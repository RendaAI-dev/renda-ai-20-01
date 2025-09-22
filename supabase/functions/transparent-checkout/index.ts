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
}

interface CheckoutRequest {
  planType: 'monthly' | 'annual';
  creditCard: CreditCardData;
  isUpgrade?: boolean;
  currentSubscriptionId?: string;
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

    const requestBody: CheckoutRequest = await req.json();
    const { planType, creditCard, isUpgrade, currentSubscriptionId } = requestBody;

    // Get Asaas configuration
    const { data: asaasConfig, error: configError } = await supabase.functions.invoke('get-admin-settings');
    if (configError) {
      throw new Error('Failed to get Asaas configuration');
    }

    const asaasApiKey = asaasConfig.asaas?.apiKey;
    const asaasEnvironment = asaasConfig.asaas?.environment || 'sandbox';
    
    if (!asaasApiKey) {
      throw new Error('Asaas API key not configured');
    }

    const asaasBaseUrl = asaasEnvironment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    // Get user data
    const { data: userData, error: userDataError } = await supabase
      .from('poupeja_users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userDataError) {
      throw new Error('User data not found');
    }

    // Get plan pricing
    const { data: publicSettings } = await supabase.functions.invoke('get-public-settings');
    const monthlyPrice = publicSettings?.pricing?.monthlyPrice || 49.90;
    const annualPrice = publicSettings?.pricing?.annualPrice || 399.90;
    const planPrice = planType === 'monthly' ? monthlyPrice : annualPrice;

    console.log('[TRANSPARENT-CHECKOUT] Dados do plano:', { planType, planPrice });

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

    // Step 1: Tokenize credit card
    console.log('[TRANSPARENT-CHECKOUT] Tokenizando cartão de crédito...');
    
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
          cpfCnpj: userData.cpf || '',
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

    const tokenData = await tokenizeResponse.json();
    console.log('[TRANSPARENT-CHECKOUT] ✅ Cartão tokenizado com sucesso');

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
          creditCard: {
            creditCardToken: tokenData.creditCardToken
          },
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
          creditCard: {
            creditCardToken: tokenData.creditCardToken
          },
          externalReference: `${user.id}_${planType}_${Date.now()}`
        })
      });

      if (!subscriptionResponse.ok) {
        const error = await subscriptionResponse.text();
        throw new Error(`Failed to create subscription: ${error}`);
      }

      const subscription = await subscriptionResponse.json();
      console.log('[TRANSPARENT-CHECKOUT] ✅ Assinatura criada:', subscription.id);

      // Save subscription in database
      await supabase.from('poupeja_subscriptions').insert({
        user_id: user.id,
        asaas_subscription_id: subscription.id,
        asaas_customer_id: asaasCustomerId,
        plan_type: planType,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: subscription.nextDueDate,
        payment_processor: 'asaas'
      });

      result = {
        success: true,
        type: 'new_subscription',
        subscriptionId: subscription.id
      };
      
      console.log('[TRANSPARENT-CHECKOUT] ✅ Nova assinatura processada');
    }

    console.log('[TRANSPARENT-CHECKOUT] ✅ Checkout transparente concluído com sucesso');

    return new Response(JSON.stringify(result), {
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