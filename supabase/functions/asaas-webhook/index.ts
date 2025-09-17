import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[ASAAS-WEBHOOK] Processando webhook...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar token do webhook (opcional - adicionar validação se necessário)
    const accessToken = req.headers.get('asaas-access-token');
    console.log('[ASAAS-WEBHOOK] Access token presente:', !!accessToken);

    const webhookData = await req.json();
    console.log('[ASAAS-WEBHOOK] Evento recebido:', webhookData.event);

    const { event, payment, subscription } = webhookData;
    
    // Eventos de CHECKOUT_* e SUBSCRIPTION_* geralmente não têm dados de pagamento
    if (!payment || !payment.id) {
      if (event && event.startsWith('CHECKOUT_')) {
        console.log('[ASAAS-WEBHOOK] Evento de checkout recebido:', event);
        return await handleCheckoutEvent(supabase, event, webhookData);
      }
      
      if (event && event.startsWith('SUBSCRIPTION_')) {
        console.log('[ASAAS-WEBHOOK] Evento de subscription recebido:', event);
        return await handleSubscriptionEvent(supabase, event, subscription);
      }
      
      console.log('[ASAAS-WEBHOOK] Evento sem dados de pagamento:', event);
      return new Response(JSON.stringify({
        received: true,
        ignored: true,
        reason: 'event_without_payment'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Buscar pagamento no banco (pode não existir ainda se usamos Checkout)
    const { data: existingPayment } = await supabase
      .from('poupeja_asaas_payments')
      .select('*, user_id')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle();

    let userId = existingPayment?.user_id as string | undefined;

    if (!existingPayment) {
      console.log('[ASAAS-WEBHOOK] Pagamento não encontrado no banco, tentando mapear pelo customer:', payment.customer);

      // Tentar descobrir o usuário pelo asaas_customer_id
      const { data: asaasCustomerRow } = await supabase
        .from('poupeja_asaas_customers')
        .select('user_id')
        .eq('asaas_customer_id', payment.customer)
        .maybeSingle();

      if (!asaasCustomerRow?.user_id) {
        console.warn('[ASAAS-WEBHOOK] Não foi possível mapear o usuário pelo customer. Ignorando evento.', { paymentId: payment.id });
        return new Response(JSON.stringify({ received: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      userId = asaasCustomerRow.user_id;

      // Inserir pagamento agora que temos o userId
      const paymentRow = {
        user_id: userId,
        asaas_payment_id: payment.id,
        asaas_customer_id: payment.customer,
        status: payment.status,
        amount: payment.value,
        due_date: payment.dueDate,
        method: 'CHECKOUT',
        description: payment.description || null,
        external_reference: payment.externalReference || null,
        invoice_url: payment.invoiceUrl || null,
        bank_slip_url: payment.bankSlipUrl || null
      };

      const { data: inserted } = await supabase
        .from('poupeja_asaas_payments')
        .insert(paymentRow)
        .select('*')
        .single();

      console.log('[ASAAS-WEBHOOK] Pagamento inserido a partir do webhook:', payment.id);

      // Prosseguir usando o registro recém-criado
      return await processPaymentEvent(supabase, userId, payment, inserted, event);
    }

    // Prosseguir processamento normal quando já existe
    return await processPaymentEvent(supabase, userId!, payment, existingPayment, event);

  } catch (error) {
    console.error('[ASAAS-WEBHOOK] Erro:', error.message);
    return new Response(JSON.stringify({
      error: error.message,
      received: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

async function processPaymentEvent(supabase: any, userId: string, payment: any, existingPayment: any, event: string) {
  console.log(`[ASAAS-WEBHOOK] Processando evento: ${event} | Payment ID: ${payment.id} | Status: ${payment.status} | User: ${userId}`);
  
  // Mapear status do Asaas para status da aplicação
  const statusMapping: Record<string, string> = {
    'PENDING': 'pending',
    'RECEIVED': 'active', 
    'CONFIRMED': 'active',
    'OVERDUE': 'past_due',
    'REFUNDED': 'cancelled',
    'RECEIVED_IN_CASH': 'active',
    'AWAITING_RISK_ANALYSIS': 'pending'
  };

  const newStatus = statusMapping[payment.status] || 'pending';
  console.log(`[ASAAS-WEBHOOK] Mapeamento de status: ${payment.status} → ${newStatus}`);

  // Atualizar pagamento
  const { error: updateError } = await supabase
    .from('poupeja_asaas_payments')
    .update({
      status: payment.status,
      payment_date: payment.paymentDate || null,
      updated_at: new Date().toISOString()
    })
    .eq('asaas_payment_id', payment.id);

  if (updateError) {
    console.error('[ASAAS-WEBHOOK] Erro ao atualizar pagamento:', updateError);
  } else {
    console.log('[ASAAS-WEBHOOK] ✅ Pagamento atualizado com sucesso');
  }

  // Processar mudanças na assinatura baseado no evento
  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
    console.log('[ASAAS-WEBHOOK] 🎉 PAGAMENTO CONFIRMADO VIA CARTÃO! Processando ativação da assinatura...');
    console.log('[ASAAS-WEBHOOK] Evento:', event, '| Status do pagamento:', payment.status);
    await handlePaymentSuccess(supabase, userId, payment, existingPayment);
  } else if (event === 'PAYMENT_UPDATED' && (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED')) {
    console.log('[ASAAS-WEBHOOK] 🔄 PAYMENT_UPDATED com status confirmado! Processando ativação...');
    console.log('[ASAAS-WEBHOOK] Status atualizado para:', payment.status);
    await handlePaymentSuccess(supabase, userId, payment, existingPayment);
  } else if (event === 'PAYMENT_OVERDUE') {
    console.log('[ASAAS-WEBHOOK] ⚠️ Pagamento em atraso, processando...');
    await handlePaymentOverdue(supabase, userId, payment);
  } else if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') {
    console.log('[ASAAS-WEBHOOK] ❌ Pagamento cancelado/reembolsado, processando...');
    await handlePaymentCancelled(supabase, userId);
  } else {
    console.log('[ASAAS-WEBHOOK] ℹ️ Evento não requer ação na assinatura:', event);
  }

  console.log('[ASAAS-WEBHOOK] ✅ Webhook processado com sucesso');

  return new Response(JSON.stringify({
    received: true,
    event,
    status: newStatus,
    payment_id: payment.id,
    user_id: userId
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handlePaymentSuccess(supabase: any, userId: string, payment: any, existingPayment: any) {
  console.log('[ASAAS-WEBHOOK] Processando pagamento recebido para usuário:', userId);

  // Determinar tipo de plano baseado na referência externa ou valor
  let planType: 'monthly' | 'annual' = 'monthly';
  const ref = existingPayment.external_reference || payment.externalReference || '';
  if (ref.includes('annual')) planType = 'annual';
  else if (ref.includes('monthly')) planType = 'monthly';
  else {
    // Fallback: comparar valores com configurações públicas
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
    asaas_subscription_id: payment.subscription || payment.id, // Usar ID da subscription ou do payment
    status: 'active',
    plan_type: planType,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: false,
    payment_processor: 'asaas',
    grace_period_end: null, // Limpar período de carência
    updated_at: new Date().toISOString()
  };

  if (existingSubscription) {
    // Atualizar assinatura existente
    await supabase
      .from('poupeja_subscriptions')
      .update(subscriptionData)
      .eq('id', existingSubscription.id);
    
    console.log('[ASAAS-WEBHOOK] Assinatura atualizada:', existingSubscription.id);
  } else {
    // Criar nova assinatura
    await supabase
      .from('poupeja_subscriptions')
      .insert(subscriptionData);
    
    console.log('[ASAAS-WEBHOOK] Nova assinatura criada para usuário:', userId);
  }
}

async function handlePaymentOverdue(supabase: any, userId: string, payment: any) {
  console.log('[ASAAS-WEBHOOK] Processando pagamento em atraso para usuário:', userId);

  const now = new Date();
  
  // Definir carência de 3 dias
  const gracePeriodEnd = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000)).toISOString();

  // Atualizar status para past_due com período de carência
  await supabase
    .from('poupeja_subscriptions')
    .update({
      status: 'past_due',
      grace_period_end: gracePeriodEnd,
      updated_at: now.toISOString()
    })
    .eq('user_id', userId);

  console.log('[ASAAS-WEBHOOK] Status atualizado para past_due com carência até:', gracePeriodEnd);
}

async function handlePaymentCancelled(supabase: any, userId: string) {
  console.log('[ASAAS-WEBHOOK] Processando cancelamento para usuário:', userId);

  // Cancelar assinatura
  await supabase
    .from('poupeja_subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  console.log('[ASAAS-WEBHOOK] Assinatura cancelada para usuário:', userId);
}

async function handleSubscriptionEvent(supabase: any, event: string, subscription: any) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  console.log('[ASAAS-WEBHOOK] Processando evento de subscription:', event, 'ID:', subscription?.id);
  
  if (!subscription?.id || !subscription?.customer) {
    console.log('[ASAAS-WEBHOOK] Dados de subscription incompletos, ignorando');
    return new Response(JSON.stringify({
      received: true,
      ignored: true,
      reason: 'incomplete_subscription_data'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Mapear customer para user_id
  const { data: asaasCustomerRow } = await supabase
    .from('poupeja_asaas_customers')
    .select('user_id')
    .eq('asaas_customer_id', subscription.customer)
    .maybeSingle();

  if (!asaasCustomerRow?.user_id) {
    console.log('[ASAAS-WEBHOOK] Customer não encontrado:', subscription.customer);
    return new Response(JSON.stringify({
      received: true,
      ignored: true,
      reason: 'customer_not_found'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const userId = asaasCustomerRow.user_id;
  console.log('[ASAAS-WEBHOOK] Subscription mapeada para usuário:', userId);

  // Mapear eventos para status
  let status = 'pending';
  let cancelAtPeriodEnd = false;

  switch (event) {
    case 'SUBSCRIPTION_CREATED':
      status = 'pending';
      break;
    case 'SUBSCRIPTION_ACTIVATED':
    case 'SUBSCRIPTION_ENABLED':
      status = 'active';
      break;
    case 'SUBSCRIPTION_UPDATED':
      status = 'active'; // Manter ativo se já estava
      break;
    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_CANCELLED':
      status = 'cancelled';
      cancelAtPeriodEnd = true;
      break;
    default:
      console.log('[ASAAS-WEBHOOK] Evento de subscription não tratado:', event);
      status = 'pending';
  }

  // Inferir plan_type do cycle ou value
  let planType: 'monthly' | 'annual' = 'monthly';
  if (subscription.cycle) {
    planType = subscription.cycle === 'YEARLY' ? 'annual' : 'monthly';
  } else if (subscription.value) {
    // Fallback: comparar com preços conhecidos
    const value = parseFloat(subscription.value);
    planType = value > 100 ? 'annual' : 'monthly'; // Heurística simples
  }

  const subscriptionData = {
    user_id: userId,
    asaas_subscription_id: subscription.id,
    asaas_customer_id: subscription.customer,
    status,
    plan_type: planType,
    cancel_at_period_end: cancelAtPeriodEnd,
    payment_processor: 'asaas',
    current_period_start: null, // Será preenchido quando o pagamento chegar
    current_period_end: null,   // Será preenchido quando o pagamento chegar
    updated_at: new Date().toISOString()
  };

  console.log('[ASAAS-WEBHOOK] Dados da subscription para upsert:', subscriptionData);

  // Upsert subscription
  const { error: upsertError } = await supabase
    .from('poupeja_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'user_id'
    });

  if (upsertError) {
    console.error('[ASAAS-WEBHOOK] Erro ao fazer upsert da subscription:', upsertError);
    throw new Error('Erro ao processar subscription');
  }

  console.log('[ASAAS-WEBHOOK] Subscription processada com sucesso:', subscription.id);

  return new Response(JSON.stringify({
    received: true,
    event,
    subscription_id: subscription.id,
    user_id: userId,
    status
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleCheckoutEvent(supabase: any, event: string, webhookData: any) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  console.log('[ASAAS-WEBHOOK] Processando evento de checkout:', event);
  console.log('[ASAAS-WEBHOOK] Dados do webhook:', JSON.stringify(webhookData, null, 2));

  const { checkout } = webhookData;

  switch (event) {
    case 'CHECKOUT_CREATED':
      console.log('[ASAAS-WEBHOOK] 📝 Checkout criado:', checkout?.id);
      return new Response(JSON.stringify({
        received: true,
        event,
        checkout_id: checkout?.id,
        message: 'Checkout created, waiting for payment'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    case 'CHECKOUT_PAID':
      console.log('[ASAAS-WEBHOOK] 💰 CHECKOUT PAGO! Processando ativação da assinatura...');
      console.log('[ASAAS-WEBHOOK] Checkout ID:', checkout?.id);
      
      if (!checkout?.id) {
        console.error('[ASAAS-WEBHOOK] ❌ Checkout ID não encontrado no evento CHECKOUT_PAID');
        return new Response(JSON.stringify({
          received: true,
          error: 'Missing checkout ID'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Buscar pagamentos relacionados ao checkout
      try {
        const paymentsResult = await fetchCheckoutPayments(supabase, checkout.id);
        
        if (!paymentsResult.success || !paymentsResult.payments?.length) {
          console.log('[ASAAS-WEBHOOK] ⏳ Aguardando pagamentos para o checkout:', checkout.id);
          return new Response(JSON.stringify({
            received: true,
            message: 'Checkout paid event received, awaiting payment data',
            checkout_id: checkout.id
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Processar cada pagamento encontrado
        for (const payment of paymentsResult.payments) {
          console.log('[ASAAS-WEBHOOK] 🔄 Processando pagamento do checkout:', payment.id);
          
          // Verificar se já existe no banco
          const { data: existingPayment } = await supabase
            .from('poupeja_asaas_payments')
            .select('*, user_id')
            .eq('asaas_payment_id', payment.id)
            .maybeSingle();

          let userId = existingPayment?.user_id;

          if (!existingPayment) {
            // Mapear customer para user_id
            const { data: asaasCustomerRow } = await supabase
              .from('poupeja_asaas_customers')
              .select('user_id')
              .eq('asaas_customer_id', payment.customer)
              .maybeSingle();

            if (!asaasCustomerRow?.user_id) {
              console.error('[ASAAS-WEBHOOK] ❌ Customer não encontrado:', payment.customer);
              continue;
            }

            userId = asaasCustomerRow.user_id;

            // Inserir pagamento
            const paymentRow = {
              user_id: userId,
              asaas_payment_id: payment.id,
              asaas_customer_id: payment.customer,
              status: payment.status,
              amount: payment.value,
              due_date: payment.dueDate,
              method: 'CHECKOUT',
              description: payment.description || null,
              external_reference: payment.externalReference || null,
              invoice_url: payment.invoiceUrl || null,
              bank_slip_url: payment.bankSlipUrl || null,
              payment_date: payment.paymentDate || null
            };

            const { data: inserted } = await supabase
              .from('poupeja_asaas_payments')
              .insert(paymentRow)
              .select('*')
              .single();

            console.log('[ASAAS-WEBHOOK] ✅ Pagamento inserido via checkout:', payment.id);
            
            // Ativar assinatura se pagamento confirmado
            if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
              await handlePaymentSuccess(supabase, userId, payment, inserted);
            }
          } else {
            // Atualizar pagamento existente
            await supabase
              .from('poupeja_asaas_payments')
              .update({
                status: payment.status,
                payment_date: payment.paymentDate || null,
                updated_at: new Date().toISOString()
              })
              .eq('asaas_payment_id', payment.id);

            console.log('[ASAAS-WEBHOOK] ✅ Pagamento atualizado via checkout:', payment.id);
            
            // Ativar assinatura se pagamento confirmado
            if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
              await handlePaymentSuccess(supabase, userId, payment, existingPayment);
            }
          }
        }

        return new Response(JSON.stringify({
          received: true,
          event,
          checkout_id: checkout.id,
          payments_processed: paymentsResult.payments.length,
          message: 'CHECKOUT_PAID processed successfully'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      } catch (error) {
        console.error('[ASAAS-WEBHOOK] ❌ Erro ao processar CHECKOUT_PAID:', error);
        return new Response(JSON.stringify({
          received: true,
          error: error.message,
          checkout_id: checkout.id
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

    case 'CHECKOUT_EXPIRED':
      console.log('[ASAAS-WEBHOOK] ⏰ Checkout expirado:', checkout?.id);
      return new Response(JSON.stringify({
        received: true,
        event,
        checkout_id: checkout?.id,
        message: 'Checkout expired'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    case 'CHECKOUT_CANCELLED':
      console.log('[ASAAS-WEBHOOK] ❌ Checkout cancelado:', checkout?.id);
      return new Response(JSON.stringify({
        received: true,
        event,
        checkout_id: checkout?.id,
        message: 'Checkout cancelled'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    default:
      console.log('[ASAAS-WEBHOOK] ℹ️ Evento de checkout não tratado:', event);
      return new Response(JSON.stringify({
        received: true,
        event,
        message: 'Checkout event logged but not processed'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
  }
}

async function fetchCheckoutPayments(supabase: any, checkoutId: string) {
  try {
    console.log('[ASAAS-WEBHOOK] 🔍 Buscando pagamentos para checkout:', checkoutId);
    
    // Buscar configuração da API do Asaas
    const { data: asaasConfig } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas')
      .in('key', ['api_key', 'environment']);

    if (!asaasConfig?.length) {
      throw new Error('Configuração do Asaas não encontrada');
    }

    const apiKey = asaasConfig.find((c: any) => c.key === 'api_key')?.value;
    const environment = asaasConfig.find((c: any) => c.key === 'environment')?.value || 'sandbox';

    if (!apiKey) {
      throw new Error('API key do Asaas não encontrada');
    }

    const baseUrl = environment === 'production' 
      ? 'https://api.asaas.com/api'
      : 'https://sandbox.asaas.com/api';

    // Buscar pagamentos do checkout via API do Asaas
    const response = await fetch(`${baseUrl}/v3/payments?checkout=${checkoutId}`, {
      method: 'GET',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ASAAS-WEBHOOK] ❌ Erro da API Asaas:', response.status, response.statusText);
      console.error('[ASAAS-WEBHOOK] ❌ Resposta de erro:', errorText);
      throw new Error(`Erro da API Asaas: ${response.status} - ${response.statusText}`);
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      const responseText = await response.text();
      console.error('[ASAAS-WEBHOOK] ❌ Erro ao fazer parse do JSON:', parseError);
      console.error('[ASAAS-WEBHOOK] ❌ Resposta recebida:', responseText);
      throw new Error(`Erro ao fazer parse da resposta: ${parseError.message}`);
    }
    console.log('[ASAAS-WEBHOOK] 📊 Resposta da API Asaas:', JSON.stringify(result, null, 2));

    return {
      success: true,
      payments: result.data || []
    };

  } catch (error) {
    console.error('[ASAAS-WEBHOOK] ❌ Erro ao buscar pagamentos do checkout:', error);
    return {
      success: false,
      error: error.message,
      payments: []
    };
  }
}