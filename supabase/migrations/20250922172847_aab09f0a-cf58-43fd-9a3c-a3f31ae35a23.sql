-- Update existing plans with proper Asaas Price IDs for testing
-- These are example/placeholder IDs - in production, these should be real Asaas price IDs

UPDATE public.poupeja_plans 
SET asaas_price_id = CASE 
  WHEN name = 'Premium' AND plan_period = 'monthly' THEN 'price_monthly_premium_test'
  WHEN name = 'Plano Anual' AND plan_period = 'annual' THEN 'price_annual_premium_test'
  ELSE asaas_price_id
END
WHERE asaas_price_id IS NULL;

-- Add a constraint to ensure asaas_price_id is not null for active plans
ALTER TABLE public.poupeja_plans 
ADD CONSTRAINT check_active_plans_have_price_id 
CHECK (
  (is_active = false) OR 
  (is_active = true AND asaas_price_id IS NOT NULL AND asaas_price_id != '')
);