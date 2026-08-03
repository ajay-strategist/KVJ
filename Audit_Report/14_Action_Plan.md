# Action Plan & Remediation Strategy

This document provides a prioritized list of engineering tasks to resolve the security, functional, and architectural issues identified in the audit.

---

## 1. Prioritized Action Plan

| Task ID | Task Description | Priority | Difficulty | Impact | Risk Level | Est. Time | Action Steps |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ACT-01** | Apply proper Row-Level Security (RLS) policies to secure the database layer. | **Critical** | Medium | High | Critical | 8 Hours | Replace the permissive `Allow true` policies with role-based checks. |
| **ACT-02** | Remove hardcoded developer profiles and fallback passwords from `SupabaseAuthService.ts`. | **Critical** | Low | High | High | 4 Hours | Fetch all user profiles and roles dynamically from the database. |
| **ACT-03** | Port the auto-clock-out cron job from the MongoDB server to a Supabase Scheduled Trigger. | **High** | Medium | High | High | 6 Hours | Implement a database trigger or Edge Function to auto-clock out dangling sessions at 23:59. |
| **ACT-04** | Update direct `supabase` database queries in UI views to filter for `deleted_at IS NULL`. | **High** | Low | Medium | Medium | 4 Hours | Ensure soft-deleted announcements and expense claims are hidden from views. |
| **ACT-05** | Refactor direct database queries in UI views to route through the central repository layer. | **Medium** | High | Medium | Medium | 16 Hours | Replace concrete `supabase` queries with resolved repository classes. |
| **ACT-06** | Deconstruct the monolithic 3,900+ lines `BatchManagement.tsx` component. | **Medium** | High | High | Low | 12 Hours | Split the component into smaller sub-views (`BatchRoster`, `BatchCalendar`). |
| **ACT-07** | Decommission the legacy MongoDB server files in `/server`. | **Medium** | Low | Low | Low | 2 Hours | Remove the legacy directories after porting active background crons to Supabase. |
| **ACT-08** | Implement responsive container wrappers for complex data tables. | **Low** | Low | Medium | Low | 6 Hours | Ensure timesheet and calendar tables scale down properly on mobile screens. |

---

## 2. Next Steps for Stakeholders

1. **Obtain Approval for Remediation Strategy**:
   The development team should review this action plan and approve the proposed phases.
2. **Execute Phase 1 & 2 (Immediate Security & Functional Patches)**:
   Focus first on securing RLS policies (**ACT-01**, **ACT-02**) and fixing the attendance cron job (**ACT-03**) to prevent further data issues.
3. **Execute Phase 3 (Architectural Cleanups)**:
   Refactor direct queries (**ACT-05**) and remove legacy server files (**ACT-07**) to establish a clean and maintainable codebase.
