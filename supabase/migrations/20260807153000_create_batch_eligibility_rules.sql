-- =============================================================================
-- Migration: Create flwdsk_batch_eligibility_rules table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.flwdsk_batch_eligibility_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID UNIQUE NOT NULL REFERENCES public.flwdsk_batches(id) ON DELETE CASCADE,
    assessment_pass_percentage INT DEFAULT 84 NOT NULL,
    consider_attendance BOOLEAN DEFAULT FALSE NOT NULL,
    attendance_pass_percentage INT DEFAULT 84 NOT NULL,
    eligibility_criteria JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
