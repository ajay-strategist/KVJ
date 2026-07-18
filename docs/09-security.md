# 09 — Security Review

> Findings are from static code reading. Severity is this reviewer's assessment for an enterprise production context. **No fixes have been applied** — this is analysis only.

## Summary table

| # | Finding | Severity |
|---|---------|----------|
| S1 | No frontend route protection (`App.jsx` registers all routes publicly) | High |
| S2 | JWT stored in `localStorage` and passed in query strings | High |
| S3 | Live secrets present in working tree (`server/.env`, service-account JSONs) | High |
| S4 | Hardcoded seed admin credentials (`admin@flowdesk.com` / `admin123`) | High |
| S5 | 30-day JWT with no refresh/rotation/revocation | Medium |
| S6 | No rate limiting / brute-force protection on auth | Medium |
| S7 | No central input validation / sanitisation library | Medium |
| S8 | No Helmet / security headers; permissive-ish CORS reliance on env | Medium |
| S9 | No CSRF token despite cookie-based auth path | Medium |
| S10 | No object-level authorization checks in several controllers | Medium |
| S11 | No automated security testing / dependency scanning | Low–Med |

## Authentication

- **Mechanism:** JWT (`jsonwebtoken`), 30-day expiry, signed with `JWT_SECRET`. Passwords hashed with **bcrypt** (salt rounds 10) via a Mongoose `pre('save')` hook — good.
- **Token transport:** the server sets an **httpOnly, sameSite=strict** cookie (good) **but also returns the token in the JSON body**, and the SPA stores it in `localStorage` and sends it as a `Bearer` header. `protect` accepts the token from cookie **or** header **or** `?token=` query param.
  - **S2 (High):** `localStorage` tokens are readable by any injected script (XSS), and `?token=` in export URLs (e.g. `AdminUsers` export) leaks tokens into browser history, server logs and referrers. The httpOnly cookie's protection is undermined by also exposing the token client-side.
- **S5 (Medium):** 30-day tokens with no refresh-token rotation and no server-side revocation list mean a stolen token is valid for a month; logout only clears the cookie, not the `localStorage` copy server-side.
- **S6 (Medium):** login has no rate limiting, lockout, or CAPTCHA — brute-force and credential-stuffing are unmitigated.

## Authorization

- **Server-side RBAC is sound in shape:** `protect` → `authorize(...roles)` middleware chains guard routes, and the matrix is mostly sensible (Admin-only writes, Manager read scoping, etc.). This is the app's strongest security aspect.
- **S1 (High):** the **frontend has no route guards**. `App.jsx` renders every page (including `/dashboard/admin`, `/dashboard/users`) with no `ProtectedRoute`/role wrapper. Unauthenticated users can load any route; access control depends entirely on each page reading `localStorage` and on the API rejecting calls. Any page that renders sensitive structure before its API call returns, or that mis-handles a 401, risks leaking UI/state.
- **S10 (Medium):** several controllers authorize by **role** but not always by **ownership/object scope**. For example, some `/:id` mutations (update/delete task, delete leave, delete expense) rely on role plus implicit ownership; confirm that a non-admin cannot act on another user's object by guessing an id. Manager "own team" scoping is enforced in `getUsers` but should be verified consistently across every list/detail endpoint.

## Input validation

- **S7 (Medium):** there is **no validation library** (no Joi/Zod/express-validator). Validation relies on Mongoose schema constraints (enum/required/min) and scattered manual checks. Free-text fields (notes, messages, project client, reasons) are stored without sanitisation.
- **Injection:** NoSQL (Mongoose) with parameterised queries means classic SQL injection does not apply, but **NoSQL operator injection** is possible where raw `req.body`/`req.query` objects are passed into queries without type coercion (e.g. an attacker sending `{"$ne": null}` as a value). Each controller that spreads request input into a query filter should be audited.

## XSS

- Chat messages, comments, notes and names are user-controlled. React escapes by default on render, which mitigates stored XSS **in the SPA**; however, the email templates in `mailer.js` correctly `escapeHtml()` user values — good, and a sign the risk is understood. The main XSS exposure is the `localStorage` token (S2): any XSS becomes account takeover.

## CSRF

- **S9 (Medium):** because a valid session can ride on the **httpOnly cookie** with `credentials: true` CORS, state-changing endpoints are theoretically CSRF-reachable. `sameSite: 'strict'` on the cookie is a strong mitigation, but there is no anti-CSRF token as defence-in-depth, and the mixed cookie/header model muddies the threat model.

## Secrets & configuration

- **S3 (High):** a populated **`server/.env`** exists in the working tree (Mongo URI, `JWT_SECRET`, Google client id/secret/**refresh token**, mail-from, Drive folder id), plus **`config/service-account.json`** and a stray **`services/service-account.json.json`**. Although `.gitignore` lists `.env`, the credentials are physically present in this copy and must be treated as compromised: **rotate all of them** and ensure no secret files are ever shipped in a shared artefact.
- **S4 (High):** `seedAdmin.js` hardcodes `admin@flowdesk.com` / `admin123` and resets the admin password on every run. If ever executed against production, it creates/keeps a trivially guessable admin.
- **S8 (Medium):** no `helmet` (so no HSTS/CSP/X-Frame-Options/etc.), no request-size hardening beyond multer limits. CORS relies on an env-driven allow-list which is reasonable, but the wildcard-ish inclusion of multiple localhost origins should be prod-gated.

## API security

- No rate limiting, no request throttling, no API gateway. No audit logging beyond the attendance `correctionLog`. No central error handler means stack/DB error messages (`error.message`) are returned to clients on 500s — **information disclosure** risk; error detail should be suppressed in production.

## Testing / supply chain

- **S11:** no automated tests and no evidence of `npm audit`/Dependabot/SCA. Dependencies are broadly current, but some declared versions are unusually high/ahead (e.g. React 19.2, Vite 8, ESLint 10) and should be verified as real, non-typo'd, non-malicious packages during the hardening pass.

## What is done well (keep)

- bcrypt hashing with a `pre('save')` hook.
- Clean server-side RBAC middleware.
- httpOnly + sameSite=strict cookie option.
- HTML-escaping in outbound emails.
- Immutable attendance correction audit log — a good pattern to extend elsewhere.
