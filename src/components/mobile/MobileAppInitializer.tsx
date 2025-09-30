import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export function MobileAppInitializer() {
  useEffect(() => {
    const initializeMobileApp = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Configure Status Bar
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#4ECDC4' });
          await StatusBar.setOverlaysWebView({ overlay: false });
          
          // Hide splash screen after app is ready
          await SplashScreen.hide();
          
          console.log('Mobile app initialized successfully');
        } catch (error) {
          console.error('Error initializing mobile app:', error);
        }
      }
    };

    initializeMobileApp();
  }, []);

  return null; // This component doesn't render anything
}