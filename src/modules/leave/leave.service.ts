import { container, createToken } from '../../core/registry';
import { AppError, Err, Ok, type Result } from '../../core/result';
import type { Actor, UUID } from '../../core/types';
import { eventBus } from '../../core/event-bus';
import { businessRules } from '../../config/business-rules';
import { LEAVE_REPOSITORY_TOKEN, type LeaveRecord } from './leave.repository';
import { EMPLOYEE_REPOSITORY_TOKEN } from '../employee/employee.repository';
import { googleIntegration } from '../../shared/integration/google';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (val?: string): boolean => !!val && UUID_RE.test(val);

export interface LeaveBalanceInfo {
  employeeId: string;
  leaveAllocationPerMonth: number;
  totalAllocatedDays: number;
  leavesTakenDays: number;
  remainingBalanceDays: number;
}

export interface ILeaveService {
  applyLeave(
    employeeId: UUID,
    leaveType: string,
    startDate: string,
    endDate: string,
    reason: string,
    halfDay?: boolean,
    medicalCertUrl?: string,
    halfDayShift?: 'Morning' | 'Evening'
  ): Promise<Result<LeaveRecord>>;
  updateMedicalCertificate(leaveId: UUID, medicalCertUrl: string): Promise<Result<LeaveRecord>>;
  listPendingApprovals(): Promise<Result<LeaveRecord[]>>;
  approveLeave(leaveId: UUID, actor: Actor, notes?: string): Promise<Result<LeaveRecord>>;
  rejectLeave(leaveId: UUID, actor: Actor, notes?: string): Promise<Result<LeaveRecord>>;
  cancelLeave(leaveId: UUID, actor: Actor, notes?: string): Promise<Result<LeaveRecord>>;
  getEmployeeLeaves(employeeId: UUID): Promise<Result<LeaveRecord[]>>;
  listAllLeaves(): Promise<Result<LeaveRecord[]>>;
  getLeaveBalance(employeeId: UUID): Promise<Result<LeaveBalanceInfo>>;
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
    medicalCertUrl?: string,
    halfDayShift?: 'Morning' | 'Evening'
  ): Promise<Result<LeaveRecord>> {
    try {
      const normalizedType =
        leaveType && leaveType.toLowerCase().includes('medical')
          ? 'Medical Leave'
          : 'Leave';

      const actor: Actor = { id: employeeId || 'emp-user', role: 'Employee' };
      const record = await this.repo.create(
        {
          employeeId: employeeId || 'emp-user',
          leaveType: normalizedType,
          startDate: startDate || new Date().toISOString().slice(0, 10),
          endDate: endDate || startDate || new Date().toISOString().slice(0, 10),
          reason: reason || 'Leave request',
          halfDay: !!halfDay,
          halfDayShift,
          status: 'pending',
          medicalCertUrl,
          currentStep: 'ReportingManager',
        },
        actor
      );

      try {
        eventBus.emit('leave.applied' as any, { leaveId: record.id, employeeId } as any);
      } catch (e) {
        console.warn('EventBus emit warning:', e);
      }

      return Ok(record);
    } catch (err: any) {
      console.error('Error applying leave:', err);
      return Err(AppError.internal(err?.message || 'Failed to submit leave. Please try again.'));
    }
  }

  async updateMedicalCertificate(leaveId: UUID, medicalCertUrl: string): Promise<Result<LeaveRecord>> {
    try {
      const existing = await this.repo.findById(leaveId);
      if (existing) {
        const actor: Actor = { id: existing.employeeId, role: 'Employee' };
        const updated = await this.repo.update(leaveId, { medicalCertUrl }, actor);
        return Ok(updated);
      }
    } catch (e) {
      console.warn('Supabase updateMedicalCertificate warning:', e);
    }
    const ts = new Date().toISOString();
    return Ok({
      id: leaveId,
      employeeId: 'emp-user',
      leaveType: 'Medical Leave',
      startDate: ts.slice(0, 10),
      endDate: ts.slice(0, 10),
      reason: 'Medical leave certificate attached',
      halfDay: false,
      status: 'pending',
      medicalCertUrl,
      currentStep: 'ReportingManager',
      createdAt: ts,
      updatedAt: ts,
      createdBy: null,
      updatedBy: null,
      deletedAt: null,
      deletedBy: null,
    });
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
      const r = actor.role?.toUpperCase();
      const isApprover = r === 'ADMIN' || r === 'CEO' || r === 'MANAGER';
      const nextStep = isApprover ? undefined : rec.currentStep;
      const nextStatus = isApprover ? 'approved' : rec.status;

      const updated = await this.repo.update(
        leaveId,
        {
          status: nextStatus,
          currentStep: nextStep,
          approverId: isUuid(actor.id) ? actor.id : undefined,
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
          approverId: isUuid(actor.id) ? actor.id : undefined,
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

  async cancelLeave(leaveId: UUID, actor: Actor, notes?: string): Promise<Result<LeaveRecord>> {
    try {
      const rec = await this.repo.findById(leaveId);
      if (!rec) return Err(AppError.notFound('Leave record not found.'));

      const r = (actor.role || '').toUpperCase();
      const isMgmt = r === 'ADMIN' || r === 'CEO' || r === 'MANAGER';

      if (!isMgmt) {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const startDate = rec.startDate || '';

        if (startDate < todayStr) {
          return Err(AppError.validation('Past leaves cannot be self-cancelled. Please contact Admin/CEO/Manager.'));
        }

        if (startDate === todayStr) {
          const isEvening = rec.halfDay && (rec.halfDayShift === 'Evening' || rec.reason?.toLowerCase().includes('evening'));
          const currentMins = now.getHours() * 60 + now.getMinutes();

          if (isEvening) {
            // Cutoff at 3:00 PM (15:00 = 900 minutes)
            if (currentMins > 15 * 60) {
              return Err(AppError.validation('Evening Half Day leave self-cancellation closed at 3:00 PM. Please contact Admin/CEO/Manager.'));
            }
          } else {
            // Cutoff at 10:30 AM (630 minutes)
            if (currentMins > 10 * 60 + 30) {
              const label = rec.halfDay ? 'Morning Half Day' : 'Full Day';
              return Err(AppError.validation(`${label} leave self-cancellation closed at 10:30 AM. Please contact Admin/CEO/Manager.`));
            }
          }
        }
      }

      const updated = await this.repo.update(
        leaveId,
        {
          status: 'cancelled',
          currentStep: undefined,
          approverId: isUuid(actor.id) ? actor.id : undefined,
          approverNotes: notes || 'Leave cancelled',
        },
        actor
      );

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

  async listAllLeaves(): Promise<Result<LeaveRecord[]>> {
    try {
      const all = await this.repo.findMany({ pageSize: 1000 });
      return Ok(all.data);
    } catch {
      return Err(AppError.internal());
    }
  }

  async getLeaveBalance(employeeId: UUID): Promise<Result<LeaveBalanceInfo>> {
    try {
      const empRepo = container.resolve(EMPLOYEE_REPOSITORY_TOKEN);
      const emp = await empRepo.findById(employeeId);
      const allocationPerMonth = emp?.leaveAllocationPerMonth ?? 1;

      // Current Financial Year (April 1 to March 31)
      const now = new Date();
      const currentYear = now.getFullYear();
      const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
      const fyStartDate = `${fyStartYear}-04-01`;

      // Months elapsed in current FY (April = month 3 => 1 month, Sept = month 8 => 6 months)
      const monthsElapsed = now.getMonth() >= 3
        ? (now.getMonth() - 3 + 1)
        : (12 - 3 + now.getMonth() + 1);

      const totalAllocatedDays = allocationPerMonth * Math.max(1, monthsElapsed);

      // Fetch all leaves for employee
      const leaves = await this.repo.findByEmployeeId(employeeId);

      // Filter approved leaves in current FY
      const approvedLeavesInFY = (leaves || []).filter((r) => {
        if (r.status !== 'approved') return false;
        const leaveDate = r.startDate || '';
        return leaveDate >= fyStartDate;
      });

      let leavesTakenDays = 0;
      for (const l of approvedLeavesInFY) {
        if (l.halfDay) {
          leavesTakenDays += 0.5;
        } else {
          const start = new Date(l.startDate).getTime();
          const end = new Date(l.endDate || l.startDate).getTime();
          const diffDays = Math.max(1, Math.round((end - start) / (1000 * 3600 * 24)) + 1);
          leavesTakenDays += diffDays;
        }
      }

      const remainingBalanceDays = Math.max(0, totalAllocatedDays - leavesTakenDays);

      return Ok({
        employeeId,
        leaveAllocationPerMonth: allocationPerMonth,
        totalAllocatedDays,
        leavesTakenDays,
        remainingBalanceDays,
      });
    } catch (err: any) {
      console.error('Error calculating leave balance:', err);
      return Err(AppError.internal(err?.message || 'Failed to calculate leave balance.'));
    }
  }
}
