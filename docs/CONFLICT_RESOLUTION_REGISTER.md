# FlowDesk Conflict Resolution Register (Stage 2 Closure)

**Document Identifier:** DOC-CR-REG-001  
**Version:** 1.0 (Stage 2 Formal Decision Closure)  
**Status:** Approved & Authoritative  
**Effective Date:** 2026-11-01  
**Project:** FlowDesk (`flow-desk-main`)  
**Scope:** Formal Resolution of Stage 1 Audit Discrepancies (`DISC-001` through `DISC-004`)

---

## 1. Purpose & Authority

This register permanently documents the final, authoritative stakeholder decisions resolving all discrepancies identified during the Stage 1 Comprehensive Pending Business Rules & Conflict Audit. These resolutions govern all subsequent implementation planning (Stage 3) and execution across all phases.

---

## 2. Formal Conflict Resolutions

### DISC-001: Employee Probation Schema & Dynamic Derivation

* **Conflict Identifier:** `DISC-001`
* **Domain / Module:** Employee Management / Database Schema (`flwdsk_employees`)
* **Previous Conflicting Text / Proposals:**
  - `ISSUES/ISSUE-010_MISSING_PROBATION_SCHEMA_COLUMNS.md` and `FINAL_PRE_REWORK_AUDIT/13_NEW_FINDINGS_AND_GAPS.md` instructed the creation of a 3-column migration adding `probation_end_date DATE NULL`, `probation_duration VARCHAR(50) NULL`, and `leave_accrual_start_date DATE NULL`.
* **Exact Final Stakeholder Decision:**
  - **Decision `EMP-Q01` is strictly re-confirmed as authoritative.**
  - **Only `probation_end_date DATE NULL` shall be added to `flwdsk_employees`** via database migration.
  - `probation_duration` must be **dynamically derived** in memory/application logic from `probation_end_date` and `date_of_joining`.
  - `leave_accrual_start_date` must be **dynamically derived** from `probation_end_date` (or `date_of_joining` if no probation).
  - Display rounding (e.g., decimal months) must never alter the stored `probation_end_date`.
  - Do NOT execute any migration at this stage.
* **Superseded Statements:**
  - The 3-column DDL instruction in `ISSUE-010` and `13_NEW_FINDINGS_AND_GAPS.md` is formally superseded and corrected.
* **Implementation Implications:**
  - Database Migration `20261101000000_add_employee_probation_columns.sql` (Phase 2) will execute exactly one DDL alteration: `ALTER TABLE flwdsk_employees ADD COLUMN IF NOT EXISTS probation_end_date DATE NULL;`.
  - TypeScript interfaces and repository adapters compute duration and accrual dates on the fly.
* **Approval Status:** **APPROVED & LOCKED** (Stakeholder Decision 01 Nov 2026).

---

### DISC-002: Training Batch Lifecycle Statuses & Authority

* **Conflict Identifier:** `DISC-002`
* **Domain / Module:** Training Operations / Batch Management / `UIUX-REQ-009`
* **Previous Conflicting Text / Proposals:**
  - `UIUX-REQ-009` originally listed a 3-state UI dropdown (`Not Started`, `In Progress`, `Completed`), omitting `Closed`.
  - `BR-TRAIN-001` listed lifecycle as `Scheduled` / `Not Started` $\rightarrow$ `In Progress` $\rightarrow$ `Completed` $\rightarrow$ `Closed`.
  - `TrainingBatchCarousel.tsx` defined 7 exploratory phases (`Preparation`, `Assessment`, etc.).
  - Database column is `flwdsk_batches.phase` (`varchar(50)`).
* **Exact Final Stakeholder Decision:**
  - The final UI-visible statuses are **EXACTLY four**:
    1. **`Not Started`**
    2. **`In Progress`**
    3. **`Completed`**
    4. **`Closed`**
  - **`Completed` and `Closed` are strictly distinct statuses.** (`Completed` indicates training curriculum concluded; `Closed` indicates administrative/operational closure of the batch).
  - **ALL authenticated employees, regardless of role or category, may change the Batch Status.** (Reaffirming `CONF-001`).
  - The existing database value `Scheduled` may map to UI `Not Started` only after verifying the actual schema, stored values, queries, and transition logic in Phase 3.
  - Do not introduce additional statuses.
* **Superseded Statements:**
  - Any 3-option dropdown specification in `UIUX-REQ-009` that omitted `Closed`.
  - Any multi-phase exploratory status lists in component mockups.
* **Implementation Implications:**
  - UI dropdown in `TrainingBatchCarousel.tsx` and batch settings renders exactly: `['Not Started', 'In Progress', 'Completed', 'Closed']`.
  - Repository/Adapter translates between stored database values and standard UI labels.
* **Approval Status:** **APPROVED & LOCKED** (Stakeholder Decision 01 Nov 2026).

---

### DISC-003: Task Status Alignment & BR-TASK-007 Start-State Governance

* **Conflict Identifier:** `DISC-003`
* **Domain / Module:** Task Management / Approvals Queue / Task Board / `BR-TASK-007`
* **Previous Conflicting Text / Proposals:**
  - `src/modules/project/pages/TaskBoard.tsx` strictly defined `type TaskStatus = 'Pending Approval' | 'To Do' | 'In Progress' | 'Under Review' | 'Completed'`, omitting `Approved` and `Rejected / Closed`.
  - Ambiguity existed on whether rejection hard-deletes tasks based on logged hours ($>0$) vs work session records.
* **Exact Final Stakeholder Decision:**
  - Domain `TaskStatus` definitions across shared TypeScript types, repositories, Task Board, and UI filters must support:
    - **`Pending Approval`**
    - **`To Do`**
    - **`In Progress`**
    - **`Under Review`**
    - **`Approved`**
    - **`Completed`**
    - **`Rejected / Closed`**
  - **Semantic Rules:**
    - `Approved` is **NOT synonymous** with `Completed`. (Approved means cleared to work / accepted from review; Completed means all work concluded).
    - `Rejected / Closed` must remain **clearly distinguishable** from `Completed`.
    - `Rejected / Closed` tasks must remain accessible through an appropriate Rejected / Archived filter on Task Board and Approvals Queue.
    - Preserve existing workflow transitions unless explicitly superseded by an approved business rule.
    - Inspect actual database constraints and historical values before proposing any schema enum changes.
  - **`BR-TASK-007` Authoritative Start-State Rule:**
    - The deletion decision depends strictly on whether the employee **EVER started the task**, not whether work hours are greater than zero or whether a work session was successfully logged.
    - **Never-started task rejected before work:** Permanently delete the task record and associated rejection record.
    - **Ever-started task rejected after work submission:** Preserve the task and available history, then mark `Rejected / Closed`.
    - Do not invent a new column or unreliable start-state detection mechanism (inspect task history / session existence / start timestamps).
* **Superseded Statements:**
  - Five-status union types in `TaskBoard.tsx`.
  - Any heuristic that equated "never started" solely to `work_hours === 0`.
* **Implementation Implications:**
  - Shared domain models define standard 7-status union.
  - Deletion logic in Approvals Queue repository verifies `ever_started` state via `flwdsk_task_work_sessions` or start event log before issuing `DELETE` vs `UPDATE status = 'Rejected / Closed'`.
* **Approval Status:** **APPROVED & LOCKED** (Stakeholder Decision 01 Nov 2026).

---

### DISC-004: Project Supervisor Authority & Scoping Boundaries

* **Conflict Identifier:** `DISC-004`
* **Domain / Module:** Project Management / Task Approvals / `UIUX-REQ-007`
* **Previous Conflicting Text / Proposals:**
  - `TaskBoard.tsx#L150-L175` restricted peer-assignment approvals strictly to Category 1 roles (`ADMIN`, `CEO`, `MANAGER`).
  - Unclear whether Project Supervisors had authority over peer-assigned tasks among their allocated project members.
* **Exact Final Stakeholder Decision:**
  - **A Project Supervisor's authority is strictly restricted to the projects assigned to that supervisor.**
  - Within an authorized project, the supervisor **may view, approve, and reject tasks** belonging to its allocated employees, **including peer-assigned tasks**.
  - A supervisor **must not access or act on another project's tasks, employees, reports, or work records** through this authority.
  - Use `flwdsk_resource_allocations` as the **canonical project membership source** under `PROJECT-Q1`.
  - Do not redesign the existing security architecture or touch RLS.
* **Superseded Statements:**
  - Hard-coded UI restriction preventing Project Supervisors from approving peer-assigned tasks within their own supervised projects.
* **Implementation Implications:**
  - Approval queue query and TaskBoard action guards filter by `flwdsk_resource_allocations WHERE project_id IN (supervisor_projects)`.
  - Cross-project access is strictly blocked at the application query and service layer.
* **Approval Status:** **APPROVED & LOCKED** (Stakeholder Decision 01 Nov 2026).

---

## 3. Cross-Document Synchronization & Verification Matrix

| Register / Document | Status | Synchronized Sections |
|---|---|---|
| `docs/BUSINESS_RULES.md` | Verified & Synchronized | `BR-EMP-001`, `BR-TRAIN-001`, `BR-TASK-007`, `BR-PROJ-001` |
| `docs/APPROVAL_AND_BLOCKER_REGISTER.md` | Verified & Synchronized | Section 2 (Formal Approvals), Section 5 (Resolved Conflicts) |
| `docs/UI_UX_REQUIREMENTS_REGISTER.md` | Verified & Synchronized | `UIUX-REQ-007` (Supervisor Scope), `UIUX-REQ-009` (4 Batch Statuses) |
| `docs/MASTER_EXECUTION_ROADMAP.md` | Verified & Synchronized | Workstream C (Training), Workstream B (Tasks & Projects) |
| `docs/MASTER_IMPLEMENTATION_PLAN.md` | Verified & Synchronized | Phase 1, Phase 2, Phase 3, Phase 7 |
| `docs/MASTER_IMPLEMENTATION_ROADMAP.md` | Verified & Synchronized | Task 2.3, Task 3.4, Task 4.6, Task 7.12 |
| `docs/PHASE_APPROVAL_MATRIX.md` | Verified & Synchronized | Gate 1, Gate 2, Gate 3 criteria |
| `docs/IMPLEMENTATION_RISK_REGISTER.md` | Verified & Synchronized | `RSK-002`, `RSK-003`, `RSK-010`, `RSK-011` |
| `ISSUES/ISSUE-010_MISSING_PROBATION_SCHEMA_COLUMNS.md` | Verified & Synchronized | Remediated to single-column migration specification |

