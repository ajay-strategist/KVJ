# FlowDesk Technical Issue Specification: ISSUE-004

**Issue Identifier:** ISSUE-004  
**Issue Title:** Employee Clock-Out Sometimes Does Not Complete  
**Module / Area:** Attendance / Clock-In & Clock-Out  
**Category:** Attendance / Workflow  
**Priority:** High  
**Investigation Status:** Root Cause Identified (31 Oct 2026 Audit)  
**Fix Status:** Open — Not Fixed  
**Investigation Mode:** Code Inspection & Repository Call Trace  
**Date Documented:** 2026-10-31  

---

## 1. Executive Summary

An employee attempts to clock out, but the action occasionally hangs or fails to persist, leaving the employee in an active "Clocked In" state.

During the 31 October 2026 pre-rework audit, **two compounding root causes were identified**:

---

## 2. Technical Evidence & Root Causes

### Root Cause 1: Foreign Key Violation during `syncWorkSessions` Deletion
* **Location:** [`src/modules/attendance/supabase-attendance.repository.ts#L14-L26`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/supabase-attendance.repository.ts#L14-L26) & [`L179-L190`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/supabase-attendance.repository.ts#L179-L190)
* **Code Trace:**
  ```typescript
  override async update(id: UUID, patch: Partial<AttendanceRecord>, actor: Actor): Promise<AttendanceRecord> {
    const { sessions, breaks, ...base } = patch;
    const updated = await super.update(id, base, actor);
    if (sessions && sessions.length > 0) {
      await this.syncWorkSessions(id, sessions); // <--- TRIES TO DELETE work_sessions
      updated.sessions = sessions;
    }
    if (breaks && breaks.length > 0) {
      await this.syncBreaks(id, breaks); // <--- RUNS AFTER syncWorkSessions
      updated.breaks = breaks;
    }
  }
  ```
* **Failure Mechanism:** In `syncWorkSessions`, line 14 executes:
  `await supabase.from('flwdsk_work_sessions').delete().eq('attendance_record_id', attendanceRecordId);`
  If breaks exist in `flwdsk_break_records` referencing those `work_sessions`, PostgreSQL rejects the deletion with a Foreign Key Constraint error (`23503`). The error is caught and swallowed silently (`console.warn`), leaving child sessions unclosed in PostgreSQL. On page reload, `findActiveRecord` re-detects an open child session (`hasRealOpenSession === true`) and reverts the UI to "Clocked In".

### Root Cause 2: Overnight / Midnight Boundary Desynchronization
* **Location:** [`src/modules/attendance/attendance.service.ts#L136-L140`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/attendance.service.ts#L136-L140)
* **Code Trace:**
  `const record = await this.repo.findActiveRecord(employeeId, todayStr());`
  If an employee clocks in before midnight and attempts to clock out the following morning, `todayStr()` evaluates to the *new* calendar date, whereas the active session is stored under yesterday's `work_date`. If child session synchronization was incomplete, the service returns `Err('No active session to clock out from.')`, permanently stranding the employee in an uncloseable state.

---

## 3. Recommended Remediation

1. In `SupabaseAttendanceRepository.update()`, reverse the synchronization order: execute `syncBreaks()` BEFORE `syncWorkSessions()`, or perform an in-place `UPDATE` on `flwdsk_work_sessions` instead of a destructive `DELETE + INSERT`.
2. In `AttendanceService.clockOut()`, allow `findActiveRecord` to resolve open sessions across past dates regardless of `todayStr()`.
