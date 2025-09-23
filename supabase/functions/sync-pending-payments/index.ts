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
    console.log('[SYNC-PENDING-PAYMENTS] Iniciando sincronização de pagamentos pendentes...');

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

    // Buscar pagamentos pendentes que foram criados há mais de 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: pendingPayments, error: paymentError } = await supabase
      .from('poupeja_asaas_payments')
      .select('*')
      .eq('status', 'PENDING')
      .lt('created_at', fiveMinutesAgo)
      .limit(50);

    if (paymentError) {
      throw new Error(`Erro ao buscar pagamentos pendentes: ${paymentError.message}`);
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      console.log('[SYNC-PENDING-PAYMENTS] Nenhum pagamento pendente encontrado para sincronizar');
      return new Response(JSON.stringify({
        success: true,
        processedPayments: 0,
        confirmedPayments: 0,
        message: 'Nenhum pagamento pendente encontrado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[SYNC-PENDING-PAYMENTS] Encontrados ${pendingPayments.length} pagamentos pendentes para verificar`);

    let processedPayments = 0;
    let confirmedPayments = 0;

    // Processar cada pagamento pendente
    for (const payment of pendingPayments) {
      try {
        console.log(`[SYNC-PENDING-PAYMENTS] Verificando status do pagamento: ${payment.asaas_payment_id}`);

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
        const currentStatus = asaasPayment.status;

        console.log(`[SYNC-PENDING-PAYMENTS] Status atual do pagamento ${payment.asaas_payment_id}: ${currentStatus}`);

        // Atualizar status na base local se mudou
        if (currentStatus !== payment.status) {
          const { error: updateError } = await supabase
            .from('poupeja_asaas_payments')
            .update({
              status: currentStatus,
              payment_date: asaasPayment.paymentDate || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.id);

          if (updateError) {
            console.error(`[SYNC-PENDING-PAYMENTS] Erro ao atualizar pagamento ${payment.asaas_payment_id}:`, updateError);
            continue;
          }

          console.log(`[SYNC-PENDING-PAYMENTS] ✅ Status atualizado: ${payment.asaas_payment_id} ${payment.status} → ${currentStatus}`);
          processedPayments++;

          // Se foi confirmado, processar confirmação
          if (currentStatus === 'CONFIRMED' || currentStatus === 'RECEIVED') {
            console.log(`[SYNC-PENDING-PAYMENTS] 🎯 Pagamento confirmado: ${payment.asaas_payment_id}`);
            
            await processConfirmedPayment(supabase, payment.user_id, asaasPayment, payment);
            confirmedPayments++;
          }
        } else {
          console.log(`[SYNC-PENDING-PAYMENTS] Status sem alteração: ${payment.asaas_payment_id} (${currentStatus})`);
        }

      } catch (error) {
        console.error(`[SYNC-PENDING-PAYMENTS] Erro ao processar pagamento ${payment.asaas_payment_id}:`, error);
        continue;
      }
    }

    console.log(`[SYNC-PENDING-PAYMENTS] ✅ Sincronização concluída: ${processedPayments} atualizados, ${confirmedPayments} confirmados`);

    return new Response(JSON.stringify({
      success: true,
      processedPayments,
      confirmedPayments,
      totalChecked: pendingPayments.length,
      message: `Sincronização concluída: ${confirmedPayments} pagamentos confirmados`
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

// Processar pagamento confirmado
async function processConfirmedPayment(supabase: any, userId: string, asaasPayment: any, paymentRecord: any) {
  try {
    console.log(`[SYNC-PENDING-PAYMENTS] Processando confirmação para usuário: ${userId}`);

    // Verificar se há solicitação de mudança de plano pendente
    const { data: planChangeRequest } = await supabase
      .from('poupeja_plan_change_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('asaas_payment_id', asaasPayment.id)
      .eq('status', 'pending')
      .single();

    if (planChangeRequest) {
      console.log('[SYNC-PENDING-PAYMENTS] Processando mudança de plano...');
      await handlePlanChangePayment(supabase, planChangeRequest, asaasPayment);
    } else {
      console.log('[SYNC-PENDING-PAYMENTS] Processando pagamento de assinatura...');
      await handlePaymentSuccess(supabase, userId, asaasPayment, paymentRecord);
    }

  } catch (error) {
    console.error('[SYNC-PENDING-PAYMENTS] Erro ao processar confirmação:', error);
    throw error;
  }
}

// Processar sucesso de pagamento
async function handlePaymentSuccess(supabase: any, userId: string, payment: any, existingPayment: any) {
  console.log(`[SYNC-PENDING-PAYMENTS] Ativando assinatura para usuário: ${userId}`);

  // Determinar tipo de plano baseado no valor
  const planType = payment.value <= 50 ? 'monthly' : 'annual';
  
  // Calcular datas do período
  const now = new Date();
  const periodEnd = new Date();
  
  if (planType === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  // Buscar assinatura existente do usuário
  const { data: existingSubscription } = await supabase
    .from('poupeja_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existingSubscription) {
    // Atualizar assinatura existente
    const { error: updateError } = await supabase
      .from('poupeja_subscriptions')
      .update({
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`Erro ao atualizar assinatura: ${updateError.message}`);
    }

    console.log('[SYNC-PENDING-PAYMENTS] ✅ Assinatura atualizada para ativa');
  } else {
    // Criar nova assinatura
    const { error: insertError } = await supabase
      .from('poupeja_subscriptions')
      .insert({
        user_id: userId,
        asaas_subscription_id: payment.subscription || null,
        asaas_customer_id: payment.customer,
        plan_type: planType,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        payment_processor: 'asaas'
      });

    if (insertError) {
      throw new Error(`Erro ao criar assinatura: ${insertError.message}`);
    }

    console.log('[SYNC-PENDING-PAYMENTS] ✅ Nova assinatura criada');
  }
}

// Processar mudança de plano
async function handlePlanChangePayment(supabase: any, changeRequest: any, payment: any) {
  console.log(`[SYNC-PENDING-PAYMENTS] Processando mudança de plano: ${changeRequest.id}`);

  try {
    // Atualizar status da solicitação
    const { error: updateRequestError } = await supabase
      .from('poupeja_plan_change_requests')
      .update({
        status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', changeRequest.id);

    if (updateRequestError) {
      throw new Error(`Erro ao atualizar solicitação: ${updateRequestError.message}`);
    }

    // Atualizar assinatura do usuário
    const periodEnd = new Date();
    if (changeRequest.new_plan_type === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const { error: updateSubscriptionError } = await supabase
      .from('poupeja_subscriptions')
      .update({
        plan_type: changeRequest.new_plan_type,
        status: 'active',
        current_period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', changeRequest.subscription_id);

    if (updateSubscriptionError) {
      throw new Error(`Erro ao atualizar assinatura: ${updateSubscriptionError.message}`);
    }

    console.log('[SYNC-PENDING-PAYMENTS] ✅ Mudança de plano processada com sucesso');

  } catch (error) {
    // Marcar como erro se falhou
    await supabase
      .from('poupeja_plan_change_requests')
      .update({
        status: 'error',
        updated_at: new Date().toISOString()
      })
      .eq('id', changeRequest.id);

    throw error;
  }
}