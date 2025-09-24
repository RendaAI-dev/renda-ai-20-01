// Console optimization utilities to reduce noise in production
export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;

// Optimized logging functions
export const logInfo = (message: string, ...args: any[]) => {
  if (isDev) {
    console.log(message, ...args);
  }
};

export const logWarn = (message: string, ...args: any[]) => {
  if (isDev) {
    console.warn(message, ...args);
  }
};

export const logError = (message: string, ...args: any[]) => {
  // Always log errors, but with less noise in production
  if (isDev) {
    console.error(message, ...args);
  } else {
    // In production, only log critical errors
    if (message.includes('critical') || message.includes('fatal')) {
      console.error(message, ...args);
    }
  }
};

// Authentication-specific logging to reduce noise
export const logAuthInfo = (message: string, ...args: any[]) => {
  // Only log auth info in dev mode and when explicitly needed
  if (isDev && !message.includes('User not authenticated')) {
    console.log(`[Auth] ${message}`, ...args);
  }
};

export const logAuthError = (message: string, error: any) => {
  // Only log actual auth errors, not expected states
  if (error?.message && !error.message.includes('session_not_found')) {
    if (isDev) {
      console.error(`[Auth] ${message}`, error);
    } else {
      console.error(`[Auth] ${message}`);
    }
  }
};

// Performance logging
export const logPerf = (message: string, ...args: any[]) => {
  if (isDev) {
    console.log(`[Perf] ${message}`, ...args);
  }
};

// PWA logging
export const logPWA = (message: string, ...args: any[]) => {
  // Completely silence PWA logs in production
  if (isDev) {
    console.log(`[PWA] ${message}`, ...args);
  }
};