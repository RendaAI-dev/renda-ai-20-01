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
}

export const usePWAInstall = () => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<PWAInstallState>({
    canInstall: false,
    isInstalled: false,
    showPopup: false,
    isPrompting: false
  });

  // Check if running as PWA
  const checkIfInstalled = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebApp = (window.navigator as any).standalone === true;
    const isInstalled = isStandalone || isInWebApp;
    
    setState(prev => ({ ...prev, isInstalled }));
    return isInstalled;
  }, []);

  // Check if user previously dismissed
  const checkUserPreferences = useCallback(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const lastShown = localStorage.getItem('pwa-install-last-shown');
    
    if (dismissed === 'forever') return false;
    
    if (lastShown) {
      const daysSinceLastShown = (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastShown < 7) return false; // Wait 7 days before showing again
    }
    
    return true;
  }, []);

  // Show popup logic
  const shouldShowPopup = useCallback(() => {
    // Check if mobile device
    const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile || state.isInstalled || !state.canInstall) return false;
    
    return checkUserPreferences();
  }, [state.canInstall, state.isInstalled, checkUserPreferences]);

  // Initialize
  useEffect(() => {
    const isInstalled = checkIfInstalled();
    if (isInstalled) return;

    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setPromptEvent(promptEvent);
      
      setState(prev => ({ ...prev, canInstall: true }));
      
      // Show popup after 3 seconds if conditions are met
      setTimeout(() => {
        if (shouldShowPopup()) {
          setState(prev => ({ ...prev, showPopup: true }));
        }
      }, 3000);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setState(prev => ({ ...prev, isInstalled: true, showPopup: false, canInstall: false }));
      setPromptEvent(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [shouldShowPopup, checkIfInstalled]);

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

  return {
    ...state,
    install,
    dismissPopup
  };
};