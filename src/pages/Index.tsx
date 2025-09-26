import React, { useState, useEffect, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import SubscriptionGuard from '@/components/subscription/SubscriptionGuard';
import TransactionForm from '@/components/common/TransactionForm';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardStatCards from '@/components/dashboard/DashboardStatCards';
import DashboardContent from '@/components/dashboard/DashboardContent';
import { useAppContext } from '@/contexts/AppContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { calculateTotalIncome, calculateTotalExpenses, calculateMonthlyFinancialData, getGoalsForMonth } from '@/utils/transactionUtils';
import { useToast } from '@/components/ui/use-toast';
import { markAsPaid } from '@/services/scheduledTransactionService';
import { ScheduledTransaction } from '@/types';
import { logInfo } from '@/utils/consoleOptimizer';
import { CriticalResourcePreloader } from '@/components/common/CriticalResourcePreloader';

const Index = memo(() => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    filteredTransactions,
    transactions,
    setCustomDateRange,
    goals,
    hideValues,
    toggleHideValues,
    getTransactions,
    getGoals,
    deleteTransaction,
    scheduledTransactions
  } = useAppContext();
  const { t } = usePreferences();
  
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0);
  
  // Only log in development to reduce console noise
  logInfo("Dashboard rendered", {
    transactionsCount: transactions.length, 
    filteredTransactionsCount: filteredTransactions.length,
    goalsCount: goals.length,
    scheduledTransactionsCount: scheduledTransactions.length
  });
  
  // NEW: Calculate month-specific financial data using the new utility
  const monthlyData = calculateMonthlyFinancialData(transactions, currentMonth);
  const monthlyGoals = getGoalsForMonth(goals, currentMonth);
  
  const totalIncome = monthlyData.monthlyIncome;
  const totalExpenses = monthlyData.monthlyExpenses;
  const balance = monthlyData.accumulatedBalance;
  
  // Load initial data only once when component mounts
  useEffect(() => {
    const loadInitialData = async () => {
      logInfo("Dashboard: Loading initial data...");
      try {
        await Promise.all([getTransactions(), getGoals()]);
        logInfo("Dashboard: Initial data loaded successfully");
      } catch (error) {
        logInfo("Dashboard: Error loading initial data:", error);
      }
    };
    
    loadInitialData();
  }, []); // ✅ Empty dependency array - runs only once

  // Update date range when month changes
  useEffect(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
    setCustomDateRange(firstDay, lastDay);
    logInfo("Dashboard: Date range updated for month:", currentMonth.toDateString());
  }, [currentMonth, setCustomDateRange]);

  // Removed auto-refresh to prevent performance issues
  // Data will be refreshed when user performs actions (add/edit/delete transactions)
  
  const handleMonthChange = useCallback((date: Date) => {
    logInfo("Dashboard: Month changed to:", date.toDateString());
    setCurrentMonth(date);
    
    // Update filtered transactions range to match the selected month
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    setCustomDateRange(firstDay, lastDay);
  }, [setCustomDateRange]);
  
  const handleAddTransaction = (type: 'income' | 'expense' = 'expense') => {
    setSelectedTransaction(null);
    setFormMode('create');
    setTransactionType(type);
    setTransactionDialogOpen(true);
  };
  
  const handleEditTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setFormMode('edit');
    setTransactionDialogOpen(true);
  };
  
  const handleDeleteTransaction = useCallback(async (id: string) => {
    try {
      await deleteTransaction(id);
      toast({
        title: t('transactions.deleted'),
        description: t('transactions.deleteSuccess'),
      });
      
      // Refresh transactions and goals
      logInfo("Dashboard: Refreshing data after delete...");
      await Promise.all([
        getTransactions(),
        getGoals()
      ]);
    } catch (error) {
      logInfo('Error deleting transaction:', error);
      toast({
        title: t('common.error'),
        description: t('transactions.deleteError'),
        variant: 'destructive',
      });
    }
  }, [deleteTransaction, toast, t, getTransactions, getGoals]);

  const handleMarkScheduledAsPaid = useCallback(async (transaction: ScheduledTransaction) => {
    const success = await markAsPaid(transaction.id);
    if (success) {
      toast({
        title: t('schedule.marked_as_paid'),
        description: t('schedule.transaction_marked_as_paid')
      });
      // Refresh data to update the alert
      logInfo("Dashboard: Refreshing data after marking as paid...");
      await Promise.all([
        getTransactions(),
        getGoals()
      ]);
    } else {
      toast({
        title: t('common.error'),
        description: t('common.somethingWentWrong'),
        variant: "destructive"
      });
    }
  }, [toast, t, getTransactions, getGoals]);
  
  const navigateToTransactionType = (type: 'income' | 'expense') => {
    navigate(`/transactions?type=${type}`);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.3
      }
    }
  };
  
  return (
    <MainLayout title={t('dashboard.title')} onAddTransaction={handleAddTransaction}>
      <SubscriptionGuard feature="o dashboard completo">
        <div className="space-y-8 min-h-0 animate-fade-in">
          {/* Header com navegação de mês e toggle de visibilidade */}
          <DashboardHeader
            currentMonth={currentMonth}
            onMonthChange={handleMonthChange}
            hideValues={hideValues}
            toggleHideValues={toggleHideValues}
            onAddTransaction={handleAddTransaction}
          />
          
          {/* 3 Cards principais na mesma linha */}
          <div className="animate-slide-up">
            <DashboardStatCards
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              balance={balance}
              hideValues={hideValues}
              onNavigateToTransactionType={navigateToTransactionType}
            />
          </div>

          {/* Conteúdo do dashboard */}
          <DashboardContent
            filteredTransactions={monthlyData.monthTransactions}
            goals={monthlyGoals}
            scheduledTransactions={scheduledTransactions}
            currentGoalIndex={currentGoalIndex}
            currentMonth={currentMonth}
            hideValues={hideValues}
            onGoalChange={setCurrentGoalIndex}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onMarkScheduledAsPaid={handleMarkScheduledAsPaid}
          />
        </div>
      </SubscriptionGuard>

      {/* Dialog do formulário de transação */}
      <TransactionForm 
        open={transactionDialogOpen} 
        onOpenChange={setTransactionDialogOpen} 
        initialData={selectedTransaction} 
        mode={formMode} 
        defaultType={transactionType} 
      />
    </MainLayout>
  );
});

Index.displayName = 'Index';

export default Index;
