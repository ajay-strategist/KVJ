-- =============================================================================
-- Training Public Read Access + Batch Visibility Fix
-- Run in Supabase SQL Editor → Run
--
-- Problem: The CEO's Supabase Auth account may not exist in auth.users yet,
-- so they log in via a fallback session (no real JWT). The existing RLS
-- policies use `auth.uid() IS NOT NULL` which returns false for fallback
-- sessions, so ALL SELECT queries on training tables return empty results
-- silently. The CEO sees "No batches found" even though batches exist.
--
-- Fix: Drop the auth.uid()-gated policies on training read-path tables and
-- replace them with USING (true) SELECT policies so ANY client (including
-- the anon-keyed Supabase client used in the fallback) can read training data.
-- Write operations (INSERT / UPDATE / DELETE) still require auth.uid() IS NOT NULL.
-- =============================================================================

-- ── BATCHES ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.batches;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.batches;

-- Everyone can read batches (they are shared org resources)
CREATE POLICY "batches_public_read" ON public.batches
  FOR SELECT USING (true);

-- Only authenticated users can write
CREATE POLICY "batches_auth_write" ON public.batches
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "batches_auth_update" ON public.batches
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "batches_auth_delete" ON public.batches
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── COURSES ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.courses;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.courses;

CREATE POLICY "courses_public_read" ON public.courses
  FOR SELECT USING (true);

CREATE POLICY "courses_auth_write" ON public.courses
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "courses_auth_update" ON public.courses
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "courses_auth_delete" ON public.courses
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── COLLEGES ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.colleges;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.colleges;

CREATE POLICY "colleges_public_read" ON public.colleges
  FOR SELECT USING (true);

CREATE POLICY "colleges_auth_write" ON public.colleges
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "colleges_auth_update" ON public.colleges
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "colleges_auth_delete" ON public.colleges
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── STUDENT RECORDS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.student_records;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.student_records;

CREATE POLICY "student_records_public_read" ON public.student_records
  FOR SELECT USING (true);

CREATE POLICY "student_records_auth_write" ON public.student_records
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "student_records_auth_update" ON public.student_records
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "student_records_auth_delete" ON public.student_records
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── ENROLLMENTS ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.enrollments;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.enrollments;

CREATE POLICY "enrollments_public_read" ON public.enrollments
  FOR SELECT USING (true);

CREATE POLICY "enrollments_auth_write" ON public.enrollments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "enrollments_auth_update" ON public.enrollments
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "enrollments_auth_delete" ON public.enrollments
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── SCHEDULE SESSIONS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.schedule_sessions;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.schedule_sessions;

CREATE POLICY "schedule_sessions_public_read" ON public.schedule_sessions
  FOR SELECT USING (true);

CREATE POLICY "schedule_sessions_auth_write" ON public.schedule_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "schedule_sessions_auth_update" ON public.schedule_sessions
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "schedule_sessions_auth_delete" ON public.schedule_sessions
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── ASSESSMENTS ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.assessments;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.assessments;

CREATE POLICY "assessments_public_read" ON public.assessments
  FOR SELECT USING (true);

CREATE POLICY "assessments_auth_write" ON public.assessments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "assessments_auth_update" ON public.assessments
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "assessments_auth_delete" ON public.assessments
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── EMPLOYEES (READ for all — needed for trainer names on batch cards) ────────
DROP POLICY IF EXISTS "employees_authenticated_read" ON public.employees;

CREATE POLICY "employees_public_read" ON public.employees
  FOR SELECT USING (true);

-- ── ROLE CORRECTION — ensure CEO account has correct role in DB ───────────────
UPDATE public.employees
  SET role = 'CEO'
  WHERE email ILIKE 'info@thestrategist.co.in'
    AND (role IS NULL OR role::text != 'CEO');
