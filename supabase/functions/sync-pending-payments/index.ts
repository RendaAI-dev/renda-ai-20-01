import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[SYNC-PENDING-PAYMENTS] Iniciando sincronização de pagamentos pendentes');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar configurações do Asaas
    const { data: asaasSettings, error: settingsError } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas')
      .in('key', ['api_key', 'environment']);

    if (settingsError) {
      throw new Error('Erro ao buscar configurações do Asaas');
    }

    const asaasApiKey = asaasSettings.find(s => s.key === 'api_key')?.value;
    const asaasEnvironment = asaasSettings.find(s => s.key === 'environment')?.value || 'sandbox';
    
    if (!asaasApiKey) {
      throw new Error('Chave API do Asaas não configurada');
    }

    const asaasUrl = asaasEnvironment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    // Buscar pagamentos pendentes há mais de 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: pendingPayments, error: paymentsError } = await supabase
      .from('poupeja_asaas_payments')
      .select('*')
      .eq('status', 'PENDING')
      .lt('created_at', fiveMinutesAgo)
      .limit(50);

    if (paymentsError) {
      throw new Error('Erro ao buscar pagamentos pendentes');
    }

    console.log(`[SYNC-PENDING-PAYMENTS] Encontrados ${pendingPayments?.length || 0} pagamentos pendentes para verificar`);

    let processedCount = 0;
    let updatedCount = 0;
    let confirmedCount = 0;

    if (pendingPayments && pendingPayments.length > 0) {
      for (const payment of pendingPayments) {
        try {
          console.log(`[SYNC-PENDING-PAYMENTS] Verificando pagamento: ${payment.asaas_payment_id}`);
          
          // Consultar status atual no Asaas
          const response = await fetch(`${asaasUrl}/payments/${payment.asaas_payment_id}`, {
            headers: {
              'access_token': asaasApiKey,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            console.error(`[SYNC-PENDING-PAYMENTS] Erro ao consultar pagamento ${payment.asaas_payment_id}: ${response.status}`);
            continue;
          }

          const asaasPayment = await response.json();
          processedCount++;

          console.log(`[SYNC-PENDING-PAYMENTS] Status atual do pagamento ${payment.asaas_payment_id}: ${asaasPayment.status}`);

          // Se o status mudou, atualizar no banco
          if (asaasPayment.status !== payment.status) {
            console.log(`[SYNC-PENDING-PAYMENTS] ✅ Status alterado de ${payment.status} para ${asaasPayment.status}`);
            
            // Atualizar pagamento no banco
            await supabase
              .from('poupeja_asaas_payments')
              .update({
                status: asaasPayment.status,
                payment_date: asaasPayment.paymentDate || null,
                invoice_url: asaasPayment.invoiceUrl || payment.invoice_url,
                updated_at: new Date().toISOString()
              })
              .eq('asaas_payment_id', payment.asaas_payment_id);

            updatedCount++;

            // Se foi confirmado, processar como pagamento bem sucedido
            if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(asaasPayment.status)) {
              console.log(`[SYNC-PENDING-PAYMENTS] 🎉 Pagamento confirmado: ${payment.asaas_payment_id}`);
              
              await processConfirmedPayment(supabase, payment.user_id, asaasPayment, payment);
              confirmedCount++;
            }
          }

          // Pequena pausa para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`[SYNC-PENDING-PAYMENTS] Erro ao processar pagamento ${payment.asaas_payment_id}:`, error.message);
        }
      }
    }

    console.log(`[SYNC-PENDING-PAYMENTS] ✅ Sincronização concluída: ${processedCount} verificados, ${updatedCount} atualizados, ${confirmedCount} confirmados`);

    return new Response(JSON.stringify({
      success: true,
      pendingPayments: pendingPayments?.length || 0,
      processedCount,
      updatedCount,
      confirmedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[SYNC-PENDING-PAYMENTS] Erro:', error.message);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Processar pagamento confirmado
async function processConfirmedPayment(supabase: any, userId: string, asaasPayment: any, paymentRecord: any) {
  console.log(`[SYNC-PENDING-PAYMENTS] Processando pagamento confirmado para usuário: ${userId}`);

  try {
    // Verificar se é uma mudança de plano
    const { data: planChangeRequest } = await supabase
      .from('poupeja_plan_change_requests')
      .select('*')
      .eq('asaas_payment_id', asaasPayment.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (planChangeRequest) {
      console.log(`[SYNC-PENDING-PAYMENTS] 🔄 Processando mudança de plano: ${planChangeRequest.id}`);
      await handlePlanChangePayment(supabase, planChangeRequest, asaasPayment);
      return;
    }

    // Processar como nova assinatura ou renovação
    await handlePaymentSuccess(supabase, userId, asaasPayment, paymentRecord);
    
  } catch (error) {
    console.error(`[SYNC-PENDING-PAYMENTS] Erro ao processar pagamento confirmado:`, error.message);
  }
}

// Função para processar sucesso do pagamento (replicada do webhook)
async function handlePaymentSuccess(supabase: any, userId: string, payment: any, existingPayment: any) {
  console.log(`[SYNC-PENDING-PAYMENTS] Ativando assinatura para usuário: ${userId}`);

  // Determinar tipo de plano
  let planType: 'monthly' | 'annual' = 'monthly';
  const ref = existingPayment.external_reference || payment.externalReference || '';
  if (ref.includes('annual')) planType = 'annual';
  else if (ref.includes('monthly')) planType = 'monthly';
  else {
    // Fallback: comparar valores
    const { data: priceSettings } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'pricing')
      .in('key', ['plan_price_monthly', 'plan_price_annual']);

    const normalize = (v?: string | null) => {
      if (!v) return 0;
      const s = String(v).replace(/\./g, '').replace(',', '.');
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    const monthly = normalize(priceSettings?.find((s: any) => s.key === 'plan_price_monthly')?.value);
    const annual = normalize(priceSettings?.find((s: any) => s.key === 'plan_price_annual')?.value);

    const diffMonthly = Math.abs((payment.value ?? 0) - monthly);
    const diffAnnual = Math.abs((payment.value ?? 0) - annual);
    planType = diffAnnual < diffMonthly ? 'annual' : 'monthly';
  }

  const periodDays = planType === 'annual' ? 365 : 30;
  const now = new Date();
  const currentPeriodStart = now.toISOString();
  const currentPeriodEnd = new Date(now.getTime() + (periodDays * 24 * 60 * 60 * 1000)).toISOString();

  // Buscar assinatura existente
  const { data: existingSubscription } = await supabase
    .from('poupeja_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const subscriptionData = {
    user_id: userId,
    asaas_customer_id: existingPayment.asaas_customer_id,
    asaas_subscription_id: payment.subscription || payment.id,
    status: 'active',
    plan_type: planType,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: false,
    payment_processor: 'asaas',
    grace_period_end: null,
    updated_at: new Date().toISOString()
  };

  if (existingSubscription) {
    await supabase
      .from('poupeja_subscriptions')
      .update(subscriptionData)
      .eq('id', existingSubscription.id);
    
    console.log(`[SYNC-PENDING-PAYMENTS] ✅ Assinatura atualizada: ${existingSubscription.id}`);
  } else {
    const { data: newSubscription } = await supabase
      .from('poupeja_subscriptions')
      .insert(subscriptionData)
      .select('*')
      .single();
    
    console.log(`[SYNC-PENDING-PAYMENTS] ✅ Nova assinatura criada: ${newSubscription?.id}`);
  }
}

// Função para processar mudança de plano (replicada do webhook)
async function handlePlanChangePayment(supabase: any, changeRequest: any, payment: any) {
  console.log(`[SYNC-PENDING-PAYMENTS] Confirmando mudança de plano: ${changeRequest.id}`);

  try {
    // Buscar configurações do Asaas
    const { data: settings } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas');

    const asaasConfig = settings?.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {}) ?? {};

    const apiKey = asaasConfig.api_key;
    const environment = asaasConfig.environment || 'sandbox';
    
    if (!apiKey) {
      throw new Error('Chave API do Asaas não configurada');
    }

    const asaasUrl = environment === 'production' 
      ? 'https://www.asaas.com/api/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    // Buscar assinatura atual
    const { data: subscription } = await supabase
      .from('poupeja_subscriptions')
      .select('*')
      .eq('id', changeRequest.subscription_id)
      .single();

    if (!subscription) {
      throw new Error('Assinatura não encontrada');
    }

    const newCycle = changeRequest.new_plan_type === 'monthly' ? 'MONTHLY' : 'YEARLY';

    // Atualizar assinatura no Asaas
    const response = await fetch(`${asaasUrl}/subscriptions/${subscription.asaas_subscription_id}`, {
      method: 'PUT',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: changeRequest.new_plan_value,
        cycle: newCycle,
        billingType: 'CREDIT_CARD',
        updatePendingPayments: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao atualizar assinatura no Asaas: ${error}`);
    }

    // Atualizar assinatura no Supabase
    await supabase
      .from('poupeja_subscriptions')
      .update({
        plan_type: changeRequest.new_plan_type,
        updated_at: new Date().toISOString()
      })
      .eq('id', changeRequest.subscription_id);

    // Marcar solicitação como paga
    await supabase
      .from('poupeja_plan_change_requests')
      .update({
        status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', changeRequest.id);

    console.log(`[SYNC-PENDING-PAYMENTS] ✅ Mudança de plano confirmada com sucesso`);

  } catch (error) {
    console.error(`[SYNC-PENDING-PAYMENTS] Erro ao processar mudança de plano:`, error.message);
    
    // Marcar solicitação como erro
    await supabase
      .from('poupeja_plan_change_requests')
      .update({
        status: 'error',
        updated_at: new Date().toISOString()
      })
      .eq('id', changeRequest.id);
  }
}