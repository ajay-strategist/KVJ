-- =============================================================================
-- Script 2: Additive Schema Migration (Idempotent, Zero Data Modification)
-- Target: Remote Supabase (KVJ-Alpha) via Supabase SQL Editor
-- Purpose:
--   1. Ensure flwdsk_batches.program and flwdsk_batches.college_id (FK -> flwdsk_colleges.id) exist
--   2. Add lookup & integration indexes
--   3. Create flwdsk_batch_migration_audit table
--   4. Create flwdsk_batch_checklist_items table + atomic toggle_batch_checklist_item RPC
--   5. Create flwdsk_batches_integration_v1 view
--   6. Enable Supabase Realtime on sync tables
-- =============================================================================

BEGIN;

-- 2.1 Ensure additive columns on flwdsk_batches (preserve existing legacy college TEXT column)
ALTER TABLE public.flwdsk_batches
  ADD COLUMN IF NOT EXISTS program TEXT;

ALTER TABLE public.flwdsk_batches
  ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.flwdsk_colleges(id) ON DELETE RESTRICT;

-- 2.2 Integration & query performance indexes
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_college_id ON public.flwdsk_batches(college_id);
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_course_id  ON public.flwdsk_batches(course_id);
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_updated_at ON public.flwdsk_batches(updated_at);
CREATE INDEX IF NOT EXISTS idx_flwdsk_batches_deleted_at ON public.flwdsk_batches(deleted_at);
CREATE INDEX IF NOT EXISTS idx_flwdsk_courses_updated_at ON public.flwdsk_courses(updated_at);
CREATE INDEX IF NOT EXISTS idx_flwdsk_colleges_updated_at ON public.flwdsk_colleges(updated_at);

-- 2.3 Migration Audit Table (logs unmatched/ambiguous colleges and duplicate batch codes)
CREATE TABLE IF NOT EXISTS public.flwdsk_batch_migration_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID,
  issue_type   TEXT NOT NULL, -- 'UNMATCHED_COLLEGE' | 'AMBIGUOUS_COLLEGE' | 'DUPLICATE_BATCH_CODE'
  raw_value    TEXT,
  details      JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flwdsk_batch_migration_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batch_migration_audit_admin ON public.flwdsk_batch_migration_audit;
CREATE POLICY batch_migration_audit_admin ON public.flwdsk_batch_migration_audit
  FOR ALL USING (public.is_training_admin()) WITH CHECK (public.is_training_admin());

-- 2.4 Normalized Batch Checklist Completion Table + Atomic Toggle RPC
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

ALTER TABLE public.flwdsk_batch_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batch_checklist_items_select ON public.flwdsk_batch_checklist_items;
CREATE POLICY batch_checklist_items_select ON public.flwdsk_batch_checklist_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS batch_checklist_items_write ON public.flwdsk_batch_checklist_items;
CREATE POLICY batch_checklist_items_write ON public.flwdsk_batch_checklist_items
  FOR ALL
  USING (public.is_training_admin() OR public.is_batch_trainer(batch_id) OR auth.uid() IS NOT NULL)
  WITH CHECK (public.is_training_admin() OR public.is_batch_trainer(batch_id) OR auth.uid() IS NOT NULL);

-- Atomic single-task toggle RPC: prevents concurrent whole-JSON overwrites
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
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.toggle_batch_checklist_item(UUID, TEXT, BOOLEAN, UUID, TEXT, TEXT, INTEGER) TO authenticated;

-- 2.5 Integration View (flwdsk_batches_integration_v1)
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

GRANT SELECT ON public.flwdsk_batches_integration_v1 TO authenticated;

-- 2.6 Enable Supabase Realtime on Sync Tables (Idempotent)
DO $$
DECLARE
  tbl TEXT;
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
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
