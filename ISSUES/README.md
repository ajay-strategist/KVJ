# FlowDesk Issues & Defect Tracking Architecture

This directory (`flow-desk-main/ISSUES/`) constitutes the official issues repository and defect tracking hub for the FlowDesk enterprise operations platform.

---

## 1. Master Issue Register

The authoritative master index is maintained in:
* [`ISSUES/ISSUES_REGISTER.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUES_REGISTER.md)

---

## 2. Active Issues Index

| Issue ID | Title | Module | Category | Priority | Investigation Status | Fix Status | Detailed Document |
|---|---|---|---|---|---|---|---|
| **ISSUE-001** | My Day Task Duration Changes After Page Refresh | My Day / Task Timer | UI / State Management | High | Root Cause Identified | Open — Not Fixed | [`ISSUE-001_TASK_DURATION_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-001_TASK_DURATION_REFRESH.md) |
| **ISSUE-002** | HTTP 500 Error During Page Refresh | Runtime / API | Runtime / API | High | Documented (Unconfirmed incident cause) | Open — Not Fixed | [`ISSUE-002_HTTP_500_DURING_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-002_HTTP_500_DURING_REFRESH.md) |
| **ISSUE-003** | Duplicate "On Break" Popups | Attendance / Break Management | UI / Attendance | Medium | Open — Root Cause Not Investigated | Open — Not Fixed | [`ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md) |
| **ISSUE-004** | Employee Clock-Out Sometimes Does Not Complete | Attendance / Clock-In & Clock-Out | Attendance / Workflow | High | Open — Root Cause Not Investigated | Open — Not Fixed | [`ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md) |

---

## 3. Category Issue Registers

For categorized reviews, issues are grouped across the following category files:

1. [`01_UI_UX_ISSUES.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/01_UI_UX_ISSUES.md) — UI rendering, display formatting, and state presentation issues (contains `ISSUE-001`).
2. [`02_ATTENDANCE_ISSUES.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/02_ATTENDANCE_ISSUES.md) — Attendance, break management, time clock, and session lifecycle issues (contains `ISSUE-003`, `ISSUE-004`).
3. [`03_BUSINESS_LOGIC_ISSUES.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/03_BUSINESS_LOGIC_ISSUES.md) — Business rule divergence and state machine defects.
4. [`04_DATA_DATABASE_ISSUES.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/04_DATA_DATABASE_ISSUES.md) — Supabase schema, migration parity, and PostgREST data persistence issues.
5. [`05_PERFORMANCE_ISSUES.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/05_PERFORMANCE_ISSUES.md) — Query performance, re-render bottlenecks, and memory leaks.
6. [`06_RUNTIME_API_ISSUES.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/06_RUNTIME_API_ISSUES.md) — Server errors, routing, API client, and error boundary crashes (contains `ISSUE-002`).
7. [`07_CROSS_MODULE_ISSUES.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/07_CROSS_MODULE_ISSUES.md) — Multi-module interactions, integrations, and event propagation.

---

## 4. Governance & Verification Rules

1. **Unique Identifiers:** Every issue is assigned an immutable ID (`ISSUE-001`, `ISSUE-002`, etc.).
2. **Investigation Integrity:** An issue is marked as "Root Cause Identified" only when code-level and data-level traces verify the failure mechanism. Uninvestigated issues are explicitly labeled `Open — Root Cause Not Investigated`.
3. **Strict Separation of Attendance Issues:** Although `ISSUE-003` and `ISSUE-004` will be evaluated during the same future attendance testing session, their causes, specifications, and eventual fixes are tracked independently.
4. **Non-Destructive Fix Process:** No fixes may be applied without explicit stakeholder approval and prior technical specification.

