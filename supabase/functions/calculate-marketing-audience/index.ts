import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AudienceRequest {
  segmentType: 'all' | 'by_plan' | 'active_users' | 'marketing_enabled';
  planFilter?: string;
  activeOnly: boolean;
  marketingOnly: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      segmentType,
      planFilter,
      activeOnly,
      marketingOnly
    }: AudienceRequest = await req.json();

    console.log('Calculando público-alvo:', { 
      segmentType, 
      planFilter, 
      activeOnly, 
      marketingOnly 
    });

    // Verificar se é admin
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
    const { data: adminCheck, error: adminError } = await supabase.rpc('is_admin', { 
      user_id: user.id 
    });

    if (adminError || !adminCheck) {
      throw new Error('Acesso negado - apenas administradores podem calcular audiência');
    }

    // Construir query para contar usuários
    let query = supabase
      .from('poupeja_users')
      .select(`
        id,
        created_at,
        poupeja_subscriptions(status, plan_type),
        poupeja_user_preferences(notification_preferences)
      `);

    // Aplicar filtros baseados na segmentação
    if (segmentType === 'by_plan' && planFilter) {
      query = query.eq('poupeja_subscriptions.plan_type', planFilter);
    }

    if (activeOnly) {
      // Usuários ativos nos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    }

    const { data: users, error: usersError } = await query;

    if (usersError) throw usersError;

    let targetUsers = users || [];

    // Filtrar usuários que aceitam marketing
    if (marketingOnly) {
      targetUsers = targetUsers.filter(user => {
        const preferences = user.poupeja_user_preferences?.[0];
        if (!preferences) return true; // Se não tem preferência, aceita por padrão
        
        const notifPrefs = preferences.notification_preferences as any;
        return notifPrefs?.marketing_notifications !== false;
      });
    }

    const count = targetUsers.length;

    console.log(`Público-alvo calculado: ${count} usuários`);

    return new Response(
      JSON.stringify({
        success: true,
        count,
        segmentation: {
          segmentType,
          planFilter,
          activeOnly,
          marketingOnly
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro ao calcular público-alvo:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});