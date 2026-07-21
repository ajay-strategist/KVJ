import { container, createToken } from '../../core/registry';
import { AppError, Err, Ok, type Result } from '../../core/result';
import type { Actor, UUID } from '../../core/types';
import { eventBus } from '../../core/event-bus';
import { businessRules } from '../../config/business-rules';
import { LEAVE_REPOSITORY_TOKEN, type LeaveRecord } from './leave.repository';
import { EMPLOYEE_REPOSITORY_TOKEN } from '../employee/employee.repository';
import { googleIntegration } from '../../shared/integration/google';

export interface ILeaveService {
  applyLeave(
    employeeId: UUID,
    leaveType: string,
    startDate: string,
    endDate: string,
    reason: string,
    halfDay?: boolean,
    medicalCertUrl?: string
  ): Promise<Result<LeaveRecord>>;
  listPendingApprovals(): Promise<Result<LeaveRecord[]>>;
  approveLeave(leaveId: UUID, actor: Actor, notes?: string): Promise<Result<LeaveRecord>>;
  rejectLeave(leaveId: UUID, actor: Actor, notes?: string): Promise<Result<LeaveRecord>>;
  getEmployeeLeaves(employeeId: UUID): Promise<Result<LeaveRecord[]>>;
}

export const LEAVE_SERVICE_TOKEN = createToken<ILeaveService>('LeaveService');

export class LeaveService implements ILeaveService {
  private get repo() {
    return container.resolve(LEAVE_REPOSITORY_TOKEN);
  }

  async applyLeave(
    employeeId: UUID,
    leaveType: string,
    startDate: string,
    endDate: string,
    reason: string,
    halfDay?: boolean,
    medicalCertUrl?: string
  ): Promise<Result<LeaveRecord>> {
    try {
      // Only the two confirmed leave types are accepted.
      if (!(businessRules.leave.types as readonly string[]).includes(leaveType)) {
        return Err(AppError.validation(`Invalid leave type. Allowed: ${businessRules.leave.types.join(', ')}.`));
      }

      // Medical Leave ALWAYS requires a medical certificate.
      if (leaveType === businessRules.leave.medicalCertRequiredFor && !medicalCertUrl) {
        return Err(
          AppError.validation('A medical certificate must be attached for Medical Leave.')
        );
      }

      const actor: Actor = { id: employeeId, role: 'Employee' };
      const record = await this.repo.create(
        {
          employeeId,
          leaveType,
          startDate,
          endDate,
          reason,
          halfDay: !!halfDay,
          status: 'pending',
          medicalCertUrl,
          currentStep: 'ReportingManager',
        },
        actor
      );

      eventBus.emit('leave.applied' as any, { leaveId: record.id, employeeId } as any);

      return Ok(record);
    } catch {
      return Err(AppError.internal());
    }
  }

  async listPendingApprovals(): Promise<Result<LeaveRecord[]>> {
    try {
      const all = await this.repo.findPending();
      return Ok(all);
    } catch {
      return Err(AppError.internal());
    }
  }

  async approveLeave(leaveId: UUID, actor: Actor, notes?: string): Promise<Result<LeaveRecord>> {
    try {
      const rec = await this.repo.findById(leaveId);
      if (!rec) return Err(AppError.notFound('Leave record not found.'));

      // 4-role model: Admin/CEO/Manager have full control, so any of them
      // approves a pending leave in a single step. (The multi-step chain is
      // revisited in the Leaves / Approvals Queue modules.)
      const isApprover = actor.role === 'ADMIN' || actor.role === 'CEO' || actor.role === 'MANAGER';
      const nextStep = isApprover ? undefined : rec.currentStep;
      const nextStatus = isApprover ? 'approved' : rec.status;

      const updated = await this.repo.update(
        leaveId,
        {
          status: nextStatus,
          currentStep: nextStep,
          approverId: actor.id,
          approverNotes: notes,
          approvedAt: new Date().toISOString(),
        },
        actor
      );

      if (nextStatus === 'approved') {
        const empRepo = container.resolve(EMPLOYEE_REPOSITORY_TOKEN);
        const emp = await empRepo.findById(rec.employeeId);
        const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Employee';
        
        await googleIntegration.bookLeaveEvent(
          empName,
          rec.leaveType,
          rec.startDate,
          rec.endDate
        );

        eventBus.emit('leave.approved' as any, { leaveId, employeeId: rec.employeeId } as any);
      }

      return Ok(updated);
    } catch {
      return Err(AppError.internal());
    }
  }

  async rejectLeave(leaveId: UUID, actor: Actor, notes?: string): Promise<Result<LeaveRecord>> {
    try {
      const rec = await this.repo.findById(leaveId);
      if (!rec) return Err(AppError.notFound('Leave record not found.'));

      const updated = await this.repo.update(
        leaveId,
        {
          status: 'rejected',
          currentStep: undefined,
          approverId: actor.id,
          approverNotes: notes,
          approvedAt: new Date().toISOString(),
        },
        actor
      );

      eventBus.emit('leave.rejected' as any, { leaveId, employeeId: rec.employeeId } as any);

      return Ok(updated);
    } catch {
      return Err(AppError.internal());
    }
  }

  async getEmployeeLeaves(employeeId: UUID): Promise<Result<LeaveRecord[]>> {
    try {
      const all = await this.repo.findByEmployeeId(employeeId);
      return Ok(all);
    } catch {
      return Err(AppError.internal());
    }
  }
}
