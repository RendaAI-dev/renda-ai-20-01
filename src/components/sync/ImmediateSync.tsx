import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export const ImmediateSync = () => {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);

  const syncPayment = async () => {
    try {
      setStatus('syncing');
      console.log('🔄 Executando sincronização forçada...');
      
      const { data, error } = await supabase.functions.invoke('sync-pending-payments', {
        body: { 
          email: 'fernando.testerenda74@gmail.com',
          forceSync: true 
        }
      });

      if (error) {
        console.error('❌ Erro na sincronização:', error);
        setStatus('error');
        setResult(error);
        return;
      }

      console.log('✅ Sincronização concluída:', data);
      setStatus('success');
      setResult(data);
      
      // Recarregar página após 2 segundos se sucesso
      if (data?.success) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
      
    } catch (error) {
      console.error('💥 Erro na execução:', error);
      setStatus('error');
      setResult(error);
    }
  };

  useEffect(() => {
    // Auto-executar ao carregar
    syncPayment();
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === 'syncing' && <RefreshCw className="h-5 w-5 animate-spin" />}
          {status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
          {status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
          Sincronização de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'idle' && (
          <p className="text-muted-foreground">Preparando sincronização...</p>
        )}
        
        {status === 'syncing' && (
          <p className="text-blue-600">Sincronizando pagamentos pendentes...</p>
        )}
        
        {status === 'success' && (
          <div className="space-y-2">
            <p className="text-green-600 font-medium">✅ Sincronização concluída!</p>
            {result?.details && (
              <div className="text-sm text-muted-foreground">
                <p>Verificados: {result.details.verified}</p>
                <p>Atualizados: {result.details.updated}</p>
                <p>Confirmados: {result.details.confirmed}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">Recarregando página...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="space-y-2">
            <p className="text-red-600 font-medium">❌ Erro na sincronização</p>
            <Button onClick={syncPayment} variant="outline" size="sm">
              Tentar Novamente
            </Button>
            {result && (
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};