# 10 — Performance Review

> Static analysis; no profiling was run against a live instance. Items are flagged as *potential* where confirmation needs runtime data. **No optimisations have been implemented.**

## Large components (frontend)

The four heaviest page files concentrate most of the app's logic and rendering in single components:

| Page | LOC | Concern |
|------|-----|---------|
| `Projects.jsx` | 1,488 | Project list + kanban board + task modals + timer + comments + transfers all in one component |
| `Expenses.jsx` | 1,344 | Claim form + table + approvals + bulk actions + export |
| `Chat.jsx` | 1,107 | Channels + DMs + threads + mentions + file upload |
| `AdminUsers.jsx` | 866 | User table + editors + exports + performance launcher |
| `AdminAttendance.jsx` | 690 | (not routed) |

**Impact:** large components re-render broadly on any state change, are hard to memoise, inflate the initial JS bundle (no code-splitting/lazy routes were observed), and slow development. These are the primary frontend bottlenecks.

## Backend: repeated / unindexed queries

- **Missing indexes on hot query fields.** Only unique constraints create indexes today. Frequent filters have **no secondary indexes**: `Attendance.user`+`date`, `Task.assignee`/`team`/`status`/`dueDate`, `Leave.user`+`status`, `Timesheet.user`+`date`, `Message.channel`, `Expense.user`+`status`. As data grows these become **collection scans**. This is the single highest-value backend improvement.
- **Overdue recomputation.** `getTasks` re-flags overdue tasks on every fetch *and* a nightly cron does the same — duplicated work; the per-request pass adds write load on reads.
- **N+1 / fan-out risk in cron and reports.** `leaveBalanceReset` loops all active users × all leave types doing an upsert each (`O(users × types)` round-trips). `overdueReports` does per-leave DM channel look-ups/creates. `performanceReportController` runs several `Promise.all` queries per user — fine for one user, but there is no caching if invoked repeatedly.
- **Populate breadth.** List endpoints `.populate()` references (users, projects) without field projection in some places, pulling more than needed over the wire.
- **Aggregations done in JS.** e.g. `dashboardController` fetches all pending expenses and sums `amount` in Node rather than using a MongoDB `$group` aggregation. Small now, wasteful at scale.

## Duplicate logic

- **Per-page axios + auth headers.** Every page rebuilds `Authorization: Bearer ${localStorage.getItem('token')}` and `API_BASE_URL` calls; there is no shared API client or interceptor. Token handling, error handling and base-URL logic are duplicated dozens of times (grep shows `localStorage.getItem('token')` scattered across most pages).
- **Repeated UI patterns.** Tables, modals, status badges, and form fields are re-implemented inline in each large page rather than shared (see [reusable-components discussion below]).
- **Date/label logic** (today-start, holiday/weekend labelling, half-day handling) recurs across attendance, leave and report controllers.
- **Export logic** (CSV/XLSX building) is repeated across many controllers rather than a shared exporter utility.

## Real-time considerations

- On socket connect, each client fetches **all** its channels and DMs over REST and joins each room individually. With many channels this is a burst of joins per connect. Acceptable at small scale; watch as channel counts grow.
- A separate 60-second REST heartbeat runs in addition to the socket connection — two liveness mechanisms doing similar work.

## Bundle / build

- No route-level lazy loading (`React.lazy`/`Suspense`) observed — the whole app, including the four giant pages and the marketing site, likely ships in one bundle. Marketing components load even for app users and vice-versa.
- No image optimisation strategy noted for `logo.png` / `hero.png`.

## Potential improvements (NOT implemented — for later phases)

1. Add MongoDB secondary indexes on the hot filter fields listed above.
2. Split the four mega-pages into feature subcomponents; lazy-load routes.
3. Introduce a single API client (axios instance + interceptor) to centralise auth/error/base-URL.
4. Replace read-time overdue writes with reliance on the cron + a computed flag.
5. Move dashboard/report aggregations into MongoDB `$group`/`$facet` pipelines.
6. Add field projections to `.populate()` and list queries.
7. Introduce a data-fetching cache (React Query/SWR) to cut redundant refetches.

These are opportunities only; measuring against real data volumes should precede any change.
