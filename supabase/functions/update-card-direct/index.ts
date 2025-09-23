import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface CreditCardData {
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  holderName: string;
  holderCpf: string;
}

interface UpdateCardRequest {
  scenario: 'update_card_only' | 'update_card_cancel_overdue';
  cardToken?: string; // For saved cards
  cardData?: CreditCardData; // For new cards
  saveCard?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[UPDATE-CARD-DIRECT] Iniciando processamento...');

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

    const { scenario, cardToken, cardData, saveCard = false }: UpdateCardRequest = await req.json();
    console.log('[UPDATE-CARD-DIRECT] Cenário:', scenario, 'Usuário:', user.email);

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

    let finalCardToken = cardToken;

    // Se não foi fornecido um token, tokenizar novo cartão
    if (!cardToken && cardData) {
      console.log('[UPDATE-CARD-DIRECT] Tokenizando novo cartão...');
      
      const tokenizeResponse = await fetch(`${asaasUrl}/creditCard/tokenize`, {
        method: 'POST',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: asaasCustomer.asaas_customer_id,
          creditCard: {
            holderName: cardData.holderName,
            number: cardData.number,
            expiryMonth: cardData.expiryMonth,
            expiryYear: cardData.expiryYear,
            ccv: cardData.ccv
          },
          creditCardHolderInfo: {
            name: cardData.holderName,
            cpfCnpj: cardData.holderCpf
          }
        })
      });

      if (!tokenizeResponse.ok) {
        const error = await tokenizeResponse.text();
        throw new Error(`Erro ao tokenizar cartão: ${error}`);
      }

      const tokenData = await tokenizeResponse.json();
      finalCardToken = tokenData.creditCardToken;

      // Salvar cartão tokenizado se solicitado
      if (saveCard) {
        console.log('[UPDATE-CARD-DIRECT] Salvando cartão tokenizado...');
        
        await supabase
          .from('poupeja_tokenized_cards')
          .insert({
            user_id: user.id,
            asaas_customer_id: asaasCustomer.asaas_customer_id,
            credit_card_token: finalCardToken,
            credit_card_number: cardData.number.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4'),
            credit_card_last_four: cardData.number.slice(-4),
            credit_card_brand: detectCardBrand(cardData.number),
            holder_name: cardData.holderName,
            expires_at: `${cardData.expiryMonth}/${cardData.expiryYear}`
          });
      }
    }

    let result;

    switch (scenario) {
      case 'update_card_only':
        result = await updateCardOnly(asaasUrl, apiKey, subscription.asaas_subscription_id, finalCardToken);
        break;
      
      case 'update_card_cancel_overdue':
        result = await updateCardCancelOverdue(asaasUrl, apiKey, asaasCustomer.asaas_customer_id, subscription.asaas_subscription_id, finalCardToken);
        break;
      
      default:
        throw new Error('Cenário não especificado ou inválido');
    }

    console.log('[UPDATE-CARD-DIRECT] ✅ Operação concluída com sucesso');

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[UPDATE-CARD-DIRECT] ❌ Erro:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

function detectCardBrand(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  
  if (/^4/.test(cleanNumber)) return 'VISA';
  if (/^5[1-5]/.test(cleanNumber)) return 'MASTERCARD';
  if (/^3[47]/.test(cleanNumber)) return 'AMEX';
  if (/^6/.test(cleanNumber)) return 'DISCOVER';
  
  return 'OTHER';
}

// Cenário 1: Trocar cartão sem cobrança adicional
async function updateCardOnly(asaasUrl: string, apiKey: string, subscriptionId: string, cardToken: string) {
  console.log('[UPDATE-CARD-DIRECT] Cenário 1: Atualizando apenas cartão');
  
  const response = await fetch(`${asaasUrl}/subscriptions/${subscriptionId}`, {
    method: 'PUT',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      billingType: 'CREDIT_CARD',
      creditCardToken: cardToken,
      updatePendingPayments: false // Não alterar pagamentos pendentes
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao atualizar cartão: ${error}`);
  }

  const subscription = await response.json();
  
  return {
    message: 'Cartão atualizado com sucesso! O novo cartão será usado nas próximas cobranças.',
    invoiceUrl: null
  };
}

// Cenário 2: Trocar cartão e cancelar dívidas antigas
async function updateCardCancelOverdue(asaasUrl: string, apiKey: string, customerId: string, subscriptionId: string, cardToken: string) {
  console.log('[UPDATE-CARD-DIRECT] Cenário 2: Cancelando dívidas antigas e atualizando cartão');
  
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
      console.log(`[UPDATE-CARD-DIRECT] Pagamento ${payment.id} cancelado`);
    }
  }

  // 3. Atualizar assinatura com nova data de vencimento (hoje) e novo cartão
  const today = new Date().toISOString().split('T')[0];
  
  const response = await fetch(`${asaasUrl}/subscriptions/${subscriptionId}`, {
    method: 'PUT',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      billingType: 'CREDIT_CARD',
      creditCardToken: cardToken,
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
    message: 'Dívidas antigas canceladas e novo cartão configurado! Uma nova cobrança será gerada hoje.',
    invoiceUrl: `${asaasUrl.replace('/api/v3', '')}/subscription/${subscriptionId}`
  };
}