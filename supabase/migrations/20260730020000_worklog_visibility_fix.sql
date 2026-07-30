-- =============================================================================
-- Worklog Visibility Fix — task_work_sessions & work_sessions
-- Run in Supabase SQL Editor → Run
--
-- Problem: When an employee starts a task (My Day → Start Task), the timer
-- runs in the browser but the work session is NOT saved to task_work_sessions
-- because the INSERT RLS policy requires auth.role() = 'authenticated', which
-- is false for fallback sessions. The Work Sessions timeline on the Projects &
-- Tasks → Task Worklog tab shows "No work sessions recorded yet" and
-- "Work Sessions (0)" for the same reason.
--
-- Fix: Same USING (true) SELECT + auth.uid() IS NOT NULL WRITE pattern.
-- SAFE TO RE-RUN: every statement uses DROP IF EXISTS.
-- =============================================================================

-- ── TASK_WORK_SESSIONS (My Day timer → Projects & Tasks → Task Worklog) ───────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.task_work_sessions;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.task_work_sessions;
DROP POLICY IF EXISTS "task_work_sessions_public_read" ON public.task_work_sessions;
DROP POLICY IF EXISTS "task_work_sessions_auth_write" ON public.task_work_sessions;
DROP POLICY IF EXISTS "task_work_sessions_auth_update" ON public.task_work_sessions;
DROP POLICY IF EXISTS "task_work_sessions_auth_delete" ON public.task_work_sessions;

-- Everyone can read work sessions (managers/supervisors need to see all)
CREATE POLICY "task_work_sessions_public_read" ON public.task_work_sessions
  FOR SELECT USING (true);

-- Only authenticated users can write (real sessions only — prevents spam)
CREATE POLICY "task_work_sessions_auth_write" ON public.task_work_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "task_work_sessions_auth_update" ON public.task_work_sessions
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "task_work_sessions_auth_delete" ON public.task_work_sessions
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── WORK_SESSIONS (Attendance → Work Sessions timeline) ───────────────────────
-- Old policies used is_full_control() which breaks for fallback sessions.
DROP POLICY IF EXISTS work_sessions_full_control ON public.work_sessions;
DROP POLICY IF EXISTS work_sessions_self ON public.work_sessions;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.work_sessions;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_public_read" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_auth_write" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_auth_update" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_auth_delete" ON public.work_sessions;

CREATE POLICY "work_sessions_public_read" ON public.work_sessions
  FOR SELECT USING (true);

CREATE POLICY "work_sessions_auth_write" ON public.work_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "work_sessions_auth_update" ON public.work_sessions
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "work_sessions_auth_delete" ON public.work_sessions
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── BREAK_RECORDS (Attendance breaks — linked to work sessions) ───────────────
DROP POLICY IF EXISTS break_records_full_control ON public.break_records;
DROP POLICY IF EXISTS break_records_self ON public.break_records;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.break_records;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.break_records;
DROP POLICY IF EXISTS "break_records_public_read" ON public.break_records;
DROP POLICY IF EXISTS "break_records_auth_write" ON public.break_records;
DROP POLICY IF EXISTS "break_records_auth_update" ON public.break_records;
DROP POLICY IF EXISTS "break_records_auth_delete" ON public.break_records;

CREATE POLICY "break_records_public_read" ON public.break_records
  FOR SELECT USING (true);

CREATE POLICY "break_records_auth_write" ON public.break_records
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "break_records_auth_update" ON public.break_records
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "break_records_auth_delete" ON public.break_records
  FOR DELETE USING (auth.uid() IS NOT NULL);
