-- Create table for pending plan changes
CREATE TABLE public.poupeja_plan_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID NOT NULL,
  current_plan_type TEXT NOT NULL,
  new_plan_type TEXT NOT NULL,
  new_plan_value NUMERIC NOT NULL,
  asaas_payment_id TEXT,
  payment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled, expired
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.poupeja_plan_change_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own plan change requests" 
ON public.poupeja_plan_change_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plan change requests" 
ON public.poupeja_plan_change_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all plan change requests" 
ON public.poupeja_plan_change_requests 
FOR ALL 
USING (true);

-- Update trigger
CREATE TRIGGER update_poupeja_plan_change_requests_updated_at
BEFORE UPDATE ON public.poupeja_plan_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_poupeja_plan_change_requests_user_id ON public.poupeja_plan_change_requests(user_id);
CREATE INDEX idx_poupeja_plan_change_requests_payment_id ON public.poupeja_plan_change_requests(asaas_payment_id);