import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  userId: string;
  notification: {
    title: string;
    body: string;
    type: string;
    data?: Record<string, any>;
  };
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

    const { userId, notification }: NotificationPayload = await req.json();

    console.log('Sending push notification:', { userId, notification });

    // Get user's device tokens
    const { data: deviceTokens, error: tokensError } = await supabase
      .from('poupeja_device_tokens')
      .select('*')
      .eq('user_id', userId);

    if (tokensError) {
      console.error('Error fetching device tokens:', tokensError);
      throw tokensError;
    }

    // Get user's web push subscriptions
    const { data: webSubscriptions, error: subsError } = await supabase
      .from('poupeja_web_push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subsError) {
      console.error('Error fetching web subscriptions:', subsError);
      throw subsError;
    }

    const results = [];

    // Send to native devices (using FCM or similar service)
    for (const token of deviceTokens || []) {
      try {
        // Here you would integrate with FCM, APNS, etc.
        // For now, we'll just log the intent
        console.log(`Would send to ${token.platform} device:`, {
          token: token.token,
          notification
        });
        
        results.push({
          platform: token.platform,
          token: token.token,
          status: 'sent'
        });
      } catch (error) {
        console.error(`Error sending to ${token.platform}:`, error);
        results.push({
          platform: token.platform,
          token: token.token,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Send to web browsers (using Web Push Protocol)
    for (const sub of webSubscriptions || []) {
      try {
        const subscription = JSON.parse(sub.subscription);
        
        // Here you would use a web push library to send the notification
        // For now, we'll just log the intent
        console.log('Would send web push to:', {
          endpoint: subscription.endpoint,
          notification
        });
        
        results.push({
          platform: 'web',
          endpoint: subscription.endpoint,
          status: 'sent'
        });
      } catch (error) {
        console.error('Error sending web push:', error);
        results.push({
          platform: 'web',
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Log notification in database for tracking
    const { error: logError } = await supabase
      .from('poupeja_notification_logs')
      .insert({
        user_id: userId,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        data: notification.data,
        sent_at: new Date().toISOString(),
        results: results
      });

    if (logError) {
      console.error('Error logging notification:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Push notifications sent',
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in send-push-notification function:', error);
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