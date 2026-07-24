import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { LeaveRecord, ILeaveRepository } from './leave.repository';
import type { UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';

export class SupabaseLeaveRepository extends SupabaseRepository<LeaveRecord> implements ILeaveRepository {
  constructor() {
    super('leave_records');
  }

  async findByEmployeeId(employeeId: UUID): Promise<LeaveRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employee_id', employeeId)
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => toCamelCaseObject(row) as LeaveRecord);
  }

  async findPending(): Promise<LeaveRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('status', 'pending')
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => toCamelCaseObject(row) as LeaveRecord);
  }
}

