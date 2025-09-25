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

    // Step 1: Get base users with segmentation filters
    let baseQuery = supabase
      .from('poupeja_users')
      .select('id, email, name, created_at, last_activity_at');

    // Apply time-based segmentation filters
    switch (segmentType) {
      case 'active':
        // Users active in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        baseQuery = baseQuery.gte('last_activity_at', thirtyDaysAgo.toISOString());
        break;
      case 'inactive':
        // Users not active in last 30 days
        const inactiveDate = new Date();
        inactiveDate.setDate(inactiveDate.getDate() - 30);
        baseQuery = baseQuery.lt('last_activity_at', inactiveDate.toISOString());
        break;
      case 'new':
        // Users registered in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        baseQuery = baseQuery.gte('created_at', sevenDaysAgo.toISOString());
        break;
      case 'subscribers':
      case 'all':
      default:
        // No time-based filters for these segments
        break;
    }

    // Apply active only filter (legacy support)
    if (activeOnly && segmentType === 'all') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      baseQuery = baseQuery.gte('last_activity_at', thirtyDaysAgo.toISOString());
    }

    const { data: baseUsers, error: usersError } = await baseQuery;

    if (usersError) {
      console.error('Error querying base users:', usersError);
      throw new Error(`Failed to query users: ${usersError.message}`);
    }

    console.log(`Found ${baseUsers?.length || 0} base users`);
    let filteredUserIds = new Set(baseUsers?.map(u => u.id) || []);

    // Step 2: Apply subscription filters if needed
    if (segmentType === 'subscribers' || (planFilter && planFilter !== 'all')) {
      let subscriptionQuery = supabase
        .from('poupeja_subscriptions')
        .select('user_id, status, plan_type')
        .eq('status', 'active');

      if (planFilter && planFilter !== 'all') {
        subscriptionQuery = subscriptionQuery.eq('plan_type', planFilter);
      }

      const { data: subscriptions, error: subscriptionError } = await subscriptionQuery;

      if (subscriptionError) {
        console.error('Error querying subscriptions:', subscriptionError);
        throw new Error(`Failed to query subscriptions: ${subscriptionError.message}`);
      }

      console.log(`Found ${subscriptions?.length || 0} matching subscriptions`);
      
      // Filter users to only those with matching subscriptions
      const subscriberIds = new Set(subscriptions?.map(s => s.user_id) || []);
      filteredUserIds = new Set([...filteredUserIds].filter(id => subscriberIds.has(id)));
      
      console.log(`After subscription filter: ${filteredUserIds.size} users`);
    }

    // Step 3: Apply marketing preferences filter if needed
    if (marketingOnly && filteredUserIds.size > 0) {
      const { data: preferences, error: preferencesError } = await supabase
        .from('poupeja_user_preferences')
        .select('user_id, notification_preferences')
        .in('user_id', Array.from(filteredUserIds));

      if (preferencesError) {
        console.error('Error querying preferences:', preferencesError);
        throw new Error(`Failed to query preferences: ${preferencesError.message}`);
      }

      console.log(`Found ${preferences?.length || 0} user preferences`);

      // Create a map of user preferences
      const preferencesMap = new Map();
      preferences?.forEach(pref => {
        preferencesMap.set(pref.user_id, pref.notification_preferences);
      });

      // Filter users based on marketing preferences (opt-out model)
      const marketingAllowedIds = new Set();
      filteredUserIds.forEach(userId => {
        const userPrefs = preferencesMap.get(userId);
        // Default to true if no preferences (opt-out model)
        if (!userPrefs || userPrefs.marketing !== false) {
          marketingAllowedIds.add(userId);
        }
      });

      filteredUserIds = marketingAllowedIds;
      console.log(`After marketing preferences filter: ${filteredUserIds.size} users`);
    }

    const finalCount = filteredUserIds.size;

    return new Response(
      JSON.stringify({
        success: true,
        count: finalCount,
        totalFound: baseUsers?.length || 0,
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