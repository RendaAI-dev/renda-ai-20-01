import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlanPeriod, formatPrice } from '@/utils/planPeriodUtils';

export interface PlanFamily {
  id: string;
  name: string;
  slug: string;
  description?: string;
  features: string[];
  limitations: string[];
  is_popular: boolean;
  trial_days: number;
  max_users?: number;
  metadata: Record<string, any>;
  pricing: {
    monthly?: PeriodPricing;
    quarterly?: PeriodPricing;
    semiannual?: PeriodPricing;
    annual?: PeriodPricing;
  };
}

interface PeriodPricing {
  amount: number;
  display: string;
  originalPrice?: string;
  discount?: string;
  savings?: string;
  priceId?: string;
}

interface PlanConfig {
  plans: PlanFamily[];
  contact: {
    phone: string;
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

  const fetchConfig = async (): Promise<PlanConfig> => {
    try {
      console.log('[useNewPlanConfig] Iniciando busca de configurações...');
      
      // Buscar planos ativos
      const { data: plansData, error: plansError } = await supabase.functions.invoke('get-active-plans');
      console.log('[useNewPlanConfig] Resposta get-active-plans:', { plansData, plansError });
      
      if (plansError) throw plansError;

      // Buscar configurações públicas para contato
      const { data: publicData, error: publicError } = await supabase.functions.invoke('get-public-settings', {
        body: { category: 'contact' }
      });
      console.log('[useNewPlanConfig] Resposta get-public-settings:', { publicData, publicError });
      
      if (publicError) {
        console.warn('[useNewPlanConfig] Erro ao buscar configurações públicas:', publicError);
      }

      // Agrupar planos por família (mesmo nome base)
      const planFamilies = new Map<string, any>();
      
      plansData?.plans?.forEach((plan: any) => {
        const familyKey = plan.name; // Use name as family key
        
        if (!planFamilies.has(familyKey)) {
          planFamilies.set(familyKey, {
            id: plan.id,
            name: plan.name,
            slug: plan.slug,
            description: plan.description,
            features: plan.features || [],
            limitations: plan.limitations || [],
            is_popular: plan.is_popular || false,
            trial_days: plan.trial_days || 0,
            max_users: plan.max_users,
            metadata: plan.metadata || {},
            pricing: {}
          });
        }
        
        const family = planFamilies.get(familyKey);
        
        // Adicionar preço do período específico
        family.pricing[plan.plan_period] = {
          amount: plan.price,
          display: plan.display,
          originalPrice: plan.originalDisplay,
          discount: plan.discount > 0 ? `${plan.discount}%` : undefined,
          savings: plan.savings,
          priceId: plan.stripe_price_id
        };
      });

      const contactPhone = publicData?.success && publicData?.settings?.contact_phone?.value 
        ? publicData.settings.contact_phone.value 
        : '';

      const config: PlanConfig = {
        plans: Array.from(planFamilies.values()),
        contact: {
          phone: contactPhone
        }
      };
      
      console.log('[useNewPlanConfig] Config final criada:', config);
      return config;
    } catch (err) {
      console.error('[useNewPlanConfig] Erro ao carregar configurações:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return { config, isLoading, error, refetch: fetchConfig };
};

// Export legacy types for compatibility
export type NewPlanConfig = PlanConfig;