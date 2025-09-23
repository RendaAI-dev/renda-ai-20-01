-- Criar tabelas para sistema de notificações

-- Tabela para armazenar tokens de dispositivos móveis
CREATE TABLE IF NOT EXISTS public.poupeja_device_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Tabela para armazenar subscrições de web push
CREATE TABLE IF NOT EXISTS public.poupeja_web_push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabela para preferências de notificação do usuário
CREATE TABLE IF NOT EXISTS public.poupeja_user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabela para logs de notificações enviadas
CREATE TABLE IF NOT EXISTS public.poupeja_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  results JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.poupeja_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poupeja_web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poupeja_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poupeja_notification_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para poupeja_device_tokens
CREATE POLICY "Users can manage their own device tokens"
ON public.poupeja_device_tokens
FOR ALL
USING (auth.uid() = user_id);

-- Políticas para poupeja_web_push_subscriptions
CREATE POLICY "Users can manage their own web push subscriptions"
ON public.poupeja_web_push_subscriptions
FOR ALL
USING (auth.uid() = user_id);

-- Políticas para poupeja_user_preferences
CREATE POLICY "Users can manage their own notification preferences"
ON public.poupeja_user_preferences
FOR ALL
USING (auth.uid() = user_id);

-- Políticas para poupeja_notification_logs
CREATE POLICY "Users can view their own notification logs"
ON public.poupeja_notification_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Política para admins gerenciarem logs
CREATE POLICY "Admins can manage all notification logs"
ON public.poupeja_notification_logs
FOR ALL
USING (public.is_admin(auth.uid()));

-- Triggers para updated_at
CREATE TRIGGER update_poupeja_device_tokens_updated_at
BEFORE UPDATE ON public.poupeja_device_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_poupeja_web_push_subscriptions_updated_at
BEFORE UPDATE ON public.poupeja_web_push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_poupeja_user_preferences_updated_at
BEFORE UPDATE ON public.poupeja_user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();