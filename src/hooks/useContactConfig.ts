
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logConfig, logError } from '@/utils/consoleOptimizer';

interface ContactConfig {
  contactPhone: string;
  whatsappMessage: string;
  supportEmail: string;
}

export const useContactConfig = () => {
  const [config, setConfig] = useState<ContactConfig>({
    contactPhone: '',
    whatsappMessage: 'Olá! Acabei de assinar o plano {planType} do PoupeJá! 🎉\n\nMeu email é: {email}\n\nPor favor, ative minha conta. Obrigado!',
    supportEmail: 'suporte@poupeja.com'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContactConfig = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-public-settings', {
          body: { category: 'contact' }
        });
        
        if (error) {
          logError('Erro ao buscar configurações de contato', error);
          setError('Erro ao carregar configurações');
          return;
        }
        
        if (data?.success && data?.settings) {
          const contactSettings = data.settings.contact || {};
          
          logConfig('Configurações de contato carregadas');
          setConfig(prev => ({
            contactPhone: contactSettings.contact_phone?.value || '',
            whatsappMessage: contactSettings.whatsapp_message?.value || prev.whatsappMessage,
            supportEmail: contactSettings.support_email?.value || prev.supportEmail
          }));
        }
      } catch (err) {
        logError('Exceção ao buscar configurações de contato', err);
        setError('Erro ao carregar configurações');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContactConfig();
  }, []);

  // Função para formatar mensagem com placeholders dinâmicos
  const formatMessage = (email: string, planType: string) => {
    return config.whatsappMessage
      .replace(/\{email\}/g, email)
      .replace(/\{planType\}/g, planType);
  };

  return { config, isLoading, error, formatMessage };
};
