import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[REACTIVATE-SUBSCRIPTION] Iniciando processo de reativação...');

    // Criar cliente Supabase
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

    console.log(`[REACTIVATE-SUBSCRIPTION] Usuário autenticado: ${user.email}`);

    // Buscar assinatura cancelada do usuário
    const { data: cancelledSubscription } = await supabase
      .from('poupeja_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('cancel_at_period_end', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!cancelledSubscription) {
      throw new Error('Nenhuma assinatura cancelada encontrada para reativar');
    }

    console.log(`[REACTIVATE-SUBSCRIPTION] Assinatura cancelada encontrada: ${cancelledSubscription.id}`);

    // Buscar configurações do Asaas
    const { data: settings } = await supabase
      .from('poupeja_settings')
      .select('key, value, encrypted')
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
      ? 'https://asaas.com/api/v3'
      : 'https://sandbox.asaas.com/api/v3';

    console.log(`[REACTIVATE-SUBSCRIPTION] Usando ambiente Asaas: ${environment}`);

    // Buscar cliente Asaas existente
    const { data: asaasCustomerData } = await supabase
      .from('poupeja_asaas_customers')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!asaasCustomerData) {
      throw new Error('Cliente Asaas não encontrado');
    }

    console.log(`[REACTIVATE-SUBSCRIPTION] Cliente Asaas encontrado: ${asaasCustomerData.asaas_customer_id}`);

    // Buscar valor do plano atual
    const { data: planData } = await supabase
      .from('poupeja_plans')
      .select('price')
      .eq('plan_period', cancelledSubscription.plan_type)
      .eq('is_active', true)
      .single();

    const planValue = planData?.price || (cancelledSubscription.plan_type === 'monthly' ? 49.90 : 538.90);

    console.log(`[REACTIVATE-SUBSCRIPTION] Valor do plano ${cancelledSubscription.plan_type}: R$ ${planValue}`);

    // Criar nova assinatura no Asaas
    const subscriptionData = {
      customer: asaasCustomerData.asaas_customer_id,
      billingType: 'CREDIT_CARD',
      value: planValue,
      cycle: cancelledSubscription.plan_type === 'monthly' ? 'MONTHLY' : 'YEARLY',
      description: cancelledSubscription.plan_type === 'monthly' ? 'Reativação - Assinatura Mensal' : 'Reativação - Assinatura Anual',
      nextDueDate: new Date().toISOString().split('T')[0], // Cobrança imediata
      externalReference: `reactivation_${user.id}_${cancelledSubscription.plan_type}_${Date.now()}`
    };

    console.log('[REACTIVATE-SUBSCRIPTION] Criando nova assinatura:', JSON.stringify(subscriptionData, null, 2));

    const subscriptionResponse = await fetch(`${asaasUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriptionData)
    });

    const subscriptionResult = await subscriptionResponse.json();
    console.log(`[REACTIVATE-SUBSCRIPTION] Resposta da criação (status ${subscriptionResponse.status}):`, JSON.stringify(subscriptionResult, null, 2));

    if (!subscriptionResponse.ok || subscriptionResult.errors) {
      const errorMessage = subscriptionResult.errors 
        ? `Erro Asaas: ${subscriptionResult.errors.map((e: any) => `${e.code} - ${e.description}`).join(', ')}`
        : `Erro HTTP ${subscriptionResponse.status}`;
      
      console.error(`[REACTIVATE-SUBSCRIPTION] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    console.log('[REACTIVATE-SUBSCRIPTION] Nova assinatura criada:', subscriptionResult.id);

    // Buscar ID do pagamento
    let paymentId = subscriptionResult.paymentId;
    
    if (!paymentId) {
      const paymentsResponse = await fetch(`${asaasUrl}/payments?subscription=${subscriptionResult.id}&limit=1`, {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        if (paymentsData.data && paymentsData.data.length > 0) {
          paymentId = paymentsData.data[0].id;
          console.log('[REACTIVATE-SUBSCRIPTION] Payment ID encontrado:', paymentId);
        }
      }
    }

    if (!paymentId) {
      throw new Error('Não foi possível obter ID do pagamento');
    }

    // Buscar URL da fatura
    let invoiceUrl = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!invoiceUrl && retryCount < maxRetries) {
      try {
        const paymentResponse = await fetch(`${asaasUrl}/payments/${paymentId}`, {
          headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
          }
        });

        if (paymentResponse.ok) {
          const paymentData = await paymentResponse.json();
          invoiceUrl = paymentData.invoiceUrl || paymentData.bankSlipUrl;
          
          if (invoiceUrl) {
            console.log('[REACTIVATE-SUBSCRIPTION] URL da fatura obtida:', invoiceUrl);
            break;
          }
        }
      } catch (error) {
        console.log(`[REACTIVATE-SUBSCRIPTION] Erro na tentativa ${retryCount + 1}: ${error.message}`);
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!invoiceUrl) {
      throw new Error('Não foi possível obter URL da fatura');
    }

    // Inserir nova assinatura no banco
    const { error: insertError } = await supabase
      .from('poupeja_subscriptions')
      .insert({
        user_id: user.id,
        asaas_subscription_id: subscriptionResult.id,
        asaas_customer_id: asaasCustomerData.asaas_customer_id,
        status: 'active',
        plan_type: cancelledSubscription.plan_type,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + (cancelledSubscription.plan_type === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
        payment_processor: 'asaas'
      });

    if (insertError) {
      console.error('[REACTIVATE-SUBSCRIPTION] Erro ao inserir nova assinatura:', insertError);
      throw new Error('Erro ao registrar nova assinatura no banco de dados');
    }

    console.log('[REACTIVATE-SUBSCRIPTION] Nova assinatura registrada no banco');

    return new Response(JSON.stringify({
      success: true,
      message: 'Assinatura reativada com sucesso! Complete o pagamento para confirmar.',
      invoiceUrl: invoiceUrl,
      paymentId: paymentId,
      subscriptionId: subscriptionResult.id,
      planType: cancelledSubscription.plan_type,
      value: planValue
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });

  } catch (error) {
    console.error('[REACTIVATE-SUBSCRIPTION] Erro:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });
  }
});