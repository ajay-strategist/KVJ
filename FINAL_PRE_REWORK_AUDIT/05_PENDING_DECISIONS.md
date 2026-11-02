# Document 05: Register of Pending Decisions & Unanswered Questions

**Project:** `flow-desk-main`  
**Audit Date:** 31 October 2026  
**Auditor:** Antigravity (Strictly Read-Only Mode)  
**Reference Document:** [`BUSINESS_RULES_AND_CLARIFICATIONS.md`](file:///Users/apple/Downloads/flow-desk-main/BUSINESS_RULES_AND_CLARIFICATIONS.md)  

---

## 1. Executive Summary

This document audits all unresolved questions, pending business decisions, and technical environment clarifications across FlowDesk. To prevent decision paralysis and maintain clarity for tomorrow's rework, all pending items are categorized into:
1. **Critical Stakeholder Decisions (Genuinely Require User Input Before/During Rework)**
2. **Technical / Environment Verification Tasks (Engineering Verifications)**
3. **Future Product Planning Items (Non-Blocking for FlowDesk Rework)**

---

## 2. Formally Approved Decisions (Moved from Pending — Approved 31 Oct 2026)

On 31 October 2026, stakeholders formally reviewed and approved all four critical architectural and business policy decisions. **Zero (0) business policy questions remain pending.** All four decisions are transitioned to **Approved — Not Yet Implemented** and queued for implementation in tomorrow's rework plan.

### Decision 1: TRAIN-Q02 — Training Batch Lifecycle Authority
- **Question ID:** `TRAIN-Q02`
- **Module:** Training Batches (In-Scope Workflow)
- **Status:** **Approved — Not Yet Implemented** (Approved 31 Oct 2026)
- **Approved Decision Wording:**
  Authorized roles for changing Training Batch status:
  - **Managers**
  - **Admins**
  - **Assigned Trainers**
  All three roles may transition a batch through:
  `Scheduled → In Progress → Completed → Closed`
- **Affected Implementation Tasks:** `RWK-007` (Role-Gate Training Batch Transitions).
- **Dependencies:** `flwdsk_batches.status`, `BatchManagement.tsx`, `training.service.ts`.
- **Blocks Rework?** **NO.** Fully unblocked for Day 3 rework execution.

---

### Decision 2: EMP-Q01 — Probation Date Storage Convention
- **Question ID:** `EMP-Q01`
- **Module:** Employee Directory & Probation
- **Status:** **Approved — Not Yet Implemented** (Approved 31 Oct 2026)
- **Approved Decision Wording:**
  - **Probation End Date is the authoritative stored value.**
  - **Probation Duration must be calculated dynamically from the End Date.**
  - **Displayed decimal duration may be rounded** (e.g. to one decimal place).
  - **Display rounding must never modify the authoritative End Date.**
  - **Editing and saving an employee record must preserve the original End Date unless an authorized user explicitly changes it.**
- **Affected Implementation Tasks:** `RWK-003` (Implement Fractional Probation Calculation & Automated Completion).
- **Dependencies:** `flwdsk_employees` table columns, `EmployeeModal.tsx`, `useEmployee.ts`.
- **Blocks Rework?** **NO.** Fully unblocked for Day 1 rework execution.

---

### Decision 3: PROJECT-Q1 — Canonical Project Membership Storage
- **Question ID:** `PROJECT-Q1`
- **Module:** Projects & Resource Scheduler
- **Status:** **Approved — Not Yet Implemented** (Approved 31 Oct 2026)
- **Approved Decision Wording:**
  - **Existing Employees must be assigned to Projects.**
  - **`flwdsk_resource_allocations` is the single canonical source for Project Membership.**
  - **Project Members receive the approved permissions to create tasks, view relevant tasks, and access relevant project reports.**
  - **Project membership must remain scoped to the assigned Project.**
  - **`flwdsk_projects.member_ids` may be deprecated only after dependency review, data validation, and migration planning.**
  - **Do not independently redesign the existing security or permission architecture.**
- **Affected Implementation Tasks:** `RWK-006` (Normalize Project Team Storage, `ISSUE-006`).
- **Dependencies:** `flwdsk_projects`, `flwdsk_resource_allocations`, `ProjectModal.tsx`, `ResourceScheduler.tsx`.
- **Blocks Rework?** **NO.** Fully unblocked for Day 2 rework execution.

---

### Decision 4: CAL-Q01 — Training Session Table Consolidation
- **Question ID:** `CAL-Q01`
- **Module:** Training Calendar / My Day / Attendance
- **Status:** **Approved — Not Yet Implemented** (Option B Approved 31 Oct 2026)
- **Approved Decision Wording:**
  Option B is approved:
  - **`flwdsk_schedule_sessions` becomes the single canonical table for Training Calendar planning, scheduling, and attendance.**
  - **Add the necessary planning fields (`session_title`, `start_time`, `end_time`, `venue`, `mode`, `color`) to the canonical table through an appropriately validated migration.**
  - **Preserve existing Calendar session records and Attendance records** via data backfill.
  - **Trainer My Day, Training Calendar, and Attendance Log must use the same canonical session records.**
  - **Preserve existing security policies and RLS.**
  - **Review all dependencies before changing existing workflows.**
  - **Validate migration and regression tests before deprecating `flwdsk_calendar_sessions`.**
  - **Do not implement yet.**
- **Affected Implementation Tasks:** `RWK-008` (Unify Training Session Tables, `ISSUE-005`).
- **Dependencies:** `flwdsk_schedule_sessions`, `flwdsk_calendar_sessions`, `TrainingCalendar.tsx`, `MyDayPage.tsx`, `AttendanceLogPage.tsx`.
- **Blocks Rework?** **NO.** Fully unblocked for Day 3 rework execution.

---

## 3. Technical & Environment Verification Tasks (Non-Business Decisions)

These questions are technical verification tasks rather than business policy decisions. They do not require business debates, but rather environment checks:

### Task 1: STARTUP-Q1 — Production Vercel Auth Mode Configuration
- **Question ID:** `STARTUP-Q1`
- **Category:** Infrastructure / Environment Configuration
- **Question:** Is `VITE_AUTH_MODE` set to `jwt` or `legacy` in the Vercel production deployment environment variables?
- **Status:** **Resolved for Rework Baseline.** Live network probes confirmed that Supabase Edge Functions (`refresh-session`) and `flwdsk_auth_refresh_tokens` are not deployed in production. Therefore, `VITE_AUTH_MODE` must remain `legacy`.

### Task 2: STARTUP-Q2 — Migration Parity in Production Database
- **Question ID:** `STARTUP-Q2`
- **Category:** Database Migration Parity
- **Question:** Have migrations `20260808180000` and `20260808190000` been executed in production Supabase?
- **Status:** **Verified Missing.** Live curl tests returned `PGRST205` for `flwdsk_auth_refresh_tokens`. Migration parity must be scheduled before any attempt to enable JWT auth mode.

---

## 4. Future Product Planning Items (Non-Blocking)

These items concern the separately planned **Student Training Management** product and do **NOT** block FlowDesk rework:

* **TRAIN-Q01: Student Attendance Compatibility Cache Recalculation Threshold:**
  - Pertains to commercial student attendance compliance formulas. Non-blocking for employee batch operations.
* **EXAM-Q01: Public Student Exam Portal Rate Limiting & Token Expiration:**
  - Pertains to `/submit-exam` public endpoint for college students. Non-blocking for employee operations.

---

## 5. Summary Matrix of Rework Blockers

| Question ID | Title | Domain | Stakeholder Input Needed? | Blocks 1 Nov Rework? | Final Status & Implementation Baseline |
|---|---|---|---|---|---|
| **TRAIN-Q02** | Batch Lifecycle Authority | Training | **Resolved (Approved)** | **No** | Approved: Managers, Admins, and Assigned Trainers authorized (`Scheduled → In Progress → Completed → Closed`). |
| **EMP-Q01** | Probation Reverse Persistence | Employee | **Resolved (Approved)** | **No** | Approved: Probation End Date is authoritative; Duration calculated dynamically; rounding does not alter End Date. |
| **PROJECT-Q1** | Project Team Storage | Projects | **Resolved (Approved)** | **No** | Approved: `flwdsk_resource_allocations` is canonical; `member_ids` deprecated after validation. |
| **CAL-Q01** | Training Sessions Unification | Calendar | **Resolved (Approved)** | **No** | Option B Approved: `flwdsk_schedule_sessions` is canonical; display fields added via migration. |
| **STARTUP-Q1** | Production Auth Mode | Infra | No (Technical) | **No** | Locked to `legacy` mode. |
| **STARTUP-Q2** | DB Migration Parity | DB | No (Technical) | **No** | Defer JWT tables until future infra phase. |
| **TRAIN-Q01** | Student Attendance Cache | Future | No (Future Phase) | **No** | Retain existing inert schema. |
| **EXAM-Q01** | Exam Portal Rate Limiting | Future | No (Future Phase) | **No** | Retain existing inert schema. |

