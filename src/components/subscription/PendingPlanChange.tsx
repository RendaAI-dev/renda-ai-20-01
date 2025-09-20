import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ExternalLink, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface PendingPlanChangeProps {
  userId?: string;
  onUpdate?: () => void;
}

interface PlanChangeRequest {
  id: string;
  current_plan_type: string;
  new_plan_type: string;
  new_plan_value: number;
  payment_url: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const PendingPlanChange: React.FC<PendingPlanChangeProps> = ({ userId, onUpdate }) => {
  const [pendingChanges, setPendingChanges] = useState<PlanChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  useEffect(() => {
    fetchPendingChanges();
  }, [userId]);

  const fetchPendingChanges = async () => {
    try {
      const { data, error } = await supabase
        .from('poupeja_plan_change_requests')
        .select('*')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPendingChanges(data || []);
    } catch (error) {
      console.error('Erro ao buscar mudanças pendentes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('poupeja_plan_change_requests')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Solicitação Cancelada",
        description: "A solicitação de mudança de plano foi cancelada.",
      });

      await fetchPendingChanges();
      onUpdate?.();
    } catch (error) {
      console.error('Erro ao cancelar solicitação:', error);
      toast({
        title: "Erro",
        description: "Erro ao cancelar solicitação",
        variant: "destructive",
      });
    }
  };

  const getPlanName = (planType: string) => {
    return planType === 'monthly' ? 'Mensal' : 'Anual';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Aguardando Pagamento</Badge>;
      case 'paid':
        return <Badge variant="default">Pago</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return null;
  }

  if (pendingChanges.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Mudanças de Plano Pendentes</h3>
      {pendingChanges.map((change) => (
        <Card key={change.id} className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Mudança: {getPlanName(change.current_plan_type)} → {getPlanName(change.new_plan_type)}
              </CardTitle>
              {getStatusBadge(change.status)}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor do novo plano:</p>
                <p className="font-semibold">{formatCurrency(change.new_plan_value)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Expira em:</p>
                <p className="text-sm font-medium">{formatExpirationDate(change.expires_at)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => window.open(change.payment_url, '_blank')}
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Pagar Agora
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleCancelRequest(change.id)}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Complete o pagamento para confirmar a mudança de plano. 
              Caso não pague até o prazo, a solicitação será cancelada automaticamente.
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PendingPlanChange;