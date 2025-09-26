import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Budget, BudgetPeriod } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, Form } from '@/components/ui/form';

// Validação do schema para formulário de orçamento (sem campos de data)
const budgetSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  plannedAmount: z.number().min(0.01, "Valor deve ser maior que zero"),
  periodType: z.enum(['monthly', 'quarterly', 'semestral', 'yearly'] as const),
  alertThreshold: z.number().min(1, "Limite deve ser entre 1% e 100%").max(100, "Limite deve ser entre 1% e 100%"),
  categoryId: z.string().optional().nullable(),
  isActive: z.boolean(),
});

interface BudgetFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Budget, "id">) => void;
  initialData?: Budget | null;
  mode: 'create' | 'edit';
}

export const BudgetForm: React.FC<BudgetFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  mode
}) => {
  const { categories } = useAppContext();
  
  // Helper function to get automatic start date (first day of current period)
  const getAutomaticStartDate = (periodType: BudgetPeriod): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    switch (periodType) {
      case 'monthly':
        return new Date(year, month, 1).toISOString().split('T')[0];
      case 'quarterly':
        const quarterStartMonth = Math.floor(month / 3) * 3;
        return new Date(year, quarterStartMonth, 1).toISOString().split('T')[0];
      case 'semestral':
        const semesterStartMonth = month < 6 ? 0 : 6;
        return new Date(year, semesterStartMonth, 1).toISOString().split('T')[0];
      case 'yearly':
        return new Date(year, 0, 1).toISOString().split('T')[0];
    }
  };
  
  // Helper function to calculate automatic end date based on period type
  const getAutomaticEndDate = (startDate: string, periodType: BudgetPeriod): string => {
    const start = new Date(startDate);
    
    switch (periodType) {
      case 'monthly':
        // Último dia do mês
        const endOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        return endOfMonth.toISOString().split('T')[0];
      case 'quarterly':
        // Último dia do trimestre
        const quarterEnd = new Date(start.getFullYear(), start.getMonth() + 3, 0);
        return quarterEnd.toISOString().split('T')[0];
      case 'semestral':
        // Último dia do semestre (junho ou dezembro)
        const semesterEnd = start.getMonth() < 6 
          ? new Date(start.getFullYear(), 5, 30) // 30 de junho
          : new Date(start.getFullYear(), 11, 31); // 31 de dezembro
        return semesterEnd.toISOString().split('T')[0];
      case 'yearly':
        // 31 de dezembro do mesmo ano
        const yearEnd = new Date(start.getFullYear(), 11, 31);
        return yearEnd.toISOString().split('T')[0];
    }
  };

  const form = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: initialData?.name || '',
      plannedAmount: initialData?.plannedAmount || 0,
      periodType: (initialData?.periodType as BudgetPeriod) || 'monthly',
      alertThreshold: initialData?.alertThreshold || 80,
      categoryId: initialData?.categoryId || undefined,
      isActive: initialData?.isActive ?? true,
    },
  });

  // Reset form when initialData changes (for edit mode)
  React.useEffect(() => {
    if (initialData && mode === 'edit') {
      form.reset({
        name: initialData.name,
        plannedAmount: initialData.plannedAmount,
        periodType: initialData.periodType as BudgetPeriod,
        alertThreshold: initialData.alertThreshold,
        categoryId: initialData.categoryId || undefined,
        isActive: initialData.isActive,
      });
    } else if (mode === 'create') {
      form.reset({
        name: '',
        plannedAmount: 0,
        periodType: 'monthly',
        alertThreshold: 80,
        categoryId: undefined,
        isActive: true,
      });
    }
  }, [initialData, mode, form]);

  const handleSubmit = (values: z.infer<typeof budgetSchema>) => {
    // Automatically calculate dates based on period type
    const startDate = getAutomaticStartDate(values.periodType);
    const endDate = getAutomaticEndDate(startDate, values.periodType);
    
    onSubmit({
      name: values.name,
      plannedAmount: values.plannedAmount,
      spentAmount: initialData?.spentAmount || 0,
      periodType: values.periodType,
      startDate: startDate,
      endDate: endDate,
      alertThreshold: values.alertThreshold,
      categoryId: values.categoryId || undefined,
      isActive: values.isActive,
    });
  };

  const expenseCategories = categories.filter(cat => cat.type === 'expense');

  // Helper function to get period description
  const getPeriodDescription = (periodType: BudgetPeriod): string => {
    const now = new Date();
    const startDate = getAutomaticStartDate(periodType);
    const endDate = getAutomaticEndDate(startDate, periodType);
    
    const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR');
    
    return `${formatDate(startDate)} até ${formatDate(endDate)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Criar Orçamento' : 'Editar Orçamento'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Orçamento</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Alimentação" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="plannedAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Planejado (R$)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                 <FormItem>
                   <FormLabel>Categoria (Opcional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "__ALL__" ? undefined : value)}
                    value={field.value ?? undefined}
                    disabled={expenseCategories.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={expenseCategories.length === 0 ? "Carregando categorias..." : "Todas as categorias"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__ALL__">Todas as categorias</SelectItem>
                      {expenseCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="periodType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Período</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Mostrar informação sobre o período automático */}
                  <div className="text-sm text-muted-foreground mt-1">
                    Período automático: {getPeriodDescription(form.watch('periodType'))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="alertThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Limite de Alerta (%)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="1"
                      max="100"
                      placeholder="80"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 80)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Orçamento Ativo</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Orçamentos inativos não são considerados nos cálculos
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                {mode === 'create' ? 'Criar' : 'Salvar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};