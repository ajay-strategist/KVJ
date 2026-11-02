/**
 * Probation Period Calculations and Utilities
 * Implements approved stakeholder decisions EMP-Q01, DISC-001, and Rule BR-EMP-002.
 * 
 * Rules:
 * 1. probation_end_date is the sole authoritative stored column in the database.
 * 2. probation_duration is dynamically calculated in code from date_of_joining and probation_end_date.
 * 3. Fractional months are supported and displayed to 1 decimal place without mutating the stored date.
 * 4. probation_completion_date is the calendar day immediately following probation_end_date.
 * 5. leave_accrual_start_date coincides with probation_completion_date.
 */

/**
 * Calculates the exact dynamic probation duration in months between date_of_joining and probation_end_date.
 * Uses calendar month stepping + fractional bridging days.
 */
export function calculateProbationDuration(dateOfJoiningStr: string, probationEndDateStr: string): number {
  if (!dateOfJoiningStr || !probationEndDateStr) return 0;

  const joinDate = new Date(dateOfJoiningStr + 'T00:00:00Z');
  const endDate = new Date(probationEndDateStr + 'T00:00:00Z');

  if (isNaN(joinDate.getTime()) || isNaN(endDate.getTime())) return 0;
  if (endDate < joinDate) return 0;

  let totalMonths = (endDate.getUTCFullYear() - joinDate.getUTCFullYear()) * 12 + (endDate.getUTCMonth() - joinDate.getUTCMonth());
  let dayDiff = endDate.getUTCDate() - joinDate.getUTCDate() + 1; // Inclusive of end date

  if (dayDiff < 0) {
    totalMonths -= 1;
    // Days in previous month relative to endDate
    const prevMonthDays = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 0)).getUTCDate();
    dayDiff += prevMonthDays;
  }

  // Bridging month total days
  const daysInBridgingMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0)).getUTCDate();
  const fractionalMonth = dayDiff / daysInBridgingMonth;

  const duration = Math.max(0, totalMonths + fractionalMonth);
  // Round to 1 decimal place
  return Math.round(duration * 10) / 10;
}

/**
 * Formats duration in months with 1 decimal place and 'months' suffix.
 */
export function formatProbationDuration(months: number): string {
  if (typeof months !== 'number' || isNaN(months) || months <= 0) return '0.0 months';
  return `${months.toFixed(1)} months`;
}

/**
 * Returns the probation completion date (the calendar day immediately following probation_end_date).
 * This also represents the leave_accrual_start_date.
 */
export function getProbationCompletionDate(probationEndDateStr: string): string | null {
  if (!probationEndDateStr) return null;
  const endDate = new Date(probationEndDateStr + 'T00:00:00Z');
  if (isNaN(endDate.getTime())) return null;

  // Add 1 calendar day
  const completionDate = new Date(endDate.getTime() + 24 * 3600 * 1000);
  return completionDate.toISOString().slice(0, 10);
}

/**
 * Checks whether an employee is actively on probation as of a given date (defaults to today).
 */
export function isProbationActive(probationEndDateStr?: string | null, asOfDateStr?: string): boolean {
  if (!probationEndDateStr) return false;
  const asOf = asOfDateStr || new Date().toISOString().slice(0, 10);
  return asOf <= probationEndDateStr;
}

