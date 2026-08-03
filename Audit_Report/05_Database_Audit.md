# Database Architecture & Schema Audit

This document reviews the Supabase (PostgreSQL) database design, table structures, indexes, soft-delete handling, and row-level security (RLS) policies.

---

## 1. Database Table Catalog

The active production schema consists of 42 tables prefixed with `flwdsk_`, managed in the public schema of the Supabase database instance.

```
flwdsk_departments        flwdsk_student_records    flwdsk_tasks
flwdsk_employees          flwdsk_enrollments        flwdsk_resource_allocations
flwdsk_attendance_records flwdsk_schedule_sessions  flwdsk_timesheets
flwdsk_work_sessions      flwdsk_assessments        flwdsk_expense_claims
flwdsk_break_records      flwdsk_final_exam_results flwdsk_budgets
flwdsk_leave_records      flwdsk_vouchers           flwdsk_vendors
flwdsk_declared_holidays  flwdsk_certificates       flwdsk_purchase_orders
flwdsk_colleges           flwdsk_referrals          flwdsk_assets
flwdsk_courses            flwdsk_alumni_profiles    flwdsk_salary_structures
flwdsk_batches            flwdsk_clients            flwdsk_travel_requests
flwdsk_chat_channels      flwdsk_projects           flwdsk_milestones
flwdsk_chat_messages      flwdsk_announcements      flwdsk_email_logs
flwdsk_notification_prefs flwdsk_kpi_definitions    flwdsk_saved_reports
flwdsk_system_settings    flwdsk_user_email_configs flwdsk_task_work_sessions
flwdsk_expense_types      flwdsk_audit_logs         flwdsk_attendance_corrections
```

---

## 2. Key Structural Findings & Security Vulnerabilities

### A. Critical Security Risk: 100% Permissive RLS Policies
- **Vulnerability**: In [MASTER_FIX_ALL_DATABASE_SAVING.sql](file:///Users/apple/Downloads/flow-desk-main/supabase/MASTER_FIX_ALL_DATABASE_SAVING.sql#L99-L139), a blanket script enables RLS on all 42 tables but drops all restrictive policies, replacing them with a single permissive policy:
  ```sql
  CREATE POLICY "kvj_full_access_policy" ON public.%I FOR ALL USING (true) WITH CHECK (true);
  ```
- **Security Impact**: Row-Level Security is effectively disabled. Any authenticated user (including regular Employees or Students, if given accounts) can bypass user-level scoping. They can view, edit, or delete any record in any table, including salary structures, expense claims, other employees' profiles, and attendance logs. This exposes the application to data leakage and unauthorized modifications.

### B. Database Duplication & Broken Cron Workflows
- **Finding**: The system contains two databases: Supabase (PostgreSQL) and MongoDB (used by `/server`).
- **Impact**:
  - The React frontend writes to Supabase.
  - The scheduled cron jobs (`autoClockOut.js`, `leaveBalanceReset.js`, etc.) run on the Express server and modify MongoDB.
  - **Dangling attendance logs in Supabase are never auto-closed at 23:59 because the cron job runs on a separate, disconnected MongoDB database. This leads to incorrect cumulative working hours in Supabase attendance logs.**
  - Similarly, annual leave balance resets do not apply to Supabase records.

### C. Schema Drift & Stale SQL Scripts
- **Finding**: The database reset script [reset-and-rebuild.sql](file:///Users/apple/Downloads/flow-desk-main/supabase/reset-and-rebuild.sql) drops all tables and rebuilds them without the `flwdsk_` prefix. However, the application code queries prefixed tables (e.g., `flwdsk_employees`).
- **Impact**: If a developer runs `reset-and-rebuild.sql` followed by helper scripts like `clean-reset-kvj.sql` or `align-user-roles.sql`, they will create a set of un-prefixed tables. This causes data desynchronization and query failures because the frontend expects prefixed tables.

### D. Soft-Delete Leakage
- **Finding**: While the central repository helper [supabase-repository.ts](file:///Users/apple/Downloads/flow-desk-main/src/shared/integration/supabase-repository.ts#L228) marks records as soft-deleted by setting `deleted_at = now()`, several screens (such as `AnnouncementsBoard.tsx` and `ExpenseClaims.tsx`) query the database directly.
- **Impact**: These direct queries lack the filter `.is('deleted_at', null)`. As a result, soft-deleted announcements and expense claims reappear in the UI, leading to logic errors.

---

## 3. Recommended Database Fixes

1. **Implement Proper RLS Scoping**:
   Replace the open `kvj_full_access_policy` with role-based policies.
   - *Example for leave records*:
     ```sql
     CREATE POLICY "leave_employee_scoping" ON public.flwdsk_leave_records
       FOR ALL USING (
         employee_id = auth.uid() OR
         public.current_role() IN ('ADMIN', 'CEO', 'MANAGER')
       );
     ```
2. **Consolidate Scheduled Cron Jobs**:
   Port the cron jobs from MongoDB/Express to Supabase pg_cron or Edge Functions.
   - *Example for auto clock-out in PostgreSQL*:
     ```sql
     UPDATE public.flwdsk_attendance_records
     SET status = 'clocked_out', last_clock_out = now()
     WHERE status IN ('present', 'on_break') AND work_date < CURRENT_DATE;
     ```
3. **Clean Up Database Reset Scripts**:
   Refactor `reset-and-rebuild.sql` to output tables with the `flwdsk_` prefix directly. This eliminates the need for separate renaming migrations and ensures a consistent database state.
