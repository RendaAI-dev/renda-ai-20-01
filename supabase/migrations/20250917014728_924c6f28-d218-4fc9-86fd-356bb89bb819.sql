-- Verificar e ajustar constraints de categoria

-- 1. Remover constraint de categoria se existir
ALTER TABLE public.poupeja_settings DROP CONSTRAINT IF EXISTS poupeja_settings_category_check;

-- 2. Limpar dados antigos do Stripe
DELETE FROM public.poupeja_settings WHERE category = 'stripe';

-- 3. Inserir configurações do Asaas  
INSERT INTO public.poupeja_settings (category, key, value, value_type, encrypted, description)
VALUES 
  ('asaas', 'api_key', '', 'string', true, 'Chave de API do Asaas'),
  ('asaas', 'environment', 'sandbox', 'string', false, 'Ambiente Asaas'),  
  ('asaas', 'webhook_token', '', 'string', true, 'Token do webhook Asaas'),
  ('asaas', 'enabled', 'true', 'boolean', false, 'Asaas habilitado')
ON CONFLICT (category, key) DO NOTHING;

-- 4. Recriar constraint permitindo asaas
ALTER TABLE public.poupeja_settings 
  ADD CONSTRAINT poupeja_settings_category_check 
  CHECK (category IN ('system', 'branding', 'contact', 'pricing', 'asaas'));

-- 5. Atualizar estrutura das tabelas principais
ALTER TABLE public.poupeja_plans DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE public.poupeja_plans ADD COLUMN IF NOT EXISTS asaas_price_id TEXT;

-- 6. Migrar poupeja_subscriptions
ALTER TABLE public.poupeja_subscriptions 
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_processor TEXT DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMP WITH TIME ZONE;