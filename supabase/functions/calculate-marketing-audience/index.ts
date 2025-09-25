import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AudienceRequest {
  segmentType: 'all' | 'active' | 'inactive' | 'new' | 'subscribers';
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

    // Build the base query - now with proper joins
    let query = supabase
      .from('poupeja_users')
      .select(`
        id,
        email,
        name,
        created_at,
        last_activity_at,
        poupeja_subscriptions!left (
          status,
          plan_type,
          current_period_end
        ),
        poupeja_user_preferences!left (
          notification_preferences
        )
      `);

    // Apply segmentation filters
    switch (segmentType) {
      case 'active':
        // Users active in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('last_activity_at', thirtyDaysAgo.toISOString());
        break;
      case 'inactive':
        // Users not active in last 30 days
        const inactiveDate = new Date();
        inactiveDate.setDate(inactiveDate.getDate() - 30);
        query = query.lt('last_activity_at', inactiveDate.toISOString());
        break;
      case 'new':
        // Users registered in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
        break;
      case 'subscribers':
        // Users with active subscriptions
        query = query.eq('poupeja_subscriptions.status', 'active');
        break;
      case 'all':
      default:
        // No additional filters for 'all'
        break;
    }

    // Apply plan filter (only if not conflicting with segmentType)
    if (planFilter && planFilter !== 'all' && segmentType !== 'subscribers') {
      query = query.eq('poupeja_subscriptions.plan_type', planFilter);
    }

    // Apply active only filter (deprecated, now using segmentType)
    if (activeOnly && segmentType === 'all') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('last_activity_at', thirtyDaysAgo.toISOString());
    }

    const { data: users, error: queryError } = await query;

    if (queryError) {
      console.error('Error querying users:', queryError);
      throw queryError;
    }

    console.log(`Found ${users?.length || 0} users before preference filtering`);

    // Filter by marketing preferences
    let filteredUsers = users || [];
    
    if (marketingOnly) {
      filteredUsers = filteredUsers.filter(user => {
        const preferences = user.poupeja_user_preferences?.[0]?.notification_preferences;
        // Default to true if no preferences (opt-out model)
        return preferences?.marketing !== false;
      });
      console.log(`After marketing filter: ${filteredUsers.length} users`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: filteredUsers.length,
        totalFound: users?.length || 0,
        segment: segmentType,
        filters: {
          planFilter,
          activeOnly,
          marketingOnly
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
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