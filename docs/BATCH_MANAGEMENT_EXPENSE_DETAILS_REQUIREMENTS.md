# FlowDesk — Batch Management Expense Details
## Modification Requirements Documentation

| Metadata Field | Value |
| :--- | :--- |
| **Work Package** | Batch Management → Expense Details Drawer / Module |
| **Document Version** | 1.0.0 |
| **Date Recorded** | 05-11-2026 |
| **Status** | Requirements Collection Completed — Documentation Only |
| **Implementation Status** | NOT STARTED |
| **Authorization** | Documentation Only (No Code Changes Authorized) |
| **Target Component** | `src/modules/training/components/BatchExpenseDetailsDrawer.tsx` |

---

## 1. OBJECTIVE & GOVERNANCE

This document records the complete, approved requirements for the upcoming modification of the **Batch Management → Expense Details** component in FlowDesk.

### Mandatory Governance Rules
- **Documentation Only:** Record requirements faithfully.
- **Zero Code Modification:** Do not implement, modify, refactor, or delete any application code at this stage.
- **Zero Database Operations:** No migrations, table alterations, or production data changes.
- **Zero Repository Mutation:** No commits, branch creation, or GitHub pushes.
- **Zero Deployment:** Do not trigger builds or production deployments.
- **Implementation Precondition:** Implementation will commence only after the complete FlowDesk modification scope (including remaining Expense Review and Tutorial System specifications) has been finalized and stakeholder authorization is explicitly granted.

---

## 2. COMPREHENSIVE REQUIREMENTS REGISTER (REQ-01 to REQ-15)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ REQUIREMENT MATRIX AT A GLANCE                                              │
├────────┬──────────────────────────────────────────┬──────────────┬──────────┤
│ ID     │ Requirement Title                        │ Nature       │ Status   │
├────────┼──────────────────────────────────────────┼──────────────┼──────────┤
│ REQ-01 │ Total Students                           │ Preserve     │ APPROVED │
│ REQ-02 │ Batch Workhours and Man-hours            │ Calculation  │ APPROVED │
│ REQ-03 │ Total Expenses                           │ Preserve     │ APPROVED │
│ REQ-04 │ Cost Per Student                         │ Preserve     │ APPROVED │
│ REQ-05 │ Remove Cost Per Workhour KPI             │ Component-   │ APPROVED │
│ REQ-06 │ Remove Average / Claim KPI               │ Component-   │ APPROVED │
│ REQ-07 │ Expense Category Distribution Redesign   │ Redesign     │ APPROVED │
│ REQ-08 │ Trainer & Submitter Allocation Expansion │ Enhancement  │ APPROVED │
│ REQ-09 │ Average Expense Per Day Calculation      │ Calculation  │ APPROVED │
│ REQ-10 │ Delivery Timeline Correction             │ Modify / Del │ APPROVED │
│ REQ-11 │ Detailed Expense Log Preservation        │ Preserve     │ APPROVED │
│ REQ-12 │ Remove Travel & Mileage Tab              │ Tab Removal  │ APPROVED │
│ REQ-13 │ Add Work Hours Tab                       │ Tab Addition │ APPROVED │
│ REQ-14 │ Add Expense Calculation Tab              │ Tab Addition │ APPROVED │
│ REQ-15 │ Employee-wise Category Distribution      │ Chart Add    │ APPROVED │
└────────┴──────────────────────────────────────────┴──────────────┴──────────┘
```

---

### REQ-01 — Total Students KPI

- **Classification:** Confirmed Requirement / Existing Functionality to Preserve.
- **Description:** Retain the existing **Total Students** KPI in the Expense Details header banner.
- **Data Source:** Batch Student Assignment (`flwdsk_training_batches.no_of_students` / enrolled student roster linked to batch).
- **Business & Calculation Rules:**
  - Obtain the student count directly from the students/users assigned during Batch Creation.
  - Expense Details must display the actual student count associated with that batch.
  - **Prohibition:** Do NOT independently calculate, approximate, or infer student count from expense records, receipts, or attendance records.
  - Batch Creation, Batch Management card, and Expense Details must display identical, consistent student counts.

---

### REQ-02 — Batch Workhours and Man-hours

- **Classification:** Confirmed Calculation Rule / Core Logic Refinement.
- **Description:** Clearly bifurcate **Batch Workhours** (effective training delivery duration) from **Man-hours** (accumulated employee work hours). They must remain distinct metrics.

#### A. Batch Workhours (Effective Delivery Time)
Batch Workhours represents the *actual elapsed training delivery duration* of the batch, **not** the sum of all employee hours. Overlapping sessions must be merged.

- **Scenario A (Simultaneous Trainers):**
  - Trainer A: 09:00 AM – 03:00 PM (6 hours)
  - Trainer B: 09:00 AM – 03:00 PM (6 hours)
  - **Batch Workhours = 6 Hours.** (Overlapping interval is counted once).
- **Scenario B (Sequential Trainers):**
  - Trainer A: 09:00 AM – 01:00 PM (4 hours)
  - Trainer B: 01:00 PM – 04:00 PM (3 hours)
  - **Batch Workhours = 7 Hours.** (Non-overlapping contiguous intervals accumulate).
- **Scenario C (Different Clock-Out Times):**
  - Trainer A: 09:00 AM – 04:00 PM (7 hours)
  - Trainer B: 09:00 AM – 12:00 PM (3 hours)
  - **Batch Workhours = 7 Hours.** (An employee leaving early does not reduce the batch delivery duration when another employee continued delivery).
- **Calculation Algorithm:**
  $$\text{Batch Workhours} = \sum [\text{Merged Disjoint Training Intervals}]$$

#### B. Total Man-hours (Accumulated Employee Effort)
Man-hours must be calculated by summing the actual individual work duration of all participating employees on that batch.

- **Scenario Example:**
  - Trainer A: 6 Hours
  - Trainer B: 6 Hours
  - **Total Man-hours = 12 Hours.**
- **Calculation Algorithm:**
  $$\text{Total Man-hours} = \sum_{i=1}^{n} (\text{Employee } i \text{ Work Hours for Batch})$$

---

### REQ-03 — Total Expenses KPI

- **Classification:** Confirmed Requirement / Existing Functionality to Preserve.
- **Description:** Retain the **Total Expenses** KPI card in the header banner.
- **Data Source:** Actual approved expense claim records linked to the batch (`flwdsk_expense_claims`).
- **Business & Calculation Rules:**
  - Display the sum of all expense amounts associated with the batch.
  - Include all applicable expense classifications (Training Expenses, Travel, Food, Accommodation, Materials, etc.) submitted for that batch.
  - **Prohibition:** Do NOT derive, estimate, or modify total expenses based on attendance, student counts, or employee workhours.
- **Formula:**
  $$\text{Total Expenses} = \sum (\text{Batch Expense Amounts})$$

---

### REQ-04 — Cost Per Student KPI

- **Classification:** Confirmed Requirement / Existing Functionality to Preserve.
- **Description:** Retain the **Cost Per Student** KPI card in the header banner.
- **Data Source:** `Total Expenses` (REQ-03) and `Total Students` (REQ-01).
- **Business & Calculation Rules:**
  - Use the batch's actual student count from Batch Creation.
  - Use actual batch expense totals.
  - If `Total Students = 0`, display `—` or `₹ 0.00` safely without divide-by-zero crashes.
- **Formula:**
  $$\text{Cost Per Student} = \frac{\text{Total Expenses}}{\text{Total Students}}$$

---

### REQ-05 — Remove Cost Per Workhour KPI

- **Classification:** Component Removal.
- **Description:** Completely remove the **Cost Per Workhour** (Cost / Hour) KPI card from the Expense Details header banner.
- **Scope of Removal:**
  - Remove KPI card component (`label="Cost / Workhour"`).
  - Remove its associated calculation and display from the Batch Expense Details section.
  - **Prohibition:** Do not unnecessarily modify or delete unrelated hourly calculations elsewhere in the application (e.g. employee billing or analytics).

---

### REQ-06 — Remove Average / Claim KPI

- **Classification:** Component Removal.
- **Description:** Completely remove the **Avg / Claim** (Average per submission) KPI card from the Expense Details header banner.
- **Scope of Removal:**
  - Remove KPI card component (`label="Avg / Claim"`).
  - Its display and calculation are not required in Batch Expense Details.

---

### REQ-07 — Expense Category Distribution Redesign

- **Classification:** UI Redesign / Component Replacement.
- **Description:** Replace the existing segmented progress bar and category cards with a modern dual-chart rectangular container.
- **Container Specification:** A single unified rectangular card container hosting **TWO side-by-side BAR CHARTS**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏷️ EXPENSE CATEGORY DISTRIBUTION (Single Container)                         │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ CHART 1: Category-wise Expense Amount│ CHART 2: Percentage Distribution     │
│                                      │                                      │
│ Travel      ████████████ ₹ 12,500   │ Travel      ████████████ 45.2%       │
│ Food        ████████     ₹  8,200   │ Food        ████████     29.7%       │
│ Materials   ████         ₹  4,100   │ Materials   ████         14.8%       │
│ Stay        ███          ₹  2,850   │ Stay        ███          10.3%       │
│                                      │                                      │
│ Total: ₹ 27,650                      │ Total: 100%                          │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

#### Chart 1: Category-wise Expense Amount
- **X/Y Elements:** Expense Category vs. Category Amount in INR (₹).
- **Labels:** Readable category names, explicit amounts (e.g., `₹ 12,500`), and category claim counts.
- **Summary:** Displays overall Total Expense Amount.

#### Chart 2: Expense Percentage Distribution
- **X/Y Elements:** Same Expense Categories vs. Percentage of Total Expenses (%).
- **Labels:** Explicit percentage badges (e.g., `45.2%`).
- **Validation:** Sum of percentages must equal **100%**.
- **Formula:**
  $$\text{Category Percentage} = \frac{\text{Category Expense Amount}}{\text{Total Expenses}} \times 100$$

#### Shared Layout Rules
- Both charts must maintain identical category sort ordering (e.g. highest amount to lowest).
- Responsive side-by-side presentation (stacks gracefully on narrow mobile viewports).
- Clean, accessible typography with branded palette.

---

### REQ-08 — Trainer & Submitter Allocation Enhancement

- **Classification:** Existing Functionality Preserved + Interactive Feature Added.
- **Description:** Preserve the existing **Trainer & Submitter Allocation** grid layout while adding drill-down expense inspection per employee.
- **New Feature:** Add a small **"View"** / **"Expand"** button inside each employee's allocation card.
- **Behavior on Click:**
  1. Expand an inline detail panel directly beneath that employee's card (or accordion drawer).
  2. Filter and display all batch expense claims submitted by that specific employee.
  3. Include columns/fields: Expense Category, Amount (₹), Date, Description / Purpose, Receipt link/status.
  4. Ensure only expenses belonging to that specific employee are rendered.
  5. Provide a toggle to collapse the section back to summary view.
- **Data Protection:** Read-only inspection; do NOT modify, delete, or reassign underlying expense records.

---

### REQ-09 — Average Expense Per Day Calculation

- **Classification:** Confirmed Calculation Rule / Data Source Realignment.
- **Description:** Retain the **Average Expense Per Day** (Avg / Day) KPI card, but strictly derive training days from **actual Attendance Records**.
- **Data Source:** Attendance Records (`flwdsk_attendance_records` + `flwdsk_work_sessions`) linked to the batch.
- **Calculation Rules:**
  - Multiple employees attending on the same date count as **ONE Training Day**.
  - Multiple sessions by one or more employees on the same date count as **ONE Training Day**.
  - **Prohibitions:**
    - Do NOT use expense submission dates as training days.
    - Do NOT infer training dates from batch creation date, start date, or calendar schedule estimates.
- **Formula:**
  $$\text{Average Expense Per Day} = \frac{\text{Total Batch Expenses}}{\text{Unique Attendance-based Training Dates}}$$
- **Consistency:** Unique training dates calculated here must match the training days displayed in Batch Workhours and Timeline.

---

### REQ-10 — Daily Expense & Workhours Delivery Timeline

- **Classification:** Modification & Column Removal.
- **Description:** Preserve the existing Daily Timeline table structure, columns, and data, with two specific updates:

#### A. Components to Remove
- Remove the **Cost Per Hour** (Cost / Hour) column from the timeline table.

#### B. Components to Correct / Add
- The **Date** column must reflect **actual Training Dates** derived from attendance records.
- Display dates when employees actually clocked in and conducted training for this batch.
- Retain Delivery Hours, Day Expense, Claimants, and Expense Items columns.
- Ensure training days displayed match the unique training days in REQ-09.

---

### REQ-11 — Detailed Expense Log Preservation

- **Classification:** Strict Preservation (No Changes Allowed).
- **Description:** The existing **Detailed Expense Log** tab (`id: 'log'`) is explicitly excluded from modification.
- **Mandate:**
  - NO redesign.
  - NO column changes.
  - NO calculation changes.
  - NO data source changes.
  - NO filter/export changes.
  - Maintain complete existing behavior, status badges, view receipt modals, and export capabilities.

---

### REQ-12 — Remove Travel & Mileage Tab

- **Classification:** Tab / UI Removal.
- **Description:** Remove the **Travel & Mileage** tab (`id: 'mileage'`) from the Batch Management → Expense Details drawer navigation.
- **Rationale:** The tab is redundant and misrepresents batch travel operations.
- **Data Safety Mandate:**
  - This is a **UI / Tab removal ONLY**.
  - Do **NOT** delete travel expense records from `flwdsk_expense_claims`.
  - Do **NOT** alter mileage calculations or travel reimbursement logic in other FlowDesk modules (e.g. My Day, Expenses & Travel).

---

### REQ-13 — Add Work Hours Tab

- **Classification:** New Tab Addition (Replaces Travel & Mileage tab).
- **Tab Placement:** Placed in the drawer navigation tab bar.
- **Structure:** Contains **TWO** distinct sections:

#### Section A — Employee-wise Work Hours Summary (Top Section)
Summary table showing aggregated employee participation on this batch:
- **Columns:**
  1. `Employee Name`
  2. `Training Days` (Unique attendance dates for this employee on this batch)
  3. `Total Work Hours` (Sum of actual hours worked by this employee on this batch)

#### Section B — Detailed Work Hours Log (Bottom Section)
Granular breakdown of each training session:
- **Columns:**
  1. `Employee Name`
  2. `Training Date` (DD-MM-YYYY)
  3. `Clock-In Time` (e.g. 09:30 AM)
  4. `Clock-Out Time` (e.g. 04:30 PM)
  5. `Work Hours` (Actual net session duration)
- **Multi-session Rule:** If an employee has multiple sessions on the same date, each session must appear as a separate row in this log.

#### Overtime Exclusion Rule
- **Prohibition:**
  - Do **NOT** display an Overtime column.
  - Do **NOT** display an Overtime KPI card.
  - Do **NOT** include overtime calculations or overtime styling in this tab.

---

### REQ-14 — Add Expense Calculation Tab

- **Classification:** New Tab Addition (Financial Analysis & Batch Costing).
- **Tab Placement:** **MUST BE THE LAST TAB** in the Expense Details drawer navigation.
- **Structure:** Divided into six functional areas (Sections A through F):

#### Section A — Total Expenses
- Display the aggregate approved Batch Expenses sourced from existing expense records (REQ-03).

#### Section B — Employee-wise Cost Calculation
Table calculating employee delivery costs based on hourly rate:
- **Columns:**
  1. `Employee Name`
  2. `Total Work Hours` (from attendance on this batch)
  3. `Hourly Rate (₹/hr)` (Editable input field)
  4. `Calculated Employee Cost (₹)`
- **Calculation Formula:**
  $$\text{Employee Cost} = \text{Total Work Hours} \times \text{Hourly Rate}$$
- **Summary:** Display `Total Employee Cost` by summing all calculated employee costs:
  $$\text{Total Employee Cost} = \sum (\text{Employee Costs})$$

#### Section C — Batch-wise Hourly Rate Persistence
- Hourly rates must be:
  - **Employee-specific** (Trainer A can have ₹ 500/hr while Trainer B has ₹ 750/hr).
  - **Batch-specific** (Trainer A can have ₹ 500/hr on Batch 1, but ₹ 600/hr on Batch 2).
  - **Persistent:** Stored securely and reloaded whenever the batch expense details drawer is reopened.
  - **Non-leaking:** Do NOT automatically copy or apply an hourly rate from one batch to another.
  - **Reactive:** Editing an hourly rate immediately updates that employee's cost and the batch total.

#### Section D — Additional Expense / Loss Recording
Facility to capture company-level expenses paid directly from organizational bank accounts or unexpected batch losses that are not submitted via standard employee reimbursement claims.
- **Entry Fields:**
  - `Additional Expense Amount (₹)` (Numeric input)
  - `Expense Description / Reason` (Text input, e.g. "College Lab Facility Fee", "Direct Hall Booking")
- **Behavior:**
  - Allow Category 1 users to add, save, edit, and view additional expenses.
  - Persist additional expenses strictly linked to the relevant batch ID.
  - Recalculate batch totals automatically when additional expenses change.
  - **Prohibition:** Do NOT overwrite or modify existing employee reimbursement claims.

#### Section E — Category 1 Permission Restriction
- **Restricted Actions:**
  - Entering Additional Expenses
  - Editing / Saving Additional Expenses
  - Modifying Employee Hourly Rates
  - Saving Expense Calculation parameters
- **Authorization Rule:**
  - ONLY **Category 1 users** (Admins / Authorized Financial Management) have write access.
  - All other roles (Trainers, Coordinators, standard Employees) have read-only access or restricted visibility.
  - Must utilize FlowDesk's existing role-based authorization model (`user.role === 'admin'`).
  - **Prohibition:** Do NOT modify the existing Security System.

#### Section F — Calculation Structure & Accounting Boundaries
$$\text{Total Employee Cost} = \sum (\text{Employee Costs})$$
$$\text{Total Additional Expenses} = \sum (\text{Additional Expense Records})$$
$$\text{Final Total Batch Cost} = \text{Existing Batch Expenses} + \text{Total Employee Cost} + \text{Total Additional Expenses}$$

- **Strict Accounting Guardrail:** Record and present these three financial components separately. Do NOT silently introduce unapproved assumptions of "profit", "loss", "margin", or "revenue".

---

### REQ-15 — Employee-wise Expense Category Distribution Chart

- **Classification:** New Visualization Feature.
- **Location:** Integrated into the **Expense & Work Hours** area, placed immediately **BEFORE** the Employee Work Hours Summary table.
- **Design Specification:** Reuses the **identical two-bar-chart container pattern** approved in REQ-07:
  1. **Chart 1:** Employee-specific Category-wise Expense Amounts (₹).
  2. **Chart 2:** Employee-specific Category Expense Percentage Distribution (%).
- **Calculation Formula:**
  $$\text{Employee Category Percentage} = \frac{\text{Employee Category Expense}}{\text{Employee Total Expenses}} \times 100$$
- **Highlights:**
  - Clear visual indicator identifying each employee's highest spending category.
  - Consistent category colors and typography matching REQ-07.

---

## 3. PROPOSED FINAL DRAWER & TAB STRUCTURE

Following validation against the existing `BatchExpenseDetailsDrawer.tsx` architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DRAWER HEADER: BATCH CODE & BATCH NAME                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ TOP KPI BANNER (Modified):                                                  │
│ [Total Students] [Batch Workhours] [Total Expense] [Cost / Student]         │
│ [Avg Expense / Day]                                                         │
│ (REMOVED: Cost / Workhour, Avg / Claim)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ DRAWER NAVIGATION TABS:                                                     │
│ 1. 📊 Expense & Workhour Analytics (Overview)                               │
│ 2. 📋 Detailed Expense Log (Unchanged)                                      │
│ 3. ⏱️ Work Hours (New Tab)                                                  │
│ 4. 🧮 Expense Calculation (New Tab — LAST TAB)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tab Breakdown & Internal Sections

#### Tab 1: 📊 Expense & Workhour Analytics (Overview)
1. **Expense Category Distribution (REQ-07)**
   - Side-by-side Bar Chart: Category Amount (₹) | Category Percentage (%)
2. **Trainer & Submitter Allocation (REQ-08)**
   - Existing claimant cards with new inline expandable **"View"** employee expenses.
3. **Daily Expense & Workhours Delivery Timeline (REQ-10)**
   - Corrected attendance-based dates.
   - Cost / Hour column removed.

#### Tab 2: 📋 Detailed Expense Log (REQ-11)
- Preserved exactly as existing (Search, Category filters, Status, Receipts, Export).

#### Tab 3: ⏱️ Work Hours (REQ-13 & REQ-15)
1. **Employee-wise Expense Category Distribution Chart (REQ-15)**
   - Reused two-bar-chart pattern for individual claimant analysis.
2. **Section A: Employee-wise Work Hours Summary (REQ-13)**
   - Employee Name | Training Days | Total Work Hours
3. **Section B: Detailed Work Hours Log (REQ-13)**
   - Employee Name | Training Date | Clock-In | Clock-Out | Net Work Hours (No Overtime)

#### Tab 4: 🧮 Expense Calculation (REQ-14 — LAST TAB)
1. **Section A:** Total Approved Batch Expenses Summary
2. **Section B:** Employee Cost Table (Hours × Hourly Rate = Employee Cost)
3. **Section C:** Batch-specific Hourly Rate Persistence Controls
4. **Section D:** Additional Direct Expenses / Loss Entry Facility
5. **Section E:** Category 1 Permission Guards (Admin edit vs. non-admin view)
6. **Section F:** Final Aggregated Batch Cost Breakdown

---

## 4. TECHNICAL INVESTIGATION ITEMS (FOR FUTURE IMPLEMENTATION)

The following 12 items require technical investigation during the implementation phase:

| # | Technical Item | Key Questions / Architecture Considerations |
| :-: | :--- | :--- |
| **INV-01** | **Batch Student Source** | Identify canonical table: `flwdsk_training_batches.no_of_students` vs. count of `flwdsk_student_enrollments`. Resolve precedence when roster count differs from batch header. |
| **INV-02** | **Attendance Record Linking** | Determine canonical query linking attendance to batch: `flwdsk_work_sessions.batch_id` vs. `flwdsk_attendance_records.notes` string parsing vs. `schedule_sessions`. |
| **INV-03** | **Work Session Timestamps** | Verify timezone handling (UTC vs IST `+05:30`) for `clock_in` and `clock_out` across multi-trainer sessions. |
| **INV-04** | **Overnight Session Handling** | Define interval clipping if a training session spans across midnight (e.g. 10:00 PM to 02:00 AM). |
| **INV-05** | **Multi-Session Disjoint Intervals** | Formulate interval merging algorithm (sweep-line or union of intervals) to calculate exact Batch Workhours without double-counting simultaneous trainers. |
| **INV-06** | **Batch Expense Linking** | Inspect `flwdsk_expense_claims.batch_id` vs `batch_name` matching to ensure 100% of claims are captured without omissions. |
| **INV-07** | **Hourly Rate Persistence** | Design schema/table (e.g. `flwdsk_batch_trainer_rates` or JSONB in `flwdsk_training_batches.cost_settings`) for batch-specific employee hourly rates. |
| **INV-08** | **Additional Expense Persistence** | Design schema/table (e.g. `flwdsk_batch_additional_expenses` with `batch_id`, `amount`, `description`, `created_by`) ensuring full auditability. |
| **INV-09** | **Category 1 Authorization Model** | Map Category 1 permission checks to existing FlowDesk auth (`user.role === 'admin'`) without creating new unbacked permission subsystems. |
| **INV-10** | **Edge Cases & Zero Divisors** | Define UI states for 0 students, 0 expenses, 0 training hours, pending approvals, and unclosed sessions. |
| **INV-11** | **Database Migration Strategy** | Plan non-breaking additive Supabase migrations (RLS policies, foreign keys) without altering existing core tables. |
| **INV-12** | **Historical Reconciliation** | Determine if historical completed batches require retroactive hourly rate entry or default to zero employee cost until configured. |

---

## 5. RELATIONSHIP TO OTHER WORK PACKAGES

### 1. Tutorial System Revamp (`docs/Modification on 05-11-2026.md`)
- **Status:** Requirements Recorded — NOT STARTED.
- **Independence:** Tutorial work remains decoupled from Batch Expense Details.
- **Rule:** Do not mix tutorial components or simulators into this financial module.

### 2. Remaining Expense Review Section
- **Status:** Pending Stakeholder Discussion.
- **Relationship:** Batch Expense Details relies on claims approved in the Expense Review queue.
- **Rule:** Final deployment of Batch Expense Details will synchronize with any approved workflow changes from the upcoming Expense Review specification.

---

## 6. IMPLEMENTATION GOVERNANCE CONFIRMATION

| Governance Check | Status | Evidence |
| :--- | :---: | :--- |
| Requirements Recorded in Dedicated Document | ✅ CONFIRMED | `docs/BATCH_MANAGEMENT_EXPENSE_DETAILS_REQUIREMENTS.md` |
| Application Source Code Modified | ❌ NONE | Zero changes to `.ts`, `.tsx`, `.css` |
| Database Migrations Executed | ❌ NONE | No DDL / DML executed |
| Git Commits Created | ❌ NONE | Clean working directory |
| GitHub Push Executed | ❌ NONE | Branch unchanged |
| Production Deployment Triggered | ❌ NONE | No build or deployment dispatched |

---

*Document recorded and sealed on 05-11-2026 for FlowDesk Engineering.*

