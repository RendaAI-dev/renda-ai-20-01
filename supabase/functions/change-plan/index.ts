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

    // Calcular valor proporcional
    const today = new Date();
    const currentPeriodEnd = new Date(subscription.current_period_end);
    const daysRemaining = Math.max(0, Math.ceil((currentPeriodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    
    let proportionalValue = newValue;
    
    // Se há dias restantes no período atual, calcular proporcional
    if (daysRemaining > 0) {
      const isUpgrade = (subscription.plan_type === 'monthly' && newPlanType === 'annual') ||
                       (newValue > (subscription.plan_type === 'monthly' ? monthlyPrice : annualPrice));
      
      if (isUpgrade) {
        // Para upgrade, cobra a diferença proporcional
        const oldValue = subscription.plan_type === 'monthly' ? monthlyPrice : annualPrice;
        const dailyDifference = (newValue - oldValue) / (newPlanType === 'monthly' ? 30 : 365);
        proportionalValue = dailyDifference * daysRemaining;
      } else {
        // Para downgrade, gera crédito para próxima fatura
        proportionalValue = 0; // Não cobra agora, crédito será aplicado
      }
    }

    // Atualizar assinatura no Asaas
    const response = await fetch(`${asaasUrl}/subscriptions/${subscription.asaas_subscription_id}`, {
      method: 'PUT',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: newValue,
        cycle: newCycle,
        billingType: 'CREDIT_CARD',
        updatePendingPayments: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao atualizar assinatura no Asaas: ${error}`);
    }

    const updatedSubscription = await response.json();

    // Atualizar assinatura no Supabase
    await supabase
      .from('poupeja_subscriptions')
      .update({
        plan_type: newPlanType,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    // Se há valor proporcional a cobrar, gerar pagamento único
    let paymentUrl = null;
    if (proportionalValue > 0) {
      const paymentResponse = await fetch(`${asaasUrl}/payments`, {
        method: 'POST',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer: updatedSubscription.customer,
          billingType: 'CREDIT_CARD',
          value: proportionalValue,
          dueDate: today.toISOString().split('T')[0],
          description: `Ajuste proporcional - Mudança para plano ${newPlanType === 'monthly' ? 'Mensal' : 'Anual'}`,
          externalReference: `plan_change_${subscription.id}_${Date.now()}`
        })
      });

      if (paymentResponse.ok) {
        const payment = await paymentResponse.json();
        paymentUrl = payment.invoiceUrl;
      }
    }

    console.log('[CHANGE-PLAN] ✅ Plano alterado com sucesso');

    return new Response(JSON.stringify({
      success: true,
      message: `Plano alterado para ${newPlanType === 'monthly' ? 'Mensal' : 'Anual'} com sucesso`,
      newPlanType,
      newValue,
      proportionalValue,
      paymentUrl,
      subscriptionUrl: `${asaasUrl.replace('/api/v3', '')}/subscription/${subscription.asaas_subscription_id}`
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