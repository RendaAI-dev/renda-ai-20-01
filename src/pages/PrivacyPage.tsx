import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const PrivacyPage = () => {
  const [content, setContent] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const loadPrivacyContent = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-public-settings');
      
      if (error) {
        console.error('Erro ao carregar política de privacidade:', error);
        return;
      }
      
      if (data?.success && data?.settings) {
        const legalSettings = data.settings.legal || {};
        setContent(legalSettings.privacy_policy?.value || getDefaultPrivacyContent());
        setLastUpdated(legalSettings.privacy_updated_at?.value || '');
      } else {
        setContent(getDefaultPrivacyContent());
      }
    } catch (err) {
      console.error('Erro ao carregar política de privacidade:', err);
      setContent(getDefaultPrivacyContent());
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultPrivacyContent = () => {
    return `# Política de Privacidade

**Última atualização:** ${new Date().toLocaleDateString('pt-BR')}

## 1. Informações que Coletamos

Coletamos informações que você nos fornece diretamente, como:
- Dados de cadastro (nome, email, telefone)
- Informações financeiras inseridas por você
- Dados de uso da plataforma

## 2. Como Usamos suas Informações

Utilizamos suas informações para:
- Fornecer e melhorar nossos serviços
- Personalizar sua experiência
- Comunicar-nos com você sobre atualizações e novidades
- Garantir a segurança da plataforma

## 3. Compartilhamento de Informações

Não vendemos, trocamos ou transferimos suas informações pessoais para terceiros, exceto:
- Quando necessário para cumprir a lei
- Para proteger nossos direitos ou segurança
- Com seu consentimento explícito

## 4. Segurança dos Dados

Implementamos medidas de segurança apropriadas para proteger suas informações pessoais contra acesso não autorizado, alteração, divulgação ou destruição.

## 5. Seus Direitos

Você tem o direito de:
- Acessar suas informações pessoais
- Corrigir dados incorretos
- Solicitar a exclusão de suas informações
- Portabilidade dos dados

## 6. Cookies e Tecnologias Similares

Utilizamos cookies e tecnologias similares para melhorar sua experiência, analisar o uso do site e personalizar conteúdo.

## 7. Retenção de Dados

Mantemos suas informações pelo tempo necessário para fornecer nossos serviços e cumprir obrigações legais.

## 8. Alterações nesta Política

Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas através da plataforma.

## 9. Contato

Para questões sobre privacidade, entre em contato conosco através dos canais disponibilizados na plataforma.`;
  };

  useEffect(() => {
    loadPrivacyContent();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando Política de Privacidade...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Shield className="h-6 w-6" />
              Política de Privacidade
            </CardTitle>
            {lastUpdated && (
              <p className="text-sm text-muted-foreground">
                Última atualização: {new Date(lastUpdated).toLocaleDateString('pt-BR')}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="prose prose-lg max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap">
                {content.split('\n').map((line, index) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={index} className="text-3xl font-bold mb-4 mt-8 first:mt-0">{line.replace('# ', '')}</h1>;
                  } else if (line.startsWith('## ')) {
                    return <h2 key={index} className="text-2xl font-semibold mb-3 mt-6">{line.replace('## ', '')}</h2>;
                  } else if (line.startsWith('### ')) {
                    return <h3 key={index} className="text-xl font-medium mb-2 mt-4">{line.replace('### ', '')}</h3>;
                  } else if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={index} className="font-semibold mb-2">{line.replace(/\*\*/g, '')}</p>;
                  } else if (line.startsWith('- ')) {
                    return <li key={index} className="ml-4 mb-1">{line.replace('- ', '')}</li>;
                  } else if (line.trim() === '') {
                    return <br key={index} />;
                  } else {
                    return <p key={index} className="mb-3 leading-relaxed">{line}</p>;
                  }
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPage;