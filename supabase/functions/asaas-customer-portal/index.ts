import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[ASAAS-CUSTOMER-PORTAL] Processando solicitação...');

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

    console.log('[ASAAS-CUSTOMER-PORTAL] Usuário autenticado:', user.email);

    // Buscar assinatura ativa do usuário
    const { data: subscription } = await supabase
      .from('poupeja_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('payment_processor', 'asaas')
      .single();

    if (!subscription) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhuma assinatura ativa encontrada'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Buscar cliente Asaas
    const { data: asaasCustomer } = await supabase
      .from('poupeja_asaas_customers')
      .select('asaas_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!asaasCustomer) {
      throw new Error('Cliente Asaas não encontrado');
    }

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

    // Buscar dados do cliente no Asaas
    const customerResponse = await fetch(`${asaasUrl}/customers/${asaasCustomer.asaas_customer_id}`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!customerResponse.ok) {
      throw new Error('Erro ao buscar dados do cliente no Asaas');
    }

    const customerData = await customerResponse.json();

    // Buscar pagamentos do cliente
    const paymentsResponse = await fetch(`${asaasUrl}/payments?customer=${asaasCustomer.asaas_customer_id}&limit=10`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    let payments = [];
    if (paymentsResponse.ok) {
      const paymentsData = await paymentsResponse.json();
      payments = paymentsData.data || [];
    }

    // Como o Asaas não tem um portal nativo como o Stripe, 
    // vamos retornar os dados para o frontend criar sua própria interface
    const portalData = {
      customer: {
        id: customerData.id,
        name: customerData.name,
        email: customerData.email,
        cpfCnpj: customerData.cpfCnpj,
        phone: customerData.phone || customerData.mobilePhone
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan_type: subscription.plan_type,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end
      },
      recent_payments: payments.map((payment: any) => ({
        id: payment.id,
        value: payment.value,
        status: payment.status,
        dueDate: payment.dueDate,
        paymentDate: payment.paymentDate,
        description: payment.description,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl
      })),
      urls: {
        // URLs para ações no Asaas (se disponíveis)
        manage_payment_methods: `${asaasUrl}/customers/${asaasCustomer.asaas_customer_id}`,
        download_invoices: payments[0]?.invoiceUrl || null
      }
    };

    console.log('[ASAAS-CUSTOMER-PORTAL] Portal data gerado com sucesso');

    return new Response(JSON.stringify({
      success: true,
      portal_data: portalData,
      // Para compatibilidade, ainda podemos retornar uma URL se necessário
      url: customerData.additionalEmails ? `mailto:${customerData.email}` : null,
      message: 'Dados do portal recuperados com sucesso'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ASAAS-CUSTOMER-PORTAL] Erro:', errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});