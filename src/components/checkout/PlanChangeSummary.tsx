import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';

interface PlanChangeSummaryProps {
  currentPlan: { type: string; name: string; price: number };
  newPlan: { type: string; name: string; price: number };
  priceDifference: number;
  operationType: 'upgrade' | 'downgrade' | 'lateral';
}

export const PlanChangeSummary: React.FC<PlanChangeSummaryProps> = ({
  currentPlan,
  newPlan,
  priceDifference,
  operationType
}) => {
  const formatPrice = (price: number) => {
    return `R$ ${price.toFixed(2).replace('.', ',')}`;
  };

  const getOperationIcon = () => {
    switch (operationType) {
      case 'upgrade':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'downgrade':
        return <TrendingDown className="w-4 h-4 text-blue-500" />;
      default:
        return <ArrowUpDown className="w-4 h-4 text-orange-500" />;
    }
  };

  const getOperationText = () => {
    switch (operationType) {
      case 'upgrade':
        return 'Upgrade de Plano';
      case 'downgrade':
        return 'Downgrade de Plano';
      default:
        return 'Alteração de Plano';
    }
  };

  const getOperationBadge = () => {
    switch (operationType) {
      case 'upgrade':
        return <Badge className="bg-green-500">Upgrade</Badge>;
      case 'downgrade':
        return <Badge className="bg-blue-500">Downgrade</Badge>;
      default:
        return <Badge variant="secondary">Alteração</Badge>;
    }
  };

  const getPlanFeatures = (planType: string) => {
    return [
      'Controle financeiro completo',
      'Categorização automática',
      'Relatórios detalhados',
      'Metas e objetivos',
      'Alertas de gastos',
      'Suporte prioritário'
    ];
  };

  const features = getPlanFeatures(newPlan.type);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Resumo da Alteração</span>
          {getOperationBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Comparison */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="text-center flex-1">
              <h4 className="font-medium text-sm mb-1">Plano Atual</h4>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="font-semibold">{currentPlan.name}</div>
                <div className="text-primary font-bold">
                  {formatPrice(currentPlan.price)}
                </div>
                <div className="text-xs text-muted-foreground">
                  /{currentPlan.type === 'monthly' ? 'mês' : 'ano'}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <ArrowRight className="w-5 h-5 text-primary mb-1" />
              {getOperationIcon()}
            </div>
            
            <div className="text-center flex-1">
              <h4 className="font-medium text-sm mb-1">Novo Plano</h4>
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="font-semibold">{newPlan.name}</div>
                <div className="text-primary font-bold">
                  {formatPrice(newPlan.price)}
                </div>
                <div className="text-xs text-muted-foreground">
                  /{newPlan.type === 'monthly' ? 'mês' : 'ano'}
                </div>
              </div>
            </div>
          </div>

          {/* Price Difference */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium">{getOperationText()}</span>
              <div className={`font-bold ${
                priceDifference > 0 ? 'text-green-600' : 
                priceDifference < 0 ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {priceDifference > 0 ? '+' : ''}{formatPrice(priceDifference)}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              {operationType === 'upgrade' 
                ? 'Diferença será cobrada imediatamente' 
                : operationType === 'downgrade'
                ? 'Crédito será aplicado na próxima fatura'
                : 'Novo valor será aplicado na próxima cobrança'
              }
            </p>
          </div>
        </div>

        {/* New Plan Features */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Incluído no {newPlan.name}:</h4>
          <ul className="space-y-1">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-green-500">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Operation Details */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 <strong>Como funciona:</strong> Sua assinatura atual será cancelada e 
            uma nova será criada com o plano selecionado. Você terá um histórico limpo 
            e controle total sobre a nova assinatura.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};