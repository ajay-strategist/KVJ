# Antigravity Prompt Pack — KVJ Analytics

Run these **in order**, one per session. Review the diff and run the app before
moving to the next. Every prompt assumes the shared context block below.

---

## ⚠️ Read this first (paste with every prompt, or point Antigravity at this file)

### SHARED CONTEXT — the real stack

> This repo is **React 19 + Vite + TypeScript + Tailwind v4**.
> There is **NO FastAPI and no MongoDB in the live app**. Ignore the `server/`
> folder (a dormant legacy Express/Mongo app) and `src/pages/*.jsx` + `legacy/`
> (the old frontend). Do not add to them.
>
> The backend is **Supabase (Postgres)**, adopted **per module**.
>
> **Architecture — follow it exactly, do not invent a parallel one:**
> - **DI container**: `src/core/registry.ts`. Everything is resolved by token.
> - **Repository pattern**: each module has `X.repository.ts` (interface +
>   token), `mock-X.repository.ts` (in-memory, extends `MemoryRepository`) and
>   `supabase-X.repository.ts`. Wiring lives in `src/app/bootstrap.ts`.
> - **Per-module Supabase cutover**: `usesSupabase('<module>')` in
>   `src/config/feature-flags.ts` requires BOTH `integrations.supabase` and that
>   module's own flag. Only turn a module's flag on **after** its tables exist.
> - **Service layer**: `X.service.ts` returns `Result<T>` (`Ok`/`Err` from
>   `src/core/result.ts`). Business logic lives here, never in components.
> - **Hooks**: `src/modules/<m>/hooks/useX.ts`. **Pages**: `src/modules/<m>/pages/`.
> - **Permissions**: 4 roles — `ADMIN`, `CEO`, `MANAGER` (all full control via
>   the `'*'` wildcard) and `EMPLOYEE` (self-scoped). Use `can()` /
>   `usePermissions()` / `<Can>` / `<ProtectedRoute>` from
>   `src/shared/permissions`. **Never write inline `role === '...'` checks.**
>   Backend enforcement is Supabase **RLS** (`is_full_control()`,
>   `current_role()`), see `supabase/migrations/20260720000000_roles_and_rls.sql`.
> - **Adding a page** = route in `src/app/router.tsx` + entry in
>   `src/shared/navigation/navigation.ts` + icon path in `ICON_PATHS` in
>   `src/shared/layout/AppShell.tsx`.
> - **Business rules**: every business constant lives in
>   `src/config/business-rules.ts`. Never hardcode a business number elsewhere.
> - **Styling**: use the semantic CSS variables in
>   `src/shared/design-system/tokens.css` (`--bg-surface`, `--text-primary`,
>   `--brand`, …). **Never raw hex.** There are **three themes** (light, dark,
>   `hud`/Cockpit) — anything you build must work in all three.
> - **UI kit**: `src/shared/ui/` (`Card`, `DataTable`, `Drawer`, `Tabs`,
>   `Button`, `StatCard`, …) and `src/shared/forms/form.tsx`
>   (`TextField`, `SelectField`, `DatePickerField`, `FileUploadField`, …).
>   Reuse these — do not create duplicates.
> - **Migrations**: add `.sql` files to `supabase/migrations/` using the
>   existing timestamp-prefix naming. Include RLS policies for every new table
>   (full-control roles see all; employees see only their own rows).
>
> **Definition of done for every prompt:** `npm run typecheck`, `npm run lint`
> (0 errors) and `npm run build` all pass, and the affected screens render in
> the browser with no console errors.

### Confirmed product decisions (do not re-litigate)

| Decision | Value |
|---|---|
| Roles | 4: Admin / CEO / Manager (full control + full visibility), Employee (self-scoped) |
| Leave types | Exactly 2: `Leave`, `Medical Leave` (certificate mandatory) |
| Work types | `Office`, `Training`, `Marketing` (Class + Supervision collapsed into Training) |
| Training clock-in | Must select the allocated **batch**; the batch supplies the college/Organization |
| Missed clock-in | **Trainings only**; CEO & Manager approve; back-fills that day |
| GPS | Captured **automatically** at clock-in (already working) — keep as is |
| Mail | **SMTP, Outlook**, per-employee, `From` = that employee's own address |
| Student key | **Register No. = phone number** (voucher Excel matches on this) |
| Self travel | Amount = **KM × rate**; rate is common for Car/Bike, **CEO-editable** |
| Task completion | Employee marks complete → *pending review* → only Manager/CEO closes it |
| Fiscal year | Starts **1 April** (accumulated leave / holiday-worked) |
| Late / Early / Break | Tracked on **Office ("Work") days only** |
| Hidden modules | Analytics suite, Procurement, Assets, Budgets, Payroll, Email Center, Reminders |
| Visible | Chat Rooms **and** Announcements |

### Already built — DO NOT REDO
Roles (4-role model + RLS migration) · nav trim / page feature-flags · work
types · Courses Catalog (icon + fields removed) · Leaves (2 types + mandatory
certificate) · Approvals Queue (inline Accept/Reject) · Cockpit theme ·
Supabase `.env` + per-module cutover.

---

## Prompt 1 — Apply the database schema

```
Read the SHARED CONTEXT in docs/21-antigravity-prompts.md first.

The Supabase project is connected (.env has VITE_SUPABASE_URL and
VITE_SUPABASE_ANON_KEY) but the database is EMPTY — no tables exist.

Two migrations already exist and must be applied first, in order:
  supabase/migrations/20260718000000_employee_attendance.sql
  supabase/migrations/20260720000000_roles_and_rls.sql

Then write NEW migrations for the modules that have a supabase-*.repository.ts
but no tables yet: training, project, finance, communication, analytics.
Derive each table's columns from the corresponding *.repository.ts interfaces
so the repository code compiles against real tables.

Every table must have:
  - the universal entity contract (uuid id, created_at/updated_at,
    created_by/updated_by, deleted_at/deleted_by soft delete)
  - RLS enabled, with a full-control policy using public.is_full_control()
    and an employee self-scope policy where the row belongs to a person.

Do not turn on any flag in featureFlags.supabaseModules yet.
Show me the migration files and the exact order to run them.
```

## Prompt 2 — Cut employee / attendance / leave over to Supabase

```
Read the SHARED CONTEXT first. The schema from Prompt 1 is now applied.

Verify the tables exist, then switch the first three modules from mock to
Supabase by setting in src/config/feature-flags.ts:
  integrations.supabase = true
  supabaseModules.employee = true
  supabaseModules.attendance = true
  supabaseModules.leave = true

Leave training/project/finance/communication/analytics on mock until their
tables are verified.

Then replace MockAuthService with Supabase Auth so auth.uid() is real and RLS
actually applies — employees.id must equal auth.users.id. Keep the IAuthService
interface unchanged so no UI changes are needed. Seed the four demo users
(admin@/ceo@/manager@/employee@kvj.test) with the correct role values.

Confirm the Employee Directory, Attendance and Leave screens read and write
real Supabase data, and that an Employee cannot see another employee's rows.
```

## Prompt 3 — Employee Mail Configuration (SMTP send-as)

```
Read the SHARED CONTEXT first.

Build per-employee mail configuration so every email the app sends on a
person's behalf goes FROM that person's own Outlook address.

- A Mail Configuration screen where an employee configures their OWN mailbox;
  Admin/CEO/Manager can configure it for anyone. This is the ONLY feature in
  this settings area — do not add others.
- Provider is Outlook/SMTP. Store host, port, username and an APP PASSWORD.
  Credentials must be ENCRYPTED AT REST server-side (Supabase Vault/pgsodium),
  never returned to the browser, never logged, never committed. The client only
  ever sees "configured / not configured" plus a masked username.
- Design the auth method to be swappable: basic SMTP now, OAuth2/XOAUTH2 later
  (Microsoft 365 tenants often disable basic SMTP AUTH).
- Expose ONE shared backend service: "send email as <employee>". Every later
  module (coordinator confirmations, daily/final training reports, voucher
  mails) must call this — build it now.
- Add a "Send test email" button that verifies the credential and reports the
  real error message on failure.

Show me the screen, the storage model and the shared send-as service.
```

## Prompt 4 — Attendance: clock-in/out + missed-clock-in approval

```
Read the SHARED CONTEXT first.

Rework the Attendance Control Panel and its backend.

Clock in / out:
- Clock In, Start Break, End Break, Clock Out. Track status (Working / On Break
  / Clocked Out), work type, clock-in time, live elapsed time, break duration.
- Work type is Office, Training or Marketing (businessRules.attendance.workTypes).
  If Training, the user must pick from the batches allocated to THEM; the batch
  supplies the Organization/college on the log.
- GPS is already captured automatically at clock-in — keep that behaviour and
  store the coordinates on the record. Show the captured location in the panel.

Missed clock-in approval (TRAINING ONLY, not Office):
- If an employee could not clock in due to an emergency they raise an
  Attendance Approval request capturing batch, date and reason.
- CEO and Manager approve it (use the permission helper, not role checks).
- On approval it BACK-FILLS the training attendance record for that day.
- These requests appear in the existing Approvals Queue, which already renders
  inline Accept / Reject buttons — wire into that, don't rebuild it.
```

## Prompt 5 — My Attendance Log

```
Read the SHARED CONTEXT first.

Build "My Attendance Log", matching the existing Google Sheet exactly.

Row columns: Date, Name, Holiday (e.g. "Sunday"), Organization, Class/Work,
Mode (Offline/Online), Start Time, End Time, Duration, Other Expenses, Note
(e.g. "Late"), Break, Holiday Worked.

Special rows: Sundays and holidays render as shaded non-working "Holiday" rows;
leave days render as a highlighted "Leave" row.

Summary block: No. of Working Days in the Month, Days to be Worked, No. of
Leaves, Holiday Worked, Working Days, Late Reporting, Early Leaving, Break,
Average Break Time, Over Break Time, Overall Avg Duration, Total Expenses, and
average duration per Organization.

Accumulated block: from the fiscal year start (1 April) and the Joined Date —
Accumulated Leave and Holiday Worked.

Training summary per institution: number of Physical vs Online sessions and
Physical vs Online hours.

Role visibility: CEO / Admin / Manager see EVERYONE; Employees see only
themselves (enforce with the permission helper AND rely on RLS).

Filters: Last Month, Current Month, Last 1 Year (EXCLUDING the current month),
Custom Range (start + end date), and Employee (only shown to CEO/Admin/Manager).

Late Reporting / Early Leaving / Break apply to Office "Work" days only.
```

## Prompt 6 — Announcements & Holidays

```
Read the SHARED CONTEXT first.

- Admin, CEO and Manager can create announcements; they surface on My Day and
  on the existing Announcements Board.
- Admin, CEO and Manager can add and update public holidays.
- Holidays feed BOTH the attendance log and the training calendar: holiday
  dates render as shaded non-working rows, exactly like the Sunday rows.

Use the permission helper for the write gates. Add the migration + RLS.
```

## Prompt 7 — Batches: Training Details (tab 1)

```
Read the SHARED CONTEXT first.

Restructure Batches into two tabs: "Training Details" and "Training Calendar".
Build Training Details now.

A training record is keyed by College + Course + Year + Batch + Program
(Course = the college class group e.g. "2 CS"; Program = the subject taught
e.g. "Data Analytics").

Fields: College, Course, Year, Batch, Program, Start Date, Trainer,
Completed Date, Status, Completion %, Client name, Month,
Certificate Printed / Delivered / Delivered Date.

Process steps — make the STEP SET CONFIGURABLE (defined once, applied to all
trainings). Each step is Yes / No / or a custom value, and BLANK means the step
is NOT completed (three states). Default steps, in order:
  Marketing, Converted, Registration, Students Name, Initial Works, Photos,
  Training, Videos, Feedback, Mock Test, Final Exam, Retest, Retest Amount,
  Report, Invoice, Payment, Certificate Printed, Certificate Delivered.
"Converted" records whether a marketing lead became an actual training.

Also on Training Details:
- Total Expense for the training, computed by rolling up expense lines tagged
  to this batch.
- College Coordinators: one or MORE per training.
- People: a Manager (overall handler) and a Trainer; any employee may be
  assigned if required.
- Reports: a reusable Send button for a Daily Report (after sessions start) and
  a Final Report. Sendable multiple times. Must send via the send-as service
  from Prompt 3, so the mail comes from the sender's own address.
```

## Prompt 8 — Batches: Training Calendar (tab 2)

```
Read the SHARED CONTEXT first.

Build the Training Calendar tab. It currently lives in a Google Sheet shaped as:
Date | Day | Holiday | then ONE COLUMN PER TRAINER, each cell holding that
trainer's assigned training for that day.

Requirements:
- Grid: rows are dates (with Day and Holiday), columns are trainers.
- A cell allocates a specific batch from the Training Details list (dropdown).
  A cell may also be "Leave", or a free-text one-off event (e.g. "SIMS
  Presentation", "STC"). One trainer may cover multiple batches in a day
  (e.g. "B1 and B2").
- A BLANK cell means the trainer is not allocated -> they default to Office,
  and this must be shown clearly as unallocated.
- Sundays/holidays render as shaded non-working rows.
- The CURRENT DAY's row is highlighted.
- Previous-year history, MONTH-WISE: past trainings grouped by month showing
  College, Course, Program etc., for contacting colleges again.

Allow entering trainings directly in the app. If syncing with the existing
Google Sheet, import through the Sheets API behind a feature flag.
```

## Prompt 9 — Students, Assessments, Vouchers, Student Attendance

```
Read the SHARED CONTEXT first.

Extend Training Details with student management, and add an "All Students" tab.

Students:
- Bulk-upload student details into a training. Each student has a
  REGISTER NO. which is their PHONE NUMBER — this is the matching key.
- On upload, email a confirmation to the training's coordinator(s) via the
  send-as service.
- Track each student's progress inside the Training Details panel.

Student attendance (per batch):
- Capture DAILY student attendance per session. This is separate from employee
  clock-in attendance and ties to the uploaded student list.

Assessments & eligibility:
- Multiple assessment types per training. Pass mark is 84% for EVERY assessment
  (put it in business-rules).
- Eligibility is configurable: the trainer selects WHICH assessments count
  (sometimes only 1 or 2). A student is eligible only if they clear every
  selected assessment.
- Allow sorting students by any assessment's marks.

Vouchers:
- "Send Voucher" with multi-select (e.g. select all Eligible students).
- Manual round-trip: download student data from Training Details -> we upload
  it to Voucher Inventory and assign Voucher IDs there -> we re-upload the
  returned Excel, and the app matches rows back to students BY REGISTER NO.
  (phone) and stores the Voucher ID. Assigning the Voucher ID is itself a
  training process step.
- "Send Voucher" emails each selected student their Voucher ID via the send-as
  service.

All Students tab (across all trainings):
- Lists every student with Final Exam Status: Passed / Failed / Not Attended.
- DEFAULT view hides Passed and shows the actionable list (Failed + Not
  Attended). Filtering to "Not Attended" shows only those. A "Show all" option
  reveals everyone including Passed.
```

## Prompt 10 — Voucher Inventory

```
Read the SHARED CONTEXT first.

Build Voucher Inventory — the central voucher ledger.

- Set / update the balance voucher number (opening or available count).
- Remaining = opening balance - vouchers allocated to students + vouchers
  unallocated.
- Provide an UNALLOCATE action that removes a voucher from a student and
  returns it to the available balance, updating the calculation.
- Keep it in sync with voucher assignment happening inside trainings (Prompt 9).

Show the ledger UI and the balance calculation.
```

## Prompt 11 — Projects & Tasks

```
Read the SHARED CONTEXT first.

Build Projects & Tasks as two tabs. Map onto the EXISTING Task Board / Project
Catalog / Timesheets nav entries rather than adding new nav.

Projects tab:
- Projects contain tasks. Track task work hours and the project's total hours.
- A project is assigned to an employee; a Manager can be the project supervisor.
- Show client name and task due dates.
- Support adding additional members and assigning them tasks.
- Inside a project show its Work Log, newest first: Date, Task, Description,
  Supervisor, Review Status, Current Status, Duration.

Tasks tab:
- Office tasks, including RECURRING tasks and ONE-DAY-ONLY tasks. A one-day-only
  task appears ONLY on that day.
- A "Show Work Log" button opening a table, newest first: Date, Task,
  Description, Project, Supervisor, Review Status, Current Status, Duration.

Completion approval:
- When an employee marks a task Completed it becomes "pending review" and
  Manager + CEO are notified.
- The task only truly completes when a Manager/CEO marks it completed.

Timing:
- Hours come from a SINGLE start/pause task timer — the same timer used on
  My Day. One timing source across My Day, Tasks and Project work logs.
```

## Prompt 12 — Expenses

```
Read the SHARED CONTEXT first.

Rework Expenses with two types: Office and Training.

Office expense: Date, Person, Expense Type, Amount, Receipt.
Training expense: Date, Person, Expense Type, Batch, Amount, Receipt — the
trainer picks from the batches available to them.

Both types also carry: No. of Persons (an amount may cover more than one
person) and a Note.

Self Travel (both types):
- Choose Bike or Car and enter KM.
- Amount AUTO-CALCULATES as KM x rate. Do not let the user type the amount.
- The rate per km is COMMON to both expense types and is editable by the CEO
  only. Put the rates in business-rules.

Claim rollup: Total = sum of line amounts; Balance = Total - Advances.

Buttons: ONLY "Add Expense" and "Submit for Claim". No other buttons.
Approval: CEO and Manager can approve in BULK, from the Attendance tab as well
as the Expense tab.
```

## Prompt 13 — My Day dashboard (build last)

```
Read the SHARED CONTEXT first. Build this LAST — it aggregates the modules
above and must call their existing APIs, never duplicate their logic.

Assemble My Day with:
- Quick actions: Add Task, Submit Expense, Request Leave.
- Stat cards: Attendance Status, Hours Worked Today, Tasks Due, Hours of this
  Month, Attendance %.
- Attendance Control Panel: current status, work type (Office/Training/
  Marketing — if Training show the allocated batches), clock-in time, live
  elapsed time, break duration and the captured GPS location. Reuse the
  Attendance module.
- Today's Tasks with timeline: each task can Start and Pause and shows hours
  worked on that task today. Reuse the single shared task timer.
- Upcoming Tasks & Events for the next 3 days, at the BOTTOM of the page.
- Announcements from the Announcements module.
```

---

## Known issues worth fixing at some point

1. **Inline styles block theming.** Components such as `StatCard` hardcode
   colours in JSX, so themes cannot fully reach them (the green Clock In button
   ignores the Cockpit palette). Move these to token-driven classes — this is
   the prerequisite for any real light/dark UI-UX upgrade.
2. **Mock repositories are unseeded.** Only `employee` has seed data; training,
   project, finance, communication and analytics seed `[]`, which is why those
   screens show "Nothing here yet".
3. **Secrets hygiene.** The GitHub PAT embedded in the git remote should be
   revoked, and the password shared in chat rotated.
