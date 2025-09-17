-- Desabilitar trigger e limpar dados para migração

-- 1. Remover completamente o trigger de auditoria 
DROP TRIGGER IF EXISTS audit_settings_trigger ON public.poupeja_settings;

-- 2. Limpar completamente tabela de histórico
DROP TABLE IF EXISTS public.poupeja_settings_history CASCADE;

-- 3. Recriar tabela de histórico vazia
CREATE TABLE public.poupeja_settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_id UUID,
  category TEXT NOT NULL,
  key TEXT NOT NULL, 
  old_value TEXT,
  new_value TEXT,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action TEXT NOT NULL
);

-- 4. Limpar dados antigos do Stripe
DELETE FROM public.poupeja_settings WHERE category = 'stripe';

-- 5. Inserir configurações do Asaas
INSERT INTO public.poupeja_settings (category, key, value, value_type, encrypted, description)
VALUES 
  ('asaas', 'api_key', '', 'string', true, 'Chave de API do Asaas'),
  ('asaas', 'environment', 'sandbox', 'string', false, 'Ambiente Asaas'),
  ('asaas', 'webhook_token', '', 'string', true, 'Token do webhook Asaas'),
  ('asaas', 'enabled', 'true', 'boolean', false, 'Asaas habilitado');