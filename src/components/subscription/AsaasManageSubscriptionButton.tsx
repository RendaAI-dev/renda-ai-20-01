import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import PlanChangeDialog from './PlanChangeDialog';

interface PortalData {
  customer: {
    id: string;
    name: string;
    email: string;
    cpfCnpj?: string;
    phone?: string;
  };
  subscription: {
    id: string;
    status: string;
    plan_type: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  };
  recent_payments: Array<{
    id: string;
    value: number;
    status: string;
    dueDate: string;
    paymentDate?: string;
    description: string;
    invoiceUrl?: string;
  }>;
}

const AsaasManageSubscriptionButton: React.FC = () => {
  const { hasActiveSubscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);

  if (!hasActiveSubscription) {
    return null;
  }

  const handleManageSubscription = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('asaas-customer-portal');

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao acessar portal do cliente');
      }

      setPortalData(data.portal_data);
      setDialogOpen(true);
      
    } catch (error: any) {
      console.error('Erro ao acessar portal:', error);
      
      if (error.message?.includes('Nenhuma assinatura ativa encontrada')) {
        toast.error('Nenhuma assinatura ativa encontrada');
      } else if (error.message?.includes('Cliente Asaas não encontrado')) {
        toast.error('Dados do cliente não encontrados');
      } else {
        toast.error(error.message || 'Erro ao acessar gerenciamento de assinatura');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCard = async (scenario: string) => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('update-payment-method', {
        body: { scenario }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao atualizar método de pagamento');
      }

      toast.success(data.message || 'Método de pagamento atualizado com sucesso');
      
      if (data.invoiceUrl) {
        toast.info('Redirecionando para a página de pagamento...');
        setTimeout(() => {
          window.open(data.invoiceUrl, '_blank');
        }, 1000);
      }

      // Recarregar dados do portal
      setTimeout(() => {
        handleManageSubscription();
      }, 2000);
      
    } catch (error: any) {
      console.error('Erro ao atualizar método de pagamento:', error);
      toast.error(error.message || 'Erro ao atualizar método de pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: 'default', text: 'Ativa' },
      past_due: { variant: 'destructive', text: 'Pendente' },
      cancelled: { variant: 'secondary', text: 'Cancelada' },
      RECEIVED: { variant: 'default', text: 'Pago' },
      PENDING: { variant: 'secondary', text: 'Pendente' },
      OVERDUE: { variant: 'destructive', text: 'Vencido' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || 
      { variant: 'secondary', text: status };

    return (
      <Badge variant={config.variant as any}>
        {config.text}
      </Badge>
    );
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={handleManageSubscription}
        disabled={isLoading}
        className="flex items-center gap-2"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        {isLoading ? 'Carregando...' : 'Gerenciar Assinatura'}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Assinatura</DialogTitle>
            <DialogDescription>
              Informações da sua assinatura e histórico de pagamentos
            </DialogDescription>
          </DialogHeader>

          {portalData && (
            <div className="space-y-6">
              {/* Informações do Cliente */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações da Conta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <strong>Nome:</strong> {portalData.customer.name}
                  </div>
                  <div>
                    <strong>Email:</strong> {portalData.customer.email}
                  </div>
                  {portalData.customer.cpfCnpj && (
                    <div>
                      <strong>CPF:</strong> {portalData.customer.cpfCnpj}
                    </div>
                  )}
                  {portalData.customer.phone && (
                    <div>
                      <strong>Telefone:</strong> {portalData.customer.phone}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assinatura Atual */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Assinatura Atual
                    {getStatusBadge(portalData.subscription.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <strong>Plano:</strong> {portalData.subscription.plan_type === 'monthly' ? 'Mensal' : 'Anual'}
                  </div>
                  <div>
                    <strong>Período Atual:</strong> {formatDate(portalData.subscription.current_period_start)} até {formatDate(portalData.subscription.current_period_end)}
                  </div>
                  {portalData.subscription.cancel_at_period_end && (
                    <div className="text-amber-600">
                      <strong>Atenção:</strong> Assinatura será cancelada no final do período atual
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pagamentos Recentes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pagamentos Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {portalData.recent_payments.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum pagamento encontrado</p>
                  ) : (
                    <div className="space-y-3">
                      {portalData.recent_payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatCurrency(payment.value)}</span>
                              {getStatusBadge(payment.status)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {payment.description}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Vencimento: {formatDate(payment.dueDate)}
                              {payment.paymentDate && (
                                <span> • Pago em: {formatDate(payment.paymentDate)}</span>
                              )}
                            </div>
                          </div>
                          {payment.invoiceUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a
                                href={payment.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Ver Fatura
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Separator />

              {/* Ações de Gerenciamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Gerenciar Pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateCard('update_card_only')}
                      disabled={isLoading}
                      className="justify-start"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Atualizar Cartão de Crédito
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateCard('update_card_cancel_overdue')}
                      disabled={isLoading}
                      className="justify-start"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Trocar Cartão e Cancelar Dívidas Antigas
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setPlanChangeOpen(true)}
                      disabled={isLoading}
                      className="justify-start"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Alterar Plano (Upgrade/Downgrade)
                    </Button>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <p>
                      <strong>Cenário 1:</strong> Para quem está em dia - apenas atualiza o cartão para futuras cobranças<br/>
                      <strong>Cenário 2:</strong> Para quem tem faturas em atraso - cancela dívidas antigas e inicia nova cobrança<br/>
                      <strong>Cenário 3:</strong> Alterar plano com cobrança proporcional a partir da data da mudança
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PlanChangeDialog
        open={planChangeOpen}
        onOpenChange={setPlanChangeOpen}
        currentPlan={portalData?.subscription.plan_type || 'monthly'}
        onPlanChanged={() => {
          // Recarregar dados do portal após mudança de plano
          setTimeout(() => {
            handleManageSubscription();
          }, 2000);
        }}
      />
    </>
  );
};

export default AsaasManageSubscriptionButton;