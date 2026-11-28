-- =============================================================================
-- Flowdesk Phase 1 — Final Consolidated Additive SQL Migration
-- Project: KVJ-Alpha (yzlyeuikvbwhgjrjntvi) | PostgreSQL 17.x
-- Scope: Expenses, Employee Attendance, Batch Management, Courses & Colleges
-- Exclusions: Student Attendance is OUT OF SCOPE and untouched.
-- Security: ZERO RLS, policy, GRANT, REVOKE, or SECURITY DEFINER changes.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Ephemeral Pre-Migration Snapshot & Report Tables (Auto-dropped on COMMIT)
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _pre_counts (
  table_name TEXT PRIMARY KEY, total_rows BIGINT NOT NULL, active_rows BIGINT NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_colleges (
  id UUID PRIMARY KEY, code TEXT, name TEXT, location TEXT, deleted_at TIMESTAMPTZ
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_courses (
  id UUID PRIMARY KEY, code TEXT, title TEXT, checklist JSONB, deleted_at TIMESTAMPTZ
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_batches (
  id UUID PRIMARY KEY, code TEXT, batch_no TEXT, training_name TEXT, college TEXT,
  course_id UUID, trainer_id UUID, academic_year TEXT, start_date DATE, end_date DATE,
  phase TEXT, created_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_expenses (
  id UUID PRIMARY KEY, employee_id UUID, category TEXT, amount NUMERIC, notes TEXT,
  receipt_url TEXT, status TEXT, approved_by UUID, approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_attendance (
  id UUID PRIMARY KEY, employee_id UUID, work_date DATE, status TEXT,
  first_clock_in TIMESTAMPTZ, last_clock_out TIMESTAMPTZ,
  total_working_minutes INTEGER, total_break_minutes INTEGER, deleted_at TIMESTAMPTZ
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_sessions (
  id UUID PRIMARY KEY, attendance_record_id UUID, clock_in TIMESTAMPTZ, clock_out TIMESTAMPTZ,
  work_type TEXT, notes TEXT, deleted_at TIMESTAMPTZ
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_checklist_json (raw_value JSONB) ON COMMIT DROP;

CREATE TEMP TABLE _pre_checklist_items (
  batch_id UUID, task_label TEXT, is_done BOOLEAN, PRIMARY KEY (batch_id, task_label)
) ON COMMIT DROP;

CREATE TEMP TABLE _migration_report (
  seq INTEGER GENERATED ALWAYS AS IDENTITY, section TEXT NOT NULL, item TEXT NOT NULL, status TEXT NOT NULL, details TEXT
) ON COMMIT DROP;

-- -----------------------------------------------------------------------------
-- 1. Strict Preflight Validation (Tables, Column Names, Exact Data Types, PKs)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing_tables TEXT[];
  v_bad_cols       TEXT[];
  v_bad_opt_cols   TEXT[];
BEGIN
  SELECT ARRAY_AGG(t) INTO v_missing_tables
  FROM UNNEST(ARRAY[
    'flwdsk_colleges','flwdsk_courses','flwdsk_batches','flwdsk_system_settings',
    'flwdsk_employees','flwdsk_attendance_records','flwdsk_work_sessions','flwdsk_break_records',
    'flwdsk_expense_claims','flwdsk_travel_requests','flwdsk_email_logs','flwdsk_audit_logs'
  ]) AS t
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t);
  IF v_missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'FATAL PREFLIGHT: Missing required tables: %', array_to_string(v_missing_tables, ', ');
  END IF;

  WITH req(tbl, col, dt) AS (
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
      ('flwdsk_break_records','deleted_at','timestamp with time zone'),
      ('flwdsk_employees','deleted_at','timestamp with time zone'),
      ('flwdsk_travel_requests','deleted_at','timestamp with time zone'),
      ('flwdsk_system_settings','key','text'), ('flwdsk_system_settings','value','jsonb')
  )
  SELECT ARRAY_AGG(r.tbl || '.' || r.col || ' (got=' || COALESCE(c.data_type, 'MISSING') || ', exp=' || r.dt || ')')
  INTO v_bad_cols
  FROM req r
  LEFT JOIN information_schema.columns c ON c.table_schema = 'public' AND c.table_name = r.tbl AND c.column_name = r.col
  WHERE c.column_name IS NULL OR c.data_type <> r.dt;
  IF v_bad_cols IS NOT NULL THEN
    RAISE EXCEPTION 'FATAL PREFLIGHT: Missing/mismatched columns: %', array_to_string(v_bad_cols, '; ');
  END IF;

  SELECT ARRAY_AGG(v.tbl || '.' || v.col || ' (got=' || c.data_type || ', exp=' || v.dt || ')')
  INTO v_bad_opt_cols
  FROM (VALUES
    ('flwdsk_batches','program','text'), ('flwdsk_batches','college_id','uuid'),
    ('flwdsk_expense_claims','batch_id','uuid'), ('flwdsk_work_sessions','batch_id','uuid')
  ) AS v(tbl, col, dt)
  JOIN information_schema.columns c ON c.table_schema = 'public' AND c.table_name = v.tbl AND c.column_name = v.col
  WHERE c.data_type <> v.dt;
  IF v_bad_opt_cols IS NOT NULL THEN
    RAISE EXCEPTION 'FATAL PREFLIGHT: Pre-existing additive columns have wrong types: %', array_to_string(v_bad_opt_cols, '; ');
  END IF;

  IF EXISTS (SELECT 1 FROM public.flwdsk_colleges WHERE id IS NULL)
     OR EXISTS (SELECT 1 FROM public.flwdsk_courses WHERE id IS NULL)
     OR EXISTS (SELECT 1 FROM public.flwdsk_batches WHERE id IS NULL) THEN
    RAISE EXCEPTION 'FATAL PREFLIGHT: NULL UUID primary key detected.';
  END IF;
END $$;

INSERT INTO _migration_report (section, item, status, details)
VALUES ('1. Preflight', 'Tables, column types & UUIDs', 'OK', 'All 12 core tables, 68 column types, and UUID PKs verified.');

-- Capture Pre-Migration Snapshots
INSERT INTO _pre_counts
SELECT 'flwdsk_colleges',           COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_colleges
UNION ALL SELECT 'flwdsk_courses',            COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_courses
UNION ALL SELECT 'flwdsk_batches',            COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_batches
UNION ALL SELECT 'flwdsk_expense_claims',     COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_expense_claims
UNION ALL SELECT 'flwdsk_attendance_records', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_attendance_records
UNION ALL SELECT 'flwdsk_work_sessions',      COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_work_sessions
UNION ALL SELECT 'flwdsk_break_records',      COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_break_records
UNION ALL SELECT 'flwdsk_employees',          COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_employees
UNION ALL SELECT 'flwdsk_travel_requests',    COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_travel_requests
UNION ALL SELECT 'flwdsk_email_logs',         COUNT(*), COUNT(*) FROM public.flwdsk_email_logs
UNION ALL SELECT 'flwdsk_audit_logs',         COUNT(*), COUNT(*) FROM public.flwdsk_audit_logs;

INSERT INTO _pre_colleges   SELECT id, code, name, location, deleted_at FROM public.flwdsk_colleges;
INSERT INTO _pre_courses    SELECT id, code, title, checklist, deleted_at FROM public.flwdsk_courses;
INSERT INTO _pre_batches    SELECT id, code, batch_no, training_name, college, course_id, trainer_id, academic_year, start_date, end_date, phase, created_at, deleted_at FROM public.flwdsk_batches;
INSERT INTO _pre_expenses   SELECT id, employee_id, category, amount, notes, receipt_url, status, approved_by, approved_at, created_at, deleted_at FROM public.flwdsk_expense_claims;
INSERT INTO _pre_attendance SELECT id, employee_id, work_date, status, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, deleted_at FROM public.flwdsk_attendance_records;
INSERT INTO _pre_sessions   SELECT id, attendance_record_id, clock_in, clock_out, work_type, notes, deleted_at FROM public.flwdsk_work_sessions;
INSERT INTO _pre_checklist_json SELECT value::jsonb FROM public.flwdsk_system_settings WHERE key = 'batch_checklist_state' LIMIT 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'flwdsk_batch_checklist_items') THEN
    INSERT INTO _pre_checklist_items (batch_id, task_label, is_done)
    SELECT batch_id, task_label, is_done FROM public.flwdsk_batch_checklist_items;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Audit Table (Compatibility Verified), Additive Columns & Exact FKs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flwdsk_batch_migration_audit (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table     TEXT NOT NULL DEFAULT '',
  source_record_id TEXT NOT NULL DEFAULT '',
  batch_id         UUID,
  issue_type       TEXT NOT NULL,
  raw_value        TEXT,
  details          JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure source_table / source_record_id exist if an older audit table existed
ALTER TABLE public.flwdsk_batch_migration_audit ADD COLUMN IF NOT EXISTS source_table TEXT NOT NULL DEFAULT '';
ALTER TABLE public.flwdsk_batch_migration_audit ADD COLUMN IF NOT EXISTS source_record_id TEXT NOT NULL DEFAULT '';

-- Verify complete audit-table compatibility (all columns, types, PK) before writing
DO $$
DECLARE
  v_bad_audit TEXT[];
BEGIN
  WITH exp(col, dt) AS (
    VALUES
      ('id','uuid'), ('source_table','text'), ('source_record_id','text'), ('batch_id','uuid'),
      ('issue_type','text'), ('raw_value','text'), ('details','jsonb'), ('resolved','boolean'), ('created_at','timestamp with time zone')
  )
  SELECT ARRAY_AGG(e.col || ' (got=' || COALESCE(c.data_type, 'MISSING') || ', exp=' || e.dt || ')')
  INTO v_bad_audit
  FROM exp e
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'flwdsk_batch_migration_audit' AND c.column_name = e.col
  WHERE c.column_name IS NULL OR c.data_type <> e.dt;

  IF v_bad_audit IS NOT NULL THEN
    RAISE EXCEPTION 'FATAL PREFLIGHT: Incompatible flwdsk_batch_migration_audit schema: %', array_to_string(v_bad_audit, '; ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid AND cls.relnamespace = 'public'::regnamespace
    WHERE cls.relname = 'flwdsk_batch_migration_audit' AND con.contype = 'p'
  ) THEN
    RAISE EXCEPTION 'FATAL PREFLIGHT: flwdsk_batch_migration_audit is missing a primary key.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_batch_migration_audit_unresolved
  ON public.flwdsk_batch_migration_audit (issue_type, source_table, source_record_id, COALESCE(raw_value, ''))
  WHERE resolved = FALSE;

ALTER TABLE public.flwdsk_batches        ADD COLUMN IF NOT EXISTS program TEXT;
ALTER TABLE public.flwdsk_batches        ADD COLUMN IF NOT EXISTS college_id UUID;
ALTER TABLE public.flwdsk_expense_claims ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.flwdsk_work_sessions  ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Pre-FK orphan check: abort if any pre-existing additive FK column contains orphaned values
DO $$
DECLARE
  v_orph_col INT; v_orph_exp INT; v_orph_ws INT;
BEGIN
  SELECT COUNT(*) INTO v_orph_col FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_colleges c ON c.id = b.college_id WHERE b.college_id IS NOT NULL AND c.id IS NULL;
  SELECT COUNT(*) INTO v_orph_exp FROM public.flwdsk_expense_claims e LEFT JOIN public.flwdsk_batches b ON b.id = e.batch_id WHERE e.batch_id IS NOT NULL AND b.id IS NULL;
  SELECT COUNT(*) INTO v_orph_ws  FROM public.flwdsk_work_sessions  w LEFT JOIN public.flwdsk_batches b ON b.id = w.batch_id WHERE w.batch_id IS NOT NULL AND b.id IS NULL;
  IF v_orph_col > 0 OR v_orph_exp > 0 OR v_orph_ws > 0 THEN
    RAISE EXCEPTION 'FATAL FK PREFLIGHT: Pre-existing orphaned values found (batches.college_id=%, expense_claims.batch_id=%, work_sessions.batch_id=%). Resolve before adding FKs.',
      v_orph_col, v_orph_exp, v_orph_ws;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.flwdsk_batch_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  task_label TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by UUID,
  completed_by_name TEXT,
  completed_at TIMESTAMPTZ,
  source_app TEXT NOT NULL DEFAULT 'flowdesk',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_flwdsk_batch_checklist_item UNIQUE (batch_id, task_label)
);

-- Exact pg_catalog FK validation (separate arrays prevent diagnostic overwrite)
DO $$
DECLARE
  v_fk RECORD;
  v_total_fks INT;
  v_exact_cnt INT;
  v_all_names TEXT[];
  v_exact_names TEXT[];
  v_dels TEXT[];
  v_vals BOOLEAN[];
BEGIN
  FOR v_fk IN
    SELECT * FROM (VALUES
      ('flwdsk_batches',               'college_id', 'flwdsk_colleges', 'r', 'fk_flwdsk_batches_college_id',       'RESTRICT'),
      ('flwdsk_expense_claims',        'batch_id',   'flwdsk_batches',  'n', 'fk_flwdsk_expense_claims_batch_id',  'SET NULL'),
      ('flwdsk_work_sessions',         'batch_id',   'flwdsk_batches',  'n', 'fk_flwdsk_work_sessions_batch_id',   'SET NULL'),
      ('flwdsk_batch_checklist_items', 'batch_id',   'flwdsk_batches',  'r', 'fk_flwdsk_batch_checklist_batch_id', 'RESTRICT')
    ) AS t(src_tbl, src_col, ref_tbl, exp_deltype, con_name, del_sql)
  LOOP
    SELECT COUNT(*), ARRAY_AGG(con.conname)
    INTO v_total_fks, v_all_names
    FROM pg_constraint con
    JOIN pg_class src_cls ON src_cls.oid = con.conrelid AND src_cls.relnamespace = 'public'::regnamespace
    JOIN pg_attribute src_att ON src_att.attrelid = src_cls.oid AND src_att.attname = v_fk.src_col
    WHERE con.contype = 'f'
      AND src_cls.relname = v_fk.src_tbl
      AND src_att.attnum = ANY(con.conkey);

    IF v_total_fks > 1 THEN
      RAISE EXCEPTION 'FATAL FK CONFLICT: Multiple FK constraints on %.%: %', v_fk.src_tbl, v_fk.src_col, array_to_string(v_all_names, ', ');
    END IF;

    SELECT COUNT(*), ARRAY_AGG(con.conname), ARRAY_AGG(con.confdeltype::text), ARRAY_AGG(con.convalidated)
    INTO v_exact_cnt, v_exact_names, v_dels, v_vals
    FROM pg_constraint con
    JOIN pg_class src_cls ON src_cls.oid = con.conrelid AND src_cls.relnamespace = 'public'::regnamespace
    JOIN pg_attribute src_att ON src_att.attrelid = src_cls.oid AND src_att.attnum = con.conkey[1]
    JOIN pg_class ref_cls ON ref_cls.oid = con.confrelid AND ref_cls.relnamespace = 'public'::regnamespace
    JOIN pg_attribute ref_att ON ref_att.attrelid = ref_cls.oid AND ref_att.attnum = con.confkey[1]
    WHERE con.contype = 'f' AND array_length(con.conkey, 1) = 1 AND array_length(con.confkey, 1) = 1
      AND src_cls.relname = v_fk.src_tbl AND src_att.attname = v_fk.src_col
      AND ref_cls.relname = v_fk.ref_tbl AND ref_att.attname = 'id';

    IF v_total_fks = 1 AND v_exact_cnt = 0 THEN
      RAISE EXCEPTION 'FATAL FK CONFLICT: Unexpected FK % exists on %.% (does not match %.id).', v_all_names[1], v_fk.src_tbl, v_fk.src_col, v_fk.ref_tbl;
    ELSIF v_exact_cnt = 1 AND (v_dels[1] <> v_fk.exp_deltype OR NOT v_vals[1]) THEN
      RAISE EXCEPTION 'FATAL FK CONFLICT: %.% -> %.id constraint % has confdeltype=% validated=% (expected %, true).',
        v_fk.src_tbl, v_fk.src_col, v_fk.ref_tbl, v_exact_names[1], v_dels[1], v_vals[1], v_fk.exp_deltype;
    ELSIF v_total_fks = 0 THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE %s',
        v_fk.src_tbl, v_fk.con_name, v_fk.src_col, v_fk.ref_tbl, v_fk.del_sql);
    END IF;
  END LOOP;
END $$;

-- Pre-replace function & view compatibility guard (never blindly replace incompatible objects)
DO $$
DECLARE
  v_bad_fn RECORD;
  v_relkind CHAR(1);
BEGIN
  FOR v_bad_fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS ret, p.prosecdef
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('normalize_batch_code', 'generate_standard_batch_code', 'toggle_batch_checklist_item')
  LOOP
    IF v_bad_fn.prosecdef THEN
      RAISE EXCEPTION 'FATAL COMPATIBILITY: Existing function public.%(%) is SECURITY DEFINER.', v_bad_fn.proname, v_bad_fn.args;
    END IF;
    IF v_bad_fn.proname = 'normalize_batch_code' AND (v_bad_fn.args <> 'p_code text' OR v_bad_fn.ret <> 'text') THEN
      RAISE EXCEPTION 'FATAL COMPATIBILITY: Incompatible signature on public.normalize_batch_code(%) -> %.', v_bad_fn.args, v_bad_fn.ret;
    END IF;
    IF v_bad_fn.proname = 'generate_standard_batch_code' AND (v_bad_fn.args <> 'p_college_code text, p_program text, p_academic_year text, p_batch_no text, p_course_code text' OR v_bad_fn.ret <> 'text') THEN
      RAISE EXCEPTION 'FATAL COMPATIBILITY: Incompatible signature on public.generate_standard_batch_code(%) -> %.', v_bad_fn.args, v_bad_fn.ret;
    END IF;
    IF v_bad_fn.proname = 'toggle_batch_checklist_item' AND (v_bad_fn.args NOT LIKE 'p_batch_id uuid, p_task_label text, p_is_done boolean%' OR v_bad_fn.ret <> 'flwdsk_batch_checklist_items') THEN
      RAISE EXCEPTION 'FATAL COMPATIBILITY: Incompatible signature on public.toggle_batch_checklist_item(%) -> %.', v_bad_fn.args, v_bad_fn.ret;
    END IF;
  END LOOP;

  SELECT c.relkind INTO v_relkind
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname = 'flwdsk_batches_integration_v1';
  IF v_relkind IS NOT NULL AND v_relkind <> 'v' THEN
    RAISE EXCEPTION 'FATAL COMPATIBILITY: public.flwdsk_batches_integration_v1 exists with relkind=% (expected view).', v_relkind;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_batch_code(p_code TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_code IS NULL THEN ''
    ELSE UPPER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(p_code), '\s*-\s*', ' - ', 'g'), '\s+', ' ', 'g'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.generate_standard_batch_code(
  p_college_code TEXT, p_program TEXT, p_academic_year TEXT, p_batch_no TEXT, p_course_code TEXT
) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CONCAT_WS(' - ',
    NULLIF(UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_college_code, '')),  '\s+', ' ', 'g')), ''),
    NULLIF(UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_program, '')),       '\s+', ' ', 'g')), ''),
    NULLIF(UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_academic_year, '')), '\s+', ' ', 'g')), ''),
    NULLIF(UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_batch_no, '')),      '\s+', ' ', 'g')), ''),
    NULLIF(UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_course_code, '')),   '\s+', ' ', 'g')), '')
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. College Code Duplicate Check & Safe Unambiguous College Backfill
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  dup RECORD; rec RECORD; v_dups INT := 0; match_cnt INT; matched_id UUID;
  v_mapped INT := 0; v_skipped INT := 0; v_unmatched INT := 0; v_ambiguous INT := 0;
BEGIN
  FOR dup IN
    SELECT UPPER(TRIM(code)) AS nc, ARRAY_AGG(id ORDER BY created_at) AS ids, COUNT(*) AS cnt
    FROM public.flwdsk_colleges WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> ''
    GROUP BY UPPER(TRIM(code)) HAVING COUNT(*) > 1
  LOOP
    v_dups := v_dups + 1;
    INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, issue_type, raw_value, details)
    VALUES ('flwdsk_colleges', dup.ids[1]::text, 'DUPLICATE_COLLEGE_CODE', dup.nc, jsonb_build_object('college_ids', dup.ids, 'count', dup.cnt))
    ON CONFLICT DO NOTHING;
  END LOOP;

  IF v_dups = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_flwdsk_colleges_code_unique
      ON public.flwdsk_colleges (UPPER(TRIM(code))) WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> '';
  END IF;

  FOR rec IN SELECT id, college FROM public.flwdsk_batches WHERE college_id IS NULL LOOP
    IF rec.college IS NULL OR TRIM(rec.college) IN ('', '—') THEN
      v_skipped := v_skipped + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, batch_id, issue_type, raw_value, details)
      VALUES ('flwdsk_batches', rec.id::text, rec.id, 'SKIPPED_BATCH_NO_COLLEGE_TEXT', COALESCE(rec.college, ''), jsonb_build_object('reason', 'Empty or placeholder college text'))
      ON CONFLICT DO NOTHING;
      CONTINUE;
    END IF;

    SELECT COUNT(*), (ARRAY_AGG(c.id))[1] INTO match_cnt, matched_id FROM public.flwdsk_colleges c
    WHERE c.deleted_at IS NULL AND (LOWER(TRIM(c.name)) = LOWER(TRIM(rec.college)) OR LOWER(TRIM(c.code)) = LOWER(TRIM(rec.college)));

    IF match_cnt = 1 THEN
      UPDATE public.flwdsk_batches SET college_id = matched_id WHERE id = rec.id AND college_id IS NULL;
      v_mapped := v_mapped + 1;
    ELSIF match_cnt = 0 THEN
      v_unmatched := v_unmatched + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, batch_id, issue_type, raw_value, details)
      VALUES ('flwdsk_batches', rec.id::text, rec.id, 'UNMATCHED_COLLEGE', rec.college, jsonb_build_object('reason', 'No active college matched'))
      ON CONFLICT DO NOTHING;
    ELSE
      v_ambiguous := v_ambiguous + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, batch_id, issue_type, raw_value, details)
      VALUES ('flwdsk_batches', rec.id::text, rec.id, 'AMBIGUOUS_COLLEGE', rec.college, jsonb_build_object('match_count', match_cnt))
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  INSERT INTO _migration_report (section, item, status, details)
  VALUES ('2. College Mapping', 'college_id backfill', CASE WHEN v_dups = 0 AND v_unmatched = 0 AND v_ambiguous = 0 THEN 'OK' ELSE 'WARNING' END,
    format('Mapped: %s, Skipped(empty): %s, Unmatched: %s, Ambiguous: %s, College code dups: %s', v_mapped, v_skipped, v_unmatched, v_ambiguous, v_dups));
END $$;

-- -----------------------------------------------------------------------------
-- 4. Safe Training Expense batch_id Backfill (Office Expense Untouched)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD; v_json JSONB; v_batch_ref TEXT; v_match_cnt INT; v_matched_id UUID;
  v_mapped INT := 0; v_malformed INT := 0; v_skipped INT := 0; v_unmatched INT := 0; v_ambiguous INT := 0;
BEGIN
  FOR rec IN
    SELECT id, notes FROM public.flwdsk_expense_claims
    WHERE deleted_at IS NULL AND batch_id IS NULL AND category ILIKE '%Training%'
  LOOP
    BEGIN
      v_json := rec.notes::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_malformed := v_malformed + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, issue_type, raw_value, details)
      VALUES ('flwdsk_expense_claims', rec.id::text, 'MALFORMED_EXPENSE_NOTES_JSON', LEFT(COALESCE(rec.notes, ''), 500), jsonb_build_object('expense_id', rec.id))
      ON CONFLICT DO NOTHING;
      CONTINUE;
    END;

    v_batch_ref := NULLIF(TRIM(COALESCE(v_json->>'batchName', '')), '');
    IF v_batch_ref IS NULL THEN
      v_skipped := v_skipped + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, issue_type, raw_value, details)
      VALUES ('flwdsk_expense_claims', rec.id::text, 'SKIPPED_EXPENSE_NO_BATCH_REF', LEFT(COALESCE(rec.notes, ''), 500), jsonb_build_object('expense_id', rec.id))
      ON CONFLICT DO NOTHING;
      CONTINUE;
    END IF;

    SELECT COUNT(*), (ARRAY_AGG(b.id))[1] INTO v_match_cnt, v_matched_id FROM public.flwdsk_batches b
    WHERE b.deleted_at IS NULL AND (b.id::text = v_batch_ref OR public.normalize_batch_code(b.code) = public.normalize_batch_code(v_batch_ref));

    IF v_match_cnt = 1 THEN
      UPDATE public.flwdsk_expense_claims SET batch_id = v_matched_id WHERE id = rec.id AND batch_id IS NULL;
      v_mapped := v_mapped + 1;
    ELSIF v_match_cnt = 0 THEN
      v_unmatched := v_unmatched + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, issue_type, raw_value, details)
      VALUES ('flwdsk_expense_claims', rec.id::text, 'UNMATCHED_EXPENSE_BATCH', v_batch_ref, jsonb_build_object('expense_id', rec.id))
      ON CONFLICT DO NOTHING;
    ELSE
      v_ambiguous := v_ambiguous + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, issue_type, raw_value, details)
      VALUES ('flwdsk_expense_claims', rec.id::text, 'AMBIGUOUS_EXPENSE_BATCH', v_batch_ref, jsonb_build_object('expense_id', rec.id, 'match_count', v_match_cnt))
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  INSERT INTO _migration_report (section, item, status, details)
  VALUES ('3. Expense batch_id', 'Training Expense backfill', CASE WHEN v_malformed = 0 AND v_skipped = 0 AND v_unmatched = 0 AND v_ambiguous = 0 THEN 'OK' ELSE 'WARNING' END,
    format('Mapped: %s, Malformed JSON: %s, Skipped(no ref): %s, Unmatched: %s, Ambiguous: %s', v_mapped, v_malformed, v_skipped, v_unmatched, v_ambiguous));
END $$;

-- -----------------------------------------------------------------------------
-- 5. Safe Training Work Session batch_id Backfill (Office/Remote Untouched)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD; v_ref TEXT; v_match_cnt INT; v_matched_id UUID;
  v_mapped INT := 0; v_skipped INT := 0; v_unmatched INT := 0; v_ambiguous INT := 0;
BEGIN
  FOR rec IN
    SELECT id, work_type, notes FROM public.flwdsk_work_sessions
    WHERE deleted_at IS NULL AND batch_id IS NULL AND (work_type ILIKE 'Training%' OR COALESCE(notes, '') ~* '\[Training:')
  LOOP
    v_ref := NULLIF(TRIM(
      CASE
        WHEN rec.work_type ~* '^Training\s*:\s*(.+)$' THEN REGEXP_REPLACE(rec.work_type, '^Training\s*:\s*', '', 'i')
        WHEN COALESCE(rec.notes, '') ~* '\[Training:\s*([^\]]+)\]' THEN (REGEXP_MATCH(rec.notes, '\[Training:\s*([^\]]+)\]', 'i'))[1]
        ELSE ''
      END
    ), '');

    IF v_ref IS NULL THEN
      v_skipped := v_skipped + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, issue_type, raw_value, details)
      VALUES ('flwdsk_work_sessions', rec.id::text, 'SKIPPED_SESSION_NO_BATCH_REF', COALESCE(rec.work_type, rec.notes, ''), jsonb_build_object('work_session_id', rec.id))
      ON CONFLICT DO NOTHING;
      CONTINUE;
    END IF;

    SELECT COUNT(*), (ARRAY_AGG(b.id))[1] INTO v_match_cnt, v_matched_id FROM public.flwdsk_batches b
    WHERE b.deleted_at IS NULL AND (b.id::text = v_ref OR public.normalize_batch_code(b.code) = public.normalize_batch_code(v_ref));

    IF v_match_cnt = 1 THEN
      UPDATE public.flwdsk_work_sessions SET batch_id = v_matched_id WHERE id = rec.id AND batch_id IS NULL;
      v_mapped := v_mapped + 1;
    ELSIF v_match_cnt = 0 THEN
      v_unmatched := v_unmatched + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, issue_type, raw_value, details)
      VALUES ('flwdsk_work_sessions', rec.id::text, 'UNMATCHED_SESSION_BATCH', v_ref, jsonb_build_object('work_session_id', rec.id))
      ON CONFLICT DO NOTHING;
    ELSE
      v_ambiguous := v_ambiguous + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, issue_type, raw_value, details)
      VALUES ('flwdsk_work_sessions', rec.id::text, 'AMBIGUOUS_SESSION_BATCH', v_ref, jsonb_build_object('work_session_id', rec.id, 'match_count', v_match_cnt))
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  INSERT INTO _migration_report (section, item, status, details)
  VALUES ('4. Attendance batch_id', 'Training work_sessions backfill', CASE WHEN v_skipped = 0 AND v_unmatched = 0 AND v_ambiguous = 0 THEN 'OK' ELSE 'WARNING' END,
    format('Mapped: %s, Skipped(no ref): %s, Unmatched: %s, Ambiguous: %s', v_mapped, v_skipped, v_unmatched, v_ambiguous));
END $$;

-- -----------------------------------------------------------------------------
-- 6. Batch Code Duplicate Check, Proposed Normalized Collision Check & Preview
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  dup RECORD; rec RECORD; pdup RECORD;
  v_dups INT := 0; v_prop_dups INT := 0; v_diff INT := 0; v_inc INT := 0; v_cand TEXT;
BEGIN
  FOR dup IN
    SELECT public.normalize_batch_code(code) AS nc, ARRAY_AGG(id ORDER BY created_at) AS ids, COUNT(*) AS cnt
    FROM public.flwdsk_batches WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> ''
    GROUP BY public.normalize_batch_code(code) HAVING COUNT(*) > 1
  LOOP
    v_dups := v_dups + 1;
    INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, batch_id, issue_type, raw_value, details)
    VALUES ('flwdsk_batches', dup.ids[1]::text, dup.ids[1], 'DUPLICATE_BATCH_CODE', dup.nc, jsonb_build_object('batch_ids', dup.ids, 'count', dup.cnt))
    ON CONFLICT DO NOTHING;
  END LOOP;

  FOR pdup IN
    SELECT public.generate_standard_batch_code(COALESCE(col.code, b.college), b.program, b.academic_year, b.batch_no, crs.code) AS pc,
           ARRAY_AGG(b.id ORDER BY b.created_at) AS ids, COUNT(*) AS cnt
    FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_colleges col ON col.id = b.college_id LEFT JOIN public.flwdsk_courses crs ON crs.id = b.course_id
    WHERE b.deleted_at IS NULL
    GROUP BY 1 HAVING public.generate_standard_batch_code(COALESCE(col.code, b.college), b.program, b.academic_year, b.batch_no, crs.code) <> '' AND COUNT(*) > 1
  LOOP
    v_prop_dups := v_prop_dups + 1;
    INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, batch_id, issue_type, raw_value, details)
    VALUES ('flwdsk_batches', pdup.ids[1]::text, pdup.ids[1], 'DUPLICATE_PROPOSED_BATCH_CODE', pdup.pc, jsonb_build_object('batch_ids', pdup.ids, 'count', pdup.cnt))
    ON CONFLICT DO NOTHING;
  END LOOP;

  FOR rec IN
    SELECT b.id, b.code AS old_code, col.code AS c_code, b.program, b.academic_year, b.batch_no, crs.code AS crs_code
    FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_colleges col ON col.id = b.college_id LEFT JOIN public.flwdsk_courses crs ON crs.id = b.course_id
    WHERE b.deleted_at IS NULL
  LOOP
    IF NULLIF(TRIM(COALESCE(rec.c_code,'')), '') IS NULL OR NULLIF(TRIM(COALESCE(rec.program,'')), '') IS NULL
       OR NULLIF(TRIM(COALESCE(rec.academic_year,'')), '') IS NULL OR NULLIF(TRIM(COALESCE(rec.batch_no,'')), '') IS NULL
       OR NULLIF(TRIM(COALESCE(rec.crs_code,'')), '') IS NULL THEN
      v_inc := v_inc + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, batch_id, issue_type, raw_value, details)
      VALUES ('flwdsk_batches', rec.id::text, rec.id, 'INCOMPLETE_PROPOSED_BATCH_CODE', COALESCE(rec.old_code, ''), jsonb_build_object('college_code', rec.c_code, 'program', rec.program, 'academic_year', rec.academic_year, 'batch_no', rec.batch_no, 'course_code', rec.crs_code))
      ON CONFLICT DO NOTHING;
    ELSE
      v_cand := public.generate_standard_batch_code(rec.c_code, rec.program, rec.academic_year, rec.batch_no, rec.crs_code);
      IF rec.old_code IS DISTINCT FROM v_cand THEN
        v_diff := v_diff + 1;
        INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, batch_id, issue_type, raw_value, details)
        VALUES ('flwdsk_batches', rec.id::text, rec.id, 'CODE_STANDARDIZATION_PREVIEW', COALESCE(rec.old_code, ''), jsonb_build_object('proposed_5part_code', v_cand))
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  IF v_dups = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_flwdsk_batches_code_unique
      ON public.flwdsk_batches (public.normalize_batch_code(code)) WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> '';
  END IF;

  INSERT INTO _migration_report (section, item, status, details)
  VALUES ('5. Batch Codes', 'Duplicates & 5-part preview', CASE WHEN v_dups = 0 AND v_prop_dups = 0 AND v_diff = 0 THEN 'OK' ELSE 'WARNING' END,
    format('Active dups: %s, Proposed dups: %s, Incomplete: %s, Preview diffs: %s (existing codes untouched).', v_dups, v_prop_dups, v_inc, v_diff));
END $$;

-- -----------------------------------------------------------------------------
-- 7. Checklist Migration & SECURITY INVOKER RPC (Exceptions Audited)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_batch_checklist_batch_id ON public.flwdsk_batch_checklist_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_checklist_updated_at ON public.flwdsk_batch_checklist_items(updated_at);

DO $$
DECLARE
  raw_val JSONB; parsed_val JSONB; b_key TEXT; t_key TEXT; raw_t JSONB; t_val BOOLEAN; b_uuid UUID;
  v_ins INT := 0; v_err INT := 0;
BEGIN
  SELECT value::jsonb INTO raw_val FROM public.flwdsk_system_settings WHERE key = 'batch_checklist_state' LIMIT 1;
  IF raw_val IS NOT NULL THEN
    BEGIN
      parsed_val := CASE WHEN jsonb_typeof(raw_val) = 'string' THEN (raw_val #>> '{}')::jsonb ELSE raw_val END;
    EXCEPTION WHEN OTHERS THEN
      v_err := v_err + 1;
      INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, issue_type, raw_value, details)
      VALUES ('flwdsk_system_settings', 'batch_checklist_state', 'CHECKLIST_MALFORMED_JSON', LEFT(raw_val::text, 500), jsonb_build_object('reason', 'Invalid JSON string'))
      ON CONFLICT DO NOTHING;
      parsed_val := NULL;
    END;

    IF parsed_val IS NOT NULL AND jsonb_typeof(parsed_val) = 'object' THEN
      FOR b_key IN SELECT jsonb_object_keys(parsed_val) LOOP
        BEGIN
          b_uuid := b_key::uuid;
        EXCEPTION WHEN OTHERS THEN
          v_err := v_err + 1;
          INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, issue_type, raw_value, details)
          VALUES ('flwdsk_system_settings', b_key, 'CHECKLIST_INVALID_BATCH_KEY', b_key, jsonb_build_object('reason', 'Non-UUID key'))
          ON CONFLICT DO NOTHING;
          CONTINUE;
        END;

        IF NOT EXISTS (SELECT 1 FROM public.flwdsk_batches WHERE id = b_uuid) THEN
          v_err := v_err + 1;
          INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, batch_id, issue_type, raw_value, details)
          VALUES ('flwdsk_system_settings', b_key, b_uuid, 'CHECKLIST_MISSING_BATCH', b_key, jsonb_build_object('reason', 'Batch UUID not in flwdsk_batches'))
          ON CONFLICT DO NOTHING;
          CONTINUE;
        END IF;

        IF jsonb_typeof(parsed_val -> b_key) <> 'object' THEN
          v_err := v_err + 1;
          INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, batch_id, issue_type, raw_value, details)
          VALUES ('flwdsk_system_settings', b_key, b_uuid, 'CHECKLIST_INVALID_BATCH_VALUE', b_key, jsonb_build_object('type', jsonb_typeof(parsed_val -> b_key)))
          ON CONFLICT DO NOTHING;
          CONTINUE;
        END IF;

        FOR t_key IN SELECT jsonb_object_keys(parsed_val -> b_key) LOOP
          raw_t := (parsed_val -> b_key) -> t_key;
          IF jsonb_typeof(raw_t) = 'boolean' THEN
            t_val := (raw_t)::text::boolean;
          ELSIF jsonb_typeof(raw_t) = 'null' THEN
            t_val := FALSE;
          ELSE
            v_err := v_err + 1;
            INSERT INTO public.flwdsk_batch_migration_audit (source_table, source_record_id, batch_id, issue_type, raw_value, details)
            VALUES ('flwdsk_system_settings', b_key || '::' || t_key, b_uuid, 'CHECKLIST_INVALID_TASK_VALUE', t_key, jsonb_build_object('value', raw_t))
            ON CONFLICT DO NOTHING;
            CONTINUE;
          END IF;

          INSERT INTO public.flwdsk_batch_checklist_items (batch_id, task_label, is_done, source_app)
          VALUES (b_uuid, t_key, t_val, 'flowdesk_migration')
          ON CONFLICT (batch_id, task_label) DO NOTHING;
          IF FOUND THEN v_ins := v_ins + 1; END IF;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  INSERT INTO _migration_report (section, item, status, details)
  VALUES ('6. Checklist', 'JSONB backfill', CASE WHEN v_err = 0 THEN 'OK' ELSE 'WARNING' END,
    format('Newly migrated: %s, Logged anomalies: %s (legacy JSONB untouched).', v_ins, v_err));
END $$;

CREATE OR REPLACE FUNCTION public.toggle_batch_checklist_item(
  p_batch_id UUID, p_task_label TEXT, p_is_done BOOLEAN,
  p_actor_id UUID DEFAULT NULL, p_actor_name TEXT DEFAULT NULL,
  p_source_app TEXT DEFAULT 'flowdesk', p_total_tasks INTEGER DEFAULT NULL
) RETURNS public.flwdsk_batch_checklist_items
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_row public.flwdsk_batch_checklist_items; v_done INTEGER; v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO public.flwdsk_batch_checklist_items (batch_id, task_label, is_done, completed_by, completed_by_name, completed_at, source_app, updated_at)
  VALUES (p_batch_id, p_task_label, p_is_done, COALESCE(p_actor_id, auth.uid()), p_actor_name, CASE WHEN p_is_done THEN v_now ELSE NULL END, COALESCE(NULLIF(TRIM(p_source_app), ''), 'flowdesk'), v_now)
  ON CONFLICT (batch_id, task_label) DO UPDATE SET
    is_done = EXCLUDED.is_done, completed_by = COALESCE(EXCLUDED.completed_by, flwdsk_batch_checklist_items.completed_by),
    completed_by_name = COALESCE(EXCLUDED.completed_by_name, flwdsk_batch_checklist_items.completed_by_name),
    completed_at = CASE WHEN EXCLUDED.is_done THEN v_now ELSE NULL END, source_app = EXCLUDED.source_app, updated_at = v_now
  RETURNING * INTO v_row;

  SELECT COUNT(*)::INTEGER INTO v_done FROM public.flwdsk_batch_checklist_items WHERE batch_id = p_batch_id AND is_done = TRUE;
  UPDATE public.flwdsk_batches SET completed_tasks = v_done, total_tasks = COALESCE(p_total_tasks, total_tasks), updated_at = v_now WHERE id = p_batch_id;
  RETURN v_row;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Indexes, Integration View (security_invoker = true) & Realtime Publication
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_college_id ON public.flwdsk_batches(college_id);
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_course_id ON public.flwdsk_batches(course_id);
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_updated_at ON public.flwdsk_batches(updated_at);
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_deleted_at ON public.flwdsk_batches(deleted_at);
CREATE INDEX IF NOT EXISTS idx_flwdsk_courses_updated_at ON public.flwdsk_courses(updated_at);
CREATE INDEX IF NOT EXISTS idx_flwdsk_colleges_updated_at ON public.flwdsk_colleges(updated_at);
CREATE INDEX IF NOT EXISTS idx_flwdsk_expense_claims_batch_id ON public.flwdsk_expense_claims(batch_id);
CREATE INDEX IF NOT EXISTS idx_flwdsk_work_sessions_batch_id ON public.flwdsk_work_sessions(batch_id);

CREATE OR REPLACE VIEW public.flwdsk_batches_integration_v1 WITH (security_invoker = true) AS
SELECT
  b.id, b.code AS batch_code, b.batch_no, b.program, b.academic_year, b.training_name,
  b.start_date, b.end_date, b.capacity, b.phase,
  b.coordinator, b.coordinator_email, b.coordinator2, b.coordinator_email2,
  b.completed_tasks, b.total_tasks,
  b.college_id, b.college AS college_name_legacy, col.code AS college_code, col.name AS college_name, col.location AS college_location,
  b.course_id, crs.code AS course_code, crs.title AS course_title, crs.checklist AS course_checklist_template,
  b.trainer_id, b.created_at, b.updated_at, b.deleted_at
FROM public.flwdsk_batches b
LEFT JOIN public.flwdsk_colleges col ON col.id = b.college_id
LEFT JOIN public.flwdsk_courses  crs ON crs.id = b.course_id;

DO $$
DECLARE tbl TEXT; v_added INT := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY['flwdsk_batches','flwdsk_courses','flwdsk_colleges','flwdsk_batch_checklist_items'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        v_added := v_added + 1;
      END IF;
    END LOOP;
    INSERT INTO _migration_report (section, item, status, details) VALUES ('7. Integration & Realtime', 'View, indexes & publication', 'OK', format('Added %s table(s) to supabase_realtime.', v_added));
  ELSE
    INSERT INTO _migration_report (section, item, status, details) VALUES ('7. Integration & Realtime', 'View, indexes & publication', 'WARNING', 'supabase_realtime publication not found.');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 9. Exact Post-Migration Parity, Strict Bidirectional Checklist & FK Checks
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_post RECORD; v_bad INT;
  v_orph_col INT; v_orph_crs INT; v_orph_exp INT; v_orph_ws INT; v_orph_chk INT;
  v_jb JSONB; v_ja JSONB; v_parsed JSONB;
  b_key TEXT; t_key TEXT; b_uuid UUID; raw_t JSONB; t_val BOOLEAN;
  v_exp_t INT := 0; v_exp_d INT := 0; v_act_t INT := 0; v_act_d INT := 0;
  v_pre_changed INT := 0; v_extra_chk INT := 0;
BEGIN
  FOR v_post IN
    WITH pc AS (
      SELECT 'flwdsk_colleges' AS tn, COUNT(*) AS tr, COUNT(*) FILTER (WHERE deleted_at IS NULL) AS ar FROM public.flwdsk_colleges
      UNION ALL SELECT 'flwdsk_courses',            COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_courses
      UNION ALL SELECT 'flwdsk_batches',            COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_batches
      UNION ALL SELECT 'flwdsk_expense_claims',     COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_expense_claims
      UNION ALL SELECT 'flwdsk_attendance_records', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_attendance_records
      UNION ALL SELECT 'flwdsk_work_sessions',      COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_work_sessions
      UNION ALL SELECT 'flwdsk_break_records',      COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_break_records
      UNION ALL SELECT 'flwdsk_employees',          COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_employees
      UNION ALL SELECT 'flwdsk_travel_requests',    COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_travel_requests
      UNION ALL SELECT 'flwdsk_email_logs',         COUNT(*), COUNT(*) FROM public.flwdsk_email_logs
      UNION ALL SELECT 'flwdsk_audit_logs',         COUNT(*), COUNT(*) FROM public.flwdsk_audit_logs
    )
    SELECT pre.table_name, pre.total_rows bt, pc.tr at, pre.active_rows ba, pc.ar aa FROM _pre_counts pre JOIN pc ON pc.tn = pre.table_name
  LOOP
    IF v_post.bt <> v_post.at OR v_post.ba <> v_post.aa THEN
      RAISE EXCEPTION 'FATAL VERIFICATION: Row count mismatch on %.', v_post.table_name;
    END IF;
  END LOOP;

  SELECT
    (SELECT COUNT(*) FROM _pre_colleges p FULL OUTER JOIN public.flwdsk_colleges c ON c.id = p.id WHERE p.id IS NULL OR c.id IS NULL OR c.code IS DISTINCT FROM p.code OR c.name IS DISTINCT FROM p.name OR c.location IS DISTINCT FROM p.location OR c.deleted_at IS DISTINCT FROM p.deleted_at) +
    (SELECT COUNT(*) FROM _pre_courses  p FULL OUTER JOIN public.flwdsk_courses  c ON c.id = p.id WHERE p.id IS NULL OR c.id IS NULL OR c.code IS DISTINCT FROM p.code OR c.title IS DISTINCT FROM p.title OR c.checklist IS DISTINCT FROM p.checklist OR c.deleted_at IS DISTINCT FROM p.deleted_at) +
    (SELECT COUNT(*) FROM _pre_batches  p FULL OUTER JOIN public.flwdsk_batches  c ON c.id = p.id WHERE p.id IS NULL OR c.id IS NULL OR c.code IS DISTINCT FROM p.code OR c.batch_no IS DISTINCT FROM p.batch_no OR c.training_name IS DISTINCT FROM p.training_name OR c.college IS DISTINCT FROM p.college OR c.course_id IS DISTINCT FROM p.course_id OR c.trainer_id IS DISTINCT FROM p.trainer_id OR c.academic_year IS DISTINCT FROM p.academic_year OR c.start_date IS DISTINCT FROM p.start_date OR c.end_date IS DISTINCT FROM p.end_date OR c.phase IS DISTINCT FROM p.phase OR c.created_at IS DISTINCT FROM p.created_at OR c.deleted_at IS DISTINCT FROM p.deleted_at) +
    (SELECT COUNT(*) FROM _pre_expenses p FULL OUTER JOIN public.flwdsk_expense_claims c ON c.id = p.id WHERE p.id IS NULL OR c.id IS NULL OR c.employee_id IS DISTINCT FROM p.employee_id OR c.category IS DISTINCT FROM p.category OR c.amount IS DISTINCT FROM p.amount OR c.notes IS DISTINCT FROM p.notes OR c.receipt_url IS DISTINCT FROM p.receipt_url OR c.status IS DISTINCT FROM p.status OR c.approved_by IS DISTINCT FROM p.approved_by OR c.approved_at IS DISTINCT FROM p.approved_at OR c.created_at IS DISTINCT FROM p.created_at OR c.deleted_at IS DISTINCT FROM p.deleted_at) +
    (SELECT COUNT(*) FROM _pre_attendance p FULL OUTER JOIN public.flwdsk_attendance_records c ON c.id = p.id WHERE p.id IS NULL OR c.id IS NULL OR c.employee_id IS DISTINCT FROM p.employee_id OR c.work_date IS DISTINCT FROM p.work_date OR c.status IS DISTINCT FROM p.status OR c.first_clock_in IS DISTINCT FROM p.first_clock_in OR c.last_clock_out IS DISTINCT FROM p.last_clock_out OR c.total_working_minutes IS DISTINCT FROM p.total_working_minutes OR c.total_break_minutes IS DISTINCT FROM p.total_break_minutes OR c.deleted_at IS DISTINCT FROM p.deleted_at) +
    (SELECT COUNT(*) FROM _pre_sessions p FULL OUTER JOIN public.flwdsk_work_sessions c ON c.id = p.id WHERE p.id IS NULL OR c.id IS NULL OR c.attendance_record_id IS DISTINCT FROM p.attendance_record_id OR c.clock_in IS DISTINCT FROM p.clock_in OR c.clock_out IS DISTINCT FROM p.clock_out OR c.work_type IS DISTINCT FROM p.work_type OR c.notes IS DISTINCT FROM p.notes OR c.deleted_at IS DISTINCT FROM p.deleted_at)
  INTO v_bad;
  IF v_bad > 0 THEN RAISE EXCEPTION 'FATAL VERIFICATION: % source record(s) mutated or missing.', v_bad; END IF;

  -- Exact raw JSONB + strict bidirectional is_done parity
  SELECT raw_value INTO v_jb FROM _pre_checklist_json LIMIT 1;
  SELECT value::jsonb INTO v_ja FROM public.flwdsk_system_settings WHERE key = 'batch_checklist_state' LIMIT 1;
  IF v_jb IS DISTINCT FROM v_ja THEN RAISE EXCEPTION 'FATAL VERIFICATION: Legacy checklist JSONB modified.'; END IF;

  SELECT COUNT(*) INTO v_pre_changed
  FROM _pre_checklist_items pi LEFT JOIN public.flwdsk_batch_checklist_items ci ON ci.batch_id = pi.batch_id AND ci.task_label = pi.task_label
  WHERE ci.id IS NULL OR ci.is_done IS DISTINCT FROM pi.is_done;
  IF v_pre_changed > 0 THEN RAISE EXCEPTION 'FATAL VERIFICATION: % pre-existing checklist row(s) overwritten.', v_pre_changed; END IF;

  IF v_ja IS NOT NULL THEN
    BEGIN
      v_parsed := CASE WHEN jsonb_typeof(v_ja) = 'string' THEN (v_ja #>> '{}')::jsonb ELSE v_ja END;
    EXCEPTION WHEN OTHERS THEN v_parsed := NULL;
    END;
    IF v_parsed IS NOT NULL AND jsonb_typeof(v_parsed) = 'object' THEN
      FOR b_key IN SELECT jsonb_object_keys(v_parsed) LOOP
        BEGIN b_uuid := b_key::uuid; EXCEPTION WHEN OTHERS THEN CONTINUE; END;
        IF EXISTS (SELECT 1 FROM public.flwdsk_batches WHERE id = b_uuid) AND jsonb_typeof(v_parsed -> b_key) = 'object' THEN
          FOR t_key IN SELECT jsonb_object_keys(v_parsed -> b_key) LOOP
            raw_t := (v_parsed -> b_key) -> t_key;
            IF jsonb_typeof(raw_t) NOT IN ('boolean','null') THEN CONTINUE; END IF;
            t_val := CASE WHEN jsonb_typeof(raw_t) = 'boolean' THEN (raw_t)::text::boolean ELSE FALSE END;
            v_exp_t := v_exp_t + 1;
            IF t_val THEN v_exp_d := v_exp_d + 1; END IF;
            -- Strict is_done match (never auto-passes contradictory pre-existing state)
            IF EXISTS (
              SELECT 1 FROM public.flwdsk_batch_checklist_items ci
              WHERE ci.batch_id = b_uuid AND ci.task_label = t_key AND ci.is_done = t_val
            ) THEN
              v_act_t := v_act_t + 1;
              IF t_val THEN v_act_d := v_act_d + 1; END IF;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
      IF v_exp_t <> v_act_t OR v_exp_d <> v_act_d THEN
        RAISE EXCEPTION 'FATAL VERIFICATION: Direction-1 checklist parity/completion mismatch (exp=%, act=%, exp_done=%, act_done=%).', v_exp_t, v_act_t, v_exp_d, v_act_d;
      END IF;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_extra_chk FROM public.flwdsk_batch_checklist_items ci
  WHERE NOT EXISTS (SELECT 1 FROM _pre_checklist_items pi WHERE pi.batch_id = ci.batch_id AND pi.task_label = ci.task_label)
    AND (v_parsed IS NULL OR NOT (v_parsed ? ci.batch_id::text) OR NOT ((v_parsed -> ci.batch_id::text) ? ci.task_label));
  IF v_extra_chk > 0 THEN RAISE EXCEPTION 'FATAL VERIFICATION: Direction-2 checklist parity failed (% unexpected rows).', v_extra_chk; END IF;

  SELECT COUNT(*) INTO v_orph_col FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_colleges c ON c.id = b.college_id WHERE b.college_id IS NOT NULL AND c.id IS NULL;
  SELECT COUNT(*) INTO v_orph_crs FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_courses  c ON c.id = b.course_id  WHERE b.course_id  IS NOT NULL AND c.id IS NULL;
  SELECT COUNT(*) INTO v_orph_exp FROM public.flwdsk_expense_claims e LEFT JOIN public.flwdsk_batches b ON b.id = e.batch_id WHERE e.batch_id IS NOT NULL AND b.id IS NULL;
  SELECT COUNT(*) INTO v_orph_ws  FROM public.flwdsk_work_sessions  w LEFT JOIN public.flwdsk_batches b ON b.id = w.batch_id WHERE w.batch_id IS NOT NULL AND b.id IS NULL;
  SELECT COUNT(*) INTO v_orph_chk FROM public.flwdsk_batch_checklist_items ci LEFT JOIN public.flwdsk_batches b ON b.id = ci.batch_id WHERE b.id IS NULL;
  IF v_orph_col > 0 OR v_orph_crs > 0 OR v_orph_exp > 0 OR v_orph_ws > 0 OR v_orph_chk > 0 THEN
    RAISE EXCEPTION 'FATAL VERIFICATION: Orphaned FK detected.';
  END IF;

  INSERT INTO _migration_report (section, item, status, details)
  VALUES ('8. Verification', 'Parity, checklist & FKs', 'OK',
    format('100%% parity; checklist %s/%s (%s/%s done, 0 unexpected); 0 orphaned FKs.', v_act_t, v_exp_t, v_act_d, v_exp_d));
END $$;

SELECT seq, section, item, status, details FROM _migration_report ORDER BY seq;

COMMIT;
