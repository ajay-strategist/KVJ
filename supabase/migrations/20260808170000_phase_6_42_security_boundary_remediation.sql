-- =============================================================================
-- Migration: Phase 6.42 — Security Boundary Remediation, RLS Hardening & Integrity
--
-- Remediates the Phase 6.41 forensic-audit findings:
--   F1  Blanket "Allow full access for authenticated users" / USING(true) policy
--       reintroduction that OR-combines with restrictive policies and nullifies
--       all Phase 6.30 / 6.40 isolation.
--   F2  Training tables where Phase 6.30 enabled RLS but did not drop a surviving
--       legacy blanket policy (exam_attempts, vouchers, calendar_sessions,
--       email_logs, audit_logs, retest_payment_verifications, eligibility_rules).
--   F3  flwdsk_employees had no restrictive RLS of its own -> employee role
--       self-escalation surface.
--   F4  flwdsk_expense_claims.amount had no DB-level integrity constraint.
--   F5  No DB-level duplicate protection for calendar sessions.
--
-- Every statement is idempotent and additive/converging. Nothing legitimate is
-- dropped: only PERMISSIVE blanket policies (qual = true, or
-- auth.role() = 'authenticated', or the well-known blanket policy name) are
-- removed. Relationship/ownership policies from 6.30/6.40 (which use
-- is_training_admin(), auth.uid() = ..., employee_id = ..., is_batch_trainer()...)
-- are matched by neither predicate and are preserved.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- F1 + F2 — Purge blanket PERMISSIVE policies from every protected table.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  protected text[] := ARRAY[
    'flwdsk_expense_claims', 'flwdsk_expense_types',
    'flwdsk_student_records', 'flwdsk_enrollments',
    'flwdsk_batches', 'flwdsk_courses', 'flwdsk_colleges',
    'flwdsk_schedule_sessions', 'flwdsk_assessments', 'flwdsk_certificates',
    'flwdsk_exam_attempts', 'flwdsk_vouchers', 'flwdsk_calendar_sessions',
    'flwdsk_retest_payment_verifications', 'flwdsk_batch_eligibility_rules',
    'flwdsk_final_exam_results', 'flwdsk_email_logs', 'flwdsk_audit_logs',
    'flwdsk_employees'
  ];
BEGIN
  FOR r IN
    SELECT pol.tablename, pol.policyname
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename = ANY(protected)
      AND (
            pol.policyname = 'Allow full access for authenticated users'
        OR  coalesce(pol.qual, '')       ILIKE '%auth.role() = ''authenticated''%'
        OR  coalesce(pol.with_check, '') ILIKE '%auth.role() = ''authenticated''%'
        OR  btrim(coalesce(pol.qual, ''))       = 'true'
        OR  btrim(coalesce(pol.with_check, '')) = 'true'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
    RAISE NOTICE 'F1/F2: dropped blanket policy % on %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- F2 — Ensure calendar RLS is ENABLED and carries the same relationship policies
-- as the rest of the Training module. (create_calendar_sessions.sql historically
-- DISABLEd RLS on this table; converge it to the secure state.)
-- The is_training_admin()/is_batch_trainer() helpers are created by Phase 6.30.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'flwdsk_calendar_sessions') THEN
    EXECUTE 'ALTER TABLE public.flwdsk_calendar_sessions ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename='flwdsk_calendar_sessions'
                     AND policyname='calendar_sessions_select') THEN
      EXECUTE $p$CREATE POLICY calendar_sessions_select ON public.flwdsk_calendar_sessions
        FOR SELECT USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))$p$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename='flwdsk_calendar_sessions'
                     AND policyname='calendar_sessions_write') THEN
      EXECUTE $p$CREATE POLICY calendar_sessions_write ON public.flwdsk_calendar_sessions
        FOR ALL USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))
        WITH CHECK (public.is_training_admin() OR public.is_batch_trainer(batch_id))$p$;
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- F3 — flwdsk_employees: restrictive RLS + a BEFORE UPDATE guard that blocks
-- non-admins from mutating privileged/identity columns (role escalation).
--
-- RLS alone cannot compare NEW vs OLD, so the trigger is the actual escalation
-- guard; the policies scope which rows a caller may touch at all.
-- -----------------------------------------------------------------------------
ALTER TABLE public.flwdsk_employees ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user may read the employee directory (preserves
-- existing app behavior: assignment pickers, chat, org views). Anonymous reads
-- remain blocked; the redacted anon path is the flwdsk_get_employee RPC.
DROP POLICY IF EXISTS employees_select ON public.flwdsk_employees;
CREATE POLICY employees_select ON public.flwdsk_employees
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: only training admins may create employee rows.
DROP POLICY IF EXISTS employees_insert ON public.flwdsk_employees;
CREATE POLICY employees_insert ON public.flwdsk_employees
  FOR INSERT WITH CHECK (public.is_training_admin());

-- UPDATE: admins may update anyone; an employee may update only their own row.
-- Column-level protection is enforced by the trigger below.
DROP POLICY IF EXISTS employees_update ON public.flwdsk_employees;
CREATE POLICY employees_update ON public.flwdsk_employees
  FOR UPDATE
  USING (public.is_training_admin() OR id = auth.uid())
  WITH CHECK (public.is_training_admin() OR id = auth.uid());

-- DELETE: admins only.
DROP POLICY IF EXISTS employees_delete ON public.flwdsk_employees;
CREATE POLICY employees_delete ON public.flwdsk_employees
  FOR DELETE USING (public.is_training_admin());

-- Guard: a non-admin cannot change any privileged/identity column on any row
-- (including their own). Self-service edits (first/last name, phone, avatar,
-- username stays fixed) remain allowed.
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

  IF NEW.id                   IS DISTINCT FROM OLD.id
     OR NEW.role              IS DISTINCT FROM OLD.role
     OR NEW.status            IS DISTINCT FROM OLD.status
     OR NEW.username          IS DISTINCT FROM OLD.username
     OR NEW.email             IS DISTINCT FROM OLD.email
     OR NEW.reporting_manager_id IS DISTINCT FROM OLD.reporting_manager_id
     OR NEW.department_id      IS DISTINCT FROM OLD.department_id
     OR NEW.designation        IS DISTINCT FROM OLD.designation
  THEN
    RAISE EXCEPTION 'Not authorized to modify privileged employee fields (role/status/identity).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flwdsk_employees_guard_privileged ON public.flwdsk_employees;
CREATE TRIGGER trg_flwdsk_employees_guard_privileged
  BEFORE UPDATE ON public.flwdsk_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.flwdsk_employees_guard_privileged();

-- -----------------------------------------------------------------------------
-- F4 — Financial integrity: expense amount must be present and non-negative.
-- (Column is already NUMERIC(10,2) NOT NULL; add the value CHECK idempotently.)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flwdsk_expense_claims_amount_nonneg'
      AND conrelid = 'public.flwdsk_expense_claims'::regclass
  ) THEN
    ALTER TABLE public.flwdsk_expense_claims
      ADD CONSTRAINT flwdsk_expense_claims_amount_nonneg CHECK (amount >= 0);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- F5 — Calendar duplicate protection. A single batch cannot hold two sessions at
-- the exact same date + start time. UPDATEs (same id) and different slots are
-- unaffected. Created only if the existing data has no such duplicates, so the
-- migration converges safely instead of hard-failing on legacy dupes.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  dup_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='flwdsk_calendar_sessions') THEN
    SELECT count(*) INTO dup_count FROM (
      SELECT 1
      FROM public.flwdsk_calendar_sessions
      WHERE deleted_at IS NULL AND batch_id IS NOT NULL AND start_time IS NOT NULL
      GROUP BY batch_id, date, start_time
      HAVING count(*) > 1
    ) d;

    IF dup_count = 0 THEN
      CREATE UNIQUE INDEX IF NOT EXISTS uq_flwdsk_calendar_slot
        ON public.flwdsk_calendar_sessions (batch_id, date, start_time)
        WHERE deleted_at IS NULL AND batch_id IS NOT NULL AND start_time IS NOT NULL;
    ELSE
      RAISE NOTICE 'F5: % duplicate calendar slot(s) exist; unique index NOT created. Dedupe then re-run.', dup_count;
    END IF;
  END IF;
END $$;

COMMIT;
