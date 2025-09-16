import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlanPeriod, formatPrice } from '@/utils/planPeriodUtils';

// Interface para o pricing de cada período
interface PeriodPricing {
  priceId: string;
  display: string;
  originalPrice?: string;
  discount?: string;
  savings?: string;
}

// Interface para o plano completo
export interface Plan {
  id: string;
  name: string;
  description?: string;
  features: string[];
  limitations?: string[];
  isPopular?: boolean;
  pricing: {
    [K in PlanPeriod]: PeriodPricing;
  };
}

// Interface para a configuração completa
export interface PlanConfig {
  plans: Plan[];
  contact?: {
    phone?: string;
  };
}

// Interface para o resultado da API
interface PlanConfigResponse {
  config: PlanConfig | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useNewPlanConfig = (): PlanConfigResponse => {
  const [config, setConfig] = useState<PlanConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Buscar planos ativos da tabela poupeja_plans
      const { data: plansData, error: plansError } = await supabase
        .from('poupeja_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (plansError) {
        throw new Error(`Erro ao carregar planos: ${plansError.message}`);
      }

      if (!plansData || plansData.length === 0) {
        throw new Error('Nenhum plano ativo encontrado');
      }

      // Buscar Price IDs do Stripe
      const { data: stripeData, error: stripeError } = await supabase.functions.invoke('get-stripe-prices');
      
      if (stripeError) {
        console.warn('Aviso: Não foi possível carregar Price IDs do Stripe:', stripeError);
      }

      // Buscar configurações públicas para contato
      const { data: settingsData, error: settingsError } = await supabase.functions.invoke('get-public-settings');
      
      if (settingsError) {
        console.warn('Aviso: Não foi possível carregar configurações de contato:', settingsError);
      }

      // Processar cada plano
      const plans: Plan[] = plansData.map(plan => {
        // Criar estrutura de pricing para cada período
        const periods: PlanPeriod[] = ['monthly', 'quarterly', 'semiannual', 'annual'];
        const pricing: any = {};
        
        periods.forEach(period => {
          const priceField = `price_${period}` as keyof typeof plan;
          const originalPriceField = `price_${period}_original` as keyof typeof plan;
          const stripePriceIdField = `stripe_price_id_${period}` as keyof typeof plan;
          
          const price = plan[priceField] as number || 0;
          const originalPrice = plan[originalPriceField] as number || price;
          const priceId = plan[stripePriceIdField] as string || stripeData?.prices?.[period] || '';
          
          // Calcular desconto
          const discount = originalPrice > price ? 
            Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
          
          pricing[period] = {
            priceId,
            display: formatPrice(price),
            originalPrice: discount > 0 ? formatPrice(originalPrice) : undefined,
            discount: discount > 0 ? `${discount}%` : undefined,
            savings: discount > 0 ? `Economize ${discount}%` : undefined
          };
        });

        return {
          id: plan.slug || plan.id,
          name: plan.name,
          description: plan.description || undefined,
          features: Array.isArray(plan.features) ? 
            plan.features.filter((f): f is string => typeof f === 'string') : [],
          limitations: Array.isArray(plan.limitations) && plan.limitations.length > 0 ? 
            plan.limitations.filter((l): l is string => typeof l === 'string') : undefined,
          isPopular: plan.is_popular || false,
          pricing
        };
      });

      // Montar configuração final
      const planConfig: PlanConfig = {
        plans,
        contact: {
          phone: settingsData?.settings?.contact?.contact_phone?.value || ''
        }
      };

      setConfig(planConfig);

    } catch (err) {
      console.error('Erro ao carregar configuração de planos:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao carregar planos');
      
      // Fallback para configuração básica se falhar
      const fallbackConfig: PlanConfig = {
        plans: [{
          id: 'premium',
          name: 'Premium',
          description: 'Plano completo com todas as funcionalidades',
          features: [
            'Controle financeiro completo',
            'Metas e objetivos',
            'Relatórios detalhados',
            'Categorias personalizadas',
            'Lembretes automáticos',
            'Sincronização em nuvem',
            'Suporte prioritário'
          ],
          isPopular: true,
          pricing: {
            monthly: {
              priceId: '',
              display: 'R$ 29,90'
            },
            quarterly: {
              priceId: '',
              display: 'R$ 87,90',
              originalPrice: 'R$ 89,70',
              discount: '2%',
              savings: 'Economize 2%'
            },
            semiannual: {
              priceId: '',
              display: 'R$ 169,90',
              originalPrice: 'R$ 179,40',
              discount: '5%',
              savings: 'Economize 5%'
            },
            annual: {
              priceId: '',
              display: 'R$ 177,00',
              originalPrice: 'R$ 358,80',
              discount: '51%',
              savings: 'Economize 51%'
            }
          }
        }],
        contact: {
          phone: ''
        }
      };
      
      setConfig(fallbackConfig);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return { config, isLoading, error, refetch: fetchConfig };
};

// Export legacy types for compatibility
export type NewPlanConfig = PlanConfig;