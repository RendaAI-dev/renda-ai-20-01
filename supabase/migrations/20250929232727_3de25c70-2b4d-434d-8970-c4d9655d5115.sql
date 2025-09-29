-- Fix RLS policies for poupeja_plan_change_requests table to prevent public access

-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage all plan change requests" ON public.poupeja_plan_change_requests;

-- Create a proper service role policy that explicitly checks for service_role JWT
CREATE POLICY "Service role can manage all plan change requests"
ON public.poupeja_plan_change_requests
FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Ensure users can only insert their own plan change requests
DROP POLICY IF EXISTS "Users can insert their own plan change requests" ON public.poupeja_plan_change_requests;
CREATE POLICY "Users can insert their own plan change requests"
ON public.poupeja_plan_change_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ensure users can only view their own plan change requests
DROP POLICY IF EXISTS "Users can view their own plan change requests" ON public.poupeja_plan_change_requests;
CREATE POLICY "Users can view their own plan change requests"
ON public.poupeja_plan_change_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add policy for users to update their own plan change requests (e.g., cancel)
CREATE POLICY "Users can update their own plan change requests"
ON public.poupeja_plan_change_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add policy for users to delete their own plan change requests
CREATE POLICY "Users can delete their own plan change requests"
ON public.poupeja_plan_change_requests
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);