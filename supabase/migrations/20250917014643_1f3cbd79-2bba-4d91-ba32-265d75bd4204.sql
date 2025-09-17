-- Migração com remoção temporária da foreign key constraint

-- 1. Remover temporariamente a constraint foreign key
ALTER TABLE public.poupeja_settings_history 
  DROP CONSTRAINT IF EXISTS poupeja_settings_history_setting_id_fkey;

-- 2. Limpar dados antigos  
DELETE FROM public.poupeja_settings WHERE category = 'stripe';
DELETE FROM public.poupeja_settings_history WHERE category = 'stripe';

-- 3. Inserir configurações do Asaas
INSERT INTO public.poupeja_settings (category, key, value, value_type, encrypted, description)
VALUES 
  ('asaas', 'api_key', '', 'string', true, 'Chave de API do Asaas'),
  ('asaas', 'environment', 'sandbox', 'string', false, 'Ambiente Asaas'),
  ('asaas', 'webhook_token', '', 'string', true, 'Token do webhook Asaas'),
  ('asaas', 'enabled', 'true', 'boolean', false, 'Asaas habilitado')
ON CONFLICT (category, key) DO NOTHING;

-- 4. Restaurar a constraint foreign key
ALTER TABLE public.poupeja_settings_history 
  ADD CONSTRAINT poupeja_settings_history_setting_id_fkey 
  FOREIGN KEY (setting_id) REFERENCES public.poupeja_settings(id);

-- 5. Atualizar tabela poupeja_plans
ALTER TABLE public.poupeja_plans DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE public.poupeja_plans ADD COLUMN IF NOT EXISTS asaas_price_id TEXT;