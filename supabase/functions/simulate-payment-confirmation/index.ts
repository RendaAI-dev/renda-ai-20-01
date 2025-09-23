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
    const { paymentId } = await req.json();
    
    if (!paymentId) {
      throw new Error('paymentId é obrigatório');
    }

    console.log('[SIMULATE-PAYMENT] Simulando confirmação do pagamento:', paymentId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar o pagamento no banco
    const { data: payment, error: paymentError } = await supabase
      .from('poupeja_asaas_payments')
      .select('*')
      .eq('asaas_payment_id', paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Pagamento não encontrado: ${paymentId}`);
    }

    console.log('[SIMULATE-PAYMENT] Pagamento encontrado:', payment);

    // Simular webhook do Asaas com PAYMENT_CONFIRMED
    const webhookPayload = {
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: paymentId,
        status: 'CONFIRMED',
        customer: payment.asaas_customer_id,
        value: parseFloat(payment.amount),
        billingType: payment.method,
        confirmedDate: new Date().toISOString().split('T')[0],
        paymentDate: new Date().toISOString().split('T')[0],
        subscription: null, // Será buscado do banco se existir
        externalReference: payment.external_reference,
        invoiceUrl: payment.invoice_url,
        description: payment.description
      }
    };

    // Buscar subscription se existir
    const { data: subscription } = await supabase
      .from('poupeja_subscriptions')
      .select('asaas_subscription_id')
      .eq('user_id', payment.user_id)
      .single();

    if (subscription) {
      webhookPayload.payment.subscription = subscription.asaas_subscription_id;
    }

    console.log('[SIMULATE-PAYMENT] Enviando webhook simulado:', webhookPayload);

    // Chamar o webhook interno
    const webhookResponse = await supabase.functions.invoke('asaas-webhook', {
      body: webhookPayload
    });

    if (webhookResponse.error) {
      throw new Error(`Erro no webhook: ${webhookResponse.error.message}`);
    }

    console.log('[SIMULATE-PAYMENT] ✅ Pagamento confirmado com sucesso');

    return new Response(JSON.stringify({
      success: true,
      paymentId,
      message: 'Pagamento confirmado com sucesso'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[SIMULATE-PAYMENT] Erro:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});