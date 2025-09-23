import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { getPlanTypeFromPriceId } from '@/utils/subscriptionUtils';
import { useBrandingConfig } from '@/hooks/useBrandingConfig';
import { useNewPlanConfig } from '@/hooks/useNewPlanConfig';
import { usePreferences } from '@/contexts/PreferencesContext';
import { CPFInput } from '@/components/common/CPFInput';
import { CEPInput } from '@/components/common/CEPInput';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { EnhancedDatePicker } from '@/components/ui/enhanced-date-picker';
import { ArrowLeft } from 'lucide-react';
import type { Address } from '@/services/viacepService';

const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = usePreferences();
  const { companyName, logoUrl, logoAltText } = useBrandingConfig();
  const { config } = useNewPlanConfig();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>();
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState<Address | null>({
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    ibge: '',
    ddd: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const priceId = searchParams.get('priceId');
  const planType = searchParams.get('planType');

  // Função para aguardar uma sessão válida ser estabelecida
  const waitForValidSession = async (maxRetries = 20, retryDelay = 1500): Promise<any> => {
    console.log(`[waitForValidSession] Iniciando com ${maxRetries} tentativas a cada ${retryDelay}ms`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[waitForValidSession] Tentativa ${attempt}/${maxRetries} - Verificando sessão...`);
      
      try {
        // Verificação dupla: getSession E getUser
        const [sessionResult, userResult] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser()
        ]);
        
        const { data: { session }, error: sessionError } = sessionResult;
        const { data: { user }, error: userError } = userResult;
        
        if (sessionError) {
          console.error(`[waitForValidSession] Erro de sessão na tentativa ${attempt}:`, sessionError);
          if (attempt === maxRetries) throw sessionError;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        if (userError) {
          console.error(`[waitForValidSession] Erro de usuário na tentativa ${attempt}:`, userError);
          if (attempt === maxRetries) throw userError;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // Verificar se temos sessão E usuário válidos
        if (session?.access_token && session?.user?.id && user?.id) {
          console.log(`[waitForValidSession] ✅ Sessão e usuário válidos encontrados na tentativa ${attempt}:`, {
            sessionUserId: session.user.id,
            userDataId: user.id,
            email: session.user.email,
            tokenLength: session.access_token.length,
            userConfirmed: user.email_confirmed_at ? 'Sim' : 'Não'
          });
          return session;
        }
        
        console.log(`[waitForValidSession] ⏳ Tentativa ${attempt}: Aguardando sessão e usuário serem estabelecidos`, {
          hasSession: !!session,
          hasToken: !!session?.access_token,
          hasSessionUser: !!session?.user?.id,
          hasUser: !!user?.id
        });
        
        // Tentar refresh da sessão nas últimas tentativas
        if (attempt > maxRetries - 3) {
          console.log(`[waitForValidSession] 🔄 Tentativa ${attempt}: Fazendo refresh da sessão`);
          await supabase.auth.refreshSession();
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error(`[waitForValidSession] Erro inesperado na tentativa ${attempt}:`, error);
        if (attempt === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw new Error('Timeout: Não foi possível estabelecer uma sessão válida após 30 segundos');
  };

  // Função para formatar o número de telefone como (XX) XXXXX-XXXX
  const formatPhoneNumber = (value: string) => {
    // Remove todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, '');
    
    // Aplica a formatação
    if (numbers.length <= 2) {
      return numbers.length ? `(${numbers}` : '';
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  // Função para lidar com a mudança no campo de WhatsApp
  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatPhoneNumber(e.target.value);
    setWhatsapp(formattedValue);
  };

  const handleAddressFound = (foundAddress: Address) => {
    setAddress(foundAddress);
  };

  const handleAddressChange = (field: keyof Address, value: string) => {
    if (address) {
      setAddress({
        ...address,
        [field]: value
      });
    }
  };

  // Função para fazer polling do redirecionamento de pagamento - REMOVIDO
  // const pollForPaymentRedirect = async (): Promise<string | null> => {
  // Toda a lógica de polling foi removida
  
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    
    // Adicionar classe de loading ao formulário
    const formElement = document.getElementById('register-form');
    if (formElement) {
      formElement.classList.add('form-loading');
    }
  
    if (!priceId && !planType) {
      setError("Plano não encontrado na URL. Por favor, selecione um plano.");
      setIsLoading(false);
      formElement?.classList.remove('form-loading');
      navigate('/plans');
      return;
    }
  
    try {
      // Normaliza o número de telefone antes de enviar (remove caracteres não numéricos)
      const formattedPhone = whatsapp.replace(/\D/g, '');
  
      console.log('Iniciando processo de registro...');
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: formattedPhone,
            cpf: cpf,
            birth_date: birthDate?.toISOString().split('T')[0],
            address: address,
            cep: cep,
          },
        },
      });
  
      if (signUpError) {
        throw signUpError;
      }

      if (!signUpData.user) {
        throw new Error('Usuário não retornado após o cadastro.');
      }

      console.log('Usuário criado com sucesso');
      
      // Mostrar feedback de progresso
      toast({
        title: "Conta criada com sucesso!",
        description: "Aguardando estabelecer sessão...",
      });

      // Aguardar que a sessão seja estabelecida
      console.log('🚀 Aguardando estabelecer sessão após registro...');
      let validSession;
      try {
        validSession = await waitForValidSession(20, 1500);
        console.log('✅ Sessão estabelecida com sucesso!');
      } catch (sessionError) {
        console.error('❌ Erro ao aguardar sessão:', sessionError);
        
        // FALLBACK: Tentar login automático
        console.log('🔄 Tentando fallback com login automático...');
        try {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (loginError) throw loginError;
          
          if (loginData.session) {
            console.log('✅ Login automático bem-sucedido!');
            validSession = loginData.session;
            
            toast({
              title: "Conta criada e login realizado!",
              description: "Prosseguindo para pagamento...",
            });
          } else {
            throw new Error('Login automático falhou');
          }
        } catch (loginError) {
          console.error('❌ Fallback de login também falhou:', loginError);
          
          // Último recurso: redirecionar para login manual
          toast({
            title: "Conta criada com sucesso!",
            description: "Redirecionando para fazer login...",
          });
          
          setTimeout(() => {
            navigate('/login', { 
              state: { 
                email, 
                message: "Sua conta foi criada! Faça login para continuar com o pagamento." 
              } 
            });
          }, 2000);
          return;
        }
      }

      // Verificar se temos uma sessão válida
      if (!validSession?.access_token || !validSession?.user?.id) {
        throw new Error('Sessão inválida após registro. Tente fazer login manualmente.');
      }

      console.log('Sessão estabelecida com sucesso, preparando pagamento...');
      
      // Usar planType da URL ou converter priceId para planType
      let finalPlanType = planType;
      if (!finalPlanType && priceId) {
        finalPlanType = await getPlanTypeFromPriceId(priceId);
      }
      
      if (!finalPlanType) {
        throw new Error("Tipo de plano inválido. Verifique as configurações.");
      }
      
      // Construir dados completos do checkout usando a configuração de planos
      let planName = 'Plano Premium';
      let planPrice = 0;
      
      if (config?.plans) {
        console.log('📋 Buscando dados do plano na configuração...', { finalPlanType, plans: config.plans });
        
        const planFamily = config.plans.find(plan => {
          const planPeriod = finalPlanType === 'monthly' ? 'monthly' : 'annual';
          return plan.pricing[planPeriod] && plan.pricing[planPeriod]!.amount > 0;
        });
        
        if (planFamily) {
          planName = planFamily.name;
          const planPeriod = finalPlanType === 'monthly' ? 'monthly' : 'annual';
          const pricingData = planFamily.pricing[planPeriod]!;
          planPrice = pricingData.amount;
          
          console.log('✅ Dados do plano encontrados:', { planName, planPrice, planPeriod });
        } else {
          console.log('⚠️ Plano não encontrado na configuração, usando valores padrão');
        }
      }
      
      // Preparar dados do checkout
      const checkoutState = {
        planType: finalPlanType as 'monthly' | 'annual',
        planName,
        planPrice,
        isUpgrade: false
      };
      
      console.log('💾 Salvando dados do checkout no localStorage:', checkoutState);
      localStorage.setItem('checkoutState', JSON.stringify(checkoutState));
      
      // Atualizar feedback de progresso
      toast({
        title: "Sessão estabelecida!",
        description: "Preparando pagamento...",
      });
      
      // Redirecionar para nosso checkout transparente
      console.log('✅ Redirecionando para checkout transparente');
      
      toast({
        title: "Conta criada com sucesso!",
        description: "Redirecionando para finalizar pagamento...",
      });
      
      // Redirecionar para nossa página de checkout (mantém URL params como fallback)
      setTimeout(() => {
        navigate(`/checkout?planType=${finalPlanType}&email=${encodeURIComponent(validSession.user.email || '')}`);
      }, 1500);
    } catch (err: any) {
      console.error('Erro no processo de registro ou pagamento:', err);
      setError(err.message || 'Ocorreu um erro desconhecido.');
      setIsLoading(false);
      
      // Remover classe de loading em caso de erro
      const formElement = document.getElementById('register-form');
      if (formElement) {
        formElement.classList.remove('form-loading');
      }
    }
  };

  // Adicione este componente dentro do RegisterPage, antes do return
  const LoadingOverlay = () => {
    if (!isLoading) return null;
    
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-medium">
            {isLoading && error ? 'Processando...' : 'Criando conta e preparando pagamento...'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-background via-muted/20 to-background flex flex-col items-center justify-center p-4">
      {/* Botão Voltar */}
      <div className="absolute top-4 left-4 z-10">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
      
      {/* Renderizar o LoadingOverlay fora do container do formulário */}
      {isLoading && <LoadingOverlay />}
      
      {/* Container do formulário com largura máxima e sombra */}
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-2xl relative">
        {/* Logo e Título Centralizados */}
        <div className="flex flex-col items-center mb-8">
          {/* Logo */}
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
              <img 
                src={logoUrl} 
                alt={logoAltText}
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const nextSibling = target.nextElementSibling as HTMLElement;
                  if (nextSibling) {
                    nextSibling.style.display = 'block';
                  }
                }}
              />
              <span className="text-white font-bold text-lg" style={{ display: 'none' }}>
                {companyName.charAt(0)}
              </span>
            </div>
            <span className="text-2xl font-bold text-primary">{companyName}</span>
          </div>
          <h1 className="text-3xl font-bold text-center text-foreground">Criar Conta</h1>
          <p className="text-muted-foreground text-center mt-2">
            Preencha os campos abaixo para criar sua conta.
          </p>
        </div>

        {error && (
          <p className="text-sm text-center text-red-600 mb-4">{error}</p>
        )}

        <form id="register-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              placeholder="Digite seu nome completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              autoComplete="tel"
              required
              placeholder="(XX) XXXXX-XXXX"
              value={whatsapp}
              onChange={handleWhatsappChange}
              className="mt-1"
              maxLength={16}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Este número será utilizado para enviar mensagens e notificações importantes via WhatsApp.
            </p>
          </div>

          <CPFInput
            value={cpf}
            onChange={setCpf}
            required
          />

          <div className="space-y-2">
            <Label>Data de Nascimento</Label>
            <EnhancedDatePicker
              date={birthDate}
              setDate={setBirthDate}
              placeholder="DD/MM/AAAA"
            />
          </div>

          <CEPInput
            value={cep}
            onChange={setCep}
            onAddressFound={handleAddressFound}
            required
          />

          <div className="space-y-2">
            <Label>Endereço</Label>
            <AddressDisplay
              address={address}
              onAddressChange={handleAddressChange}
              editable={true}
            />
          </div>

          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Cadastre sua senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="text-center text-sm text-muted-foreground mt-4">
            <p>
              {t('auth.termsAgreement')}{' '}
              <Link to="/terms" className="text-primary hover:underline">
                {t('auth.termsOfUse')}
              </Link>
              {' '}{t('auth.andThe')}{' '}
              <Link to="/privacy" className="text-primary hover:underline">
                {t('auth.privacyPolicy')}
              </Link>
            </p>
          </div>

          <div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Criando conta...' : 'Criar Conta e Ir para Pagamento'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
