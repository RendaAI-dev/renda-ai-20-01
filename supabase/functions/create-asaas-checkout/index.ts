import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    console.log('[ASAAS-PAYMENT] Iniciando processamento...');

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

    // Parse do body
    const { planType, successUrl, cancelUrl } = await req.json();
    
    if (!planType || !successUrl || !cancelUrl) {
      throw new Error('Parâmetros obrigatórios: planType, successUrl, cancelUrl');
    }

    console.log(`[ASAAS-PAYMENT] Usuário: ${user.email}, Plano: ${planType}`);

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
      ? 'https://www.asaas.com/api/v3'
      : 'https://sandbox.asaas.com/api/v3';

    // Buscar dados do usuário
    const { data: userData } = await supabase
      .from('poupeja_users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!userData) {
      throw new Error('Dados do usuário não encontrados');
    }

    // Buscar ou criar cliente no Asaas
    let asaasCustomer: AsaasCustomer;
    
    const { data: existingCustomer } = await supabase
      .from('poupeja_asaas_customers')
      .select('asaas_customer_id')
      .eq('user_id', user.id)
      .single();

    if (existingCustomer) {
      // Buscar cliente existente no Asaas
      const customerResponse = await fetch(`${asaasUrl}/customers/${existingCustomer.asaas_customer_id}`, {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!customerResponse.ok) {
        throw new Error('Erro ao buscar cliente no Asaas');
      }

      asaasCustomer = await customerResponse.json();
    } else {
      // Criar novo cliente no Asaas
      const customerData = {
        name: userData.name || 'Cliente',
        email: userData.email,
        cpfCnpj: userData.cpf?.replace(/\D/g, ''),
        phone: userData.phone?.replace(/\D/g, ''),
        mobilePhone: userData.phone?.replace(/\D/g, ''),
        address: userData.street,
        addressNumber: userData.number,
        complement: userData.complement,
        province: userData.neighborhood,
        city: userData.city,
        state: userData.state,
        postalCode: userData.cep?.replace(/\D/g, '')
      };

      const customerResponse = await fetch(`${asaasUrl}/customers`, {
        method: 'POST',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      if (!customerResponse.ok) {
        const error = await customerResponse.text();
        console.error('[ASAAS-PAYMENT] Erro ao criar cliente:', error);
        throw new Error('Erro ao criar cliente no Asaas');
      }

      asaasCustomer = await customerResponse.json();

      // Salvar cliente no banco
      await supabase
        .from('poupeja_asaas_customers')
        .insert({
          user_id: user.id,
          asaas_customer_id: asaasCustomer.id,
          email: asaasCustomer.email,
          cpf: userData.cpf,
          phone: userData.phone,
          name: asaasCustomer.name
        });

      console.log('[ASAAS-PAYMENT] Cliente criado:', asaasCustomer.id);
    }

    // Buscar valores dos planos na tabela de planos gerenciados
    const { data: monthlyPlan } = await supabase
      .from('poupeja_plans')
      .select('price')
      .eq('plan_period', 'monthly')
      .eq('is_active', true)
      .single();

    const { data: annualPlan } = await supabase
      .from('poupeja_plans')
      .select('price')
      .eq('plan_period', 'annual')
      .eq('is_active', true)
      .single();

    console.log('[ASAAS-PAYMENT] Planos encontrados:', {
      monthly: monthlyPlan?.price,
      annual: annualPlan?.price
    });

    // Valores dos planos com fallback
    const planValues = {
      monthly: monthlyPlan?.price || 49.90,
      annual: annualPlan?.price || 538.90
    } as const;

    const value = planValues[planType as keyof typeof planValues];
    if (!value) {
      throw new Error('Tipo de plano inválido');
    }

    console.log(`[ASAAS-PAYMENT] Valor do plano ${planType}: R$ ${value}`);

    // Criar assinatura recorrente no Asaas
    const subscriptionData = {
      customer: asaasCustomer.id,
      billingType: 'CREDIT_CARD',
      value: value,
      cycle: planType === 'monthly' ? 'MONTHLY' : 'YEARLY',
      description: planType === 'monthly' ? 'Assinatura Mensal - Renda AI' : 'Assinatura Anual - Renda AI',
      nextDueDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      externalReference: `${user.id}_${planType}_${Date.now()}`,
      callback: {
        successUrl: successUrl,
        autoRedirect: true
      }
    };

    console.log('[ASAAS-PAYMENT] Criando assinatura:', JSON.stringify(subscriptionData, null, 2));

    const subscriptionResponse = await fetch(`${asaasUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriptionData)
    });

    const subscriptionResult = await subscriptionResponse.json();
    console.log(`[ASAAS-PAYMENT] Resposta da criação de assinatura (status ${subscriptionResponse.status}):`, JSON.stringify(subscriptionResult, null, 2));

    if (!subscriptionResponse.ok || subscriptionResult.errors) {
      const errorMessage = subscriptionResult.errors 
        ? `Erro Asaas: ${subscriptionResult.errors.map((e: any) => `${e.code} - ${e.description}`).join(', ')}`
        : `Erro HTTP ${subscriptionResponse.status}`;
      
      console.error(`[ASAAS-PAYMENT] ${errorMessage}`);
      console.error(`[ASAAS-PAYMENT] Payload enviado:`, JSON.stringify(subscriptionData, null, 2));
      console.error(`[ASAAS-PAYMENT] Response completa:`, JSON.stringify(subscriptionResult, null, 2));
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: subscriptionResult.errors || subscriptionResult,
          sentPayload: subscriptionData
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[ASAAS-PAYMENT] Assinatura criada:', subscriptionResult.id);

    // Buscar o pagamento gerado pela assinatura
    let paymentId = subscriptionResult.paymentId;
    
    if (!paymentId) {
      // Se não temos o paymentId diretamente, buscar pagamentos da subscription
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
          console.log('[ASAAS-PAYMENT] Payment ID encontrado via busca:', paymentId);
        }
      }
    }

    if (!paymentId) {
      throw new Error('Não foi possível obter ID do pagamento');
    }

    // Buscar detalhes do pagamento para obter a URL correta da fatura
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
            console.log('[ASAAS-PAYMENT] ✅ URL da fatura obtida do Asaas:', invoiceUrl);
            break;
          } else {
            console.log(`[ASAAS-PAYMENT] ⚠️ Tentativa ${retryCount + 1}: URL ainda não disponível, aguardando...`);
          }
        }
      } catch (error) {
        console.log(`[ASAAS-PAYMENT] ❌ Erro na tentativa ${retryCount + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
      }
    }

    if (!invoiceUrl) {
      throw new Error('Não foi possível obter URL da fatura do Asaas após múltiplas tentativas');
    }

    return new Response(JSON.stringify({
      success: true,
      invoiceUrl: invoiceUrl,
      paymentId: paymentId,
      subscriptionId: subscriptionResult.id
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ASAAS-PAYMENT] Erro:', errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });
  }
});