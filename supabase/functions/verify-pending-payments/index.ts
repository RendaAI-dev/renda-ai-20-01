import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[VERIFY-PENDING-PAYMENTS] 🔍 Iniciando verificação de pagamentos pendentes...');

    // Buscar assinaturas com pagamentos pendentes há mais de 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: pendingPayments, error: paymentsError } = await supabase
      .from('poupeja_asaas_payments')
      .select(`
        *,
        poupeja_subscriptions!inner(*)
      `)
      .eq('status', 'PENDING')
      .lt('created_at', thirtyMinutesAgo);

    if (paymentsError) {
      console.error('[VERIFY-PENDING-PAYMENTS] ❌ Erro ao buscar pagamentos:', paymentsError);
      throw paymentsError;
    }

    console.log(`[VERIFY-PENDING-PAYMENTS] 📊 Encontrados ${pendingPayments?.length || 0} pagamentos pendentes`);

    if (!pendingPayments || pendingPayments.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum pagamento pendente encontrado', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter configuração do Asaas
    const { data: asaasConfig } = await supabase
      .from('poupeja_settings')
      .select('key, value, encrypted')
      .eq('category', 'asaas')
      .in('key', ['api_key', 'environment']);

    const config: Record<string, string> = {};
    asaasConfig?.forEach(setting => {
      if (setting.encrypted && setting.value) {
        // Decrypt base64 encoded value
        config[setting.key] = atob(setting.value);
      } else {
        config[setting.key] = setting.value || '';
      }
    });

    const apiKey = config.api_key;
    const environment = config.environment || 'sandbox';
    const baseUrl = environment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    let processedCount = 0;
    let cancelledCount = 0;

    // Verificar cada pagamento no Asaas
    for (const payment of pendingPayments) {
      try {
        console.log(`[VERIFY-PENDING-PAYMENTS] 🔍 Verificando pagamento: ${payment.asaas_payment_id}`);
        
        const response = await fetch(`${baseUrl}/payments/${payment.asaas_payment_id}`, {
          headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error(`[VERIFY-PENDING-PAYMENTS] ❌ Erro HTTP ${response.status} para pagamento ${payment.asaas_payment_id}`);
          continue;
        }

        const asaasPayment = await response.json();
        console.log(`[VERIFY-PENDING-PAYMENTS] 📝 Status no Asaas: ${asaasPayment.status}`);

        // Atualizar status do pagamento se mudou
        if (asaasPayment.status !== payment.status) {
          const { error: updateError } = await supabase
            .from('poupeja_asaas_payments')
            .update({
              status: asaasPayment.status,
              confirmed_date: asaasPayment.confirmedDate || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.id);

          if (updateError) {
            console.error('[VERIFY-PENDING-PAYMENTS] ❌ Erro ao atualizar pagamento:', updateError);
          } else {
            processedCount++;
            console.log(`[VERIFY-PENDING-PAYMENTS] ✅ Pagamento atualizado: ${payment.asaas_payment_id} -> ${asaasPayment.status}`);
          }

          // Se pagamento foi negado/cancelado, cancelar assinatura
          if (['DENIED', 'CANCELLED', 'REFUNDED'].includes(asaasPayment.status)) {
            const subscription = payment.poupeja_subscriptions;
            if (subscription && subscription.status === 'active') {
              const { error: cancelError } = await supabase
                .from('poupeja_subscriptions')
                .update({
                  status: 'cancelled',
                  updated_at: new Date().toISOString()
                })
                .eq('id', subscription.id);

              if (cancelError) {
                console.error('[VERIFY-PENDING-PAYMENTS] ❌ Erro ao cancelar assinatura:', cancelError);
              } else {
                cancelledCount++;
                console.log(`[VERIFY-PENDING-PAYMENTS] 🚫 Assinatura cancelada: ${subscription.id}`);
                
                // Notificar usuário
                await supabase.functions.invoke('send-push-notification', {
                  body: {
                    userId: payment.user_id,
                    title: 'Problema no Pagamento',
                    body: 'Seu pagamento foi negado. Por favor, verifique seus dados e tente novamente.',
                    data: { type: 'payment_failed', paymentId: payment.asaas_payment_id }
                  }
                }).catch(error => console.error('[VERIFY-PENDING-PAYMENTS] Erro ao enviar notificação:', error));
              }
            }
          }
        }

      } catch (error) {
        console.error(`[VERIFY-PENDING-PAYMENTS] ❌ Erro ao verificar pagamento ${payment.asaas_payment_id}:`, error);
      }
    }

    console.log(`[VERIFY-PENDING-PAYMENTS] ✅ Verificação concluída: ${processedCount} atualizados, ${cancelledCount} cancelados`);

    return new Response(
      JSON.stringify({
        message: 'Verificação de pagamentos pendentes concluída',
        totalChecked: pendingPayments.length,
        updated: processedCount,
        cancelled: cancelledCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[VERIFY-PENDING-PAYMENTS] ❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});