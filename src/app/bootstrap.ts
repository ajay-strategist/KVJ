import { container } from '../core/registry';
import { EMPLOYEE_REPOSITORY_TOKEN } from '../modules/employee/employee.repository';
import { AUTH_SERVICE_TOKEN, MockAuthService } from '../modules/auth/auth.service';
import { registerDemoWidgets } from './widgets/demo-widgets';
import { MockEmployeeRepository } from '../modules/employee/mock-employee.repository';
import { EMPLOYEE_SERVICE_TOKEN, EmployeeService } from '../modules/employee/employee.service';
import { ATTENDANCE_REPOSITORY_TOKEN } from '../modules/attendance/attendance.repository';
import { MockAttendanceRepository } from '../modules/attendance/mock-attendance.repository';
import { ATTENDANCE_SERVICE_TOKEN, AttendanceService } from '../modules/attendance/attendance.service';
import { LEAVE_REPOSITORY_TOKEN } from '../modules/leave/leave.repository';
import { MockLeaveRepository } from '../modules/leave/mock-leave.repository';
import { LEAVE_SERVICE_TOKEN, LeaveService } from '../modules/leave/leave.service';
import { SupabaseEmployeeRepository } from '../modules/employee/supabase-employee.repository';
import { SupabaseAttendanceRepository } from '../modules/attendance/supabase-attendance.repository';
import { SupabaseLeaveRepository } from '../modules/leave/supabase-leave.repository';
import { usesSupabase } from '../config/feature-flags';

// Import platform engines
import { WORKFLOW_ENGINE_TOKEN, WorkflowEngine } from '../core/engines/workflow';
import { APPROVAL_ENGINE_TOKEN, ApprovalEngine } from '../core/engines/approval';
import { AUTOMATION_ENGINE_TOKEN, AutomationEngine } from '../core/engines/automation';
import { NOTIFICATION_ENGINE_TOKEN, NotificationEngine } from '../core/engines/notification';
import { ACTIVITY_ENGINE_TOKEN, ActivityEngine } from '../core/engines/activity';
import { AUDIT_ENGINE_TOKEN, AuditEngine } from '../core/engines/audit';
import { DOCUMENT_ENGINE_TOKEN, DocumentEngine } from '../core/engines/document';
import { TEMPLATE_ENGINE_TOKEN, TemplateEngine } from '../core/engines/template';
import { SCHEDULER_ENGINE_TOKEN, SchedulerEngine } from '../core/engines/scheduler';
import { REPORTING_ENGINE_TOKEN, ReportingEngine } from '../core/engines/reporting';
import {
  AI_SERVICE_TOKEN, MockAIService,
  RECOMMENDATION_ENGINE_TOKEN, MockRecommendationEngine,
  PREDICTION_ENGINE_TOKEN, MockPredictionEngine,
  SUMMARY_ENGINE_TOKEN, MockSummaryEngine,
  PROMPT_REGISTRY_TOKEN, MockPromptRegistry
} from '../core/engines/ai';

// Import Phase 3 repositories
import {
  STUDENT_REPOSITORY_TOKEN,
  COURSE_REPOSITORY_TOKEN,
  BATCH_REPOSITORY_TOKEN,
  ENROLLMENT_REPOSITORY_TOKEN,
  SESSION_ATTENDANCE_REPOSITORY_TOKEN,
  ASSESSMENT_REPOSITORY_TOKEN,
  EXAM_VOUCHER_REPOSITORY_TOKEN,
  CERTIFICATE_REPOSITORY_TOKEN,
  REFERRAL_REPOSITORY_TOKEN,
  ALUMNI_REPOSITORY_TOKEN
} from '../modules/training/training.repository';
import {
  MockStudentRepository,
  MockCourseRepository,
  MockBatchRepository,
  MockEnrollmentRepository,
  MockSessionAttendanceRepository,
  MockAssessmentRepository,
  MockExamVoucherRepository,
  MockCertificateRepository,
  MockReferralRepository,
  MockAlumniRepository
} from '../modules/training/mock-training.repository';
import {
  SupabaseStudentRepository,
  SupabaseCourseRepository,
  SupabaseBatchRepository,
  SupabaseEnrollmentRepository,
  SupabaseSessionAttendanceRepository,
  SupabaseAssessmentRepository,
  SupabaseExamVoucherRepository,
  SupabaseCertificateRepository,
  SupabaseReferralRepository,
  SupabaseAlumniRepository
} from '../modules/training/supabase-training.repository';
import { TRAINING_SERVICE_TOKEN, TrainingService } from '../modules/training/training.service';
import { PROJECT_SERVICE_TOKEN, ProjectService } from '../modules/project/project.service';
import { FINANCE_SERVICE_TOKEN, FinanceService } from '../modules/finance/finance.service';
import { COMMUNICATION_SERVICE_TOKEN, CommunicationService } from '../modules/communication/communication.service';
import { ANALYTICS_SERVICE_TOKEN, AnalyticsService } from '../modules/analytics/analytics.service';





// Import Phase 4 repositories
import {
  CLIENT_REPOSITORY_TOKEN,
  PROJECT_REPOSITORY_TOKEN,
  MILESTONE_REPOSITORY_TOKEN,
  RESOURCE_ALLOCATION_REPOSITORY_TOKEN,
  TASK_REPOSITORY_TOKEN,
  TIMESHEET_REPOSITORY_TOKEN,
  CLIENT_MEETING_REPOSITORY_TOKEN
} from '../modules/project/project.repository';
import {
  MockClientRepository,
  MockProjectRepository,
  MockMilestoneRepository,
  MockResourceAllocationRepository,
  MockTaskRepository,
  MockTimesheetRepository,
  MockClientMeetingRepository
} from '../modules/project/mock-project.repository';
import {
  SupabaseClientRepository,
  SupabaseProjectRepository,
  SupabaseMilestoneRepository,
  SupabaseResourceAllocationRepository,
  SupabaseTaskRepository,
  SupabaseTimesheetRepository,
  SupabaseClientMeetingRepository
} from '../modules/project/supabase-project.repository';

// Import Phase 5 repositories
import {
  BUDGET_REPOSITORY_TOKEN,
  EXPENSE_CLAIM_REPOSITORY_TOKEN,
  TRAVEL_REQUEST_REPOSITORY_TOKEN,
  VENDOR_REPOSITORY_TOKEN,
  PURCHASE_ORDER_REPOSITORY_TOKEN,
  ASSET_REPOSITORY_TOKEN,
  SALARY_STRUCTURE_REPOSITORY_TOKEN
} from '../modules/finance/finance.repository';
import {
  MockBudgetRepository,
  MockExpenseClaimRepository,
  MockTravelRequestRepository,
  MockVendorRepository,
  MockPurchaseOrderRepository,
  MockAssetRepository,
  MockSalaryStructureRepository
} from '../modules/finance/mock-finance.repository';
import {
  SupabaseBudgetRepository,
  SupabaseExpenseClaimRepository,
  SupabaseTravelRequestRepository,
  SupabaseVendorRepository,
  SupabasePurchaseOrderRepository,
  SupabaseAssetRepository,
  SupabaseSalaryStructureRepository
} from '../modules/finance/supabase-finance.repository';

// Import Phase 6 repositories
import {
  CHAT_CHANNEL_REPOSITORY_TOKEN,
  CHAT_MESSAGE_REPOSITORY_TOKEN,
  ANNOUNCEMENT_REPOSITORY_TOKEN,
  EMAIL_LOG_REPOSITORY_TOKEN,
  NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN
} from '../modules/communication/communication.repository';
import {
  MockChatChannelRepository,
  MockChatMessageRepository,
  MockAnnouncementRepository,
  MockEmailLogRepository,
  MockNotificationPreferenceRepository
} from '../modules/communication/mock-communication.repository';
import {
  SupabaseChatChannelRepository,
  SupabaseChatMessageRepository,
  SupabaseAnnouncementRepository,
  SupabaseEmailLogRepository,
  SupabaseNotificationPreferenceRepository
} from '../modules/communication/supabase-communication.repository';

// Import Phase 7 repositories
import {
  KPI_DEFINITION_REPOSITORY_TOKEN,
  SAVED_REPORT_REPOSITORY_TOKEN
} from '../modules/analytics/analytics.repository';
import {
  MockKpiDefinitionRepository,
  MockSavedReportRepository
} from '../modules/analytics/mock-analytics.repository';
import {
  SupabaseKpiDefinitionRepository,
  SupabaseSavedReportRepository
} from '../modules/analytics/supabase-analytics.repository';





export function bootstrap() {
  // Per-module cutover: a module resolves Supabase only when the master switch
  // AND its own flag are on (i.e. once its tables actually exist). Everything
  // else keeps using the in-memory mocks, so a partly-migrated database can
  // never take the whole app down.
  const employeeSb = usesSupabase('employee');
  const attendanceSb = usesSupabase('attendance');
  const leaveSb = usesSupabase('leave');
  const trainingSb = usesSupabase('training');
  const projectSb = usesSupabase('project');
  const financeSb = usesSupabase('finance');
  const commSb = usesSupabase('communication');
  const analyticsSb = usesSupabase('analytics');

  // Employee
  container.register(EMPLOYEE_REPOSITORY_TOKEN, () => employeeSb ? new SupabaseEmployeeRepository() : new MockEmployeeRepository());

  // Attendance
  container.register(ATTENDANCE_REPOSITORY_TOKEN, () => attendanceSb ? new SupabaseAttendanceRepository() : new MockAttendanceRepository());

  // Leave
  container.register(LEAVE_REPOSITORY_TOKEN, () => leaveSb ? new SupabaseLeaveRepository() : new MockLeaveRepository());

  // Training
  container.register(STUDENT_REPOSITORY_TOKEN, () => trainingSb ? new SupabaseStudentRepository() : new MockStudentRepository());
  container.register(COURSE_REPOSITORY_TOKEN, () => trainingSb ? new SupabaseCourseRepository() : new MockCourseRepository());
  container.register(BATCH_REPOSITORY_TOKEN, () => trainingSb ? new SupabaseBatchRepository() : new MockBatchRepository());
  container.register(ENROLLMENT_REPOSITORY_TOKEN, () => trainingSb ? new SupabaseEnrollmentRepository() : new MockEnrollmentRepository());
  container.register(SESSION_ATTENDANCE_REPOSITORY_TOKEN, () => trainingSb ? new SupabaseSessionAttendanceRepository() : new MockSessionAttendanceRepository());
  container.register(ASSESSMENT_REPOSITORY_TOKEN, () => trainingSb ? new SupabaseAssessmentRepository() : new MockAssessmentRepository());
  container.register(EXAM_VOUCHER_REPOSITORY_TOKEN, () => trainingSb ? new SupabaseExamVoucherRepository() : new MockExamVoucherRepository());
  container.register(CERTIFICATE_REPOSITORY_TOKEN, () => trainingSb ? new SupabaseCertificateRepository() : new MockCertificateRepository());
  container.register(REFERRAL_REPOSITORY_TOKEN, () => trainingSb ? new SupabaseReferralRepository() : new MockReferralRepository());
  container.register(ALUMNI_REPOSITORY_TOKEN, () => trainingSb ? new SupabaseAlumniRepository() : new MockAlumniRepository());

  // Project
  container.register(CLIENT_REPOSITORY_TOKEN, () => projectSb ? new SupabaseClientRepository() : new MockClientRepository());
  container.register(PROJECT_REPOSITORY_TOKEN, () => projectSb ? new SupabaseProjectRepository() : new MockProjectRepository());
  container.register(MILESTONE_REPOSITORY_TOKEN, () => projectSb ? new SupabaseMilestoneRepository() : new MockMilestoneRepository());
  container.register(RESOURCE_ALLOCATION_REPOSITORY_TOKEN, () => projectSb ? new SupabaseResourceAllocationRepository() : new MockResourceAllocationRepository());
  container.register(TASK_REPOSITORY_TOKEN, () => projectSb ? new SupabaseTaskRepository() : new MockTaskRepository());
  container.register(TIMESHEET_REPOSITORY_TOKEN, () => projectSb ? new SupabaseTimesheetRepository() : new MockTimesheetRepository());
  container.register(CLIENT_MEETING_REPOSITORY_TOKEN, () => projectSb ? new SupabaseClientMeetingRepository() : new MockClientMeetingRepository());

  // Finance
  container.register(BUDGET_REPOSITORY_TOKEN, () => financeSb ? new SupabaseBudgetRepository() : new MockBudgetRepository());
  container.register(EXPENSE_CLAIM_REPOSITORY_TOKEN, () => financeSb ? new SupabaseExpenseClaimRepository() : new MockExpenseClaimRepository());
  container.register(TRAVEL_REQUEST_REPOSITORY_TOKEN, () => financeSb ? new SupabaseTravelRequestRepository() : new MockTravelRequestRepository());
  container.register(VENDOR_REPOSITORY_TOKEN, () => financeSb ? new SupabaseVendorRepository() : new MockVendorRepository());
  container.register(PURCHASE_ORDER_REPOSITORY_TOKEN, () => financeSb ? new SupabasePurchaseOrderRepository() : new MockPurchaseOrderRepository());
  container.register(ASSET_REPOSITORY_TOKEN, () => financeSb ? new SupabaseAssetRepository() : new MockAssetRepository());
  container.register(SALARY_STRUCTURE_REPOSITORY_TOKEN, () => financeSb ? new SupabaseSalaryStructureRepository() : new MockSalaryStructureRepository());

  // Communication
  container.register(CHAT_CHANNEL_REPOSITORY_TOKEN, () => commSb ? new SupabaseChatChannelRepository() : new MockChatChannelRepository());
  container.register(CHAT_MESSAGE_REPOSITORY_TOKEN, () => commSb ? new SupabaseChatMessageRepository() : new MockChatMessageRepository());
  container.register(ANNOUNCEMENT_REPOSITORY_TOKEN, () => commSb ? new SupabaseAnnouncementRepository() : new MockAnnouncementRepository());
  container.register(EMAIL_LOG_REPOSITORY_TOKEN, () => commSb ? new SupabaseEmailLogRepository() : new MockEmailLogRepository());
  container.register(NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN, () => commSb ? new SupabaseNotificationPreferenceRepository() : new MockNotificationPreferenceRepository());

  // Analytics
  container.register(KPI_DEFINITION_REPOSITORY_TOKEN, () => analyticsSb ? new SupabaseKpiDefinitionRepository() : new MockKpiDefinitionRepository());
  container.register(SAVED_REPORT_REPOSITORY_TOKEN, () => analyticsSb ? new SupabaseSavedReportRepository() : new MockSavedReportRepository());


  // Register services
  container.register(EMPLOYEE_SERVICE_TOKEN, () => new EmployeeService());
  container.register(ATTENDANCE_SERVICE_TOKEN, () => new AttendanceService());
  container.register(LEAVE_SERVICE_TOKEN, () => new LeaveService());
  container.register(TRAINING_SERVICE_TOKEN, () => new TrainingService());
  container.register(PROJECT_SERVICE_TOKEN, () => new ProjectService());
  container.register(FINANCE_SERVICE_TOKEN, () => new FinanceService());
  container.register(COMMUNICATION_SERVICE_TOKEN, () => new CommunicationService());
  container.register(ANALYTICS_SERVICE_TOKEN, () => new AnalyticsService());
  container.register(AUTH_SERVICE_TOKEN, () => new MockAuthService());

  // Register platform engines
  container.register(WORKFLOW_ENGINE_TOKEN, () => new WorkflowEngine());
  container.register(APPROVAL_ENGINE_TOKEN, () => new ApprovalEngine());
  container.register(AUTOMATION_ENGINE_TOKEN, () => new AutomationEngine());
  container.register(NOTIFICATION_ENGINE_TOKEN, () => new NotificationEngine());
  container.register(ACTIVITY_ENGINE_TOKEN, () => new ActivityEngine());
  container.register(AUDIT_ENGINE_TOKEN, () => new AuditEngine());
  container.register(DOCUMENT_ENGINE_TOKEN, () => new DocumentEngine());
  container.register(TEMPLATE_ENGINE_TOKEN, () => new TemplateEngine());
  container.register(SCHEDULER_ENGINE_TOKEN, () => new SchedulerEngine());
  container.register(REPORTING_ENGINE_TOKEN, () => new ReportingEngine());

  // Register AI Ready Stubs
  container.register(AI_SERVICE_TOKEN, () => new MockAIService());
  container.register(RECOMMENDATION_ENGINE_TOKEN, () => new MockRecommendationEngine());
  container.register(PREDICTION_ENGINE_TOKEN, () => new MockPredictionEngine());
  container.register(SUMMARY_ENGINE_TOKEN, () => new MockSummaryEngine());
  container.register(PROMPT_REGISTRY_TOKEN, () => new MockPromptRegistry());

  // Register dashboard widgets once
  registerDemoWidgets();
}







