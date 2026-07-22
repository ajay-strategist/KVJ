/**
 * Range-scoped schedule data + conflict detection for the Resource Planner.
 *
 * The planner must NEVER materialize the whole dataset. Every read goes
 * through `fetchScheduleRange`, which only ever produces records for dates
 * inside the requested window. This is the seam that becomes a Supabase query
 * (`.gte('date', from).lte('date', to)`) once the schedule tables exist — the
 * UI does not change when that swap happens.
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
  /** Optional server-side style narrowing. */
  trainerIds?: string[];
}

export interface ScheduleRangeResult {
  sessions: ScheduleSession[];
  leaves: LeaveRequest[];
  holidays: HolidayItem[];
  /** Days actually materialized — surfaced so the UI can prove the scoping. */
  daysLoaded: number;
}

const COLLEGES = ['Christ Irinjalakkuda', 'MIM Kuttikkanam', 'Santhigiri', 'Rajagiri', 'Nehru College', 'Vimala College'];
const COURSES = ['Data Analytics', 'Power BI', 'Excel Expert 365', 'Advanced Excel', 'PL 900', 'Tally & GST'];
const VENUES = ['Lab 402', 'Seminar Hall 1', 'Conference Hall', 'Room 205', 'Main Auditorium', 'Online'];
const COORDINATORS = ['Dr. Meera Nair', 'Prof. Anil Kumar', 'Dr. Sneha Raj', 'Prof. Vinod Menon'];
const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#10b981'];
const SLOTS: Array<[string, string]> = [['09:00', '12:00'], ['10:00', '13:00'], ['13:30', '16:30'], ['14:00', '17:00']];

/** Stable hash so the same date+trainer always yields the same schedule. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
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
 * Fetch ONLY the requested window. Nothing outside [from, to] is generated,
 * so widening the range is the only way to increase the row count.
 */
export async function fetchScheduleRange(
  q: ScheduleRangeQuery,
  trainerIds: string[],
): Promise<ScheduleRangeResult> {
  const dates = eachDate(q.from, q.to);
  const ids = q.trainerIds?.length ? q.trainerIds : trainerIds;

  const sessions: ScheduleSession[] = [];
  const leaves: LeaveRequest[] = [];
  const holidays: HolidayItem[] = [];

  for (const date of dates) {
    const dow = new Date(`${date}T00:00:00`).getDay();

    // Sundays are the standing non-working day.
    if (dow === 0) {
      holidays.push({ id: `h-${date}`, date, name: 'Sunday', type: 'Company' });
      continue;
    }
    // A sprinkling of declared holidays.
    if (hash(`hol${date}`) % 23 === 0) {
      holidays.push({ id: `h-${date}`, date, name: 'Declared Holiday', type: 'Regional' });
    }

    for (const trainerId of ids) {
      const seed = hash(`${date}:${trainerId}`);

      // ~15% of trainer-days are leave.
      if (seed % 7 === 0) {
        leaves.push({
          id: `l-${date}-${trainerId}`,
          trainerId,
          date,
          type: (['Medical', 'Emergency', 'Casual'] as const)[seed % 3],
          duration: (['Full Day', 'Half Day Morning', 'Half Day Afternoon'] as const)[seed % 3],
          status: seed % 2 === 0 ? 'Approved' : 'Pending',
        });
      }

      // ~60% of trainer-days carry a session; ~1 in 9 gets a second,
      // deliberately overlapping one so conflicts are exercised.
      if (seed % 5 < 3) {
        const makeSession = (n: number): ScheduleSession => {
          const s = hash(`${date}:${trainerId}:${n}`);
          const [startTime, endTime] = SLOTS[n === 0 ? s % 2 : (s % 2)]; // overlapping morning slots
          const college = COLLEGES[s % COLLEGES.length];
          const course = COURSES[s % COURSES.length];
          return {
            id: `s-${date}-${trainerId}-${n}`,
            trainerId,
            date,
            name: `${college.split(' ')[0]} ${course}`,
            batchCode: `${college.split(' ')[0].toUpperCase().slice(0, 6)}-B${(s % 4) + 1}`,
            college,
            course,
            academicYear: '2026-2027',
            coordinator: COORDINATORS[s % COORDINATORS.length],
            startTime,
            endTime,
            venue: VENUES[s % VENUES.length],
            mode: s % 4 === 0 ? 'Online' : 'Offline',
            studentCount: 25 + (s % 45),
            status: 'Scheduled',
            color: COLORS[s % COLORS.length],
          };
        };
        sessions.push(makeSession(0));
        if (seed % 9 === 0) sessions.push(makeSession(1));
      }
    }
  }

  return { sessions, leaves, holidays, daysLoaded: dates.length };
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

/**
 * Detect conflicts across the loaded window only. Sessions are bucketed by
 * trainer+date and by venue+date so this stays linear in the number of
 * sessions rather than quadratic across the whole range.
 */
export function detectConflicts(
  data: ScheduleRangeResult,
  trainerName: (id: string) => string,
): ScheduleConflict[] {
  const out: ScheduleConflict[] = [];

  const byTrainerDate = new Map<string, ScheduleSession[]>();
  const byVenueDate = new Map<string, ScheduleSession[]>();
  for (const s of data.sessions) {
    const k1 = `${s.trainerId}|${s.date}`;
    (byTrainerDate.get(k1) ?? byTrainerDate.set(k1, []).get(k1)!).push(s);
    if (s.venue !== 'Online') {
      const k2 = `${s.venue}|${s.date}`;
      (byVenueDate.get(k2) ?? byVenueDate.set(k2, []).get(k2)!).push(s);
    }
  }

  const leaveIdx = new Map(data.leaves.map((l) => [`${l.trainerId}|${l.date}`, l]));
  const holidayIdx = new Map(data.holidays.map((h) => [h.date, h]));

  for (const [key, list] of byTrainerDate) {
    const [trainerId, date] = key.split('|');
    const name = trainerName(trainerId);

    // Double booking — overlapping sessions for the same trainer.
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (!overlaps(list[i], list[j])) continue;
        out.push({
          id: `c-db-${list[i].id}-${list[j].id}`,
          trainerId, trainerName: name, date,
          time: `${list[i].startTime}–${list[i].endTime} vs ${list[j].startTime}–${list[j].endTime}`,
          batches: [list[i].batchCode, list[j].batchCode],
          type: 'Double Booking', severity: 'High', status: 'Open',
          detail: `${name} is booked for "${list[i].name}" and "${list[j].name}" at the same time.`,
        });
      }
    }

    // Leave conflict — scheduled while on approved/pending leave.
    const lv = leaveIdx.get(key);
    if (lv) {
      out.push({
        id: `c-lv-${key}`,
        trainerId, trainerName: name, date,
        time: list.map((s) => `${s.startTime}–${s.endTime}`).join(', '),
        batches: list.map((s) => s.batchCode),
        type: 'Leave Conflict', severity: 'High', status: 'Open',
        detail: `${name} has ${lv.duration} ${lv.type} leave (${lv.status}) but is scheduled to train.`,
      });
    }

    // Holiday conflict — scheduled on a declared holiday.
    const hol = holidayIdx.get(date);
    if (hol) {
      out.push({
        id: `c-hol-${key}`,
        trainerId, trainerName: name, date,
        time: list.map((s) => `${s.startTime}–${s.endTime}`).join(', '),
        batches: list.map((s) => s.batchCode),
        type: 'Holiday Conflict', severity: 'Medium', status: 'Open',
        detail: `Sessions scheduled on ${hol.name}.`,
      });
    }
  }

  // Venue conflict — two different trainers in one room at once.
  for (const [key, list] of byVenueDate) {
    const [venue, date] = key.split('|');
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].trainerId === list[j].trainerId) continue;
        if (!overlaps(list[i], list[j])) continue;
        out.push({
          id: `c-vn-${list[i].id}-${list[j].id}`,
          trainerId: list[i].trainerId,
          trainerName: `${trainerName(list[i].trainerId)} / ${trainerName(list[j].trainerId)}`,
          date,
          time: `${list[i].startTime}–${list[i].endTime}`,
          batches: [list[i].batchCode, list[j].batchCode],
          type: 'Venue Conflict', severity: 'Low', status: 'Open',
          detail: `${venue} is double-booked by two trainers.`,
        });
      }
    }
  }

  return out;
}

// ── Date range presets ───────────────────────────────────────────────────────

export type PresetId = 'today' | 'this_week' | 'next_7' | 'next_15' | 'current_month' | 'next_month' | 'custom';

export const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This Week' },
  { id: 'next_7', label: 'Next 7 Days' },
  { id: 'next_15', label: 'Next 15 Days' },
  { id: 'current_month', label: 'Current Month' },
  { id: 'next_month', label: 'Next Month' },
  { id: 'custom', label: 'Custom Range' },
];

export function presetRange(id: PresetId, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const at = (yy: number, mm: number, dd: number) => toLocalISODate(new Date(yy, mm, dd));

  switch (id) {
    case 'today':
      return { from: at(y, m, d), to: at(y, m, d) };
    case 'this_week': {
      const start = d - now.getDay();          // Sunday-based week
      return { from: at(y, m, start), to: at(y, m, start + 6) };
    }
    case 'next_7':
      return { from: at(y, m, d), to: at(y, m, d + 6) };
    case 'next_15':
      return { from: at(y, m, d), to: at(y, m, d + 14) };
    case 'next_month':
      return { from: at(y, m + 1, 1), to: at(y, m + 2, 0) };
    case 'current_month':
    default:
      return { from: at(y, m, 1), to: at(y, m + 1, 0) };
  }
}
