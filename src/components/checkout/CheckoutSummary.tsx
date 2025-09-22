import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CheckoutSummaryProps {
  planPrice: number;
  planType: 'monthly' | 'annual';
}

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({
  planPrice,
  planType
}) => {
  const formatPrice = (price: number) => {
    return `R$ ${price.toFixed(2).replace('.', ',')}`;
  };

  const getSavings = () => {
    if (planType === 'annual') {
      const monthlyEquivalent = 49.90 * 12;
      const savings = monthlyEquivalent - planPrice;
      return savings;
    }
    return 0;
  };

  const savings = getSavings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo do Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">Plano {planType === 'monthly' ? 'Mensal' : 'Anual'}</span>
            <span className="font-medium">{formatPrice(planPrice)}</span>
          </div>
          
          {savings > 0 && (
            <div className="flex justify-between items-center text-green-600">
              <span className="text-sm">Economia anual</span>
              <span className="font-medium">-{formatPrice(savings)}</span>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatPrice(planPrice)}</span>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            {planType === 'monthly' 
              ? 'Cobrança recorrente mensal' 
              : 'Pagamento único anual'
            }
          </p>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h4 className="font-medium text-sm">Formas de pagamento aceitas:</h4>
          <div className="flex gap-2">
            <div className="px-2 py-1 bg-muted rounded text-xs">Visa</div>
            <div className="px-2 py-1 bg-muted rounded text-xs">Mastercard</div>
            <div className="px-2 py-1 bg-muted rounded text-xs">Amex</div>
          </div>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            🔒 <strong>Pagamento seguro:</strong> Seus dados são criptografados e processados 
            com a mais alta segurança. Não armazenamos dados do cartão.
          </p>
        </div>

        {planType === 'annual' && (
          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-700 dark:text-green-300">
              ⭐ <strong>Melhor opção!</strong> Economize {formatPrice(savings)} 
              escolhendo o plano anual. Sem cobrança mensal!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};