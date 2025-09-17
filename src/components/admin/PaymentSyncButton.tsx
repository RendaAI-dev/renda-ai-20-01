import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const PaymentSyncButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSync = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-payment-status');

      if (error) throw error;

      if (data.success) {
        toast.success(`Sincronização concluída! ${data.synchronized} pagamentos atualizados de ${data.total_checked} verificados.`);
      } else {
        toast.error(data.error || 'Erro na sincronização');
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      toast.error('Erro ao sincronizar pagamentos: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSync}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Sincronizando...' : 'Sincronizar Pagamentos'}
    </Button>
  );
};