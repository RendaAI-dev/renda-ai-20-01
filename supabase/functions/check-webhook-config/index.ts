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
    console.log('[CHECK-WEBHOOK-CONFIG] Verificando configuração do webhook do Asaas');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar configurações do Asaas
    const { data: asaasSettings, error: settingsError } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas')
      .in('key', ['api_key', 'environment']);

    if (settingsError) {
      throw new Error('Erro ao buscar configurações do Asaas');
    }

    const asaasApiKey = asaasSettings.find(s => s.key === 'api_key')?.value;
    const asaasEnvironment = asaasSettings.find(s => s.key === 'environment')?.value || 'sandbox';
    
    if (!asaasApiKey) {
      throw new Error('Chave API do Asaas não configurada');
    }

    const asaasUrl = asaasEnvironment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    // Verificar configuração do webhook
    console.log('[CHECK-WEBHOOK-CONFIG] Consultando webhooks configurados no Asaas...');
    
    const response = await fetch(`${asaasUrl}/webhooks`, {
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao consultar webhooks: ${response.status} ${response.statusText}`);
    }

    const webhookData = await response.json();
    const webhooks = webhookData.data || [];

    console.log(`[CHECK-WEBHOOK-CONFIG] Encontrados ${webhooks.length} webhooks configurados`);

    // URL esperada do webhook
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const expectedWebhookUrl = `${supabaseUrl}/functions/v1/asaas-webhook`;

    // Análise dos webhooks
    const analysis = {
      totalWebhooks: webhooks.length,
      expectedUrl: expectedWebhookUrl,
      activeWebhooks: webhooks.filter((w: any) => w.enabled).length,
      correctWebhook: null as any,
      paymentEvents: [] as string[],
      issues: [] as string[],
      recommendations: [] as string[]
    };

    // Verificar se existe webhook para nossa URL
    const correctWebhook = webhooks.find((webhook: any) => 
      webhook.url === expectedWebhookUrl || 
      webhook.url.includes('asaas-webhook')
    );

    if (correctWebhook) {
      analysis.correctWebhook = correctWebhook;
      analysis.paymentEvents = correctWebhook.events || [];

      console.log('[CHECK-WEBHOOK-CONFIG] ✅ Webhook encontrado:', {
        id: correctWebhook.id,
        url: correctWebhook.url,
        enabled: correctWebhook.enabled,
        events: correctWebhook.events
      });

      // Verificar se está habilitado
      if (!correctWebhook.enabled) {
        analysis.issues.push('Webhook está desabilitado');
        analysis.recommendations.push('Habilitar o webhook no painel do Asaas');
      }

      // Verificar eventos importantes
      const requiredEvents = [
        'PAYMENT_CREATED',
        'PAYMENT_CONFIRMED', 
        'PAYMENT_RECEIVED',
        'PAYMENT_UPDATED',
        'PAYMENT_OVERDUE',
        'PAYMENT_DELETED',
        'PAYMENT_REFUNDED'
      ];

      const missingEvents = requiredEvents.filter(event => 
        !correctWebhook.events?.includes(event)
      );

      if (missingEvents.length > 0) {
        analysis.issues.push(`Eventos não configurados: ${missingEvents.join(', ')}`);
        analysis.recommendations.push('Configurar todos os eventos de pagamento no webhook');
      }

      // Verificar especificamente PAYMENT_CONFIRMED
      if (!correctWebhook.events?.includes('PAYMENT_CONFIRMED')) {
        analysis.issues.push('PAYMENT_CONFIRMED não está configurado - este é o evento crítico para confirmação de pagamentos com cartão');
        analysis.recommendations.push('URGENTE: Adicionar evento PAYMENT_CONFIRMED ao webhook');
      }

    } else {
      analysis.issues.push('Webhook não encontrado para a URL esperada');
      analysis.recommendations.push(`Criar webhook no Asaas para: ${expectedWebhookUrl}`);
      
      console.log('[CHECK-WEBHOOK-CONFIG] ❌ Webhook não encontrado para URL:', expectedWebhookUrl);
      console.log('[CHECK-WEBHOOK-CONFIG] Webhooks existentes:', webhooks.map((w: any) => ({
        id: w.id,
        url: w.url,
        enabled: w.enabled
      })));
    }

    // Instruções para configuração
    const setupInstructions = [
      '1. Acesse o painel do Asaas',
      '2. Vá em Configurações > Webhooks',
      '3. Criar/Editar webhook com URL: ' + expectedWebhookUrl,
      '4. Habilitar todos os eventos de PAYMENT_*',
      '5. Certificar-se que PAYMENT_CONFIRMED está marcado',
      '6. Salvar e testar a configuração'
    ];

    return new Response(JSON.stringify({
      success: true,
      analysis,
      setupInstructions,
      webhooks: webhooks.map((w: any) => ({
        id: w.id,
        url: w.url,
        enabled: w.enabled,
        events: w.events,
        isCorrect: w.url === expectedWebhookUrl || w.url.includes('asaas-webhook')
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[CHECK-WEBHOOK-CONFIG] Erro:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});