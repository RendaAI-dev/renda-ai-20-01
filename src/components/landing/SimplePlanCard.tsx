import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { PlanFamily } from '@/hooks/useNewPlanConfig';

interface SimplePlanCardProps {
  plan: PlanFamily;
  isPopular?: boolean;
  onSelectPlan: (planId: string, priceId: string, period: string) => void;
}

export const SimplePlanCard: React.FC<SimplePlanCardProps> = ({
  plan,
  isPopular = false,
  onSelectPlan
}) => {
  // Use first available pricing (monthly > annual > semiannual > quarterly)
  const pricing = plan.pricing.monthly || plan.pricing.annual || plan.pricing.semiannual || plan.pricing.quarterly;
  const period = plan.pricing.monthly ? 'monthly' : 
                 plan.pricing.annual ? 'annual' : 
                 plan.pricing.semiannual ? 'semiannual' : 'quarterly';
  
  if (!pricing) return null;

  return (
    <Card className={`relative transition-all duration-300 hover:shadow-lg ${isPopular ? 'border-primary ring-2 ring-primary' : ''}`}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
          Mais Popular
        </Badge>
      )}
      
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        
        <div className="space-y-2">
          <div className="text-3xl font-bold text-primary">
            {pricing.display}
          </div>
          <p className="text-sm text-muted-foreground">
            {period === 'monthly' ? 'por mês' : 
             period === 'annual' ? 'por ano' : 
             period === 'semiannual' ? 'por semestre' : 
             'por trimestre'}
          </p>
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
          onClick={() => onSelectPlan(plan.id, pricing.priceId, period)}
          variant={isPopular ? "default" : "outline"}
        >
          Escolher Plano
        </Button>
      </CardContent>
    </Card>
  );
};