-- =============================================================================
-- Flowdesk Phase 1 — Post-Migration Verification SQL (READ-ONLY)
-- Safe even if target objects are missing (uses to_regclass + query_to_xml).
-- Verifies FKs, exact function signatures + prosecdef, view security_invoker,
-- scope isolation, Realtime publication, and audit summary.
-- =============================================================================

WITH
fk_expected(src_tbl, src_col, ref_tbl, exp_deltype) AS (
  VALUES
    ('flwdsk_batches',               'college_id', 'flwdsk_colleges', 'r'),
    ('flwdsk_expense_claims',        'batch_id',   'flwdsk_batches',  'n'),
    ('flwdsk_work_sessions',         'batch_id',   'flwdsk_batches',  'n'),
    ('flwdsk_batch_checklist_items', 'batch_id',   'flwdsk_batches',  'r')
),
fk_verify AS (
  SELECT
    '1_FOREIGN_KEYS' AS check_group,
    fe.src_tbl || '.' || fe.src_col || ' -> ' || fe.ref_tbl || '.id' AS target,
    CASE
      WHEN con.conname IS NOT NULL AND con.confdeltype = fe.exp_deltype AND con.convalidated THEN 'PASS'
      ELSE 'BLOCKER'
    END AS status,
    COALESCE(
      'constraint=' || con.conname || ', on_delete=' || con.confdeltype::text || ', validated=' || con.convalidated::text,
      'Missing or mismatched FK constraint'
    ) AS details
  FROM fk_expected fe
  LEFT JOIN pg_class src_cls ON src_cls.relname = fe.src_tbl AND src_cls.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_attribute src_att ON src_att.attrelid = src_cls.oid AND src_att.attname = fe.src_col
  LEFT JOIN pg_class ref_cls ON ref_cls.relname = fe.ref_tbl AND ref_cls.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_attribute ref_att ON ref_att.attrelid = ref_cls.oid AND ref_att.attname = 'id'
  LEFT JOIN pg_constraint con
    ON con.contype = 'f'
   AND con.conrelid = src_cls.oid
   AND con.confrelid = ref_cls.oid
   AND array_length(con.conkey, 1) = 1 AND con.conkey[1] = src_att.attnum
   AND array_length(con.confkey, 1) = 1 AND con.confkey[1] = ref_att.attnum
),
fn_expected(fn_name, exp_args, exp_ret) AS (
  VALUES
    ('normalize_batch_code', 'p_code text', 'text'),
    ('generate_standard_batch_code', 'p_college_code text, p_program text, p_academic_year text, p_batch_no text, p_course_code text', 'text'),
    ('toggle_batch_checklist_item', 'p_batch_id uuid, p_task_label text, p_is_done boolean, p_actor_id uuid, p_actor_name text, p_source_app text, p_total_tasks integer', 'flwdsk_batch_checklist_items')
),
fn_verify AS (
  SELECT
    '2_FUNCTIONS' AS check_group,
    fe.fn_name || '(' || fe.exp_args || ')' AS target,
    CASE
      WHEN COUNT(p.oid) = 1
       AND BOOL_AND(p.prosecdef = FALSE)
       AND BOOL_AND(pg_get_function_result(p.oid) = fe.exp_ret)
       AND (SELECT COUNT(*) FROM pg_proc all_p WHERE all_p.pronamespace = 'public'::regnamespace AND all_p.proname = fe.fn_name) = 1
      THEN 'PASS'
      ELSE 'BLOCKER'
    END AS status,
    'matches=' || COUNT(p.oid)::text ||
      ', total_overloads=' || (SELECT COUNT(*)::text FROM pg_proc all_p WHERE all_p.pronamespace = 'public'::regnamespace AND all_p.proname = fe.fn_name) ||
      ', prosecdef=' || COALESCE(string_agg(p.prosecdef::text, ','), 'NONE') ||
      ', returns=' || COALESCE(string_agg(pg_get_function_result(p.oid), ','), 'NONE') AS details
  FROM fn_expected fe
  LEFT JOIN pg_proc p
    ON p.pronamespace = 'public'::regnamespace
   AND p.proname = fe.fn_name
   AND pg_get_function_identity_arguments(p.oid) = fe.exp_args
  GROUP BY fe.fn_name, fe.exp_args, fe.exp_ret
),
scope_verify AS (
  SELECT
    '3_SCOPE_ISOLATION' AS check_group,
    'Office Expenses untouched' AS target,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flwdsk_expense_claims' AND column_name='batch_id') THEN 'BLOCKER'
      WHEN ((xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_expense_claims WHERE category = ''Office Expense'' AND batch_id IS NOT NULL', false, true, '')))[1]::text)::int = 0 THEN 'PASS'
      ELSE 'BLOCKER'
    END AS status,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flwdsk_expense_claims' AND column_name='batch_id') THEN 'Missing batch_id column'
      ELSE 'office_expenses_with_batch_id=' || (xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_expense_claims WHERE category = ''Office Expense'' AND batch_id IS NOT NULL', false, true, '')))[1]::text
    END AS details
  UNION ALL
  SELECT
    '3_SCOPE_ISOLATION',
    'Office/Remote work sessions untouched',
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flwdsk_work_sessions' AND column_name='batch_id') THEN 'BLOCKER'
      WHEN ((xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_work_sessions WHERE work_type IN (''Office'', ''Work From Home'') AND batch_id IS NOT NULL', false, true, '')))[1]::text)::int = 0 THEN 'PASS'
      ELSE 'BLOCKER'
    END,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flwdsk_work_sessions' AND column_name='batch_id') THEN 'Missing batch_id column'
      ELSE 'office_remote_sessions_with_batch_id=' || (xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_work_sessions WHERE work_type IN (''Office'', ''Work From Home'') AND batch_id IS NOT NULL', false, true, '')))[1]::text
    END
),
view_pub_verify AS (
  SELECT
    '4_VIEW_AND_REALTIME' AS check_group,
    'flwdsk_batches_integration_v1' AS target,
    CASE
      WHEN v.oid IS NOT NULL AND 'security_invoker=true' = ANY(COALESCE(v.reloptions, ARRAY[]::text[])) THEN 'PASS'
      ELSE 'BLOCKER'
    END AS status,
    CASE
      WHEN v.oid IS NULL THEN 'Missing view flwdsk_batches_integration_v1'
      ELSE 'security_invoker=' || ('security_invoker=true' = ANY(COALESCE(v.reloptions, ARRAY[]::text[])))::text ||
           ', rows=' || (xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_batches_integration_v1', false, true, '')))[1]::text
    END AS details
  FROM (SELECT 1) d
  LEFT JOIN pg_class v ON v.relnamespace = 'public'::regnamespace AND v.relname = 'flwdsk_batches_integration_v1' AND v.relkind = 'v'
  UNION ALL
  SELECT
    '4_VIEW_AND_REALTIME',
    'supabase_realtime.' || t.tbl,
    CASE WHEN pt.tablename IS NOT NULL THEN 'PASS' ELSE 'WARNING' END,
    CASE WHEN pt.tablename IS NOT NULL THEN 'Present in supabase_realtime' ELSE 'Not in supabase_realtime' END
  FROM (VALUES ('flwdsk_batches'),('flwdsk_courses'),('flwdsk_colleges'),('flwdsk_batch_checklist_items')) AS t(tbl)
  LEFT JOIN pg_publication_tables pt ON pt.pubname = 'supabase_realtime' AND pt.schemaname = 'public' AND pt.tablename = t.tbl
),
audit_summary AS (
  SELECT
    '5_AUDIT_ISSUES' AS check_group,
    'flwdsk_batch_migration_audit' AS target,
    CASE
      WHEN to_regclass('public.flwdsk_batch_migration_audit') IS NULL THEN 'BLOCKER'
      WHEN ((xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_batch_migration_audit WHERE resolved = FALSE', false, true, '')))[1]::text)::int > 0 THEN 'WARNING'
      ELSE 'PASS'
    END AS status,
    CASE
      WHEN to_regclass('public.flwdsk_batch_migration_audit') IS NULL THEN 'Missing audit table'
      ELSE 'unresolved_count=' || (xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_batch_migration_audit WHERE resolved = FALSE', false, true, '')))[1]::text
    END AS details
)
SELECT * FROM (
  SELECT * FROM fk_verify
  UNION ALL SELECT * FROM fn_verify
  UNION ALL SELECT * FROM scope_verify
  UNION ALL SELECT * FROM view_pub_verify
  UNION ALL SELECT * FROM audit_summary
) all_checks
ORDER BY CASE status WHEN 'BLOCKER' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, check_group, target;
