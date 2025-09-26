import { useState, useEffect } from 'react';
import { Budget } from '@/types';
import { getBudgets, addBudget, updateBudget, deleteBudget } from '@/services/budgetService';
import { useToast } from '@/hooks/use-toast';

export const useBudgets = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const data = await getBudgets();
      setBudgets(data);
    } catch (error) {
      console.error('Error loading budgets:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os orçamentos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createBudget = async (budgetData: Omit<Budget, "id">): Promise<Budget | null> => {
    try {
      const newBudget = await addBudget(budgetData);
      if (newBudget) {
        setBudgets(prev => [newBudget, ...prev]);
        toast({
          title: "Sucesso",
          description: "Orçamento criado com sucesso!",
        });
      }
      return newBudget;
    } catch (error) {
      console.error('Error creating budget:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o orçamento.",
        variant: "destructive",
      });
      return null;
    }
  };

  const editBudget = async (budgetData: Budget): Promise<Budget | null> => {
    try {
      const updatedBudget = await updateBudget(budgetData);
      if (updatedBudget) {
        setBudgets(prev => prev.map(budget => 
          budget.id === updatedBudget.id ? updatedBudget : budget
        ));
        toast({
          title: "Sucesso",
          description: "Orçamento atualizado com sucesso!",
        });
      }
      return updatedBudget;
    } catch (error) {
      console.error('Error updating budget:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o orçamento.",
        variant: "destructive",
      });
      return null;
    }
  };

  const removeBudget = async (id: string): Promise<boolean> => {
    try {
      const success = await deleteBudget(id);
      if (success) {
        setBudgets(prev => prev.filter(budget => budget.id !== id));
        toast({
          title: "Sucesso",
          description: "Orçamento excluído com sucesso!",
        });
      }
      return success;
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o orçamento.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  return {
    budgets,
    loading,
    createBudget,
    editBudget,
    removeBudget,
    refreshBudgets: loadBudgets,
  };
};