/**
 * KVJ Analytics — BUSINESS RULE DEFAULTS  ⚠️ CONFIRM WITH KVJ
 * =============================================================================
 * Per the Master Context (Prompt 1): business rules must NOT be invented.
 * This file collects EVERY placeholder default in ONE place so KVJ can review
 * and override. Each value is flagged // CONFIRM. Engines read from here — no
 * business number is hardcoded anywhere else. In Phase 2 these move into the
 * editable Organization Settings (Supabase) so admins change them without code.
 *
 * Nothing here is a final KVJ policy. These are safe, documented starting values
 * that let the configurable engines be built now (per approved decision:
 * "Build engines with documented defaults, confirm later").
 * =============================================================================
 */

export const businessRules = {
  // ── Authentication & session (Prompt 5 / Prompt 11) ───────────────────────
  auth: {
    sessionTimeoutMinutes: 60,            // CONFIRM idle timeout
    rememberMeDays: 30,                   // CONFIRM
    maxFailedLoginAttempts: 5,            // CONFIRM before lock
    accountLockMinutes: 15,               // CONFIRM lock duration
    passwordResetTokenExpiryMinutes: 30,  // CONFIRM
    passwordPolicy: {
      minLength: 8,                       // CONFIRM
      requireUppercase: true,
      requireNumber: true,
      requireSymbol: true,
    },
  },

  // ── Attendance & work sessions (Prompt 5) ─────────────────────────────────
  attendance: {
    workingDays: [1, 2, 3, 4, 5, 6],      // CONFIRM Mon–Sat? (0=Sun..6=Sat)
    workDayStart: '09:30',                // CONFIRM
    workDayEnd: '18:30',                  // CONFIRM
    lateAfter: '09:45',                   // CONFIRM grace → 'Late'
    halfDayMaxHours: 5,                   // CONFIRM ≤ this ⇒ Half Day
    fullDayMinHours: 8,                   // CONFIRM ≥ this ⇒ full 'Present'
    autoClockOutAt: '23:59',              // existing behaviour preserved
    workTypes: ['Office', 'Training', 'Marketing', 'Meeting', 'Work From Home', 'Client Visit', 'Other'],
  },

  // ── Leave (Prompt 5) ──────────────────────────────────────────────────────
  leave: {
    // CONFIRM approval chain. Master context showed: Employee → Manager → HR
    approvalChain: ['ReportingManager', 'HR'],
    // CONFIRM annual entitlements (days/year) per type
    entitlements: {
      Casual: 12, Sick: 8, Earned: 15, Compensatory: 0,
      Maternity: 182, Paternity: 15, LossOfPay: 0, WorkFromHome: 0,
    } as Record<string, number>,
    medicalCertRequiredAfterDays: 2,      // CONFIRM
  },

  // ── Training eligibility engine (Prompt 6) ────────────────────────────────
  eligibility: {
    minAttendancePct: 75,                 // CONFIRM
    minAssessmentPct: 40,                 // CONFIRM
    finalExamRequired: true,              // CONFIRM
    allowManualOverride: true,            // every override is audited
  },

  // ── Voucher engine (Prompt 6) ─────────────────────────────────────────────
  voucher: {
    // CONFIRM: one voucher per eligible student? expiry window?
    perEligibleStudent: 1,
    expiryDays: 180,                      // CONFIRM
  },

  // ── Referral program (Prompt 6) ───────────────────────────────────────────
  referral: {
    rewardPercentOfCourseFee: 10,         // CONFIRM (master context default = 10%)
    codeLength: 8,
    rewardStages: ['Invited', 'Registered', 'Joined', 'PaymentConfirmed', 'RewardEarned'],
  },

  // ── Finance: travel / per-diem / expense (Prompt 8) ───────────────────────
  finance: {
    currency: 'INR',                      // CONFIRM
    kmReimbursement: { Car: 12, Bike: 5 },// CONFIRM ₹ per km by vehicle
    perDiem: { local: 0, outstation: 500 }, // CONFIRM ₹ per day
    // CONFIRM expense approval chain. Master context: Manager → Finance
    expenseApprovalChain: ['ReportingManager', 'Finance'],
    gstDefaultPercent: 18,                // CONFIRM (optional on expenses)
  },

  // ── Task approval (Prompt 7) ──────────────────────────────────────────────
  task: {
    // CONFIRM: Manager step optional?
    approvalChain: ['Supervisor'],        // + optional 'Manager'
    managerApprovalOptional: true,
  },

  // ── Project health thresholds (Prompt 7) ──────────────────────────────────
  projectHealth: {
    atRiskIfOverduePct: 25,               // CONFIRM % tasks overdue ⇒ At Risk
    delayedIfPastTargetDays: 0,           // CONFIRM
  },

  // ── Platform-wide defaults ────────────────────────────────────────────────
  platform: {
    defaultPageSize: 20,
    maxPageSize: 200,
    maxUploadMb: { receipt: 5, document: 10, photo: 5 }, // CONFIRM
  },
} as const;

export type BusinessRules = typeof businessRules;
