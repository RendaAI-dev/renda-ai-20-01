// Performance optimization utilities

// Intersection Observer for lazy loading
export const createIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) => {
  const defaultOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
  };

  return new IntersectionObserver(callback, { ...defaultOptions, ...options });
};

// Debounce function for performance
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

// Throttle function for scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Ultra-fast critical resource preloader
export const preloadCriticalResources = () => {
  const fragment = document.createDocumentFragment();
  const addLink = (attrs: Record<string, string>) => {
    const link = document.createElement('link');
    Object.assign(link, attrs);
    fragment.appendChild(link);
  };

  // Optimized font preloading - using Google Fonts CSS API instead of direct woff2
  // This prevents 404 errors and ensures correct font loading
  if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
    addLink({
      rel: 'preload',
      as: 'style',
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
    });
  }

  // Only preload essential resources to avoid unused preloads
  // Critical CSS is already inlined in index.html, no need to preload again
  
  // Essential modules with conditional modulepreload
  const currentPath = window.location.pathname;
  if (currentPath === '/' || currentPath === '') {
    addLink({ rel: 'modulepreload', href: '/src/main.tsx' });
  }

  // Batch append for performance
  requestAnimationFrame(() => document.head.appendChild(fragment));
};

// Advanced resource hints with performance boost
export const addResourceHints = () => {
  const fragment = document.createDocumentFragment();
  const addLink = (attrs: Record<string, string>) => {
    const link = document.createElement('link');
    Object.assign(link, attrs);
    fragment.appendChild(link);
  };

  // Critical domains with preconnect + dns-prefetch
  const criticalDomains = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://yazmxlgfraauuhmsnysh.supabase.co'
  ];

  criticalDomains.forEach(domain => {
    addLink({ rel: 'dns-prefetch', href: domain });
    // Preconnect for high-priority domains
    if (domain.includes('supabase') || domain.includes('fonts.gstatic')) {
      addLink({ rel: 'preconnect', href: domain, crossOrigin: 'anonymous' });
    }
  });

  // Performance-optimized viewport if missing
  if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width,initial-scale=1,viewport-fit=cover';
    fragment.appendChild(viewport);
  }

  // Theme color for PWA performance
  if (!document.querySelector('meta[name="theme-color"]')) {
    const themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    themeColor.content = '#2C6E7F';
    fragment.appendChild(themeColor);
  }

  document.head.appendChild(fragment);
};

// Ultra-fast performance optimization
export const optimizeForPerformance = () => {
  // Use passive event listeners for better scroll performance
  const addPassiveListener = (element: Element, event: string) => {
    element.addEventListener(event, null as any, { passive: true });
  };

  // Optimize scroll containers
  document.querySelectorAll('[data-scroll]').forEach(element => {
    addPassiveListener(element, 'scroll');
    addPassiveListener(element, 'touchmove');
  });

  // Optimize animated elements with GPU acceleration
  const animatedElements = document.querySelectorAll('[class*="animate-"], .transition-');
  animatedElements.forEach(element => {
    const el = element as HTMLElement;
    el.style.willChange = 'transform, opacity';
    el.style.transform = 'translate3d(0, 0, 0)'; // Force GPU layer
  });

  // Preload critical images with high priority
  document.querySelectorAll('img[data-critical]').forEach(img => {
    (img as HTMLImageElement).loading = 'eager';
    (img as HTMLImageElement).fetchPriority = 'high';
  });
};

// Clean up will-change after animations with performance optimization
export const cleanupPerformanceOptimizations = () => {
  requestIdleCallback(() => {
    const animatedElements = document.querySelectorAll('[style*="will-change"]');
    animatedElements.forEach(element => {
      (element as HTMLElement).style.willChange = 'auto';
    });
  });
};

// Advanced idle-time optimization
export const optimizeOnIdle = () => {
  requestIdleCallback(() => {
    // Preload non-critical components
    import('@/components/landing/LazyLandingBenefits');
    import('@/components/dashboard/DashboardContent');
  });
};

// Performance monitoring and metrics - optimized for production
export const initPerformanceMonitoring = () => {
  // Only monitor in development to reduce console pollution
  if (import.meta.env.DEV && 'PerformanceObserver' in window) {
    // Web Vitals monitoring with reduced logging
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        // Only log if performance is concerning
        if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint' && entry.startTime > 1000) {
          console.warn(`FCP slow: ${entry.startTime.toFixed(0)}ms`);
        }
        if (entry.entryType === 'largest-contentful-paint' && entry.startTime > 2500) {
          console.warn(`LCP slow: ${entry.startTime.toFixed(0)}ms`);
        }
      });
    });
    
    observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
    
    // Measure loading performance - only warn if slow
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const totalTime = navigation.loadEventEnd - navigation.fetchStart;
      if (totalTime > 3000) {
        console.warn(`Page load slow: ${totalTime}ms`);
      }
    });
  }
};

// Critical path optimization - inline CSS and preload images
export const inlineCriticalCSS = () => {
  // Inline only the most critical styles to prevent FOUC
  const criticalStyles = `
    body { font-family: Inter, sans-serif; margin: 0; }
    .animate-fade-in { animation: fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) both; }
    @keyframes fadeIn { from { opacity: 0; transform: translate3d(0, 5px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
  `;
  
  const style = document.createElement('style');
  style.textContent = criticalStyles;
  document.head.insertBefore(style, document.head.firstChild);
};