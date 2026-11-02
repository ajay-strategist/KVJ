import { describe, it, expect } from 'vitest';
import { determineTaskRejectionAction } from '../shared/utils/taskRejection';

describe('Task Rejection Lifecycle Governance (BR-TASK-007 & ISSUE-009)', () => {
  it('determines DELETE for never-started task with zero hours', () => {
    const action = determineTaskRejectionAction({
      id: 'task-1',
      actualHours: 0,
      totalHoursWorked: 0,
      hasWorkSessions: false,
    });
    expect(action).toBe('DELETE');
  });

  it('determines PRESERVE_AS_REJECTED_CLOSED for ever-started task with logged actualHours', () => {
    const action = determineTaskRejectionAction({
      id: 'task-2',
      actualHours: 1.5,
    });
    expect(action).toBe('PRESERVE_AS_REJECTED_CLOSED');
  });

  it('determines PRESERVE_AS_REJECTED_CLOSED when hasWorkSessions is true even with fractional hours', () => {
    const action = determineTaskRejectionAction({
      id: 'task-3',
      actualHours: 0.05,
      hasWorkSessions: true,
    });
    expect(action).toBe('PRESERVE_AS_REJECTED_CLOSED');
  });
});

