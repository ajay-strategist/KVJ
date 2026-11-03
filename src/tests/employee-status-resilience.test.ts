import { describe, it, expect, vi } from 'vitest';
import { SupabaseEmployeeRepository } from '../modules/employee/supabase-employee.repository';

describe('SupabaseEmployeeRepository status mapping resilience', () => {
  it('maps "relieved" and "resigned" to PostgreSQL "terminated"', async () => {
    const repo = new SupabaseEmployeeRepository();
    // Access private method sanitizeEmployeeData via any cast
    const sanitizedRelieved = (repo as any).sanitizeEmployeeData({ status: 'relieved' });
    expect(sanitizedRelieved.status).toBe('terminated');

    const sanitizedResigned = (repo as any).sanitizeEmployeeData({ status: 'resigned' });
    expect(sanitizedResigned.status).toBe('terminated');
  });

  it('maps "on_notice" to PostgreSQL "active" so login and work can continue', async () => {
    const repo = new SupabaseEmployeeRepository();
    const sanitized = (repo as any).sanitizeEmployeeData({ status: 'on_notice' });
    expect(sanitized.status).toBe('active');
  });

  it('maps database "terminated" back to "relieved" for application display', async () => {
    const repo = new SupabaseEmployeeRepository();
    const appEmp = (repo as any).toAppEmployee({ id: '123', status: 'terminated' });
    expect(appEmp.status).toBe('relieved');
  });

  it('preserves "active" and "suspended" without modification', async () => {
    const repo = new SupabaseEmployeeRepository();
    const active = (repo as any).sanitizeEmployeeData({ status: 'active' });
    expect(active.status).toBe('active');

    const suspended = (repo as any).sanitizeEmployeeData({ status: 'suspended' });
    expect(suspended.status).toBe('suspended');
  });

  describe('Active task in progress validation', () => {
    const isTaskTrulyInProgress = (task: any): boolean => {
      if (!task) return false;
      const s = String(task.status || '').toLowerCase().trim();
      if (
        s === 'review' ||
        s === 'under review' ||
        s === 'under_review' ||
        s === 'done' ||
        s === 'completed' ||
        s === 'closed' ||
        s === 'cancelled'
      ) {
        return false;
      }
      const app = String(task.approvalStatus || (task as any).approval_status || '').toLowerCase().trim();
      if (app === 'pending_task_approval' || app === 'submitted') {
        return false;
      }
      if (task.underReview || (task as any).under_review) {
        return false;
      }
      return true;
    };

    it('rejects submitted tasks from being displayed as active task in progress', () => {
      expect(isTaskTrulyInProgress({ status: 'review' })).toBe(false);
      expect(isTaskTrulyInProgress({ status: 'Under Review' })).toBe(false);
      expect(isTaskTrulyInProgress({ status: 'done' })).toBe(false);
      expect(isTaskTrulyInProgress({ status: 'completed' })).toBe(false);
      expect(isTaskTrulyInProgress({ status: 'in_progress', approvalStatus: 'pending_task_approval' })).toBe(false);
      expect(isTaskTrulyInProgress({ status: 'in_progress', underReview: true })).toBe(false);
    });

    it('accepts only truly in_progress tasks without review or completion flags', () => {
      expect(isTaskTrulyInProgress({ status: 'in_progress' })).toBe(true);
      expect(isTaskTrulyInProgress({ status: 'In Progress' })).toBe(true);
    });
  });
});

