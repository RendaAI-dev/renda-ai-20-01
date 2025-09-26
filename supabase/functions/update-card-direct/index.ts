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

    // Buscar dados do usuário
    console.log('[UPDATE-CARD-DIRECT] Buscando dados do usuário...');
    
    const { data: userProfile } = await supabase
      .from('poupeja_users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // Merge inteligente: priorizar poupeja_users, mas fazer fallback para user_metadata em campos vazios
    const rawUserData = {
      id: user.id,
      email: user.email,
      name: userProfile?.name || user.user_metadata?.full_name || user.user_metadata?.name || 'Cliente',
      phone: userProfile?.phone || user.user_metadata?.phone || '',
      cpf: userProfile?.cpf || user.user_metadata?.cpf || '',
      cep: userProfile?.cep || user.user_metadata?.cep || user.user_metadata?.address?.cep || '',
      street: userProfile?.street || user.user_metadata?.address?.street || '',
      number: userProfile?.number || user.user_metadata?.address?.number || '',
      complement: userProfile?.complement || user.user_metadata?.address?.complement || '',
      neighborhood: userProfile?.neighborhood || user.user_metadata?.address?.neighborhood || '',
      city: userProfile?.city || user.user_metadata?.address?.city || '',
      state: userProfile?.state || user.user_metadata?.address?.state || ''
    };

    // Sanitizar dados para envio ao Asaas
    const userData = {
      ...rawUserData,
      phone: sanitizePhone(rawUserData.phone),
      cpf: sanitizeCPF(rawUserData.cpf),
      cep: sanitizeCEP(rawUserData.cep)
    };

    console.log('[UPDATE-CARD-DIRECT] Dados do usuário processados:', {
      fonte_dados: userProfile ? 'poupeja_users + metadata' : 'metadata_only',
      cep: userData.cep,
      cep_original: rawUserData.cep,
      cpf: userData.cpf ? '***' : 'vazio'
    });

    // Validar CEP
    if (!isValidCEP(userData.cep)) {
      console.log('[UPDATE-CARD-DIRECT] CEP inválido:', userData.cep);
      return new Response(JSON.stringify({
        success: false,
        code: 'INVALID_POSTAL_CODE',
        message: 'CEP inválido. Por favor, atualize seus dados no perfil com um CEP válido.',
        requiresNewCard: true,
        details: { current_cep: userData.cep }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Buscar assinatura ativa
    const { data: subscription } = await supabase
      .from('poupeja_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('payment_processor', 'asaas')
      .single();

    if (!subscription) {
      return new Response(JSON.stringify({
        success: false,
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'Nenhuma assinatura ativa encontrada',
        requiresNewCard: false
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Determinar asaas_customer_id - priorizar subscription, depois saved cards, depois mapping
    let asaasCustomerId: string | null = null;
    let customerIdSource = '';

    console.log('[UPDATE-CARD-DIRECT] Determinando asaas_customer_id...');
    
    // Se usando cartão salvo, buscar o customer_id do token específico
    if (cardToken) {
      console.log('[UPDATE-CARD-DIRECT] Buscando customer_id do cartão salvo...');
      const { data: tokenData } = await supabase
        .from('poupeja_tokenized_cards')
        .select('asaas_customer_id')
        .eq('user_id', user.id)
        .eq('credit_card_token', cardToken)
        .eq('is_active', true)
        .maybeSingle();

      if (tokenData) {
        asaasCustomerId = tokenData.asaas_customer_id;
        customerIdSource = 'saved_card';
        console.log('[UPDATE-CARD-DIRECT] Customer ID encontrado via cartão salvo:', asaasCustomerId);
      } else {
        console.log('[UPDATE-CARD-DIRECT] Cartão salvo não encontrado ou inativo');
        return new Response(JSON.stringify({
          success: false,
          code: 'INVALID_CARD_TOKEN',
          message: 'Cartão salvo não encontrado ou expirado. Por favor, adicione um novo cartão.',
          requiresNewCard: true
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    } else {
      // Prioridade 1: assinatura ativa
      if (subscription.asaas_customer_id) {
        asaasCustomerId = subscription.asaas_customer_id;
        customerIdSource = 'subscription';
      } else {
        // Prioridade 2: fallback para mapping table
        const { data: customerMapping } = await supabase
          .from('poupeja_asaas_customers')
          .select('asaas_customer_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (customerMapping) {
          asaasCustomerId = customerMapping.asaas_customer_id;
          customerIdSource = 'mapping';
        }
      }
    }

    if (!asaasCustomerId) {
      return new Response(JSON.stringify({
        success: false,
        code: 'NO_ASAAS_CUSTOMER',
        message: 'Cliente Asaas não encontrado. Por favor, entre em contato com o suporte.',
        requiresNewCard: false
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('[UPDATE-CARD-DIRECT] asaas_customer_id:', asaasCustomerId, 'source:', customerIdSource);

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
      console.log('[UPDATE-CARD-DIRECT] postalCodeUsed:', userData.cep);
      
      const tokenizeResponse = await fetch(`${asaasUrl}/creditCard/tokenize`, {
        method: 'POST',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: asaasCustomerId,
          creditCard: {
            holderName: cardData.holderName,
            number: cardData.number,
            expiryMonth: cardData.expiryMonth,
            expiryYear: cardData.expiryYear,
            ccv: cardData.ccv
          },
          creditCardHolderInfo: {
            name: userData.name || cardData.holderName,
            email: userData.email,
            cpfCnpj: sanitizeCPF(cardData.holderCpf || userData.cpf),
            postalCode: userData.cep,
            addressNumber: userData.number || 'S/N',
            addressComplement: userData.complement || '',
            phone: userData.phone
          }
        })
      });

      if (!tokenizeResponse.ok) {
        const errorText = await tokenizeResponse.text();
        console.error('[UPDATE-CARD-DIRECT] Erro ao tokenizar:', errorText);
        
        return new Response(JSON.stringify({
          success: false,
          code: 'TOKENIZATION_ERROR',
          message: 'Erro ao processar os dados do cartão. Verifique as informações e tente novamente.',
          requiresNewCard: true,
          details: errorText
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
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
            asaas_customer_id: asaasCustomerId,
            credit_card_token: finalCardToken,
            credit_card_number: cardData.number.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4'),
            credit_card_last_four: cardData.number.slice(-4),
            credit_card_brand: detectCardBrand(cardData.number),
            holder_name: cardData.holderName,
            expires_at: `${cardData.expiryMonth}/${cardData.expiryYear}`
          });
      }
    }

    // Validar token do cartão salvo no Asaas se estiver usando saved card
    if (cardToken) {
      console.log('[UPDATE-CARD-DIRECT] Validando token do cartão salvo no Asaas...');
      
      const validateResponse = await fetch(`${asaasUrl}/customers/${asaasCustomerId}/creditCards`, {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!validateResponse.ok) {
        console.error('[UPDATE-CARD-DIRECT] Erro ao validar cartão:', validateResponse.status);
        
        // 404 significa que o cliente não tem cartões salvos no Asaas
        if (validateResponse.status === 404) {
          console.log('[UPDATE-CARD-DIRECT] Cliente não possui cartões salvos no Asaas');
          return new Response(JSON.stringify({
            success: false,
            code: 'CUSTOMER_HAS_NO_SAVED_CARDS',
            message: 'Não encontramos cartões salvos no Asaas para este cliente. Por favor, adicione um novo cartão.',
            requiresNewCard: true
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        
        // Outros erros
        return new Response(JSON.stringify({
          success: false,
          code: 'ASAAS_API_ERROR',
          message: 'Erro ao consultar cartões no Asaas. Tente novamente.',
          requiresNewCard: false
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const cardsData = await validateResponse.json();
      console.log('[UPDATE-CARD-DIRECT] Cartões encontrados no Asaas:', cardsData.data?.length || 0);
      
      const validTokens = cardsData.data?.map((card: any) => card.creditCardToken) || [];
      console.log('[UPDATE-CARD-DIRECT] Tokens válidos:', validTokens.map((t: string) => t.substring(0, 8) + '...'));
      console.log('[UPDATE-CARD-DIRECT] Token sendo validado:', cardToken.substring(0, 8) + '...');
      
      if (!validTokens.includes(cardToken)) {
        console.error('[UPDATE-CARD-DIRECT] Token não encontrado na lista de cartões válidos');
        return new Response(JSON.stringify({
          success: false,
          code: 'INVALID_CARD_TOKEN',
          message: 'Este cartão não pertence a este cliente no Asaas. Por favor, adicione um novo cartão.',
          requiresNewCard: true
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      console.log('[UPDATE-CARD-DIRECT] ✅ Token válido encontrado na lista do Asaas');
    }

    let result;

    switch (scenario) {
      case 'update_card_only':
        result = await updateCardOnly(asaasUrl, apiKey, subscription.asaas_subscription_id, finalCardToken || '');
        break;
      
      case 'update_card_cancel_overdue':
        result = await updateCardCancelOverdue(asaasUrl, apiKey, asaasCustomerId, subscription.asaas_subscription_id, finalCardToken || '');
        break;
      
      default:
        return new Response(JSON.stringify({
          success: false,
          code: 'INVALID_SCENARIO',
          message: 'Cenário não especificado ou inválido'
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    console.log('[UPDATE-CARD-DIRECT] ✅ Operação concluída com sucesso');

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[UPDATE-CARD-DIRECT] ❌ Erro:', errorMessage);
    
    // Determinar código de erro baseado na mensagem
    let errorCode = 'GENERAL_ERROR';
    if (errorMessage.includes('cartão')) {
      errorCode = 'CARD_ERROR';
    } else if (errorMessage.includes('assinatura')) {
      errorCode = 'SUBSCRIPTION_ERROR';
    } else if (errorMessage.includes('cliente')) {
      errorCode = 'CUSTOMER_ERROR';
    }
    
    return new Response(JSON.stringify({
      success: false,
      code: errorCode,
      message: errorMessage,
      requiresNewCard: errorCode === 'CARD_ERROR'
    }), {
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

function sanitizeCEP(cep: string): string {
  if (!cep) return '';
  return cep.replace(/\D/g, ''); // Remove tudo que não for dígito
}

function sanitizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, ''); // Remove tudo que não for dígito
}

function sanitizeCPF(cpf: string): string {
  if (!cpf) return '';
  return cpf.replace(/\D/g, ''); // Remove tudo que não for dígito
}

function isValidCEP(cep: string): boolean {
  if (!cep) return false;
  
  // Sanitizar primeiro
  const cleanCep = sanitizeCEP(cep);
  
  // Verificar se tem 8 dígitos
  if (!/^\d{8}$/.test(cleanCep)) return false;
  
  // Verificar se não é CEP genérico/inválido
  const invalidCeps = ['00000000', '11111111', '22222222', '33333333', '44444444', '55555555', '66666666', '77777777', '88888888', '99999999'];
  if (invalidCeps.includes(cleanCep)) return false;
  
  return true;
}

// Cenário 1: Trocar cartão sem cobrança adicional
async function updateCardOnly(asaasUrl: string, apiKey: string, subscriptionId: string, cardToken: string) {
  console.log('[UPDATE-CARD-DIRECT] Cenário 1: Atualizando apenas cartão');
  console.log('[UPDATE-CARD-DIRECT] Subscription ID:', subscriptionId);
  console.log('[UPDATE-CARD-DIRECT] Novo token:', cardToken.substring(0, 8) + '...');
  
  const updatePayload = {
    billingType: 'CREDIT_CARD',
    creditCardToken: cardToken,
    updatePendingPayments: false // Não alterar pagamentos pendentes
  };
  
  console.log('[UPDATE-CARD-DIRECT] Enviando atualização para Asaas:', JSON.stringify(updatePayload, null, 2));
  
  const response = await fetch(`${asaasUrl}/subscriptions/${subscriptionId}`, {
    method: 'PUT',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatePayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[UPDATE-CARD-DIRECT] Erro Asaas na atualização:', errorText);
    
    // Tentar parsear erro do Asaas
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.errors && errorData.errors[0]?.code === 'invalid_creditCard') {
        throw new Error('INVALID_CARD_TOKEN');
      }
    } catch (parseError) {
      // Se não conseguir parsear, manter erro original
    }
    
    throw new Error(`Erro ao atualizar cartão: ${errorText}`);
  }

  const subscription = await response.json();
  console.log('[UPDATE-CARD-DIRECT] ✅ Subscription atualizada no Asaas');
  console.log('[UPDATE-CARD-DIRECT] Dados da subscription:', {
    id: subscription.id,
    status: subscription.status,
    creditCard: subscription.creditCard ? {
      number: subscription.creditCard.creditCardNumber,
      brand: subscription.creditCard.creditCardBrand,
      token: subscription.creditCard.creditCardToken
    } : null
  });
  
  // Verificar se o token foi realmente aplicado
  if (subscription.creditCard?.creditCardToken !== cardToken) {
    console.error('[UPDATE-CARD-DIRECT] ⚠️ Token não foi aplicado corretamente!');
    console.error('[UPDATE-CARD-DIRECT] Esperado:', cardToken);
    console.error('[UPDATE-CARD-DIRECT] Recebido:', subscription.creditCard?.creditCardToken);
  } else {
    console.log('[UPDATE-CARD-DIRECT] ✅ Token aplicado corretamente na subscription');
  }
  
  return {
    message: 'Cartão atualizado com sucesso! O novo cartão será usado nas próximas cobranças.',
    invoiceUrl: null,
    updatedSubscription: {
      id: subscription.id,
      status: subscription.status,
      creditCardToken: subscription.creditCard?.creditCardToken,
      creditCardNumber: subscription.creditCard?.creditCardNumber
    }
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
    const errorText = await response.text();
    console.error('[UPDATE-CARD-DIRECT] Erro Asaas na atualização da assinatura:', errorText);
    
    // Tentar parsear erro do Asaas
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.errors && errorData.errors[0]?.code === 'invalid_creditCard') {
        throw new Error('INVALID_CARD_TOKEN');
      }
    } catch (parseError) {
      // Se não conseguir parsear, manter erro original
    }
    
    throw new Error(`Erro ao atualizar assinatura: ${errorText}`);
  }

  const subscription = await response.json();
  
  return {
    message: 'Dívidas antigas canceladas e novo cartão configurado! Uma nova cobrança será gerada hoje.',
    invoiceUrl: `${asaasUrl.replace('/api/v3', '')}/subscription/${subscriptionId}`
  };
}