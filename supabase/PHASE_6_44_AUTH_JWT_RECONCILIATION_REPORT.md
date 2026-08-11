# PHASE 6.44 — AUTH SESSION / SUPABASE JWT RECONCILIATION — IMPLEMENTATION REPORT

**Date:** 2026-08-08
**Selected architecture:** Option A — custom Supabase-compatible JWT minted by an Edge Function.
**Verification tier:** `STATIC VERIFIED` (source authored + `tsc` + `build`). **No `LOCAL DB VERIFIED` / `PRODUCTION VERIFIED`** — no local Supabase stack, live DB, or deployed Edge Functions were available; no live JWT/RLS test was executed and none is claimed.

---

## 1. Executive Summary
The app intentionally stores credentials in `flwdsk_employees.password_hash` (app-level auth), so most employees have no `auth.users` row and `signInWithPassword` cannot mint a JWT — leaving `auth.uid()` NULL and the 6.30/6.40/6.42 RLS only partially effective (Phase 6.43 finding). This phase adds a **secure server-side bridge**: an `issue-session` Edge Function verifies app credentials and signs a Supabase JWT whose `sub` = the employee id; the browser drives PostgREST with it via the supabase-js v2 `accessToken` option, so `auth.uid()` reliably equals `flwdsk_employees.id`. A `refresh-session` function provides rotation + revoke, and a DB trigger revokes refresh tokens on password change. Everything is behind a build-time flag `VITE_AUTH_MODE` (**default `legacy`** — no behavior change until opted in). No RLS was weakened; no `auth.users` backfill; no employee password hash touched. `tsc` PASS, `build` PASS.

## 2. Existing Authentication Architecture
- Credentials: `flwdsk_employees.password_hash` (bcrypt, `pgcrypto`), verified by `flwdsk_authenticate` (SECURITY DEFINER). Source of truth — unchanged.
- Session: custom `kvj_app_session` in localStorage; `getSession()` preferred it; the real Supabase sign-in was a best-effort background call.
- `flwdsk_set_password` updates only the app-level hash (never `auth.users`).

## 3. Problem Confirmed (re-verified from disk this phase)
- supabase-js is **v2.110.7** → supports the `accessToken` option (v2.62+). Confirmed in `node_modules` that setting it (a) drives all PostgREST/Storage/Realtime requests with the returned token and (b) **throws** on any `supabase.auth.*` access (bundle line 698). This dictated the client design and the guards in §8.
- No Edge Functions existed; no `config.toml`. Env is `VITE_*` with a publishable anon key.

## 4. Architecture Selected
Option A. Source of truth stays app-level; the Edge Function is the only component that can mint identity, and it derives identity solely from server-side credential verification.

## 5. Authentication Flow
```
credentials → issue-session (verify via flwdsk_authenticate) → sign JWT{ sub=employee.id }
→ browser stores token → supabase-js accessToken → PostgREST → auth.uid() = employee.id → RLS
```
Reload: token seeded from localStorage into the client at module load; `getSession()` (jwt branch) validates expiry and calls `refresh-session` if stale. Logout: best-effort server revoke + local clear.

## 6. JWT Claim Design
| Claim | Value | Notes |
|---|---|---|
| `sub` | `employee.id` (server-verified) | becomes `auth.uid()`; never client-supplied |
| `role` | `'authenticated'` | Postgres role for PostgREST — **never** an app role |
| `aud` | `'authenticated'` | |
| `iat`/`exp` | now / now + `ACCESS_TTL` (default **3600s / 1h**) | conservative; refresh via `refresh-session` |
| `email` | employee email | informational |
| `app_metadata.provider` | `'flwdsk'` | non-authoritative |

**Signing:** HS256 with the Supabase **legacy JWT secret** (`SUPABASE_JWT_SECRET`, function secret). ⚠️ If the project uses **asymmetric signing keys** instead, `supabase/functions/_shared/jwt.ts` must sign with the current private key — verify under Dashboard → Settings → API → JWT keys before enabling jwt mode (Open Question, §21).
App authorization roles are **not** encoded in the JWT: `is_training_admin()` and all RLS helpers read `flwdsk_employees.role` by `auth.uid()`, so a forged/edited role claim cannot escalate.

## 7. Edge Function Implementation
- `supabase/functions/issue-session/index.ts` — validates body; `resolve_login_email` → `flwdsk_authenticate` (service role) → loads safe profile columns (no `password_hash`) → checks `status='active'` → signs JWT → issues opaque refresh token (stores only its SHA-256 hash) → returns `{access_token, expires_at, refresh_token, employee}`.
- `supabase/functions/refresh-session/index.ts` — `{refresh_token}`: validates hash/expiry/revocation, re-checks employee active, **rotates** (insert new, revoke old), returns a fresh access token. `{action:'revoke'}`: idempotent logout revoke (always 200, non-probeable).
- `supabase/functions/_shared/jwt.ts` (Web Crypto HS256 signer, opaque token + SHA-256) and `_shared/cors.ts`.
- **Deploy public** (they authenticate by app credentials, not a Supabase JWT): `supabase functions deploy issue-session --no-verify-jwt` (same for `refresh-session`). Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (+ optional TTLs).

## 8. Client Session Integration
- `src/shared/integration/supabase.ts` — `AUTH_MODE`; token store (`setSupabaseAccessToken`/`getSupabaseAccessToken`, seeded from `localStorage['kvj_jwt']`); in jwt mode the client is built with `accessToken: async () => currentAccessToken` (null → supabase-js falls back to the anon key, verified — no `Bearer null`).
- `src/modules/auth/supabase-auth.service.ts` — jwt branches for `login` (→`issue-session`), `getSession` (restore/refresh), `refresh`, `logout` (revoke+clear); helpers `issueJwtSession`/`refreshJwtSession`/`getJwtSession`/`applyJwtTokens`. Because `supabase.auth.*` throws under the `accessToken` option, the remaining GoTrue call sites were guarded: `requestPasswordReset`/`resetPassword` (app-level reset instead), `deleteUser` (actor id from app session), `bootstrapInitialAdmin` (explicit server-side-only error). `updateUserPassword` was already try/catch-wrapped and routes through `flwdsk_set_password` — safe. Legacy mode paths are unchanged.

## 9. Refresh / Expiration
Access token TTL 1h (default, configurable). Refresh tokens: opaque, hashed-at-rest, default TTL 7 days, **rotated** on every refresh and **revoked** on logout / password change / inactive account. `getJwtSession` refreshes when the access token is within 60s of expiry, so the session does not silently die at the TTL boundary.

## 10. Logout
jwt mode: best-effort `refresh-session {action:'revoke'}` (revokes the refresh token server-side) then clears `kvj_jwt` + `kvj_refresh` + `kvj_app_session` and the in-memory token. UI-logged-in and JWT states cannot diverge because both derive from the same cleared store.

## 11. Password Change Behavior
`flwdsk_set_password` is **unchanged** (6.36 hardening intact). A new `AFTER UPDATE OF password_hash` trigger (`flwdsk_revoke_refresh_on_pwd_change`) revokes that employee's refresh tokens on any password change, so no new access token can be minted from a stale refresh token. **Known limitation:** an already-issued access JWT is stateless and remains valid until its ≤1h `exp` (standard JWT tradeoff); reducing `ACCESS_TTL` shrinks that window.

## 12. RLS Compatibility
No RLS policy was added, removed, or weakened. The new `flwdsk_auth_refresh_tokens` table has RLS **enabled with no policies** (only `service_role`/Edge Functions can touch it) plus a guard that strips any blanket policy. `employee_id = auth.uid()` ownership semantics are preserved and now actually satisfied.

## 13. Security Threat Model
- **Client cannot choose identity:** `sub`/`role` are server-derived from `flwdsk_authenticate`; a client-supplied id/role is ignored. ✓
- **No privilege via claims:** role claim is fixed `'authenticated'`; authorization stays DB-derived. ✓
- **Secrets:** service-role + JWT secret live only in function env; never in `VITE_*`/bundle (grep-verified). ✓
- **No leakage:** `password_hash` never returned; no password/token/secret logged (grep-verified). ✓
- **Refresh abuse:** tokens opaque + hashed at rest; rotated; revocable; expiring. ✓
- **CORS:** `*` is safe here (no cookies; auth via body + anon apikey); doc recommends restricting to app origin in prod. ✓
- **Enumeration:** generic `invalid_credentials`; revoke path always 200. ✓

## 14. Files Modified / Added
- **Added:** `supabase/functions/issue-session/index.ts`, `supabase/functions/refresh-session/index.ts`, `supabase/functions/_shared/jwt.ts`, `supabase/functions/_shared/cors.ts`, `supabase/migrations/20260808180000_phase_6_44_auth_refresh_tokens.sql`.
- **Modified:** `src/shared/integration/supabase.ts`, `src/modules/auth/supabase-auth.service.ts`, `.env.example`.

## 15. Database Migrations
`20260808180000_phase_6_44_auth_refresh_tokens.sql` — creates `flwdsk_auth_refresh_tokens` (RLS-locked, service_role-only), an active-token index, a blanket-policy guard, and the revoke-on-password-change trigger. Additive & idempotent. Does **not** touch `flwdsk_set_password`, `auth.users`, or any password hash. **STATIC VERIFIED — authored, not executed.**

## 16. Tests Performed
- `npx tsc --noEmit` → **PASS** (exit 0). App tsconfig `include: ["src"]` — Deno Edge Functions correctly out of app typecheck scope.
- `npm run build` → **PASS** (470 modules).
- Security greps (secrets/leakage/`sub` origin) → clean.
- No `npm test` script beyond typecheck/build in this repo.

## 17. TypeScript Result — PASS.
## 18. Production Build Result — PASS (470 modules, ~2.9s).

## 19. Live DB Verification Status — **STATIC VERIFIED only.**
Not executed (no live/local DB or deployed functions): JWT-issue, `auth.uid()` population, ownership isolation, refresh/rotation, revoke-on-logout, revoke-on-password-change. §24-style checks are prepared for when an environment is available.

## 20. Rollback Procedure
- Fastest: unset `VITE_AUTH_MODE` (or set `legacy`) and rebuild → client reverts to the exact prior flow; the Edge Functions/table are inert when unused.
- Full: additionally remove the two functions and the `20260808180000` migration (drop trigger, function, table). No employee data or password hash was modified, so rollback is lossless.

## 21. Known Limitations / Open Questions
1. **Signing key type must be confirmed** (HS256 legacy secret vs asymmetric). If asymmetric, adjust `_shared/jwt.ts`. This is the one item that could make Option A require a signing-code change before it works live.
2. Stateless access JWT can't be revoked before `exp` (≤1h) — mitigated by short TTL + refresh revocation.
3. `createUser` in jwt mode inserts an employee row but cannot set an app password (the legacy `signUp` throws and is caught); an admin must set the initial password via user management (`flwdsk_set_password`). Pre-existing behavior; note for rollout.
4. Self-service email password recovery is not available in jwt mode (credentials aren't in `auth.users`); admin-driven reset is the mechanism.
5. Not yet run against a live DB (§19).

## 22. Final Verdict
**CONDITIONAL PASS.** The custom-JWT bridge is implemented to spec with the security invariants intact (server-derived identity, no client-chosen `sub`/role, secrets server-side, no RLS weakening, legacy path preserved behind a default-off flag), and `tsc`/`build` pass. It is **conditional** because: (a) it is `STATIC VERIFIED` only — live JWT/RLS/refresh verification is pending an environment; and (b) the JWT signing-key type must be confirmed (§21.1) before enabling `VITE_AUTH_MODE=jwt` in production. No security control was weakened; nothing was committed.
