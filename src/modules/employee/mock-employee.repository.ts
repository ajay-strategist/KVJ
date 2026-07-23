import { MemoryRepository } from '../../core/repository';
import type { UUID } from '../../core/types';
import type { Employee, IEmployeeRepository } from './employee.repository';

const AUDIT = {
  createdAt: '2022-01-01T00:00:00Z',
  updatedAt: '2022-01-01T00:00:00Z',
  createdBy: null,
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
} as const;

/**
 * Demo staff. The trainer ids here MUST stay in sync with training.seed.ts
 * (u-admin / u-ceo / u-ops / u-lead / u-sup / u-emp) — batches reference them,
 * and if a batch's trainerId has no matching employee the trainer renders as
 * "Unassigned" and the Resource Planner shows an empty column.
 */
const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'u-admin', employeeId: 'EMP-001', firstName: 'System', lastName: 'Admin', email: 'admin@kvjanalytics.com', designation: 'Super Administrator', dateOfJoining: '2022-01-01', status: 'active', ...AUDIT },
  { id: 'u-ceo', employeeId: 'EMP-002', firstName: 'Priya', lastName: 'Nair', email: 'ceo@kvjanalytics.com', designation: 'CEO', dateOfJoining: '2022-01-15', status: 'active', ...AUDIT },
  { id: 'u-ops', employeeId: 'EMP-003', firstName: 'Rahul', lastName: 'Menon', email: 'manager@kvjanalytics.com', designation: 'Operations Manager', dateOfJoining: '2022-02-01', reportingManagerId: 'u-ceo', status: 'active', ...AUDIT },
  { id: 'u-lead', employeeId: 'EMP-004', firstName: 'Anita', lastName: 'Rao', email: 'lead@kvjanalytics.com', designation: 'Lead Trainer', dateOfJoining: '2022-03-01', reportingManagerId: 'u-ops', status: 'active', ...AUDIT },
  { id: 'u-sup', employeeId: 'EMP-005', firstName: 'Karthik', lastName: 'Iyer', email: 'trainer@kvjanalytics.com', designation: 'Trainer', dateOfJoining: '2022-04-01', reportingManagerId: 'u-ops', status: 'active', ...AUDIT },
  { id: 'u-emp', employeeId: 'EMP-006', firstName: 'Sara', lastName: 'Pillai', email: 'employee@kvjanalytics.com', designation: 'Coordinator', dateOfJoining: '2023-01-01', reportingManagerId: 'u-sup', status: 'active', ...AUDIT },
];

export class MockEmployeeRepository
  extends MemoryRepository<Employee>
  implements IEmployeeRepository
{
  constructor() {
    super({ defaultStatus: 'active', pageSize: 20 }, INITIAL_EMPLOYEES);
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const list = Array.from((this as any).store.values()) as Employee[];
    return list.find((e) => e.email.toLowerCase() === email.toLowerCase() && !e.deletedAt) ?? null;
  }

  async findTeamMembers(managerId: UUID): Promise<Employee[]> {
    const list = Array.from((this as any).store.values()) as Employee[];
    return list.filter((e) => e.reportingManagerId === managerId && !e.deletedAt);
  }
}
