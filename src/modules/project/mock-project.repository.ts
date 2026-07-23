import { MemoryRepository } from '../../core/repository';
import type { UUID } from '../../core/types';
import type {
  Client, IClientRepository,
  Project, IProjectRepository,
  Milestone, IMilestoneRepository,
  ResourceAllocation, IResourceAllocationRepository,
  Task, ITaskRepository,
  TimesheetRecord, ITimesheetRepository,
  ClientMeeting, IClientMeetingRepository
} from './project.repository';

export class MockClientRepository extends MemoryRepository<Client> implements IClientRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, [], 'MockClientRepository'); }
}

export class MockProjectRepository extends MemoryRepository<Project> implements IProjectRepository {
  constructor() { super({ defaultStatus: 'initiation', pageSize: 20 }, [], 'MockProjectRepository'); }
}

export class MockMilestoneRepository extends MemoryRepository<Milestone> implements IMilestoneRepository {
  constructor() { super({ defaultStatus: 'pending', pageSize: 20 }, [], 'MockMilestoneRepository'); }

  async findByProject(projectId: UUID): Promise<Milestone[]> {
    return [...this.store.values()].filter(
      (m) => m.projectId === projectId && !m.deletedAt
    );
  }
}

export class MockResourceAllocationRepository extends MemoryRepository<ResourceAllocation> implements IResourceAllocationRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, [], 'MockResourceAllocationRepository'); }

  async findByProject(projectId: UUID): Promise<ResourceAllocation[]> {
    return [...this.store.values()].filter(
      (r) => r.projectId === projectId && !r.deletedAt
    );
  }

  async findByEmployee(employeeId: UUID): Promise<ResourceAllocation[]> {
    return [...this.store.values()].filter(
      (r) => r.employeeId === employeeId && !r.deletedAt
    );
  }
}

export class MockTaskRepository extends MemoryRepository<Task> implements ITaskRepository {
  constructor() { super({ defaultStatus: 'todo', pageSize: 50 }, [], 'MockTaskRepository'); }

  async findByProject(projectId: UUID): Promise<Task[]> {
    return [...this.store.values()].filter(
      (t) => t.projectId === projectId && !t.deletedAt
    );
  }
}

export class MockTimesheetRepository extends MemoryRepository<TimesheetRecord> implements ITimesheetRepository {
  constructor() { super({ defaultStatus: 'draft', pageSize: 50 }, [], 'MockTimesheetRepository'); }

  async findByEmployee(employeeId: UUID): Promise<TimesheetRecord[]> {
    return [...this.store.values()].filter(
      (t) => t.employeeId === employeeId && !t.deletedAt
    );
  }
}

export class MockClientMeetingRepository extends MemoryRepository<ClientMeeting> implements IClientMeetingRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, [], 'MockClientMeetingRepository'); }
}
