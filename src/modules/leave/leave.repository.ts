import type { IRepository } from '../../core/repository';
import type { Entity, UUID } from '../../core/types';
import { createToken } from '../../core/registry';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRecord extends Entity {
  employeeId: UUID;
  leaveType: string; // 'Casual', 'Sick', 'Earned', etc.
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  halfDay?: boolean;
  reason: string;
  status: LeaveStatus;
  medicalCertUrl?: string;
  
  // Workflow
  currentStep?: string; // 'ReportingManager', 'HR', etc.
  approverId?: UUID;
  approverNotes?: string;
  approvedAt?: string;
}

export interface ILeaveRepository extends IRepository<LeaveRecord> {
  findByEmployeeId(employeeId: UUID): Promise<LeaveRecord[]>;
  findPending(): Promise<LeaveRecord[]>;
}

export const LEAVE_REPOSITORY_TOKEN = createToken<ILeaveRepository>('LeaveRepository');
