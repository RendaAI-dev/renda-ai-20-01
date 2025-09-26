import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import SubscriptionGuard from '@/components/subscription/SubscriptionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, PiggyBank, AlertTriangle, TrendingUp, Calculator } from 'lucide-react';
import { useBudgets } from '@/hooks/useBudgets';
import { usePreferences } from '@/contexts/PreferencesContext';
import { BudgetCard } from '@/components/budgets/BudgetCard';
import { BudgetForm } from '@/components/budgets/BudgetForm';
import { Budget } from '@/types';
import { calculateBudgetProgress, getBudgetStatus } from '@/services/budgetService';

const BudgetsPage: React.FC = () => {
  const { budgets, loading, createBudget, editBudget, removeBudget } = useBudgets();
  const { t, currency } = usePreferences();
  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(amount);
  };

  const handleAddBudget = () => {
    setEditingBudget(null);
    setFormOpen(true);
  };

  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setFormOpen(true);
  };

  const handleDeleteBudget = async (id: string) => {
    await removeBudget(id);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingBudget(null);
  };

  const handleFormSubmit = async (budgetData: Omit<Budget, "id">) => {
    if (editingBudget) {
      await editBudget({ ...budgetData, id: editingBudget.id } as Budget);
    } else {
      await createBudget(budgetData);
    }
    handleFormClose();
  };

  // Calculate summary statistics
  const totalPlanned = budgets.reduce((sum, budget) => sum + budget.plannedAmount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spentAmount, 0);
  const activeBudgets = budgets.filter(budget => budget.isActive);
  const exceededBudgets = budgets.filter(budget => getBudgetStatus(budget) === 'exceeded');

  return (
    <SubscriptionGuard>
      <MainLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PiggyBank className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Orçamentos</h1>
                <p className="text-muted-foreground">
                  Controle seus gastos e mantenha suas finanças organizadas
                </p>
              </div>
            </div>
            <Button onClick={handleAddBudget} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Novo Orçamento
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Planejado</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(totalPlanned)}
                    </p>
                  </div>
                  <Calculator className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Gasto</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(totalSpent)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Orçamentos Ativos</p>
                    <p className="text-2xl font-bold text-foreground">
                      {activeBudgets.length}
                    </p>
                  </div>
                  <PiggyBank className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Excedidos</p>
                    <p className="text-2xl font-bold text-destructive">
                      {exceededBudgets.length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Budgets List */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded"></div>
                      <div className="h-2 bg-muted rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <PiggyBank className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum orçamento encontrado
                </h3>
                <p className="text-muted-foreground mb-4">
                  Crie seu primeiro orçamento para começar a controlar seus gastos.
                </p>
                <Button onClick={handleAddBudget}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Orçamento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  onEdit={handleEditBudget}
                  onDelete={handleDeleteBudget}
                />
              ))}
            </div>
          )}

          {/* Budget Form Modal */}
          <BudgetForm
            open={formOpen}
            onClose={handleFormClose}
            onSubmit={handleFormSubmit}
            initialData={editingBudget}
            mode={editingBudget ? 'edit' : 'create'}
          />
        </div>
      </MainLayout>
    </SubscriptionGuard>
  );
};

export default BudgetsPage;