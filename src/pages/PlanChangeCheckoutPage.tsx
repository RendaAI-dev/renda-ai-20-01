import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useNewPlanConfig } from '@/hooks/useNewPlanConfig';
import { CreditCardForm } from '@/components/checkout/CreditCardForm';
import { SavedCardSelector } from '@/components/checkout/SavedCardSelector';
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';
import { PlanChangeSummary } from '@/components/checkout/PlanChangeSummary';
import { Settings, AlertTriangle } from 'lucide-react';
import { PlanChangeDiagnostic } from '@/components/admin/PlanChangeDiagnostic';
interface CreditCardData {
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  holderName: string;
  holderCpf: string;
}
interface PlanChangeCheckoutState {
  currentPlan: {
    type: string;
    name: string;
    price: number;
  };
  newPlan: {
    type: string;
    name: string;
    price: number;
  };
  priceDifference: number;
  operationType: 'upgrade' | 'downgrade' | 'lateral';
}
const PlanChangeCheckoutPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    toast
  } = useToast();
  const {
    subscription,
    checkSubscription
  } = useSubscription();
  const {
    config,
    isLoading: configLoading
  } = useNewPlanConfig();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [useNewCard, setUseNewCard] = useState(true);
  const [selectedCardToken, setSelectedCardToken] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [functionAvailable, setFunctionAvailable] = useState<boolean | null>(null);
  const [creditCardData, setCreditCardData] = useState<CreditCardData>({
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
    holderName: '',
    holderCpf: ''
  });

  // Verificar se a Edge Function está disponível
  const checkFunctionAvailability = async (): Promise<boolean> => {
    try {
      console.log('[FUNCTION-CHECK] Verificando disponibilidade da Edge Function...');
      const {
        error
      } = await supabase.functions.invoke('change-plan-checkout', {
        body: {
          test: true
        }
      });
      if (error && (error.message?.includes('Failed to fetch') || error.message?.includes('net::ERR_FAILED'))) {
        console.log('[FUNCTION-CHECK] Função não está deployada:', error.message);
        setFunctionAvailable(false);
        return false;
      }
      console.log('[FUNCTION-CHECK] Função está disponível');
      setFunctionAvailable(true);
      return true;
    } catch (error) {
      console.error('[FUNCTION-CHECK] Erro ao verificar função:', error);
      setFunctionAvailable(false);
      return false;
    }
  };

  // Get current user on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Verificar disponibilidade da função
      await checkFunctionAvailability();
    };
    getCurrentUser();
  }, []);

  // Obter dados da mudança de plano
  const getCheckoutState = (): PlanChangeCheckoutState | null => {
    const newPlanType = searchParams.get('newPlan') as 'monthly' | 'annual';
    const currentPlanType = searchParams.get('currentPlan') as 'monthly' | 'annual';
    if (!newPlanType || !currentPlanType || !config || configLoading) {
      console.log('Parâmetros ou config faltando:', {
        newPlanType,
        currentPlanType,
        hasConfig: !!config,
        configLoading
      });
      return null;
    }
    console.log('Config plans disponíveis:', config.plans);

    // Buscar planos que tenham o pricing para o período específico
    const currentPlan = config.plans.find(plan => plan.pricing[currentPlanType] !== undefined);
    const newPlan = config.plans.find(plan => plan.pricing[newPlanType] !== undefined);
    console.log('Planos encontrados:', {
      currentPlan,
      newPlan
    });
    if (!currentPlan?.pricing[currentPlanType] || !newPlan?.pricing[newPlanType]) {
      console.error('Pricing não encontrado para os períodos:', {
        currentPlanType,
        newPlanType,
        currentPlanPricing: currentPlan?.pricing,
        newPlanPricing: newPlan?.pricing
      });
      return null;
    }
    const currentPlanPricing = currentPlan.pricing[currentPlanType]!;
    const newPlanPricing = newPlan.pricing[newPlanType]!;
    const priceDifference = newPlanPricing.amount - currentPlanPricing.amount;
    let operationType: 'upgrade' | 'downgrade' | 'lateral' = 'lateral';
    if (priceDifference > 0) operationType = 'upgrade';else if (priceDifference < 0) operationType = 'downgrade';
    const checkoutData = {
      currentPlan: {
        type: currentPlanType,
        name: currentPlan.name || `Plano ${currentPlanType === 'monthly' ? 'Mensal' : 'Anual'}`,
        price: currentPlanPricing.amount
      },
      newPlan: {
        type: newPlanType,
        name: newPlan.name || `Plano ${newPlanType === 'monthly' ? 'Mensal' : 'Anual'}`,
        price: newPlanPricing.amount
      },
      priceDifference,
      operationType
    };
    console.log('Checkout data gerado:', checkoutData);
    return checkoutData;
  };
  const [checkoutData, setCheckoutData] = useState<PlanChangeCheckoutState | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  useEffect(() => {
    if (configLoading) return;
    const data = getCheckoutState();
    if (!data) {
      toast({
        title: "Erro na mudança de plano",
        description: "Dados da mudança não encontrados. Redirecionando...",
        variant: "destructive"
      });
      navigate('/plans');
      return;
    }
    setCheckoutData(data);
    setDataLoading(false);
  }, [configLoading, config, navigate, toast, searchParams]);

  // Verificar se usuário tem assinatura ativa
  useEffect(() => {
    if (!subscription) {
      toast({
        title: "Assinatura não encontrada",
        description: "Você precisa ter uma assinatura ativa para alterar o plano.",
        variant: "destructive"
      });
      navigate('/plans');
    }
  }, [subscription, navigate, toast]);

  // Mostrar loading
  if (dataLoading || configLoading || !checkoutData || functionAvailable === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {functionAvailable === null ? 'Verificando disponibilidade do sistema...' : 'Carregando dados da mudança...'}
          </p>
        </div>
      </div>;
  }

  // Se a função não está disponível, mostrar alerta
  if (functionAvailable === false) {
    return <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert className="border-destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sistema Indisponível</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p>A função de mudança de plano não está disponível no momento.</p>
              <p className="text-sm text-muted-foreground">
                Erro técnico: A Edge Function 'change-plan-checkout' não está deployada no Supabase.
              </p>
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Para resolver:</p>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Acesse o painel do Supabase</li>
                  <li>Vá para a seção "Edge Functions"</li>
                  <li>Execute o deploy da função 'change-plan-checkout'</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>
          <div className="mt-4 space-y-2">
            <Button onClick={() => navigate('/plans')} className="w-full">
              Voltar aos Planos
            </Button>
            <Button onClick={() => checkFunctionAvailability()} variant="outline" className="w-full">
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>;
  }
  const handleCreditCardChange = (field: keyof CreditCardData, value: string) => {
    setCreditCardData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const validateCreditCard = (): boolean => {
    const {
      number,
      expiryMonth,
      expiryYear,
      ccv,
      holderName,
      holderCpf
    } = creditCardData;
    if (!number || !expiryMonth || !expiryYear || !ccv || !holderName || !holderCpf) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os dados do cartão, incluindo o CPF do titular",
        variant: "destructive"
      });
      return false;
    }

    // Validate CPF length
    if (holderCpf.length !== 11) {
      toast({
        title: "CPF inválido",
        description: "O CPF do titular deve ter 11 dígitos",
        variant: "destructive"
      });
      return false;
    }

    // Validate card number
    const cardNumber = number.replace(/\s/g, '');
    if (cardNumber.length < 13 || cardNumber.length > 19) {
      toast({
        title: "Cartão inválido",
        description: "Número do cartão deve ter entre 13 e 19 dígitos",
        variant: "destructive"
      });
      return false;
    }

    // Validate expiry
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const expYear = parseInt(`20${expiryYear}`);
    const expMonth = parseInt(expiryMonth);
    if (expYear < currentYear || expYear === currentYear && expMonth < currentMonth) {
      toast({
        title: "Cartão expirado",
        description: "O cartão está expirado",
        variant: "destructive"
      });
      return false;
    }
    return true;
  };
  const handleNext = () => {
    if (step === 1) {
      // If using saved card, skip validation
      if (selectedCardToken && !useNewCard) {
        setStep(2);
      } else if (validateCreditCard()) {
        setStep(2);
      }
    }
  };
  const handleCardSelect = (cardToken: string | null) => {
    setSelectedCardToken(cardToken);
    setUseNewCard(cardToken === null);
  };
  const handleNewCard = () => {
    setUseNewCard(true);
    setSelectedCardToken(null);
  };
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate('/plans');
    }
  };
  const handleProcessPayment = async () => {
    // Verificar disponibilidade da função antes de processar
    const isAvailable = await checkFunctionAvailability();
    if (!isAvailable) {
      toast({
        title: "Sistema Indisponível",
        description: "🚀 A função de mudança de plano não está deployada. Acesse o painel do Supabase e execute o deploy das Edge Functions.",
        variant: "destructive"
      });
      return;
    }

    // Validate payment method
    if (useNewCard && !validateCreditCard()) return;
    if (!useNewCard && !selectedCardToken) {
      toast({
        title: "Erro de validação",
        description: "Selecione um cartão salvo ou preencha os dados do novo cartão.",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    setStep(3); // Processing step

    try {
      const body: any = {
        newPlanType: checkoutData.newPlan.type,
        currentPlanType: checkoutData.currentPlan.type
      };

      // Add payment method data
      if (useNewCard) {
        body.creditCard = creditCardData;
      } else {
        body.savedCardToken = selectedCardToken;
      }
      console.log('[PLAN-CHANGE-CHECKOUT] Iniciando chamada da Edge Function...');
      console.log('[PLAN-CHANGE-CHECKOUT] Body da requisição:', body);
      console.log('[PLAN-CHANGE-CHECKOUT] Subscription atual:', subscription);
      const {
        data,
        error
      } = await supabase.functions.invoke('change-plan-checkout', {
        body
      });
      console.log('[PLAN-CHANGE-CHECKOUT] Resposta da Edge Function:', {
        data,
        error
      });
      if (error) {
        console.error('[PLAN-CHANGE-CHECKOUT] Erro na Edge Function:', error);

        // Tratamento específico para erro de cliente Asaas não encontrado
        if (error.message?.includes('Cliente Asaas não encontrado')) {
          console.log('[PLAN-CHANGE-CHECKOUT] Tentando sincronizar dados do Asaas...');
          
          try {
            // Tentar sincronizar dados do usuário
            const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-asaas-payment', {
              body: { 
                email: currentUser?.email,
                subscriptionId: subscription?.asaas_subscription_id 
              }
            });

            if (syncError) {
              console.error('[PLAN-CHANGE-CHECKOUT] Erro na sincronização:', syncError);
              throw new Error('Não foi possível sincronizar os dados. Tente novamente.');
            }

            console.log('[PLAN-CHANGE-CHECKOUT] Sincronização concluída, tentando novamente...');
            
            // Tentar novamente após sincronização
            const { data: retryData, error: retryError } = await supabase.functions.invoke('change-plan-checkout', {
              body
            });

            if (retryError) {
              throw new Error(retryError.message || 'Erro após sincronização');
            }

            if (retryData?.success) {
              setStep(4);
              await checkSubscription();
              toast({
                title: "Plano alterado com sucesso!",
                description: "Dados sincronizados e plano alterado."
              });
              setTimeout(() => navigate('/plans?success=plan_change'), 1500);
              return;
            }
          } catch (syncError) {
            console.error('[PLAN-CHANGE-CHECKOUT] Erro na recuperação:', syncError);
            throw new Error('Falha na sincronização. Entre em contato com o suporte.');
          }
        }

        // Tratamento de outros tipos de erro
        let errorMessage = "Erro ao processar mudança de plano";
        if (error.message?.includes('Failed to fetch') || error.message?.includes('net::ERR_FAILED')) {
          errorMessage = "🚀 A Edge Function não está deployada ou acessível. Acesse o painel do Supabase e execute o deploy da função 'change-plan-checkout'.";
        } else if (error.message?.includes('401') || error.message?.includes('authentication')) {
          errorMessage = "Sessão expirada. Faça login novamente.";
        } else if (error.message?.includes('404')) {
          errorMessage = "Serviço temporariamente indisponível. Tente novamente em alguns minutos.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }
      if (data?.success) {
        setStep(4); // Success step

        // Refresh subscription data
        await checkSubscription();
        toast({
          title: "Plano alterado com sucesso!",
          description: "Redirecionando para confirmação..."
        });

        // Redirect to plans page with success message
        setTimeout(() => {
          navigate('/plans?success=plan_change');
        }, 1500);
      } else {
        const errorMessage = data?.error || 'Erro desconhecido na alteração do plano';
        console.error('[PLAN-CHANGE-CHECKOUT] Erro retornado pela função:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('[PLAN-CHANGE-CHECKOUT] Erro completo:', error);
      let errorMessage = "Ocorreu um erro ao alterar o plano. Tente novamente.";
      if (error.message?.includes('Failed to fetch') || error.message?.includes('net::ERR_FAILED')) {
        errorMessage = "🚀 A Edge Function não está deployada ou acessível. Acesse o painel do Supabase e execute o deploy da função 'change-plan-checkout'.";
      } else if (error.message?.includes('Edge Function Error')) {
        errorMessage = "Erro na comunicação com o servidor. Verifique sua conexão e tente novamente.";
      } else if (error.message?.includes('Failed to send a request')) {
        errorMessage = "Não foi possível conectar ao servidor. Verifique se a Edge Function foi deployada.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Erro na alteração do plano",
        description: errorMessage,
        variant: "destructive"
      });
      setStep(2); // Back to confirmation step
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center mb-2">Alterar Plano</h1>
          <p className="text-muted-foreground text-center">
            Complete os dados para alterar sua assinatura
          </p>
          
          
        </div>

        {showDiagnostic && <div className="mb-6">
            <PlanChangeDiagnostic />
          </div>}

        <CheckoutSteps currentStep={step} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Main Content */}
          <div className="space-y-6">
            {step === 1 && <div className="space-y-6">
                <SavedCardSelector onCardSelect={handleCardSelect} onNewCard={handleNewCard} disabled={loading} />
                
                {useNewCard && <Card>
                    <CardHeader>
                      <CardTitle>Dados do Novo Cartão</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CreditCardForm data={creditCardData} onChange={handleCreditCardChange} disabled={loading} />
                    </CardContent>
                  </Card>}
                
                <div className="flex gap-4">
                  <Button variant="outline" onClick={handleBack} className="flex-1">
                    Voltar
                  </Button>
                  <Button onClick={handleNext} className="flex-1" disabled={loading}>
                    Continuar
                  </Button>
                </div>
              </div>}

            {step === 2 && <Card>
                <CardHeader>
                  <CardTitle>Confirmar Alteração</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-medium mb-2">Dados do Cartão</h3>
                      <p className="text-sm text-muted-foreground">
                        •••• •••• •••• {creditCardData.number.slice(-4)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {creditCardData.holderName}
                      </p>
                    </div>
                    
                    <div className="flex gap-4">
                      <Button variant="outline" onClick={handleBack} className="flex-1">
                        Voltar
                      </Button>
                      <Button onClick={handleProcessPayment} className="flex-1" disabled={loading}>
                        {loading ? 'Processando...' : 'Confirmar Alteração'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>}

            {step === 3 && <Card>
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <h3 className="font-medium mb-2">Processando Alteração...</h3>
                  <p className="text-sm text-muted-foreground">
                    Aguarde enquanto processamos a mudança do seu plano
                  </p>
                </CardContent>
              </Card>}

            {step === 4 && <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-green-500 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-medium mb-2 text-green-600">Plano Alterado com Sucesso!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sua assinatura foi alterada para {checkoutData.newPlan.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Redirecionando para seus planos...
                  </p>
                </CardContent>
              </Card>}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <PlanChangeSummary currentPlan={checkoutData.currentPlan} newPlan={checkoutData.newPlan} priceDifference={checkoutData.priceDifference} operationType={checkoutData.operationType} />
            
            <CheckoutSummary planPrice={checkoutData.newPlan.price} planType={checkoutData.newPlan.type as 'monthly' | 'annual'} />
          </div>
        </div>
      </div>
    </div>;
};
export default PlanChangeCheckoutPage;