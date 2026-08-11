-- =============================================================================
-- Migration: Phase 6.40 — Expense Module RLS & Security Hardening
-- =============================================================================

BEGIN;

-- 1. Helper function to check if caller is an ADMIN, CEO, or MANAGER
CREATE OR REPLACE FUNCTION public.is_expense_manager()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM flwdsk_employees
    WHERE id = auth.uid()
      AND role::text IN ('ADMIN', 'CEO', 'MANAGER')
  );
$$;

-- 2. Enable RLS on flwdsk_expense_claims
ALTER TABLE public.flwdsk_expense_claims ENABLE ROW LEVEL SECURITY;

-- 3. Drop all legacy permissive policies on flwdsk_expense_claims
DROP POLICY IF EXISTS "expense_claims_open" ON public.flwdsk_expense_claims;
DROP POLICY IF EXISTS "expense_claims_public_read" ON public.flwdsk_expense_claims;
DROP POLICY IF EXISTS "expense_claims_auth_write" ON public.flwdsk_expense_claims;
DROP POLICY IF EXISTS "expense_claims_auth_update" ON public.flwdsk_expense_claims;
DROP POLICY IF EXISTS "expense_claims_auth_delete" ON public.flwdsk_expense_claims;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.flwdsk_expense_claims;

-- 4. Create hardened policies
-- SELECT: managers read all; employees read their own claims
CREATE POLICY expense_claims_select ON public.flwdsk_expense_claims
  FOR SELECT
  USING (
    public.is_expense_manager() OR
    employee_id = auth.uid()
  );

-- INSERT: employees insert for themselves; managers insert for anyone
CREATE POLICY expense_claims_insert ON public.flwdsk_expense_claims
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      employee_id = auth.uid() OR
      public.is_expense_manager()
    )
  );

-- UPDATE: managers update any; employees update own claims ONLY if status is still 'submitted' (pending review)
CREATE POLICY expense_claims_update ON public.flwdsk_expense_claims
  FOR UPDATE
  USING (
    public.is_expense_manager() OR (
      employee_id = auth.uid() AND
      status = 'submitted'
    )
  )
  WITH CHECK (
    public.is_expense_manager() OR (
      employee_id = auth.uid() AND
      status = 'submitted'
    )
  );

-- DELETE: managers delete any; employees delete own claims ONLY if status is still 'submitted'
CREATE POLICY expense_claims_delete ON public.flwdsk_expense_claims
  FOR DELETE
  USING (
    public.is_expense_manager() OR (
      employee_id = auth.uid() AND
      status = 'submitted'
    )
  );

-- 5. Harden custom expense types insertion
DROP POLICY IF EXISTS "Allow public insert custom expense types" ON public.flwdsk_expense_types;

CREATE POLICY "Allow authenticated insert custom expense types" ON public.flwdsk_expense_types
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

COMMIT;
