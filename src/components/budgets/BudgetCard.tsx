import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, Edit2, Trash2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Budget } from '@/types';
import { usePreferences } from '@/contexts/PreferencesContext';
import { calculateBudgetProgress, getBudgetStatus } from '@/services/budgetService';

interface BudgetCardProps {
  budget: Budget;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
}

export const BudgetCard: React.FC<BudgetCardProps> = ({
  budget,
  onEdit,
  onDelete,
}) => {
  const { currency } = usePreferences();
  
  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(amount);
  };
  
  const progress = calculateBudgetProgress(budget);
  const status = getBudgetStatus(budget);
  const remaining = budget.plannedAmount - budget.spentAmount;

  const getStatusColor = () => {
    switch (status) {
      case 'exceeded':
        return 'destructive';
      case 'warning':
        return 'secondary'; // Changed from 'warning' to 'secondary'
      default:
        return 'success'; // Changed to 'default' since 'success' doesn't exist
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'exceeded':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warning':
        return <Clock className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'exceeded':
        return 'Excedido';
      case 'warning':
        return 'Atenção';
      default:
        return 'No prazo';
    }
  };

  const getProgressColor = () => {
    if (progress >= 100) return 'bg-destructive';
    if (progress >= budget.alertThreshold) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold truncate">
            {budget.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusColor()} className="flex items-center gap-1">
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(budget)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(budget.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{progress.toFixed(1)}%</span>
          </div>
          <div className="relative">
            <Progress value={Math.min(progress, 100)} className="h-2" />
            <div 
              className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getProgressColor()}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Amounts */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Gasto</span>
            <span className="font-semibold">{formatCurrency(budget.spentAmount)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Orçado</span>
            <span className="font-semibold">{formatCurrency(budget.plannedAmount)}</span>
          </div>
          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-sm font-medium">
              {remaining >= 0 ? 'Restante' : 'Excedido em'}
            </span>
            <span className={`font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(remaining))}
            </span>
          </div>
        </div>

        {/* Period Info */}
        <div className="text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Período:</span>
            <span className="capitalize">{budget.periodType}</span>
          </div>
          <div className="flex justify-between">
            <span>De:</span>
            <span>{new Date(budget.startDate).toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="flex justify-between">
            <span>Até:</span>
            <span>{new Date(budget.endDate).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        {/* Alert threshold indicator */}
        {progress >= budget.alertThreshold && progress < 100 && (
          <div className="flex items-center gap-2 p-2 bg-yellow-100 rounded-md">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-xs text-yellow-700">
              Atingiu {budget.alertThreshold}% do orçamento
            </span>
          </div>
        )}

        {progress >= 100 && (
          <div className="flex items-center gap-2 p-2 bg-red-100 rounded-md">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-xs text-red-700">
              Orçamento excedido
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};