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

// Critical resource preloader
export const preloadCriticalResources = () => {
  // Preload critical fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.as = 'font';
  fontLink.type = 'font/woff2';
  fontLink.crossOrigin = 'anonymous';
  fontLink.href = 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2';
  document.head.appendChild(fontLink);

  // Preload critical images
  const heroImageLink = document.createElement('link');
  heroImageLink.rel = 'preload';
  heroImageLink.as = 'image';
  heroImageLink.href = '/hero-background.jpg';
  document.head.appendChild(heroImageLink);
};

// Resource hints for external domains
export const addResourceHints = () => {
  const domains = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://yazmxlgfraauuhmsnysh.supabase.co'
  ];

  domains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = domain;
    document.head.appendChild(link);
  });
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