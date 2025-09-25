import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Send, Loader2, Eye, Users, Filter } from 'lucide-react';

interface MarketingCampaignFormProps {
  onSuccess: () => void;
}

export const MarketingCampaignForm: React.FC<MarketingCampaignFormProps> = ({ onSuccess }) => {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    segmentType: 'all', // all, by_plan, active_users, marketing_enabled
    planFilter: '',
    activeOnly: true,
    marketingOnly: true,
    testMode: true
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateAudience = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('calculate-marketing-audience', {
        body: {
          segmentType: formData.segmentType,
          planFilter: formData.planFilter,
          activeOnly: formData.activeOnly,
          marketingOnly: formData.marketingOnly
        }
      });

      if (error) throw error;
      
      setAudienceCount(data?.count || 0);
    } catch (error) {
      console.error('Erro ao calcular público-alvo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível calcular o público-alvo",
        variant: "destructive",
      });
    }
  };

  const sendCampaign = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Título e mensagem são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSending(true);
      
      const { data, error } = await supabase.functions.invoke('send-marketing-campaign', {
        body: {
          title: formData.title.trim(),
          message: formData.message.trim(),
          segmentType: formData.segmentType,
          planFilter: formData.planFilter,
          activeOnly: formData.activeOnly,
          marketingOnly: formData.marketingOnly,
          testMode: formData.testMode
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Campanha enviada!",
          description: `Notificações enviadas para ${data.sentCount} usuários`,
        });
        
        // Limpar formulário
        setFormData({
          title: '',
          message: '',
          segmentType: 'all',
          planFilter: '',
          activeOnly: true,
          marketingOnly: true,
          testMode: true
        });
        
        setAudienceCount(null);
        onSuccess();
      }
    } catch (error: any) {
      console.error('Erro ao enviar campanha:', error);
      toast({
        title: "Erro ao enviar",
        description: error.message || 'Não foi possível enviar a campanha',
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Nova Campanha de Marketing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Conteúdo da Campanha */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Notificação *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Ex: Nova promoção disponível!"
                maxLength={50}
                disabled={isSending}
              />
              <p className="text-xs text-muted-foreground">
                {formData.title.length}/50 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
                placeholder="Ex: Desconto de 50% nos planos premium até o final do mês!"
                maxLength={150}
                disabled={isSending}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {formData.message.length}/150 caracteres
              </p>
            </div>
          </div>

          {/* Segmentação */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Segmentação de Público
            </h3>
            
            <div className="space-y-2">
              <Label>Tipo de Segmentação</Label>
              <Select 
                value={formData.segmentType} 
                onValueChange={(value) => handleInputChange('segmentType', value)}
                disabled={isSending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  <SelectItem value="by_plan">Por tipo de plano</SelectItem>
                  <SelectItem value="active_users">Usuários ativos</SelectItem>
                  <SelectItem value="marketing_enabled">Aceita marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.segmentType === 'by_plan' && (
              <div className="space-y-2">
                <Label>Filtro por Plano</Label>
                <Select 
                  value={formData.planFilter} 
                  onValueChange={(value) => handleInputChange('planFilter', value)}
                  disabled={isSending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Gratuito</SelectItem>
                    <SelectItem value="basic">Básico</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="activeOnly"
                  checked={formData.activeOnly}
                  onCheckedChange={(checked) => handleInputChange('activeOnly', checked)}
                  disabled={isSending}
                />
                <Label htmlFor="activeOnly">Apenas usuários ativos</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="marketingOnly"
                  checked={formData.marketingOnly}
                  onCheckedChange={(checked) => handleInputChange('marketingOnly', checked)}
                  disabled={isSending}
                />
                <Label htmlFor="marketingOnly">Apenas quem aceita marketing</Label>
              </div>
            </div>
          </div>

          {/* Configurações de Envio */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold">Configurações de Envio</h3>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="testMode"
                checked={formData.testMode}
                onCheckedChange={(checked) => handleInputChange('testMode', checked)}
                disabled={isSending}
              />
              <Label htmlFor="testMode">Modo de teste (enviar apenas para admins)</Label>
            </div>
          </div>

          {/* Preview e Público-Alvo */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={calculateAudience}
                disabled={isSending}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Calcular Público-Alvo
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPreview(!isPreview)}
                disabled={isSending}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                {isPreview ? 'Ocultar' : 'Preview'}
              </Button>
            </div>

            {audienceCount !== null && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium">
                  Público-alvo: {audienceCount} usuários
                </p>
              </div>
            )}
          </div>

          {/* Preview da Notificação */}
          {isPreview && formData.title && formData.message && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-sm">Preview da Notificação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-primary text-primary-foreground p-4 rounded-lg max-w-sm">
                  <h4 className="font-semibold text-sm">{formData.title}</h4>
                  <p className="text-xs mt-1">{formData.message}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={sendCampaign}
              disabled={isSending || !formData.title.trim() || !formData.message.trim()}
              className="flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {formData.testMode ? 'Enviar Teste' : 'Enviar Campanha'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};