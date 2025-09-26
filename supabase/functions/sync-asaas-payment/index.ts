import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { subscriptionId, email } = await req.json()
    
    if (!subscriptionId || !email) {
      return new Response(
        JSON.stringify({ error: 'subscriptionId e email são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[SYNC-PAYMENT] Sincronizando: ${subscriptionId} para ${email}`)

    // Buscar configurações do Asaas
    const { data: asaasSettings } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas')

    const settings = asaasSettings?.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>) || {}

    const asaasApiKey = settings.api_key || Deno.env.get('ASAAS_API_KEY')
    const asaasEnvironment = settings.environment || Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox'
    const asaasUrl = asaasEnvironment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3'

    if (!asaasApiKey) {
      throw new Error('API key do Asaas não configurada')
    }

    // Buscar assinatura no Asaas
    console.log(`[SYNC-PAYMENT] Buscando assinatura ${subscriptionId} no Asaas...`)
    const asaasResponse = await fetch(`${asaasUrl}/subscriptions/${subscriptionId}`, {
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!asaasResponse.ok) {
      const errorText = await asaasResponse.text()
      console.error(`[SYNC-PAYMENT] Erro ao buscar assinatura no Asaas: ${errorText}`)
      return new Response(
        JSON.stringify({ error: `Assinatura ${subscriptionId} não encontrada no Asaas` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const asaasSubscription = await asaasResponse.json()
    console.log(`[SYNC-PAYMENT] Assinatura encontrada no Asaas:`, asaasSubscription)

    // Buscar cliente no Asaas
    const customerResponse = await fetch(`${asaasUrl}/customers/${asaasSubscription.customer}`, {
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json',
      },
    })

    const asaasCustomer = customerResponse.ok ? await customerResponse.json() : null

    // Verificar se usuário existe no auth
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    let userId = authUsers.users.find(u => u.email === email)?.id

    if (!userId) {
      // Criar usuário no auth se não existir
      console.log(`[SYNC-PAYMENT] Criando usuário ${email} no auth...`)
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: {
          full_name: asaasCustomer?.name || email.split('@')[0],
          phone: asaasCustomer?.phone || '',
          cpf: asaasCustomer?.cpfCnpj || '',
        }
      })

      if (createError) {
        console.error(`[SYNC-PAYMENT] Erro ao criar usuário:`, createError)
        throw createError
      }

      userId = newUser.user.id
      console.log(`[SYNC-PAYMENT] Usuário criado: ${userId}`)
    }

    // Verificar se usuário existe na tabela poupeja_users
    const { data: existingUser } = await supabase
      .from('poupeja_users')
      .select('id')
      .eq('id', userId)
      .single()

    if (!existingUser) {
      // Criar usuário na tabela se não existir
      console.log(`[SYNC-PAYMENT] Criando usuário na tabela poupeja_users...`)
      await supabase
        .from('poupeja_users')
        .insert({
          id: userId,
          email: email,
          name: asaasCustomer?.name || email.split('@')[0],
          phone: asaasCustomer?.phone || '',
          cpf: asaasCustomer?.cpfCnpj || '',
        })
    }

    // Verificar se assinatura já existe
    const { data: existingSubscription } = await supabase
      .from('poupeja_subscriptions')
      .select('id')
      .eq('asaas_subscription_id', subscriptionId)
      .single()

    if (!existingSubscription) {
      // Criar assinatura na tabela
      console.log(`[SYNC-PAYMENT] Criando assinatura na tabela...`)
      
      // Determinar plan_type baseado no valor
      let planType = 'monthly'
      if (asaasSubscription.cycle === 'YEARLY') {
        planType = 'annual'
      }

      const subscriptionData = {
        user_id: userId,
        asaas_subscription_id: subscriptionId,
        asaas_customer_id: asaasSubscription.customer,
        status: asaasSubscription.status?.toLowerCase() || 'pending',
        plan_type: planType,
        payment_processor: 'asaas',
        current_period_start: asaasSubscription.dateCreated ? new Date(asaasSubscription.dateCreated).toISOString() : new Date().toISOString(),
        current_period_end: asaasSubscription.nextDueDate ? new Date(asaasSubscription.nextDueDate).toISOString() : null,
      }

      await supabase
        .from('poupeja_subscriptions')
        .insert(subscriptionData)

      console.log(`[SYNC-PAYMENT] Assinatura criada com sucesso`)
    } else {
      console.log(`[SYNC-PAYMENT] Assinatura já existe, atualizando status...`)
      
      // Atualizar status da assinatura
      await supabase
        .from('poupeja_subscriptions')
        .update({
          status: asaasSubscription.status?.toLowerCase() || 'active',
          current_period_end: asaasSubscription.nextDueDate ? new Date(asaasSubscription.nextDueDate).toISOString() : null,
        })
        .eq('asaas_subscription_id', subscriptionId)
    }

    // Buscar e processar pagamentos relacionados
    const paymentsResponse = await fetch(`${asaasUrl}/payments?subscription=${subscriptionId}`, {
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json',
      },
    })

    if (paymentsResponse.ok) {
      const paymentsData = await paymentsResponse.json()
      const payments = paymentsData.data || []
      
      for (const payment of payments) {
        // Verificar se pagamento já existe
        const { data: existingPayment } = await supabase
          .from('poupeja_asaas_payments')
          .select('id')
          .eq('asaas_payment_id', payment.id)
          .single()

        if (!existingPayment && payment.status === 'CONFIRMED') {
          // Criar pagamento na tabela
          await supabase
            .from('poupeja_asaas_payments')
            .insert({
              user_id: userId,
              asaas_payment_id: payment.id,
              asaas_customer_id: payment.customer,
              amount: payment.value,
              status: payment.status,
              method: payment.billingType || 'CREDIT_CARD',
              due_date: payment.dueDate,
              payment_date: payment.paymentDate,
              confirmed_date: payment.confirmedDate ? new Date(payment.confirmedDate).toISOString() : null,
              description: payment.description,
              external_reference: payment.externalReference,
              invoice_url: payment.invoiceUrl,
              bank_slip_url: payment.bankSlipUrl,
            })
        }
      }
    }

    console.log(`[SYNC-PAYMENT] Sincronização concluída com sucesso`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Pagamento sincronizado com sucesso',
        subscriptionId,
        userId,
        status: asaasSubscription.status
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[SYNC-PAYMENT] Erro:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})