-- =============================================================================
-- Flowdesk: Pre-Flight & Post-Migration Data Integrity Verification Script
-- Read-only SELECT queries — safe to run before and after applying
-- supabase/migrations/20261128000000_finalize_courses_colleges_batches_sync.sql
-- =============================================================================

-- 1. Row counts for all affected and protected tables
SELECT 'flwdsk_colleges'              AS table_name, COUNT(*) AS total_rows, COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_rows FROM public.flwdsk_colleges
UNION ALL
SELECT 'flwdsk_courses',               COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_courses
UNION ALL
SELECT 'flwdsk_batches',               COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_batches
UNION ALL
SELECT 'flwdsk_attendance_records',    COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_attendance_records
UNION ALL
SELECT 'flwdsk_expense_claims',        COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_expense_claims
UNION ALL
SELECT 'flwdsk_enrollments',           COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_enrollments
UNION ALL
SELECT 'flwdsk_schedule_sessions',     COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_schedule_sessions;

-- 2. Check batches missing college_id or with invalid/unmatched college text
SELECT
  id AS batch_id,
  code,
  college,
  college_id,
  course_id,
  deleted_at
FROM public.flwdsk_batches
WHERE college_id IS NULL
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- 3. Check for duplicate active batch codes (case/whitespace normalized)
SELECT
  UPPER(TRIM(code)) AS normalized_code,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id) AS batch_uuids
FROM public.flwdsk_batches
WHERE deleted_at IS NULL
  AND code IS NOT NULL
  AND TRIM(code) <> ''
GROUP BY UPPER(TRIM(code))
HAVING COUNT(*) > 1;

-- 4. Check for orphaned course_id or college_id foreign keys
SELECT b.id AS batch_id, b.code, b.course_id
FROM public.flwdsk_batches b
LEFT JOIN public.flwdsk_courses c ON c.id = b.course_id
WHERE b.course_id IS NOT NULL AND c.id IS NULL;

SELECT b.id AS batch_id, b.code, b.college_id
FROM public.flwdsk_batches b
LEFT JOIN public.flwdsk_colleges col ON col.id = b.college_id
WHERE b.college_id IS NOT NULL AND col.id IS NULL;

-- 5. Review migration audit log (post-migration)
SELECT id, batch_id, issue_type, raw_value, details, resolved, created_at
FROM public.flwdsk_batch_migration_audit
WHERE resolved = FALSE
ORDER BY created_at DESC;
