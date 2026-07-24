import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';
import type {
  Client, IClientRepository,
  Project, IProjectRepository,
  Milestone, IMilestoneRepository,
  ResourceAllocation, IResourceAllocationRepository,
  Task, ITaskRepository,
  TimesheetRecord, ITimesheetRepository,
  ClientMeeting, IClientMeetingRepository
} from './project.repository';

export class SupabaseClientRepository extends SupabaseRepository<Client> implements IClientRepository {
  constructor() { super('clients'); }
}

export class SupabaseProjectRepository extends SupabaseRepository<Project> implements IProjectRepository {
  constructor() { super('projects'); }
}

export class SupabaseMilestoneRepository extends SupabaseRepository<Milestone> implements IMilestoneRepository {
  constructor() { super('milestones'); }

  async findByProject(projectId: UUID): Promise<Milestone[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('project_id', projectId)
      .is('deleted_at', null);

    if (error) {
      console.warn(`Supabase findByProject warning on ${this.tableName}:`, error.message);
      return [];
    }
    return (data ?? []).map((row) => toCamelCaseObject(row) as Milestone);
  }
}

export class SupabaseResourceAllocationRepository extends SupabaseRepository<ResourceAllocation> implements IResourceAllocationRepository {
  constructor() { super('resource_allocations'); }

  async findByProject(projectId: UUID): Promise<ResourceAllocation[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('project_id', projectId)
      .is('deleted_at', null);

    if (error) {
      console.warn(`Supabase findByProject warning on ${this.tableName}:`, error.message);
      return [];
    }
    return (data ?? []).map((row) => toCamelCaseObject(row) as ResourceAllocation);
  }

  async findByEmployee(employeeId: UUID): Promise<ResourceAllocation[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employee_id', employeeId)
      .is('deleted_at', null);

    if (error) {
      console.warn(`Supabase findByEmployee warning on ${this.tableName}:`, error.message);
      return [];
    }
    return (data ?? []).map((row) => toCamelCaseObject(row) as ResourceAllocation);
  }
}

export class SupabaseTaskRepository extends SupabaseRepository<Task> implements ITaskRepository {
  constructor() { super('tasks'); }

  async findByProject(projectId: UUID): Promise<Task[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('project_id', projectId)
      .is('deleted_at', null);

    if (error) {
      console.warn(`Supabase findByProject warning on ${this.tableName}:`, error.message);
      return [];
    }
    return (data ?? []).map((row) => toCamelCaseObject(row) as Task);
  }
}

export class SupabaseTimesheetRepository extends SupabaseRepository<TimesheetRecord> implements ITimesheetRepository {
  constructor() { super('timesheets'); }

  async findByEmployee(employeeId: UUID): Promise<TimesheetRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employee_id', employeeId)
      .is('deleted_at', null);

    if (error) {
      console.warn(`Supabase findByEmployee warning on ${this.tableName}:`, error.message);
      return [];
    }
    return (data ?? []).map((row) => toCamelCaseObject(row) as TimesheetRecord);
  }
}

export class SupabaseClientMeetingRepository extends SupabaseRepository<ClientMeeting> implements IClientMeetingRepository {
  constructor() { super('client_meetings'); }
}

