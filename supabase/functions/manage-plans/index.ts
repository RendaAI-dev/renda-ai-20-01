import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Plan {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  plan_period: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  price: number;
  price_original?: number;
  asaas_price_id?: string;
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200
    });
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
        let newPlan: Plan;
        try {
          newPlan = await req.json();
        } catch (e) {
          throw new Error('Body da requisição inválido para criação de plano');
        }
        
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

        let updatedPlan: Partial<Plan>;
        try {
          updatedPlan = await req.json();
        } catch (e) {
          throw new Error('Body da requisição inválido para atualização de plano');
        }
        
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
    
    let status = 500;
    let errorMessage = error.message || 'Erro interno do servidor';
    
    // Determinar status code baseado no tipo de erro
    if (error.message?.includes('Token de autenticação')) {
      status = 401;
    } else if (error.message?.includes('Acesso negado')) {
      status = 403;
    } else if (error.message?.includes('não encontrado')) {
      status = 404;
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
      }
    );
  }
});