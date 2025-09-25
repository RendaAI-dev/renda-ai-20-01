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
    // Por enquanto apenas base64 decode - implementar criptografia real depois
    return atob(encryptedValue);
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

async function verifyPaymentOnAsaas(paymentId: string, apiKey: string, environment: string) {
  const baseUrl = environment === 'production' 
    ? 'https://api.asaas.com/v3' 
    : 'https://sandbox.asaas.com/api/v3';

  console.log(`[VERIFY-PAYMENT] Consultando pagamento ${paymentId} no Asaas...`);

  const response = await fetch(`${baseUrl}/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro na API Asaas: ${response.status} - ${await response.text()}`);
  }

  const payment = await response.json();
  console.log(`[VERIFY-PAYMENT] Status no Asaas: ${payment.status}, Confirmed: ${payment.confirmedDate}`);
  
  return payment;
}

async function processConfirmedPayment(supabase: any, payment: any, userId: string) {
  console.log(`[VERIFY-PAYMENT] Processando pagamento confirmado: ${payment.id}`);

  // 1. Atualizar/inserir pagamento
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

  // 2. Se tem subscription, ativar assinatura
  if (payment.subscription) {
    console.log(`[VERIFY-PAYMENT] Ativando assinatura: ${payment.subscription}`);

    // Buscar informações da subscription no Asaas
    const config = await getAsaasConfig(supabase);
    const baseUrl = config.environment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    const subResponse = await fetch(`${baseUrl}/subscriptions/${payment.subscription}`, {
      method: 'GET',
      headers: {
        'access_token': config.api_key,
        'Content-Type': 'application/json'
      }
    });

    if (subResponse.ok) {
      const subscription = await subResponse.json();
      
      // Determinar tipo de plano baseado no external_reference
      let planType = 'monthly';
      if (payment.externalReference?.includes('_annual_') || payment.externalReference?.includes('_change_annual_')) {
        planType = 'annual';
      }

      // Calcular datas
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date(subscription.nextDueDate.split('/').reverse().join('-'));

      // Upsert subscription
      const { error: subError } = await supabase
        .from('poupeja_subscriptions')
        .upsert({
          user_id: userId,
          asaas_subscription_id: payment.subscription,
          asaas_customer_id: payment.customer,
          status: 'active',
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
        console.error('[VERIFY-PAYMENT] Erro ao criar/atualizar assinatura:', subError);
        throw subError;
      }

      console.log(`[VERIFY-PAYMENT] ✅ Assinatura ativada com sucesso: ${payment.subscription}`);
    }
  }

  return true;
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

    const { paymentId, userId } = await req.json();

    if (!paymentId || !userId) {
      return new Response(
        JSON.stringify({ error: 'paymentId e userId são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[VERIFY-PAYMENT] Iniciando verificação para pagamento: ${paymentId}, usuário: ${userId}`);

    // Buscar configuração do Asaas
    const config = await getAsaasConfig(supabase);
    
    if (!config.api_key) {
      throw new Error('API Key do Asaas não configurada');
    }

    // Verificar status no Asaas
    const payment = await verifyPaymentOnAsaas(paymentId, config.api_key, config.environment || 'sandbox');

    // Se o pagamento foi confirmado, processar
    if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
      await processConfirmedPayment(supabase, payment, userId);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'confirmed',
          payment: {
            id: payment.id,
            status: payment.status,
            confirmedDate: payment.confirmedDate,
            subscription: payment.subscription
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: payment.status.toLowerCase(),
          payment: {
            id: payment.id,
            status: payment.status,
            confirmedDate: payment.confirmedDate
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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