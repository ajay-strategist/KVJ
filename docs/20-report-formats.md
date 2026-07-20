# 20 — KVJ Report Formats (from CEO's existing Excel reports)

Reference specs for two per-employee, per-period reports the platform must reproduce.
Derived from the CEO's current Excel sheets. **No salary is computed** — these are
work-hours + expense summaries the CEO uses to decide pay manually.

---

## A. Attendance / "Payroll" Report (per employee, per month)

> Despite the "payroll" name, this computes **hours, days, leaves and expense totals** — not salary.

### Detail table (one row per day)
Columns: **Date · Name · Holiday · Organization · Class/Work · Mode · Start Time · End Time · Duration · Other Expenses · Note · Break · Holiday Worked**

Row behaviour:
- **Class day:** Organization set (e.g. "Christ Irinjalakkuda"), Class/Work = `Class`, Mode = `Offline/Online`, fixed org timing (e.g. 08:30–17:00), Duration = 8:30:00.
- **Sunday / holiday:** Holiday = `Sunday`, Class/Work = `Holiday`, greyed, no times.
- **Leave:** Class/Work = `Leave` (shown red), no times/duration.
- **Marketing / other org:** Organization = college, Class/Work = `Marketing`, actual times (e.g. 10:00–15:00).
- **Office work:** Organization = `Office`, Class/Work = `Work`, **actual** clock times (e.g. 09:49–17:31), Duration = 7:42:12, may carry `Late` note + a **Break** fraction.

### Summary panel
- **Input:** Start Date, End Date, Employee Name.
- **Summary:** No. of Working Days in Month · No. of Days to be Worked · No. of Leaves · Holiday Worked · **Working Days** (= to-be-worked − leaves) · Late Reporting · Early Leaving · Break · Average Break Time · Over Break Time.
- **Accumulated (since joining):** period Start Date · Joined Date · Accumulated Leave · Holiday Worked · Overall Avg Duration · **Total Expenses (₹)**.
- **Organization × Avg Duration** table (avg class/work hours per organization).

### Class/Supervision Summary (per institution)
Institution × **No. of Physical** (Class / Supervision / Total) · **No. of Online** (Class) · **Duration of Physical (hr)** (Class / Supervision / Total) · **Online (hr)** (Class).
Example: Christ Irinjalakkuda → 22 physical classes, 0 supervision, 22 total, 187 physical hours.

**✅ CONFIRMED:** Late Reporting / Break apply **only to Office `Work` days** (expected office
hours). `Class`/Training days use the **organisation's fixed timing** (e.g. 08:30–17:00) and are
never flagged Late.

---

## B. Expense Summary (per employee, per period)

### Header
Start Date · End Date · Employee Name · **Total (₹)** · **Advances (₹)** · **Balance (₹) = Total − Advances**.

### Detailed table (one row per expense line)
Columns: **Date · Person · Location · Expense Type · Amount · No. of Person · Self Travel Mode · KM · Note**

- **Expense Types:** `Self Travel`, `Morning Tea`, `Lunch`, `Evening Tea`, `Dinner`, `Other`.
- **Self Travel:** has **Mode** (Bike/Car) + **KM**, and **no entered amount** —
  **Amount is DERIVED = KM × ratePerKm[mode]** (rates CEO-editable; ✅ seed **Bike ₹5/km, Car ₹10/km**).
  Example: 16 km on Bike → 16 × 5 = **₹80**.
- **Food/Other:** ✅ each person's expense is entered as a **separate line** going forward, so
  Amount is that single line's total and **No. of Person defaults to 1**.
- Note optionally carries context (e.g. "Home to College", "College to Home").

Encoded in `src/config/business-rules.ts` → `finance.expenseTypes`, `finance.selfTravel`,
`finance.supportsAdvances`.

---

---

## C. Task / Work Report (per employee or project, per period) — ✅ NEW (confirmed)

Shows **tasks COMPLETED within the selected Start Date → End Date**, with hours.

### Header
Start Date · End Date · Employee (and/or Project) · **Total Tasks Completed** · **Total Hours**.

### Detail table (one row per completed task)
Columns: **Completed Date · Task · Project · Assignee · Estimated Hours · Actual Hours · Status**
- Only tasks whose completion date falls in the range.
- **Actual Hours** come from the task's work sessions / time logs.
- Roll-ups: total tasks, total actual hours; optionally grouped by project or by employee.

Encoded in `src/config/business-rules.ts` → `reports.taskReport`.

---

## Reporting module — ✅ CONFIRMED structure
Split into **separate report screens** (not one "payroll" report), all run over a custom
Start→End date range:
1. **Attendance Report** — section A above.
2. **Expense Report** — section B above.
3. **Task / Work Report** — section C above.

## Implications for the build
- **Finance module:** expense entry auto-computes Self Travel = KM × rate, rolls Total,
  subtracts Advances → Balance, and produces the Expense Report.
- **Attendance module:** produces the monthly per-employee summary (working days, leaves,
  holiday-worked, break/late for Office days only, accumulated figures, org avg duration,
  class/supervision institution breakdown).
- **Project/Task module:** produces the Task/Work Report (completed tasks + hours in range).
- These are three "consulting-grade" report outputs (design-system doc 17 §18). No salary math.
