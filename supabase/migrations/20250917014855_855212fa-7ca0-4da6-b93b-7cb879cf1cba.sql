-- Corrigir problemas de segurança das novas tabelas Asaas

-- 1. Criar políticas RLS para poupeja_asaas_customers
CREATE POLICY "Users can view their own Asaas customer data"
  ON public.poupeja_asaas_customers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage Asaas customers"
  ON public.poupeja_asaas_customers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 2. Criar políticas RLS para poupeja_asaas_payments
CREATE POLICY "Users can view their own Asaas payments"
  ON public.poupeja_asaas_payments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage Asaas payments"
  ON public.poupeja_asaas_payments
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Adicionar triggers para updated_at
CREATE TRIGGER update_asaas_customers_updated_at
  BEFORE UPDATE ON public.poupeja_asaas_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_asaas_payments_updated_at
  BEFORE UPDATE ON public.poupeja_asaas_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();