import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface StaticLandingHeaderProps {
  companyName?: string;
  logoUrl?: string;
}

const StaticLandingHeader: React.FC<StaticLandingHeaderProps> = ({ 
  companyName = "Renda AI",
  logoUrl
}) => {
  const scrollToPlans = () => {
    const section = document.getElementById('planos');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b w-full" style={{ paddingTop: 'var(--safe-area-inset-top, 0px)' }}>
      <div className="w-full px-4 py-4 flex items-center justify-between max-w-none" style={{ 
        paddingLeft: 'max(1rem, var(--safe-area-inset-left, 0px))', 
        paddingRight: 'max(1rem, var(--safe-area-inset-right, 0px))' 
      }}>
        <div className="flex items-center space-x-3">
          {logoUrl && (
            <img 
              src={logoUrl} 
              alt={`${companyName} logo`}
              className="h-8 w-8 object-contain"
              width={32}
              height={32}
            />
          )}
          <span className="text-xl font-bold">{companyName}</span>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          <Button variant="ghost" asChild>
            <Link to="/login">Entrar</Link>
          </Button>
          <Button 
            onClick={scrollToPlans}
            className="hidden sm:inline-flex text-xs sm:text-sm md:text-base hover-scale"
            size="sm"
          >
            Estou pronto para economizar
          </Button>
          <Button 
            onClick={scrollToPlans}
            className="inline-flex sm:hidden hover-scale"
            size="sm"
          >
            Economizar
          </Button>
        </div>
      </div>
    </header>
  );
};

export default StaticLandingHeader;