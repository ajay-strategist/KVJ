-- =============================================================================
-- Migration: Phase 6.30 — Training Module RLS & Security Hardening
-- =============================================================================

BEGIN;

-- 1. Helper Functions for Role and Scope Resolutions
-- SECURITY DEFINER so that policies do not self-recurse.
-- Search path is explicitly set to public for security.

CREATE OR REPLACE FUNCTION public.is_training_admin()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM flwdsk_employees
    WHERE id = auth.uid()
      AND role::text IN ('ADMIN', 'CEO', 'MANAGER', 'COORDINATOR')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_batch_trainer(batch_uuid uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM flwdsk_batches
    WHERE id = batch_uuid
      AND trainer_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_student_trainer(student_uuid uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM flwdsk_enrollments e
    JOIN flwdsk_batches b ON e.batch_id = b.id
    WHERE e.student_id = student_uuid
      AND b.trainer_id = auth.uid()
      AND e.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_enrollment_trainer(enrollment_uuid uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM flwdsk_enrollments e
    JOIN flwdsk_batches b ON e.batch_id = b.id
    WHERE e.id = enrollment_uuid
      AND b.trainer_id = auth.uid()
      AND e.deleted_at IS NULL
  );
$$;

-- 2. Drop Legacy Permissive Training Policies
-- Ensure we clean up any pre-existing "Allow full access for authenticated users" or "public_read" policies.

DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.flwdsk_courses;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.flwdsk_colleges;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.flwdsk_batches;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.flwdsk_student_records;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.flwdsk_enrollments;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.flwdsk_schedule_sessions;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.flwdsk_assessments;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.flwdsk_final_exam_results;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.flwdsk_certificates;

DROP POLICY IF EXISTS "batches_public_read" ON public.flwdsk_batches;
DROP POLICY IF EXISTS "batches_auth_write" ON public.flwdsk_batches;
DROP POLICY IF EXISTS "batches_auth_update" ON public.flwdsk_batches;
DROP POLICY IF EXISTS "batches_auth_delete" ON public.flwdsk_batches;

DROP POLICY IF EXISTS "courses_public_read" ON public.flwdsk_courses;
DROP POLICY IF EXISTS "courses_auth_write" ON public.flwdsk_courses;
DROP POLICY IF EXISTS "courses_auth_update" ON public.flwdsk_courses;
DROP POLICY IF EXISTS "courses_auth_delete" ON public.flwdsk_courses;

DROP POLICY IF EXISTS "colleges_public_read" ON public.flwdsk_colleges;
DROP POLICY IF EXISTS "colleges_auth_write" ON public.flwdsk_colleges;
DROP POLICY IF EXISTS "colleges_auth_update" ON public.flwdsk_colleges;
DROP POLICY IF EXISTS "colleges_auth_delete" ON public.flwdsk_colleges;

DROP POLICY IF EXISTS "student_records_public_read" ON public.flwdsk_student_records;
DROP POLICY IF EXISTS "student_records_auth_write" ON public.flwdsk_student_records;
DROP POLICY IF EXISTS "student_records_auth_update" ON public.flwdsk_student_records;
DROP POLICY IF EXISTS "student_records_auth_delete" ON public.flwdsk_student_records;

DROP POLICY IF EXISTS "enrollments_public_read" ON public.flwdsk_enrollments;
DROP POLICY IF EXISTS "enrollments_auth_write" ON public.flwdsk_enrollments;
DROP POLICY IF EXISTS "enrollments_auth_update" ON public.flwdsk_enrollments;
DROP POLICY IF EXISTS "enrollments_auth_delete" ON public.flwdsk_enrollments;

DROP POLICY IF EXISTS "schedule_sessions_public_read" ON public.flwdsk_schedule_sessions;
DROP POLICY IF EXISTS "schedule_sessions_auth_write" ON public.flwdsk_schedule_sessions;
DROP POLICY IF EXISTS "schedule_sessions_auth_update" ON public.flwdsk_schedule_sessions;
DROP POLICY IF EXISTS "schedule_sessions_auth_delete" ON public.flwdsk_schedule_sessions;

DROP POLICY IF EXISTS "assessments_public_read" ON public.flwdsk_assessments;
DROP POLICY IF EXISTS "assessments_auth_write" ON public.flwdsk_assessments;
DROP POLICY IF EXISTS "assessments_auth_update" ON public.flwdsk_assessments;
DROP POLICY IF EXISTS "assessments_auth_delete" ON public.flwdsk_assessments;

DROP POLICY IF EXISTS "retest_verifications_public_read" ON public.flwdsk_retest_payment_verifications;
DROP POLICY IF EXISTS "retest_verifications_auth_write" ON public.flwdsk_retest_payment_verifications;
DROP POLICY IF EXISTS "retest_verifications_auth_update" ON public.flwdsk_retest_payment_verifications;
DROP POLICY IF EXISTS "retest_verifications_auth_delete" ON public.flwdsk_retest_payment_verifications;

-- 3. Enable RLS on all training tables

ALTER TABLE public.flwdsk_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_student_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_schedule_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_retest_payment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_batch_eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_calendar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flwdsk_email_logs ENABLE ROW LEVEL SECURITY;

-- 4. Apply Secure RLS Policies

-- ── COURSES ──────────────────────────────────────────────────────────────────
CREATE POLICY courses_select ON public.flwdsk_courses
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY courses_write ON public.flwdsk_courses
  FOR ALL USING (public.is_training_admin()) WITH CHECK (public.is_training_admin());

-- ── COLLEGES ─────────────────────────────────────────────────────────────────
CREATE POLICY colleges_select ON public.flwdsk_colleges
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY colleges_write ON public.flwdsk_colleges
  FOR ALL USING (public.is_training_admin()) WITH CHECK (public.is_training_admin());

-- ── BATCHES ──────────────────────────────────────────────────────────────────
CREATE POLICY batches_select ON public.flwdsk_batches
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY batches_write ON public.flwdsk_batches
  FOR ALL USING (public.is_training_admin() OR trainer_id = auth.uid())
  WITH CHECK (public.is_training_admin() OR trainer_id = auth.uid());

-- ── STUDENT RECORDS ──────────────────────────────────────────────────────────
CREATE POLICY student_records_select ON public.flwdsk_student_records
  FOR SELECT USING (public.is_training_admin() OR public.is_student_trainer(id));
CREATE POLICY student_records_write ON public.flwdsk_student_records
  FOR ALL USING (public.is_training_admin() OR public.is_student_trainer(id))
  WITH CHECK (public.is_training_admin() OR public.is_student_trainer(id));

-- ── ENROLLMENTS ──────────────────────────────────────────────────────────────
CREATE POLICY enrollments_select ON public.flwdsk_enrollments
  FOR SELECT USING (public.is_training_admin() OR public.is_batch_trainer(batch_id));
CREATE POLICY enrollments_write ON public.flwdsk_enrollments
  FOR ALL USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))
  WITH CHECK (public.is_training_admin() OR public.is_batch_trainer(batch_id));

-- ── SCHEDULE SESSIONS ────────────────────────────────────────────────────────
CREATE POLICY schedule_sessions_select ON public.flwdsk_schedule_sessions
  FOR SELECT USING (public.is_training_admin() OR public.is_batch_trainer(batch_id));
CREATE POLICY schedule_sessions_write ON public.flwdsk_schedule_sessions
  FOR ALL USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))
  WITH CHECK (public.is_training_admin() OR public.is_batch_trainer(batch_id));

-- ── ASSESSMENTS ──────────────────────────────────────────────────────────────
CREATE POLICY assessments_select ON public.flwdsk_assessments
  FOR SELECT USING (public.is_training_admin() OR public.is_enrollment_trainer(enrollment_id));
CREATE POLICY assessments_write ON public.flwdsk_assessments
  FOR ALL USING (public.is_training_admin() OR public.is_enrollment_trainer(enrollment_id))
  WITH CHECK (public.is_training_admin() OR public.is_enrollment_trainer(enrollment_id));

-- ── EXAM ATTEMPTS ────────────────────────────────────────────────────────────
CREATE POLICY exam_attempts_select ON public.flwdsk_exam_attempts
  FOR SELECT USING (public.is_training_admin() OR public.is_batch_trainer(batch_id));
CREATE POLICY exam_attempts_write ON public.flwdsk_exam_attempts
  FOR ALL USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))
  WITH CHECK (public.is_training_admin() OR public.is_batch_trainer(batch_id));

-- ── VOUCHERS ─────────────────────────────────────────────────────────────────
CREATE POLICY vouchers_select ON public.flwdsk_vouchers
  FOR SELECT USING (public.is_training_admin() OR public.is_batch_trainer(batch_id));
CREATE POLICY vouchers_write ON public.flwdsk_vouchers
  FOR ALL USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))
  WITH CHECK (public.is_training_admin() OR public.is_batch_trainer(batch_id));

-- ── RETEST PAYMENT VERIFICATIONS ──────────────────────────────────────────────
CREATE POLICY retest_payments_select ON public.flwdsk_retest_payment_verifications
  FOR SELECT USING (public.is_training_admin() OR public.is_batch_trainer(batch_id));
CREATE POLICY retest_payments_write ON public.flwdsk_retest_payment_verifications
  FOR ALL USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))
  WITH CHECK (public.is_training_admin() OR public.is_batch_trainer(batch_id));

-- ── BATCH ELIGIBILITY RULES ──────────────────────────────────────────────────
CREATE POLICY eligibility_rules_select ON public.flwdsk_batch_eligibility_rules
  FOR SELECT USING (public.is_training_admin() OR public.is_batch_trainer(batch_id));
CREATE POLICY eligibility_rules_write ON public.flwdsk_batch_eligibility_rules
  FOR ALL USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))
  WITH CHECK (public.is_training_admin() OR public.is_batch_trainer(batch_id));

-- ── CALENDAR SESSIONS ────────────────────────────────────────────────────────
CREATE POLICY calendar_sessions_select ON public.flwdsk_calendar_sessions
  FOR SELECT USING (public.is_training_admin() OR public.is_batch_trainer(batch_id));
CREATE POLICY calendar_sessions_write ON public.flwdsk_calendar_sessions
  FOR ALL USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))
  WITH CHECK (public.is_training_admin() OR public.is_batch_trainer(batch_id));

-- ── CERTIFICATES ─────────────────────────────────────────────────────────────
CREATE POLICY certificates_select ON public.flwdsk_certificates
  FOR SELECT USING (public.is_training_admin() OR public.is_enrollment_trainer(enrollment_id));
CREATE POLICY certificates_write ON public.flwdsk_certificates
  FOR ALL USING (public.is_training_admin() OR public.is_enrollment_trainer(enrollment_id))
  WITH CHECK (public.is_training_admin() OR public.is_enrollment_trainer(enrollment_id));

-- ── AUDIT LOGS (Append-only) ──────────────────────────────────────────────────
CREATE POLICY audit_logs_select ON public.flwdsk_audit_logs
  FOR SELECT USING (public.is_training_admin());
CREATE POLICY audit_logs_insert ON public.flwdsk_audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY audit_logs_modify ON public.flwdsk_audit_logs
  FOR ALL USING (false) WITH CHECK (false);

-- ── EMAIL LOGS (Restricted) ──────────────────────────────────────────────────
CREATE POLICY email_logs_select ON public.flwdsk_email_logs
  FOR SELECT USING (
    public.is_training_admin()
    OR (student_id IS NOT NULL AND public.is_student_trainer(student_id))
    OR (batch_id IS NOT NULL AND public.is_batch_trainer(batch_id))
  );
CREATE POLICY email_logs_insert ON public.flwdsk_email_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY email_logs_modify ON public.flwdsk_email_logs
  FOR ALL USING (public.is_training_admin()) WITH CHECK (public.is_training_admin());

COMMIT;
