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

// Cache local para evitar requisições repetidas
let cachedConfig: PlanConfig | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 60000; // 1 minuto

// Dados de fallback para quando as APIs falham
const fallbackPlans: PlanFamily[] = [
  {
    id: 'basico',
    name: 'Básico',
    slug: 'basico',
    description: 'Para usuários iniciantes',
    features: ['Controle de gastos', 'Relatórios básicos', 'Suporte por email'],
    limitations: ['Até 100 transações/mês'],
    is_popular: false,
    trial_days: 7,
    metadata: {},
    pricing: {
      monthly: { amount: 29.90, display: 'R$ 29,90', priceId: 'fallback_basic_monthly' },
      annual: { amount: 299.90, display: 'R$ 299,90', originalPrice: 'R$ 358,80', discount: '16%', savings: 'Economize 16%', priceId: 'fallback_basic_annual' }
    }
  },
  {
    id: 'premium',
    name: 'Premium',
    slug: 'premium',
    description: 'Para usuários avançados',
    features: ['Controle ilimitado', 'Relatórios avançados', 'Suporte prioritário', 'Análise preditiva'],
    limitations: [],
    is_popular: true,
    trial_days: 14,
    metadata: {},
    pricing: {
      monthly: { amount: 59.90, display: 'R$ 59,90', priceId: 'fallback_premium_monthly' },
      annual: { amount: 599.90, display: 'R$ 599,90', originalPrice: 'R$ 718,80', discount: '16%', savings: 'Economize 16%', priceId: 'fallback_premium_annual' }
    }
  }
];

export const useNewPlanConfig = (): PlanConfigResponse => {
  const [config, setConfig] = useState<PlanConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async (): Promise<PlanConfig> => {
    // Verificar cache primeiro
    const now = Date.now();
    if (cachedConfig && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('[useNewPlanConfig] Usando dados do cache');
      return cachedConfig;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      console.log('[useNewPlanConfig] Iniciando busca de configurações...');
      
      // Promise race para timeout
      const fetchWithTimeout = async () => {
        // Buscar planos ativos com timeout
        const plansPromise = supabase.functions.invoke('get-active-plans', {
          body: {},
          headers: { 'Cache-Control': 'public, max-age=60' }
        });
        
        // Buscar configurações públicas em paralelo
        const publicPromise = supabase.functions.invoke('get-public-settings', {
          body: { category: 'contact' },
          headers: { 'Cache-Control': 'public, max-age=60' }
        });

        const [plansResponse, publicResponse] = await Promise.allSettled([plansPromise, publicPromise]);
        
        // Processar resposta dos planos
        let plansData = null;
        if (plansResponse.status === 'fulfilled' && !plansResponse.value.error) {
          plansData = plansResponse.value.data;
        } else {
          console.warn('[useNewPlanConfig] Erro ao buscar planos, usando fallback:', 
            plansResponse.status === 'rejected' ? plansResponse.reason : plansResponse.value.error);
        }

        // Processar resposta das configurações públicas
        let publicData = null;
        if (publicResponse.status === 'fulfilled' && !publicResponse.value.error) {
          publicData = publicResponse.value.data;
        } else {
          console.warn('[useNewPlanConfig] Erro ao buscar configurações públicas:', 
            publicResponse.status === 'rejected' ? publicResponse.reason : publicResponse.value.error);
        }

        // Se não temos dados dos planos, usar fallback
        if (!plansData?.success || !plansData?.plans?.length) {
          console.log('[useNewPlanConfig] Usando planos de fallback');
          const contactPhone = publicData?.success && publicData?.settings?.contact_phone?.value 
            ? publicData.settings.contact_phone.value 
            : '';

          return {
            plans: fallbackPlans,
            contact: { phone: contactPhone }
          };
        }

        // Agrupar planos por família (mesmo nome base)
        const planFamilies = new Map<string, any>();
        
        plansData.plans.forEach((plan: any) => {
          const familyKey = plan.name;
          
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

        return {
          plans: Array.from(planFamilies.values()),
          contact: { phone: contactPhone }
        };
      };

      const result = await Promise.race([
        fetchWithTimeout(),
        new Promise<never>((_, reject) => 
          controller.signal.addEventListener('abort', () => 
            reject(new Error('Request timeout'))
          )
        )
      ]);

      clearTimeout(timeoutId);
      
      // Cachear resultado
      cachedConfig = result;
      cacheTimestamp = now;
      
      console.log('[useNewPlanConfig] Config carregada com sucesso');
      return result;

    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[useNewPlanConfig] Erro ao carregar configurações:', err);
      
      // Em caso de erro, usar fallback completo
      const fallbackConfig = {
        plans: fallbackPlans,
        contact: { phone: '' }
      };
      
      console.log('[useNewPlanConfig] Usando configuração de fallback completa');
      return fallbackConfig;
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await fetchConfig();
        setConfig(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        // Sempre definir uma config mesmo em caso de erro
        setConfig({
          plans: fallbackPlans,
          contact: { phone: '' }
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  const refetch = async () => {
    // Limpar cache para forçar nova busca
    cachedConfig = null;
    cacheTimestamp = null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchConfig();
      setConfig(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  return { config, isLoading, error, refetch };
};

// Export legacy types for compatibility
export type NewPlanConfig = PlanConfig;