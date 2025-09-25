import { supabase } from "@/integrations/supabase/client";

export async function syncSpecificPayment(email: string) {
  try {
    console.log(`🔄 Iniciando sincronização forçada para: ${email}`);
    
    const { data, error } = await supabase.functions.invoke('sync-pending-payments', {
      body: { 
        email: email,
        forceSync: true 
      }
    });

    if (error) {
      console.error('❌ Erro na sincronização:', error);
      throw error;
    }

    console.log('✅ Sincronização concluída:', data);
    return data;
  } catch (error) {
    console.error('❌ Falha na sincronização:', error);
    throw error;
  }
}

// Auto-executar para o usuário específico
syncSpecificPayment('fernando.testerenda74@gmail.com')
  .then((result) => {
    console.log('🎉 Sincronização executada com sucesso:', result);
  })
  .catch((error) => {
    console.error('💥 Erro na execução:', error);
  });