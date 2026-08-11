-- =============================================================================
-- Migration: Phase 6.36 — Training RPC Authorization Hardening & Account-Takeover Remediation
-- =============================================================================

BEGIN;

-- 1. Redefine flwdsk_set_password with strict caller verification -------------
CREATE OR REPLACE FUNCTION public.flwdsk_set_password(
  p_employee_id uuid,
  p_new_password text
) RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, extensions
AS $$
BEGIN
  -- Assert session exists
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated password mutation request.';
  END IF;

  -- Verify caller is either changing their own password, or is a training admin
  IF auth.uid() <> p_employee_id AND NOT public.is_training_admin() THEN
    RAISE EXCEPTION 'Unauthorized password change request.';
  END IF;

  -- Validate minimum password length constraint
  IF length(trim(p_new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE public.flwdsk_employees
     SET password_hash        = crypt(p_new_password, gen_salt('bf', 10)),
         must_change_password = false,
         updated_at           = now()
   WHERE id = p_employee_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- Revoke execute from PUBLIC and anon roles (only authenticated and service_role should access it)
REVOKE ALL ON FUNCTION public.flwdsk_set_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flwdsk_set_password(uuid, text) TO authenticated, service_role;


-- 2. Redefine flwdsk_get_employee to prevent anonymous profile scraping -------
CREATE OR REPLACE FUNCTION public.flwdsk_get_employee(
  p_email text
) RETURNS TABLE (
  id                   uuid,
  employee_id          text,
  username             text,
  first_name           text,
  last_name            text,
  email                text,
  phone                text,
  designation          text,
  role                 text,
  avatar_url           text,
  must_change_password boolean,
  status               text
)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT
    e.id,
    -- Return NULL for sensitive columns if caller is anonymous to prevent enumeration profile scraping
    CASE WHEN auth.uid() IS NOT NULL THEN e.employee_id ELSE NULL END as employee_id,
    CASE WHEN auth.uid() IS NOT NULL THEN e.username ELSE NULL END as username,
    e.first_name,
    e.last_name,
    e.email,
    CASE WHEN auth.uid() IS NOT NULL THEN e.phone ELSE NULL END as phone,
    CASE WHEN auth.uid() IS NOT NULL THEN e.designation ELSE NULL END as designation,
    e.role,
    CASE WHEN auth.uid() IS NOT NULL THEN e.avatar_url ELSE NULL END as avatar_url,
    e.must_change_password,
    e.status::text
  FROM public.flwdsk_employees e
  WHERE lower(e.email) = lower(trim(p_email))
    AND e.deleted_at IS NULL
  LIMIT 1;
$$;

COMMIT;
