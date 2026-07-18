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
}

export interface IEmployeeRepository extends IRepository<Employee> {
  findByEmail(email: string): Promise<Employee | null>;
  findTeamMembers(managerId: UUID): Promise<Employee[]>;
}

export const EMPLOYEE_REPOSITORY_TOKEN = createToken<IEmployeeRepository>('EmployeeRepository');
