import { container, createToken } from '../../core/registry';
import { todayISO } from '../../shared/utils/date';
import { AppError, Err, Ok, type Result } from '../../core/result';
import type { Actor, GeoPoint, UUID, DateRange } from '../../core/types';
import { eventBus } from '../../core/event-bus';
import { supabase } from '../../shared/integration/supabase';
import { toCamelCaseObject } from '../../shared/integration/supabase-repository';
import {
  ATTENDANCE_REPOSITORY_TOKEN,
  type AttendanceRecord,
  type WorkSession,
  type BreakRecord,
  type WorkSessionType,
} from './attendance.repository';

export interface IAttendanceService {
  getRecordForToday(employeeId: UUID): Promise<Result<AttendanceRecord | null>>;
  getHistory(employeeId: UUID, range: DateRange): Promise<Result<AttendanceRecord[]>>;
  clockIn(employeeId: UUID, workType: WorkSessionType, geo?: GeoPoint): Promise<Result<AttendanceRecord>>;
  clockOut(employeeId: UUID, geo?: GeoPoint): Promise<Result<AttendanceRecord>>;
  startBreak(employeeId: UUID, reason?: string): Promise<Result<AttendanceRecord>>;
  endBreak(employeeId: UUID): Promise<Result<AttendanceRecord>>;
  listPendingCorrections(): Promise<Result<any[]>>;
  requestCorrection(recordId: UUID, field: string, proposed: string, reason: string, actor: Actor): Promise<Result<void>>;
  approveCorrection(correctionId: UUID, actor: Actor, notes?: string): Promise<Result<void>>;
}

export const ATTENDANCE_SERVICE_TOKEN = createToken<IAttendanceService>('AttendanceService');

const todayStr = () => todayISO();
const nowIso = () => new Date().toISOString();

export class AttendanceService implements IAttendanceService {
  private get repo() {
    return container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
  }

  private uuid(): UUID {
    return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID;
  }

  async getRecordForToday(employeeId: UUID): Promise<Result<AttendanceRecord | null>> {
    try {
      const rec = await this.repo.findActiveRecord(employeeId, todayStr());
      return Ok(rec);
    } catch {
      return Err(AppError.internal());
    }
  }

  async getHistory(employeeId: UUID, range: DateRange): Promise<Result<AttendanceRecord[]>> {
    try {
      const history = await this.repo.findHistory(employeeId, range);
      return Ok(history);
    } catch {
      return Err(AppError.internal());
    }
  }

  async clockIn(employeeId: UUID, workType: WorkSessionType, geo?: GeoPoint): Promise<Result<AttendanceRecord>> {
    try {
      const date = todayStr();
      const ts = nowIso();
      let record = await this.repo.findActiveRecord(employeeId, date);
      const actor: Actor = { id: employeeId, role: 'Employee' };

      if (!record) {
        record = await this.repo.create(
          {
            employeeId,
            workDate: date,
            status: 'present',
            firstClockIn: ts,
            totalWorkingMinutes: 0,
            totalBreakMinutes: 0,
            sessions: [],
            breaks: [],
          },
          actor
        );
      }

      const hasOpenSession = record.sessions?.some((s) => !s.clockOut);
      if (hasOpenSession) {
        return Err(AppError.businessRule('You are already clocked in.'));
      }

      const session: WorkSession = {
        id: this.uuid(),
        clockIn: ts,
        workType,
        clockInGeo: geo,
      };

      const updatedSessions = [...(record.sessions ?? []), session];
      const updated = await this.repo.update(
        record.id,
        {
          status: 'present',
          sessions: updatedSessions,
        },
        actor
      );

      eventBus.emit('attendance.clockIn' as any, { employeeId, time: ts } as any);

      return Ok(updated);
    } catch (err: any) {
      return Err(err instanceof AppError ? err : AppError.internal());
    }
  }

  async clockOut(employeeId: UUID, geo?: GeoPoint): Promise<Result<AttendanceRecord>> {
    try {
      const date = todayStr();
      const ts = nowIso();
      const record = await this.repo.findActiveRecord(employeeId, date);
      const actor: Actor = { id: employeeId, role: 'Employee' };

      if (!record || record.status === 'clocked_out') {
        return Err(AppError.businessRule('No active work session found to clock out.'));
      }

      let updatedBreaks = [...(record.breaks ?? [])];
      if (record.status === 'on_break') {
        updatedBreaks = updatedBreaks.map((b) => (b.endTime ? b : { ...b, endTime: ts }));
      }

      const updatedSessions = (record.sessions ?? []).map((s) => {
        if (!s.clockOut) {
          return { ...s, clockOut: ts, clockOutGeo: geo };
        }
        return s;
      });

      let totalWorkingMs = 0;
      updatedSessions.forEach((s) => {
        if (s.clockOut) {
          totalWorkingMs += new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime();
        }
      });

      let totalBreakMs = 0;
      updatedBreaks.forEach((b) => {
        if (b.endTime) {
          totalBreakMs += new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
        }
      });

      const workingMin = Math.round(totalWorkingMs / 60000);
      const breakMin = Math.round(totalBreakMs / 60000);

      const updated = await this.repo.update(
        record.id,
        {
          status: 'clocked_out',
          lastClockOut: ts,
          sessions: updatedSessions,
          breaks: updatedBreaks,
          totalWorkingMinutes: workingMin,
          totalBreakMinutes: breakMin,
        },
        actor
      );

      eventBus.emit('attendance.clockOut' as any, { employeeId, time: ts } as any);

      return Ok(updated);
    } catch (err: any) {
      return Err(err instanceof AppError ? err : AppError.internal());
    }
  }

  async startBreak(employeeId: UUID, reason?: string): Promise<Result<AttendanceRecord>> {
    try {
      const date = todayStr();
      const ts = nowIso();
      const record = await this.repo.findActiveRecord(employeeId, date);
      const actor: Actor = { id: employeeId, role: 'Employee' };

      if (!record || (record.status !== 'present' && record.status !== 'on_break')) {
        return Err(AppError.businessRule('You must be clocked in and not already on break to start a break.'));
      }

      const activeSession = record.sessions?.find((s) => !s.clockOut);
      if (!activeSession) {
        return Err(AppError.businessRule('No active work session found.'));
      }

      const breakRec: BreakRecord = {
        id: this.uuid(),
        workSessionId: activeSession.id,
        startTime: ts,
        reason,
      };

      const updated = await this.repo.update(
        record.id,
        {
          status: 'on_break',
          breaks: [...(record.breaks ?? []), breakRec],
        },
        actor
      );

      return Ok(updated);
    } catch (err: any) {
      return Err(err instanceof AppError ? err : AppError.internal());
    }
  }

  async endBreak(employeeId: UUID): Promise<Result<AttendanceRecord>> {
    try {
      const date = todayStr();
      const ts = nowIso();
      const record = await this.repo.findActiveRecord(employeeId, date);
      const actor: Actor = { id: employeeId, role: 'Employee' };

      if (!record || record.status !== 'on_break') {
        return Err(AppError.businessRule('You are not currently on a break.'));
      }

      const updatedBreaks = (record.breaks ?? []).map((b) => {
        if (!b.endTime) {
          return { ...b, endTime: ts };
        }
        return b;
      });

      let totalBreakMs = 0;
      updatedBreaks.forEach((b) => {
        if (b.endTime) {
          totalBreakMs += new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
        }
      });
      const breakMin = Math.round(totalBreakMs / 60000);

      const updated = await this.repo.update(
        record.id,
        {
          status: 'present',
          breaks: updatedBreaks,
          totalBreakMinutes: breakMin,
        },
        actor
      );

      return Ok(updated);
    } catch (err: any) {
      return Err(err instanceof AppError ? err : AppError.internal());
    }
  }

  private corrections = new Map<UUID, any>();

  async listPendingCorrections(): Promise<Result<any[]>> {
    try {
      const { data, error } = await supabase
        .from('attendance_corrections')
        .select('*')
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        const all = [...this.corrections.values()].filter((c) => c.status === 'pending');
        return Ok(all);
      }

      const rows = (data ?? []).map((row) => toCamelCaseObject(row));
      return Ok(rows);
    } catch {
      return Err(AppError.internal());
    }
  }

  async requestCorrection(recordId: UUID, field: string, proposed: string, reason: string, actor: Actor): Promise<Result<void>> {
    try {
      const record = await this.repo.findById(recordId);
      const originalVal = record
        ? field === 'firstClockIn'
          ? record.firstClockIn || 'None'
          : record.lastClockOut || 'None'
        : 'None';

      const payload = {
        attendance_record_id: recordId,
        requested_by: actor.id,
        requested_date: todayStr(),
        field_to_correct: field,
        original_value: originalVal,
        proposed_value: proposed,
        reason,
        status: 'pending',
      };

      const { error } = await supabase
        .from('attendance_corrections')
        .insert(payload);

      if (error) {
        console.warn('Supabase attendance_corrections insert warning, using memory fallback:', error.message);
        const id = this.uuid();
        this.corrections.set(id, {
          id,
          attendanceRecordId: recordId,
          requestedBy: actor.id,
          requestedDate: todayStr(),
          fieldToCorrect: field,
          originalValue: originalVal,
          proposedValue: proposed,
          reason,
          status: 'pending',
          createdAt: nowIso(),
        });
      }
      return Ok(undefined);
    } catch {
      return Err(AppError.internal());
    }
  }

  async approveCorrection(correctionId: UUID, actor: Actor, notes?: string): Promise<Result<void>> {
    try {
      const { data: corrData } = await supabase
        .from('attendance_corrections')
        .select('*')
        .eq('id', correctionId)
        .maybeSingle();

      const corr = corrData ? toCamelCaseObject(corrData) : this.corrections.get(correctionId);
      if (!corr) return Err(AppError.notFound('Correction request not found.'));

      await supabase
        .from('attendance_corrections')
        .update({
          status: 'approved',
          approver_id: actor.id,
          approver_notes: notes || null,
          approved_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq('id', correctionId);

      this.corrections.delete(correctionId);

      const record = await this.repo.findById(corr.attendanceRecordId);
      if (record) {
        const patch: Partial<AttendanceRecord> = {};
        if (corr.fieldToCorrect === 'firstClockIn') {
          patch.firstClockIn = corr.proposedValue;
        } else if (corr.fieldToCorrect === 'lastClockOut') {
          patch.lastClockOut = corr.proposedValue;
        }
        await this.repo.update(record.id, patch, actor);
      }

      return Ok(undefined);
    } catch {
      return Err(AppError.internal());
    }
  }
}
