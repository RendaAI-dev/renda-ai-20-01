import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PlanSummaryProps {
  planName: string;
  planType: 'monthly' | 'annual';
  planPrice: number;
  isUpgrade?: boolean;
}

export const PlanSummary: React.FC<PlanSummaryProps> = ({
  planName,
  planType,
  planPrice,
  isUpgrade = false
}) => {
  const formatPrice = (price: number) => {
    return `R$ ${price.toFixed(2).replace('.', ',')}`;
  };

  const getPlanFeatures = () => {
    return [
      'Controle financeiro completo',
      'Categorização automática',
      'Relatórios detalhados',
      'Metas e objetivos',
      'Alertas de gastos',
      'Suporte prioritário'
    ];
  };

  const getDiscountPercentage = () => {
    if (planType === 'annual') {
      const monthlyEquivalent = planPrice / 12;
      const monthlyPrice = 49.90;
      const discount = Math.round(((monthlyPrice - monthlyEquivalent) / monthlyPrice) * 100);
      return discount;
    }
    return 0;
  };

  const features = getPlanFeatures();
  const discount = getDiscountPercentage();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Resumo do Plano</span>
          {isUpgrade && (
            <Badge variant="secondary">
              Upgrade
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold text-lg">{planName}</h3>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-2xl font-bold text-primary">
              {formatPrice(planPrice)}
            </span>
            <span className="text-sm text-muted-foreground">
              /{planType === 'monthly' ? 'mês' : 'ano'}
            </span>
          </div>
          
          {planType === 'annual' && discount > 0 && (
            <div className="mt-2">
              <Badge variant="default" className="bg-green-500">
                {discount}% de desconto
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                Economize {formatPrice((49.90 * 12) - planPrice)} por ano
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-sm">Incluído no plano:</h4>
          <ul className="space-y-1">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-green-500">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {planType === 'annual' && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>Plano Anual:</strong> Pague uma vez e use o ano todo! 
              Sem preocupações com cobrança mensal.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};