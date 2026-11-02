# FINAL PENDING ITEMS AND BLOCKERS

**Document ID:** `docs/FINAL_PENDING_ITEMS_AND_BLOCKERS.md`  
**Date:** November 2, 2026  
**Status:** **ACTIVE GOVERNANCE REGISTER — AWAITING STAKEHOLDER ACTIONS**  
**Authoritative References:**
- `docs/APPROVAL_AND_BLOCKER_REGISTER.md`
- `docs/MASTER_IMPLEMENTATION_PLAN.md` (v5.0)
- `docs/FINAL_IMPLEMENTATION_COMPLETION_REPORT.md`

---

## 1. Register Overview

This document clearly distinguishes between work that is **fully implemented and locally verified**, work that is **implemented in code but requires database migration execution**, items that are **intentionally frozen / excluded**, and external dependencies that await stakeholder authorization.

---

## 2. Status Classification Inventory

### Category A: Fully Implemented & Locally Verified (100% Ready)
*All application business logic, repository standardization, type safety, UI/UX redesigns, test suites, and dynamic chunking are fully implemented and verified locally with zero errors.*
- `ISSUE-001` (Task Duration sub-second ceiling precision & display).
- `ISSUE-002` (HTTP 500 error boundary resilience & graceful guards).
- `ISSUE-003` (Break toast single-dispatch cleanup).
- `ISSUE-004` & `ISSUE-012` (Attendance atomic upsert, child-first break cleanup, overnight shift resolution).
- `ISSUE-007` (Default `.is('deleted_at', null)` soft-delete enforcement).
- `ISSUE-008` (Vitest test harness with 9 test suites and 35 automated tests).
- `ISSUE-009` (Task rejection governance: ever-started `'rejected_closed'` vs pre-start deletion).
- `ISSUE-010` (Probation duration & accrual start date dynamic derivation in code).
- `ISSUE-011` (Pro-rata unearned leave accrual engine).
- `ISSUE-013` (Batch lifecycle bidirectional adapter: 4 UI states $\leftrightarrow$ DB `phase`).
- `ISSUE-014` (Dynamic imports for `xlsx`, `jspdf`, `jspdf-autotable`).
- `UIUX-REQ-001` to `UIUX-REQ-020` (All 20 UI/UX requirements completed).
- All 16 Expense Analytics metrics implemented in `ExpenseAnalyticsPage.tsx`.

---

### Category B: Implemented in Code — Awaiting Tier 2 Database Migration Execution
*The frontend and repository layers have been updated to support these schema enhancements gracefully. However, in strict accordance with governance rules, migrations have NOT been executed on live/staging databases.*

| Item ID | Target Migration Script | Scope & Dependencies | Migration Readiness | Action Required for Activation |
| :--- | :--- | :--- | :---: | :--- |
| **`APPR-MIG-000`** | `20261101000000_create_migration_log.sql` | Creates `public.flwdsk_migration_log` audit table. | **READY** | Stakeholder Tier 2 Migration Approval & Supabase execution. |
| **`APPR-MIG-001`** | `20261101010000_add_probation_end_date.sql` | Adds `probation_end_date DATE NULL` to `flwdsk_employees` (`EMP-Q01`). | **READY** | Stakeholder Tier 2 Migration Approval & Supabase execution. |
| **`APPR-MIG-002`** | `20261101020000_consolidate_schedule_sessions.sql` | Adds planning columns to `flwdsk_schedule_sessions` and backfills legacy calendar sessions (`CAL-Q01`). | **READY** | Stakeholder Tier 2 Migration Approval & Supabase execution. |
| **`APPR-MIG-003`** | `20261101030000_composite_indexes.sql` | Creates composite performance indexes on high-frequency tables. | **READY** | Stakeholder Tier 2 Migration Approval & Supabase execution. |
| **`APPR-MIG-004`** | `20261101040000_backfill_project_allocations.sql` | Idempotent backfill of `flwdsk_projects.member_ids` to `flwdsk_resource_allocations` (`PROJECT-Q1`). | **READY** | Stakeholder Tier 2 Migration Approval & Supabase execution. |

*Note: Frontend code includes defensive null checks so that application functionality remains stable whether or not these migrations are applied immediately.*

---

### Category C: Frozen & Excluded Scope (Intentionally Unmodified)
*The following boundaries have been strictly respected with zero modifications:*

| Boundary Area | Reason for Exclusion / Freeze | Evidence in Workspace |
| :--- | :--- | :--- |
| **Security System** | RLS policies, auth middleware, JWT session management, Edge Functions are locked out-of-scope (`BLCK-SEC-001`). | Zero edits to security/auth directories. |
| **Mobile App (`Mobile App/`)** | React Native / Expo codebase frozen during web rework (`BLCK-MOB-001`). Operational architecture planned under `UIUX-REQ-020`. | `git diff -- Mobile\ App/` produces zero output. |
| **Excluded Modules** | Budget Management, Procurement, Asset Management, and Payroll are excluded from rework (`EXCL-MOD`). | Zero table drops; legacy tables and data preserved intact. |

---

### Category D: External Blockers Awaiting Stakeholder Sign-Off
1. **Tier 2 Database Migration Approval:** Formal stakeholder sign-off is required prior to applying migrations `MIG-000` through `MIG-004` in staging/production environments.
2. **Personal Stakeholder Verification:** Stakeholder personal review of the local web application across the 20 modules and 20 UI/UX requirements.
3. **GitHub Push & Deployment Authorization:** Git commit, push, and remote deployments are strictly prohibited until the stakeholder completes verification and gives explicit written authorization.

---
*End of Final Pending Items and Blockers Register.*

