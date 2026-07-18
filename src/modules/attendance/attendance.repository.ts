import type { IRepository } from '../../core/repository';
import type { Entity, UUID, DateRange, GeoPoint } from '../../core/types';
import { createToken } from '../../core/registry';

export type AttendanceStatus = 'present' | 'on_break' | 'clocked_out' | 'absent';
export type WorkSessionType = 'Office' | 'Training' | 'Marketing' | 'Meeting' | 'Work From Home' | 'Client Visit' | 'Other';

export interface WorkSession {
  id: UUID;
  clockIn: string;
  clockOut?: string;
  workType: WorkSessionType;
  notes?: string;
  clockInGeo?: GeoPoint;
  clockOutGeo?: GeoPoint;
}

export interface BreakRecord {
  id: UUID;
  workSessionId: UUID;
  startTime: string;
  endTime?: string;
  reason?: string;
}

export interface AttendanceRecord extends Entity {
  employeeId: UUID;
  workDate: string; // 'YYYY-MM-DD'
  status: AttendanceStatus;
  firstClockIn?: string;
  lastClockOut?: string;
  totalWorkingMinutes: number;
  totalBreakMinutes: number;
  sessions?: WorkSession[];
  breaks?: BreakRecord[];
}

export interface IAttendanceRepository extends IRepository<AttendanceRecord> {
  findActiveRecord(employeeId: UUID, dateStr: string): Promise<AttendanceRecord | null>;
  findHistory(employeeId: UUID, range: DateRange): Promise<AttendanceRecord[]>;
}

export const ATTENDANCE_REPOSITORY_TOKEN = createToken<IAttendanceRepository>('AttendanceRepository');
