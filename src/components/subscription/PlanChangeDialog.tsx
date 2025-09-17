import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Calendar } from 'lucide-react';

interface PlanChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
  onPlanChanged: () => void;
}

const PlanChangeDialog: React.FC<PlanChangeDialogProps> = ({
  open,
  onOpenChange,
  currentPlan,
  onPlanChanged
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePlan = async (newPlanType: string) => {
    if (newPlanType === currentPlan) {
      toast.info('Você já está no plano selecionado');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('change-plan', {
        body: { newPlanType }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao alterar plano');
      }

      toast.success(data.message || 'Plano alterado com sucesso');
      
      if (data.paymentUrl) {
        toast.info('Redirecionando para pagamento do ajuste...');
        setTimeout(() => {
          window.open(data.paymentUrl, '_blank');
        }, 1000);
      }

      onPlanChanged();
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('Erro ao alterar plano:', error);
      toast.error(error.message || 'Erro ao alterar plano');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const plans = [
    {
      type: 'monthly',
      name: 'Plano Mensal',
      price: 49.90,
      description: 'Cobrança mensal',
      icon: Calendar,
      isPopular: false
    },
    {
      type: 'annual',
      name: 'Plano Anual',
      price: 538.90,
      originalPrice: 598.80,
      description: 'Cobrança anual • Economize 10%',
      icon: Zap,
      isPopular: true
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Alterar Plano
          </DialogTitle>
          <DialogDescription>
            Escolha seu novo plano. O ajuste será feito proporcionalmente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {plans.map((plan) => {
            const isCurrentPlan = plan.type === currentPlan;
            const Icon = plan.icon;

            return (
              <Card 
                key={plan.type} 
                className={`relative ${isCurrentPlan ? 'border-primary bg-primary/5' : ''}`}
              >
                {plan.isPopular && !isCurrentPlan && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <Badge variant="default" className="text-xs">
                      Mais Popular
                    </Badge>
                  </div>
                )}
                
                {isCurrentPlan && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <Badge variant="secondary" className="text-xs">
                      Plano Atual
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-2 p-2 bg-primary/10 rounded-full w-fit">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="text-center">
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-primary">
                      {formatCurrency(plan.price)}
                    </div>
                    {plan.originalPrice && (
                      <div className="text-sm text-muted-foreground line-through">
                        {formatCurrency(plan.originalPrice)}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground mt-1">
                      {plan.type === 'monthly' ? 'por mês' : 'por ano'}
                    </div>
                  </div>

                  <Button
                    onClick={() => handleChangePlan(plan.type)}
                    disabled={isLoading || isCurrentPlan}
                    variant={isCurrentPlan ? "secondary" : "default"}
                    className="w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {isCurrentPlan ? 'Plano Atual' : 
                     currentPlan === 'monthly' && plan.type === 'annual' ? 'Fazer Upgrade' :
                     currentPlan === 'annual' && plan.type === 'monthly' ? 'Fazer Downgrade' :
                     'Selecionar'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Como funciona a alteração:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Upgrade:</strong> Você paga apenas a diferença proporcional pelo período restante</li>
            <li>• <strong>Downgrade:</strong> O crédito será aplicado na próxima fatura</li>
            <li>• A alteração é efetiva imediatamente</li>
            <li>• A próxima cobrança será no novo valor escolhido</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlanChangeDialog;