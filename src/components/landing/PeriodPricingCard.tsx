import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { Plan } from '@/hooks/useNewPlanConfig';
import { PlanPeriod, PLAN_PERIODS } from '@/utils/planPeriodUtils';

interface PeriodPricingCardProps {
  plan: Plan;
  period: PlanPeriod;
  isPopular?: boolean;
  onSelectPlan: (planId: string, priceId: string) => void;
}

export const PeriodPricingCard: React.FC<PeriodPricingCardProps> = ({
  plan,
  period,
  isPopular = false,
  onSelectPlan
}) => {
  const periodInfo = PLAN_PERIODS[period];
  const pricing = plan.pricing[period];
  
  if (!pricing) return null;

  return (
    <Card className={`relative ${isPopular ? 'border-primary ring-1 ring-primary' : ''}`}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
          Mais Popular
        </Badge>
      )}
      
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{periodInfo.label}</p>
        
        <div className="space-y-2 relative">
          {period === 'annual' && (
            <Badge 
              className="absolute -top-2 -left-2 text-xs bg-primary text-primary-foreground"
              variant="default"
            >
              Melhor Valor
            </Badge>
          )}
          
          {period === 'quarterly' && (
            <Badge 
              className="absolute -top-2 -right-2 text-xs bg-secondary text-secondary-foreground"
              variant="secondary"
            >
              Popular
            </Badge>
          )}
          
          <div className="text-3xl font-bold text-primary">
            {pricing.display}
          </div>
          <p className="text-sm text-muted-foreground">
            por {periodInfo.shortLabel.toLowerCase()}
          </p>
          
          {pricing.discount && pricing.discount !== '0%' && (
            <div className="space-y-1">
              <p className="text-sm line-through text-muted-foreground">
                {pricing.originalPrice}
              </p>
              <Badge variant="secondary" className="bg-accent text-accent-foreground">
                {pricing.savings}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {plan.description && (
          <p className="text-sm text-muted-foreground text-center">
            {plan.description}
          </p>
        )}
        
        <ul className="space-y-3">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
        
        {plan.limitations && plan.limitations.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Limitações:</p>
            <ul className="space-y-1">
              {plan.limitations.map((limitation, index) => (
                <li key={index} className="text-xs text-muted-foreground">
                  • {limitation}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <Button 
          className="w-full mt-6" 
          onClick={() => onSelectPlan(plan.id, pricing.priceId)}
          variant={isPopular ? "default" : "outline"}
        >
          Escolher {periodInfo.label}
        </Button>
      </CardContent>
    </Card>
  );
};