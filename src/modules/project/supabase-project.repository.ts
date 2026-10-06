import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { UUID, Actor } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';
import type {
  Client, IClientRepository,
  Project, IProjectRepository,
  Milestone, IMilestoneRepository,
  ResourceAllocation, IResourceAllocationRepository,
  Task, ITaskRepository,
  TimesheetRecord, ITimesheetRepository,
  ClientMeeting, IClientMeetingRepository,
  TaskWorkSession, ITaskWorkSessionRepository
} from './project.repository';

export class SupabaseClientRepository extends SupabaseRepository<Client> implements IClientRepository {
  constructor() { super('flwdsk_clients'); }
}

export class SupabaseProjectRepository extends SupabaseRepository<Project> implements IProjectRepository {
  constructor() { super('flwdsk_projects'); }
}

export class SupabaseMilestoneRepository extends SupabaseRepository<Milestone> implements IMilestoneRepository {
  constructor() { super('flwdsk_milestones'); }

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
  constructor() { super('flwdsk_resource_allocations'); }

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
  constructor() { super('flwdsk_tasks'); }

  private mapTask(row: any): Task {
    const t = toCamelCaseObject(row) as Task;
    const rawHours = t.estimatedHours ?? (t as any).proposedHours ?? (row as any)?.estimated_hours ?? (row as any)?.proposed_hours;
    const hoursNum = rawHours !== undefined && rawHours !== null && rawHours !== '' ? Number(rawHours) : undefined;
    return {
      ...t,
      estimatedHours: hoursNum,
      proposedHours: hoursNum,
    };
  }

  override async create(data: Partial<Task>, actor: Actor): Promise<Task> {
    const hours = data.proposedHours ?? data.estimatedHours;
    const hoursNum = hours !== undefined && hours !== null && hours !== '' ? Number(hours) : undefined;
    const normalized: Partial<Task> = {
      ...data,
      estimatedHours: hoursNum,
      proposedHours: hoursNum,
    };
    const res = await super.create(normalized, actor);
    return this.mapTask(res);
  }

  override async update(id: UUID, patch: Partial<Task>, actor: Actor): Promise<Task> {
    const hours = patch.proposedHours ?? patch.estimatedHours;
    const hoursNum = hours !== undefined && hours !== null && hours !== '' ? Number(hours) : undefined;
    const normalized: Partial<Task> = {
      ...patch,
      ...(hours !== undefined ? {
        estimatedHours: hoursNum,
        proposedHours: hoursNum,
      } : {}),
    };
    const res = await super.update(id, normalized, actor);
    return this.mapTask(res);
  }

  override async findById(id: UUID): Promise<Task | null> {
    const res = await super.findById(id);
    return res ? this.mapTask(res) : null;
  }

  override async findMany(params?: any): Promise<any> {
    const res = await super.findMany(params);
    if (res && Array.isArray(res.data)) {
      return {
        ...res,
        data: res.data.map((r: any) => this.mapTask(r)),
      };
    }
    return res;
  }

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
    return (data ?? []).map((row) => this.mapTask(row));
  }
}

export class SupabaseTimesheetRepository extends SupabaseRepository<TimesheetRecord> implements ITimesheetRepository {
  constructor() { super('flwdsk_timesheets'); }

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
  constructor() { super('flwdsk_client_meetings'); }
}

export class SupabaseTaskWorkSessionRepository extends SupabaseRepository<TaskWorkSession> implements ITaskWorkSessionRepository {
  constructor() { super('flwdsk_task_work_sessions'); }

  async findOpenSession(employeeId: UUID, taskId: UUID): Promise<TaskWorkSession | null> {
    const { data, error } = await supabase
      .from('flwdsk_task_work_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('task_id', taskId)
      .is('end_time', null)
      .is('deleted_at', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('findOpenSession warning:', error.message);
      return null;
    }
    return data ? (toCamelCaseObject(data) as TaskWorkSession) : null;
  }
}

