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

    // Buscar valores dos planos nas configurações (corrigido para chaves corretas)
    const { data: priceSettings } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'pricing')
      .in('key', ['plan_price_monthly', 'plan_price_annual']);

    const normalizePrice = (v?: string | null) => {
      if (!v) return 0;
      const s = String(v).replace(/\./g, '').replace(',', '.');
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    const priceConfig = priceSettings?.reduce((acc, setting) => {
      acc[setting.key] = normalizePrice(setting.value);
      return acc;
    }, {} as Record<string, number>) ?? {};

    // Valores com fallback
    const planValues = {
      monthly: priceConfig.plan_price_monthly || 49.9,
      annual: priceConfig.plan_price_annual || 499.9
    } as const;

    const value = planValues[planType as keyof typeof planValues];
    if (!value) {
      throw new Error('Tipo de plano inválido');
    }

    console.log(`[ASAAS-CHECKOUT] Valor do plano ${planType}: ${value}`);

    // Criar Checkout do Asaas para ASSINATURA recorrente com cartão de crédito
    const reference = `${user.id}_${planType}_${Date.now()}`;
    const cycle = planType === 'monthly' ? 'MONTHLY' : 'ANNUALLY';
    
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
      subscription: {
        value: value,
        cycle: cycle,
        description: `Assinatura ${planType === 'monthly' ? 'Mensal' : 'Anual'} - Renda AI`
      }
    };

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
      console.error('[ASAAS-CHECKOUT] Erro ao criar checkout:', errorText);
      console.error('[ASAAS-CHECKOUT] Status:', checkoutResponse.status);
      console.error('[ASAAS-CHECKOUT] Dados enviados:', JSON.stringify(checkoutData, null, 2));

      let errorMessage = 'Erro ao criar checkout no Asaas';
      try {
        const errorObj = JSON.parse(errorText);
        if (errorObj.errors && Array.isArray(errorObj.errors)) {
          errorMessage = errorObj.errors.map((e: any) => e.description || e.message).join(', ');
        }
      } catch (_) {}
      throw new Error(errorMessage);
    }

    const checkout = await checkoutResponse.json();

    console.log('[ASAAS-CHECKOUT] Checkout criado:', checkout.id);

    // Retornar URL do checkout hospedado pelo Asaas
    return new Response(JSON.stringify({
      success: true,
      checkoutUrl: checkout.url || checkout.invoiceUrl,
      checkoutId: checkout.id,
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