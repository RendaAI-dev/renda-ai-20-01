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
    
    const { data: existingCustomer } = await supabase
      .from('poupeja_asaas_customers')
      .select('asaas_customer_id')
      .eq('user_id', user.id)
      .single();

    if (existingCustomer) {
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
      // Use existing saved card token
      console.log('[TRANSPARENT-CHECKOUT] Usando cartão salvo');
      tokenData = { creditCardToken: savedCardToken };
    } else if (creditCard) {
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
          postalCode: userData.cep || '',
          addressNumber: userData.number || '',
          addressComplement: userData.complement || '',
          phone: userData.phone || ''
        },
        customer: asaasCustomerId
      })
      });

      if (!tokenizeResponse.ok) {
        const error = await tokenizeResponse.text();
        console.error('[TRANSPARENT-CHECKOUT] Erro na tokenização:', error);
        throw new Error(`Failed to tokenize credit card: ${error}`);
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

      // Update subscription in Asaas with immediate charge
      const updateResponse = await fetch(`${asaasBaseUrl}/subscriptions/${currentSubscriptionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey,
        },
        body: JSON.stringify({
          value: planPrice,
          cycle: planType === 'monthly' ? 'MONTHLY' : 'YEARLY',
          billingType: 'CREDIT_CARD',
          creditCardToken: tokenData.creditCardToken,
          remoteIp,
          chargeNow: true
        })
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        throw new Error(`Failed to update subscription: ${error}`);
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
          externalReference: `${user.id}_${planType}_${Date.now()}`,
          chargeNow: true
        })
      });

      if (!subscriptionResponse.ok) {
        const error = await subscriptionResponse.text();
        throw new Error(`Failed to create subscription: ${error}`);
      }

      const subscription = await subscriptionResponse.json();
      console.log('[TRANSPARENT-CHECKOUT] ✅ Assinatura criada:', subscription.id);

      // Save subscription in database with PENDING status
      await supabase.from('poupeja_subscriptions').insert({
        user_id: user.id,
        asaas_subscription_id: subscription.id,
        asaas_customer_id: asaasCustomerId,
        plan_type: planType,
        status: 'pending', // CRÍTICO: Aguardar confirmação do webhook
        current_period_start: new Date().toISOString(),
        current_period_end: subscription.nextDueDate,
        payment_processor: 'asaas'
      });

      console.log('[TRANSPARENT-CHECKOUT] ✅ Assinatura PENDENTE criada - aguardando confirmação');

      result = {
        success: true,
        type: 'new_subscription',
        subscriptionId: subscription.id,
        status: 'pending'
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
        error: error.message,
        success: false 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});