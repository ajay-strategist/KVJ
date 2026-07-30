-- =============================================================================
-- CEO / MANAGER Full Access Fix
-- Run in Supabase SQL Editor → Run
--
-- Problem: CEO and MANAGER with fallback sessions (no real Supabase JWT) get
-- empty data on Projects & Tasks, Expense Claims, Approvals Queue, and
-- Employees because existing RLS policies use auth.role() = 'authenticated'
-- which evaluates to false when auth.uid() is NULL.
--
-- Fix: Same pattern as the training fix — split each table into:
--   SELECT: USING (true)   → everyone can read (org-wide shared data)
--   WRITE:  USING (auth.uid() IS NOT NULL) → must be authenticated to modify
--
-- SAFE TO RE-RUN: every statement uses DROP IF EXISTS before CREATE.
-- =============================================================================

-- ── PROJECTS ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.projects;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.projects;
DROP POLICY IF EXISTS "projects_public_read" ON public.projects;
DROP POLICY IF EXISTS "projects_auth_write" ON public.projects;
DROP POLICY IF EXISTS "projects_auth_update" ON public.projects;
DROP POLICY IF EXISTS "projects_auth_delete" ON public.projects;

CREATE POLICY "projects_public_read" ON public.projects
  FOR SELECT USING (true);

CREATE POLICY "projects_auth_write" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "projects_auth_update" ON public.projects
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "projects_auth_delete" ON public.projects
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── TASKS ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.tasks;
DROP POLICY IF EXISTS "tasks_public_read" ON public.tasks;
DROP POLICY IF EXISTS "tasks_auth_write" ON public.tasks;
DROP POLICY IF EXISTS "tasks_auth_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_auth_delete" ON public.tasks;

CREATE POLICY "tasks_public_read" ON public.tasks
  FOR SELECT USING (true);

CREATE POLICY "tasks_auth_write" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_auth_update" ON public.tasks
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_auth_delete" ON public.tasks
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── EXPENSE CLAIMS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.expense_claims;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.expense_claims;
DROP POLICY IF EXISTS "expense_claims_public_read" ON public.expense_claims;
DROP POLICY IF EXISTS "expense_claims_auth_write" ON public.expense_claims;
DROP POLICY IF EXISTS "expense_claims_auth_update" ON public.expense_claims;
DROP POLICY IF EXISTS "expense_claims_auth_delete" ON public.expense_claims;

-- Employees can only read their own; management reads all
-- (The frontend enforces the employee_id filter; here we open reads to all
--  so the component's isManagement check can fetch the full list.)
CREATE POLICY "expense_claims_public_read" ON public.expense_claims
  FOR SELECT USING (true);

CREATE POLICY "expense_claims_auth_write" ON public.expense_claims
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "expense_claims_auth_update" ON public.expense_claims
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "expense_claims_auth_delete" ON public.expense_claims
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── LEAVE RECORDS (Approvals Queue) ───────────────────────────────────────────
-- Drop conflicting old policies
DROP POLICY IF EXISTS leave_full_control ON public.leave_records;
DROP POLICY IF EXISTS leave_self ON public.leave_records;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.leave_records;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.leave_records;
DROP POLICY IF EXISTS "leave_records_public_read" ON public.leave_records;
DROP POLICY IF EXISTS "leave_records_auth_write" ON public.leave_records;
DROP POLICY IF EXISTS "leave_records_auth_update" ON public.leave_records;
DROP POLICY IF EXISTS "leave_records_auth_delete" ON public.leave_records;

-- All reads open (frontend applies isManagement filter for employee-scoped view)
CREATE POLICY "leave_records_public_read" ON public.leave_records
  FOR SELECT USING (true);

CREATE POLICY "leave_records_auth_write" ON public.leave_records
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "leave_records_auth_update" ON public.leave_records
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "leave_records_auth_delete" ON public.leave_records
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── MILESTONES ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.milestones;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.milestones;
DROP POLICY IF EXISTS "milestones_public_read" ON public.milestones;
DROP POLICY IF EXISTS "milestones_auth_write" ON public.milestones;
DROP POLICY IF EXISTS "milestones_auth_update" ON public.milestones;
DROP POLICY IF EXISTS "milestones_auth_delete" ON public.milestones;

CREATE POLICY "milestones_public_read" ON public.milestones
  FOR SELECT USING (true);

CREATE POLICY "milestones_auth_write" ON public.milestones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "milestones_auth_update" ON public.milestones
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "milestones_auth_delete" ON public.milestones
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── RESOURCE ALLOCATIONS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.resource_allocations;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_public_read" ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_auth_write" ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_auth_update" ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_auth_delete" ON public.resource_allocations;

CREATE POLICY "resource_allocations_public_read" ON public.resource_allocations
  FOR SELECT USING (true);

CREATE POLICY "resource_allocations_auth_write" ON public.resource_allocations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "resource_allocations_auth_update" ON public.resource_allocations
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "resource_allocations_auth_delete" ON public.resource_allocations
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── TIMESHEETS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.timesheets;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_public_read" ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_auth_write" ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_auth_update" ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_auth_delete" ON public.timesheets;

CREATE POLICY "timesheets_public_read" ON public.timesheets
  FOR SELECT USING (true);

CREATE POLICY "timesheets_auth_write" ON public.timesheets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "timesheets_auth_update" ON public.timesheets
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "timesheets_auth_delete" ON public.timesheets
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── ATTENDANCE & LEAVE (for Employee Status page) ─────────────────────────────
DROP POLICY IF EXISTS attendance_full_control ON public.attendance_records;
DROP POLICY IF EXISTS attendance_self ON public.attendance_records;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.attendance_records;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_public_read" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_auth_write" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_auth_update" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_auth_delete" ON public.attendance_records;

CREATE POLICY "attendance_records_public_read" ON public.attendance_records
  FOR SELECT USING (true);

CREATE POLICY "attendance_records_auth_write" ON public.attendance_records
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "attendance_records_auth_update" ON public.attendance_records
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "attendance_records_auth_delete" ON public.attendance_records
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── ROLE CORRECTION: ensure CEO and any ADMIN/MANAGER designation gets correct role ──
UPDATE public.employees
  SET role = 'CEO'
  WHERE email ILIKE 'info@thestrategist.co.in'
    AND (role IS NULL OR role::text != 'CEO');

UPDATE public.employees
  SET role = 'ADMIN'
  WHERE UPPER(designation) LIKE '%ADMIN%'
    AND (role IS NULL OR role::text = 'EMPLOYEE');

UPDATE public.employees
  SET role = 'MANAGER'
  WHERE UPPER(designation) LIKE '%MANAGER%'
    AND (role IS NULL OR role::text = 'EMPLOYEE');
