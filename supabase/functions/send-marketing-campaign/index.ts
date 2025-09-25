import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CampaignRequest {
  title: string;
  message: string;
  segmentType: 'all' | 'by_plan' | 'active_users' | 'marketing_enabled';
  planFilter?: string;
  activeOnly: boolean;
  marketingOnly: boolean;
  testMode: boolean;
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
      title,
      message,
      segmentType,
      planFilter,
      activeOnly,
      marketingOnly,
      testMode
    }: CampaignRequest = await req.json();

    console.log('Iniciando campanha de marketing:', { 
      title, 
      segmentType, 
      planFilter, 
      activeOnly, 
      marketingOnly,
      testMode 
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
      throw new Error('Acesso negado - apenas administradores podem enviar campanhas');
    }

    let targetUsers = [];

    if (testMode) {
      console.log('Modo de teste: enviando apenas para admins');
      
      // Buscar apenas usuários admin
      const { data: adminUsers, error: adminUsersError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          poupeja_users!inner(
            id,
            email,
            name
          )
        `)
        .eq('role', 'admin');

      if (adminUsersError) throw adminUsersError;

      targetUsers = adminUsers?.map((role: any) => role.poupeja_users).flat() || [];
      
    } else {
      // Buscar usuários com base na segmentação
      let query = supabase
        .from('poupeja_users')
        .select(`
          id,
          email,
          name,
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

      // Filtrar usuários que aceitam marketing
      if (marketingOnly) {
        targetUsers = users?.filter(user => {
          const preferences = user.poupeja_user_preferences?.[0];
          if (!preferences) return true; // Se não tem preferência, aceita por padrão
          
          const notifPrefs = preferences.notification_preferences as any;
          return notifPrefs?.marketing_notifications !== false;
        }) || [];
      } else {
        targetUsers = users || [];
      }

      // Aplicar filtro adicional por segmento
      if (segmentType === 'active_users') {
        // Já filtrado acima se activeOnly for true
      } else if (segmentType === 'marketing_enabled') {
        // Já filtrado acima se marketingOnly for true
      }
    }

    console.log(`Público-alvo selecionado: ${targetUsers.length} usuários`);

    if (targetUsers.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Nenhum usuário encontrado para os critérios selecionados'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const results = [];

    // Enviar notificações em lotes
    const batchSize = 10;
    for (let i = 0; i < targetUsers.length; i += batchSize) {
      const batch = targetUsers.slice(i, i + batchSize);
      
      for (const targetUser of batch) {
        try {
          console.log(`Enviando notificação para usuário: ${targetUser.email}`);
          
          const { error: sendError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: targetUser.id,
              notification: {
                title,
                body: message,
                type: 'marketing',
                data: {
                  campaign_id: crypto.randomUUID(),
                  sent_at: new Date().toISOString()
                }
              }
            }
          });

          if (sendError) {
            console.error(`Erro ao enviar para ${targetUser.email}:`, sendError);
            results.push({
              user_id: targetUser.id,
              email: targetUser.email,
              status: 'failed',
              error: sendError.message
            });
          } else {
            results.push({
              user_id: targetUser.id,
              email: targetUser.email,
              status: 'sent'
            });
          }

        } catch (error) {
          console.error(`Erro inesperado para ${targetUser.email}:`, error);
          results.push({
            user_id: targetUser.id,
            email: targetUser.email,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Pequeno delay entre lotes para não sobrecarregar
      if (i + batchSize < targetUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Registrar campanha no log
    const { error: logError } = await supabase
      .from('poupeja_notification_logs')
      .insert({
        user_id: user.id, // Admin que enviou
        title,
        body: message,
        type: 'marketing',
        data: {
          segment_type: segmentType,
          plan_filter: planFilter,
          active_only: activeOnly,
          marketing_only: marketingOnly,
          test_mode: testMode,
          target_count: targetUsers.length
        },
        sent_at: new Date().toISOString(),
        results
      });

    if (logError) {
      console.error('Erro ao registrar campanha:', logError);
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log(`Campanha finalizada: ${sentCount} enviadas, ${failedCount} falharam`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Campanha de marketing enviada',
        sentCount,
        failedCount,
        totalUsers: targetUsers.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na campanha de marketing:', error);
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