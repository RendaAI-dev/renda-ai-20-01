-- Atualizar estrutura da tabela poupeja_plans para suportar múltiplos períodos
ALTER TABLE public.poupeja_plans 
ADD COLUMN IF NOT EXISTS price_monthly_original numeric,
ADD COLUMN IF NOT EXISTS price_quarterly_original numeric,
ADD COLUMN IF NOT EXISTS price_semiannual_original numeric,
ADD COLUMN IF NOT EXISTS price_annual_original numeric;

-- Limpar planos existentes e criar um plano principal
DELETE FROM public.poupeja_plans;

-- Inserir plano principal com todos os períodos
INSERT INTO public.poupeja_plans (
  name, 
  slug,
  description,
  price_monthly, 
  price_quarterly, 
  price_semiannual, 
  price_annual,
  price_monthly_original,
  price_quarterly_original,
  price_semiannual_original,
  price_annual_original,
  features,
  is_popular,
  is_active,
  sort_order
) VALUES (
  'Premium',
  'premium',
  'Plano completo com todas as funcionalidades',
  29.90,  -- Mensal
  87.90,  -- Trimestral (original: 89.70, desconto: 2%)
  169.90, -- Semestral (original: 179.40, desconto: 5%)
  177.00, -- Anual (original: 358.80, desconto: 51%)
  29.90,  -- Original mensal (sem desconto)
  89.70,  -- Original trimestral (3 * 29.90)
  179.40, -- Original semestral (6 * 29.90)
  358.80, -- Original anual (12 * 29.90)
  '["Controle financeiro completo", "Metas e objetivos", "Relatórios detalhados", "Categorias personalizadas", "Lembretes automáticos", "Sincronização em nuvem", "Suporte prioritário"]'::jsonb,
  true,
  true,
  1
);

-- Função para calcular desconto percentual
CREATE OR REPLACE FUNCTION calculate_discount_percentage(discounted_price numeric, original_price numeric)
RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  IF original_price = 0 OR discounted_price >= original_price THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND(((original_price - discounted_price) / original_price * 100)::numeric);
END;
$$;