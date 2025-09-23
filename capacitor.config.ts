import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.be9f005973734e7f92bf7bc8e11d714b',
  appName: 'Renda AI',
  webDir: 'dist',
  server: {
    url: 'https://be9f0059-7373-4e7f-92bf-7bc8e11d714b.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#4ECDC4',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#FFFFFF'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#4ECDC4'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#4ECDC4',
      sound: 'beep.wav'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true
  }
};

export default config;