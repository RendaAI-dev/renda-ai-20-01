
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { registerSW } from 'virtual:pwa-register';
import { MobileAppInitializer } from './components/mobile/MobileAppInitializer';
import { preloadCriticalResources, addResourceHints, optimizeOnIdle, initPerformanceMonitoring, inlineCriticalCSS, optimizeForPerformance } from './utils/performanceOptimizer';

// Ultra-fast performance optimizations with monitoring
inlineCriticalCSS();

// Intelligent landing page preloader - minimal impact
const intelligentLandingPreloader = () => {
  const isLandingPage = window.location.pathname === '/' || window.location.pathname === '/landing';
  if (!isLandingPage) return;

  // Preload on idle, after initial render is complete
  requestIdleCallback(() => {
    // Only preload if user hasn't navigated away
    if (window.location.pathname === '/' || window.location.pathname === '/landing') {
      import('@/components/landing/LazyLandingFeatures');
      setTimeout(() => {
        import('@/components/landing/LazyLandingBenefits');
      }, 100);
    }
  }, { timeout: 2000 });
};

// Apply critical performance optimizations only
preloadCriticalResources();
addResourceHints();
optimizeForPerformance();

// Use idle time for non-critical optimizations
requestIdleCallback(() => {
  optimizeOnIdle();
  initPerformanceMonitoring();
  intelligentLandingPreloader();
}, { timeout: 1000 });

// Register service worker with reduced logging
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Novo conteúdo disponível. Atualizar?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    // Only log in development to reduce console pollution
    if (import.meta.env.DEV) {
      console.log('Aplicativo pronto para funcionar offline')
    }
  },
})

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <MobileAppInitializer />
    <App />
  </ErrorBoundary>
);
