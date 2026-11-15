import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectService } from '../modules/project/project.service';
import type { Client, Project } from '../modules/project/project.repository';
import { container } from '../core/registry';
import {
  PROJECT_REPOSITORY_TOKEN,
  CLIENT_REPOSITORY_TOKEN,
  RESOURCE_ALLOCATION_REPOSITORY_TOKEN,
  TASK_REPOSITORY_TOKEN,
  MILESTONE_REPOSITORY_TOKEN,
  TIMESHEET_REPOSITORY_TOKEN,
} from '../modules/project/project.repository';
import { ACTIVITY_ENGINE_TOKEN } from '../core/engines/activity';
import { AUDIT_ENGINE_TOKEN } from '../core/engines/audit';
import { APPROVAL_ENGINE_TOKEN } from '../core/engines/approval';
import { NOTIFICATION_ENGINE_TOKEN } from '../core/engines/notification';

describe('Project Client Persistence and Auto-Provisioning', () => {
  let service: ProjectService;
  let clientsDb: Client[];
  let projectsDb: Project[];

  const adminActor = {
    id: 'admin-1111-2222-3333-444444444444',
    role: 'ADMIN',
  };

  beforeEach(() => {
    clientsDb = [
      {
        id: 'client-uuid-1',
        name: 'KVJ Tech Labs',
        contactPerson: 'John Doe',
        email: 'john@kvj.com',
        status: 'active',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        createdBy: null,
        updatedBy: null,
        deletedAt: null,
        deletedBy: null,
      },
    ];

    projectsDb = [];

    const mockClientRepo = {
      findMany: vi.fn(async () => ({
        data: [...clientsDb],
        total: clientsDb.length,
      })),
      findById: vi.fn(async (id: string) => clientsDb.find((c) => c.id === id) || null),
      create: vi.fn(async (data: Partial<Client>) => {
        const newClient: Client = {
          id: `client-uuid-${clientsDb.length + 1}`,
          name: data.name || '',
          contactPerson: data.contactPerson || 'Primary Contact',
          email: data.email || '',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: null,
          updatedBy: null,
          deletedAt: null,
          deletedBy: null,
          ...data,
        };
        clientsDb.push(newClient);
        return newClient;
      }),
      update: vi.fn(async (id: string, patch: Partial<Client>) => {
        const idx = clientsDb.findIndex((c) => c.id === id);
        if (idx !== -1) {
          clientsDb[idx] = { ...clientsDb[idx], ...patch };
          return clientsDb[idx];
        }
        throw new Error('Not found');
      }),
    };

    const mockProjectRepo = {
      create: vi.fn(async (data: Partial<Project>) => {
        const newProj: Project = {
          id: `proj-uuid-${projectsDb.length + 1}`,
          title: data.title || '',
          code: data.code || 'KVJ-PRJ-01',
          clientId: data.clientId,
          supervisorId: data.supervisorId,
          status: data.status || 'planning',
          priority: data.priority || 'medium',
          category: data.category || 'Client',
          type: 'Standard',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: null,
          updatedBy: null,
          deletedAt: null,
          deletedBy: null,
          ...data,
        };
        projectsDb.push(newProj);
        return newProj;
      }),
      update: vi.fn(async (id: string, patch: Partial<Project>) => {
        const idx = projectsDb.findIndex((p) => p.id === id);
        if (idx !== -1) {
          projectsDb[idx] = { ...projectsDb[idx], ...patch };
          return projectsDb[idx];
        }
        throw new Error('Project not found');
      }),
      findById: vi.fn(async (id: string) => projectsDb.find((p) => p.id === id) || null),
    };

    const mockAllocationRepo = {
      create: vi.fn(async (data: any) => data),
      findMany: vi.fn(async () => ({ data: [], total: 0 })),
      hardDelete: vi.fn(async () => {}),
    };

    const mockEngine = {
      log: vi.fn(async () => {}),
    };

    container.register(CLIENT_REPOSITORY_TOKEN, () => mockClientRepo as any);
    container.register(PROJECT_REPOSITORY_TOKEN, () => mockProjectRepo as any);
    container.register(RESOURCE_ALLOCATION_REPOSITORY_TOKEN, () => mockAllocationRepo as any);
    container.register(TASK_REPOSITORY_TOKEN, () => ({} as any));
    container.register(MILESTONE_REPOSITORY_TOKEN, () => ({} as any));
    container.register(TIMESHEET_REPOSITORY_TOKEN, () => ({} as any));
    container.register(ACTIVITY_ENGINE_TOKEN, () => mockEngine as any);
    container.register(AUDIT_ENGINE_TOKEN, () => mockEngine as any);
    container.register(APPROVAL_ENGINE_TOKEN, () => mockEngine as any);
    container.register(NOTIFICATION_ENGINE_TOKEN, () => mockEngine as any);

    service = new ProjectService();
  });

  it('saves an explicit existing clientId on project creation', async () => {
    const res = await service.createProject(
      {
        title: 'Project With Existing Client',
        code: 'KVJ-PRJ-101',
        clientId: 'client-uuid-1',
      },
      adminActor
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.clientId).toBe('client-uuid-1');
    expect(clientsDb.length).toBe(1); // No new client created
  });

  it('auto-registers a new client in clientRepo when clientName is passed and links clientId', async () => {
    const res = await service.createProject(
      {
        title: 'Marian College Placement Portal',
        code: 'KVJ-PRJ-PCMIM',
        clientName: 'Marian College',
      },
      adminActor
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Client should have been created in clientsDb
    const createdClient = clientsDb.find((c) => c.name === 'Marian College');
    expect(createdClient).toBeDefined();
    expect(createdClient?.id).toBeDefined();
    // Project should have the new clientId assigned
    expect(res.value.clientId).toBe(createdClient?.id);
  });

  it('matches existing client case-insensitively when clientName is passed', async () => {
    const res = await service.createProject(
      {
        title: 'KVJ Internal Ops',
        code: 'KVJ-PRJ-99',
        clientName: 'kvj tech labs', // existing client with different casing
      },
      adminActor
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.clientId).toBe('client-uuid-1');
    expect(clientsDb.length).toBe(1); // Did not create a duplicate
  });

  it('sets clientId to null when clientName is "Independent"', async () => {
    const res = await service.createProject(
      {
        title: 'Internal R&D Project',
        code: 'KVJ-PRJ-RD',
        clientName: 'Independent',
      },
      adminActor
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.clientId).toBeNull();
  });

  it('updates project client by auto-registering a new client name', async () => {
    // 1. Create a project initially without a client
    const initRes = await service.createProject(
      {
        title: 'Flavourmax App',
        code: 'KVJ-PRJ-20',
      },
      adminActor
    );
    expect(initRes.ok).toBe(true);
    if (!initRes.ok) return;
    expect(initRes.value.clientId).toBeUndefined();

    // 2. Update with newly typed client "Flavourmax"
    const updateRes = await service.updateProject(
      initRes.value.id,
      {
        clientName: 'Flavourmax',
      },
      adminActor
    );

    expect(updateRes.ok).toBe(true);
    if (!updateRes.ok) return;
    const flavourmaxClient = clientsDb.find((c) => c.name === 'Flavourmax');
    expect(flavourmaxClient).toBeDefined();
    expect(updateRes.value.clientId).toBe(flavourmaxClient?.id);
  });

  it('updates project client to null when client is set to Independent', async () => {
    // 1. Create project with client
    const initRes = await service.createProject(
      {
        title: 'Proctrix System',
        code: 'KVJ-PRJ-003',
        clientId: 'client-uuid-1',
      },
      adminActor
    );
    expect(initRes.ok).toBe(true);
    if (!initRes.ok) return;
    expect(initRes.value.clientId).toBe('client-uuid-1');

    // 2. Change client to Independent
    const updateRes = await service.updateProject(
      initRes.value.id,
      {
        clientName: 'Independent',
      },
      adminActor
    );

    expect(updateRes.ok).toBe(true);
    if (!updateRes.ok) return;
    expect(updateRes.value.clientId).toBeNull();
  });
});
