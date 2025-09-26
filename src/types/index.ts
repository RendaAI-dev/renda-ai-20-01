
export type TransactionType = 'income' | 'expense';

export type TimeRange = 'today' | 'yesterday' | '7days' | '14days' | '30days' | 'custom';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  categoryIcon?: string;
  categoryColor?: string;
  description?: string;
  date: string; // ISO date string
  goalId?: string; // Optional reference to a goal
  // Database fields for compatibility
  category_id?: string;
  goal_id?: string;
  user_id?: string;
  created_at?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  startDate: string; // ISO date string
  endDate?: string; // Optional end date
  deadline?: string; // Optional deadline date
  color: string;
  transactions: Transaction[];
  // Database fields for compatibility
  target_amount?: number;
  current_amount?: number;
  start_date?: string;
  end_date?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduledTransaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  categoryIcon?: string;
  categoryColor?: string;
  description?: string;
  scheduledDate: string; // ISO date string
  recurrence?: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  goalId?: string; // Optional reference to a goal
  status?: 'pending' | 'paid' | 'overdue' | 'upcoming';
  paidDate?: string; // ISO date string
  paidAmount?: number;
  lastExecutionDate?: string; // ISO date string
  nextExecutionDate?: string; // ISO date string
  // Database fields for compatibility
  category_id?: string;
  goal_id?: string;
  user_id?: string;
  scheduled_date?: string;
  paid_date?: string;
  last_execution_date?: string;
  next_execution_date?: string;
  created_at?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  phone?: string;
  cpf?: string;
  birthDate?: string;
  address?: any; // Will be Address type from viacepService
  cep?: string;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  dateEarned: string; // ISO date string
}

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export type ReportFormat = 'csv' | 'pdf';

export type BudgetPeriod = 'monthly' | 'quarterly' | 'semestral' | 'yearly';

export type BudgetStatus = 'on_track' | 'warning' | 'exceeded';

export interface Budget {
  id: string;
  name: string;
  plannedAmount: number;
  spentAmount: number;
  periodType: BudgetPeriod;
  startDate: string;
  endDate: string;
  isActive: boolean;
  alertThreshold: number;
  categoryId?: string;
  // Database fields for compatibility
  planned_amount?: number;
  spent_amount?: number;
  period_type?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  alert_threshold?: number;
  category_id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}
