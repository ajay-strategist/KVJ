/**
 * Shared metric calculations — the SINGLE source of truth for every derived
 * number shown in the app. Confirmed formulas (do not hardcode these values in
 * components; compute them here):
 *
 *   • Attendance %        = present sessions ÷ total sessions × 100
 *   • Hours this Month    = total clocked work-hours in the current month
 *   • Workflow Completion = checked checklist items ÷ total items (x / N)
 *   • Training Completion % = checklist steps done ÷ total steps × 100
 *   • Assessment Pass %   = passed ÷ attempted × 100
 *   • Assessment Completion % = attempted ÷ total students × 100
 *
 * All functions are PURE and null-safe: an empty/zero input returns 0, never
 * NaN, so an app with no data yet shows "0", not "NaN%".
 */

/** Round to `dp` decimal places (default 0). */
function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Attendance % = present ÷ total × 100. */
export function attendancePercent(present: number, total: number, dp = 0): number {
  if (total <= 0) return 0;
  return round((present / total) * 100, dp);
}

/** Workflow completion as an `x / N` pair from a checklist. */
export function workflowCompletion(items: Array<{ done: boolean }>): { done: number; total: number } {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { done, total };
}

/** Training completion % = checklist steps done ÷ total steps × 100. */
export function trainingCompletionPercent(stepsDone: number, totalSteps: number, dp = 0): number {
  if (totalSteps <= 0) return 0;
  return round((stepsDone / totalSteps) * 100, dp);
}

/** Assessment pass % = passed ÷ attempted × 100. Not-attempted students are excluded. */
export function assessmentPassPercent(passed: number, attempted: number, dp = 0): number {
  if (attempted <= 0) return 0;
  return round((passed / attempted) * 100, dp);
}

/** Assessment completion % = attempted ÷ total students × 100. */
export function assessmentCompletionPercent(attempted: number, totalStudents: number, dp = 0): number {
  if (totalStudents <= 0) return 0;
  return round((attempted / totalStudents) * 100, dp);
}

/** Milliseconds → decimal hours (e.g. 1.5 = 1h 30m). */
export function msToHours(ms: number, dp = 1): number {
  if (ms <= 0) return 0;
  return round(ms / 3_600_000, dp);
}

/** True when `iso` (YYYY-MM-DD or ISO timestamp) falls in the given month. */
export function isSameMonth(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

/**
 * Total clocked work-hours in the current month.
 * Sums `totalWorkingMinutes` on each attendance record whose work date is in
 * the reference month. (One record per employee per day.)
 */
export function hoursThisMonth(
  records: Array<{ workDate: string; totalWorkingMinutes?: number }>,
  ref = new Date(),
  dp = 1,
): number {
  const mins = records
    .filter((r) => isSameMonth(r.workDate, ref))
    .reduce((sum, r) => sum + (r.totalWorkingMinutes ?? 0), 0);
  return round(mins / 60, dp);
}

/**
 * Attendance % for a set of daily session-attendance rows.
 * `present` counts statuses that mean the student showed up (present or late).
 */
export function sessionAttendancePercent(
  rows: Array<{ status: 'present' | 'absent' | 'late' | 'leave' }>,
  dp = 0,
): number {
  const total = rows.filter((r) => r.status !== 'leave').length; // leave doesn't count against attendance
  const present = rows.filter((r) => r.status === 'present' || r.status === 'late').length;
  return attendancePercent(present, total, dp);
}
