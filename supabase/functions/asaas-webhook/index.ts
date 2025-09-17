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

    // Verificar token do webhook (opcional)
    const accessToken = req.headers.get('asaas-access-token');
    console.log('[ASAAS-WEBHOOK] Access token presente:', !!accessToken);

    const webhookData = await req.json();
    const { event, payment, checkout } = webhookData;
    
    console.log('[ASAAS-WEBHOOK] Evento recebido:', event, {
      paymentId: payment?.id,
      checkoutId: checkout?.id,
      customerId: payment?.customer || checkout?.customer
    });

    // Processar eventos de CHECKOUT
    if (event?.startsWith('CHECKOUT_')) {
      return await processCheckoutEvent(supabase, event, checkout, webhookData);
    }

    // Processar eventos de PAYMENT
    if (event?.startsWith('PAYMENT_')) {
      return await processPaymentEvent(supabase, event, payment);
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

  console.log('[ASAAS-WEBHOOK] Processando evento de pagamento:', event, payment.id);

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
  console.log('[ASAAS-WEBHOOK] Processando status:', event, 'para usuário:', userId);

  switch (event) {
    case 'PAYMENT_CREATED':
      // Pagamento criado - apenas log
      console.log('[ASAAS-WEBHOOK] Pagamento criado:', payment.id);
      break;

    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      // Pagamento confirmado/recebido - ativar assinatura
      await handlePaymentSuccess(supabase, userId, payment, paymentRecord);
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