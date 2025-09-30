import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationData {
  title: string;
  body: string;
  type: 'expense_reminder' | 'goal_deadline' | 'scheduled_transaction' | 'marketing' | 'security';
  data?: Record<string, any>;
}

class NotificationService {
  private isNative = Capacitor.isNativePlatform();
  private registrationToken: string | null = null;

  async initialize() {
    if (this.isNative) {
      await this.initializeNative();
    } else {
      await this.initializeWeb();
    }

    // Listen for auth changes to save subscriptions
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !this.isNative) {
        await this.saveExistingWebSubscription();
      }
    });
  }

  private async initializeNative() {
    try {
      // Request permissions for local notifications
      const localPermissions = await LocalNotifications.requestPermissions();
      console.log('Local notifications permissions:', localPermissions);

      // Request permissions for push notifications
      const pushPermissions = await PushNotifications.requestPermissions();
      console.log('Push notifications permissions:', pushPermissions);

      if (pushPermissions.receive === 'granted') {
        // Register for push notifications
        await PushNotifications.register();

        // Listen for registration token
        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success:', token.value);
          this.registrationToken = token.value;
          this.saveDeviceToken(token.value);
        });

        // Listen for push notifications
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification action performed:', notification);
          this.handleNotificationAction(notification.notification);
        });
      }
    } catch (error) {
      console.error('Error initializing native notifications:', error);
    }
  }

  private async initializeWeb() {
    try {
      if (!('serviceWorker' in navigator && 'PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }

      // Importar configuração Firebase
      const { getFCMToken, onFCMMessage } = await import('@/config/firebase');

      const registration = await navigator.serviceWorker.ready;
      
      // Request notification permission
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      
      if (permission !== 'granted') {
        console.log('Notification permission not granted');
        return;
      }

      // Obter FCM token
      const fcmToken = await getFCMToken();
      
      if (fcmToken) {
        console.log('FCM Token obtido com sucesso');
        this.registrationToken = fcmToken;
        await this.saveDeviceToken(fcmToken);
      } else {
        console.warn('Não foi possível obter FCM token');
      }

      // Listener para mensagens em foreground
      onFCMMessage((payload) => {
        console.log('Mensagem FCM recebida:', payload);
        
        // Mostrar notificação
        if (payload.notification) {
          this.showWebNotification({
            title: payload.notification.title || 'Nova Notificação',
            body: payload.notification.body || '',
            type: payload.data?.type || 'system',
            data: payload.data
          });
        }
      });
    } catch (error) {
      console.error('Error initializing web notifications:', error);
    }
  }

  private async saveExistingWebSubscription() {
    try {
      if (!('serviceWorker' in navigator && 'PushManager' in window)) return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        console.log('Saving existing subscription after login');
        await this.saveWebPushSubscription(subscription);
      }
    } catch (error) {
      console.error('Error saving existing subscription:', error);
    }
  }

  async getSubscriptionStatus() {
    try {
      if (!('serviceWorker' in navigator && 'PushManager' in window)) {
        return { supported: false, permission: 'default', subscribed: false };
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      return {
        supported: true,
        permission: Notification.permission,
        subscribed: !!subscription,
        endpoint: subscription?.endpoint
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return { supported: false, permission: 'default', subscribed: false };
    }
  }

  async scheduleLocalNotification(options: NotificationData & { at?: Date; id?: number }) {
    if (!this.isNative) {
      return this.showWebNotification(options);
    }

    try {
      const notification: ScheduleOptions = {
        notifications: [{
          id: options.id || Date.now(),
          title: options.title,
          body: options.body,
          schedule: options.at ? { at: options.at } : undefined,
          extra: options.data,
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#4ECDC4'
        }]
      };

      await LocalNotifications.schedule(notification);
      console.log('Local notification scheduled:', notification);
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  }

  private async showWebNotification(options: NotificationData) {
    if (Notification.permission === 'granted') {
      new Notification(options.title, {
        body: options.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        data: options.data
      });
    }
  }

  async sendPushNotification(userId: string, notification: NotificationData) {
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId,
          notification
        }
      });

      if (error) {
        console.error('Error sending push notification:', error);
      }
    } catch (error) {
      console.error('Error invoking push notification function:', error);
    }
  }

  private async saveDeviceToken(token: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('poupeja_device_tokens')
        .upsert({
          user_id: user.id,
          token: token,
          platform: Capacitor.getPlatform()
        }, {
          onConflict: 'user_id,platform'
        });

      if (error) {
        console.error('Error saving device token:', error);
      } else {
        console.log('Device token saved successfully');
      }
    } catch (error) {
      console.error('Error saving device token:', error);
    }
  }

  private async saveWebPushSubscription(subscription: PushSubscription) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('poupeja_web_push_subscriptions')
        .upsert({
          user_id: user.id,
          subscription: subscription.toJSON() as any
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving web push subscription:', error);
      } else {
        console.log('Web push subscription saved successfully');
      }
    } catch (error) {
      console.error('Error saving web push subscription:', error);
    }
  }

  private handleNotificationAction(notification: any) {
    // Handle notification tap/action
    console.log('Notification action:', notification);
    
    // Navigate based on notification type
    const type = notification.extra?.type;
    if (type === 'expense_reminder') {
      // Navigate to expenses page
      window.location.href = '/expenses';
    } else if (type === 'goal_deadline') {
      // Navigate to goals page
      window.location.href = '/goals';
    }
  }

  private urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Schedule recurring expense reminders
  async scheduleExpenseReminders() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: scheduledTransactions } = await supabase
        .from('poupeja_scheduled_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('type', 'expense');

      scheduledTransactions?.forEach(transaction => {
        const reminderDate = new Date(transaction.next_execution_date);
        reminderDate.setHours(reminderDate.getHours() - 24); // 24h before

        this.scheduleLocalNotification({
          title: 'Lembrete de Despesa',
          body: `${transaction.description} - R$ ${transaction.amount} vence amanhã`,
          type: 'expense_reminder',
          at: reminderDate,
          id: parseInt(`1${transaction.id.replace(/-/g, '').substring(0, 8)}`, 16),
          data: { transactionId: transaction.id }
        });
      });
    } catch (error) {
      console.error('Error scheduling expense reminders:', error);
    }
  }

  // Schedule goal deadline alerts
  async scheduleGoalDeadlines() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Simplified query to avoid TypeScript issues
      const { data, error } = await supabase
        .from('poupeja_goals')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching goals:', error);
        return;
      }

      data?.forEach(goal => {
        if (goal.deadline) {
          const reminderDate = new Date(goal.deadline);
          reminderDate.setDate(reminderDate.getDate() - 7); // 1 week before

          this.scheduleLocalNotification({
            title: 'Meta Próxima do Vencimento',
            body: `Sua meta "${goal.name}" vence em uma semana!`,
            type: 'goal_deadline',
            at: reminderDate,
            id: parseInt(`2${goal.id.replace(/-/g, '').substring(0, 8)}`, 16),
            data: { goalId: goal.id }
          });
        }
      });
    } catch (error) {
      console.error('Error scheduling goal deadlines:', error);
    }
  }
}

export const notificationService = new NotificationService();