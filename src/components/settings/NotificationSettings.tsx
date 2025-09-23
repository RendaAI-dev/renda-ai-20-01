import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/services/notificationService';
import { Bell, Clock, Target, CreditCard, Shield } from 'lucide-react';

interface NotificationPreferences {
  expense_reminders: boolean;
  goal_deadlines: boolean;
  scheduled_transactions: boolean;
  marketing: boolean;
  security_alerts: boolean;
  reminder_time: string;
  reminder_days_before: number;
}

export function NotificationSettings() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    expense_reminders: true,
    goal_deadlines: true,
    scheduled_transactions: true,
    marketing: false,
    security_alerts: true,
    reminder_time: '09:00',
    reminder_days_before: 1
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    loadPreferences();
    checkNotificationPermission();
  }, []);

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use settings table as fallback until types are updated
      const { data, error } = await supabase
        .from('poupeja_settings')
        .select('value')
        .eq('category', 'notifications')
        .eq('key', `user_${user.id}`)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading preferences:', error);
        return;
      }

      if (data?.value) {
        try {
          const savedPrefs = JSON.parse(data.value);
          setPreferences({ ...preferences, ...savedPrefs });
        } catch (parseError) {
          console.error('Error parsing preferences:', parseError);
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const checkNotificationPermission = async () => {
    if ('Notification' in window) {
      setHasPermission(Notification.permission === 'granted');
    }
  };

  const requestPermission = async () => {
    try {
      await notificationService.initialize();
      setHasPermission(Notification.permission === 'granted');
      
      if (Notification.permission === 'granted') {
        toast({
          title: 'Permissão concedida',
          description: 'Notificações ativadas com sucesso!'
        });
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível ativar as notificações',
        variant: 'destructive'
      });
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.rpc('upsert_setting', {
        p_category: 'notifications',
        p_key: `user_${user.id}`,
        p_value: JSON.stringify(newPreferences),
        p_description: 'User notification preferences'
      });

      if (error) {
        throw error;
      }

      setPreferences(newPreferences);
      
      // Schedule notifications based on new preferences
      if (newPreferences.expense_reminders) {
        await notificationService.scheduleExpenseReminders();
      }
      
      if (newPreferences.goal_deadlines) {
        await notificationService.scheduleGoalDeadlines();
      }

      toast({
        title: 'Sucesso',
        description: 'Preferências de notificação salvas!'
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as preferências',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    savePreferences(newPreferences);
  };

  const testNotification = async () => {
    try {
      await notificationService.scheduleLocalNotification({
        title: 'Teste de Notificação',
        body: 'Esta é uma notificação de teste do Renda AI!',
        type: 'marketing'
      });
      
      toast({
        title: 'Teste enviado',
        description: 'Verifique se recebeu a notificação'
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar notificação de teste',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Configurações de Notificação
          </CardTitle>
          <CardDescription>
            Gerencie como e quando você deseja receber notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasPermission && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Ativar Notificações</h3>
                  <p className="text-sm text-muted-foreground">
                    Permita que o app envie notificações para você
                  </p>
                </div>
                <Button onClick={requestPermission}>
                  Ativar
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <Label htmlFor="expense-reminders">Lembretes de Despesas</Label>
              </div>
              <Switch
                id="expense-reminders"
                checked={preferences.expense_reminders}
                onCheckedChange={(value) => handlePreferenceChange('expense_reminders', value)}
                disabled={!hasPermission || isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <Label htmlFor="goal-deadlines">Prazos de Metas</Label>
              </div>
              <Switch
                id="goal-deadlines"
                checked={preferences.goal_deadlines}
                onCheckedChange={(value) => handlePreferenceChange('goal_deadlines', value)}
                disabled={!hasPermission || isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <Label htmlFor="scheduled-transactions">Transações Agendadas</Label>
              </div>
              <Switch
                id="scheduled-transactions"
                checked={preferences.scheduled_transactions}
                onCheckedChange={(value) => handlePreferenceChange('scheduled_transactions', value)}
                disabled={!hasPermission || isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <Label htmlFor="security-alerts">Alertas de Segurança</Label>
              </div>
              <Switch
                id="security-alerts"
                checked={preferences.security_alerts}
                onCheckedChange={(value) => handlePreferenceChange('security_alerts', value)}
                disabled={!hasPermission || isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <Label htmlFor="marketing">Notificações Promocionais</Label>
              </div>
              <Switch
                id="marketing"
                checked={preferences.marketing}
                onCheckedChange={(value) => handlePreferenceChange('marketing', value)}
                disabled={!hasPermission || isLoading}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reminder-time">Horário dos Lembretes</Label>
                <Select
                  value={preferences.reminder_time}
                  onValueChange={(value) => handlePreferenceChange('reminder_time', value)}
                  disabled={!hasPermission || isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="08:00">08:00</SelectItem>
                    <SelectItem value="09:00">09:00</SelectItem>
                    <SelectItem value="10:00">10:00</SelectItem>
                    <SelectItem value="18:00">18:00</SelectItem>
                    <SelectItem value="19:00">19:00</SelectItem>
                    <SelectItem value="20:00">20:00</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="reminder-days">Dias de Antecedência</Label>
                <Select
                  value={preferences.reminder_days_before.toString()}
                  onValueChange={(value) => handlePreferenceChange('reminder_days_before', parseInt(value))}
                  disabled={!hasPermission || isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia antes</SelectItem>
                    <SelectItem value="2">2 dias antes</SelectItem>
                    <SelectItem value="3">3 dias antes</SelectItem>
                    <SelectItem value="7">1 semana antes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasPermission && (
              <Button 
                variant="outline" 
                onClick={testNotification}
                className="w-full"
              >
                Enviar Notificação de Teste
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}