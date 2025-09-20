import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  plan_period: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  price: number;
  price_original?: number;
  asaas_price_id?: string;
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
        // Usar edge function para todos os planos (admin) - método GET
        const session = await supabase.auth.getSession();
        
        if (!session.data.session?.access_token) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-plans`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Não autorizado. Verifique suas credenciais.');
          } else if (response.status === 403) {
            throw new Error('Acesso negado. Apenas administradores podem gerenciar planos.');
          } else if (response.status === 0 || !response.status) {
            throw new Error('Erro de conexão. Verifique sua internet.');
          }
        }
        
        const data = await response.json();
        
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
      const session = await supabase.auth.getSession();
      
      if (!session.data.session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planData),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = data?.error || 'Erro ao criar plano';
        if (response.status === 401) {
          errorMessage = 'Não autorizado. Faça login novamente.';
        } else if (response.status === 403) {
          errorMessage = 'Acesso negado. Apenas administradores podem criar planos.';
        }
        throw new Error(errorMessage);
      }

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
      const session = await supabase.auth.getSession();
      
      if (!session.data.session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-plans?id=${planId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planData),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = data?.error || 'Erro ao atualizar plano';
        if (response.status === 401) {
          errorMessage = 'Não autorizado. Faça login novamente.';
        } else if (response.status === 403) {
          errorMessage = 'Acesso negado. Apenas administradores podem atualizar planos.';
        } else if (response.status === 404) {
          errorMessage = 'Plano não encontrado.';
        }
        throw new Error(errorMessage);
      }

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
      const session = await supabase.auth.getSession();
      
      if (!session.data.session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-plans?id=${planId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = data?.error || 'Erro ao deletar plano';
        if (response.status === 401) {
          errorMessage = 'Não autorizado. Faça login novamente.';
        } else if (response.status === 403) {
          errorMessage = 'Acesso negado. Apenas administradores podem deletar planos.';
        } else if (response.status === 404) {
          errorMessage = 'Plano não encontrado.';
        }
        throw new Error(errorMessage);
      }

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