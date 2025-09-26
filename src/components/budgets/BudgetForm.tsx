import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Budget, BudgetPeriod } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, Form } from '@/components/ui/form';
import { DatePicker } from '@/components/ui/date-picker';

// Validação do schema para formulário de orçamento
const budgetSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  plannedAmount: z.number().min(0.01, "Valor deve ser maior que zero"),
  periodType: z.enum(['monthly', 'quarterly', 'semestral', 'yearly'] as const),
  startDateOption: z.enum(['first_of_month', 'today', 'custom'] as const),
  customStartDate: z.date().optional(),
  alertThreshold: z.number().min(1, "Limite deve ser entre 1% e 100%").max(100, "Limite deve ser entre 1% e 100%"),
  categoryId: z.string().optional().nullable(),
  isActive: z.boolean(),
}).refine((data) => {
  // Se "custom" foi selecionado, customStartDate é obrigatório
  if (data.startDateOption === 'custom' && !data.customStartDate) {
    return false;
  }
  return true;
}, {
  message: "Data personalizada é obrigatória quando 'Data específica' é selecionada",
  path: ["customStartDate"],
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
  
  // Helper function to get start date based on user selection
  const getStartDate = (startDateOption: 'first_of_month' | 'today' | 'custom', customDate?: Date): Date => {
    const now = new Date();
    
    switch (startDateOption) {
      case 'first_of_month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'today':
        return now;
      case 'custom':
        return customDate || now;
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  };
  
  // Helper function to calculate end date based on start date and period type
  const calculateEndDateFromStart = (startDate: Date, periodType: BudgetPeriod): Date => {
    const start = new Date(startDate);
    
    switch (periodType) {
      case 'monthly':
        // +1 mês da data de início
        return new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1);
      case 'quarterly':
        // +3 meses da data de início
        return new Date(start.getFullYear(), start.getMonth() + 3, start.getDate() - 1);
      case 'semestral':
        // +6 meses da data de início
        return new Date(start.getFullYear(), start.getMonth() + 6, start.getDate() - 1);
      case 'yearly':
        // +12 meses da data de início
        return new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
      default:
        return start;
    }
  };

  const form = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: initialData?.name || '',
      plannedAmount: initialData?.plannedAmount || 0,
      periodType: (initialData?.periodType as BudgetPeriod) || 'monthly',
      startDateOption: 'first_of_month' as const,
      customStartDate: undefined,
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
        startDateOption: 'first_of_month' as const,
        customStartDate: undefined,
        alertThreshold: initialData.alertThreshold,
        categoryId: initialData.categoryId || undefined,
        isActive: initialData.isActive,
      });
    } else if (mode === 'create') {
      form.reset({
        name: '',
        plannedAmount: 0,
        periodType: 'monthly',
        startDateOption: 'first_of_month' as const,
        customStartDate: undefined,
        alertThreshold: 80,
        categoryId: undefined,
        isActive: true,
      });
    }
  }, [initialData, mode, form]);

  const handleSubmit = (values: z.infer<typeof budgetSchema>) => {
    // Calculate dates based on user selection
    const startDate = getStartDate(values.startDateOption, values.customStartDate);
    const endDate = calculateEndDateFromStart(startDate, values.periodType);
    
    onSubmit({
      name: values.name,
      plannedAmount: values.plannedAmount,
      spentAmount: initialData?.spentAmount || 0,
      periodType: values.periodType,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      alertThreshold: values.alertThreshold,
      categoryId: values.categoryId || undefined,
      isActive: values.isActive,
    });
  };

  const expenseCategories = categories.filter(cat => cat.type === 'expense');

  // Helper function to get period description based on current form values
  const getPeriodDescription = (periodType: BudgetPeriod, startDateOption: 'first_of_month' | 'today' | 'custom', customDate?: Date): string => {
    const startDate = getStartDate(startDateOption, customDate);
    const endDate = calculateEndDateFromStart(startDate, periodType);
    
    const formatDate = (date: Date) => date.toLocaleDateString('pt-BR');
    
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
              name="startDateOption"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quando o orçamento deve começar?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="first_of_month" id="first_of_month" />
                        <label htmlFor="first_of_month" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Primeiro dia do mês atual
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="today" id="today" />
                        <label htmlFor="today" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Hoje
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="custom" id="custom" />
                        <label htmlFor="custom" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Data específica
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Data específica condicional */}
            {form.watch('startDateOption') === 'custom' && (
              <FormField
                control={form.control}
                name="customStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início</FormLabel>
                    <FormControl>
                      <DatePicker
                        date={field.value}
                        setDate={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                  {/* Mostrar preview das datas calculadas */}
                  <div className="text-sm text-muted-foreground mt-1">
                    Período: {getPeriodDescription(
                      form.watch('periodType'), 
                      form.watch('startDateOption'), 
                      form.watch('customStartDate')
                    )}
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