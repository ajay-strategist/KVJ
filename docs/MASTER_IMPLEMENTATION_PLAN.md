# FlowDesk Master Implementation Plan (Final Validated & Locked)

**Document Identifier:** DOC-MIP-003  
**Version:** 5.0 (Reconciled Master Implementation Plan & Governance Baseline)  
**Status:** Approved Baseline — Unauthorized for Implementation Execution  
**Effective Date:** 2026-11-01  
**Project:** FlowDesk (`flow-desk-main`)  
**Scope:** All 20 Active Application Modules

---

## 1. Executive Summary & Strict Governance Boundaries

This document represents the final, comprehensive, dependency-driven, and risk-mitigated Master Implementation Plan for the FlowDesk engineering rework. It incorporates all stakeholder directives, independent plan validation findings, resolved conflicts (`CONF-001`, `EMP-Q01`, `PROJECT-Q1`, `CAL-Q01`, `DISC-001` through `DISC-004`), and finalized technical architectures for session consolidation, project membership consolidation, forensic error diagnosis, package pruning, selective soft-deletes, the complete 16-metric Expense Analytics specification, and full implementation work package specifications across all ten execution phases.

### Engineering Effort Baseline vs Calendar Schedule
- **Effort Estimate Baseline:** The complete rework represents **32.0 dedicated engineering days** of technical labor across decoupled, test-driven phases. This figure is an **engineering effort estimate**, not a guaranteed calendar completion timeframe. Actual calendar elapsed time will vary according to local verification pacing, automated test suite runs, and formal stakeholder review turnarounds for Tier 2 and Tier 3 gates.
- **Operational Transition Strategy:** Daily business operations continue undisturbed on current stable components while all rework is developed and verified in isolated local/staging environments. Phase 0A (Test Harness), Phase 0B (Package Pruning), and Phase 1 (Critical Operational Fixes) require **5.0 dedicated engineering days** of implementation and testing. Operational release occurs strictly upon passing the Tier 3 Operational Readiness Gate.

### Mandatory Scope & Safety Boundaries
1. **Security Architecture Untouched:** The Security System remains completely out of scope. Authentication architecture, login/session management, authorization, role definitions, permission assignments, PostgreSQL RLS policies, and security-related database functions must not be modified or refactored.
2. **Excluded Modules Preserved:** Budget Management, Procurement, Asset Management, and Payroll are permanently excluded from current rework. Their existing database tables (`flwdsk_budgets`, `flwdsk_purchase_orders`, `flwdsk_vendors`, `flwdsk_assets`, `flwdsk_salary_structures`) and historical records must be preserved intact. Migration `20261029000000_remove_excluded_modules_tables.sql` is formally cancelled and will not be executed.
3. **Mobile App Directory Isolated:** The `Mobile App/` directory remains untouched in the repository during web application rework. No relocation or deletion will be performed. `UIUX-REQ-020` covers approved mobile scope definition and architecture planning only; actual mobile implementation requires separate authorization after web rework.
4. **Preservation of Business Rules:** All approved business decisions are preserved without alteration.
5. **Zero Implementation Status:** This plan is planning and documentation only. No implementation, source code modification, database change, package operation, migration execution, or deployment is authorized under this task.

---

## 2. Dedicated Consolidation & Forensic Work Packages

### Work Package A: CAL-Q01 & ISSUE-005 — Training Session Consolidation
* **Problem Statement:** The application currently exhibits data dualism between `flwdsk_schedule_sessions` (operational training attendance, student attendance rollups, trainer daily logging) and `flwdsk_calendar_sessions` (calendar visualizer, session title/time/venue/mode). This causes calendar planning to drift from operational attendance.
* **Canonical Storage Target:** `flwdsk_schedule_sessions` is established as the **single authoritative table** for both calendar planning and attendance tracking.
* **Consolidation Execution Steps (Phase 2 & Phase 3):**
  1. **Schema Verification & Additive DDL (`MIG-002`):**
     - Target table `flwdsk_schedule_sessions` has existing schema: `id`, `batch_id`, `student_id`, `trainer_id`, `date`, `session_date`, `arrival_time`, `status`, `notes`.
     - Author additive non-destructive migration adding visual planning columns:
       ```sql
       ALTER TABLE public.flwdsk_schedule_sessions
         ADD COLUMN IF NOT EXISTS session_title TEXT,
         ADD COLUMN IF NOT EXISTS start_time TEXT,
         ADD COLUMN IF NOT EXISTS end_time TEXT,
         ADD COLUMN IF NOT EXISTS venue TEXT,
         ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'Offline',
         ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';
       ```
  2. **Reliable Session Identity & Matching Logic:**
     - To prevent merging separate valid sessions delivered on the same day, matching is evaluated strictly on the composite key:
       $$\text{Session Identity Key} = (\text{batch\_id}, \text{trainer\_id}, \text{date}, \text{start\_time})$$
     - Fallback for sessions with null `start_time`: match on `(batch_id, trainer_id, date)` only when exactly one session exists for that batch/trainer on that date.
  3. **Existing Attendance Relationships & Zero Data Loss:**
     - All per-student attendance rows in `flwdsk_schedule_sessions` (`student_id IS NOT NULL`, `arrival_time`, `status`) are preserved intact. Zero data deletion.
     - For parent session records (where `student_id IS NULL`), update planning metadata (`session_title`, `start_time`, `end_time`, `venue`, `mode`, `color`).
     - For calendar records with no matching schedule session, insert parent session records into `flwdsk_schedule_sessions`.
  4. **Reconciliation Counts & Validation:**
     - Execute pre-backfill count: count distinct sessions in `flwdsk_calendar_sessions` vs `flwdsk_schedule_sessions`.
     - Execute post-backfill count: verify total distinct sessions in `flwdsk_schedule_sessions` equals original count plus newly migrated calendar sessions.
  5. **Touchpoint Unification (Phase 3):**
     - Update `TrainingCalendar.tsx` and `training.service.ts` to execute all reads, inserts, and updates directly against `flwdsk_schedule_sessions`.
     - Ensure Trainer My Day, Training Calendar, Batch Console, and Attendance Log read from the unified table.
  6. **Safe Deprecation Protocol:**
     - `flwdsk_calendar_sessions` is marked read-only via application code deprecation.
     - The physical table remains untouched in the database until post-rework sign-off. Zero table drop migrations.

---

### Work Package B: PROJECT-Q1 & ISSUE-006 — Project Membership Consolidation
* **Problem Statement:** `flwdsk_projects` historically maintained a `member_ids` JSONB array column, while `flwdsk_resource_allocations` maintained relational allocation records (`project_id`, `employee_id`, `role`, `capacity_percentage`, `status`). This dualism caused state desynchronization between task assignment dropdowns and project team views.
* **Canonical Source of Truth:** `flwdsk_resource_allocations` is the **sole canonical source** for project membership.
* **Consolidation Execution Steps (Phase 2 & Phase 4):**
  1. **Schema & Data Verification of `member_ids`:**
     - Table `flwdsk_projects.member_ids` is verified as `jsonb NOT NULL DEFAULT '[]'::jsonb`.
     - Elements in `member_ids` can be plain UUID strings or object structures `{"employee_id": "...", "role": "..."}`.
  2. **Dedicated Migration Script (`MIG-004`):**
     - Pre-migration audit: validate that employee IDs extracted from `member_ids` reference valid active rows in `flwdsk_employees` (`WHERE id IN (SELECT id FROM flwdsk_employees)`). Invalid orphan references are logged and excluded.
     - Migration Metadata Tracking: All rows created by `MIG-004` must be explicitly traceable via migration provenance metadata (e.g. logging inserted IDs into an audit table `flwdsk_migration_log` with `migration_name = 'MIG-004_PROJECT_ALLOCATIONS_BACKFILL'`, or stamping a dedicated tracking column/attribute).
     - Idempotent backfill SQL:
       ```sql
       INSERT INTO public.flwdsk_resource_allocations (project_id, employee_id, role, status)
       SELECT p.id, (m.elem)::uuid, 'Team Member', 'active'
       FROM public.flwdsk_projects p, jsonb_array_elements_text(p.member_ids) AS m(elem)
       WHERE m.elem ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         AND (m.elem)::uuid IN (SELECT id FROM public.flwdsk_employees)
         AND NOT EXISTS (
           SELECT 1 FROM public.flwdsk_resource_allocations ra
           WHERE ra.project_id = p.id AND ra.employee_id = (m.elem)::uuid
         );
       ```
     - Preserve existing roles: if an allocation already exists for `(project_id, employee_id)`, its existing `role`, `capacity_percentage`, and `status` are preserved without overwrite.
  3. **Reconciliation Counts & Validation:**
     - Pre-backfill count: total allocations in `flwdsk_resource_allocations` vs distinct project members in `member_ids`.
     - Post-backfill count: verify zero unmapped valid employee references remain in `member_ids`.
  4. **Single Implementation Owner for Supervisor Scoping (`DISC-004`):**
     - **Authoritative Implementation Owner:** `ProjectService.getSupervisorProjects(supervisorId)` in `src/modules/project/project.service.ts`.
     - All task queries, approval views, and TaskBoard action guards consume this single method.
     - Project Supervisors are scoped strictly to projects where they are allocated as supervisor on `flwdsk_resource_allocations`.
     - Supervisors are permitted to approve all tasks (including peer assignments) within their allocated projects, while cross-project actions are blocked.
  5. **Rollback Safety & Distinction from Pre-Existing Allocations:**
     - A blunt rollback query such as `DELETE FROM flwdsk_resource_allocations WHERE (project_id, employee_id) IN (...)` is strictly prohibited because it cannot distinguish between pre-existing allocations that overlapped with `member_ids` and rows newly created by `MIG-004`.
     - If rollback is required, it must target strictly the row IDs recorded in `flwdsk_migration_log` for `MIG-004`.
     - **Forward-Recovery Default:** Forward recovery (marking backfilled allocations inactive or deprecating reading without executing destructive hard deletes) is established as the preferred operational default to safeguard project team assignments.
  6. **Safe Deprecation Protocol:**
     - Update `project.repository.ts` to read exclusively from `flwdsk_resource_allocations`.
     - Maintain read-only synchronization of `member_ids` JSONB during project creation for backward compatibility until retirement. Zero table drops.
---

### Work Package C: ISSUE-002 — HTTP 500 Forensic Diagnostic Gate
* **Investigation Status:** Root cause remains **UNCONFIRMED** due to absent server runtime logs. Assuming client-side errors alone cause an HTTP 500 is technically invalid.
* **Permitted Boundary:** Zero modification of authentication middleware, session tokens, JWTs, Supabase Edge Functions, or PostgreSQL security/RLS rules.
* **Separation of Gating (Staging Diagnostic vs Production Server Logs):**
  - *Staging Diagnostic Gate:* Local and staging environment read-only diagnostic reproduction, client hydration inspection, and Network HAR analysis.
  - *Production Server Logs Access Gate:* If staging reproduction is inconclusive due to external hosting configurations, inspecting production Supabase edge function or API logs is an **explicit external gate** requiring separate stakeholder authorization. Probing undocumented internal services or modifying server config is strictly forbidden.
* **Diagnostic Protocol (Phase 1 Gate):**
  1. **Step 1: Read-Only Reproduction & Evidence Collection (Staging):**
     - Reproduce reload at `/app` in an isolated staging environment.
     - Capture browser Network HAR log: identify exact failing URL, request headers, response payload, and HTTP 500 status.
     - Inspect browser console for uncaught JavaScript exceptions prior to network failure.
  2. **Step 2: Root-Cause Classification:**
     - *Scenario 1 (Application API/Edge Function Failure):* If HTTP 500 originates from an external endpoint (e.g., Supabase Auth service or edge function), document exact endpoint and payload.
     - *Scenario 2 (Client Hydration Race Condition):* If HTTP 500 is an uncaught runtime error in client bootstrap resulting in failed data fetching, identify failing component.
  3. **Step 3: Proposed Client-Side-Only Remediation:**
     - If client-side hydration race is confirmed: add defensive null-safe guards and graceful retry logic in client data providers (`useAuth`, `bootstrap.ts`).
     - If root cause resides inside authentication infrastructure, JWT logic, or server infrastructure: **HALT AND REPORT**. Label as `BLOCKED (SECURITY BOUNDARY)` and request separate stakeholder authorization.
  4. **Step 4: Read-Only Diagnostic & Regression Verification:**
     - The 20-refresh test is a **read-only diagnostic/regression test** in staging.
     - Perform 20 consecutive hard refreshes (`Ctrl+Shift+R`) across all primary role dashboards (`ADMIN`, `MANAGER`, `TRAINER`, `EMPLOYEE`), verifying zero uncaught exceptions and 100% clean rendering.

---

### Work Package D: ISSUE-004 & ISSUE-012 — Unified Attendance & Clock-Out Lifecycle Remediation
* **Consolidation Analysis & Root Cause Relationship:**
  - `ISSUE-004` and `ISSUE-012` represent two distinct but compounding failure modes within the attendance clock-out lifecycle:
    1. **Repository Concurrency & Foreign Key Violation (`ISSUE-004`):** In `SupabaseAttendanceRepository.update()`, `syncWorkSessions()` executes a destructive `DELETE` on `flwdsk_work_sessions` before re-inserting session intervals. When child rows exist in `flwdsk_break_records` referencing those session IDs, PostgreSQL raises a Foreign Key violation (`23503: foreign_key_violation`), causing the clock-out mutation to fail or be silently swallowed in `console.warn`.
    2. **Service Date Boundary & Midnight Rollover (`ISSUE-012`):** In `AttendanceService.clockOut()`, active records are retrieved via `findActiveRecord(employeeId, todayStr())`. When a shift crosses midnight (e.g. 22:00 to 06:00), `todayStr()` evaluates to the current date rather than the clock-in date, causing the query to return null and leaving yesterday's active session permanently unclosed.
    3. **Compounding Effect:** During overnight shifts, if the service fails to locate yesterday's session (`ISSUE-012`), the clock-out hangs; if the session is located, repository session deletion hits the foreign key conflict (`ISSUE-004`).
  - *Traceability Matrix Decision:* Both issue IDs (`ISSUE-004` and `ISSUE-012`) are retained in the traceability register, but their engineering execution is consolidated under this unified work package.
* **ISSUE-004 Investigation & Verification Gate (Replacing Premature Fix Assumptions):**
  - Asserting that replacing `DELETE + INSERT` with `UPDATE` is a confirmed sufficient fix without evidence is technically invalid.
  - A formal **Investigation and Verification Gate** is established prior to any repository change to verify:
    1. *Parent Session Persistence:* Verify whether `flwdsk_work_sessions` IDs are preserved across mutations and whether open session timestamps update in place.
    2. *Break Synchronization Integrity:* Verify foreign key constraints between `flwdsk_break_records.work_session_id` and `flwdsk_work_sessions.id`. Ensure child break records are reconciled without orphan deletion or constraint failure.
    3. *Cascading Update & Deletion Ordering:* Enforce child-before-parent ordering on any cascading deletion or update.
    4. *Overnight Date Query Resolution:* Update `findActiveRecord()` to query for any open, unclosed session for the employee (`clock_out IS NULL`) regardless of calendar date rollover.
    5. *Transactional Atomicity:* Wrap parent attendance record, work session, and break record updates in an atomic database transaction or single-mutation sequence, ensuring clean rollback if any step fails.
* **Mandatory Regression Test Scenarios (Passing Required for Phase 1 Gate):**
  1. *Scenario 1 (Standard Same-Day Shift):* Clock in at 09:00, take 1 break, clock out at 17:00. Verify zero errors, accurate total hours, and unclosed prompt removal.
  2. *Scenario 2 (Multi-Break Shift):* Clock in, take 3 distinct breaks, clock out. Verify all breaks persist with exact timestamps and zero FK `23503` violations.
  3. *Scenario 3 (Overnight Shift Crossing Midnight):* Clock in at 23:00 on Day 1, take break at 02:00 on Day 2, clock out at 07:00 on Day 2. Verify `findActiveRecord()` resolves Day 1 record, total duration is calculated correctly (8 hours), and session closes cleanly.
  4. *Scenario 4 (Rapid Re-Clocking & State Toggle):* Rapid clock-in / clock-out toggling to verify zero race conditions or phantom session creation.

---

### Work Package E: ISSUE-011 — Leave Accrual & Balance Engine Decoupling
* **Problem Statement:** `src/modules/leave/leave.service.ts` currently calculates leave balance quotas strictly based on elapsed calendar months from April 1 (the start of the financial year), without evaluating the employee's `date_of_joining` or active probation status. Consequently, employees who joined mid-year or who are currently on probation are erroneously awarded unearned full-year leave quotas (Finding F-11).
* **Decoupling from Phase 6 Type Safety:**
  - `ISSUE-011` is a core business logic defect in Leave Management.
  - It is mapped strictly to **Phase 1** Critical Reliability (and Phase 2 Leave Engine alignment).
  - It has **ZERO architectural dependency** on the TypeScript `TaskStatus` 7-state refactoring or progressive type safety. Progressive type safety remains an independent engineering work package in Phase 6.
* **Preservation of Authoritative Business Rules:**
  - Preserves `BR-LEAVE-011`: Pro-rata leave quota calculation based strictly on active completed service tenure.
  - Preserves `EMP-Q01`: Probation status and leave accrual eligibility are dynamically derived in code from `probation_end_date DATE NULL`.
* **Execution Tasks:**
  1. Refactor `LeaveService.getLeaveBalance(employeeId)` to incorporate `date_of_joining` and `probation_end_date` into monthly accrual multipliers.
  2. Ensure probationary periods accrue leave only if permitted by policy, or hold accrual until the dynamically derived probation completion date.
  3. Create dedicated unit test suite `src/tests/leave-accrual.test.ts` verifying pro-rata quota calculations for mid-year joiners, probationers, and confirmed employees.

---

## 3. Package Dependency Pruning Validation (Phase 0B)

Before any package removal is scheduled, an evidence-based dependency audit was conducted across the workspace:

| Package | In `package.json` | Direct Imports in `src/` | Build/Config References | Transitive/Mobile Dependencies | Pruning Recommendation |
|:---|:---|:---|:---|:---|:---|
| **`googleapis`** (`^173.0.0`) | Yes | **0 imports** | None | Server-only Google API client. Not used in web or mobile app. | **Approve for Pruning** (Phase 0B) |
| **`nodemailer`** (`^8.0.8`) | Yes | **0 imports** | None | Node.js SMTP transport; cannot run in browser runtime. | **Approve for Pruning** (Phase 0B) |
| **`dotenv`** (`^17.4.2`) | Yes | **0 imports** | None | Vite uses native `import.meta.env`. `Mobile App/` has its own isolated `dotenv`. | **Approve for Pruning** (Phase 0B) |
| **`socket.io-client`** (`^4.8.3`) | Yes | **0 imports** | None | Application uses Supabase Realtime subscriptions. | **Approve for Pruning** (Phase 0B) |
| **`axios`** (`^1.15.2`) | Yes | **0 imports** | None | Application uses native `fetch` and Supabase client exclusively. | **Approve for Pruning** (Phase 0B) |

*Safety Protocol:* In Phase 0B, pruning is executed only after Phase 0A tests pass. Following removal, `npm run build` and `npm test` must pass 100% before pruning is merged. If any build failure occurs, the commit is immediately reverted.

---

## 4. Comprehensive Database Migration & Data Preservation Plan

### Strict Migration Safety Governance
1. **Zero Table-Drop Migrations:** No migration may execute `DROP TABLE`. Migration `20261029000000_remove_excluded_modules_tables.sql` is cancelled.
2. **Transactional Execution Rules:**
   - Supabase and standard PostgreSQL migration runners execute DDL files inside transactional blocks (`BEGIN ... COMMIT`).
   - `CREATE INDEX CONCURRENTLY` **cannot execute inside a transaction block** (`ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`).
   - *Technical Resolution:* Migration scripts designed for automated deployment pipelines must use standard `CREATE INDEX IF NOT EXISTS` inside transactions, OR specify manual out-of-band execution if `CONCURRENTLY` is mandatory on high-volume production tables.
3. **Safe Non-Destructive Rollback Strategy:**
   - Dropping columns (`ALTER TABLE ... DROP COLUMN`) destroys newly entered production data.
   - *Revised Strategy:* Rollbacks must utilize **forward-recovery** or non-destructive schema deprecation. If rollback is necessary, mark the feature flag inactive or deprecate column usage in repository code without executing destructive column drops.

### Migration Inventory & Execution Protocol

| Migration ID | File Name | Target Phase | Additive DDL Actions | Rollback & Preservation Protocol | Approval Tier |
|:---|:---|:---:|:---|:---|:---:|
| **`MIG-000`** | `20261101000000_create_migration_log.sql` | Phase 2 | Schema creation of proposed audit table: `CREATE TABLE IF NOT EXISTS public.flwdsk_migration_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), migration_name TEXT NOT NULL, record_id UUID NOT NULL, target_table TEXT NOT NULL, executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), metadata JSONB DEFAULT '{}'::jsonb); CREATE INDEX IF NOT EXISTS idx_flwdsk_mig_log_name ON public.flwdsk_migration_log(migration_name, target_table);` | Pre-migration check. Rollback: `DROP TABLE IF EXISTS public.flwdsk_migration_log;`. | **Tier 2 (DB Migration)** |
| **`MIG-001`** | `20261101010000_add_probation_end_date.sql` | Phase 2 | `ALTER TABLE public.flwdsk_employees ADD COLUMN IF NOT EXISTS probation_end_date DATE NULL;` | Pre-migration backup of `flwdsk_employees`. Forward-recover: deprecate column in code; do not drop column if data exists. | **Tier 2 (DB Migration)** |
| **`MIG-002`** | `20261101010000_consolidate_schedule_sessions.sql` | Phase 2 | Add visual planning columns to `flwdsk_schedule_sessions`: `session_title TEXT`, `start_time TEXT`, `end_time TEXT`, `venue TEXT`, `mode TEXT DEFAULT 'Offline'`, `color TEXT DEFAULT '#3b82f6'`. | Pre-migration backup. Non-destructive backfill from `flwdsk_calendar_sessions`. Rollback: revert repository pointers to legacy table. | **Tier 2 (DB Migration)** |
| **`MIG-003`** | `20261101020000_composite_indexes.sql` | Phase 2 | Standard idempotent index creation: `idx_flwdsk_att_emp_date`, `idx_flwdsk_tws_emp_open`, `idx_flwdsk_sched_batch_date`. | Rollback: `DROP INDEX IF EXISTS ...`. Safe and non-destructive. | **Tier 2 (DB Migration)** |
| **`MIG-004`** | `20261101030000_backfill_project_allocations.sql` | Phase 2 | Idempotent backfill from `flwdsk_projects.member_ids` to `flwdsk_resource_allocations`. Records backfill IDs in `flwdsk_migration_log`. | Pre-migration backup. Forward-recover is default. Rollback: delete strictly rows recorded in `flwdsk_migration_log` to avoid deleting pre-existing allocations. | **Tier 2 (DB Migration)** |

---

## 5. Soft-Delete Enforcement Strategy (Phase 4)

Rather than blindly appending `.is('deleted_at', null)` to every database call, Phase 4 enforces a **module-by-module selective adoption protocol**:

1. **Active Operational Tables (Enforce Mandatory `deleted_at IS NULL`):**
   - `flwdsk_employees`: Active employee lists, dropdowns, and auth mappings.
   - `flwdsk_projects`: Active project cards and task allocation selectors.
   - `flwdsk_tasks`: Active task boards, backlog, and sprint boards.
   - `flwdsk_task_work_sessions`: Active work session tracking and timer hydration.
   - `flwdsk_attendance_records`: Daily attendance calculations.
   - `flwdsk_expense_claims`: Active claims processing queue.
   - `flwdsk_batches`: Active training batch carousel and scheduling touchpoints.
2. **Explicit Soft-Delete Exceptions (Must NOT Filter Out `deleted_at`):**
   - **Historical Audit Reports & Attendance Logs:** Auditing and forensic compliance reports must display historical logs regardless of soft-delete state.
   - **Expense Analytics Historical Summaries (`UIUX-REQ-018`):** Past fiscal year financial metrics must preserve historical receipts even if a past batch was archived.
   - **Task Rejection & Ever-Started Audit (`BR-TASK-007`):** Start-state detection must verify historical session existence to prevent accidental task purging.
   - **Archive Views:** Explicit "Archived / Deleted" tabs in Leave Board, Announcements, and Task Board deliberately query `WHERE deleted_at IS NOT NULL`.

---

## 6. Complete Traceability Matrices

### A. Full Issue-to-Phase Traceability Matrix (ISSUE-001 through ISSUE-014)

| Issue ID | Description & Reported Symptoms | Status / Root Cause | Implementation Phase | Key Tasks, Tests & Gate Criteria |
|:---|:---|:---:|:---:|:---|
| **`ISSUE-001`** | My Day Task Duration Changes After Refresh | Root Cause Confirmed | **Phase 1** | Single total `Xh Ym` rendering; LocalStorage date reconciliation; unit test in `src/tests/task-duration.test.ts`. |
| **`ISSUE-002`** | HTTP 500 Error During Page Refresh | Unconfirmed Root Cause (Investigation Gate) | **Phase 1** | Forensic reproduction protocol; Network HAR capture; client-side hydration fix; 20-refresh zero-error verification. Blocked if auth/security boundary. |
| **`ISSUE-003`** | Duplicate "On Break" Toast Popups | Root Cause Confirmed | **Phase 1** | Remove redundant toast call in `MyDayPage.tsx:3278`; automated toast dispatch unit test. |
| **`ISSUE-004`** | Employee Clock-Out Sometimes Incomplete (FK 23503 Breakdown) | Root Cause Confirmed (Repository Concurrency & Break FK Violation) | **Phase 1** | Consolidated under Unified Attendance Remediation (WP-D); formal Investigation Gate verifying parent session persistence, child break FK 23503 constraints, and atomic transaction ordering. Unit tests in `src/tests/attendance-clockout.test.ts`. |
| **`ISSUE-005`** | Training Session Table Dualism (`CAL-Q01`) | Confirmed Architecture Gap | **Phase 2 & 3** | `MIG-002` additive planning columns on `flwdsk_schedule_sessions`; non-destructive backfill from `flwdsk_calendar_sessions`; calendar unification. |
| **`ISSUE-006`** | Project Team Member Dualism (`PROJECT-Q1`) | Confirmed Architecture Gap | **Phase 2 & 4** | `MIG-004` backfill from `flwdsk_projects.member_ids` to `flwdsk_resource_allocations`; supervisor scoping via `ProjectService`. |
| **`ISSUE-007`** | Missing Soft-Delete Filtering in Queries | Confirmed Vulnerability | **Phase 4** | Standardize base repository queries with selective active vs audit rules (`.is('deleted_at', null)` on operational tables). |
| **`ISSUE-008`** | Zero Automated Test Coverage | Confirmed Risk | **Phase 0A** | Setup Vitest harness with `happy-dom`; 3 core calculation test suites passing in $<5$s. |
| **`ISSUE-009`** | Approvals Queue Hard-Deletion Defect | Confirmed Defect | **Phase 1** | Ever-started deletion protection (`BR-TASK-007` & `DISC-003`); status `Rejected / Closed`; dedicated rejected/archive filter view. |
| **`ISSUE-010`** | Missing Probation Columns on `flwdsk_employees` | Confirmed Schema Defect | **Phase 2** | `MIG-001` adding strictly `probation_end_date DATE NULL` (`EMP-Q01`, `DISC-001`); dynamic duration derivation in code. |
| **`ISSUE-011`** | Unearned Leave Accrual from April 1 (Finding F-11) | Root Cause Confirmed (Missing Tenure & Probation Evaluation) | **Phase 1** | Dedicated Leave Management package (WP-E); decouple completely from TaskStatus/Phase 6 type safety; update `LeaveService.getLeaveBalance()` to enforce `BR-LEAVE-011` and `EMP-Q01` pro-rata quotas. Unit tests in `src/tests/leave-accrual.test.ts`. |
| **`ISSUE-012`** | Overnight Shift Clock-Out Failure Across Midnight (Finding F-12) | Root Cause Confirmed (Service-Layer Date Rollover Query) | **Phase 1** | Consolidated under Unified Attendance Remediation (WP-D); update `findActiveRecord(employeeId)` to query active open unclosed sessions regardless of calendar date rollover. Regression test across midnight shifts. |
| **`ISSUE-013`** | Training Batch Lifecycle Column Schema Divergence (`phase` vs `status`) | Root Cause Confirmed | **Phase 3** | Explicit bidirectional adapter mapping UI statuses (`Not Started`, `In Progress`, `Completed`, `Closed`) to DB column `phase` (`DISC-002`). |
| **`ISSUE-014`** | Monolithic JavaScript Bundles Exceeding 500 kB (Finding F-14) | Root Cause Confirmed | **Phase 7** | Configure dynamic `import()` for `xlsx`, `jspdf`, `html2canvas` in export handlers; verify bundle chunks $<500$ kB. |

---

### B. Full UI/UX Requirements Traceability Matrix (Batch 01 & Batch 02)

| Requirement ID | Module / Screen | Target Phase | Strict Scope & Implementation Boundary |
|:---|:---|:---:|:---|
| **`UIUX-REQ-001`** | Shell / Sidebar Collapse | **Phase 7** | Remove `[` badge; preserve collapse toggle, icon, and keyboard shortcut handler. |
| **`UIUX-REQ-002`** | My Day Today's Tasks | **Phase 7** | Prepend new tasks at index 0; personal drag-and-drop; persistent sync. |
| **`UIUX-REQ-003`** | Announcements Lifecycle | **Phase 7** | My Day user dismissal; Announcements Board calendar month filter; zero hard-delete. |
| **`UIUX-REQ-004`** | Guardrail Screen Preservation | **Phase 7** | Strictly preserve Attendance Details Log, Calendar Panel, and Expense Summary. |
| **`UIUX-REQ-005`** | Leave Board Filters & UI | **Phase 7** | Remove top KPIs; highlight pending rows; exact 6 date/employee filters. |
| **`UIUX-REQ-006`** | Apply for Leave Modal | **Phase 7** | Modern centered layout; deduction summary card; preserve all fields & calc engine. |
| **`UIUX-REQ-007`** | Approvals Queue & Supervisor Scope | **Phase 1 & 7** | Scoped strictly to assigned projects (`DISC-004`); vertical stacked split sessions. |
| **`UIUX-REQ-008`** | 15-Min Employee Idle-Time Alert | **Phase 7** | Notify Admin when clocked in, no task running, not on break; breaks never idle. |
| **`UIUX-REQ-009`** | Batch Cards, Sort & 4 Statuses | **Phase 3 & 7** | Retain Expense Details button; newest sort; 4 exact statuses (`DISC-002`); `CONF-001`. |
| **`UIUX-REQ-010`** | Add/Edit Batch Forms & Work Hours | **Phase 7** | Clean fieldsets; verified employee man-hours only (zero fabricated hours). |
| **`UIUX-REQ-011`** | Create Task Modal Redesign | **Phase 7** | 4-section layout (Core, Ownership, Timeline, Description); all 8 fields preserved. |
| **`UIUX-REQ-012`** | Form-to-DB Persistence Audit | **Phase 7** | Comprehensive audit verifying all form inputs persist cleanly to Supabase. |
| **`UIUX-REQ-013`** | Clock-In Panel Redesign | **Phase 7** | Modern card layout; high-accuracy coordinates; shift status display. |
| **`UIUX-REQ-014`** | Training Calendar Usability | **Phase 7** | Shift-drag / copy-paste support; duplicate schedule warning; conflict detection. |
| **`UIUX-REQ-015`** | Projects List Redesign | **Phase 7** | Clean tabular layout; department/status filters; remove vanity KPI cards. |
| **`UIUX-REQ-016`** | Task Board Active Focus View | **Phase 7** | Remove clutter KPIs; active sprint/board focus view; 7-state columns. |
| **`UIUX-REQ-017`** | Expenses & Travel Claim Form | **Phase 7** | Clean claim form; automatic standard mileage/per-diem rate calculation. |
| **`UIUX-REQ-018`** | Expense Analytics (16 Metrics) | **Phase 7** | Implement all 16 specified metrics across 4 categories; tabular summaries. |
| **`UIUX-REQ-019`** | Announcements Board & Archive | **Phase 7** | Clean feed layout; pinned notices; historical archive filter tab. |
| **`UIUX-REQ-020`** | Mobile Companion App Isolation | **Phase 7 / Sep** | Mobile app remains isolated and untouched; planning verification only. |

---

## 7. Expense Analytics Complete Technical Specification (Exact 16 Metrics)

In accordance with stakeholder mandate `UIUX-REQ-018`, the complete 16-metric specification is permanently locked into Phase 7 (Average Amount is completely excluded from the analytics scope):

```
+---------------------------------------------------------------------------------------------------------------------+
| Top Row KPI Cards:                                                                                                  |
| [ Metric 1: Total Institutional Spend ] [ Metric 2: Training vs Office Split ] [ Metric 3: Cost Per Student ] [ Metric 4: Cost Per Training Day ] |
+---------------------------------------------------------------------------------------------------------------------+
| Main Visualizations & Analytics Tables:                                                                             |
| Tab 1: [ Metric 10: Monthly Expense Trend ] [ Metric 8: Expense by Category Breakdown ]                             |
| Tab 2: [ Metric 5: Batch-Level Total Expense ] [ Metric 6: Batch Cost/Student ] [ Metric 7: Cost/Day by Batch ]     |
|        [ Metric 14: Batch Expense Share % ]                                                                         |
| Tab 3: [ Metric 9: Expense by Type Breakdown ] [ Metric 11: Monthly Expense by Type ]                               |
| Tab 4: [ Metric 12: Employee Expense Leaderboard ] [ Metric 15: Travel Modality Breakdown (Bike/Car/Transit) ]       |
| Tab 5: [ Metric 13: 2D Matrix (Batches × Expense Types Heatmap) ]                                                   |
| Tab 6: [ Metric 16: Prior Year Academic Comparison Benchmark (YoY: College + Program + Course) ]                     |
+---------------------------------------------------------------------------------------------------------------------+
```

### Detailed Metric Definitions

#### Metric 1: Total Institutional Spend
* **Business Definition:** Gross cumulative financial spend across all approved operational and training claims. Average Amount is completely excluded from the analytics scope.
* **Calculation Formula:**
  37328\text{Total Spend} = \sum_{\text{status} = \text{'Approved'}} \text{amount}37328
* **Database Source:** `flwdsk_expense_claims.amount` (`status = 'Approved'`).
* **Filters:** Academic Year, Date Range, Category, College, Batch, Employee.
* **Null/Zero Handling:** Displays `"₹0.00"` if null or empty.
* **Visualization:** Primary Metric KPI Card; Top Row, Column 1. Format: INR (`₹X,XX,XXX`).
* **Validation Test:** Sum must exactly equal sum of Metric 2 components.

#### Metric 2: Training vs Office Expenses Split
* **Business Definition:** Categorical split of total expenditure into direct student training delivery vs. internal corporate office operations.
* **Calculation Formula:**
  37328\text{Training Expenses} = \sum_{\text{category} = \text{'Training Expense'}} \text{amount}, \quad \text{Office Expenses} = \sum_{\text{category} = \text{'Office Expense'}} \text{amount}37328
* **Database Source:** `flwdsk_expense_claims.category`.
* **Filters:** Academic Year, Date Range, Employee, College.
* **Null/Zero Handling:** Shows `"₹0 / ₹0"` with neutral 50/50 gray bar.
* **Visualization:** Dual Sub-Metric KPI Card with proportional split bar; Top Row, Column 2.
* **Validation Test:** $\text{Training} + \text{Office} = \text{Metric 1}$.

#### Metric 3: Cost Per Student
* **Business Definition:** Average direct training expenditure incurred per enrolled student across active batches within the filter scope.
* **Calculation Formula:**
  37328\text{Cost Per Student} = \frac{\text{Training Expenses}}{\sum_{\text{batch} \in \text{Scope}} \text{batch.student\_count}}37328
* **Database Source:** `flwdsk_expense_claims` matched to `flwdsk_batches` and student enrollments.
* **Filters:** Academic Year, Date Range, College, Batch.
* **Null/Zero Handling:** Displays `"₹0 / student"` if student count is zero (avoids division by zero).
* **Visualization:** KPI Card with delta trend indicator; Top Row, Column 3.
* **Validation Test:** Verify against manual sample batch calculation.

#### Metric 4: Cost Per Training Day
* **Business Definition:** Average daily training expenditure incurred per delivered training calendar day across all batches.
* **Calculation Formula:**
  37328\text{Cost Per Training Day} = \frac{\text{Training Expenses}}{\sum_{\text{batch} \in \text{Scope}} \text{UniqueTrainingDays}(\text{batch})}37328
* **Database Source:** `flwdsk_expense_claims.expenseDate` grouped by batch and cross-referenced with `flwdsk_schedule_sessions`.
* **Filters:** Academic Year, Date Range, College, Batch.
* **Null/Zero Handling:** Displays `"₹0 / day"` when training days count is zero.
* **Visualization:** KPI Card with average trend indicator; Top Row, Column 4.
* **Validation Test:** Distinct dates count verified via `flwdsk_schedule_sessions`.

#### Metric 5: Batch-Level Total Expense
* **Business Definition:** Aggregated expenditure attributed to an individual training batch across all associated claims.
* **Calculation Formula:**
  37328\text{Batch Expense}(b) = \sum_{\text{claim.batch\_id} = b.\text{id}} \text{claim.amount}37328
* **Database Source:** `flwdsk_expense_claims` linked via `batch_id`.
* **Filters:** Batch Code search, College filter, Academic Year.
* **Null/Zero Handling:** Displays `"₹0.00"`.
* **Visualization:** Data Table Column with horizontal progress fill; Main Analytics Table (Tab 2).
* **Validation Test:** Sum of all batch expenses equals total training expenses.

#### Metric 6: Batch-Level Cost Per Student
* **Business Definition:** Program delivery cost normalized by actual batch student enrollment.
* **Calculation Formula:**
  37328\text{Batch Cost/Student}(b) = \frac{\text{Batch Expense}(b)}{\max(b.\text{student\_count}, 1)}37328
* **Database Source:** `flwdsk_batches` enrollment join with `flwdsk_expense_claims`.
* **Filters:** College, Course, Academic Year.
* **Null/Zero Handling:** Displays `"₹0 / student"` if enrollment is 0.
* **Visualization:** Data Table Column with colored variance pill; Tab 2.
* **Validation Test:** High variance ($> ₹1,200$) triggers visual flag.

#### Metric 7: Cost Per Training Day by Batch
* **Business Definition:** Daily burn rate of a specific individual training batch, calculated from total approved batch expenditure divided exclusively by the number of unique calendar dates on which training actually occurred for that batch.
* **Calculation Formula:**
  37913\text{Cost/Day}(b) = \frac{\text{Batch Expense}(b)}{\text{UniqueActualTrainingDays}(b)}37913
* **Database Source:**
  - Numerator: `SUM(flwdsk_expense_claims.amount)` WHERE `batch_id = b.id` AND `status = 'Approved'`.
  - Denominator: `COUNT(DISTINCT flwdsk_schedule_sessions.date)` WHERE `batch_id = b.id` AND `deleted_at IS NULL`.
* **Batch Filters:** Batch Code search, College Name, Academic Year, Date Range (applied consistently across expenses and schedule sessions).
* **Treatment of Training Days:**
  - The number of training days is calculated exclusively from actual training session records in `flwdsk_schedule_sessions`.
  - Multiple sessions on the same calendar date count as exactly one training day.
  - Expense claim dates must NEVER be used as training-day evidence. Advance expenses, travel bookings, reimbursements, and other claim dates must not create additional training days. Do not infer training days from expense records.
* **Zero and Missing Value Handling:**
  - **Scenario A (Zero approved batch expenses):** Renders `"₹0 / day"`.
  - **Scenario B (Approved expenses exist and one or more actual training dates exist):** Divide total approved batch expenses by the count of distinct actual training dates from `flwdsk_schedule_sessions`.
  - **Scenario C (Approved expenses exist but no actual training session dates exist):** Use denominator `1` solely as a protective pre-commencement calculation fallback (e.g. advance travel booking prior to start). Display the calculated amount with the explicit informational label `"1 day (pre-commencement)"`. Do NOT describe this fallback as an actual training day, and NEVER substitute expense claim dates.
  - **Scenario D (Missing or unavailable session data):** Do not silently infer training days from unrelated records. Preserve the strict distinction between zero actual training days and missing/unavailable session data. Render an explicit data-quality warning badge `"Session Data Unavailable"` if batch session records cannot be queried or are corrupt.
* **Chart Type / Position:** Data Table Column with daily burn indicator; Main Analytics Table (Tab 2).
* **Dimensions & Sizing:** Column width: \text{px}$; aligned right.
* **Color Palette:** Low ($< ₹1,500$): `#10B981` (Emerald); Moderate ($₹1,500–₹3,500$): `#3B82F6` (Blue); High ($> ₹3,500$): `#EF4444` (Rose); Pre-commencement fallback: `#6B7280` (Gray).
* **Typography:** \text{px}$ tabular figures (`formatINR`).
* **Legends & Tooltips:** Tooltip reveals: `"₹[Total Expense] / [Unique Actual Training Days] Actual Training Days"` (or `"Pre-commencement: Advance spend before training start"`).
* **Empty State:** Shows `"₹0 / day"`.
* **Insight Generation Logic:** Identifies completed batches where daily delivery burn rate exceeds single-day workshop baselines by $> 50\%$.

---
#### Metric 8: Expense by Category Breakdown
* **Business Definition:** High-level institutional distribution of expenses across primary categories (Training Expenses vs. Office Expenses).
* **Calculation Formula:**
  37328\text{Category Share}(c) = \sum_{\text{claim.category} = c} \text{amount}, \quad \text{Pct}(c) = \frac{\text{Category Share}(c)}{\text{Total Spend}} \times 100\%37328
* **Database Source:** `flwdsk_expense_claims.category`.
* **Filters:** Academic Year, Date Range, College, Batch.
* **Chart Type / Position:** Donut Chart with central total spend callout; Row 2, Right Panel.
* **Dimensions & Sizing:** Width: \text{px}$; Height: \text{px}$; Inner Radius: \text{px}$; Outer Radius: \text{px}$.
* **Color Palette:** Training: `#10B981` (Emerald); Office: `#6366F1` (Indigo).
* **Typography:** Center text: Total INR; Legend: \text{px}$ with categorical color swatches.
* **Legends & Tooltips:** Hover reveals exact category spend and percentage share.
* **Empty State:** Clean gray circle with `"No Expense Claims Found"`.
* **Insight Generation Logic:** Highlights when Office Expenses exceed 25% of institutional operational budget.

#### Metric 9: Expense by Type Breakdown
* **Business Definition:** Granular distribution across specific expense types (Self Travel, Public Transport, Meals, Printing, Trainer Honorarium, Accommodation, Miscellaneous).
* **Calculation Formula:**
  37328\text{Type Spend}(t) = \sum_{\text{claim.type} = t} \text{amount}, \quad \text{Share}(t) = \frac{\text{Type Spend}(t)}{\text{Total Expenses}} \times 100\%37328
* **Database Source:** `flwdsk_expense_claims.expense_type`.
* **Filters:** Category, Date Range, College, Academic Year.
* **Chart Type / Position:** Horizontal Bar Chart sorted descending by spend; Tab 3 ("Types & Monthly").
* **Dimensions & Sizing:** Width: 100%; Height: \text{px}$.
* **Color Palette:** 11-color conformed palette (`#3B82F6`, `#10B981`, `#F59E0B`, `#8B5CF6`, `#EC4899`, etc.).
* **Typography:** Value: \text{px}$ bold; Axis labels: \text{px}$ regular.
* **Legends & Tooltips:** Hover reveals Type Name, Total INR, and Share %.
* **Empty State:** Centered text: `"No Expense Claims Found"`.
* **Insight Generation Logic:** Highlights if Travel represents $> 40\%$ of total spend (flags high commuting overhead).

#### Metric 10: Monthly Expense Trend
* **Business Definition:** Chronological trajectory of monthly operational expenditure across the academic year.
* **Calculation Formula:**
  37328\text{Monthly Spend}(m) = \sum_{\text{month}(c.\text{date}) = m} c.\text{amount}37328
* **Database Source:** `flwdsk_expense_claims.created_at` or `expense_date`.
* **Filters:** Academic Year, Category, College.
* **Null/Zero Handling:** Missing months render as 0 on line chart without dropping axis ticks.
* **Visualization:** Stacked Bar & Line Combo Chart (Training + Office Bars + Total Trend Line); Tab 1.
* **Validation Test:** Sum of 12 months equals Academic Year total spend.

#### Metric 11: Monthly Expense by Type
* **Business Definition:** Monthly categorical breakdown showing how specific costs evolve month-over-month.
* **Calculation Formula:**
  37328\text{Spend}(m, t) = \sum_{\text{month} = m, \text{type} = t} \text{amount}37328
* **Database Source:** Cross-tabulation of `expense_date` and `expense_type`.
* **Filters:** Academic Year, Date Range, Category.
* **Null/Zero Handling:** Missing intersections render as 0.
* **Visualization:** 100% Stacked Bar Chart; Tab 3.
* **Validation Test:** Each monthly bar stacks to 100%.

#### Metric 12: Employee Expense Leaderboard
* **Business Definition:** Ranked audit of expenses claimed per employee, tracking submission volume and average claim size.
* **Calculation Formula:**
  37328\text{Emp Spend}(e) = \sum_{c.\text{emp\_id} = e.\text{id}} c.\text{amount}, \quad \text{Avg Claim}(e) = \frac{\text{Emp Spend}(e)}{\text{Claims Count}(e)}37328
* **Database Source:** `flwdsk_expense_claims.employee_id` joined with `flwdsk_employees`.
* **Filters:** Academic Year, Date Range, Category.
* **Null/Zero Handling:** Employees with 0 claims excluded from leaderboard.
* **Visualization:** Ranked Horizontal Bar List with employee avatar and role badge; Tab 4.
* **Validation Test:** Top claimant spend matches manual query.

#### Metric 13: Batch $\times$ Expense Types Heatmap
* **Business Definition:** Cross-tabulation matrix mapping individual training batches (rows) against expense types (columns) to identify localized cost drivers.
* **Calculation Formula:**
  37328\text{Cell}(b, t) = \sum_{c \in \text{Batch}(b) \land c.\text{type} = t} c.\text{amount}, \quad \text{Heatmap Intensity} = \frac{\text{Cell}(b, t)}{\max(\text{MatrixCells})}37328
* **Database Source:** Matrix pivot of `flwdsk_expense_claims` matched to active batches.
* **Filters:** College, Academic Year, Expense Category.
* **Chart Type / Position:** 2D Interactive Grid Heatmap with summary row and summary column; Tab 5 ("Matrix").
* **Dimensions & Sizing:** Full width (\text{px}$ min); Scrollable horizontally and vertically; Cell size: \text{px} \times 40\text{px}$.
* **Color Palette:** VisionOS glass intensity: Low (neutral surface), Medium (light blue tint), High (`#3B82F6` with white text).
* **Typography:** Cells: \text{px}$ tabular; Row headers: \text{px}$ bold; Grand totals: \text{px}$ bold.
* **Legends & Tooltips:** Hovering a cell displays: `"[Batch Name] · [Expense Type] · ₹X,XXX (Y% of Batch Total)"`.
* **Empty State:** Displays empty matrix grid with zero values.
* **Insight Generation Logic:** Pinpoints anomalous batch expenditures (e.g. one batch spending 80% on Printing while another spends 80% on Food).

#### Metric 14: Batch Expense Share (%)
* **Business Definition:** The proportion of total institutional training expenditure consumed by a single batch.
* **Calculation Formula:**
  37328\text{Share Pct}(b) = \frac{\text{Batch Expense}(b)}{\text{Total Training Expenses}} \times 100\%37328
* **Database Source:** Derived ratio from Metric 5 and Metric 2.
* **Filters:** Academic Year, College.
* **Null/Zero Handling:** Shows `"0.0%"`.
* **Visualization:** Progress Bar / Donut segment in Batch Details drawer; Tab 2.
* **Validation Test:** Sum of shares across all batches equals 100%.

#### Metric 15: Travel Modality Breakdown
* **Business Definition:** Comparative breakdown of transportation expenditures across specific travel modes: Self Travel (Bike vs Car by KM rate) vs Public Transit (Bus, Metro, Train, Auto, Cab/Uber).
* **Calculation Formula:**
  37328\text{Bike Total} = \sum (\text{KM} \times \text{Rate}_{\text{bike}}), \quad \text{Car Total} = \sum (\text{KM} \times \text{Rate}_{\text{car}}), \quad \text{Transit Total} = \sum \text{Fares}37328
* **Database Source:** `flwdsk_expense_claims` parsed `vehicle`, `km`, and `route` fields.
* **Filters:** College, Batch, Academic Year.
* **Null/Zero Handling:** Displays `"No travel claims recorded"` if zero.
* **Visualization:** Multi-segment Stacked Bar Chart with vehicle icon chips; Tab 4.
* **Validation Test:** Sum of modalities equals Metric 9 Travel total.

#### Metric 16: Prior Year Academic Comparison Benchmark (YoY)
* **Business Definition:** Multi-year baseline comparative evaluation matching current year batches against historical prior year programs strictly by the composite key:
  37328\text{Comparison Key} = [\text{College Name}] + [\text{Program / Stream}] + [\text{Course}]37328
* **Calculation Formula:**
  37328\Delta \text{Expense} = \text{Expense}_{\text{Current}} - \text{Expense}_{\text{Prior}}, \quad \text{Growth \%} = \frac{\Delta \text{Expense}}{\text{Expense}_{\text{Prior}}} \times 100\%37328
* **Database Source:** Matched queries between `academicYear` and `comparisonYear` across `flwdsk_batches` and `flwdsk_expense_claims`.
* **Filters:** Current Academic Year, Comparison Academic Year, College.
* **Null/Zero Handling:** If no prior year program matches key, renders `"No Prior Baseline Record"` gray badge (prevents false $\pm 100\%$ errors).
* **Visualization:** YoY Comparative Matrix Table with variance pills; Tab 6.
* **Validation Test:** Matched program codes verified before rendering comparison.

---
## 8. Revised Phase Sequencing, Effort & Operational Readiness Schedule

### 8.1 Realistic Engineering Timeline (32.0 Dedicated Engineering Days Effort Estimate)

| Phase ID | Name & Core Deliverables | Dedicated Engineering Days | Primary Gate / Checkpoint |
|:---|:---|:---:|:---|
| **Phase 0A** | Automated Test Harness & Safety Net (`ISSUE-008`) | 1.0 Day | Test runner output & passing calculation tests |
| **Phase 0B** | Verified Package Pruning (5 dead packages) | 0.5 Day | Clean build & zero regression check |
| **Phase 1** | Critical Operational Reliability Fixes (`ISSUE-001`, `ISSUE-002`, `ISSUE-003`, `ISSUE-004`, `ISSUE-009`, `ISSUE-011`, `ISSUE-012`) | 3.5 Days | **Tier 3 Operational Readiness Gate** |
| **Phase 2** | Database Migrations & Session/Membership Consolidation (`MIG-000`–`004`) | 3.0 Days | **Tier 2 Database Migration Approval Gate** |
| **Phase 3** | Universal `SearchableBatchSelect` & Training Touchpoints (`CAL-Q01`, `CONF-001`, `ISSUE-013`) | 3.5 Days | Cross-touchpoint demonstration |
| **Phase 4** | Incremental Repository Standardization & Soft-Delete Rules (`ISSUE-006`, `ISSUE-007`) | 3.5 Days | Repository unit test review & query audit |
| **Phase 5** | Monolithic Component Decomposition ($< 500$ LOC Guidelines) | 4.0 Days | LOC audit & visual equivalence check |
| **Phase 6** | Progressive Type Safety (7-State `TaskStatus`) & Engine Decoupling | 3.0 Days | Clean `npm run typecheck` verification |
| **Phase 7** | Dynamic Imports (`ISSUE-014`) & UI/UX Requirements (Batch 01 & 02, 16 Expense Metrics) | 7.0 Days | Visual walkthrough of all 20 UI/UX items |
| **Phase 8** | End-to-End Master Regression & Deployment Sign-Off Gate | 3.0 Days | **Tier 3 Final Executive Sign-Off Gate** |
| **TOTAL** | **Comprehensive End-to-End Engineering Rework** | **32.0 Days** | Complete Rework Handover (Effort Estimate) |

### 8.2 Operational Readiness Statement & Transition Strategy
- **Effort Estimate vs Calendar Schedule:** The 32.0 dedicated engineering days baseline represents estimated engineering labor effort across decoupled work packages, not a guaranteed calendar completion timeframe. Actual calendar elapsed time will depend on local verification pacing, automated testing suite runs, and formal stakeholder review turnarounds for Tier 2 and Tier 3 gates.
- **Strict Realistic Assessment:** Delivering, testing, and verifying Phase 0A, Phase 0B, and Phase 1 requires **5.0 dedicated engineering days** of disciplined work.
- **Commitment:** We do **NOT** cut testing, skip verification, or rush unverified code into production to meet an artificial calendar deadline.
- **Operational Recommendation:** Daily operations continue on current stable components while Phase 0A, Phase 0B, and Phase 1 are systematically executed in the local staging environment. Operational release occurs strictly upon passing the Tier 3 Operational Readiness Gate.

---

### 8.3 Complete Implementation Work Package Catalog (Phase 0A through Phase 8)

Every phase is structured into fully specified, implementation-ready work packages containing all eight mandatory attributes:

#### Work Package 0A: Automated Test Harness & Safety Net (`ISSUE-008`)
1. **Scope & Exclusions:** Setup Vitest test runner with `happy-dom`. Implement 3 calculation test suites (`probation-calc.test.ts`, `leave-accrual.test.ts`, `task-duration.test.ts`). Exclude UI component snapshot testing, E2E browser tests, and live network calls.
2. **Technical Implementation Approach:** Install `vitest`, `@testing-library/react`, `happy-dom` as devDependencies. Create `vitest.config.ts`. Configure `"test": "vitest run"` in `package.json`. Author isolated unit tests verifying mathematical functions.
3. **Dependencies & Prerequisites:** Node.js v18+, clean npm dependency tree.
4. **Expected Deliverables:** `vitest.config.ts`, `src/tests/probation-calc.test.ts`, `src/tests/leave-accrual.test.ts`, `src/tests/task-duration.test.ts`, passing test run in $<5$s.
5. **Automated Test Requirements:** 100% pass rate across all 3 calculation test suites ($\ge 15$ test cases).
6. **Local Verification Requirements:** Run `npm test` locally; verify terminal output shows 3 passing suites with zero failures.
7. **Completion Criteria:** Vitest runner executes cleanly from CLI with exit code 0.
8. **Failure / Recovery Approach:** If Vitest configuration conflicts with existing Vite plugins, isolate test setup within `vitest.config.ts` without modifying `vite.config.ts`.

#### Work Package 0B: Verified Package Dependency Pruning
1. **Scope & Exclusions:** Remove 5 verified unused dependencies (`googleapis`, `nodemailer`, `dotenv`, `socket.io-client`, `axios`). Exclude all active runtime dependencies in `src/`. Exclude `Mobile App/` directory.
2. **Technical Implementation Approach:** Run `npm uninstall googleapis nodemailer dotenv socket.io-client axios`. Verify `package.json` and `package-lock.json`.
3. **Dependencies & Prerequisites:** Phase 0A automated test harness passing.
4. **Expected Deliverables:** Clean `package.json` without unused server libraries; reduced dependency graph.
5. **Automated Test Requirements:** Run `npm test` and `npm run typecheck` to verify zero regression.
6. **Local Verification Requirements:** Run `npm run build` to verify clean Vite production bundle compilation.
7. **Completion Criteria:** Build completes with exit code 0; zero unresolved module errors; bundle size verified.
8. **Failure / Recovery Approach:** If any unmapped import is detected, immediately revert package removal via `git checkout package.json package-lock.json`.

#### Work Package 1: Critical Operational Reliability Fixes
1. **Scope & Exclusions:** Implement fixes for `ISSUE-001` (Task Duration), `ISSUE-002` (Refresh HTTP 500 Diagnostic Gate), `ISSUE-003` (Duplicate Break Toast), `ISSUE-004` & `ISSUE-012` (Unified Attendance & Clock-Out Lifecycle), `ISSUE-009` (Approvals Task Rejection `BR-TASK-007`), `ISSUE-011` (Leave Accrual Pro-Rata Engine), and verify `BR-ATT-004` (Off-Shift Task Start). Exclude security architecture, JWT tokens, Supabase Edge Functions, and RLS policies.
2. **Technical Implementation Approach:**
   - *WP-1A (`ISSUE-001`):* In `TaskWidget.tsx` and `MyDayPage.tsx`, render single total `Xh Ym` sum combining historical accumulated session hours with current running timer seconds; reconcile LocalStorage date.
   - *WP-1B (`ISSUE-002`):* Execute read-only staging diagnostic reproduction; capture Network HAR and client hydration errors; implement defensive null-guards in client bootstrap (`useAuth`, `bootstrap.ts`); perform 20-refresh regression test. Gated from production logs.
   - *WP-1C (`ISSUE-003`):* Remove redundant toast notification call at `MyDayPage.tsx:3278`.
   - *WP-1D (`ISSUE-004` & `ISSUE-012`):* Execute formal Investigation Gate in `SupabaseAttendanceRepository.update()` and `AttendanceService.clockOut()`. Verify parent work-session persistence, child break FK `23503` integrity, cascading ordering, overnight session resolution in `findActiveRecord(employeeId)`, and atomic transaction rollback.
   - *WP-1E (`ISSUE-009`):* In `ApprovalsQueue.tsx`, enforce `BR-TASK-007`: verify whether employee ever started task before rejection. Pre-start: delete task; Ever-started: transition to `Rejected / Closed`.
   - *WP-1F (`ISSUE-011`):* Refactor `LeaveService.getLeaveBalance()` to calculate pro-rata leave quotas strictly from `date_of_joining` and `probation_end_date` per `BR-LEAVE-011` and `EMP-Q01`.
   - *WP-1G (`BR-ATT-004`):* Verify employees can start task timers without being clocked into attendance.
3. **Dependencies & Prerequisites:** Phase 0A test harness active; Phase 0B pruning complete.
4. **Expected Deliverables:** Clean TypeScript fixes across attendance, task, leave, and my-day modules; 5 dedicated unit test suites.
5. **Automated Test Requirements:** 100% passing tests in `attendance-clockout.test.ts`, `leave-accrual.test.ts`, `task-duration.test.ts`, `task-rejection.test.ts`.
6. **Local Verification Requirements:** Execute all 8 checks in Section 5 Phase 1 Operational Readiness Gate Checklist locally.
7. **Completion Criteria:** 20 consecutive hard refreshes with zero errors; clean clock-out across midnight; unclosed session prompt dismissed; Tier 3 Operational Readiness Gate passed.
8. **Failure / Recovery Approach:** If clock-out FK violation persists during investigation, wrap mutations in a single atomic PostgreSQL RPC function. If HTTP 500 originates from auth server infrastructure, halt and escalate under `BLCK-SEC-001`.

#### Work Package 2: Database Schema & Session/Membership Consolidation
1. **Scope & Exclusions:** Author and execute additive migrations: `MIG-000` (`flwdsk_migration_log`), `MIG-001` (`probation_end_date`), `MIG-002` (`flwdsk_schedule_sessions` additive columns & backfill), `MIG-003` (composite indexes), `MIG-004` (project allocations backfill). Zero table drops; exclude permanently excluded modules (`flwdsk_budgets`, etc.).
2. **Technical Implementation Approach:** Author transactional SQL migration scripts. Execute `MIG-000` audit table setup. Execute `MIG-001` adding solely `probation_end_date DATE NULL`. Execute `MIG-002` adding planning columns and merging `flwdsk_calendar_sessions` matching on `(batch_id, trainer_id, date, start_time)`. Execute `MIG-003` non-concurrent indexes. Execute `MIG-004` backfilling `member_ids` to `flwdsk_resource_allocations` logging IDs to `flwdsk_migration_log`.
3. **Dependencies & Prerequisites:** Phase 1 complete; Tier 2 Database Migration Approval; database snapshots.
4. **Expected Deliverables:** 5 migration SQL files in `supabase/migrations/`; migration execution logs; reconciliation count verification report.
5. **Automated Test Requirements:** Integration test querying new schema columns and indexes without errors.
6. **Local Verification Requirements:** Execute migrations against local Supabase instance; verify column definitions and table row counts.
7. **Completion Criteria:** All columns and indexes exist; post-backfill count equals pre-backfill count plus migrated rows; zero data loss.
8. **Failure / Recovery Approach:** Forward recovery default. If rollback is required: `MIG-004` deletes strictly row IDs logged in `flwdsk_migration_log`; `MIG-002` reverts repository pointers to legacy table; `MIG-001` deprecates column usage in code without dropping.

#### Work Package 3: Universal `SearchableBatchSelect` & Training Touchpoints
1. **Scope & Exclusions:** Build reusable `SearchableBatchSelect` component and deploy across all 10 training touchpoints. Enforce `CONF-001` (all employees change batch status). Enforce `DISC-002` (4 exact statuses: `Not Started`, `In Progress`, `Completed`, `Closed`). Implement `ISSUE-013` bidirectional adapter (`phase` vs `status`). Unify training touchpoints onto canonical `flwdsk_schedule_sessions`.
2. **Technical Implementation Approach:** Author accessible search combobox with keyboard navigation. Replace native selects in Batch Console, Training Calendar, Expense Claim form, Attendance Log, Task Create, etc. Map UI status strings to DB column `phase` in `training.repository.ts`.
3. **Dependencies & Prerequisites:** Phase 2 migrations complete.
4. **Expected Deliverables:** `src/shared/components/SearchableBatchSelect.tsx`, updated `TrainingCalendar.tsx`, `BatchManagement.tsx`, `training.repository.ts`.
5. **Automated Test Requirements:** Unit tests verifying batch search filtering and status adapter enum mapping.
6. **Local Verification Requirements:** Test batch selection and status transitions under Admin, Manager, Trainer, and Employee accounts.
7. **Completion Criteria:** All 10 touchpoints render standardized combobox; all employee roles can change batch status; sorting is chronological newest first.
8. **Failure / Recovery Approach:** Revert combobox to native select dropdown if accessibility or touch interaction fails.

#### Work Package 4: Incremental Repository Standardization & Soft-Delete Rules
1. **Scope & Exclusions:** Route 68 direct Supabase queries through typed domain repositories. Enforce selective soft-delete protocol (`.is('deleted_at', null)` on operational queries; preserve historical audit and expense analytics queries). Enforce project supervisor scoping via `ProjectService.getSupervisorProjects()` (`PROJECT-Q1`, `DISC-004`).
2. **Technical Implementation Approach:** Create or standardize domain repositories (`AttendanceRepository`, `TaskRepository`, `ProjectRepository`, `ExpenseRepository`). Inject mandatory `.is('deleted_at', null)` on operational queries. Scope supervisor queries strictly to allocated projects.
3. **Dependencies & Prerequisites:** Phase 2 and Phase 3 complete.
4. **Expected Deliverables:** Typed repository classes in `src/modules/*/repositories/`; updated service layer.
5. **Automated Test Requirements:** Repository unit tests verifying soft-deleted rows are filtered from active lists and included in audit queries.
6. **Local Verification Requirements:** Verify soft-deleted records do not appear in active task boards or employee lists, but remain visible in audit logs and past fiscal year expense summaries.
7. **Completion Criteria:** Zero raw Supabase queries in UI view components; 100% repository coverage.
8. **Failure / Recovery Approach:** Revert individual repository methods to legacy query format if data retrieval regressions occur.

#### Work Package 5: Monolithic Component Decomposition ($< 500$ LOC Guidelines)
1. **Scope & Exclusions:** Decompose `MyDayPage.tsx` (3,290 LOC), `AttendanceLogPage.tsx` (1,420 LOC), and `ProjectList.tsx` (1,884 LOC) into sub-components $< 500$ LOC. Exclude functional workflow or visual design changes (strict visual & functional equivalence).
2. **Technical Implementation Approach:** Extract presentational components, custom hooks, and state logic into co-located component folders. Preserve exact props, state flows, and event handlers.
3. **Dependencies & Prerequisites:** Phase 4 repository standardization complete; Phase 0A tests active.
4. **Expected Deliverables:** Modularized component directories; all files verified $< 500$ LOC.
5. **Automated Test Requirements:** Vitest calculation and lifecycle test suites pass 100%.
6. **Local Verification Requirements:** Visual regression inspection across all decomposed screens; verify 100% functional equivalence.
7. **Completion Criteria:** LOC audit confirms zero files exceed 500 LOC; zero UI regressions.
8. **Failure / Recovery Approach:** Revert decomposition file-by-file if state synchronization fails.

#### Work Package 6: Progressive Type Safety & Dead Code Elimination
1. **Scope & Exclusions:** Refactor TypeScript `TaskStatus` union to exactly 7 states (`DISC-003`). Resolve all `any` types across core modules. Prune dead in-memory engines in `src/core/engines/`. Decoupled from leave logic (resolved in Phase 1).
2. **Technical Implementation Approach:** Update `src/modules/task/task.types.ts` to `Pending Approval | To Do | In Progress | Under Review | Approved | Completed | Rejected / Closed`. Resolve exhaustive switch statements. Remove orphaned in-memory engines.
3. **Dependencies & Prerequisites:** Phase 4 and Phase 5 complete.
4. **Expected Deliverables:** Strongly typed models; clean `npm run typecheck` output; pruned dead engine directories.
5. **Automated Test Requirements:** `npm run typecheck` passes with zero errors; Vitest test suites pass 100%.
6. **Local Verification Requirements:** Execute full project build; verify zero TypeScript compiler warnings.
7. **Completion Criteria:** Zero `any` types in core domain models; 100% clean TypeScript build.
8. **Failure / Recovery Approach:** Restore explicit type narrowing guards if exhaustive checking reveals unhandled states.

#### Work Package 7: Dynamic Imports (`ISSUE-014`) & UI/UX Requirements Implementation
1. **Scope & Exclusions:** Implement dynamic `import()` for `xlsx`, `jspdf`, `html2canvas` (`ISSUE-014`). Implement all 20 UI/UX requirements (`UIUX-REQ-001` through `UIUX-REQ-020`). Deliver complete 16-metric Expense Analytics canvas (`UIUX-REQ-018`). Exclude `Mobile App/` directory (planning only).
2. **Technical Implementation Approach:** Wrap export handlers in `import()` promises. Deliver UI enhancements across Batch 01 (REQ-001 to 010) and Batch 02 (REQ-011 to 020). Build 6-tab Expense Analytics dashboard with exact 16 metrics (Average Amount excluded; Metric 7 canonical sessions only).
3. **Dependencies & Prerequisites:** Phases 0 through 6 complete.
4. **Expected Deliverables:** Complete UI/UX implementation; 16-metric analytics canvas; Vite bundle chunks $< 500	ext{ kB}$.
5. **Automated Test Requirements:** Unit tests in `expense-math.test.ts`; bundle analyzer verification report.
6. **Local Verification Requirements:** Complete walkthrough of all 20 UI/UX requirements; verify Metric 7 calculation against sample batch data.
7. **Completion Criteria:** All 20 UI/UX requirements pass acceptance criteria; initial bundle chunk verified $< 200	ext{ kB}$; 16 metrics display verified data.
8. **Failure / Recovery Approach:** Revert dynamic imports to synchronous if export download fails.

#### Work Package 8: End-to-End Master Regression & Deployment Sign-Off Gate
1. **Scope & Exclusions:** Comprehensive end-to-end regression testing across all 20 active application modules against `docs/BUSINESS_RULES.md`. Zero new feature development.
2. **Technical Implementation Approach:** Execute complete automated test runner; perform manual end-to-end scenario walkthroughs across all 4 user roles (`ADMIN`, `MANAGER`, `TRAINER`, `EMPLOYEE`); prepare final verification and acceptance report.
3. **Dependencies & Prerequisites:** Phases 0 through 7 100% implemented and locally verified.
4. **Expected Deliverables:** Comprehensive Final Verification Report; zero outstanding critical or high defects; Tier 3 Executive Sign-Off document.
5. **Automated Test Requirements:** 100% passing test runner execution across all test suites.
6. **Local Verification Requirements:** Complete verification matrix covering all 20 active modules.
7. **Completion Criteria:** Stakeholder signs off on Tier 3 Production Deployment Gate; authorization granted for Git Push and subsequent production release.
8. **Failure / Recovery Approach:** If any regression is detected, reopen the specific work package in Phase 1–7 and resolve before final sign-off.

---

## 9. Remaining Unresolved Technical Questions & Risks

1. **`ISSUE-002` Server Logs Accessibility:** If staging reproduction does not capture root-cause runtime traces due to external Supabase hosting configurations, an explicit authorization will be required to inspect production edge function logs.
2. **`CAL-Q01` Legacy Calendar Records Count:** The volume of distinct calendar sessions in `flwdsk_calendar_sessions` requires read-only query quantification prior to Phase 2 migration authoring.
3. **Database Migration Execution Tooling:** Verify whether the stakeholder applies migrations via Supabase CLI (`supabase db push`), Supabase Web SQL Editor, or direct PostgreSQL connection pooler (Transaction Pooler vs Session Pooler).

---

## 10. Final Governance Confirmation

> **FORMAL VERIFICATION:**  
> - **Zero application source-code files were modified.**  
> - **Zero database schema alterations or migrations were executed.**  
> - **Zero production or development data records were altered.**  
> - **Zero Git commits or pushes were performed.**  
> - **Zero deployments were executed.**  
> - All stakeholder review directives, work packages, 16-metric expense specs, and migration safety protocols are 100% reconciled and locked into [`docs/MASTER_IMPLEMENTATION_PLAN.md`](file:///Users/apple/Downloads/flow-desk-main/docs/MASTER_IMPLEMENTATION_PLAN.md).

---

*(Antigravity is STOPPED and standing by. Implementation will commence only upon explicit stakeholder approval of this locked Master Implementation Plan.)*
