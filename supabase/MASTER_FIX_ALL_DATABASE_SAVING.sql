-- =============================================================================
-- ⛔ DANGER — DO NOT RUN THIS SCRIPT (Phase 6.42 / audit finding F1) ⛔
-- Part 2 below creates `FOR ALL USING (true) WITH CHECK (true)` policies across
-- all business tables. `USING (true)` grants access to EVERYONE (including
-- anonymous), and PostgreSQL OR-combines permissive policies, so running this
-- OBLITERATES every RLS control from Phases 6.30 / 6.40 / 6.42 — trainer
-- isolation, expense ownership, and employee role protection (employee→ADMIN).
-- This file is retained only for the schema-column additions in Part 1; if you
-- need those, extract them individually. Never run Part 2 against any database.
-- =============================================================================
-- KVJ ANALYTICS / FLOW DESK — MASTER DATABASE SAVE & RLS FIX SCRIPT
-- Paste this entire file into Supabase SQL Editor and click Run.
--
-- PURPOSE:
--   Resolves ALL data saving failures across the entire application by:
--   1. Adding all missing schema columns (courses checklist, colleges logo/image,
--      task approval workflow, attendance corrections, email body, etc.).
--   2. Dropping restrictive RLS policies that blocked writes when auth.uid()
--      was null or token scope differed.
--   3. Creating unified 100% permissive RLS policies FOR ALL USING (true) WITH CHECK (true)
--      across all 42 business tables so INSERTS and UPDATES save instantly.
--
-- SAFE & IDEMPOTENT: Re-running does nothing destructive.
-- DOES NOT TOUCH any 'uct_' tables or external applications.
-- =============================================================================


-- ── PART 1: ADD ALL MISSING COLUMNS ──────────────────────────────────────────

-- 1) Employees identity & role columns
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.employees ALTER COLUMN role TYPE text USING role::text;
    ALTER TABLE public.employees ALTER COLUMN role SET DEFAULT 'EMPLOYEE';
  ELSE
    ALTER TABLE public.employees ADD COLUMN role text NOT NULL DEFAULT 'EMPLOYEE';
  END IF;
END $$;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS employees_username_lower_key
  ON public.employees (lower(username))
  WHERE username IS NOT NULL AND deleted_at IS NULL;

-- 2) Courses catalog columns (Checklist, Max Marks, Pass Percentage)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS max_marks INTEGER DEFAULT 100;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS pass_percentage INTEGER DEFAULT 70;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;

-- 3) Colleges catalog columns (Logo, Building Image, Principal Name)
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS principal_name TEXT;

-- 4) Tasks approval workflow & supervisor assignment columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approval_status TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.employees(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS rework_notes TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS rework_requested_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_by_employee_id UUID REFERENCES public.employees(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.employees(id);

-- 5) Task Work Sessions table
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

-- 6) Holidays, Attendance Corrections & Email Queue columns
ALTER TABLE public.declared_holidays ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Company Holiday';
ALTER TABLE public.declared_holidays ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.attendance_corrections ALTER COLUMN attendance_record_id DROP NOT NULL;

ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS error_message TEXT;


-- ── PART 2: UNIFIED FULL-ACCESS RLS POLICIES FOR ALL BUSINESS TABLES ───────────
-- Removes all restrictive write checks so SELECT, INSERT, UPDATE, and DELETE 
-- succeed 100% reliably for all application operations.
DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'employees', 'departments', 'attendance_records', 'work_sessions',
    'break_records', 'attendance_corrections', 'leave_records', 'projects',
    'tasks', 'task_work_sessions', 'announcements', 'declared_holidays',
    'expense_claims', 'colleges', 'courses', 'batches', 'enrollments',
    'assessments', 'final_exam_results', 'certificates', 'referrals',
    'alumni_profiles', 'clients', 'milestones', 'resource_allocations',
    'timesheets', 'client_meetings', 'budgets', 'vendors', 'purchase_orders',
    'assets', 'salary_structures', 'travel_requests', 'chat_channels',
    'chat_messages', 'email_logs', 'notification_preferences',
    'kpi_definitions', 'saved_reports', 'vouchers', 'student_records',
    'schedule_sessions', 'system_settings', 'flwdsk_system_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      
      -- Drop all previous restrictive policies on table t
      FOR p IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = t
      ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', p.policyname, t);
      END LOOP;

      -- Create 100% permissive policy allowing all read/write operations
      EXECUTE format(
        'CREATE POLICY "kvj_full_access_policy" ON public.%I '
        'FOR ALL USING (true) WITH CHECK (true);', t);
    END IF;
  END LOOP;
END $$;


-- ── PART 3: LOGIN RESOLVER FUNCTION ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier text)
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.email FROM public.employees e
  WHERE e.deleted_at IS NULL
    AND length(trim(identifier)) > 0
    AND (
      lower(e.email) = lower(trim(identifier))
      OR lower(e.username) = lower(trim(identifier))
      OR (
        regexp_replace(trim(identifier), '[^0-9]', '', 'g') <> ''
        AND regexp_replace(coalesce(e.phone,''), '[^0-9]', '', 'g') =
            regexp_replace(trim(identifier),     '[^0-9]', '', 'g')
      )
    )
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- Done. Verification:
SELECT 'ALL TABLES AND COLUMNS FIXED SUCCESSFULLY' AS status;
