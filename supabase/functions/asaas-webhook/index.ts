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
    console.log('[ASAAS-WEBHOOK] Método:', req.method, 'URL:', req.url);
    console.log('[ASAAS-WEBHOOK] Headers recebidos:', Object.fromEntries(req.headers.entries()));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Para GET requests (health checks), responder sem validação
    if (req.method === 'GET') {
      console.log('[ASAAS-WEBHOOK] ✅ Health check - GET request');
      return new Response('Webhook ok', {
        status: 200,
        headers: corsHeaders
      });
    }

    // VALIDAÇÃO DE TOKEN PARA POST REQUESTS
    // Tentar múltiplas fontes de token
    let accessToken = req.headers.get('asaas-access-token') ||
                     req.headers.get('access_token') ||
                     req.headers.get('authorization')?.replace('Bearer ', '') ||
                     new URL(req.url).searchParams.get('access_token');

    console.log('[ASAAS-WEBHOOK] Token encontrado:', {
      'asaas-access-token': req.headers.get('asaas-access-token'),
      'access_token': req.headers.get('access_token'), 
      'authorization': req.headers.get('authorization'),
      'query_param': new URL(req.url).searchParams.get('access_token'),
      'token_final': accessToken
    });

    if (!accessToken) {
      console.error('[ASAAS-WEBHOOK] ❌ Token ausente em todas as fontes');
      return new Response(JSON.stringify({
        error: 'Missing authorization token',
        supported_sources: ['asaas-access-token header', 'access_token header', 'Authorization Bearer', 'access_token query param']
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Buscar token configurado no banco
    const { data: webhookTokenSetting } = await supabase
      .from('poupeja_settings')
      .select('value, encrypted')
      .eq('category', 'asaas')
      .eq('key', 'webhook_token')
      .maybeSingle();

    if (!webhookTokenSetting) {
      console.error('[ASAAS-WEBHOOK] ❌ Token do webhook não configurado no sistema');
      return new Response(JSON.stringify({
        error: 'Webhook token not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Lógica melhorada de descriptografia com fallback
    let expectedToken = webhookTokenSetting.value;
    if (webhookTokenSetting.encrypted) {
      try {
        // Verificar se o valor realmente parece ser Base64
        const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(webhookTokenSetting.value) && 
                         webhookTokenSetting.value.length % 4 === 0;
        
        if (isBase64) {
          expectedToken = atob(webhookTokenSetting.value);
          console.log('[ASAAS-WEBHOOK] 🔓 Token descriptografado com sucesso');
        } else {
          // Token não está em Base64, usar diretamente
          expectedToken = webhookTokenSetting.value;
          console.log('[ASAAS-WEBHOOK] ⚠️ Token marcado como encrypted mas não é Base64, usando diretamente');
        }
      } catch (error) {
        // Se falhar a descriptografia, tentar usar o valor direto
        console.warn('[ASAAS-WEBHOOK] ⚠️ Falha na descriptografia, usando token diretamente:', error.message);
        expectedToken = webhookTokenSetting.value;
      }
    }

    console.log('[ASAAS-WEBHOOK] 🔍 Comparação de tokens:', {
      received: accessToken,
      expected: expectedToken,
      encrypted_flag: webhookTokenSetting.encrypted,
      tokens_match: accessToken === expectedToken
    });

    // Validar token
    if (accessToken !== expectedToken) {
      console.error('[ASAAS-WEBHOOK] ❌ Token inválido:', {
        received: accessToken,
        expected: expectedToken,
        match: false
      });
      return new Response(JSON.stringify({
        error: 'Invalid authorization token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('[ASAAS-WEBHOOK] ✅ Token validado com sucesso');

    const webhookData = await req.json();
    const { event, payment, checkout } = webhookData;
    
  console.log('[ASAAS-WEBHOOK] 🚀 EVENTO RECEBIDO:', event, {
    paymentId: payment?.id,
    checkoutId: checkout?.id,
    customerId: payment?.customer || checkout?.customer,
    paymentStatus: payment?.status,
    paymentValue: payment?.value,
    billingType: payment?.billingType,
    subscription: payment?.subscription,
    timestamp: new Date().toISOString(),
    fullPayload: JSON.stringify({ event, payment, checkout }, null, 2)
  });

  // ✅ ADICIONAR LOG CRÍTICO: Se for evento PAYMENT_CONFIRMED, logar detalhadamente
  if (event === 'PAYMENT_CONFIRMED') {
    console.log('[ASAAS-WEBHOOK] 🎯 PAYMENT_CONFIRMED RECEBIDO:', {
      paymentId: payment?.id,
      paymentStatus: payment?.status,
      billingType: payment?.billingType,
      customerId: payment?.customer,
      paymentValue: payment?.value,
      confirmedDate: payment?.confirmedDate,
      paymentDate: payment?.paymentDate,
      subscription: payment?.subscription,
      externalReference: payment?.externalReference,
      timestamp: new Date().toISOString()
    });
  }

    // Processar eventos de CHECKOUT
    if (event?.startsWith('CHECKOUT_')) {
      return await processCheckoutEvent(supabase, event, checkout, webhookData);
    }

    // Processar eventos de PAYMENT
    if (event?.startsWith('PAYMENT_')) {
      return await processPaymentEvent(supabase, event, payment);
    }
    
    // Processar eventos de SUBSCRIPTION
    if (event?.startsWith('SUBSCRIPTION_')) {
      return await processSubscriptionEvent(supabase, event, webhookData);
    }

    console.warn('[ASAAS-WEBHOOK] Evento não suportado:', event);
    return new Response(JSON.stringify({ received: true, processed: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[ASAAS-WEBHOOK] Erro:', error.message, error.stack);
    return new Response(JSON.stringify({
      error: error.message,
      received: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

// Processar eventos de CHECKOUT
async function processCheckoutEvent(supabase: any, event: string, checkout: any, webhookData: any) {
  console.log('[ASAAS-WEBHOOK] Processando evento de checkout:', event, checkout?.id);

  if (event === 'CHECKOUT_PAID') {
    // ✅ Checkout foi pago! Buscar pagamentos
    console.log('[ASAAS-WEBHOOK] ✅ Checkout pago! Buscando pagamentos...');
    
    // Aguardar 3 segundos para o Asaas processar
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Buscar pagamentos deste checkout
    const payments = await fetchCheckoutPayments(supabase, checkout.id);
    console.log('[ASAAS-WEBHOOK] Pagamentos encontrados:', payments.length);
    
    let processedCount = 0;
    
    // Processar cada pagamento encontrado
    for (const payment of payments) {
      console.log(`[ASAAS-WEBHOOK] Pagamento ${payment.id} - Status: ${payment.status}`);
      
      // Se já está confirmado, ativar assinatura
      if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(payment.status)) {
        await processPaymentFromCheckout(supabase, payment);
        processedCount++;
      }
    }
    
    return new Response(JSON.stringify({
      received: true,
      event,
      processed: true,
      checkout_id: checkout.id,
      payments_found: payments.length,
      payments_processed: processedCount
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Outros eventos de checkout (CREATED, CANCELED, EXPIRED)
  return new Response(JSON.stringify({
    received: true,
    event,
    processed: true,
    checkout_id: checkout?.id
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// Processar eventos de SUBSCRIPTION
async function processSubscriptionEvent(supabase: any, event: string, webhookData: any) {
  console.log('[ASAAS-WEBHOOK] 📋 PROCESSANDO EVENTO DE SUBSCRIPTION:', {
    event,
    timestamp: new Date().toISOString(),
    subscription: webhookData.subscription
  });

  // Processar SUBSCRIPTION_CREATED com status ACTIVE
  if (event === 'SUBSCRIPTION_CREATED' && webhookData.subscription?.status === 'ACTIVE') {
    const subscription = webhookData.subscription;
    
    console.log('[ASAAS-WEBHOOK] ✅ Confirmando assinatura ATIVA:', subscription.id);
    
    // Garantir que a assinatura está marcada como ativa no banco
    const { error } = await supabase
      .from('poupeja_subscriptions')
      .update({
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: subscription.nextDueDate
      })
      .eq('asaas_subscription_id', subscription.id);
      
    if (error) {
      console.error('[ASAAS-WEBHOOK] Erro ao confirmar assinatura:', error);
    } else {
      console.log('[ASAAS-WEBHOOK] ✅ Assinatura confirmada como ATIVA');
    }
  }
  
  return new Response(JSON.stringify({
    received: true,
    event,
    processed: true,
    message: 'Subscription event processed'
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// Buscar pagamentos via API do Asaas
async function fetchCheckoutPayments(supabase: any, checkoutId: string): Promise<any[]> {
  try {
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
    const asaasEnvironment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
    const asaasUrl = asaasEnvironment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';
    
    console.log('[ASAAS-WEBHOOK] Buscando pagamentos do checkout:', checkoutId);
    
    const response = await fetch(`${asaasUrl}/payments?checkout=${checkoutId}`, {
      headers: {
        'access_token': asaasApiKey!,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Falha ao buscar pagamentos: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data || [];
    
  } catch (error) {
    console.error('[ASAAS-WEBHOOK] Erro ao buscar pagamentos do checkout:', error.message);
    return [];
  }
}

// Processar pagamento encontrado via checkout
async function processPaymentFromCheckout(supabase: any, payment: any) {
  try {
    console.log('[ASAAS-WEBHOOK] Processando pagamento do checkout:', payment.id);

    // Buscar usuário pelo customer_id
    const { data: asaasCustomerRow } = await supabase
      .from('poupeja_asaas_customers')
      .select('user_id')
      .eq('asaas_customer_id', payment.customer)
      .maybeSingle();

    if (!asaasCustomerRow?.user_id) {
      console.warn('[ASAAS-WEBHOOK] Usuário não encontrado para customer:', payment.customer);
      return;
    }

    const userId = asaasCustomerRow.user_id;

    // Verificar se pagamento já existe
    const { data: existingPayment } = await supabase
      .from('poupeja_asaas_payments')
      .select('*')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle();

    let paymentRecord = existingPayment;

    if (!existingPayment) {
      // Inserir novo pagamento
      const paymentRow = {
        user_id: userId,
        asaas_payment_id: payment.id,
        asaas_customer_id: payment.customer,
        status: payment.status,
        amount: payment.value,
        due_date: payment.dueDate,
        payment_date: payment.paymentDate || null,
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

      paymentRecord = inserted;
      console.log('[ASAAS-WEBHOOK] Pagamento inserido:', payment.id);
    } else {
      // Atualizar pagamento existente
      await supabase
        .from('poupeja_asaas_payments')
        .update({
          status: payment.status,
          payment_date: payment.paymentDate || null,
          invoice_url: payment.invoiceUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('asaas_payment_id', payment.id);

      console.log('[ASAAS-WEBHOOK] Pagamento atualizado:', payment.id);
    }

    // Ativar assinatura se pagamento confirmado
    if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(payment.status)) {
      await handlePaymentSuccess(supabase, userId, payment, paymentRecord);
    }

  } catch (error) {
    console.error('[ASAAS-WEBHOOK] Erro ao processar pagamento do checkout:', error.message);
  }
}

// Processar eventos de PAYMENT
async function processPaymentEvent(supabase: any, event: string, payment: any) {
  if (!payment || !payment.id) {
    console.warn('[ASAAS-WEBHOOK] Dados do pagamento não encontrados');
    return new Response(JSON.stringify({ received: true, processed: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  console.log('[ASAAS-WEBHOOK] 💳 PROCESSANDO EVENTO DE PAGAMENTO:', {
    event,
    paymentId: payment.id,
    status: payment.status,
    value: payment.value,
    customer: payment.customer,
    timestamp: new Date().toISOString()
  });

  // Buscar pagamento no banco
  const { data: existingPayment } = await supabase
    .from('poupeja_asaas_payments')
    .select('*, user_id')
    .eq('asaas_payment_id', payment.id)
    .maybeSingle();

  let userId = existingPayment?.user_id as string | undefined;

  if (!existingPayment) {
    console.log('[ASAAS-WEBHOOK] Pagamento não encontrado, mapeando por customer:', payment.customer);

    // Mapear usuário pelo customer_id
    const { data: asaasCustomerRow } = await supabase
      .from('poupeja_asaas_customers')
      .select('user_id')
      .eq('asaas_customer_id', payment.customer)
      .maybeSingle();

    if (!asaasCustomerRow?.user_id) {
      console.warn('[ASAAS-WEBHOOK] Usuário não encontrado para customer:', payment.customer);
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
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
      payment_date: payment.paymentDate || null,
      method: payment.billingType || 'CREDIT_CARD',
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

    console.log('[ASAAS-WEBHOOK] Pagamento inserido:', payment.id);
    
    // Processar com registro recém-criado
    await processPaymentStatus(supabase, event, userId!, payment, inserted);
  } else {
    // Atualizar pagamento existente
    await supabase
      .from('poupeja_asaas_payments')
      .update({
        status: payment.status,
        payment_date: payment.paymentDate || null,
        invoice_url: payment.invoiceUrl || null,
        updated_at: new Date().toISOString()
      })
      .eq('asaas_payment_id', payment.id);

    console.log('[ASAAS-WEBHOOK] Pagamento atualizado:', payment.id);
    
    // Processar com registro existente
    await processPaymentStatus(supabase, event, userId!, payment, existingPayment);
  }

  return new Response(JSON.stringify({
    received: true,
    event,
    processed: true,
    payment_id: payment.id,
    user_id: userId
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// Processar status do pagamento baseado no evento
async function processPaymentStatus(supabase: any, event: string, userId: string, payment: any, paymentRecord: any) {
  console.log('[ASAAS-WEBHOOK] 📊 PROCESSANDO STATUS:', {
    event,
    userId,
    paymentId: payment.id,
    paymentStatus: payment.status,
    timestamp: new Date().toISOString()
  });

  switch (event) {
    case 'PAYMENT_CREATED':
      // Pagamento criado - salvar URL para redirecionamento
      console.log('[ASAAS-WEBHOOK] ✨ Pagamento criado:', payment.id, {
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
        paymentValue: payment.value,
        customerId: payment.customer,
        subscription: payment.subscription,
        billingType: payment.billingType
      });
      
      // Verificar se é uma mudança de plano
      const isPlanChange = !!payment.subscription;
      console.log(`[ASAAS-WEBHOOK] ${isPlanChange ? '🔄' : '💳'} Tipo de pagamento:`, 
        isPlanChange ? 'MUDANÇA DE PLANO' : 'NOVA ASSINATURA', {
          hasSubscription: isPlanChange,
          billingType: payment.billingType
        });
      
      if (isPlanChange) {
        // Verificar se existe uma solicitação de mudança de plano pendente
        const { data: planChangeRequest } = await supabase
          .from('poupeja_plan_change_requests')
          .select('*')
          .eq('asaas_payment_id', payment.id)
          .eq('status', 'pending')
          .maybeSingle();
        
        if (planChangeRequest) {
          console.log('[ASAAS-WEBHOOK] 🔄 MUDANÇA DE PLANO DETECTADA:', {
            planChangeRequestId: planChangeRequest.id,
            newPlanType: planChangeRequest.new_plan_type,
            currentPlanType: planChangeRequest.current_plan_type,
            paymentId: payment.id,
            billingType: payment.billingType,
            userId
          });
          
          // Para cartão de crédito, processar imediatamente
          if (payment.billingType === 'CREDIT_CARD') {
            console.log('[ASAAS-WEBHOOK] 💳 Cartão de crédito detectado - processando mudança imediatamente');
            await handlePlanChangePayment(supabase, planChangeRequest, payment);
            console.log('[ASAAS-WEBHOOK] ✅ MUDANÇA DE PLANO (CARTÃO) PROCESSADA com sucesso');
          } else {
            console.log(`[ASAAS-WEBHOOK] 📋 ${payment.billingType} detectado - aguardando confirmação para processar mudança`);
          }
        } else {
          console.warn('[ASAAS-WEBHOOK] ⚠️ Pagamento com subscription mas sem plan_change_request:', payment.id);
        }
      }
      
      // Salvar URL de redirecionamento para o usuário (priorizar invoiceUrl, fallback para bankSlipUrl)
      const redirectUrl = payment.invoiceUrl || payment.bankSlipUrl;
      if (redirectUrl) {
        const redirectResult = await supabase
          .from('poupeja_payment_redirects')
          .insert({
            user_id: userId,
            asaas_payment_id: payment.id,
            invoice_url: redirectUrl,
            checkout_id: payment.checkoutSession
          });
        
        if (redirectResult.error) {
          console.error(`[ASAAS-WEBHOOK] Erro ao salvar redirecionamento:`, redirectResult.error);
        } else {
          console.log(`[ASAAS-WEBHOOK] 🔗 URL de redirecionamento salva para usuário ${userId}: ${redirectUrl}`);
        }
      } else {
        console.warn(`[ASAAS-WEBHOOK] ⚠️ Nenhuma URL de redirecionamento encontrada para pagamento ${payment.id}`);
      }
      break;

    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      // Pagamento confirmado/recebido - ativar assinatura
      console.log('[ASAAS-WEBHOOK] ✅ PAGAMENTO CONFIRMADO/RECEBIDO - Verificando se precisa processar:', {
        event,
        paymentId: payment.id,
        userId,
        paymentValue: payment.value,
        paymentStatus: payment.status,
        billingType: payment.billingType,
        confirmedDate: payment.confirmedDate,
        paymentDate: payment.paymentDate,
        hasSubscription: !!payment.subscription,
        externalReference: payment.externalReference
      });
      
      // Verificar se é mudança de plano já processada
      if (payment.subscription) {
        const { data: planChangeRequest } = await supabase
          .from('poupeja_plan_change_requests')
          .select('*')
          .eq('asaas_payment_id', payment.id)
          .maybeSingle();
        
        if (planChangeRequest && planChangeRequest.status === 'paid') {
          console.log('[ASAAS-WEBHOOK] ⚠️ Mudança de plano já processada anteriormente - pulando');
          break;
        }
      }
      
      await handlePaymentSuccess(supabase, userId, payment, paymentRecord);
      
      console.log('[ASAAS-WEBHOOK] ✅ handlePaymentSuccess CONCLUÍDO para:', payment.id);
      break;

    case 'PAYMENT_UPDATED':
      // Pagamento atualizado - verificar status
      if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(payment.status)) {
        await handlePaymentSuccess(supabase, userId, payment, paymentRecord);
      } else if (payment.status === 'OVERDUE') {
        await handlePaymentOverdue(supabase, userId, payment);
      }
      break;

    case 'PAYMENT_OVERDUE':
      // Pagamento em atraso
      await handlePaymentOverdue(supabase, userId, payment);
      break;

    case 'PAYMENT_DELETED':
    case 'PAYMENT_REFUNDED':
      // Pagamento cancelado/estornado
      await handlePaymentCancelled(supabase, userId);
      break;

    default:
      console.log('[ASAAS-WEBHOOK] Evento não processado:', event);
  }
}

async function handlePaymentSuccess(supabase: any, userId: string, payment: any, existingPayment: any) {
  console.log('[ASAAS-WEBHOOK] 🎉 INICIANDO handlePaymentSuccess:', {
    userId,
    paymentId: payment.id,
    paymentValue: payment.value,
    paymentStatus: payment.status,
    existingPaymentId: existingPayment?.id,
    timestamp: new Date().toISOString()
  });

  // Verificar se é um pagamento de mudança de plano
  const { data: planChangeRequest } = await supabase
    .from('poupeja_plan_change_requests')
    .select('*')
    .eq('asaas_payment_id', payment.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (planChangeRequest) {
    console.log('[ASAAS-WEBHOOK] 🔄 MUDANÇA DE PLANO DETECTADA:', {
      planChangeRequestId: planChangeRequest.id,
      newPlanType: planChangeRequest.new_plan_type,
      currentPlanType: planChangeRequest.current_plan_type,
      paymentId: payment.id,
      userId
    });
    
    await handlePlanChangePayment(supabase, planChangeRequest, payment);
    
    console.log('[ASAAS-WEBHOOK] ✅ MUDANÇA DE PLANO PROCESSADA com sucesso');
    return;
  }

  // Fluxo normal de pagamento para novas assinaturas
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
    // Atualizar assinatura existente (especialmente se estava 'pending')
    const { error: updateError } = await supabase
      .from('poupeja_subscriptions')
      .update(subscriptionData)
      .eq('id', existingSubscription.id);
    
    if (updateError) {
      console.error('[ASAAS-WEBHOOK] ❌ ERRO ao atualizar assinatura:', updateError);
      throw updateError;
    }
    
    // Log especial se estava pendente e agora foi ativada
    if (existingSubscription.status === 'pending') {
      console.log('[ASAAS-WEBHOOK] 🎯 ASSINATURA ATIVADA - Era pending, agora está active:', {
        subscriptionId: existingSubscription.id,
        previousStatus: existingSubscription.status,
        newStatus: 'active',
        planType,
        userId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('[ASAAS-WEBHOOK] ✅ ASSINATURA ATUALIZADA:', {
        subscriptionId: existingSubscription.id,
        planType,
        userId,
        currentPeriodEnd,
        timestamp: new Date().toISOString()
      });
    }
  } else {
    // Criar nova assinatura
    const { data: newSubscription, error: insertError } = await supabase
      .from('poupeja_subscriptions')
      .insert(subscriptionData)
      .select('*')
      .single();
    
    if (insertError) {
      console.error('[ASAAS-WEBHOOK] ❌ ERRO ao criar assinatura:', insertError);
      throw insertError;
    }
    
    console.log('[ASAAS-WEBHOOK] ✅ NOVA ASSINATURA CRIADA:', {
      subscriptionId: newSubscription?.id,
      planType,
      userId,
      currentPeriodEnd,
      timestamp: new Date().toISOString()
    });
  }
}

// Processar pagamento de mudança de plano
async function handlePlanChangePayment(supabase: any, changeRequest: any, payment: any) {
  console.log('[ASAAS-WEBHOOK] Confirmando mudança de plano:', {
    requestId: changeRequest.id,
    newPlanType: changeRequest.new_plan_type,
    paymentValue: payment.value
  });

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

    console.log('[ASAAS-WEBHOOK] ✅ Mudança de plano confirmada com sucesso');

  } catch (error) {
    console.error('[ASAAS-WEBHOOK] ❌ Erro ao processar mudança de plano:', error.message);
    
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