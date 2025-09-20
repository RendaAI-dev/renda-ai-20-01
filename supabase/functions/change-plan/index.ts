import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CHANGE-PLAN] Iniciando alteração de plano...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autorização necessário');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { newPlanType } = await req.json();
    console.log('[CHANGE-PLAN] Usuário:', user.email, 'Novo plano:', newPlanType);

    if (!newPlanType || !['monthly', 'annual'].includes(newPlanType)) {
      throw new Error('Tipo de plano inválido');
    }

    // Buscar assinatura ativa
    const { data: subscription } = await supabase
      .from('poupeja_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('payment_processor', 'asaas')
      .single();

    if (!subscription) {
      throw new Error('Nenhuma assinatura ativa encontrada');
    }

    if (subscription.plan_type === newPlanType) {
      throw new Error('Você já está no plano selecionado');
    }

    // Buscar configurações do Asaas
    const { data: settings } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas');

    const asaasConfig = settings?.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>) ?? {};

    const apiKey = asaasConfig.api_key;
    const environment = asaasConfig.environment || 'sandbox';
    
    if (!apiKey) {
      throw new Error('Chave API do Asaas não configurada');
    }

    const asaasUrl = environment === 'production' 
      ? 'https://www.asaas.com/api/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    // Buscar novos preços das configurações públicas
    const { data: priceData } = await supabase.functions.invoke('get-public-settings', {
      body: { category: 'pricing' }
    });
    if (!priceData?.success) {
      throw new Error('Erro ao buscar configurações de preço');
    }

    const pricing = priceData.settings?.pricing || {};
    const monthlyPrice = pricing.monthly_price?.value || pricing.plan_price_monthly?.value || 49.9;
    const annualPrice = pricing.annual_price?.value || pricing.plan_price_annual?.value || 538.9;
    
    const newValue = newPlanType === 'monthly' ? monthlyPrice : annualPrice;
    const newCycle = newPlanType === 'monthly' ? 'MONTHLY' : 'YEARLY';
    
    console.log('[CHANGE-PLAN] Alterando para:', { newValue, newCycle });

    // Buscar customer do Asaas para o usuário
    const { data: asaasCustomer } = await supabase
      .from('poupeja_asaas_customers')
      .select('asaas_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!asaasCustomer) {
      throw new Error('Cliente Asaas não encontrado');
    }

    const today = new Date();
    
    // Criar pagamento único com valor total do novo plano
    const paymentResponse = await fetch(`${asaasUrl}/payments`, {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: asaasCustomer.asaas_customer_id,
        billingType: 'CREDIT_CARD',
        value: newValue,
        dueDate: today.toISOString().split('T')[0],
        description: `Mudança para plano ${newPlanType === 'monthly' ? 'Mensal' : 'Anual'}`,
        externalReference: `plan_change_${subscription.id}_${Date.now()}`
      })
    });

    if (!paymentResponse.ok) {
      const error = await paymentResponse.text();
      throw new Error(`Erro ao criar pagamento: ${error}`);
    }

    const payment = await paymentResponse.json();

    // Criar registro de mudança de plano pendente
    const { data: changeRequest, error: changeRequestError } = await supabase
      .from('poupeja_plan_change_requests')
      .insert({
        user_id: user.id,
        subscription_id: subscription.id,
        current_plan_type: subscription.plan_type,
        new_plan_type: newPlanType,
        new_plan_value: newValue,
        asaas_payment_id: payment.id,
        payment_url: payment.invoiceUrl,
        status: 'pending'
      })
      .select('*')
      .single();

    if (changeRequestError) {
      throw new Error(`Erro ao criar solicitação de mudança: ${changeRequestError.message}`);
    }

    console.log('[CHANGE-PLAN] ✅ Solicitação de mudança criada com sucesso');

    return new Response(JSON.stringify({
      success: true,
      message: `Solicitação de mudança para plano ${newPlanType === 'monthly' ? 'Mensal' : 'Anual'} criada. Complete o pagamento para confirmar.`,
      changeRequestId: changeRequest.id,
      newPlanType,
      newValue,
      paymentUrl: payment.invoiceUrl,
      paymentId: payment.id,
      status: 'pending_payment'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[CHANGE-PLAN] ❌ Erro:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});