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
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        
        // Request notification permission
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
          // Subscribe to push notifications
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(
              'BEl62iUYgUivxIkv69yViEuiBIa40HI0L5HyDX4VbXcZgN4b6F8H3M6LdE1l8R9xQ4ZX6J7Z8K4HdM3L5P2N6V9X'
            )
          });

          console.log('Web push subscription:', subscription);
          this.saveWebPushSubscription(subscription);
        }
      }
    } catch (error) {
      console.error('Error initializing web notifications:', error);
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
          token,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving device token:', error);
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
          subscription: JSON.stringify(subscription),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving web push subscription:', error);
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

      const { data: goals } = await supabase
        .from('poupeja_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .not('target_date', 'is', null);

      goals?.forEach(goal => {
        const reminderDate = new Date(goal.target_date);
        reminderDate.setDate(reminderDate.getDate() - 7); // 1 week before

        this.scheduleLocalNotification({
          title: 'Meta Próxima do Vencimento',
          body: `Sua meta "${goal.title}" vence em uma semana!`,
          type: 'goal_deadline',
          at: reminderDate,
          id: parseInt(`2${goal.id.replace(/-/g, '').substring(0, 8)}`, 16),
          data: { goalId: goal.id }
        });
      });
    } catch (error) {
      console.error('Error scheduling goal deadlines:', error);
    }
  }
}

export const notificationService = new NotificationService();