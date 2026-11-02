# Category 01: UI / UX Issues

This register contains user interface, visual layout, and frontend state presentation defects identified in FlowDesk.

---

## Active Issues in Category

| Issue ID | Title | Module | Priority | Investigation Status | Fix Status | Detailed Document |
|---|---|---|---|---|---|---|
| **ISSUE-001** | My Day Task Duration Changes After Page Refresh | My Day / Task Timer | High | Root Cause Identified | Open — Not Fixed | [`ISSUE-001_TASK_DURATION_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-001_TASK_DURATION_REFRESH.md) |

---

## Issue Summary: ISSUE-001

* **Issue ID:** `ISSUE-001`
* **Title:** My Day Task Duration Changes After Page Refresh
* **Module:** My Day / Task Timer
* **Priority:** High
* **Status:** Open — Not Fixed
* **Observed Problem:** Task duration renders as `0h 0m (Total: 7h 39m)` before page refresh, but displays `7h 39m` after refresh.
* **Expected Behavior:** Consistently display the total cumulative duration (`7h 39m`) before and after refresh.
* **Root Cause:** Conflation between lifetime hours (`actual_hours`) and daily elapsed seconds (`secondsToday`) in [`src/app/pages/workspaces/MyDayPage.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L2599), asymmetric `localStorage` date stamping, and dual-render split logic in `TaskWidget` (`totalHrsNum > secondsToday / 3600`).
* **Database Verification:** Verified that Supabase table `flwdsk_tasks` contains accurate data (`actual_hours = 7.65`). No database defect exists.
* **Detailed Report:** Refer to [`ISSUE-001_TASK_DURATION_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-001_TASK_DURATION_REFRESH.md).

