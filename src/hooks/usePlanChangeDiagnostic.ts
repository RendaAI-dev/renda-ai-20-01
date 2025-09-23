import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface DiagnosticResult {
  userAuthenticated: boolean;
  hasActiveSubscription: boolean;
  subscriptionData: any;
  hasAsaasCustomer: boolean;
  asaasCustomerData: any;
  hasAsaasConfig: boolean;
  asaasConfigData: any;
  edgeFunctionAvailable: boolean;
  edgeFunctionError: string | null;
}

export const usePlanChangeDiagnostic = () => {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { subscription, hasActiveSubscription } = useSubscription();

  const runDiagnostic = async () => {
    setIsLoading(true);
    console.log('[DIAGNOSTIC] Iniciando diagnóstico de mudança de plano...');
    
    const result: DiagnosticResult = {
      userAuthenticated: false,
      hasActiveSubscription: false,
      subscriptionData: null,
      hasAsaasCustomer: false,
      asaasCustomerData: null,
      hasAsaasConfig: false,
      asaasConfigData: null,
      edgeFunctionAvailable: false,
      edgeFunctionError: null
    };

    try {
      // 1. Verificar se usuário está autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      result.userAuthenticated = !!user && !userError;
      console.log('[DIAGNOSTIC] Usuário autenticado:', result.userAuthenticated, user?.email);

      if (!user) {
        setDiagnostic(result);
        setIsLoading(false);
        return result;
      }

      // 2. Verificar assinatura
      result.hasActiveSubscription = hasActiveSubscription;
      result.subscriptionData = subscription;
      console.log('[DIAGNOSTIC] Assinatura ativa:', result.hasActiveSubscription, subscription);

      // 3. Verificar cliente Asaas
      try {
        const { data: asaasCustomer, error: asaasCustomerError } = await supabase
          .from('poupeja_asaas_customers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        result.hasAsaasCustomer = !!asaasCustomer && !asaasCustomerError;
        result.asaasCustomerData = asaasCustomer;
        console.log('[DIAGNOSTIC] Cliente Asaas encontrado:', result.hasAsaasCustomer, asaasCustomer);
      } catch (error) {
        console.log('[DIAGNOSTIC] Erro ao buscar cliente Asaas:', error);
      }

      // 4. Verificar configurações do Asaas
      try {
        const { data: asaasConfig } = await supabase.functions.invoke('get-asaas-config');
        result.hasAsaasConfig = !!asaasConfig?.success;
        result.asaasConfigData = asaasConfig;
        console.log('[DIAGNOSTIC] Config Asaas encontrada:', result.hasAsaasConfig, asaasConfig);
      } catch (error) {
        console.log('[DIAGNOSTIC] Erro ao buscar config Asaas:', error);
      }

      // 5. Testar Edge Function change-plan-checkout
      try {
        console.log('[DIAGNOSTIC] Testando Edge Function change-plan-checkout...');
        
        // Fazer uma chamada de teste (sem dados reais para não quebrar nada)
        const testResponse = await supabase.functions.invoke('change-plan-checkout', {
          body: {
            test: true, // Flag para indicar que é um teste
            newPlanType: 'annual',
            currentPlanType: 'monthly'
          }
        });

        // Se chegou aqui, a função existe (mesmo que retorne erro)
        result.edgeFunctionAvailable = true;
        console.log('[DIAGNOSTIC] Edge Function disponível. Resposta de teste:', testResponse);
        
        if (testResponse.error) {
          result.edgeFunctionError = testResponse.error.message || 'Edge Function retornou erro';
        }
      } catch (error) {
        result.edgeFunctionAvailable = false;
        result.edgeFunctionError = error.message || 'Edge Function não encontrada';
        console.error('[DIAGNOSTIC] Edge Function não disponível:', error);
      }

    } catch (error) {
      console.error('[DIAGNOSTIC] Erro durante diagnóstico:', error);
    }

    setDiagnostic(result);
    setIsLoading(false);
    console.log('[DIAGNOSTIC] Resultado completo:', result);
    return result;
  };

  return {
    diagnostic,
    isLoading,
    runDiagnostic
  };
};