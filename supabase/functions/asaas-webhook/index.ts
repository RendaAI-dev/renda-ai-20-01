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

    const { event, payment } = webhookData;
    
    if (!payment || !payment.id) {
      throw new Error('Dados do pagamento não encontrados no webhook');
    }

    // Buscar pagamento no banco
    const { data: existingPayment } = await supabase
      .from('poupeja_asaas_payments')
      .select('*, user_id')
      .eq('asaas_payment_id', payment.id)
      .single();

    if (!existingPayment) {
      console.log('[ASAAS-WEBHOOK] Pagamento não encontrado no banco:', payment.id);
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const userId = existingPayment.user_id;
    console.log('[ASAAS-WEBHOOK] Processando para usuário:', userId);

    // Mapear status do Asaas para status da aplicação
    const statusMapping = {
      'PENDING': 'pending',
      'RECEIVED': 'active', 
      'CONFIRMED': 'active',
      'OVERDUE': 'past_due',
      'REFUNDED': 'cancelled',
      'RECEIVED_IN_CASH': 'active',
      'AWAITING_RISK_ANALYSIS': 'pending'
    };

    const newStatus = statusMapping[payment.status] || 'pending';

    // Atualizar pagamento
    await supabase
      .from('poupeja_asaas_payments')
      .update({
        status: payment.status,
        payment_date: payment.paymentDate || null,
        updated_at: new Date().toISOString()
      })
      .eq('asaas_payment_id', payment.id);

    // Processar mudanças na assinatura baseado no evento
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      await handlePaymentSuccess(supabase, userId, payment, existingPayment);
    } else if (event === 'PAYMENT_OVERDUE') {
      await handlePaymentOverdue(supabase, userId, payment);
    } else if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') {
      await handlePaymentCancelled(supabase, userId);
    }

    console.log('[ASAAS-WEBHOOK] Webhook processado com sucesso');

    return new Response(JSON.stringify({
      received: true,
      event: event,
      status: newStatus
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

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

async function handlePaymentSuccess(supabase: any, userId: string, payment: any, existingPayment: any) {
  console.log('[ASAAS-WEBHOOK] Processando pagamento recebido para usuário:', userId);

  // Determinar tipo de plano baseado na referência externa ou valor
  const planType = existingPayment.external_reference?.includes('annual') ? 'annual' : 'monthly';
  const periodDays = planType === 'annual' ? 365 : 30;

  const now = new Date();
  const currentPeriodStart = now.toISOString();
  const currentPeriodEnd = new Date(now.getTime() + (periodDays * 24 * 60 * 60 * 1000)).toISOString();

  // Buscar assinatura existente
  const { data: existingSubscription } = await supabase
    .from('poupeja_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

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