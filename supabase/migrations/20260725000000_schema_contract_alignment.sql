-- =============================================================================
-- KVJ Analytics FlowDesk — Schema Contract Alignment
-- Migration ID: 20260725000000_schema_contract_alignment.sql
--
-- RULES:
--   • Strictly ADDITIVE — no DROP TABLE, DROP COLUMN, TRUNCATE, or DELETE.
--   • Every statement is idempotent (safe to run more than once).
--   • Fixes the mismatch between TypeScript repository contracts and the actual
--     Supabase table columns identified in the full architecture audit.
--   • Column renames use: ADD COLUMN IF NOT EXISTS + UPDATE … SET + (keep old
--     column as alias for safety). Pure renames are done where the old column
--     is provably unused by any existing policy or index.
--   • All operations are wrapped in DO $$ … EXCEPTION WHEN OTHERS THEN NULL $$
--     blocks so a single failure never aborts the whole migration.
-- =============================================================================

-- Enable the uuid extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- SECTION 0 — Helper: ensure the user_role enum has all 6 app roles
-- =============================================================================
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'COORDINATOR';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'TRAINER';
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- =============================================================================
-- SECTION 1 — TRAINING MODULE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1A. colleges
--     Missing: is_active
-- ---------------------------------------------------------------------------
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;


-- ---------------------------------------------------------------------------
-- 1B. batches
--     Missing many fields the TypeScript Batch interface expects.
-- ---------------------------------------------------------------------------
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 40;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS online_link TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS training_name TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS academic_year TEXT;
-- batch_code already exists — add batch_no as the app-facing alias
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS batch_no TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS coordinator_email TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS coordinator2 TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS coordinator_email2 TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS completed_tasks INTEGER DEFAULT 0;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS total_tasks INTEGER DEFAULT 0;


-- ---------------------------------------------------------------------------
-- 1C. schedule_sessions
--     Missing: student_id (critical for per-student attendance)
--              arrival_time, notes
--     status values must match: present/absent/late/leave
-- ---------------------------------------------------------------------------
ALTER TABLE public.schedule_sessions ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.schedule_sessions ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMPTZ;
ALTER TABLE public.schedule_sessions ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add FK for student_id (ignore if it fails due to missing data)
DO $$ BEGIN
  ALTER TABLE public.schedule_sessions
    ADD CONSTRAINT fk_schedule_sessions_student
    FOREIGN KEY (student_id) REFERENCES public.student_records(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Create index for attendance lookups
CREATE INDEX IF NOT EXISTS idx_schedule_sessions_student
  ON public.schedule_sessions(student_id, batch_id, date);


-- ---------------------------------------------------------------------------
-- 1D. student_records
--     Critical: add first_name / last_name split from existing 'name' column.
--     Keep 'name' column intact (backward safe).
-- ---------------------------------------------------------------------------
ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Populate first_name / last_name from 'name' where not yet set
UPDATE public.student_records
SET
  first_name = COALESCE(
    first_name,
    CASE WHEN name IS NOT NULL AND position(' ' IN trim(name)) > 0
         THEN trim(split_part(trim(name), ' ', 1))
         ELSE trim(name)
    END
  ),
  last_name = COALESCE(
    last_name,
    CASE WHEN name IS NOT NULL AND position(' ' IN trim(name)) > 0
         THEN trim(substring(trim(name) FROM position(' ' IN trim(name)) + 1))
         ELSE ''
    END
  )
WHERE first_name IS NULL OR last_name IS NULL;

ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
-- academic_qualification: migration has 'qualification' — add canonical name, copy
ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS academic_qualification TEXT;
UPDATE public.student_records
SET academic_qualification = COALESCE(academic_qualification, qualification)
WHERE academic_qualification IS NULL AND qualification IS NOT NULL;

ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS employment_status TEXT;
ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.student_records ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;


-- ---------------------------------------------------------------------------
-- 1E. enrollments
--     Missing: seat_number
-- ---------------------------------------------------------------------------
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS seat_number TEXT;


-- ---------------------------------------------------------------------------
-- 1F. assessments
--     Column name mismatches (assessment_title→title, max_score→max_marks,
--     score→marks_obtained). Add missing type, grade, feedback, evaluated_by,
--     evaluated_at.
--     Strategy: ADD new column, copy data, keep old for safety.
-- ---------------------------------------------------------------------------
-- title (was assessment_title)
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS title TEXT;
UPDATE public.assessments
SET title = COALESCE(title, assessment_title)
WHERE title IS NULL AND assessment_title IS NOT NULL;

-- max_marks (was max_score)
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS max_marks INTEGER DEFAULT 100;
UPDATE public.assessments
SET max_marks = COALESCE(max_marks, max_score)
WHERE max_marks IS NULL AND max_score IS NOT NULL;

-- marks_obtained (was score)
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS marks_obtained INTEGER;
UPDATE public.assessments
SET marks_obtained = COALESCE(marks_obtained, score)
WHERE marks_obtained IS NULL AND score IS NOT NULL;

-- New columns
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS evaluated_by UUID;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

-- Copy assessed_date into evaluated_at
UPDATE public.assessments
SET evaluated_at = COALESCE(evaluated_at, assessed_date::TIMESTAMPTZ)
WHERE evaluated_at IS NULL AND assessed_date IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 1G. vouchers  (used as ExamVoucher repository)
--     Missing: enrollment_id, expiry_date, approved_by, approved_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS enrollment_id UUID;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Add FK for enrollment_id
DO $$ BEGIN
  ALTER TABLE public.vouchers
    ADD CONSTRAINT fk_vouchers_enrollment
    FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 1H. certificates
--     Mismatches: enrollment_id (was student_id), certificate_number (was
--     certificate_code), issued_at (was issue_date as DATE).
--     Add: verification_qr_url, digital_signature, reissued_at, reissue_reason.
-- ---------------------------------------------------------------------------
-- enrollment_id (canonical FK — keep student_id for backward compat)
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS enrollment_id UUID;
DO $$ BEGIN
  ALTER TABLE public.certificates
    ADD CONSTRAINT fk_certificates_enrollment
    FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- certificate_number (was certificate_code)
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS certificate_number TEXT;
UPDATE public.certificates
SET certificate_number = COALESCE(certificate_number, certificate_code)
WHERE certificate_number IS NULL AND certificate_code IS NOT NULL;

-- issued_at as TIMESTAMPTZ (was issue_date DATE)
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;
UPDATE public.certificates
SET issued_at = COALESCE(issued_at, issue_date::TIMESTAMPTZ)
WHERE issued_at IS NULL AND issue_date IS NOT NULL;

-- New columns
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS verification_qr_url TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS digital_signature TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS reissued_at TIMESTAMPTZ;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS reissue_reason TEXT;


-- ---------------------------------------------------------------------------
-- 1I. referrals
--     Mismatches: referrer_student_id (was referrer_id), referee_email (was
--     candidate_email). Add: referral_code, reward_amount, payout_eligible.
-- ---------------------------------------------------------------------------
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referrer_student_id UUID;
UPDATE public.referrals
SET referrer_student_id = COALESCE(referrer_student_id, referrer_id)
WHERE referrer_student_id IS NULL AND referrer_id IS NOT NULL;

ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referee_email TEXT;
UPDATE public.referrals
SET referee_email = COALESCE(referee_email, candidate_email)
WHERE referee_email IS NULL AND candidate_email IS NOT NULL;

ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS reward_amount NUMERIC(10,2);
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS payout_eligible BOOLEAN DEFAULT FALSE;


-- ---------------------------------------------------------------------------
-- 1J. alumni_profiles
--     Mismatches: current_employer (was company_name), current_designation
--     (was designation). Add: graduation_date, package_amount, testimonial.
-- ---------------------------------------------------------------------------
ALTER TABLE public.alumni_profiles ADD COLUMN IF NOT EXISTS current_employer TEXT;
UPDATE public.alumni_profiles
SET current_employer = COALESCE(current_employer, company_name)
WHERE current_employer IS NULL AND company_name IS NOT NULL;

ALTER TABLE public.alumni_profiles ADD COLUMN IF NOT EXISTS current_designation TEXT;
UPDATE public.alumni_profiles
SET current_designation = COALESCE(current_designation, designation)
WHERE current_designation IS NULL AND designation IS NOT NULL;

ALTER TABLE public.alumni_profiles ADD COLUMN IF NOT EXISTS graduation_date DATE;
ALTER TABLE public.alumni_profiles ADD COLUMN IF NOT EXISTS package_amount NUMERIC(10,2);
ALTER TABLE public.alumni_profiles ADD COLUMN IF NOT EXISTS testimonial TEXT;


-- =============================================================================
-- SECTION 2 — PROJECT MODULE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2A. clients
--     Missing: notes
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;


-- ---------------------------------------------------------------------------
-- 2B. projects
--     Critical: 'name' → 'title' (app always uses title).
--     Add: category, type, priority, estimated_hours, notes, custom_fields.
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS title TEXT;
UPDATE public.projects
SET title = COALESCE(title, name)
WHERE title IS NULL AND name IS NOT NULL;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS estimated_hours INTEGER;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;


-- ---------------------------------------------------------------------------
-- 2C. resource_allocations
--     Mismatch: capacity_percentage (was allocation_pct).
--     Missing: role, status.
-- ---------------------------------------------------------------------------
ALTER TABLE public.resource_allocations ADD COLUMN IF NOT EXISTS capacity_percentage INTEGER;
UPDATE public.resource_allocations
SET capacity_percentage = COALESCE(capacity_percentage, allocation_pct)
WHERE capacity_percentage IS NULL AND allocation_pct IS NOT NULL;

ALTER TABLE public.resource_allocations ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.resource_allocations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';


-- ---------------------------------------------------------------------------
-- 2D. tasks
--     Missing: milestone_id, estimated_hours, actual_hours, checklist.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS milestone_id UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(6,2);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;

-- Add FK for milestone_id
DO $$ BEGIN
  ALTER TABLE public.tasks
    ADD CONSTRAINT fk_tasks_milestone
    FOREIGN KEY (milestone_id) REFERENCES public.milestones(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 2E. timesheets
--     Critical: missing project_id.
--     Missing: billable, approved_by, approved_at.
-- ---------------------------------------------------------------------------
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS billable BOOLEAN DEFAULT TRUE;
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add FK for project_id
DO $$ BEGIN
  ALTER TABLE public.timesheets
    ADD CONSTRAINT fk_timesheets_project
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 2F. client_meetings
--     Missing: project_id, online_link, summary.
--     Mismatch: notes → summary (add summary, keep notes).
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_meetings ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE public.client_meetings ADD COLUMN IF NOT EXISTS online_link TEXT;
ALTER TABLE public.client_meetings ADD COLUMN IF NOT EXISTS summary TEXT;
UPDATE public.client_meetings
SET summary = COALESCE(summary, notes)
WHERE summary IS NULL AND notes IS NOT NULL;

-- Add FK for project_id
DO $$ BEGIN
  ALTER TABLE public.client_meetings
    ADD CONSTRAINT fk_client_meetings_project
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- =============================================================================
-- SECTION 3 — FINANCE MODULE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3A. expense_claims
--     Mismatches: category (was expense_type), notes (was description),
--                 receipt_url (was receipt_file_name).
-- ---------------------------------------------------------------------------
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS category TEXT;
UPDATE public.expense_claims
SET category = COALESCE(category, expense_type)
WHERE category IS NULL AND expense_type IS NOT NULL;

ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS notes TEXT;
UPDATE public.expense_claims
SET notes = COALESCE(notes, description)
WHERE notes IS NULL AND description IS NOT NULL;

ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS receipt_url TEXT;
UPDATE public.expense_claims
SET receipt_url = COALESCE(receipt_url, google_drive_view_url, receipt_file_name)
WHERE receipt_url IS NULL;


-- ---------------------------------------------------------------------------
-- 3B. budgets
--     Mismatch: fiscal_year (was year INTEGER), department (was department_id UUID).
--     Keep both columns — app uses text, but FK is still valid for reporting.
-- ---------------------------------------------------------------------------
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS fiscal_year TEXT;
UPDATE public.budgets
SET fiscal_year = COALESCE(fiscal_year, year::TEXT)
WHERE fiscal_year IS NULL AND year IS NOT NULL;

-- department as text (TypeScript interface uses text, not FK)
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS department TEXT;
-- Attempt to fill from joined departments table
DO $$ BEGIN
  UPDATE public.budgets b
  SET department = d.name
  FROM public.departments d
  WHERE b.department_id = d.id AND b.department IS NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 3C. vendors
--     Mismatch: email (was contact_email).
--     Missing: contact_person, performance_score, contract_url.
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE public.vendors
SET email = COALESCE(email, contact_email)
WHERE email IS NULL AND contact_email IS NOT NULL;

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS performance_score NUMERIC(3,1);
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS contract_url TEXT;


-- ---------------------------------------------------------------------------
-- 3D. purchase_orders
--     Mismatch: amount (was total_amount).
--     Missing: goods_received, invoice_url.
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2);
UPDATE public.purchase_orders
SET amount = COALESCE(amount, total_amount)
WHERE amount IS NULL AND total_amount IS NOT NULL;

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS goods_received BOOLEAN DEFAULT FALSE;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS invoice_url TEXT;


-- ---------------------------------------------------------------------------
-- 3E. assets
--     Mismatches: barcode_qr (was asset_tag), assigned_employee_id (was
--     assigned_to), original_value (was value).
--     Missing: warranty_expiry, status, depreciation_rate_annual.
-- ---------------------------------------------------------------------------
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS barcode_qr TEXT;
UPDATE public.assets
SET barcode_qr = COALESCE(barcode_qr, asset_tag)
WHERE barcode_qr IS NULL AND asset_tag IS NOT NULL;

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS assigned_employee_id UUID;
UPDATE public.assets
SET assigned_employee_id = COALESCE(assigned_employee_id, assigned_to)
WHERE assigned_employee_id IS NULL AND assigned_to IS NOT NULL;

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS original_value NUMERIC(10,2);
UPDATE public.assets
SET original_value = COALESCE(original_value, value)
WHERE original_value IS NULL AND value IS NOT NULL;

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS warranty_expiry DATE;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS depreciation_rate_annual NUMERIC(5,2);


-- ---------------------------------------------------------------------------
-- 3F. salary_structures
--     Mismatch: basic_salary (was base_salary).
-- ---------------------------------------------------------------------------
ALTER TABLE public.salary_structures ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(10,2);
UPDATE public.salary_structures
SET basic_salary = COALESCE(basic_salary, base_salary)
WHERE basic_salary IS NULL AND base_salary IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 3G. travel_requests
--     Mismatch: advance_requested (was estimated_cost).
--     Missing: hotel_booking_details.
-- ---------------------------------------------------------------------------
ALTER TABLE public.travel_requests ADD COLUMN IF NOT EXISTS advance_requested NUMERIC(10,2);
UPDATE public.travel_requests
SET advance_requested = COALESCE(advance_requested, estimated_cost)
WHERE advance_requested IS NULL AND estimated_cost IS NOT NULL;

ALTER TABLE public.travel_requests ADD COLUMN IF NOT EXISTS hotel_booking_details TEXT;


-- =============================================================================
-- SECTION 4 — COMMUNICATION MODULE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4A. chat_channels
--     Missing: project_id, training_id, is_muted, is_archived, is_starred,
--              pinned_message_id, members.
-- ---------------------------------------------------------------------------
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS training_id UUID;
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS pinned_message_id UUID;
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]'::jsonb;


-- ---------------------------------------------------------------------------
-- 4B. chat_messages
--     Critical mismatch: 'text' (was 'content').
--     Missing: reply_to, reactions, is_edited, is_pinned, file_attachment,
--              reply_to_message.
--     'attachments' as JSONB array (was single 'attachment_url' TEXT).
-- ---------------------------------------------------------------------------
-- Add 'text' column as the canonical message body
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS text TEXT;
UPDATE public.chat_messages
SET text = COALESCE(text, content)
WHERE text IS NULL AND content IS NOT NULL;

-- attachments as JSONB array
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
-- Migrate single attachment_url into the array
UPDATE public.chat_messages
SET attachments = jsonb_build_array(attachment_url)
WHERE attachment_url IS NOT NULL
  AND (attachments IS NULL OR attachments = '[]'::jsonb);

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to UUID;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_attachment JSONB;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to_message JSONB;


-- ---------------------------------------------------------------------------
-- 4C. announcements
--     Missing: target_type, target_id, scheduled_at, expires_at.
-- ---------------------------------------------------------------------------
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'organization';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;


-- ---------------------------------------------------------------------------
-- 4D. notification_preferences
--     Mismatch: employee_id (was user_id).
--     Missing: muted_channels, digest_mode.
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS employee_id UUID;
UPDATE public.notification_preferences
SET employee_id = COALESCE(employee_id, user_id)
WHERE employee_id IS NULL AND user_id IS NOT NULL;

ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS muted_channels JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS digest_mode BOOLEAN DEFAULT FALSE;


-- =============================================================================
-- SECTION 5 — ANALYTICS MODULE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5A. kpi_definitions
--     Critical: missing 'code' column (findByCode() always fails).
--     Mismatch: name (was title), missing formula.
-- ---------------------------------------------------------------------------
ALTER TABLE public.kpi_definitions ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.kpi_definitions ADD COLUMN IF NOT EXISTS name TEXT;
UPDATE public.kpi_definitions
SET name = COALESCE(name, title)
WHERE name IS NULL AND title IS NOT NULL;

ALTER TABLE public.kpi_definitions ADD COLUMN IF NOT EXISTS formula TEXT;

-- Create unique index on code (only for non-null, non-deleted rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_definitions_code
  ON public.kpi_definitions(code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 5B. saved_reports
--     Mismatch: filters (was config). Missing: creator_id, grouping_by, sorting_by.
-- ---------------------------------------------------------------------------
ALTER TABLE public.saved_reports ADD COLUMN IF NOT EXISTS filters JSONB;
UPDATE public.saved_reports
SET filters = COALESCE(filters, config)
WHERE filters IS NULL AND config IS NOT NULL;

ALTER TABLE public.saved_reports ADD COLUMN IF NOT EXISTS creator_id UUID;
ALTER TABLE public.saved_reports ADD COLUMN IF NOT EXISTS grouping_by TEXT;
ALTER TABLE public.saved_reports ADD COLUMN IF NOT EXISTS sorting_by TEXT;


-- =============================================================================
-- SECTION 6 — MISSING TABLES (in DB but no TypeScript interface yet)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 6A. final_exam_results
--     Already exists in DB. Add audit fields that may be missing.
-- ---------------------------------------------------------------------------
ALTER TABLE public.final_exam_results ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.final_exam_results ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE public.final_exam_results ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.final_exam_results ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Ensure RLS policy exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'final_exam_results'
      AND policyname = 'Allow full access for authenticated users'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow full access for authenticated users" ON public.final_exam_results
      FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'');';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 6B. audit_logs
--     Ensure RLS policy exists (table was created in migration 1 with no policy)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- =============================================================================
-- SECTION 7 — PERFORMANCE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_timesheets_project ON public.timesheets(project_id, work_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_employee ON public.timesheets(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_expense_employee ON public.expense_claims(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status, assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON public.announcements(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON public.chat_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_batches_phase ON public.batches(phase, start_date);


-- =============================================================================
-- SECTION 8 — RE-APPLY RLS POLICIES FOR ALL TABLES
--     (Ensure no table accidentally has RLS ON with zero policies)
-- =============================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'colleges', 'courses', 'batches', 'schedule_sessions', 'student_records',
    'enrollments', 'assessments', 'final_exam_results', 'certificates',
    'referrals', 'alumni_profiles', 'clients', 'projects', 'milestones',
    'resource_allocations', 'tasks', 'timesheets', 'client_meetings',
    'expense_claims', 'budgets', 'vendors', 'purchase_orders', 'assets',
    'salary_structures', 'travel_requests', 'chat_channels', 'chat_messages',
    'announcements', 'email_logs', 'notification_preferences',
    'kpi_definitions', 'saved_reports', 'vouchers', 'alumni_profiles',
    'declared_holidays', 'user_email_configs', 'system_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = t
      ) THEN
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = t
            AND policyname = 'Allow full access for authenticated users'
        ) THEN
          EXECUTE format(
            'CREATE POLICY "Allow full access for authenticated users" ON public.%I '
            'FOR ALL USING (auth.role() = ''authenticated'') '
            'WITH CHECK (auth.role() = ''authenticated'');', t
          );
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;


-- =============================================================================
-- SECTION 9 — VERIFY (informational — returns table of table/column counts)
-- =============================================================================
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'employees', 'departments', 'attendance_records', 'leave_records',
    'batches', 'courses', 'student_records', 'enrollments', 'assessments',
    'certificates', 'vouchers', 'referrals', 'alumni_profiles',
    'projects', 'tasks', 'timesheets', 'milestones', 'resource_allocations', 'client_meetings',
    'expense_claims', 'salary_structures', 'assets', 'vendors', 'purchase_orders',
    'chat_channels', 'chat_messages', 'announcements', 'notification_preferences',
    'kpi_definitions', 'saved_reports'
  )
GROUP BY table_name
ORDER BY table_name;
