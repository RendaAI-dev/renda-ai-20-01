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
    console.log('[UPDATE-PAYMENT-METHOD] Iniciando processamento...');

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

    const { scenario } = await req.json();
    console.log('[UPDATE-PAYMENT-METHOD] Cenário:', scenario, 'Usuário:', user.email);

    // Buscar assinatura ativa
    const { data: subscription } = await supabase
      .from('poupeja_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('payment_processor', 'asaas')
      .single();

    if (!subscription) {
      throw new Error('Nenhuma assinatura ativa encontrada');
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
      .select('key, value')
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

    let result;

    switch (scenario) {
      case 'update_card_only':
        result = await updateCardOnly(asaasUrl, apiKey, subscription.asaas_subscription_id);
        break;
      
      case 'update_card_cancel_overdue':
        result = await updateCardCancelOverdue(asaasUrl, apiKey, asaasCustomer.asaas_customer_id, subscription.asaas_subscription_id);
        break;
      
      default:
        throw new Error('Cenário não especificado ou inválido');
    }

    console.log('[UPDATE-PAYMENT-METHOD] ✅ Operação concluída com sucesso');

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[UPDATE-PAYMENT-METHOD] ❌ Erro:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

// Cenário 1: Trocar cartão sem cobrança adicional
async function updateCardOnly(asaasUrl: string, apiKey: string, subscriptionId: string) {
  console.log('[UPDATE-PAYMENT-METHOD] Cenário 1: Atualizando apenas cartão');
  
  const response = await fetch(`${asaasUrl}/subscriptions/${subscriptionId}`, {
    method: 'PUT',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      billingType: 'CREDIT_CARD',
      updatePendingPayments: false // Não alterar pagamentos pendentes
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao atualizar cartão: ${error}`);
  }

  const subscription = await response.json();
  
  return {
    message: 'Cartão será atualizado na próxima cobrança',
    invoiceUrl: subscription.nextDueDate ? `${asaasUrl.replace('/api/v3', '')}/subscription/${subscriptionId}` : null
  };
}

// Cenário 2: Trocar cartão e cancelar dívidas antigas
async function updateCardCancelOverdue(asaasUrl: string, apiKey: string, customerId: string, subscriptionId: string) {
  console.log('[UPDATE-PAYMENT-METHOD] Cenário 2: Cancelando dívidas antigas e atualizando cartão');
  
  // 1. Buscar pagamentos em atraso
  const paymentsResponse = await fetch(`${asaasUrl}/payments?customer=${customerId}&status=OVERDUE`, {
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (paymentsResponse.ok) {
    const paymentsData = await paymentsResponse.json();
    const overduePayments = paymentsData.data || [];
    
    // 2. Cancelar pagamentos em atraso
    for (const payment of overduePayments) {
      await fetch(`${asaasUrl}/payments/${payment.id}`, {
        method: 'DELETE',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });
      console.log(`[UPDATE-PAYMENT-METHOD] Pagamento ${payment.id} cancelado`);
    }
  }

  // 3. Atualizar assinatura com nova data de vencimento (hoje)
  const today = new Date().toISOString().split('T')[0];
  
  const response = await fetch(`${asaasUrl}/subscriptions/${subscriptionId}`, {
    method: 'PUT',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      billingType: 'CREDIT_CARD',
      nextDueDate: today,
      updatePendingPayments: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao atualizar assinatura: ${error}`);
  }

  const subscription = await response.json();
  
  return {
    message: 'Dívidas antigas canceladas, nova cobrança será gerada',
    invoiceUrl: `${asaasUrl.replace('/api/v3', '')}/subscription/${subscriptionId}`
  };
}