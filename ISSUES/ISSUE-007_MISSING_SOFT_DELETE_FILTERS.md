# FlowDesk Technical Issue Specification: ISSUE-007

**Issue Identifier:** ISSUE-007  
**Issue Title:** Missing Soft-Delete (`deleted_at IS NULL`) Filter on Direct Supabase Queries  
**Module / Area:** Application-Wide UI & Data Access  
**Category:** Data Integrity / Query Safety  
**Priority:** Medium  
**Investigation Status:** Code Vulnerability Confirmed  
**Fix Status:** Open — Not Fixed  
**Date Documented:** 2026-10-31  

---

## 1. Executive Summary

Certain frontend UI components query Supabase tables directly using the JavaScript SDK client (`supabase.from(...)`) but omit the standard soft-delete clause `.is('deleted_at', null)`. Consequently, rows that have been marked as soft-deleted by administrative actions or repositories can inadvertently reappear in list views, summary cards, and dropdown selectors.

---

## 2. Root Cause & Technical Details

* **Origin:** Direct PostgREST queries written in UI components without routing through the repository abstraction layer that automatically applies soft-delete filtering.
* **Affected Areas:**
  - `AnnouncementsBoard.tsx` (direct table fetch)
  - `ExpenseClaims.tsx` (secondary query loops)
  - Inline attendance queries in `AttendanceLogPage.tsx`
* **Risk:** Soft-deleted employee records, expense claims, or announcements surfacing to end users, causing operational confusion and referential validation failures.

---

## 3. Recommended Remediation

1. Audit all `supabase.from(...)` call sites across the codebase.
2. Route data queries through standardized repository classes that inject `.is('deleted_at', null)`.
3. Add PostgREST views or row-level filtering policies if server-side enforcement is desired.

