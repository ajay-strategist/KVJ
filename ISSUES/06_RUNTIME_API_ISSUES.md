# Category 06: Runtime & API Issues

This register contains application crashes, server-side HTTP errors, routing failures, and unhandled client exceptions identified in FlowDesk.

---

## Active Issues in Category

| Issue ID | Title | Module | Priority | Investigation Status | Fix Status | Detailed Document |
|---|---|---|---|---|---|---|
| **ISSUE-002** | HTTP 500 Error During Page Refresh | Runtime / API | High | Investigation documented; actual incident root cause not conclusively confirmed | Open — Not Fixed | [`ISSUE-002_HTTP_500_DURING_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-002_HTTP_500_DURING_REFRESH.md) |

---

## Issue Summary: ISSUE-002

* **Issue ID:** `ISSUE-002`
* **Title:** HTTP 500 Error During Page Refresh
* **Module:** Runtime / API
* **Priority:** High
* **Status:** Open — Not Fixed
* **Observed Problem:** Application displays an HTTP 500 error or branded full-screen 500 error page when refreshing `/app`.
* **Identified Failure Mechanisms:**
  1. **Mechanism 1 (Client-Side ErrorBoundary Crash):** Monolithic `<ErrorBoundary>` catches unhandled JavaScript exceptions or null-dereferences during cold mount and renders `<ServerError code="500">` with a "Retry" button that executes `window.location.reload()`, looping the crash.
  2. **Mechanism 2 (Supabase Edge Function Failure):** In `AUTH_MODE=jwt`, `refreshJwtSession()` calls `POST /functions/v1/refresh-session`. If server secrets or the `flwdsk_auth_refresh_tokens` database table are missing, the Edge Function returns `HTTP 500 {"error":"server_misconfigured"}` or `HTTP 500 {"error":"server_error"}`.
* **Incident Attribution Notice:** Neither mechanism is asserted as the single conclusively confirmed root cause of the specific user incident due to inaccessible production runtime logs.
* **Detailed Report:** Refer to [`ISSUE-002_HTTP_500_DURING_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-002_HTTP_500_DURING_REFRESH.md).

