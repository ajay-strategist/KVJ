import { MemoryRepository } from '../../core/repository';
import type { UUID } from '../../core/types';
import type { LeaveRecord, ILeaveRepository } from './leave.repository';

export class MockLeaveRepository extends MemoryRepository<LeaveRecord> implements ILeaveRepository {
  constructor() {
    super({ defaultStatus: 'pending', pageSize: 20 }, [], 'MockLeaveRepository');
  }

  async findByEmployeeId(employeeId: UUID): Promise<LeaveRecord[]> {
    const rows = [...this.store.values()];
    return rows.filter((r) => r.employeeId === employeeId && !r.deletedAt);
  }

  async findPending(): Promise<LeaveRecord[]> {
    const rows = [...this.store.values()];
    return rows.filter((r) => r.status === 'pending' && !r.deletedAt);
  }
}
