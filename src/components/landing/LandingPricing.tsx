
import React from 'react';
import { useNewPlanConfig } from '@/hooks/useNewPlanConfig';
import { SimplePlanCard } from '@/components/landing/SimplePlanCard';

const LandingPricing = () => {
  const { config, isLoading, error } = useNewPlanConfig();

  const handleSelectPlan = (planId: string, priceId: string, period: string = 'monthly') => {
    window.location.href = `/register?planType=${period}&planSlug=${planId}`;
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
              <div className="flex flex-wrap justify-center gap-6 max-w-5xl mx-auto mt-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-72 h-96 bg-muted rounded-lg"></div>
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


  return (
    <section className="py-20 w-full" id="planos">
      <div className="w-full px-4">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transforme sua vida financeira com nossos planos completos
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-6 max-w-5xl mx-auto mt-12">
          {config.plans.map((plan, index) => (
            <div 
              key={plan.id} 
              className="w-72 animate-fade-in hover-scale"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <SimplePlanCard
                plan={plan}
                isPopular={plan.is_popular}
                onSelectPlan={handleSelectPlan}
              />
            </div>
          ))}
        </div>
        
        <div className="text-center mt-12 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <p className="text-sm text-muted-foreground">
            Todos os planos incluem suporte prioritário e atualizações gratuitas
          </p>
        </div>
      </div>
    </section>
  );
};

export default LandingPricing;
