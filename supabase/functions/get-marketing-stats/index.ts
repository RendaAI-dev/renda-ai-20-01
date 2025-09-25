import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Authenticate the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user is admin
    const { data: isAdminData, error: adminError } = await supabase
      .rpc('is_admin', { user_id: user.id })

    if (adminError || !isAdminData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get marketing campaign stats
    const { data: campaignStats, error: campaignError } = await supabase
      .from('poupeja_notification_logs')
      .select('*')

    if (campaignError) {
      console.error('Error fetching campaign stats:', campaignError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch campaign statistics' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get total users count
    const { count: totalUsers, error: usersError } = await supabase
      .from('poupeja_users')
      .select('*', { count: 'exact', head: true })

    if (usersError) {
      console.error('Error fetching users count:', usersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users count' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get active users (last activity within 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: activeUsers, error: activeUsersError } = await supabase
      .from('poupeja_users')
      .select('*', { count: 'exact', head: true })
      .gte('last_activity_at', thirtyDaysAgo.toISOString())

    if (activeUsersError) {
      console.error('Error fetching active users:', activeUsersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch active users count' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get users with marketing enabled
    const { count: marketingUsers, error: marketingError } = await supabase
      .from('poupeja_user_preferences')
      .select('*', { count: 'exact', head: true })
      .eq('notification_preferences->marketing', true)

    if (marketingError) {
      console.error('Error fetching marketing users:', marketingError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch marketing preferences' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Calculate statistics
    const totalCampaigns = campaignStats ? [...new Set(campaignStats.map(log => log.title))].length : 0
    const totalNotifications = campaignStats ? campaignStats.length : 0
    const successfulNotifications = campaignStats ? campaignStats.filter(log => 
      log.results && typeof log.results === 'object' && !log.results.error
    ).length : 0
    const successRate = totalNotifications > 0 ? Math.round((successfulNotifications / totalNotifications) * 100) : 0

    // Get recent campaigns (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentCampaigns = campaignStats ? campaignStats.filter(log => 
      new Date(log.created_at) >= sevenDaysAgo
    ).length : 0

    const stats = {
      totalCampaigns,
      totalNotifications,
      successRate,
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      marketingUsers: marketingUsers || 0,
      recentCampaigns
    }

    console.log('Marketing stats calculated:', stats)

    return new Response(
      JSON.stringify({ success: true, data: stats }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in get-marketing-stats function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})