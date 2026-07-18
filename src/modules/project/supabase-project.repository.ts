import { SupabaseRepository } from '../../shared/integration/supabase-repository';
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
      .eq('projectId', projectId)
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as Milestone[];
  }
}

export class SupabaseResourceAllocationRepository extends SupabaseRepository<ResourceAllocation> implements IResourceAllocationRepository {
  constructor() { super('resource_allocations'); }

  async findByProject(projectId: UUID): Promise<ResourceAllocation[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('projectId', projectId)
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as ResourceAllocation[];
  }

  async findByEmployee(employeeId: UUID): Promise<ResourceAllocation[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employeeId', employeeId)
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as ResourceAllocation[];
  }
}

export class SupabaseTaskRepository extends SupabaseRepository<Task> implements ITaskRepository {
  constructor() { super('tasks'); }

  async findByProject(projectId: UUID): Promise<Task[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('projectId', projectId)
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as Task[];
  }
}

export class SupabaseTimesheetRepository extends SupabaseRepository<TimesheetRecord> implements ITimesheetRepository {
  constructor() { super('timesheets'); }

  async findByEmployee(employeeId: UUID): Promise<TimesheetRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employeeId', employeeId)
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as TimesheetRecord[];
  }
}

export class SupabaseClientMeetingRepository extends SupabaseRepository<ClientMeeting> implements IClientMeetingRepository {
  constructor() { super('client_meetings'); }
}
