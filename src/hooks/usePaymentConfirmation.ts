import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentConfirmationState {
  status: 'checking' | 'confirmed' | 'error' | 'timeout';
  subscription?: any;
  error?: string;
}

export const usePaymentConfirmation = (subscriptionId?: string, paymentId?: string, email?: string) => {
  const [state, setState] = useState<PaymentConfirmationState>({
    status: 'checking'
  });

  const syncPaymentManually = useCallback(async () => {
    if (!subscriptionId || !email) return false;

    try {
      console.log('[PAYMENT_CONFIRMATION] Executando sincronização manual...');
      
      const { data, error } = await supabase.functions.invoke('sync-asaas-payment', {
        body: { 
          subscriptionId,
          email
        }
      });

      if (error) {
        console.error('[PAYMENT_CONFIRMATION] Erro na sincronização:', error);
        return false;
      }

      console.log('[PAYMENT_CONFIRMATION] Sincronização bem-sucedida:', data);
      return true;
    } catch (error) {
      console.error('[PAYMENT_CONFIRMATION] Erro na sincronização manual:', error);
      return false;
    }
  }, [subscriptionId, email]);

  const checkPaymentStatus = useCallback(async () => {
    if (!subscriptionId) return;

    try {
      // Verificar status da assinatura
      const { data: subscription, error } = await supabase
        .from('poupeja_subscriptions')
        .select('*')
        .eq('asaas_subscription_id', subscriptionId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        setState({ status: 'error', error: error.message });
        return;
      }

      if (subscription?.status === 'active') {
        setState({ 
          status: 'confirmed',
          subscription 
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      setState({ 
        status: 'error', 
        error: 'Erro ao verificar status do pagamento' 
      });
      return false;
    }
  }, [subscriptionId]);

  const verifyPaymentOnAsaas = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || (!subscriptionId && !paymentId)) return false;
    
    try {
      console.log('[PAYMENT_CONFIRMATION] Verificando no Asaas...');
      
      const { data, error } = await supabase.functions.invoke('verify-asaas-payment-status', {
        body: { 
          subscriptionId: subscriptionId,
          paymentId: paymentId && paymentId !== subscriptionId ? paymentId : undefined,
          userId: user.id
        }
      });

      if (error) {
        console.error('[PAYMENT_CONFIRMATION] Erro ao verificar no Asaas:', error);
        setState({ status: 'error', error: error.message });
        return false;
      }

      console.log('[PAYMENT_CONFIRMATION] Resposta do Asaas:', data);
      
      if (data?.status === 'active' || data?.status === 'confirmed') {
        setState({ 
          status: 'confirmed',
          subscription: data.data 
        });
        return true;
      } else if (data?.status === 'error') {
        setState({ status: 'error', error: 'Erro na verificação' });
        return false;
      } else {
        console.log(`❌ Ainda não confirmado: ${data?.status}`);
        return false;
      }
    } catch (error) {
      console.error('[PAYMENT_CONFIRMATION] Erro na verificação Asaas:', error);
      setState({ 
        status: 'error', 
        error: 'Erro ao verificar no Asaas' 
      });
      return false;
    }
  }, [subscriptionId, paymentId]);

  useEffect(() => {
    if (!subscriptionId) return;

    let attempts = 0;
    const maxAttempts = 120; // 10 minutos máximo (5s * 120 = 600s)
    
    const interval = setInterval(async () => {
      attempts++;
      
      // Após 10 segundos sem confirmação, tentar sincronização manual
      if (attempts === 2) {
        console.log('⏰ 10 segundos sem confirmação. Tentando sincronização manual...');
        const synced = await syncPaymentManually();
        if (synced) {
          // Aguardar 2 segundos e verificar novamente
          setTimeout(async () => {
            const confirmed = await checkPaymentStatus();
            if (confirmed) {
              clearInterval(interval);
            }
          }, 2000);
        }
      }
      
      // Após 30 segundos sem confirmação, tentar verificar no Asaas
      if (attempts === 6) {
        console.log('⏰ 30 segundos sem confirmação. Verificando no Asaas...');
        const asaasConfirmed = await verifyPaymentOnAsaas();
        if (asaasConfirmed) {
          clearInterval(interval);
          return;
        }
      }
      
      // Após 5 minutos, executar verificação proativa de pagamentos pendentes
      if (attempts === 60) {
        console.log('⏰ 5 minutos sem confirmação. Executando verificação proativa...');
        try {
          await supabase.functions.invoke('verify-pending-payments');
          console.log('✅ Verificação proativa executada');
        } catch (error) {
          console.error('❌ Erro na verificação proativa:', error);
        }
      }
      
      // Após 10 minutos, dar timeout
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setState({ 
          status: 'timeout', 
          error: 'Timeout - pagamento não confirmado em 10 minutos. Verifique se o pagamento foi processado corretamente.' 
        });
        return;
      }

      const confirmed = await checkPaymentStatus();
      if (confirmed) {
        clearInterval(interval);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [subscriptionId, paymentId, checkPaymentStatus, verifyPaymentOnAsaas, syncPaymentManually]);

  return {
    ...state,
    checkPaymentStatus,
    verifyPaymentOnAsaas,
    syncPaymentManually
  };
};