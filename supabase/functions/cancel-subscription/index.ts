import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  console.log('[CANCEL-SUBSCRIPTION] Function started')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[CANCEL-SUBSCRIPTION] Auth error:', authError);
      throw new Error('User not authenticated');
    }

    console.log('[CANCEL-SUBSCRIPTION] User authenticated:', user.id);

    // Get user's active subscription
    const { data: subscription, error: subError } = await supabaseClient
      .from('poupeja_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      console.error('[CANCEL-SUBSCRIPTION] Subscription error:', subError);
      throw new Error('Nenhuma assinatura ativa encontrada');
    }

    if (subscription.cancel_at_period_end) {
      throw new Error('Assinatura já está programada para cancelamento');
    }

    console.log('[CANCEL-SUBSCRIPTION] Active subscription found:', subscription.id);

    // Get Asaas configuration
    const { data: asaasSettings, error: settingsError } = await supabaseClient
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas')
      .in('key', ['api_key', 'environment']);

    if (settingsError || !asaasSettings || asaasSettings.length === 0) {
      console.error('[CANCEL-SUBSCRIPTION] Settings error:', settingsError);
      throw new Error('Configurações do Asaas não encontradas');
    }

    const settings = asaasSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    if (!settings.api_key) {
      throw new Error('API Key do Asaas não configurada');
    }

    // Determine API URL based on environment
    const isProduction = settings.environment === 'production';
    const asaasApiUrl = isProduction 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/v3';

    console.log('[CANCEL-SUBSCRIPTION] Using Asaas environment:', settings.environment);

    // Cancel subscription in Asaas
    if (subscription.asaas_subscription_id) {
      const asaasResponse = await fetch(
        `${asaasApiUrl}/subscriptions/${subscription.asaas_subscription_id}`,
        {
          method: 'DELETE',
          headers: {
            'access_token': settings.api_key,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!asaasResponse.ok) {
        const errorData = await asaasResponse.text();
        console.error('[CANCEL-SUBSCRIPTION] Asaas API error:', errorData);
        throw new Error('Erro ao cancelar assinatura no Asaas');
      }

      console.log('[CANCEL-SUBSCRIPTION] Subscription cancelled in Asaas');
    }

    // Update subscription in database - mark for cancellation at period end
    const { error: updateError } = await supabaseClient
      .from('poupeja_subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('[CANCEL-SUBSCRIPTION] Database update error:', updateError);
      throw new Error('Erro ao atualizar status da assinatura');
    }

    console.log('[CANCEL-SUBSCRIPTION] Subscription marked for cancellation');

    const endDate = new Date(subscription.current_period_end);
    const formattedEndDate = endDate.toLocaleDateString('pt-BR');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Assinatura cancelada com sucesso. Você terá acesso até ${formattedEndDate}.`,
        subscription_end_date: formattedEndDate
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[CANCEL-SUBSCRIPTION] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});