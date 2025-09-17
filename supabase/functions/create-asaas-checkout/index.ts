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

interface AsaasPayment {
  id: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  status: string;
  value: number;
  netValue: number;
  dueDate: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[ASAAS-CHECKOUT] Iniciando processamento...');

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

    console.log(`[ASAAS-CHECKOUT] Usuário: ${user.email}, Plano: ${planType}`);

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
        console.error('[ASAAS-CHECKOUT] Erro ao criar cliente:', error);
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

      console.log('[ASAAS-CHECKOUT] Cliente criado:', asaasCustomer.id);
    }

    // Buscar preços e dados dos planos
    const { data: planPrices, error: planError } = await supabase
      .from('poupeja_plans')
      .select('plan_period, price, name, description')
      .eq('is_active', true);

    if (planError) {
      console.error('[ASAAS-CHECKOUT] Erro ao buscar preços dos planos:', planError);
      throw new Error('Erro ao obter configuração de preços');
    }

    if (!planPrices || planPrices.length === 0) {
      console.error('[ASAAS-CHECKOUT] Nenhum plano ativo encontrado');
      throw new Error('Nenhum plano disponível');
    }

    console.log('[ASAAS-CHECKOUT] Planos encontrados:', 
      planPrices.reduce((acc, plan) => {
        acc[plan.plan_period] = plan.price;
        return acc;
      }, {} as Record<string, number>)
    );

    // Mapear planos
    const monthlyPlan = planPrices.find(p => p.plan_period === 'monthly');
    const annualPlan = planPrices.find(p => p.plan_period === 'annual');

    let value: number;
    let planName: string;
    let planDescription: string;
    
    if (planType === 'monthly') {
      if (!monthlyPlan) throw new Error('Plano mensal não encontrado');
      value = parseFloat(monthlyPlan.price.toFixed(2));
      planName = monthlyPlan.name || 'Plano Premium Mensal';
      planDescription = monthlyPlan.description || 'Assinatura Mensal - Renda AI';
    } else if (planType === 'annual') {
      if (!annualPlan) throw new Error('Plano anual não encontrado');
      value = parseFloat(annualPlan.price.toFixed(2));
      planName = annualPlan.name || 'Plano Premium Anual';  
      planDescription = annualPlan.description || 'Assinatura Anual - Renda AI';
    } else {
      throw new Error('Tipo de plano inválido');
    }

    // Validar preço
    if (isNaN(value) || value <= 0) {
      console.error(`[ASAAS-CHECKOUT] Preço inválido para plano ${planType}:`, value, `(tipo: ${typeof value})`);
      throw new Error('Preço do plano inválido');
    }

    console.log(`[ASAAS-CHECKOUT] Valor do plano ${planType}: R$ ${value} (tipo: ${typeof value})`);

    // Criar Checkout do Asaas para ASSINATURA recorrente com cartão de crédito
    const reference = `${user.id}_${planType}_${Date.now()}`;
    const cycle = planType === 'monthly' ? 'MONTHLY' : 'YEARLY';

    // Calcular nextDueDate (primeira cobrança)
    const today = new Date();
    const nextDueDate = new Date(today);
    if (planType === 'monthly') {
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    } else {
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
    }
    const nextDueDateFormatted = nextDueDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD

    const checkoutData = {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      reference,
      callback: {
        successUrl,
        cancelUrl,
        expiredUrl: cancelUrl
      },
      customer: asaasCustomer.id,
      items: [
        {
          name: planName,
          description: planDescription,
          quantity: 1,
          value: value
        }
      ],
      subscription: {
        value: value,
        cycle: cycle,
        description: planDescription,
        nextDueDate: nextDueDateFormatted
      }
    };

    console.log('[ASAAS-CHECKOUT] Dados completos enviados para Asaas:', JSON.stringify(checkoutData, null, 2));

    const checkoutResponse = await fetch(`${asaasUrl}/checkouts`, {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutData)
    });

    if (!checkoutResponse.ok) {
      const errorText = await checkoutResponse.text();
      console.error('[ASAAS-CHECKOUT] Status:', checkoutResponse.status);
      console.error('[ASAAS-CHECKOUT] Dados enviados:', JSON.stringify(checkoutData, null, 2));

      let errorMessage = 'Erro ao criar checkout no Asaas';
      try {
        const errorObj = JSON.parse(errorText);
        console.error('[ASAAS-CHECKOUT] Resposta de erro completa do Asaas:', JSON.stringify(errorObj, null, 2));
        if (errorObj.errors && Array.isArray(errorObj.errors)) {
          const descriptions = errorObj.errors.map((e: any) => e.description || e.message).filter(Boolean);
          if (descriptions.length > 0) {
            errorMessage = descriptions.join(', ');
            console.error('[ASAAS-CHECKOUT] Erro:', descriptions.join(', '));
          }
        }
      } catch (parseError) {
        console.error('[ASAAS-CHECKOUT] Erro ao fazer parse da resposta:', parseError);
        console.error('[ASAAS-CHECKOUT] Resposta raw:', errorText);
      }
      
      throw new Error(errorMessage);
    }

    const checkout = await checkoutResponse.json();

    console.log('[ASAAS-CHECKOUT] Checkout criado:', checkout.id);
    console.log('[ASAAS-CHECKOUT] Resposta completa do Asaas:', JSON.stringify(checkout, null, 2));

    // Buscar subscription ID do checkout para obter a fatura
    let finalUrl = '';
    let invoiceUrl = '';
    let paymentId = '';

    try {
      // Aguardar um pouco para a subscription ser criada
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Buscar subscription através do customer e status ACTIVE
      const subscriptionResponse = await fetch(`${asaasUrl}/subscriptions?customer=${asaasCustomer.id}&status=ACTIVE`, {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (subscriptionResponse.ok) {
        const subscriptions = await subscriptionResponse.json();
        console.log('[ASAAS-CHECKOUT] Subscriptions encontradas:', JSON.stringify(subscriptions, null, 2));
        
        if (subscriptions.data && subscriptions.data.length > 0) {
          const latestSubscription = subscriptions.data[0];
          console.log('[ASAAS-CHECKOUT] Subscription ID:', latestSubscription.id);
          
          // Buscar pagamentos da subscription
          const paymentsResponse = await fetch(`${asaasUrl}/subscriptions/${latestSubscription.id}/payments`, {
            headers: {
              'access_token': apiKey,
              'Content-Type': 'application/json'
            }
          });
          
          if (paymentsResponse.ok) {
            const payments = await paymentsResponse.json();
            console.log('[ASAAS-CHECKOUT] Pagamentos da subscription:', JSON.stringify(payments, null, 2));
            
            if (payments.data && payments.data.length > 0) {
              const firstPayment = payments.data[0];
              invoiceUrl = firstPayment.invoiceUrl;
              paymentId = firstPayment.id;
              finalUrl = invoiceUrl;
              console.log('[ASAAS-CHECKOUT] ✅ Fatura encontrada:', invoiceUrl);
            }
          }
        }
      }
    } catch (error) {
      console.log('[ASAAS-CHECKOUT] ⚠️ Erro ao buscar fatura, usando checkout fallback:', error.message);
    }

    // Fallback para checkout se não conseguir obter a fatura
    if (!finalUrl) {
      const asaasEnv = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
      const baseUrl = asaasEnv === 'production' 
        ? 'https://www.asaas.com/checkoutSession/show' 
        : 'https://sandbox.asaas.com/checkoutSession/show';
      finalUrl = `${baseUrl}/${checkout.id}`;
      console.log('[ASAAS-CHECKOUT] 📋 Usando checkout fallback:', finalUrl);
    }

    console.log('[ASAAS-CHECKOUT] URL final construída:', finalUrl);

    // Retornar resposta com fatura ou checkout
    return new Response(JSON.stringify({
      success: true,
      checkoutUrl: finalUrl, // Mantém compatibilidade
      invoiceUrl: invoiceUrl || finalUrl, // Nova URL da fatura
      checkoutId: checkout.id,
      paymentId: paymentId || null, // ID do pagamento se encontrado
      reference
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });

  } catch (error) {
    console.error('[ASAAS-CHECKOUT] Erro:', error.message);
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