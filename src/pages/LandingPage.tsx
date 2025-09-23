
import React, { useEffect, useState, lazy, Suspense } from 'react';
import OptimizedLandingHero from '@/components/landing/OptimizedLandingHero';
import LandingPricing from '@/components/landing/LandingPricing';
import LandingCTA from '@/components/landing/LandingCTA';
import LandingHeader from '@/components/landing/LandingHeader';
import { useBrandingConfig } from '@/hooks/useBrandingConfig';
import { useBranding } from '@/contexts/BrandingContext';
import { supabase } from '@/integrations/supabase/client';

// Lazy load heavy components
const LazyLandingFeatures = lazy(() => import('@/components/landing/LazyLandingFeatures'));
const LazyLandingBenefits = lazy(() => import('@/components/landing/LazyLandingBenefits'));

const LandingPage = () => {
  const { companyName } = useBrandingConfig();
  const { isLoading: brandingLoading, lastUpdated } = useBranding();
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const [forcedTheme, setForcedTheme] = useState<string | null>(null);

  // Aplicar tema antes mesmo do primeiro render
  useEffect(() => {
    const loadAndApplyLandingTheme = async () => {
      try {
        console.log('Carregando tema da landing page...');
        const { data, error } = await supabase.functions.invoke('get-public-settings', {
          body: { cacheBuster: Date.now() } // Cache-busting para o tema
        });
        
        if (!error && data?.success && data?.settings?.branding?.landing_theme) {
          const theme = data.settings.branding.landing_theme.value;
          setForcedTheme(theme);
          
          if (theme && theme !== 'system') {
            // Aplicar o tema imediatamente
            const root = document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(theme);
            console.log('Tema aplicado:', theme);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar tema da landing:', err);
      } finally {
        setIsThemeLoaded(true);
      }
    };

    loadAndApplyLandingTheme();
    
    // Cleanup: restaurar tema do sistema quando sair da landing
    return () => {
      if (forcedTheme && forcedTheme !== 'system') {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        
        // Detectar preferência do sistema e aplicar
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        const savedTheme = localStorage.getItem("metacash-ui-theme");
        
        if (savedTheme === "system" || !savedTheme) {
          root.classList.add(systemTheme);
        } else {
          root.classList.add(savedTheme);
        }
      }
    };
  }, [lastUpdated]); // Reagir a mudanças no branding

  // Mostrar um loading mínimo enquanto carrega o tema para evitar flash
  if (!isThemeLoaded || brandingLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-muted/20 to-background">
      <LandingHeader />
      <main className="w-full">
        <OptimizedLandingHero />
        <Suspense fallback={<div className="h-96 w-full animate-pulse bg-muted/30"></div>}>
          <LazyLandingFeatures />
        </Suspense>
        <LandingPricing />
        <Suspense fallback={<div className="h-96 w-full animate-pulse bg-muted/30"></div>}>
          <LazyLandingBenefits />
        </Suspense>
        <LandingCTA />
      </main>
      
      {/* Footer */}
      <footer className="bg-card/50 border-t py-8 w-full">
        <div className="w-full px-4 text-center text-muted-foreground">
          <p className="max-w-6xl mx-auto">&copy; 2025 {companyName} - Transforme sua vida financeira</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
