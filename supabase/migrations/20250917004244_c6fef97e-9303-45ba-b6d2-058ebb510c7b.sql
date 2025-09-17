-- Add new columns to poupeja_users table for CPF, birth date, and address
ALTER TABLE public.poupeja_users 
ADD COLUMN cpf TEXT,
ADD COLUMN birth_date DATE,
ADD COLUMN address JSONB,
ADD COLUMN cep TEXT;

-- Add comment for better documentation
COMMENT ON COLUMN public.poupeja_users.cpf IS 'CPF do usuário (formato: XXX.XXX.XXX-XX)';
COMMENT ON COLUMN public.poupeja_users.birth_date IS 'Data de nascimento do usuário';
COMMENT ON COLUMN public.poupeja_users.address IS 'Endereço completo obtido via ViaCEP (JSON)';
COMMENT ON COLUMN public.poupeja_users.cep IS 'CEP do usuário para busca rápida';