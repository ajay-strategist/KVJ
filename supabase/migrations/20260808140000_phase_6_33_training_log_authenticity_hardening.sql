-- =============================================================================
-- Migration: Phase 6.33 — Training Audit & Email Log Authenticity Hardening
-- =============================================================================

BEGIN;

-- 1. Drop Legacy Telemetry Insert Policies
DROP POLICY IF EXISTS audit_logs_insert ON public.flwdsk_audit_logs;
DROP POLICY IF EXISTS email_logs_insert ON public.flwdsk_email_logs;

-- 2. Establish Default Column Values
-- Ensures that if insert payload omits identity columns, PostgreSQL defaults to active auth.uid().
ALTER TABLE public.flwdsk_audit_logs ALTER COLUMN actor_id SET DEFAULT auth.uid();
ALTER TABLE public.flwdsk_email_logs ALTER COLUMN sent_by SET DEFAULT auth.uid();

-- 3. Create Hardened Log Insert Policies
-- Requires that actor_id matches the active authenticated session ID.
CREATE POLICY audit_logs_insert ON public.flwdsk_audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND actor_id = auth.uid());

-- Requires that sent_by maps to the active authenticated session ID, or is explicitly null.
CREATE POLICY email_logs_insert ON public.flwdsk_email_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (sent_by = auth.uid() OR sent_by IS NULL));

COMMIT;
