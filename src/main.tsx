
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { registerSW } from 'virtual:pwa-register';
import { MobileAppInitializer } from './components/mobile/MobileAppInitializer';
import { preloadCriticalResources, addResourceHints, optimizeOnIdle, initPerformanceMonitoring, inlineCriticalCSS } from './utils/performanceOptimizer';

// Ultra-fast performance optimizations with monitoring
inlineCriticalCSS();
preloadCriticalResources();
addResourceHints();

// Initialize performance monitoring in development
if (import.meta.env.DEV) {
  initPerformanceMonitoring();
}

// Optimized landing page preloader with conditional loading
const optimizedLandingPreloader = () => {
  const isLandingPage = window.location.pathname === '/' || window.location.pathname === '';
  
  if (isLandingPage) {
    // Only preload components that will be immediately visible
    import('@/components/landing/OptimizedFastLandingHero');
    import('@/components/landing/OptimizedLandingHeader');
    
    // Defer non-critical components to avoid unused preloads
    requestIdleCallback(() => {
      import('@/components/landing/LandingPricing');
    }, { timeout: 2000 });
    
    // Background preload only after user interaction
    const preloadRemaining = () => {
      import('@/components/landing/LazyLandingFeatures');
      import('@/components/landing/OptimizedLandingCTA');
      import('@/components/landing/LazyLandingBenefits');
    };
    
    // Preload on first user interaction or after 3 seconds
    ['scroll', 'click', 'touchstart'].forEach(event => {
      window.addEventListener(event, preloadRemaining, { once: true, passive: true });
    });
    setTimeout(preloadRemaining, 3000);
  }
};

// Execute optimizations
optimizedLandingPreloader();
optimizeOnIdle();

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
