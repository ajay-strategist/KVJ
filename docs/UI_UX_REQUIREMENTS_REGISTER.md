# FlowDesk UI/UX Requirements Register

**Document Identifier:** DOC-UIUX-001  
**Version:** 3.0 (Master Authoritative Register — Batches 01 & 02 Consolidated)  
**Status:** Permanent Requirements Register — Gated for Phase 7 Implementation  
**Effective Date:** 2026-11-01  
**Project:** FlowDesk (`flow-desk-main`)  
**Scope:** UI/UX Requirements Batch 01 (`UIUX-REQ-001` through `UIUX-REQ-010`) & Batch 02 (`UIUX-REQ-011` through `UIUX-REQ-020`)

---

## 1. Register Purpose & Scope Governance

This document serves as the permanent, authoritative requirements register for all UI/UX enhancements and user interface modifications across the 20 active modules of FlowDesk.

### Scope Governance Rules:
1. **Strict Documentation & Evaluation Mode:** No UI/UX implementation may precede the stabilization of Phase 1 critical operational reliability.
2. **Phase 7 Implementation Mapping:** All approved UI/UX enhancements are provisionally scheduled for **Phase 7 (Dynamic Imports, Export Splitting & Approved UI/UX Enhancements)**.
3. **Preservation of Approved Business Rules:** UI/UX changes must never weaken, bypass, or alter approved business rules (`TRAIN-Q02`, `EMP-Q01`, `PROJECT-Q1`, `CAL-Q01`, `BR-TASK-007`, `BR-ATT-004`).
4. **Mandatory UI Preservation Guardrails (`UIUX-REQ-004`):** Attendance Details Log (`AttendanceLogPage.tsx`), Attendance Panel Calendar (`AttendanceCalendarView.tsx`), and Expense Summary (`ExpenseClaims.tsx`) must remain visually and structurally intact.
5. **Form-to-Database Parity Guarantee (`UIUX-REQ-012`):** Redesigns must preserve 100% of existing functional fields, validations, and database mappings. No speculative new fields or missing columns permitted.
6. **Restrained Animation & Accessibility:** Transitions must use GPU-only properties (`transform`, `opacity`) with durations $\le 200\text{ms}$, fully respecting `@media (prefers-reduced-motion: reduce)`.

---

## 2. Master Summary Table: Batches 01 & 02 (All 20 Requirements)

| Req ID | Title | Primary Module | Affected File(s) | Priority | Approval Status |
|---|---|---|---|---|---|
| **`UIUX-REQ-001`** | Sidebar Collapse Control (Remove Shortcut Indicator) | Navigation & Shell | `src/shared/layout/AppShell.tsx` | Low | **APPROVED** |
| **`UIUX-REQ-002`** | Personal Today's Tasks Ordering & Priority | My Day Workspace | `src/app/pages/workspaces/MyDayPage.tsx` | High | **APPROVED** |
| **`UIUX-REQ-003`** | Announcements & Notices Lifecycle (My Day & Board) | Communication | `MyDayPage.tsx`, Announcements Board | Medium | **APPROVED** |
| **`UIUX-REQ-004`** | Mandatory UI Preservation (Attendance & Expense) | Attendance & Finance | `AttendanceLogPage`, `AttendanceCalendarView`, `ExpenseClaims` | Critical | **APPROVED (MANDATE)** |
| **`UIUX-REQ-005`** | Leave Management Improvements (Filters & Highlight) | Leave Management | `src/modules/leave/pages/LeaveBoard.tsx` | High | **APPROVED** |
| **`UIUX-REQ-006`** | Apply for Leave Form Redesign | Leave Management | `src/modules/leave/forms/ApplyLeaveModal.tsx` | Medium | **APPROVED** |
| **`UIUX-REQ-007`** | Approvals Queue & Attendance Corrections UI | Approvals Queue | `src/modules/attendance/pages/ApprovalsQueue.tsx` | High | **APPROVED** |
| **`UIUX-REQ-008`** | Employee Idle-Time Admin Notification | Attendance Monitoring | `src/app/pages/workspaces/MyDayPage.tsx` | High | **APPROVED** |
| **`UIUX-REQ-009`** | Batch Management Improvements & Sorting | Training Operations | `BatchManagement.tsx`, `TrainingBatchCarousel.tsx` | High | **APPROVED (`CONF-001` Resolved)** |
| **`UIUX-REQ-010`** | Add/Edit Training Batch Forms & Expense Details | Training Operations | `BatchManagement.tsx`, `BatchExpenseDetailsDrawer.tsx` | High | **APPROVED** |
| **`UIUX-REQ-011`** | Create New Task Form Redesign | Project Management | `src/modules/project/forms/TaskFormModal.tsx` | High | **APPROVED** |
| **`UIUX-REQ-012`** | Comprehensive Form-to-Database Persistence Audit | Cross-Module Forms | 8 Core Application Forms | Critical | **APPROVED (AUDIT MANDATE)** |
| **`UIUX-REQ-013`** | Clock-In Panel Redesign & Geolocation Accuracy | Attendance | `src/app/pages/workspaces/MyDayPage.tsx` | High | **APPROVED** |
| **`UIUX-REQ-014`** | Training Calendar Usability, Copy/Paste & Duplication Guard | Training Operations | `src/modules/training/pages/TrainingCalendar.tsx` | High | **APPROVED** |
| **`UIUX-REQ-015`** | Projects & Tasks Redesign (Filters & KPI Removal) | Project Management | `src/modules/project/pages/ProjectList.tsx` | Medium | **APPROVED** |
| **`UIUX-REQ-016`** | Tasks Tab KPI Removal & Active Focus View | Project Management | `src/modules/project/pages/TaskBoard.tsx` | Medium | **APPROVED** |
| **`UIUX-REQ-017`** | Expenses & Travel Redesign & Rate Propagation | Finance Operations | `src/modules/finance/pages/ExpenseClaims.tsx` | High | **APPROVED** |
| **`UIUX-REQ-018`** | Expense Analytics Complete Specification (16 Metrics) | Finance Operations | `src/modules/finance/pages/ExpenseAnalyticsPage.tsx` | Critical | **APPROVED (DETAILED SPEC)** |
| **`UIUX-REQ-019`** | Announcements Board Simplification & Archive | Communication | `src/modules/communications/` | Medium | **APPROVED** |
| **`UIUX-REQ-020`** | Mobile Application Operational Modernization | Mobile Application | `Mobile App/` (React Native / Expo) | High | **APPROVED (SEPARATE TRACK)** |

---

## 3. Batch 01 Detailed Specifications (`UIUX-REQ-001` to `UIUX-REQ-010`)

### `UIUX-REQ-001` — Sidebar Collapse Control (Remove Shortcut Indicator)
* **Screen:** Application Shell (`src/shared/layout/AppShell.tsx#L518-L535`).
* **Current Behavior:** Renders `<kbd style={{ ... }}>[</kbd>` beside `"Collapse Sidebar"`.
* **Expected Behavior:** Remove the unnecessary `[` keyboard shortcut indicator badge completely.
* **Preservation:** Preserve `"Collapse Sidebar"` text, chevron icon, collapse toggle, and keyboard shortcut event handler. Zero unrelated sidebar changes.
* **Status:** **APPROVED**.

### `UIUX-REQ-002` — Personal Today's Tasks Ordering & Priority
* **Screen:** My Day Workspace (`src/app/pages/workspaces/MyDayPage.tsx` — `TaskWidget`).
* **Current Behavior:** Tasks stored in global un-scoped `localStorage` key (`kvj_task_order_v1`). New tasks append to bottom.
* **Expected Behavior:**
  1. Newly created tasks immediately prepend to index 0 (top) of the personal list.
  2. Drag-and-drop reordering personal to that employee.
  3. One employee's order never alters another's.
  4. Order persists across page refreshes and revisits.
* **Technically Validated Multi-Tier Storage Recommendation:**
  - *Tier 1 (Client Optimistic):* In-memory order backed by employee-scoped local key (`flwdsk_task_order_${user.id}`).
  - *Tier 2 (Cross-Device Persistence):* Persist ordered task ID array to server without DDL migrations via employee `preferences` JSONB column (`preferences.task_order: string[]`) on `flwdsk_employees` or `auth.users.user_metadata`.
* **Status:** **APPROVED**.

### `UIUX-REQ-003` — Announcements & Notices Lifecycle (My Day & Board)
* **Screen:** My Day Workspace (`MyDayPage.tsx`) & Announcements Board.
* **Expected Behavior (Two Distinct Lifecycles):**
  1. *My Day Workspace:* User dismissal immediately removes notice for that user; stored under `flwdsk_dismissed_announcements_${user.id}`. Notices automatically disappear when `expires_at < NOW()`. Dismissal never affects other employees.
  2. *Announcements Board:* Past notices hidden from default active view after their calendar month ends; historical archive filtering provided. Zero global deletion of database rows.
* **Status:** **APPROVED**.

### `UIUX-REQ-004` — Mandatory UI Preservation (Attendance & Expense)
* **Preserved Screens:**
  1. Attendance Details Log — All Employees table ([`AttendanceLogPage.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/pages/AttendanceLogPage.tsx)).
  2. Attendance Panel Calendar ([`AttendanceCalendarView.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/components/AttendanceCalendarView.tsx)).
  3. Expense Summary interface ([`ExpenseClaims.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/finance/pages/ExpenseClaims.tsx)).
* **Mandate:** Zero layout shifts, redesigns, or file removals permitted on these three mature views.
* **Status:** **APPROVED (UNIVERSAL GUARDRAIL)**.

### `UIUX-REQ-005` — Leave Management Improvements (Filters & Highlight)
* **Screen:** Leave Management Board ([`LeaveBoard.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/leave/pages/LeaveBoard.tsx)).
* **Expected Behavior:**
  1. Remove the 3 top `LeaveStatCard` components.
  2. Visually highlight table rows with `status === 'pending'` using distinct warm amber callout styling.
  3. Exact Filter Suite (No Substitutions): Employee dropdown, Current Month, Last Month, Last 6 Months, Current Financial Year (Apr 1–Mar 31), Custom Date Range (Start/End pickers). Unsupported substitutions (Week, Quarter) excluded.
  4. Combined filtering: Employee and Date filters operate independently and in intersection.
* **Status:** **APPROVED**.

### `UIUX-REQ-006` — Apply for Leave Form Redesign
* **Screen:** Apply for Leave Modal ([`ApplyLeaveModal.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/leave/forms/ApplyLeaveModal.tsx)).
* **Expected Behavior:** Modern centered two-column card presentation. Refined typography, field grouping, prominent "Total Leave Deduction" summary card showing computed working days before submission.
* **Preservation:** Preserve all existing fields, validations, half-day/shift options, calculation engine (`calcWorkingDays`), and submit/cancel endpoints.
* **Status:** **APPROVED**.

### `UIUX-REQ-007` — Approvals Queue & Attendance Corrections UI
* **Screen:** Approvals Queue ([`ApprovalsQueue.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/pages/ApprovalsQueue.tsx)).
* **Expected Behavior:**
  1. Task Approvals: Add Employee Filter and Supervisor Filter comboboxes. Role scoping strictly enforced: Category 1 has org-wide filter access; **Project Supervisors see only assigned project tasks and supervised employees, including peer-assigned tasks within that project (`DISC-004`)**; cross-project access is strictly blocked; other employees see only authorized tasks. Multi-assignee tasks represented in each assignee's view.
  2. Pre-Start Deletion vs Post-Start Rejection (`BR-TASK-007` & `DISC-003`):
     - If the task was **never started**, rejecting it deletes the task and rejection record.
     - If the task was **ever started**, rejecting it updates status to `Rejected / Closed`, preserving task record and all session history.
  3. Leave Applications: Mandatory Employee combobox filter preserved/added.
  4. Attendance Corrections UI: Clean batch titles (e.g. `"Batch: SJCET - Full Stack"`) removing redundant `"Training Batch (...)"` prefixes. Render multiple split sessions **vertically stacked below main card details** (rather than cramped right column).
* **Status:** **APPROVED (`DISC-003` & `DISC-004` Resolved)**.

### `UIUX-REQ-008` — Employee Idle-Time Admin Notification
* **Screen:** Attendance Monitoring (`MyDayPage.tsx` / Notification Center).
* **Expected Behavior:** Notify Admin when an employee continuously meets all 3 conditions for **15 consecutive minutes**:
  1. Employee is clocked in (`status === 'present'`).
  2. No task timer is running (`flwdsk_task_work_sessions` has no open session).
  3. Employee is not on break (`flwdsk_break_records` has no open break).
* **Payload & Safeguards:** Payload includes Employee Name, Idle Duration ("15 minutes"), Clock-In Status. Idle period ends immediately when task or break starts. Deduplicated to prevent repeated spam notifications for the same block. Employees on break are **never** treated as idle.
* **Status:** **APPROVED**.

### `UIUX-REQ-009` — Batch Management Improvements & Sorting Defect
* **Screen:** Batch Management Console (`BatchManagement.tsx`, `TrainingBatchCarousel.tsx`).
* **Expected Behavior:**
  1. Card Presentation: Remove redundant `"Batch:"` header prefix; organize info cleanly.
  2. Button Visibility: Remove ONLY `"Student Details"`, `"Daily Report"`, and `"Certificate Receipt"`. **PROMINENTLY RETAIN: `"Expense Details"` button**.
  3. Sorting: Newest batch appears first based on verified `created_at DESC` (fixing defect where unmapped `createdAt` fell back to 0 or pinned batches broke chronological sort).
  4. Status Dropdown (`DISC-002`):
     - Displays **EXACTLY four UI-visible statuses**: `Not Started`, `In Progress`, `Completed`, `Closed`.
     - `Completed` and `Closed` are **strictly distinct statuses**.
     - Existing database value `Scheduled` may map to UI `Not Started` only after verifying schema, stored values, queries, and transition logic in Phase 3.
* **Role Authority Decision (`CONF-001` Resolved — 01 Nov 2026):**  
  The stakeholder has explicitly resolved `CONF-001`, formally superseding the previous `TRAIN-Q02` restriction. **ALL employees, regardless of role or category, are permitted to change Training Batch Status.** This universally includes: Admins, Managers, Assigned Trainers, and All Other Employees. The batch status change control is unblocked for all authenticated staff.
* **Status:** **APPROVED (`CONF-001` & `DISC-002` Resolved)**.

### `UIUX-REQ-010` — Add/Edit Training Batch Forms & Expense Details
* **Screen:** `BatchManagement.tsx` modals & `BatchExpenseDetailsDrawer.tsx`.
* **Expected Behavior:**
  1. Add/Edit Batch Forms: Professional, clean fieldset grouping (Basic Details, College & Course, Scheduling & Trainers). 100% field preservation.
  2. Batch Expense Details: Total expenses, category breakdown, individual items, total employees worked, employee names, day-wise work details, employee work hours, total man-hours.
  3. Data Integrity Rule: Verified records only via `flwdsk_schedule_sessions` and `flwdsk_attendance_sessions`. **Zero fabricated or estimated hours.**
  4. Charts: Suggestions only (expense category pie, daily hours bar); use tabular summaries if data is insufficient.
* **Status:** **APPROVED**.

---

## 4. Batch 02 Detailed Specifications (`UIUX-REQ-011` to `UIUX-REQ-020`)

### `UIUX-REQ-011` — Create New Task Form Redesign
* **Requirement ID:** `UIUX-REQ-011`
* **Module & Affected Screens:** Project Management ([`src/modules/project/forms/TaskFormModal.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/project/forms/TaskFormModal.tsx)).
* **Current Implementation Evidence:**  
  `TaskFormModal.tsx` (495 LOC) contains a functional modal, but uses cramped form controls, basic inline styling, and lacks clear visual hierarchy between project selection, assignee designation, and timeline estimation.
* **Stakeholder's Expected Behavior:**  
  1. Professional visual redesign of the Create Task modal into a modern, accessible card layout.
  2. Clear section hierarchy: (1) Core Details (Title, Category/Project), (2) Ownership & Supervision (Assignee, Supervisor), (3) Timeline & Effort (Start Date, Due Date, Estimated Hours), (4) Description & Attachments.
  3. Searchable dropdowns for Category/Project and Assignee/Supervisor with clear avatar indicators.
  4. Responsive layout with fixed modal footer (Submit and Cancel buttons) and internal scrollable content body (`max-height: 85vh`).
* **Preservation Mandate:**  
  Preserve every required field without omission: `title`, `category` (Project ID or "Office Task"), `assigneeId`, `supervisorId`, `startDate`, `dueDate`, `estimatedHours`, `description`. Validation ensures required fields cannot be submitted blank.
* **Acceptance Criteria:**
  1. Modal opens with responsive centering and refined visual hierarchy.
  2. All 8 fields render cleanly, accept input, and validate mandatory values.
  3. Submitting the form successfully creates the task in `flwdsk_tasks` and immediately updates the task list.
* **Status:** **APPROVED** | Provisional Phase 7.

---

### `UIUX-REQ-012` — Comprehensive Form-to-Database Persistence Audit
* **Requirement ID:** `UIUX-REQ-012`
* **Module & Affected Screens:** Cross-Module Core Application Forms (8 Primary Touchpoints).
* **Objective & Scope:**  
  Execute a rigorous 6-point verification audit for every core form in FlowDesk:
  $$\text{Frontend Field} \longrightarrow \text{Validation Schema} \longrightarrow \text{Repository DTO} \longrightarrow \text{Supabase Column} \longrightarrow \text{Saved DB Record} \longrightarrow \text{UI Reload}$$
* **Forms Audited:**
  1. `TaskFormModal.tsx` $\rightarrow$ `flwdsk_tasks`.
  2. `EmployeeModal.tsx` $\rightarrow$ `flwdsk_employees`.
  3. `ApplyLeaveModal.tsx` $\rightarrow$ `flwdsk_leave_records`.
  4. `BatchManagement.tsx` (Add/Edit Batch) $\rightarrow$ `flwdsk_batches`.
  5. `TrainingCalendar.tsx` (Add/Edit Session) $\rightarrow$ `flwdsk_schedule_sessions`.
  6. `ExpenseClaims.tsx` (Submit Claim) $\rightarrow$ `flwdsk_expense_claims`.
  7. `AttendanceCorrectionDetailsModal.tsx` $\rightarrow$ `flwdsk_attendance_corrections`.
  8. `AnnouncementModal.tsx` $\rightarrow$ `flwdsk_announcements`.
* **Zero Silent Data Loss Rule:** Every field visible in the UI must have a verified column destination in Supabase. Never assume a field is saved merely because it exists in component state.
* **Acceptance Criteria:**
  1. Audit matrix published confirming 100% field parity across all 8 forms.
  2. Zero orphaned UI form fields.
  3. Editing any record and saving preserves all unchanged fields while updating edited values.
* **Status:** **APPROVED (MANDATORY AUDIT)** | Workstream B / Phase 7.

---

### `UIUX-REQ-013` — Clock-In Panel Redesign & Geolocation Accuracy
* **Requirement ID:** `UIUX-REQ-013`
* **Module & Affected Screens:** My Day Workspace ([`src/app/pages/workspaces/MyDayPage.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/app/pages/workspaces/MyDayPage.tsx) — `ClockInPanel`).
* **Current Implementation Evidence:**  
  Clock-in modal captures location via browser `navigator.geolocation`, but displays raw coordinates or generic labels. If a trainer is assigned to a batch, the panel does not automatically pre-fill or validate against the batch's scheduled session for today. Long dropdowns overflow without smooth scrolling.
* **Stakeholder's Expected Behavior:**  
  1. Redesign Clock-In panel into a modern, clean card with high-contrast shift status indicators.
  2. Accurate Training Batch schedule retrieval: if the employee has a scheduled session today in `flwdsk_schedule_sessions`, the panel automatically highlights the batch name, scheduled time, and college location.
  3. GPS reverse-geocoding display: show readable address/neighborhood alongside coordinates (with defensive fallback if reverse-geocoding is unavailable or rate-limited).
  4. Scroll usability: dropdowns and session lists must feature smooth internal vertical scrolling with visible scrollbars.
  5. Off-Shift Task Start indicator: clearly display that task timers can be started independently of attendance clock status per `BR-ATT-004`.
* **Acceptance Criteria:**
  1. Clock-In panel opens smoothly without layout shift.
  2. Trainer sees today's scheduled training batch pre-selected.
  3. Reverse-geocoded location or clean fallback string is saved to `flwdsk_attendance_records.location`.
  4. Clocking in updates attendance state to `"Present"` immediately.
* **Status:** **APPROVED** | Provisional Phase 7.

---

### `UIUX-REQ-014` — Training Calendar Usability, Copy/Paste & Duplication Guard
* **Requirement ID:** `UIUX-REQ-014`
* **Module & Affected Screens:** Training Scheduling ([`src/modules/training/pages/TrainingCalendar.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/training/pages/TrainingCalendar.tsx)).
* **Current Implementation Evidence:**  
  Calendar allows manual session creation, but lacks session duplication/copying and drag-and-drop rescheduling. Lacks unique key validation, allowing accidental duplicate session creation for the same batch and trainer on the same date.
* **Stakeholder's Expected Behavior:**  
  1. **Copy/Paste Usability:** Users can copy an existing training session (e.g. `Right-Click → Copy` or copy icon) and paste it into another date cell.
  2. **Drag-and-Drop Rescheduling:** Drag a scheduled session pill to a new date cell to reschedule, automatically updating `session_date`.
  3. **Duplicate Prevention Guard:** System checks for existing sessions with matching `(batch_id, session_date, start_time)` and blocks accidental duplicates with an informative warning.
  4. **Canonical Table Persistence:** All session creations and edits persist directly to `flwdsk_schedule_sessions` per `CAL-Q01`.
* **Acceptance Criteria:**
  1. Copying a session copies course, trainer, timing, and topic metadata.
  2. Pasting into target date creates a single new session row in `flwdsk_schedule_sessions`.
  3. Dragging a session updates its date and triggers a single success toast.
  4. Attempting to create a duplicate session displays an alert: `"A session is already scheduled for this batch at this date/time."`
* **Status:** **APPROVED** | Provisional Phase 7.

---

### `UIUX-REQ-015` — Projects & Tasks Redesign (Filters & KPI Removal)
* **Requirement ID:** `UIUX-REQ-015`
* **Module & Affected Screens:** Project Management ([`src/modules/project/pages/ProjectList.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/project/pages/ProjectList.tsx)).
* **Current Implementation Evidence:**  
  `ProjectList.tsx` (1,884 LOC) renders four large KPI cards at the top ("Total Projects", "Active Projects", "Total Tasks", "Completed Tasks"). The project table has limited filtering and manual column sorting.
* **Stakeholder's Expected Behavior:**  
  1. **Remove Top KPI Cards:** Delete the top metric cards to give maximum vertical screen space to the project table.
  2. **Refined Filter Suite:** Add structured multi-level filters:
     - Project Status (`Active`, `Completed`, `On Hold`, `All`).
     - Supervisor Filter (combobox).
     - Member Filter (combobox querying `flwdsk_resource_allocations` per `PROJECT-Q1`).
     - Date Range (Created Date / Target Completion).
  3. **Table Sorting & Presentation:** Clean column sorting (Code, Title, Supervisor, Member Count, Progress, Due Date) with persistent sort direction indicators.
  4. **Responsive Table:** Full horizontal scroll support with sticky Project Name column on tablet/mobile screens.
* **Acceptance Criteria:**
  1. Top KPI cards are removed; page starts immediately with search/filter bar and project table.
  2. Filtering by Supervisor or Member accurately isolates projects.
  3. Clicking column headers toggles ascending/descending sorts cleanly.
* **Status:** **APPROVED** | Provisional Phase 7.

---

### `UIUX-REQ-016` — Tasks Tab KPI Removal & Active Focus View
* **Requirement ID:** `UIUX-REQ-016`
* **Module & Affected Screens:** Task Management ([`src/modules/project/pages/TaskBoard.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/project/pages/TaskBoard.tsx) & Task Tab in Project Details).
* **Current Implementation Evidence:**  
  Task list renders top KPI summary cards and displays all tasks across all statuses simultaneously, creating visual clutter from hundreds of historical completed or closed tasks.
* **Stakeholder's Expected Behavior:**  
  1. **Remove KPI Cards:** Remove top metric cards from the Tasks tab.
  2. **Default Active Focus View:** By default, the task table displays only actionable tasks: `Not Started` and `In Progress`.
  3. **Default Hiding of Completed & Under Review:** Tasks with status `Completed` and `Under Review` are hidden by default from the primary active list.
  4. **Accessible Reveal Toggle:** Provide a clear filter switch / dropdown (e.g. `"Show Completed / Under Review"`) allowing users and supervisors to easily review completed tasks when needed.
* **Acceptance Criteria:**
  1. Opening Tasks tab shows only active, actionable tasks.
  2. Completed tasks do not clutter the default table view.
  3. Enabling the "Show Completed" toggle instantly reveals completed tasks with distinct muted styling.
* **Status:** **APPROVED** | Provisional Phase 7.

---

### `UIUX-REQ-017` — Expenses & Travel Redesign & Rate Propagation
* **Requirement ID:** `UIUX-REQ-017`
* **Module & Affected Screens:** Finance Operations ([`src/modules/finance/pages/ExpenseClaims.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/finance/pages/ExpenseClaims.tsx)).
* **Current Implementation Evidence:**  
  In `ExpenseClaims.tsx`, travel rates (Bike: ₹3–5/km, Car: ₹9.5–12/km) are read from `flwdsk_system_settings`, but fall back to hardcoded defaults or client `localStorage` if not set, leading to inconsistent reimbursement amounts between different employees.
* **Stakeholder's Expected Behavior:**  
  1. **Clean Redesign of Claim Submission Drawer/Modal:** Refined layout separating Training vs Office expenses, with streamlined travel distance inputs.
  2. **Authoritative Central Rate Propagation:**
     - Admin/Category 1 roles can update travel rates in `flwdsk_system_settings`.
     - Updated rates apply correctly to all relevant users without stale fallback.
     - New pending self-travel claims automatically use the updated active rate.
  3. **Vehicle Modality Support & Calculation:**
     - Support Bike, Car, Bus, Train, Metro, Auto, and Cab/Uber.
     - When Bike or Car is selected, entering KM automatically calculates:
       $$\text{Amount} = \text{KM} \times \text{Configured Rate Per KM}$$
  4. **Admin Claim Adjustment & Cancellation Governance:**
     - Admin/Category 1 roles can manually adjust pending claims before approval.
     - Approved claims strictly retain their historical rate and amount.
     - Future rate changes must **NEVER retroactively recalculate** already approved claims.
     - Admin/Category 1 roles can cancel approved claims with mandatory cancellation reason, cancellation date, and complete audit trail logging.
     - Cancelled claims must **NEVER be hard-deleted** from the database (`status = 'Cancelled'`).
  5. **Receipt Attachment Zoom & Preview:** Users can click receipt thumbnails to inspect zoomed previews in an accessible lightbox modal without opening new browser tabs.
* **Acceptance Criteria:**
  1. Submitting a Bike travel claim of 20 KM with configured rate ₹5.00/km auto-computes exactly ₹100.00.
  2. Modifying central travel rates in Settings immediately updates rate calculation for newly drafted claims.
  3. Modifying travel rates does not alter historical approved claim amounts.
  4. Admin can adjust pending claims or cancel approved claims with an audit trail, and cancelled claims are preserved.
  5. Receipt images render with accessible lightbox preview.
* **Status:** **APPROVED** | Phase 7.

---

### `UIUX-REQ-018` — Expense Analytics Complete Specification (16 Metrics)
* **Requirement ID:** `UIUX-REQ-018`
* **Module & Affected Screens:** Finance & Analytics ([`src/modules/finance/pages/ExpenseAnalyticsPage.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/modules/finance/pages/ExpenseAnalyticsPage.tsx)).
* **Stakeholder's Expected Behavior:**  
  Deliver a complete Power BI-inspired analytics canvas presenting the **16 core financial and operational metrics**. Avoid decorative chart bloat; provide actionable business insights grounded in verified data. Average Amount is completely excluded from the analytics scope.
* **Detailed Specification:** See [Section 5](#5-expense-analytics--comprehensive-16-metric-specification) below for the complete mathematical and visual specification.
* **Status:** **APPROVED (16 METRICS SPECIFIED)** | Phase 7.

---

### `UIUX-REQ-019` — Announcements Board Simplification & Archive
* **Requirement ID:** `UIUX-REQ-019`
* **Module & Affected Screens:** Communications Module (`AnnouncementsBoard`).
* **Stakeholder's Expected Behavior:**  
  1. **Clean Bulletin Layout:** Modern, readable card-based bulletin board for organizational notices, holiday calendars, and executive circulars.
  2. **Active vs Upcoming Display:** High-visibility distinction between currently active notices and upcoming future declarations (e.g. holidays scheduled next month).
  3. **Calendar-Month Default View:** By default, displays only notices published in the current calendar month.
  4. **Historical Archive Filtering:** Accessible month/year selector allowing staff to review archived notices from prior months.
  5. **Data Preservation:** Zero deletion of historical records.
* **Acceptance Criteria:**
  1. Announcements Board loads current month's active notices by default.
  2. Selecting a prior month retrieves archived notices seamlessly.
  3. Rich text formatting (bold, bullet points, links) renders safely.
* **Status:** **APPROVED** | Provisional Phase 7.

---

### `UIUX-REQ-020` — Mobile Application Operational Modernization
* **Requirement ID:** `UIUX-REQ-020`
* **Module & Affected Screens:** Mobile Application (`Mobile App/` — React Native 0.76.7 / Expo SDK 52).
* **Stakeholder's Expected Behavior:**  
  Modernize the mobile app into a lean, fast, field-oriented operational companion.
  1. **Core Operational Scope:**
     - Clock-in/out and break start/end with accurate device GPS geolocation.
     - Own attendance view and running task timers.
     - Quick task creation, assigned-task viewing, and task submission.
     - Project creation and project task operations within authorized scope.
     - Expense claims, travel expenses, and receipt photo capture/upload.
     - Supervisor push notifications and mobile one-tap approve/reject actions.
     - Enforce existing task lifecycle rules (`BR-TASK-007` deletion protection and start-state rules).
  2. **Technical & Release Architecture:**
     - Native/hybrid architecture evaluation utilizing shared API/business logic layer.
     - Robust offline and network reconnect behavior with local SQLite/queue caching.
     - Automated build pipelines and CI/CD for EAS Build.
     - Document OTA update limitations and app-store release requirements.
* **Workspace & Implementation Boundary:**
  - The `Mobile App/` directory remains strictly frozen and untouched during web application rework.
  - `UIUX-REQ-020` in the current plan covers approved mobile scope definition and architecture planning only.
  - Actual mobile implementation requires separate stakeholder authorization after web rework completion.
* **Detailed Specification:** See [`docs/MOBILE_APP_SCOPE_AND_ARCHITECTURE.md`](file:///Users/apple/Downloads/flow-desk-main/docs/MOBILE_APP_SCOPE_AND_ARCHITECTURE.md).
* **Status:** **APPROVED (PLANNING & ARCHITECTURE ONLY — IMPLEMENTATION SEPARATE)** | Workstream F.

---

## 5. Expense Analytics — Comprehensive 16-Metric Specification

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        POWER BI-INSPIRED CANVAS (1280px Grid)                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [ M1: Total Institutional Spend ] [ M2: Training vs Office ] [ M3: Cost/Student ] [ M4: Cost/Day ] │
├────────────────────────────────────────┬───────────────────────────────────────────────┤
│ [ M10: Monthly Expense Trend ]         │ [ M8: Expense by Category Breakdown ]         │
├────────────────────────────────────────┼───────────────────────────────────────────────┤
│ [ M9: Expense by Type Breakdown ]      │ [ M11: Monthly Expense by Type ]              │
├────────────────────────────────────────┼───────────────────────────────────────────────┤
│ [ M15: Travel Modality Breakdown ]     │ [ M12: Employee Expense Leaderboard ]         │
├────────────────────────────────────────┴───────────────────────────────────────────────┤
│ [ M5–M7, M14: Batch Performance Table (Expense, Cost/Student, Cost/Day, Share %) ]     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [ M13: 2D Matrix Heatmap: Batches × Expense Types ]                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [ M16: Prior Year Academic Comparison Benchmark (YoY: College + Program + Course) ]    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

The 16 metrics are formally defined and specified below (Average Amount is completely excluded from the analytics scope):

---

#### Metric 1: Total Institutional Spend
* **Business Definition:** Gross cumulative financial spend across all approved and submitted expense claims within the selected filter scope.
* **Calculation Formula:**
  $$\text{Total Spend} = \sum \text{claim.amount} \quad \forall \, \text{claim} \in \text{FilteredClaims}$$
* **Database Source:** `flwdsk_expense_claims.amount` (filtering `.is('deleted_at', null)`).
* **Filters:** Academic Year, Date Range, Category, College, Batch, Employee.
* **Chart Type / Card Position:** Primary KPI Metric Card; Top Row, Column 1.
* **Dimensions & Sizing:** Width: 100% of column ($280\text{px}$ min); Height: $110\text{px}$.
* **Color Palette:** Accent primary (`#3B82F6` / Blue); Background: `var(--bg-surface)`.
* **Typography:** Label: $12\text{px}$ uppercase (font-weight: 600, `var(--text-muted)`); Value: $26\text{px}$ bold tabular figures (`var(--text-primary)`).
* **Legends & Tooltips:** Tooltip reveals total claim count and filter boundaries.
* **Empty / Error State:** Displays `"₹0"` if no matching claims; error banner if query fails.
* **Insight Generation Logic:** If Total Spend exceeds 110% of prior year baseline, badge displays `+X% vs Prior Year (High Spend)`.

---

#### Metric 2: Training vs Office Expenses Split
* **Business Definition:** Categorical split of total expenditure into direct student training delivery vs. internal corporate office operations.
* **Calculation Formula:**
  $$\text{Training Expenses} = \sum_{\text{category} = \text{'Training Expense'}} \text{amount}, \quad \text{Office Expenses} = \sum_{\text{category} = \text{'Office Expense'}} \text{amount}$$
* **Database Source:** `flwdsk_expense_claims.category`.
* **Filters:** Academic Year, Date Range, Employee, College.
* **Chart Type / Position:** Dual Sub-Metric KPI Card with horizontal proportional bar; Top Row, Column 2.
* **Dimensions & Sizing:** Width: 100% ($280\text{px}$ min); Height: $110\text{px}$.
* **Color Palette:** Training: `#10B981` (Emerald); Office: `#6366F1` (Indigo).
* **Typography:** Value: $18\text{px}$ semi-bold per category; Share % in $12\text{px}$ badge.
* **Legends & Tooltips:** Tooltip shows exact percentage share: $\frac{\text{Training}}{\text{Total}} \times 100\%$.
* **Empty / Error State:** Shows `"₹0 / ₹0"` with 50/50 empty gray bar.
* **Insight Generation Logic:** Highlights when Training Expenses represent $> 75\%$ of total budget (indicates healthy operational delivery ratio).

---

#### Metric 3: Cost Per Student
* **Business Definition:** Average direct training expenditure incurred per enrolled student across active batches within the filter scope.
* **Calculation Formula:**
  $$\text{Cost Per Student} = \frac{\text{Training Expenses}}{\sum_{\text{batch} \in \text{Scope}} \text{batch.student\_count}}$$
* **Database Source:** `flwdsk_expense_claims` matched to `flwdsk_batches` and live student count from `flwdsk_enrollments`.
* **Filters:** Academic Year, Date Range, College, Batch.
* **Chart Type / Position:** KPI Card with delta indicator; Top Row, Column 3.
* **Dimensions & Sizing:** Width: 100%; Height: $110\text{px}$.
* **Color Palette:** Amber (`#F59E0B`).
* **Typography:** Value: $24\text{px}$ bold (`formatINR`); Subtitle: $11\text{px}$ showing total student denominator.
* **Legends & Tooltips:** Tooltip: `"Total Training Expenses / Total Live Enrolled Students"`.
* **Empty / Error State:** Displays `"₹0 / student"` if student count is zero (avoids division by zero).
* **Insight Generation Logic:** Flags batches where Cost Per Student exceeds ₹1,200 (identifies high-cost or low-enrollment programs).

---

#### Metric 4: Cost Per Training Day
* **Business Definition:** Average daily training expenditure incurred per delivered training day across all batches.
* **Calculation Formula:**
  $$\text{Cost Per Training Day} = \frac{\text{Training Expenses}}{\sum_{\text{batch} \in \text{Scope}} \text{UniqueTrainingDays}(\text{batch})}$$
* **Database Source:** `flwdsk_expense_claims.expenseDate` grouped by `matchedBatchId` and cross-referenced with `flwdsk_schedule_sessions`.
* **Filters:** Academic Year, Date Range, College, Batch.
* **Chart Type / Position:** KPI Card with average trend indicator; Top Row, Column 4.
* **Dimensions & Sizing:** Width: 100%; Height: $110\text{px}$.
* **Color Palette:** Cyan (`#06B6D4`).
* **Typography:** Value: $24\text{px}$ bold; Subtitle: $11\text{px}$ showing total days denominator.
* **Legends & Tooltips:** Tooltip: `"Total Training Expenses / Delivered Unique Training Calendar Days"`.
* **Empty / Error State:** Displays `"₹0 / day"` when training days count is 0.
* **Insight Generation Logic:** Flags days where daily delivery cost exceeds ₹5,000 (identifies high travel/lodging overhead).

---

#### Metric 5: Batch-Level Total Expense
* **Business Definition:** Aggregated expenditure attributed to an individual training batch across all associated claims.
* **Calculation Formula:**
  $$\text{Batch Expense}(b) = \sum_{\text{claim.batch\_id} = b.\text{id}} \text{claim.amount}$$
* **Database Source:** `flwdsk_expense_claims` linked via `batch_id`.
* **Filters:** Batch Code search, College filter, Academic Year.
* **Chart Type / Position:** Data Table Column with horizontal progress fill; Main Analytics Table (Tab 2).
* **Dimensions & Sizing:** Column width: $140\text{px}$; aligned right.
* **Color Palette:** High: `#EF4444` (Rose); Medium: `#3B82F6` (Blue); Low: `#10B981` (Emerald).
* **Typography:** $13\text{px}$ semi-bold tabular figures.
* **Legends & Tooltips:** Hover reveals breakdown by Trainer vs Travel vs Hospitality.
* **Empty State:** Shows `"₹0.00"`.
* **Insight Generation Logic:** Identifies top 3 highest spending batches across the institution.

---

#### Metric 6: Batch-Level Cost Per Student
* **Business Definition:** Program delivery cost normalized by actual batch enrollment.
* **Calculation Formula:**
  $$\text{Batch Cost/Student}(b) = \frac{\text{Batch Expense}(b)}{\max(b.\text{student\_count}, 1)}$$
* **Database Source:** `flwdsk_batches` enrollment join with `flwdsk_expense_claims`.
* **Filters:** College, Course, Academic Year.
* **Chart Type / Position:** Data Table Column with colored badge; Main Analytics Table (Tab 2).
* **Dimensions & Sizing:** Column width: $130\text{px}$; aligned right.
* **Color Palette:** Green ($< ₹500$), Amber ($₹500–₹1,000$), Red ($> ₹1,000$).
* **Typography:** $13\text{px}$ medium.
* **Legends & Tooltips:** Shows enrolled students vs sanctioned capacity.
* **Empty State:** Shows `"₹0"` if no expenses or students.
* **Insight Generation Logic:** Automatically compares batch unit cost against institutional average.

---

#### Metric 7: Cost Per Training Day by Batch
* **Business Definition:** Daily burn rate of a specific individual training batch, calculated from total approved batch expenditure divided exclusively by the number of unique calendar dates on which training actually occurred for that batch.
* **Calculation Formula:**
  37913\text{Cost/Day}(b) = \frac{\text{Batch Expense}(b)}{\text{UniqueActualTrainingDays}(b)}37913
* **Database Source:**
  - Numerator: `SUM(flwdsk_expense_claims.amount)` WHERE `batch_id = b.id` AND `status = 'Approved'`.
  - Denominator: `COUNT(DISTINCT flwdsk_schedule_sessions.date)` WHERE `batch_id = b.id` AND `deleted_at IS NULL`.
* **Batch Filters:** Batch Code search, College Name, Academic Year, Date Range (applied consistently across expenses and schedule sessions).
* **Treatment of Training Days:**
  - The number of training days is calculated exclusively from actual training session records in `flwdsk_schedule_sessions`.
  - Multiple sessions on the same calendar date count as exactly one training day.
  - Expense claim dates must NEVER be used as training-day evidence. Advance expenses, travel bookings, reimbursements, and other claim dates must not create additional training days. Do not infer training days from expense records.
* **Zero and Missing Value Handling:**
  - **Scenario A (Zero approved batch expenses):** Renders `"₹0 / day"`.
  - **Scenario B (Approved expenses exist and one or more actual training dates exist):** Divide total approved batch expenses by the count of distinct actual training dates from `flwdsk_schedule_sessions`.
  - **Scenario C (Approved expenses exist but no actual training session dates exist):** Use denominator `1` solely as a protective pre-commencement calculation fallback (e.g. advance travel booking prior to start). Display the calculated amount with the explicit informational label `"1 day (pre-commencement)"`. Do NOT describe this fallback as an actual training day, and NEVER substitute expense claim dates.
  - **Scenario D (Missing or unavailable session data):** Do not silently infer training days from unrelated records. Preserve the strict distinction between zero actual training days and missing/unavailable session data. Render an explicit data-quality warning badge `"Session Data Unavailable"` if batch session records cannot be queried or are corrupt.
* **Chart Type / Position:** Data Table Column with daily burn indicator; Main Analytics Table (Tab 2).
* **Dimensions & Sizing:** Column width: \text{px}$; aligned right.
* **Color Palette:** Low ($< ₹1,500$): `#10B981` (Emerald); Moderate ($₹1,500–₹3,500$): `#3B82F6` (Blue); High ($> ₹3,500$): `#EF4444` (Rose); Pre-commencement fallback: `#6B7280` (Gray).
* **Typography:** \text{px}$ tabular figures (`formatINR`).
* **Legends & Tooltips:** Tooltip reveals: `"₹[Total Expense] / [Unique Actual Training Days] Actual Training Days"` (or `"Pre-commencement: Advance spend before training start"`).
* **Empty State:** Shows `"₹0 / day"`.
* **Insight Generation Logic:** Identifies completed batches where daily delivery burn rate exceeds single-day workshop baselines by $> 50\%$.

---
#### Metric 8: Expense by Category Breakdown
* **Business Definition:** High-level institutional distribution of expenses across primary categories (Training Expenses vs. Office Expenses).
* **Calculation Formula:**
  $$\text{Category Share}(c) = \sum_{\text{claim.category} = c} \text{amount}, \quad \text{Pct}(c) = \frac{\text{Category Share}(c)}{\text{Total Spend}} \times 100\%$$
* **Database Source:** `flwdsk_expense_claims.category`.
* **Filters:** Academic Year, Date Range, College, Batch.
* **Chart Type / Position:** Donut Chart with central total spend callout; Row 2, Right Panel.
* **Dimensions & Sizing:** Width: $450\text{px}$; Height: $320\text{px}$; Inner Radius: $65\text{px}$; Outer Radius: $110\text{px}$.
* **Color Palette:** Training: `#10B981` (Emerald); Office: `#6366F1` (Indigo).
* **Typography:** Center text: Total INR; Legend: $12\text{px}$ with categorical color swatches.
* **Legends & Tooltips:** Hover reveals exact category spend and percentage share.
* **Empty State:** Clean gray circle with `"No Expense Claims Found"`.
* **Insight Generation Logic:** Highlights when Office Expenses exceed 25% of institutional operational budget.

---

#### Metric 9: Expense by Type Breakdown
* **Business Definition:** Granular distribution of expenditures across specific expense types (Self Travel, Public Transport, Meals, Printing, Trainer Honorarium, Accommodation, Miscellaneous).
* **Calculation Formula:**
  $$\text{Type Spend}(t) = \sum_{\text{claim.type} = t} \text{amount}, \quad \text{Share}(t) = \frac{\text{Type Spend}(t)}{\text{Total Expenses}} \times 100\%$$
* **Database Source:** `flwdsk_expense_claims.expense_type`.
* **Filters:** Category, Date Range, College, Academic Year.
* **Chart Type / Position:** Horizontal Bar Chart sorted descending by spend; Tab 3 ("Types & Monthly").
* **Dimensions & Sizing:** Width: 100%; Height: $320\text{px}$.
* **Color Palette:** 11-color conformed palette (`#3B82F6`, `#10B981`, `#F59E0B`, `#8B5CF6`, `#EC4899`, etc.).
* **Typography:** Value: $13\text{px}$ bold; Axis labels: $12\text{px}$ regular.
* **Legends & Tooltips:** Hover reveals Type Name, Total INR, and Share %.
* **Empty State:** Centered text: `"No Expense Claims Found"`.
* **Insight Generation Logic:** Highlights if Travel represents $> 40\%$ of total spend (flags high commuting overhead).

---

#### Metric 10: Monthly Expense Trend
* **Business Definition:** Chronological trajectory of monthly operational expenditure across the academic year.
* **Calculation Formula:**
  $$\text{Monthly Spend}(m) = \sum_{\text{month}(c.\text{date}) = m} c.\text{amount}$$
* **Database Source:** `flwdsk_expense_claims.created_at` or `expense_date`.
* **Filters:** Academic Year, Category, College.
* **Chart Type / Position:** Stacked Bar & Line Combo Chart (Training Bar + Office Bar + Total Trend Line); Row 2, Left Panel.
* **Dimensions & Sizing:** Width: 100% ($650\text{px}$ min); Height: $320\text{px}$.
* **Color Palette:** Training Bars: `#10B981` (Emerald); Office Bars: `#6366F1` (Indigo); Trend Line: `#3B82F6` (Blue).
* **Typography:** Axis: $11\text{px}$ (`var(--text-muted)`); Gridlines: dashed `var(--border-subtle)`.
* **Legends & Tooltips:** Tooltip shows Month Name, Training Total, Office Total, Combined Spend, and YoY % growth.
* **Empty State:** Centered text: `"No expense records for selected academic year"`.
* **Insight Generation Logic:** Identifies peak operational expenditure months (typically September–November during campus training season).

---

#### Metric 11: Monthly Expense by Type
* **Business Definition:** Monthly categorical breakdown showing how specific costs (e.g. Travel vs Food) evolve month-over-month.
* **Calculation Formula:**
  $$\text{Spend}(m, t) = \sum_{\text{month} = m, \text{type} = t} \text{amount}$$
* **Database Source:** Cross-tabulation of `expense_date` and `expense_type`.
* **Filters:** Academic Year, Date Range, Category.
* **Chart Type / Position:** 100% Stacked Bar Chart; Row 3, Tab 3 ("Types & Monthly").
* **Dimensions & Sizing:** Width: 100%; Height: $360\text{px}$.
* **Color Palette:** Categorical multi-hue palette.
* **Typography:** Axis: $11\text{px}$; Values $\ge 10\%$ display white percentage text inside bar.
* **Legends & Tooltips:** Hover reveals exact INR contribution of that expense type in that specific month.
* **Empty State:** Clean empty canvas with dashed border.
* **Insight Generation Logic:** Detects sudden spikes in a single category (e.g. sudden surge in Accommodation during outstation campus drives).

---

#### Metric 12: Employee Expense Leaderboard
* **Business Definition:** Ranked audit of expenses claimed per employee, tracking submission volume and average claim size.
* **Calculation Formula:**
  $$\text{Emp Spend}(e) = \sum_{c.\text{emp\_id} = e.\text{id}} c.\text{amount}, \quad \text{Avg Claim}(e) = \frac{\text{Emp Spend}(e)}{\text{Claims Count}(e)}$$
* **Database Source:** `flwdsk_expense_claims.employee_id` joined with `flwdsk_employees`.
* **Filters:** Academic Year, Date Range, Category.
* **Chart Type / Position:** Ranked Horizontal Bar List with employee avatar and role badge; Row 3, Right Panel.
* **Dimensions & Sizing:** Width: $450\text{px}$; Height: $360\text{px}$; Scrollable for $> 10$ employees.
* **Color Palette:** Gradient horizontal bars (`#3B82F6` $\rightarrow$ `#60A5FA`).
* **Typography:** Employee Name: $13\text{px}$ semi-bold; Total INR: $13\text{px}$ bold; Role: $10\text{px}$ badge.
* **Legends & Tooltips:** Hover reveals total claims submitted, top expense type, and maximum single claim.
* **Empty State:** Text: `"No employee claims in selected period"`.
* **Insight Generation Logic:** Highlights top 5 claimants and flags claims $> 2\sigma$ above organizational median.

---

#### Metric 13: Batch $\times$ Expense Types Heatmap
* **Business Definition:** Cross-tabulation matrix mapping individual training batches (rows) against expense types (columns) to identify localized cost drivers.
* **Calculation Formula:**
  $$\text{Cell}(b, t) = \sum_{c \in \text{Batch}(b) \land c.\text{type} = t} c.\text{amount}, \quad \text{Heatmap Intensity} = \frac{\text{Cell}(b, t)}{\max(\text{MatrixCells})}$$
* **Database Source:** Matrix pivot of `flwdsk_expense_claims` matched to active batches.
* **Filters:** College, Academic Year, Expense Category.
* **Chart Type / Position:** 2D Interactive Grid Heatmap with summary row and summary column; Tab 5 ("Matrix").
* **Dimensions & Sizing:** Full width ($1200\text{px}$ min); Scrollable horizontally and vertically; Cell size: $100\text{px} \times 40\text{px}$.
* **Color Palette:** VisionOS glass intensity: Low (neutral surface), Medium (light blue tint), High (`#3B82F6` with white text).
* **Typography:** Cells: $12\text{px}$ tabular; Row headers: $13\text{px}$ bold; Grand totals: $13\text{px}$ bold.
* **Legends & Tooltips:** Hovering a cell displays: `"[Batch Name] · [Expense Type] · ₹X,XXX (Y% of Batch Total)"`.
* **Empty State:** Displays empty matrix grid with zero values.
* **Insight Generation Logic:** Pinpoints anomalous batch expenditures (e.g. one batch spending 80% on Printing while another spends 80% on Food).

---

#### Metric 14: Batch Expense Share (%)
* **Business Definition:** The proportion of total institutional training expenditure consumed by a single batch.
* **Calculation Formula:**
  $$\text{Share Pct}(b) = \frac{\text{Batch Expense}(b)}{\text{Total Training Expenses}} \times 100\%$$
* **Database Source:** Derived ratio from Metric 5 and Metric 2.
* **Filters:** Academic Year, College.
* **Chart Type / Position:** Progress Bar / Donut segment in Batch Details drawer; Batch Table Column (Tab 2).
* **Dimensions & Sizing:** Column width: $110\text{px}$; Bar width: $60\text{px}$.
* **Color Palette:** Progressive blue tint (`#3B82F6`).
* **Typography:** $12\text{px}$ semi-bold percentage string (e.g. `"14.2%"`).
* **Legends & Tooltips:** Tooltip: `"Represents X% of total institutional training budget"`.
* **Empty State:** Shows `"0.0%"`.
* **Insight Generation Logic:** Flags "Mega Batches" consuming $> 15\%$ of total institutional budget.

---

#### Metric 15: Travel Modality Breakdown
* **Business Definition:** Comparative breakdown of transportation expenditures across specific travel modes: Self Travel (Bike vs Car by KM rate) vs Public Transit (Bus, Metro, Train, Auto, Cab/Uber).
* **Calculation Formula:**
  $$\text{Bike Total} = \sum (\text{KM} \times \text{Rate}_{\text{bike}}), \quad \text{Car Total} = \sum (\text{KM} \times \text{Rate}_{\text{car}}), \quad \text{Transit Total} = \sum \text{Fares}$$
* **Database Source:** `flwdsk_expense_claims` parsed `vehicle`, `km`, and `route` fields.
* **Filters:** College, Batch, Academic Year.
* **Chart Type / Position:** Multi-segment Stacked Bar Chart with vehicle icon chips; Tab 4 ("Travel").
* **Dimensions & Sizing:** Width: 100%; Height: $300\text{px}$.
* **Color Palette:** Bike: `#F59E0B` (Amber); Car: `#3B82F6` (Blue); Bus/Metro: `#10B981` (Emerald); Cab/Uber: `#8B5CF6` (Purple).
* **Typography:** Vehicle tags: $11\text{px}$ uppercase; Values: $13\text{px}$ bold.
* **Legends & Tooltips:** Hover reveals Total Distance (KM), Total Reimbursement (INR), and Active Rate Applied (₹/KM).
* **Empty State:** Text: `"No travel claims recorded for this selection"`.
* **Insight Generation Logic:** Recommends transit optimization (e.g. identifies routes where public transit reimbursement would reduce car mileage spend by $> 30\%$).

---

#### Metric 16: Prior Year Academic Comparison Benchmark (YoY)
* **Business Definition:** Multi-year baseline comparative evaluation matching current year batches against historical prior year programs strictly by the composite key:
  $$\text{Comparison Key} = [\text{College Name}] + [\text{Program / Stream}] + [\text{Course}]$$
* **Calculation Formula:**
  $$\Delta \text{Expense} = \text{Expense}_{\text{Current}} - \text{Expense}_{\text{Prior}}, \quad \text{Growth \%} = \frac{\Delta \text{Expense}}{\text{Expense}_{\text{Prior}}} \times 100\%$$
  $$\Delta \text{Cost/Student} = \text{Cost/Student}_{\text{Current}} - \text{Cost/Student}_{\text{Prior}}$$
* **Database Source:** Matched queries between `academicYear` (e.g. 2026–2027) and `comparisonYear` (e.g. 2025–2026) across `flwdsk_batches` and `flwdsk_expense_claims`.
* **Filters:** Current Academic Year, Comparison Academic Year, College.
* **Chart Type / Position:** YoY Comparative Matrix Table with variance pills; Tab 6 ("YoY Comparison").
* **Dimensions & Sizing:** Full width ($1200\text{px}$ min); Column widths: College ($200\text{px}$), Program ($150\text{px}$), Current Spend ($130\text{px}$), Prior Spend ($130\text{px}$), Variance ($120\text{px}$).
* **Color Palette:** Positive/Favorable Variance: `#10B981` (Green badge); Adverse Variance: `#EF4444` (Red badge); New Program (No baseline): `#6B7280` (Gray badge: `"No Prior Baseline Record"`).
* **Typography:** Table: $13\text{px}$; Variance badges: $11\text{px}$ bold.
* **Legends & Tooltips:** Tooltip shows exact batch codes compared and variance drivers (enrollment change vs cost change).
* **Empty State:** Displays `"No matched prior year programs found for selected criteria"`.
* **Insight Generation Logic:** Automatically flags programs where Cost Per Student increased $> 15\%$ despite constant or increased student enrollment.

---

## 6. Resolved Decisions & Conflict History

| Item ID | Title | Nature of Conflict | Reference Decision | Stakeholder Resolution & Final Authoritative Rule | Status |
|---|---|---|---|---|---|
| **`CONF-001`** | Batch Status Dropdown Role Authority (`UIUX-REQ-009`) | Stakeholder requested batch status-change capability for Category 1 and *all other employees*, conflicting with `TRAIN-Q02` (Admins, Managers, Assigned Trainers only). | `TRAIN-Q02` (Superseded) | **RESOLVED (01 Nov 2026):** Stakeholder explicitly superseded `TRAIN-Q02`. **ALL employees, regardless of role or category, are permitted to change Training Batch Status** (Admins, Managers, Assigned Trainers, and All Other Employees). | **RESOLVED / APPROVED** |
