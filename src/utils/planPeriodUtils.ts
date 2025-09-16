export type PlanPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface PeriodInfo {
  key: PlanPeriod;
  label: string;
  shortLabel: string;
  months: number;
  discountMultiplier: number;
}

export const PLAN_PERIODS: Record<PlanPeriod, PeriodInfo> = {
  monthly: {
    key: 'monthly',
    label: 'Mensal',
    shortLabel: 'Mês',
    months: 1,
    discountMultiplier: 1.0
  },
  quarterly: {
    key: 'quarterly',
    label: 'Trimestral',
    shortLabel: '3 Meses',
    months: 3,
    discountMultiplier: 0.98 // 2% desconto
  },
  semiannual: {
    key: 'semiannual',
    label: 'Semestral',
    shortLabel: '6 Meses',
    months: 6,
    discountMultiplier: 0.95 // 5% desconto
  },
  annual: {
    key: 'annual',
    label: 'Anual',
    shortLabel: '12 Meses',
    months: 12,
    discountMultiplier: 0.82 // 18% desconto
  }
};

export function isValidPeriod(period: string): period is PlanPeriod {
  return period in PLAN_PERIODS;
}

export function getPeriodInfo(period: PlanPeriod): PeriodInfo {
  return PLAN_PERIODS[period];
}

export function calculatePeriodPrice(monthlyPrice: number, period: PlanPeriod): number {
  const periodInfo = getPeriodInfo(period);
  return monthlyPrice * periodInfo.months * periodInfo.discountMultiplier;
}

export function calculateDiscount(monthlyPrice: number, period: PlanPeriod): number {
  if (period === 'monthly') return 0;
  
  const normalPrice = monthlyPrice * PLAN_PERIODS[period].months;
  const discountedPrice = calculatePeriodPrice(monthlyPrice, period);
  
  return Math.round(((normalPrice - discountedPrice) / normalPrice) * 100);
}

export function formatPrice(price: number): string {
  return `R$ ${price.toFixed(2).replace('.', ',')}`;
}

export function getPlanPeriodFromPriceId(priceId: string, planConfig: any): PlanPeriod | null {
  if (!planConfig?.prices) return null;
  
  const periods: PlanPeriod[] = ['monthly', 'quarterly', 'semiannual', 'annual'];
  
  for (const period of periods) {
    if (planConfig.prices[period]?.priceId === priceId) {
      return period;
    }
  }
  
  return null;
}

export function getBestValuePeriod(): PlanPeriod {
  return 'annual'; // Maior desconto
}

export function getMostPopularPeriod(): PlanPeriod {
  return 'quarterly'; // Equilíbrio entre desconto e compromisso
}