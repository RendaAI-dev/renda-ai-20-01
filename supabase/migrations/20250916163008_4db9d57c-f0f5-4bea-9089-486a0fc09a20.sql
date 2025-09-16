-- Criar tabela de planos
CREATE TABLE public.poupeja_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  price_monthly numeric NOT NULL,
  price_annual numeric,
  stripe_price_id_monthly text,
  stripe_price_id_annual text,
  features jsonb DEFAULT '[]'::jsonb,
  limitations jsonb DEFAULT '[]'::jsonb,
  is_popular boolean DEFAULT false,
  is_active boolean DEFAULT true,
  max_users integer,
  trial_days integer DEFAULT 0,
  sort_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT poupeja_plans_pkey PRIMARY KEY (id),
  CONSTRAINT poupeja_plans_slug_key UNIQUE (slug)
);

-- Habilitar RLS
ALTER TABLE public.poupeja_plans ENABLE ROW LEVEL SECURITY;

-- Policies para administradores
CREATE POLICY "Admins can manage all plans" ON public.poupeja_plans
FOR ALL USING (is_admin());

-- Policies para usuários autenticados (apenas leitura de planos ativos)
CREATE POLICY "Users can view active plans" ON public.poupeja_plans
FOR SELECT USING (is_active = true);

-- Policies para acesso público (planos ativos)
CREATE POLICY "Public can view active plans" ON public.poupeja_plans
FOR SELECT USING (is_active = true);

-- Trigger para updated_at
CREATE TRIGGER update_poupeja_plans_updated_at
  BEFORE UPDATE ON public.poupeja_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir planos padrão baseados nas configurações atuais
INSERT INTO public.poupeja_plans (
  name, slug, description, price_monthly, price_annual, 
  is_popular, is_active, sort_order, features, created_by
) VALUES 
(
  'Mensal', 
  'monthly', 
  'Para uso pessoal completo', 
  29.90, 
  NULL,
  false, 
  true, 
  1,
  '["Movimentos ilimitados", "Dashboard completo", "Todos os relatórios", "Metas ilimitadas", "Agendamentos", "Suporte prioritário"]'::jsonb,
  (SELECT id FROM auth.users WHERE email = 'admin@admin.com' LIMIT 1)
),
(
  'Anual', 
  'annual', 
  'Melhor custo-benefício', 
  177.00, 
  177.00,
  true, 
  true, 
  2,
  '["Movimentos ilimitados", "Dashboard completo", "Todos os relatórios", "Metas ilimitadas", "Agendamentos", "Suporte VIP", "Backup automático", "Análises avançadas"]'::jsonb,
  (SELECT id FROM auth.users WHERE email = 'admin@admin.com' LIMIT 1)
);