/**
 * Daily Training Report Types & Interfaces
 */

export type SectionId =
  | 'cover'
  | 'executive-summary'
  | 'batch-info'
  | 'attendance-summary'
  | 'attendance-charts'
  | 'datewise-attendance'
  | 'absent-students'
  | 'student-attendance-details'
  | 'assessment-status'
  | 'assessment-charts'
  | 'failed-students'
  | 'not-attended-students'
  | 'final-exam-eligibility'
  | 'eligibility-charts'
  | 'student-data'
  | 'progress-analytics'
  | 'risk-analysis'
  | 'trainer-notes'
  | 'attachments-summary';

export type StudentColumnId =
  | 'registerNo'
  | 'studentName'
  | 'gender'
  | 'hasComputer'
  | 'learnedBefore'
  | 'attendancePct'
  | 'assessmentStatus'
  | 'finalExamEligibility'
  | string; // Allows dynamic assessment IDs like 'ass-1', 'ass-2'

export interface DailyReportConfig {
  selectedSections: SectionId[];
  selectedAssessmentIds: string[];
  selectedStudentColumns: StudentColumnId[];
  trainerNotes: string;
}

export interface AssessmentDefinition {
  id: string;
  title: string;
  type: string;
  maxMarks: number;
  passMarkPercent: number; // e.g. 84 or custom
  isCustomPassMark?: boolean;
}

export interface SessionAttendanceRecord {
  date: string; // YYYY-MM-DD
  presentCount: number;
  absentCount: number;
  lateCount: number;
  totalStudents: number;
  attendancePct: number;
  absentStudentIds: string[];
}

export interface AssessmentAttempt {
  date: string; // YYYY-MM-DD
  marks: number;
  maxMarks: number;
  passed: boolean;
}

export interface StudentAssessmentScore {
  marks: number; // Highest mark achieved across all attempts
  maxMarks: number;
  grade: string;
  passed: boolean;
  attempted: boolean;
  date?: string;
  attempts?: AssessmentAttempt[];
}

export interface StudentReportRow {
  id: string;
  registerNo: string;
  phone: string;
  name: string;
  email: string;
  college: string;
  batch: string;
  avatarUrl?: string;
  gender?: 'Male' | 'Female';
  hasComputer?: 'Yes' | 'No';
  learnedBefore?: 'Yes' | 'No';
  attendancePct: number;
  totalPresent: number;
  totalSessions: number;
  assessmentScores: Record<string, StudentAssessmentScore>;
  assessmentStatus: 'Completed' | 'Pending' | 'Failed';
  finalExamEligibility: 'Eligible' | 'Not Eligible';
  eligibilityReason?: string;
  remarks?: string;
}

export interface DailyProgressMilestone {
  date: string;
  sessionNo: number;
  topicCovered: string;
  practicalDone: boolean;
  status: 'Completed' | 'In Progress' | 'Upcoming';
}

export interface StudentRiskItem {
  studentId: string;
  studentName: string;
  registerNo: string;
  riskReason: 'Low Attendance (<75%)' | 'Failed Assessments' | 'Pending Assessments' | 'Multiple Issues';
  attendancePct: number;
  failedCount: number;
  severity: 'High' | 'Medium' | 'Low';
}

export interface BatchCertificateStatus {
  printed: boolean;
  issuedCount: number;
  pendingCount: number;
}

export interface DailyReportData {
  reportDate: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  collegeName: string;
  courseName: string;
  academicYear: string;
  trainerName: string;
  coordinatorName: string;
  totalStudents: number;
  courseMaxMarks: number;
  finalExamPassMarkPercent: number; // e.g. 70
  assessments: AssessmentDefinition[];
  sessions: SessionAttendanceRecord[];
  students: StudentReportRow[];
  progressMilestones: DailyProgressMilestone[];
  riskItems: StudentRiskItem[];
  certificates?: any;
  certificateStatus?: any;
  attachments?: any[];
  defaultTrainerNotes: string;
}
