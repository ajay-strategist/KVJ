# 1. Business Logics & Doubts

This section serves as the authoritative register of finalized business rules, approved operational decisions, unverified existing behaviors identified during module audits, and confirmed policy supersessions. 

- **Finalized Business Rules:** Explicitly approved and locked by management and stakeholders.
- **Unverified Existing Behaviors (UEBs):** Observed in code or audit reports that have not yet received explicit stakeholder sign-off.
- **Conflict / Superseded Rules:** Outdated configurations or documented assumptions that are formally superseded by newer stakeholder decisions.

---

## Employee Directory

### Finalized Business Rules

#### BR-EMP-001: Recognized Role Hierarchy and Category 1 Designation
- **Business Rule:** The application recognizes six operational roles: `ADMIN`, `CEO`, `MANAGER`, `EMPLOYEE`, `TRAINER`, and `STUDENT`.
- **Category 1 Executive Tier:** `ADMIN`, `CEO`, and `MANAGER` constitute **Category 1**, possessing global management, administrative edit rights, and cross-project visibility.
- **Scope:** Access control, workspace layouts, approval workflows, and administrative permissions.
- **Source:** [`src/core/types/auth.ts`](file:///Users/apple/Downloads/flow-desk-main/src/core/types/auth.ts), Stakeholder Confirmation.
- **Decision Status:** Finalized.

#### BR-EMP-002: Employee-Specific Configurable Probation (Add and Edit Workflows)
- **Business Rule:** Employee Add and Edit workflows require **configurable probation information** governed by the following consolidated stakeholder decisions and operational policies:

  1. **Duration Configuration and Fractional Support:**
     - Probation Duration is configurable per employee and accepts **positive fractional calendar-month values** (e.g., `2.5` or `2.9` months).
     - The platform must not assume a fixed duration or enforce a fixed list of selectable durations.
     - When an authorized user explicitly enters or edits the Duration field, the **user-entered Duration is authoritative**.
     - In the user interface, Duration is **displayed to exactly one decimal place** (e.g., `X.X months`).
     - Display formatting must strictly remain a presentation layer concern and **must never silently alter an underlying date or date calculation**.
     - Duration is **never rounded to whole months**.

  2. **Calendar-Based Forward Calculation (Joining Date + Duration $\rightarrow$ End Date):**
     - **Complete Calendar Months First:** Calculate complete calendar months first from the Joining Date.
     - **Fractional Month on Actual Calendar Days:** Calculate the remaining fractional-month portion using the **actual number of calendar days** in the specific relevant calendar month immediately following the complete-month portion.
     - **Fractional-Day Rounding & Tie-Breaking:** When converting the fractional-month portion into days produces a decimal day count, round it to the **nearest whole day**. For exact half-days (a decimal part of exactly `.5`), apply the uniform **half-up** tie-breaking convention ($0.5 \rightarrow 1$ day, e.g., $15.5\text{ days} \rightarrow 16\text{ days}$).
     - **Missing Target-Month Date (Month-End Clamping):** If the corresponding calendar day does not exist in the target month (e.g., advancing 1 month from January 31 to February, where February 31 does not exist), clamp to that month's **last calendar day** (e.g., February 28, or February 29 in a leap year).
     - **Post-Clamping Fractional Calculation:** After month-end clamping on the complete-month portion, calculate any remaining fractional month from the clamped date using the actual calendar days of the relevant subsequent month.

  3. **End-Date Semantics and Automatic Progression:**
     - **Probation End Date:** The final calendar day of the probation period.
     - **Probation Completion Date:** The calendar day immediately following the Probation End Date.
     - **Leave Accrual Start Date:** The calendar day immediately following the Probation End Date, which coincides with the Probation Completion Date.
     - **Zero Accrual During Probation:** No annual leave accrues during probation (reaffirming `BR-LEAVE-011`).
     - **Automatic Scheduled Completion:** Probation completes automatically on its scheduled date without requiring manual confirmation or sign-off by Admin, CEO, or Manager.
     - **Lifecycle Status Independence:** Automatic probation completion does not alter the employee's lifecycle status, including when the employee is `Suspended` (a Suspended employee remains Suspended).

  4. **Reverse Calculation (Joining Date + Updated End Date $\rightarrow$ Duration):**
     - When an authorized user explicitly changes the Probation End Date, the system recalculates the **Probation Duration** from the employee's existing Joining Date and updated End Date.
     - Reverse calculation uses the **identical calendar-month and actual-calendar-day methodology** as forward calculation (counting completed calendar months and dividing remaining days by the actual calendar days of the bridging month).
     - The recalculated Duration must not be rounded to whole months.
     - The reverse-calculated Duration is displayed in the UI to **one decimal place**.
     - The user-entered End Date is **authoritative and strictly preserved**; the system must not silently alter the user-entered End Date merely because the displayed Duration is rounded to one decimal place.

  5. **Field Precedence, Edits, and Joining Date Changes:**
     - **Explicit Duration Edit:** If the user explicitly edits Duration, the entered value takes precedence and the Probation End Date is automatically recalculated.
     - **Explicit End Date Edit:** If the user explicitly edits End Date, the entered End Date remains authoritative and Duration is automatically reverse-calculated.
     - **Simultaneous Edits Precedence:** If both fields are edited before saving, the **last field explicitly edited by the user takes absolute precedence**, and the other field is recalculated from it, ensuring both are synchronized before saving.
     - **Recalculated vs User-Edited Fields:** An automatically recalculated field must **never be treated as an explicit user edit**.
     - **Joining Date Changes:** When the Joining Date is modified, the system **preserves the currently established Duration value** and automatically recalculates the Probation End Date from the new Joining Date.
     - **Workflow Consistency:** These synchronization and precedence rules apply identically across both **Employee Add** and **Employee Edit** workflows.
     - **No Confirmation Prompt:** Modifying Duration or End Date must not require a separate confirmation modal.

  6. **No-Probation State (`0` or Blank/Null):**
     - Both **`0`** and **blank/null** Probation Duration represent an employee with **no probation**.
     - The system must **not** generate, calculate, or store a Probation End Date, Probation Completion Date, or probation-derived Leave Accrual Start Date for an employee with no probation.
     - For employees without probation, annual leave accrual begins immediately from their **Joining Date** (subject to pro-rata rules under `BR-LEAVE-011` / `BR-LEAVE-013`).
     - No-probation employees must be **explicitly excluded from automatic probation-completion routines**.
     - If probation is added later to an existing employee, calculate the End Date from the existing Joining Date using standard rules.

  7. **Approved Persistence Convention (EMP-Q01 — 31 Oct 2026):**
     - **Probation End Date is the authoritative stored value** in the database.
     - **Probation Duration must be calculated dynamically from the End Date** (using Joining Date).
     - **Displayed decimal duration may be rounded** (e.g. to one decimal place in the UI).
     - **Display rounding must never modify the authoritative End Date.**
     - **Editing and saving an employee record must preserve the original End Date unless an authorized user explicitly changes it.**

- **Illustrative Expected Outcomes (Documentation Examples — Not Application Test Evidence):**
  | Scenario | Expected Outcome |
  | :--- | :--- |
  | **Joining Date Jan 15, Duration 3 months** | Probation End Date: April 14; Completion & Accrual Start Date: April 15. |
  | **Joining Date Jan 31, Duration 1.5 months (non-leap year)** | 1 complete month clamps to Feb 28; remaining 0.5 month uses March's 31 days ($0.5 \times 31 = 15.5$ days, rounds half-up to 16 days); Probation End Date: March 16; Completion & Accrual Start Date: March 17. |
  | **Joining Date Jan 31, Duration 1 month (leap year)** | 1 complete month clamps to Feb 29; Probation End Date: February 29; Completion & Accrual Start Date: March 1. |
  | **Duration explicitly changed** | Recalculate End Date from Joining Date and the new Duration without confirmation modal. |
  | **End Date explicitly changed** | Preserve user-entered End Date and reverse-calculate Duration; display to 1 decimal place without mutating End Date. |
  | **Joining Date changed** | Preserve current Duration value and recalculate End Date from new Joining Date. |
  | **Duration is `0` or blank** | No probation dates generated; excluded from completion routines; leave accrues from Joining Date. |
  | **Employee Suspended when probation ends** | Probation completes on schedule without changing employee's Suspended lifecycle status. |

- **Audit of Reverse-Calculation Precision & Persistence Ambiguity:**
  > [!NOTE]
  > **Mathematical Distinction Across Duration Representations:**
  > The documentation explicitly recognizes four distinct concepts:
  > 1. *User-Entered Duration:* The exact decimal value entered by a user (e.g., `2.9`).
  > 2. *Reverse-Calculated Duration:* The calculated result of converting an End Date back into months (e.g., `2.871...`).
  > 3. *UI Display Value:* The rounded presentation value displayed to exactly one decimal place (e.g., `2.9`).
  > 4. *Calculation Value:* The value utilized for subsequent date operations.
  >
  > **Identified Ambiguity:** When an End Date produces a reverse-calculated value of `2.87` months and the UI displays `2.9` months, stakeholder decisions do not explicitly define whether the database should persist the exact mathematical fraction (`2.87`), the one-decimal rounded value (`2.9`), or an edit-precedence flag (`is_end_date_authoritative`).
  > - *Technical Recommendation (Unconfirmed Implementation Detail):* It is recommended that during implementation, if an End Date is user-entered, the system stores the authoritative End Date and marks the record so that subsequent background date checks use the stored End Date directly, rather than re-forward-calculating from the 1-decimal display duration. This prevents display rounding from shifting an authoritative date.
  > - *Clarification Status:* Pending Technical / Implementation Decision (do not treat recommendation as an approved business rule).

- **Proposed Validation Requirements for Future Implementation (Non-Approved Implementation Guidance):**
  - Accept `0`, blank/null, and valid positive Duration values.
  - Reject negative Duration values.
  - Prevent invalid date inputs and prevent End Dates earlier than the Joining Date.
  - Prevent invalid or internally inconsistent field states from being saved to the database.
  - Enforce consistent calculation rules across both Employee Add and Employee Edit modals.
  - Ensure UI display rounding does not silently mutate an authoritative End Date.
  - Distinctly track user-edited fields from automatically recalculated fields in component state.
  *(Note: Maximum duration limits or other arbitrary validation restrictions must not be introduced without explicit stakeholder sign-off).*

- **Scope:** Employee Add Modal, Employee Edit Modal, Employee Management Service, Employee Profile.
- **Technical / Database Consideration:** Storage requirements for decimal duration, nullable dates, and no-probation states remain unverified in the live database schema (see `EMP-Q01` in Section 2 Part C).
- **Source:** Confirmed stakeholder decisions (Consolidated Probation Rules).
- **Decision Status:** Finalized (Policy rules finalized; reverse-calculation storage precision retained as implementation clarification).

#### BR-EMP-003: Calendar-Month Probation Calculation and Automatic Completion
- **Business Rule:** Probation duration is calculated using the **calendar-month method**, not a fixed day count, and operates under the following synchronized standards:
  1. **Calculation Methodology Alignment:** Whole-month and fractional-month calculations adhere strictly to `BR-EMP-002` (complete calendar months first, followed by fractional days based on actual calendar days of the bridging month, with half-up whole-day rounding and month-end clamping).
  2. **Distinct Date Semantics:**
     - **Probation End Date:** The final calendar day of the probation period (e.g., April 14 for a 3-month probation starting Jan 15). This is the last day of probation and is **not** an accrual day.
     - **Probation Completion Date:** The calendar day immediately following the final probation day (e.g., April 15).
     - **Leave Accrual Start Date:** The calendar day immediately following the final probation day (e.g., April 15), on which leave accrual begins, coinciding with the Probation Completion Date.
  3. **Zero Accrual During Probation:** No annual leave accrues during the probation period (reaffirming `BR-LEAVE-011`).
  4. **Automatic Completion Without Manual Confirmation:** Probation completes automatically on its scheduled date when the Probation End Date has passed. Manual confirmation by Admin, CEO, or Manager is **not required**.
  5. **Suspended Status Independence:** Probation completes automatically on the scheduled date even if the employee's lifecycle status is `Suspended`. Automatic completion does **not** change the employee's lifecycle status (a Suspended employee remains Suspended).
  6. **No-Probation State Exemption:** For employees configured with no probation (`0` or blank/null per `BR-EMP-002`), no probation dates or completion triggers exist; leave accrual commences from their Joining Date.
  7. **Distinct Rounding Domains:** Fractional-day rounding in probation calculation (nearest whole day with half-up tie-breaking per `BR-EMP-002`) is strictly separate from the half-day leave allocation rounding rule defined in `BR-LEAVE-013`. Neither calculation may borrow or substitute the rounding convention of the other.
- **Scope:** Employee Lifecycle, Probation tracking routines, Leave initialization service.
- **Dependencies:** `flwdsk_employees.joining_date`, Probation calculation utility (`BR-EMP-002`), `flwdsk_leave_balances` (`BR-LEAVE-011`).
- **Source:** Confirmed stakeholder decisions.
- **Decision Status:** Finalized.

### Unverified Existing Behaviors
- **UEB-EMP-001: Soft-Delete Archival Mechanism**
  - **Observed Behavior:** Terminating or deleting an employee sets `deleted_at = NOW()` and `deleted_by = actor.id` in `flwdsk_employees`. Rows are never physically deleted from the database.
  - **Scope:** `flwdsk_employees`, Employee Management service.
  - **Source:** [`src/modules/employee/supabase-employee.repository.ts`](file:///Users/apple/Downloads/flow-desk-main/src/modules/employee/supabase-employee.repository.ts).
  - **Status:** Unverified Existing Behavior (reconciled with `BR-ES-001`).

- **UEB-EMP-002: Default Work Email Generation**
  - **Observed Behavior:** When creating an employee without an explicit work email, the repository generates a placeholder based on employee ID or company domain.
  - **Scope:** Employee creation modal and employee repository.
  - **Source:** [`src/modules/employee/employee.service.ts`](file:///Users/apple/Downloads/flow-desk-main/src/modules/employee/employee.service.ts).
  - **Status:** Unverified Existing Behavior.

---

## Employee Status

### Finalized Business Rules

#### BR-ES-001: Inactive Employee Default Visibility and Filtered Access
- **Business Rule:** Terminated and Suspended employees are **hidden by default** from the Employee Status board and Team Directory. They can be displayed exclusively when the user enables explicit filter controls (e.g., toggling "Show Inactive / Terminated").
- **Scope:** Employee Status board, Employee Directory, Team Status filters.
- **Dependencies:** `flwdsk_employees.deleted_at`, `flwdsk_employees.status`.
- **Source:** Confirmed stakeholder decision (formally resolves `ES-Q1`).
- **Decision Status:** Finalized.

#### BR-ES-002: Current Task Display Rules and Fallback
- **Business Rule:** The "Current Task" field on the status board and directory must adhere to the following display rules:
  1. If an employee has **no active task running**, the Current Task field is strictly **blank** (no placeholder text, em dash, or "None").
  2. If an active task is running, the Current Task field displays the **task name only**, without emoji, status icons, progress percentage, or additional explanatory text.
- **Scope:** Employee Status board, Employee Directory, MyDay status cards.
- **Dependencies:** `flwdsk_task_work_sessions`, Task service.
- **Source:** Confirmed stakeholder decision (formally resolves `ES-Q2` and `TASK-Q6`).
- **Decision Status:** Finalized.

#### BR-ES-003: Clocked-In Status Without Active Task (Available / Idle)
- **Business Rule:** When an employee is clocked in to Attendance but does not have an active Task Timer running, their live status badge on the status board must explicitly display **`Available/Idle`**.
- **Scope:** Employee Status board, live team overview.
- **Dependencies:** `flwdsk_attendance_records`, `flwdsk_task_work_sessions`.
- **Source:** Confirmed stakeholder decision (formally resolves `ES-Q3`).
- **Decision Status:** Finalized.

#### BR-ES-004: 15-Minute Inactive Alert to Admin
- **Business Rule:** If an employee has clocked in to Attendance but has not started any Task Timer within **15 minutes**, an automated notification is dispatched to the **Admin**.
- **Scope:** Attendance service, background notification engine.
- **Dependencies:** `flwdsk_attendance_records`, `flwdsk_notifications`.
- **Source:** Confirmed stakeholder decision (reaffirms `BR-TS-002`).
- **Decision Status:** Finalized.

### Unverified Existing Behaviors
- **UEB-ES-001: Live Status Board Derivation Query**
  - **Observed Behavior:** An employee's status badge on the status board is derived dynamically by joining the latest `flwdsk_attendance_records` for today and active `flwdsk_task_work_sessions`.
  - **Scope:** Employee Status board, Team Status views.
  - **Source:** [`src/modules/employee/pages/EmployeeStatusPage.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/employee/pages/EmployeeStatusPage.tsx).
  - **Status:** Unverified Existing Behavior.

---

## Attendance

### Finalized Business Rules

#### BR-ATT-001: Allowed Attendance Work Types
- **Business Rule:** The platform strictly supports exactly three work types: `'Office'`, `'Training'`, and `'Marketing'`. When `'Training'` is selected, the employee must associate the session with an allocated training batch.
- **Scope:** Attendance clock-in modal, attendance logging service, timesheet rollups.
- **Conditions and Exceptions:** Selecting `'Training'` without a valid batch is rejected.
- **Dependencies:** Training module (`flwdsk_batches`).
- **Source:** [`src/config/business-rules.ts:37-40`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L37-L40).
- **Decision Status:** Finalized.

#### BR-ATT-002: Late Reporting and Break Tracking Scope
- **Business Rule:** Late reporting tracking and Break tracking apply **exclusively** to `'Office'` work days. Class/Training and Marketing days do not track or penalize late reporting or break durations.
- **Scope:** Attendance service, break logging, daily attendance reporting.
- **Conditions and Exceptions:** Applies only when work type is `'Office'`.
- **Dependencies:** Attendance reporting engine.
- **Source:** [`src/config/business-rules.ts:30-34`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L30-L34).
- **Decision Status:** Finalized.

#### BR-ATT-003: Training and Class Fixed Timing
- **Business Rule:** Class and training sessions operate on the host organization's fixed institutional schedule (e.g., 08:30–17:00). Trainers do not log ad-hoc break durations during active institutional classes.
- **Scope:** Attendance clock-in, Training calendar timesheet rollups.
- **Conditions and Exceptions:** Applies exclusively to sessions marked with work type `'Training'`.
- **Dependencies:** Training batch schedules.
- **Source:** [`src/config/business-rules.ts:28-29, 35`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L28-L29).
- **Decision Status:** Finalized.

#### BR-ATT-004: Prohibition of Silent Automatic Clock-Out
- **Business Rule:** The system is strictly prohibited from silently or automatically clocking out employees at midnight (`23:59`) or on date boundaries without manual user confirmation or supervisor intervention.
- **Scope:** Attendance engine, daily session closure, cron routines.
- **Conditions and Exceptions:** Dangling sessions must be surfaced for manual employee/manager resolution.
- **Dependencies:** `flwdsk_attendance_records`, attendance correction service.
- **Source:** Confirmed stakeholder decision; supersedes legacy code defaults.
- **Decision Status:** Finalized.

#### BR-ATT-005: Resolution of Dangling Unclosed Attendance Sessions
- **Business Rule:** If an employee fails to clock out on the previous day and returns to work, the open previous-day Attendance session must be explicitly handled and resolved before a new Clock-In can be initiated. Automatic clock-out is strictly prohibited.
- **Operational Enforcement:** When an unclosed attendance session is detected on a new calendar day, the platform prompts the employee to record their actual departure time (or submit an attendance correction claim). A new attendance punch cannot be created until the prior session is cleanly closed.
- **Notification:** If an open session from a previous day is detected, an automated notification is dispatched to **Category 1 / Admin**.
- **Scope:** MyDayPage attendance widget, attendance clock-in service.
- **Dependencies:** `flwdsk_attendance_records`, `flwdsk_attendance_claims`.
- **Source:** Confirmed stakeholder decision (formally resolves `ATT-Q1`).
- **Conflict / Superseded Decision:** Formally supersedes and cancels `autoClockOutAt: '23:59'` in [`src/config/business-rules.ts:36`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L36).
- **Decision Status:** Finalized.

#### BR-ATT-006: Working Hours Display Scope (Net vs Gross)
- **Business Rule:** Only the **My Day Attendance Control Panel** displays net working hours (Gross Clock-In-to-Clock-Out duration minus recorded breaks). All other Attendance views, admin summary panels, monthly logs, and reports display **gross hours**, with break duration made separately available as an informational column.
- **Scope:** MyDayPage, AttendanceCalendarView, AttendanceLogPage, Attendance Reports.
- **Dependencies:** `flwdsk_attendance_records.total_working_minutes`, `flwdsk_attendance_records.total_break_minutes`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-ATT-007: Attendance Claims for Punch Corrections and Category 1 Approval Authority
- **Business Rule:** If an employee's Clock-In or Clock-Out time is incorrect, omitted, or disputed, the employee must submit an **Attendance Claim** through the existing correction process.
- **Approval Authority:** All **Category 1 members (`ADMIN`, `CEO`, `MANAGER`)** possess full authority to approve or reject Attendance Correction Claims. Reporting Manager status alone does **not** grant a separate approval authority.
- **Scope:** Approvals Queue, Attendance Claims, Attendance Log.
- **Dependencies:** `flwdsk_attendance_claims`, Attendance correction service, Category 1 auth roles.
- **Conflict / Superseded Decision:** Formally supersedes older documentation stating that reporting managers independently approve attendance corrections.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-ATT-008: Category 1 Force Clock-Out Authority, Defaults, and Break Reconciliation
- **Business Rule:** Force Clock-Out operates under the following strict operational policies:
  1. **Authority:** Force Clock-Out is executed manually exclusively by **Category 1 (`ADMIN`, `CEO`, `MANAGER`)** through the Approval Queue. Category 1 can Force Clock-Out **any employee** across the organization.
  2. **Explicit Timestamp Required:** Force Clock-Out requires an explicit clock-out time entered by the approver.
  3. **Default Clock-Out Time:** The default Force Clock-Out time is **5:30 PM**, which can be adjusted by the authorized Category 1 approver before submission.
  4. **Active Break Reconciliation:** If a break session is active when Force Clock-Out is executed, the default break end time is automatically set to **5:30 PM**, and can be adjusted by the authorized approver.
  5. **Employee Notification Exemption:** **No separate notification** to the employee is required when a Force Clock-Out is executed.
- **Scope:** Approvals Queue, `AttendanceService.forceClockOutSession()`, `AttendanceLogPage`.
- **Dependencies:** `flwdsk_attendance_records.breaks`, `flwdsk_attendance_records.sessions`.
- **Source:** Confirmed stakeholder decision (formally resolves `ATT-Q2`).
- **Decision Status:** Finalized.

### Unverified Existing Behaviors
- **UEB-ATT-001: Geofence Validation Fallback**
  - **Observed Behavior:** If browser geolocation fails or is disabled by the user, the clock-in punch proceeds with `clock_in_geo = null` rather than blocking clock-in.
  - **Scope:** `useAttendance` hook, `MyDayPage`.
  - **Source:** [`src/modules/attendance/hooks/useAttendance.ts`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/hooks/useAttendance.ts).
  - **Status:** Unverified Existing Behavior.

---

## Leave Management

### Finalized Business Rules

#### BR-LEAVE-001: Category 1 Leave Approval Authority
- **Business Rule:** Approval responsibility for all employee leave applications resides exclusively with **Category 1 (`ADMIN`, `CEO`, `MANAGER`)**.
- **Scope:** Leave application service, Approvals Queue.
- **Conflict / Superseded Decision:** Formally **supersedes** the older two-tier Reporting Manager → CEO sequential approval chain documented in [`src/config/business-rules.ts:49-51`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L49-L51).
- **Dependencies:** Auth roles (`ADMIN`, `CEO`, `MANAGER`).
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-LEAVE-002: Self-Escalation Skip-Step Rule
- **Business Rule:** If a Category 1 member applies for leave, they cannot approve their own application; the application is approved by another Category 1 peer or the CEO.
- **Scope:** Workflow engine, leave approval routing.
- **Dependencies:** Workflow engine (`WorkflowEngine.ts`), Role verification.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-LEAVE-003: Informational Balances Without Payroll/Salary Impact
- **Business Rule:** Employee leave balances are tracked purely for operational visibility and scheduling capacity. Leave taken has **zero financial or payroll deduction impact** on the platform (`salaryImpact: false`).
- **Scope:** Leave balance repository, attendance time-off rollups.
- **Conditions and Exceptions:** Loss of Pay (LOP) calculations are strictly excluded from FlowDesk.
- **Dependencies:** Leave balance store.
- **Source:** [`src/config/business-rules.ts:52-54`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L52-L54).
- **Decision Status:** Finalized.

#### BR-LEAVE-004: Supported Leave Types
- **Business Rule:** The platform strictly recognizes exactly two formal leave types: **`'Leave'`** (standard casual/general leave) and **`'Medical Leave'`**.
- **Scope:** Leave request forms, leave approval workflows, leave reports.
- **Dependencies:** `flwdsk_leave_records.leave_type`.
- **Source:** [`src/config/business-rules.ts:56`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L56).
- **Decision Status:** Finalized.

#### BR-LEAVE-005: Mandatory Medical Certificate for Medical Leave
- **Business Rule:** Any leave request submitted under the category **`'Medical Leave'`** strictly requires a medical certificate file attachment. The submission must be rejected at validation if the attachment is missing.
- **Scope:** Leave application modal, leave validation engine.
- **Dependencies:** File upload service, Supabase storage bucket (`receipts` / `documents`).
- **Source:** [`src/config/business-rules.ts:58`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L58).
- **Decision Status:** Finalized.

#### BR-LEAVE-006: Sandwich Leave Policy Disabled (Working Days Deduction Only)
- **Business Rule:** The Sandwich Leave policy is **strictly disabled**. When an employee applies for leave spanning weekends (e.g., Friday to Monday), **only official working days are deducted** from the employee's leave balance. Non-working days (Saturdays and Sundays) are strictly excluded from deduction.
- **Scope:** Leave duration calculator, leave balance deduction service.
- **Dependencies:** `flwdsk_leave_records`, Leave duration engine.
- **Source:** Confirmed stakeholder decision (formally resolves `LEAVE-Q1`).
- **Decision Status:** Finalized.

#### BR-LEAVE-007: Negative Leave Balances and Overdraft Permission
- **Business Rule:** Employees are **permitted to apply for leave even when their available balance is exhausted or becomes negative**. The application is not blocked by zero or negative balance; approval is at the discretion of Category 1.
- **Scope:** Leave request modal, leave balance validation.
- **Dependencies:** `flwdsk_leave_balances`.
- **Source:** Confirmed stakeholder decision (formally resolves `LEAVE-Q3`).
- **Decision Status:** Finalized.

#### BR-LEAVE-008: Annual Leave Expiration on March 31 (No Carry-Forward)
- **Business Rule:** Unused employee leave balances **do not carry forward** beyond the end of the financial year. All unused leaves expire annually on **March 31**.
- **Scope:** Leave balance store, year-end reset scheduler.
- **Dependencies:** `flwdsk_leave_balances`, Scheduler cron.
- **Source:** Confirmed stakeholder decision (formally resolves `LEAVE-Q7`).
- **Decision Status:** Finalized.

#### BR-LEAVE-009: Early Return from Leave and Remainder Cancellation
- **Business Rule:** When an employee returns to work earlier than their approved leave end date, the employee is permitted to **cancel the remaining unused leave days**, restoring those days back to their leave balance.
- **Scope:** MyDayPage leave status, LeaveBoard cancellation modal.
- **Dependencies:** `flwdsk_leave_records`, Leave balance restoration.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-LEAVE-010: Exclusion of Public Holidays from Leave Deductions
- **Business Rule:** Official declared public holidays (backed by `flwdsk_declared_holidays`) that fall within an employee's approved leave span **must not be deducted from the employee's Leave Balance**.
- **Interaction with Sandwich Leave:** Preserves `BR-LEAVE-006` (sandwich leave policy is disabled; only scheduled working days are deducted). No additional unapproved holiday or leave-deduction conditions are introduced.
- **Scope:** Leave duration calculator, leave balance deduction service, attendance reporting.
- **Dependencies:** `flwdsk_declared_holidays`, `flwdsk_leave_records`, `flwdsk_leave_balances`.
- **Source:** Confirmed stakeholder decision (formally resolves `LEAVE-Q2`).
- **Decision Status:** Finalized.

#### BR-LEAVE-011: Baseline Annual Leave Entitlement, Probation Accrual Pause, and Pro-Rata Allocation
- **Business Rule:** Annual leave entitlement and accrual for new joiners operate under the following confirmed rules:
  1. **Baseline Annual Entitlement:** Baseline entitlement is **1 day of Annual Leave per month**, totaling **12 days** for a full Financial Year before applying eligibility and pro-rata rules.
  2. **Financial Year Cycle:** The company Financial Year ends on **March 31**. Unused annual leave does not carry forward beyond March 31 (reaffirming `BR-LEAVE-003`).
  3. **Probation Accrual Pause:** New employees' leave accrual is subject to their probation period. **Zero Annual Leave accrues during the probation period**.
  4. **Leave Accrual Start Date:** Leave accrual starts on the calendar day immediately after the final day of probation (the **Leave Accrual Start Date**, which coincides with the Probation Completion Date). The Probation End Date itself is the final day of probation and is not an accrual day.
  5. **Pro-Rata Allocation for Remaining Financial Year:** Once the Leave Accrual Start Date is reached, leave is allocated based on the remaining eligible period in the Financial Year ending March 31. No leave is allocated for any period prior to the Leave Accrual Start Date. Full subsequent calendar months within the financial year receive the standard 1 day per month.
- **Scope:** Employee onboarding, Probation completion, Leave balance initialization service.
- **Dependencies:** `flwdsk_employees.joining_date`, Probation calculation, `flwdsk_leave_balances`.
- **Conflict / Superseded Decision:** Formally supersedes the preliminary placeholder in `LEAVE-Q4A` and establishes the confirmed entitlement baseline, probation exclusion, and accrual start date.
- **Source:** Confirmed stakeholder decision (formally resolves `LEAVE-Q4` and `LEAVE-Q4A`).
- **Decision Status:** Finalized.

#### BR-LEAVE-012: Universal Category 1 Leave Approval and Absence Delegation
- **Business Rule:** Any available **Category 1 member (`ADMIN`, `CEO`, `MANAGER`)** possesses full authority to approve or reject a Leave Request when the originally assigned or primary Category 1 approver is unavailable or on leave. A leave application **does not need to wait** for a specific individual approver to return.
- **Reaffirmation of Approval Tier:** Preserves the established rule (`BR-LEAVE-001`) that Leave Requests are approved by Category 1 as an executive tier, not solely by an employee's immediate reporting manager.
- **Scope:** Approvals Queue, Leave approval routing, notification dispatch.
- **Dependencies:** Auth roles (`ADMIN`, `CEO`, `MANAGER`), Approvals Queue.
- **Source:** Confirmed stakeholder decision (formally resolves `LEAVE-Q5`).
- **Decision Status:** Finalized.

#### BR-LEAVE-013: Partial-Month Pro-Rata Leave Accrual Calculation and Half-Day Rounding
- **Business Rule:** When the Leave Accrual Start Date falls on a day other than the first day of a calendar month, the partial-month leave allocation is calculated and rounded as follows:
  1. **Calculation Formula:**
     $$\text{Partial Month Allocation} = \left( \frac{\text{Eligible Calendar Days in Month}}{\text{Total Calendar Days in Month}} \right) \times 1\text{ day}$$
     - **Eligible Calendar Days:** Counted inclusively starting from the **Leave Accrual Start Date** through the final calendar day of that month.
     - **Total Calendar Days:** The actual number of calendar days in that specific month (28, 29, 30, or 31).
     - **Monthly Entitlement:** 1 day.
  2. **Half-Day Rounding Rule:** The calculated partial-month allocation is rounded to the **nearest permitted half-day (0.5-day) increment**, with a **minimum positive allocation of 0.5 day** when the calculated allocation is positive ($> 0$):
     - Calculated value of $0.25\text{ day} \rightarrow \mathbf{0.5\text{ day}}$ (minimum positive allocation).
     - Calculated value of $0.50\text{ day} \rightarrow \mathbf{0.5\text{ day}}$.
     - Calculated value of $0.75\text{ day} \rightarrow \mathbf{1.0\text{ day}}$.
     - Calculated value of $1.00\text{ day} \rightarrow \mathbf{1.0\text{ day}}$.
  3. **Annual Allocation Summation:** The total annual leave credited for the new joiner's remaining financial year is the sum of the rounded partial-month allocation plus 1 day for each subsequent full calendar month through March 31. The monthly entitlement rounding is applied to the partial-month allocation; the annual total is not repeatedly rounded in a manner that contradicts the confirmed monthly pro-rata method.
- **Scope:** Leave balance calculation service, Employee onboarding, Probation completion workflows.
- **Dependencies:** Leave Accrual Start Date, `flwdsk_leave_balances`.
- **Source:** Confirmed stakeholder decision (formally resolves `LEAVE-Q4A`).
- **Decision Status:** Finalized.

### Unverified Existing Behaviors
- **UEB-LEAVE-001: Calendar Conflict Soft Warning vs Hard Block**
  - **Observed Behavior:** The calendar matrix displays an amber badge when a trainer has approved leave. The latest confirmed rule (`BR-CAL-006`) establishes that leave blocks creating a new schedule, while existing schedules preserve and flag a conflict.
  - **Scope:** `TrainingCalendar.tsx`, `schedule.data.ts`.
  - **Status:** Reconciled under `BR-CAL-006`.

---

## Tasks Management

### Finalized Business Rules

#### BR-TASK-001: Task Creation and Assignment Approval Hierarchy
- **Business Rule:** Task creation and delegation adhere to the following strict governance:
  1. If an **Employee** creates a Task within a Project, approval from the **Project Supervisor**, **Admin**, **CEO**, or **Manager** is mandatory before the task becomes active.
  2. If an **Employee** creates a Task within the default **"Office Task"** project for themselves, **no approval is required**.
  3. If an **Employee** assigns a task to another employee, approval from the **Admin**, **CEO**, or **Manager** is mandatory.
  4. The **CEO** can assign tasks directly to any employee across any project without requiring intermediate approval.
- **Scope:** Task creation drawer, Task assignment modal, Approvals Queue.
- **Dependencies:** `flwdsk_tasks`, Project Supervisor assignment, Auth roles.
- **Source:** [`src/config/business-rules.ts:150-157`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L150-L157).
- **Decision Status:** Finalized.

#### BR-TASK-002: Single Active Task Timer Rule
- **Business Rule:** An employee is permitted to have **only one active Task Timer** running at any given time across all projects and tasks.
- **Scope:** MyDayPage task timer, TaskBoard, task work sessions.
- **Dependencies:** `flwdsk_task_work_sessions`, `TaskTimer` component.
- **Source:** Stakeholder Confirmation.
- **Decision Status:** Finalized.

#### BR-TASK-003: Mandatory Work Progress Update on Pause
- **Business Rule:** Every time an employee pauses an active task timer, submitting a text progress update describing the completed work is **strictly mandatory**.
- **Exemption:** Submitting a task for **final completion** is explicitly **exempt** from requiring a separate pause progress update.
- **Scope:** TaskTimer pause action, Clock-out prompt, Task completion modal.
- **Dependencies:** `flwdsk_task_work_sessions.progress_note`, Task service.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-TASK-004: Decoupling of Task Timers from Attendance
- **Business Rule:** A Task Timer **may start without an active Attendance Clock-In**. The platform does not gate, disable, or prevent starting task timers based on attendance status.
- **Scope:** MyDayPage, TaskBoard, TaskTimer.
- **Dependencies:** `flwdsk_tasks`, `flwdsk_task_work_sessions`.
- **Source:** Confirmed stakeholder decision (formally resolves `TASK-Q1`).
- **Decision Status:** Finalized.

#### BR-TASK-005: Lifetime Cumulative Task Actual Hours and Rework
- **Business Rule:** Task `actualHours` represents the **lifetime cumulative work duration** for that task across all historical work sessions.
- **Rework Duration:** Any time spent on task rework or modifications is directly added to the same lifetime cumulative `actualHours` total.
- **Prohibition:** Overwriting lifetime actual hours with only the current day's or latest session's duration is strictly prohibited:
  $$\text{actualHours} = \sum_{i} \text{sessionDuration}_i$$
- **Scope:** `flwdsk_tasks.actual_hours`, `flwdsk_task_work_sessions`.
- **Source:** Confirmed stakeholder decision (formally resolves `TASK-Q2`).
- **Decision Status:** Finalized.

#### BR-TASK-006: Task Reopening Permission
- **Business Rule:** An employee **may reopen a completed task** when additional work, adjustments, or testing are required. Reopening does not require administrative override.
- **Scope:** Task details modal, TaskBoard completed column.
- **Dependencies:** `flwdsk_tasks.status`.
- **Source:** Confirmed stakeholder decision (formally resolves `TASK-Q3`).
- **Decision Status:** Finalized.

#### BR-TASK-007: Task Approval & Rejection Lifecycle Governance (ISSUE-009)
- **Business Rule:** Two distinct task approval scenarios are recognized and governed separately:

  1. **Scenario A — Pre-Start Task Approval:**
     - Applies when a Project Supervisor must approve a proposed Task before the Employee can start working on it.
     - The Employee must receive approval before starting the Task.
     - If the Supervisor approves, the Employee can start working on the Task.
     - If the Supervisor rejects the Task **before the Employee has ever started it**:
       - Permanently delete the Task record from the database.
       - Delete its associated rejection record as well.
       - Do not retain a rejection history for this pre-start rejection.
       - This hard-deletion rule applies **ONLY when the Task has never been started**.

  2. **Scenario B — Post-Start / Post-Work Task Review:**
     - Applies when an Employee has started working on a Task and subsequently submits it for Supervisor review.
     - Once an Employee has started a Task, the Task record **must NEVER be hard-deleted** through the rejection workflow.
     - This protection applies **even when recorded Work Hours are zero**.
     - Strictly preserve the Task record, Employee start details, available work history, and relevant submission information.
     - Work Hours must be calculated and recorded automatically by the existing application workflow (`flwdsk_task_work_sessions`).
     - The Employee must not be required to manually enter Work Hours when submitting a Task.
     - A Task with zero Work Hours must still be eligible for submission; zero must not block submission.
     - If the Supervisor approves the submitted Task, change its status to **`Approved`** (or `Completed`).
     - If the Supervisor rejects the submitted Task:
       - Preserve the Task record.
       - Change its status to **`Rejected / Closed`**.
       - Preserve recorded Work Hours and available Task History.
       - Rejection Reason is optional, not mandatory.
       - Do not allow the Employee to resubmit the rejected and closed Task.

  3. **Critical Deletion Decision Matrix:**
     The deletion decision must be based on **whether the Employee has EVER started the Task**, and **NOT** merely on whether Work Hours are greater than zero.

     | Task condition at rejection | Required outcome |
     |---|---|
     | Never started; no start history | Hard-delete Task and associated rejection record |
     | Started; Work Hours greater than zero | Preserve Task; mark `Rejected / Closed` |
     | Started; Work Hours equal to zero | Preserve Task; mark `Rejected / Closed` |
     | Submitted for review and approved | Mark `Approved` |
     | Submitted for review and rejected | Preserve Task; mark `Rejected / Closed` |

     *Note on Implementation:* Do not use `work_hours > 0` as the sole condition for deciding whether a Task can be deleted. A reliable indication of whether the Task has ever started must be used (e.g. checking associated work sessions in `flwdsk_task_work_sessions`).

- **Scope:** Approvals Queue, Task assignment modal, Task completion modal, `ApprovalsQueue.tsx`, `useProject.ts`.
- **Dependencies:** `flwdsk_tasks`, `flwdsk_task_work_sessions`.
- **Source:** Confirmed stakeholder decision (31 October 2026, formally resolves `ISSUE-009` / `TASK-Q4`).
- **Decision Status:** Approved — Not Yet Implemented.

#### BR-TASK-008: Paused Task State Classification
- **Business Rule:** When an employee pauses a running task timer with hours logged, the task's operational status remains **`In Progress`**. It does not transition to a separate `'paused'` database status.
- **Scope:** `flwdsk_tasks.status`, TaskBoard Kanban swimlanes.
- **Dependencies:** `flwdsk_tasks.status`.
- **Source:** Confirmed stakeholder decision (formally resolves `TASK-Q5`).
- **Decision Status:** Finalized.

#### BR-TASK-009: Task Completion Workflow (Under Review State) and Equivalent Review Authority
- **Business Rule:** When an employee completes work on a task and submits it for completion, the task enters the **`Under Review`** status. The task transitions to **`Completed`** only upon explicit review and approval by the designated **Project Supervisor** or any **Category 1** member (`ADMIN`, `CEO`, `MANAGER`).
- **Equivalent Review and Approval Authority:** The **Project Supervisor**, **Admin**, **CEO**, and **Manager** have equal review authority. Any one of these authorized reviewers can approve a submitted task or return it for rework. The Project Supervisor does not have higher priority, precedence, or exclusive authority over Category 1 members.
- **Preservation of Task Rules:** Preserves all established task creation, assignment, timer, progress-update, rework, and completion requirements, without implementing changes to task workflows or permissions.
- **Scope:** Task completion modal, Approvals Queue, TaskBoard, Task Review modal.
- **Dependencies:** `flwdsk_tasks.status`, Task approval service, Auth roles (`Category 1`, Project Supervisor).
- **Source:** Confirmed stakeholder decision (formally aligned with `BR-PRJ-003`).
- **Decision Status:** Finalized.

### Unverified Existing Behaviors
- **UEB-TASK-001: Task Auto-Completion on 100% Progress Slider**
  - **Observed Behavior:** Setting task progress to 100% via the slider in `TaskBoard.tsx` automatically mutates `status = 'completed'` in the legacy code. This will be replaced by `BR-TASK-009` (`Under Review` state).
  - **Scope:** `TaskBoard.tsx`, `useProject.ts`.
  - **Status:** Reconciled and superseded by `BR-TASK-009`.

---

## Timesheets & Task Worklogs

### Finalized Business Rules

#### BR-TS-001: Strict Separation of Attendance and Task Worklogs
- **Business Rule:** Attendance records and Task Worklogs are **completely independent subsystems** and must never be merged or blended into a single data record:
  1. **Attendance:** Based strictly on Clock-In and Clock-Out punches. Represents physical presence duration. Gross duration is the Clock-In-to-Clock-Out interval; net working hours subtract recorded breaks.
  2. **Task Worklogs:** Based strictly on chronological Task Work Sessions logged against specific project tasks.
  3. **No Timesheet Approval Requirement:** Task worklog time does **not** require a separate timesheet approval workflow.
  4. **No Daily Working Hours Cap:** There is **no daily maximum working-hours cap** (e.g., 8, 12, or 16 hours) imposed on attendance or task duration.
- **Scope:** MyDayPage, Attendance, Projects & Tasks, Timesheets.
- **Dependencies:** `flwdsk_attendance_records`, `flwdsk_task_work_sessions`.
- **Source:** Confirmed stakeholder decision (formally resolves `TS-Q01`, `TS-Q03`, `TS-Q04`).
- **Decision Status:** Finalized.

#### BR-TS-002: Task Timer Mechanics, Continuity, and Administrative Oversight
- **Business Rule:** Task Timers operate under the following verified behavioral mechanics:
  1. **Clock-Out Precondition:** When an employee attempts to Clock-Out while a Task Timer is running, the running task must first be paused and its required progress update submitted before the clock-out can proceed.
  2. **15-Hour Continuous Run Alert:** If a single Task Timer runs continuously for more than **15 hours**, the system automatically dispatches an alert notification to the **Admin**. The timer must still be paused before clock-out.
  3. **15-Minute Inactive Alert:** If an employee has Clocked In to Attendance but has not started any Task Timer within **15 minutes**, an automated notification is dispatched to the **Admin**.
  4. **Timer Continuity Through Disconnection and Shutdown:** If a Task Timer is not explicitly stopped or paused, it **continues uninterrupted** even if the browser closes, the computer shuts down, or the internet disconnects.
  5. **Multi-Day and Overnight Continuity:** Timer duration continues overnight and across subsequent calendar days until the employee explicitly pauses or stops it. Upon returning, the displayed elapsed duration must accurately include the entire intervening period.
  6. **Prohibition of Auto-Stopping:** The system must **never automatically stop or truncate a task timer** because of browser closure, operating system shutdown, internet disconnection, or a calendar date boundary.
  7. **Administrative Emergency Pause:** The **Admin alone** possesses the authority to pause an employee's running Task Timer when administrative intervention is necessary.
- **Scope:** TaskTimer component, background notification service, MyDayPage.
- **Dependencies:** `flwdsk_task_work_sessions`, `flwdsk_notifications`.
- **Source:** Confirmed stakeholder decision (formally resolves `TS-Q05`).
- **Decision Status:** Finalized.

#### BR-TS-003: Chronological Task Worklog Structure and Project Labour Hours
- **Business Rule:** The Task Worklog is an unaggregated, chronological audit record of what employees worked on and when:
  1. **Session Granularity:** Every distinct Task Work Session must be recorded separately. Each record must capture: `employee_id`, `project_id`, `task_id`, `start_time`, `end_time`, and `duration`.
  2. **Preservation of Distinct Sessions:** If an employee pauses and later resumes the same task, or switches from Task A to Task B and returns to Task A, each session must remain an individual, immutable historical record.
  3. **Display Context:** Worklog entries must appear in the relevant Task details panel and Project details view.
  4. **Prohibition of Single-Total Replacement:** The chronological Worklog must never be replaced by a single aggregated total per task. Aggregated totals may only be calculated dynamically when a relevant report or UI filter requests them.
  5. **Project Total Labour Hours Calculation:** Project Total Labour Hours must be computed as the exact sum of all recorded Task Work Session durations across all employees working on that Project:
     $$\text{Project Total Labour Hours} = \sum_{e \in \text{Employees}} \sum_{s \in \text{Sessions}(e)} \text{Duration}(s)$$
     Concurrent sessions by multiple employees are summed together as cumulative labour hours, **not** compressed into elapsed wall-clock calendar time.
- **Scope:** Worklog views, Project Details, Task Details, Labour Hours reporting.
- **Dependencies:** `flwdsk_task_work_sessions`, `flwdsk_tasks`, `flwdsk_projects`.
- **Source:** Confirmed stakeholder decision (formally resolves `TS-Q02`, `PROJECT-Q3`).
- **Decision Status:** Finalized.

#### BR-TS-004: Worklog Editing Authority and Access Visibility Hierarchy
- **Business Rule:** Access, visibility, and mutation rights for Worklog records follow a strict role-based structure:
  1. **Editing Authority:** Only **Category 1 users (`ADMIN`, `CEO`, `MANAGER`)** are permitted to edit Worklog records. Regular employees cannot modify closed work sessions.
  2. **Audit History Exemption:** When a Worklog record is edited by Category 1, the system retains the updated values only. Maintaining a full before-and-after historical versioning chain is **not required**.
  3. **Employee Visibility:** Regular employees may view their own Worklog records and details for Projects they actively work on, strictly subject to their assigned project access.
  4. **Supervisor Visibility:** Project Supervisors may view Worklog details across all tasks for Projects they supervise.
  5. **Executive Visibility:** Category 1 users may view Worklog details across all projects and employees company-wide.
  6. **Peer Privacy (Prohibition of Blanket Access):** Project Members must **not** be granted blanket access to view each other's detailed Worklogs on shared projects.
- **Scope:** Worklog data repository, Project Details timesheet tab, Timesheets view.
- **Dependencies:** Auth roles, Project member records.
- **Source:** Confirmed stakeholder decision (formally resolves `TS-Q06`).
- **Decision Status:** Finalized.

#### BR-TS-005: Worklog Reporting and Export Specifications
- **Business Rule:** Timesheet and Worklog reporting must strictly fulfill the following technical and operational criteria:
  1. **Dual Export Formats:** The system must provide both **Excel (`.xlsx`)** and **PDF** exports for all Worklog reports.
  2. **Standard Filters:** Mandatory report filters must include **Project**, **Task**, **Employee**, and **Date Range**.
  3. **Mandatory Report Fields:** Exported files and reports must show: Project Title, Task Title, Employee Name, Work Session Start Time, Work Session End Time, and Session Duration.
  4. **Aggregated Summaries:** Reports must dynamically calculate and present relevant aggregated totals when filters are applied, specifically including **Project Total Labour Hours**.
  5. **Role-Based Report Access:**
     - **Category 1:** Can view and export reports across all projects and employees.
     - **Project Supervisors:** Can view and export reports for the projects they supervise.
     - **Employees:** Can view and export details for projects they work on, within their permitted project access scope.
  6. **Filter Consistency:** Applied UI filters must be reflected identically and consistently in the generated export file.
  7. **Prohibition of Combined Summaries:** The platform must **not** introduce combined daily or monthly task-time summary requirements unless supported by a separate confirmed decision. Attendance reports continue to show Attendance duration, not Task time.
- **Scope:** Timesheet report generator, PDF/Excel export engines.
- **Dependencies:** Reporting engine, `exportToExcel`, `jspdf-autotable`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

### Unverified Existing Behaviors
- **UEB-TS-001: Timesheets Route Fallback View**
  - **Observed Behavior:** The `/app/project/timesheets` route currently displays a grid aggregating hours from `flwdsk_task_work_sessions` with mock pending approval badges, despite task worklogs not requiring approval.
  - **Scope:** `src/modules/project/pages/TimesheetsPage.tsx`.
  - **Status:** Unverified Existing Behavior (requires UI cleanup to align with `BR-TS-001`).

---

## Projects Management

### Finalized Business Rules

#### BR-PRJ-001: Project Deletion Authority, Confirmation Modal, and No Restoration
- **Business Rule:** Deleting a Project is permitted for all **Category 1 members** holding the **`ADMIN`**, **`CEO`**, or **`MANAGER`** role.
- **Mandatory Confirmation Modal:** Deleting a project **strictly requires a confirmation modal**. The user must explicitly confirm the deletion before it proceeds.
- **Irreversible Deletion:** In accordance with explicit stakeholder confirmation, deleted projects cannot be restored under the currently confirmed rule (no restoration mechanism or undo in the UI).
- **Scope:** Project details actions, Project deletion modal, project repository.
- **Dependencies:** `flwdsk_projects.deleted_at`, Role verification (`Category 1`).
- **Conflict / Superseded Decision:** Formally supersedes older documentation that restricted project deletion to `ADMIN` and `CEO` only and bypassed the confirmation modal.
- **Security Boundary Note:** Recorded as a confirmed business rule without modifying the Security System or implementing authorization changes.
- **Source:** Confirmed stakeholder decision (formally resolves `PROJECT-Q4`).
- **Decision Status:** Finalized.

#### BR-PRJ-002: Automatic Routing to "Office Task" Project
- **Business Rule:** Every employee is automatically assigned to a permanent, internal baseline project named **`"Office Task"`**. When a task is created without an explicit project association, it routes automatically to "Office Task".
- **Scope:** Task creation workflow, employee onboarding.
- **Conditions and Exceptions:** "Office Task" cannot be deleted or renamed.
- **Dependencies:** `flwdsk_projects`, `flwdsk_tasks.project_id`.
- **Source:** [`src/config/business-rules.ts:152`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L152).
- **Decision Status:** Finalized.

#### BR-PRJ-003: Equivalent Task Review Authority Between Project Supervisor and Category 1
- **Business Rule:** For project-scoped tasks, the designated **Project Supervisor** and **Category 1 members (`ADMIN`, `CEO`, `MANAGER`)** have **equivalent review and approval authority**. Any one of these authorized reviewers can review, approve a submitted task, or send it back for rework, subject to the applicable task workflow.
- **No Precedence or Exclusivity:** The Project Supervisor does **not** have higher priority, precedence, or exclusive authority over Category 1 members, nor does Category 1 override or exclude the Project Supervisor.
- **Scope:** Task approvals, task review modal, project dashboard, Approvals Queue.
- **Dependencies:** `flwdsk_projects.supervisor_id`, `flwdsk_tasks.status`, Category 1 roles.
- **Conflict / Superseded Decision:** Formally supersedes older rule formulations (such as legacy `business-rules.ts:151`) that granted Project Supervisor precedence or exclusive oversight over Category 1 members.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-PRJ-004: Canonical Project Operational Statuses
- **Business Rule:** The operational lifecycle statuses for projects across the entire platform are strictly: **`Not Started`**, **`In Progress`**, and **`Completed`**.
- **Scope:** Project creation modal, Project list, Project filters, Dashboard metrics.
- **Dependencies:** `flwdsk_projects.status`.
- **Source:** Confirmed stakeholder decision (formally resolves `PROJECT-Q2`).
- **Decision Status:** Finalized.

#### BR-PRJ-005: Multi-Project Allocation Without Capacity Cap
- **Business Rule:** Employees may belong to and be allocated across **any number of concurrent projects**. There is **no project capacity limit** (no 100% allocation cap or overallocation restriction enforced).
- **Scope:** Resource allocation modal, Project assignment service.
- **Dependencies:** `flwdsk_resource_allocations`.
- **Source:** Confirmed stakeholder decision (formally resolves `PROJECT-Q5`).
- **Decision Status:** Finalized.

#### BR-PRJ-006: Project Details View Requirements
- **Business Rule:** The Project Details view must prominently display:
  1. The designated **Project Supervisor**.
  2. All **assigned Project Members**.
  Project members must be represented consistently for reporting who worked on each project.
- **Scope:** `ProjectDetailsPage.tsx`, Project members tab.
- **Dependencies:** `flwdsk_projects.supervisor_id`, `flwdsk_projects.member_ids`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-PRJ-007: Project Budget and Milestones De-scoping
- **Business Rule:** Project budget tracking and project milestone progression are **not required** and are formally excluded from current project management requirements.
- **Scope:** `flwdsk_projects.budget`, `flwdsk_milestones`.
- **Dependencies:** Project service.
- **Source:** Confirmed stakeholder decision (formally resolves `PROJECT-Q6` and `PROJECT-Q7`).
- **Decision Status:** Finalized.

#### BR-PRJ-008: Project Expense Association
- **Business Rule:** Employee expense claims incurred for a project must link directly to the relevant project through the project association field on the claim form.
- **Scope:** Expense claim form, Project financial summaries.
- **Dependencies:** `flwdsk_expense_claims.project_id`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-PRJ-009: Canonical Project Membership Storage (PROJECT-Q1)
- **Business Rule:**
  1. Existing Employees must be assigned to Projects.
  2. `flwdsk_resource_allocations` is the single canonical source for Project Membership.
  3. Project Members receive the approved permissions to create tasks, view relevant tasks, and access relevant project reports.
  4. Project membership must remain scoped to the assigned Project.
  5. `flwdsk_projects.member_ids` may be deprecated only after dependency review, data validation, and migration planning.
  6. Do not independently redesign the existing security or permission architecture.
- **Scope:** `ProjectModal.tsx`, `ResourceScheduler.tsx`, `useProject.ts`, `flwdsk_resource_allocations`.
- **Source:** Approved Stakeholder Decision (31 October 2026, `PROJECT-Q1`).
- **Decision Status:** Approved — Not Yet Implemented.

### Unverified Existing Behaviors
- **UEB-PRJ-001: Dual Member Storage Schema**
  - **Observed Behavior:** Projects store assigned team members both as a JSON string array (`flwdsk_projects.member_ids`) and as normalized relational rows in `flwdsk_resource_allocations`.
  - **Scope:** Database migrations and project repository.
  - **Source:** Migration `20260808190000_add_project_members.sql`.
  - **Status:** Unverified Existing Behavior (tracked under `PROJECT-Q1` in schema verification).

---

## Client Directory

### Finalized Business Rules

#### BR-CLIENT-001: Simplified Client Master Scope and Field Requirements
- **Business Rule:** The Client Directory is maintained strictly as a **simplified client contact register**:
  1. **Required Fields:** **Client Name** is strictly mandatory.
  2. **Optional Fields:** **Coordinator Name** and **Contact Number** are optional.
  3. **Exclusion of Complex Lifecycles:** Client lifecycle stages (`Lead`, `Active`, `Dormant`, `Terminated`) are **not introduced**.
  4. **Exclusion of Invoicing / Receivables:** Client invoicing and Accounts Receivable functionality are **strictly out of scope**.
- **Scope:** `/app/project/clients`, Client registration modal, client repository.
- **Dependencies:** `flwdsk_clients`.
- **Source:** Confirmed stakeholder decision (formally resolves `CLIENT-Q01`, `CLIENT-Q04`, `CLIENT-Q05`).
- **Decision Status:** Finalized.

#### BR-CLIENT-002: Editable Auto-Generated Client Code
- **Business Rule:** The Client Code (`code`) is **generated automatically** by the system, but **may be manually edited** by authorized users upon creation or update.
- **Scope:** Client registration modal, Client service.
- **Dependencies:** `flwdsk_clients.code`.
- **Source:** Confirmed stakeholder decision (formally resolves `CLIENT-Q03`).
- **Decision Status:** Finalized.

#### BR-CLIENT-003: Client Management Role Permissions
- **Business Rule:** Client creation, editing, and archival are restricted exclusively to **Category 1 users (`ADMIN`, `CEO`, `MANAGER`)**. Project Supervisors possess read-only visibility for clients linked to their supervised projects.
- **Scope:** Client directory routing, Client profile.
- **Dependencies:** Auth roles, `flwdsk_clients`.
- **Source:** Client Directory Audit Report.
- **Decision Status:** Finalized.

#### BR-CLIENT-004: Soft-Delete Client Archival
- **Business Rule:** Deleting a client record executes a soft-delete (`deleted_at = NOW()`). Client records with linked historical projects cannot be permanently purged from the database.
- **Scope:** Client repository, project integrity.
- **Dependencies:** `flwdsk_clients.deleted_at`.
- **Source:** Client Directory Audit Report.
- **Decision Status:** Finalized.

#### BR-CLIENT-005: Project-Scoped Client Contact Details Visibility for Assigned Team Members
- **Business Rule:** Employees actively assigned to a Project are **permitted to view the Client Contact Details** (Client Name, Coordinator Name, Contact Number, Official Email) associated with that specific Project.
- **Strict Project Boundary:** This visibility permission applies **strictly and exclusively** to the relevant Project and its linked client. Assigned employees are **not** granted access to client contact details for unrelated projects or the global unassigned client directory.
- **Reconciliation Note:** Reconciles the earlier observation in `BR-CLIENT-003` (which previously noted read-only visibility for Supervisors only) by explicitly extending project-scoped client contact visibility to assigned Project Members.
- **Security System Boundary:** This is recorded strictly as an approved business logic requirement and does not authorize direct code or RLS modifications as part of this documentation task.
- **Scope:** Project Details client card, Client repository access scope.
- **Dependencies:** `flwdsk_projects.client_id`, `flwdsk_project_members`, `flwdsk_clients`.
- **Source:** Confirmed stakeholder decision (formally resolves `CLIENT-Q02`).
- **Decision Status:** Finalized.

### Unverified Existing Behaviors
*No active unverified behaviors remaining for basic client management.*

---

## Finance & Expenses

### Finalized Business Rules

#### BR-FIN-001: Expense Claims Core Scope and Permanently Excluded Modules
- **Business Rule:** The active operational scope of the Finance module covers **employee expense claims, reimbursement totals, expense reports, and expense analytics**.
- **Permanently Excluded Modules:** Budget Management, Procurement & Purchase Orders, Asset Management, and Payroll Processing are **permanently excluded** from FlowDesk's planned scope. Dedicated UI screens, routes, services, hooks, and database tables for these excluded capabilities have been completely removed from the application.
- **Scope:** `/app/finance/*`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-FIN-002: Category 1 Expense Approval Hierarchy
- **Business Rule:** All employee operational expense claims and travel reimbursements are reviewed and approved directly by **Category 1 (`ADMIN`, `CEO`, `MANAGER`)**.
- **Conflict / Superseded Decision:** Formally **supersedes** the older Reporting Manager → CEO sequential approval chain documented in [`src/config/business-rules.ts:122`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L122).
- **Scope:** Expense claim submission, Approvals Queue.
- **Dependencies:** Auth roles (`ADMIN`, `CEO`, `MANAGER`).
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-FIN-003: Optional Receipt Attachment Policy
- **Business Rule:** Attaching physical receipts or invoice files to expense claims is **optional** under the latest confirmed business policy. Missing receipts do not block claim submission or approval.
- **Scope:** Expense claim entry modal, claim validation engine.
- **Dependencies:** `flwdsk_expense_claims.receipt_url`.
- **Source:** Confirmed stakeholder decision (formally resolves `EXPENSE-Q01`).
- **Decision Status:** Finalized.

#### BR-FIN-004: Claim Deletion and Visibility Permissions by Lifecycle State
- **Business Rule:** Deletion rights for expense claims adhere strictly to their lifecycle status:
  1. **Pending Claims:** Can be deleted directly by the **submitting employee**.
  2. **Rejected Claims:** Remain visible in the system and may be deleted only by **Category 1**.
  3. **Approved / Paid Claims:** May only be deleted by **Category 1**.
- **Scope:** Expense list view, claim actions, Approvals Queue.
- **Dependencies:** `flwdsk_expense_claims.status`, Auth roles.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-FIN-005: Expense Analytics Inclusion and Exclusion Criteria
- **Business Rule:** Expense analytics dashboards, KPI cards, and summary rollups strictly include **Approved** and **Pending** claims. **Rejected claims are strictly excluded** from all analytics charts and expenditure totals.
- **Scope:** `/app/finance/expense-analytics`, Expense dashboard.
- **Dependencies:** `flwdsk_expense_claims.status`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-FIN-006: Monthly Office Expenses Report
- **Business Rule:** The platform must generate a dedicated **Monthly Office Expenses Report** summarizing corporate office expenditures for executive review.
- **Scope:** Finance reports, executive summary dashboard.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-FIN-007: Standardized Expense Categories and Derived Self-Travel
- **Business Rule:** Operational expense claims categorize line items into: `'Self Travel'`, `'Morning Tea'`, `'Lunch'`, `'Evening Tea'`, `'Dinner'`, and `'Other'`. Each person's expense must be logged as a separate line entry.
- **Self-Travel Reimbursement Formula:**
  $$\text{Amount} = \text{Distance (km)} \times \text{RatePerKm}[\text{VehicleMode}]$$
  Baseline rates are: **Bike: ₹3.00/km**; **Car: ₹9.50/km** (CEO-editable).
- **Scope:** Expense claim submission, CEO summary report.
- **Dependencies:** `src/config/business-rules.ts:126-143`.
- **Source:** Stakeholder Confirmation.
- **Decision Status:** Finalized.

#### BR-FIN-008: Unrestricted Expense Submission and Advance Settlement Timeline
- **Business Rule:** Employees may submit operational expense-related claims or advance settlement details **at any time**. There is **no fixed submission deadline, mandatory number of days, elapsed-day cutoff (e.g., no 7, 14, or 30-day limit), or project-completion deadline** imposed on expense claim submissions or cash advance reconciliations.
- **Accounting & Approval Boundary:** This rule provides operational flexibility for expense entry and advance settlement; it does not alter existing expense approval hierarchies (`BR-FIN-002`), claim deletion rules (`BR-FIN-004`), reimbursement payments, or general accounting ledger audit processes.
- **Scope:** Expense claim submission form, Advance reconciliation reports.
- **Dependencies:** `flwdsk_expense_claims.advances`.
- **Source:** Confirmed stakeholder decision (formally resolves `EXPENSE-Q02`).
- **Decision Status:** Finalized.

### Unverified Existing Behaviors
- **UEB-FIN-001: Google Drive Receipt Metadata Storage**
  - **Observed Behavior:** Receipts uploaded on expense claims store Google Drive IDs and view URLs in `flwdsk_expense_claims.receipt_url`.
  - **Scope:** `src/shared/integration/google.ts`.
  - **Status:** Unverified Existing Behavior.

---

## Training and Training Calendar

### Finalized Business Rules

#### BR-TRN-001: Operational Scope of Training Module
- **Business Rule:** The active operational scope of the Training module in FlowDesk strictly covers:
  1. **Employee training batch scheduling** and management.
  2. **Trainer assignment** and availability tracking.
  3. **Batch attendance** tracking for scheduled sessions.
  4. **Batch expense tracking and analytics** (aggregating trainer travel/operational claims).
  5. **Student count / enrollment information only where required by current batch workflows** (e.g., computing "Cost Per Student" in batch expense analytics and populating session attendance rows).
- **Future Separate Initiative:** Comprehensive Student Training Management (student lifecycle and detailed student records, student assessments/marks/grades, public exam portal, external student exam submissions, voucher workflows, and commercial student enrollment/fee management) is a separate, future product initiative.
- **Component Classification & Preservation:** Existing code and database objects for Student Lifecycle are classified as *Shared / Uncertain* pending a separate stakeholder decision. Assessment Board and Public Exam Portal are classified as *Future Student Training Management capabilities* (not approved current FlowDesk office workflows). All existing code and data structures are strictly preserved in the repository without deletion.
- **Scope:** `/app/training/*`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-TRN-002: Training Batch Lifecycle Authority (TRAIN-Q02)
- **Business Rule:** Authorized roles for changing Training Batch status are:
  - **Managers**
  - **Admins**
  - **Assigned Trainers**
- **Lifecycle Stages:** All three roles may transition a batch through:
  `Scheduled → In Progress → Completed → Closed`
- **Scope:** `BatchManagement.tsx`, `training.service.ts`, `flwdsk_batches.status`.
- **Source:** Approved Stakeholder Decision (31 October 2026, `TRAIN-Q02`).
- **Decision Status:** Approved — Not Yet Implemented.

#### BR-CAL-001: Training Schedule Planner Purpose
- **Business Rule:** The Training Calendar is dedicated strictly as a **training schedule planner** for trainer-to-batch allocations, not a generic company-wide calendar.
- **Scope:** `/app/training/calendar`, `TrainingCalendar.tsx`.
- **Dependencies:** `flwdsk_calendar_sessions`, `flwdsk_employees`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-CAL-002: Universal Schedule Management Rights
- **Business Rule:** **All employees** (Trainers, Employees, Category 1) possess permissions to **create, modify, copy, and delete** training schedules on the planner.
- **Scope:** `TrainingCalendar.tsx`, `TrainingService.saveCalendarSession()`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-CAL-003: Schedule Audit Tracking Metadata
- **Business Rule:** The system records the **creator ID and creation timestamp**, plus the **last editor ID and last edit timestamp** on each calendar session record.
- **No Value History Chain:** Full before-and-after historical value change logs are **not retained or displayed**.
- **Scope:** `flwdsk_calendar_sessions`, Audit logging.
- **Dependencies:** `flwdsk_calendar_sessions.created_by`, `flwdsk_calendar_sessions.updated_by`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-CAL-004: Chronological Ordering, Drag-and-Drop, and Multi-Date Copying
- **Business Rule:** Sessions are displayed in strict chronological order. The planner fully supports **drag-and-drop rescheduling**, single session copying, and **multi-date copying**.
- **Scope:** `TrainingCalendar.tsx`, `MatrixCell`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-CAL-005: Conflict Management and Notification (No Silent Blocking)
- **Business Rule:** Overlapping sessions scheduled for the same trainer at the same time must be flagged as a **Double Booking conflict**, and an automated alert is dispatched to the scheduler and **Admin**.
- **Prohibition:** The system must **never automatically reschedule, move, or silently block** overlapping sessions.
- **Scope:** `TrainingCalendar.tsx`, `schedule.data.ts`.
- **Dependencies:** `detectConflicts()`, `flwdsk_notifications`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-CAL-006: Approved Leave Blocking and Post-Schedule Leave Conflicts
- **Business Rule:** Leave conflict rules on the Training Calendar operate as follows:
  1. An approved leave record in `flwdsk_leave_records` **strictly blocks the creation of a new trainer schedule** on that date.
  2. If a leave application is approved **after** a schedule has already been created, the existing schedule is **preserved**, the conflict is flagged on the planner, and an alert is dispatched to the scheduler.
- **Scope:** `TrainingCalendar.tsx`, `TrainingService.saveCalendarSession()`.
- **Dependencies:** `flwdsk_leave_records`.
- **Source:** Confirmed stakeholder decision (formally resolves `CAL-Q03`).
- **Decision Status:** Finalized.

#### BR-CAL-007: Resilient Multi-Date Copy Handling
- **Business Rule:** When a schedule is copied across multiple dates, valid non-conflicting dates are created successfully, while any conflicting dates are flagged without aborting the entire batch copy operation.
- **Scope:** Schedule copy modal, `TrainingCalendar.tsx`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-CAL-008: Schedule Deletion Isolation
- **Business Rule:** Deleting a calendar schedule must **never delete or cascade to linked Attendance records, Expense claims, or other historical operational data**.
- **Scope:** `TrainingService.deleteCalendarSession()`, database foreign keys.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-CAL-009: Clock-In Training Batch Prioritization
- **Business Rule:** When an employee clocks in for Work Type = `'Training'`, the batches scheduled on the Training Calendar for that day are displayed **at the top of the batch selector in chronological order**.
- **No Strict Restriction:** The system does **not strictly restrict** selection against other active batches; unassigned batches remain accessible below the scheduled batches.
- **Scope:** `MyDayPage.tsx`, Clock-In batch dropdown.
- **Dependencies:** `flwdsk_calendar_sessions`, `MyDayPage.tsx`.
- **Source:** Confirmed stakeholder decision (formally resolves `CAL-Q02`).
- **Decision Status:** Finalized.

#### BR-CAL-010: Canonical Training Session Storage and Consolidation (CAL-Q01)
- **Business Rule:** Option B is approved. `flwdsk_schedule_sessions` becomes the single canonical table for Training Calendar planning, scheduling, and attendance.
- **Migration & Consolidation Requirements:**
  1. Add necessary planning fields (`session_title`, `start_time`, `end_time`, `venue`, `mode`, `color`) to `flwdsk_schedule_sessions` through an appropriately validated migration.
  2. Preserve all existing Calendar session records and Attendance records.
  3. Trainer My Day (`MyDayPage.tsx`), Training Calendar (`TrainingCalendar.tsx`), and Attendance Log (`AttendanceLogPage.tsx`) must use the same canonical session records.
  4. Preserve existing security policies and RLS.
  5. Review all dependencies before changing existing workflows.
  6. Validate migration and regression tests before deprecating `flwdsk_calendar_sessions`.
  7. Do not implement yet (scheduled for rework).
- **Scope:** `flwdsk_schedule_sessions`, `TrainingCalendar.tsx`, `MyDayPage.tsx`, `AttendanceLogPage.tsx`, `training.service.ts`.
- **Source:** Approved Stakeholder Decision (31 October 2026, `CAL-Q01`).
- **Decision Status:** Approved — Not Yet Implemented.

### Unverified Existing Behaviors
- **UEB-CAL-001: Drag-and-Drop Direct Supabase Mutation**
  - **Observed Behavior:** Moving a session via drag-and-drop executes `supabase.from('flwdsk_calendar_sessions').update(...)` directly from the UI component, bypassing the service layer and audit logging.
  - **Scope:** `TrainingCalendar.tsx:687-690`.
  - **Status:** Unverified Existing Behavior (requires service layer routing).

---

## Communication & Notifications

### Finalized Business Rules

#### BR-COMM-001: Chat Message and Attachment Retention Policies
- **Business Rule:** Communication retention policies are established as follows:
  1. **Chat Messages:** Retained in the database for **one year**, after which they may be purged/archived.
  2. **File Attachments:** Uploaded to Google Drive and automatically deleted after **14 days**.
- **Scope:** Internal team chat channels, Google Drive storage.
- **Dependencies:** `flwdsk_chat_messages`, Google Drive cleanup routine.
- **Source:** Confirmed stakeholder decision (formally resolves `COMM-Q01`).
- **Decision Status:** Finalized.

#### BR-COMM-002: Message Edit and Deletion Transparency
- **Business Rule:** Users may edit or delete their chat messages. When a message is edited, an **edit history badge/timestamp remains visible**.
- **Scope:** Chat message component, chat repository.
- **Dependencies:** `flwdsk_chat_messages.is_edited`, `flwdsk_chat_messages.edited_at`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-COMM-003: Cross-Device Read Receipt Synchronization
- **Business Rule:** Message read receipts must synchronize across all active devices and sessions for each user.
- **Scope:** Chat engine, real-time subscription.
- **Dependencies:** `flwdsk_chat_read_receipts`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-COMM-004: Browser Notification Scope and Channel Exclusions
- **Business Rule:** In-app browser notifications operate **only while the browser tab is open**. Background push notifications with the browser closed, SMS text notifications, and WhatsApp messaging are **strictly out of scope**.
- **Scope:** `NotificationProvider.tsx`, Browser Web Notifications API.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

#### BR-COMM-005: Outbound Emails and Reminders De-scoping
- **Business Rule:** Outbound email delivery configuration and standalone reminder automation are **formally out of current scope**.
- **Scope:** `/app/communication/emails`, `/app/communication/reminders`.
- **Source:** Confirmed stakeholder decision.
- **Decision Status:** Finalized.

### Unverified Existing Behaviors
- **UEB-NOTIF-001: In-App Notification Dispatch**
  - **Observed Behavior:** Task assignments, rework requests, and leave status updates dispatch in-app notifications to `flwdsk_notifications` with `read = false`.
  - **Scope:** Notification engine.
  - **Source:** [`src/core/engines/notification.ts`](file:///Users/apple/Downloads/flow-desk-main/src/core/engines/notification.ts).
  - **Status:** Unverified Existing Behavior.

---

## Profile & Dashboard

### Finalized Business Rules
*No finalized dashboard business rules have been formally locked by stakeholders yet.*

### Unverified Existing Behaviors
- **UEB-DASH-001: Role-Based Dashboard View**
  - **Observed Behavior:** `/app` dynamically renders distinct layout widgets based on whether the active user role is executive (`ADMIN`, `CEO`), managerial (`MANAGER`), or staff (`EMPLOYEE`, `TRAINER`).
  - **Scope:** Dashboard routing shell.
  - **Source:** [`src/modules/dashboard/pages/DashboardPage.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/dashboard/pages/DashboardPage.tsx).
  - **Status:** Unverified Existing Behavior.

---

## Application-Wide Rules

### Finalized Business Rules

#### BR-APP-001: Public Holiday Management and Tracking
- **Business Rule:** Public and declared company holidays can be added, updated, or removed exclusively by users holding the **`ADMIN`**, **`CEO`**, or **`MANAGER`** role. When an employee clocks in and works on an official holiday, the attendance log must explicitly flag the record as **`"Holiday Worked"`**.
- **Scope:** Calendar management, attendance engine, monthly attendance report.
- **Conditions and Exceptions:** Working on a holiday does not prevent attendance logging; it is highlighted for management audit.
- **Dependencies:** `flwdsk_declared_holidays`, `flwdsk_attendance_records`.
- **Source:** [`src/config/business-rules.ts:170-175`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L170-L175).
- **Decision Status:** Finalized.

#### BR-APP-002: Default Page and Query Constraints
- **Business Rule:** Global data tables and list queries default to a page size of **20 records**, with an absolute upper bound of **200 records per query**. Unbounded table scans (`pageSize > 200` or unrestricted queries) are prohibited in production data access routines.
- **Scope:** Data repositories, API clients.
- **Conditions and Exceptions:** Exports require chunked/streaming pagination.
- **Dependencies:** Supabase data repositories.
- **Source:** [`src/config/business-rules.ts:184-186`](file:///Users/apple/Downloads/flow-desk-main/src/config/business-rules.ts#L184-L186).
- **Decision Status:** Finalized.

#### BR-APP-003: Category 1 Universal Approval Authority Across All Modules
- **Business Rule:** Category 1 consists of **`ADMIN`**, **`CEO`**, and **`MANAGER`**. Every individual Category 1 member possesses full authority to review, approve, or reject **all Approval Requests** across all application modules (Leaves, Tasks, Attendance Corrections / Force Clock-Outs, Expenses). Procurement has been permanently excluded from product scope.
- **Interchangeability & Absence Delegation:** If one Category 1 member is unavailable, out of the office, or on approved leave, **another Category 1 member can handle and decide the request**. Approval requests **must never be blocked or stalled** waiting for a specific Category 1 individual to return.
- **Cross-Module Consistency:** This rule applies consistently across all approval workflows in FlowDesk.
- **Security Boundary Note:** Recorded as a confirmed business requirement without altering application RLS policies, permissions, or backend services during this task.
- **Scope:** Approvals Queue, Workflow Engine, Notification routing.
- **Dependencies:** Auth roles (`ADMIN`, `CEO`, `MANAGER`), Approvals Queue.
- **Source:** Confirmed stakeholder decision (formally resolves `APPROVAL-Q01`).
- **Decision Status:** Finalized.

### Unverified Existing Behaviors
- **UEB-APP-001: Universal Authenticated RLS Blanket**
  - **Observed Behavior:** Database tables use permissive RLS policies allowing full read/write access to any user authenticated via Supabase (`auth.role() = 'authenticated'`).
  - **Scope:** PostgreSQL schema.
  - **Source:** `20260724000000_production_schema_alignment.sql:748`.
  - **Status:** Unverified Existing Behavior (flagged as critical security defect `BUG-PROJECT-006`).

---
---

# 2. Clarification Required

This section catalogs all remaining questions, cleanly grouped into:
1. **Genuinely Unresolved Business Policy Questions (Active Scope)**
2. **Questions Concerning Modules Out of Current Scope / Deferred**
3. **Production Environment, Security & Database Schema Verification Questions**

Questions resolved by recent stakeholder decisions (including `ES-Q1`, `ES-Q2`, `ES-Q3`, `ATT-Q1`, `ATT-Q2`, `LEAVE-Q1`, `LEAVE-Q3`, `LEAVE-Q7`, `TASK-Q1` through `TASK-Q6`, `PROJECT-Q2` through `PROJECT-Q7`, `CLIENT-Q01` through `CLIENT-Q05`, `EXPENSE-Q01`, `CAL-Q02`, `CAL-Q03`, `COMM-Q01`, and `TS-Q01` through `TS-Q06`) have been removed from this pending register and formally documented under Section 1.

---

## Part A: Genuinely Unresolved Business Policy Questions (Active Scope)

*Recent Reconciliation Note: The policy decisions for new joiner leave entitlement baseline, probation exclusion, calendar-month duration calculation, automatic completion, Leave Accrual Start Date determination, partial-month day-proportion formula, and half-day rounding rules have been confirmed by stakeholders. Consequently, **`LEAVE-Q4A` is fully resolved** (formally documented under `BR-LEAVE-011`, `BR-LEAVE-013`, `BR-EMP-002`, and `BR-EMP-003`).*

*Status: **All active scope business policy questions have been fully resolved by confirmed stakeholder decisions.** On 31 October 2026, `TRAIN-Q02` was formally approved. Zero active-scope business policy questions remain pending.*

### TRAIN-Q02: Batch Lifecycle Progression Authority [RESOLVED — APPROVED]
- **Question ID:** `TRAIN-Q02`
- **Module:** Training Batches (In-Scope Workflow)
- **Question:** Who has authority to transition an existing Training Batch through `Scheduled → In Progress → Completed → Closed`?
- **Stakeholder Decision (31 Oct 2026):** **Approved.** Authorized roles for changing Training Batch status are:
  - **Managers**
  - **Admins**
  - **Assigned Trainers**
  All three roles may transition a batch through: `Scheduled → In Progress → Completed → Closed`.
- **Status:** Approved — Not Yet Implemented (documented under `BR-TRN-002`).

### LEAVE-Q4A: Pro-Rata Leave Calculation Method & Rounding Formula for New Joiners [RESOLVED]
- **Question ID:** `LEAVE-Q4A`
- **Module:** Leave Management
- **Original Question:** While the policy of pro-rata leave allocation for new joiners is confirmed (`BR-LEAVE-011`), what exact mathematical calculation formula should be used (monthly vs daily, rounding rule, joining cutoff, probation unlocking)?
- **Resolution Summary:** Fully resolved by confirmed stakeholder decisions:
  1. *Baseline Entitlement:* 1 day of Annual Leave per month (12 days per full FY ending March 31). Documented under `BR-LEAVE-011`.
  2. *Probation Period:* Zero leave accrues during probation. Accrual begins on the Leave Accrual Start Date (day immediately after final day of probation). Documented under `BR-LEAVE-011`.
  3. *Probation Calculation & Auto-Completion:* Calculated using the calendar-month method (e.g., Jan 15 joining with 3 months probation -> final day April 14, completion April 15, accrual start April 15). Automatically completes on the scheduled date without manual confirmation, even if employee is Suspended (lifecycle status unchanged). Documented under `BR-EMP-002` and `BR-EMP-003`.
  4. *Partial-Month Formula:* Count eligible calendar days inclusively from the Leave Accrual Start Date through the end of the month, divide by total days in that month, and multiply by 1 day. Documented under `BR-LEAVE-013`.
  5. *Rounding Rule:* Rounded to the nearest 0.5-day increment, with a minimum positive allocation of 0.5 day for positive values (0.25 -> 0.5, 0.50 -> 0.5, 0.75 -> 1.0, 1.0 -> 1.0). Documented under `BR-LEAVE-013`.
- **Status:** Resolved (Documented under `BR-LEAVE-011`, `BR-LEAVE-013`, `BR-EMP-002`, and `BR-EMP-003`).

---

## Part B: Permanently Excluded Modules & Future Product Planning

### Scope Exclusion Record: Permanently Excluded Modules
The following four modules are **permanently excluded from FlowDesk's planned product scope** (not merely postponed or deferred):
1. **Budget Management** (Budget Allocation, Variance Tracking, and Rollover)
2. **Procurement and Purchase Orders** (Purchasing, Vendor Rosters, and PO Workflows)
3. **Asset Management** (Hardware/Software Inventory, Warranties, and Physical Verification)
4. **Payroll Processing** (Salary Structures, Base Pay, Allowances, Deductions, and Payslip Generation)

*Audit Record & Status:*
- All dedicated UI pages (`BudgetsConsole.tsx`, `ProcurementBoard.tsx`, `AssetInventory.tsx`, `PayrollPrep.tsx`), navigation items, feature flags, routes, repositories, services, and hooks (`useFinance.ts`) have been completely removed from the application.
- Dedicated database tables (`flwdsk_budgets`, `flwdsk_vendors`, `flwdsk_purchase_orders`, `flwdsk_assets`, `flwdsk_salary_structures`) are dropped via explicit versioned migration `20261029000000_remove_excluded_modules_tables.sql`.
- Previous clarification questions (`BUDGET-Q01`, `BUDGET-Q02`, `PROC-Q01`, `ASSET-Q01`, `PAYROLL-Q01`) are formally archived and closed as permanently out of scope.

#### Archived Clarifications for Permanently Excluded Modules:
- **BUDGET-Q01: Multi-Year / Rollover Budget Policy** — *Closed / Permanently Excluded from FlowDesk.*
- **BUDGET-Q02: Budget Overspend Enforcement** — *Closed / Permanently Excluded from FlowDesk.*
- **PROC-Q01: Purchase Order Budget Gating** — *Closed / Permanently Excluded from FlowDesk.*
- **ASSET-Q01: Asset Physical Verification Frequency** — *Closed / Permanently Excluded from FlowDesk.*
- **PAYROLL-Q01: Salary Component Configurations and Payslip Generation** — *Closed / Permanently Excluded from FlowDesk (payrollEnabled: false).*

---

### Future Product Planning: Student Training Management
The business intends to plan and develop a separate **Student Training Management** capability in the future as an independent product initiative.

#### 1. Scope Boundary Formalization:
- **Current FlowDesk Scope:**
  - Employee training batch scheduling
  - Trainer assignment
  - Batch attendance
  - Batch expense tracking and analytics
  - Student count / enrollment information only where required by current batch workflows (e.g., computing "Cost Per Student" in batch expense analytics and populating session attendance rows)
- **Future Separate Student Training Management Initiative:**
  - Student lifecycle and detailed student records
  - Student assessments, marks, and grades
  - Public exam portal
  - External student exam submissions and voucher workflows
  - Commercial student enrollment and fee management

#### 2. Component & Artifact Classification Record:
- **Student Lifecycle (`StudentLifecycle.tsx`, `flwdsk_student_records`, `flwdsk_enrollments`):**
  - *Classification:* **Shared / Uncertain** pending a separate stakeholder decision.
  - *Rationale & Evidence:* The active batch expense analytics (`BatchExpenseDetailsDrawer.tsx`) and session attendance sheet (`StudentAttendance.tsx`) read `studentCount` and `enrollments` for in-scope batch operations. However, candidate onboarding fields (guardians, academic qualifications, employment status) belong to commercial training. Existing code and data are preserved without deletion.
- **Assessment Board (`AssessmentBoard.tsx`, `flwdsk_assessments`):**
  - *Classification:* **Future Student Training Management Capability** (not an approved current FlowDesk internal office workflow).
  - *Rationale & Evidence:* Manages coursework evaluation and student grades. No core internal office workflows (employees, attendance, leaves, projects, timesheets, expenses) depend on this functionality. Preserved in repository without deletion pending future migration.
- **Public Exam Portal (`ExamSubmissionPage.tsx`, `FinalExamModule.tsx`, `/submit-exam`, `flwdsk_vouchers`, `flwdsk_exam_attempts`):**
  - *Classification:* **Future Student Training Management Capability** (not an approved current FlowDesk internal office workflow).
  - *Rationale & Evidence:* Unauthenticated public portal allowing external students from colleges to submit exam marks and vouchers. Completely separate from internal company operations. Preserved in repository without deletion pending future migration.

#### 3. Current Architectural & Data Boundary:
1. No student marks, assessment management, or new student workflows are implemented in FlowDesk.
2. No speculative database tables, APIs, UI screens, permissions, or abstractions are created.
3. Existing employee Training Batch functionality (batches, trainer calendar, attendance, expense allocations, and related reports) required by current active workflows is strictly preserved.
4. Existing code, routes, and database tables for Student Lifecycle, Assessment Board, and Public Exam Portal are strictly retained and NOT deleted during this documentation task.
5. The platform retains extensible boundaries so the separately designed Student Training Management system can be split or integrated later without architectural disruption.

#### 4. Future Planning Clarifications:
- **TRAIN-Q01: Student Attendance Compatibility Cache Recalculation Threshold**
  - *Question ID:* `TRAIN-Q01`
  - *Module:* Student Training Management (Future Planning Item)
  - *Question:* What is the intended policy threshold for student batch attendance compliance, and should attendance percentage be computed purely dynamically from `flwdsk_schedule_sessions` rather than stored in a cached column?
  - *Status:* Future Product Planning Item
- **EXAM-Q01: Public Student Exam Portal Rate Limiting and Token Expiration**
  - *Question ID:* `EXAM-Q01`
  - *Module:* Student Training Management (Future Planning Item)
  - *Question:* What token expiration window and rate limiting policies should govern external student exam mark submissions on `/submit-exam`?
  - *Status:* Future Product Planning Item

---

## Part C: Production Environment, Security & Database Schema Verification Questions

*These questions pertain to live cloud infrastructure, deployment environment variables, and database schema normalization. They are technical verification tasks rather than business-policy decisions.*

### STARTUP-Q1: Production Vercel Auth Mode Configuration
- **Question ID:** `STARTUP-Q1`
- **Category:** Infrastructure / Environment Configuration
- **Question:** Is `VITE_AUTH_MODE` set to `jwt` or `legacy` in the Vercel production deployment environment variables?
- **Why It Matters:** Confirms the exact execution path causing intermittent HTTP 500 errors on `/app`.
- **Dependencies:** Supabase Auth Edge Functions, `buildSession()` in `supabase-auth.service.ts`.
- **Status:** Production Verification Required

### STARTUP-Q2: Migration Parity in Production Database
- **Question ID:** `STARTUP-Q2`
- **Category:** Infrastructure / Database Migration Parity
- **Question:** Have all schema migrations (specifically `20260808180000_phase_6_44_auth_refresh_tokens.sql` and `20260808190000_add_project_members.sql`) been executed in production Supabase, or is the live database lagging behind the codebase?
- **Why It Matters:** Root cause confirmation for intermittent crashes caused by missing database columns.
- **Dependencies:** Supabase production migration status.
- **Status:** Production Verification Required

### PROJECT-Q1: Canonical Storage of Project Team Members [RESOLVED — APPROVED]
- **Question ID:** `PROJECT-Q1`
- **Category:** Database Schema Normalization / Project Team Members
- **Question:** Where should project member assignments canonically reside in the database: normalized in `flwdsk_resource_allocations` (which supports capacity percentage and roles), or as a JSON string array on `flwdsk_projects.member_ids`?
- **Stakeholder Decision (31 Oct 2026):** **Approved.**
  - Existing Employees must be assigned to Projects.
  - `flwdsk_resource_allocations` is the single canonical source for Project Membership.
  - Project Members receive the approved permissions to create tasks, view relevant tasks, and access relevant project reports.
  - Project membership must remain scoped to the assigned Project.
  - `flwdsk_projects.member_ids` may be deprecated only after dependency review, data validation, and migration planning.
  - Do not independently redesign the existing security or permission architecture.
- **Status:** Approved — Not Yet Implemented (documented under `BR-PROJ-004`).

### CAL-Q01: Database Unification of Training Sessions [RESOLVED — APPROVED]
- **Question ID:** `CAL-Q01`
- **Category:** Database Schema Normalization / Training Sessions
- **Question:** Should `flwdsk_calendar_sessions` (trainer calendar plans) and `flwdsk_schedule_sessions` (student attendance logs) be unified into a normalized relational model, or formally separated with renamed tables?
- **Stakeholder Decision (31 Oct 2026):** **Option B Approved.**
  - `flwdsk_schedule_sessions` becomes the single canonical table for Training Calendar planning, scheduling, and attendance.
  - Add the necessary planning fields (`session_title`, `start_time`, `end_time`, `venue`, `mode`, `color`) to the canonical table through an appropriately validated migration.
  - Preserve existing Calendar session records and Attendance records.
  - Trainer My Day, Training Calendar, and Attendance Log must use the same canonical session records.
  - Preserve existing security policies and RLS.
  - Review all dependencies before changing existing workflows.
  - Validate migration and regression tests before deprecating `flwdsk_calendar_sessions`.
  - Do not implement yet.
- **Status:** Approved — Not Yet Implemented (documented under `BR-CAL-010`).

### EMP-Q01: Database Schema Support for Configurable Employee Probation & Accrual Dates [RESOLVED — APPROVED]
- **Question ID:** `EMP-Q01`
- **Category:** Database Schema & Architecture Verification / Employee Probation
- **Stakeholder Decision (31 Oct 2026):** **Approved.**
  - **Probation End Date is the authoritative stored value.**
  - **Probation Duration must be calculated dynamically from the End Date.**
  - **Displayed decimal duration may be rounded** (e.g., to one decimal place).
  - **Display rounding must never modify the authoritative End Date.**
  - **Editing and saving an employee record must preserve the original End Date unless an authorized user explicitly changes it.**
- **Enforcement Rules:**
  - Enforces bidirectional synchronization between probation duration (including fractional months) and end date in the Employee Add and Edit UI workflows (`BR-EMP-002`).
  - Supports employees with no probation (`0` or blank/null) without fabricating dangling probation end dates or completion timestamps.
  - Automates scheduled probation completion without manual managerial sign-off, even when an employee is in Suspended status (`BR-EMP-003`).
  - Enables deterministic, automated calculation of new joiner pro-rata annual leave quotas starting exclusively on the Leave Accrual Start Date through the end of the Financial Year on March 31 (`BR-LEAVE-011`, `BR-LEAVE-013`).
- **Read-Only / Implementation Boundary Notice:**
  - Approved for tomorrow's rework plan (`RWK-003`). No database schemas or records were modified during this documentation activity.
- **Status:** Approved — Not Yet Implemented (documented under `BR-EMP-002`).
