
import React, { useEffect, useState, lazy, Suspense } from 'react';
import FastLandingHero from '@/components/landing/FastLandingHero';
import LandingPricing from '@/components/landing/LandingPricing';
import LandingCTA from '@/components/landing/LandingCTA';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingSkeleton from '@/components/landing/LandingSkeleton';

import { Button } from '@/components/ui/button';
import { useBrandingConfig } from '@/hooks/useBrandingConfig';
import { useBranding } from '@/contexts/BrandingContext';

import { supabase } from '@/integrations/supabase/client';

// Lazy load com preload mais agressivo
const LazyLandingFeatures = lazy(() => 
  import('@/components/landing/LazyLandingFeatures').then(module => {
    // Preload benefits enquanto features carrega
    import('@/components/landing/LazyLandingBenefits');
    return module;
  })
);
const LazyLandingBenefits = lazy(() => import('@/components/landing/LazyLandingBenefits'));

const LandingPage = () => {
  const { companyName } = useBrandingConfig();
  const { isLoading: brandingLoading } = useBranding();
  
  const [themeApplied, setThemeApplied] = useState(false);

  // Aplicação do tema assíncrona sem bloquear
  useEffect(() => {
    // Renderizar imediatamente
    setThemeApplied(true);
    
    // Aplicar tema em background
    const applyTheme = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-public-settings', {
          body: { cacheBuster: Date.now() }
        });
        
        if (!error && data?.success && data?.settings?.branding?.landing_theme) {
          const theme = data.settings.branding.landing_theme.value;
          
          if (theme && theme !== 'system') {
            const root = document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(theme);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar tema da landing:', err);
      }
    };

    applyTheme();
  }, []);

  // Nunca mostrar skeleton - sempre renderizar imediatamente
  // if (brandingLoading && !themeApplied) {
  //   return <LandingSkeleton />;
  // }
  
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-muted/20 to-background animate-fade-in">
      <LandingHeader />
      <main className="w-full">
        <FastLandingHero />
        <Suspense fallback={
          <div className="py-16 animate-fade-in">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-3 gap-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="text-center space-y-4">
                    <div className="h-16 w-16 bg-muted rounded-full animate-pulse mx-auto"></div>
                    <div className="h-6 w-32 bg-muted rounded animate-pulse mx-auto"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                      <div className="h-4 w-3/4 bg-muted rounded animate-pulse mx-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        }>
          <LazyLandingFeatures />
        </Suspense>
        <LandingPricing />
        <Suspense fallback={
          <div className="py-16 animate-fade-in">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <div className="h-8 w-48 bg-muted rounded animate-pulse"></div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                    <div className="h-4 w-5/6 bg-muted rounded animate-pulse"></div>
                    <div className="h-4 w-4/5 bg-muted rounded animate-pulse"></div>
                  </div>
                </div>
                <div className="h-64 bg-muted rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        }>
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
