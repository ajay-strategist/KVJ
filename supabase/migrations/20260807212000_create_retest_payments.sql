-- =============================================================================
-- Migration: Create flwdsk_retest_payment_verifications table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.flwdsk_retest_payment_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.flwdsk_student_records(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.flwdsk_batches(id) ON DELETE CASCADE,
    voucher_id UUID REFERENCES public.flwdsk_vouchers(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified')),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES public.flwdsk_employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.flwdsk_retest_payment_verifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "retest_verifications_public_read" ON public.flwdsk_retest_payment_verifications;
DROP POLICY IF EXISTS "retest_verifications_auth_write" ON public.flwdsk_retest_payment_verifications;
DROP POLICY IF EXISTS "retest_verifications_auth_update" ON public.flwdsk_retest_payment_verifications;
DROP POLICY IF EXISTS "retest_verifications_auth_delete" ON public.flwdsk_retest_payment_verifications;

-- Create policies matching standard conventions
CREATE POLICY "retest_verifications_public_read" ON public.flwdsk_retest_payment_verifications
    FOR SELECT USING (true);

CREATE POLICY "retest_verifications_auth_write" ON public.flwdsk_retest_payment_verifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "retest_verifications_auth_update" ON public.flwdsk_retest_payment_verifications
    FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "retest_verifications_auth_delete" ON public.flwdsk_retest_payment_verifications
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Indexes for batch-scoped performance
CREATE INDEX IF NOT EXISTS idx_flwdsk_retest_verifications_student_batch 
    ON public.flwdsk_retest_payment_verifications(student_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_flwdsk_retest_verifications_voucher 
    ON public.flwdsk_retest_payment_verifications(voucher_id);

-- Enforce uniqueness of active verification records per student/batch combination
CREATE UNIQUE INDEX IF NOT EXISTS uq_retest_payment_verifications_student_batch
    ON public.flwdsk_retest_payment_verifications(student_id, batch_id)
    WHERE deleted_at IS NULL;
