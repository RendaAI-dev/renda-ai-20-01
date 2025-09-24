
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

// Advanced landing page preloader with performance optimization
const ultraFastLandingPreloader = () => {
  const isLandingPage = window.location.pathname === '/' || window.location.pathname === '';
  
  if (isLandingPage) {
    // Immediate critical components
    Promise.all([
      import('@/components/landing/OptimizedFastLandingHero'),
      import('@/components/landing/OptimizedLandingHeader')
    ]);
    
    // Staggered non-critical components
    requestIdleCallback(() => {
      import('@/components/landing/LandingPricing');
    });
    
    setTimeout(() => {
      import('@/components/landing/LazyLandingFeatures');
      import('@/components/landing/OptimizedLandingCTA');
    }, 150);
    
    // Background preload for next likely components
    setTimeout(() => {
      import('@/components/landing/LazyLandingBenefits');
    }, 300);
  }
};

// Execute optimizations
ultraFastLandingPreloader();
optimizeOnIdle();

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
  <ErrorBoundary>
    <MobileAppInitializer />
    <App />
  </ErrorBoundary>
);
