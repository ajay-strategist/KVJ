-- =============================================================================
-- Migration: Phase 6.45 — Employees Guard Hardening
--
-- Restricts non-admin updates to:
--   - employee_id (employee code)
--   - deleted_at
--   - deleted_by
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.flwdsk_employees_guard_privileged()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Trusted server-side contexts (service_role, direct SQL / provisioning, edge
  -- functions) run with no end-user JWT, so auth.uid() is NULL. RLS already
  -- prevents authenticated non-admins and anon from reaching this trigger on
  -- rows they do not own, so allowing the null-session path here does not open a
  -- self-escalation route — it only preserves provisioning (provision-admin.sql,
  -- align-user-roles.sql) and other backend maintenance.
  IF auth.uid() IS NULL OR public.is_training_admin() THEN
    RETURN NEW;  -- admins/managers + trusted backend may manage employees
  END IF;

  IF NEW.id                      IS DISTINCT FROM OLD.id
     OR NEW.employee_id          IS DISTINCT FROM OLD.employee_id
     OR NEW.role                 IS DISTINCT FROM OLD.role
     OR NEW.status               IS DISTINCT FROM OLD.status
     OR NEW.username             IS DISTINCT FROM OLD.username
     OR NEW.email                IS DISTINCT FROM OLD.email
     OR NEW.reporting_manager_id IS DISTINCT FROM OLD.reporting_manager_id
     OR NEW.department_id         IS DISTINCT FROM OLD.department_id
     OR NEW.designation           IS DISTINCT FROM OLD.designation
     OR NEW.deleted_at           IS DISTINCT FROM OLD.deleted_at
     OR NEW.deleted_by           IS DISTINCT FROM OLD.deleted_by
  THEN
    RAISE EXCEPTION 'Not authorized to modify privileged employee fields (role/status/identity/deletion).';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
