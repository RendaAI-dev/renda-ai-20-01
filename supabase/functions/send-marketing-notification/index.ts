import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketingNotificationRequest {
  title: string;
  message: string;
  target_segment?: 'all' | 'active_subscribers' | 'trial_users' | 'premium_users';
  data?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header and verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
      user_id: user.id
    });

    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestBody: MarketingNotificationRequest = await req.json();
    const {
      title,
      message,
      target_segment = 'all',
      data = {}
    } = requestBody;

    // Validate required fields
    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: 'Title and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get target users based on segment
    let targetUsers: string[] = [];
    
    if (target_segment === 'all') {
      // Get all users with marketing notifications enabled
      const { data: users, error: usersError } = await supabase
        .from('poupeja_user_preferences')
        .select('user_id')
        .eq('notification_preferences->marketing', true);
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch target users' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      targetUsers = users?.map(u => u.user_id) || [];
    } else if (target_segment === 'active_subscribers') {
      // Get users with active subscriptions
      const { data: subscribers, error: subsError } = await supabase
        .from('poupeja_subscriptions')
        .select('user_id')
        .eq('status', 'active')
        .gte('current_period_end', new Date().toISOString());
      
      if (subsError) {
        console.error('Error fetching subscribers:', subsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch subscribers' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      targetUsers = subscribers?.map(s => s.user_id) || [];
    }

    if (targetUsers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No target users found for the selected segment',
          sent_count: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create notifications for all target users
    const notifications = targetUsers.map(userId => ({
      user_id: userId,
      title,
      message,
      type: 'marketing',
      category: 'campaign',
      data: {
        ...data,
        campaign_segment: target_segment,
        sent_by: user.id,
        sent_at: new Date().toISOString()
      }
    }));

    // Batch insert notifications
    const { data: createdNotifications, error: insertError } = await supabase
      .from('poupeja_notifications')
      .insert(notifications)
      .select('id');

    if (insertError) {
      console.error('Error creating notifications:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create notifications' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the campaign
    console.log(`Marketing campaign sent to ${targetUsers.length} users by admin ${user.id}`);

    // Send push notifications asynchronously (don't wait for completion)
    const pushPromises = targetUsers.map(async (userId) => {
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: userId,
            title,
            body: message,
            type: 'marketing',
            data
          }
        });
      } catch (error) {
        console.error(`Failed to send push notification to user ${userId}:`, error);
      }
    });

    // Don't await push notifications to avoid timeout
    Promise.allSettled(pushPromises);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Marketing campaign sent successfully',
        sent_count: targetUsers.length,
        notification_ids: createdNotifications?.map(n => n.id) || []
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-marketing-notification function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});