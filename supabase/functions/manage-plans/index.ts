import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Plan {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  price_monthly: number;
  price_quarterly?: number;
  price_semiannual?: number;
  price_annual?: number;
  stripe_price_id_monthly?: string;
  stripe_price_id_quarterly?: string;
  stripe_price_id_semiannual?: string;
  stripe_price_id_annual?: string;
  features: string[];
  limitations: string[];
  is_popular: boolean;
  is_active: boolean;
  max_users?: number;
  trial_days: number;
  sort_order: number;
  metadata: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se o usuário é admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autenticação necessário');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Token de autenticação inválido');
    }

    // Verificar se o usuário é admin
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (userRole?.role !== 'admin') {
      throw new Error('Acesso negado: apenas administradores podem gerenciar planos');
    }

    const method = req.method;
    const url = new URL(req.url);
    const planId = url.searchParams.get('id');

    switch (method) {
      case 'GET':
        if (planId) {
          // Buscar plano específico
          const { data: plan, error } = await supabaseClient
            .from('poupeja_plans')
            .select('*')
            .eq('id', planId)
            .single();

          if (error) throw error;

          return new Response(JSON.stringify({ success: true, plan }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Buscar todos os planos
          const { data: plans, error } = await supabaseClient
            .from('poupeja_plans')
            .select('*')
            .order('sort_order', { ascending: true });

          if (error) throw error;

          return new Response(JSON.stringify({ success: true, plans }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      case 'POST':
        // Criar novo plano
        const newPlan: Plan = await req.json();
        
        const { data: createdPlan, error: createError } = await supabaseClient
          .from('poupeja_plans')
          .insert([{
            ...newPlan,
            created_by: user.id,
            updated_by: user.id
          }])
          .select()
          .single();

        if (createError) throw createError;

        return new Response(JSON.stringify({ success: true, plan: createdPlan }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'PUT':
        // Atualizar plano existente
        if (!planId) {
          throw new Error('ID do plano é obrigatório para atualização');
        }

        const updatedPlan: Partial<Plan> = await req.json();
        
        const { data: updated, error: updateError } = await supabaseClient
          .from('poupeja_plans')
          .update({
            ...updatedPlan,
            updated_by: user.id
          })
          .eq('id', planId)
          .select()
          .single();

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, plan: updated }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'DELETE':
        // Deletar plano
        if (!planId) {
          throw new Error('ID do plano é obrigatório para exclusão');
        }

        const { error: deleteError } = await supabaseClient
          .from('poupeja_plans')
          .delete()
          .eq('id', planId);

        if (deleteError) throw deleteError;

        return new Response(JSON.stringify({ success: true, message: 'Plano deletado com sucesso' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        throw new Error(`Método ${method} não suportado`);
    }

  } catch (error) {
    console.error('Erro no manage-plans:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno do servidor' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});