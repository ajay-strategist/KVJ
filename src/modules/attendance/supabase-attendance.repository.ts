import { SupabaseRepository } from '../../shared/integration/supabase-repository';
import type { AttendanceRecord, IAttendanceRepository } from './attendance.repository';
import type { UUID, DateRange } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';

export class SupabaseAttendanceRepository extends SupabaseRepository<AttendanceRecord> implements IAttendanceRepository {
  constructor() {
    super('attendance_records');
  }

  async findActiveRecord(employeeId: UUID, dateStr: string): Promise<AttendanceRecord | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employeeId', employeeId)
      .eq('workDate', dateStr)
      .is('deletedAt', null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as AttendanceRecord | null;
  }

  async findHistory(employeeId: UUID, range: DateRange): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employeeId', employeeId)
      .gte('workDate', range.from)
      .lte('workDate', range.to)
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as AttendanceRecord[];
  }
}
