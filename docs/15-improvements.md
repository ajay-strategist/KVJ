# 15 — Overall Improvement Opportunities

> **Analysis only.** This is a prioritised catalogue of opportunities to inform the upcoming upgrade. **None of these have been implemented, and no code was changed.** Sequencing is a recommendation, not a commitment.

## Guiding principle

FlowDesk has strong domain coverage on a clean backend but a heavy, under-factored frontend and a soft security posture. The highest-leverage work is to **harden and refactor the foundation before adding OMS breadth**, so new modules land on stable ground.

## Priority 0 — Safety net & secrets (do first)

1. **Rotate and remove all secrets** currently in the tree (`server/.env`, both `service-account.json*` files) and move to a secrets manager; scrub git history if they were ever committed.
2. **Remove/So-secure the hardcoded seed admin**; require a strong password via env at seed time.
3. **Introduce an automated test harness** (start with API integration tests on `authController`, `taskController`, leave/expense flows) to protect the refactor.
4. **Add CI** running lint + tests + build on every change.

## Priority 1 — Security hardening

5. **Add frontend route guards** (`ProtectedRoute` + role-aware routing) so auth is enforced at the router, not just per page.
6. **Stop storing JWT in `localStorage`**; standardise on the httpOnly cookie, and **remove `?token=` query-string auth** from export links (use short-lived signed download URLs instead).
7. **Add `helmet`, rate limiting** on auth, a **central error handler** that suppresses internal messages in production, and **input validation** (Zod/Joi/express-validator) with NoSQL-operator-injection guards.
8. **Introduce refresh-token rotation** and server-side revocation, shortening access-token lifetime from 30 days.
9. **Add object-level authorization checks** (ownership/team scope) consistently across `/:id` mutations.

## Priority 2 — Frontend architecture

10. **Extract a shared API client** (single axios instance, auth + error interceptors, base-URL) and adopt a **data-fetching cache** (React Query/SWR).
11. **Build a component library** (Button, Card, Table, Modal, FormField, StatusBadge, EmptyState) and refactor the four mega-pages (`Projects`, `Expenses`, `Chat`, `AdminUsers`) into feature subcomponents.
12. **Adopt a form library + schema validation** (React Hook Form + Zod) to replace ad-hoc inline validation.
13. **Lazy-load routes** and split the marketing bundle from the app bundle.
14. **Make the layout a real layout route** (shared parent) instead of wrapping `DashboardLayout` inside each page.

## Priority 3 — Data model consistency

15. **Link `Project.client` to the `Client` collection** (reference, with migration) so client analytics/operations become reliable.
16. **Reconcile configurable vs hardcoded labels** — drive `Task.priority`/`status` from `Settings` (or a `DimStatus`-style collection) and remove hardcoded enums.
17. **Retire legacy `Expense` fields** behind a migration; establish a single source of truth per field.
18. **Add secondary indexes** on hot query fields (Attendance user+date, Task assignee/team/status/dueDate, Leave user+status, Timesheet user+date, Message channel, Expense user+status).
19. **Consolidate date/time handling** into a shared util; standardise UTC storage.
20. **Wire or remove the unrouted pages** (`AdminAttendance`, `Timesheets`).

## Priority 4 — Performance & scale

21. Move dashboard/report aggregations into MongoDB **aggregation pipelines**.
22. Add **field projections** to list/populate queries.
23. Replace read-time overdue writes with cron-only flagging.
24. Migrate cron to a **distributed job runner** (BullMQ/Agenda) with locking if scaling horizontally.
25. Add **structured logging + monitoring** (request logs, error tracking, uptime/health metrics).

## Priority 5 — OMS feature breadth (post-foundation)

26. **Granular RBAC + org-wide audit log** (extend the attendance correction-log pattern).
27. **Configurable approval workflows** (expense/leave/task) instead of hardcoded chains.
28. **SSO/OIDC + MFA.**
29. New operations modules per [14](14-missing-features.md): **scheduling/shifts, resource/capacity planning, asset/inventory, procurement/vendor, ticketing/SLA, invoicing/billing** to close the PSA loop.
30. **Notification centre** with preferences and digests; enrich chat (search, reactions, edits).
31. **Dark mode / theming, mobile/PWA, i18n, accessibility, global search.**

## Priority 6 — Analytics / Power BI

32. Stand up an **analytics store** (read replica or warehouse) and an **ETL** that flattens documents and resolves references into a **star schema** with surrogate keys and SCD-2 on `DimUser` (see [13](13-powerbi-readiness.md)).
33. Connect **Power BI** via the warehouse/Atlas connector with a gateway and scheduled/incremental refresh.
34. Add an in-app **report builder** and **scheduled report delivery**.

## What to preserve (do not "improve" away)

- The clean `routes → controllers → models` backend layering.
- The RBAC middleware pattern and bcrypt password handling.
- The real-time (Socket.IO room) and cron infrastructure — genuine assets.
- The immutable attendance **audit log** pattern — extend it, don't replace it.
- The breadth of already-working domain features (recurring tasks, timers, transfers, half-day leave, medical-cert deadlines, leave balances, exports).

---

### Closing note

This completes the **analysis phase**. No application code has been modified, refactored, or optimised, and no files were created other than this documentation set. Awaiting your next instruction before any implementation begins.
