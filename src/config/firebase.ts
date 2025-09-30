import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAJMcwMil-dpZ9JsN9Ikwz_SqIz89huFFw",
  authDomain: "renda-ai-8e279.firebaseapp.com",
  projectId: "renda-ai-8e279",
  storageBucket: "renda-ai-8e279.firebasestorage.app",
  messagingSenderId: "993762838881",
  appId: "1:993762838881:web:19bc2019fde8e546671d20",
  measurementId: "G-P3HM5BP951"
};

// VAPID Key para Web Push
export const VAPID_PUBLIC_KEY = "BFT55KJti8Hur4UsnBk0RzocIEWWXtiNSZn0MK5kILjyyPgoZ4V9bTsrL6rHjWnEnn6ruKtRZff4LdhMPGgocmo";

// Inicializar Firebase
export const firebaseApp = initializeApp(firebaseConfig);

// Inicializar Firebase Messaging (apenas para web)
let messaging: ReturnType<typeof getMessaging> | null = null;

export const getFirebaseMessaging = () => {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    if (!messaging) {
      messaging = getMessaging(firebaseApp);
    }
  }
  return messaging;
};

// Obter FCM token
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.log('Firebase Messaging not supported');
      return null;
    }

    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY
    });

    if (currentToken) {
      console.log('FCM Token obtido:', currentToken);
      return currentToken;
    } else {
      console.log('No registration token available');
      return null;
    }
  } catch (error) {
    console.error('Erro ao obter FCM token:', error);
    return null;
  }
};

// Listener para mensagens em foreground
export const onFCMMessage = (callback: (payload: any) => void) => {
  const messaging = getFirebaseMessaging();
  if (messaging) {
    return onMessage(messaging, callback);
  }
  return () => {};
};
