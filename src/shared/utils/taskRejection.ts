/**
 * Task Rejection & Deletion Governance Utilities
 * Enforces Rule BR-TASK-007, DISC-003, and ISSUE-009.
 * 
 * Rules:
 * 1. Governed strictly by whether the employee EVER started the task.
 * 2. If NEVER started (actualHours === 0 and zero work sessions): delete task and record.
 * 3. If EVER started (actualHours > 0 or has work sessions): preserve task and work history,
 *    set status to 'Rejected / Closed' (or 'rejected_closed').
 */

export interface TaskRejectionCandidate {
  id: string;
  actualHours?: number;
  totalHoursWorked?: number;
  hasWorkSessions?: boolean;
}

export type TaskRejectionAction = 'DELETE' | 'PRESERVE_AS_REJECTED_CLOSED';

/**
 * Determines whether a rejected task must be deleted or preserved with status 'Rejected / Closed'.
 */
export function determineTaskRejectionAction(task: TaskRejectionCandidate): TaskRejectionAction {
  const hours = Number(task.actualHours || task.totalHoursWorked || 0);
  const everStarted = hours > 0 || !!task.hasWorkSessions;

  return everStarted ? 'PRESERVE_AS_REJECTED_CLOSED' : 'DELETE';
}

