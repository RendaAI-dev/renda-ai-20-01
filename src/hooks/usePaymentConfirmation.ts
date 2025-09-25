import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentConfirmationState {
  status: 'checking' | 'confirmed' | 'error' | 'timeout';
  subscription?: any;
  error?: string;
}

export const usePaymentConfirmation = (subscriptionId?: string, paymentId?: string) => {
  const [state, setState] = useState<PaymentConfirmationState>({
    status: 'checking'
  });

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
      
      // Após 30 segundos sem confirmação, tentar verificar no Asaas
      if (attempts === 6) {
        console.log('⏰ 30 segundos sem confirmação. Verificando no Asaas...');
        const asaasConfirmed = await verifyPaymentOnAsaas();
        if (asaasConfirmed) {
          clearInterval(interval);
          return;
        }
      }
      
      // Após 10 minutos, dar timeout
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setState({ 
          status: 'timeout', 
          error: 'Timeout - pagamento não confirmado em 10 minutos' 
        });
        return;
      }

      const confirmed = await checkPaymentStatus();
      if (confirmed) {
        clearInterval(interval);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [subscriptionId, paymentId, checkPaymentStatus, verifyPaymentOnAsaas]);

  return {
    ...state,
    checkPaymentStatus,
    verifyPaymentOnAsaas
  };
};