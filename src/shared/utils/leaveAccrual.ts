/**
 * Leave Accrual & Balance Calculation Utilities
 * Enforces Rule BR-LEAVE-011 and EMP-Q01.
 * 
 * Rules:
 * 1. Accrual is based strictly on active completed service tenure within the Financial Year (April 1 to March 31).
 * 2. Does NOT award unearned leave from April 1 to employees who joined later in the year or who are on probation.
 * 3. Incorporates date_of_joining and probation_end_date.
 */

export interface CalculateLeaveAllocationParams {
  dateOfJoining?: string | null;
  probationEndDate?: string | null;
  allocationPerMonth?: number;
  asOfDate?: string; // YYYY-MM-DD
}

/**
 * Calculates the total allocated leave days earned for the current financial year.
 */
export function calculateEarnedLeaveAllocation(params: CalculateLeaveAllocationParams): number {
  const {
    dateOfJoining,
    probationEndDate,
    allocationPerMonth = 1,
    asOfDate = new Date().toISOString().slice(0, 10),
  } = params;

  if (allocationPerMonth <= 0) return 0;

  const asOf = new Date(asOfDate + 'T00:00:00Z');
  if (isNaN(asOf.getTime())) return 0;

  // Determine current Financial Year start (April 1)
  const asOfYear = asOf.getUTCFullYear();
  const asOfMonth = asOf.getUTCMonth(); // 0-indexed: April = 3
  const fyStartYear = asOfMonth >= 3 ? asOfYear : asOfYear - 1;
  const fyStartDate = new Date(Date.UTC(fyStartYear, 3, 1)); // April 1

  // Determine effective eligibility start date
  let effectiveStartDate = fyStartDate;

  if (dateOfJoining) {
    const joinDate = new Date(dateOfJoining + 'T00:00:00Z');
    if (!isNaN(joinDate.getTime()) && joinDate > effectiveStartDate) {
      effectiveStartDate = joinDate;
    }
  }

  // If probation end date is set, leave accrual starts the day after probation completes
  if (probationEndDate) {
    const probEnd = new Date(probationEndDate + 'T00:00:00Z');
    if (!isNaN(probEnd.getTime())) {
      const probCompletion = new Date(probEnd.getTime() + 24 * 3600 * 1000);
      if (probCompletion > effectiveStartDate) {
        effectiveStartDate = probCompletion;
      }
    }
  }

  // If effective start date is in the future relative to asOfDate, 0 leaves earned
  if (effectiveStartDate > asOf) {
    return 0;
  }

  // Calculate elapsed months between effectiveStartDate and asOfDate
  const startYear = effectiveStartDate.getUTCFullYear();
  const startMonth = effectiveStartDate.getUTCMonth();
  const endYear = asOf.getUTCFullYear();
  const endMonth = asOf.getUTCMonth();

  let months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

  // Cap at maximum 12 months for the FY
  months = Math.max(0, Math.min(12, months));

  return months * allocationPerMonth;
}

