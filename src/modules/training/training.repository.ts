import type { IRepository } from '../../core/repository';
import type { Entity, UUID } from '../../core/types';
import { createToken } from '../../core/registry';

export type EnrollmentStatus = 'registered' | 'admitted' | 'deferred' | 'cancelled' | 'completed';
export type TrainingCategory = 'corporate' | 'college' | 'public' | 'individual';
export type TrainingType = 'online' | 'hybrid' | 'workshop' | 'bootcamp' | 'certification';

export interface Student extends Entity {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guardianName?: string;
  guardianPhone?: string;
  academicQualification?: string;
  employmentStatus?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  photoUrl?: string;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

/**
 * A course in the catalog. Category / Type / Duration / Description were
 * removed per confirmed scope — the catalog is just the course identity.
 */
export interface Course extends Entity {
  title: string;
  code: string;
  maxMarks?: number;
  passPercentage?: number;
  checklist?: string[];
}

/** Lifecycle phase of a training batch, shown as a coloured badge. */
export type TrainingPhase =
  | 'Preparation'
  | 'Scheduled'
  | 'In Progress'
  | 'Assessment'
  | 'Feedback'
  | 'Certificate'
  | 'Completed';

export const TRAINING_PHASES: TrainingPhase[] = [
  'Preparation', 'Scheduled', 'In Progress', 'Assessment', 'Feedback', 'Certificate', 'Completed',
];

export interface Batch extends Entity {
  courseId: UUID;
  code: string;
  trainerId?: UUID;
  startDate: string;
  endDate: string;
  capacity: number;
  venue?: string;
  onlineLink?: string;

  // Training-record fields surfaced on the batch overview carousel.
  // Optional so existing records and create flows keep compiling.
  trainingName?: string;
  college?: string;
  academicYear?: string;   // e.g. "2026-2027"
  batchNo?: string;        // e.g. "Batch 2"
  coordinator?: string;
  coordinatorEmail?: string;
  coordinator2?: string;
  coordinatorEmail2?: string;
  phase?: TrainingPhase;
  completedTasks?: number;
  totalTasks?: number;
}

export interface Enrollment extends Entity {
  studentId: UUID;
  batchId?: UUID;
  status: EnrollmentStatus;
  seatNumber?: string;
}

export interface SessionAttendanceRecord extends Entity {
  batchId: UUID;
  sessionDate: string;
  studentId?: UUID;
  trainerId?: UUID;
  status: 'present' | 'absent' | 'late' | 'leave';
  arrivalTime?: string;
  notes?: string;
}

export interface AssessmentRecord extends Entity {
  enrollmentId: UUID;
  title: string;
  type: 'Assignment' | 'ModuleTest' | 'MockTest' | 'FinalExam';
  maxMarks: number;
  marksObtained?: number;
  grade?: string;
  feedback?: string;
  evaluatedBy?: UUID;
  evaluatedAt?: string;
}

export interface ExamVoucher extends Entity {
  enrollmentId: UUID;
  voucherCode: string;
  expiryDate: string;
  approvedBy?: UUID;
  approvedAt?: string;
}

export interface CertificateRecord extends Entity {
  enrollmentId: UUID;
  certificateNumber: string;
  verificationQrUrl?: string;
  digitalSignature?: string;
  issuedAt: string;
  reissuedAt?: string;
  reissueReason?: string;
}

export interface ReferralRecord extends Entity {
  referrerStudentId: UUID;
  referralCode: string;
  refereeEmail: string;
  rewardAmount?: number;
  payoutEligible?: boolean;
}

export interface AlumniProfile extends Entity {
  studentId: UUID;
  graduationDate: string;
  currentEmployer?: string;
  currentDesignation?: string;
  packageAmount?: number;
  testimonial?: string;
}

export interface College extends Entity {
  code: string;
  name: string;
  location?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive?: boolean;
}

export interface IStudentRepository extends IRepository<Student> {}
export interface ICourseRepository extends IRepository<Course> {}
export interface IBatchRepository extends IRepository<Batch> {}
export interface ICollegeRepository extends IRepository<College> {}
export interface IEnrollmentRepository extends IRepository<Enrollment> {}
export interface ISessionAttendanceRepository extends IRepository<SessionAttendanceRecord> {
  findByBatch(batchId: UUID, dateStr: string): Promise<SessionAttendanceRecord[]>;
}
export interface IAssessmentRepository extends IRepository<AssessmentRecord> {
  findByEnrollment(enrollmentId: UUID): Promise<AssessmentRecord[]>;
}
export interface IExamVoucherRepository extends IRepository<ExamVoucher> {}
export interface ICertificateRepository extends IRepository<CertificateRecord> {}
export interface IReferralRepository extends IRepository<ReferralRecord> {}
export interface IAlumniRepository extends IRepository<AlumniProfile> {}

export const STUDENT_REPOSITORY_TOKEN = createToken<IStudentRepository>('StudentRepository');
export const COURSE_REPOSITORY_TOKEN = createToken<ICourseRepository>('CourseRepository');
export const BATCH_REPOSITORY_TOKEN = createToken<IBatchRepository>('BatchRepository');
export const COLLEGE_REPOSITORY_TOKEN = createToken<ICollegeRepository>('CollegeRepository');
export const ENROLLMENT_REPOSITORY_TOKEN = createToken<IEnrollmentRepository>('EnrollmentRepository');
export const SESSION_ATTENDANCE_REPOSITORY_TOKEN = createToken<ISessionAttendanceRepository>('SessionAttendanceRepository');
export const ASSESSMENT_REPOSITORY_TOKEN = createToken<IAssessmentRepository>('AssessmentRepository');
export const EXAM_VOUCHER_REPOSITORY_TOKEN = createToken<IExamVoucherRepository>('ExamVoucherRepository');
export const CERTIFICATE_REPOSITORY_TOKEN = createToken<ICertificateRepository>('CertificateRepository');
export const REFERRAL_REPOSITORY_TOKEN = createToken<IReferralRepository>('ReferralRepository');
export const ALUMNI_REPOSITORY_TOKEN = createToken<IAlumniRepository>('AlumniRepository');
