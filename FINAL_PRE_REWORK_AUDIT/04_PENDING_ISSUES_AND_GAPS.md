# Document 04: Pending Issues, Defect Register & Gaps Inventory

**Project:** `flow-desk-main`  
**Audit Date:** 31 October 2026  
**Auditor:** Antigravity (Strictly Read-Only Mode)  
**Reference Folder:** [`flow-desk-main/ISSUES/`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/)  

---

## 1. Executive Summary

This document consolidates all active technical issues, defects, and architectural gaps in FlowDesk. It audits the current status of existing issues `ISSUE-001` through `ISSUE-004` (referencing their detailed reports without duplication) and formally registers newly discovered technical issues starting with sequential ID `ISSUE-005`.

All issues remain strictly **Open — Not Fixed**.

---

## 2. Status of Previously Documented Issues (ISSUE-001 to ISSUE-004)

| Issue ID | Title | Module | Category | Priority | Investigation Status | Fix Status | Detailed Documentation Reference |
|---|---|---|---|---|---|---|---|
| **ISSUE-001** | My Day Task Duration Changes After Page Refresh | My Day / Task Timer | UI / State Management | High | Root Cause Identified | Open — Not Fixed | [`ISSUES/ISSUE-001_TASK_DURATION_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-001_TASK_DURATION_REFRESH.md) |
| **ISSUE-002** | HTTP 500 Error During Page Refresh | Runtime / API | Runtime / API | High | Investigation Documented (Incident Cause Unconfirmed) | Open — Not Fixed | [`ISSUES/ISSUE-002_HTTP_500_DURING_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-002_HTTP_500_DURING_REFRESH.md) |
| **ISSUE-003** | Duplicate "On Break" Popups | Attendance / Break Management | UI / Attendance | Medium | Open — Root Cause Not Investigated | Open — Not Fixed | [`ISSUES/ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md) |
| **ISSUE-004** | Employee Clock-Out Sometimes Does Not Complete | Attendance / Clock-In & Clock-Out | Attendance / Workflow | High | Open — Root Cause Not Investigated | Open — Not Fixed | [`ISSUES/ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md) |

### Cross-Issue Relationship Notice
`ISSUE-003` and `ISSUE-004` belong to the Attendance module and must be scheduled together in a single future Attendance testing session. However, their root causes and fixes must be investigated and documented separately; it must not be assumed that they share the same failure mechanism.

---

## 3. Newly Identified Technical Issues (ISSUE-005 to ISSUE-008)

During this pre-rework audit, four additional architectural and technical issues were identified and assigned sequential IDs:

### ISSUE-005: Architectural Dualism in Training Session Tables
- **Issue ID:** `ISSUE-005`
- **Title:** Dualism in Training Session Tables (`flwdsk_calendar_sessions` vs `flwdsk_schedule_sessions`)
- **Module:** Training / Calendar / My Day
- **Category:** Data & Architecture
- **Priority:** High
- **Investigation Status:** Architectural Conflict Identified (Linked to `CAL-Q01`)
- **Fix Status:** Open — Not Fixed
- **Observed Behavior:** Trainer schedule entries are written to `flwdsk_calendar_sessions`, but session attendance records and `MyDayPage` trainer matching queries target `flwdsk_schedule_sessions`. This results in desynchronized schedules where sessions appear on the Training Calendar but are missing from My Day assigned sessions.
- **Expected Behavior:** Single authoritative relational model for training batch sessions.

### ISSUE-006: Dualism in Project Team Member Storage
- **Issue ID:** `ISSUE-006`
- **Title:** Dualism in Project Team Storage (`flwdsk_resource_allocations` vs `flwdsk_projects.member_ids`)
- **Module:** Projects / Resource Scheduler
- **Category:** Data & Architecture
- **Priority:** High
- **Investigation Status:** Schema Dualism Identified (Linked to `PROJECT-Q1`)
- **Fix Status:** Open — Not Fixed
- **Observed Behavior:** The project edit modal stores team member assignments as a JSON string array in `flwdsk_projects.member_ids`, while the Resource Scheduler stores assignments normalized in `flwdsk_resource_allocations` (which includes capacity percentages and roles). The two stores diverge when members are updated from different screens.
- **Expected Behavior:** Single canonical source of truth for project member allocations.

### ISSUE-007: Missing Soft-Delete Filtering in Direct Supabase UI Queries
- **Issue ID:** `ISSUE-007`
- **Title:** Missing Soft-Delete (`deleted_at IS NULL`) Filter on Direct Supabase UI Queries
- **Module:** Application-Wide UI Views
- **Category:** Data Integrity / Query Safety
- **Priority:** Medium
- **Investigation Status:** Code Vulnerability Identified
- **Fix Status:** Open — Not Fixed
- **Observed Behavior:** Certain UI components that query Supabase directly (e.g., `AnnouncementsBoard.tsx`, `ExpenseClaims.tsx`, and inline attendance queries in `AttendanceLogPage.tsx`) omit `.is('deleted_at', null)`. Soft-deleted rows reappear in user listings, causing confusion and validation failures.
- **Expected Behavior:** All queries must explicitly filter out soft-deleted records (`deleted_at IS NULL`) or route through registered repository classes.

### ISSUE-008: Zero Automated Test Coverage
- **Issue ID:** `ISSUE-008`
- **Title:** Zero Automated Test Coverage (Absence of Unit and Integration Test Harness)
- **Module:** Testing & Quality Assurance
- **Category:** Code Quality / DevOps
- **Priority:** Medium
- **Investigation Status:** Repository Gap Confirmed
- **Fix Status:** Open — Not Fixed
- **Observed Behavior:** `package.json` contains no test runner (such as Vitest, Jest, or Playwright). The only validation scripts are `tsc --noEmit` and `eslint`. Regressions in complex calculations (e.g. fractional probation or pro-rata leave formulas) can only be caught via manual testing.
- **Expected Behavior:** Automated unit testing harness for core business calculation engines (leave pro-rata, probation formulas, attendance hours).

---

## 4. Comprehensive Issues Register Update

The master register [`ISSUES/ISSUES_REGISTER.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUES_REGISTER.md) and category files will be kept synchronized with these sequential issue IDs.

