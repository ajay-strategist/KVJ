-- =============================================================================
-- USER & ROLE ALIGNMENT SCRIPT (SAFE UPDATE)
-- Application: KVJ Analytics / Flow Desk
--
-- Aligns roles and updates employee records for:
--   1. Ajay Thomas     -> ADMIN
--   2. Jomon Joseph    -> CEO
--   3. Linto George    -> EMPLOYEE
--   4. Anoop Baiju     -> EMPLOYEE
--
-- SAFE: Updates existing rows, never creates duplicate email constraint errors.
-- Does NOT touch any 'uct_' tables or external applications.
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

-- Step 2: Update existing employee rows cleanly without duplicate key conflicts

-- 1) Ajay Thomas -> ADMIN
UPDATE public.employees 
SET role = 'ADMIN', 
    first_name = 'Ajay', 
    last_name = 'Thomas', 
    designation = 'System Administrator', 
    status = 'active'
WHERE lower(email) LIKE '%ajay%' 
   OR lower(email) = 'mail@thestrategist.co.in'
   OR lower(coalesce(username,'')) = 'ajaythomas';

-- 2) Jomon Joseph -> CEO
UPDATE public.employees 
SET role = 'CEO', 
    first_name = 'Jomon', 
    last_name = 'Joseph', 
    designation = 'Chief Executive Officer', 
    status = 'active'
WHERE lower(email) LIKE '%jomon%' 
   OR lower(email) = 'info@thestrategist.co.in';

-- 3) Linto George -> EMPLOYEE
UPDATE public.employees 
SET role = 'EMPLOYEE', 
    first_name = 'Linto', 
    last_name = 'George', 
    status = 'active'
WHERE lower(email) LIKE '%linto%' 
   OR lower(first_name) = 'linto';

-- 4) Anoop Baiju -> EMPLOYEE
UPDATE public.employees 
SET role = 'EMPLOYEE', 
    first_name = 'Anoop', 
    last_name = 'Baiju', 
    status = 'active'
WHERE lower(email) LIKE '%anoop%' 
   OR lower(first_name) = 'anoop';

-- Step 3: Link employees.id to auth.users.id if auth account exists (enables RLS)
DO $$
BEGIN
  UPDATE public.employees e
  SET id = u.id
  FROM auth.users u
  WHERE lower(e.email) = lower(u.email)
    AND e.id != u.id;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Step 4: Verify final updated employee list
SELECT id, email, username, first_name, last_name, role, designation, status 
FROM public.employees;
