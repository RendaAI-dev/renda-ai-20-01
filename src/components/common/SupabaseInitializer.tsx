
import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';

interface SupabaseInitializerProps {
  children: React.ReactNode;
}

export const SupabaseInitializer: React.FC<SupabaseInitializerProps> = ({ children }) => {
  const [showConfigWarning, setShowConfigWarning] = useState(false);

  useEffect(() => {
    // Não bloquear a renderização - inicializar em background
    const initialize = async () => {
      try {
        const configured = isSupabaseConfigured();
        
        if (!configured) {
          console.log('Supabase não configurado, executando em modo demonstração');
          setShowConfigWarning(true);
        }
      } catch (error) {
        console.error('Erro na inicialização do Supabase:', error);
        setShowConfigWarning(true);
      }
    };

    initialize();
  }, []);

  // Renderizar imediatamente - não bloquear

  return (
    <>
      {showConfigWarning && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                Sistema executando em modo demonstração. Para usar todas as funcionalidades, configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
              </p>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
};

