import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const TermsPage = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const loadTermsContent = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-public-settings');
      
      if (error) {
        console.error('Erro ao carregar termos de uso:', error);
        return;
      }
      
      if (data?.success && data?.settings) {
        const legalSettings = data.settings.legal || {};
        setContent(legalSettings.terms_of_use?.value || getDefaultTermsContent());
        setLastUpdated(legalSettings.terms_updated_at?.value || '');
      } else {
        setContent(getDefaultTermsContent());
      }
    } catch (err) {
      console.error('Erro ao carregar termos de uso:', err);
      setContent(getDefaultTermsContent());
    } finally {
      setIsLoading(false);
    }
  };

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

  useEffect(() => {
    loadTermsContent();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando Termos de Uso...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <FileText className="h-6 w-6" />
              Termos de Uso
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

export default TermsPage;