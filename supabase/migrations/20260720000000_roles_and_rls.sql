-- =============================================================================
-- Roles & Permissions (backend source of truth)  — 4-role model
-- Mirrors src/shared/permissions: ADMIN/CEO/MANAGER = full control + full
-- visibility; EMPLOYEE = self-scoped ("user-level security").
--
-- The frontend permission engine (permission-engine.ts) is a MIRROR used only to
-- hide/disable UI. THESE RLS POLICIES ARE THE ENFORCEMENT. Assumes Supabase Auth
-- with employees.id = auth.users.id.
-- =============================================================================

-- 1) Role enum + column ------------------------------------------------------
CREATE TYPE user_role AS ENUM ('ADMIN', 'CEO', 'MANAGER', 'EMPLOYEE');

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'EMPLOYEE';

-- 2) Reusable permission helpers (the backend equivalent of can()/isFullControl)
--    SECURITY DEFINER so a row's own RLS doesn't recurse while resolving a role.
CREATE OR REPLACE FUNCTION public.current_role()
  RETURNS user_role
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM employees WHERE id = auth.uid();
$$;

-- Full control + full visibility: Admin, CEO, Manager.
CREATE OR REPLACE FUNCTION public.is_full_control()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.current_role() IN ('ADMIN', 'CEO', 'MANAGER');
$$;

-- 3) Enable RLS on every business table -------------------------------------
ALTER TABLE employees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_records          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_records          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;

-- 4) Policies ----------------------------------------------------------------
-- Convention: full-control roles get an ALL policy over everything; employees
-- get scoped policies over their OWN rows only.

-- employees: full control sees/edits all; an employee sees/edits only self.
CREATE POLICY employees_full_control ON employees
  FOR ALL USING (public.is_full_control()) WITH CHECK (public.is_full_control());
CREATE POLICY employees_self_select ON employees
  FOR SELECT USING (id = auth.uid());
CREATE POLICY employees_self_update ON employees
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- departments: full control writes; everyone authenticated may read.
CREATE POLICY departments_full_control ON departments
  FOR ALL USING (public.is_full_control()) WITH CHECK (public.is_full_control());
CREATE POLICY departments_read ON departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- attendance_records: full control all; employee only own rows.
CREATE POLICY attendance_full_control ON attendance_records
  FOR ALL USING (public.is_full_control()) WITH CHECK (public.is_full_control());
CREATE POLICY attendance_self ON attendance_records
  FOR ALL USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());

-- work_sessions: full control all; employee only sessions on their own record.
CREATE POLICY work_sessions_full_control ON work_sessions
  FOR ALL USING (public.is_full_control()) WITH CHECK (public.is_full_control());
CREATE POLICY work_sessions_self ON work_sessions
  FOR ALL USING (
    attendance_record_id IN (SELECT id FROM attendance_records WHERE employee_id = auth.uid())
  ) WITH CHECK (
    attendance_record_id IN (SELECT id FROM attendance_records WHERE employee_id = auth.uid())
  );

-- break_records: full control all; employee only breaks on their own sessions.
CREATE POLICY break_records_full_control ON break_records
  FOR ALL USING (public.is_full_control()) WITH CHECK (public.is_full_control());
CREATE POLICY break_records_self ON break_records
  FOR ALL USING (
    work_session_id IN (
      SELECT ws.id FROM work_sessions ws
      JOIN attendance_records ar ON ar.id = ws.attendance_record_id
      WHERE ar.employee_id = auth.uid()
    )
  ) WITH CHECK (
    work_session_id IN (
      SELECT ws.id FROM work_sessions ws
      JOIN attendance_records ar ON ar.id = ws.attendance_record_id
      WHERE ar.employee_id = auth.uid()
    )
  );

-- attendance_corrections: full control approves/sees all; employee raises + sees own.
CREATE POLICY corrections_full_control ON attendance_corrections
  FOR ALL USING (public.is_full_control()) WITH CHECK (public.is_full_control());
CREATE POLICY corrections_self ON attendance_corrections
  FOR ALL USING (requested_by = auth.uid()) WITH CHECK (requested_by = auth.uid());

-- leave_records: full control approves/sees all; employee creates + sees own.
CREATE POLICY leave_full_control ON leave_records
  FOR ALL USING (public.is_full_control()) WITH CHECK (public.is_full_control());
CREATE POLICY leave_self ON leave_records
  FOR ALL USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());

-- audit_logs: full control reads; the system (definer functions) writes.
CREATE POLICY audit_full_control ON audit_logs
  FOR SELECT USING (public.is_full_control());
