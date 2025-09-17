-- Limpar dados antigos e migração simplificada

-- 1. Limpar completamente dados antigos
TRUNCATE public.poupeja_settings_history;
DELETE FROM public.poupeja_settings WHERE category IN ('stripe', 'asaas');

-- 2. Inserir configurações do Asaas
INSERT INTO public.poupeja_settings (category, key, value, value_type, encrypted, description)
VALUES 
  ('asaas', 'api_key', '', 'string', true, 'Chave de API do Asaas'),
  ('asaas', 'environment', 'sandbox', 'string', false, 'Ambiente Asaas (sandbox/production)'),
  ('asaas', 'webhook_token', '', 'string', true, 'Token do webhook Asaas'),
  ('asaas', 'enabled', 'true', 'boolean', false, 'Asaas habilitado');

-- 3. Atualizar poupeja_plans
ALTER TABLE public.poupeja_plans DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE public.poupeja_plans ADD COLUMN IF NOT EXISTS asaas_price_id TEXT;

-- 4. Limpar subscriptions existentes e atualizar estrutura
TRUNCATE public.poupeja_subscriptions;
ALTER TABLE public.poupeja_subscriptions 
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_processor TEXT DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMP WITH TIME ZONE;