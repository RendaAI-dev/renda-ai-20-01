import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const OptimizedLandingCTA = () => {
  const scrollToPlans = useCallback(() => {
    const section = document.getElementById('planos');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4 text-center animate-fade-in">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold">
            Pronto para transformar suas{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              finanças?
            </span>
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Junte-se a milhares de pessoas que já conquistaram sua liberdade financeira. 
            Comece hoje mesmo!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-scale-in">
            <Button 
              size="lg" 
              onClick={scrollToPlans}
              className="text-lg px-8 py-6 hover-scale group"
            >
              Começar agora
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
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
        </div>
      </div>
    </section>
  );
};

export default OptimizedLandingCTA;