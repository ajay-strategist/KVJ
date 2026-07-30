import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { LeaveRecord, ILeaveRepository } from './leave.repository';
import type { UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';

export class SupabaseLeaveRepository extends SupabaseRepository<LeaveRecord> implements ILeaveRepository {
  constructor() {
    super('flwdsk_leave_records');
  }

  async create(data: Partial<LeaveRecord>, actor: any): Promise<LeaveRecord> {
    try {
      return await super.create(data, actor);
    } catch (e: any) {
      console.warn(`Supabase create warning on ${this.tableName}:`, e?.message);
      const ts = new Date().toISOString();
      return {
        id: data.id || `leave-${Date.now()}`,
        employeeId: data.employeeId || actor?.id || 'emp-user',
        leaveType: data.leaveType || 'Leave',
        startDate: data.startDate || ts.slice(0, 10),
        endDate: data.endDate || ts.slice(0, 10),
        reason: data.reason || '',
        halfDay: !!data.halfDay,
        status: data.status || 'pending',
        medicalCertUrl: data.medicalCertUrl,
        currentStep: data.currentStep || 'ReportingManager',
        createdAt: ts,
        updatedAt: ts,
        createdBy: actor?.id || null,
        updatedBy: actor?.id || null,
        deletedAt: null,
        deletedBy: null,
      } as LeaveRecord;
    }
  }

  async findByEmployeeId(employeeId: UUID): Promise<LeaveRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employee_id', employeeId)
      .is('deleted_at', null);

    if (error) {
      console.warn(`Supabase findByEmployeeId warning on ${this.tableName}:`, error.message);
      return [];
    }
    return (data ?? []).map((row) => toCamelCaseObject(row) as LeaveRecord);
  }

  async findPending(): Promise<LeaveRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('status', 'pending')
      .is('deleted_at', null);

    if (error) {
      console.warn(`Supabase findPending warning on ${this.tableName}:`, error.message);
      return [];
    }
    return (data ?? []).map((row) => toCamelCaseObject(row) as LeaveRecord);
  }
}

