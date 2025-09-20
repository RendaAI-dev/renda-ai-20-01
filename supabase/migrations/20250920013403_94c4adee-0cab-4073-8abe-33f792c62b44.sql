-- First, remove history records for Stripe-related settings
DELETE FROM public.poupeja_settings_history 
WHERE setting_id IN (
  SELECT id FROM public.poupeja_settings 
  WHERE category = 'stripe' 
     OR key LIKE '%stripe%' 
     OR key IN ('STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'monthly_price_id', 'annual_price_id')
);

-- Then remove the Stripe-related settings
DELETE FROM public.poupeja_settings 
WHERE category = 'stripe' 
   OR key LIKE '%stripe%' 
   OR key IN ('STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'monthly_price_id', 'annual_price_id');

-- Remove Stripe-related column from customers table
ALTER TABLE public.poupeja_customers DROP COLUMN IF EXISTS stripe_customer_id;