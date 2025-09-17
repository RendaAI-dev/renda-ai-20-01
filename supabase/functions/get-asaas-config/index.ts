import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[GET-ASAAS-CONFIG] Buscando configurações...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Autenticar usuário (apenas admins podem acessar)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autorização necessário');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se é admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!userRole) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Acesso negado - apenas administradores'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Buscar configurações do Asaas
    const { data: settings } = await supabase
      .from('poupeja_settings')
      .select('key, value, encrypted, description, updated_at')
      .eq('category', 'asaas')
      .order('key');

    if (!settings) {
      throw new Error('Configurações não encontradas');
    }

    // Função para descriptografar (simulada - implementar descriptografia real)
    const decryptValue = (value: string, encrypted: boolean) => {
      if (!encrypted) return value;
      
      try {
        // Por enquanto apenas decode base64 - implementar descriptografia real
        return atob(value);
      } catch {
        return ''; // Se não conseguir descriptografar, retornar vazio
      }
    };

    // Processar configurações
    const config = settings.reduce((acc, setting) => {
      acc[setting.key] = {
        value: decryptValue(setting.value, setting.encrypted),
        encrypted: setting.encrypted,
        description: setting.description,
        updated_at: setting.updated_at
      };
      return acc;
    }, {} as Record<string, any>);

    // Verificar conexão com Asaas (se API key estiver configurada)
    let connectionStatus = 'not_configured';
    let asaasInfo = null;

    if (config.api_key?.value) {
      try {
        const environment = config.environment?.value || 'sandbox';
        const asaasUrl = environment === 'production' 
          ? 'https://www.asaas.com/api/v3'
          : 'https://sandbox.asaas.com/api/v3';

        // Testar conexão com API do Asaas
        const response = await fetch(`${asaasUrl}/myAccount`, {
          headers: {
            'access_token': config.api_key.value,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const accountData = await response.json();
          connectionStatus = 'connected';
          asaasInfo = {
            name: accountData.name || 'Conta Asaas',
            email: accountData.email,
            environment: environment,
            apiVersion: 'v3'
          };
        } else {
          connectionStatus = 'invalid_credentials';
        }
      } catch (error) {
        connectionStatus = 'connection_error';
        console.error('[GET-ASAAS-CONFIG] Erro ao testar conexão:', error.message);
      }
    }

    // Gerar URL do webhook
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/asaas-webhook`;

    console.log('[GET-ASAAS-CONFIG] Configurações recuperadas com sucesso');

    return new Response(JSON.stringify({
      success: true,
      config: config,
      connection_status: connectionStatus,
      asaas_info: asaasInfo,
      webhook_url: webhookUrl,
      environments: ['sandbox', 'production']
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[GET-ASAAS-CONFIG] Erro:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});