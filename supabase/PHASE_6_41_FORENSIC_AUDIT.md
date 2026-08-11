# PHASE 6.41 — TRAINING & EXPENSE RLS, IDOR, DATA-INTEGRITY & CONCURRENCY FORENSIC AUDIT

**Mode:** Read-only. No code, SQL, RLS, or migration was modified during this audit.
**Date:** 2026-08-08
**Auditor:** Claude (static source/SQL audit)

---

## 0. CRITICAL SCOPE LIMITATION (read first)

This audit is a **static** review of the repository's source, SQL, and migration files. **There is no live database connection available in this environment**, and production must not be probed. Therefore:

- I can verify **what the migration and script files declare**.
- I **cannot** verify the **actual live policy set** attached to the production tables (`pg_policies`), nor run authorization probes against real `auth.uid()` sessions.
- Several findings below are **order-dependent** — they become P0 or become non-issues depending on **which SQL was actually applied to prod and in what order**. Those are flagged explicitly and require a live `SELECT * FROM pg_policies` to close out.

Do not treat "PASS in source" as "PASS in production" for the RLS-coexistence findings.

---

## 1. Executive Summary

The **migration-defined** security posture is genuinely good: Phase 6.30 (training RLS), 6.36 (RPC hardening), and 6.40 (expense RLS) are well-written, use `SECURITY DEFINER` helpers with `SET search_path`, correctly scope ownership/relationship access, and drop legacy permissive policies before installing restrictive ones.

**However, the handoff's claim that "all controls are intact" is not safely true**, because of one systemic problem that overrides everything else:

> **The blanket policy `"Allow full access for authenticated users"` (`FOR ALL USING auth.role() = 'authenticated'`) is (re)created by non-migration scripts and by earlier migrations on the very tables the phase migrations try to isolate. In PostgreSQL, multiple *permissive* policies are combined with `OR`. If any such blanket policy coexists with the hardened policies on a table, it grants every authenticated user full CRUD on every row — silently nullifying trainer batch isolation, expense ownership, expense state-machine, and email-log restrictions.**

Whether this is currently exploitable depends on **what was actually run against prod**. The repo contains a file (`RUN_ME_consolidated_fixes.sql`) whose own header instructs the operator to paste-and-run it, and which re-creates that blanket policy on `flwdsk_expense_claims`, `flwdsk_student_records`, `flwdsk_enrollments`, `flwdsk_assessments`, `flwdsk_schedule_sessions`, `flwdsk_batches`, `flwdsk_email_logs`, and more. If it was run after the phase migrations, the entire RLS hardening is currently bypassed.

**This is the single most important thing to resolve before declaring the project secure.**

`typecheck` PASS · `build` PASS.

---

## 2. Audit Scope

Static inspection of: Expense RLS/IDOR/state-machine, manager boundaries, expense-type security, numeric integrity, file-upload security, batch statistics integrity, calendar concurrency, training cross-batch IDOR, role escalation, audit/email log authenticity, RPC regression (6.36/6.37), and the application-vs-database boundary. Certificate PDF layout explicitly **out of scope** (not audited).

---

## 3. Files Inspected (primary)

- `supabase/migrations/20260808130000_phase_6_30_training_rls.sql`
- `supabase/migrations/20260808140000_phase_6_33_training_log_authenticity_hardening.sql`
- `supabase/migrations/20260808150000_phase_6_36_training_rpc_security_hardening.sql`
- `supabase/migrations/20260808160000_phase_6_40_expense_rls_hardening.sql`
- `supabase/migrations/20260724000000_production_schema_alignment.sql` (legacy blanket policies)
- `supabase/migrations/20260725000000_schema_contract_alignment.sql`, `20260724120000_production_stabilization.sql`, `20260729000000_employee_visibility_and_training_access.sql` (blanket-policy loops)
- `supabase/migrations/20260807224000_add_certificate_delivery_fields.sql` (storage bucket policy)
- `supabase/RUN_ME_consolidated_fixes.sql`, `supabase/MASTER_FIX_ALL_DATABASE_SAVING.sql`, `supabase/reset-and-rebuild.sql` (manual paste scripts)
- `src/modules/training/pages/BatchManagement.tsx` (batch stats)

---

## 4. Database Tables Inspected (RLS-relevant)

`flwdsk_expense_claims`, `flwdsk_expense_types`, `flwdsk_student_records`, `flwdsk_enrollments`, `flwdsk_batches`, `flwdsk_assessments`, `flwdsk_exam_attempts`, `flwdsk_vouchers`, `flwdsk_schedule_sessions`, `flwdsk_calendar_sessions`, `flwdsk_retest_payment_verifications`, `flwdsk_batch_eligibility_rules`, `flwdsk_certificates`, `flwdsk_audit_logs`, `flwdsk_email_logs`, `flwdsk_employees`.

---

## 5. RLS Policy Inventory (as declared in migrations)

| Table | Hardened policy source | Legacy blanket dropped by hardening migration? |
|---|---|---|
| flwdsk_expense_claims | 6.40 (select/insert/update/delete, ownership + `is_expense_manager()`) | ✅ dropped in 6.40 line 28 |
| flwdsk_expense_types | 6.40 (auth insert only) | ✅ old "public insert" dropped |
| flwdsk_student_records | 6.30 (admin OR `is_student_trainer`) | ✅ dropped 6.30 line 65 |
| flwdsk_enrollments | 6.30 (admin OR `is_batch_trainer`) | ✅ dropped 6.30 line 66 |
| flwdsk_batches / courses / colleges | 6.30 | ✅ dropped 6.30 lines 62-64 |
| flwdsk_schedule_sessions | 6.30 | ✅ dropped 6.30 line 67 |
| flwdsk_assessments | 6.30 | ✅ dropped 6.30 line 68 |
| flwdsk_certificates | 6.30 | ✅ dropped 6.30 line 70 |
| **flwdsk_exam_attempts** | 6.30 | ❌ **NOT dropped** |
| **flwdsk_vouchers** | 6.30 | ❌ **NOT dropped** |
| **flwdsk_calendar_sessions** | 6.30 | ❌ **NOT dropped** |
| **flwdsk_retest_payment_verifications** | 6.30 (partial drops of `*_public_read` etc., not the blanket) | ❌ blanket **NOT dropped** |
| **flwdsk_batch_eligibility_rules** | 6.30 | ❌ **NOT dropped** |
| **flwdsk_audit_logs** | 6.30 (append-only) | ❌ **NOT dropped** |
| **flwdsk_email_logs** | 6.30 (restricted) | ❌ **NOT dropped** |

The ❌ rows are only safe **if no blanket policy was ever created on them**. See Findings F1/F2.

---

## 6–10. Expense RLS / IDOR / State-Machine / Manager Boundary Audit

**Verified controls (in the 6.40 migration, assuming no coexisting blanket policy):**

- ✅ **Cross-user read blocked** — `expense_claims_select USING (is_expense_manager() OR employee_id = auth.uid())`.
- ✅ **Cross-user insert blocked** — `WITH CHECK (auth.uid() IS NOT NULL AND (employee_id = auth.uid() OR is_expense_manager()))`. An employee cannot insert a row owned by another `employee_id`.
- ✅ **Ownership change blocked** — UPDATE `USING` and `WITH CHECK` both pin `employee_id = auth.uid()`, so an employee cannot reassign a claim to/from another user.
- ✅ **Self-approval blocked** — employee UPDATE requires `status = 'submitted'` in **both** `USING` (old row) and `WITH CHECK` (new row). Setting `status='approved'` fails the `WITH CHECK` → `submitted → approved` self-transition is **DB-blocked**. Good.
- ✅ **Edit-after-decision blocked** — once `status` is `approved`/`rejected`, the employee `USING` clause fails → they can no longer UPDATE/DELETE. Good.

**Findings:**

### F4 — [P3] Employee can mutate the amount (and other fields) of a still-`submitted` claim; no DB numeric guard
While a claim is `submitted`, the employee may UPDATE it (legitimate — pre-review edit), but there is **no column-level restriction and no `CHECK` constraint on `amount`** (confirmed: no numeric CHECK exists in any expense migration). So an employee can set `amount` to any value — negative, zero, huge, high-precision — right up until a manager approves. Financial integrity therefore rests **entirely on the human approval step**, not on the database. Numeric validation is **TypeScript-only** (per handoff 6.40; DB has no guard). *Remediation: add `CHECK (amount >= 0)` and precision constraints; consider freezing non-owner-relevant fields via a trigger.*

### F-manager — [P5 informational] `is_expense_manager()` correctly restricts approval to ADMIN/CEO/MANAGER by reading `flwdsk_employees.role` under `SECURITY DEFINER` with `search_path=public`. Sound.

---

## 11. Numeric Data Integrity — [P3]
No DB-level `CHECK`/`NOT NULL`/precision constraints on `amount`, `km`, `rate` were found. `NaN`/`Infinity`/negative/scientific-notation are blocked **only** by frontend/TypeScript. Direct PostgREST writes bypass all of it. Combined with F4, financial fields are DB-unconstrained.

---

## 12. Expense Type Security
- ✅ Anonymous insert blocked — 6.40 replaces the old "public insert" policy with `WITH CHECK (auth.uid() IS NOT NULL)`.
- ⚠️ **[P4]** No DB constraint against empty/whitespace-only/duplicate/over-long type names or category manipulation; any authenticated user can create arbitrary types. Low risk (authenticated only), but unvalidated. Parameterized inserts via supabase-js make classic SQL injection unlikely, but no server-side value validation exists.

---

## 13. File Upload Security — [P3]
- The **only** storage policy in the repo is for the `certificate-receipts` bucket (`20260807224000`): `INSERT`/`SELECT` `TO authenticated USING (bucket_id = 'certificate-receipts')`. This is scoped **only by bucket**, with **no per-user/owner/foldername check** → **any authenticated user can read or write any object in that bucket** (cross-user file access).
- **No storage policy was found for expense-receipt uploads.** Either the bucket is public or relies on defaults — receipt attachments likely have **no ownership-scoped protection**. Frontend enforces 10 MB + MIME allowlist; the **Storage layer does not** → MIME-spoofed/oversized/cross-user uploads via the direct Storage API are not prevented at the DB/storage layer.
*Remediation: add owner/foldername-scoped `storage.objects` policies (e.g. `(storage.foldername(name))[1] = auth.uid()::text`) for every bucket, and confirm no bucket is `public` unless intended.*

---

## 14. Batch Management Integrity — ✅ PASS
`BatchManagement.tsx:3666-3667`: `attendanceAvg`/`scoreAvg` use `students.length ? … : 0` — divide-by-zero is guarded (no `NaN`/`Infinity`). Phase 6.40 fix is present in current source. Duplicate-student handling exists (`dedupeBatchStudents`). No integrity defect observed here.

---

## 15. Training Calendar Concurrency — [P3]
- **No `UNIQUE` constraint** on a natural key (e.g. `(batch_id, session_date, start_time)`) was found for calendar/schedule sessions. Frontend `submittingSession` lock (6.40) prevents double-click, but **two concurrent direct API calls, or two browser tabs, can create duplicate sessions** — no DB-level idempotency. Data-integrity risk, not an authorization breach.

---

## 16. Training Cross-Batch IDOR — ✅ PASS *in migration* (subject to F1/F2)
6.30 uses **relationship-aware** predicates: `is_batch_trainer(batch_id)`, `is_student_trainer(id)`, `is_enrollment_trainer(enrollment_id)`. Split-identity attacks (valid `student_id` from Batch A + `batch_id` from Batch B) are correctly defeated because access is checked against the **actual** enrollment→batch→trainer relationship, not the client-supplied pairing. **This holds only if no blanket policy coexists (F1/F2).**

---

## 17. Role Escalation — ⚠️ verify in prod
- `flwdsk_batches` write policy allows `trainer_id = auth.uid()` — a trainer can write their own batch rows. **Confirm the batch UPDATE cannot be used to set `trainer_id` to self on a batch they don't own**: `USING (is_training_admin() OR trainer_id = auth.uid())` gates the old row, and `WITH CHECK` the same — so a non-owner trainer cannot claim a foreign batch (old-row `trainer_id` ≠ them → `USING` fails). ✅ Self-assignment to a foreign batch is blocked.
- **`flwdsk_employees.role`** self-escalation: I did **not** find an RLS policy on `flwdsk_employees` in the phase migrations restricting UPDATE of the `role` column. If the live `flwdsk_employees` table carries a blanket "Allow full access for authenticated users" policy (it is in the `RUN_ME` list, line 112), **any authenticated employee could UPDATE their own `role` to `ADMIN`** via direct REST — a **P0 privilege escalation**. *This must be checked against prod immediately.* → tracked as **F1** (same root cause).

---

## 18. Audit Log Integrity — ✅ in migration / ⚠️ at risk
6.30 makes `flwdsk_audit_logs` append-only: `audit_logs_insert WITH CHECK (auth.uid() IS NOT NULL)`, `audit_logs_modify FOR ALL USING (false) WITH CHECK (false)`. **But** `flwdsk_audit_logs` is **not** dropped of a prior blanket policy (§5), and a coexisting permissive `FOR ALL USING(auth.role()='authenticated')` policy would **re-enable UPDATE/DELETE** (OR-combination), breaking append-only. Also note `actor_id` forgery is **not** structurally prevented in the insert `WITH CHECK` (it only checks `auth.uid() IS NOT NULL`, not `actor_id = auth.uid()`) — 6.33 may address this; **6.33 was not fully read** — verify that `actor_id = auth.uid()` is enforced. **[P2 pending 6.33 confirmation + F2].**

---

## 19. Email Log Integrity — ⚠️ at risk
6.30 restricts SELECT and restricts modify to admins. `email_logs_insert WITH CHECK (auth.uid() IS NOT NULL)` does **not** pin `sent_by = auth.uid()` → sender spoofing on insert is not structurally blocked at this layer. And `flwdsk_email_logs` is in the `RUN_ME` blanket list → coexisting full-access policy would nullify the modify restriction. **[P2/P3 pending F1/F2].**

---

## 20. RPC Regression (Phase 6.36/6.37) — ✅ PASS
- `flwdsk_set_password`: `SECURITY DEFINER`, `SET search_path = public, extensions`; body enforces `auth.uid() IS NOT NULL`, then `auth.uid() = p_employee_id OR is_training_admin()`, plus min-length; `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated, service_role`. **Anonymous and cross-user password mutation are blocked.** No regression.
- `flwdsk_get_employee`: `SECURITY DEFINER`, `SET search_path = public`. Redaction body not re-read line-by-line this pass — **confirm the anon-redaction branch still strips `employee_id/username/phone/designation/avatar_url`**.
- `resolve_login_email`: `SECURITY DEFINER SET search_path = public`, `REVOKE … FROM public; GRANT … TO anon, authenticated`. Username/phone enumeration remains (accepted P4, per 6.37).

---

## 21. Application vs Database Security Boundary Matrix

| Operation | UI | Service | RLS (migration) | DB Constraint | Direct-REST safe? |
|---|---|---|---|---|---|
| Expense SELECT | ✔ | ✔ | ✔ (6.40) | — | ✅ *if no blanket* |
| Expense INSERT (own) | ✔ | ✔ | ✔ | — | ✅ *if no blanket* |
| Expense UPDATE (own, submitted) | ✔ | ✔ | ✔ | ❌ no amount CHECK | ⚠️ amount unbounded (F4) |
| Expense self-approve | ✔ | ✔ | ✔ blocked | — | ✅ |
| Expense DELETE (post-decision) | ✔ | ✔ | ✔ blocked | — | ✅ *if no blanket* |
| Expense Type INSERT | ✔ | ✔ | ✔ (auth only) | ❌ no value CHECK | ⚠️ unvalidated (P4) |
| Calendar INSERT/UPDATE/DELETE | ✔ lock | ✔ | ✔ (batch trainer) | ❌ no UNIQUE | ⚠️ duplicates (F5) |
| Batch student access | ✔ | ✔ | ✔ relationship | — | ✅ *if no blanket* |
| Employee role UPDATE | hidden | — | ❌ **no restrictive policy found** | — | ❌ **P0 if blanket present (F1)** |
| Audit log UPDATE/DELETE | — | — | ✔ `USING(false)` | — | ⚠️ *nullified if blanket present* |
| Email log insert (`sent_by`) | ✔ | ✔ | ⚠️ not pinned to `auth.uid()` | — | ⚠️ spoofable |
| File upload (expense receipt) | ✔ 10MB/MIME | ✔ | ❌ **no storage policy found** | — | ❌ **cross-user (F-upload)** |

Any row that reads "*if no blanket*" collapses to **FAIL** the moment a `"Allow full access for authenticated users"` permissive policy coexists on that table.

---

## 22. Concurrency / Duplicate-Write Audit — [P3]
Frontend locks exist (`submittingClaim`, `processingAction`, `submittingSession`) but **no DB-level idempotency/unique constraints** back them for expense submission or calendar sessions. Direct/concurrent REST calls can duplicate writes.

---

## 23. Database Constraint Audit
Business rules currently enforced **only in TypeScript** (no DB `CHECK`/`UNIQUE` found): expense `amount`/`km`/`rate` numeric bounds; calendar session natural-key uniqueness; expense-type value validity. `register_no TEXT UNIQUE NOT NULL` (student key) is correctly DB-enforced (locked business rule, intact).

---

## 24. Adversarial Attack Matrix

| # | Attack | Expected | Actual (source) | Protection layer | Severity | Result |
|---|---|---|---|---|---|---|
| 1 | Employee reads another's expense | Block | Blocked by 6.40 select | RLS | — | ✅ *if no blanket* |
| 2 | Insert with `employee_id = B` | Block | Blocked by 6.40 check | RLS | — | ✅ *if no blanket* |
| 3 | Update another's expense | Block | Blocked (`employee_id=auth.uid()`) | RLS | — | ✅ *if no blanket* |
| 4 | Delete another's expense | Block | Blocked | RLS | — | ✅ *if no blanket* |
| 5 | Edit approved expense | Block | Blocked (`status='submitted'` gate) | RLS | — | ✅ *if no blanket* |
| 6 | Edit rejected expense | Block | Blocked | RLS | — | ✅ *if no blanket* |
| 7 | submitted→approved (self) | Block | Blocked by `WITH CHECK` | RLS | — | ✅ |
| 8 | approved→submitted (self) | Block | Blocked (post-decision `USING` fails) | RLS | — | ✅ *if no blanket* |
| 9 | Change expense owner | Block | Blocked | RLS | — | ✅ *if no blanket* |
| 10 | Anonymous expense insert | Block | Blocked (`auth.uid() IS NOT NULL`) | RLS | — | ✅ |
| 11 | Anonymous expense read | Block | Blocked | RLS | — | ✅ *if no blanket* |
| 12 | Unauthorized type insert | Block anon | Blocked | RLS | — | ✅ |
| 13 | Manager impersonation | Block | `is_expense_manager()` reads real role | RLS+DEFINER | — | ✅ |
| 14 | Trainer cross-batch access | Block | Relationship predicates | RLS | — | ✅ *if no blanket* |
| 15 | Student cross-batch access | Block | Relationship predicates | RLS | — | ✅ *if no blanket* |
| 16 | Calendar duplicate creation | Block/idempotent | No UNIQUE; FE lock only | App only | P3 | ⚠️ |
| 17 | Duplicate expense submission | Block/idempotent | No UNIQUE; FE lock only | App only | P3 | ⚠️ |
| 18 | Audit `actor_id` spoof | Block | Not pinned in insert check | RLS partial | P2 | ⚠️ verify 6.33 |
| 19 | Email `sent_by` spoof | Block | Not pinned in insert check | RLS partial | P2/P3 | ⚠️ |
| 20 | **Employee role escalation** | Block | **No restrictive policy on `flwdsk_employees`** | — | **P0 if blanket present** | ❌ verify prod |
| 21 | Trainer self-assign foreign batch | Block | Blocked (`USING` old-row `trainer_id`) | RLS | — | ✅ *if no blanket* |
| 22 | Password reset bypass | Block | 6.36 guards intact | RPC | — | ✅ |
| 23 | Anonymous employee scraping | Redact | 6.36 redaction (verify body) | RPC | P4 | ⚠️ confirm |
| 24 | **Direct-REST RLS bypass via blanket policy** | Block | **`RUN_ME` re-creates blanket full-access** | — | **P0/P1** | ❌ **verify prod** |
| 25 | File upload ownership bypass | Block | No owner-scoped storage policy | — | P3 | ❌ |

---

## 25. P0–P5 Findings

### F1 — [P0 if applied to prod / P1 latent] Blanket `Allow full access for authenticated users` reintroduction nullifies all RLS
- **Where:** `supabase/RUN_ME_consolidated_fixes.sql` lines ~100-133 loop over a table list that includes `flwdsk_expense_claims`, `flwdsk_student_records`, `flwdsk_enrollments`, `flwdsk_assessments`, `flwdsk_schedule_sessions`, `flwdsk_batches`, `flwdsk_email_logs`, `flwdsk_employees`, and creates `CREATE POLICY "Allow full access for authenticated users" … FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated')`. Also present in legacy migrations `20260724000000`, `20260725000000`, `20260724120000`, `20260729000000` on the pre-rename table names (policies survive the `20260730030000` rename to `flwdsk_`).
- **Why protection fails:** PostgreSQL OR-combines permissive policies. A single coexisting blanket policy grants **every authenticated user full CRUD on every row**, defeating 6.30 trainer isolation, 6.40 expense ownership, expense state-machine, audit append-only, and email-log restrictions — **and enables employee role self-escalation on `flwdsk_employees` (→ ADMIN)** since no restrictive policy guards that table.
- **Exploit path:** authenticated user → direct PostgREST `PATCH /flwdsk_employees?id=eq.<self>` set `role=ADMIN` (or read all `flwdsk_expense_claims`) → succeeds if the blanket policy is live.
- **The file's header calls itself "SAFE / additive / idempotent"** — misleading; it additively reopens a full bypass.
- **Remediation:** (1) Immediately run `SELECT schemaname, tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE tablename LIKE 'flwdsk_%' ORDER BY tablename;` against prod and confirm **no** `"Allow full access for authenticated users"` policy exists on any hardened table. (2) Delete the blanket-policy loop from `RUN_ME_consolidated_fixes.sql` (and neuter `MASTER_FIX_ALL_DATABASE_SAVING.sql` / `reset-and-rebuild.sql` similarly). (3) Add a migration that `DROP POLICY IF EXISTS "Allow full access for authenticated users"` on **every** `flwdsk_` table, run last. (4) Add an explicit restrictive RLS policy set on `flwdsk_employees` (self-read; role/UPDATE admin-only).

### F2 — [P2] Hardening migrations omit the blanket-policy `DROP` on several newly-secured tables
6.30 does not `DROP … "Allow full access for authenticated users"` on `flwdsk_exam_attempts`, `flwdsk_vouchers`, `flwdsk_calendar_sessions`, `flwdsk_retest_payment_verifications`, `flwdsk_batch_eligibility_rules`, `flwdsk_email_logs`, `flwdsk_audit_logs` (§5). If any carried a prior blanket policy, the new restrictive policy coexists with it → bypass. *Remediation: add explicit drops for these before the `CREATE POLICY` block.*

### F3 — [P2] `flwdsk_employees` has no restrictive RLS in the phase migrations
No policy restricting who may `UPDATE` `role`/`status`/`password_hash` on `flwdsk_employees` was found in the audited hardening migrations. This is the escalation surface behind attack #20. *Remediation: add ownership/role-scoped policies; ensure `role` changes require `is_training_admin()`.*

### F4 — [P3] Expense `amount` (and sibling numerics) DB-unconstrained; editable while `submitted` (§10-11).
### F5 — [P3] No DB uniqueness/idempotency for calendar sessions or expense submission (§15, §22).
### F-upload — [P3] Storage buckets lack owner-scoped policies; expense-receipt bucket has no policy at all (§13).
### F-authenticity — [P2 pending] `actor_id`/`sent_by` not pinned to `auth.uid()` in insert `WITH CHECK` (§18-19); confirm whether 6.33 closes `actor_id`.
### F-types — [P4] Expense-type values unvalidated at DB (§12).
### F-enum — [P4 accepted] `resolve_login_email` identifier enumeration (unchanged from 6.37).

---

## 26. Recommended Remediation (priority order)

1. **[Immediate] Verify prod policy set** (`pg_policies` query above). This single query determines whether F1 is a live P0 or a latent P1.
2. **[Immediate] Neutralize the blanket-policy scripts** — remove the loop from `RUN_ME_consolidated_fixes.sql` and the equivalents in `MASTER_FIX_ALL_DATABASE_SAVING.sql` / `reset-and-rebuild.sql`; they are footguns that silently undo every RLS phase.
3. **[Immediate] Add restrictive RLS to `flwdsk_employees`** (F3) and a sweep migration dropping the blanket policy from all `flwdsk_` tables (F1/F2).
4. **[Next]** Storage owner-scoping (F-upload); pin `actor_id`/`sent_by = auth.uid()` (F-authenticity).
5. **[Next]** DB constraints: `CHECK (amount >= 0)`, calendar natural-key `UNIQUE` (F4/F5).
6. **[Backlog]** Expense-type value validation (F-types).

*Per phase rules, none of the above was implemented in this read-only audit.*

---

## 27–33. Regression & Change Log
- **27. Regression:** `git status` shows pre-existing uncommitted feature work (BatchManagement final-exam changes, etc.); no audit-driven changes made.
- **28. TypeScript:** `npx tsc --noEmit` → **PASS** (exit 0).
- **29. Production build:** `npm run build` → **PASS** (470 modules, built in ~2.8s).
- **30. Database changes:** none.
- **31. RLS changes:** none.
- **32. RPC changes:** none.
- **33. Migration changes:** none.

---

## 34. Final Verdict

**CONDITIONAL FAIL — remediation required before "secure" can be asserted.**

The migration-defined controls are strong and Phase 6.36 RPC hardening is verifiably intact. **But** the project ships manual SQL (`RUN_ME_consolidated_fixes.sql`) and legacy migrations that create a blanket `"Allow full access for authenticated users"` permissive policy on the isolated tables — including `flwdsk_employees`, which has no restrictive policy of its own. If that policy is live in prod (the file's own header tells operators to run it), the result is a **P0**: full cross-user data access and employee→ADMIN role escalation via direct REST. This **cannot be closed from source alone** and requires the one-line `pg_policies` verification against the live database.

The handoff's assertion that "all controls are intact" is **not safely supportable** until F1 is resolved. This is a genuine discrepancy between the phase reports and the actual repository.

---

## 35. Security Posture Summary
- **Strong (verified in source):** RPC password/get-employee hardening, `SECURITY DEFINER search_path`, expense ownership + state-machine, relationship-aware training IDOR predicates, batch-stats integrity.
- **At risk (verify prod):** blanket-policy coexistence (F1/F2), `flwdsk_employees` role escalation (F3), audit/email authenticity pinning.
- **Weak (DB-unenforced, TypeScript-only):** numeric integrity, upload ownership, write idempotency, expense-type validity.
- **Not ready for "no further security work."** Ready for a **targeted remediation phase (6.42)** scoped to F1–F5 above — no unrelated features.
