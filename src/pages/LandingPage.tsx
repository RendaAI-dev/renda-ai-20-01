
import React, { useEffect, useState, lazy, Suspense } from 'react';
import OptimizedLandingHero from '@/components/landing/OptimizedLandingHero';
import LandingPricing from '@/components/landing/LandingPricing';
import LandingCTA from '@/components/landing/LandingCTA';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingSkeleton from '@/components/landing/LandingSkeleton';
import PWAInstallModal from '@/components/pwa/PWAInstallModal';
import { Button } from '@/components/ui/button';
import { useBrandingConfig } from '@/hooks/useBrandingConfig';
import { useBranding } from '@/contexts/BrandingContext';
import { usePWAInstall } from '@/hooks/usePWAInstall';
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
  const pwa = usePWAInstall();
  const [themeApplied, setThemeApplied] = useState(false);

  // Otimizar aplicação do tema - não bloquear o render inicial
  useEffect(() => {
    const applyThemeAsync = async () => {
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
      } finally {
        setThemeApplied(true);
      }
    };

    // Precarregar recursos críticos
    const link1 = document.createElement('link');
    link1.rel = 'preload';
    link1.href = '/src/components/landing/OptimizedLandingHero.tsx';
    link1.as = 'script';
    document.head.appendChild(link1);

    const link2 = document.createElement('link');
    link2.rel = 'preload';
    link2.href = '/src/components/landing/LandingPricing.tsx';
    link2.as = 'script';
    document.head.appendChild(link2);

    // Não esperar o tema para mostrar o conteúdo
    setThemeApplied(true);
    applyThemeAsync();
  }, []);

  // Mostrar conteúdo imediatamente com skeleton se necessário
  if (brandingLoading && !themeApplied) {
    return <LandingSkeleton />;
  }
  
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-muted/20 to-background animate-fade-in">
      <LandingHeader />
      <main className="w-full">
        <OptimizedLandingHero />
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
      
      {/* PWA Install Modal */}
      <PWAInstallModal
        isOpen={pwa.showPopup}
        onInstall={pwa.install}
        onDismiss={pwa.dismissPopup}
        isInstalling={pwa.isPrompting}
        canInstall={pwa.canInstall}
      />
      
      {/* Debug panel for development - simplified */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 bg-muted p-4 rounded-lg shadow-lg text-xs z-[60]">
          <div>PWA Debug:</div>
          <div>Mobile: {pwa.isMobile ? 'Yes' : 'No'}</div>
          <div>Can Install: {pwa.canInstall ? 'Yes' : 'No'}</div>
          <div>Installed: {pwa.isInstalled ? 'Yes' : 'No'}</div>
          <div>Show Popup: {pwa.showPopup ? 'Yes' : 'No'}</div>
          <div className="mt-2 space-x-2">
            <Button size="sm" onClick={pwa.forceShowPopup}>
              Force Popup
            </Button>
            <Button size="sm" onClick={pwa.resetPreferences} variant="outline">
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
