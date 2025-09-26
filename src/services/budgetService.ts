import { supabase } from "@/integrations/supabase/client";
import { Budget, BudgetStatus } from "@/types";

export const getBudgets = async (): Promise<Budget[]> => {
  const { data, error } = await supabase
    .from('poupeja_budgets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching budgets:', error);
    throw error;
  }

  return data?.map((budget) => ({
    id: budget.id,
    name: budget.name,
    plannedAmount: budget.planned_amount || 0,
    spentAmount: budget.spent_amount || 0,
    periodType: budget.period_type as Budget['periodType'],
    startDate: budget.start_date,
    endDate: budget.end_date,
    isActive: budget.is_active ?? true,
    alertThreshold: budget.alert_threshold || 80,
    categoryId: budget.category_id,
    // Keep database fields for compatibility
    planned_amount: budget.planned_amount || 0,
    spent_amount: budget.spent_amount || 0,
    period_type: budget.period_type,
    start_date: budget.start_date,
    end_date: budget.end_date,
    is_active: budget.is_active ?? true,
    alert_threshold: budget.alert_threshold || 80,
    category_id: budget.category_id,
    user_id: budget.user_id,
    created_at: budget.created_at,
    updated_at: budget.updated_at,
  })) || [];
};

export const addBudget = async (budget: Omit<Budget, "id">): Promise<Budget | null> => {
  const user = await supabase.auth.getUser();
  
  if (!user.data.user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('poupeja_budgets')
    .insert([{
      user_id: user.data.user.id,
      name: budget.name,
      planned_amount: budget.plannedAmount || 0,
      spent_amount: 0,
      period_type: budget.periodType || 'monthly',
      start_date: budget.startDate,
      end_date: budget.endDate,
      is_active: budget.isActive ?? true,
      alert_threshold: budget.alertThreshold || 80,
      category_id: budget.categoryId,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding budget:', error);
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    plannedAmount: data.planned_amount,
    spentAmount: data.spent_amount,
    periodType: data.period_type as Budget['periodType'],
    startDate: data.start_date,
    endDate: data.end_date,
    isActive: data.is_active,
    alertThreshold: data.alert_threshold,
    categoryId: data.category_id,
    // Keep database fields for compatibility
    planned_amount: data.planned_amount,
    spent_amount: data.spent_amount,
    period_type: data.period_type,
    start_date: data.start_date,
    end_date: data.end_date,
    is_active: data.is_active,
    alert_threshold: data.alert_threshold,
    category_id: data.category_id,
    user_id: data.user_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
};

export const updateBudget = async (budget: Budget): Promise<Budget | null> => {
  const { data, error } = await supabase
    .from('poupeja_budgets')
    .update({
      name: budget.name,
      planned_amount: budget.plannedAmount,
      period_type: budget.periodType,
      start_date: budget.startDate,
      end_date: budget.endDate,
      is_active: budget.isActive,
      alert_threshold: budget.alertThreshold,
      category_id: budget.categoryId,
    })
    .eq('id', budget.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating budget:', error);
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    plannedAmount: data.planned_amount,
    spentAmount: data.spent_amount,
    periodType: data.period_type as Budget['periodType'],
    startDate: data.start_date,
    endDate: data.end_date,
    isActive: data.is_active,
    alertThreshold: data.alert_threshold,
    categoryId: data.category_id,
    // Keep database fields for compatibility
    planned_amount: data.planned_amount,
    spent_amount: data.spent_amount,
    period_type: data.period_type,
    start_date: data.start_date,
    end_date: data.end_date,
    is_active: data.is_active,
    alert_threshold: data.alert_threshold,
    category_id: data.category_id,
    user_id: data.user_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
};

export const deleteBudget = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('poupeja_budgets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting budget:', error);
    throw error;
  }

  return true;
};

export const calculateBudgetProgress = (budget: Budget): number => {
  if (budget.plannedAmount === 0) return 0;
  return Math.min((budget.spentAmount / budget.plannedAmount) * 100, 100);
};

export const getBudgetStatus = (budget: Budget): BudgetStatus => {
  const progress = calculateBudgetProgress(budget);
  
  if (progress >= 100) return 'exceeded';
  if (progress >= budget.alertThreshold) return 'warning';
  return 'on_track';
};

export const refreshBudgetAmounts = async (): Promise<void> => {
  // This function would call the database trigger when transactions change
  // For now, it's a placeholder since the trigger handles updates automatically
  console.log('Budget amounts are updated automatically via database triggers');
};
