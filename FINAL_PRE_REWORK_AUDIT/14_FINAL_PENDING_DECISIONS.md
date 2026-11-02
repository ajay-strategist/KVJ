# Document 14: Final Decision Register & Authority Reconciliation

**Project:** `flow-desk-main`  
**Audit Date:** 31 October 2026  
**Auditor:** Antigravity (Strictly Read-Only Mode)  
**Planned Rework Start:** 1 November 2026  

---

## 1. Executive Summary

This register serves as the authoritative, finalized record of all business policy decisions, schema normalization directives, and technical environment confirmations in FlowDesk. 

**Definitive Milestone:** Following stakeholder sign-off on 31 October 2026, **all four critical business questions (`TRAIN-Q02`, `EMP-Q01`, `PROJECT-Q1`, `CAL-Q01`) have been formally approved**. 

**Zero (0) business policy questions remain pending in active scope.**

---

## 2. Formally Approved Business & Architectural Decisions

### DECISION 1 — TRAIN-Q02: Training Batch Lifecycle Authority
* **Decision ID:** `TRAIN-Q02`
* **Module:** Training Batches
* **Status:** **`Approved — Not Yet Implemented`** (Approved 31 Oct 2026)
* **Approved Policy Wording:**
  Authorized roles for changing Training Batch status are:
  - **Managers**
  - **Admins**
  - **Assigned Trainers**
  All three roles may transition a batch through:
  $$\text{Scheduled} \longrightarrow \text{In Progress} \longrightarrow \text{Completed} \longrightarrow \text{Closed}$$
* **Implementation Mapping:** Task `RWK-007` (Role-Gate Training Batch Transitions). Maps to the `phase` column on `flwdsk_batches`.

---

### DECISION 2 — EMP-Q01: Probation Date Storage Convention
* **Decision ID:** `EMP-Q01`
* **Module:** Employee Directory & Probation
* **Status:** **`Approved — Not Yet Implemented`** (Approved 31 Oct 2026)
* **Approved Policy Wording:**
  - **Probation End Date is the authoritative stored value** in the database.
  - **Probation Duration must be calculated dynamically from the End Date** (using Joining Date).
  - **Displayed decimal duration may be rounded** (e.g. to one decimal place in the UI).
  - **Display rounding must never modify the authoritative End Date.**
  - **Editing and saving an employee record must preserve the original End Date unless an authorized user explicitly changes it.**
* **Implementation Mapping:** Task `RWK-003` (Implement Fractional Probation Calculation). Requires schema migration adding `probation_end_date` and `probation_duration` to `flwdsk_employees` (`ISSUE-010`).

---

### DECISION 3 — PROJECT-Q1: Canonical Project Membership Storage
* **Decision ID:** `PROJECT-Q1`
* **Module:** Projects & Resource Scheduler
* **Status:** **`Approved — Not Yet Implemented`** (Approved 31 Oct 2026)
* **Approved Policy Wording:**
  - **Existing Employees must be assigned to Projects.**
  - **`flwdsk_resource_allocations` is the single canonical source for Project Membership.**
  - **Project Members receive the approved permissions to create tasks, view relevant tasks, and access relevant project reports.**
  - **Project membership must remain scoped to the assigned Project.**
  - **`flwdsk_projects.member_ids` may be deprecated only after dependency review, data validation, and migration planning.**
  - **Do not independently redesign the existing security or permission architecture.**
* **Implementation Mapping:** Task `RWK-006` (Normalize Project Team Storage, `ISSUE-006`). Requires data backfill migration from `member_ids` to `flwdsk_resource_allocations`.

---

### DECISION 4 — CAL-Q01: Training Session Table Consolidation
* **Decision ID:** `CAL-Q01`
* **Module:** Training Calendar / My Day / Attendance
* **Status:** **`Approved — Not Yet Implemented`** (Option B Approved 31 Oct 2026)
* **Approved Policy Wording:**
  - **`flwdsk_schedule_sessions` becomes the single canonical table for Training Calendar planning, scheduling, and attendance.**
  - **Add the necessary planning fields (`session_title`, `start_time`, `end_time`, `venue`, `mode`, `color`) to the canonical table through an appropriately validated migration.**
  - **Preserve existing Calendar session records and Attendance records** via data backfill.
  - **Trainer My Day, Training Calendar, and Attendance Log must use the same canonical session records.**
  - **Preserve existing security policies and RLS.**
  - **Review all dependencies before changing existing workflows.**
  - **Validate migration and regression tests before deprecating `flwdsk_calendar_sessions`.**
  - **Do not implement yet.**
* **Implementation Mapping:** Task `RWK-008` (Unify Training Session Tables, `ISSUE-005`). Requires schema expansion and data backfill migration.

---

## 3. Technical & Infrastructure Confirmations (Engineering Baseline)

* **STARTUP-Q1: Production Vercel Auth Mode Configuration:**
  - *Status:* **Resolved & Locked.** Production Vercel deployment must lock `VITE_AUTH_MODE=legacy`. Live curl tests confirmed that Supabase Auth Edge Functions (`refresh-session`) and refresh token tables are not deployed in production. Using `legacy` mode eliminates runtime HTTP 500 session crashes.
* **STARTUP-Q2: Database Migration Parity:**
  - *Status:* **Verified Missing in Live DB.** Live curl probes returned `PGRST205` for `flwdsk_auth_refresh_tokens`. Migration parity is deferred until a dedicated infrastructure phase and does not block FlowDesk rework.

---

## 4. Future Product Planning Items (Non-Blocking)

These items pertain strictly to the separately planned **Student Training Management** commercial product initiative and do not block FlowDesk internal office rework:

* **TRAIN-Q01: Student Attendance Compatibility Cache Recalculation Threshold:**
  - Commercial student attendance compliance formulas. Non-blocking. Retain existing schema inert.
* **EXAM-Q01: Public Student Exam Portal Rate Limiting & Token Expiration:**
  - External public exam token expirations on `/submit-exam`. Non-blocking. Retain existing routes inert.

---

## 5. Authority Summary Matrix

| Decision ID | Domain | Stakeholder Decision | Implementation Status | Blocks Rework? |
|---|---|:---:|:---:|:---:|
| **TRAIN-Q02** | Training Batches | **Approved** | Queued for `RWK-007` | **No** |
| **EMP-Q01** | Employee Probation | **Approved** | Queued for `RWK-003` / Migration | **No** |
| **PROJECT-Q1** | Project Members | **Approved** | Queued for `RWK-006` / Migration | **No** |
| **CAL-Q01** | Training Sessions | **Approved (Option B)** | Queued for `RWK-008` / Migration | **No** |
| **LEAVE-Q4A** | Leave Quota Pro-Rata | **Approved** | Queued for `RWK-004` | **No** |
| **STARTUP-Q1** | Infrastructure Auth | **Technical Baseline** | Locked to `legacy` | **No** |
| **STARTUP-Q2** | DB Migration Parity | **Technical Baseline** | Defer JWT tables | **No** |
| **TRAIN-Q01** | Student Attendance | **Future Initiative** | Retain inert | **No** |
| **EXAM-Q01** | Student Exam Portal | **Future Initiative** | Retain inert | **No** |

