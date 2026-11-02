# FlowDesk Issues Register

This register serves as the authoritative project tracking log for operational defects, runtime errors, and technical issues identified in the FlowDesk (`flow-desk-main`) application.

---

## Active Issues Register

| Issue ID | Title | Module | Category | Priority | Investigation Status | Fix Status | Detailed Documentation Reference |
|---|---|---|---|---|---|---|---|
| **ISSUE-001** | My Day Task Duration Changes After Page Refresh | My Day / Task Timer | UI / State Management | High | Root Cause Identified | Open — Not Fixed | [`ISSUES/ISSUE-001_TASK_DURATION_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-001_TASK_DURATION_REFRESH.md) |
| **ISSUE-002** | HTTP 500 Error During Page Refresh | Runtime / API | Runtime / API | High | Investigation documented (Incident Cause Unconfirmed) | Open — Not Fixed | [`ISSUES/ISSUE-002_HTTP_500_DURING_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-002_HTTP_500_DURING_REFRESH.md) |
| **ISSUE-003** | Duplicate "On Break" Popups | Attendance / Break Management | UI / Attendance | Medium | Root Cause Identified (Dual Toast Call in MyDayPage) | Open — Not Fixed | [`ISSUES/ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md) |
| **ISSUE-004** | Employee Clock-Out Sometimes Does Not Complete | Attendance / Clock-In & Clock-Out | Attendance / Workflow | High | Root Cause Identified (FK Violation on WorkSession Delete) | Open — Not Fixed | [`ISSUES/ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md) |
| **ISSUE-005** | Dualism in Training Session Tables (`flwdsk_calendar_sessions` vs `flwdsk_schedule_sessions`) | Training / Calendar / My Day | Data & Architecture | High | Root Cause Identified (CAL-Q01) | Approved — Not Yet Implemented | [`ISSUES/ISSUE-005_TRAINING_SESSION_DUALISM.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-005_TRAINING_SESSION_DUALISM.md) |
| **ISSUE-006** | Dualism in Project Team Member Storage (`flwdsk_resource_allocations` vs `flwdsk_projects.member_ids`) | Projects / Scheduler | Data & Architecture | High | Root Cause Identified (PROJECT-Q1) | Approved — Not Yet Implemented | [`ISSUES/ISSUE-006_PROJECT_MEMBERSHIP_DUALISM.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-006_PROJECT_MEMBERSHIP_DUALISM.md) |
| **ISSUE-007** | Missing Soft-Delete (`deleted_at IS NULL`) Filter on Direct Supabase Queries | Application-Wide | Data Integrity | Medium | Code Vulnerability Confirmed | Open — Not Fixed | [`ISSUES/ISSUE-007_MISSING_SOFT_DELETE_FILTERS.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-007_MISSING_SOFT_DELETE_FILTERS.md) |
| **ISSUE-008** | Zero Automated Test Coverage (Absence of Unit & Integration Test Harness) | Testing & QA | Code Quality / DevOps | Medium | Repository Gap Confirmed | Open — Not Fixed | [`ISSUES/ISSUE-008_ZERO_AUTOMATED_TEST_COVERAGE.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-008_ZERO_AUTOMATED_TEST_COVERAGE.md) |
| **ISSUE-009** | Task Approval & Rejection Governance (Pre-Start Deletion vs Post-Start Preservation) | Approvals Queue / Tasks | Business Logic / Data Loss | High | Root Cause Identified (`ApprovalsQueue.tsx:472`) | Approved — Not Yet Implemented | [`ISSUES/ISSUE-009_APPROVALS_QUEUE_TASK_DELETION.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-009_APPROVALS_QUEUE_TASK_DELETION.md) |
| **ISSUE-010** | Database Schema Absence of Probation & Accrual Columns on `flwdsk_employees` | Employee / Database Migrations | Data & Architecture | High | Root Cause Identified (Columns Missing in SQL & DB) | Open — Not Fixed | [`ISSUES/ISSUE-010_MISSING_PROBATION_SCHEMA_COLUMNS.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-010_MISSING_PROBATION_SCHEMA_COLUMNS.md) |

---

## Detailed Issue Summaries

### ISSUE-001: My Day Task Duration Changes After Page Refresh
* **Issue ID:** `ISSUE-001`
* **Title:** My Day Task Duration Changes After Page Refresh
* **Module:** My Day / Task Timer
* **Category:** UI / State Management
* **Priority:** High
* **Investigation Status:** Root Cause Identified (Conflation between lifetime `actual_hours` and daily `secondsToday` in `TaskWidget`).
* **Fix Status:** Open — Not Fixed.
* **Detailed Documentation Reference:** [`ISSUES/ISSUE-001_TASK_DURATION_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-001_TASK_DURATION_REFRESH.md)
* **Observed Problem:** Task duration displays `0h 0m (Total: 7h 39m)` before page refresh, but displays `7h 39m` after refresh.
* **Expected Behavior:** Display only the accumulated total duration, such as `7h 39m`, consistently across page refreshes.
* **Root Cause Findings:** Incorrect initialization of daily timer seconds (`secondsToday`) using lifetime `actual_hours`, asymmetric `localStorage` date reconciliation (`isStaleDay` resets to 0 but updates the date stamp, so the subsequent reload uses the lifetime hours directly), and conditional split rendering in `TaskWidget` (`totalHrsNum > secondsToday / 3600`).
* **Database Status:** Accurate (`actual_hours = 7.65` in `flwdsk_tasks`).

---

### ISSUE-002: HTTP 500 Error During Page Refresh
* **Issue ID:** `ISSUE-002`
* **Title:** HTTP 500 Error During Page Refresh
* **Module:** Runtime / API
* **Category:** Runtime / API
* **Priority:** High
* **Investigation Status:** Investigation documented; actual incident root cause not conclusively confirmed.
* **Fix Status:** Open — Not Fixed.
* **Detailed Documentation Reference:** [`ISSUES/ISSUE-002_HTTP_500_DURING_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-002_HTTP_500_DURING_REFRESH.md)
* **Observed Problem:** Application displays an HTTP 500-style error or branded full-screen 500 error page when refreshing `/app`.
* **Investigation Findings:**
  1. **Mechanism 1 (Client-Side ErrorBoundary Crash):** Monolithic `<ErrorBoundary>` catches unhandled JavaScript exceptions during cold mount and renders `<ServerError code="500">` with a "Retry" button that reloads the page.
  2. **Mechanism 2 (Supabase Edge Function Failure):** In `AUTH_MODE=jwt`, `refreshJwtSession()` calls `POST /functions/v1/refresh-session`. If server secrets or the `flwdsk_auth_refresh_tokens` database table are missing, the Edge Function returns `HTTP 500 {"error":"server_misconfigured"}` or `HTTP 500 {"error":"server_error"}`.
* **Incident Attribution:** Neither mechanism is asserted as the single conclusively confirmed root cause of the specific user incident due to inaccessible production runtime logs.

---

### ISSUE-003: Duplicate "On Break" Popups
* **Issue ID:** `ISSUE-003`
* **Title:** Duplicate "On Break" Popups
* **Module:** Attendance / Break Management
* **Category:** UI / Attendance
* **Priority:** Medium
* **Investigation Status:** Root Cause Identified (Dual Toast Call in MyDayPage).
* **Fix Status:** Open — Not Fixed.
* **Detailed Documentation Reference:** [`ISSUES/ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md)
* **Observed Problem:** Starting a break displays two "On Break" popups or toast notifications.
* **Expected Behavior:** Exactly one confirmation popup/toast should appear when a break is started.
* **Root Cause Findings:** Identified in `MyDayPage.tsx`. When `handleBreakClick` invokes `onStartBreakWithTask`, `handleStartBreakWithTask` fires a toast (line 2809) and returns `true`. Then `handleBreakClick` sees `success === true` and fires an identical redundant toast (line 498).
* **Remediation:** Remove redundant toast invocation in `AttendancePanel.handleBreakClick`.

---

### ISSUE-004: Employee Clock-Out Sometimes Does Not Complete
* **Issue ID:** `ISSUE-004`
* **Title:** Employee Clock-Out Sometimes Does Not Complete
* **Module:** Attendance / Clock-In & Clock-Out
* **Category:** Attendance / Workflow
* **Priority:** High
* **Investigation Status:** Root Cause Identified (FK Violation on WorkSession Delete).
* **Fix Status:** Open — Not Fixed.
* **Detailed Documentation Reference:** [`ISSUES/ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md)
* **Observed Problem:** An employee attempts to clock out, but the action fails to complete, leaving the employee in an active "Clocked In" state.
* **Expected Behavior:** A valid clock-out action must reliably transition the attendance record to `clocked_out`, persist the clock-out timestamp to the database, close active work sessions/timers, and reflect the "Clocked Out" state in the UI.
* **Root Cause Findings:** In `SupabaseAttendanceRepository.update()`, `syncWorkSessions` runs before `syncBreaks` and attempts to delete rows in `flwdsk_work_sessions`. Because `flwdsk_break_records` holds a foreign key reference without cascade, PostgreSQL rejects the deletion (`23503`), which is caught and logged silently, leaving child sessions open. Furthermore, overnight sessions crossing midnight are missed when `AttendanceService.clockOut()` filters by `todayStr()`.
* **Remediation:** Synchronize breaks before work sessions or perform in-place `UPDATE` on `flwdsk_work_sessions`, and allow active record resolution across past dates.

---

## Newly Identified Pre-Rework Audit Issues (ISSUE-005 to ISSUE-008)

The following architectural and quality defects were identified during the 31 October 2026 Pre-Rework Audit. Each has a dedicated specification document in `flow-desk-main/ISSUES/`:

### ISSUE-005: Architectural Dualism in Training Session Tables
* **Issue ID:** `ISSUE-005`
* **Title:** Dualism in Training Session Tables (`flwdsk_calendar_sessions` vs `flwdsk_schedule_sessions`)
* **Module:** Training / Calendar / My Day
* **Category:** Data & Architecture
* **Priority:** High
* **Investigation Status:** Root Cause Identified (Linked to Decision `CAL-Q01`).
* **Fix Status:** Approved — Not Yet Implemented.
* **Detailed Documentation Reference:** [`ISSUES/ISSUE-005_TRAINING_SESSION_DUALISM.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-005_TRAINING_SESSION_DUALISM.md)
* **Observed Problem:** Sessions scheduled in the Training Calendar write to `flwdsk_calendar_sessions`, but `MyDayPage` and attendance logging query `flwdsk_schedule_sessions`, causing calendar sessions to disappear from trainer dashboards.
* **Expected Behavior:** Single canonical table (`flwdsk_schedule_sessions`) supporting planning, daily briefing, and attendance.

---

### ISSUE-006: Dualism in Project Team Member Storage
* **Issue ID:** `ISSUE-006`
* **Title:** Dualism in Project Team Member Storage (`flwdsk_resource_allocations` vs `flwdsk_projects.member_ids`)
* **Module:** Projects / Resource Scheduler
* **Category:** Data & Architecture
* **Priority:** High
* **Investigation Status:** Root Cause Identified (Linked to Decision `PROJECT-Q1`).
* **Fix Status:** Approved — Not Yet Implemented.
* **Detailed Documentation Reference:** [`ISSUES/ISSUE-006_PROJECT_MEMBERSHIP_DUALISM.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-006_PROJECT_MEMBERSHIP_DUALISM.md)
* **Observed Problem:** Project edit modal saves members to `member_ids` (JSON array) while Resource Scheduler saves to `flwdsk_resource_allocations`, leading to desynchronization.
* **Expected Behavior:** `flwdsk_resource_allocations` serves as the single canonical source of truth for project membership.

---

### ISSUE-007: Missing Soft-Delete Filter on Direct Supabase Queries
* **Issue ID:** `ISSUE-007`
* **Title:** Missing Soft-Delete (`deleted_at IS NULL`) Filter on Direct Supabase Queries
* **Module:** Application-Wide UI Views
* **Category:** Data Integrity / Query Safety
* **Priority:** Medium
* **Investigation Status:** Code Vulnerability Confirmed.
* **Fix Status:** Open — Not Fixed.
* **Detailed Documentation Reference:** [`ISSUES/ISSUE-007_MISSING_SOFT_DELETE_FILTERS.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-007_MISSING_SOFT_DELETE_FILTERS.md)
* **Observed Problem:** Certain direct PostgREST table calls omit `.is('deleted_at', null)`, causing soft-deleted rows to reappear.
* **Expected Behavior:** Standardize soft-delete filtering across all data fetching paths.

---

### ISSUE-008: Zero Automated Test Coverage
* **Issue ID:** `ISSUE-008`
* **Title:** Zero Automated Test Coverage (Absence of Unit & Integration Test Harness)
* **Module:** Testing & Quality Assurance
* **Category:** Code Quality / DevOps
* **Priority:** Medium
* **Investigation Status:** Repository Gap Confirmed.
* **Fix Status:** Open — Not Fixed.
* **Detailed Documentation Reference:** [`ISSUES/ISSUE-008_ZERO_AUTOMATED_TEST_COVERAGE.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-008_ZERO_AUTOMATED_TEST_COVERAGE.md)
* **Observed Problem:** No unit test runner or test suites exist in the repository, making calculations dependent on manual verification.
* **Expected Behavior:** Install `vitest` and implement test suites for core business rules (leave pro-rata, probation formulas, task timer sums).

---

### ISSUE-009: Task Approval & Rejection Lifecycle Governance
* **Issue ID:** `ISSUE-009`
* **Title:** Task Approval & Rejection Lifecycle Governance (Pre-Start Deletion vs. Post-Start Preservation)
* **Module:** Approvals Queue / Task Management
* **Category:** Business Logic / Data Integrity
* **Priority:** High
* **Investigation Status:** Root Cause Identified (`ApprovalsQueue.tsx:472`).
* **Decision Status:** Approved — Not Yet Implemented (Stakeholder Confirmation 31 Oct 2026).
* **Fix Status:** Open — Not Fixed (Pending Implementation & Verification).
* **Detailed Documentation Reference:** [`ISSUES/ISSUE-009_APPROVALS_QUEUE_TASK_DELETION.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-009_APPROVALS_QUEUE_TASK_DELETION.md)
* **Observed Problem:** In `ApprovalsQueue.tsx:472`, `handleRejectTaskAssignmentInline` calls `deleteTask(task.id)` unconditionally, hard-deleting the task even if work was performed.
* **Approved Business Rules (31 Oct 2026):**
  1. **Scenario A (Pre-Start Task Approval):** If a Supervisor rejects a proposed task before the employee has ever started it, hard-delete the task record and its rejection record without retaining history.
  2. **Scenario B (Post-Start Task Review):** Once an employee has started a task (even if work hours equal zero), the task record must **never be deleted**. If rejected by a supervisor, change its status to `Rejected / Closed`, preserve all recorded work hours and history, accept optional rejection reason, and prohibit resubmission.
  3. **Critical Deletion Rule:** Deletion depends strictly on whether the task was **ever started**, not merely on whether `work_hours > 0`.
* **Technical Implementation:** Distinguish pre-start tasks (`pending_approval`) from post-start review tasks (`under_review`) in `ApprovalsQueue.tsx`.

---

### ISSUE-010: Database Schema Absence of Probation & Accrual Columns on `flwdsk_employees`
* **Issue ID:** `ISSUE-010`
* **Title:** Database Schema Absence of Probation and Accrual Date Columns on `flwdsk_employees`
* **Module:** Employee Directory / Database Migrations
* **Category:** Data & Architecture
* **Priority:** High
* **Investigation Status:** Root Cause Identified (Columns Missing in SQL & DB).
* **Fix Status:** Open — Not Fixed.
* **Detailed Documentation Reference:** [`ISSUES/ISSUE-010_MISSING_PROBATION_SCHEMA_COLUMNS.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-010_MISSING_PROBATION_SCHEMA_COLUMNS.md)
* **Observed Problem:** `flwdsk_employees` lacks `probation_end_date`, `probation_duration`, and `leave_accrual_start_date` columns in `reset-and-rebuild.sql` and all migrations, blocking `RWK-003` without a prior schema migration.
* **Expected Behavior:** Author versioned migration adding columns to `flwdsk_employees` before frontend binding.

