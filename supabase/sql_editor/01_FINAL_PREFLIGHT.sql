-- =============================================================================
-- Flowdesk Phase 1 — Complete Read-Only Preflight Inspection
-- Target: KVJ-Alpha (PostgreSQL 17.x) via Supabase SQL Editor
-- Modifies NOTHING. Safe to run even if required tables are missing (no static
-- table references to potentially missing tables; uses to_regclass + query_to_xml).
-- =============================================================================
WITH
req_tables(tbl) AS (
  VALUES
    ('flwdsk_colleges'), ('flwdsk_courses'), ('flwdsk_batches'),
    ('flwdsk_expense_claims'), ('flwdsk_attendance_records'), ('flwdsk_work_sessions'),
    ('flwdsk_break_records'), ('flwdsk_employees'), ('flwdsk_travel_requests'),
    ('flwdsk_system_settings'), ('flwdsk_email_logs'), ('flwdsk_audit_logs')
),
req_cols(tbl, col, expected_type) AS (
  VALUES
    ('flwdsk_colleges','id','uuid'), ('flwdsk_colleges','code','text'), ('flwdsk_colleges','name','text'),
    ('flwdsk_colleges','location','text'), ('flwdsk_colleges','created_at','timestamp with time zone'),
    ('flwdsk_colleges','updated_at','timestamp with time zone'), ('flwdsk_colleges','deleted_at','timestamp with time zone'),
    ('flwdsk_courses','id','uuid'), ('flwdsk_courses','code','text'), ('flwdsk_courses','title','text'),
    ('flwdsk_courses','checklist','jsonb'), ('flwdsk_courses','created_at','timestamp with time zone'),
    ('flwdsk_courses','updated_at','timestamp with time zone'), ('flwdsk_courses','deleted_at','timestamp with time zone'),
    ('flwdsk_batches','id','uuid'), ('flwdsk_batches','code','text'), ('flwdsk_batches','batch_no','text'),
    ('flwdsk_batches','academic_year','text'), ('flwdsk_batches','training_name','text'),
    ('flwdsk_batches','college','text'), ('flwdsk_batches','course_id','uuid'), ('flwdsk_batches','trainer_id','uuid'),
    ('flwdsk_batches','coordinator','text'), ('flwdsk_batches','coordinator_email','text'),
    ('flwdsk_batches','coordinator2','text'), ('flwdsk_batches','coordinator_email2','text'),
    ('flwdsk_batches','start_date','date'), ('flwdsk_batches','end_date','date'),
    ('flwdsk_batches','capacity','integer'), ('flwdsk_batches','phase','text'),
    ('flwdsk_batches','completed_tasks','integer'), ('flwdsk_batches','total_tasks','integer'),
    ('flwdsk_batches','created_at','timestamp with time zone'), ('flwdsk_batches','updated_at','timestamp with time zone'),
    ('flwdsk_batches','deleted_at','timestamp with time zone'),
    ('flwdsk_expense_claims','id','uuid'), ('flwdsk_expense_claims','employee_id','uuid'),
    ('flwdsk_expense_claims','category','text'), ('flwdsk_expense_claims','amount','numeric'),
    ('flwdsk_expense_claims','status','text'), ('flwdsk_expense_claims','notes','text'),
    ('flwdsk_expense_claims','receipt_url','text'), ('flwdsk_expense_claims','approved_by','uuid'),
    ('flwdsk_expense_claims','approved_at','timestamp with time zone'),
    ('flwdsk_expense_claims','created_at','timestamp with time zone'), ('flwdsk_expense_claims','updated_at','timestamp with time zone'),
    ('flwdsk_expense_claims','deleted_at','timestamp with time zone'),
    ('flwdsk_attendance_records','id','uuid'), ('flwdsk_attendance_records','employee_id','uuid'),
    ('flwdsk_attendance_records','work_date','date'), ('flwdsk_attendance_records','status','text'),
    ('flwdsk_attendance_records','first_clock_in','timestamp with time zone'), ('flwdsk_attendance_records','last_clock_out','timestamp with time zone'),
    ('flwdsk_attendance_records','total_working_minutes','integer'), ('flwdsk_attendance_records','total_break_minutes','integer'),
    ('flwdsk_attendance_records','deleted_at','timestamp with time zone'),
    ('flwdsk_work_sessions','id','uuid'), ('flwdsk_work_sessions','attendance_record_id','uuid'),
    ('flwdsk_work_sessions','work_type','text'), ('flwdsk_work_sessions','notes','text'),
    ('flwdsk_work_sessions','clock_in','timestamp with time zone'), ('flwdsk_work_sessions','clock_out','timestamp with time zone'),
    ('flwdsk_work_sessions','created_at','timestamp with time zone'), ('flwdsk_work_sessions','updated_at','timestamp with time zone'),
    ('flwdsk_work_sessions','deleted_at','timestamp with time zone'),
    ('flwdsk_break_records','id','uuid'), ('flwdsk_break_records','deleted_at','timestamp with time zone'),
    ('flwdsk_employees','id','uuid'), ('flwdsk_employees','deleted_at','timestamp with time zone'),
    ('flwdsk_travel_requests','id','uuid'), ('flwdsk_travel_requests','deleted_at','timestamp with time zone'),
    ('flwdsk_system_settings','key','text'), ('flwdsk_system_settings','value','jsonb'),
    ('flwdsk_email_logs','id','uuid'), ('flwdsk_audit_logs','id','uuid')
),
tbl_check AS (
  SELECT '01_TABLE_EXISTS' AS check_group, rt.tbl AS target,
    CASE WHEN to_regclass('public.' || rt.tbl) IS NOT NULL THEN 'PASS' ELSE 'BLOCKER' END AS severity,
    CASE WHEN to_regclass('public.' || rt.tbl) IS NOT NULL THEN 'Exists' ELSE 'Missing required table' END AS details
  FROM req_tables rt
),
col_check AS (
  SELECT '02_COLUMN_AND_TYPE' AS check_group, rc.tbl || '.' || rc.col AS target,
    CASE WHEN c.column_name IS NULL THEN 'BLOCKER' WHEN c.data_type <> rc.expected_type THEN 'BLOCKER' ELSE 'PASS' END AS severity,
    COALESCE('actual=' || c.data_type || ' (expected=' || rc.expected_type || ')', 'Missing required column') AS details
  FROM req_cols rc
  LEFT JOIN information_schema.columns c ON c.table_schema = 'public' AND c.table_name = rc.tbl AND c.column_name = rc.col
),
opt_col_check AS (
  SELECT '03_ADDITIVE_COL_CHECK' AS check_group, v.tbl || '.' || v.col AS target,
    CASE WHEN c.column_name IS NOT NULL AND c.data_type <> v.exp_type THEN 'BLOCKER' ELSE 'PASS' END AS severity,
    CASE WHEN c.column_name IS NOT NULL THEN 'Exists (' || c.data_type || ')' ELSE 'Not yet present (will be added as ' || v.exp_type || ')' END AS details
  FROM (VALUES
    ('flwdsk_batches','program','text'),
    ('flwdsk_batches','college_id','uuid'),
    ('flwdsk_expense_claims','batch_id','uuid'),
    ('flwdsk_work_sessions','batch_id','uuid')
  ) AS v(tbl, col, exp_type)
  LEFT JOIN information_schema.columns c ON c.table_schema = 'public' AND c.table_name = v.tbl AND c.column_name = v.col
),
audit_tbl_check AS (
  SELECT '04_AUDIT_TABLE_COMPAT' AS check_group,
    'flwdsk_batch_migration_audit.' || v.col AS target,
    CASE
      WHEN to_regclass('public.flwdsk_batch_migration_audit') IS NULL THEN 'INFO'
      WHEN c.column_name IS NULL AND v.col IN ('source_table','source_record_id') THEN 'INFO'
      WHEN c.column_name IS NULL THEN 'BLOCKER'
      WHEN c.data_type <> v.exp_type THEN 'BLOCKER'
      ELSE 'PASS'
    END AS severity,
    CASE
      WHEN to_regclass('public.flwdsk_batch_migration_audit') IS NULL THEN 'Table not yet created'
      WHEN c.column_name IS NULL AND v.col IN ('source_table','source_record_id') THEN 'Missing (will be added safely)'
      WHEN c.column_name IS NULL THEN 'Incompatible pre-existing audit table: missing ' || v.col
      ELSE 'type=' || c.data_type || ', nullable=' || c.is_nullable
    END AS details
  FROM (VALUES
    ('id','uuid'), ('source_table','text'), ('source_record_id','text'), ('batch_id','uuid'),
    ('issue_type','text'), ('raw_value','text'), ('details','jsonb'), ('resolved','boolean'), ('created_at','timestamp with time zone')
  ) AS v(col, exp_type)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'flwdsk_batch_migration_audit' AND c.column_name = v.col
),
pk_check AS (
  SELECT '05_PRIMARY_KEYS' AS check_group, rt.tbl AS target,
    CASE WHEN con.conname IS NOT NULL THEN 'PASS' ELSE 'BLOCKER' END AS severity,
    COALESCE('PK=' || con.conname, 'Missing primary key (or table missing)') AS details
  FROM req_tables rt
  LEFT JOIN pg_class cls ON cls.relname = rt.tbl AND cls.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_constraint con ON con.conrelid = cls.oid AND con.contype = 'p'
),
fk_check AS (
  SELECT '06_EXISTING_FKS' AS check_group,
    src_ns.nspname || '.' || src_cls.relname || '.' ||
      array_to_string(ARRAY(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = src_cls.oid AND a.attnum = ANY(con.conkey) ORDER BY a.attnum), ',') ||
    ' -> ' || ref_ns.nspname || '.' || ref_cls.relname || '.' ||
      array_to_string(ARRAY(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = ref_cls.oid AND a.attnum = ANY(con.confkey) ORDER BY a.attnum), ',') AS target,
    CASE WHEN con.convalidated THEN 'PASS' ELSE 'WARNING' END AS severity,
    'constraint=' || con.conname || ', validated=' || con.convalidated::text ||
      ', on_update=' || CASE con.confupdtype WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL' WHEN 'c' THEN 'CASCADE' WHEN 'a' THEN 'NO ACTION' ELSE con.confupdtype::text END ||
      ', on_delete=' || CASE con.confdeltype WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL' WHEN 'c' THEN 'CASCADE' WHEN 'a' THEN 'NO ACTION' ELSE con.confdeltype::text END AS details
  FROM pg_constraint con
  JOIN pg_class src_cls ON src_cls.oid = con.conrelid
  JOIN pg_namespace src_ns ON src_ns.oid = src_cls.relnamespace
  JOIN pg_class ref_cls ON ref_cls.oid = con.confrelid
  JOIN pg_namespace ref_ns ON ref_ns.oid = ref_cls.relnamespace
  WHERE con.contype = 'f' AND src_ns.nspname = 'public'
    AND src_cls.relname IN ('flwdsk_batches','flwdsk_expense_claims','flwdsk_work_sessions','flwdsk_attendance_records')
),
-- Guarded dynamic checks using to_regclass + query_to_xml so missing tables never crash preflight
dyn_checks AS (
  SELECT '07_DUP_COLLEGE_CODES' AS check_group, 'flwdsk_colleges.code' AS target,
    CASE
      WHEN to_regclass('public.flwdsk_colleges') IS NULL THEN 'BLOCKER'
      WHEN ((xpath('/row/cnt/text()', query_to_xml(
        'SELECT COUNT(*) AS cnt FROM (SELECT 1 FROM public.flwdsk_colleges WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> '''' GROUP BY UPPER(TRIM(code)) HAVING COUNT(*) > 1) d',
        false, true, '')))[1]::text)::int > 0 THEN 'WARNING'
      ELSE 'PASS'
    END AS severity,
    CASE
      WHEN to_regclass('public.flwdsk_colleges') IS NULL THEN 'Table missing'
      ELSE 'duplicate_groups=' || (xpath('/row/cnt/text()', query_to_xml(
        'SELECT COUNT(*) AS cnt FROM (SELECT 1 FROM public.flwdsk_colleges WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> '''' GROUP BY UPPER(TRIM(code)) HAVING COUNT(*) > 1) d',
        false, true, '')))[1]::text
    END AS details
  UNION ALL
  SELECT '08_DUP_BATCH_CODES', 'flwdsk_batches.code',
    CASE
      WHEN to_regclass('public.flwdsk_batches') IS NULL THEN 'BLOCKER'
      WHEN ((xpath('/row/cnt/text()', query_to_xml(
        'SELECT COUNT(*) AS cnt FROM (SELECT 1 FROM public.flwdsk_batches WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> '''' GROUP BY UPPER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(code), ''\s*-\s*'', '' - '', ''g''), ''\s+'', '' '', ''g'')) HAVING COUNT(*) > 1) d',
        false, true, '')))[1]::text)::int > 0 THEN 'WARNING'
      ELSE 'PASS'
    END,
    CASE
      WHEN to_regclass('public.flwdsk_batches') IS NULL THEN 'Table missing'
      ELSE 'duplicate_groups=' || (xpath('/row/cnt/text()', query_to_xml(
        'SELECT COUNT(*) AS cnt FROM (SELECT 1 FROM public.flwdsk_batches WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> '''' GROUP BY UPPER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(code), ''\s*-\s*'', '' - '', ''g''), ''\s+'', '' '', ''g'')) HAVING COUNT(*) > 1) d',
        false, true, '')))[1]::text
    END
  UNION ALL
  SELECT '09_CHECKLIST_JSONB', 'flwdsk_system_settings(batch_checklist_state)',
    CASE
      WHEN to_regclass('public.flwdsk_system_settings') IS NULL THEN 'BLOCKER'
      WHEN (xpath('/row/jt/text()', query_to_xml('SELECT COALESCE(jsonb_typeof(value::jsonb), ''NULL'') AS jt FROM public.flwdsk_system_settings WHERE key = ''batch_checklist_state'' LIMIT 1', false, true, '')))[1]::text IS NULL THEN 'INFO'
      WHEN (xpath('/row/jt/text()', query_to_xml('SELECT COALESCE(jsonb_typeof(value::jsonb), ''NULL'') AS jt FROM public.flwdsk_system_settings WHERE key = ''batch_checklist_state'' LIMIT 1', false, true, '')))[1]::text = 'object' THEN 'PASS'
      ELSE 'WARNING'
    END,
    CASE
      WHEN to_regclass('public.flwdsk_system_settings') IS NULL THEN 'Table missing'
      ELSE 'jsonb_typeof=' || COALESCE((xpath('/row/jt/text()', query_to_xml('SELECT COALESCE(jsonb_typeof(value::jsonb), ''NULL'') AS jt FROM public.flwdsk_system_settings WHERE key = ''batch_checklist_state'' LIMIT 1', false, true, '')))[1]::text, 'NO_ROW')
    END
),
-- Pre-existing orphan checks if additive FK columns already exist
orphan_precheck AS (
  SELECT '10_PRE_ORPHAN_CHECK' AS check_group, 'flwdsk_batches.college_id' AS target,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flwdsk_batches' AND column_name='college_id') THEN 'INFO'
      WHEN to_regclass('public.flwdsk_colleges') IS NULL THEN 'BLOCKER'
      WHEN ((xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_colleges c ON c.id = b.college_id WHERE b.college_id IS NOT NULL AND c.id IS NULL', false, true, '')))[1]::text)::int > 0 THEN 'BLOCKER'
      ELSE 'PASS'
    END AS severity,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flwdsk_batches' AND column_name='college_id') THEN 'Column not yet present'
      WHEN to_regclass('public.flwdsk_colleges') IS NULL THEN 'Target table missing'
      ELSE 'orphans=' || (xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_colleges c ON c.id = b.college_id WHERE b.college_id IS NOT NULL AND c.id IS NULL', false, true, '')))[1]::text
    END AS details
  UNION ALL
  SELECT '10_PRE_ORPHAN_CHECK', 'flwdsk_expense_claims.batch_id',
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flwdsk_expense_claims' AND column_name='batch_id') THEN 'INFO'
      WHEN to_regclass('public.flwdsk_batches') IS NULL THEN 'BLOCKER'
      WHEN ((xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_expense_claims e LEFT JOIN public.flwdsk_batches b ON b.id = e.batch_id WHERE e.batch_id IS NOT NULL AND b.id IS NULL', false, true, '')))[1]::text)::int > 0 THEN 'BLOCKER'
      ELSE 'PASS'
    END,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flwdsk_expense_claims' AND column_name='batch_id') THEN 'Column not yet present'
      WHEN to_regclass('public.flwdsk_batches') IS NULL THEN 'Target table missing'
      ELSE 'orphans=' || (xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_expense_claims e LEFT JOIN public.flwdsk_batches b ON b.id = e.batch_id WHERE e.batch_id IS NOT NULL AND b.id IS NULL', false, true, '')))[1]::text
    END
  UNION ALL
  SELECT '10_PRE_ORPHAN_CHECK', 'flwdsk_work_sessions.batch_id',
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flwdsk_work_sessions' AND column_name='batch_id') THEN 'INFO'
      WHEN to_regclass('public.flwdsk_batches') IS NULL THEN 'BLOCKER'
      WHEN ((xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_work_sessions w LEFT JOIN public.flwdsk_batches b ON b.id = w.batch_id WHERE w.batch_id IS NOT NULL AND b.id IS NULL', false, true, '')))[1]::text)::int > 0 THEN 'BLOCKER'
      ELSE 'PASS'
    END,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flwdsk_work_sessions' AND column_name='batch_id') THEN 'Column not yet present'
      WHEN to_regclass('public.flwdsk_batches') IS NULL THEN 'Target table missing'
      ELSE 'orphans=' || (xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM public.flwdsk_work_sessions w LEFT JOIN public.flwdsk_batches b ON b.id = w.batch_id WHERE w.batch_id IS NOT NULL AND b.id IS NULL', false, true, '')))[1]::text
    END
),
rls_pub_chk AS (
  SELECT '11_RLS_AND_POLICIES' AS check_group, cls.relname AS target,
    CASE WHEN cls.relrowsecurity AND EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = cls.relname) THEN 'INFO' ELSE 'WARNING' END AS severity,
    'rls=' || cls.relrowsecurity::text || ', policies=' ||
    COALESCE((SELECT string_agg(p.policyname || '(' || p.cmd || ')', ', ') FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = cls.relname), 'none') AS details
  FROM pg_class cls WHERE cls.relnamespace = 'public'::regnamespace
    AND cls.relname IN ('flwdsk_colleges','flwdsk_courses','flwdsk_batches','flwdsk_expense_claims','flwdsk_work_sessions','flwdsk_system_settings')
  UNION ALL
  SELECT '12_REALTIME_PUB', t.tbl,
    CASE WHEN pt.tablename IS NOT NULL THEN 'INFO' ELSE 'WARNING' END,
    CASE WHEN pt.tablename IS NOT NULL THEN 'Present in supabase_realtime' ELSE 'Absent from supabase_realtime (will be added by migration)' END
  FROM (VALUES ('flwdsk_batches'),('flwdsk_courses'),('flwdsk_colleges'),('flwdsk_batch_checklist_items')) AS t(tbl)
  LEFT JOIN pg_publication_tables pt ON pt.pubname = 'supabase_realtime' AND pt.schemaname = 'public' AND pt.tablename = t.tbl
)
SELECT * FROM (
  SELECT * FROM tbl_check
  UNION ALL SELECT * FROM col_check
  UNION ALL SELECT * FROM opt_col_check
  UNION ALL SELECT * FROM audit_tbl_check
  UNION ALL SELECT * FROM pk_check
  UNION ALL SELECT * FROM fk_check
  UNION ALL SELECT * FROM dyn_checks
  UNION ALL SELECT * FROM orphan_precheck
  UNION ALL SELECT * FROM rls_pub_chk
) all_checks
ORDER BY CASE severity WHEN 'BLOCKER' THEN 1 WHEN 'WARNING' THEN 2 WHEN 'INFO' THEN 3 ELSE 4 END, check_group, target;
