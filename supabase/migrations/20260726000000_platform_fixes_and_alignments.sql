-- Supabase Migration: 20260726000000_platform_fixes_and_alignments.sql
-- Alignment & bug fixes for Attendance Claims, Task Approvals, Declared Holidays, Colleges, and Courses

-- 1. Make attendance_record_id nullable in attendance_corrections for claims without prior clock-in
ALTER TABLE public.attendance_corrections ALTER COLUMN attendance_record_id DROP NOT NULL;

-- 2. Add task approval workflow columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approval_status TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.employees(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS rework_notes TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS rework_requested_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_by_employee_id UUID REFERENCES public.employees(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.employees(id);

-- 3. Add columns to declared_holidays
ALTER TABLE public.declared_holidays ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Company Holiday';
ALTER TABLE public.declared_holidays ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 4. Add logo_url and image_url to colleges
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 5. Add max_marks, pass_percentage, and checklist to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS max_marks INTEGER DEFAULT 100;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS pass_percentage INTEGER DEFAULT 50;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
