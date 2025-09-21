-- Corrigir valores dos planos na tabela poupeja_settings
UPDATE poupeja_settings 
SET value = '49.90', updated_at = NOW(), updated_by = auth.uid()
WHERE category = 'pricing' AND key = 'plan_price_monthly';

UPDATE poupeja_settings 
SET value = '538.90', updated_at = NOW(), updated_by = auth.uid()
WHERE category = 'pricing' AND key = 'plan_price_annual';

-- Verificar se os valores foram atualizados corretamente
SELECT category, key, value FROM poupeja_settings WHERE category = 'pricing' ORDER BY key;