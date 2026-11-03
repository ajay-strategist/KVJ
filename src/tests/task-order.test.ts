import { describe, it, expect } from 'vitest';

interface TestTask {
  id: string;
  title: string;
  createdAt?: string;
}

function sortTasks(tasks: TestTask[], savedOrder: string[]): TestTask[] {
  return [...tasks].sort((a, b) => {
    const idxA = savedOrder.indexOf(a.id);
    const idxB = savedOrder.indexOf(b.id);
    // Both tasks are in user's saved manual order
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    // Task A is new (not in savedOrder) -> bring to top
    if (idxA === -1 && idxB !== -1) return -1;
    // Task B is new (not in savedOrder) -> bring to top
    if (idxA !== -1 && idxB === -1) return 1;
    // Both are new -> sort newest created first
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    return a.id.localeCompare(b.id);
  });
}

describe('Task Ordering & Drag & Drop Reorder Logic', () => {
  it('places a newly created task at the top above existing ordered tasks', () => {
    const existingTasks: TestTask[] = [
      { id: 'task-1', title: 'Task 1', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'task-2', title: 'Task 2', createdAt: '2026-11-01T11:00:00Z' },
      { id: 'task-3', title: 'Task 3', createdAt: '2026-11-01T12:00:00Z' },
    ];
    // User had arranged task-2, then task-1, then task-3 via drag & drop
    const savedOrder = ['task-2', 'task-1', 'task-3'];

    const newTask: TestTask = {
      id: 'task-new',
      title: 'New Task',
      createdAt: '2026-11-03T09:00:00Z',
    };

    const sorted = sortTasks([newTask, ...existingTasks], savedOrder);

    // The new task MUST be at the top
    expect(sorted[0].id).toBe('task-new');
    // The existing tasks must maintain the user's drag & drop order
    expect(sorted[1].id).toBe('task-2');
    expect(sorted[2].id).toBe('task-1');
    expect(sorted[3].id).toBe('task-3');
  });

  it('orders multiple new tasks newest-first at the top', () => {
    const existingTasks: TestTask[] = [
      { id: 'task-old', title: 'Old Task', createdAt: '2026-11-01T10:00:00Z' },
    ];
    const savedOrder = ['task-old'];

    const newEarlier: TestTask = {
      id: 'task-new-earlier',
      title: 'New Earlier',
      createdAt: '2026-11-03T08:00:00Z',
    };
    const newLater: TestTask = {
      id: 'task-new-later',
      title: 'New Later',
      createdAt: '2026-11-03T09:30:00Z',
    };

    const sorted = sortTasks([newEarlier, existingTasks[0], newLater], savedOrder);

    expect(sorted.map((t) => t.id)).toEqual(['task-new-later', 'task-new-earlier', 'task-old']);
  });

  it('preserves complete drag & drop sequence once user reorders', () => {
    const tasks: TestTask[] = [
      { id: 't1', title: 'Task 1' },
      { id: 't2', title: 'Task 2' },
      { id: 't3', title: 'Task 3' },
    ];
    // User dragged t3 to top, then t1, then t2
    const savedOrder = ['t3', 't1', 't2'];

    const sorted = sortTasks(tasks, savedOrder);
    expect(sorted.map((t) => t.id)).toEqual(['t3', 't1', 't2']);
  });

  it('places a newly created task at the top if no previous saved order exists', () => {
    const tasks: TestTask[] = [
      { id: 't1', title: 'First Task', createdAt: '2026-11-01T10:00:00Z' },
      { id: 't2', title: 'Second Task', createdAt: '2026-11-02T10:00:00Z' },
      { id: 't3', title: 'Brand New Task', createdAt: '2026-11-03T10:00:00Z' },
    ];
    const savedOrder: string[] = [];

    const sorted = sortTasks(tasks, savedOrder);
    expect(sorted[0].id).toBe('t3');
    expect(sorted[1].id).toBe('t2');
    expect(sorted[2].id).toBe('t1');
  });
});

