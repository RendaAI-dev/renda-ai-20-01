import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Send, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

interface MarketingStats {
  totalCampaigns: number;
  totalNotificationsSent: number;
  successRate: number;
  totalUsers: number;
  marketingEnabledUsers: number;
  activeUsers: number;
  recentCampaigns: number;
}

export const MarketingStats: React.FC = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      
      // Buscar estatísticas de campanhas
      const { data: campaigns, error: campaignsError } = await supabase
        .from('poupeja_notification_logs')
        .select('id, results, sent_at')
        .eq('type', 'marketing');

      if (campaignsError) throw campaignsError;

      // Buscar estatísticas de usuários com activity tracking
      const { data: users, error: usersError } = await supabase
        .from('poupeja_users')
        .select('id, created_at, last_activity_at');

      if (usersError) throw usersError;

      // Buscar preferências de marketing
      const { data: preferences, error: prefError } = await supabase
        .from('poupeja_user_preferences')
        .select('user_id, notification_preferences');

      if (prefError) throw prefError;

      // Calcular estatísticas
      const totalCampaigns = campaigns?.length || 0;
      let totalNotificationsSent = 0;
      let totalSuccessful = 0;

      campaigns?.forEach(campaign => {
        const resultsArray = Array.isArray(campaign.results) ? campaign.results : [];
        if (resultsArray.length > 0) {
          totalNotificationsSent += resultsArray.length;
          totalSuccessful += resultsArray.filter((r: any) => r.status === 'sent').length;
        }
      });

      const successRate = totalNotificationsSent > 0 ? 
        Math.round((totalSuccessful / totalNotificationsSent) * 100) : 0;

      const totalUsers = users?.length || 0;
      
      // Contar usuários que aceitam marketing (opt-out model)
      const marketingEnabledUsers = preferences?.filter(pref => {
        const notifPrefs = pref.notification_preferences as any;
        return notifPrefs?.marketing !== false; // Changed: use opt-out model
      }).length || totalUsers; // Default to all users if no preferences

      // Calculate REAL active users (activity in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeUsers = users?.filter(user => {
        const lastActivity = user.last_activity_at ? new Date(user.last_activity_at) : new Date(user.created_at);
        return lastActivity >= thirtyDaysAgo;
      }).length || 0;

      // Campanhas recentes (últimos 7 dias)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentCampaigns = campaigns?.filter(campaign => 
        new Date(campaign.sent_at || '') > sevenDaysAgo
      ).length || 0;

      setStats({
        totalCampaigns,
        totalNotificationsSent,
        successRate,
        totalUsers,
        marketingEnabledUsers,
        activeUsers,
        recentCampaigns
      });

    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as estatísticas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando estatísticas...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            Não foi possível carregar as estatísticas.
          </p>
        </CardContent>
      </Card>
    );
  }

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    description: string;
    icon: React.ReactNode;
    trend?: string;
  }> = ({ title, value, description, icon, trend }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {trend}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Estatísticas de Marketing</h3>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Campanhas"
            value={stats.totalCampaigns}
            description="Campanhas enviadas até agora"
            icon={<Send className="h-4 w-4" />}
          />
          
          <StatCard
            title="Notificações Enviadas"
            value={stats.totalNotificationsSent.toLocaleString()}
            description="Total de notificações"
            icon={<CheckCircle className="h-4 w-4" />}
          />
          
          <StatCard
            title="Taxa de Sucesso"
            value={`${stats.successRate}%`}
            description="Entregas bem-sucedidas"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          
          <StatCard
            title="Campanhas Recentes"
            value={stats.recentCampaigns}
            description="Últimos 7 dias"
            icon={<Send className="h-4 w-4" />}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Audiência</h3>
        
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Total de Usuários"
            value={stats.totalUsers.toLocaleString()}
            description="Usuários registrados"
            icon={<Users className="h-4 w-4" />}
          />
          
          <StatCard
            title="Aceita Marketing"
            value={stats.marketingEnabledUsers.toLocaleString()}
            description={`${Math.round((stats.marketingEnabledUsers / stats.totalUsers) * 100)}% do total`}
            icon={<CheckCircle className="h-4 w-4" />}
          />
          
          <StatCard
            title="Usuários Ativos"
            value={stats.activeUsers.toLocaleString()}
            description="Últimos 30 dias"
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  );
};