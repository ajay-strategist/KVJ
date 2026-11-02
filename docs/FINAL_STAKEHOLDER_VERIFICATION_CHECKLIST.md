# FINAL STAKEHOLDER VERIFICATION CHECKLIST

**Document ID:** `docs/FINAL_STAKEHOLDER_VERIFICATION_CHECKLIST.md`  
**Date:** November 2, 2026  
**Status:** **READY FOR PERSONAL STAKEHOLDER WALKTHROUGH**  
**Authoritative References:**
- `docs/FINAL_IMPLEMENTATION_COMPLETION_REPORT.md`
- `docs/FINAL_UIUX_DESIGN_UPGRADE_REPORT.md`
- `docs/FINAL_LOCAL_TECHNICAL_VERIFICATION_REPORT.md`

---

## 1. Instructions for the Stakeholder

This checklist is provided for your personal review and verification of the FlowDesk Comprehensive Rework. Every item listed below has been implemented, checked against regression suites, and verified in the local development environment.

Please use this checklist to guide your local inspection before authorizing database migrations, Git Push, or staging/production deployment.

---

## 2. Interactive Feature Verification Checklist

### A. Navigation, Shell & My Day Workspace
- [ ] **`UIUX-REQ-001` — Sidebar Collapse:** Open `/app`. Verify that the collapse sidebar button in the bottom left no longer displays the `[` shortcut indicator badge. Click the button and press `[` on the keyboard to confirm sidebar toggling still works.
- [ ] **`UIUX-REQ-002` — Today's Tasks Ordering:** In My Day Workspace, reorder personal tasks via drag-and-drop. Refresh the page to confirm your custom order persists without affecting other accounts.
- [ ] **`UIUX-REQ-003` — Announcements Widget:** Dismiss an announcement notice in My Day. Confirm it hides immediately for your user account.
- [ ] **`UIUX-REQ-008` — 15-Minute Idle Alert:** Confirm attendance monitoring alerts admin when clocked in without an active task or break for 15 minutes.
- [ ] **`UIUX-REQ-013` — Clock-In Panel & Geolocation:** Click Clock In. Confirm high-contrast status badge, pre-filled batch schedule, coordinates capture, and off-shift task timer independence.
- [ ] **`ISSUE-001` & `ISSUE-003` — Task Durations & Break Toasts:** Start a task timer, refresh the page, and confirm duration does not revert or distort. Start/stop a break and confirm only a single toast notification appears.

---

### B. Project & Task Management
- [ ] **`UIUX-REQ-011` — Create Task Modal:** Open `/app/projects` and click `+ Create Task`. Confirm the modern 4-section layout (Core, Ownership, Timeline, Description). Confirm estimated hours is mandatory and due date prohibits past dates.
- [ ] **`UIUX-REQ-015` — Projects List:** Confirm top vanity KPI cards are removed. Test filtering by Status, Supervisor, and Member. Test Card View vs. Table View toggle.
- [ ] **`UIUX-REQ-016` — Task Board Active Focus View:** Open Tasks tab. Confirm top KPI cards are removed. Confirm Completed and Under Review tasks are hidden by default. Toggle `Show Completed / Under Review` to verify completed tasks reveal cleanly.
- [ ] **`DISC-003` / `ISSUE-009` — Task Rejection Governance:** Reject an ever-started task in Approvals Queue; confirm it moves to `'Rejected / Closed'` with mandatory remarks. Reject an unstarted task proposal; confirm it deletes cleanly.
- [ ] **`DISC-004` — Supervisor Scoping:** Log in as a Project Supervisor. Confirm you can only approve tasks for members allocated to your supervised projects.

---

### C. Leave Management
- [ ] **`UIUX-REQ-005` — Leave Board:** Open `/app/leave`. Confirm the top 3 KPI cards are removed. Confirm pending rows are visually highlighted in warm amber. Test the 6-item date filter suite (Current Month, Last Month, Last 6 Months, Current Financial Year, Custom Range).
- [ ] **`UIUX-REQ-006` — Apply for Leave Form:** Click `Request Leave`. Confirm the segmented Shift buttons (☀️ Full Day, 🌅 Morning, 🌇 Afternoon) and the prominent live "Total Leave Deduction" card excluding weekends (No-Sandwich Policy).
- [ ] **`ISSUE-011` — Leave Accrual Engine:** Check leave balance calculation for employees on probation or newly joined; confirm pro-rata quota based on active tenure.

---

### D. Training Operations
- [ ] **`UIUX-REQ-009` — Batch Management:** Open `/app/training/batches`. Confirm batches sort by newest `created_at DESC`, `"Batch:"` prefix is removed, and `"Expense Details"` button is prominent.
- [ ] **`CONF-001` & `DISC-002` — Batch Status Authority:** As any employee role, open the Batch Status dropdown. Confirm all 4 statuses (`Not Started`, `In Progress`, `Completed`, `Closed`) are present, selectable, and editable.
- [ ] **`UIUX-REQ-010` — Batch Expense Details:** Click `"Expense Details"` on any batch card. Confirm man-hours are calculated strictly from verified schedule/attendance sessions.
- [ ] **`UIUX-REQ-014` & `ISSUE-005` — Training Calendar:** Open `/app/training/calendar`. Confirm copy/paste and drag-and-drop rescheduling persist to canonical table `flwdsk_schedule_sessions`.

---

### E. Finance & Expense Analytics
- [ ] **`UIUX-REQ-017` — Expense Claims & Travel:** Submit a travel claim with Bike/Car. Confirm auto-calculation based on configured rate per KM. Confirm receipt zoom preview lightbox.
- [ ] **`UIUX-REQ-018` — Expense Analytics Canvas:** Open `/app/finance/expense-analytics`. Verify all 16 metrics render cleanly across the 4 layout tiers. Confirm "Average Amount" is completely absent.
- [ ] **`UIUX-REQ-019` — Announcements Board:** Open `/app/communication/announcements`. Confirm calendar-month view and archive browsing.

---

## 3. Boundary & Technical Verification Sign-Off

- [ ] **Automated Tests:** 35/35 automated tests passing (`npm test`).
- [ ] **TypeScript Check:** Strict typecheck passing with zero errors (`npm run typecheck`).
- [ ] **Vite Production Build:** Production bundle builds cleanly in $<4$s (`npm run build`).
- [ ] **Security System:** 100% frozen; zero changes made to auth middleware, JWT, Edge Functions, or RLS.
- [ ] **Mobile App:** Directory `Mobile App/` is 100% untouched.
- [ ] **Excluded Modules:** Budgets, Procurement, Assets, and Payroll preserved without dropped tables.

---

## 4. Stakeholder Sign-Off Block

**Stakeholder Verification Result:**  
[ ] **APPROVED** — Ready for Tier 2 Database Migrations and Git Push / Deployment  
[ ] **REVISE** — Additional adjustments requested (specify below)

**Stakeholder Notes / Signature:**  
`____________________________________________________`  
**Date:** `____ / ____ / 2026`

---
*End of Final Stakeholder Verification Checklist.*

