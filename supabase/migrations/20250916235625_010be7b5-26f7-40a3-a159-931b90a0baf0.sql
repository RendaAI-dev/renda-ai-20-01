-- Corrigir função para resolver warning de segurança
CREATE OR REPLACE FUNCTION calculate_discount_percentage(discounted_price numeric, original_price numeric)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF original_price = 0 OR discounted_price >= original_price THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND(((original_price - discounted_price) / original_price * 100)::numeric);
END;
$$;