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
});

