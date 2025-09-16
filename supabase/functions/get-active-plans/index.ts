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
        price_quarterly,
        price_semiannual,
        price_annual,
        stripe_price_id_monthly,
        stripe_price_id_quarterly,
        stripe_price_id_semiannual,
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
      const quarterlyPrice = plan.price_quarterly;
      const semiannualPrice = plan.price_semiannual;
      const annualPrice = plan.price_annual;
      
      // Calcular preços equivalentes para comparação
      const quarterlyEquivalent = monthlyPrice * 3;
      const semiannualEquivalent = monthlyPrice * 6;
      const yearlyEquivalent = monthlyPrice * 12;
      
      // Calcular descontos
      const quarterlyDiscount = quarterlyPrice 
        ? Math.round(((quarterlyEquivalent - quarterlyPrice) / quarterlyEquivalent) * 100)
        : 0;
      const semiannualDiscount = semiannualPrice 
        ? Math.round(((semiannualEquivalent - semiannualPrice) / semiannualEquivalent) * 100)
        : 0;
      const annualDiscount = annualPrice 
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
          quarterly: quarterlyPrice ? {
            amount: quarterlyPrice,
            display: `R$ ${quarterlyPrice.toFixed(2).replace('.', ',')}`,
            originalPrice: `R$ ${quarterlyEquivalent.toFixed(2).replace('.', ',')}`,
            discount: `${quarterlyDiscount}%`,
            savings: `Economize ${quarterlyDiscount}%`,
            priceId: plan.stripe_price_id_quarterly
          } : null,
          semiannual: semiannualPrice ? {
            amount: semiannualPrice,
            display: `R$ ${semiannualPrice.toFixed(2).replace('.', ',')}`,
            originalPrice: `R$ ${semiannualEquivalent.toFixed(2).replace('.', ',')}`,
            discount: `${semiannualDiscount}%`,
            savings: `Economize ${semiannualDiscount}%`,
            priceId: plan.stripe_price_id_semiannual
          } : null,
          annual: annualPrice ? {
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