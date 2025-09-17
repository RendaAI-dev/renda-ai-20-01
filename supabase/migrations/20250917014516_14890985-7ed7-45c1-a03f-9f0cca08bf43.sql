-- Migração Stripe → Asaas (versão corrigida)

-- 1. Desabilitar temporariamente o trigger de auditoria
DROP TRIGGER IF EXISTS audit_settings_trigger ON public.poupeja_settings;

-- 2. Remover configurações antigas do Stripe
DELETE FROM public.poupeja_settings WHERE category = 'stripe';
DELETE FROM public.poupeja_settings_history WHERE category = 'stripe';

-- 3. Adicionar configurações do Asaas
INSERT INTO public.poupeja_settings (category, key, value, value_type, encrypted, description)
VALUES 
  ('asaas', 'api_key', '', 'string', true, 'Chave de API do Asaas (criptografada)'),
  ('asaas', 'environment', 'sandbox', 'string', false, 'Ambiente Asaas (sandbox/production)'),
  ('asaas', 'webhook_token', '', 'string', true, 'Token do webhook Asaas (criptografado)'),
  ('asaas', 'enabled', 'true', 'boolean', false, 'Asaas habilitado como processador de pagamentos')
ON CONFLICT (category, key) DO NOTHING;

-- 4. Reabilitar o trigger de auditoria
CREATE TRIGGER audit_settings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.poupeja_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_settings_changes();

-- 5. Atualizar tabela poupeja_plans - remover stripe_price_id, adicionar asaas_price_id
ALTER TABLE public.poupeja_plans DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE public.poupeja_plans ADD COLUMN IF NOT EXISTS asaas_price_id TEXT;

-- 6. Atualizar tabela poupeja_subscriptions - migrar do Stripe para Asaas
ALTER TABLE public.poupeja_subscriptions 
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_processor TEXT DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMP WITH TIME ZONE;

-- 7. Criar tabela poupeja_asaas_customers
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

-- 8. Criar tabela poupeja_asaas_payments
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

-- 9. Habilitar RLS nas novas tabelas
ALTER TABLE public.poupeja_asaas_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poupeja_asaas_payments ENABLE ROW LEVEL SECURITY;