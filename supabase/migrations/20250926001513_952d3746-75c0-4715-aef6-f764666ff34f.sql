-- Fix poupeja_budgets table structure with proper defaults
ALTER TABLE public.poupeja_budgets 
ALTER COLUMN spent_amount SET DEFAULT 0.0,
ALTER COLUMN period_type SET DEFAULT 'monthly',
ALTER COLUMN is_active SET DEFAULT true,
ALTER COLUMN alert_threshold SET DEFAULT 80;

-- Update existing records that might have null values
UPDATE public.poupeja_budgets 
SET spent_amount = 0.0 
WHERE spent_amount IS NULL;

UPDATE public.poupeja_budgets 
SET alert_threshold = 80 
WHERE alert_threshold IS NULL;