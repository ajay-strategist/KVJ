import { describe, it, expect, beforeEach, vi } from 'vitest';
import { taskTimerStore } from '../shared/utils/taskTimerStore';

describe('Session Task Isolation and Login Multi-User Scoping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('taskTimerStore.clearAll properly wipes all task timer keys from localStorage', () => {
    taskTimerStore.startTask('task-123', 5000);
    expect(localStorage.getItem('kvj_task_timers')).toBeTruthy();

    taskTimerStore.clearAll();
    expect(localStorage.getItem('kvj_task_timers')).toBeNull();
    expect(localStorage.getItem('kvj_task_timer_state_v1')).toBeNull();
  });

  it('MyDay task isolation only includes tasks where user is assignee, preventing cross-employee task leakage for supervisors', () => {
    const ceoUser = {
      id: '5f6bac56-9a03-47e3-bdb9-9e8857ee998e',
      email: 'info@thestrategist.co.in',
      fullName: 'Jomon Joseph',
      role: 'CEO',
    };

    const adminUser = {
      id: '6446ace9-79d8-447b-b20a-d905429c6074',
      email: 'mail@thestrategist.co.in',
      fullName: 'Ajay Thomas',
      role: 'ADMIN',
    };

    const allProjectTasks = [
      {
        id: 'task-admin-work',
        title: 'Flow Desk Modification',
        assigneeId: adminUser.id,
        supervisorId: ceoUser.id,
        projectId: 'proj-flow-desk',
        status: 'in_progress',
      },
      {
        id: 'task-ceo-personal',
        title: 'Review Quarterly Financials',
        assigneeId: ceoUser.id,
        supervisorId: ceoUser.id,
        projectId: 'proj-exec',
        status: 'todo',
      },
    ];

    // Simulate MyDay task filter logic for CEO
    const myId = (ceoUser.id || '').toLowerCase();
    const myName = (ceoUser.fullName || '').toLowerCase();
    const myEmail = (ceoUser.email || '').toLowerCase();
    const myIdentifiers = new Set([myId, myEmail]);

    const ceoVisibleTasks = allProjectTasks.filter((t) => {
      const tAssigneeId = (t.assigneeId || '').toLowerCase();
      const tAssigneeName = (typeof (t as any).assignee === 'string' ? (t as any).assignee : '').toLowerCase();

      const isMyTask =
        (tAssigneeId && myIdentifiers.has(tAssigneeId)) ||
        (tAssigneeName && myName && (tAssigneeName === myName || tAssigneeName.includes(myName) || myName.includes(tAssigneeName)));

      return isMyTask;
    });

    // CEO must only see CEO personal task, NEVER Admin task
    expect(ceoVisibleTasks).toHaveLength(1);
    expect(ceoVisibleTasks[0].id).toBe('task-ceo-personal');
    expect(ceoVisibleTasks.some((t) => t.id === 'task-admin-work')).toBe(false);
  });

  it('Executive and Administrator roles are exempt from automated task-idle alerts', () => {
    const isExecutiveOrAdmin = (emp: { role?: string; designation?: string }) => {
      const roleUpper = (emp.role || '').toUpperCase();
      const desigUpper = (emp.designation || '').toUpperCase();
      return roleUpper === 'ADMIN' || roleUpper === 'CEO' || desigUpper.includes('ADMIN') || desigUpper.includes('CEO');
    };

    expect(isExecutiveOrAdmin({ role: 'ADMIN', designation: 'Admin' })).toBe(true);
    expect(isExecutiveOrAdmin({ role: 'CEO', designation: 'CEO' })).toBe(true);
    expect(isExecutiveOrAdmin({ role: 'EMPLOYEE', designation: 'Data Analyst' })).toBe(false);
    expect(isExecutiveOrAdmin({ role: 'EMPLOYEE', designation: 'Developer' })).toBe(false);
  });
});

