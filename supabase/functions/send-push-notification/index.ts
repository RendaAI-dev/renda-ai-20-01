import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Tipos
interface NotificationPayload {
  userId: string;
  notification: {
    title: string;
    body: string;
    type?: string;
    data?: Record<string, any>;
  };
}

interface FirebaseMessage {
  token: string;
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
  webpush?: {
    fcm_options?: {
      link?: string;
    };
  };
}

// Função para enviar via Firebase Admin SDK
async function sendFCMNotification(token: string, notification: any, data?: any) {
  const serviceAccountKey = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
  
  if (!serviceAccountKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada');
  }

  const serviceAccount = JSON.parse(serviceAccountKey);
  
  // Obter access token do Google OAuth2
  const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;
  
  const jwtClaimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: expiry,
    iat: now
  };

  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet));
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;
  
  // Importar chave privada
  const privateKey = serviceAccount.private_key;
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey.substring(
    pemHeader.length,
    privateKey.length - pemFooter.length
  ).replace(/\s/g, "");
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signatureInput)
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${jwtHeader}.${jwtClaimSetEncoded}.${signatureBase64}`;

  // Obter access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const { access_token } = await tokenResponse.json();

  // Enviar mensagem FCM
  const message: FirebaseMessage = {
    token,
    notification: {
      title: notification.title,
      body: notification.body
    }
  };

  // Adicionar data se fornecido
  if (data) {
    message.data = {};
    for (const key in data) {
      message.data[key] = String(data[key]);
    }
  }

  // Configuração específica para web
  message.webpush = {
    fcm_options: {
      link: data?.url || '/'
    }
  };

  const fcmResponse = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    }
  );

  if (!fcmResponse.ok) {
    const error = await fcmResponse.text();
    throw new Error(`FCM Error: ${error}`);
  }

  return await fcmResponse.json();
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const payload: NotificationPayload = await req.json();
    const { userId, notification } = payload;

    console.log('[SEND-PUSH] Enviando notificação para usuário:', userId);

    if (!userId || !notification) {
      return new Response(
        JSON.stringify({ error: 'userId e notification são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar tokens FCM do usuário (web, android, ios)
    const { data: deviceTokens, error: tokensError } = await supabase
      .from('poupeja_device_tokens')
      .select('token, platform')
      .eq('user_id', userId);

    if (tokensError) {
      console.error('[SEND-PUSH] Erro ao buscar tokens:', tokensError);
    }

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Enviar para todos os tokens FCM encontrados
    if (deviceTokens && deviceTokens.length > 0) {
      console.log(`[SEND-PUSH] Encontrados ${deviceTokens.length} tokens para enviar`);
      
      for (const device of deviceTokens) {
        try {
          console.log(`[SEND-PUSH] Enviando FCM para ${device.platform}: ${device.token.substring(0, 20)}...`);
          
          const result = await sendFCMNotification(
            device.token,
            notification,
            notification.data
          );

          console.log('[SEND-PUSH] FCM enviado com sucesso:', result);
          
          results.push({
            platform: device.platform,
            token: device.token.substring(0, 20) + '...',
            status: 'success',
            result
          });
          
          successCount++;

          // Atualizar last_used_at
          await supabase
            .from('poupeja_device_tokens')
            .update({ updated_at: new Date().toISOString() })
            .eq('token', device.token);

        } catch (error: any) {
          console.error(`[SEND-PUSH] Erro ao enviar FCM para ${device.platform}:`, error.message);
          
          errorCount++;
          
          results.push({
            platform: device.platform,
            token: device.token.substring(0, 20) + '...',
            status: 'error',
            error: error.message
          });

          // Se o token é inválido, remover
          if (error.message.includes('NOT_FOUND') || error.message.includes('INVALID')) {
            console.log('[SEND-PUSH] Removendo token inválido');
            await supabase
              .from('poupeja_device_tokens')
              .delete()
              .eq('token', device.token);
          }
        }
      }
    } else {
      console.log('[SEND-PUSH] Nenhum token FCM encontrado para o usuário');
      results.push({
        status: 'no_tokens',
        message: 'Nenhum token FCM registrado para este usuário'
      });
    }

    // Registrar log da notificação
    const { error: logError } = await supabase
      .from('poupeja_notification_logs')
      .insert({
        user_id: userId,
        title: notification.title,
        body: notification.body,
        type: notification.type || 'system',
        data: notification.data || {},
        results: results,
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error('[SEND-PUSH] Erro ao registrar log:', logError);
    }

    console.log(`[SEND-PUSH] Notificação processada: ${successCount} sucesso, ${errorCount} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notificação processada',
        stats: {
          total: deviceTokens?.length || 0,
          success: successCount,
          errors: errorCount
        },
        results: results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[SEND-PUSH] Erro ao enviar notificação:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});