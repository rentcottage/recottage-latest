-- Verifies an agency login against auth.users without exposing the table to the
-- anon/authenticated clients. Returns the user id on match, NULL otherwise.
-- Used by the corporate-login edge function so agencies can sign in with their
-- tax ID + password.

CREATE OR REPLACE FUNCTION public.verify_corporate_login(p_email text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  result_id uuid;
BEGIN
  SELECT id INTO result_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
    AND encrypted_password = crypt(p_password, encrypted_password)
    AND email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL;
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_corporate_login(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_corporate_login(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_corporate_login(text, text) TO service_role;
