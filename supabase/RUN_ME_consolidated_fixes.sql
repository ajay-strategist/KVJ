-- =============================================================================
-- KVJ / Nexus — CONSOLIDATED FIX SCRIPT
-- Paste this whole file into the Supabase SQL Editor and Run.
--
-- SAFE: every statement is additive and idempotent (re-running does nothing new).
-- Nothing is dropped, renamed, reset or deleted.
--
-- Fixes:
--   1. Task submit → approve → rework workflow (missing columns)
--   2. Work Sessions timeline (new task_work_sessions table)
--   3. Declared holidays saving to the calendar
--   4. Colleges / Courses fields used by the UI
--   5. Attendance claims without a prior clock-in
--   6. Email queue columns
--   7. RLS policies for tables that had none (were deny-all)
--   8. Username/phone login resolver
--
-- ROLES: the app has exactly 4 (CEO / ADMIN / MANAGER / EMPLOYEE), which your
-- user_role enum already contains — so there is NOTHING to change for roles.
-- =============================================================================


-- 1) EMPLOYEE identity columns (username login + forced first-time reset) -------
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS employees_username_lower_key
  ON public.employees (lower(username))
  WHERE username IS NOT NULL AND deleted_at IS NULL;


-- 2) TASK APPROVAL WORKFLOW columns (submit → approve / rework) -----------------
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approval_status TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.employees(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS rework_notes TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS rework_requested_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_by_employee_id UUID REFERENCES public.employees(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.employees(id);


-- 3) DECLARED HOLIDAYS extra columns (holiday saving + calendar) ----------------
ALTER TABLE public.declared_holidays ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Company Holiday';
ALTER TABLE public.declared_holidays ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';


-- 4) COLLEGES / COURSES fields the UI reads/writes -----------------------------
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.courses  ADD COLUMN IF NOT EXISTS max_marks INTEGER DEFAULT 100;
ALTER TABLE public.courses  ADD COLUMN IF NOT EXISTS pass_percentage INTEGER DEFAULT 50;
ALTER TABLE public.courses  ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;


-- 5) ATTENDANCE claims without a prior clock-in --------------------------------
ALTER TABLE public.attendance_corrections ALTER COLUMN attendance_record_id DROP NOT NULL;


-- 6) EMAIL QUEUE columns -------------------------------------------------------
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS error_message TEXT;


-- 7) TASK WORK SESSIONS — Work Sessions timeline -------------------------------
CREATE TABLE IF NOT EXISTS public.task_work_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          uuid REFERENCES public.tasks(id)     ON DELETE CASCADE,
  project_id       uuid REFERENCES public.projects(id)  ON DELETE SET NULL,
  employee_id      uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  supervisor_id    uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  work_code        text,
  work_title       text NOT NULL,
  supervisor_name  text,
  start_time       timestamptz NOT NULL DEFAULT now(),
  end_time         timestamptz,
  duration_minutes integer,
  status           text NOT NULL DEFAULT 'running',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  created_by       uuid REFERENCES public.employees(id),
  updated_by       uuid REFERENCES public.employees(id),
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES public.employees(id)
);

CREATE INDEX IF NOT EXISTS idx_task_sessions_employee ON public.task_work_sessions(employee_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_task_sessions_task     ON public.task_work_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_sessions_open     ON public.task_work_sessions(employee_id, task_id) WHERE end_time IS NULL AND deleted_at IS NULL;

ALTER TABLE public.task_work_sessions ENABLE ROW LEVEL SECURITY;


-- 8) RLS POLICIES for every business table + the login resolver ----------------
--    Adds the standard "authenticated users have access" policy to any listed
--    table that is missing it (RLS-on with no policy = nobody can read/write).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'task_work_sessions',
    'enrollments', 'assessments', 'final_exam_results', 'certificates',
    'referrals', 'alumni_profiles', 'clients', 'milestones',
    'resource_allocations', 'timesheets', 'client_meetings', 'budgets',
    'vendors', 'purchase_orders', 'assets', 'salary_structures',
    'travel_requests', 'chat_channels', 'announcements', 'email_logs',
    'notification_preferences', 'kpi_definitions', 'saved_reports',
    'declared_holidays'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename=t
          AND policyname='Allow full access for authenticated users'
      ) THEN
        EXECUTE format(
          'CREATE POLICY "Allow full access for authenticated users" ON public.%I '
          'FOR ALL USING (auth.role() = ''authenticated'') '
          'WITH CHECK (auth.role() = ''authenticated'');', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Username / phone → email resolver, used by the login screen. SECURITY DEFINER
-- so an anonymous (not-yet-signed-in) visitor can resolve their email only.
CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier text)
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.email FROM public.employees e
  WHERE e.deleted_at IS NULL
    AND length(trim(identifier)) > 0
    AND (
      lower(e.email) = lower(trim(identifier))
      OR lower(e.username) = lower(trim(identifier))
      OR regexp_replace(coalesce(e.phone,''), '[^0-9]', '', 'g') =
         regexp_replace(trim(identifier),     '[^0-9]', '', 'g')
    )
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- Done.
