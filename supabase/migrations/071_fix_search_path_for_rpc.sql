-- Fix: SET search_path = '' breaks PostgREST RPC routing for functions
-- that reference extensions.vector type or public schema tables.
-- Use 'public, extensions' instead of empty string for RPC-callable functions.

ALTER FUNCTION public.match_manifest_content(extensions.vector, UUID, FLOAT, INT) SET search_path = 'public, extensions';
ALTER FUNCTION public.match_manifest_chunks(extensions.vector, UUID, FLOAT, INT) SET search_path = 'public, extensions';
ALTER FUNCTION public.match_personal_context(extensions.vector, UUID, FLOAT, INT) SET search_path = 'public, extensions';

-- Trigger functions need public schema access for INSERT/UPDATE
ALTER FUNCTION public.update_updated_at() SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';
ALTER FUNCTION public.dismiss_reminders_on_task_complete() SET search_path = 'public';
ALTER FUNCTION public.dismiss_reminders_on_task_archive() SET search_path = 'public';
ALTER FUNCTION public.activity_log_on_task_complete() SET search_path = 'public';
ALTER FUNCTION public.activity_log_on_victory_insert() SET search_path = 'public';
ALTER FUNCTION public.activity_log_on_meeting_insert() SET search_path = 'public';
ALTER FUNCTION public.activity_log_on_helm_conversation_insert() SET search_path = 'public';
ALTER FUNCTION public.activity_log_on_journal_entry_insert() SET search_path = 'public';
ALTER FUNCTION public.activity_log_on_keel_entry_insert() SET search_path = 'public';
ALTER FUNCTION public.activity_log_on_mast_entry_insert() SET search_path = 'public';
