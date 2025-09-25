-- Adicionar foreign key entre user_roles e poupeja_users
ALTER TABLE public.user_roles 
ADD CONSTRAINT fk_user_roles_poupeja_users 
FOREIGN KEY (user_id) REFERENCES public.poupeja_users(id) ON DELETE CASCADE;

-- Verificar se a função is_admin existe, se não, criar
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = $1 AND ur.role = 'admin'::app_role
  );
END;
$$;