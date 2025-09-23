import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Calendar, CreditCard } from 'lucide-react';

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
  const navigate = useNavigate();


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
            Escolha seu novo plano e prossiga com o checkout completo.
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
                    disabled={isCurrentPlan}
                    variant={isCurrentPlan ? "secondary" : "default"}
                    className="w-full"
                    onClick={() => {
                      if (!isCurrentPlan) {
                        const params = new URLSearchParams({
                          newPlan: plan.type,
                          currentPlan: currentPlan
                        });
                        navigate(`/checkout/change-plan?${params.toString()}`);
                      }
                    }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {isCurrentPlan ? 'Plano Atual' : 'Alterar Plano'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-6">
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
              <CreditCard className="w-4 h-4" />
              Como funciona:
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Nova assinatura:</strong> Cancela a atual e cria uma nova</li>
              <li>• <strong>Método de pagamento:</strong> Opção de alterar cartão se necessário</li>
              <li>• <strong>Processamento:</strong> Checkout seguro com todas as opções</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlanChangeDialog;