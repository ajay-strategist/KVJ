# Document 02: Module-Wise Pre-Rework Cross-Check & Audit

**Project:** `flow-desk-main`  
**Audit Date:** 31 October 2026  
**Auditor:** Antigravity (Strictly Read-Only Mode)  
**Scope:** 20 Active Application Modules & Workflows  

---

## 1. Executive Summary

This document performs an exhaustive cross-check across all **20 active modules and functional domains** of FlowDesk. Every module is evaluated across 11 verification dimensions: Requirements, Business Logic, Implementation Consistency, Functional Testing, Integration Testing, Technical Issues, Missing Validations, Incomplete UI/UX, Data Consistency, Dependencies, and Pending Decisions.

---

## 2. Granular Module-by-Module Audit

### Module 01: Employee Directory & Employee Status
- **Requirements Finalized:** Yes (`BR-EMP-001`, `BR-EMP-002`, `BR-EMP-003`).
- **Business Logic Finalized:** Yes (Status enum, fractional probation duration, round-half-up fractional days, automated completion without manual sign-off).
- **Implementation Consistency:** **Inconsistent.** Current implementation calculates duration in whole integer months and does not automatically transition status when the probation end date passes.
- **Testing Status:** Functional testing partially completed in dev; formal automated integration tests: None.
- **Unresolved Technical Issues:** `EMP-Q01` (lack of reverse-calculation precision flag or decimal column in live schema).
- **Missing Validations / Edge Cases:** Zero probation duration (`0` or blank) must not generate a dangling probation end date.
- **Incomplete UI/UX:** `EmployeeModal.tsx` lacks fractional month inputs and real-time bidirectional date calculation.
- **Data Consistency Concerns:** Unverified whether `flwdsk_employees` schema supports decimal probation duration in production.
- **Dependencies:** Leave Management (Leave Accrual Start Date depends on Probation End Date).
- **Awaiting Decision:** `EMP-Q01` (authoritative reverse calculation precision).

### Module 02: Attendance, Clock-In, Clock-Out & Break Management
- **Requirements Finalized:** Yes (`BR-ATT-001` to `BR-ATT-010`).
- **Business Logic Finalized:** Yes (9h workday, 1h break, work types: Office/Remote/Training/Marketing).
- **Implementation Consistency:** **Partially Consistent.** Core time clock operates, but edge cases trigger UI/workflow failures.
- **Testing Status:** Functional testing in progress; formal automated integration tests: None.
- **Unresolved Technical Issues:**
  - `ISSUE-003`: Duplicate "On Break" popups appear when starting a break.
  - `ISSUE-004`: Clock-out sometimes hangs or fails to persist, leaving the employee clocked in.
- **Missing Validations / Edge Cases:** Unclosed sessions across calendar days (weekend dangling clock-ins).
- **Incomplete UI/UX:** Break modal and clock-out drawer occasionally encounter double toast dispatches.
- **Data Consistency Concerns:** Sessions in `flwdsk_attendance_records` must sync correctly with child table `flwdsk_work_sessions`.
- **Dependencies:** Task Worklogs (clocking in/out or breaking auto-pauses tasks).
- **Awaiting Decision:** None on business policy. Technical investigation required in upcoming Attendance testing session.

### Module 03: Attendance Corrections
- **Requirements Finalized:** Yes (`BR-ATT-008`).
- **Business Logic Finalized:** Yes (Correction requests require managerial review; audit trail preserved).
- **Implementation Consistency:** **Consistent in UI, Weak in Database.** UI flows exist, but backend RLS permits direct employee updates.
- **Testing Status:** Manual testing passed; automated testing: None.
- **Unresolved Technical Issues:** Self-approval vulnerabilities in RLS policies on `flwdsk_attendance_corrections`.
- **Missing Validations / Edge Cases:** Duplicate correction submissions for the same historical calendar day.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** Overwriting approved correction timestamps without soft-delete history.
- **Dependencies:** Approval Queue, Attendance Record rollups.
- **Awaiting Decision:** None.

### Module 04: Leave Management
- **Requirements Finalized:** Yes (`BR-LEAVE-001` through `BR-LEAVE-013`).
- **Business Logic Finalized:** Yes (1 day/month baseline, zero accrual during probation, pro-rata formula, 0.5-day rounding, minimum 0.5-day positive allocation, two-tier approval).
- **Implementation Consistency:** **Inconsistent.** Current code does not enforce the pro-rata partial-month formula or probation exclusion.
- **Testing Status:** Manual happy-path tested; automated testing: None.
- **Unresolved Technical Issues:** `flwdsk_leave_balances` does not currently support partial-year pro-rata calculation triggers.
- **Missing Validations / Edge Cases:** Applying for leave on a date prior to the Leave Accrual Start Date.
- **Incomplete UI/UX:** `ApplyLeaveModal.tsx` does not display the pro-rata allocation calculation breakdown.
- **Data Consistency Concerns:** Balance deduction on approved leave must be idempotent.
- **Dependencies:** Employee Directory (Probation End Date / Accrual Start Date), Approval Queue.
- **Awaiting Decision:** None on business policy (fully resolved by `LEAVE-Q4A`). Schema trigger implementation required.

### Module 05: Tasks & Task Worklogs
- **Requirements Finalized:** Yes (`BR-TASK-001` through `BR-TASK-008`).
- **Business Logic Finalized:** Yes (Single active timer rule, progress update required on pause, auto-assignment to default project).
- **Implementation Consistency:** **Inconsistent.** Conflation between lifetime `actual_hours` and daily `secondsToday` causes UI duration display to mutate on page refresh.
- **Testing Status:** Manual tested; automated testing: None.
- **Unresolved Technical Issues:** `ISSUE-001` (My Day Task Duration display inconsistency before vs. after refresh).
- **Missing Validations / Edge Cases:** Starting a task timer while employee attendance status is clocked out or on break.
- **Incomplete UI/UX:** `TaskWidget` dual-display split `Today: X (Total: Y)` causes user confusion.
- **Data Consistency Concerns:** Global `taskTimerStore` and `localStorage` date reconciliation mismatches.
- **Dependencies:** Attendance Time Clock, Projects.
- **Awaiting Decision:** None. Fix specified under `ISSUE-001`.

### Module 06: Projects & Project Assignments
- **Requirements Finalized:** Yes (`BR-PROJ-001` through `BR-PROJ-008`).
- **Business Logic Finalized:** Yes (Project codes auto-generated, supervisor assignment, completion percentage derived from milestones/tasks).
- **Implementation Consistency:** **Partially Consistent.** Core CRUD operates, but team member assignment exhibits dual storage.
- **Testing Status:** Manual tested; automated testing: None.
- **Unresolved Technical Issues:** `PROJECT-Q1` (Canonical storage: `flwdsk_resource_allocations` vs `flwdsk_projects.member_ids`).
- **Missing Validations / Edge Cases:** Deleting a project that has active in-progress tasks.
- **Incomplete UI/UX:** Project member multi-select dropdown does not synchronize bidirectionally with resource allocation capacity.
- **Data Consistency Concerns:** Desynchronization between `member_ids` array and `flwdsk_resource_allocations` table.
- **Dependencies:** Tasks, Timesheets, Client Directory.
- **Awaiting Decision:** `PROJECT-Q1` (stakeholder direction required).

### Module 07: Timesheets
- **Requirements Finalized:** Yes (`BR-TS-001` through `BR-TS-006`).
- **Business Logic Finalized:** Yes (Timesheets aggregate task work sessions; weekly submission and manager approval).
- **Implementation Consistency:** **Consistent.** Timesheet tracker reads `flwdsk_task_work_sessions`.
- **Testing Status:** Functional testing completed; automated testing: None.
- **Unresolved Technical Issues:** None blocking.
- **Missing Validations / Edge Cases:** Submitting timesheets for weeks with overlapping open task sessions.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** Reconciling manual timesheet entries against automated task timer logs.
- **Dependencies:** Tasks, Projects, Attendance.
- **Awaiting Decision:** None.

### Module 08: Client Directory
- **Requirements Finalized:** Yes (`BR-CLIENT-001` through `BR-CLIENT-005`).
- **Business Logic Finalized:** Yes (Lightweight CRM client records, contact management, project associations).
- **Implementation Consistency:** **Consistent.** Full CRUD operational via `SupabaseClientRepository`.
- **Testing Status:** Functional testing passed; automated testing: None.
- **Unresolved Technical Issues:** None.
- **Missing Validations / Edge Cases:** Soft-delete checks when listing active clients.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** None.
- **Dependencies:** Projects.
- **Awaiting Decision:** None.

### Module 09: Employee Expense Claims & Reimbursements
- **Requirements Finalized:** Yes (`BR-EXP-001` through `BR-EXP-010`).
- **Business Logic Finalized:** Yes (Per-person line items, travel distance calculation, advance deduction, manager &rarr; CEO approval).
- **Implementation Consistency:** **Consistent.** Expense claims flow cleanly; date parsing hardened in commit `be89779`.
- **Testing Status:** Functional testing passed; automated testing: None.
- **Unresolved Technical Issues:** None blocking.
- **Missing Validations / Edge Cases:** Maximum daily allowance validation.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** Advance settlement tracking.
- **Dependencies:** Travel Requests, Approvals Queue, Finance Analytics.
- **Awaiting Decision:** None.

### Module 10: Travel Requests
- **Requirements Finalized:** Yes (`BR-EXP-006`, `BR-EXP-007`).
- **Business Logic Finalized:** Yes (Pre-travel authorization, mode-specific rates).
- **Implementation Consistency:** **Consistent.**
- **Testing Status:** Manual tested; automated testing: None.
- **Unresolved Technical Issues:** None.
- **Missing Validations / Edge Cases:** Linking multiple travel days to a single master expense claim.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** None.
- **Dependencies:** Expense Claims.
- **Awaiting Decision:** None.

### Module 11: Finance & Expense Analytics
- **Requirements Finalized:** Yes (Scoped strictly to Expense Analytics and Batch Cost Allocation; budgets/payroll removed).
- **Business Logic Finalized:** Yes (Rollup of expense claims by department, project, and training batch).
- **Implementation Consistency:** **Consistent.** `ExpenseAnalyticsPage.tsx` active; excluded modules cleanly decoupled.
- **Testing Status:** Functional testing passed; automated testing: None.
- **Unresolved Technical Issues:** None.
- **Missing Validations / Edge Cases:** Empty state visualization when no expenses are logged in period.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** None.
- **Dependencies:** Expense Claims, Training Batches, Projects.
- **Awaiting Decision:** None.

### Module 12: Training Batch Scheduling
- **Requirements Finalized:** Yes (`BR-TRAIN-001` through `BR-TRAIN-008`).
- **Business Logic Finalized:** Yes (Batch code formatting, college association, trainer assignment).
- **Implementation Consistency:** **Consistent.** Batch code cleaning hardened via `cleanBatchCode`.
- **Testing Status:** Functional testing completed; automated testing: None.
- **Unresolved Technical Issues:** `TRAIN-Q02` (Authority to transition batch statuses).
- **Missing Validations / Edge Cases:** Scheduling overlapping batches for the same trainer at different college campuses.
- **Incomplete UI/UX:** `BatchManagement.tsx` is functional but large (>500 kB chunk).
- **Data Consistency Concerns:** `flwdsk_batches` status values alignment (`scheduled`, `in_progress`, `completed`, `closed`).
- **Dependencies:** Calendar, Trainer Assignment, Batch Expenses.
- **Awaiting Decision:** `TRAIN-Q02` (Progression authority).

### Module 13: Trainer Assignment
- **Requirements Finalized:** Yes (`BR-TRAIN-003`).
- **Business Logic Finalized:** Yes (Primary trainer assignment, trainer availability check).
- **Implementation Consistency:** **Consistent.**
- **Testing Status:** Functional testing passed; automated testing: None.
- **Unresolved Technical Issues:** None.
- **Missing Validations / Edge Cases:** Trainer leave conflicts with scheduled batch calendar.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** None.
- **Dependencies:** Training Batches, Calendar, Employee Directory.
- **Awaiting Decision:** None.

### Module 14: Batch Attendance & Batch Expenses
- **Requirements Finalized:** Yes (`BR-TRAIN-004`, `BR-TRAIN-007`).
- **Business Logic Finalized:** Yes (Session attendance sheet; batch expense allocation reading student count).
- **Implementation Consistency:** **Consistent.** Retains `flwdsk_enrollments` read access for batch operations.
- **Testing Status:** Functional testing passed; automated testing: None.
- **Unresolved Technical Issues:** `TRAIN-Q01` (Attendance cache vs dynamic calculation — deferred to future phase).
- **Missing Validations / Edge Cases:** Batch expenses exceeding college fee recovery threshold.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** Preserving student records without deleting shared tables during cleanup.
- **Dependencies:** Training Batches, Expense Claims.
- **Awaiting Decision:** None blocking FlowDesk rework.

### Module 15: Calendar & Scheduling
- **Requirements Finalized:** Yes (`BR-CAL-001` through `BR-CAL-003`).
- **Business Logic Finalized:** Yes (Trainer calendar view, public holidays overlay).
- **Implementation Consistency:** **Partially Consistent.** Calendar renders, but queries disparate session tables.
- **Testing Status:** Manual tested; automated testing: None.
- **Unresolved Technical Issues:** `CAL-Q01` (Dualism: `flwdsk_calendar_sessions` vs `flwdsk_schedule_sessions`).
- **Missing Validations / Edge Cases:** Day-31 boundary condition previously identified in calendar view.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** Desynchronization between calendar sessions and attendance logs.
- **Dependencies:** Training Batches, Attendance.
- **Awaiting Decision:** `CAL-Q01` (Session table unification).

### Module 16: Notifications System
- **Requirements Finalized:** Yes (Toast alerts, in-app notifications, event bus integration).
- **Business Logic Finalized:** Yes (Leave approved/rejected, task updates, break alerts).
- **Implementation Consistency:** **Consistent in UI, Event Bus Partially Disconnected.** `NotificationProvider` active.
- **Testing Status:** Manual tested; automated testing: None.
- **Unresolved Technical Issues:** Potential double-event dispatch on break start (`ISSUE-003`).
- **Missing Validations / Edge Cases:** Clearing read notifications on mobile viewports.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** None.
- **Dependencies:** All modules emitting events.
- **Awaiting Decision:** None.

### Module 17: Approvals Queue & Governance Hub
- **Requirements Finalized:** Yes (`BR-APP-001` through `BR-APP-004`).
- **Business Logic Finalized:** Yes (Consolidated queue for leaves, attendance corrections, and task reviews; self-approval prevention).
- **Implementation Consistency:** **Partially Consistent.** UI handles approval tabs; backend RLS lacks self-approval block.
- **Testing Status:** Manual tested; automated testing: None.
- **Unresolved Technical Issues:** Permissive RLS on `flwdsk_leave_records` and `flwdsk_attendance_corrections`.
- **Missing Validations / Edge Cases:** Rejection notes mandatory on task rework/rejection.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** Permanent task deletion on rejection instead of transitioning status.
- **Dependencies:** Leaves, Attendance Corrections, Tasks.
- **Awaiting Decision:** None.

### Module 18: Executive & Role Dashboard
- **Requirements Finalized:** Yes (Role-tailored dashboards for CEO, Manager, Supervisor, Employee).
- **Business Logic Finalized:** Yes (KPI cards, active task counters, attendance percentages).
- **Implementation Consistency:** **Consistent.** Role workspaces render clean role-specific widgets.
- **Testing Status:** Functional testing passed; automated testing: None.
- **Unresolved Technical Issues:** None blocking.
- **Missing Validations / Edge Cases:** Null checks on empty dashboard metrics.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** None.
- **Dependencies:** All reporting modules.
- **Awaiting Decision:** None.

### Module 19: Employee Profile
- **Requirements Finalized:** Yes (`BR-EMP-001`).
- **Business Logic Finalized:** Yes (Personal details, designation, contact information, role display).
- **Implementation Consistency:** **Consistent.** Profile editing and password updates operational.
- **Testing Status:** Functional testing passed; automated testing: None.
- **Unresolved Technical Issues:** None blocking.
- **Missing Validations / Edge Cases:** Email uniqueness validation on profile update.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** None.
- **Dependencies:** Employee Directory, Auth Service.
- **Awaiting Decision:** None.

### Module 20: Cross-Module Integrations & Communication
- **Requirements Finalized:** Yes (Chat channels, announcements board).
- **Business Logic Finalized:** Yes (Internal messaging via Supabase REST).
- **Implementation Consistency:** **Consistent via HTTP.** Real-time WebSockets (Socket.io) disconnected in frontend; relies on manual refresh or Supabase channel polling.
- **Testing Status:** Manual tested; automated testing: None.
- **Unresolved Technical Issues:** None blocking.
- **Missing Validations / Edge Cases:** Channel message pagination for high-volume chat.
- **Incomplete UI/UX:** Complete.
- **Data Consistency Concerns:** None.
- **Dependencies:** Employee Directory.
- **Awaiting Decision:** None.

