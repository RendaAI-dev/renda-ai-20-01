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
    console.log('[CHANGE-PLAN-CHECKOUT] Buscando assinatura ativa para usuário:', user.id);
    
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('poupeja_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('payment_processor', 'asaas')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    console.log('[CHANGE-PLAN-CHECKOUT] Resultado da busca de assinatura:', { 
      subscriptionsFound: subscriptions?.length || 0,
      subscriptionError 
    });

    // Se não encontrou assinaturas ativas, tentar buscar qualquer assinatura do usuário para debug
    if (!subscriptions || subscriptions.length === 0) {
      const { data: allSubscriptions } = await supabase
        .from('poupeja_subscriptions')
        .select('id, status, plan_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      console.log('[CHANGE-PLAN-CHECKOUT] Debug - Todas as assinaturas do usuário:', allSubscriptions);
      throw new Error('Nenhuma assinatura ativa encontrada');
    }

    const currentSubscription = subscriptions[0];
    console.log('[CHANGE-PLAN-CHECKOUT] Assinatura ativa encontrada:', {
      id: currentSubscription.id,
      status: currentSubscription.status,
      plan_type: currentSubscription.plan_type,
      asaas_subscription_id: currentSubscription.asaas_subscription_id
    });

    // Buscar dados do usuário e cliente Asaas
    const [{ data: userData }, { data: asaasCustomer }] = await Promise.all([
      supabase
        .from('poupeja_users')
        .select('email, phone, cep, street, number, neighborhood, city, state')
        .eq('id', user.id)
        .single(),
      supabase
        .from('poupeja_asaas_customers')
        .select('asaas_customer_id')
        .eq('user_id', user.id)
        .single()
    ]);

    if (!asaasCustomer) {
      throw new Error('Cliente Asaas não encontrado');
    }

    if (!userData) {
      throw new Error('Dados do usuário não encontrados');
    }

    console.log('[CHANGE-PLAN-CHECKOUT] Dados do usuário encontrados:', { 
      hasEmail: !!userData.email, 
      hasPhone: !!userData.phone, 
      hasCep: !!userData.cep 
    });

    // Buscar configurações do Asaas
    console.log('[CHANGE-PLAN-CHECKOUT] Buscando configurações do Asaas...');
    const { data: settings, error: settingsError } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas');

    if (settingsError) {
      console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro ao buscar configurações:', settingsError);
      throw new Error(`Erro ao buscar configurações: ${settingsError.message}`);
    }

    console.log('[CHANGE-PLAN-CHECKOUT] Configurações encontradas:', settings?.length || 0);

    const asaasConfig = settings?.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>) ?? {};

    const apiKey = asaasConfig.api_key;
    const environment = asaasConfig.environment || 'sandbox';
    
    console.log('[CHANGE-PLAN-CHECKOUT] Configuração Asaas:', {
      hasApiKey: !!apiKey,
      environment,
      configKeys: Object.keys(asaasConfig)
    });
    
    if (!apiKey) {
      throw new Error('Chave API do Asaas não configurada');
    }

    const asaasUrl = environment === 'production' 
      ? 'https://www.asaas.com/api/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    // Buscar preços das configurações públicas
    console.log('[CHANGE-PLAN-CHECKOUT] Buscando configurações de preço...');
    const { data: priceData, error: priceError } = await supabase.functions.invoke('get-public-settings', {
      body: { category: 'pricing' }
    });
    
    if (!priceData?.success || priceError) {
      console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro ao buscar preços:', priceError || 'Resposta inválida');
      throw new Error('Erro ao buscar configurações de preço');
    }

    console.log('[CHANGE-PLAN-CHECKOUT] Dados de preço recebidos:', priceData);

    const pricing = priceData.settings?.pricing || {};
    const monthlyPrice = pricing.monthly_price?.value || pricing.plan_price_monthly?.value || 49.9;
    const annualPrice = pricing.annual_price?.value || pricing.plan_price_annual?.value || 538.9;
    
    const newPlanPrice = newPlanType === 'monthly' ? monthlyPrice : annualPrice;
    const newPlanCycle = newPlanType === 'monthly' ? 'MONTHLY' : 'YEARLY';

    console.log('[CHANGE-PLAN-CHECKOUT] Configurações do novo plano:', { 
      newPlanType, 
      newPlanPrice, 
      newPlanCycle,
      precosMapeados: { monthlyPrice, annualPrice }
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
            email: userData.email, // ✅ Email obrigatório do usuário
            cpfCnpj: creditCard.holderCpf.replace(/\D/g, ''),
            postalCode: (userData.cep || '').replace(/\D/g, '') || '01310100', // CEP real ou fallback válido
            address: userData.street || 'Rua Exemplo',
            addressNumber: userData.number || '123',
            complement: userData.neighborhood || '',
            province: userData.city || 'São Paulo',
            city: userData.city || 'São Paulo',
            phone: (userData.phone || '11999999999').replace(/\D/g, '').substring(0, 11) // Telefone real ou fallback
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
    console.log('[CHANGE-PLAN-CHECKOUT] Dados da nova assinatura:', {
      id: newSubscription.id,
      status: newSubscription.status,
      nextDueDate: newSubscription.nextDueDate,
      value: newSubscription.value,
      cycle: newSubscription.cycle
    });

    // Validar se a assinatura foi criada com sucesso
    if (!newSubscription.id || !newSubscription.nextDueDate) {
      console.error('[CHANGE-PLAN-CHECKOUT] ❌ Dados da assinatura incompletos:', newSubscription);
      throw new Error('Assinatura criada com dados incompletos');
    }

    // Converter nextDueDate para formato ISO correto
    let periodEndDate: string;
    try {
      // Se nextDueDate está em formato YYYY-MM-DD, converter para ISO timestamp 
      if (newSubscription.nextDueDate.includes('T')) {
        periodEndDate = newSubscription.nextDueDate;
      } else {
        // Adicionar horário para o final do dia
        periodEndDate = new Date(newSubscription.nextDueDate + 'T23:59:59.999Z').toISOString();
      }
      console.log('[CHANGE-PLAN-CHECKOUT] Data convertida:', { original: newSubscription.nextDueDate, converted: periodEndDate });
    } catch (dateError) {
      console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro na conversão de data:', dateError);
      // Usar data atual + período como fallback
      const fallbackDate = new Date();
      if (newPlanType === 'monthly') {
        fallbackDate.setMonth(fallbackDate.getMonth() + 1);
      } else {
        fallbackDate.setFullYear(fallbackDate.getFullYear() + 1);
      }
      periodEndDate = fallbackDate.toISOString();
      console.log('[CHANGE-PLAN-CHECKOUT] ⚠️ Usando data fallback:', periodEndDate);
    }

    // PASSO 4: Atualizar assinatura existente no banco de dados
    console.log('[CHANGE-PLAN-CHECKOUT] Atualizando assinatura no banco com:', {
      asaas_subscription_id: newSubscription.id,
      plan_type: newPlanType,
      status: 'active',
      current_period_end: periodEndDate
    });

    const { error: updateError } = await supabase
      .from('poupeja_subscriptions')
      .update({
        asaas_subscription_id: newSubscription.id,
        plan_type: newPlanType,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: periodEndDate,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSubscription.id);

    if (updateError) {
      console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro ao atualizar assinatura:', updateError);
      console.error('[CHANGE-PLAN-CHECKOUT] ❌ Detalhes do erro:', {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      });
      
      // Tentar rollback - cancelar a nova assinatura criada
      try {
        console.log('[CHANGE-PLAN-CHECKOUT] 🔄 Tentando rollback - cancelando nova assinatura...');
        await fetch(`${asaasUrl}/subscriptions/${newSubscription.id}`, {
          method: 'DELETE',
          headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
          }
        });
        console.log('[CHANGE-PLAN-CHECKOUT] ✅ Rollback concluído');
      } catch (rollbackError) {
        console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro no rollback:', rollbackError);
      }
      
      throw new Error(`Erro ao atualizar assinatura: ${updateError.message}`);
    }

    console.log('[CHANGE-PLAN-CHECKOUT] ✅ Assinatura atualizada no banco de dados');

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro:', errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});