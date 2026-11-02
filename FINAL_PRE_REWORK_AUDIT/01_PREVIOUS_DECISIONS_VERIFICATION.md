# Document 01: Verification of Previous Decisions & Project Documentation

**Project:** `flow-desk-main`  
**Audit Date:** 31 October 2026  
**Auditor:** Antigravity (Strictly Read-Only Mode)  
**Reference Document:** [`BUSINESS_RULES_AND_CLARIFICATIONS.md`](file:///Users/apple/Downloads/flow-desk-main/BUSINESS_RULES_AND_CLARIFICATIONS.md)  

---

## 1. Executive Summary

This document verifies all previously finalized business rules, architectural agreements, and scope boundaries in the FlowDesk project. It establishes an authoritative classification of all functional areas into eight strict status tiers to ensure that finalized logic is preserved without redesign during tomorrow's rework.

---

## 2. Decision Status Classification Framework

Every functional requirement, business rule, and architectural decision is classified into one of the following eight categories:

1. **Finalized & Approved:** Explicit stakeholder decisions locked in documentation.
2. **Implemented & Verified:** Approved logic authored in source code and verified operational.
3. **Documented but Not Implemented:** Approved business rules recorded in documentation that await code implementation.
4. **Partially Completed:** Implementation is partially in place but requires reconciliation with updated rules.
5. **Pending Investigation:** Technical or runtime anomalies whose root causes are unverified.
6. **Pending Decision / Clarification:** Business policy or database schema questions awaiting stakeholder direction.
7. **Deferred to Future Phase:** Functionality acknowledged as valid for a separate product initiative (e.g. Student Training).
8. **Permanently Excluded:** Modules completely removed from FlowDesk's product scope.

---

## 3. Comprehensive Verification by Domain

### A. Employee Directory & Status Lifecycle
* **Probation Duration (Fractional Months) (`BR-EMP-002`, `EMP-Q01`):**
  - *Rule Statement:* Probation duration may be fractional (e.g. `2.5` or `2.9` months) and is calculated using the calendar-month method plus the day-proportion of the remaining fractional month. Rounding fractional days to the nearest whole day uses round-half-up. Duration and End Date must stay bidirectionally synchronized.
  - *Persistence Decision (`EMP-Q01`):* Probation End Date is the authoritative stored value. Probation Duration is calculated dynamically from the End Date. Displayed decimal duration may be rounded without mutating the End Date. Editing/saving preserves the original End Date unless explicitly edited.
  - *Status:* **Approved — Not Yet Implemented (31 Oct 2026).** UI and validation logic in `EmployeeModal.tsx` and `useEmployee.ts` currently assume whole integer months or lack fractional recalculation.
* **Automated Probation Completion (`BR-EMP-003`):**
  - *Rule Statement:* Probation completes automatically on the scheduled Probation End Date without manual managerial sign-off, even if the employee is in Suspended status (lifecycle status remains Suspended).
  - *Status:* **Documented but Not Implemented.** Current application lacks an automated cron or database trigger evaluating scheduled completion; status transitions currently rely on manual action.
* **Employee Status Transitions (`BR-EMP-001`):**
  - *Rule Statement:* Supported statuses: `Active`, `Probation`, `Notice Period`, `Suspended`, `Terminated`. Suspended employees cannot clock in, log tasks, or request leaves.
  - *Status:* **Implemented & Verified.** Enforced in `useAttendance.ts` and `EmployeeDirectory.tsx`.

### B. Leave Management & Accrual
* **New Joiner Leave Baseline (`BR-LEAVE-011`):**
  - *Rule Statement:* Base entitlement is 1 day per month (12 days per full Financial Year ending March 31). Zero leave accrues during probation.
  - *Status:* **Finalized & Approved (Documented but Not Implemented).**
* **Leave Accrual Start Date (`BR-LEAVE-011`):**
  - *Rule Statement:* Leave accrual commences on the calendar day immediately following the final day of probation (the Leave Accrual Start Date). For zero-probation employees, accrual begins on their Joining Date.
  - *Status:* **Finalized & Approved (Documented but Not Implemented).**
* **Partial-Month Accrual Formula (`BR-LEAVE-013`):**
  - *Rule Statement:* Eligible calendar days divided by total days in the initial month, multiplied by 1 day, rounded to the nearest 0.5-day increment with a minimum positive allocation of 0.5 day (0.25 &rarr; 0.5, 0.50 &rarr; 0.5, 0.75 &rarr; 1.0).
  - *Status:* **Finalized & Approved (Documented but Not Implemented).**
* **Two-Tier Leave Approvals (`BR-LEAVE-001`):**
  - *Rule Statement:* Leave requests require sequential approval from Reporting Manager &rarr; CEO. Self-escalation bypasses an approver when the requester holds that role.
  - *Status:* **Partially Completed.** Frontend supports approval routing, but backend RLS policies on `flwdsk_leave_records` lack enforcement.

### C. Attendance & Time Clock
* **Working Hours & Breaks (`BR-ATT-001` to `BR-ATT-010`):**
  - *Rule Statement:* Normal workday is 9 hours with 1 hour break. Auto-pausing of active task timer occurs when taking a break.
  - *Status:* **Implemented & Verified.**
* **Duplicate Break Popups (`ISSUE-003`):**
  - *Rule Statement:* Initiating a break must display exactly one popup notification.
  - *Status:* **Pending Investigation.**
* **Clock-Out Completion Anomaly (`ISSUE-004`):**
  - *Rule Statement:* Clock-out must reliably update attendance status and persist timestamp.
  - *Status:* **Pending Investigation.**

### D. Tasks & Task Worklogs
* **Single Active Task Rule (`BR-TASK-001`):**
  - *Rule Statement:* An employee may have only one active running task timer at any given moment.
  - *Status:* **Implemented & Verified.**
* **Task Duration Display Consistency (`ISSUE-001`):**
  - *Rule Statement:* Task duration on My Day must consistently render total duration (e.g. `7h 39m`) before and after page refresh.
  - *Status:* **Root Cause Identified (Awaiting Implementation).**

### E. Projects & Project Assignments
* **Project Team Storage Normalization (`PROJECT-Q1`):**
  - *Decision:* `flwdsk_resource_allocations` is the single canonical source of truth for Project Membership. Existing Employees must be assigned to Projects. Scoped permissions granted to project members. `flwdsk_projects.member_ids` deprecated only after dependency review, data validation, and migration planning. Do not redesign security architecture.
  - *Status:* **Approved — Not Yet Implemented (31 Oct 2026).**

### F. Training Batches & Trainer Calendar
* **Employee Training Batches (`BR-TRAIN-001` to `BR-TRAIN-008`):**
  - *Scope:* Batch scheduling, trainer assignment, batch attendance, expense allocation.
  - *Status:* **Implemented & Verified.**
* **Batch Lifecycle Progression Authority (`TRAIN-Q02`):**
  - *Decision:* Managers, Admins, and Assigned Trainers are authorized to transition batches through `Scheduled → In Progress → Completed → Closed`.
  - *Status:* **Approved — Not Yet Implemented (31 Oct 2026).**
* **Session Table Dualism (`CAL-Q01`):**
  - *Decision:* Option B approved. `flwdsk_schedule_sessions` becomes the single canonical table for planning, scheduling, and attendance. Planning fields added via validated migration. Preserve existing calendar & attendance records. Trainer My Day, Training Calendar, and Attendance Log use the same canonical table. Preserve security & RLS. Deprecate `flwdsk_calendar_sessions` only after validation.
  - *Status:* **Approved — Not Yet Implemented (31 Oct 2026).**

### G. Runtime Infrastructure & Authentication
* **HTTP 500 During Refresh (`ISSUE-002`):**
  - *Issue:* Monolithic React `<ErrorBoundary>` crash on cold hydration vs. unconfigured Supabase Auth Edge Function.
  - *Status:* **Documented; Root Cause Not Conclusively Confirmed.**
* **Production Auth Mode (`STARTUP-Q1`):**
  - *Issue:* Verifying whether `VITE_AUTH_MODE` is `legacy` or `jwt` in production Vercel environment.
  - *Status:* **Pending Production Verification.**
* **Database Migration Parity (`STARTUP-Q2`):**
  - *Issue:* Verifying whether migrations `20260808180000` and `20260808190000` have been executed in live Supabase.
  - *Status:* **Confirmed Missing in Live DB (Live curl tests returned 404/PGRST205).**

---

## 4. Master Scope Boundary Classification

| Module / Capability | Approved Product Scope | Current Code Status | Rework Action |
|---|---|---|---|
| **Employee Directory & Status** | Core FlowDesk Internal | Active in codebase | Retain & harden probation logic |
| **Attendance & Time Clock** | Core FlowDesk Internal | Active in codebase | Resolve ISSUE-003 & ISSUE-004 |
| **Leave Management** | Core FlowDesk Internal | Active in codebase | Implement fractional pro-rata accrual |
| **Tasks & Worklogs** | Core FlowDesk Internal | Active in codebase | Resolve ISSUE-001 duration split |
| **Projects & Resource Scheduler** | Core FlowDesk Internal | Active in codebase | Normalize team member storage |
| **Timesheets** | Core FlowDesk Internal | Active in codebase | Retain & verify sync with worklogs |
| **Client Directory** | Core FlowDesk Internal | Active in codebase | Retain (lightweight CRM) |
| **Expenses & Travel Claims** | Core FlowDesk Internal | Active in codebase | Retain & verify approval hierarchy |
| **Finance & Expense Analytics** | Core FlowDesk Internal | Active in codebase | Retain batch expense rollups |
| **Training Batches & Attendance** | Core FlowDesk Internal | Active in codebase | Retain; resolve TRAIN-Q02 authority |
| **Calendar & Scheduling** | Core FlowDesk Internal | Active in codebase | Unify session tables (CAL-Q01) |
| **Approvals Queue** | Core FlowDesk Internal | Active in codebase | Enforce sequential approval rules |
| **Budget Management** | **Permanently Excluded** | Completely removed | Drop DB tables via migration |
| **Procurement / Purchase Orders** | **Permanently Excluded** | Completely removed | Drop DB tables via migration |
| **Asset Management** | **Permanently Excluded** | Completely removed | Drop DB tables via migration |
| **Payroll Processing** | **Permanently Excluded** | Completely removed | Drop DB tables via migration |
| **Student Lifecycle & Grades** | **Future Product Initiative** | Preserved (gated) | Retain inert; do not expand |
| **Public Exam Portal (`/submit-exam`)** | **Future Product Initiative** | Preserved (gated) | Retain inert; do not expand |

