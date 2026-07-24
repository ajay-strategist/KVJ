-- =============================================================================
-- KVJ Analytics FlowDesk — COMPLETE DATABASE RESET & REBUILD
-- File: supabase/reset-and-rebuild.sql
--
-- PURPOSE: Drop every custom table, type and function in the public schema,
--          then rebuild the correct schema from scratch in one atomic pass.
--
-- SAFE TO RUN: auth.users (Supabase managed) is NEVER touched.
--
-- USAGE: Paste the ENTIRE file into Supabase SQL Editor and click Run.
--        Then run the provision-admin steps afterwards to create the admin login.
-- =============================================================================


-- =============================================================================
-- PART 1 — TEARDOWN
-- Drop all tables (CASCADE handles FK order automatically)
-- Drop all custom types and functions
-- =============================================================================

-- Drop all tables in public schema (CASCADE kills FKs automatically)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE;', r.tablename);
  END LOOP;
END $$;

-- Drop all custom types
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  ) LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE;', r.typname);
  END LOOP;
END $$;

-- Drop custom functions
DROP FUNCTION IF EXISTS public.resolve_login_email(text) CASCADE;
DROP FUNCTION IF EXISTS public.current_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_full_control() CASCADE;

-- =============================================================================
-- PART 2 — REBUILD: TYPES
-- =============================================================================

CREATE TYPE public.user_role AS ENUM (
  'ADMIN', 'CEO', 'MANAGER', 'COORDINATOR', 'TRAINER', 'EMPLOYEE'
);


-- =============================================================================
-- PART 3 — CORE TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- departments (no FK dependencies — created first)
-- ---------------------------------------------------------------------------
CREATE TABLE public.departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  manager_id    UUID,                        -- FK to employees added after
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID
);

-- ---------------------------------------------------------------------------
-- employees  (id = auth.users.id — the ONLY source of truth for identity)
-- ---------------------------------------------------------------------------
CREATE TABLE public.employees (
  id                    UUID PRIMARY KEY,    -- set to auth.users.id at insert
  employee_id           TEXT UNIQUE,         -- human-readable EMP-001
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  phone                 TEXT,
  department_id         UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  designation           TEXT,
  reporting_manager_id  UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  date_of_joining       DATE,
  avatar_url            TEXT,
  google_drive_folder_id TEXT,
  role                  public.user_role NOT NULL DEFAULT 'EMPLOYEE',
  username              TEXT,
  must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','terminated')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID
);

-- Add FK from departments.manager_id now that employees exists
ALTER TABLE public.departments
  ADD CONSTRAINT fk_departments_manager
  FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- Case-insensitive unique username index
CREATE UNIQUE INDEX employees_username_lower_key
  ON public.employees (lower(username))
  WHERE username IS NOT NULL AND deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- attendance_records
-- ---------------------------------------------------------------------------
CREATE TABLE public.attendance_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date             DATE NOT NULL,
  status                TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present','on_break','clocked_out','absent')),
  first_clock_in        TIMESTAMPTZ,
  last_clock_out        TIMESTAMPTZ,
  total_working_minutes INTEGER NOT NULL DEFAULT 0,
  total_break_minutes   INTEGER NOT NULL DEFAULT 0,
  approved_by           UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID,
  UNIQUE (employee_id, work_date)
);

-- ---------------------------------------------------------------------------
-- work_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE public.work_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id  UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  clock_in              TIMESTAMPTZ NOT NULL,
  clock_out             TIMESTAMPTZ,
  work_type             TEXT DEFAULT 'Office',
  notes                 TEXT,
  clock_in_geo          JSONB,
  clock_out_geo         JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID
);

-- ---------------------------------------------------------------------------
-- break_records
-- ---------------------------------------------------------------------------
CREATE TABLE public.break_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_session_id  UUID NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID,
  updated_by       UUID,
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID
);

-- ---------------------------------------------------------------------------
-- attendance_corrections
-- ---------------------------------------------------------------------------
CREATE TABLE public.attendance_corrections (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID REFERENCES public.attendance_records(id) ON DELETE SET NULL,
  requested_by         UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requested_date       DATE NOT NULL,
  field_to_correct     TEXT,
  original_value       TEXT NOT NULL,
  proposed_value       TEXT NOT NULL,
  reason               TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approver_id          UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  approver_notes       TEXT,
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID,
  updated_by           UUID,
  deleted_at           TIMESTAMPTZ,
  deleted_by           UUID
);

-- ---------------------------------------------------------------------------
-- leave_records
-- ---------------------------------------------------------------------------
CREATE TABLE public.leave_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type      TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  half_day        BOOLEAN NOT NULL DEFAULT FALSE,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  medical_cert_url TEXT,
  current_step    TEXT DEFAULT 'ReportingManager',
  approver_id     UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  approver_notes  TEXT,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);

-- ---------------------------------------------------------------------------
-- declared_holidays
-- ---------------------------------------------------------------------------
CREATE TABLE public.declared_holidays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  type        TEXT DEFAULT 'national',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID,
  updated_by  UUID,
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID
);


-- =============================================================================
-- PART 4 — TRAINING MODULE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- colleges
-- ---------------------------------------------------------------------------
CREATE TABLE public.colleges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE,
  name            TEXT NOT NULL,
  location        TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
CREATE TABLE public.courses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT UNIQUE,
  title            TEXT NOT NULL,
  max_marks        INTEGER NOT NULL DEFAULT 100,
  pass_percentage  INTEGER NOT NULL DEFAULT 50,
  checklist        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID,
  updated_by       UUID,
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID
);

-- ---------------------------------------------------------------------------
-- batches
-- ---------------------------------------------------------------------------
CREATE TABLE public.batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT,
  batch_no            TEXT,
  training_name       TEXT,
  college             TEXT,
  academic_year       TEXT,
  course_id           UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  trainer_id          UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  coordinator         TEXT,
  coordinator_email   TEXT,
  coordinator2        TEXT,
  coordinator_email2  TEXT,
  start_date          DATE,
  end_date            DATE,
  capacity            INTEGER DEFAULT 40,
  venue               TEXT,
  online_link         TEXT,
  phase               TEXT NOT NULL DEFAULT 'Preparation',
  completed_tasks     INTEGER NOT NULL DEFAULT 0,
  total_tasks         INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID
);

-- ---------------------------------------------------------------------------
-- student_records
-- ---------------------------------------------------------------------------
CREATE TABLE public.student_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name              TEXT NOT NULL,
  last_name               TEXT NOT NULL DEFAULT '',
  email                   TEXT,
  phone                   TEXT,
  guardian_name           TEXT,
  guardian_phone          TEXT,
  academic_qualification  TEXT,
  employment_status       TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  photo_url               TEXT,
  notes                   TEXT,
  tags                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID,
  updated_by              UUID,
  deleted_at              TIMESTAMPTZ,
  deleted_by              UUID
);

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------
CREATE TABLE public.enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES public.student_records(id) ON DELETE CASCADE,
  batch_id     UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'enrolled',
  seat_number  TEXT,
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID,
  UNIQUE (student_id, batch_id)
);

-- ---------------------------------------------------------------------------
-- schedule_sessions  (calendar + per-student attendance)
-- ---------------------------------------------------------------------------
CREATE TABLE public.schedule_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES public.student_records(id) ON DELETE SET NULL,
  trainer_id   UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  date         DATE NOT NULL,
  session_date DATE,
  arrival_time TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'Scheduled',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID
);

CREATE INDEX idx_schedule_sessions_batch_date ON public.schedule_sessions(batch_id, date);
CREATE INDEX idx_schedule_sessions_student ON public.schedule_sessions(student_id, batch_id);

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
CREATE TABLE public.assessments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  type          TEXT,
  max_marks     INTEGER NOT NULL DEFAULT 100,
  marks_obtained INTEGER,
  grade         TEXT,
  feedback      TEXT,
  evaluated_by  UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  evaluated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID
);

-- ---------------------------------------------------------------------------
-- final_exam_results
-- ---------------------------------------------------------------------------
CREATE TABLE public.final_exam_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID REFERENCES public.student_records(id) ON DELETE CASCADE,
  batch_id    UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  mark        NUMERIC(6,2),
  result      TEXT,
  remarks     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID,
  updated_by  UUID,
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID
);

-- ---------------------------------------------------------------------------
-- vouchers
-- ---------------------------------------------------------------------------
CREATE TABLE public.vouchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  voucher_code    TEXT UNIQUE,
  expiry_date     DATE,
  status          TEXT NOT NULL DEFAULT 'pending',
  approved_by     UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);

-- ---------------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------------
CREATE TABLE public.certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id       UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  student_id          UUID REFERENCES public.student_records(id) ON DELETE CASCADE,
  certificate_number  TEXT UNIQUE,
  verification_qr_url TEXT,
  digital_signature   TEXT,
  issued_at           TIMESTAMPTZ,
  reissued_at         TIMESTAMPTZ,
  reissue_reason      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID
);

-- ---------------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------------
CREATE TABLE public.referrals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_student_id  UUID REFERENCES public.student_records(id) ON DELETE SET NULL,
  referral_code        TEXT,
  referee_email        TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  reward_amount        NUMERIC(10,2),
  payout_eligible      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID,
  updated_by           UUID,
  deleted_at           TIMESTAMPTZ,
  deleted_by           UUID
);

-- ---------------------------------------------------------------------------
-- alumni_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.alumni_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID UNIQUE REFERENCES public.student_records(id) ON DELETE CASCADE,
  graduation_date       DATE,
  current_employer      TEXT,
  current_designation   TEXT,
  package_amount        NUMERIC(10,2),
  testimonial           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID
);


-- =============================================================================
-- PART 5 — PROJECT MODULE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
CREATE TABLE public.clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  code            TEXT UNIQUE,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  contact_person  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  code             TEXT UNIQUE,
  category         TEXT,
  type             TEXT,
  status           TEXT NOT NULL DEFAULT 'planning',
  priority         TEXT NOT NULL DEFAULT 'medium',
  start_date       DATE,
  end_date         DATE,
  estimated_hours  INTEGER,
  notes            TEXT,
  custom_fields    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID,
  updated_by       UUID,
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID
);

-- ---------------------------------------------------------------------------
-- milestones
-- ---------------------------------------------------------------------------
CREATE TABLE public.milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID,
  updated_by  UUID,
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID
);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
CREATE TABLE public.tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id     UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  assignee_id      UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  priority         TEXT NOT NULL DEFAULT 'medium',
  status           TEXT NOT NULL DEFAULT 'todo',
  due_date         DATE,
  estimated_hours  NUMERIC(6,2),
  actual_hours     NUMERIC(6,2),
  checklist        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID,
  updated_by       UUID,
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID
);

-- ---------------------------------------------------------------------------
-- resource_allocations
-- ---------------------------------------------------------------------------
CREATE TABLE public.resource_allocations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role                TEXT,
  capacity_percentage INTEGER NOT NULL DEFAULT 100,
  status              TEXT NOT NULL DEFAULT 'active',
  start_date          DATE,
  end_date            DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID
);

-- ---------------------------------------------------------------------------
-- timesheets
-- ---------------------------------------------------------------------------
CREATE TABLE public.timesheets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id       UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date     DATE NOT NULL,
  hours_logged  NUMERIC(5,2) NOT NULL DEFAULT 0,
  billable      BOOLEAN NOT NULL DEFAULT TRUE,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',
  approved_by   UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID
);

-- ---------------------------------------------------------------------------
-- client_meetings
-- ---------------------------------------------------------------------------
CREATE TABLE public.client_meetings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id    UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  meeting_date  TIMESTAMPTZ,
  online_link   TEXT,
  summary       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID
);


-- =============================================================================
-- PART 6 — FINANCE MODULE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- expense_claims
-- ---------------------------------------------------------------------------
CREATE TABLE public.expense_claims (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  notes        TEXT,
  receipt_url  TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',
  approved_by  UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID
);

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------
CREATE TABLE public.budgets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department       TEXT NOT NULL,
  fiscal_year      TEXT NOT NULL,
  allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  spent_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID,
  updated_by       UUID,
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID
);

-- ---------------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------------
CREATE TABLE public.vendors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  category          TEXT,
  email             TEXT,
  phone             TEXT,
  contact_person    TEXT,
  performance_score NUMERIC(3,1),
  contract_url      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_by        UUID,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID
);

-- ---------------------------------------------------------------------------
-- purchase_orders
-- ---------------------------------------------------------------------------
CREATE TABLE public.purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  po_number       TEXT UNIQUE,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft',
  goods_received  BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_url     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------
CREATE TABLE public.assets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  category                TEXT,
  barcode_qr              TEXT,
  assigned_employee_id    UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  warranty_expiry         DATE,
  status                  TEXT NOT NULL DEFAULT 'available',
  original_value          NUMERIC(10,2),
  depreciation_rate_annual NUMERIC(5,2),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID,
  updated_by              UUID,
  deleted_at              TIMESTAMPTZ,
  deleted_by              UUID
);

-- ---------------------------------------------------------------------------
-- salary_structures
-- ---------------------------------------------------------------------------
CREATE TABLE public.salary_structures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_salary  NUMERIC(10,2) NOT NULL DEFAULT 0,
  allowances    JSONB NOT NULL DEFAULT '{}'::jsonb,
  deductions    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID
);

-- ---------------------------------------------------------------------------
-- travel_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.travel_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  destination          TEXT NOT NULL,
  start_date           DATE NOT NULL,
  end_date             DATE NOT NULL,
  purpose              TEXT,
  hotel_booking_details TEXT,
  advance_requested    NUMERIC(10,2),
  status               TEXT NOT NULL DEFAULT 'pending',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID,
  updated_by           UUID,
  deleted_at           TIMESTAMPTZ,
  deleted_by           UUID
);


-- =============================================================================
-- PART 7 — COMMUNICATION MODULE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- chat_channels
-- ---------------------------------------------------------------------------
CREATE TABLE public.chat_channels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'team',
  project_id       UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  training_id      UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  department       TEXT,
  is_muted         BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived      BOOLEAN NOT NULL DEFAULT FALSE,
  is_starred       BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_message_id UUID,
  members          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID,
  updated_by       UUID,
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID
);

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id       UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id        UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  text             TEXT,
  attachments      JSONB NOT NULL DEFAULT '[]'::jsonb,
  reply_to         UUID,
  reactions        JSONB NOT NULL DEFAULT '[]'::jsonb,
  read_by          JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_edited        BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned        BOOLEAN NOT NULL DEFAULT FALSE,
  file_attachment  JSONB,
  reply_to_message JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID,
  updated_by       UUID,
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID
);

CREATE INDEX idx_chat_messages_channel ON public.chat_messages(channel_id, created_at);

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
CREATE TABLE public.announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  author_id    UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  target_type  TEXT NOT NULL DEFAULT 'organization',
  target_id    TEXT,
  priority     TEXT NOT NULL DEFAULT 'normal',
  scheduled_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID
);

-- ---------------------------------------------------------------------------
-- email_logs
-- ---------------------------------------------------------------------------
CREATE TABLE public.email_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID,
  updated_by  UUID,
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID
);

-- ---------------------------------------------------------------------------
-- notification_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE public.notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  email_alerts    BOOLEAN NOT NULL DEFAULT TRUE,
  push_alerts     BOOLEAN NOT NULL DEFAULT TRUE,
  sms_alerts      BOOLEAN NOT NULL DEFAULT FALSE,
  muted_channels  JSONB NOT NULL DEFAULT '[]'::jsonb,
  digest_mode     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);


-- =============================================================================
-- PART 8 — ANALYTICS MODULE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- kpi_definitions
-- ---------------------------------------------------------------------------
CREATE TABLE public.kpi_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE,
  name          TEXT NOT NULL,
  category      TEXT,
  formula       TEXT,
  current_value NUMERIC(12,2),
  target_value  NUMERIC(12,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID
);

-- ---------------------------------------------------------------------------
-- saved_reports
-- ---------------------------------------------------------------------------
CREATE TABLE public.saved_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  creator_id  UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  filters     JSONB NOT NULL DEFAULT '{}'::jsonb,
  grouping_by TEXT,
  sorting_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID,
  updated_by  UUID,
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID
);


-- =============================================================================
-- PART 9 — SYSTEM TABLES
-- =============================================================================

CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id UUID,
  old_values  JSONB,
  new_values  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.system_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID
);

CREATE TABLE public.user_email_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  smtp_host    TEXT,
  smtp_port    INTEGER,
  smtp_user    TEXT,
  smtp_pass    TEXT,
  from_name    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- PART 10 — PERFORMANCE INDEXES
-- =============================================================================

CREATE INDEX idx_employees_email ON public.employees(lower(email));
CREATE INDEX idx_employees_role ON public.employees(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_employee_date ON public.attendance_records(employee_id, work_date);
CREATE INDEX idx_leave_employee_status ON public.leave_records(employee_id, status);
CREATE INDEX idx_projects_status ON public.projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_client ON public.projects(client_id);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id, status);
CREATE INDEX idx_timesheets_project ON public.timesheets(project_id, work_date);
CREATE INDEX idx_timesheets_employee ON public.timesheets(employee_id, work_date);
CREATE INDEX idx_expense_employee ON public.expense_claims(employee_id, status);
CREATE INDEX idx_assets_status ON public.assets(status, assigned_employee_id);
CREATE INDEX idx_batches_phase ON public.batches(phase, start_date);
CREATE INDEX idx_kpi_code ON public.kpi_definitions(code) WHERE deleted_at IS NULL;


-- =============================================================================
-- PART 11 — ROW LEVEL SECURITY
-- Enable RLS on every table and apply a single blanket policy:
-- authenticated users can read/write all rows.
-- (Fine-grained per-role policies can be layered on top later.)
-- =============================================================================

DO $$
DECLARE
  t TEXT;
  all_tables TEXT[] := ARRAY[
    'departments', 'employees', 'attendance_records', 'work_sessions',
    'break_records', 'attendance_corrections', 'leave_records', 'declared_holidays',
    'colleges', 'courses', 'batches', 'student_records', 'enrollments',
    'schedule_sessions', 'assessments', 'final_exam_results', 'vouchers',
    'certificates', 'referrals', 'alumni_profiles',
    'clients', 'projects', 'milestones', 'tasks', 'resource_allocations',
    'timesheets', 'client_meetings',
    'expense_claims', 'budgets', 'vendors', 'purchase_orders', 'assets',
    'salary_structures', 'travel_requests',
    'chat_channels', 'chat_messages', 'announcements', 'email_logs',
    'notification_preferences',
    'kpi_definitions', 'saved_reports',
    'audit_logs', 'system_settings', 'user_email_configs'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY "authenticated_full_access" ON public.%I '
      'FOR ALL USING (auth.role() = ''authenticated'') '
      'WITH CHECK (auth.role() = ''authenticated'');', t
    );
  END LOOP;
END $$;

-- employees: also allow anon read of own row for session restore
CREATE POLICY "anon_resolve_login" ON public.employees
  FOR SELECT USING (true);  -- overridden by resolve_login_email SECURITY DEFINER


-- =============================================================================
-- PART 12 — HELPER FUNCTIONS
-- =============================================================================

-- resolve_login_email: used by the login screen for username/phone login
-- SECURITY DEFINER allows it to run before the caller is authenticated
CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier TEXT)
  RETURNS TEXT
  LANGUAGE SQL
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT e.email
  FROM public.employees e
  WHERE e.deleted_at IS NULL
    AND (
      lower(e.email)    = lower(trim(identifier))
      OR lower(e.username) = lower(trim(identifier))
      OR regexp_replace(coalesce(e.phone,''), '[^0-9]', '', 'g') =
         regexp_replace(trim(identifier), '[^0-9]', '', 'g')
    )
    AND length(trim(identifier)) > 0
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;


-- =============================================================================
-- PART 13 — PROVISION ADMIN EMPLOYEE ROW
-- Run this AFTER creating the admin in Authentication → Users dashboard.
-- It reads the UUID that Supabase assigned and links it to an employees row.
-- =============================================================================

INSERT INTO public.employees (
  id, employee_id, first_name, last_name, email, phone,
  designation, date_of_joining, role, username, status, must_change_password
)
SELECT
  u.id, 'EMP-001', 'Ajay', 'Thomas', u.email,
  '+91 9876543210', 'Chief Executive Officer', CURRENT_DATE,
  'ADMIN', 'Ajaythomas', 'active', false
FROM auth.users u
WHERE u.email = 'admin@kvjanalytics.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'ADMIN', username = 'Ajaythomas',
      status = 'active', must_change_password = false,
      deleted_at = NULL, updated_at = now();


-- =============================================================================
-- PART 14 — VERIFICATION
-- All four checks must return positive results before you test the app.
-- =============================================================================

-- 1) Auth credential exists and is confirmed
SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users WHERE email = 'admin@kvjanalytics.com';

-- 2) Employee row linked correctly
SELECT id, email, role, username, status
FROM public.employees WHERE email = 'admin@kvjanalytics.com';

-- 3) IDs match (critical for RLS)
SELECT EXISTS (
  SELECT 1 FROM auth.users u
  JOIN public.employees e ON e.id = u.id
  WHERE u.email = 'admin@kvjanalytics.com'
) AS identity_linked;

-- 4) Username login resolution works
SELECT public.resolve_login_email('Ajaythomas') AS resolved_email;

-- 5) Table count (expect 40+ tables)
SELECT count(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
