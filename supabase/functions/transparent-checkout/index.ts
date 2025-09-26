import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreditCardData {
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  holderName: string;
  holderCpf: string;
}

interface CheckoutRequest {
  planType: 'monthly' | 'annual';
  creditCard?: CreditCardData;
  savedCardToken?: string;
  isUpgrade?: boolean;
  currentSubscriptionId?: string;
}

// Function to detect card brand from number
function detectCardBrand(cardNumber: string): string {
  const number = cardNumber.replace(/\s/g, '');
  
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  if (/^2[2-7]/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'American Express';
  if (/^6(?:011|5)/.test(number)) return 'Discover';
  if (/^35/.test(number)) return 'JCB';
  if (/^30[0-5]/.test(number)) return 'Diners Club';
  
  return 'Unknown';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TRANSPARENT-CHECKOUT] Iniciando processamento...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    console.log('[TRANSPARENT-CHECKOUT] Usuário autenticado:', user.id);

    // Parse request body
    const requestBody: CheckoutRequest = await req.json();
    const { planType, creditCard, savedCardToken, isUpgrade, currentSubscriptionId } = requestBody;
    
    // Validate input data
    if (!planType || !['monthly', 'annual'].includes(planType)) {
      throw new Error('Plan type must be either "monthly" or "annual"');
    }
    
    if (!creditCard && !savedCardToken) {
      throw new Error('Either credit card data or saved card token must be provided');
    }
    
    if (isUpgrade && !currentSubscriptionId) {
      throw new Error('Current subscription ID is required for upgrades');
    }
    
    console.log('[TRANSPARENT-CHECKOUT] Dados recebidos:', { 
      planType, 
      hasNewCard: !!creditCard,
      hasSavedToken: !!savedCardToken,
      isUpgrade 
    });

    // Extract client IP to help Asaas risk analysis confirm payments faster
    const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const realIp = req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip');
    const remoteIp = forwardedFor || realIp || '';
    console.log('[TRANSPARENT-CHECKOUT] remoteIp:', remoteIp || 'N/A');
    // Get Asaas configuration directly from settings table (using service role)
    console.log('[TRANSPARENT-CHECKOUT] Buscando configurações do Asaas...');
    
    const { data: asaasSettings, error: settingsError } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas')
      .in('key', ['api_key', 'environment']);

    if (settingsError) {
      console.error('[TRANSPARENT-CHECKOUT] Erro ao buscar configurações:', settingsError);
      throw new Error('Failed to get Asaas configuration');
    }

    if (!asaasSettings || asaasSettings.length === 0) {
      throw new Error('Asaas configuration not found');
    }

    const asaasApiKey = asaasSettings.find(s => s.key === 'api_key')?.value;
    const asaasEnvironment = asaasSettings.find(s => s.key === 'environment')?.value || 'sandbox';
    
    if (!asaasApiKey) {
      throw new Error('Asaas API key not configured');
    }

    const asaasBaseUrl = asaasEnvironment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    // Get user data - try poupeja_users first, fallback to auth metadata
    console.log('[TRANSPARENT-CHECKOUT] Buscando dados do usuário...');
    
    let userData: any = null;
    
    const { data: userProfile, error: userDataError } = await supabase
      .from('poupeja_users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (userProfile) {
      userData = userProfile;
      console.log('[TRANSPARENT-CHECKOUT] Dados encontrados na tabela poupeja_users');
    } else {
      // Fallback to user metadata if poupeja_users doesn't exist or has no data
      console.log('[TRANSPARENT-CHECKOUT] Usando dados do metadata do usuário');
      userData = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || 'Cliente',
        phone: user.user_metadata?.phone || '',
        cpf: user.user_metadata?.cpf || '',
        cep: user.user_metadata?.cep || '',
        street: user.user_metadata?.address?.street || '',
        number: user.user_metadata?.address?.number || '',
        complement: user.user_metadata?.address?.complement || '',
        neighborhood: user.user_metadata?.address?.neighborhood || '',
        city: user.user_metadata?.address?.city || '',
        state: user.user_metadata?.address?.state || ''
      };
    }

    // Get plan data from database with proper asaas_price_id
    console.log('[TRANSPARENT-CHECKOUT] Buscando dados do plano no banco...');
    
    const { data: planData, error: planError } = await supabase
      .from('poupeja_plans')
      .select('id, name, price, asaas_price_id, plan_period')
      .eq('plan_period', planType)
      .eq('is_active', true)
      .maybeSingle();

    if (planError) {
      console.error('[TRANSPARENT-CHECKOUT] Erro ao buscar plano:', planError);
      throw new Error('Erro interno: Falha ao buscar dados do plano');
    }

    if (!planData) {
      console.error('[TRANSPARENT-CHECKOUT] Plano não encontrado:', { planType });
      throw new Error(`Plano ${planType === 'monthly' ? 'mensal' : 'anual'} não encontrado. Verifique as configurações dos planos.`);
    }

    if (!planData.asaas_price_id) {
      console.error('[TRANSPARENT-CHECKOUT] Price ID do Asaas não configurado:', planData);
      throw new Error('Configuração de pagamento incompleta. Entre em contato com o suporte.');
    }

    const planPrice = planData.price;
    const asaasPriceId = planData.asaas_price_id;

    console.log('[TRANSPARENT-CHECKOUT] Dados do plano:', { 
      planType, 
      planPrice, 
      asaasPriceId,
      planName: planData.name 
    });

    // Get or create Asaas customer
    let asaasCustomerId: string;
    
    console.log('[TRANSPARENT-CHECKOUT] Verificando cliente Asaas existente...');
    const { data: existingCustomer, error: customerLookupError } = await supabase
      .from('poupeja_asaas_customers')
      .select('asaas_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (customerLookupError) {
      console.error('[TRANSPARENT-CHECKOUT] Erro ao buscar cliente Asaas:', customerLookupError);
      throw new Error('Failed to lookup Asaas customer');
    }

    if (existingCustomer?.asaas_customer_id) {
      asaasCustomerId = existingCustomer.asaas_customer_id;
      console.log('[TRANSPARENT-CHECKOUT] Cliente Asaas existente:', asaasCustomerId);
    } else {
      // Create new Asaas customer
      const customerData = {
        name: userData.name || 'Cliente',
        email: userData.email,
        phone: userData.phone || '',
        cpfCnpj: userData.cpf || '',
        postalCode: userData.cep || '',
        address: userData.street || '',
        addressNumber: userData.number || '',
        complement: userData.complement || '',
        province: userData.neighborhood || '',
        city: userData.city || '',
        state: userData.state || ''
      };

      console.log('[TRANSPARENT-CHECKOUT] Criando cliente Asaas:', customerData);

      const customerResponse = await fetch(`${asaasBaseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey,
        },
        body: JSON.stringify(customerData)
      });

      if (!customerResponse.ok) {
        const error = await customerResponse.text();
        throw new Error(`Failed to create Asaas customer: ${error}`);
      }

      const customer = await customerResponse.json();
      asaasCustomerId = customer.id;

      // Save customer in database
      await supabase.from('poupeja_asaas_customers').insert({
        user_id: user.id,
        asaas_customer_id: asaasCustomerId,
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        cpf: userData.cpf
      });

      console.log('[TRANSPARENT-CHECKOUT] Cliente Asaas criado:', asaasCustomerId);
    }

    // Step 1: Handle card tokenization
    let tokenData;
    let shouldSaveCard = false;
    
    if (savedCardToken) {
      // Validate saved card token exists in Asaas before using
      console.log('[TRANSPARENT-CHECKOUT] Validando token de cartão salvo:', savedCardToken);
      
      try {
        const validateResponse = await fetch(`${asaasBaseUrl}/customers/${asaasCustomerId}/creditCards`, {
          headers: {
            'access_token': asaasApiKey,
            'Content-Type': 'application/json'
          }
        });

        if (!validateResponse.ok) {
          console.error('[TRANSPARENT-CHECKOUT] Erro ao validar cartão:', validateResponse.status);
          
          // 404 significa que o cliente não tem cartões salvos no Asaas
          if (validateResponse.status === 404) {
            console.log('[TRANSPARENT-CHECKOUT] Cliente não possui cartões salvos no Asaas');
            
            // Mark card as inactive in database
            await supabase
              .from('poupeja_tokenized_cards')
              .update({ is_active: false })
              .eq('credit_card_token', savedCardToken)
              .eq('user_id', user.id);
              
            if (!creditCard) {
              throw new Error('Não encontramos cartões salvos no Asaas para este cliente. Por favor, cadastre um novo cartão.');
            }
            
            console.log('[TRANSPARENT-CHECKOUT] Prosseguindo com tokenização de novo cartão...');
          } else {
            // Outros erros do Asaas
            if (!creditCard) {
              throw new Error('Erro ao consultar cartões no Asaas. Tente novamente.');
            }
            console.log('[TRANSPARENT-CHECKOUT] Erro na consulta, prosseguindo com novo cartão...');
          }
        } else {
          const cardsData = await validateResponse.json();
          console.log('[TRANSPARENT-CHECKOUT] Cartões encontrados no Asaas:', cardsData.data?.length || 0);
          
          const validTokens = cardsData.data?.map((card: any) => card.creditCardToken) || [];
          console.log('[TRANSPARENT-CHECKOUT] Tokens válidos:', validTokens.map((t: string) => t.substring(0, 8) + '...'));
          console.log('[TRANSPARENT-CHECKOUT] Token sendo validado:', savedCardToken.substring(0, 8) + '...');
          
          if (!validTokens.includes(savedCardToken)) {
            console.error('[TRANSPARENT-CHECKOUT] Token não encontrado na lista de cartões válidos');
            console.log('[TRANSPARENT-CHECKOUT] ⚠️ Token inválido, marcando cartão como inativo e forçando novo cartão');
            
            // Mark card as inactive in database
            await supabase
              .from('poupeja_tokenized_cards')
              .update({ is_active: false })
              .eq('credit_card_token', savedCardToken)
              .eq('user_id', user.id);
              
            // Force new card usage by clearing savedCardToken
            if (!creditCard) {
              throw new Error('Este cartão não pertence a este cliente no Asaas. Por favor, cadastre um novo cartão.');
            }
            
            // Continue to new card tokenization below
            console.log('[TRANSPARENT-CHECKOUT] Prosseguindo com tokenização de novo cartão...');
          } else {
            console.log('[TRANSPARENT-CHECKOUT] ✅ Token válido encontrado na lista do Asaas');
            tokenData = { creditCardToken: savedCardToken };
          }
        }
      } catch (tokenValidationError) {
        console.error('[TRANSPARENT-CHECKOUT] Erro ao validar token:', tokenValidationError);
        
        if (!creditCard) {
          throw new Error('Falha ao validar cartão salvo e nenhum novo cartão fornecido. Por favor, cadastre um novo cartão.');
        }
        
        // Continue to new card tokenization below
        console.log('[TRANSPARENT-CHECKOUT] Erro na validação, prosseguindo com novo cartão...');
      }
    }
    
    if (!tokenData && creditCard) {
      // Tokenize new credit card
      console.log('[TRANSPARENT-CHECKOUT] Tokenizando novo cartão de crédito...');
      shouldSaveCard = true;
    
    const tokenizeResponse = await fetch(`${asaasBaseUrl}/creditCard/tokenize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
      },
      body: JSON.stringify({
        creditCard: {
          holderName: creditCard.holderName,
          number: creditCard.number.replace(/\s/g, ''),
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv
        },
        creditCardHolderInfo: {
          name: userData.name || creditCard.holderName,
          email: userData.email,
          cpfCnpj: creditCard.holderCpf || userData.cpf || '',
          postalCode: userData.cep || '00000-000',
          addressNumber: userData.number || 'S/N',
          addressComplement: userData.complement || '',
          phone: userData.phone || ''
        },
        customer: asaasCustomerId
      })
      });

      if (!tokenizeResponse.ok) {
        const error = await tokenizeResponse.text();
        console.error('[TRANSPARENT-CHECKOUT] Erro na tokenização:', {
          status: tokenizeResponse.status,
          statusText: tokenizeResponse.statusText,
          error
        });
        throw new Error(`Falha na tokenização do cartão (${tokenizeResponse.status}): ${error}`);
      }

      tokenData = await tokenizeResponse.json();
      console.log('[TRANSPARENT-CHECKOUT] ✅ Cartão tokenizado com sucesso');
    } else {
      throw new Error('Método de pagamento não especificado');
    }
    
    // Save tokenized card data only for new cards
    if (shouldSaveCard && creditCard) {
      const cardBrand = detectCardBrand(creditCard.number);
      const lastFour = creditCard.number.replace(/\s/g, '').slice(-4);
      const maskedNumber = `****-****-****-${lastFour}`;
      
      try {
        // Check if user already has this card (by last 4 digits and brand)
        const { data: existingCards } = await supabase
          .from('poupeja_tokenized_cards')
          .select('id')
          .eq('user_id', user.id)
          .eq('credit_card_last_four', lastFour)
          .eq('credit_card_brand', cardBrand);
        
        // Only save if this card doesn't exist yet
        if (!existingCards || existingCards.length === 0) {
          // Check if this will be the user's first card (make it default)
          const { data: userCards } = await supabase
            .from('poupeja_tokenized_cards')
            .select('id')
            .eq('user_id', user.id);
          
          const isFirstCard = !userCards || userCards.length === 0;
          
          const { error: cardSaveError } = await supabase
            .from('poupeja_tokenized_cards')
            .insert({
              user_id: user.id,
              asaas_customer_id: asaasCustomerId,
              credit_card_token: tokenData.creditCardToken,
              credit_card_number: maskedNumber,
              credit_card_brand: cardBrand,
              credit_card_last_four: lastFour,
              holder_name: creditCard.holderName,
              expires_at: `${creditCard.expiryMonth}/${creditCard.expiryYear}`,
              is_default: isFirstCard,
              is_active: true
            });
          
          if (cardSaveError) {
            console.error('[TRANSPARENT-CHECKOUT] ⚠️ Erro ao salvar cartão tokenizado:', cardSaveError);
            // Don't throw error - tokenization was successful, card saving is secondary
          } else {
            console.log('[TRANSPARENT-CHECKOUT] ✅ Cartão tokenizado salvo com sucesso');
          }
        } else {
          console.log('[TRANSPARENT-CHECKOUT] ℹ️ Cartão já existe, não salvando duplicata');
        }
      } catch (error) {
        console.error('[TRANSPARENT-CHECKOUT] ⚠️ Erro ao verificar/salvar cartão:', error);
        // Continue with the flow - card saving is not critical
      }
    }

    // Step 2: Handle subscription creation or plan change
    let result;

    if (isUpgrade && currentSubscriptionId) {
      // Handle plan change
      console.log('[TRANSPARENT-CHECKOUT] Processando mudança de plano...');
      
      // CRITICAL: Buscar o asaas_subscription_id correto do banco de dados
      console.log('[TRANSPARENT-CHECKOUT] Buscando subscription no banco de dados...');
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('poupeja_subscriptions')
        .select('asaas_subscription_id')
        .eq('id', currentSubscriptionId)
        .maybeSingle();

      if (subscriptionError) {
        console.error('[TRANSPARENT-CHECKOUT] ❌ Erro ao buscar subscription:', subscriptionError);
        throw new Error('Failed to lookup subscription in database');
      }

      if (!subscriptionData?.asaas_subscription_id) {
        console.error('[TRANSPARENT-CHECKOUT] ❌ Subscription não encontrada ou sem asaas_subscription_id:', currentSubscriptionId);
        throw new Error(`Subscription não encontrada ou sem asaas_subscription_id: ${currentSubscriptionId}`);
      }

      const asaasSubscriptionId = subscriptionData.asaas_subscription_id;
      console.log(`[TRANSPARENT-CHECKOUT] ✅ Asaas subscription ID encontrado: ${asaasSubscriptionId}`);
      
      // Validar dados críticos antes da atualização
      console.log(`[TRANSPARENT-CHECKOUT] 🔍 Validando dados da mudança de plano:`, {
        asaasSubscriptionId,
        newPlanType: planType,
        newPlanPrice: planPrice,
        cardToken: savedCardToken || 'new_card',
        userId: user.id
      });
      
      // Create plan change request
      const { data: planChangeRequest } = await supabase
        .from('poupeja_plan_change_requests')
        .insert({
          user_id: user.id,
          subscription_id: currentSubscriptionId,
          current_plan_type: planType === 'monthly' ? 'annual' : 'monthly',
          new_plan_type: planType,
          new_plan_value: planPrice,
          status: 'pending'
        })
        .select()
        .single();

      // Preparar dados para atualização da subscription no Asaas
      const updatePayload = {
        billingType: 'CREDIT_CARD',
        value: planPrice,
        cycle: planType === 'monthly' ? 'MONTHLY' : 'YEARLY',
        creditCard: {
          creditCardToken: tokenData.creditCardToken,
        }
      };
      
      console.log(`[TRANSPARENT-CHECKOUT] 📤 Enviando atualização para Asaas:`, {
        url: `${asaasBaseUrl}/subscriptions/${asaasSubscriptionId}`,
        payload: updatePayload
      });

      // Update subscription in Asaas - REMOVENDO chargeNow e updatePendingPayments que podem causar erro
      const updateResponse = await fetch(`${asaasBaseUrl}/subscriptions/${asaasSubscriptionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey,
        },
        body: JSON.stringify(updatePayload)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('[TRANSPARENT-CHECKOUT] ❌ Erro na atualização da subscription:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          error: errorText,
          asaasSubscriptionId: asaasSubscriptionId
        });
        throw new Error(`Failed to update subscription (${updateResponse.status}): ${errorText}`);
      }

      const updatedSubscription = await updateResponse.json();
      
      // Update plan change request with payment ID
      if (planChangeRequest && updatedSubscription.id) {
        await supabase
          .from('poupeja_plan_change_requests')
          .update({ 
            asaas_payment_id: updatedSubscription.id,
            status: 'processing'
          })
          .eq('id', planChangeRequest.id);
      }

      result = {
        success: true,
        type: 'plan_change',
        subscriptionId: updatedSubscription.id,
        paymentId: updatedSubscription.id
      };
      
      console.log('[TRANSPARENT-CHECKOUT] ✅ Mudança de plano processada');
    } else {
      // Create new subscription
      console.log('[TRANSPARENT-CHECKOUT] Criando nova assinatura...');
      
      const subscriptionResponse = await fetch(`${asaasBaseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey,
        },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: 'CREDIT_CARD',
          value: planPrice,
          nextDueDate: new Date().toISOString().split('T')[0],
          cycle: planType === 'monthly' ? 'MONTHLY' : 'YEARLY',
          description: `Assinatura ${planType === 'monthly' ? 'Mensal' : 'Anual'} - Renda AI`,
          creditCardToken: tokenData.creditCardToken,
          remoteIp,
          externalReference: `${user.id}_${planType}_${Date.now()}`
        })
      });

      if (!subscriptionResponse.ok) {
        const error = await subscriptionResponse.text();
        console.error('[TRANSPARENT-CHECKOUT] ❌ Erro ao criar subscription:', {
          status: subscriptionResponse.status,
          statusText: subscriptionResponse.statusText,
          error
        });
        
        // Check for specific credit card token errors
        if (error.includes('CreditCardToken') && error.includes('não encontrado')) {
          console.log('[TRANSPARENT-CHECKOUT] 🔄 Token de cartão não encontrado, tentando com novo cartão...');
          
          // Mark saved card as inactive if it was used
          if (savedCardToken) {
            await supabase
              .from('poupeja_tokenized_cards')
              .update({ is_active: false })
              .eq('credit_card_token', savedCardToken)
              .eq('user_id', user.id);
          }
          
          throw new Error('Token de cartão inválido. Por favor, cadastre um novo cartão.');
        }
        
        throw new Error(`Falha ao criar assinatura (${subscriptionResponse.status}): ${error}`);
      }

      const subscription = await subscriptionResponse.json();
      console.log('[TRANSPARENT-CHECKOUT] ✅ Assinatura criada:', subscription.id);

      // Save subscription in database with PENDING status - aguarda webhook PAYMENT_CONFIRMED
      await supabase.from('poupeja_subscriptions').insert({
        user_id: user.id,
        asaas_subscription_id: subscription.id,
        asaas_customer_id: asaasCustomerId,
        plan_type: planType,
        status: 'pending', // PENDENTE até confirmação via webhook
        current_period_start: new Date().toISOString(),
        current_period_end: subscription.nextDueDate,
        payment_processor: 'asaas'
      });

      console.log('[TRANSPARENT-CHECKOUT] ✅ Assinatura PENDENTE criada - aguarda confirmação');

      result = {
        success: true,
        type: 'new_subscription',
        subscriptionId: subscription.id,
        status: 'pending',
        paymentId: subscription.id
      };
      
      console.log('[TRANSPARENT-CHECKOUT] ✅ Nova assinatura processada');
    }

    console.log('[TRANSPARENT-CHECKOUT] ✅ Checkout transparente concluído com sucesso');

    // Return success with session information for redirect
    const successResult = {
      ...result,
      sessionId: `${user.id}_${planType}_${Date.now()}`,
      redirectTo: '/payment-success'
    };

    return new Response(JSON.stringify(successResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TRANSPARENT-CHECKOUT] ❌ Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        success: false 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});