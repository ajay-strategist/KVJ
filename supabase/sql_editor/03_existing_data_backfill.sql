-- =============================================================================
-- Script 3: Existing Data Backfill (Safe, Idempotent, Non-Destructive)
-- Target: Remote Supabase (KVJ-Alpha) via Supabase SQL Editor
-- Purpose:
--   1. Populate flwdsk_batches.college_id ONLY when exactly 1 active college matches
--   2. Log unmatched/ambiguous colleges into flwdsk_batch_migration_audit
--   3. Migrate legacy flwdsk_system_settings('batch_checklist_state') JSONB into
--      flwdsk_batch_checklist_items without deleting or altering the legacy JSONB
-- =============================================================================

BEGIN;

-- 3.1 Unambiguous College UUID backfill (never guesses when match_count <> 1)
DO $$
DECLARE
  rec RECORD;
  match_count INTEGER;
  matched_college_id UUID;
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
    ELSIF match_count = 0 THEN
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
END $$;

-- 3.2 Backfill checklist completion states from legacy flwdsk_system_settings('batch_checklist_state')
--     Preserves the legacy JSONB row untouched.
DO $$
DECLARE
  raw_val JSONB;
  b_key TEXT;
  t_key TEXT;
  t_val BOOLEAN;
  b_uuid UUID;
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
        END LOOP;
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
