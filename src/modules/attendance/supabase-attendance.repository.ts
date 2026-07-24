import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
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
      .eq('employee_id', employeeId)
      .eq('work_date', dateStr)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.warn(`Supabase findActiveRecord warning on ${this.tableName}:`, error.message);
      return null;
    }
    return data ? (toCamelCaseObject(data) as AttendanceRecord) : null;
  }

  async findHistory(employeeId: UUID, range: DateRange): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employee_id', employeeId)
      .gte('work_date', range.from)
      .lte('work_date', range.to)
      .is('deleted_at', null);

    if (error) {
      console.warn(`Supabase findHistory warning on ${this.tableName}:`, error.message);
      return [];
    }
    return (data ?? []).map((row) => toCamelCaseObject(row) as AttendanceRecord);
  }
}

