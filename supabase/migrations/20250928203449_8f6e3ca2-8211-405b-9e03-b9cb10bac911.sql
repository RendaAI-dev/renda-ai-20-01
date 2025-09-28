-- Add unique constraints for phone and cpf to prevent duplicates
ALTER TABLE public.poupeja_users 
ADD CONSTRAINT unique_phone UNIQUE (phone),
ADD CONSTRAINT unique_cpf UNIQUE (cpf);

-- Create indexes for better performance on duplicate checks
CREATE INDEX IF NOT EXISTS idx_poupeja_users_phone ON public.poupeja_users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_poupeja_users_cpf ON public.poupeja_users(cpf) WHERE cpf IS NOT NULL;