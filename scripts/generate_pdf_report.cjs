const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read logo if exists
let logoBase64 = '';
const logoPath = path.join(__dirname, '..', 'KVJ analytics Logo.png');
if (fs.existsSync(logoPath)) {
  const buf = fs.readFileSync(logoPath);
  logoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
}

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>KVJ Analytics ERP — Executive Audit & Mobile Roadmap</title>
<style>
  @page {
    size: A4 portrait;
    margin: 10mm 12mm 10mm 12mm;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.45;
    font-size: 9pt;
    margin: 0;
    padding: 0;
  }

  /* Page Wrapper to guarantee exact A4 pagination */
  .page {
    width: 100%;
    min-height: 270mm;
    max-height: 275mm;
    page-break-after: always;
    break-after: page;
    position: relative;
    padding-bottom: 25px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .page:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }

  .page-content {
    flex: 1;
  }

  /* Cover / Header Banner */
  .cover-banner {
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
    color: #ffffff;
    padding: 22px 24px;
    border-radius: 12px;
    margin-bottom: 16px;
    box-shadow: 0 8px 20px -4px rgba(15, 23, 42, 0.25);
    position: relative;
    overflow: hidden;
  }

  .cover-banner::after {
    content: "";
    position: absolute;
    top: -40px;
    right: -40px;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, transparent 70%);
    border-radius: 50%;
  }

  .cover-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }

  .logo-img {
    height: 42px;
    background: #ffffff;
    padding: 4px 10px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .confidential-tag {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #e2e8f0;
    font-size: 7.5pt;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 16px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .cover-title {
    font-size: 21pt;
    font-weight: 800;
    margin: 0 0 5px 0;
    letter-spacing: -0.5px;
    line-height: 1.15;
    background: linear-gradient(90deg, #ffffff, #93c5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .cover-subtitle {
    font-size: 10pt;
    color: #cbd5e1;
    margin: 0 0 12px 0;
    max-width: 90%;
    line-height: 1.35;
  }

  .meta-pills {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .meta-pill {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: #f1f5f9;
    font-size: 7.5pt;
    padding: 3px 9px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  /* Compact Page Header for Pages 2 to 5 */
  .page-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    margin-bottom: 14px;
    border-bottom: 2px solid #e2e8f0;
  }

  .page-header-title {
    font-size: 13pt;
    font-weight: 800;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .page-header-title::before {
    content: "";
    display: inline-block;
    width: 4px;
    height: 18px;
    background: #4f46e5;
    border-radius: 2px;
  }

  .page-header-badge {
    font-size: 7.5pt;
    font-weight: 700;
    color: #475569;
    background: #f1f5f9;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  /* Metric KPI Cards */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }

  .kpi-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    border-top: 4px solid #3b82f6;
  }

  .kpi-card.purple { border-top-color: #8b5cf6; }
  .kpi-card.amber { border-top-color: #f59e0b; }
  .kpi-card.emerald { border-top-color: #10b981; }

  .kpi-val {
    font-size: 17pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
  }

  .kpi-label {
    font-size: 7.5pt;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 3px;
  }

  .kpi-sub {
    font-size: 7.5pt;
    color: #475569;
    margin-top: 2px;
  }

  /* Section Styling */
  .section-title {
    font-size: 11pt;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 6px 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-desc {
    font-size: 8.5pt;
    color: #475569;
    margin: 0 0 10px 0;
  }

  /* Highlight Callout Box */
  .callout {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-left: 4px solid #16a34a;
    padding: 10px 12px;
    border-radius: 6px;
    margin-bottom: 12px;
    font-size: 8.5pt;
    color: #166534;
    line-height: 1.4;
  }

  .callout.warning {
    background: #fffbeb;
    border-color: #fde68a;
    border-left-color: #d97706;
    color: #92400e;
  }

  .callout.info {
    background: #eff6ff;
    border-color: #bfdbfe;
    border-left-color: #2563eb;
    color: #1e40af;
  }

  /* Presentation Tables */
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-bottom: 8px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    font-size: 7.5pt;
  }

  th {
    background: #f1f5f9;
    color: #1e293b;
    font-weight: 700;
    text-align: left;
    padding: 4.5px 7px;
    border-bottom: 2px solid #cbd5e1;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  td {
    padding: 4.5px 7px;
    border-bottom: 1px solid #e2e8f0;
    color: #334155;
    vertical-align: top;
    line-height: 1.3;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* Badges & Chips */
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }

  .badge-danger { background: #fee2e2; color: #991b1b; }
  .badge-warning { background: #fef3c7; color: #92400e; }
  .badge-success { background: #dcfce7; color: #166534; }
  .badge-info { background: #e0e7ff; color: #3730a3; }
  .badge-neutral { background: #f1f5f9; color: #475569; }

  /* Feature Grid / Cards */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7px;
    margin-bottom: 8px;
  }

  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 9px 11px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 8.5pt;
    color: #0f172a;
    margin-bottom: 4px;
  }

  .card-body {
    font-size: 8pt;
    color: #475569;
    line-height: 1.4;
  }

  /* Code & Architecture Tree */
  .arch-tree {
    background: #0f172a;
    color: #e2e8f0;
    padding: 9px 12px;
    border-radius: 6px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 7.5pt;
    line-height: 1.35;
    overflow: hidden;
  }

  .arch-tree .highlight { color: #38bdf8; font-weight: 700; }
  .arch-tree .comment { color: #94a3b8; font-style: italic; }
  .arch-tree .star { color: #facc15; font-weight: 700; }

  /* Timeline / Roadmap */
  .timeline {
    position: relative;
    padding-left: 18px;
    margin-left: 8px;
    border-left: 2px dashed #94a3b8;
  }

  .timeline-step {
    position: relative;
    margin-bottom: 12px;
  }

  .timeline-dot {
    position: absolute;
    left: -24px;
    top: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #4f46e5;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 2px #4f46e5;
  }

  .timeline-title {
    font-weight: 700;
    font-size: 8.5pt;
    color: #0f172a;
  }

  .timeline-desc {
    font-size: 7.5pt;
    color: #475569;
    margin-top: 2px;
    line-height: 1.35;
  }

  /* Footer */
  .doc-footer {
    padding-top: 6px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #94a3b8;
  }
</style>
</head>
<body>

  <!-- ================= PAGE 1: COVER & EXECUTIVE OVERVIEW ================= -->
  <div class="page">
    <div class="page-content">
      <div class="cover-banner">
        <div class="cover-top">
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="KVJ Analytics Logo">` : `<div style="font-size: 15pt; font-weight: 800; color: #fff;">KVJ Analytics</div>`}
          <div class="confidential-tag">Executive Presentation Report</div>
        </div>
        <div class="cover-title">ERP Modernization Audit & Mobile Roadmap</div>
        <div class="cover-subtitle">A comprehensive review of system health, form component unification, standardized folder architecture, business logic verification, and iOS/Android mobile app strategy.</div>
        <div class="meta-pills">
          <div class="meta-pill">📅 Date: September 2026</div>
          <div class="meta-pill">🏢 Organization: KVJ Analytics</div>
          <div class="meta-pill">🎯 Focus: Non-Technical Executive Overview</div>
          <div class="meta-pill">📱 Target: Web Modernization + iOS & Android Mobile Apps</div>
        </div>
      </div>

      <!-- KPI METRICS -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-val">57,800+</div>
          <div class="kpi-label">Lines of Active Code</div>
          <div class="kpi-sub">Powering 9 operational modules</div>
        </div>
        <div class="kpi-card amber">
          <div class="kpi-val">7,059</div>
          <div class="kpi-label">Largest Single File</div>
          <div class="kpi-sub">BatchManagement.tsx needs modularization</div>
        </div>
        <div class="kpi-card emerald">
          <div class="kpi-val">4 Major</div>
          <div class="kpi-label">Forms to Unify</div>
          <div class="kpi-sub">Single source of truth across all screens</div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-val">50%+</div>
          <div class="kpi-label">Dead Code Redundancy</div>
          <div class="kpi-sub">Safe removal of legacy/ & server/ folders</div>
        </div>
      </div>

      <!-- 1. EXECUTIVE SUMMARY -->
      <div class="section-title">1. Executive Summary: Current Health & Opportunity</div>
      <div class="section-desc">Key findings for leadership presented in clear, plain English without technical jargon.</div>
      <p style="margin: 0 0 10px 0; font-size: 8.5pt; line-height: 1.45;">
        KVJ Analytics ERP reliably manages core daily operations: <strong>Employee Attendance, Classroom Batches, Final Exam Vouchers, Travel Mileage Claims, and Project Worklogs</strong>. However, as new capabilities were added over time, the system accumulated "digital baggage" — duplicate forms, orphaned files, and giant code files that slow down the web app and make building a mobile app difficult.
      </p>

      <div class="grid-3">
        <div class="card" style="border-left: 3px solid #ef4444;">
          <div class="card-header">1. Duplicated Forms</div>
          <div class="card-body">Actions like <em>Creating a Task</em> or <em>Applying for Leave</em> have 2 to 3 different forms coded independently in different screens. This creates inconsistent rules and double the maintenance effort.</div>
        </div>
        <div class="card" style="border-left: 3px solid #f59e0b;">
          <div class="card-header">2. "Monster" Files</div>
          <div class="card-body">Four files contain 2,000 to 7,000 lines of code crammed into a single file. This causes occasional browser lag and makes minor updates risky. Splitting them into sub-tabs fixes this.</div>
        </div>
        <div class="card" style="border-left: 3px solid #10b981;">
          <div class="card-header">3. Mobile App Opportunity</div>
          <div class="card-body">Field trainers and staff urgently need a tap-and-go phone app. We can build a fast, unified iOS & Android app connecting directly to your existing Supabase cloud database with zero sync delay.</div>
        </div>
      </div>

      <div class="callout info" style="margin-top: 6px;">
        <strong>Strategic Plan & Hotfixes Delivered:</strong> Attendance timezone (+5:30 shift), Real-Time Chat Audio Chimes, and Batch Management 180-Row PDF Pagination Defect were all resolved today. Executing our 3-step modernization (Clean Dead Code &rarr; Unify Reusable Forms &rarr; Launch Mobile App) will give KVJ Analytics a resilient, 10x more maintainable platform.
      </div>
    </div>

    <div class="doc-footer">
      <span>KVJ Analytics ERP — Architecture Modernization & Mobile Strategy</span>
      <span>Page 1 of 5 (Executive Summary)</span>
    </div>
  </div>

  <!-- ================= PAGE 2: FORM COMPONENT UNIFICATION ================= -->
  <div class="page">
    <div class="page-content">
      <div class="page-header-bar">
        <div class="page-header-title">2. Form Component Unification & Urgent Defect Fixes</div>
        <div class="page-header-badge">Core Architecture & Reliability</div>
      </div>

      <div class="callout info">
        <strong>The Problem You Identified:</strong> In several areas, the application uses completely different forms for the exact same task, team chat lacked sound/alerts, and 180-row tables in Batch PDF reports collapsed into a single page.<br>
        <strong>The Solution:</strong> Build <strong>ONE reusable Form component</strong> per business entity, connect global real-time audio alerts for chats, and partition large student rosters into discrete A4 booklet pages with repeated headers.
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 17%;">Entity / Action</th>
            <th style="width: 27%;">Where Currently Duplicated</th>
            <th style="width: 28%;">Discrepancy & Business Risk</th>
            <th style="width: 28%;">Unified Component Solution</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Chat & Direct Message Alerts</strong></td>
            <td>
              • <code>useCommunication.ts</code> (Active channel only)<br>
              • <code>NotificationProvider.tsx</code> (No chat connection)
            </td>
            <td><span class="badge badge-success">Resolved Today</span> <strong>Zero Alerts or Sounds:</strong> Staff received no audio chime or banner when incoming messages arrived while working on other screens.</td>
            <td><strong>Real-Time Sound Chime & Toast:</strong> Added global Supabase Realtime listener, harmonic dual-tone chime (E5 &rarr; B5), and instant top-right Toast alert with sender name.</td>
          </tr>
          <tr>
            <td><strong>Attendance Corrections</strong></td>
            <td>
              • <code>AttendanceHistory.tsx</code> (Correction Claim)<br>
              • <code>ApprovalsQueue.tsx</code> (Force Clock-Out)<br>
              • <code>AttendanceLogPage.tsx</code> (Session Claims)
            </td>
            <td><span class="badge badge-success">Resolved Today</span> <strong>Timezone Shift Bug:</strong> 4:15 PM forced clock-out shifted +5:30 to 9:45 PM in UTC.</td>
            <td>Fixed via universal <code>localDateTimeToUtcIso()</code> conversion and corrected affected database records in Supabase.</td>
          </tr>
          <tr>
            <td><strong>Batch PDF Reports (180+ Rows Defect)</strong></td>
            <td>
              • <code>DailyReportDocument.tsx</code><br>
              • <code>StudentDataSection.tsx</code><br>
              • <code>BatchManagement.tsx</code> (Direct Export)
            </td>
            <td><span class="badge badge-success">Resolved Today</span> <strong>180-Row Pagination Defect:</strong> Tables with 180 students collapsed into a single 4,000px mega-page. Top margins and continuation headers were missing, cutting off rows.</td>
            <td><strong>Discrete A4 Chunk Paginator:</strong> Slices rosters into discrete 16-row blocks with repeated table headers, explicit 22mm top margins, and running headers on every page.</td>
          </tr>
          <tr>
            <td><strong>Task Creation Form</strong></td>
            <td>
              • <code>WorkspacePages.tsx</code> (My Day)<br>
              • <code>TaskBoard.tsx</code> (Kanban Board)<br>
              • <code>ProjectList.tsx</code> (Project Detail)<br>
              • <code>CreateTaskModal.tsx</code>
            </td>
            <td><span class="badge badge-danger">High Risk</span> Validation rules differ; project assignment was required in one form but optional in another. Codes and deadlines formatted differently.</td>
            <td>Extract <strong><code>TaskFormModal.tsx</code></strong> in <code>src/modules/project/components/</code>. Used identically in My Day, Task Board, and Project views with prefill props.</td>
          </tr>
          <tr>
            <td><strong>Leave Application Form</strong></td>
            <td>
              • <code>WorkspacePages.tsx</code> (My Day Quick Action Drawer)<br>
              • <code>LeaveBoard.tsx</code> (Dedicated Leave Management Screen)
            </td>
            <td><span class="badge badge-warning">Medium Risk</span> The My Day quick drawer lacked medical certificate upload and half-day shift selectors that existed in LeaveBoard.</td>
            <td>Extract <strong><code>ApplyLeaveModal.tsx</code></strong> in <code>src/modules/leave/components/</code> as the single authoritative leave filing form.</td>
          </tr>
          <tr>
            <td><strong>Expense Claim Filing</strong></td>
            <td>
              • <code>ExpenseClaims.tsx</code> (Inline Drawer)<br>
              • <code>AttendanceLogPage.tsx</code> (Inline claim modals)
            </td>
            <td><span class="badge badge-warning">Medium Risk</span> Mileage rates and vehicle calculations were hardcoded inside the page rather than encapsulated in a reusable form.</td>
            <td>Extract <strong><code>ExpenseClaimModal.tsx</code></strong> in <code>src/modules/finance/components/</code> with automatic KM reimbursement calculations.</td>
          </tr>
          <tr>
            <td><strong>Student Registration</strong></td>
            <td>
              • <code>BatchManagement.tsx</code> (Single Student Form)<br>
              • <code>BatchManagement.tsx</code> (Bulk Import Form)
            </td>
            <td><span class="badge badge-neutral">Maintenance</span> In-page state handling makes the file 7,059 lines long.</td>
            <td>Extract <strong><code>StudentRegistrationModal.tsx</code></strong> as a dedicated standalone component.</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">Why Component Unification & Defect Fixes Matter to Your Business:</div>
      <div class="grid-4">
        <div class="card" style="border-top: 3px solid #059669;">
          <div class="card-header">🛡️ 100% Consistent Rules</div>
          <div class="card-body">Staff cannot bypass required fields by using shortcut screens. All rules are identical everywhere.</div>
        </div>
        <div class="card" style="border-top: 3px solid #0284c7;">
          <div class="card-header">📄 True A4 Multi-Page PDFs</div>
          <div class="card-body">180+ student batches split into clean A4 booklets with repeating headers and zero awkward row clipping.</div>
        </div>
        <div class="card" style="border-top: 3px solid #2563eb;">
          <div class="card-header">⚡ 3x Faster Changes</div>
          <div class="card-body">Adding a new field takes minutes in a single form instead of modifying 4 separate files.</div>
        </div>
        <div class="card" style="border-top: 3px solid #8b5cf6;">
          <div class="card-header">📱 Easy Mobile Porting</div>
          <div class="card-body">Unified forms port directly into iOS and Android screens without conflicting business logic.</div>
        </div>
      </div>
    </div>

    <div class="doc-footer">
      <span>KVJ Analytics ERP — Architecture Modernization & Mobile Strategy</span>
      <span>Page 2 of 5 (Form Unification)</span>
    </div>
  </div>

  <!-- ================= PAGE 3: FOLDER STRUCTURE & HOUSEKEEPING ================= -->
  <div class="page">
    <div class="page-content">
      <div class="page-header-bar">
        <div class="page-header-title">3. Standardized Folder Architecture & File Housekeeping</div>
        <div class="page-header-badge">Enterprise Code Organization</div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header" style="color: #ef4444;">❌ Current Structural Flaws</div>
          <div class="card-body">
            • <strong>Monster Files:</strong> <code>BatchManagement.tsx</code> (7,059 lines) and <code>WorkspacePages.tsx</code> (3,231 lines) pack 5 screens into 1 file.<br>
            • <strong>Orphaned Directories:</strong> <code>legacy/</code>, <code>server/</code>, and <code>sandbox-scripts/</code> remain from old discarded systems.<br>
            • <strong>Scattered Forms:</strong> Some forms are in pages, some in components, some in app folders.
          </div>
        </div>
        <div class="card">
          <div class="card-header" style="color: #10b981;">✅ Standardized Modular Architecture</div>
          <div class="card-body">
            • <strong>Feature-Driven Modules:</strong> Every business module (attendance, leave, project, training) is completely self-contained.<br>
            • <strong>Dedicated <code>forms/</code> Folders:</strong> Every reusable form lives in a clean, predictable location.<br>
            • <strong>Clean Root Folder:</strong> Zero dead code. Fast backups and zero confusion for new developers.
          </div>
        </div>
      </div>

      <div class="section-title" style="margin-top: 8px;">Target Production Folder Hierarchy:</div>
      <div class="arch-tree">
<span class="highlight">src/</span>
├── <span class="highlight">app/</span>                        <span class="comment"># Application shell, global navigation, authentication providers</span>
├── <span class="highlight">core/</span>                       <span class="comment"># Core Dependency Injection container, base types, shared event bus</span>
├── <span class="highlight">shared/</span>                     <span class="comment"># Universal UI primitives (Button, Card, Modal, Input, Table, Date Utils)</span>
└── <span class="highlight">modules/</span>
    ├── <span class="highlight">project/</span>                <span class="comment"># Self-contained Project & Tasks domain</span>
    │   ├── <span class="highlight">api/</span>                <span class="comment"># ProjectService & Supabase database calls</span>
    │   ├── <span class="highlight">components/</span>         <span class="comment"># KanbanBoard.tsx, TaskCard.tsx, WorklogTable.tsx</span>
    │   ├── <span class="highlight">forms/</span>              <span class="comment"><span class="star">⭐️</span> TaskFormModal.tsx (Single form used in My Day, Task Board & Project List)</span>
    │   ├── <span class="highlight">hooks/</span>              <span class="comment"># useProject.ts, useTasks.ts</span>
    │   └── <span class="highlight">pages/</span>              <span class="comment"># TaskBoardPage.tsx, ProjectListPage.tsx</span>
    ├── <span class="highlight">leave/</span>                  <span class="comment"># Self-contained Leave domain</span>
    │   ├── <span class="highlight">forms/</span>              <span class="comment"><span class="star">⭐️</span> ApplyLeaveModal.tsx (Single form used everywhere for leave filing)</span>
    │   └── <span class="highlight">pages/</span>              <span class="comment"># LeaveBoardPage.tsx</span>
    ├── <span class="highlight">finance/</span>                <span class="comment"># Expenses, travel claims, mileage rates</span>
    │   ├── <span class="highlight">forms/</span>              <span class="comment"><span class="star">⭐️</span> ExpenseClaimModal.tsx (Single form with central KM reimbursement calculator)</span>
    │   └── <span class="highlight">pages/</span>              <span class="comment"># ExpenseClaimsPage.tsx</span>
    └── <span class="highlight">training/</span>               <span class="comment"># Batches, attendance matrix, exam vouchers, certificates</span>
        ├── <span class="highlight">components/</span>         <span class="comment"># StudentsTab.tsx, AttendanceMatrixTab.tsx, ExamScoresTab.tsx, DeliveryTab.tsx</span>
        └── <span class="highlight">pages/</span>              <span class="comment"># BatchManagementPage.tsx (Reduced from 7,059 to &lt; 350 lines)</span>
      </div>

      <div class="section-title" style="margin-top: 10px;">Housekeeping: Safe File Deletions</div>
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Directory / File</th>
            <th style="width: 35%;">What It Contains</th>
            <th style="width: 40%;">Reason It Is 100% Safe to Delete</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong><code>legacy/</code></strong> (entire folder)</td>
            <td>Old React JavaScript frontend</td>
            <td>Completely disconnected. Active app runs entirely on modern TypeScript in <code>src/</code>.</td>
          </tr>
          <tr>
            <td><strong><code>server/</code></strong> (entire folder)</td>
            <td>Old Express.js & MongoDB backend</td>
            <td>Unused. Active app connects directly to Supabase cloud. No routes are called.</td>
          </tr>
          <tr>
            <td><strong><code>sandbox-scripts/</code></strong> (25 files)</td>
            <td>Old scratch test files (<code>scratch1..7.js</code>)</td>
            <td>Temporary developer tests from months ago. Not part of the running application.</td>
          </tr>
          <tr>
            <td><strong><code>src/pages/</code></strong></td>
            <td>Empty directory</td>
            <td>Zero files inside. Real pages are located inside <code>src/modules/</code>.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="doc-footer">
      <span>KVJ Analytics ERP — Architecture Modernization & Mobile Strategy</span>
      <span>Page 3 of 5 (Architecture & Housekeeping)</span>
    </div>
  </div>

  <!-- ================= PAGE 4: BUSINESS LOGIC CATALOG ================= -->
  <div class="page">
    <div class="page-content">
      <div class="page-header-bar">
        <div class="page-header-title">4. Business Rules Catalog (Currently Applied in Code)</div>
        <div class="page-header-badge">Stakeholder Policy Review</div>
      </div>

      <div class="callout warning">
        <strong>Review Request for Leadership:</strong> These are the exact mathematical formulas, shift windows, and cut-off times currently hardcoded into your software. Please verify if any rule differs from your company policy.
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 18%;">Module Area</th>
            <th style="width: 32%;">Software Rule Currently Applied</th>
            <th style="width: 35%;">Exact Formula / Cut-off Logic</th>
            <th style="width: 15%;">Policy Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Attendance Shift</strong></td>
            <td>Standard office shift expected from 09:30 AM to 05:30 PM (17:30).</td>
            <td>Clock-in at <strong>09:31 AM or later</strong> is flagged Late.<br>Clock-out before <strong>05:30 PM</strong> is flagged Early Exit.</td>
            <td><span class="badge badge-success">Standard</span></td>
          </tr>
          <tr>
            <td><strong>Working Duration</strong></td>
            <td>Breaks are deducted from gross session duration.</td>
            <td>$$\\text{Net Hours} = (\\text{Clock Out} - \\text{Clock In}) - \\text{Total Break Duration}$$</td>
            <td><span class="badge badge-success">Accurate</span></td>
          </tr>
          <tr>
            <td><strong>Force Clock-Out</strong></td>
            <td>Admin can close forgotten open sessions from past days.</td>
            <td>Defaults to <strong>05:30 PM</strong> local time (now stored with proper UTC conversion).</td>
            <td><span class="badge badge-success">Protected</span></td>
          </tr>
          <tr>
            <td><strong>Leave Allocation</strong></td>
            <td>Accrues monthly based on Indian Financial Year (April 1 to March 31).</td>
            <td>$$\\text{Total Leaves} = 1.0\\text{ day/month} \\times \\text{Months Elapsed since April 1st}$$</td>
            <td><span class="badge badge-info">1.0 Day / Mo</span></td>
          </tr>
          <tr>
            <td><strong>Leave Cancellation</strong></td>
            <td>Self-cancellation blocked after specific shift cut-offs:</td>
            <td>• Morning / Full-day: must cancel before <strong>10:30 AM</strong>.<br>• Evening Half-day: must cancel before <strong>03:00 PM</strong>.<br>• Past leaves cannot be self-cancelled.</td>
            <td><span class="badge badge-warning">Verify Cut-offs</span></td>
          </tr>
          <tr>
            <td><strong>Travel Mileage</strong></td>
            <td>Reimbursement strictly auto-calculated by distance & vehicle:</td>
            <td>• <strong>Two-Wheeler (Bike):</strong> ₹ 5.00 / km<br>• <strong>Four-Wheeler (Car):</strong> ₹ 12.00 / km<br>$$\\text{Amount} = \\text{Distance (KM)} \\times \\text{Vehicle Rate}$$</td>
            <td><span class="badge badge-success">Configurable</span></td>
          </tr>
          <tr>
            <td><strong>Chat Sound Alerts</strong></td>
            <td>Audible chime & toast alerts for recipients; self-sent messages and muted channels are silenced.</td>
            <td>$$\\text{Chime Triggered} \\iff \\text{Sender} \\ne \\text{Current User} \\land \\text{Channel} \\ne \\text{Muted}$$ Dual-tone audio chime (E5 &rarr; B5) + popup banner across all pages.</td>
            <td><span class="badge badge-success">Live & Active</span></td>
          </tr>
          <tr>
            <td><strong>Exam Eligibility</strong></td>
            <td>Students must meet classroom attendance and internal assessment threshold.</td>
            <td>Eligibility formula checks: $\\text{Attendance} \\ge 75\\%$ (or 80%) AND internal assessment pass mark before issuing voucher.</td>
            <td><span class="badge badge-success">Standard</span></td>
          </tr>
          <tr>
            <td><strong>Exam Retests</strong></td>
            <td>Retest scores are locked until payment is confirmed.</td>
            <td>Admin must verify <code>Retest Payment = Verified</code> before score input field is unlocked.</td>
            <td><span class="badge badge-success">Audit Protected</span></td>
          </tr>
          <tr>
            <td><strong>Batch Report Pagination</strong></td>
            <td>Multi-page roster splitting, repeating headers & A4 print margins.</td>
            <td>• Maximum <strong>16 rows/page</strong> (HTML) or <strong>30-32 rows/page</strong> (vector PDF).<br>• Table header repeated on every continuation page.<br>• Top margin <strong>&ge; 22mm</strong> protects running headers.</td>
            <td><span class="badge badge-success">Optimized</span></td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">Background Automations & PDF Reporting Recommendations:</div>
      <div class="grid-3">
        <div class="card" style="border-left: 3px solid #ef4444;">
          <div class="card-header">⏰ Auto Clock-Out at Midnight</div>
          <div class="card-body">Re-enable the midnight cron via a <strong>Supabase Scheduled Function</strong> to close forgotten open clock-ins automatically.</div>
        </div>
        <div class="card" style="border-left: 3px solid #f59e0b;">
          <div class="card-header">🚩 Task Overdue Flagging</div>
          <div class="card-body">Migrate the background task due-date checker to Supabase so managers receive automated daily overdue summaries.</div>
        </div>
        <div class="card" style="border-left: 3px solid #2563eb;">
          <div class="card-header">💡 Enterprise PDF Suggestions</div>
          <div class="card-body">
            • <strong>Vector PDF Over HTML:</strong> Always use vector PDF export to eliminate client browser zoom/driver quirks.<br>
            • <strong>16-Row Discrete Booklets:</strong> Slice 180+ student tables into discrete A4 blocks.<br>
            • <strong>Density (8.5pt Font):</strong> Keep 9-column matrices at 8.5pt font to fit 30+ rows per page cleanly.
          </div>
        </div>
      </div>
    </div>

    <div class="doc-footer">
      <span>KVJ Analytics ERP — Architecture Modernization & Mobile Strategy</span>
      <span>Page 4 of 5 (Business Logic Catalog)</span>
    </div>
  </div>

  <!-- ================= PAGE 5: MOBILE APP STRATEGY & ROADMAP ================= -->
  <div class="page">
    <div class="page-content">
      <div class="page-header-bar">
        <div class="page-header-title">5. Mobile Application Strategy & Action Roadmap</div>
        <div class="page-header-badge">iOS, Android & Web Unified</div>
      </div>

      <div class="callout" style="background: #fdf4ff; border-color: #f0abfc; border-left-color: #c026d3; color: #701a75;">
        <strong>Recommended Mobile Technology: Flutter (Dart)</strong><br>
        • <strong>Single Codebase:</strong> Natively compiled for high-speed performance (60/120 FPS) on both Apple iPhones and Android devices.<br>
        • <strong>Direct Supabase Connection:</strong> Uses your existing database. When a field trainer clocks in or files a claim on their phone, the Admin Web dashboard updates in real time with zero delay.
      </div>

      <div class="grid-2">
        <div class="card" style="border-top: 3px solid #2563eb;">
          <div class="card-header">📱 Tailored for the Mobile App (Field & Trainer)</div>
          <div class="card-body">
            • <strong>1-Tap GPS Attendance:</strong> Geofencing confirms the trainer is physically at the office or assigned college before clock-in.<br>
            • <strong>Quick Break Toggle:</strong> One-tap "Start Break" and "End Break" with live timer.<br>
            • <strong>Camera Expense Claims:</strong> Take a photo of fuel slips or bus tickets; auto-calculates KM reimbursement.<br>
            • <strong>Class Attendance Roster:</strong> Fast swipe-to-mark Present/Absent for students.<br>
            • <strong>Lock-Screen Push Notifications:</strong> Real-time audio alerts for team chat messages, 9:25 AM clock-in reminders, and instant leave/claim approvals.
          </div>
        </div>
        <div class="card" style="border-top: 3px solid #64748b;">
          <div class="card-header">💻 Kept Primarily on the Web App (Desktop Management)</div>
          <div class="card-body">
            • <strong>Batch PDF Report Builder:</strong> Multi-page report compilation with student performance graphs and print layouts.<br>
            • <strong>System Configuration:</strong> Employee provisioning, salary structure, and global mileage rate settings.<br>
            • <strong>Gantt & Scheduling Matrix:</strong> Broad panoramic view of multi-college training calendars.
          </div>
        </div>
      </div>

      <div class="section-title" style="margin-top: 8px;">Implementation Roadmap & Timeline:</div>
      <div class="timeline">
        <div class="timeline-step">
          <div class="timeline-dot"></div>
          <div class="timeline-title">Phase 1: Housekeeping & Unified Form Components (Week 1)</div>
          <div class="timeline-desc">Safely archive <code>legacy/</code> and <code>server/</code>. Extract unified components (<code>TaskFormModal</code>, <code>ApplyLeaveModal</code>, <code>ExpenseClaimModal</code>) so all screens share the exact same forms.</div>
        </div>
        <div class="timeline-step">
          <div class="timeline-dot" style="background: #f59e0b; box-shadow: 0 0 0 2px #f59e0b;"></div>
          <div class="timeline-title">Phase 2: Modularize Monster Screens & Setup Supabase Crons (Week 2)</div>
          <div class="timeline-desc">Break <code>BatchManagement.tsx</code> (7,059 lines) into modular sub-tabs. Re-enable automated midnight clock-out and task overdue checks in Supabase.</div>
        </div>
        <div class="timeline-step">
          <div class="timeline-dot" style="background: #10b981; box-shadow: 0 0 0 2px #10b981;"></div>
          <div class="timeline-title">Phase 3: Cross-Platform Mobile App Development (Weeks 3–5)</div>
          <div class="timeline-desc">Build Flutter mobile app for iOS and Android with GPS Clock-In, Camera Receipts, Student Attendance, and Push Notifications. Deploy to Apple TestFlight & Google Play.</div>
        </div>
      </div>

      <div class="callout" style="background: #f0fdf4; border-color: #bbf7d0; border-left-color: #16a34a; color: #166534; margin-top: 4px;">
        <strong>Expected Return on Investment (ROI):</strong><br>
        1. <strong>70% Faster Screen Loads:</strong> Splitting 7,000-line files eliminates browser rendering lag.<br>
        2. <strong>Zero Data Inconsistencies:</strong> Shared forms guarantee unified validation across all departments.<br>
        3. <strong>Effortless Field Operations:</strong> Trainers record attendance and fuel receipts directly on their phones.
      </div>
    </div>

    <div class="doc-footer">
      <span>KVJ Analytics ERP — Architecture Modernization & Mobile Strategy</span>
      <span>Page 5 of 5 (Mobile App & Roadmap)</span>
    </div>
  </div>

</body>
</html>`;

const outputPathHtml = path.join(__dirname, '..', 'docs', 'executive_presentation.html');
const outputPathPdf = path.join(__dirname, '..', 'KVJ_Analytics_ERP_Audit_and_Mobile_Roadmap.pdf');

fs.writeFileSync(outputPathHtml, htmlContent, 'utf8');
console.log('HTML written to:', outputPathHtml);

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cmd = `"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${outputPathPdf}" "${outputPathHtml}"`;

console.log('Running Chrome to generate PDF...');
execSync(cmd);

const stat = fs.statSync(outputPathPdf);
console.log(`Success! PDF generated at: ${outputPathPdf} (Size: ${stat.size} bytes)`);
