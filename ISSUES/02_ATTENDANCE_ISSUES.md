# Category 02: Attendance & Time Clock Issues

This register contains operational defects, time clock anomalies, and workflow state transition issues identified in the Attendance module of FlowDesk.

---

## Active Issues in Category

| Issue ID | Title | Module | Priority | Investigation Status | Fix Status | Detailed Document |
|---|---|---|---|---|---|---|
| **ISSUE-003** | Duplicate "On Break" Popups | Attendance / Break Management | Medium | Open — Root Cause Not Investigated | Open — Not Fixed | [`ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md) |
| **ISSUE-004** | Employee Clock-Out Sometimes Does Not Complete | Attendance / Clock-In & Clock-Out | High | Open — Root Cause Not Investigated | Open — Not Fixed | [`ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md) |

---

## Important Inter-Issue Relationship Notice

> [!IMPORTANT]
> **Combined Testing Session Requirement:**  
> `ISSUE-003` (Duplicate "On Break" Popups) and `ISSUE-004` (Employee Clock-Out Sometimes Does Not Complete) both pertain to active Attendance and Time Clock user interactions.  
> **Stakeholder Directive:** They must be investigated together in one future Attendance testing session.  
> **Separation of Technical Documentation:** Their root causes, failure modes, specifications, and eventual fixes must be investigated and documented **completely separately**. It must not be assumed that they share the same underlying defect or root cause.

---

## Issue Summary: ISSUE-003

* **Issue ID:** `ISSUE-003`
* **Title:** Duplicate "On Break" Popups
* **Module:** Attendance / Break Management
* **Priority:** Medium
* **Status:** Open — Root Cause Not Investigated (Fix Status: Open — Not Fixed)
* **Observed Problem:** Initiating a break causes two "On Break" popups or notifications to display.
* **Expected Behavior:** Exactly one "On Break" popup should appear.
* **Investigation Status:** Uninvestigated. Root cause has not yet been determined.
* **Detailed Document:** Refer to [`ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-003_DUPLICATE_ON_BREAK_POPUPS.md).

---

## Issue Summary: ISSUE-004

* **Issue ID:** `ISSUE-004`
* **Title:** Employee Clock-Out Sometimes Does Not Complete
* **Module:** Attendance / Clock-In & Clock-Out
* **Priority:** High
* **Status:** Open — Root Cause Not Investigated (Fix Status: Open — Not Fixed)
* **Observed Problem:** An employee attempts to clock out, but the action does not complete, leaving the employee in an active "Clocked In" state.
* **Expected Behavior:** A valid clock-out action must reliably complete, transition the record status to `clocked_out`, write the timestamp to PostgreSQL, and update the UI accordingly.
* **Investigation Status:** Uninvestigated. Root cause has not yet been determined.
* **Detailed Document:** Refer to [`ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-004_CLOCK_OUT_NOT_COMPLETING.md).

