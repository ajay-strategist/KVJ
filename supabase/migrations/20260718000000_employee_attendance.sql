-- Enums & Lookups
CREATE TYPE employee_status AS ENUM ('active', 'suspended', 'terminated');
CREATE TYPE attendance_status AS ENUM ('present', 'on_break', 'clocked_out', 'absent');
CREATE TYPE work_session_type AS ENUM ('Office', 'Training', 'Marketing', 'Meeting', 'Work From Home', 'Client Visit', 'Other');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');

-- Departments
CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  manager_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Employees (Extends auth.users metadata)
CREATE TABLE employees (
  id uuid PRIMARY KEY,
  employee_id text UNIQUE NOT NULL, -- e.g. "EMP-001"
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  status employee_status DEFAULT 'active',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  designation text NOT NULL,
  reporting_manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  date_of_joining date NOT NULL,
  avatar_url text,
  google_drive_folder_id text,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES employees(id),
  updated_by uuid REFERENCES employees(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES employees(id)
);

-- Set manager FK constraint on departments
ALTER TABLE departments ADD CONSTRAINT fk_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Attendance Records (One row per day per employee)
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT current_date,
  status attendance_status DEFAULT 'clocked_out',
  first_clock_in timestamptz,
  last_clock_out timestamptz,
  total_working_minutes integer DEFAULT 0,
  total_break_minutes integer DEFAULT 0,
  approved_by uuid REFERENCES employees(id),
  approved_at timestamptz,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES employees(id),
  updated_by uuid REFERENCES employees(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES employees(id),
  
  CONSTRAINT unique_employee_date UNIQUE (employee_id, work_date)
);

-- Work Sessions (Allows multiple clock-ins/outs in a day)
CREATE TABLE work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id uuid NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  work_type work_session_type NOT NULL DEFAULT 'Office',
  notes text,
  clock_in_geo jsonb, -- {latitude, longitude, accuracy}
  clock_out_geo jsonb,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES employees(id),
  updated_by uuid REFERENCES employees(id)
);

-- Break Logs (Breaks taken during work sessions)
CREATE TABLE break_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_session_id uuid NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  reason text,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES employees(id),
  updated_by uuid REFERENCES employees(id)
);

-- Attendance Corrections (Audited approval requests)
CREATE TABLE attendance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id uuid NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES employees(id),
  requested_date date NOT NULL,
  field_to_correct text NOT NULL, -- 'clock_in' or 'clock_out' or 'session'
  original_value text NOT NULL,
  proposed_value text NOT NULL,
  reason text NOT NULL,
  status leave_status DEFAULT 'pending',
  approver_id uuid REFERENCES employees(id),
  approver_notes text,
  approved_at timestamptz,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Leave Applications (Leave foundation)
CREATE TABLE leave_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL, -- 'Casual', 'Sick', 'Earned', etc.
  start_date date NOT NULL,
  end_date date NOT NULL,
  half_day boolean DEFAULT false,
  reason text NOT NULL,
  status leave_status DEFAULT 'pending',
  medical_cert_url text,
  
  -- Workflow / Approval
  current_step text DEFAULT 'ReportingManager', -- Workflow step
  approver_id uuid REFERENCES employees(id),
  approver_notes text,
  approved_at timestamptz,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES employees(id),
  updated_by uuid REFERENCES employees(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES employees(id)
);

-- Audit log
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES employees(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  ip text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_emp_dept ON employees(department_id);
CREATE INDEX idx_emp_mgr ON employees(reporting_manager_id);
CREATE INDEX idx_att_emp_date ON attendance_records(employee_id, work_date);
CREATE INDEX idx_session_att ON work_sessions(attendance_record_id);
CREATE INDEX idx_break_session ON break_records(work_session_id);
CREATE INDEX idx_correction_status ON attendance_corrections(status);
CREATE INDEX idx_leave_emp_dates ON leave_records(employee_id, start_date, end_date);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
