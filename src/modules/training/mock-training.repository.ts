import { MemoryRepository } from '../../core/repository';
import type { UUID } from '../../core/types';
import type {
  Student, IStudentRepository,
  Course, ICourseRepository,
  Batch, IBatchRepository,
  Enrollment, IEnrollmentRepository,
  SessionAttendanceRecord, ISessionAttendanceRepository,
  AssessmentRecord, IAssessmentRepository,
  ExamVoucher, IExamVoucherRepository,
  CertificateRecord, ICertificateRepository,
  ReferralRecord, IReferralRepository,
  AlumniProfile, IAlumniRepository
} from './training.repository';

const DEFAULT_COURSES: any[] = [
  {
    id: 'c1',
    title: 'Power BI',
    code: 'KVJ-PBI-101',
    maxMarks: 100,
    passPercentage: 84,
    checklist: ['College Confirmation Form Signed', 'Trainer Assigned', 'Student Registry Uploaded', 'Syllabus Dispatched', 'Daily Sessions Logged', 'Final Report Generated', 'Certificates Dispatched', 'Signed Receipt Uploaded'],
  },
  {
    id: 'c2',
    title: 'Data Analytics',
    code: 'KVJ-DA-101',
    maxMarks: 100,
    passPercentage: 84,
    checklist: ['College Confirmation Form Signed', 'Trainer Assigned', 'Student Registry Uploaded', 'Syllabus Dispatched', 'Daily Sessions Logged', 'Final Report Generated', 'Certificates Dispatched', 'Signed Receipt Uploaded'],
  },
  {
    id: 'c3',
    title: 'Advanced Excel',
    code: 'KVJ-EXCEL-101',
    maxMarks: 100,
    passPercentage: 84,
    checklist: ['College Confirmation Form Signed', 'Trainer Assigned', 'Student Registry Uploaded', 'Syllabus Dispatched', 'Daily Sessions Logged', 'Final Report Generated', 'Certificates Dispatched', 'Signed Receipt Uploaded'],
  },
];

const DEFAULT_BATCHES: any[] = [
  {
    id: 'b1',
    code: 'Christ Irinjalakkuda-2 BBA-2026-27-Batch 1-Power BI',
    college: 'Christ Irinjalakkuda',
    courseId: 'c1',
    academicYear: '2026-2027',
    trainingName: 'Power BI',
    capacity: 30,
    coordinator: 'Prof. Anil Kumar',
    venue: 'Lab 1',
    status: 'scheduled',
    startDate: '2026-07-01',
    endDate: '2026-08-30',
  },
  {
    id: 'b2',
    code: 'MIM Kuttikkanam-1 MBA-2026-27-Batch 1-Data Analytics',
    college: 'MIM Kuttikkanam',
    courseId: 'c2',
    academicYear: '2026-2027',
    trainingName: 'Data Analytics',
    capacity: 45,
    coordinator: 'Dr. Joby Thomas',
    venue: 'Hall B',
    status: 'scheduled',
    startDate: '2026-07-05',
    endDate: '2026-09-15',
  },
  {
    id: 'b3',
    code: 'St. Thomas College-3 BCOM-2026-27-Batch 1-Advanced Excel',
    college: 'St. Thomas College',
    courseId: 'c3',
    academicYear: '2026-2027',
    trainingName: 'Advanced Excel',
    capacity: 40,
    coordinator: 'Prof. Mary John',
    venue: 'Lab 3',
    status: 'scheduled',
    startDate: '2026-07-10',
    endDate: '2026-09-20',
  },
];

export class MockStudentRepository extends MemoryRepository<Student> implements IStudentRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, [], 'MockStudentRepository'); }
}

export class MockCourseRepository extends MemoryRepository<Course> implements ICourseRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, DEFAULT_COURSES as Course[], 'MockCourseRepository'); }
}

export class MockBatchRepository extends MemoryRepository<Batch> implements IBatchRepository {
  constructor() { super({ defaultStatus: 'scheduled', pageSize: 500 }, DEFAULT_BATCHES as Batch[], 'MockBatchRepository'); }
}

export class MockEnrollmentRepository extends MemoryRepository<Enrollment> implements IEnrollmentRepository {
  constructor() { super({ defaultStatus: 'registered', pageSize: 20 }, [], 'MockEnrollmentRepository'); }
}

export class MockSessionAttendanceRepository extends MemoryRepository<SessionAttendanceRecord> implements ISessionAttendanceRepository {
  constructor() { super({ defaultStatus: 'present', pageSize: 50 }, [], 'MockSessionAttendanceRepository'); }

  async findByBatch(batchId: UUID, dateStr: string): Promise<SessionAttendanceRecord[]> {
    return [...this.store.values()].filter(
      (r) => r.batchId === batchId && r.sessionDate === dateStr && !r.deletedAt
    );
  }
}

export class MockAssessmentRepository extends MemoryRepository<AssessmentRecord> implements IAssessmentRepository {
  constructor() { super({ defaultStatus: 'pending', pageSize: 20 }, [], 'MockAssessmentRepository'); }

  async findByEnrollment(enrollmentId: UUID): Promise<AssessmentRecord[]> {
    return [...this.store.values()].filter(
      (r) => r.enrollmentId === enrollmentId && !r.deletedAt
    );
  }
}

export class MockExamVoucherRepository extends MemoryRepository<ExamVoucher> implements IExamVoucherRepository {
  constructor() { super({ defaultStatus: 'pending', pageSize: 20 }, [], 'MockExamVoucherRepository'); }
}

export class MockCertificateRepository extends MemoryRepository<CertificateRecord> implements ICertificateRepository {
  constructor() { super({ defaultStatus: 'issued', pageSize: 20 }, [], 'MockCertificateRepository'); }
}

export class MockReferralRepository extends MemoryRepository<ReferralRecord> implements IReferralRepository {
  constructor() { super({ defaultStatus: 'sent', pageSize: 20 }, [], 'MockReferralRepository'); }
}

export class MockAlumniRepository extends MemoryRepository<AlumniProfile> implements IAlumniRepository {
  constructor() { super({ defaultStatus: 'placed', pageSize: 20 }, [], 'MockAlumniRepository'); }
}
