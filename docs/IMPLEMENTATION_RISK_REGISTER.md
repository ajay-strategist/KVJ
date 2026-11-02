# FlowDesk Implementation Risk Register

**Document Identifier:** DOC-RISK-001  
**Version:** 1.0 (Master Authoritative Register)  
**Status:** Approved Risk Management Plan  
**Effective Date:** 2026-10-31  
**Project:** FlowDesk (`flow-desk-main`)

---

## 1. Risk Governance & Management Protocol

This register identifies technical, operational, and architectural risks associated with the FlowDesk engineering rework, defining preventive controls, detection mechanisms, and rollback procedures.

### Severity Scoring Framework
- **Impact:** Critical (4), High (3), Medium (2), Low (1)
- **Likelihood:** High (3), Medium (2), Low (1)
- **Risk Score = Impact $\times$ Likelihood** (Scores $\ge 6$ require mandatory architectural safeguards).

---

## 2. Active Risk Register

| Risk ID | Category | Risk Description | Impact | Likelihood | Score | Preventive Mitigation Control | Detection & Monitoring | Recovery / Rollback Procedure |
|---|---|---|---|---|---|---|---|---|
| **`RSK-001`** | Data Loss | Accidental execution of table-drop migration (`remove_excluded_modules_tables.sql`) destroying budget, procurement, asset, or payroll data. | Critical (4) | Low (1) | 4 | **Scope Boundary**: Formally cancelled. File excluded from CI/CD migration pipeline. | Pre-deployment migration dry-run checks in staging. | Restore PostgreSQL database from latest Supabase snapshot. |
| **`RSK-002`** | Diagnostics | Attempting to fix `ISSUE-002` (HTTP 500 on refresh) without live runtime evidence, causing auth/session regressions. | High (3) | Medium (2) | 6 | **Mandatory Diagnostic Gate**: No code changes to ErrorBoundary or JWT until live HAR and server logs are captured. | Browser Network tab HAR inspection and edge function execution logs. | Revert diagnostic branch; maintain existing session handling. |
| **`RSK-003`** | Workflow | `ISSUE-004` clock-out failure leaves employees stranded across midnight shifts due to cascading deletes or date clamping. | High (3) | Medium (2) | 6 | **In-Place Updates**: Replace destructive `DELETE + INSERT` in `syncWorkSessions` with in-place `UPDATE`. Extend `findActiveRecord` to resolve unclosed past sessions. | Attendance log audit; automated midnight-rollover test suite. | Revert repository changes; execute manual clock-out via admin script. |
| **`RSK-004`** | Regression | Refactoring monolithic pages (e.g. `MyDayPage` 3,290 LOC) breaks prop passing, timer state, or modal bindings. | High (3) | Medium (2) | 6 | **Incremental Decomposition**: Break files into focused sub-components (< 500 LOC) one container at a time with visual equivalence tests. | Automated component smoke tests; Cypress/Playwright regression pass. | Git branch revert per decomposed screen. |
| **`RSK-005`** | Data Integrity | Inadvertent deletion of work sessions when rejecting tasks under `ISSUE-009`. | High (3) | Low (1) | 3 | **Ever-Started Detection**: Enforce query `EXISTS (SELECT 1 FROM flwdsk_task_work_sessions WHERE task_id = :id AND deleted_at IS NULL)` before branching to delete vs. `Rejected / Closed`. | Audit log inspection on task rejection events. | Restore task row from soft-delete or backup. |
| **`RSK-006`** | Architecture | Universal replacement of all 68 direct Supabase queries causes broad application breakage if done in one sweep. | High (3) | Medium (2) | 6 | **Module-by-Module Refactoring**: Refactor repositories incrementally per active module alongside targeted unit tests. | Repository mock unit tests; CI grep audit. | Rollback individual module repository branches. |
| **`RSK-007`** | Security | Inadvertent modification of PostgreSQL RLS policies, roles, or permissions during rework. | Critical (4) | Low (1) | 4 | **Strict Scope Boundary**: Security System is out of scope. Zero migration files altering RLS or auth functions allowed. | Automated SQL linting rejecting `ALTER POLICY`, `CREATE POLICY`, or auth schema edits. | Revert unauthorized migration; restore RLS baseline. |
| **`RSK-008`** | Operational | Premature performance micro-optimization breaks working exports or layout stability. | Medium (2) | Low (1) | 2 | **Benchmark First**: Measure baseline Lighthouse and bundle sizes before imposing arbitrary gates. Lazy-load `xlsx` and `jspdf` on demand. | Vite rollup bundle analyzer inspection. | Revert dynamic import splitting. |
| **`RSK-009`** | Mobile | Relocating or altering `Mobile App/` breaks mobile developer build pipelines. | High (3) | Low (1) | 3 | **Workspace Freeze**: Directory remains completely untouched during web rework. | Git status check verifying 0 changes in `Mobile App/`. | N/A (Untouched). |
| **`RSK-010`** | Governance Conflict | Prior conflict between `UIUX-REQ-009` and `TRAIN-Q02` resolved by stakeholder. `CONF-001` formally approves all-employee batch status changing, superseding `TRAIN-Q02`. | Low (1) | Low (1) | 1 | **CONF-001 Resolved Policy**: Service layer and UI dropdown configured to permit all authenticated employees to change batch statuses. | Automated permission tests verifying all authenticated roles can change batch status. | Revert to previous role gating if policy is revised. |
| **`RSK-011`** | Data Persistence | Relying solely on client `localStorage` for `UIUX-REQ-002` (task ordering) fails employee-specific cross-device synchronization and is lost on cache clear. | Medium (2) | High (3) | 6 | **Technically Validated Multi-Tier Storage**: Implement server-side preference persistence (`flwdsk_employees.preferences` JSONB or `auth.users.user_metadata`) backed by optimistic local state. | Integration test verifying task order persists across independent device profiles. | Fallback gracefully to scoped local key `flwdsk_task_order_${user.id}` if server offline. |

---

## 3. Rollback & Emergency Incident Protocol

If an unauthorized regression or fatal defect is detected during any rework phase:
1. **Immediate Freeze:** Stop all forward development on the affected phase branch.
2. **Diagnostic Snapshot:** Capture error stack traces, network payloads, and browser logs.
3. **Automated Rollback:** Revert to the last verified commit tagged at the preceding phase approval checkpoint.
4. **Post-Incident Root Cause Analysis:** Document the failure in `ISSUES_REGISTER.md` before scheduling a remediation review.

