-- =============================================================================
-- Migration: Phase 6.44 — Auth refresh-token store + revoke-on-password-change
--
-- Supports the custom-JWT auth bridge (issue-session / refresh-session Edge
-- Functions). The refresh tokens are opaque; only their SHA-256 hash is stored.
--
-- Access to this table is restricted to the Edge Functions, which use the
-- service_role key (service_role BYPASSES RLS). RLS is ENABLED with NO policies,
-- so anon/authenticated browser clients can neither read nor write it.
--
-- Additive & idempotent. Does NOT modify flwdsk_set_password, does NOT touch
-- auth.users, does NOT backfill or change any employee password hash.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.flwdsk_auth_refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.flwdsk_employees(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_flwdsk_refresh_active
  ON public.flwdsk_auth_refresh_tokens (employee_id)
  WHERE revoked_at IS NULL;

-- RLS enabled, deliberately NO policies -> only service_role (Edge Fn) may access.
ALTER TABLE public.flwdsk_auth_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: make sure no blanket policy is ever attached here.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='flwdsk_auth_refresh_tokens'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.flwdsk_auth_refresh_tokens;', r.policyname);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Revoke a user's refresh tokens whenever their password_hash changes (via the
-- flwdsk_set_password RPC or any direct update). This makes password changes
-- invalidate the ability to mint new access tokens from stale refresh tokens.
-- (Already-issued short-lived access JWTs remain valid until their exp — see the
-- Phase 6.44 report §11 "Known Limitations".)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flwdsk_revoke_refresh_on_pwd_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    UPDATE public.flwdsk_auth_refresh_tokens
       SET revoked_at = now()
     WHERE employee_id = NEW.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flwdsk_revoke_refresh_on_pwd_change ON public.flwdsk_employees;
CREATE TRIGGER trg_flwdsk_revoke_refresh_on_pwd_change
  AFTER UPDATE OF password_hash ON public.flwdsk_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.flwdsk_revoke_refresh_on_pwd_change();

COMMIT;
