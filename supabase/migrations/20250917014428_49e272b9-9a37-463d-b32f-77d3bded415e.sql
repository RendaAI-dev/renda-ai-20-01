-- Migração completa Stripe → Asaas

-- 1. Remover configurações antigas do Stripe da poupeja_settings
DELETE FROM public.poupeja_settings WHERE category = 'stripe';

-- 2. Adicionar configurações do Asaas
INSERT INTO public.poupeja_settings (category, key, value, value_type, encrypted, description, created_by, updated_by)
VALUES 
  ('asaas', 'api_key', '', 'string', true, 'Chave de API do Asaas (criptografada)', auth.uid(), auth.uid()),
  ('asaas', 'environment', 'sandbox', 'string', false, 'Ambiente Asaas (sandbox/production)', auth.uid(), auth.uid()),
  ('asaas', 'webhook_token', '', 'string', true, 'Token do webhook Asaas (criptografado)', auth.uid(), auth.uid()),
  ('asaas', 'enabled', 'true', 'boolean', false, 'Asaas habilitado como processador de pagamentos', auth.uid(), auth.uid())
ON CONFLICT (category, key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_by = auth.uid(),
  updated_at = NOW();

-- 3. Atualizar tabela poupeja_plans - remover stripe_price_id, adicionar asaas_price_id
ALTER TABLE public.poupeja_plans DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE public.poupeja_plans ADD COLUMN IF NOT EXISTS asaas_price_id TEXT;

-- 4. Atualizar tabela poupeja_subscriptions - adicionar suporte ao Asaas
ALTER TABLE public.poupeja_subscriptions 
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_processor TEXT DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMP WITH TIME ZONE;

-- 5. Criar tabela poupeja_asaas_customers
CREATE TABLE IF NOT EXISTS public.poupeja_asaas_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.poupeja_users(id) ON DELETE CASCADE,
  asaas_customer_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Criar tabela poupeja_asaas_payments  
CREATE TABLE IF NOT EXISTS public.poupeja_asaas_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.poupeja_users(id) ON DELETE CASCADE,
  asaas_payment_id TEXT NOT NULL UNIQUE,
  asaas_customer_id TEXT NOT NULL,
  status TEXT NOT NULL, -- PENDING, RECEIVED, OVERDUE, CANCELLED
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

-- 7. Habilitar RLS nas novas tabelas
ALTER TABLE public.poupeja_asaas_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poupeja_asaas_payments ENABLE ROW LEVEL SECURITY;

-- 8. Criar políticas RLS para poupeja_asaas_customers
CREATE POLICY "Users can view their own Asaas customer data"
  ON public.poupeja_asaas_customers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage Asaas customers"
  ON public.poupeja_asaas_customers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 9. Criar políticas RLS para poupeja_asaas_payments  
CREATE POLICY "Users can view their own Asaas payments"
  ON public.poupeja_asaas_payments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage Asaas payments"
  ON public.poupeja_asaas_payments
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 10. Criar triggers para updated_at
CREATE TRIGGER update_asaas_customers_updated_at
  BEFORE UPDATE ON public.poupeja_asaas_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_asaas_payments_updated_at
  BEFORE UPDATE ON public.poupeja_asaas_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Atualizar preços dos planos para Asaas (valores em reais)
UPDATE public.poupeja_plans 
SET 
  price = CASE 
    WHEN plan_period = 'monthly' THEN 9.99
    WHEN plan_period = 'annual' THEN 99.99
    ELSE price
  END,
  price_original = CASE
    WHEN plan_period = 'annual' THEN 119.88 -- 9.99 * 12
    ELSE price_original
  END;

-- 12. Remover tabela antiga poupeja_customers (Stripe)
DROP TABLE IF EXISTS public.poupeja_customers CASCADE;