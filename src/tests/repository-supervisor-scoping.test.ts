import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectService } from '../modules/project/project.service';
import type { Project, ResourceAllocation } from '../modules/project/project.repository';
import { container } from '../core/registry';
import {
  PROJECT_REPOSITORY_TOKEN,
  RESOURCE_ALLOCATION_REPOSITORY_TOKEN,
  TASK_REPOSITORY_TOKEN,
  CLIENT_REPOSITORY_TOKEN,
  MILESTONE_REPOSITORY_TOKEN,
  TIMESHEET_REPOSITORY_TOKEN,
} from '../modules/project/project.repository';
import { ACTIVITY_ENGINE_TOKEN } from '../core/engines/activity';
import { AUDIT_ENGINE_TOKEN } from '../core/engines/audit';
import { APPROVAL_ENGINE_TOKEN } from '../core/engines/approval';
import { NOTIFICATION_ENGINE_TOKEN } from '../core/engines/notification';

describe('Phase 4: Project Supervisor Authority & Scoping (PROJECT-Q1, DISC-004, ISSUE-006)', () => {
  const supervisorId = '11111111-1111-4111-a111-111111111111';
  const otherEmpId = '22222222-2222-4222-a222-222222222222';
  const projectId1 = '33333333-3333-4333-a333-333333333333';
  const projectId2 = '44444444-4444-4444-a444-444444444444';

  const mockProjects: any[] = [
    {
      id: projectId1,
      title: 'Alpha Project',
      code: 'PRJ-ALPHA',
      clientId: 'c1',
      status: 'execution',
      priority: 'medium',
      category: 'Internal',
      type: 'Development',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: projectId2,
      title: 'Beta Project',
      code: 'PRJ-BETA',
      clientId: 'c1',
      status: 'execution',
      priority: 'medium',
      category: 'Internal',
      type: 'Development',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      supervisorId: supervisorId,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const mockAllocations: any[] = [
    {
      id: 'a1',
      projectId: projectId1,
      employeeId: supervisorId,
      role: 'Supervisor',
      status: 'active',
      startDate: '2026-01-01',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'a2',
      projectId: projectId1,
      employeeId: otherEmpId,
      role: 'Team Member',
      status: 'active',
      startDate: '2026-01-01',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  beforeEach(() => {
    container.register(PROJECT_REPOSITORY_TOKEN, () => ({
      findById: vi.fn(async (id: string) => mockProjects.find((p) => p.id === id) || null),
      findMany: vi.fn(async () => ({ data: mockProjects, total: mockProjects.length })),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      hardDelete: vi.fn(),
      restore: vi.fn(),
    } as any));

    container.register(RESOURCE_ALLOCATION_REPOSITORY_TOKEN, () => ({
      findByEmployee: vi.fn(async (empId: string) => mockAllocations.filter((a) => a.employeeId === empId)),
      findByProject: vi.fn(async (pId: string) => mockAllocations.filter((a) => a.projectId === pId)),
      findById: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      hardDelete: vi.fn(),
      restore: vi.fn(),
    } as any));

    container.register(TASK_REPOSITORY_TOKEN, () => ({
      findById: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      hardDelete: vi.fn(),
      restore: vi.fn(),
      findByProject: vi.fn(),
    } as any));

    container.register(CLIENT_REPOSITORY_TOKEN, () => ({} as any));
    container.register(MILESTONE_REPOSITORY_TOKEN, () => ({} as any));
    container.register(TIMESHEET_REPOSITORY_TOKEN, () => ({} as any));
    container.register(ACTIVITY_ENGINE_TOKEN, () => ({ log: vi.fn() } as any));
    container.register(AUDIT_ENGINE_TOKEN, () => ({ log: vi.fn() } as any));
    container.register(APPROVAL_ENGINE_TOKEN, () => ({} as any));
    container.register(NOTIFICATION_ENGINE_TOKEN, () => ({ send: vi.fn() } as any));
  });

  it('getSupervisorProjects resolves projects where employee is allocated as supervisor or assigned supervisorId', async () => {
    const service = new ProjectService();
    const res = await service.getSupervisorProjects(supervisorId);

    expect(res.ok).toBe(true);
    if (res.ok) {
      const ids = res.value.map((p) => p.id);
      expect(ids).toContain(projectId1); // via flwdsk_resource_allocations role='Supervisor'
      expect(ids).toContain(projectId2); // via project.supervisorId
    }
  });

  it('getSupervisorProjects returns empty for an employee with only Team Member allocation', async () => {
    const service = new ProjectService();
    const res = await service.getSupervisorProjects(otherEmpId);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toHaveLength(0);
    }
  });
});
