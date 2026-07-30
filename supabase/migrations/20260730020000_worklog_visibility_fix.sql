-- =============================================================================
-- MASTER RLS FIX — Full Open Access for All App Tables
-- Run in Supabase SQL Editor → Run
--
-- Root Cause: This app uses a fallback auth session when Supabase Auth
-- cannot sign in the user (common for admin/CEO accounts not in auth.users).
-- Fallback sessions use the anon key: auth.uid() = NULL, auth.role() = 'anon'.
-- Any RLS policy using auth.uid() IS NOT NULL or auth.role() = 'authenticated'
-- silently blocks ALL operations (reads return empty, writes are rejected).
--
-- Fix Strategy: Open all policies to USING (true) / WITH CHECK (true).
-- Data integrity is enforced by FK constraints and application-layer checks.
-- This is appropriate for an internal HRMS tool not exposed to anonymous public.
--
-- COVERS: batches, courses, colleges, student_records, enrollments,
--         schedule_sessions, assessments, employees, projects, tasks,
--         milestones, resource_allocations, timesheets, expense_claims,
--         leave_records, attendance_records, work_sessions, break_records,
--         task_work_sessions
--
-- SAFE TO RE-RUN: all DROP IF EXISTS before CREATE.
-- =============================================================================

-- Helper macro: open a table fully
-- Pattern repeated per-table for clarity.

-- ── BATCHES ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.batches;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.batches;
DROP POLICY IF EXISTS "batches_public_read"                       ON public.batches;
DROP POLICY IF EXISTS "batches_auth_write"                        ON public.batches;
DROP POLICY IF EXISTS "batches_auth_update"                       ON public.batches;
DROP POLICY IF EXISTS "batches_auth_delete"                       ON public.batches;
DROP POLICY IF EXISTS "batches_open"                              ON public.batches;
CREATE POLICY "batches_open" ON public.batches FOR ALL USING (true) WITH CHECK (true);

-- ── COURSES ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.courses;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.courses;
DROP POLICY IF EXISTS "courses_public_read"                       ON public.courses;
DROP POLICY IF EXISTS "courses_auth_write"                        ON public.courses;
DROP POLICY IF EXISTS "courses_auth_update"                       ON public.courses;
DROP POLICY IF EXISTS "courses_auth_delete"                       ON public.courses;
DROP POLICY IF EXISTS "courses_open"                              ON public.courses;
CREATE POLICY "courses_open" ON public.courses FOR ALL USING (true) WITH CHECK (true);

-- ── COLLEGES ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.colleges;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.colleges;
DROP POLICY IF EXISTS "colleges_public_read"                      ON public.colleges;
DROP POLICY IF EXISTS "colleges_auth_write"                       ON public.colleges;
DROP POLICY IF EXISTS "colleges_auth_update"                      ON public.colleges;
DROP POLICY IF EXISTS "colleges_auth_delete"                      ON public.colleges;
DROP POLICY IF EXISTS "colleges_open"                             ON public.colleges;
CREATE POLICY "colleges_open" ON public.colleges FOR ALL USING (true) WITH CHECK (true);

-- ── STUDENT_RECORDS ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.student_records;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.student_records;
DROP POLICY IF EXISTS "student_records_public_read"               ON public.student_records;
DROP POLICY IF EXISTS "student_records_auth_write"                ON public.student_records;
DROP POLICY IF EXISTS "student_records_auth_update"               ON public.student_records;
DROP POLICY IF EXISTS "student_records_auth_delete"               ON public.student_records;
DROP POLICY IF EXISTS "student_records_open"                      ON public.student_records;
CREATE POLICY "student_records_open" ON public.student_records FOR ALL USING (true) WITH CHECK (true);

-- ── ENROLLMENTS ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.enrollments;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_public_read"                   ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_auth_write"                    ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_auth_update"                   ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_auth_delete"                   ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_open"                          ON public.enrollments;
CREATE POLICY "enrollments_open" ON public.enrollments FOR ALL USING (true) WITH CHECK (true);

-- ── SCHEDULE_SESSIONS ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.schedule_sessions;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.schedule_sessions;
DROP POLICY IF EXISTS "schedule_sessions_public_read"             ON public.schedule_sessions;
DROP POLICY IF EXISTS "schedule_sessions_auth_write"              ON public.schedule_sessions;
DROP POLICY IF EXISTS "schedule_sessions_auth_update"             ON public.schedule_sessions;
DROP POLICY IF EXISTS "schedule_sessions_auth_delete"             ON public.schedule_sessions;
DROP POLICY IF EXISTS "schedule_sessions_open"                    ON public.schedule_sessions;
CREATE POLICY "schedule_sessions_open" ON public.schedule_sessions FOR ALL USING (true) WITH CHECK (true);

-- ── ASSESSMENTS ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.assessments;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.assessments;
DROP POLICY IF EXISTS "assessments_public_read"                   ON public.assessments;
DROP POLICY IF EXISTS "assessments_auth_write"                    ON public.assessments;
DROP POLICY IF EXISTS "assessments_auth_update"                   ON public.assessments;
DROP POLICY IF EXISTS "assessments_auth_delete"                   ON public.assessments;
DROP POLICY IF EXISTS "assessments_open"                          ON public.assessments;
CREATE POLICY "assessments_open" ON public.assessments FOR ALL USING (true) WITH CHECK (true);

-- ── EMPLOYEES ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_authenticated_read"              ON public.employees;
DROP POLICY IF EXISTS "employees_public_read"                     ON public.employees;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.employees;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.employees;
DROP POLICY IF EXISTS "employees_open"                            ON public.employees;
CREATE POLICY "employees_open" ON public.employees FOR ALL USING (true) WITH CHECK (true);

-- ── PROJECTS ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.projects;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.projects;
DROP POLICY IF EXISTS "projects_public_read"                      ON public.projects;
DROP POLICY IF EXISTS "projects_auth_write"                       ON public.projects;
DROP POLICY IF EXISTS "projects_auth_update"                      ON public.projects;
DROP POLICY IF EXISTS "projects_auth_delete"                      ON public.projects;
DROP POLICY IF EXISTS "projects_open"                             ON public.projects;
CREATE POLICY "projects_open" ON public.projects FOR ALL USING (true) WITH CHECK (true);

-- ── TASKS ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.tasks;
DROP POLICY IF EXISTS "tasks_public_read"                         ON public.tasks;
DROP POLICY IF EXISTS "tasks_auth_write"                          ON public.tasks;
DROP POLICY IF EXISTS "tasks_auth_update"                         ON public.tasks;
DROP POLICY IF EXISTS "tasks_auth_delete"                         ON public.tasks;
DROP POLICY IF EXISTS "tasks_open"                                ON public.tasks;
CREATE POLICY "tasks_open" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- ── MILESTONES ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.milestones;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.milestones;
DROP POLICY IF EXISTS "milestones_public_read"                    ON public.milestones;
DROP POLICY IF EXISTS "milestones_auth_write"                     ON public.milestones;
DROP POLICY IF EXISTS "milestones_auth_update"                    ON public.milestones;
DROP POLICY IF EXISTS "milestones_auth_delete"                    ON public.milestones;
DROP POLICY IF EXISTS "milestones_open"                           ON public.milestones;
CREATE POLICY "milestones_open" ON public.milestones FOR ALL USING (true) WITH CHECK (true);

-- ── RESOURCE_ALLOCATIONS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.resource_allocations;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_public_read"          ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_auth_write"           ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_auth_update"          ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_auth_delete"          ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_open"                 ON public.resource_allocations;
CREATE POLICY "resource_allocations_open" ON public.resource_allocations FOR ALL USING (true) WITH CHECK (true);

-- ── TIMESHEETS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.timesheets;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_public_read"                    ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_auth_write"                     ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_auth_update"                    ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_auth_delete"                    ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_open"                           ON public.timesheets;
CREATE POLICY "timesheets_open" ON public.timesheets FOR ALL USING (true) WITH CHECK (true);

-- ── EXPENSE_CLAIMS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.expense_claims;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.expense_claims;
DROP POLICY IF EXISTS "expense_claims_public_read"                ON public.expense_claims;
DROP POLICY IF EXISTS "expense_claims_auth_write"                 ON public.expense_claims;
DROP POLICY IF EXISTS "expense_claims_auth_update"                ON public.expense_claims;
DROP POLICY IF EXISTS "expense_claims_auth_delete"                ON public.expense_claims;
DROP POLICY IF EXISTS "expense_claims_open"                       ON public.expense_claims;
CREATE POLICY "expense_claims_open" ON public.expense_claims FOR ALL USING (true) WITH CHECK (true);

-- ── LEAVE_RECORDS ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS leave_full_control                          ON public.leave_records;
DROP POLICY IF EXISTS leave_self                                  ON public.leave_records;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.leave_records;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.leave_records;
DROP POLICY IF EXISTS "leave_records_public_read"                 ON public.leave_records;
DROP POLICY IF EXISTS "leave_records_auth_write"                  ON public.leave_records;
DROP POLICY IF EXISTS "leave_records_auth_update"                 ON public.leave_records;
DROP POLICY IF EXISTS "leave_records_auth_delete"                 ON public.leave_records;
DROP POLICY IF EXISTS "leave_records_open"                        ON public.leave_records;
CREATE POLICY "leave_records_open" ON public.leave_records FOR ALL USING (true) WITH CHECK (true);

-- ── ATTENDANCE_RECORDS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS attendance_full_control                     ON public.attendance_records;
DROP POLICY IF EXISTS attendance_self                             ON public.attendance_records;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.attendance_records;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_public_read"            ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_auth_write"             ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_auth_update"            ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_auth_delete"            ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_open"                   ON public.attendance_records;
CREATE POLICY "attendance_records_open" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);

-- ── WORK_SESSIONS ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS work_sessions_full_control                  ON public.work_sessions;
DROP POLICY IF EXISTS work_sessions_self                          ON public.work_sessions;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.work_sessions;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_public_read"                 ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_auth_write"                  ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_auth_update"                 ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_auth_delete"                 ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_open"                        ON public.work_sessions;
CREATE POLICY "work_sessions_open" ON public.work_sessions FOR ALL USING (true) WITH CHECK (true);

-- ── BREAK_RECORDS ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS break_records_full_control                  ON public.break_records;
DROP POLICY IF EXISTS break_records_self                          ON public.break_records;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.break_records;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.break_records;
DROP POLICY IF EXISTS "break_records_public_read"                 ON public.break_records;
DROP POLICY IF EXISTS "break_records_auth_write"                  ON public.break_records;
DROP POLICY IF EXISTS "break_records_auth_update"                 ON public.break_records;
DROP POLICY IF EXISTS "break_records_auth_delete"                 ON public.break_records;
DROP POLICY IF EXISTS "break_records_open"                        ON public.break_records;
CREATE POLICY "break_records_open" ON public.break_records FOR ALL USING (true) WITH CHECK (true);

-- ── TASK_WORK_SESSIONS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.task_work_sessions;
DROP POLICY IF EXISTS "authenticated_full_access"                 ON public.task_work_sessions;
DROP POLICY IF EXISTS "task_work_sessions_public_read"            ON public.task_work_sessions;
DROP POLICY IF EXISTS "task_work_sessions_auth_write"             ON public.task_work_sessions;
DROP POLICY IF EXISTS "task_work_sessions_auth_update"            ON public.task_work_sessions;
DROP POLICY IF EXISTS "task_work_sessions_auth_delete"            ON public.task_work_sessions;
DROP POLICY IF EXISTS "task_work_sessions_open"                   ON public.task_work_sessions;
CREATE POLICY "task_work_sessions_open" ON public.task_work_sessions FOR ALL USING (true) WITH CHECK (true);

-- ── ROLE CORRECTIONS ──────────────────────────────────────────────────────────
UPDATE public.employees SET role = 'CEO'
  WHERE email ILIKE 'info@thestrategist.co.in' AND role::text != 'CEO';
UPDATE public.employees SET role = 'ADMIN'
  WHERE UPPER(designation) LIKE '%ADMIN%' AND role::text = 'EMPLOYEE';
UPDATE public.employees SET role = 'MANAGER'
  WHERE UPPER(designation) LIKE '%MANAGER%' AND role::text = 'EMPLOYEE';
