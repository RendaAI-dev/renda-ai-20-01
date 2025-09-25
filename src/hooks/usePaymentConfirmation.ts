import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentConfirmationState {
  status: 'checking' | 'confirmed' | 'error' | 'timeout';
  subscription?: any;
  error?: string;
}

export const usePaymentConfirmation = (subscriptionId?: string) => {
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

      if (error) {
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

  useEffect(() => {
    if (!subscriptionId) return;

    let attempts = 0;
    const maxAttempts = 60; // 5 minutos máximo
    
    const interval = setInterval(async () => {
      attempts++;
      
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setState({ 
          status: 'timeout', 
          error: 'Timeout - pagamento não confirmado em 5 minutos' 
        });
        return;
      }

      const confirmed = await checkPaymentStatus();
      if (confirmed) {
        clearInterval(interval);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [subscriptionId, checkPaymentStatus]);

  return {
    ...state,
    checkPaymentStatus
  };
};