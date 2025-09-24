import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  showPopup: boolean;
  isPrompting: boolean;
  debugMode: boolean;
}

export const usePWAInstall = () => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<PWAInstallState>({
    canInstall: false,
    isInstalled: false,
    showPopup: false,
    isPrompting: false,
    debugMode: import.meta.env.DEV
  });

  const debug = useCallback((message: string, data?: any) => {
    // Only log critical errors in production
    if (state.debugMode && (message.includes('Error') || message.includes('Failed'))) {
      console.error(`[PWA] ${message}`, data || '');
    }
  }, [state.debugMode]);

  // Check if running as PWA
  const checkIfInstalled = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebApp = (window.navigator as any).standalone === true;
    const isInstalled = isStandalone || isInWebApp;
    
    debug('Checking if installed', { isStandalone, isInWebApp, isInstalled });
    setState(prev => ({ ...prev, isInstalled }));
    return isInstalled;
  }, [debug]);

  // Enhanced mobile detection
  const isMobileDevice = useCallback(() => {
    const userAgent = navigator.userAgent;
    const isMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(userAgent);
    const isMobileViewport = window.innerWidth <= 768;
    const hasTouch = 'ontouchstart' in window;
    const isMobile = isMobileUA || (isMobileViewport && hasTouch);
    
    debug('Mobile detection', { userAgent, isMobileUA, isMobileViewport, hasTouch, isMobile });
    return isMobile;
  }, [debug]);

  // Check if user previously dismissed
  const checkUserPreferences = useCallback(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const lastShown = localStorage.getItem('pwa-install-last-shown');
    
    debug('Checking user preferences', { dismissed, lastShown });
    
    if (dismissed === 'forever') return false;
    
    if (lastShown) {
      const daysSinceLastShown = (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastShown < 7) return false;
    }
    
    return true;
  }, [debug]);

  // Show popup after delay
  const schedulePopup = useCallback(() => {
    const canShow = isMobileDevice() && !state.isInstalled && checkUserPreferences();
    debug('Schedule popup check', { canShow, isInstalled: state.isInstalled });
    
    if (canShow) {
      setTimeout(() => {
        debug('Showing popup after delay');
        setState(prev => ({ ...prev, showPopup: true }));
      }, 3000);
    }
  }, [state.isInstalled, isMobileDevice, checkUserPreferences, debug]);

  // Initialize
  useEffect(() => {
    debug('Initializing PWA install hook');
    
    const isInstalled = checkIfInstalled();
    if (isInstalled) {
      debug('App already installed, skipping');
      return;
    }

    // Skip PWA logic in development to improve performance
    if (import.meta.env.DEV) {
      setState(prev => ({ ...prev, canInstall: false, showPopup: false }));
      return;
    }

    const handler = (e: Event) => {
      debug('beforeinstallprompt event fired');
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setPromptEvent(promptEvent);
      
      setState(prev => ({ ...prev, canInstall: true }));
      schedulePopup();
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      debug('App installed event fired');
      setState(prev => ({ ...prev, isInstalled: true, showPopup: false, canInstall: false }));
      setPromptEvent(null);
    });

    // Fallback: show popup even without beforeinstallprompt for iOS or unsupported browsers
    const fallbackTimer = setTimeout(() => {
      if (!state.canInstall && isMobileDevice() && !state.isInstalled) {
        debug('Fallback popup for unsupported browsers');
        setState(prev => ({ ...prev, showPopup: true, canInstall: false }));
      }
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallbackTimer);
    };
  }, [checkIfInstalled, schedulePopup, debug, state.canInstall, state.isInstalled, isMobileDevice]);

  const install = useCallback(async () => {
    if (!promptEvent || state.isPrompting) return false;
    
    setState(prev => ({ ...prev, isPrompting: true }));
    
    try {
      await promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        localStorage.setItem('pwa-install-accepted', Date.now().toString());
        setState(prev => ({ ...prev, showPopup: false }));
        return true;
      } else {
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        localStorage.setItem('pwa-install-last-shown', Date.now().toString());
        setState(prev => ({ ...prev, showPopup: false }));
        return false;
      }
    } catch (error) {
      console.error('Error during PWA installation:', error);
      return false;
    } finally {
      setState(prev => ({ ...prev, isPrompting: false }));
      setPromptEvent(null);
    }
  }, [promptEvent, state.isPrompting]);

  const dismissPopup = useCallback((forever = false) => {
    setState(prev => ({ ...prev, showPopup: false }));
    
    if (forever) {
      localStorage.setItem('pwa-install-dismissed', 'forever');
    } else {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      localStorage.setItem('pwa-install-last-shown', Date.now().toString());
    }
  }, []);

  // Force show popup for testing
  const forceShowPopup = useCallback(() => {
    debug('Force showing popup for testing');
    setState(prev => ({ ...prev, showPopup: true }));
  }, [debug]);

  // Clear preferences for testing
  const resetPreferences = useCallback(() => {
    localStorage.removeItem('pwa-install-dismissed');
    localStorage.removeItem('pwa-install-last-shown');
    localStorage.removeItem('pwa-install-accepted');
    debug('Preferences reset');
  }, [debug]);

  return {
    ...state,
    install,
    dismissPopup,
    forceShowPopup,
    resetPreferences,
    isMobile: isMobileDevice()
  };
};