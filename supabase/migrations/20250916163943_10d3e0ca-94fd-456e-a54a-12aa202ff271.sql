-- Adicionar campos para períodos flexíveis na tabela poupeja_plans
ALTER TABLE public.poupeja_plans 
ADD COLUMN price_quarterly numeric,
ADD COLUMN price_semiannual numeric,
ADD COLUMN stripe_price_id_quarterly text,
ADD COLUMN stripe_price_id_semiannual text;

-- Atualizar planos existentes com preços para novos períodos
UPDATE public.poupeja_plans 
SET 
  price_quarterly = CASE 
    WHEN slug = 'monthly' THEN 87.90  -- 3 meses com 2% desconto
    WHEN slug = 'annual' THEN 525.00  -- trimestral do plano anual
  END,
  price_semiannual = CASE 
    WHEN slug = 'monthly' THEN 169.90  -- 6 meses com 5% desconto  
    WHEN slug = 'annual' THEN 1050.00  -- semestral do plano anual
  END
WHERE slug IN ('monthly', 'annual');