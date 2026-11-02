# FlowDesk Technical Investigation Report: ISSUE-001

**Issue Identifier:** ISSUE-001  
**Issue Title:** My Day Task Duration Changes After Page Refresh  
**Module / Area:** My Day / Task Timer  
**Category:** UI / State Management  
**Priority:** High  
**Investigation Status:** Root Cause Identified (Frontend state reconciliation and caching logic)  
**Fix Status:** Open — Not Fixed  
**Investigation Mode:** Strictly Read-Only (Zero Code or Database Changes)  
**Target Component:** `TaskWidget` within [`src/app/pages/workspaces/MyDayPage.tsx#L1324`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L1324)  
**Date Documented:** 2026-10-31  

---

## 1. Executive Summary

A defect on the My Day page (`/app`) causes the duration of a task to display inconsistently before versus after a browser page refresh:
* **Before page refresh:** `0h 0m (Total: 7h 39m)`
* **After page refresh:** `7h 39m`

The second display (`7h 39m`) represents the desired format.

Forensic code and data analysis confirms that this discrepancy originates **entirely from frontend state reconciliation and caching logic in [`src/app/pages/workspaces/MyDayPage.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx)**. The Supabase database value is completely accurate (`actual_hours = 7.65`) and returns identical data before and after refresh.

The root cause is a **semantic conflation between lifetime cumulative hours (`actual_hours`) and daily elapsed seconds (`secondsToday`)**, coupled with an asymmetric `localStorage` date-stamping effect:
1. `flwdsk_tasks.actual_hours` stores the **cumulative lifetime hours** worked on a task across all calendar days (7.65 hours = 7h 39m).
2. On initial page load after a calendar day rollover, the stale-day detector in `MyDayPage.tsx` identifies a previous day's timestamp in `localStorage`, resets `secondsToday` to `0`, but immediately writes today's date stamp into `localStorage`.
3. Because `secondsToday` is `0` while `totalHoursWorked` is `7.65`, `TaskWidget` evaluates `totalHrsNum > secondsToday / 3600` (`7.65 > 0`) as `true` and renders the split label: `⏱ 0h 0m (Total: 7h 39m)`.
4. On browser refresh, `localStorage` now contains today's date stamp, so the stale-day reset does not execute. Instead, the task mapping falls back to initializing `secondsToday` directly from lifetime `actual_hours * 3600` (27,540s = 7h 39m).
5. Now `secondsToday` (7h 39m) equals `totalHoursWorked` (7h 39m). The condition `totalHrsNum > secondsToday / 3600` (`7.65 > 7.65`) evaluates to `false`, the `(Total: ...)` suffix is omitted, and only `7h 39m` renders.

---

## 2. Reported Problem vs. Expected Behavior

| Dimension | Observed (Reported) Behavior | Expected Behavior |
|---|---|---|
| **Before Page Refresh** | Displays split timer string: `0h 0m (Total: 7h 39m)` | Displays single accumulated duration: `7h 39m` |
| **After Page Refresh** | Displays single accumulated duration: `7h 39m` | Displays single accumulated duration: `7h 39m` |
| **Consistency** | Inconsistent across page reloads | Fully consistent across navigation and refresh |

---

## 3. Data Flow Traces

### Initial Load Data Flow (Before Refresh)
1. User loads `/app` on a new calendar day.
2. `useProject()` fetches tasks from Supabase: `actual_hours = 7.65`.
3. `MyDayPage` initializes `storedStates` from `localStorage.getItem('flowdesk_task_timer_states')`.
4. Stale-day check triggers: `stored.date !== todayStr` is `true`.
5. `updatedStates[t.id].secondsToday = 0;` (reset to zero for new day).
6. `updatedStates[t.id].date = todayStr;` (date overwritten with today's date).
7. `localStorage.setItem('flowdesk_task_timer_states', ...)` persists today's date.
8. `TaskItem` mapped with:
   - `secondsToday = 0`
   - `totalHoursWorked = 7.65`
9. `TaskWidget` renders duration:
   - Evaluates `totalHrsNum > secondsToday / 3600` &rarr; `7.65 > 0` &rarr; **`true`**.
   - Renders: `0h 0m (Total: 7h 39m)`.

### Page Refresh Data Flow (After Refresh)
1. User refreshes the page (F5 / Cmd+R).
2. `useProject()` fetches tasks from Supabase: `actual_hours = 7.65` (identical).
3. `MyDayPage` initializes `storedStates` from `localStorage.getItem('flowdesk_task_timer_states')`.
4. Stale-day check: `stored.date !== todayStr` is now **`false`** (persisted from initial load).
5. `secondsToday` defaults to `Math.round((t.actualHours || 0) * 3600) = 27540` (7h 39m).
6. `TaskItem` mapped with:
   - `secondsToday = 27540` (7h 39m)
   - `totalHoursWorked = 7.65` (7h 39m)
7. `TaskWidget` renders duration:
   - Evaluates `totalHrsNum > secondsToday / 3600` &rarr; `7.65 > 7.65` &rarr; **`false`**.
   - Renders: `7h 39m`.

---

## 4. Key Source Code References

1. [`src/app/pages/workspaces/MyDayPage.tsx#L2599`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L2599):
   ```ts
   let secondsToday = Math.round((t.actualHours || 0) * 3600);
   ```
2. [`src/app/pages/workspaces/MyDayPage.tsx#L2614-L2658`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L2614-L2658):
   Stale-day detector and date reconciliation in `localStorage`.
3. [`src/app/pages/workspaces/MyDayPage.tsx#L1641-L1647`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L1641-L1647) and [`L1763-L1769`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L1763-L1769):
   Dual-display split condition in `TaskWidget`:
   ```tsx
   {totalHrsNum > secondsToday / 3600 && totalHrsFormatted && (
     <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
       (Total: {totalHrsFormatted})
     </span>
   )}
   ```

---

## 5. Database Status

* **Supabase database (`flwdsk_tasks.actual_hours`):** 100% accurate and stable.
* No database corruption, missing migrations, or query errors exist for this issue.

---

## 6. Recommended Future Correction (Analysis Only — Not Implemented)

In [`src/app/pages/workspaces/MyDayPage.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx) within `TaskWidget` (lines 1623–1650 and lines 1744–1771):
* Simplify the rendered duration to consistently display the task's authoritative total duration `totalHrsFormatted` (derived from `t.totalHoursWorked || t.actualHours`).
* Remove the `totalHrsNum > secondsToday / 3600` conditional branch to eliminate the split `0h 0m (Total: ...)` display entirely.

