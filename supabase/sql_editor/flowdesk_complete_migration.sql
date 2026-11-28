-- =============================================================================
-- Flowdesk Complete Consolidated Migration Script (Revised)
-- File: flowdesk_complete_migration.sql
-- Target: Remote Supabase (KVJ-Alpha) via Supabase SQL Editor (Single Execution)
--
-- Mandatory Safety Guarantees:
--   - NO security/RLS modifications (zero ENABLE/DISABLE RLS, DROP/CREATE POLICY, GRANT)
--   - Checklist RPC uses SECURITY INVOKER (no SECURITY DEFINER authorization bypass)
--   - NO updates to existing flwdsk_batches.code values (preview/report only)
--   - NO DROP TABLE, TRUNCATE, DELETE FROM, or UUID regeneration
--   - Strict preflight validation of all referenced tables & columns
--   - Before/after parity verification of row counts, UUIDs, critical fields,
--     and legacy checklist JSONB
--   - Atomic transaction (BEGIN ... COMMIT): any critical failure rolls back all changes
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- STEP 0: Ephemeral Snapshot & Report Tables (Auto-dropped on COMMIT)
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _pre_migration_counts (
  table_name   TEXT PRIMARY KEY,
  total_rows   BIGINT NOT NULL,
  active_rows  BIGINT NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_batches_snapshot (
  id          UUID PRIMARY KEY,
  code        TEXT,
  college     TEXT,
  course_id   UUID,
  created_at  TIMESTAMPTZ
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_colleges_snapshot (
  id    UUID PRIMARY KEY,
  code  TEXT,
  name  TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_courses_snapshot (
  id     UUID PRIMARY KEY,
  code   TEXT,
  title  TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE _pre_checklist_json_snapshot (
  raw_value JSONB
) ON COMMIT DROP;

CREATE TEMP TABLE _migration_report (
  seq     INTEGER GENERATED ALWAYS AS IDENTITY,
  section TEXT NOT NULL,
  item    TEXT NOT NULL,
  status  TEXT NOT NULL,
  details TEXT
) ON COMMIT DROP;

-- -----------------------------------------------------------------------------
-- STEP 1: Preflight Validation of All Referenced Tables, Columns & UUIDs
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing_tables TEXT[];
  v_missing_cols   TEXT[];
BEGIN
  -- 1.1 Verify all referenced tables exist
  SELECT ARRAY_AGG(t)
  INTO v_missing_tables
  FROM UNNEST(ARRAY[
    'flwdsk_colleges',
    'flwdsk_courses',
    'flwdsk_batches',
    'flwdsk_system_settings',
    'flwdsk_employees',
    'flwdsk_attendance_records',
    'flwdsk_work_sessions',
    'flwdsk_travel_requests',
    'flwdsk_expense_claims',
    'flwdsk_student_records',
    'flwdsk_enrollments',
    'flwdsk_schedule_sessions',
    'flwdsk_assessments',
    'flwdsk_final_exam_results',
    'flwdsk_vouchers',
    'flwdsk_email_logs',
    'flwdsk_audit_logs'
  ]) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = t
  );

  IF v_missing_tables IS NOT NULL AND array_length(v_missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'FATAL PREFLIGHT: Missing required tables: %. Rolling back.', array_to_string(v_missing_tables, ', ');
  END IF;

  -- 1.2 Verify all required existing columns exist before referencing them
  WITH required_cols(tbl, col) AS (
    VALUES
      ('flwdsk_colleges', 'id'),
      ('flwdsk_colleges', 'code'),
      ('flwdsk_colleges', 'name'),
      ('flwdsk_colleges', 'location'),
      ('flwdsk_colleges', 'created_at'),
      ('flwdsk_colleges', 'updated_at'),
      ('flwdsk_colleges', 'deleted_at'),
      ('flwdsk_courses', 'id'),
      ('flwdsk_courses', 'code'),
      ('flwdsk_courses', 'title'),
      ('flwdsk_courses', 'checklist'),
      ('flwdsk_courses', 'created_at'),
      ('flwdsk_courses', 'updated_at'),
      ('flwdsk_courses', 'deleted_at'),
      ('flwdsk_batches', 'id'),
      ('flwdsk_batches', 'code'),
      ('flwdsk_batches', 'batch_no'),
      ('flwdsk_batches', 'academic_year'),
      ('flwdsk_batches', 'training_name'),
      ('flwdsk_batches', 'college'),
      ('flwdsk_batches', 'course_id'),
      ('flwdsk_batches', 'coordinator'),
      ('flwdsk_batches', 'coordinator_email'),
      ('flwdsk_batches', 'coordinator2'),
      ('flwdsk_batches', 'coordinator_email2'),
      ('flwdsk_batches', 'start_date'),
      ('flwdsk_batches', 'end_date'),
      ('flwdsk_batches', 'capacity'),
      ('flwdsk_batches', 'phase'),
      ('flwdsk_batches', 'completed_tasks'),
      ('flwdsk_batches', 'total_tasks'),
      ('flwdsk_batches', 'created_at'),
      ('flwdsk_batches', 'updated_at'),
      ('flwdsk_batches', 'deleted_at'),
      ('flwdsk_system_settings', 'key'),
      ('flwdsk_system_settings', 'value'),
      ('flwdsk_work_sessions', 'notes'),
      ('flwdsk_travel_requests', 'purpose'),
      ('flwdsk_expense_claims', 'notes')
  )
  SELECT ARRAY_AGG(rc.tbl || '.' || rc.col)
  INTO v_missing_cols
  FROM required_cols rc
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = rc.tbl
      AND c.column_name = rc.col
  );

  IF v_missing_cols IS NOT NULL AND array_length(v_missing_cols, 1) > 0 THEN
    RAISE EXCEPTION 'FATAL PREFLIGHT: Missing required columns: %. Rolling back.', array_to_string(v_missing_cols, ', ');
  END IF;

  -- 1.3 Verify every existing college, course, and batch already has a non-null UUID primary key
  IF EXISTS (SELECT 1 FROM public.flwdsk_colleges WHERE id IS NULL)
     OR EXISTS (SELECT 1 FROM public.flwdsk_courses WHERE id IS NULL)
     OR EXISTS (SELECT 1 FROM public.flwdsk_batches WHERE id IS NULL) THEN
    RAISE EXCEPTION 'FATAL PREFLIGHT: Found NULL UUID primary key in colleges, courses, or batches. Rolling back.';
  END IF;
END $$;

INSERT INTO _migration_report (section, item, status, details)
VALUES ('1. Preflight Checks', 'Tables, columns & UUIDs', 'OK', 'All 17 referenced tables, 39 required columns, and non-null UUID primary keys verified.');

-- Capture baseline ("BEFORE") row counts & critical field snapshots
INSERT INTO _pre_migration_counts (table_name, total_rows, active_rows)
SELECT 'flwdsk_colleges',           COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_colleges
UNION ALL SELECT 'flwdsk_courses',            COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_courses
UNION ALL SELECT 'flwdsk_batches',            COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_batches
UNION ALL SELECT 'flwdsk_student_records',    COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_student_records
UNION ALL SELECT 'flwdsk_enrollments',        COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_enrollments
UNION ALL SELECT 'flwdsk_schedule_sessions',  COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_schedule_sessions
UNION ALL SELECT 'flwdsk_assessments',        COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_assessments
UNION ALL SELECT 'flwdsk_final_exam_results', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_final_exam_results
UNION ALL SELECT 'flwdsk_vouchers',           COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_vouchers
UNION ALL SELECT 'flwdsk_employees',          COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_employees
UNION ALL SELECT 'flwdsk_attendance_records', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_attendance_records
UNION ALL SELECT 'flwdsk_work_sessions',      COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_work_sessions
UNION ALL SELECT 'flwdsk_travel_requests',    COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_travel_requests
UNION ALL SELECT 'flwdsk_expense_claims',     COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_expense_claims
UNION ALL SELECT 'flwdsk_email_logs',         COUNT(*), COUNT(*) FROM public.flwdsk_email_logs
UNION ALL SELECT 'flwdsk_audit_logs',         COUNT(*), COUNT(*) FROM public.flwdsk_audit_logs;

INSERT INTO _pre_batches_snapshot (id, code, college, course_id, created_at)
SELECT id, code, college, course_id, created_at FROM public.flwdsk_batches;

INSERT INTO _pre_colleges_snapshot (id, code, name)
SELECT id, code, name FROM public.flwdsk_colleges;

INSERT INTO _pre_courses_snapshot (id, code, title)
SELECT id, code, title FROM public.flwdsk_courses;

INSERT INTO _pre_checklist_json_snapshot (raw_value)
SELECT value::jsonb
FROM public.flwdsk_system_settings
WHERE key = 'batch_checklist_state'
LIMIT 1;

-- -----------------------------------------------------------------------------
-- STEP 2: Additive Schema Changes (No RLS / Policy / Grant Modifications)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flwdsk_batch_migration_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID,
  issue_type   TEXT NOT NULL, -- 'UNMATCHED_COLLEGE' | 'AMBIGUOUS_COLLEGE' | 'DUPLICATE_BATCH_CODE' | 'DUPLICATE_COLLEGE_CODE' | 'CODE_STANDARDIZATION_PREVIEW'
  raw_value    TEXT,
  details      JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure program and college_id exist on flwdsk_batches (preserve legacy college TEXT)
ALTER TABLE public.flwdsk_batches
  ADD COLUMN IF NOT EXISTS program TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'flwdsk_batches' AND column_name = 'college_id'
  ) THEN
    ALTER TABLE public.flwdsk_batches
      ADD COLUMN college_id UUID REFERENCES public.flwdsk_colleges(id) ON DELETE RESTRICT;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'flwdsk_batches'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'college_id'
  ) THEN
    ALTER TABLE public.flwdsk_batches
      ADD CONSTRAINT fk_flwdsk_batches_college_id
      FOREIGN KEY (college_id) REFERENCES public.flwdsk_colleges(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Pure SQL batch code formatting helpers (SECURITY INVOKER / IMMUTABLE)
CREATE OR REPLACE FUNCTION public.normalize_batch_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_code IS NULL THEN ''
    ELSE UPPER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(TRIM(p_code), '\s*-\s*', ' - ', 'g'),
        '\s+', ' ', 'g'
      )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.generate_standard_batch_code(
  p_college_code  TEXT,
  p_program       TEXT,
  p_academic_year TEXT,
  p_batch_no      TEXT,
  p_course_code   TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CONCAT_WS(
    ' - ',
    NULLIF(UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_college_code, '')),  '\s+', ' ', 'g')), ''),
    NULLIF(UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_program, '')),       '\s+', ' ', 'g')), ''),
    NULLIF(UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_academic_year, '')), '\s+', ' ', 'g')), ''),
    NULLIF(UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_batch_no, '')),      '\s+', ' ', 'g')), ''),
    NULLIF(UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_course_code, '')),   '\s+', ' ', 'g')), '')
  );
$$;

-- -----------------------------------------------------------------------------
-- STEP 3: Duplicate College Code Detection & Safe Index Guard
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  dup RECORD;
  v_dup_count INTEGER := 0;
BEGIN
  FOR dup IN
    SELECT UPPER(TRIM(code)) AS norm_code, ARRAY_AGG(id ORDER BY created_at) AS college_ids, COUNT(*) AS cnt
    FROM public.flwdsk_colleges
    WHERE deleted_at IS NULL
      AND code IS NOT NULL
      AND TRIM(code) <> ''
    GROUP BY UPPER(TRIM(code))
    HAVING COUNT(*) > 1
  LOOP
    v_dup_count := v_dup_count + 1;
    IF NOT EXISTS (
      SELECT 1 FROM public.flwdsk_batch_migration_audit
      WHERE issue_type = 'DUPLICATE_COLLEGE_CODE'
        AND raw_value = dup.norm_code
        AND resolved = FALSE
    ) THEN
      INSERT INTO public.flwdsk_batch_migration_audit (batch_id, issue_type, raw_value, details)
      VALUES (
        dup.college_ids[1],
        'DUPLICATE_COLLEGE_CODE',
        dup.norm_code,
        jsonb_build_object('college_ids', dup.college_ids, 'count', dup.cnt)
      );
    END IF;
  END LOOP;

  IF v_dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_flwdsk_colleges_code_unique
      ON public.flwdsk_colleges (UPPER(TRIM(code)))
      WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> '';
    INSERT INTO _migration_report (section, item, status, details)
    VALUES ('2. College Code Check', 'Duplicate active college codes', 'OK', 'Zero duplicates; idx_flwdsk_colleges_code_unique ensured.');
  ELSE
    RAISE NOTICE 'WARNING: % duplicate active college code group(s) logged to flwdsk_batch_migration_audit. Skipping idx_flwdsk_colleges_code_unique.', v_dup_count;
    INSERT INTO _migration_report (section, item, status, details)
    VALUES ('2. College Code Check', 'Duplicate active college codes', 'WARNING', format('%s duplicate group(s) logged; unique index skipped.', v_dup_count));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 4: Safe College UUID Backfill (Unambiguous Matches Only)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
  match_count INTEGER;
  matched_college_id UUID;
  v_mapped INTEGER := 0;
  v_unmatched INTEGER := 0;
  v_ambiguous INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT id, college
    FROM public.flwdsk_batches
    WHERE college_id IS NULL
      AND college IS NOT NULL
      AND TRIM(college) <> ''
      AND TRIM(college) <> '—'
  LOOP
    SELECT COUNT(*), MIN(c.id)
    INTO match_count, matched_college_id
    FROM public.flwdsk_colleges c
    WHERE c.deleted_at IS NULL
      AND (
        LOWER(TRIM(c.name)) = LOWER(TRIM(rec.college))
        OR LOWER(TRIM(c.code)) = LOWER(TRIM(rec.college))
      );

    IF match_count = 1 THEN
      UPDATE public.flwdsk_batches
      SET college_id = matched_college_id
      WHERE id = rec.id
        AND college_id IS NULL;
      v_mapped := v_mapped + 1;
    ELSIF match_count = 0 THEN
      v_unmatched := v_unmatched + 1;
      IF NOT EXISTS (
        SELECT 1 FROM public.flwdsk_batch_migration_audit
        WHERE batch_id = rec.id AND issue_type = 'UNMATCHED_COLLEGE' AND resolved = FALSE
      ) THEN
        INSERT INTO public.flwdsk_batch_migration_audit (batch_id, issue_type, raw_value, details)
        VALUES (
          rec.id,
          'UNMATCHED_COLLEGE',
          rec.college,
          jsonb_build_object('reason', 'No active college matched by name or code')
        );
      END IF;
    ELSE
      v_ambiguous := v_ambiguous + 1;
      IF NOT EXISTS (
        SELECT 1 FROM public.flwdsk_batch_migration_audit
        WHERE batch_id = rec.id AND issue_type = 'AMBIGUOUS_COLLEGE' AND resolved = FALSE
      ) THEN
        INSERT INTO public.flwdsk_batch_migration_audit (batch_id, issue_type, raw_value, details)
        VALUES (
          rec.id,
          'AMBIGUOUS_COLLEGE',
          rec.college,
          jsonb_build_object('match_count', match_count)
        );
      END IF;
    END IF;
  END LOOP;

  INSERT INTO _migration_report (section, item, status, details)
  VALUES (
    '3. College UUID Backfill',
    'flwdsk_batches.college_id',
    CASE WHEN v_unmatched = 0 AND v_ambiguous = 0 THEN 'OK' ELSE 'WARNING' END,
    format('Newly mapped: %s, Unmatched logged: %s, Ambiguous logged: %s (legacy college TEXT preserved).', v_mapped, v_unmatched, v_ambiguous)
  );
END $$;

-- -----------------------------------------------------------------------------
-- STEP 5: Course Relationship Validation
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_orphaned_courses INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_orphaned_courses
  FROM public.flwdsk_batches b
  LEFT JOIN public.flwdsk_courses c ON c.id = b.course_id
  WHERE b.course_id IS NOT NULL AND c.id IS NULL;

  IF v_orphaned_courses > 0 THEN
    RAISE EXCEPTION 'FATAL: Found % batch(es) with orphaned course_id not present in flwdsk_courses. Rolling back.', v_orphaned_courses;
  END IF;

  INSERT INTO _migration_report (section, item, status, details)
  VALUES ('4. Course Validation', 'flwdsk_batches.course_id FK', 'OK', 'Zero orphaned course_id references.');
END $$;

-- -----------------------------------------------------------------------------
-- STEP 6: Batch Code Duplicate Detection & Preview-Only 5-Part Report
--         (NEVER updates existing flwdsk_batches.code values)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  dup RECORD;
  rec RECORD;
  v_dup_count INTEGER := 0;
  v_preview_diff INTEGER := 0;
  v_preview_colliding INTEGER := 0;
  v_candidate TEXT;
  v_text_refs INTEGER;
  v_collides BOOLEAN;
BEGIN
  -- 6.1 Detect existing duplicate active batch codes
  FOR dup IN
    SELECT UPPER(TRIM(code)) AS norm_code, ARRAY_AGG(id ORDER BY created_at) AS batch_ids, COUNT(*) AS cnt
    FROM public.flwdsk_batches
    WHERE deleted_at IS NULL
      AND code IS NOT NULL
      AND TRIM(code) <> ''
    GROUP BY UPPER(TRIM(code))
    HAVING COUNT(*) > 1
  LOOP
    v_dup_count := v_dup_count + 1;
    IF NOT EXISTS (
      SELECT 1 FROM public.flwdsk_batch_migration_audit
      WHERE issue_type = 'DUPLICATE_BATCH_CODE'
        AND raw_value = dup.norm_code
        AND resolved = FALSE
    ) THEN
      INSERT INTO public.flwdsk_batch_migration_audit (batch_id, issue_type, raw_value, details)
      VALUES (
        dup.batch_ids[1],
        'DUPLICATE_BATCH_CODE',
        dup.norm_code,
        jsonb_build_object('batch_ids', dup.batch_ids, 'count', dup.cnt)
      );
    END IF;
  END LOOP;

  -- 6.2 Preview proposed 5-part codes & dependent text references WITHOUT modifying flwdsk_batches.code
  FOR rec IN
    SELECT
      b.id,
      b.code AS old_code,
      COALESCE(col.code, b.college) AS college_seg,
      b.program,
      b.academic_year,
      b.batch_no,
      crs.code AS course_code
    FROM public.flwdsk_batches b
    LEFT JOIN public.flwdsk_colleges col ON col.id = b.college_id
    LEFT JOIN public.flwdsk_courses  crs ON crs.id = b.course_id
    WHERE b.deleted_at IS NULL
  LOOP
    v_candidate := public.generate_standard_batch_code(
      rec.college_seg,
      rec.program,
      rec.academic_year,
      rec.batch_no,
      rec.course_code
    );

    IF rec.old_code IS DISTINCT FROM v_candidate AND NULLIF(v_candidate, '') IS NOT NULL THEN
      v_preview_diff := v_preview_diff + 1;

      SELECT EXISTS (
        SELECT 1 FROM public.flwdsk_batches other
        WHERE other.id <> rec.id
          AND other.deleted_at IS NULL
          AND public.normalize_batch_code(other.code) = v_candidate
      ) INTO v_collides;

      IF v_collides THEN
        v_preview_colliding := v_preview_colliding + 1;
      END IF;

      v_text_refs := 0;
      IF NULLIF(TRIM(COALESCE(rec.old_code, '')), '') IS NOT NULL THEN
        SELECT
          (SELECT COUNT(*) FROM public.flwdsk_work_sessions ws WHERE ws.notes ILIKE '%' || rec.old_code || '%') +
          (SELECT COUNT(*) FROM public.flwdsk_travel_requests tr WHERE tr.purpose ILIKE '%' || rec.old_code || '%') +
          (SELECT COUNT(*) FROM public.flwdsk_expense_claims ec WHERE ec.notes ILIKE '%' || rec.old_code || '%')
        INTO v_text_refs;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.flwdsk_batch_migration_audit
        WHERE batch_id = rec.id AND issue_type = 'CODE_STANDARDIZATION_PREVIEW' AND resolved = FALSE
      ) THEN
        INSERT INTO public.flwdsk_batch_migration_audit (batch_id, issue_type, raw_value, details)
        VALUES (
          rec.id,
          'CODE_STANDARDIZATION_PREVIEW',
          rec.old_code,
          jsonb_build_object(
            'proposed_5part_code', v_candidate,
            'collides_with_existing', v_collides,
            'dependent_text_references', v_text_refs
          )
        );
      END IF;
    END IF;
  END LOOP;

  IF v_dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_flwdsk_batches_code_unique
      ON public.flwdsk_batches (UPPER(TRIM(code)))
      WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> '';
    INSERT INTO _migration_report (section, item, status, details)
    VALUES (
      '5. Batch Code Safety',
      'Duplicate check & 5-part preview',
      CASE WHEN v_preview_diff = 0 THEN 'OK' ELSE 'WARNING' END,
      format('0 active duplicates (idx_flwdsk_batches_code_unique ensured). %s batch(es) differ from 5-part preview (%s candidate collisions); all existing codes preserved untouched.', v_preview_diff, v_preview_colliding)
    );
  ELSE
    RAISE NOTICE 'WARNING: % duplicate active batch code group(s) detected and logged. Skipping idx_flwdsk_batches_code_unique.', v_dup_count;
    INSERT INTO _migration_report (section, item, status, details)
    VALUES (
      '5. Batch Code Safety',
      'Duplicate check & 5-part preview',
      'WARNING',
      format('%s duplicate active code group(s) logged; unique index skipped. %s batch(es) differ from 5-part preview; all existing codes preserved untouched.', v_dup_count, v_preview_diff)
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 7 & 8: Checklist Table Creation, JSONB Backfill & SECURITY INVOKER RPC
--             (Zero RLS/GRANT modifications)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flwdsk_batch_checklist_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          UUID NOT NULL REFERENCES public.flwdsk_batches(id) ON DELETE CASCADE,
  task_label        TEXT NOT NULL,
  is_done           BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by      UUID,
  completed_by_name TEXT,
  completed_at      TIMESTAMPTZ,
  source_app        TEXT NOT NULL DEFAULT 'flowdesk',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_flwdsk_batch_checklist_item UNIQUE (batch_id, task_label)
);

CREATE INDEX IF NOT EXISTS idx_batch_checklist_batch_id
  ON public.flwdsk_batch_checklist_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_checklist_updated_at
  ON public.flwdsk_batch_checklist_items(updated_at);

-- Backfill from legacy flwdsk_system_settings('batch_checklist_state') preserving original JSONB
DO $$
DECLARE
  raw_val JSONB;
  b_key TEXT;
  t_key TEXT;
  t_val BOOLEAN;
  b_uuid UUID;
  v_inserted INTEGER := 0;
BEGIN
  SELECT
    CASE
      WHEN jsonb_typeof(value::jsonb) = 'string' THEN (value #>> '{}')::jsonb
      ELSE value::jsonb
    END
  INTO raw_val
  FROM public.flwdsk_system_settings
  WHERE key = 'batch_checklist_state'
  LIMIT 1;

  IF raw_val IS NOT NULL AND jsonb_typeof(raw_val) = 'object' THEN
    FOR b_key IN SELECT jsonb_object_keys(raw_val) LOOP
      BEGIN
        b_uuid := b_key::uuid;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;

      IF EXISTS (SELECT 1 FROM public.flwdsk_batches WHERE id = b_uuid) THEN
        FOR t_key IN SELECT jsonb_object_keys(raw_val -> b_key) LOOP
          t_val := COALESCE((raw_val -> b_key ->> t_key)::boolean, FALSE);
          INSERT INTO public.flwdsk_batch_checklist_items (batch_id, task_label, is_done, source_app)
          VALUES (b_uuid, t_key, t_val, 'flowdesk_migration')
          ON CONFLICT (batch_id, task_label) DO NOTHING;
          IF FOUND THEN
            v_inserted := v_inserted + 1;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO _migration_report (section, item, status, details)
  VALUES ('6. Checklist Migration', 'flwdsk_batch_checklist_items backfill', 'OK', format('Newly migrated checklist items: %s (legacy JSONB preserved untouched).', v_inserted));
END $$;

-- Atomic single-task toggle RPC using SECURITY INVOKER (respects caller's existing RLS/privileges)
CREATE OR REPLACE FUNCTION public.toggle_batch_checklist_item(
  p_batch_id    UUID,
  p_task_label  TEXT,
  p_is_done     BOOLEAN,
  p_actor_id    UUID DEFAULT NULL,
  p_actor_name  TEXT DEFAULT NULL,
  p_source_app  TEXT DEFAULT 'flowdesk',
  p_total_tasks INTEGER DEFAULT NULL
)
RETURNS public.flwdsk_batch_checklist_items
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.flwdsk_batch_checklist_items;
  v_done_count INTEGER;
  v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO public.flwdsk_batch_checklist_items (
    batch_id,
    task_label,
    is_done,
    completed_by,
    completed_by_name,
    completed_at,
    source_app,
    updated_at
  )
  VALUES (
    p_batch_id,
    p_task_label,
    p_is_done,
    COALESCE(p_actor_id, auth.uid()),
    p_actor_name,
    CASE WHEN p_is_done THEN v_now ELSE NULL END,
    COALESCE(NULLIF(TRIM(p_source_app), ''), 'flowdesk'),
    v_now
  )
  ON CONFLICT (batch_id, task_label) DO UPDATE
  SET
    is_done           = EXCLUDED.is_done,
    completed_by      = COALESCE(EXCLUDED.completed_by, flwdsk_batch_checklist_items.completed_by),
    completed_by_name = COALESCE(EXCLUDED.completed_by_name, flwdsk_batch_checklist_items.completed_by_name),
    completed_at      = CASE WHEN EXCLUDED.is_done THEN v_now ELSE NULL END,
    source_app        = EXCLUDED.source_app,
    updated_at        = v_now
  RETURNING * INTO v_row;

  SELECT COUNT(*)::INTEGER
  INTO v_done_count
  FROM public.flwdsk_batch_checklist_items
  WHERE batch_id = p_batch_id AND is_done = TRUE;

  UPDATE public.flwdsk_batches
  SET
    completed_tasks = v_done_count,
    total_tasks     = COALESCE(p_total_tasks, total_tasks),
    updated_at      = v_now
  WHERE id = p_batch_id;

  RETURN v_row;
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 9 & 10: Integration View & Required Indexes (No GRANT modifications)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_college_id ON public.flwdsk_batches(college_id);
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_course_id  ON public.flwdsk_batches(course_id);
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_updated_at ON public.flwdsk_batches(updated_at);
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_deleted_at ON public.flwdsk_batches(deleted_at);
CREATE INDEX IF NOT EXISTS idx_flwdsk_courses_updated_at ON public.flwdsk_courses(updated_at);
CREATE INDEX IF NOT EXISTS idx_flwdsk_colleges_updated_at ON public.flwdsk_colleges(updated_at);

CREATE OR REPLACE VIEW public.flwdsk_batches_integration_v1 AS
SELECT
  b.id,
  b.code                AS batch_code,
  b.batch_no,
  b.program,
  b.academic_year,
  b.training_name,
  b.start_date,
  b.end_date,
  b.capacity,
  b.phase,
  b.coordinator,
  b.coordinator_email,
  b.coordinator2,
  b.coordinator_email2,
  b.completed_tasks,
  b.total_tasks,
  b.college_id,
  b.college             AS college_name_legacy,
  col.code              AS college_code,
  col.name              AS college_name,
  col.location          AS college_location,
  b.course_id,
  crs.code              AS course_code,
  crs.title             AS course_title,
  crs.checklist         AS course_checklist_template,
  b.created_at,
  b.updated_at,
  b.deleted_at
FROM public.flwdsk_batches b
LEFT JOIN public.flwdsk_colleges col ON col.id = b.college_id
LEFT JOIN public.flwdsk_courses  crs ON crs.id = b.course_id;

INSERT INTO _migration_report (section, item, status, details)
VALUES ('7. Integration View & Indexes', 'flwdsk_batches_integration_v1', 'OK', 'View and 6 lookup/sync indexes ensured.');

-- -----------------------------------------------------------------------------
-- STEP 11: Supabase Realtime Publication Configuration (Idempotent)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  v_added INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY[
      'flwdsk_batches',
      'flwdsk_courses',
      'flwdsk_colleges',
      'flwdsk_batch_checklist_items'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        v_added := v_added + 1;
      END IF;
    END LOOP;
    INSERT INTO _migration_report (section, item, status, details)
    VALUES ('8. Realtime Publication', 'supabase_realtime', 'OK', format('Added %s new table(s) to supabase_realtime.', v_added));
  ELSE
    INSERT INTO _migration_report (section, item, status, details)
    VALUES ('8. Realtime Publication', 'supabase_realtime', 'WARNING', 'Publication supabase_realtime not found; skipped.');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 12: Post-Migration Verification (Row Counts, IDs, Critical Fields & Checklist Parity)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_post RECORD;
  v_changed_batches   INTEGER;
  v_changed_colleges  INTEGER;
  v_changed_courses   INTEGER;
  v_orphaned_college  INTEGER;
  v_orphaned_course   INTEGER;
  v_orphaned_chk      INTEGER;
  v_legacy_json_after JSONB;
  v_legacy_json_before JSONB;
  v_parsed_json       JSONB;
  v_expected_tasks    INTEGER := 0;
  v_expected_done     INTEGER := 0;
  v_actual_matched    INTEGER := 0;
  v_actual_done_match INTEGER := 0;
  b_key TEXT;
  t_key TEXT;
  b_uuid UUID;
  t_val BOOLEAN;
  v_view_count BIGINT;
BEGIN
  -- 12.1 Row-count parity across all 16 preserved tables
  FOR v_post IN
    WITH post_counts AS (
      SELECT 'flwdsk_colleges' AS table_name, COUNT(*) AS total_rows, COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_rows FROM public.flwdsk_colleges
      UNION ALL SELECT 'flwdsk_courses',            COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_courses
      UNION ALL SELECT 'flwdsk_batches',            COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_batches
      UNION ALL SELECT 'flwdsk_student_records',    COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_student_records
      UNION ALL SELECT 'flwdsk_enrollments',        COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_enrollments
      UNION ALL SELECT 'flwdsk_schedule_sessions',  COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_schedule_sessions
      UNION ALL SELECT 'flwdsk_assessments',        COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_assessments
      UNION ALL SELECT 'flwdsk_final_exam_results', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_final_exam_results
      UNION ALL SELECT 'flwdsk_vouchers',           COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_vouchers
      UNION ALL SELECT 'flwdsk_employees',          COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_employees
      UNION ALL SELECT 'flwdsk_attendance_records', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_attendance_records
      UNION ALL SELECT 'flwdsk_work_sessions',      COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_work_sessions
      UNION ALL SELECT 'flwdsk_travel_requests',    COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_travel_requests
      UNION ALL SELECT 'flwdsk_expense_claims',     COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM public.flwdsk_expense_claims
      UNION ALL SELECT 'flwdsk_email_logs',         COUNT(*), COUNT(*) FROM public.flwdsk_email_logs
      UNION ALL SELECT 'flwdsk_audit_logs',         COUNT(*), COUNT(*) FROM public.flwdsk_audit_logs
    )
    SELECT
      pre.table_name,
      pre.total_rows  AS before_total,
      post.total_rows AS after_total,
      pre.active_rows AS before_active,
      post.active_rows AS after_active
    FROM _pre_migration_counts pre
    JOIN post_counts post ON post.table_name = pre.table_name
  LOOP
    IF v_post.before_total <> v_post.after_total OR v_post.before_active <> v_post.after_active THEN
      RAISE EXCEPTION 'FATAL VERIFICATION: Row count mismatch on % (before=%, after=%). Rolling back!',
        v_post.table_name, v_post.before_total, v_post.after_total;
    END IF;
  END LOOP;

  -- 12.2 Verify existing UUIDs & critical fields (code, college, course_id, created_at) are unchanged
  SELECT COUNT(*) INTO v_changed_batches
  FROM _pre_batches_snapshot pre
  FULL OUTER JOIN public.flwdsk_batches cur ON cur.id = pre.id
  WHERE pre.id IS NULL
     OR cur.id IS NULL
     OR cur.code IS DISTINCT FROM pre.code
     OR cur.college IS DISTINCT FROM pre.college
     OR cur.course_id IS DISTINCT FROM pre.course_id
     OR cur.created_at IS DISTINCT FROM pre.created_at;

  SELECT COUNT(*) INTO v_changed_colleges
  FROM _pre_colleges_snapshot pre
  FULL OUTER JOIN public.flwdsk_colleges cur ON cur.id = pre.id
  WHERE pre.id IS NULL OR cur.id IS NULL OR cur.code IS DISTINCT FROM pre.code OR cur.name IS DISTINCT FROM pre.name;

  SELECT COUNT(*) INTO v_changed_courses
  FROM _pre_courses_snapshot pre
  FULL OUTER JOIN public.flwdsk_courses cur ON cur.id = pre.id
  WHERE pre.id IS NULL OR cur.id IS NULL OR cur.code IS DISTINCT FROM pre.code OR cur.title IS DISTINCT FROM pre.title;

  IF v_changed_batches > 0 OR v_changed_colleges > 0 OR v_changed_courses > 0 THEN
    RAISE EXCEPTION 'FATAL VERIFICATION: Existing UUIDs or critical fields altered (batches=%, colleges=%, courses=%). Rolling back!',
      v_changed_batches, v_changed_colleges, v_changed_courses;
  END IF;

  -- 12.3 Verify legacy checklist JSONB is untouched and migrated checklist parity holds
  SELECT raw_value INTO v_legacy_json_before FROM _pre_checklist_json_snapshot LIMIT 1;
  SELECT value::jsonb INTO v_legacy_json_after FROM public.flwdsk_system_settings WHERE key = 'batch_checklist_state' LIMIT 1;

  IF v_legacy_json_before IS DISTINCT FROM v_legacy_json_after THEN
    RAISE EXCEPTION 'FATAL VERIFICATION: Legacy batch_checklist_state JSONB was modified. Rolling back!';
  END IF;

  IF v_legacy_json_after IS NOT NULL THEN
    v_parsed_json := CASE
      WHEN jsonb_typeof(v_legacy_json_after) = 'string' THEN (v_legacy_json_after #>> '{}')::jsonb
      ELSE v_legacy_json_after
    END;

    IF jsonb_typeof(v_parsed_json) = 'object' THEN
      FOR b_key IN SELECT jsonb_object_keys(v_parsed_json) LOOP
        BEGIN
          b_uuid := b_key::uuid;
        EXCEPTION WHEN OTHERS THEN
          CONTINUE;
        END;
        IF EXISTS (SELECT 1 FROM public.flwdsk_batches WHERE id = b_uuid) THEN
          FOR t_key IN SELECT jsonb_object_keys(v_parsed_json -> b_key) LOOP
            t_val := COALESCE((v_parsed_json -> b_key ->> t_key)::boolean, FALSE);
            v_expected_tasks := v_expected_tasks + 1;
            IF t_val THEN
              v_expected_done := v_expected_done + 1;
            END IF;
            IF EXISTS (
              SELECT 1 FROM public.flwdsk_batch_checklist_items ci
              WHERE ci.batch_id = b_uuid AND ci.task_label = t_key
            ) THEN
              v_actual_matched := v_actual_matched + 1;
            END IF;
            IF t_val AND EXISTS (
              SELECT 1 FROM public.flwdsk_batch_checklist_items ci
              WHERE ci.batch_id = b_uuid AND ci.task_label = t_key AND ci.is_done = TRUE
            ) THEN
              v_actual_done_match := v_actual_done_match + 1;
            END IF;
          END LOOP;
        END IF;
      END LOOP;

      IF v_expected_tasks <> v_actual_matched OR v_expected_done <> v_actual_done_match THEN
        RAISE EXCEPTION 'FATAL VERIFICATION: Checklist parity failed (expected_tasks=%, matched=%, expected_done=%, done_matched=%). Rolling back!',
          v_expected_tasks, v_actual_matched, v_expected_done, v_actual_done_match;
      END IF;
    END IF;
  END IF;

  -- 12.4 Verify zero orphaned foreign keys
  SELECT COUNT(*) INTO v_orphaned_college FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_colleges c ON c.id = b.college_id WHERE b.college_id IS NOT NULL AND c.id IS NULL;
  SELECT COUNT(*) INTO v_orphaned_course  FROM public.flwdsk_batches b LEFT JOIN public.flwdsk_courses  c ON c.id = b.course_id  WHERE b.course_id  IS NOT NULL AND c.id IS NULL;
  SELECT COUNT(*) INTO v_orphaned_chk     FROM public.flwdsk_batch_checklist_items ci LEFT JOIN public.flwdsk_batches b ON b.id = ci.batch_id WHERE b.id IS NULL;

  IF v_orphaned_college > 0 OR v_orphaned_course > 0 OR v_orphaned_chk > 0 THEN
    RAISE EXCEPTION 'FATAL VERIFICATION: Orphaned FK detected (college=%, course=%, checklist=%). Rolling back!',
      v_orphaned_college, v_orphaned_course, v_orphaned_chk;
  END IF;

  SELECT COUNT(*) INTO v_view_count FROM public.flwdsk_batches_integration_v1;

  INSERT INTO _migration_report (section, item, status, details)
  VALUES
    ('9. Post-Migration Verification', 'Row counts & critical fields', 'OK', '100% parity across all 16 preserved tables; zero UUIDs or legacy codes/colleges altered.'),
    ('9. Post-Migration Verification', 'Checklist parity', 'OK', format('Verified %s/%s legacy checklist tasks (%s/%s completed) in flwdsk_batch_checklist_items; legacy JSONB untouched.', v_actual_matched, v_expected_tasks, v_actual_done_match, v_expected_done)),
    ('9. Post-Migration Verification', 'FKs & integration view', 'OK', format('Zero orphaned FKs; flwdsk_batches_integration_v1 exposes %s row(s).', v_view_count));
END $$;

-- -----------------------------------------------------------------------------
-- STEP 13: Final Migration Summary Output
-- -----------------------------------------------------------------------------
SELECT seq, section, item, status, details
FROM _migration_report
ORDER BY seq;

COMMIT;
