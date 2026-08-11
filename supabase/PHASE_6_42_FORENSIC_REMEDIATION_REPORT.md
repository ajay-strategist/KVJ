# PHASE 6.42 — FORENSIC REMEDIATION REPORT
### Training & Expense Security Boundary Remediation, RLS Hardening & Data-Integrity Fix

**Date:** 2026-08-08
**Verification tiers used:** `STATIC VERIFIED` (source/SQL authored & reviewed) · `LOCAL DB VERIFIED` (none — no local Postgres) · `LIVE DB VERIFIED` (none — no credentials).
**No live database was available; no live RLS attack tests were run. Do not read any table below as LIVE-verified.**

---

## 1. Executive Summary

Phase 6.42 remediates the six Phase 6.41 findings plus one additional latent hole discovered during this pass (calendar RLS being disabled by a late-sorting migration). The core fix is **one new, idempotent, converging migration** that (a) programmatically purges every blanket permissive policy from the protected tables, (b) installs restrictive RLS + a privilege-guard trigger on `flwdsk_employees` to stop role self-escalation, (c) adds a DB `CHECK` on expense `amount`, and (d) adds a calendar slot-uniqueness guard. Alongside it, the repository's dangerous "paste-and-run" SQL scripts were neutralized so they can no longer silently re-open the protected tables, and a small expense idempotency key was added in the app.

One audit finding (**F-upload**) was **reclassified after tracing the actual code**: expense receipts are stored in **Google Drive**, not Supabase Storage — there is no Supabase receipt bucket to lock down, so the "bucket RLS" remediation does not apply. This is documented honestly in §9.

`typecheck` **PASS** · `build` **PASS** (470 modules). All Phase 6.30/6.36/6.40 controls preserved; certificate PDF untouched.

**Verdict: CONDITIONAL PASS** — the source/migration state is now secure and self-converging, but "PASS" cannot be asserted until the migration is applied and the one-line `pg_policies` check is run against the live database (§16).

---

## 2. Phase 6.41 Findings Reviewed

| ID | Finding | Disposition in 6.42 |
|---|---|---|
| F1 | Blanket `Allow full access` / `USING(true)` reintroduction | **Fixed** — migration purges them; scripts neutralized |
| F2 | 6.30 didn't drop legacy blanket on some tables | **Fixed** — migration purges the full protected set |
| F3 | `flwdsk_employees` role-escalation surface | **Fixed** — RLS + BEFORE UPDATE guard trigger |
| F4 | Expense `amount` DB-unconstrained | **Fixed** — `CHECK (amount >= 0)` |
| F5 | No DB duplicate protection (expense/calendar) | **Fixed** — calendar slot unique index; expense idempotency key |
| F-upload | Receipt bucket not owner-scoped | **Reclassified** — receipts live in Google Drive, not Supabase Storage (§9) |
| — | *New:* calendar RLS DISABLEd by late-sorting migration | **Fixed** — file converted to secure-by-itself + migration re-enables |

---

## 3. Actual Repository Verification (what was really found)

- **F1 is real and live-capable.** `supabase/RUN_ME_consolidated_fixes.sql` (§8 loop) re-creates `"Allow full access for authenticated users"` (`FOR ALL USING (auth.role()='authenticated')`) on `flwdsk_expense_claims`, `flwdsk_student_records`, `flwdsk_enrollments`, `flwdsk_assessments`, `flwdsk_schedule_sessions`, `flwdsk_batches`, `flwdsk_email_logs`, **and `flwdsk_employees`**. `supabase/MASTER_FIX_ALL_DATABASE_SAVING.sql` is worse — `FOR ALL USING (true) WITH CHECK (true)` (anonymous included) — but targets pre-rename table names, so it is mostly inert on the current `flwdsk_`-prefixed schema. `login-fix-verify.sql` targets `public.students` (obsolete post-rename).
- **F3 confirmed:** no restrictive policy on `flwdsk_employees` existed in the phase migrations; `role TEXT DEFAULT 'EMPLOYEE'` with no CHECK. With any blanket policy present, an employee could `PATCH /flwdsk_employees?id=eq.<self>` to `role=ADMIN`.
- **F4 confirmed:** `amount NUMERIC(10,2) NOT NULL`, no value CHECK. `km`/`rate`/`route` are **not columns** — they are packed into a `notes` JSON blob, so only `amount` needs a DB guard.
- **Expense status vocabulary reconciled:** the DB default is `'Pending'`, but the app always writes lowercase `'submitted'/'approved'/'rejected'` and lower-cases on read. The 6.40 policies gate on `status='submitted'`, which **matches the app's written value** — so the state-machine is functionally correct (no dead policy). The `'Pending'` default is cosmetic/harmless.
- **New finding:** `create_calendar_sessions.sql` has no timestamp prefix, so it **sorts after** `20260808130000_phase_6_30_training_rls.sql`. It ran `ALTER TABLE flwdsk_calendar_sessions DISABLE ROW LEVEL SECURITY`, i.e. it **re-opened the calendar** after 6.30 secured it, on any fresh `db reset`.
- **F-upload reclassified:** `grep "storage.from(" src/` returns **nothing**. `ExpenseClaims.tsx` uploads receipts via `googleIntegration.uploadReceiptWithMetadata(...)` and stores a `googleDriveViewUrl`. There is no Supabase expense-receipt bucket.

---

## 4. Remediations (root cause → change → impact)

### F1/F2 — Blanket-policy purge + script neutralization
- **Root cause:** permissive policies OR-combine; blanket policies coexisting with restrictive ones grant full access.
- **Change:**
  - `migrations/20260808170000_phase_6_42_security_boundary_remediation.sql` — a `DO` block iterates `pg_policies` for the protected table set and `DROP`s any policy that is (a) named `Allow full access for authenticated users`, or (b) has `qual`/`with_check` matching `auth.role() = 'authenticated'`, or (c) has `qual`/`with_check` equal to `true`. Hardened policies (which use `is_training_admin()`, `auth.uid() = …`, `employee_id = …`, `is_batch_trainer(…)`) match none of these and are preserved.
  - `RUN_ME_consolidated_fixes.sql` — removed all protected tables from the blanket-policy loop; added a hard `protected[]` guard that `RAISE EXCEPTION`s if a protected table is ever re-added.
  - `MASTER_FIX_ALL_DATABASE_SAVING.sql` — prominent ⛔ DO-NOT-RUN banner on Part 2.
- **Impact:** no repository SQL can reintroduce blanket access to the protected tables; the secure migrations are authoritative.

### F3 — Employee role-escalation lockdown
- **Change (migration §F3):** `ENABLE RLS`; `employees_select` (authenticated read — preserves directory/chat/pickers), `employees_insert` (admins only), `employees_update` (admin OR self-row), `employees_delete` (admins only); plus a `BEFORE UPDATE` trigger `flwdsk_employees_guard_privileged()` (`SECURITY DEFINER, search_path=public`) that raises if a non-admin changes `id/role/status/username/email/reporting_manager_id/department_id/designation`.
- **Why the trigger:** RLS `WITH CHECK` cannot compare NEW vs OLD, so it cannot by itself distinguish "employee edited their phone" from "employee set role=ADMIN". The trigger is the actual escalation guard; the policies scope which rows are reachable.
- **Password RPC preserved:** `flwdsk_set_password` updates only `password_hash`/`must_change_password`/`updated_at` — none are guarded columns — so self-service and forced-reset password changes still succeed. Phase 6.36 intact.

### F4 — Expense amount integrity
- **Change (migration §F4):** idempotent `ADD CONSTRAINT flwdsk_expense_claims_amount_nonneg CHECK (amount >= 0)`. Column was already `NOT NULL`.
- **Impact:** negative/`NaN`-coerced amounts are rejected by the database, not just the UI.

### F5 — Duplicate/idempotency protection
- **Calendar (migration §F5):** partial `UNIQUE INDEX uq_flwdsk_calendar_slot (batch_id, date, start_time) WHERE deleted_at IS NULL AND batch_id IS NOT NULL AND start_time IS NOT NULL`, created **only if** no existing duplicates (else a `NOTICE`, no hard failure). UPDATEs reuse the same `id`, and different slots are unaffected — legitimate scheduling is not blocked.
- **Expense (app):** `ExpenseClaims.tsx` now generates a client `id` (`crypto.randomUUID()`) and sends it in the insert. A replayed/retried identical submit collides on the primary key instead of creating a duplicate; two genuinely separate submits keep distinct ids and are both allowed. This is the DB backstop to the existing `submittingClaim` UX lock.

### New — Calendar RLS re-enable
- **Change:** `create_calendar_sessions.sql` converted from `DISABLE ROW LEVEL SECURITY` to `ENABLE` + the two 6.30-style relationship policies (guarded on helper-function existence so it is order-safe). The 6.42 migration also re-enables + (re)creates these policies for already-migrated databases.

---

## 5. RLS Policy Matrix (intended state after migration)

| Table | Anonymous | Employee (self) | Employee (others) | Trainer (own batch) | Manager/Admin/CEO |
|---|---|---|---|---|---|
| flwdsk_expense_claims | ✗ | R/W own; W only while `submitted` | ✗ | (as employee) | R/W all; approve/reject |
| flwdsk_expense_types | ✗ | insert (auth) | — | insert | full |
| flwdsk_employees | ✗ | read dir; update own **non-privileged** fields | read dir only | read dir | full (role mgmt) |
| flwdsk_student_records | ✗ | ✗ | ✗ | R/W own students | full |
| flwdsk_enrollments | ✗ | ✗ | ✗ | R/W own batch | full |
| flwdsk_batches | ✗ | read | read | R/W own batch | full |
| flwdsk_schedule_sessions | ✗ | ✗ | ✗ | R/W own batch | full |
| flwdsk_calendar_sessions | ✗ | ✗ | ✗ | R/W own batch | full |
| flwdsk_assessments | ✗ | ✗ | ✗ | R/W own batch (via enrollment) | full |
| flwdsk_exam_attempts / vouchers / retest / eligibility | ✗ | ✗ | ✗ | R/W own batch | full |
| flwdsk_audit_logs | ✗ | insert only | insert only | insert only | read; **no** update/delete (append-only) |
| flwdsk_email_logs | ✗ | insert only | insert only | read own scope | full |

"✗" = no access at the table layer. Anonymous login flows use the `SECURITY DEFINER` RPCs (`resolve_login_email`, `flwdsk_get_employee`), not direct table reads.

---

## 6. Employee Role Protection (how escalation is prevented)

Two layers: (1) `employees_update` restricts a non-admin to their **own** row; (2) the `BEFORE UPDATE` trigger rejects any non-admin change to `role/status/id/username/email/reporting_manager_id/department_id/designation`. A direct `PATCH` from an authenticated employee setting `role='ADMIN'` now raises `Not authorized to modify privileged employee fields`. Admin/manager employee management is unaffected (`is_training_admin()` short-circuits the trigger). **STATIC VERIFIED** (needs LIVE confirmation).

---

## 7. Expense Integrity
- **Amount:** `NOT NULL` + `CHECK (amount >= 0)` (DB-enforced).
- **Ownership:** `employee_id = auth.uid()` pinned in UPDATE `USING`+`WITH CHECK` (6.40, preserved) — ownership cannot be reassigned by an employee.
- **Status transitions:** employee edits/deletes only while `status='submitted'`; self-approval blocked by `WITH CHECK` (6.40, preserved).
- **Idempotency:** client-generated PK (§4 F5).

## 8. Calendar Integrity
Duplicate exact-slot inserts (`batch_id, date, start_time`) are rejected by `uq_flwdsk_calendar_slot`; edits (same `id`) and distinct slots are unaffected; RLS restored to trainer/admin scope.

## 9. Storage Security (receipts)
**Reclassified.** Receipts are uploaded to **Google Drive** (`googleIntegration.uploadReceiptWithMetadata`) and stored as a `google_drive_view_url`; there is **no Supabase Storage bucket** for expense receipts, so Supabase Storage RLS is not the control here. The relevant exposure is **Google Drive link sharing** (if links are "anyone with the link", they are effectively public). *Recommendation (out of DB scope): confirm the Drive integration creates per-file restricted permissions / uses signed access rather than public links.* The only Supabase Storage policy in the repo is for `certificate-receipts` (bucket-scoped, not owner-scoped) — **not touched** (certificates are out of scope).

## 10. RPC Regression — ✅ PASS (unchanged)
`flwdsk_set_password` still enforces `auth.uid() IS NOT NULL` → `auth.uid() = p_employee_id OR is_training_admin()` → length; `SECURITY DEFINER`, `search_path` set, `REVOKE … FROM PUBLIC, anon`. The new employees trigger does not block it (unguarded columns). `flwdsk_get_employee`/`resolve_login_email` untouched.

## 11. Training Regression — ✅ preserved
All 6.30 relationship policies remain (the purge matches only blanket predicates). Calendar isolation is now *stronger* (was being disabled). Cross-batch split-identity protection intact.

## 12. Batch PDF Regression — ✅ preserved
No changes to `BatchManagement.tsx` PDF code. Division-by-zero guard verified present (`students.length ? … : 0`, lines 3666-3667). A4/170mm/pagination/fallbacks untouched.

## 13. Attendance Report Builder — ✅ IMPLEMENTED
Product decision (confirmed by user): the **Date-wise Attendance SECTION is the master switch**. If that section is not selected, **no** attendance detail is shown anywhere — gauge, summary, or the Attendance % column — even if the column checkbox is ticked. Changes:
- `sections/ExecutiveSummarySection.tsx` — `showAttendance` now depends **only** on `selectedSections.includes('datewise-attendance')` (removed the OR-on-column that leaked the gauge).
- `sections/StudentDataSection.tsx` — the Attendance % column is now gated on `selectedCols.includes('attendancePct') && selectedSections.includes('datewise-attendance')`.
Dedicated attendance sub-sections were already section-gated by the registry, so no leak remains. `typecheck`/`build` PASS.

## 14. Certificate PDF — OUT OF SCOPE — NO CHANGES.

## 15. Tests
- **TypeScript:** `npx tsc --noEmit` → **PASS** (exit 0). `STATIC VERIFIED`.
- **Production build:** `npm run build` → **PASS** (470 modules, ~2.8s). `STATIC VERIFIED`.
- **SQL/static audit:** migration authored & reviewed; policy-drop predicate confirmed not to match any hardened 6.30/6.40 policy. `STATIC VERIFIED`.
- **Local DB tests:** none (no local Postgres). **Live DB tests: none.**

### Security Test Matrix (expected vs static reasoning; NOT live-verified)
| # | Test | Expected | Static reasoning |
|---|---|---|---|
| 1-2 | Anon SELECT/INSERT expense | Block | no anon policy |
| 3-6 | Emp own R/W; others R/W; insert-as-other | own only | 6.40 ownership |
| 7-11 | Emp edit approved / others / delete others | Block | `status='submitted'` + ownership |
| 12-13 | Emp set role=ADMIN / change other's role | Block | employees_update + trigger |
| 14-15 | Manager/Admin employee mgmt | Allow | `is_training_admin()` |
| 16-20 | Trainer cross-batch / split-identity | Block | relationship predicates |
| 21-25 | RPC anon/cross-user password, scraping | Block | 6.36 intact |
| 26-30 | Receipt access | N/A (Google Drive) | not Supabase Storage |
| 31-33 | Duplicate expense/calendar/retry | Block dupes | PK idempotency + slot unique index |

## 16. Remaining Issues (genuine)
1. **LIVE verification required.** Apply the migration, then run
   `SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'flwdsk_%' AND (policyname='Allow full access for authenticated users' OR qual='true');`
   Expect **zero rows**. Until then this phase is CONDITIONAL.
2. **Migration file ordering (fresh reset).** `create_calendar_sessions.sql` still lacks a timestamp prefix; it is now secure-by-itself, but a future cleanup should rename it to a timestamp before 6.30 for tidy ordering. Non-urgent (prod already migrated).
3. **Attendance report toggle semantics** — resolved & implemented (§13).
4. **Email/audit insert identity** — `sent_by`/`actor_id` are still not pinned to `auth.uid()` in the insert `WITH CHECK` (only `auth.uid() IS NOT NULL`). Lower priority; recommend a 6.43 follow-up if strict non-repudiation is required.
5. **`km`/`rate` integrity** — stored inside a JSON `notes` blob, so not DB-constrainable without schema change; TypeScript-validated only. Accepted for now.

## 17. Database Changes
- **New migration:** `supabase/migrations/20260808170000_phase_6_42_security_boundary_remediation.sql`
- **Edited (secure-by-itself):** `supabase/migrations/create_calendar_sessions.sql`
- **Neutralized scripts:** `supabase/RUN_ME_consolidated_fixes.sql`, `supabase/MASTER_FIX_ALL_DATABASE_SAVING.sql`
- **App:** `src/modules/finance/pages/ExpenseClaims.tsx` (idempotency key); `report/sections/ExecutiveSummarySection.tsx` + `report/sections/StudentDataSection.tsx` (attendance master switch, §13)

## 18. Final Security Verdict

**CONDITIONAL PASS.**

The repository/migration state is now secure and self-converging: no repository SQL can reintroduce blanket authenticated access to protected tables; employee role self-escalation is blocked at the database; expense amount and calendar duplicates have DB-level integrity; and all Phase 6.30/6.36/6.40 controls plus the Batch PDF and Expense/Calendar UX are preserved. It is **not** an unconditional PASS because the fixes are DB-side and this environment had no live database — the migration must be applied and the §16.1 `pg_policies` check must return zero rows before declaring the live system clean. No P0/P1 remains **in the source**; a live P0 (F1) persists until the migration runs against production.
