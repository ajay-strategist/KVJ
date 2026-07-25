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
            sessions: [{ id: this.uuid(), clockIn: ts, workType: 'Office' }],
            breaks: [],
          },
          actor
        );
      }

      let activeSession = record.sessions?.find((s) => !s.clockOut);
      let updatedSessions = record.sessions ?? [];

      if (!activeSession) {
        activeSession = {
          id: this.uuid(),
          clockIn: record.firstClockIn || ts,
          workType: 'Office',
        };
        updatedSessions = [...updatedSessions, activeSession];
      }

      const breakRec: BreakRecord = {
        id: this.uuid(),
        workSessionId: activeSession.id,
        startTime: ts,
        reason: reason || 'Official Break',
      };

      const updated = await this.repo.update(
        record.id,
        {
          status: 'on_break',
          sessions: updatedSessions,
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

      const parseTimeStr = (date: string, tStr: string): string | undefined => {
        if (tStr.includes('T') && tStr.includes('Z')) return tStr;
        const t = tStr.trim();
        const match = t.match(/^(\d+)(?::(\d+))?(?::(\d+))?\s*(AM|PM)?$/i);
        if (!match) return undefined;
        
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const seconds = match[3] ? parseInt(match[3], 10) : 0;
        const ampm = match[4]?.toUpperCase();

        if (ampm) {
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }

        const dateParts = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!dateParts) return undefined;
        const y = parseInt(dateParts[1], 10);
        const m = parseInt(dateParts[2], 10);
        const d = parseInt(dateParts[3], 10);

        try {
          const localDate = new Date(y, m - 1, d, hours, minutes, seconds);
          return localDate.toISOString();
        } catch {
          return undefined;
        }
      };

      let record = null;
      if (corr.attendanceRecordId && corr.attendanceRecordId.length === 36) {
        try {
          record = await this.repo.findById(corr.attendanceRecordId);
        } catch {}
      }

      if (!record) {
        let targetDate = corr.requestedDate;
        if (corr.fieldToCorrect === 'attendance_claim') {
          const match = corr.proposedValue.match(/^([\d-]+)/);
          if (match) targetDate = match[1];
        }
        if (targetDate) {
          record = await this.repo.findActiveRecord(corr.requestedBy, targetDate);
        }
      }

      if (!record) {
        let workDate = corr.requestedDate;
        let firstClockIn = undefined;
        let lastClockOut = undefined;

        if (corr.fieldToCorrect === 'attendance_claim') {
          const claimMatch = corr.proposedValue.match(/^([\d-]+)\s*\(([^)]+)\)/);
          if (claimMatch) {
            workDate = claimMatch[1];
            const timeRange = claimMatch[2];
            const times = timeRange.split(/\s*-\s*/);
            if (times.length === 2) {
              firstClockIn = parseTimeStr(workDate, times[0]);
              lastClockOut = parseTimeStr(workDate, times[1]);
            }
          }
        }

        const newRecord: AttendanceRecord = {
          id: this.uuid(),
          employeeId: corr.requestedBy,
          workDate: workDate || todayStr(),
          status: 'clocked_out',
          firstClockIn,
          lastClockOut,
          totalWorkingMinutes: 480,
          totalBreakMinutes: 0,
          sessions: [],
          breaks: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
          createdBy: actor.id,
          updatedBy: actor.id,
          deletedAt: null,
          deletedBy: null,
        };
        await this.repo.create(newRecord, actor);
      } else {
        const patch: Partial<AttendanceRecord> = {};
        if (corr.fieldToCorrect === 'firstClockIn') {
          patch.firstClockIn = parseTimeStr(record.workDate, corr.proposedValue) || corr.proposedValue;
        } else if (corr.fieldToCorrect === 'lastClockOut') {
          patch.lastClockOut = parseTimeStr(record.workDate, corr.proposedValue) || corr.proposedValue;
        } else if (corr.fieldToCorrect === 'attendance_claim') {
          const claimMatch = corr.proposedValue.match(/^([\d-]+)\s*\(([^)]+)\)/);
          if (claimMatch) {
            const workDate = claimMatch[1];
            const timeRange = claimMatch[2];
            const times = timeRange.split(/\s*-\s*/);
            if (times.length === 2) {
              patch.firstClockIn = parseTimeStr(workDate, times[0]);
              patch.lastClockOut = parseTimeStr(workDate, times[1]);
            }
          }
        }
        await this.repo.update(record.id, patch, actor);
      }

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

      return Ok(undefined);
    } catch (e) {
      console.error('Failed to approve attendance correction:', e);
      return Err(AppError.internal());
    }
  }
}
