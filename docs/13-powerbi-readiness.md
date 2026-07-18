# 13 — Power BI Readiness Report

## Current reporting capability

FlowDesk's reporting today is **operational, not analytical**:

- **In-app dashboards:** the admin dashboard aggregates live counts (active users, projects, today's attendance, pending leaves/expenses and their totals). Computed in Node on each request.
- **Per-user performance reports:** `performanceReportController` aggregates attendance, approved leaves, expenses, trainer logs and holidays over a date range (JSON + XLSX).
- **CSV/XLSX exports** on nearly every module (users, tasks, projects, timesheets, expenses, leaves, attendance, trainer logs).

There is **no BI layer**: no Power BI dataset, no data gateway, no star schema, no incremental-refresh feed, no read replica or warehouse. Any Power BI work today would connect **directly to the operational MongoDB** and reshape data inside Power Query — workable for a proof of concept, not for production analytics.

## Database quality for analytics

**Strengths**
- Rich, timestamped transactional data across all domains (`createdAt`/`updatedAt` on nearly every collection).
- Clear grain on the key fact-like collections: Attendance (per user/day), Timesheet (per user/task/day), Leave, Expense, TrainerLog.
- Reference/lookup collections already exist (LeaveType, ExpenseType, College, Course, Team, Client, PublicHoliday) — natural dimension seeds.

**Weaknesses for BI**
- **Document model, not relational.** Power BI's connector for MongoDB (or via the Atlas SQL/BI Connector) will need flattening of embedded arrays (`Attendance.breaks[]`, `Task.timeLogs[]`, `Task.timer{}`, `correctionLog[]`, `Message.mentions[]`).
- **References are ObjectIds, resolved only at query time.** Joins must be reconstructed in Power Query / the model layer; there are no enforced keys to lean on.
- **Denormalisation drift:** `Project.client` is free text, not a `Client` key — breaks clean client-dimension joins. Task status/priority labels are configurable strings, risking inconsistent category values over time.
- **No surrogate keys or slowly-changing-dimension handling** — e.g. a user's role/team/salary changes overwrite in place, so historical attribution ("who was in which team when") is lost.
- **Mixed date semantics** (some UTC `setUTCHours`, some string dates, some `startTime`/`endTime` as strings in TrainerLog) complicate a clean date dimension.

## Normalisation assessment

The data sits at roughly **2NF–3NF in intent** but with document-store denormalisation and a few integrity gaps (Client string, legacy expense fields, embedded arrays). It is **not currently shaped as a dimensional (star) model**.

## Proposed fact / dimension mapping (target, not built)

**Candidate fact tables**
- `FactAttendance` — grain: one row per user per day (hours, breaks, label, location).
- `FactTimesheet` / `FactWorkLog` — grain: user × task × day (hours, cost).
- `FactLeave` — grain: leave request (days, nature, status, dates).
- `FactExpense` — grain: expense claim (amount, category, status, dates).
- `FactTrainerActivity` — grain: trainer log (duration, type, mode).
- `FactTask` — grain: task snapshot/close (cycle time, overdue, status).

**Candidate dimensions**
- `DimUser` (with SCD-2 for role/team/grade/salary history), `DimTeam`, `DimProject`, `DimClient`, `DimLeaveType`, `DimExpenseType`, `DimCollege`, `DimCourse`, `DimBatch`, `DimDate` (conformed), `DimStatus`.

## Data-warehouse readiness

**Not yet warehouse-ready.** To make FlowDesk genuinely Power BI-ready (target-state, **not** part of this analysis phase):

1. Stand up an analytics store separate from the operational DB (a read replica, Atlas Data Federation / SQL interface, or an ETL into a relational warehouse such as Postgres/Synapse/BigQuery).
2. Build an ETL/ELT that flattens embedded arrays and resolves ObjectId references into surrogate keys.
3. Fix the Client relationship (key, not string) and freeze category domains (statuses/priorities) or map them via a dimension.
4. Add SCD handling for User attributes to preserve history.
5. Introduce a conformed Date dimension and normalise date/time storage.
6. Expose the model to Power BI via the warehouse or the Atlas Power BI/ODBC connector, with scheduled/incremental refresh through a gateway.

## Bottom line

The **raw material for good analytics is present** — the transactional coverage is broad and timestamped. But the app is currently at the "export to Excel" stage of BI maturity. Reaching production Power BI requires a modelling and ETL layer that does not exist yet; direct-to-Mongo Power BI is viable only for prototypes.
