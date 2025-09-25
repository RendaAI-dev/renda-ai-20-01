-- First, let's check and clean any orphaned data before adding foreign keys
-- Remove any subscriptions without valid users
DELETE FROM public.poupeja_subscriptions 
WHERE user_id NOT IN (SELECT id FROM public.poupeja_users);

-- Remove any user preferences without valid users
DELETE FROM public.poupeja_user_preferences 
WHERE user_id NOT IN (SELECT id FROM public.poupeja_users);

-- Add foreign key constraints
ALTER TABLE public.poupeja_subscriptions 
ADD CONSTRAINT fk_poupeja_subscriptions_user_id 
FOREIGN KEY (user_id) REFERENCES public.poupeja_users(id) ON DELETE CASCADE;

ALTER TABLE public.poupeja_user_preferences 
ADD CONSTRAINT fk_poupeja_user_preferences_user_id 
FOREIGN KEY (user_id) REFERENCES public.poupeja_users(id) ON DELETE CASCADE;

-- Create indexes for better performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_poupeja_subscriptions_user_id ON public.poupeja_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_poupeja_subscriptions_status ON public.poupeja_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_poupeja_user_preferences_user_id ON public.poupeja_user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_poupeja_users_last_activity_at ON public.poupeja_users(last_activity_at);