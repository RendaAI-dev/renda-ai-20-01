import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { usePaymentConfirmation } from '@/hooks/usePaymentConfirmation';
import { useToast } from '@/components/ui/use-toast';
import { useEffect, useState } from 'react';

const PaymentConfirmationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const email = searchParams.get('email') || '';
  const planType = searchParams.get('plan_type') || 'monthly';
  const subscriptionId = searchParams.get('subscription_id') || '';
  const paymentId = searchParams.get('payment_id') || '';

  const { status, subscription, error, verifyPaymentOnAsaas, syncPaymentManually } = usePaymentConfirmation(subscriptionId, paymentId, email);

  const handleManualSync = async () => {
    if (isManualSyncing) return;
    
    setIsManualSyncing(true);
    try {
      toast({
        title: "Sincronizando...",
        description: "Buscando dados do pagamento no Asaas...",
      });

      const success = await syncPaymentManually();
      if (success) {
        toast({
          title: "Sincronização concluída!",
          description: "Verificando status do pagamento...",
        });
        
        // Aguardar 2 segundos e verificar status
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast({
          title: "Erro na sincronização",
          description: "Não foi possível sincronizar o pagamento. Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro na sincronização manual:', error);
      toast({
        title: "Erro na sincronização", 
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  useEffect(() => {
    if (status === 'confirmed') {
      toast({
        title: "Pagamento confirmado!",
        description: "Redirecionando para a página de sucesso...",
      });

      setTimeout(() => {
        const params = new URLSearchParams({
          email,
          plan_type: planType,
          session_id: `${subscriptionId}_confirmed_${Date.now()}`
        });
        navigate(`/payment-success?${params.toString()}`);
      }, 2000);
    }
  }, [status, navigate, email, planType, subscriptionId, toast]);

  const renderStatus = () => {
    switch (status) {
      case 'checking':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <h2 className="text-xl font-semibold">Confirmando pagamento...</h2>
            <p className="text-muted-foreground">
              Aguarde enquanto processamos seu pagamento. Isso pode levar alguns minutos.
            </p>
            <div className="mt-6">
              <Button 
                onClick={handleManualSync}
                disabled={isManualSyncing}
                variant="outline"
                size="sm"
                className="flex items-center"
              >
                {isManualSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Forçar Sincronização
              </Button>
            </div>
          </div>
        );
      
      case 'confirmed':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <h2 className="text-xl font-semibold text-green-600">Pagamento confirmado!</h2>
            <p className="text-muted-foreground">
              Redirecionando para a página de sucesso...
            </p>
          </div>
        );
      
      case 'timeout':
        return (
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500" />
            <h2 className="text-xl font-semibold text-yellow-600">Tempo limite excedido</h2>
            <p className="text-muted-foreground">
              O pagamento está demorando mais que o esperado para ser processado.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
              <Button 
                onClick={handleManualSync}
                disabled={isManualSyncing}
                variant="default"
                className="flex items-center"
              >
                {isManualSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Forçar Sincronização
              </Button>
              <Button 
                onClick={verifyPaymentOnAsaas}
                variant="outline"
                className="flex items-center"
              >
                Verificar Status
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button onClick={() => navigate('/payment-success?timeout=true')}>
                Continuar para página de sucesso
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        );
      
      case 'error':
        return (
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-500" />
            <h2 className="text-xl font-semibold text-red-600">Erro na confirmação</h2>
            <p className="text-muted-foreground">
              {error || 'Ocorreu um erro ao confirmar o pagamento'}
            </p>
            <Button onClick={() => navigate('/plans')} variant="outline" className="mt-4">
              Voltar aos planos
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              Processando Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {renderStatus()}
            
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>Email: {email}</p>
              <p>Plano: {planType === 'monthly' ? 'Mensal' : 'Anual'}</p>
              {paymentId && (
                <p className="font-mono text-xs">ID: {paymentId}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentConfirmationPage;