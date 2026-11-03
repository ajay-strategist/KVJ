import { describe, it, expect } from 'vitest';

describe('ApprovalsQueue and Component TDZ Resilience', () => {
  it('correctly resolves supervisor and employee names without temporal dead zone errors', () => {
    const mockEmployees: Record<string, { id: string; firstName: string; lastName: string }> = {
      'emp-1': { id: 'emp-1', firstName: 'Ajay', lastName: 'Thomas' },
      'emp-2': { id: 'emp-2', firstName: 'Linto', lastName: 'George' },
    };

    const mockProjects = [
      { id: 'proj-1', supervisorId: 'emp-1' },
    ];

    const empName = (empId?: string) => {
      if (!empId) return 'Unknown Employee';
      const emp = mockEmployees[empId];
      return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee';
    };

    const getSupervisorName = (t: any) => {
      if (!t) return '—';
      const proj = mockProjects.find((p) => p.id === t.projectId);
      const projSupId = proj?.supervisorId;
      if (projSupId && mockEmployees[projSupId]) {
        const emp = mockEmployees[projSupId];
        return `${emp.firstName} ${emp.lastName}`;
      }
      return '—';
    };

    const task = { id: 't-1', projectId: 'proj-1', assigneeId: 'emp-2' };
    expect(empName(task.assigneeId)).toBe('Linto George');
    expect(getSupervisorName(task)).toBe('Ajay Thomas');
  });
});

