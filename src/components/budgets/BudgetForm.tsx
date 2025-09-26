import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Budget, BudgetPeriod } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, Form } from '@/components/ui/form';

const budgetSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  plannedAmount: z.number().min(0.01, "Valor deve ser maior que zero"),
  periodType: z.enum(['monthly', 'quarterly', 'yearly'] as const),
  startDate: z.string().min(1, "Data de início é obrigatória"),
  endDate: z.string().min(1, "Data de fim é obrigatória"),
  alertThreshold: z.number().min(1, "Limite deve ser entre 1% e 100%").max(100, "Limite deve ser entre 1% e 100%"),
  categoryId: z.string().optional(),
  isActive: z.boolean(),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: "Data de fim deve ser posterior à data de início",
  path: ["endDate"],
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
  
  const form = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: initialData?.name || '',
      plannedAmount: initialData?.plannedAmount || 0,
      periodType: (initialData?.periodType as BudgetPeriod) || 'monthly',
      startDate: initialData?.startDate || new Date().toISOString().split('T')[0],
      endDate: initialData?.endDate || '',
      alertThreshold: initialData?.alertThreshold || 80,
      categoryId: initialData?.categoryId || '',
      isActive: initialData?.isActive ?? true,
    },
  });

  const handleSubmit = (values: z.infer<typeof budgetSchema>) => {
    onSubmit({
      name: values.name,
      plannedAmount: values.plannedAmount,
      spentAmount: initialData?.spentAmount || 0,
      periodType: values.periodType,
      startDate: values.startDate,
      endDate: values.endDate,
      alertThreshold: values.alertThreshold,
      categoryId: values.categoryId || undefined,
      isActive: values.isActive,
    });
  };

  const expenseCategories = categories.filter(cat => cat.type === 'expense');

  // Helper function to calculate end date based on period type
  const calculateEndDate = (startDate: string, periodType: BudgetPeriod): string => {
    const start = new Date(startDate);
    const end = new Date(start);
    
    switch (periodType) {
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        end.setDate(end.getDate() - 1);
        break;
      case 'quarterly':
        end.setMonth(end.getMonth() + 3);
        end.setDate(end.getDate() - 1);
        break;
      case 'yearly':
        end.setFullYear(end.getFullYear() + 1);
        end.setDate(end.getDate() - 1);
        break;
    }
    
    return end.toISOString().split('T')[0];
  };

  // Watch for changes in start date and period type to auto-calculate end date
  React.useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'startDate' || name === 'periodType') {
        const startDate = value.startDate;
        const periodType = value.periodType;
        
        if (startDate && periodType) {
          const endDate = calculateEndDate(startDate, periodType as BudgetPeriod);
          form.setValue('endDate', endDate);
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

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
                    <Input {...field} placeholder="Ex: Alimentação Dezembro" />
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Todas as categorias</SelectItem>
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
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Fim</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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