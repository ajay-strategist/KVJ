/**
 * Range-scoped schedule data + conflict detection for the Resource Planner.
 */

import { toLocalISODate } from '../../shared/utils/date';

export interface ScheduleSession {
  id: string;
  trainerId: string;
  date: string;          // YYYY-MM-DD
  name: string;
  batchCode: string;
  college: string;
  course: string;
  academicYear: string;
  coordinator: string;
  startTime: string;     // HH:mm
  endTime: string;       // HH:mm
  venue: string;
  mode: 'Online' | 'Offline';
  studentCount: number;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  color: string;
}

export interface LeaveRequest {
  id: string;
  trainerId: string;
  date: string;
  type: 'Medical' | 'Emergency' | 'Casual';
  duration: 'Full Day' | 'Half Day Morning' | 'Half Day Afternoon';
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface HolidayItem {
  id: string;
  date: string;
  name: string;
  type: 'National' | 'Regional' | 'Company' | 'Training';
}

export interface ScheduleRangeQuery {
  from: string;
  to: string;
  trainerIds?: string[];
}

export interface ScheduleRangeResult {
  sessions: ScheduleSession[];
  leaves: LeaveRequest[];
  holidays: HolidayItem[];
  daysLoaded: number;
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    out.push(toLocalISODate(d));
  }
  return out;
}

/**
 * Clean production range fetcher. Initial dataset starts fresh without mock sessions.
 */
export async function fetchScheduleRange(
  q: ScheduleRangeQuery,
  _trainerIds: string[],
): Promise<ScheduleRangeResult> {
  const dates = eachDate(q.from, q.to);
  const holidays: HolidayItem[] = [];

  for (const date of dates) {
    const dow = new Date(`${date}T00:00:00`).getDay();
    if (dow === 0) {
      holidays.push({ id: `h-${date}`, date, name: 'Sunday', type: 'Company' });
    }
  }

  return { sessions: [], leaves: [], holidays, daysLoaded: dates.length };
}

// ── Conflict engine ──────────────────────────────────────────────────────────

export type ConflictType = 'Double Booking' | 'Leave Conflict' | 'Holiday Conflict' | 'Venue Conflict';
export type ConflictSeverity = 'High' | 'Medium' | 'Low';
export type ConflictStatus = 'Open' | 'Resolved' | 'Ignored';

export interface ScheduleConflict {
  id: string;
  trainerId: string;
  trainerName: string;
  date: string;
  time: string;
  batches: string[];
  type: ConflictType;
  severity: ConflictSeverity;
  status: ConflictStatus;
  detail: string;
}

export const CONFLICT_META: Record<ConflictType, { icon: string; severity: ConflictSeverity }> = {
  'Double Booking': { icon: '🔴', severity: 'High' },
  'Leave Conflict': { icon: '🟠', severity: 'High' },
  'Holiday Conflict': { icon: '🟡', severity: 'Medium' },
  'Venue Conflict': { icon: '🔵', severity: 'Low' },
};

const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const overlaps = (a: ScheduleSession, b: ScheduleSession) =>
  mins(a.startTime) < mins(b.endTime) && mins(b.startTime) < mins(a.endTime);

export function detectConflicts(
  sessions: ScheduleSession[],
  leaves: LeaveRequest[],
  holidays: HolidayItem[],
  trainers: Array<{ id: string; name: string }>,
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const trainerMap = new Map(trainers.map((t) => [t.id, t.name]));

  // 1. Double Booking & Venue Conflicts
  const byDate = new Map<string, ScheduleSession[]>();
  for (const s of sessions) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }

  for (const [date, daySessions] of byDate.entries()) {
    for (let i = 0; i < daySessions.length; i++) {
      for (let j = i + 1; j < daySessions.length; j++) {
        const a = daySessions[i];
        const b = daySessions[j];
        if (overlaps(a, b)) {
          if (a.trainerId === b.trainerId) {
            conflicts.push({
              id: `c-db-${a.id}-${b.id}`,
              trainerId: a.trainerId,
              trainerName: trainerMap.get(a.trainerId) ?? a.trainerId,
              date,
              time: `${a.startTime}-${a.endTime} / ${b.startTime}-${b.endTime}`,
              batches: [a.batchCode, b.batchCode],
              type: 'Double Booking',
              severity: 'High',
              status: 'Open',
              detail: `Trainer assigned to ${a.batchCode} and ${b.batchCode} during overlapping hours.`,
            });
          } else if (a.venue && b.venue && a.venue === b.venue && a.venue !== 'Online') {
            conflicts.push({
              id: `c-vc-${a.id}-${b.id}`,
              trainerId: a.trainerId,
              trainerName: trainerMap.get(a.trainerId) ?? a.trainerId,
              date,
              time: `${a.startTime}-${a.endTime}`,
              batches: [a.batchCode, b.batchCode],
              type: 'Venue Conflict',
              severity: 'Low',
              status: 'Open',
              detail: `Venue ${a.venue} double booked for ${a.batchCode} and ${b.batchCode}.`,
            });
          }
        }
      }
    }
  }

  // 2. Leave Conflicts
  for (const l of leaves) {
    if (l.status === 'Rejected') continue;
    const trainerSessions = sessions.filter((s) => s.trainerId === l.trainerId && s.date === l.date);
    for (const s of trainerSessions) {
      conflicts.push({
        id: `c-lc-${l.id}-${s.id}`,
        trainerId: s.trainerId,
        trainerName: trainerMap.get(s.trainerId) ?? s.trainerId,
        date: s.date,
        time: `${s.startTime}-${s.endTime}`,
        batches: [s.batchCode],
        type: 'Leave Conflict',
        severity: 'High',
        status: 'Open',
        detail: `Session scheduled while trainer is on ${l.duration} ${l.type} Leave.`,
      });
    }
  }

  // 3. Holiday Conflicts
  const holDates = new Set(holidays.map((h) => h.date));
  for (const s of sessions) {
    if (holDates.has(s.date)) {
      conflicts.push({
        id: `c-hc-${s.id}`,
        trainerId: s.trainerId,
        trainerName: trainerMap.get(s.trainerId) ?? s.trainerId,
        date: s.date,
        time: `${s.startTime}-${s.endTime}`,
        batches: [s.batchCode],
        type: 'Holiday Conflict',
        severity: 'Medium',
        status: 'Open',
        detail: `Session scheduled on a declared non-working holiday (${s.date}).`,
      });
    }
  }

  return conflicts;
}

export type PresetId = 'current_month' | 'next_month' | 'next_90_days' | 'custom';

export const PRESETS: Record<Exclude<PresetId, 'custom'>, { label: string; range: () => { from: string; to: string } }> = {
  current_month: {
    label: 'Current Month',
    range: () => {
      const n = new Date();
      const first = new Date(n.getFullYear(), n.getMonth(), 1);
      const last = new Date(n.getFullYear(), n.getMonth() + 1, 0);
      return { from: toLocalISODate(first), to: toLocalISODate(last) };
    },
  },
  next_month: {
    label: 'Next Month',
    range: () => {
      const n = new Date();
      const first = new Date(n.getFullYear(), n.getMonth() + 1, 1);
      const last = new Date(n.getFullYear(), n.getMonth() + 2, 0);
      return { from: toLocalISODate(first), to: toLocalISODate(last) };
    },
  },
  next_90_days: {
    label: 'Next 90 Days',
    range: () => {
      const n = new Date();
      const to = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 90);
      return { from: toLocalISODate(n), to: toLocalISODate(to) };
    },
  },
};

export function presetRange(id: PresetId): { from: string; to: string } {
  if (id === 'custom') return PRESETS.current_month.range();
  return PRESETS[id]?.range() ?? PRESETS.current_month.range();
}
