# Category 04: Data & Database Issues

This register tracks Supabase PostgreSQL schema anomalies, missing migrations, PostgREST query defects, and data persistence errors in FlowDesk.

---

## Active Issues in Category

| Issue ID | Title | Module | Priority | Investigation Status | Fix Status | Detailed Document |
|---|---|---|---|---|---|---|
| — | *No active standalone issues currently assigned to this category* | — | — | — | — | — |

---

## Category Scope & Verification Findings

This category encompasses:
* Database schema parity between local migrations (`supabase/migrations/`) and live Supabase Cloud instances.
* Row Level Security (RLS) policy execution and permission denied (`42501`) errors.
* RPC procedure stability (`flwdsk_get_employee`, `flwdsk_authenticate`, `resolve_login_email`).

*Note:* Database aspects of `ISSUE-002` (missing `flwdsk_auth_refresh_tokens` table under JWT mode) are cross-referenced in [`06_RUNTIME_API_ISSUES.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/06_RUNTIME_API_ISSUES.md) and [`ISSUE-002_HTTP_500_DURING_REFRESH.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUE-002_HTTP_500_DURING_REFRESH.md).

*Master index: [`ISSUES_REGISTER.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUES_REGISTER.md).*

