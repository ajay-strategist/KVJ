-- =============================================================================
-- Flowdesk Phase 1 — Post-Migration Verification SQL (READ-ONLY)
-- =============================================================================

-- 1. Audit Summary (Review all unresolved issues)
SELECT issue_type, COUNT(*) AS unresolved_count
FROM public.flwdsk_batch_migration_audit
WHERE resolved = FALSE
GROUP BY issue_type
ORDER BY issue_type;

-- 2. Scope, Preservation & Relationship Integrity
SELECT
  (SELECT COUNT(*) FROM public.flwdsk_batches) AS total_batches,
  (SELECT COUNT(*) FROM public.flwdsk_batches WHERE college_id IS NOT NULL) AS batches_with_college_id,
  (SELECT COUNT(*) FROM public.flwdsk_expense_claims WHERE category = 'Office Expense' AND batch_id IS NOT NULL) AS office_expenses_touched_must_be_0,
  (SELECT COUNT(*) FROM public.flwdsk_expense_claims WHERE category ILIKE '%Training%' AND batch_id IS NOT NULL) AS training_expenses_linked,
  (SELECT COUNT(*) FROM public.flwdsk_work_sessions WHERE work_type IN ('Office', 'Work From Home') AND batch_id IS NOT NULL) AS office_remote_sessions_touched_must_be_0,
  (SELECT COUNT(*) FROM public.flwdsk_work_sessions WHERE work_type ILIKE 'Training%' AND batch_id IS NOT NULL) AS training_sessions_linked,
  (SELECT COUNT(*) FROM public.flwdsk_batch_checklist_items) AS checklist_items_total,
  (SELECT COUNT(*) FROM public.flwdsk_batch_checklist_items WHERE is_done = TRUE) AS checklist_items_done,
  (SELECT COUNT(*) FROM public.flwdsk_batches_integration_v1) AS integration_view_rows;

-- 3. Verify Indexes & Realtime Publication
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'uq_batch_migration_audit_unresolved', 'idx_flwdsk_colleges_code_unique', 'idx_flwdsk_batches_code_unique',
    'idx_batch_checklist_batch_id', 'idx_batch_checklist_updated_at', 'idx_flwdsk_batches_college_id',
    'idx_flwdsk_batches_course_id', 'idx_flwdsk_batches_updated_at', 'idx_flwdsk_batches_deleted_at',
    'idx_flwdsk_courses_updated_at', 'idx_flwdsk_colleges_updated_at',
    'idx_flwdsk_expense_claims_batch_id', 'idx_flwdsk_work_sessions_batch_id'
  )
ORDER BY tablename, indexname;

SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;

-- 4. Verify Functions & Foreign Keys Created/Verified
SELECT proname AS function_name, prosecdef AS is_security_definer
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('normalize_batch_code', 'generate_standard_batch_code', 'toggle_batch_checklist_item')
ORDER BY proname;

SELECT con.conname AS constraint_name, src.relname AS source_table, ref.relname AS referenced_table, con.confdeltype AS on_delete_code, con.convalidated AS validated
FROM pg_constraint con
JOIN pg_class src ON src.oid = con.conrelid
JOIN pg_class ref ON ref.oid = con.confrelid
WHERE con.contype = 'f' AND src.relnamespace = 'public'::regnamespace
  AND con.conname IN ('fk_flwdsk_batches_college_id', 'fk_flwdsk_expense_claims_batch_id', 'fk_flwdsk_work_sessions_batch_id', 'fk_flwdsk_batch_checklist_batch_id')
ORDER BY con.conname;
