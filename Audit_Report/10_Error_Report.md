# Error Report & Bug Diagnostic

This document compiles a detailed list of runtime errors, edge cases, validation failures, and logic defects identified in the KVJ Analytics application.

---

## 1. High-Impact Bugs & Logic Errors

### A. Orphaned Attendance Sessions (Broken Cron Job)
- **Issue**: The auto-clock-out cron job runs on the Express server and targets MongoDB, while the React frontend writes to Supabase.
- **Impact**: Users who forget to clock out remain active indefinitely in Supabase. This corrupts cumulative working hours (e.g., logging 500+ hours for a single session) and distorts monthly attendance reports.
- **Edge Case**: If an employee clocks in on Friday and forgets to clock out, their session remains open over the weekend, multiplying their recorded work hours.

### B. Mismatched Database Schemas
- **Issue**: Running the reset script `reset-and-rebuild.sql` creates tables without prefixes. However, the frontend repositories query tables with the `flwdsk_` prefix (e.g., `flwdsk_employees`).
- **Impact**: All frontend operations fail with "table does not exist" database errors.

### C. Missing Live Chat Updates (Broken WebSockets)
- **Issue**: The Express server is configured with Socket.io, but the React frontend does not initialize a Socket.io client. Instead, it queries chat messages directly from Supabase via HTTP.
- **Impact**: The chat interface does not update in real-time. Users must manually refresh the page or toggle channels to view new messages.

### D. Soft-Delete Leakage in Direct Queries
- **Issue**: UI components that query `supabase` directly (e.g., `AnnouncementsBoard.tsx` and `ExpenseClaims.tsx`) do not filter for `deleted_at IS NULL`.
- **Impact**: Soft-deleted announcements and expense claims reappear in the UI, causing logic errors.

---

## 2. Validation & Exception Handling Defects

### A. Unhandled Network Failures on Direct Queries
- **Issue**: Centralized error mapping and network loss recovery are handled in `api-client.ts`. However, components that query `supabase` directly bypass this client.
- **Impact**: If the database is unreachable, these direct queries throw unhandled promise rejections. This crashes the component tree instead of showing a friendly offline warning.

### B. Form Validation Blocks
- **Issue**: Validation checks in form controllers (such as batch creation or student profile updates) trigger browser-native `alert()` boxes.
- **Impact**: Native alerts pause JavaScript execution, which can disrupt active state loops and degrades the user experience.

---

## 3. Recommended Bug Fixes

| ID | Issue | Recommended Solution | Severity | Priority |
| :--- | :--- | :--- | :---: | :---: |
| **BUG-01** | Dangling clock-ins in Supabase. | Port the auto-clock-out cron job from the Express server to a Supabase Scheduled Trigger. | High | High |
| **BUG-02** | Schema mismatch after database reset. | Refactor `reset-and-rebuild.sql` to create tables with the `flwdsk_` prefix directly. | High | High |
| **BUG-03** | No real-time chat updates. | Implement Supabase Realtime listeners (`supabase.channel().on(...)`) in the chat hooks. | Medium | Medium |
| **BUG-04** | Soft-deleted records appearing in UI. | Update direct `supabase` queries in UI views to include the `.is('deleted_at', null)` filter. | Medium | High |
| **BUG-05** | Unhandled database query crashes. | Refactor direct database queries in UI views to use the registered repository classes. | Medium | High |
