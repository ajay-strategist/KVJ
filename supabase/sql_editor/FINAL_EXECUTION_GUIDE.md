# Flowdesk Phase 1 — Final Execution Guide

## 1. Current Status
- **Status**: `READY FOR PREFLIGHT / STAGING ONLY` (Static SQL review completed; live `KVJ-Alpha` schema not yet queried and no runtime PostgreSQL server test executed locally).
- **Executed against DB**: None. Zero production data or security settings were modified.

## 2. Execution Order (Supabase SQL Editor)
1. **Take a verified backup** (`pg_dump -Fc` + `pg_restore --list`).
2. **Run [`final_01_preflight.sql`](file:///Users/apple/Downloads/flow-desk-main/supabase/sql_editor/final_01_preflight.sql)** (Read-Only):
   - **STOP** if any row has `severity = 'BLOCKER'`.
   - Review `WARNING` rows (duplicate college/batch codes, string-encoded `batch_checklist_state`).
3. **Run [`final_02_consolidated_migration.sql`](file:///Users/apple/Downloads/flow-desk-main/supabase/sql_editor/final_02_consolidated_migration.sql)** once in **staging**, then once in **production** after staging passes:
   - Runs atomically inside `BEGIN ... COMMIT`.
   - Any `FATAL ...` error rolls back all changes automatically.
4. **Run [`final_03_post_migration_verification.sql`](file:///Users/apple/Downloads/flow-desk-main/supabase/sql_editor/final_03_post_migration_verification.sql)** (Read-Only):
   - Confirm `office_expenses_touched_must_be_0 = 0`.
   - Confirm `office_remote_sessions_touched_must_be_0 = 0`.
   - Review `flwdsk_batch_migration_audit` (`resolved = FALSE`) for any flagged mappings.

## 3. Security Limitations (NOT READY FOR FRONTEND USE)
Because no RLS, `GRANT`, `REVOKE`, or `SECURITY DEFINER` changes were authorized in Phase 1:
- `public.flwdsk_batch_migration_audit` — RLS disabled; **NOT READY FOR FRONTEND USE**.
- `public.flwdsk_batch_checklist_items` — RLS disabled; **NOT READY FOR FRONTEND USE**.
- `public.flwdsk_batches_integration_v1` — `security_invoker = true`, `GRANT`s unaudited; **NOT READY FOR FRONTEND USE**.
- `public.toggle_batch_checklist_item(...)` — `SECURITY INVOKER` with default `PUBLIC` execute; **NOT READY FOR FRONTEND USE**.

Apply a separate security/RLS migration before deploying Phase 2 frontend changes.
