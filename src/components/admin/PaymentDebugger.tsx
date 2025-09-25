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
  const [emailLoading, setEmailLoading] = useState(false);
  const [forceLoading, setForceLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [webhookConfig, setWebhookConfig] = useState<any>(null);
  const [cardValidation, setCardValidation] = useState<any>(null);
  const [testCardNumber, setTestCardNumber] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const { toast } = useToast();

  const syncPendingPayments = async (options: { email?: string; forceSync?: boolean } = {}) => {
    const loadingState = options.email ? setEmailLoading : (options.forceSync ? setForceLoading : setLoading);
    loadingState(true);
    
    try {
      const requestBody: any = {};
      if (options.email) requestBody.email = options.email;
      if (options.forceSync) requestBody.forceSync = true;
      
      const { data, error } = await supabase.functions.invoke('sync-pending-payments', {
        body: requestBody
      });
      
      if (error) throw error;

      setSyncResult(data);
      const title = options.email 
        ? `Sincronização para ${options.email} concluída`
        : options.forceSync 
        ? "Sincronização forçada concluída"
        : "Sincronização concluída";
        
      toast({
        title,
        description: `${data.details?.verified || 0} verificados, ${data.details?.updated || 0} atualizados, ${data.details?.confirmed || 0} confirmados`,
      });
    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      toast({
        title: "Erro na sincronização",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      loadingState(false);
    }
  };

  const checkWebhookConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-webhook-config');
      
      if (error) throw error;

      setWebhookConfig(data);
      
      if (data.status === 'ok') {
        toast({
          title: "Webhook configurado corretamente",
          description: "Todas as configurações estão corretas",
        });
      } else {
        toast({
          title: "Problemas encontrados no webhook",
          description: `${data.issues?.length || 0} problemas detectados`,
          variant: "destructive"
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
      
      if (data.isTestCard) {
        toast({
          title: "Cartão de teste válido",
          description: data.recommendation,
        });
      } else if (data.isValid) {
        toast({
          title: "Cartão real detectado",
          description: "Use cartões de teste no sandbox",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Cartão inválido",
          description: data.recommendation,
          variant: "destructive"
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
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => syncPendingPayments()}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? 'Sincronizando...' : 'Sincronizar (>5min)'}
                    </Button>
                    
                    <Button 
                      onClick={() => syncPendingPayments({ forceSync: true })}
                      disabled={forceLoading}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${forceLoading ? 'animate-spin' : ''}`} />
                      {forceLoading ? 'Sincronizando...' : 'Forçar Todos'}
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="targetEmail">Sincronizar por Email:</Label>
                    <div className="flex gap-2">
                      <Input
                        id="targetEmail"
                        type="email"
                        placeholder="usuario@email.com"
                        value={targetEmail}
                        onChange={(e) => setTargetEmail(e.target.value)}
                        className="flex-1"
                      />
                      <Button 
                        onClick={() => syncPendingPayments({ email: targetEmail })}
                        disabled={!targetEmail || emailLoading}
                        variant="secondary"
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${emailLoading ? 'animate-spin' : ''}`} />
                        {emailLoading ? 'Sincronizando...' : 'Sincronizar'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {syncResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Resultado da Sincronização
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Verificados:</span>
                        <div className="text-lg font-bold text-blue-600">{syncResult.details?.verified || 0}</div>
                      </div>
                      <div>
                        <span className="font-medium">Atualizados:</span>
                        <div className="text-lg font-bold text-orange-600">{syncResult.details?.updated || 0}</div>
                      </div>
                      <div>
                        <span className="font-medium">Confirmados:</span>
                        <div className="text-lg font-bold text-green-600">{syncResult.details?.confirmed || 0}</div>
                      </div>
                      <div>
                        <span className="font-medium">Processados:</span>
                        <div className="text-lg font-bold text-gray-600">{syncResult.details?.processed || 0}</div>
                      </div>
                    </div>

                    {syncResult.results && syncResult.results.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-medium">Detalhes dos pagamentos:</p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {syncResult.results.map((result: any, index: number) => (
                            <div key={index} className="text-sm p-2 bg-muted rounded">
                              <div className="font-mono">{result.paymentId}</div>
                              <div className="text-muted-foreground">
                                {result.updated ? (
                                  <span className="text-green-600">
                                    {result.oldStatus} → {result.newStatus}
                                    {result.processed && " (processado)"}
                                  </span>
                                ) : (
                                  <span>{result.message || result.status}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {syncResult.environment && (
                      <div className="flex items-center gap-2">
                        <Badge variant={syncResult.environment === 'production' ? 'destructive' : 'secondary'}>
                          {syncResult.environment.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Ambiente Asaas</span>
                      </div>
                    )}
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
                    <CardTitle className="text-base flex items-center gap-2">
                      {webhookConfig.status === 'ok' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                      Status do Webhook
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div>URL: {webhookConfig.webhook?.url}</div>
                      <div>Configurado: {webhookConfig.webhook?.configured ? 'Sim' : 'Não'}</div>
                      <div>Ambiente: {webhookConfig.environment}</div>
                    </div>

                    {webhookConfig.issues && webhookConfig.issues.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-medium text-destructive">Problemas encontrados:</p>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          {webhookConfig.issues.map((issue: string, index: number) => (
                            <li key={index}>• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {webhookConfig.recommendations && webhookConfig.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-medium text-yellow-600">Recomendações:</p>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          {webhookConfig.recommendations.map((rec: string, index: number) => (
                            <li key={index}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
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
                    <CardTitle className="text-base flex items-center gap-2">
                      {cardValidation.isTestCard ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : cardValidation.isValid ? (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      Resultado da Validação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      {cardValidation.recommendation}
                    </div>

                    {cardValidation.recommendedTestCards && (
                      <div className="space-y-2">
                        <p className="font-medium">Cartões recomendados para teste:</p>
                        <div className="space-y-1">
                          {cardValidation.recommendedTestCards.map((card: any, index: number) => (
                            <div key={index} className="text-sm p-2 bg-muted rounded">
                              <div className="font-mono">{card.number}</div>
                              <div className="text-muted-foreground">{card.brand} - {card.description}</div>
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
