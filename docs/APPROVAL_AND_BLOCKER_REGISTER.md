# FlowDesk Approval & Blocker Register

**Document Identifier:** DOC-APPR-BLOCK-001  
**Version:** 1.0 (Master Authoritative Approval & Blocker Register)  
**Status:** Active Governance Register  
**Effective Date:** 2026-11-01  
**Project:** FlowDesk (`flow-desk-main`)

---

## 1. Register Purpose & Governance Principles

This document serves as the central, authoritative register of all formal stakeholder approvals, pending authorization requests, and active technical or architectural blockers.

### Governance Rules:
1. **Never Re-Ask Approved Decisions:** Decisions marked **APPROVED** are legally and operationally locked. They must not be re-opened or re-questioned.
2. **Hard Escalation on Conflicts:** Any new stakeholder request that directly contradicts an approved decision is marked **BLOCKED — DECISION CONFLICT** and halted until explicit resolution.
3. **Strict Migration Approval Gate:** Database DDL migrations, column alterations, or data backfills require explicit **Tier 2 Database Migration Approval** prior to staging or production execution.
4. **Strict Production Deployment Gate:** No code may be deployed to production without an explicit **Tier 3 Production Deployment Sign-Off**.

---

## 2. Formal Stakeholder Approvals (Authoritative & Locked)

| Decision ID | Domain / Scope | Approved Rule & Implementation Convention | Approval Date | Reference Authority |
|---|---|---|---|---|
| **`CONF-001`** *(Superseding `TRAIN-Q02`)* | Training Operations | **Training Batch Status Authority:** **ALL employees, regardless of role or category, are permitted to change Training Batch Status** (`Not Started → In Progress → Completed → Closed`). This universally includes Admins, Managers, Assigned Trainers, and All Other Employees. Formally supersedes the prior restricted `TRAIN-Q02` decision. | 2026-11-01 | Stakeholder Confirmation (`CONF-001`, `DISC-002`) |
| **`EMP-Q01`** | Employee Management | **Probation Date Storage Convention:** **Probation End Date** is the sole authoritative stored column (`probation_end_date DATE NULL`). Probation Duration and Leave Accrual Start Date are derived dynamically. Decimal display rounding must never mutate the stored End Date. | 2026-10-31 / 2026-11-01 | Stakeholder Confirmation (`EMP-Q01`, `DISC-001`) |
| **`PROJECT-Q1`** | Project Management | **Canonical Project Membership & Supervisor Scope:** `flwdsk_resource_allocations` is the sole canonical source of project members. Supervisors have authority strictly over their assigned projects and allocated members, including peer-assigned tasks. Cross-project supervisor actions prohibited. | 2026-10-31 / 2026-11-01 | Stakeholder Confirmation (`PROJECT-Q1`, `DISC-004`) |
| **`CAL-Q01`** | Training Scheduling | **Canonical Training Schedule Table:** `flwdsk_schedule_sessions` is the sole canonical storage table. Dual-table usage is discontinued; legacy calendar sessions are to be merged. | 2026-10-31 | Stakeholder Confirmation |
| **`BR-TASK-007`** | Task Management | **Task Rejection & Deletion Governance:** Governed strictly by whether the employee **EVER started** the task (not work hours). Never-started task rejected before work: delete task and rejection record. Ever-started task rejected: preserve task and history, set status to `Rejected / Closed`. Distinct from `Completed` and `Approved`. | 2026-10-31 / 2026-11-01 | Stakeholder Confirmation (`BR-TASK-007`, `DISC-003`) |
| **`BR-ATT-004`** | Time Tracking | **Off-Shift Task Start:** Employees are strictly permitted to start task timers even if they are not clocked into attendance. Zero attendance prerequisites for task start. | 2026-10-31 | Operational Policy |
| **`EXCL-MOD`** | System Scope | **Module Exclusions:** Budget Management, Procurement, Asset Management, and Payroll are excluded from rework. Existing tables and historical records must be preserved intact. | 2026-10-31 | Executive Mandate |
| **`UIUX-BATCH-01`**| User Interface | **UI/UX Batch 01 Scope:** `UIUX-REQ-001` through `UIUX-REQ-010` approved for planning (including batch status change capability for all employees via `CONF-001`). | 2026-10-31 / 2026-11-01 | Stakeholder Directive |
| **`UIUX-BATCH-02`**| User Interface | **UI/UX Batch 02 Scope:** `UIUX-REQ-011` through `UIUX-REQ-020` approved for planning (including 16-metric Expense Analytics specification). | 2026-11-01 | Stakeholder Directive |

---

## 3. Pending Approvals Register

The following items are completely planned, specified, and verified, but require formal stakeholder sign-off before execution:

| Item ID | Category | Description & Proposed Scope | Prerequisites Completed | Required Approval Tier | Current Status |
|---|---|---|---|---|---|
| **`APPR-MIG-000`** | Database DDL | Schema creation of proposed audit table `public.flwdsk_migration_log` (prerequisite for `MIG-004` provenance tracking). | DDL drafted and verified; safe additive table; zero impact on existing schemas. | **Tier 2 (DB Migration)** | **PENDING STAKEHOLDER APPROVAL** |
| **`APPR-MIG-001`** | Database DDL | Execution of `ALTER TABLE flwdsk_employees ADD COLUMN IF NOT EXISTS probation_end_date DATE NULL;` (`EMP-Q01`, `DISC-001`). | DDL script drafted; rollback SQL prepared; dependency analysis complete. | **Tier 2 (DB Migration)** | **PENDING STAKEHOLDER APPROVAL** |
| **`APPR-MIG-002`** | Database DDL | Additive planning columns on `flwdsk_schedule_sessions` and non-destructive backfill from `flwdsk_calendar_sessions` (`CAL-Q01`). | Read usage mapped; zero data loss backfill script verified; non-destructive. | **Tier 2 (DB Migration)** | **PENDING STAKEHOLDER APPROVAL** |
| **`APPR-MIG-003`** | Database DDL | Execution of composite performance indexes (`idx_flwdsk_att_emp_date`, `idx_flwdsk_tws_emp_open`, `idx_flwdsk_sched_batch_date`). | Index DDL prepared; non-concurrent transaction safety verified. | **Tier 2 (DB Migration)** | **PENDING STAKEHOLDER APPROVAL** |
| **`APPR-MIG-004`** | Database DDL | Idempotent backfill from `flwdsk_projects.member_ids` to `flwdsk_resource_allocations` with migration provenance tracking (`flwdsk_migration_log`) and forward-recovery default (`PROJECT-Q1`). | Non-destructive backfill SQL prepared; rollback safe via `flwdsk_migration_log`. | **Tier 2 (DB Migration)** | **PENDING STAKEHOLDER APPROVAL** |
| **`APPR-DIAG-001`**| Server Diagnostics| Authorization to access production Supabase Edge Function logs if staging read-only reproduction of `ISSUE-002` is inconclusive. | Staging reproduction protocol and HAR analysis drafted; strict security boundaries maintained. | **Tier 1 (Diagnostic)** | **PENDING CONDITIONAL ESCALATION** |
| **`APPR-REL-PH1`** | Release Gate | Deployment of Phase 1 Critical Operational Reliability fixes (`ISSUE-001`, `ISSUE-002`, `ISSUE-003`, `ISSUE-004`, `ISSUE-009`, `ISSUE-011`, `ISSUE-012`). | Local implementation, automated testing, investigation gates, and local verification report prepared (5.0 engineering days effort estimate). | **Tier 3 (Production Deploy)** | **PENDING LOCAL VERIFICATION** |
| **`APPR-UIUX-020`**| Mobile App | Implementation kickoff for Mobile App operational feature scope (React Native/Expo). | Architecture plan, operational scoping, and CI/CD strategy completed. `Mobile App/` frozen. | **Tier 1 (Implementation)** | **PENDING SEPARATE AUTHORIZATION** |

---

## 4. Active Blockers & Scope Boundaries

| Blocker ID | Severity | Nature of Blocker | Impacted Requirements | Root Cause & Scope Limitation | Required Action | Status |
|---|---|---|---|---|---|---|
| **`BLCK-SEC-001`** | **CRITICAL** | **Security System Scope Boundary:** Modifying JWT configuration, authentication middleware, RLS policies, or security functions is strictly forbidden. | `ISSUE-002` (Refresh HTTP 500) | Application audit identified potential session refresh race conditions near edge functions. | Rework must utilize defensive client-side fallbacks without altering core auth infrastructure. | **BLOCKED (OUT OF SCOPE)** |
| **`BLCK-EXP-001`** | **MEDIUM** | **Table Drop Migrations:** Migration `20261029000000_remove_excluded_modules_tables.sql` attempts to drop budget and payroll tables, violating data preservation mandates. | Database Deployment Pipeline | Legacy AI-generated migration file in workspace. | Migration permanently excluded from CI/CD pipeline; file archived. | **BLOCKED (CANCELLED)** |
| **`BLCK-MOB-001`** | **MEDIUM** | **Mobile App Modification Freeze:** Modifying the `Mobile App/` directory during web application rework risks breaking mobile build pipelines. | `Mobile App/` directory | Concurrent modification of mobile dependencies during web rework. | `Mobile App/` frozen until web rework Phase 8 completion and separate authorization. | **BLOCKED (FROZEN)** |

---

## 5. Resolved Decision Conflicts & Governance History

| Conflict ID | Domain | Previous Rule | New Authoritative Rule | Resolution Date | Authority | Status |
|---|---|---|---|---|---|---|
| **`CONF-001`** | Training Batch Status Authority | `TRAIN-Q02`: Only Admins, Managers, and Assigned Trainers were permitted to change batch status. | **All employees, regardless of role or category, are permitted to change Training Batch Status** (Admins, Managers, Assigned Trainers, and All Other Employees). | 2026-11-01 | Stakeholder Confirmation | **RESOLVED / APPROVED** |
| **`DISC-001`** | Employee Probation Schema | Legacy `ISSUE-010` recommended adding 3 columns (`probation_end_date`, `probation_duration`, `leave_accrual_start_date`). | **Store only `probation_end_date DATE NULL`.** Duration and leave accrual start date are strictly derived dynamically in code. | 2026-11-01 | Stakeholder Confirmation (`EMP-Q01`, `DISC-001`) | **RESOLVED / APPROVED** |
| **`DISC-002`** | Training Batch Lifecycle Statuses | Incomplete 3-status UI dropdown (`Not Started`, `In Progress`, `Completed`) omitting `Closed`. | **Exact 4 UI-visible statuses:** `Not Started`, `In Progress`, `Completed`, `Closed`. `Completed` and `Closed` are strictly distinct. All employees can change status. | 2026-11-01 | Stakeholder Confirmation (`CONF-001`, `DISC-002`) | **RESOLVED / APPROVED** |
| **`DISC-003`** | Task Lifecycle & Status Alignment | Five-state TypeScript union missing `Approved` and `Rejected / Closed`; deletion rule based on hours $>0$. | **7-state union:** `Pending Approval`, `To Do`, `In Progress`, `Under Review`, `Approved`, `Completed`, `Rejected / Closed`. Deletion governed strictly by whether employee **ever started** the task. | 2026-11-01 | Stakeholder Confirmation (`BR-TASK-007`, `DISC-003`) | **RESOLVED / APPROVED** |
| **`DISC-004`** | Project Supervisor Authority Scope | Hard-coded UI blocked supervisors from approving peer assignments within their projects. | **Supervisor authority is strictly project-scoped via `flwdsk_resource_allocations`.** Supervisor may approve all tasks (including peer-assigned) within their assigned projects. Cross-project action strictly prohibited. | 2026-11-01 | Stakeholder Confirmation (`PROJECT-Q1`, `DISC-004`) | **RESOLVED / APPROVED** |

