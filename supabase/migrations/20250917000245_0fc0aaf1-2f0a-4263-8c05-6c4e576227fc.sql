-- Add plan_period enum type
CREATE TYPE plan_period AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');

-- Add plan_period column and simplify pricing structure
ALTER TABLE public.poupeja_plans 
ADD COLUMN plan_period plan_period NOT NULL DEFAULT 'monthly',
ADD COLUMN price numeric NOT NULL DEFAULT 0,
ADD COLUMN price_original numeric,
ADD COLUMN stripe_price_id text;

-- Update existing plans to use new structure (convert first monthly plan as example)
UPDATE public.poupeja_plans 
SET 
  price = price_monthly,
  price_original = price_monthly_original,
  stripe_price_id = stripe_price_id_monthly,
  plan_period = 'monthly'
WHERE price_monthly IS NOT NULL;

-- Remove old price columns after data migration
ALTER TABLE public.poupeja_plans 
DROP COLUMN IF EXISTS price_monthly,
DROP COLUMN IF EXISTS price_quarterly, 
DROP COLUMN IF EXISTS price_semiannual,
DROP COLUMN IF EXISTS price_annual,
DROP COLUMN IF EXISTS price_monthly_original,
DROP COLUMN IF EXISTS price_quarterly_original,
DROP COLUMN IF EXISTS price_semiannual_original,
DROP COLUMN IF EXISTS price_annual_original,
DROP COLUMN IF EXISTS stripe_price_id_monthly,
DROP COLUMN IF EXISTS stripe_price_id_quarterly,
DROP COLUMN IF EXISTS stripe_price_id_semiannual,
DROP COLUMN IF EXISTS stripe_price_id_annual;

-- Add constraint to ensure unique plan name per period
ALTER TABLE public.poupeja_plans 
ADD CONSTRAINT unique_plan_name_period UNIQUE (name, plan_period);

-- Update the existing function to work with new structure
CREATE OR REPLACE FUNCTION public.calculate_discount_percentage(discounted_price numeric, original_price numeric)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF original_price = 0 OR original_price IS NULL OR discounted_price >= original_price THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND(((original_price - discounted_price) / original_price * 100)::numeric);
END;
$function$;