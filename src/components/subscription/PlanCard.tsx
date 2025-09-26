
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import PlanChangeDialog from '@/components/subscription/PlanChangeDialog';
import UpdateCardOnlyModal from '@/components/subscription/UpdateCardOnlyModal';
import { logSilent, logError } from '@/utils/consoleOptimizer';

interface PlanCardProps {
  name: string;
  price: string;
  period: string;
  originalPrice?: string;
  savings?: string;
  description: string;
  features: string[];
  popular?: boolean;
  planType: 'monthly' | 'annual';
}

const PlanCard: React.FC<PlanCardProps> = ({
  name,
  price,
  period,
  originalPrice,
  savings,
  description,
  features,
  popular = false,
  planType
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPlanChangeDialog, setShowPlanChangeDialog] = useState(false);
  const [showUpdateCardModal, setShowUpdateCardModal] = useState(false);
  const { subscription, hasActiveSubscription, checkSubscription } = useSubscription();
  const { t } = usePreferences();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Verifica se é o plano atual e se está ativo
  const isCurrentPlan = subscription?.plan_type === planType && hasActiveSubscription;
  
  // Verifica se é o plano atual mas está vencido (expirado)
  const isExpiredCurrentPlan = subscription?.plan_type === planType && !hasActiveSubscription;
  
  // Verifica se pode fazer upgrade (está no plano mensal e visualizando o anual)
  const canUpgrade = subscription?.plan_type === 'monthly' && planType === 'annual' && hasActiveSubscription;
  
  // Verifica se pode fazer downgrade (está no plano anual e visualizando o mensal)
  const canDowngrade = subscription?.plan_type === 'annual' && planType === 'monthly' && hasActiveSubscription;
  
  const waitForValidSession = async (maxAttempts = 3, delayMs = 1000) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        if (attempt === maxAttempts) throw sessionError;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      if (session?.user) {
        return session;
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return null;
  };

  const parsePrice = (priceString: string): number => {
    try {
      // Remove 'R$ ' e substitui ',' por '.'
      const cleanPrice = priceString
        .replace(/R\$\s*/g, '')
        .replace(/\./g, '') // Remove pontos de milhares
        .replace(',', '.'); // Substitui vírgula decimal por ponto
      
      const parsedPrice = parseFloat(cleanPrice);
      
      if (isNaN(parsedPrice)) {
        throw new Error(`Preço inválido: ${priceString}`);
      }
      
      return parsedPrice;
    } catch (error) {
      logError('Erro ao parsear preço:', error);
      throw error;
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('reactivate-subscription', {
        body: { planType }
      });

      if (error) {
        logError('Erro na reativação da assinatura:', error);
        throw new Error(error.message || 'Erro desconhecido ao reativar assinatura');
      }
      
      if (!data || !data.success) {
        const errorMsg = data?.error || 'Erro desconhecido ao reativar assinatura';
        
        // Check if it's a card error that requires updating
        if (data?.action === 'update_card') {
          setShowUpdateCardModal(true);
          toast({
            title: "Problema com o cartão",
            description: "Atualize seu cartão para continuar.",
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorMsg);
      }
      
      toast({
        title: "Assinatura reativada!",
        description: "O pagamento foi processado no seu cartão cadastrado.",
      });
      
      // Atualizar contexto
      await checkSubscription();
      
    } catch (error: any) {
      logError('Erro ao reativar assinatura:', error);
      toast({
        title: "Erro na reativação",
        description: error.message || "Algo deu errado. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleCheckout = async () => {
    try {
      setIsLoading(true);
      
      // Se é assinatura expirada, chamar reativação direta
      if (isExpiredCurrentPlan) {
        await handleReactivateSubscription();
        setIsLoading(false);
        return;
      }
      
      // Se é um upgrade ou downgrade para usuários com assinatura ativa, abrir dialog
      if (hasActiveSubscription && (canUpgrade || canDowngrade)) {
        setShowPlanChangeDialog(true);
        setIsLoading(false);
        return;
      }
      
      // Aguardar por uma sessão válida com retry
      const session = await waitForValidSession();
      
      if (!session?.user) {
        // Armazenar dados do plano no localStorage para recuperação posterior
        const checkoutData = {
          planType,
          planName: name,
          planPrice: parsePrice(price),
          timestamp: Date.now()
        };
        localStorage.setItem('pendingCheckout', JSON.stringify(checkoutData));
        
        toast({
          title: "Login necessário",
          description: "Você precisa estar logado para fazer uma assinatura.",
          variant: "destructive",
        });
        
        navigate(`/register?planType=${planType}`);
        return;
      }

      // Navigate to transparent checkout page
      const isUpgrade = hasActiveSubscription && (canUpgrade || canDowngrade);
      const parsedPrice = parsePrice(price);
      
      const checkoutState = {
        planType,
        planName: name,
        planPrice: parsedPrice,
        isUpgrade
      };
      
      // SEMPRE salvar no localStorage antes da navegação
      localStorage.setItem('checkoutState', JSON.stringify(checkoutState));
      
      // Tentar navegação normal primeiro
      try {
        navigate('/checkout', { state: checkoutState });
      } catch (navError) {
        logError('Erro na navegação, usando fallback:', navError);
        navigate('/checkout');
      }
      
    } catch (error) {
      logError('Erro no checkout:', error);
      toast({
        title: "Erro no checkout",
        description: error instanceof Error ? error.message : "Algo deu errado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanChanged = () => {
    // Recarregar informações da assinatura após mudança
    checkSubscription();
    setShowPlanChangeDialog(false);
  };

  const getButtonContent = () => {
    if (isCurrentPlan) {
      return (
        <>
          <Check className="mr-2 h-4 w-4" />
          {t('plans.current')}
        </>
      );
    }
    
    if (isExpiredCurrentPlan) {
      return (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Renovar assinatura
        </>
      );
    }
    
    if (canUpgrade) {
      return t('plans.upgradeToAnnual');
    }
    
    if (canDowngrade) {
      return t('plans.downgrade');
    }
    
    return hasActiveSubscription ? t('plans.upgrade') : t('plans.subscribe');
  };

  const getButtonVariant = () => {
    if (isCurrentPlan) return 'outline';
    if (isExpiredCurrentPlan) return 'default';
    if (canUpgrade) return 'default';
    return 'default';
  };

  return (
    <Card className={`relative ${popular ? 'border-primary shadow-xl' : ''} ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
            Mais Popular
          </div>
        </div>
      )}
      
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <Badge variant="success" className="shadow-md">
            {t('plans.current')}
          </Badge>
        </div>
      )}
      
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{name}</CardTitle>
        <div className="mt-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl font-bold">{price}</span>
            <span className="text-muted-foreground">{period}</span>
          </div>
          {originalPrice && (
            <div className="mt-2">
              <span className="text-sm text-muted-foreground line-through">{originalPrice}</span>
              <span className="ml-2 text-sm font-medium text-green-600">{savings}</span>
            </div>
          )}
        </div>
        <p className="text-muted-foreground mt-2">{description}</p>
      </CardHeader>
      
      <CardContent>
        <ul className="space-y-3 mb-8">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-center gap-3">
              <div className="h-2 w-2 bg-primary rounded-full"></div>
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
        
        <Button 
          className="w-full" 
          size="lg"
          onClick={handleCheckout}
          disabled={isLoading || (isCurrentPlan && !isExpiredCurrentPlan)}
          variant={getButtonVariant()}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            getButtonContent()
          )}
        </Button>

        {canUpgrade && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            {t('plans.saveWithAnnual')}
          </p>
        )}
      </CardContent>

      <PlanChangeDialog
        open={showPlanChangeDialog}
        onOpenChange={setShowPlanChangeDialog}
        currentPlan={subscription?.plan_type || ''}
        onPlanChanged={handlePlanChanged}
      />

      <UpdateCardOnlyModal
        open={showUpdateCardModal}
        onOpenChange={setShowUpdateCardModal}
        onSuccess={() => {
          setShowUpdateCardModal(false);
          // Tentar reativar novamente após atualizar o cartão
          handleReactivateSubscription();
        }}
      />
    </Card>
  );
};

export default PlanCard;
