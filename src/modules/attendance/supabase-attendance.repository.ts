import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { AttendanceRecord, IAttendanceRepository, WorkSession } from './attendance.repository';
import type { UUID, DateRange, Actor } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';

export class SupabaseAttendanceRepository extends SupabaseRepository<AttendanceRecord> implements IAttendanceRepository {
  constructor() {
    super('attendance_records');
  }

  private async syncWorkSessions(attendanceRecordId: UUID, sessions?: WorkSession[]): Promise<void> {
    if (!sessions || sessions.length === 0) return;
    try {
      await supabase.from('work_sessions').delete().eq('attendance_record_id', attendanceRecordId);
      const rows = sessions.map((s) => ({
        attendance_record_id: attendanceRecordId,
        clock_in: s.clockIn,
        clock_out: s.clockOut || null,
        work_type: s.workType || 'Office',
        notes: s.notes || null,
      }));
      await supabase.from('work_sessions').insert(rows);
    } catch (e) {
      console.warn('Could not sync work_sessions to Supabase:', e);
    }
  }

  private async attachSessionsToRecords(records: AttendanceRecord[]): Promise<AttendanceRecord[]> {
    if (records.length === 0) return records;
    const ids = records.map((r) => r.id).filter((id) => id && id.length === 36);
    if (ids.length === 0) return records;

    try {
      const { data: wsData } = await supabase
        .from('work_sessions')
        .select('*')
        .in('attendance_record_id', ids);

      if (wsData && wsData.length > 0) {
        const map: Record<string, WorkSession[]> = {};
        wsData.forEach((row: any) => {
          const s: WorkSession = {
            id: row.id,
            workType: row.work_type || 'Office',
            clockIn: row.clock_in,
            clockOut: row.clock_out || undefined,
            notes: row.notes || undefined,
          };
          if (!map[row.attendance_record_id]) map[row.attendance_record_id] = [];
          map[row.attendance_record_id].push(s);
        });

        return records.map((r) => ({
          ...r,
          sessions: map[r.id] && map[r.id].length > 0 ? map[r.id] : r.sessions,
        }));
      }
    } catch (e) {
      console.warn('Could not attach work_sessions:', e);
    }
    return records;
  }

  override async create(data: Partial<AttendanceRecord>, actor: Actor): Promise<AttendanceRecord> {
    const created = await super.create(data, actor);
    const sessions = data.sessions || created.sessions;
    if (sessions && sessions.length > 0) {
      await this.syncWorkSessions(created.id, sessions);
      created.sessions = sessions;
    }
    return created;
  }

  override async update(id: UUID, patch: Partial<AttendanceRecord>, actor: Actor): Promise<AttendanceRecord> {
    const updated = await super.update(id, patch, actor);
    if (patch.sessions && patch.sessions.length > 0) {
      await this.syncWorkSessions(id, patch.sessions);
      updated.sessions = patch.sessions;
    }
    return updated;
  }

  override async findById(id: UUID, opts?: { includeDeleted?: boolean }): Promise<AttendanceRecord | null> {
    const rec = await super.findById(id, opts);
    if (!rec) return null;
    const attached = await this.attachSessionsToRecords([rec]);
    return attached[0];
  }

  override async findMany(query?: any): Promise<any> {
    const res = await super.findMany(query);
    if (res.data.length > 0) {
      res.data = await this.attachSessionsToRecords(res.data);
    }
    return res;
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
    if (!data) return null;
    const rec = toCamelCaseObject(data) as AttendanceRecord;
    const attached = await this.attachSessionsToRecords([rec]);
    return attached[0];
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
    const list = (data ?? []).map((row) => toCamelCaseObject(row) as AttendanceRecord);
    return this.attachSessionsToRecords(list);
  }
}


