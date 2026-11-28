-- =============================================================================
-- Script 1: Pre-Migration Inspection (READ-ONLY)
-- Target: Remote Supabase (KVJ-Alpha) via Supabase SQL Editor
-- Purpose: Inspect table structures, baseline row counts, UUIDs, duplicate
--          batch codes, college mapping readiness, and FK dependencies.
-- =============================================================================

-- 1.1 Inspect columns of core tables
SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'flwdsk_colleges',
    'flwdsk_courses',
    'flwdsk_batches',
    'flwdsk_system_settings'
  )
ORDER BY table_name, ordinal_position;

-- 1.2 Inspect existing foreign keys referencing flwdsk_batches, flwdsk_colleges, flwdsk_courses
SELECT
  tc.table_name       AS referencing_table,
  kcu.column_name     AS referencing_column,
  ccu.table_name      AS referenced_table,
  ccu.column_name     AS referenced_column,
  rc.delete_rule,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (
    ccu.table_name IN ('flwdsk_batches', 'flwdsk_colleges', 'flwdsk_courses')
    OR tc.table_name IN ('flwdsk_batches', 'flwdsk_colleges', 'flwdsk_courses')
  )
ORDER BY tc.table_name, kcu.column_name;

-- 1.3 Inspect existing indexes on core tables
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('flwdsk_colleges', 'flwdsk_courses', 'flwdsk_batches', 'flwdsk_system_settings')
ORDER BY tablename, indexname;

-- 1.4 Baseline row counts across training and preserved business tables
SELECT 'flwdsk_colleges' AS table_name, COUNT(*) AS total_rows, COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_rows FROM public.flwdsk_colleges
UNION ALL
SELECT 'flwdsk_courses', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_courses
UNION ALL
SELECT 'flwdsk_batches', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_batches
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

-- 1.5 Verify every existing College, Course, and Batch already has a non-null UUID primary key
SELECT 'flwdsk_colleges' AS table_name, COUNT(*) AS total, COUNT(id) AS with_uuid, COUNT(*) FILTER (WHERE id IS NULL) AS missing_uuid FROM public.flwdsk_colleges
UNION ALL
SELECT 'flwdsk_courses', COUNT(*), COUNT(id), COUNT(*) FILTER (WHERE id IS NULL) FROM public.flwdsk_courses
UNION ALL
SELECT 'flwdsk_batches', COUNT(*), COUNT(id), COUNT(*) FILTER (WHERE id IS NULL) FROM public.flwdsk_batches;

-- 1.6 Detect duplicate active Batch Codes (normalized by UPPER(TRIM(code)))
SELECT
  UPPER(TRIM(code)) AS normalized_code,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id ORDER BY created_at) AS batch_ids,
  ARRAY_AGG(code ORDER BY created_at) AS raw_codes
FROM public.flwdsk_batches
WHERE deleted_at IS NULL
  AND code IS NOT NULL
  AND TRIM(code) <> ''
GROUP BY UPPER(TRIM(code))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 1.7 Preview College Mapping Readiness (Unambiguous vs Unmatched vs Ambiguous)
WITH matches AS (
  SELECT
    b.id AS batch_id,
    b.code AS batch_code,
    b.college AS legacy_college_text,
    COUNT(c.id) AS match_count,
    ARRAY_AGG(c.id) FILTER (WHERE c.id IS NOT NULL) AS matched_college_ids,
    ARRAY_AGG(c.name) FILTER (WHERE c.id IS NOT NULL) AS matched_college_names
  FROM public.flwdsk_batches b
  LEFT JOIN public.flwdsk_colleges c
    ON c.deleted_at IS NULL
   AND (
     LOWER(TRIM(c.name)) = LOWER(TRIM(b.college))
     OR LOWER(TRIM(c.code)) = LOWER(TRIM(b.college))
   )
  WHERE b.college IS NOT NULL
    AND TRIM(b.college) <> ''
    AND TRIM(b.college) <> '—'
  GROUP BY b.id, b.code, b.college
)
SELECT
  CASE
    WHEN match_count = 1 THEN 'UNAMBIGUOUS'
    WHEN match_count = 0 THEN 'UNMATCHED'
    ELSE 'AMBIGUOUS'
  END AS mapping_status,
  COUNT(*) AS batch_count
FROM matches
GROUP BY 1
ORDER BY 1;

-- 1.8 List any Unmatched or Ambiguous batch college records for review
SELECT
  b.id AS batch_id,
  b.code AS batch_code,
  b.college AS legacy_college_text,
  COUNT(c.id) AS match_count,
  ARRAY_AGG(c.name) FILTER (WHERE c.id IS NOT NULL) AS candidate_colleges
FROM public.flwdsk_batches b
LEFT JOIN public.flwdsk_colleges c
  ON c.deleted_at IS NULL
 AND (
   LOWER(TRIM(c.name)) = LOWER(TRIM(b.college))
   OR LOWER(TRIM(c.code)) = LOWER(TRIM(b.college))
 )
WHERE b.college IS NOT NULL
  AND TRIM(b.college) <> ''
  AND TRIM(b.college) <> '—'
GROUP BY b.id, b.code, b.college
HAVING COUNT(c.id) <> 1
ORDER BY b.created_at DESC;

-- 1.9 Inspect legacy batch_checklist_state in flwdsk_system_settings
SELECT
  key,
  jsonb_typeof(value::jsonb) AS raw_jsonb_type,
  updated_at
FROM public.flwdsk_system_settings
WHERE key = 'batch_checklist_state';
