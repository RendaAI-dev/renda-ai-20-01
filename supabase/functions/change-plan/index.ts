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
    
    console.log('[CHANGE-PLAN] Cancelando assinatura atual e criando nova:', { 
      oldSubscription: subscription.asaas_subscription_id,
      newValue, 
      newCycle 
    });

    // Buscar customer do Asaas para o usuário
    const { data: asaasCustomer } = await supabase
      .from('poupeja_asaas_customers')
      .select('asaas_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!asaasCustomer) {
      throw new Error('Cliente Asaas não encontrado');
    }

    // PASSO 1: Cancelar assinatura atual no Asaas
    if (subscription.asaas_subscription_id) {
      console.log('[CHANGE-PLAN] Cancelando assinatura atual:', subscription.asaas_subscription_id);
      
      const cancelResponse = await fetch(`${asaasUrl}/subscriptions/${subscription.asaas_subscription_id}`, {
        method: 'DELETE',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!cancelResponse.ok) {
        const error = await cancelResponse.text();
        console.error('[CHANGE-PLAN] Erro ao cancelar assinatura:', error);
        throw new Error(`Erro ao cancelar assinatura atual: ${error}`);
      }

      console.log('[CHANGE-PLAN] ✅ Assinatura atual cancelada com sucesso');
    }

    // PASSO 2: Criar nova assinatura no Asaas
    const today = new Date();
    const nextDueDate = new Date(today);
    nextDueDate.setDate(today.getDate() + 1); // Próximo dia útil

    console.log('[CHANGE-PLAN] Criando nova assinatura');
    
    const subscriptionResponse = await fetch(`${asaasUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: asaasCustomer.asaas_customer_id,
        billingType: 'CREDIT_CARD',
        value: newValue,
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        cycle: newCycle,
        description: `Plano ${newPlanType === 'monthly' ? 'Mensal' : 'Anual'}`,
        externalReference: `subscription_change_${subscription.id}_${Date.now()}`
      })
    });

    if (!subscriptionResponse.ok) {
      const error = await subscriptionResponse.text();
      console.error('[CHANGE-PLAN] Erro ao criar nova assinatura:', error);
      throw new Error(`Erro ao criar nova assinatura: ${error}`);
    }

    const newSubscription = await subscriptionResponse.json();
    console.log('[CHANGE-PLAN] ✅ Nova assinatura criada:', newSubscription.id);

    // PASSO 3: Atualizar assinatura no banco de dados
    const { error: updateError } = await supabase
      .from('poupeja_subscriptions')
      .update({
        asaas_subscription_id: newSubscription.id,
        plan_type: newPlanType,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(nextDueDate.getTime() + (newPlanType === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('[CHANGE-PLAN] Erro ao atualizar assinatura no banco:', updateError);
      throw new Error(`Erro ao atualizar assinatura no banco: ${updateError.message}`);
    }

    console.log('[CHANGE-PLAN] ✅ Mudança de plano concluída com sucesso');

    return new Response(JSON.stringify({
      success: true,
      message: `Plano alterado com sucesso para ${newPlanType === 'monthly' ? 'Mensal' : 'Anual'}!`,
      newPlanType,
      newValue,
      subscriptionId: newSubscription.id,
      status: 'completed'
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