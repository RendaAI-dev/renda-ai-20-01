import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        price_monthly,
        price_annual,
        stripe_price_id_monthly,
        stripe_price_id_annual,
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
      const monthlyPrice = plan.price_monthly;
      const annualPrice = plan.price_annual || monthlyPrice * 12;
      const yearlyEquivalent = monthlyPrice * 12;
      
      // Calcular desconto anual
      const annualDiscount = plan.price_annual 
        ? Math.round(((yearlyEquivalent - annualPrice) / yearlyEquivalent) * 100)
        : 0;

      return {
        ...plan,
        pricing: {
          monthly: {
            amount: monthlyPrice,
            display: `R$ ${monthlyPrice.toFixed(2).replace('.', ',')}`,
            priceId: plan.stripe_price_id_monthly
          },
          annual: plan.price_annual ? {
            amount: annualPrice,
            display: `R$ ${annualPrice.toFixed(2).replace('.', ',')}`,
            originalPrice: `R$ ${yearlyEquivalent.toFixed(2).replace('.', ',')}`,
            discount: `${annualDiscount}%`,
            savings: `Economize ${annualDiscount}%`,
            priceId: plan.stripe_price_id_annual
          } : null
        }
      };
    });

    return new Response(JSON.stringify({ 
      success: true, 
      plans: processedPlans || [] 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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