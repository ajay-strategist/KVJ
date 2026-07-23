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
 * Production initial staff — Root Administrator only.
 * Additional employees are created dynamically by Admin in Settings.
 */
const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'u-admin',
    employeeId: 'EMP-001',
    firstName: 'System',
    lastName: 'Admin',
    email: 'admin@kvjanalytics.com',
    designation: 'Super Administrator',
    dateOfJoining: '2022-01-01',
    status: 'active',
    ...AUDIT,
  },
];

export class MockEmployeeRepository
  extends MemoryRepository<Employee>
  implements IEmployeeRepository
{
  constructor() {
    super({ defaultStatus: 'active', pageSize: 20 }, INITIAL_EMPLOYEES, 'MockEmployeeRepository');

    // Enforce production mode: purge non-admin employee records cached in localStorage
    const list = Array.from(this.store.values());
    const hasNonAdmin = list.some((e) => e.id !== 'u-admin' && e.email !== 'admin@kvjanalytics.com');
    if (hasNonAdmin) {
      this.store.clear();
      INITIAL_EMPLOYEES.forEach((e) => this.store.set(e.id, e));
      this.persist();
    }
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
