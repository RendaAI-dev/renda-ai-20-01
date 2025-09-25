import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MarketingCampaign {
  id: string;
  title: string;
  body: string;
  type: string;
  sent_at: string;
  results: any;
  user_count?: number;
}

export const MarketingCampaignList: React.FC = () => {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCampaigns = async () => {
    try {
      setIsLoading(true);
      
      // Buscar logs de notificação do tipo marketing
      const { data, error } = await supabase
        .from('poupeja_notification_logs')
        .select(`
          id,
          title,
          body,
          type,
          sent_at,
          results
        `)
        .eq('type', 'marketing')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setCampaigns(data || []);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as campanhas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const getStatusBadge = (results: any) => {
    const resultsArray = Array.isArray(results) ? results : [];
    
    if (resultsArray.length === 0) {
      return <Badge variant="secondary">Sem dados</Badge>;
    }

    const successful = resultsArray.filter((r: any) => r.status === 'sent').length;
    const failed = resultsArray.filter((r: any) => r.status === 'failed').length;
    
    if (failed === 0) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Enviada
        </Badge>
      );
    } else if (successful > 0) {
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          Parcial
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Falhou
        </Badge>
      );
    }
  };

  const getDeliveryStats = (results: any) => {
    const resultsArray = Array.isArray(results) ? results : [];
    
    if (resultsArray.length === 0) return { sent: 0, failed: 0, total: 0 };
    
    const sent = resultsArray.filter((r: any) => r.status === 'sent').length;
    const failed = resultsArray.filter((r: any) => r.status === 'failed').length;
    const total = resultsArray.length;
    
    return { sent, failed, total };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando campanhas...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Histórico de Campanhas</h3>
        <Button onClick={loadCampaigns} variant="outline" size="sm">
          Atualizar
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nenhuma campanha de marketing foi enviada ainda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const stats = getDeliveryStats(campaign.results);
            
            return (
              <Card key={campaign.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{campaign.title}</h4>
                        {getStatusBadge(campaign.results)}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-4">
                        {campaign.body}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(campaign.sent_at), 'PPp', { locale: ptBR })}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {stats.total} destinatários
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-600">
                        {stats.sent} enviadas
                      </div>
                      {stats.failed > 0 && (
                        <div className="text-sm text-red-600">
                          {stats.failed} falharam
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {stats.total > 0 && `${Math.round((stats.sent / stats.total) * 100)}% sucesso`}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};