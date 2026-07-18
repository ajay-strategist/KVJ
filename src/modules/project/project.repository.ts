import type { IRepository } from '../../core/repository';
import type { Entity, UUID } from '../../core/types';
import { createToken } from '../../core/registry';

export type ProjectStatus = 'initiation' | 'planning' | 'execution' | 'closure' | 'suspended';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskPriority = 'low' | 'medium' | 'high';
export type AllocationStatus = 'active' | 'completed' | 'released';

export interface Client extends Entity {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  contactPerson: string;
  notes?: string;
}

export interface Project extends Entity {
  clientId?: UUID;
  title: string;
  code: string;
  category: string;
  type: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate?: string;
  endDate?: string;
  estimatedHours?: number;
  notes?: string;
  customFields?: Record<string, any>;
}

export interface Milestone extends Entity {
  projectId: UUID;
  title: string;
  dueDate: string;
  status: 'pending' | 'completed';
}

export interface ResourceAllocation extends Entity {
  projectId: UUID;
  employeeId: UUID;
  role: string;
  capacityPercentage?: number;
  status: AllocationStatus;
  startDate: string;
  endDate?: string;
}

export interface Task extends Entity {
  projectId: UUID;
  milestoneId?: UUID;
  assigneeId?: UUID;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  checklist?: { item: string; done: boolean }[];
}

export interface TimesheetRecord extends Entity {
  projectId: UUID;
  employeeId: UUID;
  taskId?: UUID;
  workDate: string;
  hoursLogged: number;
  billable?: boolean;
  notes?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  approvedBy?: UUID;
  approvedAt?: string;
}

export interface ClientMeeting extends Entity {
  clientId: UUID;
  projectId?: UUID;
  title: string;
  meetingDate: string;
  onlineLink?: string;
  summary?: string;
}

export interface IClientRepository extends IRepository<Client> {}
export interface IProjectRepository extends IRepository<Project> {}
export interface IMilestoneRepository extends IRepository<Milestone> {
  findByProject(projectId: UUID): Promise<Milestone[]>;
}
export interface IResourceAllocationRepository extends IRepository<ResourceAllocation> {
  findByProject(projectId: UUID): Promise<ResourceAllocation[]>;
  findByEmployee(employeeId: UUID): Promise<ResourceAllocation[]>;
}
export interface ITaskRepository extends IRepository<Task> {
  findByProject(projectId: UUID): Promise<Task[]>;
}
export interface ITimesheetRepository extends IRepository<TimesheetRecord> {
  findByEmployee(employeeId: UUID): Promise<TimesheetRecord[]>;
}
export interface IClientMeetingRepository extends IRepository<ClientMeeting> {}

export const CLIENT_REPOSITORY_TOKEN = createToken<IClientRepository>('ClientRepository');
export const PROJECT_REPOSITORY_TOKEN = createToken<IProjectRepository>('ProjectRepository');
export const MILESTONE_REPOSITORY_TOKEN = createToken<IMilestoneRepository>('MilestoneRepository');
export const RESOURCE_ALLOCATION_REPOSITORY_TOKEN = createToken<IResourceAllocationRepository>('ResourceAllocationRepository');
export const TASK_REPOSITORY_TOKEN = createToken<ITaskRepository>('TaskRepository');
export const TIMESHEET_REPOSITORY_TOKEN = createToken<ITimesheetRepository>('TimesheetRepository');
export const CLIENT_MEETING_REPOSITORY_TOKEN = createToken<IClientMeetingRepository>('ClientMeetingRepository');
