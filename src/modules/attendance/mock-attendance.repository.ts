import { MemoryRepository } from '../../core/repository';
import type { UUID, DateRange } from '../../core/types';
import type { AttendanceRecord, IAttendanceRepository } from './attendance.repository';

export class MockAttendanceRepository extends MemoryRepository<AttendanceRecord> implements IAttendanceRepository {
  constructor() {
    super({ defaultStatus: 'clocked_out', pageSize: 20 }, [], 'MockAttendanceRepository');
  }

  async findActiveRecord(employeeId: UUID, dateStr: string): Promise<AttendanceRecord | null> {
    const rows = [...this.store.values()];
    return rows.find((r) => r.employeeId === employeeId && r.workDate === dateStr && !r.deletedAt) || null;
  }

  async findHistory(employeeId: UUID, range: DateRange): Promise<AttendanceRecord[]> {
    const rows = [...this.store.values()];
    return rows.filter(
      (r) =>
        r.employeeId === employeeId &&
        r.workDate >= range.from &&
        r.workDate <= range.to &&
        !r.deletedAt
    );
  }
}
