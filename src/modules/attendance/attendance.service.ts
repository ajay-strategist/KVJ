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
  rejectCorrection(correctionId: UUID, actor: Actor, notes?: string): Promise<Result<void>>;
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

  private corrections = new Map<string, any>();

  async getRecordForToday(employeeId: UUID): Promise<Result<AttendanceRecord | null>> {
    try {
      const record = await this.repo.findActiveRecord(employeeId, todayStr());
      return Ok(record);
    } catch (e) {
      console.error('Failed to get today attendance record:', e);
      return Err(AppError.internal((e as any)?.message));
    }
  }

  async getHistory(employeeId: UUID, range: DateRange): Promise<Result<AttendanceRecord[]>> {
    try {
      const records = await this.repo.findHistory(employeeId, range);
      return Ok(records);
    } catch (e) {
      console.error('Failed to get attendance history:', e);
      return Err(AppError.internal((e as any)?.message));
    }
  }

  async clockIn(employeeId: UUID, workType: WorkSessionType, geo?: GeoPoint): Promise<Result<AttendanceRecord>> {
    try {
      const ts = nowIso();
      const date = todayStr();
      const existing = await this.repo.findActiveRecord(employeeId, date);

      if (!existing) {
        const newRecord: AttendanceRecord = {
          id: this.uuid(),
          employeeId,
          workDate: date,
          status: 'present',
          firstClockIn: ts,
          totalWorkingMinutes: 0,
          totalBreakMinutes: 0,
          sessions: [
            {
              id: this.uuid(),
              clockIn: ts,
              workType,
              clockInGeo: geo,
            },
          ],
          breaks: [],
          createdAt: ts,
          updatedAt: ts,
          createdBy: employeeId,
          updatedBy: employeeId,
          deletedAt: null,
          deletedBy: null,
        };

        const saved = await this.repo.create(newRecord, { id: employeeId, role: 'Employee' });
        eventBus.emit('attendance.clockIn' as any, { employeeId, time: ts } as any);
        return Ok(saved);
      }

      const hasOpenSession = existing.sessions?.some((s) => !s.clockOut);
      if (hasOpenSession) {
        return Err(AppError.businessRule('Already clocked in. Please clock out of current session first.'));
      }

      const session: WorkSession = {
        id: this.uuid(),
        clockIn: ts,
        workType,
        clockInGeo: geo,
      };

      const updatedSessions = [...(existing.sessions ?? []), session];
      const patch: Partial<AttendanceRecord> = {
        status: 'present',
        firstClockIn: existing.firstClockIn || ts,
        sessions: updatedSessions,
        updatedAt: ts,
        updatedBy: employeeId,
      };

      const saved = await this.repo.update(existing.id, patch, { id: employeeId, role: 'Employee' });
      eventBus.emit('attendance.clockIn' as any, { employeeId, time: ts } as any);
      return Ok(saved);
    } catch (e) {
      console.error('Failed to clock in:', e);
      return Err(AppError.internal((e as any)?.message));
    }
  }

  async clockOut(employeeId: UUID, geo?: GeoPoint): Promise<Result<AttendanceRecord>> {
    try {
      const ts = nowIso();
      const record = await this.repo.findActiveRecord(employeeId, todayStr());

      if (!record || record.status === 'clocked_out') {
        return Err(AppError.businessRule('No active session to clock out from.'));
      }

      let totalWorkingMs = 0;
      const updatedSessions = (record.sessions ?? []).map((s) => {
        if (!s.clockOut) {
          const finished: WorkSession = { ...s, clockOut: ts, clockOutGeo: geo };
          totalWorkingMs += new Date(ts).getTime() - new Date(s.clockIn).getTime();
          return finished;
        } else {
          totalWorkingMs += new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime();
          return s;
        }
      });

      const openBreak = record.breaks?.find((b) => !b.endTime);
      let updatedBreaks = record.breaks ?? [];
      let extraBreakMs = 0;
      if (openBreak) {
        updatedBreaks = updatedBreaks.map((b) =>
          b.id === openBreak.id ? { ...b, endTime: ts } : b
        );
        extraBreakMs = new Date(ts).getTime() - new Date(openBreak.startTime).getTime();
      }

      const totalWorkingMins = Math.max(0, Math.floor(totalWorkingMs / 60000));
      const totalBreakMins = (record.totalBreakMinutes || 0) + Math.floor(extraBreakMs / 60000);

      const patch: Partial<AttendanceRecord> = {
        status: 'clocked_out',
        lastClockOut: ts,
        totalWorkingMinutes: totalWorkingMins,
        totalBreakMinutes: totalBreakMins,
        sessions: updatedSessions,
        breaks: updatedBreaks,
        updatedAt: ts,
        updatedBy: employeeId,
      };

      const saved = await this.repo.update(record.id, patch, { id: employeeId, role: 'Employee' });
      eventBus.emit('attendance.clockOut' as any, { employeeId, time: ts } as any);
      return Ok(saved);
    } catch (e) {
      console.error('Failed to clock out:', e);
      return Err(AppError.internal((e as any)?.message));
    }
  }

  async startBreak(employeeId: UUID, reason?: string): Promise<Result<AttendanceRecord>> {
    try {
      const ts = nowIso();
      const record = await this.repo.findActiveRecord(employeeId, todayStr());

      if (!record || record.status !== 'present') {
        return Err(AppError.businessRule('Must be actively clocked in to start a break.'));
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
        reason,
      };

      const patch: Partial<AttendanceRecord> = {
        status: 'on_break',
        sessions: updatedSessions,
        breaks: [...(record.breaks ?? []), breakRec],
        updatedAt: ts,
        updatedBy: employeeId,
      };

      const saved = await this.repo.update(record.id, patch, { id: employeeId, role: 'Employee' });
      return Ok(saved);
    } catch (e) {
      console.error('Failed to start break:', e);
      return Err(AppError.internal((e as any)?.message));
    }
  }

  async endBreak(employeeId: UUID): Promise<Result<AttendanceRecord>> {
    try {
      const ts = nowIso();
      const record = await this.repo.findActiveRecord(employeeId, todayStr());

      if (!record || record.status !== 'on_break') {
        return Err(AppError.businessRule('Not currently on break.'));
      }

      const openBreak = record.breaks?.find((b) => !b.endTime);
      let breakMins = 0;
      let updatedBreaks = record.breaks ?? [];

      if (openBreak) {
        const breakMs = new Date(ts).getTime() - new Date(openBreak.startTime).getTime();
        breakMins = Math.max(0, Math.floor(breakMs / 60000));
        updatedBreaks = (record.breaks ?? []).map((b) =>
          b.id === openBreak.id ? { ...b, endTime: ts } : b
        );
      } else {
        // Self-healing fallback: If the record status is 'on_break' but no unsaved break log
        // exists in break_records table (e.g. started before the sync fix), heal the state.
        const fallbackStart = record.updatedAt || record.firstClockIn || ts;
        const breakMs = new Date(ts).getTime() - new Date(fallbackStart).getTime();
        breakMins = Math.max(0, Math.floor(breakMs / 60000));

        const fallbackBreak: BreakRecord = {
          id: this.uuid(),
          workSessionId: record.sessions?.[record.sessions.length - 1]?.id || this.uuid(),
          startTime: fallbackStart,
          endTime: ts,
          reason: 'Auto-recovery break',
        };
        updatedBreaks = [...updatedBreaks, fallbackBreak];
      }

      const patch: Partial<AttendanceRecord> = {
        status: 'present',
        totalBreakMinutes: (record.totalBreakMinutes || 0) + breakMins,
        breaks: updatedBreaks,
        updatedAt: ts,
        updatedBy: employeeId,
      };

      const saved = await this.repo.update(record.id, patch, { id: employeeId, role: 'Employee' });
      return Ok(saved);
    } catch (e) {
      console.error('Failed to end break:', e);
      return Err(AppError.internal((e as any)?.message));
    }
  }

  async listPendingCorrections(): Promise<Result<any[]>> {
    try {
      const { data, error } = await supabase
        .from('flwdsk_attendance_corrections')
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
    } catch (e) {
      return Err(AppError.internal((e as any)?.message));
    }
  }

  async requestCorrection(recordId: UUID, field: string, proposed: string, reason: string, actor: Actor): Promise<Result<void>> {
    try {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = UUID_RE.test(recordId);

      const record = isUuid ? await this.repo.findById(recordId) : null;
      const originalVal = record
        ? field === 'firstClockIn'
          ? record.firstClockIn || 'None'
          : record.lastClockOut || 'None'
        : 'None';

      const payload = {
        attendance_record_id: isUuid ? recordId : null,
        requested_by: actor.id,
        requested_date: todayStr(),
        field_to_correct: field,
        original_value: originalVal,
        proposed_value: proposed,
        reason,
        status: 'pending',
      };

      const { error } = await supabase
        .from('flwdsk_attendance_corrections')
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
    } catch (e) {
      return Err(AppError.internal((e as any)?.message));
    }
  }

  async approveCorrection(correctionId: UUID, actor: Actor, notes?: string): Promise<Result<void>> {
    try {
      const { data: corrData } = await supabase
        .from('flwdsk_attendance_corrections')
        .select('*')
        .eq('id', correctionId)
        .maybeSingle();

      const corr = corrData ? toCamelCaseObject(corrData) : this.corrections.get(correctionId);
      if (!corr) return Err(AppError.notFound('Correction request not found.'));

      const parseTimeStr = (date: string, tStr: string): string | undefined => {
        if (!tStr) return undefined;
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

      // Determine workDate, firstClockIn, lastClockOut
      let workDate = corr.requestedDate || todayStr();
      let firstClockIn: string | undefined = undefined;
      let lastClockOut: string | undefined = undefined;

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

      // Parse classification & location from corr.reason
      let workType: WorkSessionType = 'Office';
      const reasonStr = corr.reason || '';
      const classMatch = reasonStr.match(/Classification:\s*([^,\n.]+)/i);
      if (classMatch) {
        const raw = classMatch[1].trim().toLowerCase();
        if (raw.includes('training')) workType = 'Training';
        else if (raw.includes('marketing')) workType = 'Marketing';
        else if (raw.includes('supervision')) workType = 'Supervision' as any;
        else if (raw.includes('travel')) workType = 'Travel' as any;
        else if (raw.includes('remote')) workType = 'Work From Home';
        else workType = 'Office';
      } else if (reasonStr.toLowerCase().includes('training')) {
        workType = 'Training';
      }

      let record = null;
      if (corr.attendanceRecordId && corr.attendanceRecordId.length === 36) {
        try {
          record = await this.repo.findById(corr.attendanceRecordId);
        } catch {}
      }

      if (!record && workDate) {
        record = await this.repo.findActiveRecord(corr.requestedBy, workDate);
      }

      // Calculate elapsed working minutes
      let calculatedMins = 480;
      if (firstClockIn && lastClockOut) {
        const sMs = new Date(firstClockIn).getTime();
        const eMs = new Date(lastClockOut).getTime();
        if (!isNaN(sMs) && !isNaN(eMs) && eMs > sMs) {
          calculatedMins = Math.round((eMs - sMs) / (1000 * 60));
        }
      }

      if (!record) {
        // CREATE NEW ATTENDANCE RECORD
        const newRecord: AttendanceRecord = {
          id: this.uuid(),
          employeeId: corr.requestedBy,
          workDate: workDate || todayStr(),
          status: 'clocked_out',
          firstClockIn,
          lastClockOut,
          totalWorkingMinutes: calculatedMins,
          totalBreakMinutes: 0,
          sessions: [
            {
              id: this.uuid(),
              workType,
              clockIn: firstClockIn || workDate || nowIso(),
              clockOut: lastClockOut,
              notes: corr.reason || 'Approved Claim',
            },
          ],
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
        // RESUBMISSION / UPDATE EXISTING ATTENDANCE RECORD
        const patch: Partial<AttendanceRecord> = {
          status: 'clocked_out',
          updatedAt: nowIso(),
          updatedBy: actor.id,
        };

        if (firstClockIn) patch.firstClockIn = firstClockIn;
        else if (corr.fieldToCorrect === 'firstClockIn') {
          patch.firstClockIn = parseTimeStr(record.workDate, corr.proposedValue) || corr.proposedValue;
        }

        if (lastClockOut) patch.lastClockOut = lastClockOut;
        else if (corr.fieldToCorrect === 'lastClockOut') {
          patch.lastClockOut = parseTimeStr(record.workDate, corr.proposedValue) || corr.proposedValue;
        }

        const effectiveFirstIn = patch.firstClockIn || record.firstClockIn;
        const effectiveLastOut = patch.lastClockOut || record.lastClockOut;

        if (effectiveFirstIn && effectiveLastOut) {
          const sMs = new Date(effectiveFirstIn).getTime();
          const eMs = new Date(effectiveLastOut).getTime();
          if (!isNaN(sMs) && !isNaN(eMs) && eMs > sMs) {
            patch.totalWorkingMinutes = Math.round((eMs - sMs) / (1000 * 60));
          }
        }
        if (!patch.totalWorkingMinutes) {
          patch.totalWorkingMinutes = record.totalWorkingMinutes || 480;
        }

        const sessionNotes = corr.reason || (record as any).notes || 'Re-approved session';
        const updatedSession: WorkSession = {
          id: record.sessions?.[0]?.id || this.uuid(),
          workType,
          clockIn: effectiveFirstIn || record.firstClockIn || record.workDate || nowIso(),
          clockOut: effectiveLastOut || record.lastClockOut,
          notes: sessionNotes,
        };
        (updatedSession as any).isReapproved = true;

        patch.sessions = [updatedSession, ...(record.sessions?.slice(1) || [])];
        await this.repo.update(record.id, patch, actor);
      }

      await supabase
        .from('flwdsk_attendance_corrections')
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
      return Err(AppError.internal((e as any)?.message));
    }
  }

  async rejectCorrection(correctionId: UUID, actor: Actor, notes?: string): Promise<Result<void>> {
    try {
      await supabase
        .from('flwdsk_attendance_corrections')
        .update({
          status: 'rejected',
          approver_id: actor.id,
          approver_notes: notes || null,
          updated_at: nowIso(),
        })
        .eq('id', correctionId);

      this.corrections.delete(correctionId);
      return Ok(undefined);
    } catch (e) {
      console.error('Failed to reject attendance correction:', e);
      return Err(AppError.internal((e as any)?.message));
    }
  }
}
