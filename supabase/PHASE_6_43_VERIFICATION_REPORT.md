# PHASE 6.43 — POST-REMEDIATION VERIFICATION, REGRESSION & DATA-INTEGRITY AUDIT

**Date:** 2026-08-08
**Method:** From-disk inspection of actual repository state. Prior reports (incl. 6.42) treated as claims to be re-verified, not trusted.
**Verification tiers:** `STATIC VERIFIED` only — no live/local Postgres or Supabase session was available, so no live RLS/JWT tests were run.
**Note:** The Phase 6.43 brief was received **truncated** (cut off at §7, `flwdsk_set_password`); no report-format spec or §7+ checks were included. This report covers the clearly-defined verification scope.

---

## 1. Executive Summary

All controls claimed by Phases 6.30 / 6.36 / 6.40 / 6.42 are **present and correct on disk**. Verification also **caught and fixed one regression** introduced by the 6.42 employee-guard trigger (it would have blocked admin provisioning), and **surfaced one high-value architectural finding** that governs whether *any* of the RLS hardening is actually effective in production:

> **The RLS security model depends on `auth.uid()` (a real Supabase JWT), but the app's primary login path does not guarantee one.** Login Path 1 (`flwdsk_authenticate` + a custom `kvj_app_session` in localStorage) returns immediately; the real Supabase sign-in is a fire-and-forget, error-swallowed background call (`syncSupabaseAuth`). `getSession()` prefers the custom session. And `flwdsk_set_password` changes only the app-level `password_hash`, never `auth.users` — so after any in-app password change the Supabase credential desyncs and the JWT can no longer be obtained.

Consequence: for users without a synced JWT, `auth.uid()` is NULL → every hardened policy denies → the app silently falls back to local/in-memory state on write failure. This does not make the 6.42 migration *wrong*, but it means **strict RLS must be deployed together with an auth-session reconciliation**, or those users lose real DB persistence.

`typecheck` **PASS** · `build` **PASS** (470 modules).

---

## 2. Controls Verified Present & Correct (on disk)

| Control | File / line | Result |
|---|---|---|
| `flwdsk_set_password` guard `auth.uid()=p_employee_id OR is_training_admin()`, anon revoked | `migrations/…6_36…sql:19,23,44-45` | ✅ intact |
| 6.30 training RLS (relationship predicates, blanket dropped) | `migrations/…6_30…sql` | ✅ intact |
| 6.40 expense RLS (ownership + `status='submitted'` gate + self-approval block) | `migrations/…6_40…sql` | ✅ intact |
| 6.42 blanket-policy purge (programmatic, protected set) | `migrations/…6_42…sql` §F1/F2 | ✅ present |
| 6.42 `flwdsk_employees` RLS + privilege-guard trigger | same, §F3 | ✅ present (regression fixed — §3) |
| 6.42 `CHECK (amount >= 0)` | same, §F4 | ✅ present |
| 6.42 calendar slot unique index (dup-guarded) | same, §F5 | ✅ present |
| `RUN_ME` blanket loop neutralized + `RAISE EXCEPTION` guard | `RUN_ME_consolidated_fixes.sql` | ✅ present |
| `create_calendar_sessions.sql` now ENABLEs RLS + policies | that file | ✅ present |
| Attendance **master switch** (section governs column + gauge) | `StudentDataSection.tsx:31,70`, `ExecutiveSummarySection.tsx:15` | ✅ implemented |
| Calendar concurrency locks set-before / release-in-`finally` | `TrainingCalendar.tsx:574-588, 618-638` | ✅ both handlers |
| Expense locks (`submittingClaim`, `processingAction`) + `finally` on submit/approve/reject/delete/bulk | `ExpenseClaims.tsx:530-666, 672-844` | ✅ all guarded |
| Expense idempotency key (client `id`) | `ExpenseClaims.tsx:626-` | ✅ present |
| Batch PDF widths = 170mm (6+42+24+20+12+12+12+16+26) | `BatchManagement.tsx:3617-3626` | ✅ intact |
| Batch PDF divide-by-zero guard | `BatchManagement.tsx:3666-3667` | ✅ intact |

---

## 3. Regression Found & Fixed This Pass

**6.42 employee-guard trigger blocked provisioning.** `provision-admin.sql` (`ON CONFLICT DO UPDATE SET role='ADMIN'`) and `align-user-roles.sql` (`SET role=…`) run in the SQL editor as `service_role`/`postgres`, where `auth.uid()` is NULL → `is_training_admin()` false → the trigger would `RAISE EXCEPTION` and **break admin provisioning**.

**Fix applied** to `migrations/20260808170000_phase_6_42_security_boundary_remediation.sql`: the trigger now short-circuits on `auth.uid() IS NULL OR public.is_training_admin()`. This is safe because RLS (`employees_update`) already prevents authenticated non-admins and anon from reaching the trigger on rows they don't own; self-row updates still carry a non-null `auth.uid()`, so employee→ADMIN self-escalation stays blocked. `STATIC VERIFIED`.

---

## 4. Headline Architectural Finding — [P2] Auth session / JWT dependency

**Root cause:** RLS uses `auth.uid()`; the app does not guarantee a Supabase JWT.
- `login()` Path 1 (`supabase-auth.service.ts:294-327`): on `flwdsk_authenticate` success it returns a **custom** `Session` (`token: app_<ts>`) persisted to `localStorage['kvj_app_session']`; the real Supabase sign-in is `syncSupabaseAuth()` — **non-blocking, `.catch(()=>{})`** (lines 274-283, 310-312).
- `getSession()` (`:436-447`) returns the custom session **first**, before consulting `supabase.auth.getSession()`.
- `flwdsk_set_password` (`migrations/…6_36…sql:32-37`) updates only `flwdsk_employees.password_hash` (via `crypt`), **not `auth.users`**. After any app password change, `syncSupabaseAuth(email, newPwd)` fails → no JWT.

**Impact:**
- Users without a synced JWT operate as `anon` → all hardened policies deny → writes fail and the UI **degrades to local state** (e.g., `ExpenseClaims` insert `catch` → "persisting to local state"). Data-integrity/persistence risk.
- The RLS hardening is only *effective* for JWT-backed sessions; it is neither enforced nor bypassed consistently across the user base.
- **Deployment risk:** applying the 6.42 blanket-policy purge in production could remove real-DB access for non-JWT users who previously (accidentally) relied on… nothing — since a blanket `authenticated` policy also requires a JWT. In practice those users were already falling back to local state; strict RLS makes that permanent until auth is reconciled.

**Recommendation (next phase, not done here — needs product/architecture decision):** pick a single source of truth for auth. Either (a) make Supabase Auth authoritative and block login until a JWT is obtained (make `syncSupabaseAuth` blocking; keep `auth.users` password in sync inside `flwdsk_set_password` or via an Edge Function using the Admin API), or (b) if app-level auth must remain primary, issue a signed Supabase JWT for the employee (custom token / Edge Function) so `auth.uid()` is always present. Until then, RLS effectiveness is partial.

---

## 5. Other Observations
- **[P3] Password desync** (subset of §4): in-app password changes leave `auth.users` stale; a future reconciliation is required for JWT continuity.
- **[P4] Fresh-reset ordering:** `create_calendar_sessions.sql` still lacks a timestamp prefix (now secure-by-itself; cosmetic ordering cleanup deferred).
- **[Info] Regular-employee training visibility:** 6.30 restricts training tables to trainers/admins; role `EMPLOYEE` sees no training data. This is pre-existing 6.30 design, not a 6.42 change — confirm it matches business intent.

---

## 6. Tests
- `npx tsc --noEmit` → **PASS** (exit 0). `STATIC VERIFIED`.
- `npm run build` → **PASS** (470 modules, ~2.5s). `STATIC VERIFIED`.
- Live RLS / JWT / concurrency tests: **not run** (no live DB/session). Not claimed.

---

## 7. Verdict

**CONDITIONAL PASS.** Every prior control is verified present and correct, one real regression (provisioning) was fixed, and the Batch PDF / Expense / Calendar / attendance behaviors are intact. The gating items before an unconditional PASS:
1. Apply the 6.42 migration and confirm `pg_policies` shows **zero** blanket policies on `flwdsk_%` (the §16.1 query from the 6.42 report).
2. **Resolve the auth-session/JWT dependency (§4)** — this determines whether the RLS hardening is actually effective and whether strict RLS is safe to enforce for the whole user base. This is the primary recommendation for Phase 6.44.
