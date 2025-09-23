import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { getPlanTypeFromPriceId } from '@/utils/subscriptionUtils';
import { useBrandingConfig } from '@/hooks/useBrandingConfig';
import { usePreferences } from '@/contexts/PreferencesContext';
import { CPFInput } from '@/components/common/CPFInput';
import { CEPInput } from '@/components/common/CEPInput';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { EnhancedDatePicker } from '@/components/ui/enhanced-date-picker';
import type { Address } from '@/services/viacepService';

const RegisterWithPlanPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = usePreferences();
  const { companyName, logoUrl, logoAltText } = useBrandingConfig();

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

  // Função para formatar o número de telefone como (XX) XXXXX-XXXX
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 2) {
      return numbers.length ? `(${numbers}` : '';
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  };

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!priceId && !planType) {
      setError("Plano não encontrado na URL. Por favor, selecione um plano.");
      setIsLoading(false);
      navigate('/plans');
      return;
    }

    try {
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
      
      toast({
        title: "Conta criada com sucesso!",
        description: "Aguardando estabelecer sessão...",
      });

      // Aguardar a sessão ser estabelecida
      await new Promise(resolve => setTimeout(resolve, 2000));

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Tentar login automático
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (loginError || !loginData.session) {
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

      // Usar planType da URL ou converter priceId para planType
      let finalPlanType = planType;
      if (!finalPlanType && priceId) {
        finalPlanType = await getPlanTypeFromPriceId(priceId);
      }
      
      if (!finalPlanType) {
        throw new Error("Tipo de plano inválido. Verifique as configurações.");
      }
      
      toast({
        title: "Conta criada com sucesso!",
        description: "Redirecionando para finalizar pagamento...",
      });
      
      // Redirecionar para nossa página de checkout
      setTimeout(() => {
        navigate(`/checkout?planType=${finalPlanType}&email=${encodeURIComponent(email)}`);
      }, 1500);

    } catch (err: any) {
      console.error('Erro no processo de registro:', err);
      setError(err.message || 'Ocorreu um erro desconhecido.');
      setIsLoading(false);
    }
  };

  const LoadingOverlay = () => {
    if (!isLoading) return null;
    
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-medium">
            Criando conta e preparando pagamento...
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex flex-col items-center justify-center p-4">
      {isLoading && <LoadingOverlay />}
      
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-2xl relative">
        <div className="flex flex-col items-center mb-8">
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
            Preencha os campos abaixo para criar sua conta e finalizar a assinatura.
          </p>
        </div>

        {error && (
          <p className="text-sm text-center text-red-600 mb-4">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="text-center text-sm text-muted-foreground mt-4 mb-4">
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

          <Button
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isLoading}
          >
            {isLoading ? 'Criando conta...' : 'Criar Conta e Finalizar Assinatura'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default RegisterWithPlanPage;