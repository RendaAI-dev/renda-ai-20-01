import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[ASAAS-WEBHOOK] Processando webhook...')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Security: Validate webhook token
    const webhookToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
    const headerToken = req.headers.get('asaas-access-token')
    const url = new URL(req.url)
    const queryToken = url.searchParams.get('access_token')
    const receivedToken = headerToken || queryToken

    if (webhookToken && receivedToken !== webhookToken) {
      console.warn('[ASAAS-WEBHOOK] ⚠️ Token inválido recebido:', receivedToken?.substring(0, 8) + '...')
      return new Response(JSON.stringify({
        received: true,
        ignored: true,
        reason: 'invalid_token'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    console.log('[ASAAS-WEBHOOK] Access token validado:', !!receivedToken)

    // Parse webhook data
    let webhookData
    try {
      webhookData = await req.json()
    } catch (error) {
      const responseText = await req.text()
      console.error('[ASAAS-WEBHOOK] ❌ JSON inválido:', error, 'Response:', responseText)
      return new Response(JSON.stringify({
        received: true,
        ignored: true,
        reason: 'invalid_json'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    const { event } = webhookData
    console.log('[ASAAS-WEBHOOK] Evento recebido:', event)

    // Event router
    if (event?.startsWith('PAYMENT_')) {
      return await handlePaymentEvent(supabase, event, webhookData)
    } else if (event?.startsWith('CHECKOUT_')) {
      return await handleCheckoutEvent(supabase, event, webhookData)
    } else if (event?.startsWith('SUBSCRIPTION_')) {
      return await handleSubscriptionEvent(supabase, event, webhookData)
    } else {
      console.log('[ASAAS-WEBHOOK] Evento não processado:', event)
      return new Response(JSON.stringify({
        received: true,
        ignored: true,
        reason: 'unhandled_event'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

  } catch (error) {
    console.error('[ASAAS-WEBHOOK] ❌ Erro crítico:', error)
    return new Response(JSON.stringify({
      received: true,
      error: true,
      message: error.message
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})

// Payment Event Handler
async function handlePaymentEvent(supabase: any, event: string, webhookData: any) {
  const { payment } = webhookData
  
  if (!payment?.id) {
    console.error('[ASAAS-WEBHOOK] ❌ Dados de pagamento inválidos')
    return createSuccessResponse({ error: 'invalid_payment_data' })
  }

  console.log(`[ASAAS-WEBHOOK] Processando evento: ${event} | Payment ID: ${payment.id} | Status: ${payment.status}`)

  try {
    // Map user from various sources
    let userId = await mapUserFromPayment(supabase, payment)
    
    if (!userId) {
      console.error('[ASAAS-WEBHOOK] ❌ Não foi possível mapear usuário para o pagamento:', payment.id)
      return createSuccessResponse({ error: 'user_mapping_failed' })
    }

    console.log(`[ASAAS-WEBHOOK] Usuário mapeado: ${userId}`)

    // Map Asaas status to internal status
    const internalStatus = mapPaymentStatus(payment.status)
    
    // Upsert payment record
    const paymentData = {
      user_id: userId,
      asaas_payment_id: payment.id,
      asaas_customer_id: payment.customer,
      status: internalStatus,
      amount: payment.value,
      due_date: payment.dueDate,
      payment_date: payment.paymentDate || null,
      description: payment.description || null,
      external_reference: payment.externalReference || null,
      invoice_url: payment.invoiceUrl || null,
      bank_slip_url: payment.bankSlipUrl || null,
      method: payment.billingType || 'CREDIT_CARD',
      updated_at: new Date().toISOString()
    }

    const { error: upsertError } = await supabase
      .from('poupeja_asaas_payments')
      .upsert(paymentData, { 
        onConflict: 'asaas_payment_id',
        ignoreDuplicates: false 
      })

    if (upsertError) {
      console.error('[ASAAS-WEBHOOK] ❌ Erro ao salvar pagamento:', upsertError)
      return createSuccessResponse({ error: 'payment_save_failed' })
    }

    console.log('[ASAAS-WEBHOOK] ✅ Pagamento atualizado com sucesso')

    // Check for immediate activation
    const shouldActivate = (
      event === 'PAYMENT_CONFIRMED' ||
      event === 'PAYMENT_RECEIVED' ||
      (event === 'PAYMENT_UPDATED' && ['CONFIRMED', 'RECEIVED'].includes(payment.status))
    )

    if (shouldActivate) {
      await handlePaymentSuccess(supabase, userId, payment)
    }

    // NEW: Quick status check for PAYMENT_CREATED
    if (event === 'PAYMENT_CREATED') {
      const currentStatus = await fetchPaymentById(supabase, payment.id)
      if (currentStatus && ['CONFIRMED', 'RECEIVED'].includes(currentStatus.status)) {
        console.log('[ASAAS-WEBHOOK] 🚀 Pagamento já confirmado no CREATED, ativando imediatamente')
        await handlePaymentSuccess(supabase, userId, currentStatus)
      }
    }

    // Handle other status changes
    if (payment.status === 'OVERDUE') {
      await handlePaymentOverdue(supabase, userId, payment)
    } else if (['CANCELLED', 'REFUNDED', 'DELETED'].includes(payment.status)) {
      await handlePaymentCancelled(supabase, userId, payment)
    }

    return createSuccessResponse({ 
      processed: true, 
      event,
      payment_id: payment.id,
      user_id: userId,
      status: internalStatus
    })

  } catch (error) {
    console.error('[ASAAS-WEBHOOK] ❌ Erro ao processar pagamento:', error)
    return createSuccessResponse({ error: 'payment_processing_failed' })
  }
}

// Checkout Event Handler
async function handleCheckoutEvent(supabase: any, event: string, webhookData: any) {
  const { checkout } = webhookData

  console.log(`[ASAAS-WEBHOOK] Processando evento de checkout: ${event}`)
  
  if (event === 'CHECKOUT_CREATED') {
    console.log(`[ASAAS-WEBHOOK] 📝 Checkout criado: ${checkout?.id}`)
    return createSuccessResponse({ processed: true, event, checkout_id: checkout?.id })
  }

  if (event === 'CHECKOUT_PAID') {
    console.log('[ASAAS-WEBHOOK] 💰 CHECKOUT PAGO! Processando ativação da assinatura...')
    
    if (!checkout?.id) {
      return createSuccessResponse({ error: 'invalid_checkout_data' })
    }

    try {
      // Fetch payments from checkout
      console.log(`[ASAAS-WEBHOOK] 🔍 Buscando pagamentos para checkout: ${checkout.id}`)
      const paymentsResult = await fetchCheckoutPayments(supabase, checkout.id)
      
      if (!paymentsResult.success || !paymentsResult.payments?.length) {
        console.log('[ASAAS-WEBHOOK] ⏳ Aguardando pagamentos para o checkout:', checkout.id)
        return createSuccessResponse({
          processed: true,
          message: 'Checkout paid event received, awaiting payment data',
          checkout_id: checkout.id
        })
      }

      // Process each payment
      for (const payment of paymentsResult.payments) {
        console.log(`[ASAAS-WEBHOOK] 🔄 Processando pagamento do checkout: ${payment.id}`)
        
        const userId = await mapUserFromPayment(supabase, payment)
        if (!userId) {
          console.warn(`[ASAAS-WEBHOOK] ⚠️ Usuário não encontrado para pagamento: ${payment.id}`)
          continue
        }

        // Upsert payment
        const paymentData = {
          user_id: userId,
          asaas_payment_id: payment.id,
          asaas_customer_id: payment.customer,
          status: mapPaymentStatus(payment.status),
          amount: payment.value,
          due_date: payment.dueDate,
          payment_date: payment.paymentDate || null,
          description: payment.description || null,
          external_reference: payment.externalReference || null,
          invoice_url: payment.invoiceUrl || null,
          bank_slip_url: payment.bankSlipUrl || null,
          method: payment.billingType || 'CREDIT_CARD',
          updated_at: new Date().toISOString()
        }

        await supabase
          .from('poupeja_asaas_payments')
          .upsert(paymentData, { onConflict: 'asaas_payment_id' })

        console.log(`[ASAAS-WEBHOOK] ✅ Pagamento atualizado via checkout: ${payment.id}`)

        // Activate subscription if payment is confirmed
        if (['CONFIRMED', 'RECEIVED'].includes(payment.status)) {
          await handlePaymentSuccess(supabase, userId, payment)
        }
      }

      return createSuccessResponse({
        processed: true,
        event,
        checkout_id: checkout.id,
        payments_processed: paymentsResult.payments.length
      })

    } catch (error) {
      console.error('[ASAAS-WEBHOOK] ❌ Erro ao processar checkout:', error)
      return createSuccessResponse({ error: 'checkout_processing_failed' })
    }
  }

  // Other checkout events
  return createSuccessResponse({ processed: true, event, logged: true })
}

// Subscription Event Handler
async function handleSubscriptionEvent(supabase: any, event: string, webhookData: any) {
  const { subscription } = webhookData

  console.log(`[ASAAS-WEBHOOK] Processando evento de subscription: ${event} ID: ${subscription?.id}`)

  if (!subscription?.id || !subscription?.customer) {
    console.error('[ASAAS-WEBHOOK] ❌ Dados de subscription inválidos')
    return createSuccessResponse({ error: 'invalid_subscription_data' })
  }

  try {
    // Map user from customer
    const { data: customerData } = await supabase
      .from('poupeja_asaas_customers')
      .select('user_id')
      .eq('asaas_customer_id', subscription.customer)
      .single()

    const userId = customerData?.user_id
    if (!userId) {
      console.error('[ASAAS-WEBHOOK] ❌ Customer não encontrado:', subscription.customer)
      return createSuccessResponse({ error: 'customer_not_found' })
    }

    console.log(`[ASAAS-WEBHOOK] Subscription mapeada para usuário: ${userId}`)

    // Map subscription status
    let subscriptionStatus = 'pending'
    if (['SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_ENABLED'].includes(event)) {
      subscriptionStatus = 'active'
    } else if (event === 'SUBSCRIPTION_UPDATED') {
      subscriptionStatus = 'active' // Keep active on updates
    } else if (['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_CANCELLED'].includes(event)) {
      subscriptionStatus = 'cancelled'
    } else if (['SUBSCRIPTION_SUSPENDED', 'SUBSCRIPTION_DISABLED'].includes(event)) {
      subscriptionStatus = 'past_due'
    }

    // Infer plan type from subscription cycle
    let planType = 'monthly'
    if (subscription.cycle === 'YEARLY') {
      planType = 'annual'
    }

    // Upsert subscription
    const subscriptionData = {
      user_id: userId,
      asaas_subscription_id: subscription.id,
      asaas_customer_id: subscription.customer,
      status: subscriptionStatus,
      plan_type: planType,
      cancel_at_period_end: subscriptionStatus === 'cancelled',
      payment_processor: 'asaas',
      current_period_start: null, // Will be set when payment is confirmed
      current_period_end: null,
      updated_at: new Date().toISOString()
    }

    console.log('[ASAAS-WEBHOOK] Dados da subscription para upsert:', subscriptionData)

    const { error: upsertError } = await supabase
      .from('poupeja_subscriptions')
      .upsert(subscriptionData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      })

    if (upsertError) {
      console.error('[ASAAS-WEBHOOK] ❌ Erro ao salvar subscription:', upsertError)
      return createSuccessResponse({ error: 'subscription_save_failed' })
    }

    console.log('[ASAAS-WEBHOOK] Subscription processada com sucesso:', subscription.id)

    return createSuccessResponse({
      processed: true,
      event,
      subscription_id: subscription.id,
      user_id: userId,
      status: subscriptionStatus
    })

  } catch (error) {
    console.error('[ASAAS-WEBHOOK] ❌ Erro ao processar subscription:', error)
    return createSuccessResponse({ error: 'subscription_processing_failed' })
  }
}

// User mapping utilities
async function mapUserFromPayment(supabase: any, payment: any): Promise<string | null> {
  // Try 1: Find by customer ID
  if (payment.customer) {
    const { data: customerData } = await supabase
      .from('poupeja_asaas_customers')
      .select('user_id')
      .eq('asaas_customer_id', payment.customer)
      .single()

    if (customerData?.user_id) {
      return customerData.user_id
    }
  }

  // Try 2: External reference as UUID
  if (payment.externalReference && isValidUUID(payment.externalReference)) {
    return payment.externalReference
  }

  // Try 3: Map by email if available
  if (payment.customerEmail) {
    const { data: userData } = await supabase
      .from('poupeja_users')
      .select('id')
      .eq('email', payment.customerEmail)
      .single()

    if (userData?.id) {
      return userData.id
    }
  }

  return null
}

// Payment status mapping
function mapPaymentStatus(asaasStatus: string): string {
  const statusMap: Record<string, string> = {
    'PENDING': 'pending',
    'AWAITING_RISK_ANALYSIS': 'pending',
    'RECEIVED': 'active',
    'RECEIVED_IN_CASH': 'active', 
    'CONFIRMED': 'active',
    'OVERDUE': 'past_due',
    'REFUNDED': 'cancelled',
    'CANCELLED': 'cancelled',
    'DELETED': 'cancelled'
  }
  
  return statusMap[asaasStatus] || 'pending'
}

// Payment success handler
async function handlePaymentSuccess(supabase: any, userId: string, payment: any) {
  console.log('[ASAAS-WEBHOOK] Processando pagamento recebido para usuário:', userId)

  try {
    // Infer plan type
    let planType = 'monthly'
    
    // Method 1: From subscription cycle
    if (payment.subscription?.cycle === 'YEARLY') {
      planType = 'annual'
    }
    // Method 2: From external reference
    else if (payment.externalReference?.toLowerCase().includes('annual')) {
      planType = 'annual'
    }
    // Method 3: By amount comparison (fallback)
    else {
      const { data: pricingData } = await supabase
        .from('poupeja_settings')
        .select('key, value')
        .eq('category', 'pricing')
        .in('key', ['monthly_price', 'annual_price'])

      const monthlyPrice = pricingData?.find(p => p.key === 'monthly_price')?.value
      const annualPrice = pricingData?.find(p => p.key === 'annual_price')?.value

      if (annualPrice && Math.abs(payment.value - parseFloat(annualPrice)) < 10) {
        planType = 'annual'
      }
    }

    // Calculate periods
    const now = new Date()
    const periodStart = now.toISOString()
    const periodEnd = new Date(now.getTime() + (planType === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString()

    // Upsert subscription
    const subscriptionData = {
      user_id: userId,
      status: 'active',
      plan_type: planType,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      grace_period_end: null,
      payment_processor: 'asaas',
      asaas_subscription_id: payment.subscription?.id || null,
      asaas_customer_id: payment.customer,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('poupeja_subscriptions')
      .upsert(subscriptionData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      })

    if (error) {
      console.error('[ASAAS-WEBHOOK] ❌ Erro ao ativar subscription:', error)
    } else {
      console.log('[ASAAS-WEBHOOK] Assinatura atualizada:', userId)
    }

  } catch (error) {
    console.error('[ASAAS-WEBHOOK] ❌ Erro ao processar sucesso do pagamento:', error)
  }
}

// Payment overdue handler
async function handlePaymentOverdue(supabase: any, userId: string, payment: any) {
  const gracePeriodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  
  await supabase
    .from('poupeja_subscriptions')
    .update({
      status: 'past_due',
      grace_period_end: gracePeriodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
}

// Payment cancelled handler  
async function handlePaymentCancelled(supabase: any, userId: string, payment: any) {
  await supabase
    .from('poupeja_subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
}

// Fetch single payment by ID
async function fetchPaymentById(supabase: any, paymentId: string) {
  try {
    const { data: settings } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas')
      .in('key', ['api_key', 'environment'])

    const apiKey = settings?.find(s => s.key === 'api_key')?.value
    const environment = settings?.find(s => s.key === 'environment')?.value

    if (!apiKey) {
      console.error('[ASAAS-WEBHOOK] ❌ API key não configurada')
      return null
    }

    const baseUrl = environment === 'production' 
      ? 'https://api.asaas.com/api'
      : 'https://sandbox.asaas.com/api'

    const response = await fetch(`${baseUrl}/v3/payments/${paymentId}`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('[ASAAS-WEBHOOK] ❌ Erro ao buscar pagamento:', response.status)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('[ASAAS-WEBHOOK] ❌ Erro ao buscar pagamento por ID:', error)
    return null
  }
}

// Fetch checkout payments (existing function, improved)
async function fetchCheckoutPayments(supabase: any, checkoutId: string) {
  try {
    const { data: settings } = await supabase
      .from('poupeja_settings')
      .select('key, value')
      .eq('category', 'asaas')
      .in('key', ['api_key', 'environment'])

    const apiKey = settings?.find(s => s.key === 'api_key')?.value
    const environment = settings?.find(s => s.key === 'environment')?.value

    if (!apiKey) {
      console.error('[ASAAS-WEBHOOK] ❌ Configuração da API não encontrada')
      return { success: false, error: 'API key not configured' }
    }

    const baseUrl = environment === 'production' 
      ? 'https://api.asaas.com/api'
      : 'https://sandbox.asaas.com/api'

    const response = await fetch(`${baseUrl}/v3/payments?checkout=${checkoutId}`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ASAAS-WEBHOOK] ❌ Erro da API Asaas:', response.status, response.statusText)
      console.error('[ASAAS-WEBHOOK] ❌ Resposta de erro:', errorText)
      return { success: false, error: `API Error: ${response.status}` }
    }

    let result
    try {
      result = await response.json()
    } catch (parseError) {
      const responseText = await response.text()
      console.error('[ASAAS-WEBHOOK] ❌ Erro ao fazer parse do JSON:', parseError)
      console.error('[ASAAS-WEBHOOK] ❌ Resposta recebida:', responseText)
      return { success: false, error: 'Parse error' }
    }

    console.log('[ASAAS-WEBHOOK] 📊 Resposta da API Asaas:', JSON.stringify(result, null, 2))

    return {
      success: true,
      payments: result.data || []
    }
  } catch (error) {
    console.error('[ASAAS-WEBHOOK] ❌ Erro ao buscar pagamentos do checkout:', error)
    return { success: false, error: error.message }
  }
}

// Utility functions
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

function createSuccessResponse(data: any) {
  return new Response(JSON.stringify({
    received: true,
    ...data
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}

console.log('[ASAAS-WEBHOOK] ✅ Webhook refatorizado carregado com sucesso')
