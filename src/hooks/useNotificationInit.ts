import { useEffect } from 'react';
import { notificationService } from '@/services/notificationService';

export const useNotificationInit = () => {
  useEffect(() => {
    const initNotifications = async () => {
      try {
        console.log('Initializing notification service...');
        await notificationService.initialize();
        console.log('Notification service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize notification service:', error);
      }
    };

    // Inicializar após um pequeno delay para garantir que o app está pronto
    const timer = setTimeout(initNotifications, 1000);

    return () => clearTimeout(timer);
  }, []);
};
