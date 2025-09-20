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
    const { planType, successUrl, cancelUrl, waitForPaymentCreated = false } = await req.json();
    
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

    console.log('[ASAAS-CHECKOUT] Planos encontrados:', {
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

    console.log(`[ASAAS-CHECKOUT] Valor do plano ${planType}: R$ ${value}`);

    // Criar Checkout do Asaas para ASSINATURA recorrente com cartão de crédito
    const reference = `${user.id}_${planType}_${Date.now()}`;
    const cycle = planType === 'monthly' ? 'MONTHLY' : 'YEARLY';
    const planName = planType === 'monthly' ? 'Plano Premium Mensal' : 'Plano Premium Anual';
    const planDescription = planType === 'monthly' ? 'Assinatura Mensal - Renda AI' : 'Assinatura Anual - Renda AI';

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
        nextDueDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        externalReference: reference
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
      console.error('[ASAAS-CHECKOUT] Erro ao criar checkout:', errorText);
      console.error('[ASAAS-CHECKOUT] Status:', checkoutResponse.status);
      console.error('[ASAAS-CHECKOUT] Dados enviados:', JSON.stringify(checkoutData, null, 2));

      let errorMessage = 'Erro ao criar checkout no Asaas';
      try {
        const errorObj = JSON.parse(errorText);
        console.error('[ASAAS-CHECKOUT] Resposta de erro completa do Asaas:', errorObj);
        if (errorObj.errors && Array.isArray(errorObj.errors)) {
          errorMessage = errorObj.errors.map((e: any) => e.description || e.message).join(', ');
        }
      } catch (_) {}
      throw new Error(errorMessage);
    }

    const checkout = await checkoutResponse.json();

    console.log('[ASAAS-CHECKOUT] Checkout criado:', checkout.id);
    console.log('[ASAAS-CHECKOUT] Checkout objeto completo:', JSON.stringify(checkout, null, 2));
    console.log('[ASAAS-CHECKOUT] Checkout keys disponíveis:', Object.keys(checkout || {}));

    // Garantir checkoutUrl válida com estratégia robusta
    const getCheckoutUrl = async (): Promise<{ url: string; source: string }> => {
      // Prioridade 1: Link direto do checkout (mais comum para checkout sessions)
      if (checkout.link) {
        console.log('[ASAAS-CHECKOUT] ✅ Link encontrado no checkout inicial');
        return { url: checkout.link, source: 'link_initial' };
      }

      // Prioridade 2: URL direta do checkout
      if (checkout.url) {
        console.log('[ASAAS-CHECKOUT] ✅ URL encontrada no checkout inicial');
        return { url: checkout.url, source: 'checkout_initial' };
      }

      // Prioridade 3: invoiceUrl direta
      if (checkout.invoiceUrl) {
        console.log('[ASAAS-CHECKOUT] ✅ invoiceUrl encontrada no checkout inicial');
        return { url: checkout.invoiceUrl, source: 'invoice_initial' };
      }

      // Prioridade 4: Buscar checkout específico
      console.log('[ASAAS-CHECKOUT] ⚠️ URL não encontrada, buscando checkout específico...');
      try {
        const checkoutDetailResponse = await fetch(`${asaasUrl}/checkouts/${checkout.id}`, {
          headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
          }
        });

        console.log('[ASAAS-CHECKOUT] Status GET checkout específico:', checkoutDetailResponse.status);

        if (checkoutDetailResponse.ok) {
          const checkoutDetail = await checkoutDetailResponse.json();
          console.log('[ASAAS-CHECKOUT] Checkout específico keys:', Object.keys(checkoutDetail || {}));
          
          if (checkoutDetail.link) {
            console.log('[ASAAS-CHECKOUT] ✅ Link encontrado no GET checkout específico');
            return { url: checkoutDetail.link, source: 'link_refetch' };
          }

          if (checkoutDetail.url) {
            console.log('[ASAAS-CHECKOUT] ✅ URL encontrada no GET checkout específico');
            return { url: checkoutDetail.url, source: 'checkout_refetch' };
          }
          
          if (checkoutDetail.invoiceUrl) {
            console.log('[ASAAS-CHECKOUT] ✅ invoiceUrl encontrada no GET checkout específico');
            return { url: checkoutDetail.invoiceUrl, source: 'invoice_refetch' };
          }
        } else {
          const errorText = await checkoutDetailResponse.text();
          console.error('[ASAAS-CHECKOUT] Erro ao buscar checkout específico:', errorText);
        }
      } catch (error) {
        console.error('[ASAAS-CHECKOUT] Erro na busca do checkout específico:', error);
      }

      // Prioridade 5: URL construída como fallback (formato correto para checkout sessions)
      const baseUrl = environment === 'production' 
        ? 'https://www.asaas.com'
        : 'https://sandbox.asaas.com';
      const fallbackUrl = `${baseUrl}/checkoutSession/show/${checkout.id}`;
      
      console.log('[ASAAS-CHECKOUT] ⚠️ Usando URL construída como fallback (checkoutSession):', fallbackUrl);
      return { url: fallbackUrl, source: 'constructed_fallback' };
    };

    const { url: guaranteedCheckoutUrl, source: urlSource } = await getCheckoutUrl();
    console.log('[ASAAS-CHECKOUT] ✅ URL final garantida:', guaranteedCheckoutUrl, '(source:', urlSource + ')');

    // Função para buscar pagamentos do usuário com estratégia melhorada
    const fetchUserPayments = async (retries = 5): Promise<AsaasPayment | null> => {
      for (let i = 0; i < retries; i++) {
        try {
          // Delay reduzido: 1s, 2s, 4s, 6s, 8s
          const delay = i === 0 ? 1000 : (i * 2000);
          await new Promise(resolve => setTimeout(resolve, delay));

          console.log(`[ASAAS-CHECKOUT] Tentativa ${i + 1}/${retries} - Buscando pagamentos do customer ${asaasCustomer.id}...`);

          const paymentsResponse = await fetch(`${asaasUrl}/payments?customer=${asaasCustomer.id}&limit=20&status=PENDING&status=CONFIRMED&status=RECEIVED`, {
            headers: {
              'access_token': apiKey,
              'Content-Type': 'application/json'
            }
          });

          console.log(`[ASAAS-CHECKOUT] Status da resposta de pagamentos: ${paymentsResponse.status}`);

          if (!paymentsResponse.ok) {
            const errorText = await paymentsResponse.text();
            console.error(`[ASAAS-CHECKOUT] Erro ${paymentsResponse.status} na busca de pagamentos:`, errorText);
            
            // Se erro 400, tentar busca alternativa por subscriptions
            if (paymentsResponse.status === 400) {
              console.log(`[ASAAS-CHECKOUT] Tentando busca alternativa por subscriptions...`);
              
              const subscriptionsResponse = await fetch(`${asaasUrl}/subscriptions?customer=${asaasCustomer.id}&limit=10`, {
                headers: {
                  'access_token': apiKey,
                  'Content-Type': 'application/json'
                }
              });

              if (subscriptionsResponse.ok) {
                const subscriptionsData = await subscriptionsResponse.json();
                console.log(`[ASAAS-CHECKOUT] Encontradas ${subscriptionsData.data?.length || 0} subscriptions`);
                
                const recentTime = Date.now() - (5 * 60 * 1000);
                const subscription = subscriptionsData.data?.find((s: any) => 
                  Math.abs(parseFloat(s.value) - value) < 0.01 &&
                  new Date(s.dateCreated).getTime() > recentTime
                );

                if (subscription && subscription.nextDueDate) {
                  console.log(`[ASAAS-CHECKOUT] ✅ Subscription encontrada: ${subscription.id}`);
                  // Buscar payment específico da subscription
                  const subPaymentResponse = await fetch(`${asaasUrl}/payments?subscription=${subscription.id}&limit=1`, {
                    headers: {
                      'access_token': apiKey,
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  if (subPaymentResponse.ok) {
                    const subPaymentData = await subPaymentResponse.json();
                    if (subPaymentData.data && subPaymentData.data.length > 0) {
                      return subPaymentData.data[0];
                    }
                  }
                }
              }
            }
            continue;
          }

          const paymentsData = await paymentsResponse.json();
          console.log(`[ASAAS-CHECKOUT] Encontrados ${paymentsData.data?.length || 0} pagamentos`);

          if (paymentsData.data && paymentsData.data.length > 0) {
            // Buscar pagamento que corresponde ao valor e é recente (últimos 10 minutos)
            const recentTime = Date.now() - (10 * 60 * 1000);
            const payment = paymentsData.data.find((p: any) => {
              const valueDiff = Math.abs(parseFloat(p.value) - value);
              const isRecentlyCreated = new Date(p.dateCreated).getTime() > recentTime;
              const hasValidStatus = ['PENDING', 'CONFIRMED', 'RECEIVED'].includes(p.status);
              
              console.log(`[ASAAS-CHECKOUT] Verificando pagamento ${p.id}: valor=${p.value} (diff=${valueDiff}), status=${p.status}, recente=${isRecentlyCreated}`);
              
              return valueDiff < 0.01 && hasValidStatus && isRecentlyCreated;
            });

            if (payment) {
              console.log(`[ASAAS-CHECKOUT] ✅ Pagamento encontrado: ${payment.id}, status: ${payment.status}, valor: ${payment.value}`);
              return payment;
            } else {
              console.log(`[ASAAS-CHECKOUT] ⚠️ Nenhum pagamento correspondente encontrado nos critérios`);
            }
          }
        } catch (error) {
          console.error(`[ASAAS-CHECKOUT] Erro na tentativa ${i + 1}:`, error);
        }
      }
      
      console.log(`[ASAAS-CHECKOUT] ❌ Não foi possível encontrar pagamento após ${retries} tentativas`);
      return null;
    };

    // Tentar buscar o pagamento específico com prioridade para invoiceUrl
    const userPayment = await fetchUserPayments();

    if (userPayment && userPayment.invoiceUrl) {
      console.log('[ASAAS-CHECKOUT] ✅ Redirecionando para fatura específica (invoiceUrl tem prioridade)');
      return new Response(JSON.stringify({
        success: true,
        checkoutUrl: userPayment.invoiceUrl,
        paymentId: userPayment.id,
        checkoutId: checkout.id,
        reference,
        source: 'invoice_found'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }

  // Se waitForPaymentCreated foi solicitado, aguardar pela URL da fatura
  if (waitForPaymentCreated) {
    console.log(`[ASAAS-CHECKOUT] 🔄 Aguardando PAYMENT_CREATED para user ${user.id}...`);
    
    // Aguardar um pouco para o webhook processar
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Tentar buscar URL da fatura na tabela de redirects por até 60 segundos
    let attempts = 0;
    const maxAttempts = 12; // 12 tentativas x 5s = 60s
    const delayMs = 5000; // 5 segundos entre tentativas
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[ASAAS-CHECKOUT] Tentativa ${attempts}/${maxAttempts} - Buscando URL da fatura para user ${user.id}...`);
      
      try {
        // Buscar URL da fatura na tabela de redirects
        const { data: redirectData, error: redirectError } = await supabase
          .from('poupeja_payment_redirects')
          .select('invoice_url, asaas_payment_id')
          .eq('user_id', user.id)
          .eq('processed', false)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!redirectError && redirectData) {
          console.log(`[ASAAS-CHECKOUT] ✅ URL da fatura encontrada via webhook: ${redirectData.invoice_url}`);
          
          // Marcar como processado
          await supabase
            .from('poupeja_payment_redirects')
            .update({ processed: true })
            .eq('user_id', user.id)
            .eq('asaas_payment_id', redirectData.asaas_payment_id);
          
          return new Response(JSON.stringify({
            success: true,
            checkoutUrl: redirectData.invoice_url,
            paymentId: redirectData.asaas_payment_id,
            customerId: asaasCustomer.id,
            source: 'webhook_redirect'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Fallback: tentar buscar diretamente da API Asaas
        if (attempts > 6) { // Após 30s, tentar fallback
          const paymentsResponse = await fetch(`${asaasUrl}/payments?customer=${asaasCustomer.id}&limit=1`, {
            method: 'GET',
            headers: {
              'access_token': apiKey,
              'Content-Type': 'application/json'
            }
          });
          
          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            
            if (paymentsData.data && paymentsData.data.length > 0) {
              const latestPayment = paymentsData.data[0];
              const invoiceUrl = latestPayment.invoiceUrl || latestPayment.bankSlipUrl;
              
              if (invoiceUrl) {
                console.log(`[ASAAS-CHECKOUT] ✅ URL da fatura encontrada via API fallback: ${invoiceUrl}`);
                return new Response(JSON.stringify({
                  success: true,
                  checkoutUrl: invoiceUrl,
                  paymentId: latestPayment.id,
                  customerId: asaasCustomer.id,
                  source: 'api_fallback'
                }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
            }
          }
        }
        
      } catch (error) {
        console.log(`[ASAAS-CHECKOUT] Erro na tentativa ${attempts}:`, error);
      }
      
      // Aguardar antes da próxima tentativa
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.log(`[ASAAS-CHECKOUT] ❌ Timeout: Não foi possível encontrar URL da fatura após ${maxAttempts} tentativas`);
  }

    // Usar URL garantida do checkout
    console.log('[ASAAS-CHECKOUT] ✅ Redirecionando para checkout URL garantida');
    return new Response(JSON.stringify({
      success: true,
      checkoutUrl: guaranteedCheckoutUrl,
      checkoutId: checkout.id,
      reference,
      source: urlSource
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