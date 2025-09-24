
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { MobileAppInitializer } from './components/mobile/MobileAppInitializer'
import { preloadCriticalResources, addResourceHints } from './utils/performanceOptimizer'

// Performance optimizations - mais agressivo
preloadCriticalResources();
addResourceHints();

// Preload componentes críticos da landing
const landingPreloader = () => {
  // Preload hero component
  import('@/components/landing/OptimizedLandingHero');
  // Preload pricing após 100ms
  setTimeout(() => import('@/components/landing/LandingPricing'), 100);
  // Preload features após 200ms
  setTimeout(() => import('@/components/landing/LazyLandingFeatures'), 200);
};

// Iniciar preload se for landing page
if (window.location.pathname === '/' || window.location.pathname === '') {
  landingPreloader();
}

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Novo conteúdo disponível. Atualizar?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('Aplicativo pronto para funcionar offline')
  },
})

createRoot(document.getElementById("root")!).render(
  <>
    <MobileAppInitializer />
    <App />
  </>
);
