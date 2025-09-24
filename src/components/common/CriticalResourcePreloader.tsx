import { useEffect } from 'react';
import { logPerf } from '@/utils/consoleOptimizer';

export const CriticalResourcePreloader = () => {
  useEffect(() => {
    // Preload critical Supabase resources
    const preloadSupabase = () => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = '//yazmxlgfraauuhmsnysh.supabase.co';
      document.head.appendChild(link);
      logPerf('Preloaded Supabase DNS');
    };

    // Preload critical dashboard components on idle
    const preloadDashboard = () => {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          import('@/components/dashboard/DashboardContent').then(() => {
            logPerf('Dashboard content preloaded');
          });
        }, { timeout: 2000 });
      } else {
        setTimeout(() => {
          import('@/components/dashboard/DashboardContent');
        }, 1000);
      }
    };

    // Only preload if user is authenticated or on dashboard route
    const currentPath = window.location.pathname;
    const shouldPreload = currentPath === '/' || currentPath.includes('dashboard');

    if (shouldPreload) {
      preloadSupabase();
      preloadDashboard();
    }

  }, []);

  return null;
};