# Flowdesk — Final SQL Execution Guide

> **Status**: Statically reviewed for PostgreSQL 17 (`KVJ-Alpha`, `yzlyeuikvbwhgjrjntvi`). Not yet runtime-tested or executed against production.

---

## 1. Prerequisite Backup & Staging Requirement

1. **Take a verified backup first** before running any migration against production:
   ```bash
   pg_dump "postgresql://postgres:<DB_PASSWORD>@db.yzlyeuikvbwhgjrjntvi.supabase.co:5432/postgres?sslmode=require" \
     -Fc --no-owner --no-acl -f "kvj_alpha_pre_phase1_$(date +%Y%m%d_%H%M%S).dump"
   pg_restore --list kvj_alpha_pre_phase1_*.dump | head -n 20
   ```
2. **Staging validation**: Run all three files in order on a staging clone restored from the backup before executing on production.

---

## 2. Exact Execution Order (Supabase SQL Editor)

1. **Paste & Run First**: [`01_FINAL_PREFLIGHT.sql`](file:///Users/apple/Downloads/flow-desk-main/supabase/sql_editor/01_FINAL_PREFLIGHT.sql) *(Read-Only)*
2. **Paste & Run Second**: [`02_FINAL_MIGRATION.sql`](file:///Users/apple/Downloads/flow-desk-main/supabase/sql_editor/02_FINAL_MIGRATION.sql) *(Transactional Migration)*
3. **Paste & Run Third**: [`03_FINAL_VERIFICATION.sql`](file:///Users/apple/Downloads/flow-desk-main/supabase/sql_editor/03_FINAL_VERIFICATION.sql) *(Read-Only Verification)*

---

## 3. Expected Successful Output

- **After `01_FINAL_PREFLIGHT.sql`**:
  - Zero rows with `severity = 'BLOCKER'`.
  - Any `WARNING` rows (e.g., duplicate college/batch codes or string-encoded `batch_checklist_state`) are reviewed and expected.
- **After `02_FINAL_MIGRATION.sql`**:
  - Returns an 8-row `_migration_report` table (`1. Preflight` through `8. Verification`) with `status = 'OK'` (or `'WARNING'` where unmatched/ambiguous/duplicate items were logged to `flwdsk_batch_migration_audit`).
- **After `03_FINAL_VERIFICATION.sql`**:
  - Zero rows with `status = 'BLOCKER'`.
  - All 4 FKs (`1_FOREIGN_KEYS`), all 3 functions (`2_FUNCTIONS`, `prosecdef = false`), `Office Expenses untouched`, `Office/Remote work sessions untouched`, and `flwdsk_batches_integration_v1` report `status = 'PASS'`.
  - `5_AUDIT_ISSUES` lists any unresolved `WARNING` items in `flwdsk_batch_migration_audit`.

---

## 4. Error Handling & Rollback

- **Is rollback automatic?**
  - **Yes** for `02_FINAL_MIGRATION.sql`: the entire script runs inside `BEGIN; ... COMMIT;`. Any `FATAL PREFLIGHT`, `FATAL FK CONFLICT`, or `FATAL VERIFICATION` error automatically aborts and rolls back all DDL and backfill changes.
  - `01_FINAL_PREFLIGHT.sql` and `03_FINAL_VERIFICATION.sql` are 100% read-only `SELECT` scripts.
- **What to do if an error occurs**:
  1. **Do not** re-run blindly or run destructive SQL.
  2. Read the exact `FATAL ...` error message in the Supabase SQL Editor output.
  3. If `01_FINAL_PREFLIGHT.sql` reports a `BLOCKER` (missing table/column or wrong column type), stop and resolve the schema mismatch before running `02_FINAL_MIGRATION.sql`.
  4. If `02_FINAL_MIGRATION.sql` rolls back with `FATAL FK CONFLICT` or `FATAL VERIFICATION`, inspect the reported constraint/table name; zero partial changes were committed.

---

## 5. Blocked Operations / Separate Security Approval Required

Under Phase 1 restrictions (zero RLS, `GRANT`, `REVOKE`, or `SECURITY DEFINER` changes), the following newly created objects are **NOT READY FOR FRONTEND USE** until a separate security migration configures RLS and scoped grants:
- `public.flwdsk_batch_migration_audit` (RLS disabled)
- `public.flwdsk_batch_checklist_items` (RLS disabled)
- `public.flwdsk_batches_integration_v1` (`security_invoker = true`, `GRANT`s unaudited)
- `public.toggle_batch_checklist_item(...)` (`SECURITY INVOKER`, default `PUBLIC` execute privilege)
