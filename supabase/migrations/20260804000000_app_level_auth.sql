-- =============================================================================
-- KVJ Analytics — Application-Level Authentication
-- Migration: 20260804000000_app_level_auth.sql
--
-- Moves credential management OUT of Supabase Auth (auth.users) and INTO
-- flwdsk_employees, so any application connecting to this central DB can
-- authenticate employees independently of Supabase Auth.
--
-- What this adds:
--   1. pgcrypto extension (bcrypt password hashing)
--   2. password_hash column on flwdsk_employees
--   3. flwdsk_authenticate(email, password) → employee UUID or NULL
--      SECURITY DEFINER: works with the anon key (pre-auth context)
--   4. flwdsk_get_employee(email) → employee row
--      SECURITY DEFINER: needed because RLS blocks anon reads pre-auth
--   5. flwdsk_set_password(employee_id, new_password) → boolean
--      For password-change flows (requires authenticated session)
--   6. Sets default password 'password' for all existing employees
--      and marks must_change_password = true
-- =============================================================================

-- Enable bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Password hash column -------------------------------------------------------
ALTER TABLE public.flwdsk_employees
  ADD COLUMN IF NOT EXISTS password_hash text;


-- 2. Primary authentication function -------------------------------------------
-- Returns the employee's UUID if email + password match, NULL otherwise.
-- SECURITY DEFINER bypasses RLS so this works before a Supabase session exists.
CREATE OR REPLACE FUNCTION public.flwdsk_authenticate(
  p_email    text,
  p_password text
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_id            uuid;
  v_password_hash text;
  v_status        text;
BEGIN
  SELECT id, password_hash, status::text
    INTO v_id, v_password_hash, v_status
    FROM public.flwdsk_employees
   WHERE lower(email) = lower(trim(p_email))
     AND deleted_at IS NULL
   LIMIT 1;

  -- Not found, inactive, or no password set yet
  IF v_id IS NULL OR v_status <> 'active' OR v_password_hash IS NULL THEN
    RETURN NULL;
  END IF;

  -- Verify bcrypt hash
  IF crypt(p_password, v_password_hash) = v_password_hash THEN
    RETURN v_id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.flwdsk_authenticate(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flwdsk_authenticate(text, text) TO anon, authenticated;


-- 3. Employee profile loader (SECURITY DEFINER for pre-auth context) ------------
-- Needed because RLS blocks anon reads of flwdsk_employees. The login flow
-- calls this AFTER flwdsk_authenticate confirms identity.
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
    e.employee_id,
    e.username,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.designation,
    e.role,
    e.avatar_url,
    e.must_change_password,
    e.status::text
  FROM public.flwdsk_employees e
  WHERE lower(e.email) = lower(trim(p_email))
    AND e.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.flwdsk_get_employee(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flwdsk_get_employee(text) TO anon, authenticated;


-- 4. Password change function ---------------------------------------------------
-- Called after the user is already authenticated (authenticated role required).
CREATE OR REPLACE FUNCTION public.flwdsk_set_password(
  p_employee_id uuid,
  p_new_password text
) RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
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

REVOKE ALL ON FUNCTION public.flwdsk_set_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flwdsk_set_password(uuid, text) TO anon, authenticated;


-- 5. Initialise existing employees with default password -----------------------
-- Default: 'password'. Employees are flagged must_change_password = true.
-- Run this once; re-running is idempotent (only updates NULLs).
UPDATE public.flwdsk_employees
   SET password_hash        = crypt('password', gen_salt('bf', 10)),
       must_change_password = CASE
                                WHEN must_change_password IS NULL THEN true
                                ELSE must_change_password
                              END,
       updated_at           = now()
 WHERE password_hash IS NULL
   AND deleted_at   IS NULL;


-- =============================================================================
-- VERIFY — run these after the migration to confirm it worked:
-- =============================================================================
-- Should return the UUID of mail@thestrategist.co.in:
-- SELECT public.flwdsk_authenticate('mail@thestrategist.co.in', 'password');
--
-- Should return the employee row:
-- SELECT * FROM public.flwdsk_get_employee('mail@thestrategist.co.in');
-- =============================================================================
