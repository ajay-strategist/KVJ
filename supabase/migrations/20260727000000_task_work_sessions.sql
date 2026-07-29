-- =============================================================================
-- Task Work Sessions — per-interval task time tracking (ADDITIVE)
--
-- Records one row for every Start → Pause/Submit interval a user works on a
-- task, so the Task Worklog can show a real Work Sessions timeline with start
-- time, end time, duration and a running/paused/completed status.
--
-- This is distinct from:
--   • work_sessions  — attendance clock-in/out (tied to attendance_records)
--   • timesheets     — aggregate hours per task per day
-- Neither captures individual work intervals, which is what this table adds.
--
-- Additive and idempotent: no existing table/column is changed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.task_work_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id     uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  employee_id    uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  supervisor_id  uuid REFERENCES public.employees(id) ON DELETE SET NULL,

  work_code      text,                       -- short code shown in the timeline (e.g. PBI)
  work_title     text NOT NULL,              -- the task / work name
  supervisor_name text,                      -- denormalised for office tasks with a free-text supervisor

  start_time     timestamptz NOT NULL DEFAULT now(),
  end_time       timestamptz,                -- null while running
  duration_minutes integer,                  -- filled when the session is closed

  -- 'running' while active, 'paused' when the user pauses, 'completed' when the
  -- task is submitted/finished. A single open (end_time IS NULL) session per
  -- user+task represents the current activity.
  status         text NOT NULL DEFAULT 'running',

  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  created_by     uuid REFERENCES public.employees(id),
  updated_by     uuid REFERENCES public.employees(id),
  deleted_at     timestamptz,
  deleted_by     uuid REFERENCES public.employees(id)
);

CREATE INDEX IF NOT EXISTS idx_task_sessions_employee ON public.task_work_sessions(employee_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_task_sessions_task     ON public.task_work_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_sessions_open     ON public.task_work_sessions(employee_id, task_id) WHERE end_time IS NULL AND deleted_at IS NULL;

ALTER TABLE public.task_work_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_work_sessions'
      AND policyname = 'Allow full access for authenticated users'
  ) THEN
    CREATE POLICY "Allow full access for authenticated users" ON public.task_work_sessions
      FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
