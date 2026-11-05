import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { AttendanceRecord, IAttendanceRepository, WorkSession, BreakRecord } from './attendance.repository';
import type { UUID, DateRange, Actor } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';

export class SupabaseAttendanceRepository extends SupabaseRepository<AttendanceRecord> implements IAttendanceRepository {
  constructor() {
    super('flwdsk_attendance_records');
  }

  private async syncWorkSessions(attendanceRecordId: UUID, sessions?: WorkSession[]): Promise<void> {
    if (!sessions || sessions.length === 0) return;
    try {
      const rows = sessions.map((s) => ({
        ...(s.id && s.id.length === 36 ? { id: s.id } : {}),
        attendance_record_id: attendanceRecordId,
        clock_in: s.clockIn,
        clock_out: s.clockOut || null,
        work_type: s.workType || 'Office',
        notes: s.notes || null,
      }));

      // In-place upsert to prevent foreign key constraint violations against flwdsk_break_records
      await supabase.from('flwdsk_work_sessions').upsert(rows);

      // Clean up removed sessions with strict child-before-parent ordering
      const currentIds = rows.map((r: any) => r.id).filter(Boolean);
      const { data: existing } = await supabase
        .from('flwdsk_work_sessions')
        .select('id')
        .eq('attendance_record_id', attendanceRecordId);

      const toRemove = (existing || []).map((e) => e.id).filter((id) => !currentIds.includes(id));
      if (toRemove.length > 0) {
        await supabase.from('flwdsk_break_records').delete().in('work_session_id', toRemove);
        await supabase.from('flwdsk_work_sessions').delete().in('id', toRemove);
      }
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
        .from('flwdsk_work_sessions')
        .select('*')
        .in('attendance_record_id', ids)
        .order('clock_in', { ascending: true });

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

        // Ensure chronological ascending order for sessions of each record
        Object.keys(map).forEach((k) => {
          map[k].sort((a, b) => {
            const tA = a.clockIn ? new Date(a.clockIn).getTime() : 0;
            const tB = b.clockIn ? new Date(b.clockIn).getTime() : 0;
            return tA - tB;
          });
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

  private async syncBreaks(attendanceRecordId: UUID, breaks?: BreakRecord[]): Promise<void> {
    if (!breaks || breaks.length === 0) return;
    try {
      const { data: sessions } = await supabase
        .from('flwdsk_work_sessions')
        .select('id')
        .eq('attendance_record_id', attendanceRecordId);
        
      const sessionIds = (sessions || []).map((s) => s.id);
      if (sessionIds.length === 0) {
        const { data: createdWs } = await supabase
          .from('flwdsk_work_sessions')
          .insert({
            attendance_record_id: attendanceRecordId,
            clock_in: breaks[0]?.startTime || new Date().toISOString(),
            work_type: 'Office',
          })
          .select('id')
          .single();
        if (createdWs?.id) {
          sessionIds.push(createdWs.id);
        }
      }

      const fallbackSessionId = sessionIds.length > 0 ? sessionIds[sessionIds.length - 1] : null;
      
      const rows = breaks.map((b) => ({
        ...(b.id && b.id.length === 36 ? { id: b.id } : {}),
        work_session_id: sessionIds.includes(b.workSessionId) ? b.workSessionId : fallbackSessionId,
        start_time: b.startTime,
        end_time: b.endTime || null,
        reason: b.reason || null,
      })).filter((row) => !!row.work_session_id);
      
      if (rows.length > 0) {
        await supabase.from('flwdsk_break_records').upsert(rows);

        const currentBreakIds = rows.map((r: any) => r.id).filter(Boolean);
        if (currentBreakIds.length > 0 && sessionIds.length > 0) {
          const { data: existingBreaks } = await supabase
            .from('flwdsk_break_records')
            .select('id')
            .in('work_session_id', sessionIds);

          const breaksToRemove = (existingBreaks || [])
            .map((eb: any) => eb.id)
            .filter((bid: string) => !currentBreakIds.includes(bid));

          if (breaksToRemove.length > 0) {
            await supabase
              .from('flwdsk_break_records')
              .delete()
              .in('id', breaksToRemove);
          }
        }
      }
    } catch (e) {
      console.warn('Could not sync break_records to Supabase:', e);
    }
  }

  private async attachBreaksToRecords(records: AttendanceRecord[]): Promise<AttendanceRecord[]> {
    if (records.length === 0) return records;
    const ids = records.map((r) => r.id).filter((id) => id && id.length === 36);
    if (ids.length === 0) return records;

    try {
      const { data: wsData } = await supabase
        .from('flwdsk_work_sessions')
        .select('id, attendance_record_id')
        .in('attendance_record_id', ids);

      if (wsData && wsData.length > 0) {
        const sessionIds = wsData.map((row) => row.id);
        const wsToAttMap: Record<string, string> = {};
        wsData.forEach((row) => {
          wsToAttMap[row.id] = row.attendance_record_id;
        });

        const { data: bData } = await supabase
          .from('flwdsk_break_records')
          .select('*')
          .in('work_session_id', sessionIds)
          .order('start_time', { ascending: true });

        if (bData && bData.length > 0) {
          const attToBreaksMap: Record<string, BreakRecord[]> = {};
          bData.forEach((row: any) => {
            const b: BreakRecord = {
              id: row.id,
              workSessionId: row.work_session_id,
              startTime: row.start_time,
              endTime: row.end_time || undefined,
              reason: row.reason || undefined,
            };
            const attId = wsToAttMap[row.work_session_id];
            if (attId) {
              if (!attToBreaksMap[attId]) attToBreaksMap[attId] = [];
              attToBreaksMap[attId].push(b);
            }
          });

          // Ensure chronological ascending order for breaks of each record
          Object.keys(attToBreaksMap).forEach((k) => {
            attToBreaksMap[k].sort((a, b) => {
              const tA = a.startTime ? new Date(a.startTime).getTime() : 0;
              const tB = b.startTime ? new Date(b.startTime).getTime() : 0;
              return tA - tB;
            });
          });

          return records.map((r) => ({
            ...r,
            breaks: attToBreaksMap[r.id] && attToBreaksMap[r.id].length > 0 ? attToBreaksMap[r.id] : r.breaks || [],
          }));
        }
      }
    } catch (e) {
      console.warn('Could not attach break_records:', e);
    }
    return records;
  }

  override async create(data: Partial<AttendanceRecord>, actor: Actor): Promise<AttendanceRecord> {
    // `sessions` and `breaks` are NOT columns on flwdsk_attendance_records — they
    // live in flwdsk_work_sessions / flwdsk_break_records and are written below.
    // Strip them before the base insert so the insert doesn't error on unknown
    // columns (which caused clock-in to fail).
    const { sessions, breaks, ...base } = data;
    const created = await super.create(base, actor);
    if (sessions && sessions.length > 0) {
      await this.syncWorkSessions(created.id, sessions);
      created.sessions = sessions;
    }
    if (breaks && breaks.length > 0) {
      await this.syncBreaks(created.id, breaks);
      created.breaks = breaks;
    }
    return created;
  }

  override async update(id: UUID, patch: Partial<AttendanceRecord>, actor: Actor): Promise<AttendanceRecord> {
    const { sessions, breaks, ...base } = patch;
    const updated = await super.update(id, base, actor);
    if (sessions && sessions.length > 0) {
      await this.syncWorkSessions(id, sessions);
      updated.sessions = sessions;
    }
    if (breaks && breaks.length > 0) {
      await this.syncBreaks(id, breaks);
      updated.breaks = breaks;
    }
    return updated;
  }

  override async findById(id: UUID, opts?: { includeDeleted?: boolean }): Promise<AttendanceRecord | null> {
    const rec = await super.findById(id, opts);
    if (!rec) return null;
    const attached = await this.attachSessionsToRecords([rec]);
    const withBreaks = await this.attachBreaksToRecords(attached);
    return withBreaks[0];
  }

  override async findMany(query?: any): Promise<any> {
    const res = await super.findMany(query);
    if (res.data.length > 0) {
      const attached = await this.attachSessionsToRecords(res.data);
      res.data = await this.attachBreaksToRecords(attached);
    }
    return res;
  }

  async findActiveRecord(employeeId: UUID, dateStr: string): Promise<AttendanceRecord | null> {
    // 1. Check for any unclosed session (status IN ('present', 'on_break')) regardless of work_date
    const { data: openData, error: openError } = await supabase
      .from(this.tableName)
      .select()
      .eq('employee_id', employeeId)
      .in('status', ['present', 'on_break'])
      .is('deleted_at', null)
      .order('work_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!openError && openData) {
      const rec = toCamelCaseObject(openData) as AttendanceRecord;
      const attached = await this.attachSessionsToRecords([rec]);
      const withBreaks = await this.attachBreaksToRecords(attached);
      const activeCandidate = withBreaks[0];

      // If an active session is currently open (present or on_break), always return it so
      // employee can clock out or manage breaks reliably, even across midnight rollover.
      return activeCandidate;
    }

    // 2. If no open session, query for the record on dateStr
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
    const withBreaks = await this.attachBreaksToRecords(attached);
    return withBreaks[0];
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
    const attached = await this.attachSessionsToRecords(list);
    return this.attachBreaksToRecords(attached);
  }
}


