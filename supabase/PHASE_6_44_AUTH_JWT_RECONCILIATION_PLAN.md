# PHASE 6.44 — AUTH SESSION / SUPABASE JWT RECONCILIATION — DESIGN PLAN

**Status:** DESIGN ONLY. No authentication code, migration, or Edge Function was created or modified in this pass (per your "plan only" decision). This document is the decision artifact; implementation is a follow-up once a direction is chosen.

---

## 1. Problem (from Phase 6.43)

All RLS policies (6.30 training, 6.40 expense, 6.42 employees) authorize on `auth.uid()` — the `sub` claim of a Supabase JWT presented to PostgREST. The app does **not** reliably present such a JWT:

- `login()` **Path 1** (`supabase-auth.service.ts:294-327`) verifies credentials via the `flwdsk_authenticate` RPC and then returns a **custom** session (`token: app_<ts>`) persisted at `localStorage['kvj_app_session']`. The real Supabase sign-in is `syncSupabaseAuth()` — **non-blocking and error-swallowed** (`:274-283, 310-312`).
- `getSession()` (`:436-447`) returns the **custom** session first, before `supabase.auth.getSession()`.
- `flwdsk_set_password` (`migrations/…6_36…:32-37`) updates only `flwdsk_employees.password_hash`; it never touches `auth.users`, so any in-app password change desyncs the Supabase credential and the JWT can no longer be minted via `signInWithPassword`.

**Net effect:** for any user without a live Supabase JWT, `auth.uid()` is NULL → hardened policies deny → the app silently degrades to local/in-memory state on writes. RLS is therefore only *partially* effective, and enforcing it strictly (6.42) risks removing real-DB persistence for those users until auth is reconciled.

---

## 2. Ground truth / constraints

- **App-level auth is intentional.** `20260804000000_app_level_auth.sql` deliberately moved the credential of record to `flwdsk_employees.password_hash` (bcrypt via `pgcrypto`). We keep this as the credential store; we are only fixing *session identity*.
- **No Edge Functions today** (`supabase/functions/` empty) → no current server-side holder of the `service_role` key or the JWT signing secret.
- **Most employees have no `auth.users` row** (only `provision-admin.sql` seeds the admin). The browser cannot create `auth.users` rows.
- `flwdsk_employees.id` is the intended `auth.uid()` (provisioning links them 1:1).
- Non-goals: no UI redesign, no certificate PDF work, no change to the 4-role model, `register_no = phone` stays locked.

Both robust options require a server-side/service-role capability that does not exist yet. That capability is the crux of the choice.

---

## 3. Success criteria (either option must meet these)

1. After login, PostgREST requests carry a JWT whose `sub` = the employee's `flwdsk_employees.id`, `role = 'authenticated'`, `aud = 'authenticated'`.
2. `auth.uid()` is non-NULL for every logged-in employee → 6.30/6.40/6.42 RLS becomes fully effective.
3. In-app password changes keep the JWT obtainable (no credential desync).
4. Session survives page reload and expires per `businessRules.auth.sessionTimeoutMinutes`.
5. No regression to `flwdsk_authenticate` / `flwdsk_set_password` / `flwdsk_get_employee` hardening (6.36/6.37).
6. Rollback path exists that restores today's behavior without data loss.

---

## 4. OPTION A — Custom Supabase-compatible JWT via an Edge Function  *(recommended)*

Keep app-level auth authoritative; mint a Supabase JWT server-side after verifying the credential.

### 4.1 Components
- **New Edge Function `issue-session`** (`supabase/functions/issue-session/index.ts`), holds two secrets: `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` (both set via `supabase secrets set …`, never shipped to the browser).
- **New table `flwdsk_auth_refresh_tokens`** (opaque, hashed refresh tokens) for a real refresh flow.
- **New Edge Function `refresh-session`** to exchange a refresh token for a fresh access JWT.
- **Client change** in `supabase-auth.service.ts`: after `flwdsk_authenticate`, call `issue-session`, then drive supabase-js with the returned token via the v2 `accessToken` client option.

### 4.2 `issue-session` skeleton (design, not applied)
```ts
// POST { identifier, password } -> { access_token, refresh_token, expires_at, employee }
import { createClient } from "jsr:@supabase/supabase-js@2";
import { create as signJwt } from "https://deno.land/x/djwt/mod.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const JWT_SECRET = Deno.env.get("SUPABASE_JWT_SECRET")!; // HS256 legacy secret

// 1. resolve identifier -> email (resolve_login_email RPC), then verify:
const { data: employeeId } = await admin.rpc("flwdsk_authenticate", { p_email, p_password });
if (!employeeId) return json(401, { error: "invalid_credentials" });

// 2. sign a GoTrue-shaped JWT
const now = Math.floor(Date.now()/1000);
const access_token = await signJwt({ alg: "HS256", typ: "JWT" }, {
  sub: employeeId, aud: "authenticated", role: "authenticated",
  email, iat: now, exp: now + 60*60, app_metadata: { provider: "flwdsk" },
}, key /* HMAC key from JWT_SECRET */);

// 3. issue opaque refresh token, store SHA-256 hash in flwdsk_auth_refresh_tokens
```
Key facts that make this work: Postgres `auth.uid()` = `current_setting('request.jwt.claim.sub')`; PostgREST accepts any JWT signed with the project JWT secret. Setting `role:'authenticated'` satisfies `auth.role()`.

> ⚠️ Signing-key caveat: this uses the project's **legacy HS256 JWT secret**. If the project has migrated to asymmetric JWT signing keys (ES256/RS256), sign with the current private signing key instead. Confirm under Dashboard → Settings → API → JWT keys before building.

### 4.3 Client wiring (design)
```ts
// supabaseClient.ts — let supabase-js pull the current custom token for every request
export const supabase = createClient(URL, ANON, {
  accessToken: async () => tokenStore.getAccessToken(),   // supabase-js v2 option
});
// login(): after flwdsk_authenticate success, call issue-session, store tokens,
// schedule refresh at exp-60s via refresh-session. getSession() rehydrates from
// the stored token (validated by exp) instead of the app_<ts> placeholder.
```
Token lifecycle is **self-managed** (custom JWTs are outside GoTrue's refresh); the `refresh-session` function + `accessToken` callback cover it.

### 4.4 Rollout
1. Deploy tables + both functions; set secrets. RLS already enforced (6.42).
2. Ship client behind a flag `VITE_AUTH_MODE=jwt`; verify `auth.uid()` populated (§7).
3. Flip default; keep the custom-session fallback for one release, then remove.

### 4.5 Rollback
Set `VITE_AUTH_MODE=legacy` (revert client to today's custom-session path). Functions/tables are inert when unused. No schema loss.

### 4.6 Pros / Cons
- ➕ Single source of truth stays app-level; no `auth.users` duplication; no direct writes to the `auth` schema; clean `auth.uid()`.
- ➖ Requires Edge Function infra + secret management + a self-managed refresh flow (most code of the three).

---

## 5. OPTION B — Make Supabase Auth authoritative (mirror into `auth.users`)

Since both stores use bcrypt, mirror `flwdsk_employees.password_hash` into `auth.users.encrypted_password` and use `signInWithPassword` for real GoTrue sessions.

### 5.1 One-time backfill migration skeleton (design, not applied)
```sql
-- For every active employee lacking an auth.users row, create one with the SAME
-- id, email, mirrored bcrypt password, and confirmed email. Runs as postgres.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
SELECT '00000000-0000-0000-0000-000000000000', e.id, 'authenticated','authenticated',
       lower(e.email), e.password_hash, now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', e.full_name)
FROM public.flwdsk_employees e
WHERE e.deleted_at IS NULL AND e.email IS NOT NULL AND e.password_hash IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.id)
ON CONFLICT (id) DO NOTHING;
-- Also insert matching auth.identities rows (GoTrue expects an identity per user).
```

### 5.2 Keep them in sync — extend `flwdsk_set_password`
```sql
-- inside flwdsk_set_password, after updating flwdsk_employees.password_hash:
UPDATE auth.users
   SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
       updated_at = now()
 WHERE id = p_employee_id;   -- SECURITY DEFINER (postgres) can write auth schema
```

### 5.3 Client change
Make `syncSupabaseAuth` **blocking** during `login()` (await `signInWithPassword`; now guaranteed to match because passwords are mirrored). `getSession()` prefers `supabase.auth.getSession()`. Remove the `app_<ts>` placeholder once verified.

### 5.4 Rollout
1. Apply backfill migration (off-hours; it's additive/idempotent).
2. Deploy `flwdsk_set_password` sync + blocking-login client behind `VITE_AUTH_MODE=supabase`.
3. Verify `auth.uid()` (§7); flip default.

### 5.5 Rollback
Client flag back to legacy. The mirrored `auth.users` rows are harmless if unused; the `flwdsk_set_password` sync `UPDATE` is a no-op when no matching `auth.users` row exists.

### 5.6 Pros / Cons
- ➕ Native GoTrue sessions + refresh; no custom JWT lifecycle; least client code.
- ➖ Duplicates credentials into `auth.users`; requires **direct writes to the `auth` schema** (backfill + identities) which Supabase discourages and which can be brittle across GoTrue upgrades; email-confirmation and identity-row correctness must be exact.

---

## 6. Comparison

| Dimension | A — Custom JWT (Edge Fn) | B — Supabase Auth authoritative |
|---|---|---|
| Credential source of truth | app-level only | duplicated (app + auth.users) |
| Writes to `auth` schema | none | yes (backfill + set_password) |
| New infra | 2 Edge Functions + 1 table + secrets | none (SQL only) |
| Token refresh | self-managed (`refresh-session`) | native GoTrue |
| Backfill required | no | yes (all employees) |
| Brittleness risk | signing-key type must match | GoTrue schema/upgrade coupling |
| Client change size | medium | small |
| Reversibility | flag flip | flag flip |

---

## 7. Verification plan (for whichever option is built)

- **Prove `auth.uid()` is populated:** add a temporary read of `SELECT auth.uid()` via an RPC after login in a scratch build, or check a network request in the browser: PostgREST calls should carry `Authorization: Bearer <jwt>` and RLS-protected reads should succeed for the logged-in employee and fail cross-user.
- **Adversarial (LOCAL DB VERIFIED):** on a local Supabase, log in as an EMPLOYEE and confirm: own expense read OK, other's expense read empty, `PATCH role=ADMIN` on self → rejected by the 6.42 trigger, cross-batch training read empty.
- **Regression:** password change in-app → immediately log out/in → JWT still obtainable (A: re-issue; B: mirrored password matches).
- `npm run typecheck` + `npm run build` green.
- No live claims without a live/local run.

---

## 8. Risks & mitigations
- **Lockout risk (both):** ship behind `VITE_AUTH_MODE` flag with the legacy path intact for one release; never remove the fallback until §7 passes for real users.
- **Signing-key mismatch (A):** confirm HS256 legacy secret vs asymmetric keys before coding.
- **auth schema drift (B):** pin the exact `auth.users` + `auth.identities` shape for the deployed GoTrue version; test backfill on a DB clone first.
- **Email uniqueness/nulls (B):** employees with missing/duplicate emails will fail backfill — pre-audit `flwdsk_employees.email` first.

---

## 9. Recommendation

**Option A (custom JWT via Edge Function)** is the cleaner long-term fit: it honors the deliberate app-level auth design, avoids duplicating credentials and writing to the `auth` schema, and gives exact control of `auth.uid()`. Its cost is the Edge Function infra and a self-managed refresh flow. Choose **Option B** only if adding Edge Functions is undesirable and direct `auth.users` mirroring is acceptable operationally.

## 10. Open questions before implementation
1. Does the project use the **legacy HS256 JWT secret** or **asymmetric signing keys**? (Determines A's signing code.)
2. Is adding **Edge Functions** acceptable in your deploy pipeline? (A requires it.)
3. Do all active employees have **valid, unique emails** in `flwdsk_employees`? (Blocks B's backfill otherwise.)
4. Desired **access-token TTL** and idle/absolute session limits (reconcile with `businessRules.auth.sessionTimeoutMinutes`).
5. Should logout **revoke** server-side (refresh-token table for A) or remain client-only as today?
