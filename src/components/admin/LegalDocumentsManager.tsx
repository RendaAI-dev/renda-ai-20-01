import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Save, Loader2, FileText, Shield, Eye, ExternalLink } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const LegalDocumentsManager: React.FC = () => {
  const { toast } = useToast();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('terms');
  
  const [termsContent, setTermsContent] = useState('');
  const [privacyContent, setPrivacyContent] = useState('');
  const [termsUpdatedAt, setTermsUpdatedAt] = useState('');
  const [privacyUpdatedAt, setPrivacyUpdatedAt] = useState('');

  const getDefaultTermsContent = () => {
    return `# Termos de Uso

**Última atualização:** ${new Date().toLocaleDateString('pt-BR')}

## 1. Aceitação dos Termos

Ao acessar e usar este serviço, você aceita e concorda em ficar vinculado aos termos e condições de uso aqui estabelecidos.

## 2. Descrição do Serviço

Este sistema oferece ferramentas para gerenciamento financeiro pessoal, incluindo controle de receitas, despesas, metas e relatórios.

## 3. Responsabilidades do Usuário

O usuário é responsável por:
- Manter a confidencialidade de suas credenciais de acesso
- Fornecer informações verdadeiras e atualizadas
- Usar o serviço de forma legal e ética

## 4. Limitações de Responsabilidade

O serviço é fornecido "como está" e não oferecemos garantias sobre sua disponibilidade contínua ou precisão dos dados.

## 5. Modificações dos Termos

Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão em vigor imediatamente após sua publicação.

## 6. Contato

Para dúvidas sobre estes termos, entre em contato conosco através dos canais disponibilizados na plataforma.`;
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

  const loadLegalDocuments = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-admin-settings');
      
      if (error) {
        console.error('Erro ao carregar documentos legais:', error);
        return;
      }
      
      if (data?.success && data?.settings) {
        const legalSettings = data.settings.legal || {};
        setTermsContent(legalSettings.terms_of_use?.value || getDefaultTermsContent());
        setPrivacyContent(legalSettings.privacy_policy?.value || getDefaultPrivacyContent());
        setTermsUpdatedAt(legalSettings.terms_updated_at?.value || '');
        setPrivacyUpdatedAt(legalSettings.privacy_updated_at?.value || '');
      } else {
        setTermsContent(getDefaultTermsContent());
        setPrivacyContent(getDefaultPrivacyContent());
      }
    } catch (err) {
      console.error('Erro ao carregar documentos legais:', err);
      setTermsContent(getDefaultTermsContent());
      setPrivacyContent(getDefaultPrivacyContent());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadLegalDocuments();
    }
  }, [isAdmin]);

  const handleSave = async (documentType: 'terms' | 'privacy') => {
    try {
      setIsUpdating(true);
      
      const content = documentType === 'terms' ? termsContent : privacyContent;
      const currentDate = new Date().toISOString();
      
      const updates = {
        [documentType === 'terms' ? 'terms_of_use' : 'privacy_policy']: content,
        [documentType === 'terms' ? 'terms_updated_at' : 'privacy_updated_at']: currentDate,
      };

      const { data, error } = await supabase.functions.invoke('update-admin-settings', {
        body: {
          category: 'legal',
          updates
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        if (documentType === 'terms') {
          setTermsUpdatedAt(currentDate);
        } else {
          setPrivacyUpdatedAt(currentDate);
        }
        
        toast({
          title: "Documento atualizado!",
          description: `${documentType === 'terms' ? 'Termos de Uso' : 'Política de Privacidade'} foi salvo com sucesso.`,
        });
      }
    } catch (error: any) {
      console.error('Erro ao salvar documento legal:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || 'Não foi possível salvar o documento.',
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openPublicPage = (type: 'terms' | 'privacy') => {
    const url = type === 'terms' ? '/terms' : '/privacy';
    window.open(url, '_blank');
  };

  if (roleLoading || isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando documentos legais...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            Acesso Negado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Você não tem permissões para acessar o gerenciamento de documentos legais.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerenciamento de Documentos Legais
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Gerencie os Termos de Uso e a Política de Privacidade do sistema. Os documentos serão exibidos nas páginas públicas /terms e /privacy.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="terms" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Termos de Uso
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Política de Privacidade
              </TabsTrigger>
            </TabsList>

            <TabsContent value="terms" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Termos de Uso</h3>
                  {termsUpdatedAt && (
                    <p className="text-sm text-muted-foreground">
                      Última atualização: {new Date(termsUpdatedAt).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPublicPage('terms')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver Página Pública
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="termsContent">Conteúdo dos Termos de Uso</Label>
                <Textarea
                  id="termsContent"
                  value={termsContent}
                  onChange={(e) => setTermsContent(e.target.value)}
                  placeholder="Digite o conteúdo dos termos de uso..."
                  className="min-h-[400px] font-mono text-sm"
                  disabled={isUpdating}
                />
                <p className="text-xs text-muted-foreground">
                  Suporte a Markdown básico: # Título, ## Subtítulo, **negrito**, - lista
                </p>
              </div>

              <Button 
                onClick={() => handleSave('terms')}
                disabled={isUpdating}
                className="flex items-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar Termos de Uso
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="privacy" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Política de Privacidade</h3>
                  {privacyUpdatedAt && (
                    <p className="text-sm text-muted-foreground">
                      Última atualização: {new Date(privacyUpdatedAt).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPublicPage('privacy')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver Página Pública
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="privacyContent">Conteúdo da Política de Privacidade</Label>
                <Textarea
                  id="privacyContent"
                  value={privacyContent}
                  onChange={(e) => setPrivacyContent(e.target.value)}
                  placeholder="Digite o conteúdo da política de privacidade..."
                  className="min-h-[400px] font-mono text-sm"
                  disabled={isUpdating}
                />
                <p className="text-xs text-muted-foreground">
                  Suporte a Markdown básico: # Título, ## Subtítulo, **negrito**, - lista
                </p>
              </div>

              <Button 
                onClick={() => handleSave('privacy')}
                disabled={isUpdating}
                className="flex items-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar Política de Privacidade
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default LegalDocumentsManager;