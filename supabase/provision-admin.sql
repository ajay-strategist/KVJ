-- =============================================================================
-- ONE-TIME ADMIN PROVISIONING  (run manually — this is NOT a migration)
--
-- Creating an auth.users row requires service-role privileges, which a browser
-- must never hold. So provisioning is a two-step operation you perform once.
--
-- STEP 1 — Create the login credential (Supabase Dashboard)
--   Authentication → Users → "Add user" → "Create new user"
--     Email:          admin@kvjanalytics.com
--     Password:       <choose a NEW strong password>
--     Auto Confirm User: ON     ← required, or login fails until email confirmed
--
--   IMPORTANT: do NOT reuse the previous password. It was committed to source
--   and to git history and must be treated as compromised.
--
-- STEP 2 — Link that credential to an employee row (run the SQL below in
--          Supabase → SQL Editor). It reads the id created in step 1, so the
--          two rows always share the same primary key, which is exactly what
--          the RLS helpers current_role() / is_full_control() rely on.
-- =============================================================================

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
  u.id,                              -- auth.users.id === employees.id
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
  SET role       = 'ADMIN',
      status     = 'active',
      deleted_at = NULL,
      updated_at = now();


-- -----------------------------------------------------------------------------
-- VERIFY — all three checks must return a row / true before the app will work.
-- -----------------------------------------------------------------------------

-- 1) The credential exists and is confirmed.
SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users
WHERE email = 'admin@kvjanalytics.com';

-- 2) The employee row exists with the SAME id and an ADMIN role.
SELECT id, email, role, username, status
FROM public.employees
WHERE email = 'admin@kvjanalytics.com';

-- 3) The ids match (this is what makes RLS work). Expect: true
SELECT EXISTS (
  SELECT 1
  FROM auth.users u
  JOIN public.employees e ON e.id = u.id
  WHERE u.email = 'admin@kvjanalytics.com'
) AS identity_linked;
