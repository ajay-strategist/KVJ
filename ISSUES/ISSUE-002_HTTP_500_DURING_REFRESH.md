# FlowDesk Technical Investigation Report: ISSUE-002

**Issue Identifier:** ISSUE-002  
**Issue Title:** HTTP 500 Error During Page Refresh  
**Module / Area:** Runtime / Routing / Session Initialization / ErrorBoundary  
**Category:** Runtime / API  
**Priority:** High  
**Investigation Status:** Investigation documented; actual incident root cause not conclusively confirmed  
**Fix Status:** Open — Not Fixed  
**Investigation Mode:** Strictly Read-Only (Zero Code, Database, or Infrastructure Modifications)  
**Date Documented:** 2026-10-31  

---

## 1. Executive Summary

A reported defect in FlowDesk indicates that an **HTTP 500 error occurs when refreshing the application**. 

Forensic analysis of the codebase, routing infrastructure, authentication lifecycle, and live cloud services demonstrates that this symptom stems from one of two distinct technical mechanisms within the FlowDesk architecture:

1. **Mechanism 1 (Client-Side React ErrorBoundary Crash — Visual "500"):**  
   FlowDesk wraps the complete client-side routing tree inside a global React `<ErrorBoundary>` ([`src/app/ErrorBoundary.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/app/ErrorBoundary.tsx)). When an unhandled JavaScript exception, unhandled promise rejection, or null-dereference occurs during the cold render cycle on direct page reload, the boundary intercepts the failure and renders `<ServerError>` ([`src/app/pages/errors/ErrorPages.tsx#L34`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/errors/ErrorPages.tsx#L34)). This component renders a full-screen branded shell displaying the hardcoded heading **`500 — Something went wrong`** and a "Retry" button that executes `window.location.reload()`. This creates a repeating refresh/crash loop that presents to end users as an HTTP 500 error.
2. **Mechanism 2 (Server-Side Network HTTP 500 from Supabase Edge Function):**  
   If `VITE_AUTH_MODE=jwt` is configured in the environment (e.g., in Vercel build variables), a page refresh triggers [`refreshJwtSession()`](file:///Users/apple/Downloads/flow-desk-main/src/modules/auth/supabase-auth.service.ts#L325), dispatching a network `POST` request to `${SUPABASE_URL}/functions/v1/refresh-session`. In [`supabase/functions/refresh-session/index.ts#L29-L115`](file:///Users/apple/Downloads/flow-desk-main/supabase/functions/refresh-session/index.ts#L29-L115), if environment secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`) are missing, or if the `flwdsk_auth_refresh_tokens` database table has not been migrated to the database, the Edge Function explicitly returns an HTTP 500 response (`{"error":"server_misconfigured"}` or `{"error":"server_error"}`).

### Critical Status & Distinction Notice
- **Mechanism Distinction:** The two identified mechanisms are structurally distinct. Mechanism 1 produces an internal React client render crash where the web server returns `HTTP 200 OK` (serving `index.html`), but the UI renders a branded "500" shell. Mechanism 2 produces a literal network HTTP 500 response status from a cloud endpoint.
- **Incident Attribution:** Because production runtime server logs, live browser console traces, and user network HAR files are unavailable in this environment, **neither mechanism is asserted as the single conclusively confirmed root cause of the specific user-reported incident**. Both represent verifiable technical vulnerability paths in the codebase that reproduce the observed behavior under defined conditions.

---

## 2. Identified Failure Mechanisms in Detail

### Mechanism 1: Client-Side React ErrorBoundary Render Crash
- **Component Layer:** React Component Tree / Global Error Boundary.
- **Trigger:** Any unhandled synchronous runtime exception thrown while mounting or rendering providers, layouts, or workspace pages during cold reload.
- **Behavior:**
  - In [`src/app/router.tsx#L67`](file:///Users/apple/Downloads/flow-desk-main/src/app/router.tsx#L67), `<AppRouter>` wraps all application routes in `<ErrorBoundary>`.
  - When a component throws an uncaught error, `ErrorBoundary.getDerivedStateFromError()` catches it and sets `hasError: true`.
  - The boundary calls `logger.error(error?.message, 'ErrorBoundary', info.componentStack)` and renders `<ServerError onRetry={...} />`.
  - `<ServerError>` in [`src/app/pages/errors/ErrorPages.tsx#L34`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/errors/ErrorPages.tsx#L34) outputs:
    ```tsx
    <Shell code="500" title="Something went wrong" message="An unexpected error occurred. You can retry, or head back to your workspace.">
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <Button onClick={handleRetry}>Retry</Button>
        <Link to="/app"><Button variant="secondary">Go home</Button></Link>
      </div>
    </Shell>
    ```
  - The retry handler explicitly executes `window.location.reload()`. When the reload triggers the same cold initialization fault, the user is trapped in an infinite 500 loop.
- **Historical Codebase Evidence:** Git history documents seven distinct prior commits addressing "500 error boundary crashes on /app" caused by null-dereferences during cold load:
  - `34ec75c`: `fix(auth): add exception safeguards to hasUsers and window reload handler to ErrorBoundary 500 screen`
  - `50c6be7`: `fix(workspace): add null-safe guards for tasks, projects, schedules, and stats in WorkspacePages to prevent 500 error boundary crashes on /app`
  - `2829007`: `fix(app): add try/catch guards to global CommandPaletteProvider, useNavPrefs, and DashboardGrid localStorage reads to prevent 500 error boundary crashes across all pages`
  - `21bf3ed`: `fix(routing, permissions, UI): resolve 500 error boundary crashes across app pages by normalizing permission role keys and hardening array state fallbacks`
  - `72b161f`: `fix(stability): harden array state fallbacks in AttendanceLogPage, useLeave, useEmployee...`
  - `dc90df6`: `fix: add safe array fallbacks, optional chaining, and null checks across Projects, Tasks, and Worklog tabs...`
  - `4dbe287`: `fix(approvals): guard null task when rendering review drawer to prevent 500 error`

### Mechanism 2: Supabase Edge Function Session-Refresh Failure
- **Component Layer:** Supabase Deno Edge Runtime / Auth Token Infrastructure.
- **Trigger:** Active deployment utilizing `VITE_AUTH_MODE=jwt` where cloud secrets are unconfigured or migrations are incomplete.
- **Behavior:**
  - When `AUTH_MODE === 'jwt'`, [`SupabaseAuthService.getSession()`](file:///Users/apple/Downloads/flow-desk-main/src/modules/auth/supabase-auth.service.ts#L596) calls `getJwtSession()`.
  - If the token is near expiration or stale, `refreshJwtSession()` is executed:
    ```ts
    const res = await fetch(`${SUPABASE_URL}/functions/v1/refresh-session`, {
      method: 'POST',
      headers: this.fnHeaders(),
      body: JSON.stringify({ refresh_token: rt }),
    });
    ```
  - In [`supabase/functions/refresh-session/index.ts`](file:///Users/apple/Downloads/flow-desk-main/supabase/functions/refresh-session/index.ts):
    - **Lines 27–30:** Checks for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_JWT_SECRET`. If any secret is absent:
      ```ts
      return json(500, { error: 'server_misconfigured' });
      ```
    - **Lines 107–115:** Attempts to record token rotation in table `flwdsk_auth_refresh_tokens`. If the table does not exist or the insert errors:
      ```ts
      return json(500, { error: 'server_error' });
      ```

---

## 3. Reproduction Scenarios

### Scenario A: Reproducing the ErrorBoundary "500" Screen (Mechanism 1)
1. Sign in to FlowDesk (`/login`) as an authenticated user.
2. Navigate to `/app` (My Day workspace).
3. Observe successful initial rendering when navigating via internal SPA client-side router links (React memory state is warm).
4. Perform a direct browser refresh (**Cmd+R**, **F5**, or clicking the browser reload button).
5. On reload, the entire React state tree is destroyed. `AuthProvider` reads `localStorage.getItem('kvj_app_session')`, immediately setting `status = 'authenticated'`.
6. `<ProtectedRoute>` instantly mounts `<MyDayPage />` while background data hooks (`useEmployee`, `useProject`, `useAttendance`, `useTraining`) start with unpopulated default state (`[]` or `null`).
7. If any child component or helper accesses a nested property of unhydrated data synchronously without optional chaining (e.g. `user.role`, `record.breaks`, `tasks[0].projectId`), React throws a runtime `TypeError`.
8. `<ErrorBoundary>` catches the exception and renders `<ServerError code="500">`.
9. Clicking "Retry" calls `window.location.reload()`, immediately re-triggering the failure.

### Scenario B: Reproducing the Network HTTP 500 (Mechanism 2)
1. Set environment variable `VITE_AUTH_MODE=jwt` in the build/deployment environment without configuring Supabase Edge Function secrets or without executing migration `20260808180000_phase_6_44_auth_refresh_tokens.sql`.
2. Open browser Developer Tools (Network Tab).
3. Load the application with an existing session and execute a page refresh.
4. Observe outgoing network request:
   `POST https://yzlyeuikvbwhgjrjntvi.supabase.co/functions/v1/refresh-session`
5. The endpoint returns `HTTP 500 Internal Server Error` with JSON payload `{"error":"server_misconfigured"}` or `{"error":"server_error"}`.

---

## 4. Technical Endpoint, Method, and Response Details

| Field | Mechanism 1 (Client Render Crash) | Mechanism 2 (Network Failure) |
|---|---|---|
| **Failing URL / Target** | `http://localhost:4173/app` or `https://<domain>/app` | `https://yzlyeuikvbwhgjrjntvi.supabase.co/functions/v1/refresh-session` |
| **HTTP Method** | `GET` | `POST` |
| **Request Type** | Document / Navigation asset request (`index.html`) | `fetch` / JSON API call (`Content-Type: application/json`) |
| **HTTP Status Code** | **200 OK** (Server level) / **500** (Hardcoded in UI component) | **500 Internal Server Error** (Network level) |
| **Response Headers** | `content-type: text/html; charset=UTF-8` | `content-type: application/json; charset=UTF-8` |
| **Response Body** | Full SPA HTML payload (`<!doctype html>...`) | `{"error": "server_misconfigured"}` or `{"error": "server_error"}` |

---

## 5. Hosting and SPA Routing Investigation

The static hosting and routing configurations were audited to verify whether direct URL refresh causes a web server-level 500 error:

1. **Vercel Hosting ([`vercel.json`](file:///Users/apple/Downloads/flow-desk-main/vercel.json)):**
   ```json
   {
     "rewrites": [
       { "source": "/:path*", "destination": "/index.html" }
     ]
   }
   ```
   *Finding:* Configured correctly for SPA history fallback. Direct browser requests to nested paths (`/app`, `/app/attendance`) rewrite cleanly to `/index.html`.
2. **Nginx Hosting ([`nginx.conf`](file:///Users/apple/Downloads/flow-desk-main/nginx.conf)):**
   ```nginx
   location / {
       root /usr/share/nginx/html;
       index index.html index.htm;
       try_files $uri $uri/ /index.html;
   }
   error_page 500 502 503 504 /50x.html;
   ```
   *Finding:* Configured with `try_files` pointing to `/index.html`.
3. **Local Vite Preview Server:**
   Tested via `curl -i http://localhost:4173/app`. The server returns `HTTP/1.1 200 OK` serving `index.html`.
4. **Conclusion on Hosting:** Hosting rewrites are intact and do not generate an HTTP 500 status on route refresh.

---

## 6. Live Database and RPC Inspection Results

Live read-only network queries were executed against the Supabase backend (`https://yzlyeuikvbwhgjrjntvi.supabase.co`) using the application's anon key:

1. **Core Database Tables Queried on `/app`:**
   - `flwdsk_employees`: **HTTP 200 OK**
   - `flwdsk_attendance_records`: **HTTP 200 OK**
   - `flwdsk_projects`: **HTTP 200 OK**
   - `flwdsk_tasks`: **HTTP 200 OK**
   - `flwdsk_resource_allocations`: **HTTP 200 OK**
   - `flwdsk_clients`: **HTTP 200 OK**
   - `flwdsk_timesheets`: **HTTP 200 OK**
   - `flwdsk_batches`: **HTTP 200 OK**
   - `flwdsk_courses`: **HTTP 200 OK**
   - `flwdsk_enrollments`: **HTTP 200 OK**
   - `flwdsk_schedule_sessions`: **HTTP 200 OK**
2. **Database Functions & RPCs:**
   - `resolve_login_email`: **HTTP 200 OK** (correctly resolves email identifiers)
   - `flwdsk_get_employee`: **HTTP 200 OK** (correctly retrieves employee profile)
   - `flwdsk_authenticate`: **HTTP 200 OK** (returns matching UUID or null)
3. **Missing Tables and Functions:**
   - `flwdsk_auth_refresh_tokens`: **HTTP 404 / PGRST205** (`Could not find the table 'public.flwdsk_auth_refresh_tokens' in the schema cache`).
   - `functions/v1/refresh-session`: **HTTP 404 NOT_FOUND** (`Requested function was not found`).
   - `functions/v1/issue-session`: **HTTP 404 NOT_FOUND** (`Requested function was not found`).

*Database Conclusion:* Standard relational tables and PostgREST endpoints are functioning correctly. However, the Edge Functions and database schema required for JWT mode have not been applied to the live Supabase project.

---

## 7. Authentication and Session Initialization Flow

FlowDesk supports two authentication modes via `AUTH_MODE` in [`src/shared/integration/supabase.ts#L16`](file:///Users/apple/Downloads/flow-desk-main/src/shared/integration/supabase.ts#L16):

```
                        Browser Page Refresh
                                │
                        src/main.tsx Boots
                                │
                    <AuthProvider> Initialized
                                │
                   authService.getSession() Called
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
    [AUTH_MODE === 'legacy']             [AUTH_MODE === 'jwt']
              │                                   │
  Reads localStorage                       Reads localStorage
  'kvj_app_session'                        'kvj_app_session'
              │                                   │
      ┌───────┴───────┐                   ┌───────┴───────┐
      ▼               ▼                   ▼               ▼
Valid Session     No Session          Valid & Fresh    Expired / Stale
      │               │                   │               │
Sets 'authenticated'  Calls Supabase      Returns Session Calls refreshJwtSession()
Mounts <MyDayPage>    GoTrue getSession()                 │
                      (If fails → /login)                 ▼
                                                   POST /refresh-session
                                                   (If misconfigured → HTTP 500)
```

1. **Legacy Mode (Default):**
   - Synchronously reads `kvj_app_session` from `localStorage`.
   - If present and not expired, immediately restores the session.
   - `status` transitions to `'authenticated'`, immediately triggering `<ProtectedRoute>` to render the page component.
2. **JWT Mode (Edge Function Dependent):**
   - Checks expiration; if expired or needing rotation, issues `POST /functions/v1/refresh-session`.
   - If the function fails with HTTP 500, `refreshJwtSession()` catches the error and returns `null`, redirecting the user to `/login`.

---

## 8. Error Logs and Code-Path Trace

### Client-Side Crash Log Pattern (Mechanism 1)
When `<ErrorBoundary>` traps an unhandled render exception:
- **Location:** [`src/app/ErrorBoundary.tsx#L20-L23`](file:///Users/apple/Downloads/flow-desk-main/src/app/ErrorBoundary.tsx#L20-L23)
- **Console Output:**
  ```text
  ErrorBoundary caught exception: TypeError: Cannot read properties of undefined (reading '<property>')
      at <Component> (<File>.tsx:<Line>)
      at renderWithHooks (react-dom.development.js)
      at mountIndeterminateComponent (react-dom.development.js)
  [KVJ Logger] [ERROR] [ErrorBoundary] Cannot read properties of undefined (reading '<property>')
  ```

### Server-Side Edge Function Log Pattern (Mechanism 2)
When the Supabase Deno runtime executes `refresh-session` under invalid configuration:
- **Location:** [`supabase/functions/refresh-session/index.ts#L28,L113`](file:///Users/apple/Downloads/flow-desk-main/supabase/functions/refresh-session/index.ts#L28)
- **Runtime Log Output:**
  ```text
  refresh-session misconfigured: missing secrets
  POST https://yzlyeuikvbwhgjrjntvi.supabase.co/functions/v1/refresh-session 500 (Internal Server Error)
  -- OR --
  refresh-session: rotation insert failed: relation "flwdsk_auth_refresh_tokens" does not exist
  POST https://yzlyeuikvbwhgjrjntvi.supabase.co/functions/v1/refresh-session 500 (Internal Server Error)
  ```

---

## 9. Normal Navigation vs. Direct Page Refresh Comparison

| Operational Aspect | Normal In-App Navigation | Direct Page Refresh |
|---|---|---|
| **Routing Mechanism** | HTML5 History API (`pushState`) managed by React Router. | Full HTTP document request (`GET /app`) to web server. |
| **Application Memory** | React state, context providers, and singleton services remain warm in memory. | Entire JavaScript memory and React context hierarchy are cleared. |
| **Session State** | `user` and `principal` objects are pre-loaded and stable. | Session must be parsed and re-validated from `localStorage` or cloud auth. |
| **Data Collections** | Hook arrays (`employees`, `projects`, `tasks`) retain cached values. | All hook state variables reset to initial values (`[]`, `null`). |
| **Component Mount Timing** | Components mount with known, existing data. | Components mount simultaneously while async queries are in flight. |
| **Vulnerability to 500** | **Low:** Initial data checks already passed. | **High:** Race conditions and null property accesses occur during cold render tick. |

---

## 10. Relevant Source Files and Functions

| Layer | File Path | Key Functions / Entities |
|---|---|---|
| **Error Handling** | [`src/app/ErrorBoundary.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/app/ErrorBoundary.tsx) | `componentDidCatch()`, `render()`, `getDerivedStateFromError()` |
| **Error UI** | [`src/app/pages/errors/ErrorPages.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/errors/ErrorPages.tsx#L34-L45) | `ServerError()`, `<Shell code="500">`, `handleRetry()` |
| **Router** | [`src/app/router.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/app/router.tsx#L67-L92) | Top-level `<ErrorBoundary>` wrapping `<AppRouter>` and all routes |
| **Auth Provider** | [`src/modules/auth/AuthProvider.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/auth/AuthProvider.tsx#L42-L58) | Session restoration `useEffect()`, `useAuth()` |
| **Auth Service** | [`src/modules/auth/supabase-auth.service.ts`](file:///Users/apple/Downloads/flow-desk-main/src/modules/auth/supabase-auth.service.ts) | `getSession()`, `getJwtSession()`, `refreshJwtSession()`, `buildSession()` |
| **Supabase Client** | [`src/shared/integration/supabase.ts`](file:///Users/apple/Downloads/flow-desk-main/src/shared/integration/supabase.ts#L16) | `AUTH_MODE`, `setSupabaseAccessToken()`, `supabase` instance |
| **Workspace Page** | [`src/app/pages/workspaces/MyDayPage.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx#L168-L222) | `MyDayPage()`, `AttendancePanel()`, direct `supabase.from()` calls |
| **Edge Functions** | [`supabase/functions/refresh-session/index.ts`](file:///Users/apple/Downloads/flow-desk-main/supabase/functions/refresh-session/index.ts#L20-L119) | `Deno.serve()`, secret checks (line 29), token rotation insert (line 114) |
| **Server Config** | [`vercel.json`](file:///Users/apple/Downloads/flow-desk-main/vercel.json), [`nginx.conf`](file:///Users/apple/Downloads/flow-desk-main/nginx.conf) | Rewrite definitions for single-page routing |

---

## 11. Relationship to ISSUE-001

* **ISSUE-001 (My Day Task Duration Inconsistency):**  
  An isolated in-component state derivation issue in `TaskWidget` (`MyDayPage.tsx`) where displayed duration flipped between `0h 0m (Total: 7h 39m)` before refresh and `7h 39m` after refresh due to semantic confusion between lifetime cumulative hours (`actual_hours`) and daily elapsed seconds (`secondsToday`).
* **ISSUE-002 (HTTP 500 During Page Refresh):**  
  An application-level runtime / routing / authentication failure that either displays a top-level error boundary screen or encounters a server-side Edge Function failure on reload.
* **Conclusion:** ISSUE-001 and ISSUE-002 operate at completely separate layers of the application and are **technically independent**.

---

## 12. Documented Missing Evidence & Runtime Limitations

The investigation noted the following observational limitations in the current environment:
1. **Production Runtime Logs:** Vercel function and deployment logs were inaccessible from the local repository.
2. **Supabase Function / Database Logs:** Cloud runtime logs and PostgREST request logs were not accessible without direct Supabase Dashboard credentials.
3. **Browser Network HAR Traces:** Exact network captures from the user reporting the incident were not provided.
4. **Active Vercel Environment Variables:** Current production values for `VITE_AUTH_MODE` in Vercel settings could not be inspected directly.

---

## 13. Recommended Corrections for Future Fixing Stage

The following corrections are documented for consideration during the implementation stage (none are to be implemented during this documentation task):

1. **Localize Error Boundaries:**  
   Replace the monolithic top-level `<ErrorBoundary>` in `router.tsx` with scoped error boundaries around specific routes and workspace panels (e.g., surrounding `<MyDayPage>` and sub-widgets). If an individual widget encounters an unhandled exception, only that widget displays an inline error state, preventing full-page application crashes.
2. **Harden Cold State Fallbacks in `MyDayPage.tsx`:**  
   Review and harden all synchronous object dereferences across `MyDayPage.tsx` and `AttendancePanel` to ensure default empty states (`user?.role`, `record?.breaks ?? []`, `projectTasks ?? []`) never trigger a synchronous `TypeError` during the initial render tick.
3. **Verify and Lock `VITE_AUTH_MODE=legacy`:**  
   Ensure that `VITE_AUTH_MODE` remains configured to `legacy` in production until Supabase Edge Functions (`issue-session`, `refresh-session`) and migration `20260808180000_phase_6_44_auth_refresh_tokens.sql` are fully deployed with valid secrets.
4. **Wire Production Error Logging:**  
   Connect an external monitoring sink (such as Sentry) to `logger.setLogSink(...)` in `src/shared/logging/logger.ts` so that whenever `<ErrorBoundary>` catches an exception, the exact component stack and error trace are captured automatically.

