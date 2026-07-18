import { MemoryRepository } from '../../core/repository';
import type { UUID } from '../../core/types';
import type { Employee, IEmployeeRepository } from './employee.repository';

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'u-admin',
    employeeId: 'EMP-001',
    firstName: 'System',
    lastName: 'Admin',
    email: 'admin@kvj.test',
    designation: 'Super Administrator',
    dateOfJoining: '2022-01-01',
    status: 'active',
    createdAt: '2022-01-01T00:00:00Z',
    updatedAt: '2022-01-01T00:00:00Z',
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'u-ceo',
    employeeId: 'EMP-002',
    firstName: 'Priya',
    lastName: 'Nair',
    email: 'ceo@kvj.test',
    designation: 'CEO',
    dateOfJoining: '2022-01-15',
    status: 'active',
    createdAt: '2022-01-15T00:00:00Z',
    updatedAt: '2022-01-15T00:00:00Z',
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'u-ops',
    employeeId: 'EMP-003',
    firstName: 'Rahul',
    lastName: 'Menon',
    email: 'ops@kvj.test',
    designation: 'Operations Manager',
    dateOfJoining: '2022-02-01',
    reportingManagerId: 'u-ceo',
    status: 'active',
    createdAt: '2022-02-01T00:00:00Z',
    updatedAt: '2022-02-01T00:00:00Z',
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'u-lead',
    employeeId: 'EMP-004',
    firstName: 'Anita',
    lastName: 'Rao',
    email: 'lead@kvj.test',
    designation: 'Lead Trainer',
    dateOfJoining: '2022-03-01',
    reportingManagerId: 'u-ops',
    status: 'active',
    createdAt: '2022-03-01T00:00:00Z',
    updatedAt: '2022-03-01T00:00:00Z',
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'u-sup',
    employeeId: 'EMP-005',
    firstName: 'Karthik',
    lastName: 'Iyer',
    email: 'supervisor@kvj.test',
    designation: 'Project Supervisor',
    dateOfJoining: '2022-04-01',
    reportingManagerId: 'u-ops',
    status: 'active',
    createdAt: '2022-04-01T00:00:00Z',
    updatedAt: '2022-04-01T00:00:00Z',
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'u-emp',
    employeeId: 'EMP-006',
    firstName: 'Sara',
    lastName: 'Pillai',
    email: 'employee@kvj.test',
    designation: 'Trainer / Software Engineer',
    dateOfJoining: '2023-01-01',
    reportingManagerId: 'u-sup',
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
  },
];

export class MockEmployeeRepository extends MemoryRepository<Employee> implements IEmployeeRepository {
  constructor() {
    super({ defaultStatus: 'active', pageSize: 20 }, MOCK_EMPLOYEES);
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const rows = [...this.store.values()];
    return rows.find((r) => r.email.toLowerCase() === email.toLowerCase() && !r.deletedAt) || null;
  }

  async findTeamMembers(managerId: UUID): Promise<Employee[]> {
    const rows = [...this.store.values()];
    return rows.filter((r) => r.reportingManagerId === managerId && !r.deletedAt);
  }
}
