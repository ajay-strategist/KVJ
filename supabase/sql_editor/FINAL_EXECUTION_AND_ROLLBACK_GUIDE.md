# Flowdesk Phase 1 — Final Execution and Rollback Guide

> **Current Status**: **`READY FOR STATIC REVIEW`** (Not yet runtime-tested or executed against production. PITR is disabled and no managed backups exist on `KVJ-Alpha`.)

---

## 1. Mandatory Prerequisites (Production Blocked Until Complete)

Production execution is **BLOCKED** until all of the following are completed in order:
1. Take a full PostgreSQL custom-format backup using `pg_dump -Fc`:
   ```bash
   pg_dump "postgresql://postgres:<DB_PASSWORD>@db.yzlyeuikvbwhgjrjntvi.supabase.co:5432/postgres?sslmode=require" \
     -Fc --no-owner --no-acl -f "kvj_alpha_pre_phase1_$(date +%Y%m%d_%H%M%S).dump"
   ```
2. Validate the backup archive with `pg_restore --list`:
   ```bash
   pg_restore --list kvj_alpha_pre_phase1_*.dump | head -n 30
   ```
3. Restore that backup into an isolated **staging** PostgreSQL 17 database.
4. Execute `01_FINAL_PREFLIGHT.sql`, `02_FINAL_MIGRATION.sql`, and `03_FINAL_VERIFICATION.sql` against **staging**.
5. Verify existing application workflows (Expenses, Employee Attendance, Batch Management, Courses & Colleges) and record-level data parity in staging.
6. Confirm the rollback procedure below works cleanly on staging.

---

## 2. Exact Execution Order (Supabase SQL Editor)

1. **Paste & Run First**: [`01_FINAL_PREFLIGHT.sql`](file:///Users/apple/Downloads/flow-desk-main/supabase/sql_editor/01_FINAL_PREFLIGHT.sql) *(Read-Only — safe even if tables are missing)*
   - **STOP** if any row returns `severity = 'BLOCKER'`.
2. **Paste & Run Second**: [`02_FINAL_MIGRATION.sql`](file:///Users/apple/Downloads/flow-desk-main/supabase/sql_editor/02_FINAL_MIGRATION.sql) *(Single `BEGIN ... COMMIT` transaction)*
   - Expected: 8 rows in `_migration_report` (`OK` or `WARNING` with audit details).
3. **Paste & Run Third**: [`03_FINAL_VERIFICATION.sql`](file:///Users/apple/Downloads/flow-desk-main/supabase/sql_editor/03_FINAL_VERIFICATION.sql) *(Read-Only — safe even if objects are missing)*
   - Expected: Zero `BLOCKER` rows; all FKs, functions (`prosecdef = false`), `security_invoker=true` view, and scope isolation checks return `PASS`.

---

## 3. Rollback & Recovery Procedure

- **Automatic In-Transaction Rollback**: Any `FATAL ...` error in `02_FINAL_MIGRATION.sql` aborts and rolls back the entire `BEGIN ... COMMIT` transaction automatically, leaving zero partial changes.
- **Post-Commit Non-Destructive Recovery**:
  - Never run `DROP TABLE` or `DELETE FROM`.
  - Either restore from the verified `pg_dump -Fc` archive, **or** clear only the newly backfilled nullable FK columns (`UPDATE ... SET batch_id = NULL` / `college_id = NULL`) while all legacy `code`, `college`, `notes`, `work_type`, and `batch_checklist_state` JSONB values remain intact.

---

## 4. Security & Frontend Readiness

All newly created objects (`flwdsk_batch_migration_audit`, `flwdsk_batch_checklist_items`, `flwdsk_batches_integration_v1`, `toggle_batch_checklist_item`) are **NOT READY FOR FRONTEND USE** until a separate security migration configures RLS and scoped `GRANT`/`REVOKE` permissions.
