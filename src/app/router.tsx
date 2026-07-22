/**
 * KVJ Analytics — Routing architecture (Phase-1 §2)
 * Public + protected + permission-guarded routes, lazy loading with a Suspense
 * boundary, an error boundary, and 404/403 pages. Business routes are NOT added
 * here yet — only the app framework, workspaces, dashboard and showcase.
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { ProtectedRoute } from '../shared/permissions/react';
import { RouteLoading, NotFound, Forbidden } from './pages/errors/ErrorPages';
import { CommandRegistrar } from './CommandRegistrar';

// Lazy-loaded pages (code-splitting).
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const SessionExpired = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.SessionExpired })));
const LockedAccount = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LockedAccount })));
const MyDayPage = lazy(() => import('./pages/workspaces/WorkspacePages').then((m) => ({ default: m.MyDayPage })));
const DashboardPage = lazy(() => import('./pages/workspaces/WorkspacePages').then((m) => ({ default: m.DashboardPage })));
const RoleWorkspacePage = lazy(() => import('./pages/workspaces/WorkspacePages').then((m) => ({ default: m.RoleWorkspacePage })));
const ShowcasePage = lazy(() => import('./pages/ShowcasePage').then((m) => ({ default: m.ShowcasePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const EmployeeDirectory = lazy(() => import('../modules/employee/pages/EmployeeDirectory').then((m) => ({ default: m.EmployeeDirectory })));
const EmployeeProfile = lazy(() => import('../modules/employee/pages/EmployeeProfile').then((m) => ({ default: m.EmployeeProfile })));
const AttendanceLogPage = lazy(() => import('../modules/attendance/pages/AttendanceLogPage').then((m) => ({ default: m.AttendanceLogPage })));
const LeaveBoard = lazy(() => import('../modules/leave/pages/LeaveBoard').then((m) => ({ default: m.LeaveBoard })));
const ApprovalsQueue = lazy(() => import('../modules/attendance/pages/ApprovalsQueue').then((m) => ({ default: m.ApprovalsQueue })));

// Training & Student Lifecycle
const CourseList = lazy(() => import('../modules/training/pages/CourseList').then((m) => ({ default: m.CourseList })));
const BatchManagement = lazy(() => import('../modules/training/pages/BatchManagement').then((m) => ({ default: m.BatchManagement })));
const TrainingCalendar = lazy(() => import('../modules/training/pages/TrainingCalendar').then((m) => ({ default: m.TrainingCalendar })));
const ProjectsAndTasks = lazy(() => import('../modules/project/pages/ProjectsAndTasks').then((m) => ({ default: m.ProjectsAndTasks })));
const StudentLifecycle = lazy(() => import('../modules/training/pages/StudentLifecycle').then((m) => ({ default: m.StudentLifecycle })));
const StudentAttendance = lazy(() => import('../modules/training/pages/StudentAttendance').then((m) => ({ default: m.StudentAttendance })));
const AssessmentBoard = lazy(() => import('../modules/training/pages/AssessmentBoard').then((m) => ({ default: m.AssessmentBoard })));

// Project & Resource Management
const ClientDirectory = lazy(() => import('../modules/project/pages/ClientDirectory').then((m) => ({ default: m.ClientDirectory })));
const ProjectList = lazy(() => import('../modules/project/pages/ProjectList').then((m) => ({ default: m.ProjectList })));
const ResourceScheduler = lazy(() => import('../modules/project/pages/ResourceScheduler').then((m) => ({ default: m.ResourceScheduler })));
const TaskBoard = lazy(() => import('../modules/project/pages/TaskBoard').then((m) => ({ default: m.TaskBoard })));
const TimesheetTracker = lazy(() => import('../modules/project/pages/TimesheetTracker').then((m) => ({ default: m.TimesheetTracker })));

// Finance & Operations Management
const ExpenseClaims = lazy(() => import('../modules/finance/pages/ExpenseClaims').then((m) => ({ default: m.ExpenseClaims })));
const ProcurementBoard = lazy(() => import('../modules/finance/pages/ProcurementBoard').then((m) => ({ default: m.ProcurementBoard })));
const AssetInventory = lazy(() => import('../modules/finance/pages/AssetInventory').then((m) => ({ default: m.AssetInventory })));
const BudgetsConsole = lazy(() => import('../modules/finance/pages/BudgetsConsole').then((m) => ({ default: m.BudgetsConsole })));
const PayrollPrep = lazy(() => import('../modules/finance/pages/PayrollPrep').then((m) => ({ default: m.PayrollPrep })));

// Communication & Collaboration Platform
const ChatChannels = lazy(() => import('../modules/communication/pages/ChatChannels').then((m) => ({ default: m.ChatChannels })));
const AnnouncementsBoard = lazy(() => import('../modules/communication/pages/AnnouncementsBoard').then((m) => ({ default: m.AnnouncementsBoard })));
const EmailCenter = lazy(() => import('../modules/communication/pages/EmailCenter').then((m) => ({ default: m.EmailCenter })));
const ReminderCenter = lazy(() => import('../modules/communication/pages/ReminderCenter').then((m) => ({ default: m.ReminderCenter })));

// Executive Analytics & BI Platform
const ExecutiveConsole = lazy(() => import('../modules/analytics/pages/ExecutiveConsole').then((m) => ({ default: m.ExecutiveConsole })));
const ReportBuilder = lazy(() => import('../modules/analytics/pages/ReportBuilder').then((m) => ({ default: m.ReportBuilder })));
const KpiRegistryPage = lazy(() => import('../modules/analytics/pages/KpiRegistryPage').then((m) => ({ default: m.KpiRegistryPage })));
const PowerBiGateway = lazy(() => import('../modules/analytics/pages/PowerBiGateway').then((m) => ({ default: m.PowerBiGateway })));

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

          {/* Protected app */}
          <Route path="/app" element={<ProtectedRoute><MyDayPage /></ProtectedRoute>} />
          <Route path="/app/dashboard" element={<ProtectedRoute resource="dashboard" action="view"><DashboardPage /></ProtectedRoute>} />
          <Route path="/app/workspace/supervisor" element={<ProtectedRoute><RoleWorkspacePage role="supervisor" /></ProtectedRoute>} />
          <Route path="/app/workspace/manager" element={<ProtectedRoute><RoleWorkspacePage role="manager" /></ProtectedRoute>} />
          <Route path="/app/workspace/ceo" element={<ProtectedRoute><RoleWorkspacePage role="ceo" /></ProtectedRoute>} />
          <Route path="/app/employees" element={<ProtectedRoute resource="employee" action="view"><EmployeeDirectory /></ProtectedRoute>} />
          <Route path="/app/employees/:id" element={<ProtectedRoute resource="employee" action="view"><EmployeeProfile /></ProtectedRoute>} />
          <Route path="/app/attendance" element={<ProtectedRoute resource="attendance" action="view"><AttendanceLogPage /></ProtectedRoute>} />
          <Route path="/app/leave" element={<ProtectedRoute resource="leave" action="view"><LeaveBoard /></ProtectedRoute>} />
          <Route path="/app/approvals" element={<ProtectedRoute resource="leave" action="approve"><ApprovalsQueue /></ProtectedRoute>} />
          <Route path="/app/showcase" element={<ProtectedRoute><ShowcasePage /></ProtectedRoute>} />
          <Route path="/app/settings" element={<ProtectedRoute resource="settings" action="view"><SettingsPage /></ProtectedRoute>} />

          {/* Training Platform */}
          <Route path="/app/training/courses" element={<ProtectedRoute resource="training" action="view"><CourseList /></ProtectedRoute>} />
          <Route path="/app/training/batches" element={<ProtectedRoute resource="training" action="view"><BatchManagement /></ProtectedRoute>} />
          <Route path="/app/training/details" element={<ProtectedRoute resource="training" action="view"><BatchManagement /></ProtectedRoute>} />
          <Route path="/app/training/calendar" element={<ProtectedRoute resource="training" action="view"><TrainingCalendar /></ProtectedRoute>} />
          <Route path="/app/training/students" element={<ProtectedRoute resource="training" action="view"><StudentLifecycle /></ProtectedRoute>} />
          <Route path="/app/training/attendance" element={<ProtectedRoute resource="training" action="view"><StudentAttendance /></ProtectedRoute>} />
          <Route path="/app/training/assessments" element={<ProtectedRoute resource="training" action="view"><AssessmentBoard /></ProtectedRoute>} />

          {/* Project & Resource Management */}
          <Route path="/app/projects" element={<ProtectedRoute resource="project" action="view"><ProjectsAndTasks /></ProtectedRoute>} />
          <Route path="/app/project/clients" element={<ProtectedRoute resource="project" action="view"><ClientDirectory /></ProtectedRoute>} />
          <Route path="/app/project/list" element={<ProtectedRoute resource="project" action="view"><ProjectList /></ProtectedRoute>} />
          <Route path="/app/project/resources" element={<ProtectedRoute resource="project" action="view"><ResourceScheduler /></ProtectedRoute>} />
          <Route path="/app/project/tasks" element={<ProtectedRoute resource="project" action="view"><TaskBoard /></ProtectedRoute>} />
          <Route path="/app/project/timesheets" element={<ProtectedRoute resource="project" action="view"><TimesheetTracker /></ProtectedRoute>} />

          {/* Finance & Operations Management */}
          <Route path="/app/finance/expenses" element={<ProtectedRoute resource="expense" action="view"><ExpenseClaims /></ProtectedRoute>} />
          <Route path="/app/finance/procurement" element={<ProtectedRoute resource="expense" action="view"><ProcurementBoard /></ProtectedRoute>} />
          <Route path="/app/finance/assets" element={<ProtectedRoute resource="expense" action="view"><AssetInventory /></ProtectedRoute>} />
          <Route path="/app/finance/budgets" element={<ProtectedRoute resource="expense" action="view"><BudgetsConsole /></ProtectedRoute>} />
          <Route path="/app/finance/payroll" element={<ProtectedRoute resource="expense" action="view"><PayrollPrep /></ProtectedRoute>} />

          {/* Communication & Collaboration Platform */}
          <Route path="/app/communication/chat" element={<ProtectedRoute resource="chat" action="view"><ChatChannels /></ProtectedRoute>} />
          <Route path="/app/communication/announcements" element={<ProtectedRoute resource="chat" action="view"><AnnouncementsBoard /></ProtectedRoute>} />
          <Route path="/app/communication/emails" element={<ProtectedRoute resource="chat" action="view"><EmailCenter /></ProtectedRoute>} />
          <Route path="/app/communication/reminders" element={<ProtectedRoute resource="chat" action="view"><ReminderCenter /></ProtectedRoute>} />

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





