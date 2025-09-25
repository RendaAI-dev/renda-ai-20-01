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
      
      // Call the Edge Function to get marketing stats
      const { data, error } = await supabase.functions.invoke('get-marketing-stats');

      if (error) {
        console.error('Edge Function error:', error);
        throw new Error(error.message || 'Erro ao carregar estatísticas');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro na resposta do servidor');
      }

      const serverStats = data.data;
      
      setStats({
        totalCampaigns: serverStats.totalCampaigns,
        totalNotificationsSent: serverStats.totalNotifications,
        successRate: serverStats.successRate,
        totalUsers: serverStats.totalUsers,
        marketingEnabledUsers: serverStats.marketingUsers,
        activeUsers: serverStats.activeUsers,
        recentCampaigns: serverStats.recentCampaigns
      });

    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível carregar as estatísticas",
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