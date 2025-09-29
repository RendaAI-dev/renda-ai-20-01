-- Fix RLS policies for poupeja_notifications table to prevent public access

-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage all notifications" ON public.poupeja_notifications;

-- Create a proper service role policy that explicitly checks for service_role JWT
CREATE POLICY "Service role can manage all notifications"
ON public.poupeja_notifications
FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Ensure users can only delete their own notifications
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.poupeja_notifications;
CREATE POLICY "Users can delete their own notifications"
ON public.poupeja_notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Ensure users can only insert their own notifications  
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.poupeja_notifications;
CREATE POLICY "Users can insert their own notifications"
ON public.poupeja_notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix RLS policies for poupeja_payment_redirects table to prevent public access

-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage all payment redirects" ON public.poupeja_payment_redirects;

-- Create a proper service role policy that explicitly checks for service_role JWT
CREATE POLICY "Service role can manage all payment redirects"
ON public.poupeja_payment_redirects
FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Ensure users can only insert their own payment redirects
DROP POLICY IF EXISTS "Users can insert their own payment redirects" ON public.poupeja_payment_redirects;
CREATE POLICY "Users can insert their own payment redirects"
ON public.poupeja_payment_redirects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ensure users can only update their own payment redirects
DROP POLICY IF EXISTS "Users can update their own payment redirects" ON public.poupeja_payment_redirects;
CREATE POLICY "Users can update their own payment redirects"
ON public.poupeja_payment_redirects
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure users can only delete their own payment redirects
DROP POLICY IF EXISTS "Users can delete their own payment redirects" ON public.poupeja_payment_redirects;
CREATE POLICY "Users can delete their own payment redirects"
ON public.poupeja_payment_redirects
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);