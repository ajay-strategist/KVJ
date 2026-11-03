/**
 * KVJ Analytics — Routing architecture (Phase-1 §2)
 * Public + protected + permission-guarded routes, lazy loading with a Suspense
 * boundary, an error boundary, and 404/403 pages. Business routes are NOT added
 * here yet — only the app framework, workspaces, dashboard and showcase.
 */

import { lazy, Suspense, type ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { ProtectedRoute } from '../shared/permissions/react';
import { RouteLoading, NotFound, Forbidden } from './pages/errors/ErrorPages';
import { CommandRegistrar } from './CommandRegistrar';

function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const isChunkLoadFailed =
        err?.name === 'ChunkLoadError' ||
        err?.message?.includes('dynamically imported module') ||
        err?.message?.includes('Importing a module script failed') ||
        err?.message?.includes('Failed to fetch');

      const storageKey = 'kvj_last_chunk_reload';
      const lastReload = Number(sessionStorage.getItem(storageKey) || 0);
      const now = Date.now();

      if (isChunkLoadFailed && now - lastReload > 8000) {
        sessionStorage.setItem(storageKey, String(now));
        window.location.reload();
      }
      throw err;
    }
  });
}

// Lazy-loaded pages (code-splitting with chunk reload resilience).
const LoginPage = lazyWithRetry(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const SessionExpired = lazyWithRetry(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.SessionExpired })));
const LockedAccount = lazyWithRetry(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LockedAccount })));
const MyDayPage = lazyWithRetry(() => import('./pages/workspaces/MyDayPage').then((m) => ({ default: m.MyDayPage })));
const DashboardPage = lazyWithRetry(() => import('./pages/workspaces/ExecutiveDashboardPage').then((m) => ({ default: m.DashboardPage })));
const RoleWorkspacePage = lazyWithRetry(() => import('./pages/workspaces/RoleWorkspacePage').then((m) => ({ default: m.RoleWorkspacePage })));
const ShowcasePage = lazyWithRetry(() => import('./pages/ShowcasePage').then((m) => ({ default: m.ShowcasePage })));
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const EmployeeDirectory = lazyWithRetry(() => import('../modules/employee/pages/EmployeeDirectory').then((m) => ({ default: m.EmployeeDirectory })));
const EmployeeProfile = lazyWithRetry(() => import('../modules/employee/pages/EmployeeProfile').then((m) => ({ default: m.EmployeeProfile })));
const AttendanceLogPage = lazyWithRetry(() => import('../modules/attendance/pages/AttendanceLogPage').then((m) => ({ default: m.AttendanceLogPage })));
const LeaveBoard = lazyWithRetry(() => import('../modules/leave/pages/LeaveBoard').then((m) => ({ default: m.LeaveBoard })));
const ApprovalsQueue = lazyWithRetry(() => import('../modules/attendance/pages/ApprovalsQueue').then((m) => ({ default: m.ApprovalsQueue })));

// Training & Student Lifecycle
const CourseList = lazyWithRetry(() => import('../modules/training/pages/CourseList').then((m) => ({ default: m.CourseList })));
const BatchManagement = lazyWithRetry(() => import('../modules/training/pages/BatchManagement').then((m) => ({ default: m.BatchManagement })));
const TrainingCalendar = lazyWithRetry(() => import('../modules/training/pages/TrainingCalendar').then((m) => ({ default: m.TrainingCalendar })));
const ProjectsAndTasks = lazyWithRetry(() => import('../modules/project/pages/ProjectsAndTasks').then((m) => ({ default: m.ProjectsAndTasks })));
const StudentLifecycle = lazyWithRetry(() => import('../modules/training/pages/StudentLifecycle').then((m) => ({ default: m.StudentLifecycle })));
const StudentAttendance = lazyWithRetry(() => import('../modules/training/pages/StudentAttendance').then((m) => ({ default: m.StudentAttendance })));
const AssessmentBoard = lazyWithRetry(() => import('../modules/training/pages/AssessmentBoard').then((m) => ({ default: m.AssessmentBoard })));
const FinalExamModule = lazyWithRetry(() => import('../modules/training/pages/FinalExamModule').then((m) => ({ default: m.FinalExamModule })));
const ExamSubmissionPage = lazyWithRetry(() => import('../modules/training/pages/ExamSubmissionPage').then((m) => ({ default: m.ExamSubmissionPage })));

// Project & Resource Management
const ClientDirectory = lazyWithRetry(() => import('../modules/project/pages/ClientDirectory').then((m) => ({ default: m.ClientDirectory })));
const ProjectList = lazyWithRetry(() => import('../modules/project/pages/ProjectList').then((m) => ({ default: m.ProjectList })));
const ResourceScheduler = lazyWithRetry(() => import('../modules/project/pages/ResourceScheduler').then((m) => ({ default: m.ResourceScheduler })));
const TaskBoard = lazyWithRetry(() => import('../modules/project/pages/TaskBoard').then((m) => ({ default: m.TaskBoard })));
const TimesheetTracker = lazyWithRetry(() => import('../modules/project/pages/TimesheetTracker').then((m) => ({ default: m.TimesheetTracker })));

// Finance Management (Expenses & Travel Claims, Expense Analytics)
const ExpenseClaims = lazyWithRetry(() => import('../modules/finance/pages/ExpenseClaims').then((m) => ({ default: m.ExpenseClaims })));
const ExpenseAnalyticsPage = lazyWithRetry(() => import('../modules/finance/pages/ExpenseAnalyticsPage').then((m) => ({ default: m.ExpenseAnalyticsPage })));

// Communication & Collaboration Platform
const ChatChannels = lazyWithRetry(() => import('../modules/communication/pages/ChatChannels').then((m) => ({ default: m.ChatChannels })));
const AnnouncementsBoard = lazyWithRetry(() => import('../modules/communication/pages/AnnouncementsBoard').then((m) => ({ default: m.AnnouncementsBoard })));
const EmailCenter = lazyWithRetry(() => import('../modules/communication/pages/EmailCenter').then((m) => ({ default: m.EmailCenter })));
const ReminderCenter = lazyWithRetry(() => import('../modules/communication/pages/ReminderCenter').then((m) => ({ default: m.ReminderCenter })));
const IssuesPage = lazyWithRetry(() => import('../modules/issues/pages/IssuesPage').then((m) => ({ default: m.IssuesPage })));

// Executive Analytics & BI Platform
const ExecutiveConsole = lazyWithRetry(() => import('../modules/analytics/pages/ExecutiveConsole').then((m) => ({ default: m.ExecutiveConsole })));
const ReportBuilder = lazyWithRetry(() => import('../modules/analytics/pages/ReportBuilder').then((m) => ({ default: m.ReportBuilder })));
const KpiRegistryPage = lazyWithRetry(() => import('../modules/analytics/pages/KpiRegistryPage').then((m) => ({ default: m.KpiRegistryPage })));
const PowerBiGateway = lazyWithRetry(() => import('../modules/analytics/pages/PowerBiGateway').then((m) => ({ default: m.PowerBiGateway })));

export function AppRouter() {
  return (
    <ErrorBoundary>
      <CommandRegistrar />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/session-expired" element={<SessionExpired />} />
          <Route path="/locked" element={<LockedAccount />} />
          <Route path="/403" element={<Forbidden />} />
          <Route path="/submit-exam" element={<ExamSubmissionPage />} />

          {/* Protected app */}
          <Route path="/app" element={<ProtectedRoute><MyDayPage /></ProtectedRoute>} />
          <Route path="/app/dashboard" element={<ProtectedRoute resource="dashboard" action="view"><DashboardPage /></ProtectedRoute>} />
          <Route path="/app/workspace/supervisor" element={<ProtectedRoute><RoleWorkspacePage role="supervisor" /></ProtectedRoute>} />
          <Route path="/app/workspace/manager" element={<ProtectedRoute><RoleWorkspacePage role="manager" /></ProtectedRoute>} />
          <Route path="/app/workspace/ceo" element={<ProtectedRoute><RoleWorkspacePage role="ceo" /></ProtectedRoute>} />
          <Route path="/app/employees" element={<ProtectedRoute resource="employee" action="view"><EmployeeDirectory defaultTabId="directory" /></ProtectedRoute>} />
          <Route path="/app/employees/status" element={<ProtectedRoute resource="employee" action="view"><EmployeeDirectory defaultTabId="status" /></ProtectedRoute>} />
          <Route path="/app/employees/:id" element={<ProtectedRoute resource="employee" action="view"><EmployeeProfile /></ProtectedRoute>} />
          <Route path="/app/attendance" element={<ProtectedRoute resource="attendance" action="view"><AttendanceLogPage /></ProtectedRoute>} />
          <Route path="/app/leave" element={<ProtectedRoute resource="leave" action="view"><LeaveBoard /></ProtectedRoute>} />
          <Route path="/app/approvals" element={<ProtectedRoute><ApprovalsQueue /></ProtectedRoute>} />
          <Route path="/app/showcase" element={<ProtectedRoute><ShowcasePage /></ProtectedRoute>} />
          <Route path="/app/settings" element={<ProtectedRoute resource="settings" action="view"><SettingsPage /></ProtectedRoute>} />

          {/* Training Platform */}
          <Route path="/app/training/courses" element={<ProtectedRoute resource="training" action="view"><CourseList defaultTab="courses" /></ProtectedRoute>} />
          <Route path="/app/training/colleges" element={<ProtectedRoute resource="training" action="view"><CourseList defaultTab="colleges" /></ProtectedRoute>} />
          <Route path="/app/training/batches" element={<ProtectedRoute resource="training" action="view"><BatchManagement /></ProtectedRoute>} />
          <Route path="/app/training/details" element={<ProtectedRoute resource="training" action="view"><BatchManagement /></ProtectedRoute>} />
          <Route path="/app/training/calendar" element={<ProtectedRoute resource="training" action="view"><TrainingCalendar /></ProtectedRoute>} />
          <Route path="/app/training/students" element={<ProtectedRoute resource="training" action="view"><StudentLifecycle /></ProtectedRoute>} />
          <Route path="/app/training/attendance" element={<ProtectedRoute resource="training" action="view"><StudentAttendance /></ProtectedRoute>} />
          <Route path="/app/training/assessments" element={<ProtectedRoute resource="training" action="view"><AssessmentBoard /></ProtectedRoute>} />
          <Route path="/app/training/final-exam" element={<ProtectedRoute resource="training" action="view"><FinalExamModule /></ProtectedRoute>} />

          {/* Project & Resource Management */}
          <Route path="/app/projects" element={<ProtectedRoute resource="project" action="view"><ProjectsAndTasks /></ProtectedRoute>} />
          <Route path="/app/project/clients" element={<ProtectedRoute resource="project" action="view"><ClientDirectory /></ProtectedRoute>} />
          <Route path="/app/project/list" element={<ProtectedRoute resource="project" action="view"><ProjectList /></ProtectedRoute>} />
          <Route path="/app/project/resources" element={<ProtectedRoute resource="project" action="view"><ResourceScheduler /></ProtectedRoute>} />
          <Route path="/app/project/tasks" element={<ProtectedRoute resource="project" action="view"><TaskBoard /></ProtectedRoute>} />
          <Route path="/app/project/timesheets" element={<ProtectedRoute resource="project" action="view"><TimesheetTracker /></ProtectedRoute>} />

          {/* Finance Management */}
          <Route path="/app/finance/expenses" element={<ProtectedRoute resource="expense" action="view"><ExpenseClaims /></ProtectedRoute>} />
          <Route path="/app/finance/expense-analytics" element={<ProtectedRoute resource="expense" action="view"><ExpenseAnalyticsPage /></ProtectedRoute>} />

          {/* Communication & Collaboration Platform */}
          <Route path="/app/communication/chat" element={<ProtectedRoute resource="chat" action="view"><ChatChannels /></ProtectedRoute>} />
          <Route path="/app/communication/announcements" element={<ProtectedRoute resource="chat" action="view"><AnnouncementsBoard /></ProtectedRoute>} />
          <Route path="/app/communication/emails" element={<ProtectedRoute resource="chat" action="view"><EmailCenter /></ProtectedRoute>} />
          <Route path="/app/communication/reminders" element={<ProtectedRoute resource="chat" action="view"><ReminderCenter /></ProtectedRoute>} />

          {/* Support & Issue Tracking */}
          <Route path="/app/issues" element={<ProtectedRoute><IssuesPage /></ProtectedRoute>} />

          {/* Executive Analytics & BI Platform */}
          <Route path="/app/analytics/executive" element={<ProtectedRoute resource="analytics" action="view"><ExecutiveConsole /></ProtectedRoute>} />
          <Route path="/app/analytics/builder" element={<ProtectedRoute resource="analytics" action="view"><ReportBuilder /></ProtectedRoute>} />
          <Route path="/app/analytics/kpis" element={<ProtectedRoute resource="analytics" action="view"><KpiRegistryPage /></ProtectedRoute>} />
          <Route path="/app/analytics/powerbi" element={<ProtectedRoute resource="analytics" action="view"><PowerBiGateway /></ProtectedRoute>} />

          {/* Redirects & 404 */}
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}





