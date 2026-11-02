# FlowDesk Database Architecture & Integrity Specification

**Document Identifier:** DOC-DB-001  
**Version:** 2.0  
**Status:** Approved Database Architecture Specification  
**Effective Date:** 2026-10-31  
**Project:** FlowDesk (`flow-desk-main`)  
**Target RDBMS:** PostgreSQL 15+ (Supabase)

---

## 1. Executive Summary

The FlowDesk database schema is hosted on PostgreSQL via Supabase. The active schema consists of 44 tables in the `public` schema prefixed with `flwdsk_`.

This audit identified four major database integrity challenges that must be addressed during the engineering rework:
1. **Schema Absence of Approved Columns (`ISSUE-010`):** `flwdsk_employees` lacks `probation_end_date`, `probation_duration`, and `leave_accrual_start_date` columns required by stakeholder decision `EMP-Q01`.
2. **Table Dualism in Training Sessions (`ISSUE-005` / `CAL-Q01`):** Two competing session tables exist: `flwdsk_schedule_sessions` (active attendance & operational sessions) and `flwdsk_calendar_sessions` (calendar views).
3. **Data Dualism in Project Membership (`ISSUE-006` / `PROJECT-Q1`):** Team members are stored redundantly in `flwdsk_projects.member_ids` (array) and `flwdsk_resource_allocations` (relational table).
4. **Soft-Delete Inconsistency (`ISSUE-007`):** Over 68 raw queries omit `.is('deleted_at', null)`, causing soft-deleted records to reappear in UI listings.
5. **Permanently Excluded Module Tables:** Tables for permanently excluded modules (`flwdsk_budgets`, `flwdsk_vendors`, `flwdsk_purchase_orders`, `flwdsk_assets`, `flwdsk_salary_structures`) exist in legacy rebuild scripts.

---

## 2. Active Tables Inventory & Data Ownership

| Table Name | Domain / Module | Primary Key | Foreign Keys | Soft Delete? | Authoritative Role |
|---|---|---|---|---|---|
| `flwdsk_employees` | Employee Directory | `id (UUID)` | `department_id` | Yes (`deleted_at`) | Core staff identities & probation data |
| `flwdsk_departments` | Organization | `id (UUID)` | `manager_id` | Yes (`deleted_at`) | Organizational hierarchy |
| `flwdsk_attendance_records`| Attendance | `id (UUID)` | `employee_id` | Yes (`deleted_at`) | Daily attendance rollup per employee/day |
| `flwdsk_work_sessions` | Attendance | `id (UUID)` | `attendance_record_id` | Yes (`deleted_at`) | Granular attendance punch sessions |
| `flwdsk_break_records` | Attendance | `id (UUID)` | `attendance_record_id` | Yes (`deleted_at`) | Pause / lunch break intervals |
| `flwdsk_attendance_corrections` | Attendance / Approvals | `id (UUID)` | `employee_id`, `record_id` | Yes (`deleted_at`) | Punch correction requests |
| `flwdsk_leave_records` | Leave Management | `id (UUID)` | `employee_id`, `approved_by`| Yes (`deleted_at`) | Employee leave requests & approvals |
| `flwdsk_declared_holidays` | Calendar / Leave | `id (UUID)` | None | No | Official company holidays |
| `flwdsk_projects` | Project Management | `id (UUID)` | `client_id`, `supervisor_id`| Yes (`deleted_at`) | Project delivery containers |
| `flwdsk_milestones` | Project Management | `id (UUID)` | `project_id` | Yes (`deleted_at`) | Project delivery phases |
| `flwdsk_tasks` | Task Management | `id (UUID)` | `project_id`, `assignee_id` | Yes (`deleted_at`) | Operational task definitions |
| `flwdsk_task_work_sessions` | Task Management | `id (UUID)` | `task_id`, `employee_id` | Yes (`deleted_at`) | Active & completed task timers |
| `flwdsk_resource_allocations` | Projects / Teams | `id (UUID)` | `project_id`, `employee_id` | Yes (`deleted_at`) | **Authoritative team membership** (`PROJECT-Q1`) |
| `flwdsk_batches` | Training Operations | `id (UUID)` | `course_id`, `trainer_id` | Yes (`deleted_at`) | Scheduled training batches |
| `flwdsk_courses` | Training Operations | `id (UUID)` | None | Yes (`deleted_at`) | Master curriculum & course catalog |
| `flwdsk_colleges` | Training Operations | `id (UUID)` | None | Yes (`deleted_at`) | Partner institutions & colleges |
| `flwdsk_schedule_sessions` | Training Operations | `id (UUID)` | `batch_id`, `course_id` | Yes (`deleted_at`) | **Authoritative training sessions** (`CAL-Q01`) |
| `flwdsk_calendar_sessions` | Training Calendar | `id (UUID)` | `batch_id`, `trainer_id` | Yes (`deleted_at`) | Calendar-specific scheduling view |
| `flwdsk_student_records` | Training Operations | `id (UUID)` | `college_id` | Yes (`deleted_at`) | Student profile repository |
| `flwdsk_enrollments` | Training Operations | `id (UUID)` | `batch_id`, `student_id` | Yes (`deleted_at`) | Student-to-batch enrollment mapping |
| `flwdsk_assessments` | Training Operations | `id (UUID)` | `batch_id`, `course_id` | Yes (`deleted_at`) | Batch evaluation milestones |
| `flwdsk_final_exam_results`| Exam Center | `id (UUID)` | `student_id`, `assessment_id`| Yes (`deleted_at`) | Assessment scorecards |
| `flwdsk_vouchers` | Exam Center | `id (UUID)` | `student_id`, `batch_id` | Yes (`deleted_at`) | Assessment access vouchers |
| `flwdsk_certificates` | Training Operations | `id (UUID)` | `student_id`, `batch_id` | Yes (`deleted_at`) | Issued completion certificates |
| `flwdsk_expense_claims` | Finance / Expenses | `id (UUID)` | `employee_id`, `batch_id` | Yes (`deleted_at`) | Operational & travel expense claims |
| `flwdsk_chat_channels` | Communication | `id (UUID)` | None | Yes (`deleted_at`) | Internal collaboration channels |
| `flwdsk_chat_messages` | Communication | `id (UUID)` | `channel_id`, `sender_id` | Yes (`deleted_at`) | Chat message history |
| `flwdsk_announcements` | Communication | `id (UUID)` | `created_by` | Yes (`deleted_at`) | Company-wide broadcasts |
| `flwdsk_audit_logs` | Platform Governance | `id (UUID)` | `actor_id` | No | Authoritative audit trail |

---

## 3. Approved Database Decisions & Schema Migrations

### Decision EMP-Q01 & DISC-001: Employee Probation Schema (`ISSUE-010`)
* **Approved Policy:** Store **SOLELY `probation_end_date DATE NULL`** on `flwdsk_employees`. `probation_duration` and `leave_accrual_start_date` must be dynamically derived in code. Decimal display rounding must never mutate the stored date. Historical recommendations to create 3 columns are formally rescinded.
* **Required Additive Migration (`MIG-001` / `20261101000000_add_probation_end_date.sql`):**
  ```sql
  ALTER TABLE public.flwdsk_employees 
    ADD COLUMN IF NOT EXISTS probation_end_date DATE NULL;

  COMMENT ON COLUMN public.flwdsk_employees.probation_end_date IS 'Authoritative final day of employee probation period (EMP-Q01, DISC-001)';
  ```

### Decision PROJECT-Q1 & DISC-004: Single Source of Truth for Team Members (`ISSUE-006`)
* **Approved Policy:** `flwdsk_resource_allocations` is the **sole canonical source** for project membership.
* **Migration & Maintenance Strategy (`MIG-004`):**
  - Execute idempotent backfill inserting valid `member_ids` into `flwdsk_resource_allocations`.
  - All backfilled allocations are traceable via the proposed audit table `flwdsk_migration_log`.
  - Preserve pre-existing roles and allocations without overwrite.
  - Forward recovery is the default rollback strategy; bulk indiscriminate deletes are prohibited.
  - Supervisor authority is strictly project-scoped via `ProjectService.getSupervisorProjects()`.
  - Legacy `member_ids` maintained as read-only during project creation for backward compatibility until retirement. Zero table drops.

### Decision CAL-Q01: Canonical Training Session Architecture (`ISSUE-005`)
* **Approved Policy:** `flwdsk_schedule_sessions` is established as the **single canonical storage table** for both visual calendar planning and operational student attendance.
* **Schema Additive Migration (`MIG-002` / `20261101010000_consolidate_schedule_sessions.sql`):**
  ```sql
  ALTER TABLE public.flwdsk_schedule_sessions
    ADD COLUMN IF NOT EXISTS session_title TEXT,
    ADD COLUMN IF NOT EXISTS start_time TEXT,
    ADD COLUMN IF NOT EXISTS end_time TEXT,
    ADD COLUMN IF NOT EXISTS venue TEXT,
    ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'Offline',
    ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';
  ```
* **Consolidation Execution:**
  - Non-destructive backfill matches sessions on composite key `(batch_id, trainer_id, date, start_time)`.
  - Per-student attendance rows (`student_id IS NOT NULL`) preserved intact.
  - Legacy table `flwdsk_calendar_sessions` marked read-only in application code. Physical table preserved in DB. Zero table drops.

---

### Proposed Migration Provenance Schema (`flwdsk_migration_log`)
To enable safe, targeted, non-destructive rollbacks that distinguish newly backfilled rows from pre-existing records, the following audit structure is proposed for execution prior to `MIG-004`:

```sql
CREATE TABLE IF NOT EXISTS public.flwdsk_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  target_table TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_flwdsk_mig_log_name 
  ON public.flwdsk_migration_log(migration_name, target_table);
```

---

## 4. Indexing & Query Optimization Strategy

To resolve query bottlenecks and eliminate full table scans, the following composite indexes are scheduled for creation in Phase 1:

```sql
-- Attendance lookups (Daily active record per employee)
CREATE INDEX IF NOT EXISTS idx_flwdsk_att_emp_date 
  ON public.flwdsk_attendance_records(employee_id, work_date) 
  WHERE deleted_at IS NULL;

-- Task work sessions (Active open timer lookup)
CREATE INDEX IF NOT EXISTS idx_flwdsk_tws_emp_open 
  ON public.flwdsk_task_work_sessions(employee_id, task_id) 
  WHERE end_time IS NULL AND deleted_at IS NULL;

-- Training batch session lookups
CREATE INDEX IF NOT EXISTS idx_flwdsk_sched_batch_date 
  ON public.flwdsk_schedule_sessions(batch_id, date) 
  WHERE deleted_at IS NULL;

-- Leave balance lookups
CREATE INDEX IF NOT EXISTS idx_flwdsk_leave_emp_status 
  ON public.flwdsk_leave_records(employee_id, status) 
  WHERE deleted_at IS NULL;
```

---

## 5. Soft-Delete Governance & Query Conventions

1. **Standard Column Definition:** Every soft-deletable table must include:
   ```sql
   deleted_at TIMESTAMPTZ NULL DEFAULT NULL,
   deleted_by UUID NULL REFERENCES public.flwdsk_employees(id)
   ```
2. **Repository Query Requirement:** Every `select`, `count`, and `join` query authored in repositories must include `.is('deleted_at', null)`.
3. **Database RLS / View Layer Protection:** In future security phases, Views or RLS policies will enforce `deleted_at IS NULL` at the database engine level so that PostgREST queries automatically filter soft-deleted rows.

