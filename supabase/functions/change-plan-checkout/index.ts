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
    console.log('[CHANGE-PLAN-CHECKOUT] Iniciando checkout de mudança de plano...');

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

    const { newPlanType, currentPlanType, creditCard, savedCardToken } = await req.json();
    console.log('[CHANGE-PLAN-CHECKOUT] Dados recebidos:', { 
      user: user.email, 
      newPlanType, 
      currentPlanType,
      hasNewCard: !!creditCard,
      hasSavedCard: !!savedCardToken
    });

    // Validar entrada
    if (!newPlanType || !currentPlanType || !['monthly', 'annual'].includes(newPlanType) || !['monthly', 'annual'].includes(currentPlanType)) {
      throw new Error('Tipos de plano inválidos');
    }

    if (newPlanType === currentPlanType) {
      throw new Error('Novo plano deve ser diferente do atual');
    }

    if (!creditCard && !savedCardToken) {
      throw new Error('Método de pagamento não fornecido');
    }

    // Buscar assinatura ativa atual
    const { data: currentSubscription } = await supabase
      .from('poupeja_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('payment_processor', 'asaas')
      .eq('status', 'active')
      .single();

    if (!currentSubscription) {
      throw new Error('Nenhuma assinatura ativa encontrada');
    }

    // Buscar cliente Asaas
    const { data: asaasCustomer } = await supabase
      .from('poupeja_asaas_customers')
      .select('asaas_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!asaasCustomer) {
      throw new Error('Cliente Asaas não encontrado');
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

    // Buscar preços das configurações públicas
    const { data: priceData } = await supabase.functions.invoke('get-public-settings', {
      body: { category: 'pricing' }
    });
    
    if (!priceData?.success) {
      throw new Error('Erro ao buscar configurações de preço');
    }

    const pricing = priceData.settings?.pricing || {};
    const monthlyPrice = pricing.monthly_price?.value || pricing.plan_price_monthly?.value || 49.9;
    const annualPrice = pricing.annual_price?.value || pricing.plan_price_annual?.value || 538.9;
    
    const newPlanPrice = newPlanType === 'monthly' ? monthlyPrice : annualPrice;
    const newPlanCycle = newPlanType === 'monthly' ? 'MONTHLY' : 'YEARLY';

    console.log('[CHANGE-PLAN-CHECKOUT] Configurações do novo plano:', { 
      newPlanType, 
      newPlanPrice, 
      newPlanCycle 
    });

    // PASSO 1: Cancelar assinatura atual no Asaas
    console.log('[CHANGE-PLAN-CHECKOUT] Cancelando assinatura atual:', currentSubscription.asaas_subscription_id);
    
    const cancelResponse = await fetch(`${asaasUrl}/subscriptions/${currentSubscription.asaas_subscription_id}`, {
      method: 'DELETE',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!cancelResponse.ok) {
      const cancelError = await cancelResponse.text();
      console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro ao cancelar assinatura:', cancelError);
      throw new Error(`Erro ao cancelar assinatura atual: ${cancelError}`);
    }

    console.log('[CHANGE-PLAN-CHECKOUT] ✅ Assinatura atual cancelada');

    // PASSO 2: Processar método de pagamento (tokenizar cartão se necessário)
    let paymentData: any = {};
    
    if (creditCard) {
      // Tokenizar novo cartão
      const tokenizeResponse = await fetch(`${asaasUrl}/creditCard/tokenize`, {
        method: 'POST',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer: asaasCustomer.asaas_customer_id,
          creditCard: {
            holderName: creditCard.holderName,
            number: creditCard.number.replace(/\s/g, ''),
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv
          },
          creditCardHolderInfo: {
            name: creditCard.holderName,
            cpfCnpj: creditCard.holderCpf.replace(/\D/g, ''),
            postalCode: '00000000',
            addressNumber: '123',
            phone: '11999999999'
          }
        })
      });

      if (!tokenizeResponse.ok) {
        const tokenError = await tokenizeResponse.text();
        console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro ao tokenizar cartão:', tokenError);
        throw new Error(`Erro ao processar cartão: ${tokenError}`);
      }

      const tokenData = await tokenizeResponse.json();
      paymentData.creditCardToken = tokenData.creditCardToken;
      
      console.log('[CHANGE-PLAN-CHECKOUT] ✅ Cartão tokenizado');
    } else {
      // Usar cartão salvo
      paymentData.creditCardToken = savedCardToken;
      console.log('[CHANGE-PLAN-CHECKOUT] ✅ Usando cartão salvo');
    }

    // PASSO 3: Criar nova assinatura no Asaas
    console.log('[CHANGE-PLAN-CHECKOUT] Criando nova assinatura...');
    
    const createSubscriptionResponse = await fetch(`${asaasUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: asaasCustomer.asaas_customer_id,
        billingType: 'CREDIT_CARD',
        value: newPlanPrice,
        nextDueDate: new Date().toISOString().split('T')[0], // Cobrança hoje
        cycle: newPlanCycle,
        description: `Nova Assinatura ${newPlanType === 'monthly' ? 'Mensal' : 'Anual'} - Mudança de Plano`,
        creditCardToken: paymentData.creditCardToken,
        externalReference: `${user.id}_change_${newPlanType}_${Date.now()}`
      })
    });

    if (!createSubscriptionResponse.ok) {
      const createError = await createSubscriptionResponse.text();
      console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro ao criar nova assinatura:', createError);
      throw new Error(`Erro ao criar nova assinatura: ${createError}`);
    }

    const newSubscription = await createSubscriptionResponse.json();
    console.log('[CHANGE-PLAN-CHECKOUT] ✅ Nova assinatura criada:', newSubscription.id);

    // PASSO 4: Atualizar assinatura no banco de dados (marcar antiga como cancelada)
    const { error: cancelDbError } = await supabase
      .from('poupeja_subscriptions')
      .update({
        status: 'canceled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSubscription.id);

    if (cancelDbError) {
      console.error('[CHANGE-PLAN-CHECKOUT] Erro ao atualizar assinatura cancelada:', cancelDbError);
    }

    // PASSO 5: Inserir nova assinatura no banco de dados
    const { error: insertError } = await supabase
      .from('poupeja_subscriptions')
      .insert({
        user_id: user.id,
        asaas_subscription_id: newSubscription.id,
        asaas_customer_id: asaasCustomer.asaas_customer_id,
        plan_type: newPlanType,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: newSubscription.nextDueDate,
        payment_processor: 'asaas'
      });

    if (insertError) {
      console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro ao inserir nova assinatura:', insertError);
      throw new Error(`Erro ao salvar nova assinatura: ${insertError.message}`);
    }

    console.log('[CHANGE-PLAN-CHECKOUT] ✅ Mudança de plano concluída com sucesso');

    return new Response(JSON.stringify({
      success: true,
      message: `Plano alterado com sucesso! Nova assinatura ${newPlanType === 'monthly' ? 'Mensal' : 'Anual'} ativada.`,
      newPlanType,
      newSubscriptionId: newSubscription.id,
      status: 'completed'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});