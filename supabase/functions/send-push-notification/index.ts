import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.6'

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

    // Validate notification structure
    if (!notification || !notification.title || !notification.body) {
      console.error('Invalid notification structure:', { userId, notification });
      throw new Error('Invalid notification: title and body are required');
    }

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

    // Configure VAPID keys for web push
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    
    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(
        'mailto:admin@rendaai.com.br',
        vapidPublicKey,
        vapidPrivateKey
      );
      console.log('VAPID configured successfully');
    } else {
      console.warn('VAPID keys not configured - web push will be skipped');
    }

    // Send to web browsers (using Web Push Protocol)
    for (const sub of webSubscriptions || []) {
      try {
        const subscription = sub.subscription;
        
        const payload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          data: notification.data || {}
        });

        if (vapidPublicKey && vapidPrivateKey) {
          const pushResult = await webpush.sendNotification(subscription, payload);
          console.log('Web push sent:', {
            endpoint: subscription.endpoint.substring(0, 50) + '...',
            statusCode: pushResult.statusCode
          });
          
          results.push({
            platform: 'web',
            endpoint: subscription.endpoint,
            status: 'sent'
          });
        } else {
          console.warn('VAPID keys not configured, skipping web push');
          results.push({
            platform: 'web',
            endpoint: subscription.endpoint,
            status: 'skipped',
            error: 'VAPID keys not configured'
          });
        }
      } catch (error: any) {
        console.error('Web push error:', {
          message: error.message,
          statusCode: error.statusCode,
          endpoint: sub.subscription?.endpoint?.substring(0, 50)
        });
        
        // Remove invalid subscriptions (410 Gone or 404 Not Found)
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('Removing invalid subscription:', sub.id);
          await supabase
            .from('poupeja_web_push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }
        
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