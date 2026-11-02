# FlowDesk Technical Issue Specification: ISSUE-009

**Issue Identifier:** ISSUE-009  
**Issue Title:** Task Approval & Rejection Lifecycle Governance (Pre-Start Deletion vs. Post-Start Preservation)  
**Module / Area:** Approvals Queue / Task Management  
**Category:** Business Logic / Data Integrity  
**Priority:** High  
**Investigation Status:** Root Cause Identified (`ApprovalsQueue.tsx:472`)  
**Decision Status:** Approved — Not Yet Implemented (Stakeholder Confirmation 31 Oct 2026)  
**Fix Status:** Open — Not Fixed (Pending Implementation & Verification)  
**Date Documented:** 2026-10-31  

---

## 1. Executive Summary

In the current implementation of the Approvals Queue ([`src/modules/attendance/pages/ApprovalsQueue.tsx#L471-L479`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/pages/ApprovalsQueue.tsx#L471-L479)), rejecting a task assignment unconditionally calls `deleteTask(task.id)`. This action hard-deletes the task record from the database regardless of whether work was performed, destroying worklogs, timer history, and audit context.

On 31 October 2026, the stakeholder reviewed the task approval lifecycle and formally finalized the business rules governing Task Approval and Rejection. 

There are **two distinct Task Approval scenarios** with separate governance rules:
1. **Scenario A:** Pre-Start Task Approval (Before any work has started).
2. **Scenario B:** Post-Start / Post-Work Task Review (After an employee has started or worked on the task).

---

## 2. Technical Evidence & Current Implementation

* **Source File:** [`src/modules/attendance/pages/ApprovalsQueue.tsx#L471-L479`](file:///Users/apple/Downloads/flow-desk-main/src/modules/attendance/pages/ApprovalsQueue.tsx#L471-L479)
* **Code Trace:**
  ```typescript
  const handleRejectTaskAssignmentInline = async (task: any) => {
    const proj = projects.find((p) => p.id === task.projectId);
    const projTitle = proj ? proj.title : 'Office Task';
    const ok = await confirm({
      title: 'Reject Assignment?',
      message: `Confirm rejecting task "${projTitle}: ${task.title}"?`,
    });
    if (!ok) return;

    const res = await deleteTask(task.id);
    if (res.ok) {
      toast({ variant: 'warning', title: 'Assignment Rejected', message: `Task "${task.title}" was rejected and removed.` });
      refreshProjects();
    } else {
      toast({ variant: 'error', title: 'Rejection Failed', message: res.error });
    }
  };
  ```
* **Failure Analysis:** The handler executes `deleteTask(task.id)` without checking whether the task was ever started, whether timer sessions exist, or whether the rejection is a pre-start assignment rejection or a post-work review rejection.

---

## 3. Final Approved Business Rules

### Scenario A — Pre-Start Task Approval

This scenario applies when a Project Supervisor must approve a proposed Task before the Employee can start working on it.

1. **Mandatory Approval Before Start:** The Employee must receive approval from the Project Supervisor before starting the Task.
2. **Approval Outcome:** If the Supervisor approves, the Employee can start working on the Task.
3. **Rejection Outcome (Permanent Deletion):** If the Supervisor rejects the Task **before the Employee has ever started it**:
   - Permanently delete the Task record from the database.
   - Delete its associated rejection record as well.
   - Do not retain a rejection history for this pre-start rejection.
4. **Strict Boundary:** This hard-deletion rule applies **ONLY when the Task has never been started**.

---

### Scenario B — Post-Start / Post-Work Task Review

This scenario applies when an Employee has started working on a Task and subsequently submits it for Supervisor review.

1. **Absolute Deletion Protection:** Once an Employee has started a Task, the Task record **must NEVER be hard-deleted** through the rejection workflow.
2. **Protection at Zero Work Hours:** This protection applies **even when recorded Work Hours are zero** (e.g. the employee started and immediately paused/submitted, or worked brief seconds).
3. **Preservation of History:** The system must strictly preserve the Task record, Employee start details, available work history, and relevant submission information.
4. **Automatic Calculation of Work Hours:** Work Hours must be calculated and recorded automatically by the existing application workflow (`flwdsk_task_work_sessions`).
5. **No Manual Work Hours Entry:** The Employee must not be required to manually enter Work Hours when submitting a Task.
6. **Zero Work Hours Submission Eligibility:** A Task with zero Work Hours must still be eligible for submission. A zero balance must never block submission.
7. **Approval Outcome:** If the Supervisor approves the submitted Task, change its status to **`Approved`** (or `Completed`).
8. **Rejection Outcome (Preserve & Close):** If the Supervisor rejects the submitted Task:
   - **Preserve the Task record** in the database.
   - Change its status to **`Rejected / Closed`**.
   - Preserve recorded Work Hours and available Task History.
   - **Rejection Reason is optional, not mandatory.**
   - **Do not allow the Employee to resubmit the rejected and closed Task.**

---

## 4. Critical Deletion Decision Matrix

The deletion decision must be based on **whether the Employee has EVER started the Task**, and **NOT** merely on whether Work Hours are greater than zero.

| Task Condition at Rejection | Required Workflow Outcome | Action on Task Record | Action on Rejection Record |
|---|---|---|---|
| **Never started; no start history** | Pre-Start Rejection | **Hard-delete Task record** | **Hard-delete rejection record** |
| **Started; Work Hours greater than zero** | Post-Start Rejection | **Preserve Task; mark `Rejected / Closed`** | Preserve rejection details & history |
| **Started; Work Hours equal to zero** | Post-Start Rejection | **Preserve Task; mark `Rejected / Closed`** | Preserve rejection details & history |
| **Submitted for review and approved** | Post-Start Approval | **Mark `Approved` (or `Completed`)** | Record approval timestamp & reviewer |
| **Submitted for review and rejected** | Post-Start Rejection | **Preserve Task; mark `Rejected / Closed`** | Optional reason; no resubmission permitted |

> [!IMPORTANT]
> **Prohibition on `work_hours > 0` as Sole Check:**  
> Systems must never use `work_hours > 0` as the sole condition to allow deletion. A task that was started but logged zero rounded hours (e.g. under 1 minute) has an established lifecycle start event and must be protected from deletion.

---

## 5. Technical Implementation Questions & Considerations

To ensure safe implementation during rework without inventing speculative database structures:

1. **Reliable Determination of "Ever Started":**  
   - *Technical Question:* How does the system determine whether an employee has "ever started" a task?
   - *Implementation Evaluation:* The check should inspect whether any associated work session exists in `flwdsk_task_work_sessions WHERE task_id = task.id`, or whether the task record contains a populated `started_at` timestamp or status progression beyond initial draft/assigned state (`status != 'pending_approval' && status != 'assigned'`).
   - *Database Integrity Constraint:* Do not invent new database schemas or modify tables today. Implementation must utilize verified existing relations (`flwdsk_task_work_sessions`).
2. **Approvals Queue Handler Refactoring:**  
   - In `ApprovalsQueue.tsx`, `handleRejectTaskAssignmentInline` must distinguish whether the task is in `pending_approval` (Pre-Start) or `under_review` (Post-Start/Review).
   - For Pre-Start tasks: invoke `deleteTask(task.id)`.
   - For Post-Start tasks: invoke `updateTask(task.id, { status: 'rejected_closed', rejectionReason: notes || null })`.

---

## 6. Status and Decision Tracking

* **Business Policy Decision:** **Approved & Finalized** (Stakeholder Confirmation 31 Oct 2026).
* **Technical Implementation:** **Not Yet Implemented** (Scheduled for Rework phase).
* **Issue Register Status:** **Open — Not Fixed** (Will be marked fixed only after code implementation and verification tests pass).
