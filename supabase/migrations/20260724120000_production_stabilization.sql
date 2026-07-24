-- =============================================================================
-- Production stabilization — ADDITIVE REPAIRS ONLY
--
-- This migration repairs verified defects found during the technical audit.
-- It is strictly additive and backward compatible:
--   • No table is created, dropped, renamed or recreated.
--   • No column is dropped or renamed.
--   • No data is deleted, truncated or reset.
--   • Every statement is idempotent (safe to run more than once).
--
-- Sections:
--   1. Role enum completion      — DB enum had 4 of the app's 6 roles
--   2. Employee identity columns — columns Supabase Auth cutover requires
--   3. Login identifier resolver — lets username/phone login keep working
--   4. RLS policies for 23 tables that had RLS ON and NO policy (deny-all)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. ROLE ENUM  (self-sufficient — does not assume earlier migrations ran)
--
-- DEFECT A: 20260720000000_roles_and_rls.sql creates
--   CREATE TYPE user_role AS ENUM ('ADMIN','CEO','MANAGER','EMPLOYEE');
-- but src/shared/permissions/roles.ts defines SIX roles, so COORDINATOR and
-- TRAINER could never be assigned.
--
-- DEFECT B: that migration may never have been applied at all — running this
-- file against such a database failed with
--   ERROR 42704: type "user_role" does not exist
-- so the enum is now CREATED when absent instead of assumed.
--
-- Role NAMES are unchanged; this only makes the database match the application's
-- existing role model.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v text;
  wanted text[] := ARRAY['ADMIN', 'CEO', 'MANAGER', 'COORDINATOR', 'TRAINER', 'EMPLOYEE'];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role' AND n.nspname = 'public'
  ) THEN
    -- Type absent: create it complete, in the app's own precedence order.
    CREATE TYPE public.user_role AS ENUM
      ('ADMIN', 'CEO', 'MANAGER', 'COORDINATOR', 'TRAINER', 'EMPLOYEE');
  ELSE
    -- Type present: top it up with any values it is missing.
    FOREACH v IN ARRAY wanted LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'user_role' AND n.nspname = 'public' AND e.enumlabel = v
      ) THEN
        EXECUTE format('ALTER TYPE public.user_role ADD VALUE %L', v);
      END IF;
    END LOOP;
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 1b. employees.role
--
-- Added by 20260720000000; recreated here because that migration may not have
-- run. src/modules/auth/supabase-auth.service.ts reads employees.role on every
-- login, so without this column nobody can sign in.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    RAISE EXCEPTION
      'Table public.employees does not exist. Apply 20260718000000_employee_attendance.sql first.';
  END IF;

  ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'EMPLOYEE';
END $$;


-- -----------------------------------------------------------------------------
-- 2. EMPLOYEE IDENTITY COLUMNS
--
-- DEFECT: the login screen accepts "username or email" and the app supports a
-- forced first-time password reset, but `employees` has neither a username nor
-- a must_change_password column. Without them these EXISTING features would be
-- lost in the Supabase Auth cutover.
--
-- FIX: add both as nullable/defaulted columns. Existing rows are unaffected.
-- -----------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Case-insensitive uniqueness for usernames, ignoring soft-deleted rows.
CREATE UNIQUE INDEX IF NOT EXISTS employees_username_lower_key
  ON public.employees (lower(username))
  WHERE username IS NOT NULL AND deleted_at IS NULL;


-- -----------------------------------------------------------------------------
-- 3. LOGIN IDENTIFIER RESOLVER
--
-- The user is not authenticated when logging in, so RLS prevents reading
-- `employees` to map a username/phone to an email. SECURITY DEFINER lets the
-- lookup run, while returning ONLY the email and nothing else.
--
-- Consumed by src/modules/auth/supabase-auth.service.ts → resolveIdentifierToEmail().
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier text)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT e.email
  FROM public.employees e
  WHERE e.deleted_at IS NULL
    AND (
      lower(e.email) = lower(trim(identifier))
      OR lower(e.username) = lower(trim(identifier))
      OR regexp_replace(coalesce(e.phone, ''), '[^0-9]', '', 'g') =
         regexp_replace(trim(identifier),      '[^0-9]', '', 'g')
    )
    -- Never match on an empty/blank identifier.
    AND length(trim(identifier)) > 0
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. RLS POLICIES FOR TABLES THAT HAD NONE
--
-- DEFECT: 20260724000000_production_schema_alignment.sql enabled RLS on 32
-- tables but created only 9 policies. In PostgreSQL, RLS enabled with zero
-- policies denies ALL access. The 23 tables below were therefore unreachable
-- by any client, including core training tables (enrollments, assessments,
-- certificates).
--
-- FIX: apply the same access rule the 9 existing policies already use —
-- authenticated users may access the row. This CHANGES NO EXISTING POLICY and
-- introduces no new permission concept; it makes the remaining tables behave
-- exactly like the ones that already work.
--
-- NOTE: this deliberately matches the existing model rather than introducing a
-- stricter per-role scheme, which would be a security-model redesign and
-- requires explicit approval. See the deliverables report, "Requires approval".
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'enrollments', 'assessments', 'final_exam_results', 'certificates',
    'referrals', 'alumni_profiles', 'clients', 'milestones',
    'resource_allocations', 'timesheets', 'client_meetings', 'budgets',
    'vendors', 'purchase_orders', 'assets', 'salary_structures',
    'travel_requests', 'chat_channels', 'announcements', 'email_logs',
    'notification_preferences', 'kpi_definitions', 'saved_reports'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Only act on tables that actually exist, so this migration is safe to run
    -- against a partially-migrated database.
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = t
          AND policyname = 'Allow full access for authenticated users'
      ) THEN
        EXECUTE format(
          'CREATE POLICY "Allow full access for authenticated users" ON public.%I '
          'FOR ALL USING (auth.role() = ''authenticated'') '
          'WITH CHECK (auth.role() = ''authenticated'');', t
        );
      END IF;
    END IF;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 4b. WITH CHECK on the 9 pre-existing policies
--
-- DEFECT: the 9 policies created in 20260724000000 specify USING but not
-- WITH CHECK. For FOR ALL policies PostgreSQL falls back to USING for the write
-- check, so behaviour is currently correct — but stating it explicitly prevents
-- a future USING-only edit from silently opening writes. Additive and
-- behaviour-preserving.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'colleges', 'courses', 'batches', 'schedule_sessions', 'student_records',
    'expense_claims', 'tasks', 'projects', 'chat_messages'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = 'Allow full access for authenticated users'
        AND with_check IS NULL
    ) THEN
      EXECUTE format(
        'ALTER POLICY "Allow full access for authenticated users" ON public.%I '
        'WITH CHECK (auth.role() = ''authenticated'');', t
      );
    END IF;
  END LOOP;
END $$;
