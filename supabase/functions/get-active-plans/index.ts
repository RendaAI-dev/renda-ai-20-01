import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'public, max-age=60, s-maxage=60',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Buscar apenas planos ativos, ordenados por sort_order
    const { data: plans, error } = await supabaseClient
      .from('poupeja_plans')
      .select(`
        id,
        name,
        slug,
        description,
        plan_period,
        price,
        price_original,
        stripe_price_id,
        features,
        limitations,
        is_popular,
        trial_days,
        max_users,
        metadata
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Processar planos para adicionar campos calculados
    const processedPlans = plans?.map(plan => {
      const discount = plan.price_original && plan.price_original > plan.price
        ? Math.round(((plan.price_original - plan.price) / plan.price_original) * 100)
        : 0;

      return {
        ...plan,
        discount,
        display: `R$ ${plan.price.toFixed(2).replace('.', ',')}`,
        originalDisplay: plan.price_original 
          ? `R$ ${plan.price_original.toFixed(2).replace('.', ',')}` 
          : null,
        savings: discount > 0 ? `Economize ${discount}%` : null
      };
    });

    return new Response(JSON.stringify({ 
      success: true, 
      plans: processedPlans || [],
      cached_at: new Date().toISOString()
    }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60'
      },
    });

  } catch (error) {
    console.error('Erro no get-active-plans:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro ao buscar planos' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});