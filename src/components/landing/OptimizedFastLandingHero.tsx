import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { TrendingUp, Shield, Smartphone } from 'lucide-react';
import { useBrandingConfig } from '@/hooks/useBrandingConfig';

const OptimizedFastLandingHero = () => {
  const { companyName } = useBrandingConfig();
  
  const scrollToPlans = useCallback(() => {
    const section = document.getElementById('planos');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <section className="flex flex-col items-center justify-center text-center py-12 md:py-20 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Transforme suas finanças com{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {companyName}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-slide-up">
            A solução completa para você conquistar sua liberdade financeira. 
            Controle total, segurança máxima e resultados reais.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-scale-in">
          <Button 
            size="lg" 
            onClick={scrollToPlans}
            className="text-lg px-8 py-6 hover-scale"
          >
            Estou pronto para economizar
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            asChild
            className="text-lg px-8 py-6 hover-scale"
          >
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 animate-fade-in">
          <div className="flex flex-col items-center space-y-3 p-6 rounded-xl bg-card hover-card">
            <div className="p-3 rounded-full bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Controle Total</h3>
            <p className="text-sm text-muted-foreground text-center">
              Acompanhe cada centavo com precisão e inteligência
            </p>
          </div>

          <div className="flex flex-col items-center space-y-3 p-6 rounded-xl bg-card hover-card">
            <div className="p-3 rounded-full bg-secondary/10">
              <Shield className="h-6 w-6 text-secondary" />
            </div>
            <h3 className="font-semibold text-lg">100% Seguro</h3>
            <p className="text-sm text-muted-foreground text-center">
              Seus dados protegidos com criptografia de ponta
            </p>
          </div>

          <div className="flex flex-col items-center space-y-3 p-6 rounded-xl bg-card hover-card">
            <div className="p-3 rounded-full bg-accent/10">
              <Smartphone className="h-6 w-6 text-accent" />
            </div>
            <h3 className="font-semibold text-lg">Sempre Disponível</h3>
            <p className="text-sm text-muted-foreground text-center">
              Acesse suas finanças de qualquer lugar, a qualquer hora
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OptimizedFastLandingHero;