export type LeaveShiftType = 'Full Day' | 'Morning Half Day' | 'Afternoon Half Day';

/**
 * Calculates net working days between start and end date under KVJ's No-Sandwich Policy.
 * - Saturday is a regular working day for the company (NOT a holiday).
 * - Holidays are Sunday (0) and Declared Holidays.
 * - Sundays and Declared Holidays are excluded from leave deduction.
 */
export function calculateWorkingDays(
  startDate: string,
  endDate: string,
  shift: LeaveShiftType,
  declaredHolidays?: Set<string> | string[]
): number {
  if (shift === 'Morning Half Day' || shift === 'Afternoon Half Day') {
    return 0.5;
  }
  if (!startDate || !endDate) return 0;
  const [sY, sM, sD] = startDate.split('-').map(Number);
  const [eY, eM, eD] = endDate.split('-').map(Number);
  if (!sY || !sM || !sD || !eY || !eM || !eD) return 0;

  const start = new Date(sY, sM - 1, sD);
  const end = new Date(eY, eM - 1, eD);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

  const holSet = declaredHolidays instanceof Set
    ? declaredHolidays
    : new Set(declaredHolidays || []);

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;

    // Sundays (0) and Declared Holidays are excluded. Saturday (6) is a regular working day.
    const isSunday = day === 0;
    const isDeclaredHoliday = holSet.has(isoDate);

    if (!isSunday && !isDeclaredHoliday) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

