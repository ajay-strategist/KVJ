import { container, createToken } from '../../core/registry';
import { todayISO } from '../../shared/utils/date';
import { AppError, Err, Ok, type Result } from '../../core/result';
import type { Actor, UUID } from '../../core/types';
import {
  CLIENT_REPOSITORY_TOKEN,
  PROJECT_REPOSITORY_TOKEN,
  MILESTONE_REPOSITORY_TOKEN,
  RESOURCE_ALLOCATION_REPOSITORY_TOKEN,
  TASK_REPOSITORY_TOKEN,
  TIMESHEET_REPOSITORY_TOKEN,
  type Client, type Project, type Milestone, type ResourceAllocation,
  type Task, type TimesheetRecord
} from './project.repository';
import { ACTIVITY_ENGINE_TOKEN } from '../../core/engines/activity';
import { AUDIT_ENGINE_TOKEN } from '../../core/engines/audit';
import { APPROVAL_ENGINE_TOKEN } from '../../core/engines/approval';
import { NOTIFICATION_ENGINE_TOKEN } from '../../core/engines/notification';

export interface IProjectService {
  createClient(data: Partial<Client>, actor: Actor): Promise<Result<Client>>;
  createProject(data: Partial<Project>, actor: Actor): Promise<Result<Project>>;
  updateProject(projectId: UUID, patch: Partial<Project>, actor: Actor): Promise<Result<Project>>;
  addMilestone(projectId: UUID, title: string, dueDate: string, actor: Actor): Promise<Result<Milestone>>;
  allocateResource(projectId: UUID, employeeId: UUID, role: string, capacity: number, actor: Actor): Promise<Result<ResourceAllocation>>;
  createTask(data: Partial<Task>, actor: Actor): Promise<Result<Task>>;
  updateTask(taskId: UUID, patch: Partial<Task>, actor: Actor): Promise<Result<Task>>;
  deleteTask(taskId: UUID, actor: Actor): Promise<Result<void>>;
  submitTask(taskId: UUID, notes: string, actor: Actor): Promise<Result<Task>>;
  requestRework(taskId: UUID, notes: string, actor: Actor): Promise<Result<Task>>;
  approveTaskSubmission(taskId: UUID, actor: Actor): Promise<Result<Task>>;
  requestTaskAssignment(taskId: UUID, assigneeId: UUID, assignedByEmployeeId: UUID, actor: Actor): Promise<Result<Task>>;
  approveTaskAssignment(taskId: UUID, actor: Actor): Promise<Result<Task>>;
  logTimesheet(data: Partial<TimesheetRecord>, actor: Actor): Promise<Result<TimesheetRecord>>;
  approveTimesheet(timesheetId: UUID, actor: Actor): Promise<Result<TimesheetRecord>>;
}

export const PROJECT_SERVICE_TOKEN = createToken<IProjectService>('ProjectService');

export class ProjectService implements IProjectService {
  private get clientRepo() { return container.resolve(CLIENT_REPOSITORY_TOKEN); }
  private get projectRepo() { return container.resolve(PROJECT_REPOSITORY_TOKEN); }
  private get milestoneRepo() { return container.resolve(MILESTONE_REPOSITORY_TOKEN); }
  private get allocationRepo() { return container.resolve(RESOURCE_ALLOCATION_REPOSITORY_TOKEN); }
  private get taskRepo() { return container.resolve(TASK_REPOSITORY_TOKEN); }
  private get timesheetRepo() { return container.resolve(TIMESHEET_REPOSITORY_TOKEN); }

  private get activity() { return container.resolve(ACTIVITY_ENGINE_TOKEN); }
  private get audit() { return container.resolve(AUDIT_ENGINE_TOKEN); }
  private get approval() { return container.resolve(APPROVAL_ENGINE_TOKEN); }
  private get notification() { return container.resolve(NOTIFICATION_ENGINE_TOKEN); }

  async createClient(data: Partial<Client>, actor: Actor): Promise<Result<Client>> {
    try {
      const client = await this.clientRepo.create(data, actor);
      await this.activity.log('project', client.id, actor, 'create', `Created client record ${client.name}`);
      return Ok(client);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async createProject(data: Partial<Project>, actor: Actor): Promise<Result<Project>> {
    try {
      const project = await this.projectRepo.create(data, actor);
      await this.activity.log('project', project.id, actor, 'create', `Created project code ${project.code} - ${project.title}`);
      await this.audit.log(actor, 'create', 'projects', project.id, { newValues: project });
      return Ok(project);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updateProject(projectId: UUID, patch: Partial<Project>, actor: Actor): Promise<Result<Project>> {
    try {
      const project = await this.projectRepo.update(projectId, patch, actor);
      await this.activity.log('project', project.id, actor, 'update', `Updated project code ${project.code} - ${project.title}`);
      await this.audit.log(actor, 'update', 'projects', project.id, { newValues: project });
      return Ok(project);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async addMilestone(projectId: UUID, title: string, dueDate: string, actor: Actor): Promise<Result<Milestone>> {
    try {
      const milestone = await this.milestoneRepo.create({ projectId, title, dueDate, status: 'pending' }, actor);
      await this.activity.log('project', projectId, actor, 'create', `Scheduled milestone: ${title}`);
      return Ok(milestone);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async allocateResource(projectId: UUID, employeeId: UUID, role: string, capacity: number, actor: Actor): Promise<Result<ResourceAllocation>> {
    try {
      const allocation = await this.allocationRepo.create({
        projectId,
        employeeId,
        role,
        capacityPercentage: capacity,
        status: 'active',
        startDate: todayISO()
      }, actor);

      await this.activity.log('project', projectId, actor, 'assign', `Allocated resource to project: role ${role}`);
      
      await this.notification.send({
        recipientId: employeeId,
        title: 'Project Assignment',
        body: `You have been allocated to project ${projectId} as a ${role} (${capacity}% capacity).`,
        channels: ['in_app']
      });

      return Ok(allocation);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async createTask(data: Partial<Task>, actor: Actor): Promise<Result<Task>> {
    try {
      const isSelfAssigned = !data.assigneeId || data.assigneeId === actor.id;
      const r = actor.role?.toUpperCase();
      const isCeo = r === 'CEO';
      const needsAssignmentApproval = !isSelfAssigned && !isCeo;

      const payload: Partial<Task> = {
        ...data,
        approvalStatus: needsAssignmentApproval ? 'pending_assignment_approval' : (data.approvalStatus ?? null),
        assignedByEmployeeId: !isSelfAssigned ? actor.id : undefined,
      };

      const task = await this.taskRepo.create(payload, actor);
      if (task.assigneeId && !needsAssignmentApproval) {
        await this.activity.log('project', task.projectId, actor, 'assign', `Assigned task: ${task.title}`);
        await this.notification.send({
          recipientId: task.assigneeId,
          title: 'Task Assigned',
          body: `New task assigned: ${task.title}. Due date: ${task.dueDate ?? 'N/A'}`,
          channels: ['in_app']
        });
      }
      return Ok(task);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updateTask(taskId: UUID, patch: Partial<Task>, actor: Actor): Promise<Result<Task>> {
    try {
      const existing = await this.taskRepo.findById(taskId);
      if (existing && patch.assigneeId && patch.assigneeId !== existing.assigneeId) {
        const isSelfAssigned = patch.assigneeId === actor.id;
        const r = actor.role?.toUpperCase();
        const isCeo = r === 'CEO';
        if (!isSelfAssigned && !isCeo) {
          patch.approvalStatus = 'pending_assignment_approval';
          (patch as any).assignedByEmployeeId = actor.id;
        }
      }
      const updated = await this.taskRepo.update(taskId, patch, actor);
      if (updated) {
        await this.activity.log('project', updated.projectId, actor, 'update', `Updated task: ${updated.title}`);
      }
      return Ok(updated);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async deleteTask(taskId: UUID, actor: Actor): Promise<Result<void>> {
    try {
      await this.taskRepo.softDelete(taskId, actor);
      return Ok(undefined as any);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async submitTask(taskId: UUID, notes: string, actor: Actor): Promise<Result<Task>> {
    try {
      const updated = await this.taskRepo.update(taskId, {
        status: 'review',
        approvalStatus: 'pending_task_approval',
        submittedAt: new Date().toISOString(),
        submittedBy: actor.id,
      } as any, actor);
      await this.activity.log('project', updated.projectId, actor, 'update', `Task submitted for approval: ${updated.title}`);
      return Ok(updated);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async requestRework(taskId: UUID, notes: string, actor: Actor): Promise<Result<Task>> {
    try {
      const existing = await this.taskRepo.findById(taskId);
      if (!existing) return Err(AppError.notFound('Task not found.'));
      const updated = await this.taskRepo.update(taskId, {
        status: 'in_progress',
        approvalStatus: 'rework',
        reworkNotes: notes,
        reworkRequestedAt: new Date().toISOString(),
      } as any, actor);
      if (existing.assigneeId) {
        await this.notification.send({
          recipientId: existing.assigneeId,
          title: 'Task Sent Back for Rework',
          body: `"${existing.title}" was returned for rework. Notes: ${notes}`,
          channels: ['in_app'],
        });
      }
      await this.activity.log('project', updated.projectId, actor, 'update', `Rework requested for task: ${updated.title}`);
      return Ok(updated);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async approveTaskSubmission(taskId: UUID, actor: Actor): Promise<Result<Task>> {
    try {
      const existing = await this.taskRepo.findById(taskId);
      if (!existing) return Err(AppError.notFound('Task not found.'));
      const updated = await this.taskRepo.update(taskId, {
        status: 'done',
        approvalStatus: 'approved',
      } as any, actor);
      if (existing.assigneeId) {
        await this.notification.send({
          recipientId: existing.assigneeId,
          title: 'Task Approved ✅',
          body: `Your submission for "${existing.title}" has been approved.`,
          channels: ['in_app'],
        });
      }
      await this.activity.log('project', updated.projectId, actor, 'approve', `Task approved: ${updated.title}`);
      return Ok(updated);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async requestTaskAssignment(taskId: UUID, assigneeId: UUID, assignedByEmployeeId: UUID, actor: Actor): Promise<Result<Task>> {
    try {
      const updated = await this.taskRepo.update(taskId, {
        assigneeId,
        approvalStatus: 'pending_assignment_approval',
        assignedByEmployeeId,
      } as any, actor);
      await this.activity.log('project', updated.projectId, actor, 'assign', `Assignment pending approval: ${updated.title}`);
      return Ok(updated);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async approveTaskAssignment(taskId: UUID, actor: Actor): Promise<Result<Task>> {
    try {
      const existing = await this.taskRepo.findById(taskId);
      if (!existing) return Err(AppError.notFound('Task not found.'));
      const updated = await this.taskRepo.update(taskId, {
        status: 'todo',
        approvalStatus: null,
      } as any, actor);
      if (existing.assigneeId) {
        await this.notification.send({
          recipientId: existing.assigneeId,
          title: 'New Task Assigned to You',
          body: `You have been assigned task: "${existing.title}". You can start working on it now.`,
          channels: ['in_app'],
        });
      }
      await this.activity.log('project', updated.projectId, actor, 'approve', `Assignment approved: ${updated.title}`);
      return Ok(updated);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async logTimesheet(data: Partial<TimesheetRecord>, actor: Actor): Promise<Result<TimesheetRecord>> {
    try {
      const sheet = await this.timesheetRepo.create({
        ...data,
        status: 'submitted'
      }, actor);

      await this.activity.log('project', sheet.projectId, actor, 'create', `Timesheet submitted: ${sheet.hoursLogged} hours logged`);
      await this.audit.log(actor, 'create', 'timesheets', sheet.id, { newValues: sheet });
      return Ok(sheet);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async approveTimesheet(timesheetId: UUID, actor: Actor): Promise<Result<TimesheetRecord>> {
    try {
      const sheet = await this.timesheetRepo.findById(timesheetId);
      if (!sheet) return Err(AppError.notFound('Timesheet not found.'));

      sheet.status = 'approved';
      sheet.approvedBy = actor.id;
      sheet.approvedAt = new Date().toISOString();

      const updated = await this.timesheetRepo.update(timesheetId, sheet, actor);
      await this.activity.log('project', sheet.projectId, actor, 'approve', `Timesheet approved for employee ${sheet.employeeId}`);
      return Ok(updated);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }
}
