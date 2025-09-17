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

    // Buscar valores dos planos nas configurações
    const { data: priceSettings } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'pricing')
      .in('key', ['monthly_price', 'annual_price']);

    const priceConfig = priceSettings?.reduce((acc, setting) => {
      acc[setting.key] = parseFloat(setting.value) || 0;
      return acc;
    }, {} as Record<string, number>) ?? {};

    // Valores com fallback
    const planValues = {
      monthly: priceConfig.monthly_price || 9.99,
      annual: priceConfig.annual_price || 99.99
    };

    const value = planValues[planType as keyof typeof planValues];
    if (!value) {
      throw new Error('Tipo de plano inválido');
    }

    console.log(`[ASAAS-CHECKOUT] Valor do plano ${planType}: ${value}`);

    // Criar cobrança no Asaas para pagamento via cartão de crédito
    const paymentData = {
      customer: asaasCustomer.id,
      billingType: 'CREDIT_CARD',
      value: value,
      dueDate: new Date().toISOString().split('T')[0],
      description: `Assinatura ${planType === 'monthly' ? 'Mensal' : 'Anual'} - Renda AI`,
      externalReference: `${user.id}_${planType}_${Date.now()}`
    };

    const paymentResponse = await fetch(`${asaasUrl}/payments`, {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      console.error('[ASAAS-CHECKOUT] Erro ao criar cobrança:', errorText);
      console.error('[ASAAS-CHECKOUT] Status:', paymentResponse.status);
      console.error('[ASAAS-CHECKOUT] Dados enviados:', JSON.stringify(paymentData, null, 2));
      
      let errorMessage = 'Erro ao criar cobrança no Asaas';
      try {
        const errorObj = JSON.parse(errorText);
        if (errorObj.errors && Array.isArray(errorObj.errors)) {
          errorMessage = errorObj.errors.map((e: any) => e.description || e.message).join(', ');
        }
      } catch (e) {
        // Se não conseguir parsear, usar mensagem padrão
      }
      
      throw new Error(errorMessage);
    }

    const payment: AsaasPayment = await paymentResponse.json();

    // Salvar pagamento no banco
    await supabase
      .from('poupeja_asaas_payments')
      .insert({
        user_id: user.id,
        asaas_payment_id: payment.id,
        asaas_customer_id: asaasCustomer.id,
        status: payment.status,
        amount: value,
        due_date: payment.dueDate,
        method: 'CHECKOUT',
        description: paymentData.description,
        external_reference: paymentData.externalReference,
        invoice_url: payment.invoiceUrl,
        bank_slip_url: payment.bankSlipUrl
      });

    console.log('[ASAAS-CHECKOUT] Cobrança criada:', payment.id);

    // Retornar URL do checkout (invoice_url do Asaas)
    return new Response(JSON.stringify({
      success: true,
      checkoutUrl: payment.invoiceUrl,
      paymentId: payment.id
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