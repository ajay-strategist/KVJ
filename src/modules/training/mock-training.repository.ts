import { MemoryRepository } from '../../core/repository';
import { SEED_COURSES, SEED_BATCHES } from './training.seed';
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

export class MockStudentRepository extends MemoryRepository<Student> implements IStudentRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, []); }
}

export class MockCourseRepository extends MemoryRepository<Course> implements ICourseRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, []); }
}

export class MockBatchRepository extends MemoryRepository<Batch> implements IBatchRepository {
  constructor() { super({ defaultStatus: 'scheduled', pageSize: 500 }, []); }
}

export class MockEnrollmentRepository extends MemoryRepository<Enrollment> implements IEnrollmentRepository {
  constructor() { super({ defaultStatus: 'registered', pageSize: 20 }, []); }
}

export class MockSessionAttendanceRepository extends MemoryRepository<SessionAttendanceRecord> implements ISessionAttendanceRepository {
  constructor() { super({ defaultStatus: 'present', pageSize: 50 }, []); }

  async findByBatch(batchId: UUID, dateStr: string): Promise<SessionAttendanceRecord[]> {
    return [...this.store.values()].filter(
      (r) => r.batchId === batchId && r.sessionDate === dateStr && !r.deletedAt
    );
  }
}

export class MockAssessmentRepository extends MemoryRepository<AssessmentRecord> implements IAssessmentRepository {
  constructor() { super({ defaultStatus: 'pending', pageSize: 20 }, []); }

  async findByEnrollment(enrollmentId: UUID): Promise<AssessmentRecord[]> {
    return [...this.store.values()].filter(
      (r) => r.enrollmentId === enrollmentId && !r.deletedAt
    );
  }
}

export class MockExamVoucherRepository extends MemoryRepository<ExamVoucher> implements IExamVoucherRepository {
  constructor() { super({ defaultStatus: 'pending', pageSize: 20 }, []); }
}

export class MockCertificateRepository extends MemoryRepository<CertificateRecord> implements ICertificateRepository {
  constructor() { super({ defaultStatus: 'issued', pageSize: 20 }, []); }
}

export class MockReferralRepository extends MemoryRepository<ReferralRecord> implements IReferralRepository {
  constructor() { super({ defaultStatus: 'sent', pageSize: 20 }, []); }
}

export class MockAlumniRepository extends MemoryRepository<AlumniProfile> implements IAlumniRepository {
  constructor() { super({ defaultStatus: 'placed', pageSize: 20 }, []); }
}
