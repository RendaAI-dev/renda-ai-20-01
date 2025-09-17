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
    console.log('[SYNC-PAYMENT] Iniciando sincronização de pagamentos...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autorização obrigatório');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Token inválido');
    }

    // Buscar pagamentos com status PENDING
    const { data: pendingPayments, error: fetchError } = await supabase
      .from('poupeja_asaas_payments')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(20);

    if (fetchError) {
      throw new Error(`Erro ao buscar pagamentos: ${fetchError.message}`);
    }

    console.log(`[SYNC-PAYMENT] Encontrados ${pendingPayments?.length || 0} pagamentos pendentes`);

    if (!pendingPayments?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum pagamento pendente encontrado',
        synchronized: 0
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Obter chave da API do Asaas
    const { data: asaasConfig } = await supabase
      .from('poupeja_settings')
      .select('value')
      .eq('category', 'asaas')
      .eq('key', 'api_key')
      .maybeSingle();

    if (!asaasConfig?.value) {
      throw new Error('Chave API do Asaas não configurada');
    }

    // Obter ambiente (sandbox/production)
    const { data: envConfig } = await supabase
      .from('poupeja_settings')
      .select('value')
      .eq('category', 'asaas')
      .eq('key', 'environment')
      .maybeSingle();

    const environment = envConfig?.value || 'sandbox';
    const asaasBaseUrl = environment === 'production' 
      ? 'https://www.asaas.com/api/v3'
      : 'https://sandbox.asaas.com/api/v3';

    let synchronized = 0;

    // Verificar cada pagamento na API do Asaas
    for (const payment of pendingPayments) {
      try {
        console.log(`[SYNC-PAYMENT] Verificando pagamento: ${payment.asaas_payment_id}`);

        const response = await fetch(`${asaasBaseUrl}/payments/${payment.asaas_payment_id}`, {
          method: 'GET',
          headers: {
            'access_token': asaasConfig.value,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.log(`[SYNC-PAYMENT] ⚠️ Erro ao consultar pagamento ${payment.asaas_payment_id}: ${response.status}`);
          continue;
        }

        const asaasPayment = await response.json();
        console.log(`[SYNC-PAYMENT] Status no Asaas: ${asaasPayment.status}`);

        // Se o status mudou, atualizar no banco
        if (asaasPayment.status !== payment.status) {
          console.log(`[SYNC-PAYMENT] 🔄 Atualizando status: ${payment.status} → ${asaasPayment.status}`);

          // Mapear status do Asaas
          const statusMapping: Record<string, string> = {
            'PENDING': 'pending',
            'RECEIVED': 'active', 
            'CONFIRMED': 'active',
            'OVERDUE': 'past_due',
            'REFUNDED': 'cancelled',
            'RECEIVED_IN_CASH': 'active',
            'AWAITING_RISK_ANALYSIS': 'pending'
          };

          const newStatus = statusMapping[asaasPayment.status] || 'pending';

          // Atualizar pagamento
          await supabase
            .from('poupeja_asaas_payments')
            .update({
              status: asaasPayment.status,
              payment_date: asaasPayment.paymentDate || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.id);

          // Se pagamento foi confirmado, ativar assinatura
          if (asaasPayment.status === 'RECEIVED' || asaasPayment.status === 'CONFIRMED') {
            console.log('[SYNC-PAYMENT] 🎉 Pagamento confirmado! Ativando assinatura...');
            await activateSubscription(supabase, payment.user_id, asaasPayment, payment);
          }

          synchronized++;
        }

        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[SYNC-PAYMENT] Erro ao processar pagamento ${payment.asaas_payment_id}:`, error.message);
      }
    }

    console.log(`[SYNC-PAYMENT] ✅ Sincronização concluída. ${synchronized} pagamentos atualizados.`);

    return new Response(JSON.stringify({
      success: true,
      message: `Sincronização concluída`,
      total_checked: pendingPayments.length,
      synchronized
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[SYNC-PAYMENT] Erro:', error.message);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

async function activateSubscription(supabase: any, userId: string, payment: any, existingPayment: any) {
  // Determinar tipo de plano baseado na referência externa ou valor
  let planType: 'monthly' | 'annual' = 'monthly';
  const ref = existingPayment.external_reference || payment.externalReference || '';
  if (ref.includes('annual')) planType = 'annual';
  else if (ref.includes('monthly')) planType = 'monthly';
  else {
    // Fallback: comparar valores com configurações públicas
    const { data: priceSettings } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'pricing')
      .in('key', ['plan_price_monthly', 'plan_price_annual']);

    const normalize = (v?: string | null) => {
      if (!v) return 0;
      const s = String(v).replace(/\./g, '').replace(',', '.');
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    const monthly = normalize(priceSettings?.find((s: any) => s.key === 'plan_price_monthly')?.value);
    const annual = normalize(priceSettings?.find((s: any) => s.key === 'plan_price_annual')?.value);

    const diffMonthly = Math.abs((payment.value ?? 0) - monthly);
    const diffAnnual = Math.abs((payment.value ?? 0) - annual);
    planType = diffAnnual < diffMonthly ? 'annual' : 'monthly';
  }

  const periodDays = planType === 'annual' ? 365 : 30;
  const now = new Date();
  const currentPeriodStart = now.toISOString();
  const currentPeriodEnd = new Date(now.getTime() + (periodDays * 24 * 60 * 60 * 1000)).toISOString();

  // Buscar assinatura existente
  const { data: existingSubscription } = await supabase
    .from('poupeja_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const subscriptionData = {
    user_id: userId,
    asaas_customer_id: existingPayment.asaas_customer_id,
    asaas_subscription_id: payment.subscription || payment.id,
    status: 'active',
    plan_type: planType,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: false,
    payment_processor: 'asaas',
    grace_period_end: null,
    updated_at: new Date().toISOString()
  };

  if (existingSubscription) {
    await supabase
      .from('poupeja_subscriptions')
      .update(subscriptionData)
      .eq('id', existingSubscription.id);
    
    console.log('[SYNC-PAYMENT] ✅ Assinatura atualizada para active');
  } else {
    await supabase
      .from('poupeja_subscriptions')
      .insert(subscriptionData);
    
    console.log('[SYNC-PAYMENT] ✅ Nova assinatura criada como active');
  }
}