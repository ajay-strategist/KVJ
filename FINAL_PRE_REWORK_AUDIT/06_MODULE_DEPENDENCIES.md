# Document 06: Module Dependencies & Interaction Matrix

**Project:** `flow-desk-main`  
**Audit Date:** 31 October 2026  
**Auditor:** Antigravity (Strictly Read-Only Mode)  

---

## 1. Executive Summary

This document maps all inter-module dependencies, cross-cutting data flows, and sequencing constraints across FlowDesk. It defines the strict order of implementation required for tomorrow's rework so that downstream modules do not break due to upstream interface modifications.

---

## 2. Core Architectural Data Flow Chains

```
                                 [ Authentication & Session ]
                                               │
                                               ▼
                                     [ Employee Directory ]
                                   (Probation, Role, Profile)
                                               │
                      ┌────────────────────────┼────────────────────────┐
                      ▼                        ▼                        ▼
             [ Time Clock Core ]      [ Leave Management ]      [ Training Batches ]
             (Clock-In, Breaks)       (Accrual from End Date)   (Trainer Assignment)
                      │                        │                        │
                      ▼                        │                        ▼
            [ Tasks & Task Timer ]             │               [ Trainer Calendar ]
          (Auto-Pause on Break/Out)            │               (Session Schedules)
                      │                        │                        │
                      ▼                        ▼                        ▼
                 [ Projects ]         [ Approvals Queue ]     [ Batch Expenses ]
             (Resource Allocations)   (Leaves, Corrections,    (Student Count
                      │                Task Reviews)            Expense Rollup)
                      ▼                        │                        │
                [ Timesheets ]                 ▼                        ▼
           (Aggregated Worklogs)       [ Role Dashboard ]      [ Expense Analytics ]
```

---

## 3. Detailed Cross-Module Dependency Matrix

| Upstream (Provider) Module | Downstream (Consumer) Module | Data / Interface Dependency | Critical Failure Risk |
|---|---|---|---|
| **Employee Directory** | **Leave Management** | Probation End Date & Joining Date determine `Leave Accrual Start Date`. | Pro-rata leave quota cannot calculate without valid accrual start date. |
| **Employee Directory** | **Permission Engine** | `flwdsk_employees.role` feeds the RBAC principal. | Role escalation or permission lockout if role is unpopulated. |
| **Employee Directory** | **Training Batches** | Employee ID & designations feed Trainer Assignment dropdowns. | Inability to assign trainers to training batches. |
| **Attendance Time Clock** | **Task Worklogs / Timer** | Time clock status (`present`, `on_break`, `clocked_out`). | Starting task timer while off-shift or failing to auto-pause on break. |
| **Task Worklogs** | **Timesheets** | `flwdsk_task_work_sessions` (accumulated work seconds). | Timesheet hours diverging from real task timer logs. |
| **Projects** | **Tasks** | `projectId`, `projectCode`, supervisor ID. | Tasks orphaned with default `OFFICE_TASK` code. |
| **Projects** | **Resource Scheduler** | `flwdsk_resource_allocations` (member IDs, capacity %). | Team member assignments diverging between Project Edit and Scheduler. |
| **Leave Management** | **Approvals Queue** | `flwdsk_leave_records` (`status = 'pending'`). | Stalled leave approval workflow if queue filters by obsolete role. |
| **Attendance Corrections** | **Approvals Queue** | `flwdsk_attendance_corrections` (`status = 'pending'`). | Backfilled attendance hours not updating master attendance records. |
| **Training Batches** | **Training Calendar** | `batchId`, `collegeId`, `topic`, `trainerId`. | Scheduled batch sessions missing from Trainer Calendar view. |
| **Training Batches** | **Expense Claims / Analytics** | `batchId`, enrolled student count (`flwdsk_enrollments`). | Inability to allocate travel and trainer expenses against batches. |
| **Expense Claims** | **Approvals Queue** | Claims requiring two-tier approval (`ReportingManager → CEO`). | Reimbursement approvals bypassed. |

---

## 4. Rework Implementation Sequencing Constraints

Based on the dependency topology above, and incorporating the **four approved stakeholder decisions (`EMP-Q01`, `PROJECT-Q1`, `CAL-Q01`, `TRAIN-Q02`)**, rework activities proceed in five unblocked sequential tiers:

### Tier 1: Foundation & Runtime Resilience (Day 1 Morning)
* **Modules:** Global Error Boundary, App Providers, Auth Service, Static Error Pages (`RWK-001`, `ISSUE-002`).
* **Why First:** Stabilizing the cold-hydration lifecycle and introducing scoped error boundaries eliminates the full-screen "500" crash, providing a resilient foundation for all other modules.

### Tier 2: Core Identity & Employee Probation Normalization (Day 1 Afternoon)
* **Modules:** Employee Directory (`BR-EMP-001`, `BR-EMP-002`, `BR-EMP-003`, `EMP-Q01`, `RWK-003`).
* **Approved Baseline:** Authoritative End Date persistence with dynamic duration recalculation; display rounding does not mutate End Date.
* **Why Second:** Fractional probation calculation and automated completion establish the authoritative `Leave Accrual Start Date`, which unblocks Tier 3 Leave Management.

### Tier 3: Attendance, Time Clock & Leave Remediations (Day 2 Morning)
* **Modules:** Attendance Time Clock (`ISSUE-003`, `ISSUE-004`, `RWK-005`), Leave Management (`BR-LEAVE-011`, `BR-LEAVE-013`, `RWK-004`).
* **Why Third:** Time clock events directly drive task timer auto-pausing, and leave accrual depends on Tier 2 employee accrual dates.

### Tier 4: Task Timer, Projects & Resource Allocations (Day 2 Afternoon)
* **Modules:** Task Duration Reconciliation (`ISSUE-001`, `RWK-002`), Project Team Storage Normalization (`PROJECT-Q1`, `ISSUE-006`, `RWK-006`), Timesheets.
* **Approved Baseline:** `flwdsk_resource_allocations` is canonical; member assignments scoped to projects.
* **Why Fourth:** Requires stable attendance status and clean project resource allocation definitions.

### Tier 5: Training Batches, Calendar & Approvals Queue (Day 3)
* **Modules:** Training Calendar Session Unification (`CAL-Q01`, `ISSUE-005`, `RWK-008`), Batch Progression Authority (`TRAIN-Q02`, `RWK-007`), Approvals Queue hardening.
* **Approved Baseline:** Option B approved (`flwdsk_schedule_sessions` canonical); Managers, Admins, and Assigned Trainers authorized for batch status transitions.
* **Why Fifth:** Downstream consumer of tasks, leaves, attendance corrections, and trainer assignments.

