-- =============================================================================
-- Migration: Phase 6.11 Student & Enrollment Integrity Remediations
-- Migration ID: 20260808120000_student_enrollment_integrity.sql
-- =============================================================================

-- 1. Add deprecation comment to flwdsk_student_records.batch_id column
COMMENT ON COLUMN public.flwdsk_student_records.batch_id IS 'DEPRECATED: Stale legacy field. Storing batch membership dynamically in flwdsk_enrollments instead.';

-- 2. Add partial unique index on flwdsk_enrollments to prevent duplicate active student enrollments
CREATE UNIQUE INDEX IF NOT EXISTS uq_flwdsk_enrollments_student_batch
ON public.flwdsk_enrollments(student_id, batch_id)
WHERE deleted_at IS NULL;
