# Document 10: Business Logic Completeness Audit Across All 20 Active Modules

**Project:** `flow-desk-main`  
**Audit Date:** 31 October 2026  
**Auditor:** Antigravity (Strictly Read-Only Mode)  
**Reference Specification:** [`BUSINESS_RULES_AND_CLARIFICATIONS.md`](file:///Users/apple/Downloads/flow-desk-main/BUSINESS_RULES_AND_CLARIFICATIONS.md)  

---

## 1. Executive Summary

This document audits the business logic implementation across all 20 active modules in FlowDesk against the approved business rules and stakeholder decisions. It identifies all discrepancies where current application behavior deviates from confirmed policies, missing validations, incorrect calculations, and unhandled business edge cases.

---

## 2. Granular Module-by-Module Business Logic Audit

### Module 01: Employee Directory & Status Lifecycle
* **Approved Business Rules:** `BR-EMP-001`, `BR-EMP-002`, `BR-EMP-003`, `EMP-Q01`.
* **Current Implementation Analysis:**
  - `src/modules/employee/forms/EmployeeFormModal.tsx` contains basic personal fields (first/last name, email, employeeId, designation, dateOfJoining, role, status), but **completely lacks probation duration and probation end date fields**.
  - `src/modules/employee/employee.repository.ts` omits probation properties from the `Employee` interface.
  - No automated routine exists to check whether `probation_end_date` has passed to automatically mark probation as completed.
* **Gaps Identified:**
  1. **Missing Configurable Probation UI:** Neither the Add nor Edit modal supports entering fractional months (`2.5`, `2.9`) or selecting `0` (no probation).
  2. **Missing Authoritative End Date Persistence (`EMP-Q01`):** End Date is not stored; reverse-calculation cannot occur.
  3. **Suspended Status Logic:** Enforced in `useAttendance.ts` (suspended employees blocked from clocking in), but automatic probation completion while suspended is not automated.
* **Severity:** **High.** Blocks accurate leave accrual calculations.

---

### Module 02: Attendance, Clock-In, Clock-Out & Break Management
* **Approved Business Rules:** `BR-ATT-001` through `BR-ATT-010`.
* **Current Implementation Analysis:**
  - Standard workday calculation: 9 hours with 1 hour break.
  - `MyDayPage.tsx` and `useAttendance.ts` enforce single active status: `present`, `on_break`, `clocked_out`.
  - When starting a break or clocking out, active task timers are auto-paused via `pauseRunningTasks()`.
* **Gaps Identified:**
  1. **Work Update Mandatory on Break:** When an active task is running, `handleBreakClick` prompts for a work progress update (`MyDayPage.tsx:522`). However, if no task is running, it allows starting a break without a note.
  2. **Overnight Sessions Across Midnight:** If an employee clocks in at 11:00 PM and clocks out at 7:00 AM, `attendance.service.ts:136` uses `todayStr()` (the current day), failing to locate the active record created on the previous calendar date.
  3. **Weekend Dangling Clock-Ins:** An unclosed session left open on Friday accumulates excessive working hours until force-closed or self-healed.
* **Severity:** **High.** Directly affects timesheet accuracy.

---

### Module 03: Attendance Corrections
* **Approved Business Rules:** `BR-ATT-008`.
* **Current Implementation Analysis:**
  - `AttendanceLogPage.tsx` allows employees to submit correction requests specifying field, original value, proposed value, and reason.
  - Requests write to `flwdsk_attendance_corrections` with `status = 'pending'`.
  - Managers approve or reject via `ApprovalsQueue.tsx`.
* **Gaps Identified:**
  1. **Duplicate Correction Guard:** An employee can submit multiple pending corrections for the exact same historical date and field simultaneously.
  2. **Direct Record Mutation Risk:** Once approved, `AttendanceService.approveCorrection` updates the attendance record directly without retaining an explicit audit revision number on the master record.
* **Severity:** **Medium.** Minor governance risk.

---

### Module 04: Leave Management
* **Approved Business Rules:** `BR-LEAVE-001` through `BR-LEAVE-013`, `LEAVE-Q4A`.
* **Current Implementation Analysis:**
  - Base entitlement: 1 day/month (12 days/year).
  - Two-tier approval: `ReportingManager → CEO`.
* **Gaps Identified:**
  1. **New Joiner Quota Calculation Disconnect (`BR-LEAVE-011`, `BR-LEAVE-013`):**  
     In `LeaveService.getLeaveBalance` (`leave.service.ts:284-295`):
     ```typescript
     const monthsElapsed = now.getMonth() >= 3 ? (now.getMonth() - 3 + 1) : (12 - 3 + now.getMonth() + 1);
     const totalAllocatedDays = allocationPerMonth * Math.max(1, monthsElapsed);
     ```
     The calculation counts months elapsed from the Financial Year start (April 1) for **ALL employees unconditionally**. An employee who joined yesterday is granted the full months elapsed since April!
  2. **Probation Accrual Exclusion Disconnect:** The calculation completely ignores probation. Zero leave should accrue during probation, and accrual should start strictly from `Leave Accrual Start Date`.
  3. **Missing Pro-Rata Partial-Month Formula (`LEAVE-Q4A`):** The formula `(eligible days / total month days) * 1` rounded to the nearest 0.5-day increment with minimum 0.5-day positive allocation is completely absent from `leave.service.ts`.
* **Severity:** **Critical.** Causes massive leave entitlement errors for all new joiners.

---

### Module 05: Tasks & Task Worklogs
* **Approved Business Rules:** `BR-TASK-001` through `BR-TASK-008`.
* **Current Implementation Analysis:**
  - Single active task timer rule strictly enforced by `taskTimerStore`.
  - Progress updates required on pause.
* **Gaps Identified:**
  1. **Duration Refresh Inconsistency (`ISSUE-001`):** `TaskWidget` conditionally splits display: `0h 0m (Total: 7h 39m)` before refresh, and `7h 39m` after refresh. Standard total duration display required.
  2. **Timer Execution Off-Shift:** An employee can start a task timer even if their attendance status is `clocked_out`.
* **Severity:** **High.** User confusion and UI discrepancy.

---

### Module 06: Projects & Project Assignments
* **Approved Business Rules:** `BR-PROJ-001` through `BR-PROJ-008`, `BR-PRJ-009`, `PROJECT-Q1`.
* **Current Implementation Analysis:**
  - Auto-generated project codes, supervisor assignment, completion tracking.
* **Gaps Identified:**
  1. **Dual Member Storage (`ISSUE-006`):** `ProjectModal.tsx` saves to `flwdsk_projects.member_ids` (JSON string array), whereas `ResourceScheduler.tsx` saves to `flwdsk_resource_allocations`. Decision `PROJECT-Q1` approved canonicalizing on `flwdsk_resource_allocations`.
  2. **Allocation Capacity Enforcement:** System allows allocating >100% capacity (approved under `PROJECT-Q5`), but UI provides no visual warning when an employee is assigned to 5+ projects simultaneously.
* **Severity:** **High.** Resolved by rework task `RWK-006`.

---

### Module 07: Timesheets
* **Approved Business Rules:** `BR-TS-001` through `BR-TS-006`.
* **Current Implementation Analysis:**
  - `TimesheetTracker.tsx` reads work sessions from `flwdsk_task_work_sessions`.
  - Aggregates hours by project and day.
* **Gaps Identified:**
  1. **Manual Entry Conflict:** When manual time adjustments are submitted, they do not create a corresponding audit record linking back to the original automated task session.
* **Severity:** **Low.** Operational convenience.

---

### Module 08: Client Directory
* **Approved Business Rules:** `BR-CLIENT-001` through `BR-CLIENT-005`.
* **Current Implementation Analysis:**
  - Simplified contact register. Client name is mandatory.
* **Gaps Identified:**
  1. **Soft-Delete Filtering:** Direct listing queries in `ClientDirectory.tsx` must explicitly include `.is('deleted_at', null)`.
* **Severity:** **Low.**

---

### Module 09: Employee Expense Claims & Reimbursements
* **Approved Business Rules:** `BR-EXP-001` through `BR-EXP-010`.
* **Current Implementation Analysis:**
  - Per-person line item breakdown, mileage calculation, advance deduction.
* **Gaps Identified:**
  1. **Maximum Daily Allowance Enforcement:** Expense form allows entering amounts exceeding standard daily thresholds without requiring managerial justification text.
* **Severity:** **Medium.** Policy compliance.

---

### Module 10: Travel Requests
* **Approved Business Rules:** `BR-EXP-006`, `BR-EXP-007`.
* **Current Implementation Analysis:**
  - Pre-travel authorization form linked to expense claims.
* **Gaps Identified:**
  1. **Multi-Day Travel Claims:** Travel request claims spanning across financial months lack automated line-item monthly splitting.
* **Severity:** **Low.**

---

### Module 11: Finance & Expense Analytics
* **Approved Business Rules:** Scoped strictly to expense analytics and batch cost allocations (budgets/payroll permanently excluded).
* **Current Implementation Analysis:**
  - `ExpenseAnalyticsPage.tsx` aggregates claims by category, project, and training batch.
* **Gaps Identified:**
  1. **Zero-Expense Batches:** When viewing a batch with 0 claims, cost-per-student KPI renders `$NaN` instead of `$0.00`.
* **Severity:** **Medium.** Presentation edge case.

---

### Module 12: Training Batch Scheduling
* **Approved Business Rules:** `BR-TRN-001`, `BR-TRN-002`, `TRAIN-Q02`.
* **Current Implementation Analysis:**
  - Batch creation, college mapping, course curriculum binding.
* **Gaps Identified:**
  1. **Role-Gating Batch Lifecycle (`TRAIN-Q02`):** `BatchManagement.tsx` currently allows any user with training edit permissions to update batch status. Under approved decision `TRAIN-Q02`, only Managers, Admins, and Assigned Trainers may transition a batch through `Scheduled → In Progress → Completed → Closed`.
  2. **Database Field Mismatch:** In `flwdsk_batches`, the database column is named `phase` rather than `status`.
* **Severity:** **High.** Addressed by `RWK-007`.

---

### Module 13: Trainer Assignment
* **Approved Business Rules:** `BR-TRN-001`, `BR-TRAIN-003`.
* **Current Implementation Analysis:**
  - Primary trainer assignment modal checks trainer designation.
* **Gaps Identified:**
  1. **Leave Conflict Warning:** If an assigned trainer applies for and is granted leave, existing scheduled batch assignments are not automatically flagged on the batch details drawer.
* **Severity:** **Medium.** Operational coordination risk.

---

### Module 14: Batch Attendance & Batch Expenses
* **Approved Business Rules:** `BR-TRN-001`, `BR-TRAIN-004`, `BR-TRAIN-007`.
* **Current Implementation Analysis:**
  - `StudentAttendance.tsx` loads session sheets. `BatchExpenseDetailsDrawer.tsx` computes expense allocations per student using `flwdsk_enrollments` count.
* **Gaps Identified:**
  1. **Preserved Inert Commercial Structures:** The UI displays student candidate details (onboarding status, fees) which belong to the future Student Training Management initiative. These should remain view-only without modification.
* **Severity:** **Low.** Scope boundary maintenance.

---

### Module 15: Calendar & Scheduling
* **Approved Business Rules:** `BR-CAL-001` through `BR-CAL-010`, `CAL-Q01`.
* **Current Implementation Analysis:**
  - Visual matrix planner renders batch sessions.
* **Gaps Identified:**
  1. **Session Table Dualism (`CAL-Q01`):** Calendar writes to `flwdsk_calendar_sessions`, but My Day and attendance read from `flwdsk_schedule_sessions`. Approved decision `CAL-Q01` (Option B) unifies all sessions canonically into `flwdsk_schedule_sessions`.
  2. **Overlapping Session Warning (`BR-CAL-005`):** Double-booking detection warns the user, but does not persist the conflict flag in the database for admin reporting.
* **Severity:** **High.** Addressed by `RWK-008`.

---

### Module 16: Notifications System
* **Approved Business Rules:** Toast notifications, in-app alerts, reminder center.
* **Current Implementation Analysis:**
  - `NotificationProvider.tsx` provides toast alerts.
* **Gaps Identified:**
  1. **Duplicate Break Toast (`ISSUE-003`):** Dual toast invocation between `MyDayPage.tsx:498` and `MyDayPage.tsx:2809`.
* **Severity:** **Medium.** Confirmed root cause identified.

---

### Module 17: Approvals Queue & Governance Hub
* **Approved Business Rules:** `BR-APP-001` through `BR-APP-004`.
* **Current Implementation Analysis:**
  - Unified queue for leaves, attendance corrections, expense claims, and task reviews.
* **Gaps Identified:**
  1. **Task Assignment Rejection Hard Deletion (`ISSUE-009`):** Rejecting a task assignment in `ApprovalsQueue.tsx:472` invokes `deleteTask(task.id)` unconditionally. Per approved governance, hard-deletion is ONLY permitted for Pre-Start rejections (never started); Post-Start tasks must transition to `Rejected / Closed`, preserve all history/hours, make reason optional, and block resubmission.
  2. **Self-Approval Prevention:** UI hides approval actions on an employee's own submission, but backend RLS policies lack check constraints.
* **Severity:** **High.** Data loss vulnerability.

---

### Module 18: Executive & Role Dashboard
* **Approved Business Rules:** Role-tailored dashboards for CEO, Manager, Supervisor, Employee.
* **Current Implementation Analysis:**
  - `RoleWorkspacePage.tsx` renders role-appropriate KPI cards and summary feeds.
* **Gaps Identified:**
  1. **Division by Zero:** Attendance percentage metric in KPI cards returns `NaN%` when an employee has 0 recorded working days in the current month.
* **Severity:** **Low.** Display formatting.

---

### Module 19: Employee Profile
* **Approved Business Rules:** `BR-EMP-001`.
* **Current Implementation Analysis:**
  - `EmployeeProfile.tsx` displays identity, contact details, role, and department.
* **Gaps Identified:**
  1. **Probation Completion Visibility:** Employee cannot view their scheduled probation end date or leave accrual start date on their personal profile card.
* **Severity:** **Medium.** Transparency requirement.

---

### Module 20: Cross-Module Integrations & Communication
* **Approved Business Rules:** Chat channels, announcements board, issue tickets.
* **Current Implementation Analysis:**
  - `ChatChannels.tsx`, `AnnouncementsBoard.tsx`, `IssuesPage.tsx` operational via HTTP REST.
* **Gaps Identified:**
  1. **Socket Disconnect:** Realtime WebSocket transport (`socket.io`) is disabled; messaging relies on manual refresh or Supabase polling.
* **Severity:** **Low.** Performance / real-time responsiveness.

