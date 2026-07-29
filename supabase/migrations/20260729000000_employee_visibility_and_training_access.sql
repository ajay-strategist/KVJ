-- =============================================================================
-- Employee Visibility Fix: all authenticated users can read employee list
-- =============================================================================
-- The original RLS on employees only allowed:
--   - full-control roles (ADMIN/CEO/MANAGER): ALL operations on ALL rows
--   - EMPLOYEE role: only their OWN row (self-select)
--
-- This blocks normal employees from seeing the employee list used in:
--   - Training Calendar (trainer columns for all employees)
--   - Leave Board (employee filter dropdown for management)
--   - Office Timeline (all employee rows)
--
-- Fix: Add a SELECT-only policy allowing ANY authenticated user to read
-- the employee roster. Full-control roles already have an ALL policy.
-- =============================================================================

-- Allow every authenticated user to read the employee list
DROP POLICY IF EXISTS employees_authenticated_read ON employees;
CREATE POLICY employees_authenticated_read ON employees
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Training tables: ensure all authenticated users can read & write
-- (courses, colleges, batches, schedule_sessions are shared org resources)
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.courses;
CREATE POLICY "Allow full access for authenticated users" ON public.courses
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.colleges;
CREATE POLICY "Allow full access for authenticated users" ON public.colleges
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.batches;
CREATE POLICY "Allow full access for authenticated users" ON public.batches
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.schedule_sessions;
CREATE POLICY "Allow full access for authenticated users" ON public.schedule_sessions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.student_records;
CREATE POLICY "Allow full access for authenticated users" ON public.student_records
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.enrollments;
CREATE POLICY "Allow full access for authenticated users" ON public.enrollments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.assessments;
CREATE POLICY "Allow full access for authenticated users" ON public.assessments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.announcements;
CREATE POLICY "Allow full access for authenticated users" ON public.announcements
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
