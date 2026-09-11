import type { Batch } from '../training.repository';

export type WorkspaceTab =
  | 'students'
  | 'mark-attendance'
  | 'final-exam'
  | 'retest'
  | 'registration'
  | 'attendance'
  | 'assessments'
  | 'certificates'
  | 'communication'
  | 'documents'
  | 'timeline';

export type StudentSubTab =
  | 'matrix'
  | 'attendance'
  | 'final-exam'
  | 'retest'
  | 'registration'
  | 'certificates';

export type EligibilityFilter = 'all' | 'eligible' | 'not-eligible';
export type SortableCol = 'ass1' | 'ass2' | 'ass3' | 'finalExam' | 'attendancePct';

export interface RegistrationRecord {
  timestamp: string;
  email: string;
  college: string;
  batch: string;
  registerNo: string;
  phone: string;
  name: string;
  gender: string;
  qualification: string;
  hasComputer: string;
  learnedBefore: string;
  certiportUser: string;
  photoUrl: string;
}

export interface ChecklistItem {
  id: string;
  task: string;
  checked: boolean;
  assigned: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  commentsCount: number;
}

export interface StudentRecord {
  id: string;
  registerNo?: string;
  name: string;
  photo: string;
  photoUrl?: string;
  phone: string;
  email: string;
  college: string;
  department: string;
  course?: string;
  examDate?: string;
  examAttemptCount?: number;
  attendancePct: number;
  attendanceStatus: 'Regular' | 'Irregular' | 'Critical';
  ass1: number;
  ass2: number;
  ass3: number;
  project: number;
  finalExam: number;
  overallScore: number;
  voucherId: string;
  retestVoucherId?: string;
  selectedVoucherId?: string;
  retestPaymentStatus?: 'Paid' | 'Pending';
  retestCollectedAmount?: number;
  retestApproved?: boolean;
  retestDate?: string;
  retestScore?: number;
  gender?: 'Male' | 'Female';
  qualification?: string;
  hasComputer?: 'Yes' | 'No';
  learnedBefore?: 'Yes' | 'No';
  voucherStatus: string;
  certificateStatus: string;
}

export interface EmailHistoryItem {
  id: string;
  to: string;
  subject: string;
  sentAt: string;
  status: 'Delivered' | 'Pending' | 'Read';
}

export interface DocumentItem {
  id: string;
  name: string;
  category: 'Material' | 'Report' | 'Receipt' | 'Certificate';
  uploadedAt: string;
  size: string;
}
