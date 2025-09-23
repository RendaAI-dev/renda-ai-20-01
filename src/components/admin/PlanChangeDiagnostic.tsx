import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { usePlanChangeDiagnostic } from '@/hooks/usePlanChangeDiagnostic';

export const PlanChangeDiagnostic = () => {
  const { diagnostic, isLoading, runDiagnostic } = usePlanChangeDiagnostic();

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const getStatusBadge = (status: boolean, label: string) => {
    return (
      <Badge variant={status ? "default" : "destructive"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {label}
      </Badge>
    );
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Diagnóstico de Mudança de Plano
        </CardTitle>
        <CardDescription>
          Verifica se todos os componentes necessários estão funcionando para mudança de plano
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostic} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Executando Diagnóstico...
            </>
          ) : (
            'Executar Diagnóstico'
          )}
        </Button>

        {diagnostic && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Autenticação</CardTitle>
              </CardHeader>
              <CardContent>
                {getStatusBadge(diagnostic.userAuthenticated, diagnostic.userAuthenticated ? 'Usuário Autenticado' : 'Não Autenticado')}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Assinatura Ativa</CardTitle>
              </CardHeader>
              <CardContent>
                {getStatusBadge(diagnostic.hasActiveSubscription, diagnostic.hasActiveSubscription ? 'Assinatura Ativa' : 'Sem Assinatura Ativa')}
                {diagnostic.subscriptionData && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>Plano: {diagnostic.subscriptionData.plan_type}</p>
                    <p>Status: {diagnostic.subscriptionData.status}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Cliente Asaas</CardTitle>
              </CardHeader>
              <CardContent>
                {getStatusBadge(diagnostic.hasAsaasCustomer, diagnostic.hasAsaasCustomer ? 'Cliente Registrado' : 'Cliente Não Encontrado')}
                {diagnostic.asaasCustomerData && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>ID: {diagnostic.asaasCustomerData.asaas_customer_id}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Configuração Asaas</CardTitle>
              </CardHeader>
              <CardContent>
                {getStatusBadge(diagnostic.hasAsaasConfig, diagnostic.hasAsaasConfig ? 'Configuração OK' : 'Configuração Faltando')}
                {diagnostic.asaasConfigData?.success && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>Preços configurados</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Edge Function change-plan-checkout</CardTitle>
              </CardHeader>
              <CardContent>
                {getStatusBadge(diagnostic.edgeFunctionAvailable, diagnostic.edgeFunctionAvailable ? 'Edge Function Disponível' : 'Edge Function Indisponível')}
                {diagnostic.edgeFunctionError && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                    <p><strong>Erro:</strong> {diagnostic.edgeFunctionError}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {diagnostic && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-blue-800">Resumo do Diagnóstico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-blue-700">
                {diagnostic.userAuthenticated && diagnostic.hasActiveSubscription && diagnostic.hasAsaasCustomer && diagnostic.hasAsaasConfig && diagnostic.edgeFunctionAvailable ? (
                  <p>✅ <strong>Tudo funcionando!</strong> A mudança de plano deve funcionar normalmente.</p>
                ) : (
                  <div>
                    <p>❌ <strong>Problemas encontrados:</strong></p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {!diagnostic.userAuthenticated && <li>Usuário não autenticado</li>}
                      {!diagnostic.hasActiveSubscription && <li>Usuário sem assinatura ativa</li>}
                      {!diagnostic.hasAsaasCustomer && <li>Cliente Asaas não registrado</li>}
                      {!diagnostic.hasAsaasConfig && <li>Configurações do Asaas faltando</li>}
                      {!diagnostic.edgeFunctionAvailable && <li>Edge Function change-plan-checkout não disponível</li>}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};