# Document 13: Inventory of New Findings, Gaps & Architectural Deficiencies

**Project:** `flow-desk-main`  
**Audit Date:** 31 October 2026  
**Auditor:** Antigravity (Strictly Read-Only Mode)  
**Standard:** Every finding documented with exact code references, severity, confirmed root causes, and recommended actions.

---

## 1. Master Findings & Gaps Register

| Finding ID | Module | Category | Title | Severity | Status | Target Action |
|---|---|---|---|:---:|:---:|:---:|
| **F-01** (`ISSUE-001`) | My Day / Tasks | UI / State Management | Task Duration Displays `0h 0m (Total: 7h 39m)` Before Refresh | High | Confirmed | `RWK-002` |
| **F-02** (`ISSUE-002`) | Runtime / Core | Runtime / Hydration | Cold-Mount Full Screen 500 Error on Page Refresh | High | Confirmed Risk | `RWK-001` |
| **F-03** (`ISSUE-003`) | Attendance | UI / Notifications | Duplicate "On Break" Toast Notifications | Medium | Confirmed | Patch `MyDayPage.tsx:498` |
| **F-04** (`ISSUE-004`) | Attendance | Data Integrity / DB | Clock-Out Incomplete Due to FK Deletion Conflict | High | Confirmed | Patch `SupabaseAttendanceRepository:182` |
| **F-05** (`ISSUE-005`) | Training / Calendar | Architecture / Data | Disconnected Training Session Tables (`CAL-Q01`) | High | Confirmed | `RWK-008` |
| **F-06** (`ISSUE-006`) | Projects | Architecture / Data | Project Team Member Dual Storage (`PROJECT-Q1`) | High | Confirmed | `RWK-006` |
| **F-07** (`ISSUE-007`) | Application-Wide | Data Integrity / Query | Missing Soft-Delete (`deleted_at IS NULL`) Filters | Medium | Confirmed | `RWK-009` |
| **F-08** (`ISSUE-008`) | DevOps / QA | Code Quality | Zero Automated Unit & Integration Tests in Repository | Medium | Confirmed | `RWK-010` |
| **F-09** (`ISSUE-009`) | Approvals Queue | Business Logic / Data | Task Rejection Permanently Deletes Task Records | High | Confirmed | Patch `ApprovalsQueue.tsx:472` |
| **F-10** (`ISSUE-010`) | Employee / Schema | Schema & Architecture | Missing Probation Columns on `flwdsk_employees` Table | High | Confirmed | Author DDL migration |
| **F-11** | Leave Management | Business Logic | `getLeaveBalance` Ignores Joining Date & Probation | Critical | Confirmed | `RWK-004` |
| **F-12** | Attendance | Workflow / Timezone | Overnight Shifts Crossing Midnight Fail `findActiveRecord` | High | Confirmed | Patch `attendance.service.ts:136` |
| **F-13** | Training Batches | Schema Alignment | Database Column Named `phase`, Business Rules Use `status` | Medium | Confirmed | Align types in `RWK-007` |
| **F-14** | Build / Performance | Web Performance | Bundle Chunks Exceeding 500 kB (`BatchManagement`) | Low | Confirmed | Dynamic import of export libraries |

---

## 2. Granular Technical Finding Specifications

### Finding F-01 (ISSUE-001): Task Duration Inconsistent Before vs. After Page Refresh
* **Module:** My Day / Task Timer
* **Category:** UI / State Management
* **Description:** A task with 7.65 hours logged displays `0h 0m (Total: 7h 39m)` before page refresh, but displays `7h 39m` after refresh.
* **Evidence:** [`src/app/pages/workspaces/MyDayPage.tsx#L1623-L1650`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L1623-L1650).
* **Confirmed Root Cause:** Split conditional rendering `totalHrsNum > secondsToday / 3600 && totalHrsFormatted && (Total: ...)` combined with asymmetric LocalStorage date stamp initialization.
* **Impact:** Confuses employees regarding their recorded working time.
* **Severity:** **High.**
* **Status:** Confirmed.
* **Recommended Action:** Standardize duration display on `totalHrsFormatted` via task `RWK-002`.

---

### Finding F-02 (ISSUE-002): Cold-Mount Full Screen 500 Error During Page Refresh
* **Module:** Runtime / App Router
* **Category:** Runtime / Error Boundary
* **Description:** Refreshing the application at `/app` occasionally displays an HTTP 500-style error or branded full-screen crash.
* **Evidence:** [`src/app/router.tsx#L67`](file:///Users/apple/Downloads/flow-desk-main/src/app/router.tsx#L67), [`src/app/pages/errors/ErrorPages.tsx#L34`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/errors/ErrorPages.tsx#L34).
* **Confirmed Root Cause:** Monolithic `<ErrorBoundary>` catches unhandled JavaScript exceptions in child widgets during cold hydration; plus risk of Supabase Auth Edge Function misconfiguration in JWT mode.
* **Impact:** Prevents page reloads during development and production.
* **Severity:** **High.**
* **Status:** Confirmed Risk.
* **Recommended Action:** Decompose error boundaries and lock `VITE_AUTH_MODE=legacy` via task `RWK-001`.

---

### Finding F-03 (ISSUE-003): Duplicate "On Break" Toast Notifications
* **Module:** Attendance / Break Management
* **Category:** UI / Notifications
* **Description:** Initiating an official break displays two identical "On Break: Enjoy your break" toast alerts.
* **Evidence:** [`src/app/pages/workspaces/MyDayPage.tsx#L498`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L498) & [`#L2809`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L2809).
* **Confirmed Root Cause:** `handleStartBreakWithTask` fires a toast at line 2809 and returns `true`. Then `AttendancePanel.handleBreakClick` sees `success === true` and fires a redundant second toast at line 498.
* **Impact:** Visual clutter and confusion.
* **Severity:** **Medium.**
* **Status:** Confirmed.
* **Recommended Action:** Remove the redundant toast invocation in `AttendancePanel.handleBreakClick`.

---

### Finding F-04 (ISSUE-004): Clock-Out Incomplete Due to FK Deletion Conflict
* **Module:** Attendance / Time Clock Repository
* **Category:** Data Integrity / PostgreSQL Constraints
* **Description:** Employee clock-out occasionally fails or reverts to "Clocked In" upon page refresh.
* **Evidence:** [`src/modules/attendance/supabase-attendance.repository.ts#L14-L26`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/supabase-attendance.repository.ts#L14-L26) & [`#L182-L190`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/supabase-attendance.repository.ts#L182-L190).
* **Confirmed Root Cause:** `syncWorkSessions` runs before `syncBreaks` and attempts `DELETE FROM flwdsk_work_sessions`. PostgreSQL rejects the deletion with error code `23503` (Foreign Key Constraint violation) because `flwdsk_break_records` references the work session without cascade. The error is silently swallowed in a `catch` block, leaving child sessions unclosed.
* **Impact:** Overinflated employee work hours across weekends.
* **Severity:** **High.**
* **Status:** Confirmed.
* **Recommended Action:** Execute break deletion before session deletion or perform an in-place `UPDATE` on `flwdsk_work_sessions`.

---

### Finding F-05 (ISSUE-005): Disconnected Training Session Tables (`CAL-Q01`)
* **Module:** Training / Calendar / My Day
* **Category:** Data & Architecture
* **Description:** Classes scheduled on `TrainingCalendar.tsx` save to `flwdsk_calendar_sessions`, but `MyDayPage.tsx` queries `flwdsk_schedule_sessions`, causing calendar sessions to disappear from the assigned trainer's My Day dashboard.
* **Evidence:** [`src/pages/training/TrainingCalendar.tsx#L111`](file:///Users/apple/Downloads/flow-desk-main/src/pages/training/TrainingCalendar.tsx#L111), [`src/pages/MyDayPage.tsx#L185`](file:///Users/apple/Downloads/flow-desk-main/src/pages/MyDayPage.tsx#L185).
* **Confirmed Root Cause:** Commit `e865cd2e` created an auxiliary table with RLS disabled to bypass schema constraints, but never updated dependent modules.
* **Impact:** Trainers cannot view assigned classes or take attendance directly.
* **Severity:** **High.**
* **Status:** Confirmed.
* **Recommended Action:** Execute Option B (`CAL-Q01`): consolidate into canonical `flwdsk_schedule_sessions` in `RWK-008`.

---

### Finding F-06 (ISSUE-006): Project Team Member Dual Storage (`PROJECT-Q1`)
* **Module:** Projects / Resource Scheduler
* **Category:** Data & Architecture
* **Description:** Team members added in Project Modal save to `flwdsk_projects.member_ids`, but Resource Scheduler saves to `flwdsk_resource_allocations`, leading to state desynchronization.
* **Evidence:** [`src/modules/project/forms/ProjectModal.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/project/forms/ProjectModal.tsx), [`src/modules/project/pages/ResourceScheduler.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/project/pages/ResourceScheduler.tsx).
* **Confirmed Root Cause:** Incomplete migration to relational resource allocation.
* **Impact:** Member assignments diverge depending on which screen is used.
* **Severity:** **High.**
* **Status:** Confirmed.
* **Recommended Action:** Execute `PROJECT-Q1`: standardize canonically on `flwdsk_resource_allocations` in `RWK-006`.

---

### Finding F-07 (ISSUE-007): Missing Soft-Delete Filtering in Direct Supabase Queries
* **Module:** Application-Wide UI Views
* **Category:** Data Integrity / Query Safety
* **Description:** Certain direct `supabase.from(...)` queries omit `.is('deleted_at', null)`, causing soft-deleted rows to reappear in listings.
* **Evidence:** `AnnouncementsBoard.tsx:41`, `ClientDirectory.tsx:84`.
* **Confirmed Root Cause:** Bypassing repository abstraction in UI views.
* **Impact:** Deleted records confuse end users.
* **Severity:** **Medium.**
* **Status:** Confirmed.
* **Recommended Action:** Enforce repository query routing in `RWK-009`.

---

### Finding F-08 (ISSUE-008): Zero Automated Test Coverage
* **Module:** Testing & QA / DevOps
* **Category:** Code Quality
* **Description:** The repository contains no unit or integration testing harness.
* **Evidence:** `package.json` contains no test runner dependency.
* **Confirmed Root Cause:** Test suite omitted during initial rapid development.
* **Impact:** Regressions in complex calculations can only be discovered manually.
* **Severity:** **Medium.**
* **Status:** Confirmed.
* **Recommended Action:** Install `vitest` and author unit test suites in `RWK-010`.

---

### Finding F-09 (ISSUE-009): Task Approval & Rejection Lifecycle Governance (Pre-Start vs Post-Start)
* **Module:** Approvals Queue / Tasks
* **Category:** Business Logic / Data Governance
* **Description:** Current implementation indiscriminately invokes `deleteTask(task.id)` on task rejection without distinguishing between pre-start assignment rejections and post-work submissions.
* **Evidence:** [`src/modules/attendance/pages/ApprovalsQueue.tsx#L471-L474`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/pages/ApprovalsQueue.tsx#L471-L474).
* **Confirmed Root Cause:** `handleRejectTaskAssignmentInline` executes `deleteTask(task.id)` unconditionally regardless of whether the task has work sessions, start timestamps, or accumulated work hours.
* **Final Approved Business Rule:**
  * **Scenario A (Pre-Start):** If task was never started, rejection permanently deletes the task record and any associated rejection record (no rejection history retained).
  * **Scenario B (Post-Start / Post-Work):** If task was ever started, it must NEVER be deleted (even if work hours = 0). It transitions to `Rejected / Closed`, preserves all history/work hours, rejection reason is optional, and employee cannot resubmit.
* **Severity:** **High.**
* **Status:** Decision Approved — Not Yet Implemented (Fix Status: Open — Not Fixed).
* **Recommended Action:** Update `ApprovalsQueue.tsx` to inspect work session history before deciding whether to hard-delete (pre-start) or update status to `Rejected / Closed` (post-start).

---

### Finding F-10 (ISSUE-010): Missing Probation Columns on `flwdsk_employees` Table
* **Module:** Employee Directory / Database Schema
* **Category:** Schema & Architecture
* **Description:** `flwdsk_employees` lacks `probation_end_date`, `probation_duration`, and `leave_accrual_start_date` columns in `reset-and-rebuild.sql` and all migrations.
* **Evidence:** [`supabase/reset-and-rebuild.sql#L83-L106`](file:///Users/apple/Downloads/flow-desk-main/supabase/reset-and-rebuild.sql#L83-L106).
* **Confirmed Root Cause:** Database schema was never migrated to support the approved `EMP-Q01` persistence model.
* **Impact:** `RWK-003` will fail with PostgREST missing column errors (`PGRST204`) if executed without a schema migration.
* **Severity:** **High.**
* **Status:** Confirmed.
* **Recommended Action:** Author and apply a versioned schema migration before frontend binding.

---

### Finding F-11: `LeaveService.getLeaveBalance` Calculates Quotas Unconditionally from April 1
* **Module:** Leave Management
* **Category:** Business Logic / Calculations
* **Description:** Annual leave quota is awarded based on months elapsed from April 1 for all employees, completely ignoring joining date and probation status.
* **Evidence:** [`src/modules/leave/leave.service.ts#L284-L295`](file:///Users/apple/Downloads/flow-desk-main/src/modules/leave/leave.service.ts#L284-L295).
* **Confirmed Root Cause:** Simplified placeholder formula was never updated to implement `BR-LEAVE-011` and `BR-LEAVE-013`.
* **Impact:** Employees joining mid-year or on probation receive unearned leave quotas.
* **Severity:** **Critical.**
* **Status:** Confirmed.
* **Recommended Action:** Implement pro-rata formula utility in `RWK-004`.

---

### Finding F-12: Overnight Shifts Crossing Midnight Fail `findActiveRecord` Lookups
* **Module:** Attendance / Clock-In & Clock-Out
* **Category:** Workflow / Timezone
* **Description:** An employee clocking in late at night and clocking out the next morning cannot clock out because `todayStr()` changes date.
* **Evidence:** [`src/modules/attendance/attendance.service.ts#L136`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/attendance.service.ts#L136).
* **Confirmed Root Cause:** `clockOut()` queries `findActiveRecord(employeeId, todayStr())` strictly by current date string.
* **Impact:** Employees working night shifts become permanently stuck in clocked-in status.
* **Severity:** **High.**
* **Status:** Confirmed.
* **Recommended Action:** Update `findActiveRecord` to resolve open sessions across past dates.

---

### Finding F-13: Training Batch Lifecycle Column Named `phase` in Database
* **Module:** Training Batches
* **Category:** Schema Alignment
* **Description:** Business rules specify batch status transitions (`Scheduled → In Progress → Completed → Closed`), but the database column on `flwdsk_batches` is named `phase`.
* **Evidence:** [`supabase/reset-and-rebuild.sql#L307`](file:///Users/apple/Downloads/flow-desk-main/supabase/reset-and-rebuild.sql#L307), [`src/modules/training/training.service.ts#L1097`](file:///Users/apple/Downloads/flow-desk-main/src/modules/training/training.service.ts#L1097).
* **Confirmed Root Cause:** Early domain terminology divergence.
* **Impact:** Developers looking for `status` will encounter type or runtime errors.
* **Severity:** **Medium.**
* **Status:** Confirmed.
* **Recommended Action:** Explicitly map `status` to `phase` in `RWK-007`.

---

### Finding F-14: Large JavaScript Bundle Chunks Exceeding 500 kB
* **Module:** Build / Performance
* **Category:** Web Performance
* **Description:** `BatchManagement.tsx` bundles to 623.8 kB, and `index.js` bundles to 641.1 kB.
* **Evidence:** Vite production build output.
* **Confirmed Root Cause:** Static imports of large export libraries (`xlsx`, `jspdf`, `html2canvas`).
* **Impact:** Slow initial cold load on slow connections.
* **Severity:** **Low.**
* **Status:** Confirmed.
* **Recommended Action:** Defer export libraries with dynamic `import()`.

