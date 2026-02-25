-- Migration 012: Add delete_user_account RPC function
-- Allows authenticated users to delete their own account.
-- Deleting from auth.users cascades to all related tables via FK constraints.

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the auth user, which cascades to all tables via FK constraints
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
