import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CreditCard, Webhook, Search, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function PaymentDebugger() {
  const [loading, setLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [webhookConfig, setWebhookConfig] = useState<any>(null);
  const [cardValidation, setCardValidation] = useState<any>(null);
  const [testCardNumber, setTestCardNumber] = useState('');
  const { toast } = useToast();

  const syncPendingPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-pending-payments');
      
      if (error) throw error;

      setSyncResult(data);
      toast({
        title: "Sincronização concluída",
        description: `${data.confirmedCount} pagamentos confirmados de ${data.processedCount} verificados`,
      });
    } catch (error: any) {
      toast({
        title: "Erro na sincronização",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkWebhookConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-webhook-config');
      
      if (error) throw error;

      setWebhookConfig(data);
      
      if (data.analysis.issues.length > 0) {
        toast({
          title: "Problemas encontrados no webhook",
          description: `${data.analysis.issues.length} problema(s) detectado(s)`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Webhook configurado corretamente",
          description: "Todos os eventos necessários estão habilitados",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao verificar webhook",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateTestCard = async () => {
    if (!testCardNumber.trim()) {
      toast({
        title: "Número do cartão necessário",
        description: "Digite um número de cartão para validar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-test-cards', {
        body: { cardNumber: testCardNumber }
      });
      
      if (error) throw error;

      setCardValidation(data);
      
      if (data.validation.isValidTestCard && data.validation.expectedResult === 'approved') {
        toast({
          title: "Cartão válido",
          description: "Este cartão será aprovado automaticamente no sandbox",
        });
      } else if (data.validation.isTestCard) {
        toast({
          title: "Cartão de teste",
          description: data.validation.recommendation,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Cartão real detectado",
          description: "Use apenas cartões de teste no sandbox",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na validação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 mr-1" />Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Depurador de Pagamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sync" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sync">Sincronizar</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
            <TabsTrigger value="cards">Cartões</TabsTrigger>
          </TabsList>

          <TabsContent value="sync" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Sincronizar Pagamentos Pendentes</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Verifica pagamentos que estão há mais de 5 minutos em status PENDING e consulta o Asaas para obter o status atual.
                </p>
                <Button 
                  onClick={syncPendingPayments}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Sincronizando...' : 'Sincronizar Agora'}
                </Button>
              </div>

              {syncResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resultado da Sincronização</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Pagamentos Pendentes:</span>
                        <div className="text-lg font-bold text-blue-600">{syncResult.pendingPayments}</div>
                      </div>
                      <div>
                        <span className="font-medium">Verificados:</span>
                        <div className="text-lg font-bold text-gray-600">{syncResult.processedCount}</div>
                      </div>
                      <div>
                        <span className="font-medium">Atualizados:</span>
                        <div className="text-lg font-bold text-orange-600">{syncResult.updatedCount}</div>
                      </div>
                      <div>
                        <span className="font-medium">Confirmados:</span>
                        <div className="text-lg font-bold text-green-600">{syncResult.confirmedCount}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="webhook" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Configuração do Webhook</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Verifica se o webhook do Asaas está configurado corretamente para receber eventos de pagamento.
                </p>
                <Button 
                  onClick={checkWebhookConfig}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Webhook className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Verificando...' : 'Verificar Webhook'}
                </Button>
              </div>

              {webhookConfig && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Status do Webhook</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Total de Webhooks:</span>
                        <div className="text-lg font-bold">{webhookConfig.analysis.totalWebhooks}</div>
                      </div>
                      <div>
                        <span className="font-medium">Ativos:</span>
                        <div className="text-lg font-bold text-green-600">{webhookConfig.analysis.activeWebhooks}</div>
                      </div>
                      <div>
                        <span className="font-medium">Problemas:</span>
                        <div className="text-lg font-bold text-red-600">{webhookConfig.analysis.issues.length}</div>
                      </div>
                    </div>

                    {webhookConfig.analysis.correctWebhook && (
                      <div>
                        <h4 className="font-medium mb-2">Eventos Configurados:</h4>
                        <div className="flex flex-wrap gap-1">
                          {webhookConfig.analysis.paymentEvents.map((event: string) => (
                            <Badge key={event} variant={event === 'PAYMENT_CONFIRMED' ? 'default' : 'secondary'}>
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {webhookConfig.analysis.issues.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 text-red-600">Problemas Encontrados:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {webhookConfig.analysis.issues.map((issue: string, index: number) => (
                            <li key={index} className="text-red-600">{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {webhookConfig.analysis.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 text-blue-600">Recomendações:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {webhookConfig.analysis.recommendations.map((rec: string, index: number) => (
                            <li key={index} className="text-blue-600">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      <strong>URL esperada:</strong> {webhookConfig.analysis.expectedUrl}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cards" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Validador de Cartões de Teste</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Valida se um cartão é adequado para testes no sandbox do Asaas.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="cardNumber">Número do Cartão</Label>
                    <Input
                      id="cardNumber"
                      value={testCardNumber}
                      onChange={(e) => setTestCardNumber(e.target.value)}
                      placeholder="4111111111111111"
                      maxLength={19}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={validateTestCard}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <CreditCard className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? 'Validando...' : 'Validar'}
                    </Button>
                  </div>
                </div>
              </div>

              {cardValidation && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resultado da Validação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="font-medium">Cartão:</span>
                        <div className="text-lg font-mono">{cardValidation.cardNumber}</div>
                      </div>
                      <div>
                        <span className="font-medium">Bandeira:</span>
                        <div className="text-lg">{cardValidation.validation.brand}</div>
                      </div>
                      <div>
                        <span className="font-medium">Resultado:</span>
                        {getStatusBadge(cardValidation.validation.expectedResult)}
                      </div>
                    </div>

                    <div className="text-sm bg-blue-50 p-3 rounded">
                      <strong>Recomendação:</strong> {cardValidation.validation.recommendation}
                    </div>

                    {cardValidation.suggestedCards && (
                      <div>
                        <h4 className="font-medium mb-2">Cartões Recomendados para Teste:</h4>
                        <div className="space-y-2">
                          {cardValidation.suggestedCards.map((card: any, index: number) => (
                            <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded text-sm">
                              <div>
                                <span className="font-mono">{card.number}</span>
                                <span className="ml-2 text-gray-600">({card.brand})</span>
                              </div>
                              <Badge className="bg-green-100 text-green-800">Auto-aprovado</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}