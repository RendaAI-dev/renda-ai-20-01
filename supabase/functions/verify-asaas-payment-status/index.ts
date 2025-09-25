import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para descriptografar valores
function decryptValue(encryptedValue: string, isEncrypted: boolean = false): string {
  if (!isEncrypted) {
    return encryptedValue;
  }
  
  try {
    // Se o valor não é base64, retorna como está
    if (!encryptedValue || encryptedValue.length === 0) {
      return encryptedValue;
    }
    // Verifica se é base64 válido antes de tentar decodificar
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (base64Regex.test(encryptedValue) && encryptedValue.length % 4 === 0) {
      return atob(encryptedValue);
    } else {
      return encryptedValue;
    }
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
    return encryptedValue;
  }
}

async function getAsaasConfig(supabase: any) {
  const { data: settings, error } = await supabase
    .from('poupeja_settings')
    .select('key, value, encrypted')
    .eq('category', 'asaas');

  if (error) {
    throw new Error(`Erro ao buscar configurações: ${error.message}`);
  }

  const config: any = {};
  
  for (const setting of settings) {
    config[setting.key] = decryptValue(setting.value, setting.encrypted);
  }

  return config;
}

async function verifyOnAsaas(id: string, apiKey: string, environment: string, type: 'payment' | 'subscription' = 'payment') {
  const baseUrl = environment === 'production' 
    ? 'https://api.asaas.com/v3' 
    : 'https://sandbox.asaas.com/api/v3';

  console.log(`[VERIFY-ASAAS] Consultando ${type} ${id} no Asaas...`);

  const endpoint = type === 'payment' ? 'payments' : 'subscriptions';
  const response = await fetch(`${baseUrl}/${endpoint}/${id}`, {
    method: 'GET',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro na API Asaas: ${response.status} - ${await response.text()}`);
  }

  const result = await response.json();
  console.log(`[VERIFY-ASAAS] ${type} encontrado:`, { id: result.id, status: result.status });
  
  return result;
}

async function getSubscriptionPayments(subscriptionId: string, apiKey: string, environment: string) {
  const baseUrl = environment === 'production' 
    ? 'https://api.asaas.com/v3' 
    : 'https://sandbox.asaas.com/api/v3';

  console.log(`[VERIFY-ASAAS] Buscando pagamentos da assinatura ${subscriptionId}...`);

  const response = await fetch(`${baseUrl}/payments?subscription=${subscriptionId}`, {
    method: 'GET',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar pagamentos: ${response.status} - ${await response.text()}`);
  }

  const result = await response.json();
  console.log(`[VERIFY-ASAAS] Encontrados ${result.data?.length || 0} pagamentos`);
  
  return result.data || [];
}

async function processSubscription(supabase: any, subscription: any, userId: string) {
  console.log(`[VERIFY-SUBSCRIPTION] Processando assinatura: ${subscription.id}`);

  // Determinar tipo de plano baseado no external_reference
  let planType = 'monthly';
  if (subscription.externalReference?.includes('_annual_') || subscription.externalReference?.includes('_change_annual_')) {
    planType = 'annual';
  } else if (subscription.cycle === 'YEARLY') {
    planType = 'annual';
  }

  // Calcular datas - converter formato DD/MM/YYYY para YYYY-MM-DD
  const nextDueDateParts = subscription.nextDueDate.split('/');
  const currentPeriodEnd = new Date(`${nextDueDateParts[2]}-${nextDueDateParts[1]}-${nextDueDateParts[0]}`);
  const currentPeriodStart = new Date(subscription.dateCreated.split('/').reverse().join('-'));

  // Upsert subscription
  const { error: subError } = await supabase
    .from('poupeja_subscriptions')
    .upsert({
      user_id: userId,
      asaas_subscription_id: subscription.id,
      asaas_customer_id: subscription.customer,
      status: subscription.status.toLowerCase(),
      plan_type: planType,
      payment_processor: 'asaas',
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'asaas_subscription_id'
    });

  if (subError) {
    console.error('[VERIFY-SUBSCRIPTION] Erro ao criar/atualizar assinatura:', subError);
    throw subError;
  }

  console.log(`[VERIFY-SUBSCRIPTION] ✅ Assinatura processada: ${subscription.id}`);
  return subscription;
}

async function processPayment(supabase: any, payment: any, userId: string) {
  console.log(`[VERIFY-PAYMENT] Processando pagamento: ${payment.id}`);

  // Criar/atualizar pagamento
  const { error: paymentError } = await supabase
    .from('poupeja_asaas_payments')
    .upsert({
      asaas_payment_id: payment.id,
      user_id: userId,
      asaas_customer_id: payment.customer,
      amount: payment.value,
      status: payment.status,
      method: payment.billingType,
      due_date: payment.dueDate,
      payment_date: payment.paymentDate,
      confirmed_date: payment.confirmedDate ? new Date(payment.confirmedDate).toISOString() : null,
      invoice_url: payment.invoiceUrl,
      bank_slip_url: payment.bankSlipUrl,
      external_reference: payment.externalReference,
      description: payment.description,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'asaas_payment_id'
    });

  if (paymentError) {
    console.error('[VERIFY-PAYMENT] Erro ao atualizar pagamento:', paymentError);
    throw paymentError;
  }

  console.log(`[VERIFY-PAYMENT] ✅ Pagamento processado: ${payment.id}`);
  return payment;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { paymentId, subscriptionId, userId } = await req.json();

    if ((!paymentId && !subscriptionId) || !userId) {
      return new Response(
        JSON.stringify({ error: 'paymentId ou subscriptionId e userId são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Buscar configuração do Asaas
    const config = await getAsaasConfig(supabase);
    
    if (!config.api_key) {
      throw new Error('API Key do Asaas não configurada');
    }

    let result: { success: boolean; status: string; data: any } = { success: true, status: '', data: null };

    // Se foi fornecido subscriptionId, processar assinatura
    if (subscriptionId) {
      console.log(`[VERIFY-SUBSCRIPTION] Iniciando verificação para assinatura: ${subscriptionId}, usuário: ${userId}`);
      
      try {
        // Verificar se assinatura existe no Asaas
        const subscription = await verifyOnAsaas(subscriptionId, config.api_key, config.environment || 'sandbox', 'subscription');
        
        if (subscription.status === 'ACTIVE') {
          // Processar assinatura localmente
          await processSubscription(supabase, subscription, userId);
          
          // Buscar pagamentos da assinatura
          const payments = await getSubscriptionPayments(subscriptionId, config.api_key, config.environment || 'sandbox');
          
          // Processar pagamentos confirmados
          for (const payment of payments) {
            if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
              await processPayment(supabase, payment, userId);
            }
          }
          
          result.status = 'active';
          result.data = { subscription, payments };
        } else {
          result.status = subscription.status.toLowerCase();
          result.data = { subscription };
        }
      } catch (error) {
        console.error('[VERIFY-SUBSCRIPTION] Erro:', error);
        result.success = false;
        result.status = 'error';
        result.data = { error: error instanceof Error ? error.message : String(error) };
      }
    }
    
    // Se foi fornecido paymentId, processar pagamento
    if (paymentId && !subscriptionId) {
      console.log(`[VERIFY-PAYMENT] Iniciando verificação para pagamento: ${paymentId}, usuário: ${userId}`);
      
      try {
        const payment = await verifyOnAsaas(paymentId, config.api_key, config.environment || 'sandbox', 'payment');
        
        if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
          await processPayment(supabase, payment, userId);
          
          // Se tem subscription, processar também
          if (payment.subscription) {
            const subscription = await verifyOnAsaas(payment.subscription, config.api_key, config.environment || 'sandbox', 'subscription');
            await processSubscription(supabase, subscription, userId);
          }
          
          result.status = 'confirmed';
          result.data = { payment };
        } else {
          result.status = payment.status.toLowerCase();
          result.data = { payment };
        }
      } catch (error) {
        console.error('[VERIFY-PAYMENT] Erro:', error);
        result.success = false;
        result.status = 'error';
        result.data = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[VERIFY-PAYMENT] Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});