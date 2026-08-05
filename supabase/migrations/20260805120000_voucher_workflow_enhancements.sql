-- Migration: 20260805120000_voucher_workflow_enhancements.sql
-- Description: Advanced vouchers, multiple attempts, retests, email logs, and audit logs.

-- 1. Extend flwdsk_vouchers table
ALTER TABLE public.flwdsk_vouchers ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.flwdsk_student_records(id) ON DELETE SET NULL;
ALTER TABLE public.flwdsk_vouchers ADD COLUMN IF NOT EXISTS voucher_type TEXT DEFAULT 'Initial'; -- 'Initial' | 'Retest'
ALTER TABLE public.flwdsk_vouchers ADD COLUMN IF NOT EXISTS assigned_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.flwdsk_vouchers ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.flwdsk_employees(id) ON DELETE SET NULL;
ALTER TABLE public.flwdsk_vouchers ADD COLUMN IF NOT EXISTS payment_verified TEXT DEFAULT 'Pending'; -- 'Pending' | 'Verified' | 'Rejected'
ALTER TABLE public.flwdsk_vouchers ADD COLUMN IF NOT EXISTS sent_status TEXT DEFAULT 'Pending'; -- 'Pending' | 'Sent'
ALTER TABLE public.flwdsk_vouchers ADD COLUMN IF NOT EXISTS sent_time TIMESTAMPTZ;

-- Disable Row Level Security on flwdsk_vouchers
ALTER TABLE public.flwdsk_vouchers DISABLE ROW LEVEL SECURITY;

-- 2. Create flwdsk_exam_attempts table
CREATE TABLE IF NOT EXISTS public.flwdsk_exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.flwdsk_student_records(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.flwdsk_batches(id) ON DELETE CASCADE,
    attempt_type TEXT NOT NULL, -- 'Initial' | 'Retest'
    attempt_number INTEGER DEFAULT 1,
    mark INTEGER NOT NULL CHECK (mark >= 0 AND mark <= 100),
    result TEXT NOT NULL, -- 'Passed' | 'Failed'
    screenshot_url TEXT,
    submitted_by TEXT NOT NULL, -- 'Student' | 'Trainer Manual Entry'
    updated_by UUID REFERENCES public.flwdsk_employees(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Disable Row Level Security on flwdsk_exam_attempts
ALTER TABLE public.flwdsk_exam_attempts DISABLE ROW LEVEL SECURITY;

-- 3. Extend flwdsk_email_logs table
ALTER TABLE public.flwdsk_email_logs ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.flwdsk_student_records(id) ON DELETE SET NULL;
ALTER TABLE public.flwdsk_email_logs ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.flwdsk_batches(id) ON DELETE SET NULL;
ALTER TABLE public.flwdsk_email_logs ADD COLUMN IF NOT EXISTS mail_type TEXT; -- 'Voucher Mail' | 'Congratulations' | 'Reminder' | 'Retest'
ALTER TABLE public.flwdsk_email_logs ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES public.flwdsk_employees(id) ON DELETE SET NULL;

-- Disable Row Level Security on flwdsk_email_logs
ALTER TABLE public.flwdsk_email_logs DISABLE ROW LEVEL SECURITY;
