-- Create table to store payment redirect URLs
CREATE TABLE public.poupeja_payment_redirects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_payment_id TEXT NOT NULL,
  invoice_url TEXT NOT NULL,
  checkout_id TEXT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Enable RLS
ALTER TABLE public.poupeja_payment_redirects ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own payment redirects" 
ON public.poupeja_payment_redirects 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all payment redirects" 
ON public.poupeja_payment_redirects 
FOR ALL 
USING (true);

-- Create index for better performance
CREATE INDEX idx_payment_redirects_user_processed ON public.poupeja_payment_redirects(user_id, processed);
CREATE INDEX idx_payment_redirects_payment_id ON public.poupeja_payment_redirects(asaas_payment_id);