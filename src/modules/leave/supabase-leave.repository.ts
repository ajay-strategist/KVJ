import { SupabaseRepository } from '../../shared/integration/supabase-repository';
import type { LeaveRecord, ILeaveRepository } from './leave.repository';
import type { UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';

export class SupabaseLeaveRepository extends SupabaseRepository<LeaveRecord> implements ILeaveRepository {
  constructor() {
    super('leaves');
  }

  async findByEmployeeId(employeeId: UUID): Promise<LeaveRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employeeId', employeeId)
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as LeaveRecord[];
  }

  async findPending(): Promise<LeaveRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('status', 'pending')
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as LeaveRecord[];
  }
}
