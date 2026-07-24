-- =============================================================================
-- COMPLETE LOGIN FIX — Run BOTH steps in order
-- Supabase SQL Editor → https://supabase.com/dashboard/project/yzlyeuikvbwhgjrjntvi/sql/new
--
-- WHY LOGIN FAILS:
--   The app authenticates via Supabase Auth (auth.users table).
--   Currently only a custom 'users' table has the admin record — this is a
--   legacy table the app no longer reads. auth.users is EMPTY, so every login
--   attempt fails with "Invalid username/email or password."
--
-- STEP 1 — Run ONLY this block first (creates the auth credential):
-- =============================================================================

-- Check if auth user already exists
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'admin@kvjanalytics.com';

-- =============================================================================
-- STEP 2 — After step 1 confirms auth user exists, run this block to link it:
-- =============================================================================

-- Link the auth user to an employees row (required for RLS and role checks)
INSERT INTO public.employees (
  id,
  employee_id,
  first_name,
  last_name,
  email,
  phone,
  designation,
  date_of_joining,
  role,
  username,
  status,
  must_change_password
)
SELECT
  u.id,              -- CRITICAL: employees.id must equal auth.users.id
  'EMP-001',
  'Ajay',
  'Thomas',
  u.email,
  '+91 9876543210',
  'Chief Executive Officer',
  CURRENT_DATE,
  'ADMIN',
  'Ajaythomas',
  'active',
  false
FROM auth.users u
WHERE u.email = 'admin@kvjanalytics.com'
ON CONFLICT (id) DO UPDATE
  SET role               = 'ADMIN',
      username           = 'Ajaythomas',
      status             = 'active',
      must_change_password = false,
      deleted_at         = NULL,
      updated_at         = now();


-- =============================================================================
-- STEP 3 — Verify all three checks pass before testing login:
-- =============================================================================

-- 1) Auth credential exists and email is confirmed
SELECT
  id,
  email,
  email_confirmed_at IS NOT NULL AS confirmed,
  created_at
FROM auth.users
WHERE email = 'admin@kvjanalytics.com';

-- 2) Employee row exists with correct role and username
SELECT id, email, role, username, status, must_change_password
FROM public.employees
WHERE email = 'admin@kvjanalytics.com';

-- 3) IDs match (this is what makes RLS work) — must return TRUE
SELECT EXISTS (
  SELECT 1
  FROM auth.users u
  JOIN public.employees e ON e.id = u.id
  WHERE u.email = 'admin@kvjanalytics.com'
) AS identity_linked;

-- 4) resolve_login_email function works for username login
SELECT public.resolve_login_email('Ajaythomas') AS resolved_email;
-- Expected result: admin@kvjanalytics.com

-- =============================================================================
-- OPTIONAL: Fix the legacy 'students' table (showing UNRESTRICTED in dashboard)
-- =============================================================================
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'students'
      AND policyname = 'Allow full access for authenticated users'
  ) THEN
    CREATE POLICY "Allow full access for authenticated users" ON public.students
      FOR ALL USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
