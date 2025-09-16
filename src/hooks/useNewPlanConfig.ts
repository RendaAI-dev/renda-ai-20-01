import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface NewPlanConfig {
  plans: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    pricing: {
      monthly: {
        amount: number;
        display: string;
        priceId: string;
      };
      quarterly?: {
        amount: number;
        display: string;
        originalPrice: string;
        discount: string;
        savings: string;
        priceId: string;
      };
      semiannual?: {
        amount: number;
        display: string;
        originalPrice: string;
        discount: string;
        savings: string;
        priceId: string;
      };
      annual?: {
        amount: number;
        display: string;
        originalPrice: string;
        discount: string;
        savings: string;
        priceId: string;
      };
    };
    features: string[];
    limitations: string[];
    isPopular: boolean;
    isActive: boolean;
    trialDays: number;
    maxUsers?: number;
  }[];
}

export type Plan = NewPlanConfig['plans'][0];

export const useNewPlanConfig = () => {
  const [config, setConfig] = useState<NewPlanConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Buscar planos ativos usando a edge function
      const { data, error } = await supabase.functions.invoke('get-active-plans');
      
      if (error) throw error;
      
      if (data?.success) {
        // Transformar dados para o formato esperado
        const transformedConfig: NewPlanConfig = {
          plans: data.plans.map((plan: any) => ({
            id: plan.id,
            name: plan.name,
            slug: plan.slug,
            description: plan.description,
            pricing: plan.pricing,
            features: plan.features || [],
            limitations: plan.limitations || [],
            isPopular: plan.is_popular,
            isActive: true, // Apenas planos ativos são retornados
            trialDays: plan.trial_days || 0,
            maxUsers: plan.max_users,
          }))
        };
        
        setConfig(transformedConfig);
      } else {
        throw new Error(data?.error || 'Erro ao buscar configurações de planos');
      }
    } catch (err: any) {
      console.error('Erro ao buscar configurações de planos:', err);
      setError(err.message || 'Erro ao carregar configurações de planos');
      
      // Fallback para sistema antigo se o novo falhar
      try {
        const { data: legacyData, error: legacyError } = await supabase.functions.invoke('get-stripe-prices');
        
        if (!legacyError && legacyData?.success) {
          // Usar configuração legacy como fallback
          const fallbackConfig: NewPlanConfig = {
            plans: [
              {
                id: 'monthly-legacy',
                name: 'Mensal',
                slug: 'monthly',
                description: 'Para uso pessoal completo',
                pricing: {
                  monthly: {
                    amount: 29.90,
                    display: 'R$ 29,90',
                    priceId: legacyData.prices.monthly
                  }
                },
                features: ['Movimentos ilimitados', 'Dashboard completo', 'Todos os relatórios', 'Metas ilimitadas', 'Agendamentos', 'Suporte prioritário'],
                limitations: [],
                isPopular: false,
                isActive: true,
                trialDays: 0
              },
              {
                id: 'annual-legacy',
                name: 'Anual',
                slug: 'annual',
                description: 'Melhor custo-benefício',
                pricing: {
                  monthly: {
                    amount: 177.00,
                    display: 'R$ 177,00',
                    priceId: legacyData.prices.annual
                  },
                  annual: {
                    amount: 177.00,
                    display: 'R$ 177,00',
                    originalPrice: 'R$ 238,80',
                    discount: '26%',
                    savings: 'Economize 26%',
                    priceId: legacyData.prices.annual
                  }
                },
                features: ['Movimentos ilimitados', 'Dashboard completo', 'Todos os relatórios', 'Metas ilimitadas', 'Agendamentos', 'Suporte VIP', 'Backup automático', 'Análises avançadas'],
                limitations: [],
                isPopular: true,
                isActive: true,
                trialDays: 0
              }
            ]
          };
          
          setConfig(fallbackConfig);
          setError(null);
        }
      } catch (fallbackErr) {
        console.error('Fallback também falhou:', fallbackErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    isLoading,
    error,
    refetch: fetchConfig,
  };
};