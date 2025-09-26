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

    // Buscar configurações do Asaas PRIMEIRO
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

    // Determinar o asaasCustomerId com prioridade: assinatura -> cartão -> mapeamento -> criação
    let asaasCustomerId = currentSubscription.asaas_customer_id || undefined;
    console.log('[CHANGE-PLAN-CHECKOUT] asaas_customer_id inicial (assinatura):', asaasCustomerId);

    if (!asaasCustomerId) {
      // Tentar via cartão tokenizado ativo (priorizando default)
      const { data: cardCustomer } = await supabase
        .from('poupeja_tokenized_cards')
        .select('asaas_customer_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();

      asaasCustomerId = cardCustomer?.asaas_customer_id || asaasCustomerId;
      console.log('[CHANGE-PLAN-CHECKOUT] asaas_customer_id após cartão tokenizado:', asaasCustomerId);
    }

    if (!asaasCustomerId) {
      // Buscar cliente Asaas do mapeamento
      const { data: asaasCustomer } = await supabase
        .from('poupeja_asaas_customers')
        .select('asaas_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();

      asaasCustomerId = asaasCustomer?.asaas_customer_id || asaasCustomerId;
      console.log('[CHANGE-PLAN-CHECKOUT] asaas_customer_id após mapeamento local:', asaasCustomerId);
    }

    // Se ainda não existe cliente Asaas, criar um
    if (!asaasCustomerId) {
      console.log('[CHANGE-PLAN-CHECKOUT] Cliente Asaas não encontrado em nenhuma fonte, criando novo...');
      
      // Buscar dados do usuário
      const { data: userData } = await supabase
        .from('poupeja_users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const customerData = {
        name: userData?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cliente',
        email: user.email,
        phone: userData?.phone || user.user_metadata?.phone || '11999999999',
        cpfCnpj: userData?.cpf || user.user_metadata?.cpf || '00000000000',
        postalCode: userData?.cep || user.user_metadata?.cep || '00000-000',
        address: userData?.street || user.user_metadata?.address?.street || 'Endereço não informado',
        addressNumber: userData?.number || user.user_metadata?.address?.number || '123',
        complement: userData?.complement || user.user_metadata?.address?.complement || '',
        province: userData?.neighborhood || user.user_metadata?.address?.neighborhood || 'Centro',
        city: userData?.city || user.user_metadata?.address?.city || 'Cidade',
        state: userData?.state || user.user_metadata?.address?.state || 'SP'
      };

      console.log('[CHANGE-PLAN-CHECKOUT] Criando cliente Asaas:', customerData);

      // Criar cliente no Asaas
      const createCustomerResponse = await fetch(`${asaasUrl}/customers`, {
        method: 'POST',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      if (!createCustomerResponse.ok) {
        const createError = await createCustomerResponse.text();
        console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro ao criar cliente Asaas:', createError);
        throw new Error(`Erro ao criar cliente Asaas: ${createError}`);
      }

      const newCustomer = await createCustomerResponse.json();
      asaasCustomerId = newCustomer.id;

      console.log('[CHANGE-PLAN-CHECKOUT] Cliente Asaas criado:', asaasCustomerId);

      // Salvar cliente no banco
      await supabase
        .from('poupeja_asaas_customers')
        .insert({
          user_id: user.id,
          asaas_customer_id: asaasCustomerId,
          email: user.email,
          phone: customerData.phone,
          cpf: customerData.cpfCnpj,
          name: customerData.name
        });

      console.log('[CHANGE-PLAN-CHECKOUT] ✅ Cliente Asaas salvo no banco');
    }

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

    // PASSO 1: Cancelar assinatura atual no Asaas (tolerante a erros)
    console.log('[CHANGE-PLAN-CHECKOUT] Verificando status da assinatura atual:', currentSubscription.asaas_subscription_id);
    
    try {
      // Primeiro verificar se a assinatura ainda existe
      const statusResponse = await fetch(`${asaasUrl}/subscriptions/${currentSubscription.asaas_subscription_id}`, {
        method: 'GET',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (statusResponse.ok) {
        const subscriptionData = await statusResponse.json();
        console.log('[CHANGE-PLAN-CHECKOUT] Status atual da assinatura:', subscriptionData.status);
        
        // Só tentar cancelar se ainda estiver ativa
        if (subscriptionData.status === 'ACTIVE') {
          const cancelResponse = await fetch(`${asaasUrl}/subscriptions/${currentSubscription.asaas_subscription_id}`, {
            method: 'DELETE',
            headers: {
              'access_token': apiKey,
              'Content-Type': 'application/json'  
            }
          });

          if (cancelResponse.ok) {
            console.log('[CHANGE-PLAN-CHECKOUT] ✅ Assinatura atual cancelada');
          } else {
            const cancelError = await cancelResponse.text();
            console.log('[CHANGE-PLAN-CHECKOUT] ⚠️ Assinatura não pôde ser cancelada (pode já estar cancelada):', cancelError);
          }
        } else {
          console.log('[CHANGE-PLAN-CHECKOUT] ✅ Assinatura já estava cancelada/inativa');
        }
      } else if (statusResponse.status === 404 || statusResponse.status === 410) {
        console.log('[CHANGE-PLAN-CHECKOUT] ✅ Assinatura não existe mais no Asaas (já cancelada)');
      } else {
        console.log('[CHANGE-PLAN-CHECKOUT] ⚠️ Não foi possível verificar status da assinatura, continuando...');
      }
    } catch (cancelError) {
      console.log('[CHANGE-PLAN-CHECKOUT] ⚠️ Erro ao cancelar assinatura, continuando:', cancelError);
    }

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
          customer: asaasCustomerId,
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
      // Usar cartão salvo - validar se token existe no Asaas
      if (!savedCardToken) {
        return new Response(JSON.stringify({
          success: false,
          error: 'TOKEN_REQUIRED',
          message: 'Token do cartão salvo não fornecido'
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Verificar se o token é válido consultando cartões do cliente
      try {
        const cardsResponse = await fetch(`${asaasUrl}/customers/${asaasCustomerId}/creditCard`, {
          method: 'GET',
          headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
          }
        });

        if (cardsResponse.ok) {
          const cardsData = await cardsResponse.json();
          const validCard = cardsData.data?.find((card: any) => card.creditCardToken === savedCardToken);
          
          if (!validCard) {
            console.log('[CHANGE-PLAN-CHECKOUT] ⚠️ Token do cartão salvo inválido, solicitando novo cartão');
            return new Response(JSON.stringify({
              success: false,
              error: 'INVALID_CARD_TOKEN',
              message: 'Cartão salvo inválido. Por favor, cadastre um novo cartão.',
              requiresNewCard: true
            }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          console.log('[CHANGE-PLAN-CHECKOUT] ✅ Token do cartão salvo validado');
        }
      } catch (tokenValidationError) {
        console.log('[CHANGE-PLAN-CHECKOUT] ⚠️ Não foi possível validar token, tentando continuar...');
      }
      
      paymentData.creditCardToken = savedCardToken;
      console.log('[CHANGE-PLAN-CHECKOUT] ✅ Usando cartão salvo');
    }

    // PASSO 3: Criar nova assinatura no Asaas (com retry se cliente não encontrado)
    console.log('[CHANGE-PLAN-CHECKOUT] Criando nova assinatura...');
    
    let createSubscriptionResponse: Response | undefined;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      createSubscriptionResponse = await fetch(`${asaasUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: 'CREDIT_CARD',
          value: newPlanPrice,
          nextDueDate: new Date().toISOString().split('T')[0], // Cobrança hoje
          cycle: newPlanCycle,
          description: `Nova Assinatura ${newPlanType === 'monthly' ? 'Mensal' : 'Anual'} - Mudança de Plano`,
          creditCardToken: paymentData.creditCardToken,
          externalReference: `${user.id}_change_${newPlanType}_${Date.now()}`
        })
      });

      if (createSubscriptionResponse.ok) {
        break; // Sucesso, sair do loop
      }

      const createError = await createSubscriptionResponse.text();
      console.log(`[CHANGE-PLAN-CHECKOUT] Tentativa ${retryCount + 1} falhou:`, createError);

      // Se erro é de token de cartão inválido, retornar instrução para novo cartão
      if (
        createError.includes('invalid_creditCard') ||
        (createError.includes('creditCardToken') && (createError.includes('não encontrado') || createError.includes('not found')))
      ) {
        console.log('[CHANGE-PLAN-CHECKOUT] ⚠️ Token de cartão inválido/inexistente para este cliente');
        return new Response(JSON.stringify({
          success: false,
          error: 'INVALID_CARD_TOKEN',
          message: 'Cartão salvo inválido. Por favor, cadastre um novo cartão.',
          requiresNewCard: true,
          details: createError
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Se erro é de cliente não encontrado
      if (createError.includes('customer') && createError.includes('not found')) {
        // Se estiver usando cartão salvo, não adianta recriar cliente (token pertence a outro cliente)
        if (!creditCard && savedCardToken) {
          console.log('[CHANGE-PLAN-CHECKOUT] ⚠️ Cliente não encontrado e uso de cartão salvo detectado — solicitando novo cartão');
          return new Response(JSON.stringify({
            success: false,
            error: 'INVALID_CARD_TOKEN',
            message: 'Não foi possível localizar o cliente do Asaas vinculado ao cartão salvo. Por favor, cadastre um novo cartão.',
            requiresNewCard: true,
            details: createError
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Caso esteja tokenizando um novo cartão, podemos recriar o cliente e tentar novamente
        if (retryCount < maxRetries) {
          console.log('[CHANGE-PLAN-CHECKOUT] Cliente não encontrado, forçando recriação...');
          
          // Remover cliente do cache local e recriar
          await supabase
            .from('poupeja_asaas_customers')
            .delete()
            .eq('user_id', user.id);
          
          // Recriar cliente
          const { data: userData } = await supabase
            .from('poupeja_users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          const customerData = {
            name: userData?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cliente',
            email: user.email,
            phone: userData?.phone || user.user_metadata?.phone || '11999999999',
            cpfCnpj: userData?.cpf || user.user_metadata?.cpf || '00000000000',
            postalCode: userData?.cep || user.user_metadata?.cep || '00000-000',
            address: userData?.street || user.user_metadata?.address?.street || 'Endereço não informado',
            addressNumber: userData?.number || user.user_metadata?.address?.number || '123',
            complement: userData?.complement || user.user_metadata?.address?.complement || '',
            province: userData?.neighborhood || user.user_metadata?.address?.neighborhood || 'Centro',
            city: userData?.city || user.user_metadata?.address?.city || 'Cidade',
            state: userData?.state || user.user_metadata?.address?.state || 'SP'
          };

          const recreateResponse = await fetch(`${asaasUrl}/customers`, {
            method: 'POST',
            headers: {
              'access_token': apiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerData)
          });

          if (recreateResponse.ok) {
            const newCustomer = await recreateResponse.json();
            asaasCustomerId = newCustomer.id;
            
            await supabase
              .from('poupeja_asaas_customers')
              .insert({
                user_id: user.id,
                asaas_customer_id: asaasCustomerId,
                email: user.email,
                phone: customerData.phone,
                cpf: customerData.cpfCnpj,
                name: customerData.name
              });
            
            console.log('[CHANGE-PLAN-CHECKOUT] Cliente recriado:', asaasCustomerId);
          }
        }
      }

      retryCount++;
      
      if (retryCount > maxRetries) {
        console.error('[CHANGE-PLAN-CHECKOUT] ❌ Todas as tentativas falharam:', createError);
        return new Response(JSON.stringify({
          success: false,
          error: 'SUBSCRIPTION_CREATION_FAILED',
          message: 'Não foi possível criar a nova assinatura. Tente novamente.',
          details: createError
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    if (!createSubscriptionResponse?.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: 'SUBSCRIPTION_CREATION_FAILED',
        message: 'Falha na criação da assinatura'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
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
      
      return new Response(JSON.stringify({
        success: false,
        error: 'DATABASE_UPDATE_FAILED',
        message: 'Assinatura criada no Asaas mas não foi possível atualizar no banco. Entre em contato com o suporte.',
        details: updateError.message,
        newSubscriptionId: newSubscription.id
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
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
    console.error('[CHANGE-PLAN-CHECKOUT] ❌ Erro geral:', errorMessage);
    
    // Retornar erro estruturado com status 200 para evitar problemas no frontend
    return new Response(JSON.stringify({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor. Tente novamente em alguns minutos.',
      details: errorMessage
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});