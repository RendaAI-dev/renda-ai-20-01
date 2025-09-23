-- Corrigir o flag de criptografia do webhook token
UPDATE public.poupeja_settings 
SET encrypted = false,
    updated_at = NOW()
WHERE category = 'asaas' 
  AND key = 'webhook_token';