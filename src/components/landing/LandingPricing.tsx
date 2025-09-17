
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useNewPlanConfig } from '@/hooks/useNewPlanConfig';
import { PeriodSelector } from '@/components/common/PeriodSelector';
import { PeriodPricingCard } from '@/components/landing/PeriodPricingCard';
import { PlanPeriod } from '@/utils/planPeriodUtils';

const LandingPricing = () => {
  const { config, isLoading, error } = useNewPlanConfig();
  const [selectedPeriod, setSelectedPeriod] = useState<PlanPeriod>('annual');

  const handleSelectPlan = (planId: string, priceId: string) => {
    window.location.href = `/register?priceId=${priceId}&planType=${selectedPeriod}&planSlug=${planId}`;
  };

  // Sempre mostrar o conteúdo, mesmo durante loading
  if (isLoading && !config) {
    return (
      <section className="py-20 w-full" id="planos">
        <div className="w-full px-4">
          <div className="text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-64 mx-auto"></div>
              <div className="h-4 bg-muted rounded w-96 mx-auto"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mt-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-96 bg-muted rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Se houve erro mas temos config (fallback), continue normalmente
  if (!config) {
    return (
      <section className="py-20 w-full" id="planos">
        <div className="w-full px-4">
          <div className="text-center text-muted-foreground">
            Planos temporariamente indisponíveis. Tente novamente em alguns instantes.
          </div>
        </div>
      </section>
    );
  }

  // Pegar o primeiro plano para calcular o preço base para o seletor
  const basePlan = config.plans[0];
  const monthlyPrice = basePlan?.pricing?.monthly ? 
    parseFloat(basePlan.pricing.monthly.display.replace('R$ ', '').replace(',', '.')) : 29.90;

  return (
    <section className="py-20 w-full" id="planos">
      <div className="w-full px-4">
        <motion.div 
          className="text-center mb-16" 
          initial={{ opacity: 0, y: 20 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6 }} 
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Transforme sua vida financeira com nossos planos completos
          </p>
          
          {/* Seletor de Período */}
          <div className="mb-8">
            <PeriodSelector
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              monthlyPrice={monthlyPrice}
              className="justify-center"
            />
          </div>
        </motion.div>
        
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto" 
          initial={{ opacity: 0, y: 40 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6, staggerChildren: 0.1 }} 
          viewport={{ once: true }}
        >
          {config.plans.map((plan, index) => (
            <motion.div 
              key={`${plan.id}-${selectedPeriod}`} 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.6, delay: index * 0.1 }} 
              viewport={{ once: true }}
            >
              <PeriodPricingCard
                plan={plan}
                period={selectedPeriod}
                isPopular={selectedPeriod === 'quarterly'}
                onSelectPlan={handleSelectPlan}
              />
            </motion.div>
          ))}
        </motion.div>
        
        <motion.div 
          className="text-center mt-12"
          initial={{ opacity: 0 }} 
          whileInView={{ opacity: 1 }} 
          transition={{ duration: 0.6, delay: 0.3 }} 
          viewport={{ once: true }}
        >
          <p className="text-sm text-muted-foreground">
            Todos os planos incluem suporte prioritário e atualizações gratuitas
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingPricing;
