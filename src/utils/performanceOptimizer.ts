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

// Critical resource preloader - otimizado para landing
export const preloadCriticalResources = () => {
  // Preload critical fonts mais agressivo
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.as = 'font';
  fontLink.type = 'font/woff2';
  fontLink.crossOrigin = 'anonymous';
  fontLink.href = 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2';
  document.head.appendChild(fontLink);

  // Preload CSS crítico
  const cssLink = document.createElement('link');
  cssLink.rel = 'preload';
  cssLink.as = 'style';
  cssLink.href = '/src/index.css';
  document.head.appendChild(cssLink);

  // Preload módulos JavaScript críticos
  const scriptLink = document.createElement('link');
  scriptLink.rel = 'modulepreload';
  scriptLink.href = '/src/main.tsx';
  document.head.appendChild(scriptLink);
};

// Resource hints para otimizar ainda mais
export const addResourceHints = () => {
  const domains = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://yazmxlgfraauuhmsnysh.supabase.co'
  ];

  domains.forEach(domain => {
    // DNS prefetch
    const dnsLink = document.createElement('link');
    dnsLink.rel = 'dns-prefetch';
    dnsLink.href = domain;
    document.head.appendChild(dnsLink);

    // Preconnect para domínios críticos
    if (domain.includes('supabase')) {
      const preconnectLink = document.createElement('link');
      preconnectLink.rel = 'preconnect';
      preconnectLink.href = domain;
      document.head.appendChild(preconnectLink);
    }
  });

  // Adicionar viewport meta se não existir
  if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(viewport);
  }
};

// Optimize animations to use transform and opacity only
export const optimizeForPerformance = () => {
  // Add will-change to elements that will animate
  const animatedElements = document.querySelectorAll('[class*="animate-"]');
  animatedElements.forEach(element => {
    (element as HTMLElement).style.willChange = 'transform, opacity';
  });
};

// Clean up will-change after animations
export const cleanupPerformanceOptimizations = () => {
  const animatedElements = document.querySelectorAll('[class*="animate-"]');
  animatedElements.forEach(element => {
    (element as HTMLElement).style.willChange = 'auto';
  });
};