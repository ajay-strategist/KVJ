# 08 — Workflow Documentation

This report describes the principal business workflows and, for each, how data enters, moves, is stored and is displayed.

## Overall data-flow shape

```
User action in SPA ──axios/multipart──▶ Express route ──▶ controller
   ──▶ Mongoose model ──▶ MongoDB                     (persist)
   ──▶ driveService/mailer/calendar   (side-effects: files, email, calendar)
   ──▶ Socket.IO emit to rooms        (real-time push)
GET requests ──▶ controller query + .populate ──▶ JSON ──▶ page renders
Cron jobs run on schedule ──▶ mutate MongoDB ──▶ emit socket events / send DMs
```

---

## 1. Onboarding & account activation

1. Prospect self-registers (`Signup`) → `User` created with `status: Pending`.
2. Admin sees the pending user in `AdminUsers`.
3. Admin approves → controller sets `status: Active`, assigns role/team/grade, **seeds that year's `LeaveBalance` records** (via `leaveBalanceReset.seedLeaveBalances`), and **sends a Gmail approval email** (`mailer.sendApprovalEmail`).
4. User can now log in. Rejection or later deactivation sets status accordingly; deactivation emits `forceLogout` over Socket.IO so any active session is booted immediately.

## 2. Daily attendance

1. Employee opens `Attendance`, clocks in → `Attendance` doc created with `clockInTime`, optional geolocation, label derived (Normal/Weekend/Public Holiday/half-day).
2. Breaks recorded as `breaks[]`; `totalBreakDurationMinutes` accumulates.
3. Clock-out computes `totalHours = (out − in − breaks)`.
4. If a session is left open, the **23:59 auto clock-out cron** closes it and labels it `Auto-closed`.
5. A 60-second heartbeat updates `lastActiveAt` for Active/Away presence, surfaced in `TeamStatusPanel` and team-status views.
6. Admin can correct a record; every correction appends to an immutable `correctionLog[]`.
7. **Gate:** non-admins must be clocked-in (and not on break) to start a task/timer (`taskStartAccess`).

## 3. Leave request → approval → balance

1. Employee submits a leave request (`Leave`), choosing dates, nature (Medical/Personal) and optional half-day. `daysTaken` computed.
2. Manager/Admin approves or rejects (`PUT /:id/status`), optionally with `managerComment`; approval stamps `approvedBy` and decrements the relevant `LeaveBalance.usedDays`.
3. **Medical path:** medical leaves get a `reportDeadline` and `reportStatus: Pending`. The employee later uploads a certificate (`POST /:id/report`) → stored in Google Drive, `reportStatus: Submitted`.
4. If the deadline passes without a certificate, the **nightly overdue-reports cron** flips `reportStatus: Overdue`, DMs the employee, and posts a notice in the General chat channel.
5. Half-day leaves also affect that day's attendance label.
6. Every Jan 1, the **leave-balance-reset cron** seeds fresh balances for all active users.

## 4. Task lifecycle (create → work → complete → archive)

1. A task is created (Admin/Manager/Employee) against a project and/or team. Assigning to a specific user vs leaving `assignee: null` (a **team pool** task) determines routing.
2. If a **manager** assigns a task that needs admin sign-off, `managerApprovalPending` + `pendingAssignee` hold it until an admin approves/rejects.
3. Pool tasks are **claimed** by members (`PUT /:id/claim`), broadcast as `poolTaskClaimed`.
4. Work is tracked via **time logs** and/or the **real-time timer** (start/pause/end) — gated by clock-in status.
5. **Comments** thread on the task with socket toasts to watchers.
6. **Transfer** flow: current owner initiates → recipient accepts/rejects → **admin** approves/rejects (`TaskTransfer` with `status` + `adminStatus`).
7. **Overdue:** reactively in `getTasks` and via a nightly cron, non-Done past-due tasks get `isOverdue: true`.
8. **Recurring** tasks spawn fresh instances daily/weekly/monthly via cron.
9. Completed tasks are **archived**; a cron **deletes archived tasks older than one year**.

## 5. Timesheet / worklog

1. Employee logs hours against a task/project (`Timesheet`), with `cost = hoursSpent × salaryRate`.
2. **Auto-approved on creation** — there is no approval queue (despite a `status` enum on the schema).
3. Managers/Admin review team worklogs; admin exports to XLSX.

## 6. Expense claim → approval → payment

1. Employee submits a claim (`Expense`) with category (Training/Office), structured fields, amount and a **bill image**.
2. The bill is streamed to **Google Drive** (`driveService`) with a structured filename; only the Drive id/link is stored on the document. (Cloudinary is stubbed off, so Drive is the live store.)
3. Status flows **Pending → Approved → Paid** (or **Rejected**), with `managerNotes`.
4. Admin can **bulk approve** and **bulk pay**, and export claims to CSV.

## 7. Team communication

1. Channels (General/Team/Custom) and DMs organise conversation. Admin/Manager manage channels/membership.
2. Messages (optionally with a file, threaded via `threadId`, with `@mentions`) are saved and pushed to channel rooms over Socket.IO.
3. `DashboardLayout` shows global toasts for new messages, mentions and thread replies; unread mention counts are queryable.

## 8. Trainer logging & training batches

1. Trainers log activity (`TrainerLog`: date, org, type, mode, times → duration).
2. Colleges/Courses/Batches provide the reference taxonomy used to categorise trainer work and expenses.
3. Admin views/export all trainer logs.

## 9. Reporting & exports

1. Admin dashboard aggregates live counts (users, projects, attendance, pending leaves/expenses).
2. Per-user **performance reports** aggregate attendance, approved leaves, expenses, trainer logs and holidays over a date range (JSON + XLSX).
3. Almost every module offers a CSV/XLSX export, generated on demand server-side.

## Where data lives vs where it's shown

| Data | Stored in | Shown in |
|------|-----------|----------|
| Identity, roles | `User` | Login, AdminUsers, everywhere via localStorage cache |
| Attendance | `Attendance` (+ Drive N/A) | Attendance, AdminAttendance, TeamStatusPanel, dashboards |
| Leave & balances | `Leave`, `LeaveBalance`, `LeaveType`, `PublicHoliday` | Leaves, dashboards |
| Work | `Task`, `TaskComment`, `TaskTransfer`, `Timesheet` | Projects, Timesheets, dashboards |
| Money | `Expense`, `ExpenseType` (bills in Drive) | Expenses, admin dashboard |
| Comms | `Channel`, `Message` | Chat, global toasts |
| Training | `TrainerLog`, `TrainingBatch`, `College`, `Course` | TrainerLog, ManageBatches |
| Config | `Settings`, `Client` | admin screens |
