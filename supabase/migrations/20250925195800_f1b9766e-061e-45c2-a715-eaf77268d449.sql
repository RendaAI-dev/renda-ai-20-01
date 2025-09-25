-- 1. Adicionar campo last_activity_at na tabela poupeja_users para tracking real de atividade
ALTER TABLE public.poupeja_users 
ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now();

-- 2. Atualizar usuários existentes com data atual
UPDATE public.poupeja_users 
SET last_activity_at = now()
WHERE last_activity_at IS NULL;

-- 3. Criar função para inserir preferências padrão para usuários
CREATE OR REPLACE FUNCTION public.ensure_user_preferences(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  preference_id UUID;
BEGIN
  -- Inserir preferências padrão se não existir
  INSERT INTO public.poupeja_user_preferences (
    user_id, 
    notification_preferences
  ) VALUES (
    user_id, 
    jsonb_build_object(
      'marketing', true,
      'system', true,
      'email', true,
      'push', true
    )
  )
  ON CONFLICT (user_id) DO UPDATE SET
    notification_preferences = EXCLUDED.notification_preferences
  RETURNING id INTO preference_id;
  
  RETURN preference_id;
END;
$function$;

-- 4. Inserir preferências padrão para todos os usuários existentes
INSERT INTO public.poupeja_user_preferences (user_id, notification_preferences)
SELECT 
  id,
  jsonb_build_object(
    'marketing', true,
    'system', true,
    'email', true,
    'push', true
  )
FROM public.poupeja_users
ON CONFLICT (user_id) DO NOTHING;

-- 5. Atualizar trigger para criar preferências automaticamente para novos usuários
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_name TEXT;
  user_phone TEXT;
  user_cpf TEXT;
  user_birth_date DATE;
  user_cep TEXT;
  user_street TEXT;
  user_number TEXT;
  user_complement TEXT;
  user_neighborhood TEXT;
  user_city TEXT;
  user_state TEXT;
  user_ibge TEXT;
  user_ddd TEXT;
  address_obj JSONB;
  birth_date_str TEXT;
BEGIN
  -- Extrair dados do metadata (mantendo lógica existente)
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'fullName',
    ''
  );
  
  user_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'whatsapp',
    ''
  );
  
  user_cpf := COALESCE(NEW.raw_user_meta_data->>'cpf', '');
  user_cep := COALESCE(NEW.raw_user_meta_data->>'cep', '');
  
  birth_date_str := COALESCE(
    NEW.raw_user_meta_data->>'birth_date',
    NEW.raw_user_meta_data->>'birthDate'
  );
  
  IF birth_date_str IS NOT NULL THEN
    BEGIN
      user_birth_date := birth_date_str::DATE;
    EXCEPTION
      WHEN others THEN
        user_birth_date := NULL;
    END;
  END IF;
  
  -- Extrair campos de endereço
  address_obj := NEW.raw_user_meta_data->'address';
  IF address_obj IS NOT NULL THEN
    user_street := COALESCE(address_obj->>'street', '');
    user_number := COALESCE(address_obj->>'number', '');
    user_complement := COALESCE(address_obj->>'complement', '');
    user_neighborhood := COALESCE(address_obj->>'neighborhood', '');
    user_city := COALESCE(address_obj->>'city', '');
    user_state := COALESCE(address_obj->>'state', '');
    user_ibge := COALESCE(address_obj->>'ibge', '');
    user_ddd := COALESCE(address_obj->>'ddd', '');
  END IF;
  
  -- Confirmar email automaticamente
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = NEW.id;
  
  -- Inserir na tabela poupeja_users (mantendo lógica existente)
  INSERT INTO public.poupeja_users (
    id, email, name, phone, cpf, birth_date, cep, street, number, 
    complement, neighborhood, city, state, ibge, ddd, 
    created_at, updated_at, last_activity_at
  ) VALUES (
    NEW.id, NEW.email, NULLIF(user_name, ''), NULLIF(user_phone, ''),
    NULLIF(user_cpf, ''), user_birth_date, NULLIF(user_cep, ''),
    NULLIF(user_street, ''), NULLIF(user_number, ''), NULLIF(user_complement, ''),
    NULLIF(user_neighborhood, ''), NULLIF(user_city, ''), NULLIF(user_state, ''),
    NULLIF(user_ibge, ''), NULLIF(user_ddd, ''), NOW(), NOW(), NOW()
  );
  
  -- Criar preferências padrão para o novo usuário
  PERFORM public.ensure_user_preferences(NEW.id);
  
  RETURN NEW;
  
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
  WHEN others THEN
    RETURN NEW;
END;
$function$;