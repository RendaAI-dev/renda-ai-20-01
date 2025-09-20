import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Star, Clock, Users, Zap } from 'lucide-react';
import { Plan } from '@/hooks/usePlans';
import { PLAN_PERIODS } from '@/utils/planPeriodUtils';

interface PlanPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: Plan | null;
}

const PlanPreviewDialog: React.FC<PlanPreviewDialogProps> = ({
  isOpen,
  onClose,
  plan
}) => {
  if (!plan) return null;

  const currentPrice = plan.price;
  const originalPrice = plan.price_original || currentPrice;
  const discount = plan.price_original 
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0;

  const periodInfo = PLAN_PERIODS[plan.plan_period];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Visualização do Plano: {plan.name}
            {plan.is_popular && <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Card Principal */}
          <Card className="relative">
            {plan.is_popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                Mais Popular
              </Badge>
            )}
            
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <p className="text-muted-foreground">{plan.description}</p>
              
              <div className="text-center mb-4">
                <div className="text-3xl font-bold mb-1">
                  R$ {currentPrice.toFixed(2).replace('.', ',')}
                </div>
                <p className="text-sm text-muted-foreground">
                  por {periodInfo.shortLabel.toLowerCase()}
                </p>
                {discount > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm line-through text-muted-foreground">
                      R$ {originalPrice.toFixed(2).replace('.', ',')}
                    </p>
                    <Badge variant="secondary" className="bg-accent text-accent-foreground">
                      Economize {discount}%
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Features */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Funcionalidades Incluídas
                </h4>
                <ul className="space-y-2">
                  {plan.features?.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  )) || <p className="text-sm text-muted-foreground">Nenhuma funcionalidade especificada</p>}
                </ul>
              </div>

              {/* Limitations */}
              {plan.limitations && plan.limitations.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-muted-foreground">Limitações</h4>
                  <ul className="space-y-2">
                    {plan.limitations.map((limitation, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{limitation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Configurações Técnicas */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm">Configurações do Plano</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-medium">Período de Teste</p>
                      <p className="text-muted-foreground">{plan.trial_days || 0} dias</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-medium">Máx. Usuários</p>
                      <p className="text-muted-foreground">{plan.max_users || 'Ilimitado'}</p>
                    </div>
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <p><strong>Período:</strong> {periodInfo.label}</p>
                  <p><strong>Status:</strong> {plan.is_active ? 'Ativo' : 'Inativo'}</p>
                  <p><strong>Slug:</strong> {plan.slug}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlanPreviewDialog;