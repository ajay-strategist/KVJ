# FlowDesk Technical Issue Specification: ISSUE-003

**Issue Identifier:** ISSUE-003  
**Issue Title:** Duplicate "On Break" Popups  
**Module / Area:** Attendance / Break Management  
**Category:** UI / Attendance  
**Priority:** Medium  
**Investigation Status:** Root Cause Identified (31 Oct 2026 Audit)  
**Fix Status:** Open — Not Fixed  
**Investigation Mode:** Code Inspection & Call Trace  
**Date Documented:** 2026-10-31  

---

## 1. Executive Summary

A reported defect causes two separate "On Break" toast notifications to appear when an employee initiates an official break session.

During the 31 October 2026 pre-rework completeness audit, the **exact root cause was conclusively identified** in `src/app/pages/workspaces/MyDayPage.tsx`.

---

## 2. Conclusive Root Cause & Code Trace

The duplicate toast is caused by an asymmetric dual-invocation of `toast({ variant: 'info', title: 'On Break', ... })` across two nested handlers:

1. **Outer Handler (`AttendancePanel.handleBreakClick`):**
   In [`src/app/pages/workspaces/MyDayPage.tsx#L495-L500`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L495-L500):
   ```typescript
   if (onStartBreakWithTask) {
     const success = await onStartBreakWithTask('Official Break', '');
     if (success) {
       toast({ variant: 'info', title: 'On Break', message: 'Enjoy your break.' }); // <--- TOAST 2
     }
   }
   ```
2. **Inner Handler (`handleStartBreakWithTask`):**
   In [`src/app/pages/workspaces/MyDayPage.tsx#L2809-L2816`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L2809-L2816):
   ```typescript
   toast({
     variant: 'info',
     title: 'On Break',
     message: runningTask
       ? `Break started. Active task "${runningTask.title}" paused and progress update recorded.`
       : 'Enjoy your break.'
   }); // <--- TOAST 1
   return true;
   ```

Because `handleStartBreakWithTask` fires `toast(...)` and returns `true`, `handleBreakClick` in `AttendancePanel` receives `success === true` and fires a redundant second `toast(...)`.

---

## 3. Recommended Remediation

Remove the redundant `toast({ variant: 'info', title: 'On Break', ... })` call in `AttendancePanel.handleBreakClick` (line 498), allowing `handleStartBreakWithTask` to act as the single authoritative notification dispatcher.
