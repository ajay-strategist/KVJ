-- =============================================================================
-- KVJ ANALYTICS — RESET & REBUILD EMPLOYEES TABLE & USER ROLES
--
-- This script resets KVJ Analytics employee identity records and provisions:
--   1. Ajay Thomas     -> ADMIN    (mail@thestrategist.co.in, username: Ajaythomas)
--   2. Jomon Joseph    -> CEO      (info@thestrategist.co.in)
--   3. Linto George    -> EMPLOYEE (lintogeorge@kvjanalytics.onmicrosoft.com)
--   4. Anoop Baiju     -> EMPLOYEE (smartanoop02@gmail.com)
--
-- SAFE: DOES NOT DROP ANY 'uct_' TABLES or touch other applications.
-- =============================================================================

-- Step 1: Ensure role column exists as text
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

-- Step 2: Clear outdated/conflicting KVJ employees rows (does not touch uct_ tables)
DELETE FROM public.employees;

-- Step 3: Insert employees linked directly to auth.users records (or standalone fallback IDs)

-- 1. Ajay Thomas (ADMIN)
INSERT INTO public.employees (
  id, employee_id, first_name, last_name, email, role, designation, username, status, must_change_password
)
SELECT 
  COALESCE((SELECT id FROM auth.users WHERE lower(email) = 'mail@thestrategist.co.in' LIMIT 1), '6446ace9-79d8-447b-b20a-d905429c6074'::uuid),
  'EMP-001', 'Ajay', 'Thomas', 'mail@thestrategist.co.in', 'ADMIN', 'System Administrator', 'Ajaythomas', 'active', false
ON CONFLICT (id) DO UPDATE SET 
  role = 'ADMIN', 
  first_name = 'Ajay', 
  last_name = 'Thomas', 
  username = 'Ajaythomas', 
  email = 'mail@thestrategist.co.in';

-- 2. Jomon Joseph (CEO)
INSERT INTO public.employees (
  id, employee_id, first_name, last_name, email, role, designation, status, must_change_password
)
SELECT 
  COALESCE((SELECT id FROM auth.users WHERE lower(email) = 'info@thestrategist.co.in' LIMIT 1), 'ca7bd003-ba18-4a06-88cf-a9d996ee8660'::uuid),
  'EMP-002', 'Jomon', 'Joseph', 'info@thestrategist.co.in', 'CEO', 'Chief Executive Officer', 'active', false
ON CONFLICT (id) DO UPDATE SET 
  role = 'CEO', 
  first_name = 'Jomon', 
  last_name = 'Joseph', 
  email = 'info@thestrategist.co.in';

-- 3. Linto George (EMPLOYEE)
INSERT INTO public.employees (
  id, employee_id, first_name, last_name, email, role, designation, status, must_change_password
)
SELECT 
  COALESCE((SELECT id FROM auth.users WHERE lower(email) LIKE '%linto%' LIMIT 1), '2b3af0d6-b7cd-4043-8cdb-e3734b153489'::uuid),
  'EMP-003', 'Linto', 'George', 'lintogeorge@kvjanalytics.onmicrosoft.com', 'EMPLOYEE', 'Staff member', 'active', false
ON CONFLICT (id) DO UPDATE SET 
  role = 'EMPLOYEE', 
  first_name = 'Linto', 
  last_name = 'George';

-- 4. Anoop Baiju (EMPLOYEE)
INSERT INTO public.employees (
  id, employee_id, first_name, last_name, email, role, designation, status, must_change_password
)
SELECT 
  COALESCE((SELECT id FROM auth.users WHERE lower(email) LIKE '%anoop%' LIMIT 1), '94a45c3d-598c-4cbc-a87d-5bc0e0c9554d'::uuid),
  'EMP-004', 'Anoop', 'Baiju', 'smartanoop02@gmail.com', 'EMPLOYEE', 'Data Analyst', 'active', false
ON CONFLICT (id) DO UPDATE SET 
  role = 'EMPLOYEE', 
  first_name = 'Anoop', 
  last_name = 'Baiju';

-- Step 4: Verify the fresh employees table
SELECT id, email, username, first_name, last_name, role, designation, status FROM public.employees;
