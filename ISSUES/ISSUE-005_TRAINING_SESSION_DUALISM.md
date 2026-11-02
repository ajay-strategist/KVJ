# FlowDesk Technical Issue Specification: ISSUE-005

**Issue Identifier:** ISSUE-005  
**Issue Title:** Architectural Dualism in Training Session Tables (`flwdsk_calendar_sessions` vs `flwdsk_schedule_sessions`)  
**Module / Area:** Training Batches / Training Calendar / My Day  
**Category:** Data & Architecture  
**Priority:** High  
**Investigation Status:** Root Cause Identified (Linked to Decision `CAL-Q01`)  
**Fix Status:** Approved — Not Yet Implemented  
**Date Documented:** 2026-10-31  

---

## 1. Executive Summary

FlowDesk currently maintains two separate database tables for training sessions:
1. `flwdsk_calendar_sessions`: Visual calendar events, scheduling, and planning.
2. `flwdsk_schedule_sessions`: Session attendance execution and trainer logs.

Because the two tables do not synchronize, classes scheduled via the Training Calendar (`TrainingCalendar.tsx`) are saved exclusively in `flwdsk_calendar_sessions`. When the assigned trainer opens `MyDayPage.tsx`, the application queries `flwdsk_schedule_sessions`, returning zero sessions for the day. Furthermore, taking attendance in `AttendanceLogPage.tsx` relies on `flwdsk_schedule_sessions`, requiring duplicate entry of scheduled classes.

---

## 2. Root Cause & Technical Details

* **Origin:** Commit `e865cd2e9dea52b78b05b0f4287c021ec00ca348` (5 August 2026), titled *"fix: Training Calendar now saves to correct DB table (flwdsk_calendar_sessions, no RLS)"*. An auxiliary table with RLS disabled was created to bypass schema and RLS constraints on `flwdsk_schedule_sessions`.
* **Affected Files:**
  - [`src/pages/training/TrainingCalendar.tsx#L111`](file:///Users/apple/Downloads/flow-desk-main/src/pages/training/TrainingCalendar.tsx#L111): Reads and writes `flwdsk_calendar_sessions`.
  - [`src/pages/MyDayPage.tsx#L185-L223`](file:///Users/apple/Downloads/flow-desk-main/src/pages/MyDayPage.tsx#L185-L223): Queries `flwdsk_schedule_sessions`.
  - [`src/pages/training/AttendanceLogPage.tsx#L144`](file:///Users/apple/Downloads/flow-desk-main/src/pages/training/AttendanceLogPage.tsx#L144): Queries `schedule_sessions`.
  - [`src/services/training/repositories/supabase-training.repository.ts#L94`](file:///Users/apple/Downloads/flow-desk-main/src/services/training/repositories/supabase-training.repository.ts#L94): `SupabaseSessionAttendanceRepository` uses `flwdsk_schedule_sessions`.
  - [`src/services/training.service.ts#L2528-L2570`](file:///Users/apple/Downloads/flow-desk-main/src/services/training.service.ts#L2528-L2570): In-memory manual merge of both tables.

---

## 3. Approved Resolution (Decision CAL-Q01)

- **Approved Architectural Direction:** Option B — Consolidate into canonical `flwdsk_schedule_sessions`.
- **Requirements:**
  1. Add planning columns (`session_title`, `start_time`, `end_time`, `venue`, `mode`, `color`) to `flwdsk_schedule_sessions` via validated migration.
  2. Preserve existing calendar and attendance records via backfill.
  3. Update `TrainingCalendar.tsx`, `MyDayPage.tsx`, and `AttendanceLogPage.tsx` to read/write the canonical table.
  4. Preserve existing RLS policies and security boundaries.
  5. Validate migration and regression tests before deprecating `flwdsk_calendar_sessions`.

