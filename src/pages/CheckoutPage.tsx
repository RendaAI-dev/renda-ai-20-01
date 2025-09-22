import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { CreditCardForm } from '@/components/checkout/CreditCardForm';
import { PlanSummary } from '@/components/checkout/PlanSummary';
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';

interface CreditCardData {
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  holderName: string;
}

interface CheckoutState {
  planType: 'monthly' | 'annual';
  planName: string;
  planPrice: number;
  isUpgrade?: boolean;
}

const CheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscription, checkSubscription } = useSubscription();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [creditCardData, setCreditCardData] = useState<CreditCardData>({
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
    holderName: ''
  });

  // Estado do checkout passado via location ou localStorage
  const getCheckoutState = (): CheckoutState | null => {
    // Primeiro tenta obter do state da navegação
    if (location.state) {
      console.log('[Checkout Page] Dados obtidos via location.state:', location.state);
      return location.state as CheckoutState;
    }
    
    // Fallback: tentar obter do localStorage
    const storedState = localStorage.getItem('checkoutState');
    if (storedState) {
      try {
        const parsed = JSON.parse(storedState);
        console.log('[Checkout Page] Dados obtidos via localStorage:', parsed);
        // Limpar após uso
        localStorage.removeItem('checkoutState');
        return parsed;
      } catch (error) {
        console.error('[Checkout Page] Erro ao parsear dados do localStorage:', error);
      }
    }
    
    console.log('[Checkout Page] Nenhum dado de checkout encontrado');
    return null;
  };
  
  const checkoutData = getCheckoutState();
  
  useEffect(() => {
    if (!checkoutData) {
      console.log('[Checkout Page] Dados do checkout não encontrados, redirecionando para /plans');
      toast({
        title: "Erro no checkout",
        description: "Dados do plano não encontrados. Redirecionando...",
        variant: "destructive"
      });
      navigate('/plans');
      return;
    }
    
    console.log('[Checkout Page] Checkout inicializado com dados:', checkoutData);
  }, [checkoutData, navigate, toast]);

  if (!checkoutData) {
    return null;
  }

  const handleCreditCardChange = (field: keyof CreditCardData, value: string) => {
    setCreditCardData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateCreditCard = (): boolean => {
    const { number, expiryMonth, expiryYear, ccv, holderName } = creditCardData;
    
    if (!number || !expiryMonth || !expiryYear || !ccv || !holderName) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os dados do cartão",
        variant: "destructive"
      });
      return false;
    }

    // Validate card number (basic Luhn algorithm)
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
    
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
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
      if (validateCreditCard()) {
        setStep(2);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate('/plans');
    }
  };

  const handleProcessPayment = async () => {
    if (!validateCreditCard()) return;

    setLoading(true);
    setStep(3); // Processing step

    try {
      const { data, error } = await supabase.functions.invoke('transparent-checkout', {
        body: {
          planType: checkoutData.planType,
          creditCard: creditCardData,
          isUpgrade: checkoutData.isUpgrade,
          currentSubscriptionId: subscription?.id
        }
      });

      if (error) throw error;

      if (data.success) {
        setStep(4); // Success step
        
        // Refresh subscription data
        await checkSubscription();
        
        toast({
          title: "Pagamento processado!",
          description: "Sua assinatura foi ativada com sucesso.",
        });

        // Redirect after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        throw new Error(data.error || 'Erro no processamento do pagamento');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      
      // Parse error message to provide more specific feedback
      let errorTitle = "Erro no pagamento";
      let errorDescription = "Ocorreu um erro ao processar o pagamento. Tente novamente.";
      
      if (error.message) {
        if (error.message.includes('não encontrado')) {
          errorTitle = "Plano não disponível";
          errorDescription = "O plano selecionado não está disponível no momento.";
        } else if (error.message.includes('configuração')) {
          errorTitle = "Erro de configuração";
          errorDescription = "Há um problema com a configuração do pagamento. Entre em contato com o suporte.";
        } else if (error.message.includes('cartão') || error.message.includes('credit card')) {
          errorTitle = "Erro no cartão";
          errorDescription = "Verifique os dados do cartão e tente novamente.";
        } else if (error.message.includes('customer')) {
          errorTitle = "Erro nos dados do cliente";
          errorDescription = "Verifique seus dados cadastrais e tente novamente.";
        } else {
          errorDescription = error.message;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive"
      });
      
      setStep(2); // Back to confirmation step
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center mb-2">Finalizar Assinatura</h1>
          <p className="text-muted-foreground text-center">
            Complete os dados para ativar sua assinatura
          </p>
        </div>

        <CheckoutSteps currentStep={step} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Main Content */}
          <div className="space-y-6">
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Dados do Cartão de Crédito</CardTitle>
                </CardHeader>
                <CardContent>
                  <CreditCardForm
                    data={creditCardData}
                    onChange={handleCreditCardChange}
                    disabled={loading}
                  />
                  
                  <div className="flex gap-4 mt-6">
                    <Button variant="outline" onClick={handleBack} className="flex-1">
                      Voltar
                    </Button>
                    <Button onClick={handleNext} className="flex-1">
                      Continuar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Confirmar Pagamento</CardTitle>
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
                      <Button 
                        onClick={handleProcessPayment} 
                        className="flex-1"
                        disabled={loading}
                      >
                        {loading ? 'Processando...' : 'Confirmar Pagamento'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <h3 className="font-medium mb-2">Processando Pagamento...</h3>
                  <p className="text-sm text-muted-foreground">
                    Aguarde enquanto processamos seu pagamento
                  </p>
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-green-500 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-medium mb-2 text-green-600">Pagamento Aprovado!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sua assinatura foi ativada com sucesso
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Redirecionando para o dashboard...
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <PlanSummary 
              planName={checkoutData.planName}
              planType={checkoutData.planType}
              planPrice={checkoutData.planPrice}
              isUpgrade={checkoutData.isUpgrade}
            />
            
            <CheckoutSummary 
              planPrice={checkoutData.planPrice}
              planType={checkoutData.planType}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;