import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBrandingConfig } from '@/hooks/useBrandingConfig';
import { useBranding } from '@/contexts/BrandingContext';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import OptimizedLandingHeader from '@/components/landing/OptimizedLandingHeader';
import OptimizedFastLandingHero from '@/components/landing/OptimizedFastLandingHero';
import LandingPricing from '@/components/landing/LandingPricing';
import OptimizedLandingCTA from '@/components/landing/OptimizedLandingCTA';
import LandingSkeleton from '@/components/landing/LandingSkeleton';
import OptimizedPWAInstallModal from '@/components/pwa/OptimizedPWAInstallModal';

// Lazy load non-critical components for better performance
const LazyLandingFeatures = React.lazy(() => 
  import('@/components/landing/LazyLandingFeatures').then(module => ({
    default: () => {
      // Preload benefits while features are loading
      import('@/components/landing/LazyLandingBenefits');
      return module.default();
    }
  }))
);

const LazyLandingBenefits = React.lazy(() => 
  import('@/components/landing/LazyLandingBenefits')
);

const OptimizedLandingPage = () => {
  const { companyName } = useBrandingConfig();
  const { isLoading: brandingLoading } = useBranding();
  const [themeApplied, setThemeApplied] = useState(false);
  
  const {
    showPopup,
    install,
    dismissPopup,
    canInstall,
    isPrompting
  } = usePWAInstall();

  useEffect(() => {
    // Apply theme immediately for better performance
    setThemeApplied(true);
    
    // Async theme loading without blocking render
    const loadTheme = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-public-settings');
        if (data?.landingPageTheme) {
          document.documentElement.style.setProperty('--landing-theme', data.landingPageTheme);
        }
      } catch (error) {
        console.debug('Theme loading failed:', error);
      }
    };
    
    requestIdleCallback(loadTheme);
  }, []);

  if (brandingLoading || !themeApplied) {
    return <LandingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <OptimizedLandingHeader />
      
      <main>
        <OptimizedFastLandingHero />
        
        <div id="planos">
          <LandingPricing />
        </div>
        
        <Suspense fallback={<div className="h-96 animate-pulse bg-muted/20 rounded-lg mx-4" />}>
          <LazyLandingFeatures />
        </Suspense>
        
        <Suspense fallback={<div className="h-64 animate-pulse bg-muted/20 rounded-lg mx-4" />}>
          <LazyLandingBenefits />
        </Suspense>
        
        <OptimizedLandingCTA />
      </main>
      
      <footer className="py-8 border-t bg-card/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 {companyName}. Todos os direitos reservados.</p>
        </div>
      </footer>

      <OptimizedPWAInstallModal
        isOpen={showPopup}
        onInstall={install}
        onDismiss={dismissPopup}
        isInstalling={isPrompting}
        canInstall={canInstall}
      />

      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-card p-4 rounded-lg shadow-lg border">
          <p className="text-sm mb-2">PWA Debug:</p>
          <p className="text-xs">Visible: {showPopup.toString()}</p>
          <p className="text-xs">Can Install: {canInstall.toString()}</p>
        </div>
      )}
    </div>
  );
};

export default OptimizedLandingPage;