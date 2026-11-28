-- =============================================================================
-- Script 5: Post-Migration Verification (READ-ONLY)
-- Target: Remote Supabase (KVJ-Alpha) via Supabase SQL Editor
-- Purpose: Verify row counts, UUID preservation, College & Course relationships,
--          checklist migration, integration view, and zero orphaned records.
-- =============================================================================

-- 5.1 Post-migration row counts across training and preserved business tables
SELECT 'flwdsk_colleges' AS table_name, COUNT(*) AS total_rows, COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_rows FROM public.flwdsk_colleges
UNION ALL
SELECT 'flwdsk_courses', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_courses
UNION ALL
SELECT 'flwdsk_batches', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_batches
UNION ALL
SELECT 'flwdsk_batch_checklist_items', COUNT(*), COUNT(*) FROM public.flwdsk_batch_checklist_items
UNION ALL
SELECT 'flwdsk_batch_migration_audit', COUNT(*), COUNT(*) FILTER (WHERE resolved = FALSE) FROM public.flwdsk_batch_migration_audit
UNION ALL
SELECT 'flwdsk_student_records', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_student_records
UNION ALL
SELECT 'flwdsk_enrollments', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_enrollments
UNION ALL
SELECT 'flwdsk_schedule_sessions', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_schedule_sessions
UNION ALL
SELECT 'flwdsk_assessments', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_assessments
UNION ALL
SELECT 'flwdsk_final_exam_results', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_final_exam_results
UNION ALL
SELECT 'flwdsk_vouchers', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_vouchers
UNION ALL
SELECT 'flwdsk_employees', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_employees
UNION ALL
SELECT 'flwdsk_attendance_records', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_attendance_records
UNION ALL
SELECT 'flwdsk_work_sessions', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_work_sessions
UNION ALL
SELECT 'flwdsk_travel_requests', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_travel_requests
UNION ALL
SELECT 'flwdsk_expense_claims', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_expense_claims
UNION ALL
SELECT 'flwdsk_email_logs', COUNT(*), COUNT(*) FROM public.flwdsk_email_logs
UNION ALL
SELECT 'flwdsk_audit_logs', COUNT(*), COUNT(*) FROM public.flwdsk_audit_logs
ORDER BY table_name;

-- 5.2 Verify UUID preservation & College/Course relationship coverage
SELECT
  COUNT(*) AS total_batches,
  COUNT(id) AS batches_with_uuid,
  COUNT(college_id) AS batches_with_college_id,
  COUNT(*) FILTER (WHERE college_id IS NULL AND college IS NOT NULL AND TRIM(college) <> '' AND TRIM(college) <> '—') AS batches_pending_college_mapping,
  COUNT(course_id) AS batches_with_course_id
FROM public.flwdsk_batches;

-- 5.3 Verify zero orphaned foreign keys on batches, enrollments, schedules, checklists
SELECT
  (SELECT COUNT(*) FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_colleges c ON c.id = b.college_id WHERE b.college_id IS NOT NULL AND c.id IS NULL) AS orphaned_college_fks,
  (SELECT COUNT(*) FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_courses  c ON c.id = b.course_id  WHERE b.course_id  IS NOT NULL AND c.id IS NULL) AS orphaned_course_fks,
  (SELECT COUNT(*) FROM public.flwdsk_batch_checklist_items ci LEFT JOIN public.flwdsk_batches b ON b.id = ci.batch_id WHERE b.id IS NULL) AS orphaned_checklist_fks,
  (SELECT COUNT(*) FROM public.flwdsk_enrollments e LEFT JOIN public.flwdsk_batches b ON b.id = e.batch_id WHERE b.id IS NULL) AS orphaned_enrollment_fks;

-- 5.4 Verify migrated checklist completion items vs legacy system setting
SELECT
  COUNT(*) AS total_checklist_rows,
  COUNT(*) FILTER (WHERE is_done = TRUE) AS completed_items,
  COUNT(DISTINCT batch_id) AS batches_with_checklist_items
FROM public.flwdsk_batch_checklist_items;

-- 5.5 Verify flwdsk_batches_integration_v1 view
SELECT
  COUNT(*) AS integration_view_rows,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_integration_rows,
  COUNT(college_id) AS rows_with_college_uuid,
  COUNT(course_id) AS rows_with_course_uuid
FROM public.flwdsk_batches_integration_v1;

-- 5.6 Review any unresolved migration audit items (unmatched/ambiguous colleges or duplicate codes)
SELECT id, batch_id, issue_type, raw_value, details, resolved, created_at
FROM public.flwdsk_batch_migration_audit
WHERE resolved = FALSE
ORDER BY created_at DESC;
