-- Migração final: remover constraints e completar migração

-- 1. Remover todas as constraints da tabela poupeja_settings
ALTER TABLE public.poupeja_settings DROP CONSTRAINT IF EXISTS poupeja_settings_category_check;
ALTER TABLE public.poupeja_settings DROP CONSTRAINT IF EXISTS poupeja_settings_key_check;
ALTER TABLE public.poupeja_settings DROP CONSTRAINT IF EXISTS poupeja_settings_value_type_check;

-- 2. Inserir configurações do Asaas
INSERT INTO public.poupeja_settings (category, key, value, value_type, encrypted, description)
VALUES 
  ('asaas', 'api_key', '', 'string', true, 'Chave de API do Asaas'),
  ('asaas', 'environment', 'sandbox', 'string', false, 'Ambiente Asaas'),
  ('asaas', 'webhook_token', '', 'string', true, 'Token do webhook Asaas'),
  ('asaas', 'enabled', 'true', 'boolean', false, 'Asaas habilitado')
ON CONFLICT (category, key) DO NOTHING;

-- 3. Completar migração das tabelas
ALTER TABLE public.poupeja_plans DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE public.poupeja_plans ADD COLUMN IF NOT EXISTS asaas_price_id TEXT;

-- 4. Migrar poupeja_subscriptions 
ALTER TABLE public.poupeja_subscriptions 
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_processor TEXT DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMP WITH TIME ZONE;

-- 5. Criar tabelas específicas do Asaas
CREATE TABLE IF NOT EXISTS public.poupeja_asaas_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.poupeja_users(id) ON DELETE CASCADE,
  asaas_customer_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poupeja_asaas_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.poupeja_users(id) ON DELETE CASCADE,
  asaas_payment_id TEXT NOT NULL UNIQUE,
  asaas_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  method TEXT DEFAULT 'CREDIT_CARD',
  description TEXT,
  external_reference TEXT,
  invoice_url TEXT,
  bank_slip_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Habilitar RLS
ALTER TABLE public.poupeja_asaas_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poupeja_asaas_payments ENABLE ROW LEVEL SECURITY;