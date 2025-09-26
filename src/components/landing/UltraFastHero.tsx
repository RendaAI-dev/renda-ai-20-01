import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Clock, Smartphone } from 'lucide-react';

interface UltraFastHeroProps {
  companyName?: string;
}

const UltraFastHero: React.FC<UltraFastHeroProps> = ({ companyName = "Renda AI" }) => {
  const scrollToPlans = () => {
    const section = document.getElementById('planos');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Transforme suas finanças com o{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {companyName}
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            A ferramenta mais completa para controlar seus gastos, organizar suas finanças e 
            conquistar sua liberdade financeira de forma simples e intuitiva.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={scrollToPlans}
              className="text-lg px-8 py-6 hover-scale group"
            >
              Estou pronto para economizar
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
          
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <div className="flex flex-col items-center space-y-3 p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Controle Total</h3>
              <p className="text-sm text-muted-foreground text-center">
                Monitore cada centavo com relatórios detalhados e análises inteligentes
              </p>
            </div>
            
            <div className="flex flex-col items-center space-y-3 p-6">
              <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="font-semibold">100% Seguro</h3>
              <p className="text-sm text-muted-foreground text-center">
                Seus dados protegidos com criptografia de ponta e backup automático
              </p>
            </div>
            
            <div className="flex flex-col items-center space-y-3 p-6">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold">Sempre Disponível</h3>
              <p className="text-sm text-muted-foreground text-center">
                Acesse de qualquer lugar, funciona offline e sincroniza automaticamente
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UltraFastHero;