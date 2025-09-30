-- Remove notification triggers first
DROP TRIGGER IF EXISTS notification_transaction_changes ON poupeja_transactions;
DROP TRIGGER IF EXISTS notification_goal_changes ON poupeja_goals;
DROP TRIGGER IF EXISTS notification_scheduled_transaction_changes ON poupeja_scheduled_transactions;
DROP TRIGGER IF EXISTS notification_subscription_changes ON poupeja_subscriptions;

-- Remove notification functions with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS public.notify_transaction_changes() CASCADE;
DROP FUNCTION IF EXISTS public.notify_goal_changes() CASCADE;
DROP FUNCTION IF EXISTS public.notify_scheduled_transaction_changes() CASCADE;
DROP FUNCTION IF EXISTS public.notify_subscription_changes() CASCADE;
DROP FUNCTION IF EXISTS public.create_notification(uuid, text, text, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.mark_notification_read(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.mark_all_notifications_read(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_unread_notifications_count(uuid) CASCADE;

-- Remove notification tables
DROP TABLE IF EXISTS public.poupeja_notification_logs CASCADE;
DROP TABLE IF EXISTS public.poupeja_notifications CASCADE;
DROP TABLE IF EXISTS public.poupeja_device_tokens CASCADE;
DROP TABLE IF EXISTS public.poupeja_web_push_subscriptions CASCADE;

-- Remove notification preferences column from user preferences
ALTER TABLE public.poupeja_user_preferences 
DROP COLUMN IF EXISTS notification_preferences;