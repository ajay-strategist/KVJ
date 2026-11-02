/**
 * Task Duration Calculation and Formatting Utilities
 * Resolves ISSUE-001: My Day Task Duration Changes After Refresh
 * 
 * Rules:
 * 1. Correctly calculates total task duration by combining historical accumulated work session hours (from database)
 *    with currently running session seconds (from timer store).
 * 2. Formats duration consistently as 'Xh Ym' (e.g. '2h 15m', '0h 45m', '0h 0m').
 * 3. Prevents state divergence on page reload by providing idempotent duration calculations.
 */

export interface CalculateTaskTotalSecondsParams {
  historicalHours?: number; // Accumulated completed sessions from DB
  timerStartTime?: number | null; // Timestamp ms of current running session
  timerElapsedMs?: number; // Any paused elapsed ms in current session
  isRunning?: boolean;
  now?: number; // Current timestamp ms (for testing)
}

/**
 * Calculates the exact total seconds for a task combining historical hours and running timer.
 */
export function calculateTaskTotalSeconds(params: CalculateTaskTotalSecondsParams): number {
  const {
    historicalHours = 0,
    timerStartTime = null,
    timerElapsedMs = 0,
    isRunning = false,
    now = Date.now(),
  } = params;

  const historicalSeconds = Math.max(0, Math.round(historicalHours * 3600));
  let liveSeconds = Math.max(0, Math.floor(timerElapsedMs / 1000));

  if (isRunning && timerStartTime && timerStartTime <= now) {
    liveSeconds += Math.floor((now - timerStartTime) / 1000);
  }

  return historicalSeconds + liveSeconds;
}

/**
 * Formats seconds into consistent 'Xh Ym' format.
 */
export function formatHoursMinutes(totalSeconds: number): string {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds <= 0) {
    return '0h 0m';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return `${hours}h ${minutes}m`;
}

/**
 * Formats historical hours directly into 'Xh Ym'.
 */
export function formatDurationFromHours(hours: number): string {
  return formatHoursMinutes(Math.round((hours || 0) * 3600));
}

