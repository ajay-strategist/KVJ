export interface TutorialField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

export interface TutorialWorkflow {
  id: string;
  title: string;
  summary: string;
  whoCanUse: string[];
  prerequisites?: string[];
  steps: string[];
  fields?: TutorialField[];
  validationRules?: string[];
  commonErrors?: { error: string; cause: string; solution: string }[];
  proTips?: string[];
  simulationKey?: string;
}

export interface TutorialItem {
  id: string;
  tabKey: string;
  title: string;
  module: 'Daily Operations' | 'Employee Management' | 'Attendance & Shifts' | 'Training & Academics' | 'Projects & Tasks' | 'Finance & Travel' | 'Governance & Approvals' | 'Communication & Support' | 'Executive & BI';
  route: string;
  summary: string;
  rolesAllowed: ('ALL' | 'EMPLOYEE' | 'SUPERVISOR' | 'MANAGER' | 'ADMIN' | 'CEO')[];
  icon: string;
  whereToFind: string;
  workflows: TutorialWorkflow[];
  faq: { q: string; a: string }[];
}

export const TUTORIAL_MODULES: TutorialItem[] = [
  // ── 1. MY DAY ─────────────────────────────────────────────────────────────
  {
    id: 'my-day',
    tabKey: 'my-day',
    title: 'My Day — Attendance Clock In, Breaks & Task Execution',
    module: 'Daily Operations',
    route: '/app',
    icon: 'Home',
    whereToFind: 'Sidebar → My Day (Default landing page)',
    rolesAllowed: ['ALL'],
    summary: 'Central personal cockpit for managing daily attendance, GPS clock-in (Office, Training, Remote, Travel), taking breaks, running task timers, and submitting daily work progress.',
    workflows: [
      {
        id: 'clock-in',
        title: 'How to Clock In for the Day (Office, Training, Remote, Travel)',
        summary: 'Start your official working hours with GPS location verification and designated work mode.',
        whoCanUse: ['All Employees', 'Trainers', 'Supervisors', 'Managers', 'Admin'],
        prerequisites: [
          'Browser location permissions must be allowed for GPS verification.',
          'If you had an unclosed session from yesterday, clock out from it first.',
        ],
        steps: [
          'Navigate to Sidebar → "My Day".',
          'In the top "Attendance Control Panel", click the green "Clock In (Office / Training)" button.',
          'Select your Attendance Location Mode: "Office", "Training", "Remote", or "Travel".',
          'If "Training" is selected, select your scheduled batch from the dropdown (you can use the search bar to find it quickly).',
          'Verify your GPS verification status displays green "GPS Status: Verified".',
          'Review the Clock In Summary and click the blue "Confirm Clock In" button.',
        ],
        fields: [
          { name: 'mode', label: 'Attendance Mode', type: 'Choice', required: true, description: 'Office, Training, Remote (WFH), or Travel', example: 'Training' },
          { name: 'batch', label: 'Select Training Batch', type: 'Dropdown with Search', required: true, description: 'Required when mode is Training. Links attendance to batch hours.', example: 'Christ - Christ Teachers - Batch 1' },
          { name: 'gps', label: 'GPS Coordinates', type: 'Auto-detected', required: true, description: 'Browser geolocation verification', example: '9.9842°, 76.2743° (High Accuracy)' },
        ],
        validationRules: [
          'Cannot clock in twice without clocking out first.',
          'If mode is Training, selecting a batch is required.',
          'Clock-in after 09:30 AM is recorded as Late arrival for Office sessions.',
        ],
        commonErrors: [
          {
            error: 'GPS Verification Failed or Denied',
            cause: 'Browser location access was blocked in settings.',
            solution: 'Click the padlock/location icon in your browser URL address bar, allow Location access, and click "Retry GPS".',
          },
          {
            error: 'Unclosed Attendance Session Warning',
            cause: 'You forgot to clock out from a previous working day.',
            solution: 'Click "Clock Out" on the previous day banner or submit an Attendance Correction to close the session.',
          },
        ],
        proTips: [
          'Trainers who clock in for a Training Batch are automatically recognized in training and will NEVER be marked as idle.',
        ],
        simulationKey: 'sim-clock-in',
      },
      {
        id: 'breaks',
        title: 'How to Take Breaks and Resume Work',
        summary: 'Track tea, lunch, and official breaks accurately so they are deducted from gross working hours.',
        whoCanUse: ['All Employees'],
        steps: [
          'While Clocked In, click the amber "Take Break" button in the Attendance Control Panel.',
          'Select break type ("Tea Break", "Lunch Break", or "Personal Break").',
          'When finished, return to My Day and click the green "Resume Work" button.',
        ],
        proTips: [
          'Multiple breaks in a single day are automatically merged and subtracted from your daily gross duration.',
        ],
      },
      {
        id: 'start-task-timer',
        title: 'How to Start a Task Timer and Submit Work',
        summary: 'Run real-time task work sessions and submit work for supervisor review.',
        whoCanUse: ['All Employees'],
        steps: [
          'Scroll to "Today\'s Tasks" on the My Day page.',
          'Find your assigned task and click "▶ Start". The live stopwatch timer begins.',
          'To pause or switch tasks, click "⏸ Pause". A modal appears requiring a brief progress note describing what was accomplished.',
          'When task work is complete, click "📦 Submit". Enter your completion worklog notes and submit for supervisor approval.',
        ],
        simulationKey: 'sim-task-timer',
      },
    ],
    faq: [
      {
        q: 'Why does the app say I am idle if I am working?',
        a: 'If you clocked in for Office mode but did not click "▶ Start" on a task in Today\'s Tasks for >15 minutes, the system marks you as idle. If you are conducting training, always clock in under "Training" mode with your batch selected.',
      },
      {
        q: 'Can I reorder tasks on My Day?',
        a: 'Yes, grab the six-dot grip icon (⋮⋮) on the left of any task card to drag and drop it into your preferred order.',
      },
    ],
  },

  // ── 2. EMPLOYEE STATUS & REAL-TIME MONITORING ────────────────────────────
  {
    id: 'employee-status',
    tabKey: 'employee-status',
    title: 'Employee Status — Live Clock-In & Idle Activity Monitoring',
    module: 'Employee Management',
    route: '/app/employees/status',
    icon: 'Users',
    whereToFind: 'Sidebar → Employee Status',
    rolesAllowed: ['ADMIN', 'CEO', 'MANAGER', 'SUPERVISOR'],
    summary: 'Executive real-time radar showing who is clocked in right now, which task or training batch they are executing, and automatic alerts for employees who have been idle for >15 minutes.',
    workflows: [
      {
        id: 'monitor-live-status',
        title: 'How to Read Employee Status & Training Sessions',
        summary: 'View every employee\'s live status across the company in one place.',
        whoCanUse: ['Admin', 'CEO', 'Manager', 'Supervisor'],
        steps: [
          'Navigate to Sidebar → "Employee Status".',
          'Inspect the "CURRENT STATUS" column: 🟢 Clocked In, ☕ On Break, 🌴 On Leave, or Offline.',
          'Inspect "CURRENT TASK IN PROGRESS": displays active project tasks (📝) or active training batches (🎓 Training: Batch Code).',
          'Notice that trainers conducting batches are displayed with blue 🎓 badges and are excluded from idle alerts.',
        ],
        proTips: [
          'Employees are ordered naturally by numerical EMP ID (EMP-001, EMP-002, EMP-003, EMP-004, EMP-401, etc.).',
          'Relieved and resigned employees are automatically excluded from the live status list.',
        ],
      },
      {
        id: 'manage-idle-alerts',
        title: 'How Idle Alerts and Top-Right Teams Popups Work',
        summary: 'Understand automated idle detection (>15m) and how to dismiss notifications.',
        whoCanUse: ['Admin', 'CEO', 'Manager'],
        steps: [
          'When any employee is clocked in with no active task timer and no training batch for 15+ minutes, an alert is triggered.',
          'A top-right Teams-style notification popup appears with a pleasant notification chime, showing the employee name, avatar, and idle minutes.',
          'Admin can click "View Status →" to jump directly to the Employee Status page, or click "✕" / "Dismiss" to close the card (snoozed for 30 minutes).',
          'A yellow banner also appears at the top of the Employee Status page summarizing all idle team members.',
        ],
      },
    ],
    faq: [
      {
        q: 'Why is a trainer not marked as idle even if they don\'t start a task timer?',
        a: 'Because trainers conduct physical or online classes. Their clock-in mode "Training" links directly to their batch, which qualifies as active work.',
      },
    ],
  },

  // ── 3. EMPLOYEE DIRECTORY ────────────────────────────────────────────────
  {
    id: 'employee-directory',
    tabKey: 'employee-directory',
    title: 'Employee Directory — Profiles, Roles & Relieved Management',
    module: 'Employee Management',
    route: '/app/employees',
    icon: 'Users',
    whereToFind: 'Sidebar → Employees',
    rolesAllowed: ['ADMIN', 'CEO', 'MANAGER'],
    summary: 'Manage official employee records, generate EMP IDs, assign designations, set reporting supervisors, manage system access, and handle relieved/resigned transitions.',
    workflows: [
      {
        id: 'add-employee',
        title: 'How to Add a New Employee',
        summary: 'Create an employee record and system account.',
        whoCanUse: ['Admin', 'CEO'],
        steps: [
          'Navigate to Sidebar → "Employees".',
          'Click the blue "+ Add New Employee" button at the top right.',
          'Fill in First Name, Last Name, and Company Email.',
          'Verify Auto-Generated Employee ID (e.g. EMP-708) or customize if needed.',
          'Select Designation (e.g. Senior Technical Trainer, Data Analyst, Developer).',
          'Select System Role: "Employee (Can also conduct Training)", "Manager", "CEO", or "Admin".',
          'Select Reporting Manager / Supervisor from the list.',
          'Click "Add Employee" to save.',
        ],
        fields: [
          { name: 'firstName', label: 'First Name', type: 'Text', required: true, description: 'Employee legal first name', example: 'Anoop' },
          { name: 'lastName', label: 'Last Name', type: 'Text', required: true, description: 'Employee legal last name', example: 'Baiju' },
          { name: 'email', label: 'Company Email', type: 'Email', required: true, description: 'Official company login email', example: 'anoop@kvjanalytics.com' },
          { name: 'employeeId', label: 'Employee ID', type: 'Text', required: true, description: 'Standard identifier formatted EMP-xxx', example: 'EMP-004' },
          { name: 'role', label: 'System Role', type: 'Select', required: true, description: 'EMPLOYEE, MANAGER, CEO, ADMIN', example: 'EMPLOYEE' },
          { name: 'status', label: 'Employment Status', type: 'Select', required: true, description: 'Active, On Notice, Relieved / Resigned', example: 'Active' },
        ],
        simulationKey: 'sim-add-employee',
      },
      {
        id: 'relieve-employee',
        title: 'How to Mark an Employee as Relieved / Resigned',
        summary: 'Deactivate system access while preserving historical attendance, logs, and financial records.',
        whoCanUse: ['Admin', 'CEO'],
        steps: [
          'In Employee Directory, find the employee and click "Edit Profile".',
          'Scroll to "Employment Status".',
          'Select "🔴 Relieved / Resigned (Deactivates Access)".',
          'Click "Update Profile".',
        ],
        proTips: [
          'Relieved employees are safely filtered out of Training Calendar columns, Trainer dropdowns, and Live Status boards.',
          'To view past relieved employees, use the Status Filter dropdown on the Directory page and select "Relieved / Resigned".',
        ],
      },
    ],
    faq: [
      {
        q: 'Does marking someone Relieved delete their past batch records?',
        a: 'No. FlowDesk uses enterprise soft-deactivation. All historical records, expenses, and certificates remain intact.',
      },
    ],
  },

  // ── 4. ATTENDANCE & SHIFTS ────────────────────────────────────────────────
  {
    id: 'attendance',
    tabKey: 'attendance',
    title: 'Attendance Log — Shift Records, Master Excel & Corrections',
    module: 'Attendance & Shifts',
    route: '/app/attendance',
    icon: 'Clock',
    whereToFind: 'Sidebar → Attendance',
    rolesAllowed: ['ALL'],
    summary: 'Comprehensive shift log displaying clock-in/out times, resolved locations and colleges, break calculations, multi-session day splits, attendance correction claims, and 6-sheet master Excel export.',
    workflows: [
      {
        id: 'export-attendance-excel',
        title: 'How to Export Master Excel (6 Sheets)',
        summary: 'Generate official company payroll and audit Excel reports containing all 6 operational sheets.',
        whoCanUse: ['Admin', 'CEO', 'Manager'],
        steps: [
          'Navigate to Sidebar → "Attendance".',
          'Select your desired Date Range filter (e.g., Current Month, 01/10/2026 to 31/10/2026).',
          'Click the green "📊 Export Master Excel" button.',
          'FlowDesk generates a multi-sheet spreadsheet containing: 1. Summary, 2. Attendance Details Log, 3. Expense Summary, 4. Expense Details, 5. Batch Wise Expense, 6. Task Summary & Worklog.',
        ],
      },
      {
        id: 'submit-attendance-correction',
        title: 'How to Submit an Attendance Correction Claim',
        summary: 'Request supervisor approval for missed clock-ins or split working sessions.',
        whoCanUse: ['All Employees'],
        steps: [
          'Click "📝 Request Attendance Correction" button.',
          'Choose Mode: "Single Session" or "Multiple Sessions (Split Work Day)".',
          'Pick the Work Date and enter Start Time and End Time.',
          'Select Work Type (e.g. Office, Training, Remote). If Training, choose the Batch.',
          'Provide a reason note and click "Submit for Approval".',
        ],
        validationRules: [
          'End Time must always be strictly after Start Time.',
          'In Multiple Sessions mode, Session #2 start time cannot overlap with Session #1 end time.',
        ],
      },
      {
        id: 'force-clock-out',
        title: 'How Admins Force Clock Out an Unclosed Session',
        summary: 'Close forgotten overnight or unclocked sessions with an official audit timestamp.',
        whoCanUse: ['Admin', 'CEO', 'Manager'],
        steps: [
          'Navigate to "Approvals Queue" → "Unclosed Sessions" tab.',
          'Review employees who have open sessions from past dates.',
          'Click "Force Clock Out".',
          'Enter official end time (default 17:30) and an admin note.',
          'Confirm action. The session is closed and marked in the audit log.',
        ],
      },
    ],
    faq: [
      {
        q: 'How does the app know which college or batch I worked at?',
        a: 'The system inspects your attendance record\'s work type, session notes, and linked batch ID to automatically resolve the organization name (e.g., SJCET, Christ, Marian College).',
      },
    ],
  },

  // ── 5. LEAVE MANAGEMENT ──────────────────────────────────────────────────
  {
    id: 'leave',
    tabKey: 'leave',
    title: 'Leave Board — Balances, Accrual & Applying Leave',
    module: 'Attendance & Shifts',
    route: '/app/leave',
    icon: 'CalendarDays',
    whereToFind: 'Sidebar → Leave',
    rolesAllowed: ['ALL'],
    summary: 'Manage employee leaves, track annual and monthly balances, apply for leaves with auto-balance verification, and review team leave schedules.',
    workflows: [
      {
        id: 'apply-leave',
        title: 'How to Apply for Leave',
        summary: 'Submit a formal leave request to your supervisor/admin.',
        whoCanUse: ['All Employees'],
        steps: [
          'Navigate to Sidebar → "Leave".',
          'Click the blue "+ Apply Leave" button.',
          'Select Leave Type: "Casual Leave", "Sick Leave", "Earned Leave", or "Maternity/Paternity".',
          'Select Start Date and End Date.',
          'Choose Day Type ("Full Day" or "Half Day").',
          'Enter Reason for leave.',
          'Click "Submit Leave Request".',
        ],
        validationRules: [
          'End date cannot be prior to start date.',
          'Cannot submit overlapping leave requests for the same date.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does an approved leave mark me as offline on Employee Status?',
        a: 'When an approved leave covers today\'s date, Employee Status displays "🌴 On Leave" and you are never flagged as idle.',
      },
    ],
  },

  // ── 6. APPROVALS QUEUE ───────────────────────────────────────────────────
  {
    id: 'approvals',
    tabKey: 'approvals',
    title: 'Approvals Queue — Central Governance & Multi-Workflow Authorization',
    module: 'Governance & Approvals',
    route: '/app/approvals',
    icon: 'CheckSquare',
    whereToFind: 'Sidebar → Approvals Queue',
    rolesAllowed: ['ADMIN', 'CEO', 'MANAGER', 'SUPERVISOR'],
    summary: 'Unified management queue for approving finished task completions, task assignments, leave requests, attendance corrections, and force clock-outs.',
    workflows: [
      {
        id: 'approve-task-completion',
        title: 'How to Review & Approve Submitted Tasks',
        summary: 'Inspect employee worklogs and either approve or return for rework.',
        whoCanUse: ['Project Supervisor', 'Manager', 'CEO', 'Admin'],
        steps: [
          'In Approvals Queue, select the "Task Approvals" tab.',
          'Click "Review Worklog" on any pending submission to view detailed worklog updates, timestamps, and notes.',
          'To accept: click the green "Approve Task" button.',
          'To send back: click the amber "Request Rework" button, enter mandatory rework guidance notes, and confirm. The task returns to "In Progress" for the employee.',
        ],
      },
      {
        id: 'task-assignment-rules',
        title: 'Task Assignment Approval Governance Rules',
        summary: 'Understand who is authorized to approve task assignments.',
        whoCanUse: ['Admin', 'CEO', 'Manager', 'Supervisor'],
        steps: [
          'Self-Assignment: If an employee assigns a task to themselves on a project, the Project Supervisor or Admin/CEO can approve it.',
          'Peer-Assignment Rule: If an employee assigns a task to another peer employee, ONLY Admin or CEO can approve the assignment (Project Supervisors cannot approve peer assignments).',
        ],
      },
    ],
    faq: [
      {
        q: 'Why can\'t I see tasks from other projects?',
        a: 'FlowDesk enforces Row-Level Security: Supervisors only see approval items for projects or tasks they directly supervise.',
      },
    ],
  },

  // ── 7. BATCH MANAGEMENT ──────────────────────────────────────────────────
  {
    id: 'batch-management',
    tabKey: 'batch-management',
    title: 'Batch Management — Batch Lifecycle, Workhours & Expense Analysis',
    module: 'Training & Academics',
    route: '/app/training/batches',
    icon: 'GraduationCap',
    whereToFind: 'Sidebar → Batch Management',
    rolesAllowed: ['ADMIN', 'CEO', 'MANAGER', 'EMPLOYEE'],
    summary: 'Create and configure institutional training batches, assign trainers and coordinators, track students, and analyze real-time workhours, student cost, and detailed expense breakdowns.',
    workflows: [
      {
        id: 'create-batch',
        title: 'How to Create a Training Batch',
        summary: 'Initialize a new training cohort linked to a college and syllabus.',
        whoCanUse: ['Admin', 'CEO', 'Manager'],
        steps: [
          'Navigate to Sidebar → "Batch Management".',
          'Click "+ Create New Batch".',
          'Select College from the searchable dropdown.',
          'Select Course / Syllabus.',
          'Enter Batch Code (e.g., SJCET - 2 MBA - 2026-2027 - Batch 1).',
          'Select Primary Trainer (only active, eligible trainers are listed; relieved staff and cleaning staff are excluded).',
          'Select Coordinator, Start Date, End Date, and Student Count.',
          'Click "Create Batch".',
        ],
        fields: [
          { name: 'college', label: 'College', type: 'Select', required: true, description: 'Client institution', example: 'SJCET' },
          { name: 'course', label: 'Course', type: 'Select', required: true, description: 'Mapped training syllabus', example: 'Excel Expert 365' },
          { name: 'code', label: 'Batch Code', type: 'Text', required: true, description: 'Unique batch name format', example: 'SJCET - 2 MBA - Batch 1' },
          { name: 'trainer', label: 'Assigned Trainer', type: 'Select', required: true, description: 'Eligible trainer EMP', example: 'Linto George' },
        ],
        simulationKey: 'sim-create-batch',
      },
      {
        id: 'batch-expense-details',
        title: 'How to Inspect Batch Workhours & Expense Analytics',
        summary: 'View automated cost-per-student and logged trainer workhours.',
        whoCanUse: ['Admin', 'CEO', 'Manager', 'Trainer'],
        steps: [
          'In Batch Management, locate the batch card or row.',
          'Click the "💰 Expense Details" or "View Analytics" button.',
          'A rich analytics drawer opens displaying:',
          '  • Total Students & Total Logged Workhours (calculated from trainer attendance records).',
          '  • Total Claimed Expenses and Cost Per Student (Total Expense / Enrolled Students).',
          '  • Average Expense Per Claim and Daily Expense Averages.',
          '  • Detailed Expense Log with receipt inspection links.',
        ],
      },
    ],
    faq: [
      {
        q: 'Where do the Batch Workhours come from?',
        a: 'Workhours are dynamically calculated from all attendance sessions where trainers clocked in under that specific batch.',
      },
    ],
  },

  // ── 8. TRAINING CALENDAR / RESOURCE PLANNER ───────────────────────────────
  {
    id: 'training-calendar',
    tabKey: 'training-calendar',
    title: 'Training Calendar — Resource Allocation, Matrix & Multi-Day Schedules',
    module: 'Training & Academics',
    route: '/app/training/calendar',
    icon: 'CalendarDays',
    whereToFind: 'Sidebar → Training Calendar',
    rolesAllowed: ['ADMIN', 'CEO', 'MANAGER', 'EMPLOYEE'],
    summary: 'Unified interactive trainer-matrix calendar for scheduling training sessions, configuring repeating schedules (skipping Sundays and holidays), detecting scheduling conflicts, copying schedules, and drag-and-drop rescheduling.',
    workflows: [
      {
        id: 'assign-schedule',
        title: 'How to Schedule Training Sessions (With Multi-Day Repeating)',
        summary: 'Assign a batch to a trainer for a single day or across multiple dates.',
        whoCanUse: ['Admin', 'CEO', 'Manager'],
        steps: [
          'Navigate to Sidebar → "Training Calendar".',
          'Click the "+ Assign Schedule" button (or click directly on any trainer/date cell).',
          'Select Batch (use search bar if needed) and Assigned Trainer.',
          'Set Start Time (e.g. 09:00) and End Time (e.g. 16:00).',
          'Configure Schedule Mode:',
          '  • "Single Day": Schedule for one specific date.',
          '  • "Consecutive Days": Enter number of days (e.g., 3 days). Automatically skips Sundays!',
          '  • "Date Range": Pick Start Date and End Date. Automatically skips Sundays and configured institutional holidays!',
          'Click "Save Schedule".',
        ],
        simulationKey: 'sim-calendar-schedule',
      },
      {
        id: 'copy-schedule',
        title: 'How to Copy a Schedule to Another Day',
        summary: 'Quickly duplicate an existing schedule slot without re-typing batch details.',
        whoCanUse: ['Admin', 'CEO', 'Manager'],
        steps: [
          'Find the schedule card on the matrix grid.',
          'Click the "📋 Copy" button on the card.',
          'A modal opens with all batch, timing, and trainer details pre-filled.',
          'Select the Target Date and click "Confirm Copy".',
        ],
      },
      {
        id: 'drag-and-drop-reschedule',
        title: 'How to Drag & Drop to Move Dates or Trainers',
        summary: 'Drag a schedule card from one cell to another to update dates or reassign trainers instantly.',
        whoCanUse: ['Admin', 'CEO', 'Manager'],
        steps: [
          'Click and hold any schedule card on the matrix grid.',
          'Drag it over to a different trainer column or date row.',
          'Drop the card. FlowDesk saves the change to Supabase immediately.',
        ],
      },
    ],
    faq: [
      {
        q: 'Why didn\'t my schedule appear on Sunday?',
        a: 'The system has automated business logic that skips Sundays and holidays to protect trainers from accidental scheduling errors.',
      },
      {
        q: 'Why are duplicate cards prevented?',
        a: 'FlowDesk deduplicates sessions by unique slot ID and trainer/time key, preventing accidental double-clicking from cluttering the calendar.',
      },
    ],
  },

  // ── 9. PROJECTS & TASKS ──────────────────────────────────────────────────
  {
    id: 'projects-tasks',
    tabKey: 'projects-tasks',
    title: 'Projects & Tasks — Kanban Board, Worklog Notes & Mandatory Pause Notes',
    module: 'Projects & Tasks',
    route: '/app/project/tasks',
    icon: 'FolderKanban',
    whereToFind: 'Sidebar → Projects & Tasks',
    rolesAllowed: ['ALL'],
    summary: 'Interactive project task board with status columns (Backlog, Todo, In Progress, Review, Completed), live stopwatches, mandatory progress notes upon pausing/switching, and supervisor worklog history.',
    workflows: [
      {
        id: 'create-task',
        title: 'How to Create a Project or Office Task',
        summary: 'Add a new deliverable with proposed hours, priority, and assignees.',
        whoCanUse: ['All Employees', 'Supervisors', 'Managers', 'Admin'],
        steps: [
          'Navigate to Sidebar → "Projects & Tasks".',
          'Click "+ Add Task" button.',
          'Enter Task Title and select Category: "Office Task" or "Project Task".',
          'If Project Task, select the Client and Project.',
          'Assign an employee and assign a supervisor.',
          'Set Due Date, Priority (Low, Normal, High, Urgent), and Estimated Hours.',
          'Click "Create Task". If self-assigned, it will route for assignment approval if required.',
        ],
        simulationKey: 'sim-create-task',
      },
      {
        id: 'mandatory-pause-note',
        title: 'Mandatory Progress Note on Task Pause or Switch',
        summary: 'Learn how FlowDesk enforces audit-ready worklogging.',
        whoCanUse: ['All Employees'],
        steps: [
          'When you are working on a task ("In Progress") and want to start another task or pause work:',
          'Click "▶ Start" on the new task or "⏸ Pause" on the current task.',
          'A mandatory modal appears: "Switch Task — Save Progress (Mandatory)".',
          'Enter a description of what you accomplished in this session (e.g., "Built 4 KPI visual cards and tested DAX formulas").',
          'Click "⏸ Save Progress & Start Next Task". Your note is permanently recorded in the Task Worklog.',
        ],
      },
      {
        id: 'inspect-task-worklogs',
        title: 'How to View Task Worklog Updates',
        summary: 'Review full history of session notes and timestamps for any task.',
        whoCanUse: ['Supervisors', 'Managers', 'Admin', 'Assignee'],
        steps: [
          'On any task card, click the updates counter pill (e.g. "📝 3 Updates").',
          'The Task Worklog Updates drawer opens from the right.',
          'View each work session\'s start time, end time, duration, and the employee\'s logged progress notes.',
        ],
      },
    ],
    faq: [
      {
        q: 'Can I leave the progress note blank when pausing a task?',
        a: 'No. FlowDesk requires an audit note to ensure project transparency and accurate client timesheets.',
      },
    ],
  },

  // ── 10. EXPENSES & TRAVEL CLAIMS ─────────────────────────────────────────
  {
    id: 'expenses',
    tabKey: 'expenses',
    title: 'Expenses & Travel — Claim Submissions, KM Calculation & Batch Routing',
    module: 'Finance & Travel',
    route: '/app/finance/expenses',
    icon: 'Receipt',
    whereToFind: 'Sidebar → Expenses & Travel',
    rolesAllowed: ['ALL'],
    summary: 'Submit and track travel reimbursements, client visit expenses, food/tea, and training batch travel with automatic kilometer rate calculation and receipt uploads.',
    workflows: [
      {
        id: 'submit-expense',
        title: 'How to Submit an Expense Claim (With Car/Bike KM Auto-Calculation)',
        summary: 'Submit an expense claim with receipt and batch linkage.',
        whoCanUse: ['All Employees'],
        steps: [
          'Navigate to Sidebar → "Expenses & Travel".',
          'Click "+ New Expense Claim".',
          'Select Expense Type: "Auto", "Bus", "Metro", "Self Travel (Car)", "Self Travel (Bike)", or "Evening/Morning Tea".',
          'If Self Travel is selected, enter Distance in KM (e.g. 110 km). The total amount is automatically calculated based on company rates!',
          'Select Linked Training Batch or Project (e.g. SJCET - 2 MBA - Batch 1).',
          'Attach receipt photo/PDF if applicable.',
          'Click "Submit Expense Claim".',
        ],
        fields: [
          { name: 'type', label: 'Expense Type', type: 'Select', required: true, description: 'Travel mode or expense category', example: 'Self Travel (Car)' },
          { name: 'km', label: 'Distance (KM)', type: 'Number', required: false, description: 'Used for vehicle rate multiplication', example: '110' },
          { name: 'amount', label: 'Amount (₹)', type: 'Number', required: true, description: 'Total reimbursement amount claimed', example: '1045' },
          { name: 'batch', label: 'Linked Batch', type: 'Select', required: false, description: 'Routes expense to batch cost center', example: 'SJCET - 2 MBA - Batch 1' },
        ],
        simulationKey: 'sim-submit-expense',
      },
    ],
    faq: [
      {
        q: 'Why is it important to link my expense to a Training Batch?',
        a: 'Linking expenses to a batch allows the system to compute accurate Cost-Per-Student and comprehensive Batch Expense Analytics.',
      },
    ],
  },

  // ── 11. COMMUNICATION & CHAT ─────────────────────────────────────────────
  {
    id: 'communication',
    tabKey: 'communication',
    title: 'Chat Rooms & Announcements — Real-Time Messaging & Broadcasts',
    module: 'Communication & Support',
    route: '/app/communication/chat',
    icon: 'MessageSquare',
    whereToFind: 'Sidebar → Chat Rooms / Announcements Board',
    rolesAllowed: ['ALL'],
    summary: 'Enterprise real-time communication platform featuring department channels, direct messages, file sharing, unread indicators, and company-wide official announcements.',
    workflows: [
      {
        id: 'send-chat-message',
        title: 'How to Use Chat Channels & Direct Messages',
        summary: 'Collaborate with colleagues and teams with real-time chimes.',
        whoCanUse: ['All Employees'],
        steps: [
          'Navigate to Sidebar → "Chat Rooms".',
          'Select a channel (e.g., #general, #trainers, #data-analytics) or click on a colleague to start a Direct Message.',
          'Type your message in the bottom input and press Enter.',
          'Incoming messages trigger a high-fidelity chime sound and top-right toast alert.',
        ],
      },
    ],
    faq: [
      {
        q: 'Can I mute a noisy channel?',
        a: 'Yes, click the speaker icon next to the channel name to mute sound notifications for that specific room.',
      },
    ],
  },
];
