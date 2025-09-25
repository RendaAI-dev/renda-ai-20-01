import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
      throw new Error('ASAAS_API_KEY não configurada')
    }

    const asaasUrl = asaasEnvironment === 'production' 
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3'

    console.log(`[CHECK-WEBHOOK-CONFIG] Verificando configuração do webhook - Ambiente: ${asaasEnvironment}`)

    // Listar webhooks configurados no Asaas
    const response = await fetch(`${asaasUrl}/webhooks`, {
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Erro ao consultar webhooks no Asaas: ${response.status}`)
    }

    const webhooksData = await response.json()
    console.log('[CHECK-WEBHOOK-CONFIG] Webhooks encontrados:', webhooksData)

    const expectedWebhookUrl = `https://yazmxlgfraauuhmsnysh.supabase.co/functions/v1/asaas-webhook`
    const requiredEvents = [
      'PAYMENT_CREATED',
      'PAYMENT_UPDATED', 
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
      'PAYMENT_OVERDUE',
      'PAYMENT_DELETED',
      'SUBSCRIPTION_CREATED',
      'SUBSCRIPTION_UPDATED'
    ]

    let webhookStatus = 'not_configured'
    let configuredWebhook = null
    let issues = []
    let recommendations = []

    // Verificar se existe webhook configurado
    if (webhooksData.data && webhooksData.data.length > 0) {
      for (const webhook of webhooksData.data) {
        if (webhook.url === expectedWebhookUrl) {
          webhookStatus = 'configured'
          configuredWebhook = webhook
          break
        }
      }
    }

    if (webhookStatus === 'not_configured') {
      issues.push('Webhook não encontrado ou URL incorreta')
      recommendations.push(`Configure o webhook com a URL: ${expectedWebhookUrl}`)
    } else {
      // Verificar eventos configurados
      const configuredEvents = configuredWebhook.events || []
      const missingEvents = requiredEvents.filter(event => !configuredEvents.includes(event))
      
      if (missingEvents.length > 0) {
        issues.push(`Eventos não configurados: ${missingEvents.join(', ')}`)
        recommendations.push('Habilite todos os eventos de pagamento e assinatura')
      }

      // Verificar se está ativo
      if (!configuredWebhook.enabled) {
        issues.push('Webhook está desabilitado')
        recommendations.push('Ative o webhook no painel do Asaas')
      }

      // Verificar token
      const webhookToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
      if (!webhookToken) {
        issues.push('Token do webhook não configurado')
        recommendations.push('Configure ASAAS_WEBHOOK_TOKEN nas variáveis de ambiente')
      }
    }

    // Status geral
    const overallStatus = issues.length === 0 ? 'ok' : 'issues_found'

    const result = {
      success: true,
      status: overallStatus,
      webhook: {
        configured: webhookStatus === 'configured',
        url: expectedWebhookUrl,
        details: configuredWebhook
      },
      issues,
      recommendations,
      environment: asaasEnvironment,
      allWebhooks: webhooksData.data || []
    }

    console.log('[CHECK-WEBHOOK-CONFIG] Resultado:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[CHECK-WEBHOOK-CONFIG] Erro:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})