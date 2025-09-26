import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock, Plus, TrendingUp } from 'lucide-react';
import { Budget } from '@/types';
import { usePreferences } from '@/contexts/PreferencesContext';
import { calculateBudgetProgress, getBudgetStatus } from '@/services/budgetService';

interface DashboardBudgetsProps {
  budgets: Budget[];
  loading: boolean;
  currentMonth: Date;
}

const DashboardBudgets: React.FC<DashboardBudgetsProps> = ({
  budgets,
  loading,
  currentMonth
}) => {
  const { currency, t } = usePreferences();

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(amount);
  };

  // Filter budgets for current month and get most relevant ones
  const currentMonthBudgets = budgets.filter(budget => {
    const budgetStart = new Date(budget.startDate);
    const budgetEnd = new Date(budget.endDate);
    return currentMonth >= budgetStart && currentMonth <= budgetEnd && budget.isActive;
  });

  // Sort by priority: exceeded > warning > on_track, then by progress desc
  const sortedBudgets = currentMonthBudgets
    .map(budget => ({
      ...budget,
      progress: calculateBudgetProgress(budget),
      status: getBudgetStatus(budget)
    }))
    .sort((a, b) => {
      const statusPriority = { exceeded: 0, warning: 1, on_track: 2 };
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return b.progress - a.progress;
    })
    .slice(0, 3); // Show top 3

  // Calculate summary stats
  const totalPlanned = currentMonthBudgets.reduce((sum, budget) => sum + budget.plannedAmount, 0);
  const totalSpent = currentMonthBudgets.reduce((sum, budget) => sum + budget.spentAmount, 0);
  const exceededCount = currentMonthBudgets.filter(budget => getBudgetStatus(budget) === 'exceeded').length;

  const getStatusBadge = (status: string, progress: number) => {
    switch (status) {
      case 'exceeded':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Excedido
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Atenção
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            No prazo
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-3 bg-muted rounded"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (currentMonthBudgets.length === 0) {
    return (
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum orçamento ativo</h3>
            <p className="text-muted-foreground mb-4">
              Crie orçamentos para controlar melhor seus gastos mensais
            </p>
            <Button asChild>
              <Link to="/budgets">
                <Plus className="h-4 w-4 mr-2" />
                Criar Orçamento
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold">Orçamentos</CardTitle>
          <Button variant="outline" asChild size="sm">
            <Link to="/budgets">Ver todos</Link>
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{formatCurrency(totalPlanned)}</div>
            <div className="text-sm text-muted-foreground">Planejado</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
            <div className="text-sm text-muted-foreground">Gasto</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(Math.max(0, totalPlanned - totalSpent))}
            </div>
            <div className="text-sm text-muted-foreground">Disponível</div>
          </div>
        </div>

        {/* Warning if any budgets exceeded */}
        {exceededCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">
              {exceededCount} orçamento{exceededCount > 1 ? 's' : ''} excedido{exceededCount > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Budget List */}
        <div className="space-y-4">
          {sortedBudgets.map((budget) => (
            <div key={budget.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{budget.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(budget.spentAmount)} de {formatCurrency(budget.plannedAmount)}
                  </p>
                </div>
                {getStatusBadge(budget.status, budget.progress)}
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>{budget.progress.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(budget.progress, 100)} className="h-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Show more link if there are more budgets */}
        {currentMonthBudgets.length > 3 && (
          <div className="text-center">
            <Button variant="ghost" asChild size="sm">
              <Link to="/budgets">
                Ver todos os {currentMonthBudgets.length} orçamentos
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardBudgets;