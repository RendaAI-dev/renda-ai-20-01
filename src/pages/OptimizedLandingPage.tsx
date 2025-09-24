import React, { useEffect, useState, Suspense } from 'react';
import { useBrandingConfig } from '@/hooks/useBrandingConfig';
import { useBranding } from '@/contexts/BrandingContext';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import StaticLandingHeader from '@/components/landing/StaticLandingHeader';
import UltraFastHero from '@/components/landing/UltraFastHero';
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
  const { companyName, logoUrl } = useBrandingConfig();
  const { isLoading: brandingLoading } = useBranding();
  const [isReady, setIsReady] = useState(false);
  
  const {
    showPopup,
    install,
    dismissPopup,
    canInstall,
    isPrompting
  } = usePWAInstall();

  useEffect(() => {
    // Mark as ready immediately for ultra-fast render
    setIsReady(true);
  }, []);

  if (brandingLoading || !isReady) {
    return <LandingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <StaticLandingHeader companyName={companyName} logoUrl={logoUrl} />
      
      <main>
        <UltraFastHero companyName={companyName} />
        
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

    </div>
  );
};

export default OptimizedLandingPage;