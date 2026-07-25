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

const INITIAL_SEED_TASKS: Task[] = [
  {
    id: 'task-1',
    projectId: 'proj-flow-desk',
    title: 'Cross check each features',
    status: 'todo',
    priority: 'medium',
    dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    actualHours: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'task-2',
    projectId: 'proj-flow-desk',
    title: 'Complete the Attendance Feature',
    status: 'todo',
    priority: 'medium',
    dueDate: new Date().toISOString().slice(0, 10),
    actualHours: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'task-3',
    projectId: 'proj-flow-desk',
    title: 'Complete the Expense details',
    status: 'in_progress',
    priority: 'medium',
    dueDate: new Date().toISOString().slice(0, 10),
    actualHours: 3.5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
    approvalStatus: null,
  },
  {
    id: 'task-4',
    projectId: 'proj-flow-desk',
    title: 'Project Management & Task Management',
    status: 'todo',
    priority: 'medium',
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    actualHours: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
    approvalStatus: null,
  },
];

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

const INITIAL_SEED_TIMESHEETS: TimesheetRecord[] = [
  {
    id: 'ts-1',
    projectId: 'proj-flow-desk',
    taskId: 'task-1',
    employeeId: 'emp-ajay',
    workDate: twoDaysAgo,
    hoursLogged: 3.5,
    billable: true,
    notes: 'Cross-checked attendance module features, fixed timer logic',
    status: 'approved',
    approvedBy: 'emp-ajay',
    approvedAt: yesterday,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'emp-ajay',
    updatedBy: 'emp-ajay',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'ts-2',
    projectId: 'proj-flow-desk',
    taskId: 'task-2',
    employeeId: 'emp-ajay',
    workDate: yesterday,
    hoursLogged: 4.0,
    billable: true,
    notes: 'Implemented clock-in/out functionality and break tracking',
    status: 'submitted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'emp-ajay',
    updatedBy: 'emp-ajay',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'ts-3',
    projectId: 'proj-flow-desk',
    taskId: 'task-3',
    employeeId: 'emp-ajay',
    workDate: today,
    hoursLogged: 2.0,
    billable: true,
    notes: 'Working on expense claim forms and report export',
    status: 'submitted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'emp-ajay',
    updatedBy: 'emp-ajay',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'ts-4',
    projectId: 'proj-flow-desk',
    taskId: 'task-1',
    employeeId: 'emp-ajay',
    workDate: yesterday,
    hoursLogged: 1.5,
    billable: false,
    notes: 'Code review and documentation',
    status: 'approved',
    approvedBy: 'emp-ajay',
    approvedAt: today,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'emp-ajay',
    updatedBy: 'emp-ajay',
    deletedAt: null,
    deletedBy: null,
  },
];


export class MockTaskRepository extends MemoryRepository<Task> implements ITaskRepository {
  constructor() { super({ defaultStatus: 'todo', pageSize: 50 }, INITIAL_SEED_TASKS, 'MockTaskRepository'); }

  async findByProject(projectId: UUID): Promise<Task[]> {
    return [...this.store.values()].filter(
      (t) => t.projectId === projectId && !t.deletedAt
    );
  }
}

export class MockTimesheetRepository extends MemoryRepository<TimesheetRecord> implements ITimesheetRepository {
  constructor() { super({ defaultStatus: 'draft', pageSize: 50 }, INITIAL_SEED_TIMESHEETS, 'MockTimesheetRepository'); }

  async findByEmployee(employeeId: UUID): Promise<TimesheetRecord[]> {
    return [...this.store.values()].filter(
      (t) => t.employeeId === employeeId && !t.deletedAt
    );
  }
}

export class MockClientMeetingRepository extends MemoryRepository<ClientMeeting> implements IClientMeetingRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, [], 'MockClientMeetingRepository'); }
}
