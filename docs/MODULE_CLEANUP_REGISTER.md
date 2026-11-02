# FlowDesk Module, Package & Asset Cleanup Register

**Document Identifier:** DOC-CLEANUP-001  
**Version:** 1.0 (Master Authoritative Register)  
**Status:** Audit & Evaluation Only — No Deletion Authorized  
**Effective Date:** 2026-10-31  
**Project:** FlowDesk (`flow-desk-main`)

---

## 1. Scope & Deletion Safeguards

> [!CAUTION]
> **STRICT RETENTION DIRECTIVE:**  
> This register documents candidates identified during the architecture audit for eventual cleanup, deprecation, or relocation. **NO files, packages, modules, database tables, or historical records may be deleted or moved during planning.** Any future cleanup requires verified dependency analysis, staging validation, and explicit stakeholder approval.

---

## 2. Package Dependency Candidates (Evaluated Separately)

Each package identified as potentially dead in `package.json` was audited individually across imports, indirect dependencies, build scripts, tooling, and runtime behavior:

| Package Name | Current Version | Direct Imports in `src/` | Indirect / Script References | Runtime / Build Necessity | Regression Risk | Proposed Action | Required Approval |
|---|---|---|---|---|---|---|---|
| **`googleapis`** | `^173.0.0` | **0 imports** | None in `scripts/`, `vite.config.js`, or config files. | Zero (Node.js server library; invalid in browser). | Very Low | Prune in Phase 0B | Explicit Stakeholder Sign-Off on Phase 0B |
| **`nodemailer`** | `^8.0.8` | **0 imports** | None in `scripts/` or tooling. | Zero (Node.js server library; invalid in browser). | Very Low | Prune in Phase 0B | Explicit Stakeholder Sign-Off on Phase 0B |
| **`dotenv`** | `^17.4.2` | **0 imports** | None in `scripts/`. Vite natively uses `import.meta.env`. | Zero in client bundle. | Very Low | Prune in Phase 0B | Explicit Stakeholder Sign-Off on Phase 0B |
| **`socket.io-client`** | `^4.8.3` | **0 imports** | None in `scripts/`. Realtime communication uses Supabase client. | Zero (Realtime is via Supabase). | Very Low | Prune in Phase 0B | Explicit Stakeholder Sign-Off on Phase 0B |
| **`axios`** | `^1.15.2` | **0 imports** | None in `scripts/`. Entire app uses native browser `fetch`. | Zero. | Very Low | Prune in Phase 0B | Explicit Stakeholder Sign-Off on Phase 0B |

---

## 3. Code, Module & Workspace Candidates

| Candidate Path | Description & Classification | Usage Evidence & Dependency Analysis | Business Impact | Data Impact | Safe Removal / Handling Procedure | Required Approval Checkpoint |
|---|---|---|---|---|---|---|
| **`Mobile App/`** | Independent React Native / Expo codebase inside web root. | Web app has **0 imports** from `Mobile App/`. Own `node_modules` (500+ pkgs) and `package.json`. | Zero impact on web app; high impact on mobile devs if moved. | None. | **LEAVE TOUCHED (CLOSED)**: Retain in workspace untouched per approved stakeholder decision. | **CLOSED** (Do not relocate) |
| **`src/core/engines/`** (11 files) | In-memory workflow engines (`workflow.ts`, `approval.ts`, `activity.ts`, etc.). | Transient arrays (`ActivityLog[]`). Registered in `bootstrap.ts`; imported in `training.service.ts` and `project.service.ts` constructors. Real app uses Supabase tables. | Zero impact on business logic. | None. | **PHASED DEPRECATION**: Decouple service constructor imports first in Phase 6; run full typecheck; deprecate files without sudden deletion. | Phase 6 Decoupling Audit Sign-off |
| **`flwdsk_budgets`, `flwdsk_purchase_orders`...** | Tables for excluded modules (Budget, Procurement, Assets, Payroll). | Untracked migration `20261029000000_remove_excluded_modules_tables.sql` exists. | Historical data loss if dropped. | **Severe Data Destruction**. | **CANCEL MIGRATION (CLOSED)**: Retain all tables and historical records intact. Exclude migration from pipeline. | **CLOSED** (Table drops rejected) |
| **`schema.sql`** (root) | Outdated static SQL file (6.4 kB). | Superseded by `supabase/reset-and-rebuild.sql` and migrations. Zero application imports. | None. | None. | **RETAIN AS-IS / ARCHIVE ONLY**: Move to `docs/archive/` during final housekeeping; do not delete. | Documentation Archive Review |
| **`Audit_Report/`** | Historical audit notes from August 2026. | Stale text files. Zero application imports. | None. | None. | **RETAIN AS-IS / ARCHIVE ONLY**: Preserve in documentation archive. | Documentation Archive Review |
| **`graphify-out/`** | Graph visualization build artifact. | Static visualization output. Zero application imports. | None. | None. | **DEFER**: Add to `.gitignore`; do not manually delete during planning. | General Repository Cleanup |
| **Root Brand Logos** (`logo.png`, `KVJ analytics Logo.png`, etc.) | Loose unreferenced image files in root. | Official production logos are in `public/` and `src/assets/`. | None. | None. | **CONSOLIDATE**: Relocate to `src/assets/branding/` during Phase 6 cleanup; verify no broken paths. | Phase 6 Asset Audit |

---

## 4. Safe Removal & Regression Verification Protocol

Before any package is uninstalled or any code file is deprecated in future authorized phases, the following 4-step protocol must be executed:
1. **Pre-Removal Static Analysis:** Execute AST grep (`grep -rn "<package-or-symbol>" src/`) to guarantee 0 references.
2. **Isolated Staging Commit:** Execute removal in a dedicated, isolated git commit.
3. **Automated Verification:** Execute full test runner (`npm test`), strict typecheck (`npm run typecheck`), and production build (`npm run build`).
4. **Rollback Plan:** If any build warning, broken dynamic import, or runtime exception occurs, immediately revert the commit.

