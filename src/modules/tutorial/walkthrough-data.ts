/**
 * FlowDesk — Gamified Guided Walkthrough Data Definitions
 *
 * Defines interactive, game-style step-by-step tours for each functional module.
 * Targets actual application DOM elements with contextual spotlight highlights and tips.
 */

export interface WalkthroughStep {
  targetSelector: string; // CSS selector or data-tutorial attribute
  title: string;
  description: string;
  actionHint: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  roleScope?: ('ALL' | 'EMPLOYEE' | 'SUPERVISOR' | 'ADMIN')[];
}

export interface WalkthroughTour {
  id: string;
  moduleKey: string;
  title: string;
  badgeName: string;
  xpReward: number;
  steps: WalkthroughStep[];
}

export const WALKTHROUGH_TOURS: Record<string, WalkthroughTour> = {
  'my-day': {
    id: 'my-day',
    moduleKey: 'my-day',
    title: 'My Day Cockpit Guided Tour',
    badgeName: 'Daily Operations Ace',
    xpReward: 100,
    steps: [
      {
        targetSelector: '#attendance-control-panel, .attendance-control-panel, [data-tutorial="clock-in-panel"]',
        title: 'Step 1: Attendance Control Panel',
        description: 'Start your official workday by clocking in. Select Office, Training, Remote (WFH), or Travel with automated GPS coordinates check.',
        actionHint: 'Click "Clock In" to begin your shift or switch modes.',
        position: 'bottom',
      },
      {
        targetSelector: '#today-tasks-section, .today-tasks, [data-tutorial="tasks-list"]',
        title: 'Step 2: Real-time Task Execution',
        description: 'View tasks assigned for today. Click Start to launch the active live task timer and track project-level hours seamlessly.',
        actionHint: 'Hit "Start" on any task to begin active work duration tracking.',
        position: 'top',
      },
      {
        targetSelector: '#break-control-btn, .break-controls, [data-tutorial="break-btn"]',
        title: 'Step 3: Official Break Tracking',
        description: 'Need a tea or lunch break? Start an official break to ensure accurate deductions from your gross working hours.',
        actionHint: 'Click "Start Official Break" when stepping away from tasks.',
        position: 'bottom',
      },
      {
        targetSelector: '#submit-attendance-btn, .submit-attendance, [data-tutorial="submit-day"]',
        title: 'Step 4: End-of-Day Review & Submission',
        description: 'At the end of your day, review your total working hours, breaks taken, and submit your daily work log for supervisor review.',
        actionHint: 'Click "Submit Attendance" when your workday is complete.',
        position: 'left',
      },
    ],
  },

  'attendance': {
    id: 'attendance',
    moduleKey: 'attendance',
    title: 'Attendance Log & Verification Tour',
    badgeName: 'Attendance Master',
    xpReward: 75,
    steps: [
      {
        targetSelector: '#attendance-table, .attendance-table, table',
        title: 'Step 1: Attendance Records Table',
        description: 'Chronological timeline of your daily attendance punch-in, punch-out, gross duration, and break records.',
        actionHint: 'Review your logged attendance days and statuses.',
        position: 'top',
      },
      {
        targetSelector: '#attendance-correction-btn, [data-tutorial="correction-btn"]',
        title: 'Step 2: Missing Punch Corrections',
        description: 'Forgot to clock out or had a hardware glitch? Submit an Attendance Correction request for supervisor approval.',
        actionHint: 'Click "Submit Correction" to amend past punches.',
        position: 'bottom',
      },
    ],
  },

  'leave': {
    id: 'leave',
    moduleKey: 'leave',
    title: 'Leave Board & Sandwich Policy Tour',
    badgeName: 'Leave Navigator',
    xpReward: 75,
    steps: [
      {
        targetSelector: '#leave-balance-strip, .leave-balances',
        title: 'Step 1: Leave Balance Balances',
        description: 'View real-time balances for Casual Leave (CL), Sick Leave (SL), and Earned Leave (EL).',
        actionHint: 'Check your available balances before applying.',
        position: 'bottom',
      },
      {
        targetSelector: '#apply-leave-btn, [data-tutorial="apply-leave-btn"]',
        title: 'Step 2: Apply for Leave',
        description: 'Apply for full day or half day leaves. Under company policy, Sundays and Declared Holidays are excluded from deductions (No Sandwich Policy).',
        actionHint: 'Click "Apply for Leave" to submit a new request.',
        position: 'bottom',
      },
    ],
  },

  'batch-management': {
    id: 'batch-management',
    moduleKey: 'batch-management',
    title: 'Training Batch Management Tour',
    badgeName: 'Batch Orchestrator',
    xpReward: 120,
    steps: [
      {
        targetSelector: '#batch-catalog, .batch-cards-grid, table',
        title: 'Step 1: Batch Catalog',
        description: 'Overview of ongoing, upcoming, and completed academic batches with student count, lead trainers, and delivery status.',
        actionHint: 'Select any batch to open detailed student and session tabs.',
        position: 'top',
        roleScope: ['ADMIN', 'SUPERVISOR'],
      },
      {
        targetSelector: '#batch-expense-details-btn, [data-tutorial="batch-expense-btn"]',
        title: 'Step 2: Batch Expense & Workhours Intelligence',
        description: 'Click "Expense Details" on any batch to view total expenses, unit cost per student, merged delivery workhours, and trainer claims.',
        actionHint: 'Open Expense Details for comprehensive financial analytics.',
        position: 'left',
        roleScope: ['ADMIN', 'SUPERVISOR'],
      },
    ],
  },

  'projects-tasks': {
    id: 'projects-tasks',
    moduleKey: 'projects-tasks',
    title: 'Projects & Tasks Operations Tour',
    badgeName: 'Task Commander',
    xpReward: 90,
    steps: [
      {
        targetSelector: '#task-board-container, .task-board, [data-tutorial="task-board"]',
        title: 'Step 1: Kanban Task Board',
        description: 'Visual workflow tracking across Todo, In Progress, Review, and Completed stages with drag-and-drop reordering.',
        actionHint: 'Drag cards across columns to update task progress.',
        position: 'top',
      },
      {
        targetSelector: '#add-new-task-btn, [data-tutorial="add-task-btn"]',
        title: 'Step 2: Create New Task',
        description: 'Create tasks tied to internal projects or client deliverables. Assign team members, deadlines, and estimated hours.',
        actionHint: 'Click "Add Task" to create a work item.',
        position: 'bottom',
      },
    ],
  },

  'expenses': {
    id: 'expenses',
    moduleKey: 'expenses',
    title: 'Expenses & Reimbursements Tour',
    badgeName: 'Finance Guru',
    xpReward: 90,
    steps: [
      {
        targetSelector: '#expense-claims-table, .claims-table, table',
        title: 'Step 1: Expense Claims Ledger',
        description: 'Filterable list of your submitted claims for travel conveyance, meals, accommodation, and training materials.',
        actionHint: 'Track claim status from Submitted to Approved and Disbursed.',
        position: 'top',
      },
      {
        targetSelector: '#new-expense-claim-btn, [data-tutorial="new-expense-btn"]',
        title: 'Step 2: Submit New Expense Claim',
        description: 'Submit claims with receipt image attachments, automated mileage vehicle rates, and optional batch tagging.',
        actionHint: 'Click "New Expense Claim" to submit receipts.',
        position: 'bottom',
      },
    ],
  },
};

