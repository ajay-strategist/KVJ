# Document 11: Technical Completeness Audit Across All 20 Active Modules

**Project:** `flow-desk-main`  
**Audit Date:** 31 October 2026  
**Auditor:** Antigravity (Strictly Read-Only Mode)  

---

## 1. Executive Summary

This document audits the technical architecture, database integrity, runtime stability, error-handling mechanisms, state synchronization, query efficiency, and testing coverage across the FlowDesk codebase. It distinguishes **conclusively confirmed technical defects** from **architectural risks and unverified hypotheses**.

---

## 2. Technical Evaluation Dimensions

### A. Database Schema & Relationship Integrity
1. **Missing Schema Columns on `flwdsk_employees` (`ISSUE-010` — Confirmed Defect):**  
   - *Evidence:* Inspection of `supabase/reset-and-rebuild.sql:83-106` and all migration scripts confirms that `probation_end_date`, `probation_duration`, and `leave_accrual_start_date` do not exist on `flwdsk_employees`.
   - *Impact:* Day 1 rework task `RWK-003` cannot be implemented without authoring a versioned DDL migration adding these columns.
2. **Foreign Key Constraint Conflict on `syncWorkSessions` (`ISSUE-004` — Confirmed Defect):**  
   - *Evidence:* In `src/modules/attendance/supabase-attendance.repository.ts:14`, `syncWorkSessions` attempts `DELETE FROM flwdsk_work_sessions WHERE attendance_record_id = ?` before deleting child break records. PostgreSQL blocks deletion due to `flwdsk_break_records.work_session_id` FK constraints without cascade.
   - *Impact:* Child sessions fail to update `clock_out`, causing clock-outs to fail or revert to "Clocked In" on reload.
3. **Database Dualism in Training Sessions (`ISSUE-005` / `CAL-Q01` — Confirmed Defect):**  
   - *Evidence:* `flwdsk_calendar_sessions` (planning) vs `flwdsk_schedule_sessions` (attendance). Bridge is missing; sessions created on calendar do not appear on My Day. Resolved by approved decision `CAL-Q01` (Option B).
4. **Database Dualism in Project Members (`ISSUE-006` / `PROJECT-Q1` — Confirmed Defect):**  
   - *Evidence:* `flwdsk_projects.member_ids` (JSON string array) vs `flwdsk_resource_allocations` (relational table). Resolved by approved decision `PROJECT-Q1`.

---

### B. Soft-Delete (`deleted_at IS NULL`) Consistency (`ISSUE-007`)
1. **Query Vulnerability Audit:**  
   - Repository-based queries (e.g. `SupabaseRepository.findMany`) automatically apply `.is('deleted_at', null)`.
   - Direct `supabase.from(...)` queries in certain UI components (e.g. `ClientDirectory.tsx:84`, `AnnouncementsBoard.tsx:41`, `ExpenseClaims.tsx:257`) mix manual filtering with direct table calls.
   - *Confirmed Defect:* Soft-deleted announcements or clients can reappear if direct UI queries fail to include `.is('deleted_at', null)`.
   - *Remediation:* Enforce repository abstraction across all 20 modules in `RWK-009`.

---

### C. Error Boundaries & Cold-Hydration Stability (`ISSUE-002` / `RWK-001`)
1. **Monolithic Boundary Risk:**  
   - *Evidence:* `src/app/router.tsx:67` wraps the entire `<Routes>` tree in a single `<ErrorBoundary>`.
   - *Failure Path:* If any asynchronous child widget (e.g. in `MyDayPage.tsx` or `BatchManagement.tsx`) encounters a synchronous `TypeError: Cannot read properties of undefined` during initial React mount, the top-level error boundary catches it and renders `<ServerError code="500">` (`src/app/pages/errors/ErrorPages.tsx:34`).
   - *Remediation:* Decompose into route-level and component-level error boundaries (`RWK-001`) with local retry fallbacks.
2. **Auth Edge Function Misconfiguration Risk:**  
   - *Evidence:* `POST /functions/v1/refresh-session` in `supabase-auth.service.ts:376` triggers HTTP 500 when `VITE_AUTH_MODE=jwt` is set without deployed server secrets.
   - *Remediation:* Lock `VITE_AUTH_MODE=legacy` across development and production configurations.

---

### D. State Synchronization & Refresh Inconsistency (`ISSUE-001` / `RWK-002`)
1. **Task Duration Display Split:**  
   - *Evidence:* In `MyDayPage.tsx:1623-1650`, `TaskWidget` renders:
     ```tsx
     {totalHrsNum > secondsToday / 3600 && totalHrsFormatted && (
       <span>(Total: {totalHrsFormatted})</span>
     )}
     ```
   - *Failure Path:* On initial load before timer start, `secondsToday = 0`, triggering the split display `0h 0m (Total: 7h 39m)`. On page refresh, LocalStorage reconciliation sets `secondsToday = totalHrsNum * 3600`, hiding the split and displaying `7h 39m`.
   - *Remediation:* Remove the conditional split; standardize duration display strictly on `totalHrsFormatted` (`RWK-002`).

---

### E. Concurrency, Race Conditions & Duplicate Dispatches (`ISSUE-003`)
1. **Asymmetric Double-Toast on Break Start:**  
   - *Evidence:* In `MyDayPage.tsx`, `handleBreakClick` invokes `onStartBreakWithTask` (line 496). `handleStartBreakWithTask` fires `toast({ variant: 'info', title: 'On Break', ... })` (line 2809) and returns `true`. Then `handleBreakClick` sees `success === true` and fires a second redundant `toast(...)` (line 498).
   - *Remediation:* Remove redundant toast in `AttendancePanel.handleBreakClick`.

---

### F. Query Performance, Payload Sizes & Bundle Metrics
1. **Large JavaScript Bundle Chunks:**  
   - Production build inspection (`npm run build`) identified chunks exceeding the 500 kB recommended threshold:
     - `dist/assets/BatchManagement-BsEHIDoM.js`: **623.80 kB** (gzip: 181.01 kB)
     - `dist/assets/index-D71ldvJ9.js`: **641.17 kB** (gzip: 180.90 kB)
     - `dist/assets/xlsx-BojT3SgY.js`: **424.38 kB** (gzip: 141.60 kB)
   - *Risk:* Slower initial page load on constrained networks during initial cold load.
   - *Remediation:* Defer Excel/PDF export libraries (`xlsx`, `jspdf`) via dynamic `import()` on click.
2. **N+1 PostgREST Query Loops:**  
   - In `AttendanceLogPage.tsx:611-625`, attendance history and expense claims execute two full-table scans with `pageSize: 1000` on date range change.
   - *Remediation:* Add compound index `(employee_id, work_date)` and `(employee_id, created_at)`.

---

### G. Date, Time & Timezone Integrity
1. **Local vs UTC Date String Conversions:**  
   - `localDateTimeToUtcIso` in `src/shared/utils/date.ts` correctly handles ISO 8601 UTC offsets for task sessions.
   - However, `AttendanceService` uses `todayISO()` which evaluates the browser's local midnight. For remote employees operating across timezones (+/- 5.5 hours UTC offset), `todayISO()` can diverge from PostgreSQL server `CURRENT_DATE`, causing `findActiveRecord` lookups to misalign.
   - *Remediation:* Anchor attendance date strictly to the employee's assigned operating timezone.

---

### H. Automated Testing & Quality Assurance Coverage (`ISSUE-008` / `RWK-010`)
1. **Repository Test Runner Absence:**  
   - *Evidence:* `package.json` contains scripts for `build`, `dev`, `lint`, and `typecheck`, but **zero testing framework** (`vitest`, `jest`, `@testing-library`).
   - *Impact:* Complex calculations (fractional probation clamping, pro-rata leave formulas, task timer aggregations) lack automated regression safety.
   - *Remediation:* Install `vitest` and author unit test suites in `RWK-010`.

---

## 3. Summary of Confirmed Technical Defects vs. Risks

| Finding | Classification | Severity | Affected Module | Target Resolution |
|---|:---:|:---:|---|:---:|
| **ISSUE-001** | Confirmed Defect | High | My Day / Tasks | `RWK-002` (Remove split rendering) |
| **ISSUE-002** | Confirmed Risk | High | Runtime / Error Boundary | `RWK-001` (Localize error boundaries) |
| **ISSUE-003** | Confirmed Defect | Medium | Attendance / My Day | Remove duplicate toast in `MyDayPage.tsx:498` |
| **ISSUE-004** | Confirmed Defect | High | Attendance Repository | Reverse sync order in `SupabaseAttendanceRepository:182` |
| **ISSUE-005** | Confirmed Defect | High | Training Calendar | `RWK-008` (Option B: canonical `flwdsk_schedule_sessions`) |
| **ISSUE-006** | Confirmed Defect | High | Projects / Schedulers | `RWK-006` (Canonical `flwdsk_resource_allocations`) |
| **ISSUE-007** | Confirmed Vulnerability | Medium | Application-Wide | `RWK-009` (Audit and inject `.is('deleted_at', null)`) |
| **ISSUE-008** | Confirmed Gap | Medium | DevOps / QA | `RWK-010` (Install Vitest & author unit test suites) |
| **ISSUE-009** | Confirmed Defect | High | Approvals Queue | Transition task to `rejected` instead of calling `deleteTask` |
| **ISSUE-010** | Confirmed Defect | High | Employee / Schema | Author migration adding probation columns to `flwdsk_employees` |

