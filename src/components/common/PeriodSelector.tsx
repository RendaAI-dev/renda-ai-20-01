import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlanPeriod, PLAN_PERIODS, calculateDiscount } from '@/utils/planPeriodUtils';

interface PeriodSelectorProps {
  selectedPeriod: PlanPeriod;
  onPeriodChange: (period: PlanPeriod) => void;
  monthlyPrice: number;
  className?: string;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriod,
  onPeriodChange,
  monthlyPrice,
  className = ''
}) => {
  const periods: PlanPeriod[] = ['monthly', 'quarterly', 'semiannual', 'annual'];

  return (
    <div className={`flex flex-wrap gap-2 justify-center ${className}`}>
      {periods.map((period) => {
        const periodInfo = PLAN_PERIODS[period];
        const discount = calculateDiscount(monthlyPrice, period);
        const isSelected = selectedPeriod === period;
        
        return (
          <Button
            key={period}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onPeriodChange(period)}
            className="relative"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium">{periodInfo.label}</span>
              <span className="text-xs opacity-75">{periodInfo.shortLabel}</span>
            </div>
            
            {discount > 0 && (
              <Badge 
                className="absolute -top-2 -right-2 text-xs bg-accent text-accent-foreground"
                variant="secondary"
              >
                -{discount}%
              </Badge>
            )}
            
            {period === 'annual' && (
              <Badge 
                className="absolute -top-2 -left-2 text-xs bg-primary text-primary-foreground"
                variant="default"
              >
                Popular
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
};