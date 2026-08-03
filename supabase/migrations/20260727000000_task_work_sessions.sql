-- =============================================================================
-- Task Work Sessions — per-interval task time tracking (ADDITIVE)
-- Uses the flwdsk_ table prefix to match the rest of the database and the app.
-- Records one row per Start → Pause/Submit interval so the Task Worklog can show
-- a real Work Sessions timeline (start/end/duration/status).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.flwdsk_task_work_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          uuid,
  project_id       uuid,
  employee_id      uuid,
  supervisor_id    uuid,
  work_code        text,
  work_title       text NOT NULL,
  supervisor_name  text,
  start_time       timestamptz NOT NULL DEFAULT now(),
  end_time         timestamptz,
  duration_minutes integer,
  status           text NOT NULL DEFAULT 'running',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  created_by       uuid,
  updated_by       uuid,
  deleted_at       timestamptz,
  deleted_by       uuid
);

CREATE INDEX IF NOT EXISTS idx_flwdsk_task_sessions_employee ON public.flwdsk_task_work_sessions(employee_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_flwdsk_task_sessions_task     ON public.flwdsk_task_work_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_flwdsk_task_sessions_open     ON public.flwdsk_task_work_sessions(employee_id, task_id) WHERE end_time IS NULL AND deleted_at IS NULL;

ALTER TABLE public.flwdsk_task_work_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='flwdsk_task_work_sessions'
      AND policyname='Allow full access for authenticated users'
  ) THEN
    CREATE POLICY "Allow full access for authenticated users" ON public.flwdsk_task_work_sessions
      FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
