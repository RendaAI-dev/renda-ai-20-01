-- Corrigir a função is_admin que está com problema de ambiguidade
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = $1 AND ur.role = 'admin'::app_role
  );
END;
$function$;

-- Verificar se o tipo app_role existe, senão criar
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
    END IF;
END $$;

-- Verificar se a tabela user_roles existe e está correta
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role app_role NOT NULL DEFAULT 'user'::app_role,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Habilitar RLS na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para user_roles
DROP POLICY IF EXISTS "Service role can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "users_select_own_roles" ON public.user_roles;

CREATE POLICY "Service role can manage all roles" 
ON public.user_roles 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "users_select_own_roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Conceder permissões de admin ao usuário atual (admin@admin.com)
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin'::app_role
FROM auth.users au
WHERE au.email = 'admin@admin.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Atualizar a função has_role para usar a tabela correta
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  )
$function$;