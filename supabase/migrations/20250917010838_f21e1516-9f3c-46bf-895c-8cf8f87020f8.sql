-- Fix birth date field extraction in trigger
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
  -- Log detalhado
  RAISE WARNING '[AUTH_TRIGGER] Usuário criado no auth.users - ID: %, Email: %', NEW.id, NEW.email;
  RAISE WARNING '[AUTH_TRIGGER] Raw metadata: %', NEW.raw_user_meta_data;
  
  -- Extrair dados do metadata
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
  
  -- Converter data de nascimento - CORRIGIDO: buscar birth_date primeiro, depois birthDate
  birth_date_str := COALESCE(
    NEW.raw_user_meta_data->>'birth_date',  -- snake_case (enviado pelo form)
    NEW.raw_user_meta_data->>'birthDate'    -- camelCase (compatibilidade)
  );
  
  RAISE WARNING '[AUTH_TRIGGER] Campo birth_date encontrado: "%"', birth_date_str;
  
  IF birth_date_str IS NOT NULL THEN
    BEGIN
      user_birth_date := birth_date_str::DATE;
      RAISE WARNING '[AUTH_TRIGGER] ✅ Data convertida com sucesso: %', user_birth_date;
    EXCEPTION
      WHEN others THEN
        user_birth_date := NULL;
        RAISE WARNING '[AUTH_TRIGGER] ❌ Erro ao converter data de nascimento: "%" - Erro: %', birth_date_str, SQLERRM;
    END;
  ELSE
    RAISE WARNING '[AUTH_TRIGGER] ⚠️ Campo birth_date não encontrado no metadata';
  END IF;
  
  -- Extrair campos de endereço do objeto address
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
  
  RAISE WARNING '[AUTH_TRIGGER] Dados processados - Nome: "%", Phone: "%", CPF: "%", CEP: "%", Nascimento: %', 
    user_name, user_phone, user_cpf, user_cep, user_birth_date;
  
  -- Confirmar email automaticamente
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = NEW.id;
  
  RAISE WARNING '[AUTH_TRIGGER] Email confirmado automaticamente';
  
  -- Inserir na tabela poupeja_users com todos os campos
  INSERT INTO public.poupeja_users (
    id, 
    email, 
    name, 
    phone,
    cpf,
    birth_date,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    ibge,
    ddd,
    created_at, 
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    NULLIF(user_name, ''),
    NULLIF(user_phone, ''),
    NULLIF(user_cpf, ''),
    user_birth_date,
    NULLIF(user_cep, ''),
    NULLIF(user_street, ''),
    NULLIF(user_number, ''),
    NULLIF(user_complement, ''),
    NULLIF(user_neighborhood, ''),
    NULLIF(user_city, ''),
    NULLIF(user_state, ''),
    NULLIF(user_ibge, ''),
    NULLIF(user_ddd, ''),
    NOW(),
    NOW()
  );
  
  RAISE WARNING '[AUTH_TRIGGER] ✅ SUCESSO - Usuário inserido em poupeja_users com todos os campos: %', NEW.id;
  
  RETURN NEW;
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE WARNING '[AUTH_TRIGGER] ⚠️ Usuário já existe na poupeja_users: %', NEW.id;
    RETURN NEW;
  WHEN others THEN
    RAISE WARNING '[AUTH_TRIGGER] ❌ ERRO CRÍTICO: % - %', SQLERRM, SQLSTATE;
    RAISE WARNING '[AUTH_TRIGGER] Dados que falharam: ID=%, Email=%, Nome=%, Phone=%, CPF=%', 
      NEW.id, NEW.email, user_name, user_phone, user_cpf;
    RETURN NEW; -- Não quebrar o signup
END;
$function$;