import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, Zap, XCircle, RotateCcw } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import PlanChangeDialog from './PlanChangeDialog';
import UpdateCardOnlyModal from './UpdateCardOnlyModal';
import UpdateCardCancelOverdueModal from './UpdateCardCancelOverdueModal';

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
  const { hasActiveSubscription, checkSubscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [updateCardOnlyOpen, setUpdateCardOnlyOpen] = useState(false);
  const [updateCardCancelOverdueOpen, setUpdateCardCancelOverdueOpen] = useState(false);

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

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription');
      
      if (error) {
        throw error;
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao cancelar assinatura');
      }
      
      toast.success(data.message || 'Assinatura cancelada com sucesso');
      setCancelDialogOpen(false);
      
      // Atualizar dados do portal e subscription context
      await checkSubscription();
      setTimeout(() => {
        handleManageSubscription();
      }, 1000);
      
    } catch (error: any) {
      console.error('Erro ao cancelar assinatura:', error);
      toast.error(error.message || 'Erro ao cancelar assinatura');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setIsReactivating(true);
    
    try {
      console.log('[FRONTEND] Iniciando reativação de assinatura...');
      
      const { data, error } = await supabase.functions.invoke('reactivate-subscription', {
        method: 'POST'
      });
      
      console.log('[FRONTEND] Resposta da edge function:', { data, error });
      
      if (error) {
        console.error('[FRONTEND] Erro da edge function:', error);
        throw new Error(`Erro na comunicação: ${error.message}`);
      }
      
      if (!data || !data.success) {
        const errorMsg = data?.error || 'Erro desconhecido ao reativar assintura';
        console.error('[FRONTEND] Erro retornado:', errorMsg);
        
        // Check if it's a card error that requires updating
        if (data?.action === 'update_card') {
          setReactivateDialogOpen(false);
          setUpdateCardOnlyOpen(true);
          toast.error('Problema com o cartão cadastrado. Atualize seu cartão para continuar.');
          return;
        }
        
        throw new Error(errorMsg);
      }
      
      console.log('[FRONTEND] Reativação bem-sucedida:', data);
      toast.success(data.message || 'Assinatura reativada com sucesso! O pagamento foi processado no seu cartão.');
      setReactivateDialogOpen(false);
      
      // Atualizar contexto
      await checkSubscription();
      
      // Refresh portal data
      setTimeout(() => {
        handleManageSubscription();
      }, 1500);
      
    } catch (error: any) {
      console.error('[FRONTEND] Erro completo ao reativar assinatura:', error);
      const errorMessage = error.message || 'Erro ao reativar assinatura';
      toast.error(errorMessage);
    } finally {
      setIsReactivating(false);
    }
  };

  const handleModalSuccess = () => {
    // Recarregar dados do portal após sucesso
    setTimeout(() => {
      handleManageSubscription();
    }, 2000);
  };

  const isSubscriptionOverdue = portalData?.subscription.status === 'past_due';
  const hasOverduePayments = portalData?.recent_payments.some(payment => payment.status === 'OVERDUE');

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
        className="w-full flex items-center justify-center gap-2"
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
                    {/* Botão de Reativação - só mostra se está cancelada */}
                    {portalData?.subscription.cancel_at_period_end && (
                      <Button
                        variant="outline"
                        onClick={() => setReactivateDialogOpen(true)}
                        disabled={isLoading || isReactivating}
                        className="justify-start border-green-200 text-green-700 hover:bg-green-50"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reativar Assinatura
                      </Button>
                    )}

                    {/* Botão para usuários em dia */}
                    {!isSubscriptionOverdue && !hasOverduePayments && !portalData?.subscription.cancel_at_period_end && (
                      <Button
                        variant="outline"
                        onClick={() => setUpdateCardOnlyOpen(true)}
                        disabled={isLoading}
                        className="justify-start"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Atualizar Cartão de Crédito
                      </Button>
                    )}
                    
                    {/* Botão para usuários com dívidas */}
                    {(isSubscriptionOverdue || hasOverduePayments) && !portalData?.subscription.cancel_at_period_end && (
                      <Button
                        variant="outline"
                        onClick={() => setUpdateCardCancelOverdueOpen(true)}
                        disabled={isLoading}
                        className="justify-start border-orange-200 text-orange-700 hover:bg-orange-50"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Trocar Cartão e Cancelar Dívidas Antigas
                      </Button>
                    )}

                    {!portalData?.subscription.cancel_at_period_end && (
                      <Button
                        variant="outline"
                        onClick={() => setPlanChangeOpen(true)}
                        disabled={isLoading}
                        className="justify-start"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Alterar Plano (Upgrade/Downgrade)
                      </Button>
                    )}

                    {/* Botão de Cancelamento - só mostra se não está cancelada */}
                    {!portalData?.subscription.cancel_at_period_end && (
                      <Button
                        variant="outline"
                        onClick={() => setCancelDialogOpen(true)}
                        disabled={isLoading}
                        className="justify-start border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancelar Assinatura
                      </Button>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <p>
                      {portalData?.subscription.cancel_at_period_end ? (
                        <>
                          <strong>🔄 Assinatura cancelada:</strong> Reative criando uma nova assinatura com cobrança imediata<br/>
                          <strong>💳 Nova cobrança:</strong> O valor será cobrado no cartão assim que confirmar
                        </>
                      ) : !isSubscriptionOverdue && !hasOverduePayments ? (
                        <>
                          <strong>✅ Conta em dia:</strong> Atualize seu cartão de forma simples para futuras cobranças<br/>
                          <strong>📈 Upgrade/Downgrade:</strong> Altere seu plano com cobrança proporcional
                        </>
                      ) : (
                        <>
                          <strong>⚠️ Faturas pendentes:</strong> Cancele dívidas antigas e configure novo cartão<br/>
                          <strong>📈 Upgrade/Downgrade:</strong> Altere seu plano após regularizar a situação
                        </>
                      )}
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
        onPlanChanged={handleModalSuccess}
      />

      <UpdateCardOnlyModal
        open={updateCardOnlyOpen}
        onOpenChange={setUpdateCardOnlyOpen}
        onSuccess={handleModalSuccess}
      />

      <UpdateCardCancelOverdueModal
        open={updateCardCancelOverdueOpen}
        onOpenChange={setUpdateCardCancelOverdueOpen}
        onSuccess={handleModalSuccess}
      />

      {/* Dialog de Confirmação de Cancelamento */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Assinatura</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja cancelar sua assinatura? Esta ação não pode ser desfeita.
              </p>
              {portalData && (
                <div className="bg-amber-50 p-3 rounded-lg text-sm">
                  <p className="font-medium text-amber-800 mb-1">
                    ⚠️ Importante:
                  </p>
                  <ul className="text-amber-700 space-y-1">
                    <li>• Você continuará tendo acesso até <strong>{formatDate(portalData.subscription.current_period_end)}</strong></li>
                    <li>• Não haverá reembolso do período atual</li>
                    <li>• A cobrança automática será interrompida</li>
                    <li>• Você pode reativar antes do término do período</li>
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Manter Assinatura
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Sim, Cancelar Assinatura'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Confirmação de Reativação */}
      <AlertDialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar Assinatura</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Deseja reativar sua assinatura? Uma nova assinatura será criada e você será cobrado imediatamente.
              </p>
              {portalData && (
                <div className="bg-green-50 p-3 rounded-lg text-sm">
                  <p className="font-medium text-green-800 mb-1">
                    ✅ Detalhes da Reativação:
                  </p>
                  <ul className="text-green-700 space-y-1">
                    <li>• Nova assinatura {portalData.subscription.plan_type === 'monthly' ? 'mensal' : 'anual'}</li>
                    <li>• Cobrança imediata no seu cartão de crédito</li>
                    <li>• Acesso liberado após confirmação do pagamento</li>
                    <li>• Nova data de vencimento será definida</li>
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReactivating}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReactivateSubscription}
              disabled={isReactivating}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {isReactivating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reativando...
                </>
              ) : (
                'Sim, Reativar Assinatura'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AsaasManageSubscriptionButton;