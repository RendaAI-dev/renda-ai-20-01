import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Credit card data interface
interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  holderCpf: string;
}

// Cardholder data interface
interface CardholderData {
  name: string;
  cpf: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  phone: string;
}

// Request body interface
interface CheckoutRequest {
  planType: 'monthly' | 'annual';
  creditCard?: CreditCardData;
  cardholderData?: CardholderData;
  savedCardToken?: string;
  isUpgrade?: boolean;
  currentSubscriptionId?: string;
}

// Function to detect card brand from number
function detectCardBrand(cardNumber: string): string {
  const number = cardNumber.replace(/\s/g, '');
  
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  if (/^2[2-7]/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'American Express';
  if (/^6(?:011|5)/.test(number)) return 'Discover';
  if (/^35/.test(number)) return 'JCB';
  if (/^30[0-5]/.test(number)) return 'Diners Club';
  
  return 'Unknown';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TRANSPARENT-CHECKOUT] Iniciando processamento...');
    
    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    console.log('[TRANSPARENT-CHECKOUT] Usuário autenticado:', user.id);
    
    // Parse request body
    const body = await req.json() as CheckoutRequest;
    const { 
      planType, 
      creditCard, 
      cardholderData,
      savedCardToken, 
      isUpgrade, 
      currentSubscriptionId 
    } = body;

    const remoteIp = req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    console.log('[TRANSPARENT-CHECKOUT] remoteIp:', remoteIp);
    
    console.log('[TRANSPARENT-CHECKOUT] Dados recebidos:', {
      planType,
      hasNewCard: !!creditCard,
      hasCardholderData: !!cardholderData,
      hasSavedToken: !!savedCardToken,
      isUpgrade: !!isUpgrade
    });

    // Get Asaas configuration
    console.log('[TRANSPARENT-CHECKOUT] Buscando configurações do Asaas...');
    
    const { data: asaasConfig, error: configError } = await supabaseClient.functions.invoke('get-asaas-config');
    if (configError || !asaasConfig?.success) {
      throw new Error('Erro ao buscar configurações de pagamento');
    }

    const { asaasApiKey, asaasBaseUrl } = asaasConfig.data;

    // Get user data
    console.log('[TRANSPARENT-CHECKOUT] Buscando dados do usuário...');
    const { data: userData, error: userDataError } = await supabaseClient
      .from('poupeja_users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userDataError) {
      throw new Error('Usuário não encontrado na base de dados');
    }
    
    console.log('[TRANSPARENT-CHECKOUT] Dados encontrados na tabela poupeja_users');

    // Get plan configuration
    console.log('[TRANSPARENT-CHECKOUT] Buscando dados do plano no banco...');
    const { data: planData, error: planError } = await supabaseClient
      .from('poupeja_plans')
      .select('*')
      .eq('plan_period', planType)
      .eq('is_active', true)
      .single();

    if (planError || !planData) {
      throw new Error('Plano não encontrado ou inativo');
    }

    console.log('[TRANSPARENT-CHECKOUT] Dados do plano:', {
      planType,
      planPrice: planData.price,
      asaasPriceId: planData.asaas_price_id,
      planName: planData.name
    });

    // Check if customer already exists in Asaas
    console.log('[TRANSPARENT-CHECKOUT] Verificando cliente Asaas existente...');
    const { data: existingCustomer } = await supabaseClient
      .from('poupeja_asaas_customers')
      .select('asaas_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let asaasCustomerId = existingCustomer?.asaas_customer_id;
    
    if (asaasCustomerId) {
      console.log('[TRANSPARENT-CHECKOUT] Cliente Asaas existente:', asaasCustomerId);
    } else {
      // Create new customer in Asaas
      const customerPayload = {
        name: userData.name || user.email?.split('@')[0] || 'Usuário',
        email: userData.email || user.email,
        phone: userData.phone || '',
        cpfCnpj: userData.cpf || ''
      };

      const customerResponse = await fetch(`${asaasBaseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey,
        },
        body: JSON.stringify(customerPayload)
      });

      if (!customerResponse.ok) {
        const customerError = await customerResponse.text();
        console.error('[TRANSPARENT-CHECKOUT] Erro ao criar cliente:', customerError);
        throw new Error('Falha ao criar cliente no sistema de pagamento');
      }

      const customerData = await customerResponse.json();
      asaasCustomerId = customerData.id;
      
      // Save customer in database
      await supabaseClient
        .from('poupeja_asaas_customers')
        .insert({
          user_id: user.id,
          asaas_customer_id: asaasCustomerId,
          email: userData.email || user.email,
          phone: userData.phone || '',
          cpf: userData.cpf || '',
          name: userData.name || user.email?.split('@')[0] || 'Usuário'
        });

      console.log('[TRANSPARENT-CHECKOUT] ✅ Novo cliente criado no Asaas:', asaasCustomerId);
    }

    // Handle payment method (saved card vs new card)
    let tokenData: any = null;
    let shouldSaveCard = false;
    
    if (savedCardToken) {
      console.log('[TRANSPARENT-CHECKOUT] Validando token de cartão salvo:', savedCardToken.substring(0, 8) + '...');
      
      try {
        // Validate saved card token by checking with Asaas
        const validateResponse = await fetch(`${asaasBaseUrl}/customers/${asaasCustomerId}/creditCards`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'access_token': asaasApiKey,
          }
        });
        
        if (!validateResponse.ok) {
          console.error('[TRANSPARENT-CHECKOUT] Erro ao validar cartão:', validateResponse.status);
          
          if (validateResponse.status === 404) {
            console.log('[TRANSPARENT-CHECKOUT] Cliente não possui cartões salvos no Asaas');
            
            const { error: updateError } = await supabaseClient
              .from('poupeja_tokenized_cards')
              .update({ is_active: false })
              .eq('credit_card_token', savedCardToken)
              .eq('user_id', user.id);
              
            if (!creditCard) {
              console.log('[TRANSPARENT-CHECKOUT] ❌ Cliente sem cartões salvos e sem novo cartão fornecido');
              return new Response(JSON.stringify({
                error: 'INVALID_SAVED_CARD',
                message: 'Não encontramos cartões salvos para este cliente. Por favor, selecione "Usar novo cartão" e preencha os dados.',
                code: 'NO_SAVED_CARDS_AVAILABLE'
              }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            console.log('[TRANSPARENT-CHECKOUT] Prosseguindo com tokenização de novo cartão...');
          } else {
            // Outros erros do Asaas
            if (!creditCard) {
              throw new Error('Erro ao consultar cartões no Asaas. Tente novamente.');
            }
            console.log('[TRANSPARENT-CHECKOUT] Erro na consulta, prosseguindo com novo cartão...');
          }
        } else {
          const cardsData = await validateResponse.json();
          console.log('[TRANSPARENT-CHECKOUT] Cartões encontrados no Asaas:', cardsData.data?.length || 0);
          
          const validTokens = cardsData.data?.map((card: any) => card.creditCardToken) || [];
          console.log('[TRANSPARENT-CHECKOUT] Tokens válidos:', validTokens.map((t: string) => t.substring(0, 8) + '...'));
          console.log('[TRANSPARENT-CHECKOUT] Token sendo validado:', savedCardToken.substring(0, 8) + '...');
          
          if (!validTokens.includes(savedCardToken)) {
            console.error('[TRANSPARENT-CHECKOUT] Token não encontrado na lista de cartões válidos');
            console.log('[TRANSPARENT-CHECKOUT] ⚠️ Token inválido, marcando cartão como inativo e forçando novo cartão');
            
            // Mark card as inactive in database
            await supabaseClient
              .from('poupeja_tokenized_cards')
              .update({ is_active: false })
              .eq('credit_card_token', savedCardToken)
              .eq('user_id', user.id);
              
            // Force new card usage by clearing savedCardToken
            if (!creditCard) {
              console.log('[TRANSPARENT-CHECKOUT] ❌ Cartão salvo inválido e sem novo cartão fornecido');
              return new Response(JSON.stringify({
                error: 'INVALID_SAVED_CARD',
                message: 'O cartão selecionado não é válido. Por favor, selecione outro cartão salvo ou adicione um novo cartão.',
                code: 'SAVED_CARD_INVALID',
                action: 'SELECT_OTHER_OR_ADD_NEW'
              }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            // Continue to new card tokenization below
            console.log('[TRANSPARENT-CHECKOUT] Prosseguindo com tokenização de novo cartão...');
          } else {
            console.log('[TRANSPARENT-CHECKOUT] ✅ Token válido encontrado na lista do Asaas');
            tokenData = { creditCardToken: savedCardToken };
          }
        }
      } catch (tokenValidationError) {
        console.error('[TRANSPARENT-CHECKOUT] Erro ao validar token:', tokenValidationError);
        
        if (!creditCard) {
          console.log('[TRANSPARENT-CHECKOUT] ❌ Erro na validação de cartão e sem novo cartão fornecido');
          return new Response(JSON.stringify({
            error: 'VALIDATION_FAILED',
            message: 'Erro ao validar o cartão selecionado. Por favor, tente outro cartão salvo ou adicione um novo cartão.',
            code: 'CARD_VALIDATION_ERROR',
            action: 'SELECT_OTHER_OR_ADD_NEW'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Continue to new card tokenization below
        console.log('[TRANSPARENT-CHECKOUT] Erro na validação, prosseguindo com novo cartão...');
      }
    }
    
    if (!tokenData && creditCard) {
      // Validate that we have complete cardholder data for new card tokenization
      if (!cardholderData) {
        console.log('[TRANSPARENT-CHECKOUT] ❌ Dados do portador não fornecidos para novo cartão');
        return new Response(JSON.stringify({
          error: 'MISSING_CARDHOLDER_DATA',
          message: 'Dados do portador do cartão são obrigatórios para novos cartões.',
          code: 'CARDHOLDER_DATA_REQUIRED'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validate required cardholder fields
      const requiredFields = ['name', 'cpf', 'cep', 'street', 'number', 'neighborhood', 'city', 'state', 'phone'];
      const missingFields = requiredFields.filter(field => !cardholderData[field as keyof CardholderData]);
      
      if (missingFields.length > 0) {
        console.log('[TRANSPARENT-CHECKOUT] ❌ Campos obrigatórios do portador ausentes:', missingFields);
        return new Response(JSON.stringify({
          error: 'INCOMPLETE_CARDHOLDER_DATA',
          message: `Os seguintes dados do portador são obrigatórios: ${missingFields.join(', ')}`,
          code: 'MISSING_REQUIRED_FIELDS',
          missingFields
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validate CEP format
      const cleanCep = cardholderData.cep.replace(/\D/g, '');
      if (cleanCep.length !== 8 || /^0{8}$/.test(cleanCep)) {
        console.log('[TRANSPARENT-CHECKOUT] ❌ CEP inválido fornecido:', cardholderData.cep);
        return new Response(JSON.stringify({
          error: 'INVALID_CEP',
          message: 'O CEP fornecido é inválido. Por favor, verifique e tente novamente.',
          code: 'INVALID_POSTAL_CODE'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Format CEP properly (XXXXX-XXX)
      const formattedCep = `${cleanCep.substring(0, 5)}-${cleanCep.substring(5)}`;

      // Tokenize new credit card
      console.log('[TRANSPARENT-CHECKOUT] Tokenizando novo cartão de crédito...');
      shouldSaveCard = true;
    
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
            name: cardholderData.name,
            email: userData.email,
            cpfCnpj: cardholderData.cpf,
            postalCode: formattedCep,
            addressNumber: cardholderData.number,
            addressComplement: cardholderData.complement || '',
            phone: cardholderData.phone
          },
          customer: asaasCustomerId,
          remoteIp: remoteIp
        })
      });

      console.log('[TRANSPARENT-CHECKOUT] Status da tokenização:', tokenizeResponse.status);
      
      if (!tokenizeResponse.ok) {
        const errorData = await tokenizeResponse.text();
        console.error('[TRANSPARENT-CHECKOUT] Erro na tokenização:', {
          status: tokenizeResponse.status,
          statusText: tokenizeResponse.statusText,
          error: errorData
        });
        
        // Parse Asaas error response
        try {
          const parsedError = JSON.parse(errorData);
          if (parsedError.errors && parsedError.errors.length > 0) {
            const firstError = parsedError.errors[0];
            let userMessage = 'Erro ao processar dados do cartão.';
            
            if (firstError.code === 'invalid_holderInfo') {
              if (firstError.description.includes('CEP')) {
                userMessage = 'O CEP fornecido é inválido. Verifique e tente novamente.';
              } else if (firstError.description.includes('CPF')) {
                userMessage = 'O CPF fornecido é inválido. Verifique e tente novamente.';
              } else {
                userMessage = 'Dados do portador inválidos. Verifique todas as informações.';
              }
            } else if (firstError.code === 'invalid_creditCard') {
              userMessage = 'Dados do cartão inválidos. Verifique número, validade e código de segurança.';
            }
            
            throw new Error(userMessage);
          }
        } catch (parseError) {
          // If parsing fails, use the raw error
          console.error('[TRANSPARENT-CHECKOUT] Erro ao parsear resposta do Asaas:', parseError);
        }
        
        throw new Error(`Falha na tokenização do cartão (${tokenizeResponse.status}): ${errorData}`);
      }

      const tokenizeData = await tokenizeResponse.json();
      console.log('[TRANSPARENT-CHECKOUT] ✅ Cartão tokenizado com sucesso');
      
      tokenData = {
        creditCardToken: tokenizeData.creditCardToken
      };
    } else if (!tokenData) {
      throw new Error('Método de pagamento não especificado');
    }
    
    // Save tokenized card data only for new cards
    if (shouldSaveCard && creditCard && cardholderData) {
      const cardBrand = detectCardBrand(creditCard.number);
      const lastFour = creditCard.number.replace(/\s/g, '').slice(-4);
      const maskedNumber = `****-****-****-${lastFour}`;
      
      try {
        // Check if user already has this card (by last 4 digits and brand)
        const { data: existingCards } = await supabaseClient
          .from('poupeja_tokenized_cards')
          .select('id')
          .eq('user_id', user.id)
          .eq('credit_card_last_four', lastFour)
          .eq('credit_card_brand', cardBrand);
        
        // Only save if this card doesn't exist yet
        if (!existingCards || existingCards.length === 0) {
          // Check if this will be the user's first card (make it default)
          const { data: userCards } = await supabaseClient
            .from('poupeja_tokenized_cards')
            .select('id')
            .eq('user_id', user.id);
          
          const isFirstCard = !userCards || userCards.length === 0;
          
          const { error: cardSaveError } = await supabaseClient
            .from('poupeja_tokenized_cards')
            .insert({
              user_id: user.id,
              asaas_customer_id: asaasCustomerId,
              credit_card_token: tokenData.creditCardToken,
              credit_card_number: maskedNumber,
              credit_card_brand: cardBrand,
              credit_card_last_four: lastFour,
              holder_name: cardholderData.name, // Use cardholder name
              expires_at: `${creditCard.expiryMonth}/${creditCard.expiryYear}`,
              is_default: isFirstCard,
              is_active: true
            });
          
          if (cardSaveError) {
            console.error('[TRANSPARENT-CHECKOUT] ⚠️ Erro ao salvar cartão tokenizado:', cardSaveError);
            // Don't throw error - tokenization was successful, card saving is secondary
          } else {
            console.log('[TRANSPARENT-CHECKOUT] ✅ Cartão tokenizado salvo com sucesso');
          }
        } else {
          console.log('[TRANSPARENT-CHECKOUT] ℹ️ Cartão já existe, não salvando duplicata');
        }
      } catch (cardSaveError) {
        console.error('[TRANSPARENT-CHECKOUT] ⚠️ Erro ao processar salvamento de cartão:', cardSaveError);
        // Continue - tokenization was successful
      }
    }

    // Create subscription in Asaas
    console.log('[TRANSPARENT-CHECKOUT] Criando assinatura no Asaas...');
    
    const subscriptionPayload = {
      customer: asaasCustomerId,
      billingType: 'CREDIT_CARD',
      value: planData.price,
      nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      cycle: planType === 'monthly' ? 'MONTHLY' : 'YEARLY',
      description: `Assinatura ${planData.name} - ${planType === 'monthly' ? 'Mensal' : 'Anual'}`,
      creditCard: {
        creditCardToken: tokenData.creditCardToken
      },
      creditCardHolderInfo: {
        name: cardholderData?.name || userData.name || user.email?.split('@')[0] || 'Usuário',
        email: userData.email || user.email,
        cpfCnpj: cardholderData?.cpf || creditCard?.holderCpf || userData.cpf || '',
        postalCode: cardholderData?.cep ? `${cardholderData.cep.replace(/\D/g, '').substring(0, 5)}-${cardholderData.cep.replace(/\D/g, '').substring(5)}` : (userData.cep || ''),
        addressNumber: cardholderData?.number || userData.number || 'S/N',
        addressComplement: cardholderData?.complement || userData.complement || '',
        phone: cardholderData?.phone || userData.phone || ''
      },
      remoteIp: remoteIp
    };

    console.log('[TRANSPARENT-CHECKOUT] Payload da assinatura preparado');

    const subscriptionResponse = await fetch(`${asaasBaseUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
      },
      body: JSON.stringify(subscriptionPayload)
    });

    if (!subscriptionResponse.ok) {
      const subscriptionError = await subscriptionResponse.text();
      console.error('[TRANSPARENT-CHECKOUT] Erro ao criar assinatura:', {
        status: subscriptionResponse.status,
        error: subscriptionError
      });
      throw new Error(`Falha ao criar assinatura: ${subscriptionError}`);
    }

    const subscriptionData = await subscriptionResponse.json();
    console.log('[TRANSPARENT-CHECKOUT] ✅ Assinatura criada no Asaas:', subscriptionData.id);

    // Save subscription in database
    const { error: subscriptionSaveError } = await supabaseClient
      .from('poupeja_subscriptions')
      .insert({
        user_id: user.id,
        asaas_subscription_id: subscriptionData.id,
        asaas_customer_id: asaasCustomerId,
        plan_type: planType,
        status: subscriptionData.status || 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: subscriptionData.nextDueDate ? new Date(subscriptionData.nextDueDate).toISOString() : new Date(Date.now() + (planType === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false
      });

    if (subscriptionSaveError) {
      console.error('[TRANSPARENT-CHECKOUT] Erro ao salvar assinatura no banco:', subscriptionSaveError);
      throw new Error('Falha ao registrar assinatura no sistema');
    }

    console.log('[TRANSPARENT-CHECKOUT] ✅ Assinatura salva no banco de dados');

    return new Response(JSON.stringify({
      success: true,
      subscriptionId: subscriptionData.id,
      status: subscriptionData.status,
      message: 'Assinatura criada com sucesso!'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[TRANSPARENT-CHECKOUT] ❌ Erro:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});