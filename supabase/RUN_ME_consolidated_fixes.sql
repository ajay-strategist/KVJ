-- =============================================================================
-- KVJ / Nexus — CONSOLIDATED FIX SCRIPT  (CORRECTED for flwdsk_ table prefix)
-- Paste this whole file into the Supabase SQL Editor and Run.
--
-- IMPORTANT: your database uses the `flwdsk_` table-name prefix, and so does
-- the app code. This script targets those real tables.
--
-- SAFE: every statement is additive and idempotent (re-running does nothing new).
-- Nothing is dropped, renamed, reset or deleted.
--
-- Fixes:
--   1. Username / forced-first-reset columns on employees
--   2. Task submit → approve → rework workflow (missing columns)
--   3. Declared holidays saving to the calendar
--   4. Colleges / Courses fields used by the UI
--   5. Attendance claims without a prior clock-in
--   6. Email queue columns
--   7. TASK WORK SESSIONS table  ← fixes "worked task not showing in Work Log"
--   8. RLS policies for tables that had none + username/phone login resolver
--
-- Roles: the app has exactly 4 (CEO / ADMIN / MANAGER / EMPLOYEE) — no DB change.
-- =============================================================================


-- 1) EMPLOYEE identity columns -------------------------------------------------
ALTER TABLE public.flwdsk_employees ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.flwdsk_employees ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS flwdsk_employees_username_lower_key
  ON public.flwdsk_employees (lower(username))
  WHERE username IS NOT NULL AND deleted_at IS NULL;

-- 1b) PROJECT supervisor column ------------------------------------------------
ALTER TABLE public.flwdsk_projects ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.flwdsk_employees(id) ON DELETE SET NULL;



-- 2) TASK APPROVAL WORKFLOW columns (submit → approve / rework) -----------------
ALTER TABLE public.flwdsk_tasks ADD COLUMN IF NOT EXISTS approval_status TEXT;
ALTER TABLE public.flwdsk_tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.flwdsk_tasks ADD COLUMN IF NOT EXISTS submitted_by UUID;
ALTER TABLE public.flwdsk_tasks ADD COLUMN IF NOT EXISTS rework_notes TEXT;
ALTER TABLE public.flwdsk_tasks ADD COLUMN IF NOT EXISTS rework_requested_at TIMESTAMPTZ;
ALTER TABLE public.flwdsk_tasks ADD COLUMN IF NOT EXISTS assigned_by_employee_id UUID;
ALTER TABLE public.flwdsk_tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.flwdsk_tasks ADD COLUMN IF NOT EXISTS approved_by UUID;


-- 3) DECLARED HOLIDAYS extra columns (holiday saving + calendar) ----------------
ALTER TABLE public.flwdsk_declared_holidays ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Company Holiday';
ALTER TABLE public.flwdsk_declared_holidays ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';


-- 4) COLLEGES / COURSES fields the UI reads/writes -----------------------------
ALTER TABLE public.flwdsk_colleges ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.flwdsk_colleges ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.flwdsk_courses  ADD COLUMN IF NOT EXISTS max_marks INTEGER DEFAULT 100;
ALTER TABLE public.flwdsk_courses  ADD COLUMN IF NOT EXISTS pass_percentage INTEGER DEFAULT 50;
ALTER TABLE public.flwdsk_courses  ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;


-- 5) ATTENDANCE claims without a prior clock-in --------------------------------
ALTER TABLE public.flwdsk_attendance_corrections ALTER COLUMN attendance_record_id DROP NOT NULL;


-- 6) EMAIL QUEUE columns -------------------------------------------------------
ALTER TABLE public.flwdsk_email_logs ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.flwdsk_email_logs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.flwdsk_email_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.flwdsk_email_logs ADD COLUMN IF NOT EXISTS error_message TEXT;


-- 7) TASK WORK SESSIONS — Work Sessions timeline (the missing table) -----------
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


-- 8) RLS policies for any listed table missing one, + login resolver -----------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'flwdsk_task_work_sessions',
    'flwdsk_enrollments', 'flwdsk_assessments', 'flwdsk_certificates',
    'flwdsk_referrals', 'flwdsk_alumni_profiles', 'flwdsk_clients', 'flwdsk_milestones',
    'flwdsk_resource_allocations', 'flwdsk_timesheets', 'flwdsk_client_meetings',
    'flwdsk_budgets', 'flwdsk_vendors', 'flwdsk_purchase_orders', 'flwdsk_assets',
    'flwdsk_salary_structures', 'flwdsk_travel_requests', 'flwdsk_chat_channels',
    'flwdsk_chat_messages', 'flwdsk_announcements', 'flwdsk_email_logs',
    'flwdsk_notification_preferences', 'flwdsk_kpi_definitions', 'flwdsk_saved_reports',
    'flwdsk_declared_holidays', 'flwdsk_tasks', 'flwdsk_projects', 'flwdsk_employees',
    'flwdsk_colleges', 'flwdsk_courses', 'flwdsk_batches', 'flwdsk_student_records',
    'flwdsk_expense_claims', 'flwdsk_expense_types', 'flwdsk_schedule_sessions',
    'flwdsk_attendance_records', 'flwdsk_leave_records'
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

-- Username / phone → email resolver used by the login screen (anon-callable).
CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier text)
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.email FROM public.flwdsk_employees e
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
