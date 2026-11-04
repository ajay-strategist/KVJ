import { describe, it, expect } from 'vitest';
import {
  sortTasksWithSupervisorTier,
  isTaskAssignedToUser,
  type OrderableTask,
  type UserIdentity,
} from '../app/pages/workspaces/task-ordering';

describe('Task Ordering & Supervisor Tier Logic', () => {
  const currentUser: UserIdentity = {
    id: 'user-ajay',
    fullName: 'Ajay Thomas',
  };

  it('accurately identifies whether a task is assigned to the current user or is a supervisor view task', () => {
    // Assigned by id
    expect(isTaskAssignedToUser({ assigneeId: 'user-ajay' }, currentUser)).toBe(true);
    // Assigned by name
    expect(isTaskAssignedToUser({ assignee: 'Ajay Thomas' }, currentUser)).toBe(true);
    // Assigned by lowercase name
    expect(isTaskAssignedToUser({ assignee: 'ajay thomas' }, currentUser)).toBe(true);
    // Different assignee id -> supervisor task
    expect(isTaskAssignedToUser({ assigneeId: 'user-linto' }, currentUser)).toBe(false);
    // Different assignee name -> supervisor task
    expect(isTaskAssignedToUser({ assignee: 'Linto George' }, currentUser)).toBe(false);
    // No assignee specified -> defaults to user's task
    expect(isTaskAssignedToUser({}, currentUser)).toBe(true);
  });

  it('places a newly created own task at the top above existing ordered tasks', () => {
    const existingTasks: OrderableTask[] = [
      { id: 'task-1', title: 'Task 1', assigneeId: 'user-ajay', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'task-2', title: 'Task 2', assigneeId: 'user-ajay', createdAt: '2026-11-01T11:00:00Z' },
    ];
    // User had arranged task-2, then task-1
    const savedOrder = ['task-2', 'task-1'];

    const newOwnTask: OrderableTask = {
      id: 'task-new-own',
      title: 'New Own Task',
      assigneeId: 'user-ajay',
      createdAt: '2026-11-04T09:00:00Z',
    };

    const sorted = sortTasksWithSupervisorTier([newOwnTask, ...existingTasks], savedOrder, currentUser);

    // The new own task MUST be placed at the top
    expect(sorted[0].id).toBe('task-new-own');
    // The existing tasks maintain the user's manual order
    expect(sorted[1].id).toBe('task-2');
    expect(sorted[2].id).toBe('task-1');
  });

  it('moves a newly created supervisor task to the bottom below existing tasks', () => {
    const existingTasks: OrderableTask[] = [
      { id: 'task-1', title: 'Task 1', assigneeId: 'user-ajay', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'task-2', title: 'Task 2', assigneeId: 'user-ajay', createdAt: '2026-11-01T11:00:00Z' },
    ];
    const savedOrder = ['task-2', 'task-1'];

    // Supervisor task assigned to Linto George
    const newSupervisorTask: OrderableTask = {
      id: 'task-sup-review',
      title: 'Proposal Review (Supervisor View)',
      assigneeId: 'user-linto',
      assignee: 'Linto George',
      supervisorId: 'user-ajay',
      createdAt: '2026-11-04T09:00:00Z',
    };

    const sorted = sortTasksWithSupervisorTier([newSupervisorTask, ...existingTasks], savedOrder, currentUser);

    // Existing own tasks must remain above, in their saved order
    expect(sorted[0].id).toBe('task-2');
    expect(sorted[1].id).toBe('task-1');
    // The new supervisor task MUST be at the bottom!
    expect(sorted[2].id).toBe('task-sup-review');
  });

  it('places own tasks at the top and supervisor tasks at the bottom by default (or when order is reset)', () => {
    const tasks: OrderableTask[] = [
      { id: 'sup-1', title: 'Supervisor Task 1', assigneeId: 'user-linto', createdAt: '2026-11-04T12:00:00Z' },
      { id: 'own-1', title: 'My Task 1', assigneeId: 'user-ajay', createdAt: '2026-11-04T09:00:00Z' },
      { id: 'sup-2', title: 'Supervisor Task 2', assigneeId: 'user-freddy', createdAt: '2026-11-04T10:00:00Z' },
      { id: 'own-2', title: 'My Task 2', assigneeId: 'user-ajay', createdAt: '2026-11-04T11:00:00Z' },
    ];

    // Reset order (empty savedOrder)
    const sorted = sortTasksWithSupervisorTier(tasks, [], currentUser);

    // All own tasks must be in top tier (newest first: own-2 at 11:00, then own-1 at 09:00)
    expect(sorted[0].id).toBe('own-2');
    expect(sorted[1].id).toBe('own-1');

    // All supervisor tasks must be in bottom tier (newest first: sup-1 at 12:00, then sup-2 at 10:00)
    expect(sorted[2].id).toBe('sup-1');
    expect(sorted[3].id).toBe('sup-2');
  });

  it('preserves complete drag & drop sequence once user reorders manually', () => {
    const tasks: OrderableTask[] = [
      { id: 't1', title: 'Own Task 1', assigneeId: 'user-ajay' },
      { id: 't2', title: 'Own Task 2', assigneeId: 'user-ajay' },
      { id: 't3', title: 'Supervisor Task', assigneeId: 'user-other' },
    ];
    // User explicitly dragged supervisor task t3 to the top, then t1, then t2
    const savedOrder = ['t3', 't1', 't2'];

    const sorted = sortTasksWithSupervisorTier(tasks, savedOrder, currentUser);
    expect(sorted.map((t) => t.id)).toEqual(['t3', 't1', 't2']);
  });

  it('orders multiple new tasks correctly: new own tasks at top (newest first), new supervisor tasks at bottom', () => {
    const existingTasks: OrderableTask[] = [
      { id: 'existing-own', title: 'Existing Own', assigneeId: 'user-ajay', createdAt: '2026-11-01T10:00:00Z' },
    ];
    const savedOrder = ['existing-own'];

    const newOwnEarlier: OrderableTask = {
      id: 'own-early',
      title: 'Own Early',
      assigneeId: 'user-ajay',
      createdAt: '2026-11-04T08:00:00Z',
    };
    const newOwnLater: OrderableTask = {
      id: 'own-late',
      title: 'Own Late',
      assigneeId: 'user-ajay',
      createdAt: '2026-11-04T10:00:00Z',
    };
    const newSupervisor: OrderableTask = {
      id: 'sup-task',
      title: 'Supervisor Task',
      assigneeId: 'user-other',
      createdAt: '2026-11-04T11:00:00Z',
    };

    const sorted = sortTasksWithSupervisorTier(
      [existingTasks[0], newSupervisor, newOwnEarlier, newOwnLater],
      savedOrder,
      currentUser
    );

    // New own tasks newest-first at top -> existing saved tasks -> new supervisor tasks at bottom
    expect(sorted.map((t) => t.id)).toEqual([
      'own-late',
      'own-early',
      'existing-own',
      'sup-task',
    ]);
  });
});
