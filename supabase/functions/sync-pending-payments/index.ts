import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, forceSync } = await req.json().catch(() => ({}));
    
    console.log(`[SYNC-PENDING-PAYMENTS] Iniciando sincronização - Email: ${email || 'todos'}, ForceSync: ${forceSync}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
    const asaasEnvironment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
    
    if (!asaasApiKey) {
      throw new Error('Chave API do Asaas não configurada');
    }

    const asaasUrl = asaasEnvironment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://api-sandbox.asaas.com/v3';

    // Configurar query baseada nos filtros
    let query = supabase
      .from('poupeja_asaas_payments')
      .select(`
        *,
        poupeja_users!inner(email)
      `)
      .eq('status', 'PENDING');

    if (email) {
      query = query.eq('poupeja_users.email', email);
    } else if (!forceSync) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      query = query.lt('created_at', fiveMinutesAgo);
    }
    
    const { data: pendingPayments, error: paymentsError } = await query.limit(50);

    if (paymentsError) {
      throw new Error('Erro ao buscar pagamentos pendentes');
    }

    console.log(`[SYNC-PENDING-PAYMENTS] Encontrados ${pendingPayments?.length || 0} pagamentos pendentes`);

    let updatedCount = 0;
    let confirmedCount = 0;
    let results = [];

    for (const payment of pendingPayments || []) {
      try {
        console.log(`[SYNC-PENDING-PAYMENTS] Verificando pagamento: ${payment.asaas_payment_id}`);
        
        const response = await fetch(`${asaasUrl}/payments/${payment.asaas_payment_id}`, {
          headers: {
            'access_token': asaasApiKey,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error(`[SYNC-PENDING-PAYMENTS] Erro ao consultar pagamento ${payment.asaas_payment_id}: ${response.status}`);
          results.push({
            paymentId: payment.asaas_payment_id,
            status: 'error',
            message: 'Erro ao consultar Asaas'
          });
          continue;
        }

        const asaasPayment = await response.json();
        console.log(`[SYNC-PENDING-PAYMENTS] Status atual: ${asaasPayment.status}`);

        if (asaasPayment.status !== payment.status) {
          await supabase
            .from('poupeja_asaas_payments')
            .update({
              status: asaasPayment.status,
              payment_date: asaasPayment.paymentDate || null,
              updated_at: new Date().toISOString()
            })
            .eq('asaas_payment_id', payment.asaas_payment_id);

          updatedCount++;
          results.push({
            paymentId: payment.asaas_payment_id,
            oldStatus: payment.status,
            newStatus: asaasPayment.status,
            updated: true
          });

          if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(asaasPayment.status)) {
            await processConfirmedPayment(supabase, payment.user_id, asaasPayment, payment);
            confirmedCount++;
            results[results.length - 1].processed = true;
          }
        } else {
          results.push({
            paymentId: payment.asaas_payment_id,
            status: asaasPayment.status,
            updated: false
          });
        }

        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[SYNC-PENDING-PAYMENTS] Erro ao processar:`, error);
        results.push({
          paymentId: payment.asaas_payment_id,
          status: 'error',
          message: error.message
        });
      }
    }

    console.log(`[SYNC-PENDING-PAYMENTS] ✅ Concluída: ${updatedCount} atualizados, ${confirmedCount} confirmados`);

    return new Response(JSON.stringify({
      success: true,
      details: {
        verified: pendingPayments?.length || 0,
        updated: updatedCount,
        confirmed: confirmedCount
      },
      results,
      environment: asaasEnvironment
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[SYNC-PENDING-PAYMENTS] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processConfirmedPayment(supabase: any, userId: string, asaasPayment: any, paymentRecord: any) {
  console.log(`[SYNC-PENDING-PAYMENTS] Processando pagamento confirmado: ${asaasPayment.id}`);

  try {
    // Verificar mudança de plano
    const { data: planChange } = await supabase
      .from('poupeja_plan_change_requests')
      .select('*')
      .eq('asaas_payment_id', asaasPayment.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (planChange) {
      await handlePlanChange(supabase, planChange, asaasPayment);
      return;
    }

    // Nova assinatura ou renovação
    await handlePaymentSuccess(supabase, userId, asaasPayment, paymentRecord);
    
  } catch (error) {
    console.error(`[SYNC-PENDING-PAYMENTS] Erro ao processar confirmação:`, error);
  }
}

async function handlePaymentSuccess(supabase: any, userId: string, payment: any, existingPayment: any) {
  console.log(`[SYNC-PENDING-PAYMENTS] Ativando assinatura: ${userId}`);

  const planType = existingPayment.external_reference?.includes('annual') ? 'annual' : 'monthly';
  const periodDays = planType === 'annual' ? 365 : 30;
  const now = new Date();
  const currentPeriodEnd = new Date(now.getTime() + (periodDays * 24 * 60 * 60 * 1000));

  const subscriptionData = {
    user_id: userId,
    asaas_customer_id: existingPayment.asaas_customer_id,
    asaas_subscription_id: payment.subscription || payment.id,
    status: 'active',
    plan_type: planType,
    current_period_start: now.toISOString(),
    current_period_end: currentPeriodEnd.toISOString(),
    cancel_at_period_end: false,
    payment_processor: 'asaas',
    updated_at: now.toISOString()
  };

  const { data: existingSubscription } = await supabase
    .from('poupeja_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingSubscription) {
    await supabase
      .from('poupeja_subscriptions')
      .update(subscriptionData)
      .eq('id', existingSubscription.id);
  } else {
    await supabase
      .from('poupeja_subscriptions')
      .insert(subscriptionData);
  }

  console.log(`[SYNC-PENDING-PAYMENTS] ✅ Assinatura ativada`);
}

async function handlePlanChange(supabase: any, changeRequest: any, payment: any) {
  console.log(`[SYNC-PENDING-PAYMENTS] Processando mudança de plano: ${changeRequest.id}`);

  await supabase
    .from('poupeja_subscriptions')
    .update({
      plan_type: changeRequest.new_plan_type,
      updated_at: new Date().toISOString()
    })
    .eq('id', changeRequest.subscription_id);

  await supabase
    .from('poupeja_plan_change_requests')
    .update({
      status: 'paid',
      updated_at: new Date().toISOString()
    })
    .eq('id', changeRequest.id);

  console.log(`[SYNC-PENDING-PAYMENTS] ✅ Mudança de plano confirmada`);
}