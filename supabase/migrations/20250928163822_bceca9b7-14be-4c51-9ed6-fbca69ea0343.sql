-- Fix the handle_auth_user_created function to properly handle errors and add logging
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER
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
  error_msg TEXT;
BEGIN
  -- Log trigger execution
  RAISE LOG 'handle_auth_user_created triggered for user: %', NEW.id;
  
  -- Extract data from metadata
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
        RAISE LOG 'Invalid birth_date format for user %: %', NEW.id, birth_date_str;
    END;
  END IF;
  
  -- Extract address fields
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
  
  -- Confirm email automatically
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = NEW.id;
  
  -- Insert into poupeja_users table with explicit error handling
  BEGIN
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
    
    RAISE LOG 'Successfully created poupeja_users entry for user: %', NEW.id;
    
  EXCEPTION
    WHEN unique_violation THEN
      RAISE LOG 'User already exists in poupeja_users: %', NEW.id;
    WHEN others THEN
      -- Log the actual error instead of silencing it
      GET STACKED DIAGNOSTICS error_msg = MESSAGE_TEXT;
      RAISE LOG 'Failed to create poupeja_users entry for user %: %', NEW.id, error_msg;
      -- Re-raise the error so we know something failed
      RAISE EXCEPTION 'Failed to create user profile: %', error_msg;
  END;
  
  -- Create default preferences for the new user
  BEGIN
    PERFORM public.ensure_user_preferences(NEW.id);
    RAISE LOG 'Successfully created preferences for user: %', NEW.id;
  EXCEPTION
    WHEN others THEN
      GET STACKED DIAGNOSTICS error_msg = MESSAGE_TEXT;
      RAISE LOG 'Failed to create preferences for user %: %', NEW.id, error_msg;
  END;
  
  RETURN NEW;
END;
$function$;

-- Add a policy to allow the trigger to insert users regardless of RLS
CREATE POLICY "Allow trigger and service role to insert users"
ON public.poupeja_users
FOR INSERT
TO authenticated, anon
WITH CHECK (
  -- Allow service role and authenticated users to insert
  auth.jwt() ->> 'role' = 'service_role' OR
  auth.uid() = id OR
  -- Allow function with SECURITY DEFINER to bypass RLS
  current_setting('role') = 'postgres'
);

-- Recover all missing users immediately
DO $$
DECLARE
  recovered_count INTEGER := 0;
  user_record RECORD;
  error_msg TEXT;
BEGIN
  RAISE LOG 'Starting user recovery process...';
  
  FOR user_record IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.poupeja_users pu ON au.id = pu.id
    WHERE pu.id IS NULL
  LOOP
    BEGIN
      INSERT INTO public.poupeja_users (
        id, 
        email, 
        name, 
        phone, 
        created_at, 
        updated_at, 
        last_activity_at
      ) VALUES (
        user_record.id,
        user_record.email,
        COALESCE(
          user_record.raw_user_meta_data->>'full_name',
          user_record.raw_user_meta_data->>'name',
          user_record.raw_user_meta_data->>'fullName',
          split_part(user_record.email, '@', 1)
        ),
        user_record.raw_user_meta_data->>'phone',
        NOW(),
        NOW(),
        NOW()
      );
      
      -- Create default preferences
      PERFORM public.ensure_user_preferences(user_record.id);
      
      recovered_count := recovered_count + 1;
      RAISE LOG 'Recovered user: %', user_record.email;
      
    EXCEPTION
      WHEN others THEN
        GET STACKED DIAGNOSTICS error_msg = MESSAGE_TEXT;
        RAISE LOG 'Failed to recover user %: %', user_record.email, error_msg;
    END;
  END LOOP;
  
  RAISE LOG 'User recovery completed. Recovered % users.', recovered_count;
END;
$$;