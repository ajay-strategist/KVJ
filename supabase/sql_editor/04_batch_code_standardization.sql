-- =============================================================================
-- Script 4: Batch Code Standardization & Uniqueness Guards
-- Target: Remote Supabase (KVJ-Alpha) via Supabase SQL Editor
-- Purpose:
--   1. Create SQL normalization/generation helpers matching frontend TypeScript
--   2. Detect duplicate active batch codes (never deletes rows)
--   3. Check text-based references in work_sessions/travel/expense notes
--   4. Create partial unique indexes ONLY when zero active duplicates exist
-- =============================================================================

BEGIN;

-- 4.1 Centralized SQL batch code normalization helper (mirrors normalizeBatchCode)
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

-- 4.2 Centralized 5-part batch code generator (mirrors generateStandardBatchCode)
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

-- 4.3 Detect duplicate active Batch Codes and log to flwdsk_batch_migration_audit
DO $$
DECLARE
  dup RECORD;
  has_dups BOOLEAN := FALSE;
BEGIN
  FOR dup IN
    SELECT UPPER(TRIM(code)) AS norm_code, ARRAY_AGG(id ORDER BY created_at) AS batch_ids, COUNT(*) AS cnt
    FROM public.flwdsk_batches
    WHERE deleted_at IS NULL
      AND code IS NOT NULL
      AND TRIM(code) <> ''
    GROUP BY UPPER(TRIM(code))
    HAVING COUNT(*) > 1
  LOOP
    has_dups := TRUE;
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

  IF NOT has_dups THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_flwdsk_batches_code_unique
      ON public.flwdsk_batches (UPPER(TRIM(code)))
      WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> '';
  ELSE
    RAISE NOTICE 'Duplicate active batch codes detected and logged to flwdsk_batch_migration_audit. Resolve duplicates before creating idx_flwdsk_batches_code_unique.';
  END IF;
END $$;

-- 4.4 Enforce normalized College Code uniqueness for active colleges
CREATE UNIQUE INDEX IF NOT EXISTS idx_flwdsk_colleges_code_unique
  ON public.flwdsk_colleges (UPPER(TRIM(code)))
  WHERE deleted_at IS NULL AND code IS NOT NULL AND TRIM(code) <> '';

COMMIT;

-- 4.5 READ-ONLY Diagnostic: Preview batches that differ from normalized 5-part format
--     and check if their legacy code is referenced in work_sessions/travel_requests/expense_claims notes.
--     Review this output before deciding to backfill legacy 3-part codes to 5-part codes.
SELECT
  b.id AS batch_id,
  b.code AS current_code,
  public.generate_standard_batch_code(
    COALESCE(col.code, b.college),
    b.program,
    b.academic_year,
    b.batch_no,
    crs.code
  ) AS candidate_5part_code,
  (SELECT COUNT(*) FROM public.flwdsk_work_sessions ws WHERE ws.notes ILIKE '%' || b.code || '%') AS work_session_text_refs,
  (SELECT COUNT(*) FROM public.flwdsk_travel_requests tr WHERE tr.purpose ILIKE '%' || b.code || '%') AS travel_text_refs,
  (SELECT COUNT(*) FROM public.flwdsk_expense_claims ec WHERE ec.notes ILIKE '%' || b.code || '%') AS expense_text_refs
FROM public.flwdsk_batches b
LEFT JOIN public.flwdsk_colleges col ON col.id = b.college_id
LEFT JOIN public.flwdsk_courses  crs ON crs.id = b.course_id
WHERE b.deleted_at IS NULL
  AND b.code IS DISTINCT FROM public.generate_standard_batch_code(
    COALESCE(col.code, b.college),
    b.program,
    b.academic_year,
    b.batch_no,
    crs.code
  )
ORDER BY b.created_at DESC;
