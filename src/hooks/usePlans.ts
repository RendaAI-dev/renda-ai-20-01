import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price_monthly: number;
  price_annual?: number;
  stripe_price_id_monthly?: string;
  stripe_price_id_annual?: string;
  features: string[];
  limitations: string[];
  is_popular: boolean;
  is_active: boolean;
  max_users?: number;
  trial_days: number;
  sort_order: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  pricing?: {
    monthly: {
      amount: number;
      display: string;
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
}

export const usePlans = (activeOnly = false) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (activeOnly) {
        // Usar edge function para planos ativos (público)
        const { data, error } = await supabase.functions.invoke('get-active-plans');
        
        if (error) throw error;
        
        if (data?.success) {
          setPlans(data.plans || []);
        } else {
          throw new Error(data?.error || 'Erro ao buscar planos');
        }
      } else {
        // Usar edge function para todos os planos (admin)
        const { data, error } = await supabase.functions.invoke('manage-plans');
        
        if (error) throw error;
        
        if (data?.success) {
          setPlans(data.plans || []);
        } else {
          throw new Error(data?.error || 'Erro ao buscar planos');
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar planos:', err);
      setError(err.message || 'Erro ao carregar planos');
      toast({
        title: "Erro ao carregar planos",
        description: err.message || 'Tente novamente mais tarde',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createPlan = async (planData: Omit<Plan, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-plans', {
        body: planData
      });

      if (error) throw error;

      if (data?.success) {
        await fetchPlans(); // Recarregar lista
        toast({
          title: "Plano criado com sucesso!",
          description: `O plano "${planData.name}" foi criado.`,
        });
        return data.plan;
      } else {
        throw new Error(data?.error || 'Erro ao criar plano');
      }
    } catch (err: any) {
      console.error('Erro ao criar plano:', err);
      toast({
        title: "Erro ao criar plano",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const updatePlan = async (planId: string, planData: Partial<Plan>) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-plans', {
        body: planData
      });

      if (error) throw error;

      if (data?.success) {
        await fetchPlans(); // Recarregar lista
        toast({
          title: "Plano atualizado com sucesso!",
          description: `As alterações foram salvas.`,
        });
        return data.plan;
      } else {
        throw new Error(data?.error || 'Erro ao atualizar plano');
      }
    } catch (err: any) {
      console.error('Erro ao atualizar plano:', err);
      toast({
        title: "Erro ao atualizar plano",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-plans', {
        body: null
      });

      if (error) throw error;

      if (data?.success) {
        await fetchPlans(); // Recarregar lista
        toast({
          title: "Plano deletado com sucesso!",
          description: "O plano foi removido permanentemente.",
        });
      } else {
        throw new Error(data?.error || 'Erro ao deletar plano');
      }
    } catch (err: any) {
      console.error('Erro ao deletar plano:', err);
      toast({
        title: "Erro ao deletar plano",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const togglePlanStatus = async (planId: string, isActive: boolean) => {
    try {
      await updatePlan(planId, { is_active: isActive });
    } catch (err) {
      // Erro já tratado no updatePlan
      throw err;
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [activeOnly]);

  return {
    plans,
    isLoading,
    error,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
    togglePlanStatus,
  };
};