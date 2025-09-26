-- Create budgets table
CREATE TABLE public.poupeja_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID,
  name TEXT NOT NULL,
  planned_amount NUMERIC NOT NULL,
  spent_amount NUMERIC NOT NULL DEFAULT 0,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  alert_threshold NUMERIC DEFAULT 80,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.poupeja_budgets ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own budgets" 
ON public.poupeja_budgets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own budgets" 
ON public.poupeja_budgets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets" 
ON public.poupeja_budgets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets" 
ON public.poupeja_budgets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_budgets_updated_at
BEFORE UPDATE ON public.poupeja_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate spent amount for budgets
CREATE OR REPLACE FUNCTION public.calculate_budget_spent_amount(
  p_budget_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_spent_amount NUMERIC := 0;
  v_budget RECORD;
BEGIN
  -- Get budget details
  SELECT * INTO v_budget
  FROM public.poupeja_budgets
  WHERE id = p_budget_id;
  
  IF v_budget IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate spent amount from transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_spent_amount
  FROM public.poupeja_transactions
  WHERE user_id = v_budget.user_id
    AND type = 'expense'
    AND date >= v_budget.start_date
    AND date <= v_budget.end_date
    AND (v_budget.category_id IS NULL OR category_id = v_budget.category_id);
  
  -- Update budget with calculated amount
  UPDATE public.poupeja_budgets
  SET spent_amount = v_spent_amount,
      updated_at = NOW()
  WHERE id = p_budget_id;
  
  RETURN v_spent_amount;
END;
$$;

-- Create function to update all budget spent amounts
CREATE OR REPLACE FUNCTION public.update_budget_spent_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  budget_record RECORD;
BEGIN
  -- Update all active budgets that might be affected by this transaction
  FOR budget_record IN 
    SELECT id FROM public.poupeja_budgets 
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
      AND is_active = true
      AND (
        (COALESCE(NEW.date, OLD.date) >= start_date AND COALESCE(NEW.date, OLD.date) <= end_date)
        OR (category_id IS NULL OR category_id = COALESCE(NEW.category_id, OLD.category_id))
      )
  LOOP
    PERFORM public.calculate_budget_spent_amount(budget_record.id);
  END LOOP;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to update budget spent amounts when transactions change
CREATE TRIGGER update_budget_on_transaction_change
AFTER INSERT OR UPDATE OR DELETE ON public.poupeja_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_budget_spent_amounts();