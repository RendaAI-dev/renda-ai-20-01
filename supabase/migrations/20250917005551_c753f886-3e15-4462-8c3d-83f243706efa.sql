-- Add individual address columns to poupeja_users table
ALTER TABLE public.poupeja_users 
ADD COLUMN street text,
ADD COLUMN number text,  
ADD COLUMN complement text,
ADD COLUMN neighborhood text,
ADD COLUMN city text,
ADD COLUMN state text,
ADD COLUMN ibge text,
ADD COLUMN ddd text;

-- Migrate existing address data from JSONB to individual columns
UPDATE public.poupeja_users 
SET 
  street = address->>'street',
  number = address->>'number', 
  complement = address->>'complement',
  neighborhood = address->>'neighborhood',
  city = address->>'city',
  state = address->>'state',
  ibge = address->>'ibge',
  ddd = address->>'ddd'
WHERE address IS NOT NULL;

-- Remove the old address JSONB column after migration
ALTER TABLE public.poupeja_users DROP COLUMN address;