import type { IRepository } from '../../core/repository';
import type { Entity, UUID } from '../../core/types';
import { createToken } from '../../core/registry';

export interface Employee extends Entity {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentId?: UUID;
  designation: string;
  reportingManagerId?: UUID;
  dateOfJoining: string;
  avatarUrl?: string;
  googleDriveFolderId?: string;
  leaveAllocationPerMonth?: number;
  role?: string;
  status: 'active' | 'on_notice' | 'relieved' | string;
  supervisorId?: UUID;
}

export interface IEmployeeRepository extends IRepository<Employee> {
  findByEmail(email: string): Promise<Employee | null>;
  findTeamMembers(managerId: UUID): Promise<Employee[]>;
}

export const EMPLOYEE_REPOSITORY_TOKEN = createToken<IEmployeeRepository>('EmployeeRepository');

/**
 * Check if employee is relieved / terminated / resigned / inactive
 */
export function isRelievedEmployee(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'relieved' || s === 'terminated' || s === 'resigned';
}

/**
 * Natural sort for employees by numeric Employee Code (EMP-001 -> EMP-002 -> ...)
 */
export function sortEmployeesByCode<T extends { employeeId?: string; firstName?: string; lastName?: string }>(employees: T[]): T[] {
  return [...employees].sort((a, b) => {
    const numA = parseInt((a.employeeId || '').replace(/\D/g, ''), 10) || 999999;
    const numB = parseInt((b.employeeId || '').replace(/\D/g, ''), 10) || 999999;
    if (numA !== numB) return numA - numB;
    return `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`);
  });
}

/**
 * Eligible trainers: active employees (not relieved) and not non-training support staff (e.g. cleaning staff)
 */
export function isEligibleTrainer<T extends { status?: string | null; designation?: string | null }>(emp: T): boolean {
  if (isRelievedEmployee(emp.status)) return false;
  const des = (emp.designation || '').toLowerCase();
  if (des.includes('cleaning') || des.includes('housekeeping')) return false;
  return true;
}

