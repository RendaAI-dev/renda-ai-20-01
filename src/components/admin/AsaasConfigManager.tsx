import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';

interface AsaasConfig {
  api_key: { value: string; encrypted: boolean; description: string };
  environment: { value: string; encrypted: boolean; description: string };
  webhook_token: { value: string; encrypted: boolean; description: string };
  enabled: { value: string; encrypted: boolean; description: string };
}

interface AsaasInfo {
  name: string;
  email: string;
  environment: string;
  apiVersion: string;
}

const AsaasConfigManager: React.FC = () => {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [config, setConfig] = useState<AsaasConfig>({
    api_key: { value: '', encrypted: true, description: '' },
    environment: { value: 'sandbox', encrypted: false, description: '' },
    webhook_token: { value: '', encrypted: true, description: '' },
    enabled: { value: 'true', encrypted: false, description: '' }
  });
  const [connectionStatus, setConnectionStatus] = useState<string>('not_configured');
  const [asaasInfo, setAsaasInfo] = useState<AsaasInfo | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchAsaasConfig();
    }
  }, [isAdmin]);

  const fetchAsaasConfig = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('get-asaas-config');

      if (error) throw error;

      if (data.success) {
        setConfig(data.config);
        setConnectionStatus(data.connection_status);
        setAsaasInfo(data.asaas_info);
        setWebhookUrl(data.webhook_url);
      } else {
        throw new Error(data.error || 'Erro ao buscar configurações');
      }
    } catch (error: any) {
      console.error('Erro ao buscar config Asaas:', error);
      toast.error('Erro ao carregar configurações do Asaas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: {
        ...prev[key as keyof AsaasConfig],
        value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setIsUpdating(true);

      // Atualizar configurações uma por uma
      for (const [key, setting] of Object.entries(config)) {
        const { error } = await supabase.functions.invoke('update-admin-settings', {
          body: {
            category: 'asaas',
            key: key,
            value: setting.value,
            encrypted: setting.encrypted
          }
        });

        if (error) throw error;
      }

      toast.success('Configurações do Asaas salvas com sucesso!');
      
      // Recarregar configurações para verificar conexão
      await fetchAsaasConfig();
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast.error(error.message || 'Erro ao salvar configurações');
    } finally {
      setIsUpdating(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL do webhook copiada!');
  };

  const getStatusBadge = () => {
    const statusConfig = {
      connected: { variant: 'default', text: 'Conectado', icon: CheckCircle },
      not_configured: { variant: 'secondary', text: 'Não Configurado', icon: AlertCircle },
      invalid_credentials: { variant: 'destructive', text: 'Credenciais Inválidas', icon: AlertCircle },
      connection_error: { variant: 'destructive', text: 'Erro de Conexão', icon: AlertCircle }
    };

    const status = statusConfig[connectionStatus as keyof typeof statusConfig] || statusConfig.not_configured;
    const Icon = status.icon;

    return (
      <Badge variant={status.variant as any} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status.text}
      </Badge>
    );
  };

  if (roleLoading || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p>Acesso negado. Apenas administradores podem gerenciar configurações do Asaas.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Configurações do Asaas
                {getStatusBadge()}
              </CardTitle>
              <CardDescription>
                Configure a integração com o Asaas para processamento de pagamentos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectionStatus === 'connected' && asaasInfo && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Conectado à conta: <strong>{asaasInfo.name}</strong> ({asaasInfo.email}) - 
                Ambiente: <strong>{asaasInfo.environment}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api_key">Chave de API *</Label>
              <Input
                id="api_key"
                type="password"
                placeholder="$aact_YTU5YTE0M2Jj..."
                value={config.api_key.value}
                onChange={(e) => handleInputChange('api_key', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Sua chave de API do Asaas (será criptografada)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment">Ambiente</Label>
              <Select
                value={config.environment.value}
                onValueChange={(value) => handleInputChange('environment', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ambiente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook_token">Token do Webhook</Label>
              <Input
                id="webhook_token"
                type="password"
                placeholder="Token opcional para validação"
                value={config.webhook_token.value}
                onChange={(e) => handleInputChange('webhook_token', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Token opcional para validação de webhooks
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="enabled">Status</Label>
              <Select
                value={config.enabled.value}
                onValueChange={(value) => handleInputChange('enabled', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Habilitado</SelectItem>
                  <SelectItem value="false">Desabilitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium">URL do Webhook</h4>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyWebhookUrl}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                asChild
              >
                <a
                  href="https://sandbox.asaas.com/config/webhook"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure esta URL no painel do Asaas para receber notificações de pagamento
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={isUpdating}
              className="flex-1"
            >
              {isUpdating ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
            <Button
              variant="outline"
              onClick={fetchAsaasConfig}
              disabled={isLoading}
            >
              Recarregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como Configurar o Asaas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <p><strong>1.</strong> Crie uma conta no Asaas (sandbox ou produção)</p>
            <p><strong>2.</strong> Gere sua chave de API no painel de integração</p>
            <p><strong>3.</strong> Configure a URL do webhook no Asaas</p>
            <p><strong>4.</strong> Teste a conexão salvando as configurações</p>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Certifique-se de usar o ambiente "sandbox" para testes antes de ir para produção.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default AsaasConfigManager;