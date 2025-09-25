-- Add confirmed_date column to poupeja_asaas_payments table
ALTER TABLE public.poupeja_asaas_payments 
ADD COLUMN confirmed_date TIMESTAMPTZ NULL;

-- Add comment to the new column
COMMENT ON COLUMN public.poupeja_asaas_payments.confirmed_date IS 'Date when payment was confirmed by Asaas (from confirmedDate field)';

-- Update existing records that have a payment_date to set confirmed_date
UPDATE public.poupeja_asaas_payments 
SET confirmed_date = payment_date::timestamptz
WHERE payment_date IS NOT NULL AND status = 'CONFIRMED';

-- Create index on confirmed_date for better query performance
CREATE INDEX idx_poupeja_asaas_payments_confirmed_date 
ON public.poupeja_asaas_payments(confirmed_date) 
WHERE confirmed_date IS NOT NULL;