# Technical Improvement Roadmap

This document outlines a structured engineering roadmap to resolve the architectural issues, security vulnerabilities, and performance bottlenecks identified in the audit.

---

## Roadmap Overview

```
Phase 1: Security Hardening  ---> Phase 2: Cron Migration  ---> Phase 3: DI Integration  ---> Phase 4: Component split
(Granular RLS, env keys)         (Port cron to Supabase)        (Refactor direct queries)       (Optimize Batch view)
```

---

## Phase 1: Security Hardening (Immediate Priority)

### Objective
Secure the data layer by implementing role-based Row-Level Security (RLS) policies and removing hardcoded credentials from source files.

### Engineering Tasks
1. **Apply Granular RLS Policies**:
   Replace the permissive `Allow true` policies on all 42 tables with restrictive rules. This ensures that employees can only access their own records, while managers and executives retain full visibility.
2. **Sanitize `SupabaseAuthService`**:
   Remove hardcoded developer emails and fallback passwords. Ensure that all user roles are resolved dynamically from database queries.
3. **Secure API Keys**:
   Remove fallback values for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from source code. Configure the application to throw an error if configuration variables are undefined at build time.

---

## Phase 2: Database & Scheduled Cron Consolidation

### Objective
Eliminate MongoDB dependencies and migrate all background cron jobs to run directly on the active Supabase PostgreSQL database.

### Engineering Tasks
1. **Decommission MongoDB Server**:
   Stop and disable the Express/MongoDB server inside `/server`.
2. **Implement Supabase Scheduled Triggers**:
   Port background jobs (e.g., auto clock-out at 23:59, leave balance resets) to Supabase Edge Functions or pg_cron extensions.
   - *Example auto clock-out query*:
     ```sql
     UPDATE public.flwdsk_attendance_records
     SET status = 'clocked_out', last_clock_out = now()
     WHERE status IN ('present', 'on_break') AND work_date < CURRENT_DATE;
     ```
3. **Standardize Schema Creation**:
   Refactor `reset-and-rebuild.sql` to output tables with the `flwdsk_` prefix directly. This eliminates the need for separate renaming migrations and ensures a consistent database state.

---

## Phase 3: Architectural Cleanup & Repository Integration

### Objective
Enforce the Dependency Injection (DI) and Repository patterns across all UI modules.

### Engineering Tasks
1. **Refactor Direct Database Queries**:
   Locate UI views that import the concrete `supabase` instance directly (e.g., `ExpenseClaims.tsx`, `TrainingCalendar.tsx`, `AnnouncementsBoard.tsx`). Refactor them to query database tables using the registered repository classes resolved via the DI container (`container.resolve`).
2. **Centralize Error Handling**:
   Wrap repository requests in the central `ApiClient` handler to intercept network errors. This prevents unhandled promise rejections and displays friendly offline notices in the UI.
3. **Clean Up Unused Dependencies**:
   Remove unused packages like `axios` and `socket.io-client` from the frontend `package.json` to decrease bundle size.

---

## Phase 4: UI/UX & Component Optimization

### Objective
Improve frontend rendering performance and mobile responsiveness.

### Engineering Tasks
1. **Deconstruct Monolithic Page Components**:
   Split the 3,900+ lines [BatchManagement.tsx](file:///Users/apple/Downloads/flow-desk-main/src/modules/training/pages/BatchManagement.tsx) file into smaller, single-purpose components (e.g., `BatchRoster`, `BatchCalendar`, `GradeSheet`). This confines re-renders to smaller component trees.
2. **Implement Responsive Grids**:
   Refactor complex data tables into responsive grids. These grids should automatically switch to stacked card views on smaller mobile screens.
3. **Add Button Loading States**:
   Update form submission buttons to disable themselves and display loading indicators during asynchronous network requests. This prevents users from clicking buttons multiple times and creating duplicate entries.
