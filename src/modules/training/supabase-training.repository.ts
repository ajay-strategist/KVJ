import { SupabaseRepository } from '../../shared/integration/supabase-repository';
import type { UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';
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

export class SupabaseStudentRepository extends SupabaseRepository<Student> implements IStudentRepository {
  constructor() { super('students'); }
}

export class SupabaseCourseRepository extends SupabaseRepository<Course> implements ICourseRepository {
  constructor() { super('courses'); }
}

export class SupabaseBatchRepository extends SupabaseRepository<Batch> implements IBatchRepository {
  constructor() { super('batches'); }
}

export class SupabaseEnrollmentRepository extends SupabaseRepository<Enrollment> implements IEnrollmentRepository {
  constructor() { super('enrollments'); }
}

export class SupabaseSessionAttendanceRepository extends SupabaseRepository<SessionAttendanceRecord> implements ISessionAttendanceRepository {
  constructor() { super('session_attendance'); }

  async findByBatch(batchId: UUID, dateStr: string): Promise<SessionAttendanceRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('batchId', batchId)
      .eq('sessionDate', dateStr)
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as SessionAttendanceRecord[];
  }
}

export class SupabaseAssessmentRepository extends SupabaseRepository<AssessmentRecord> implements IAssessmentRepository {
  constructor() { super('assessments'); }

  async findByEnrollment(enrollmentId: UUID): Promise<AssessmentRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('enrollmentId', enrollmentId)
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as AssessmentRecord[];
  }
}

export class SupabaseExamVoucherRepository extends SupabaseRepository<ExamVoucher> implements IExamVoucherRepository {
  constructor() { super('exam_vouchers'); }
}

export class SupabaseCertificateRepository extends SupabaseRepository<CertificateRecord> implements ICertificateRepository {
  constructor() { super('certificates'); }
}

export class SupabaseReferralRepository extends SupabaseRepository<ReferralRecord> implements IReferralRepository {
  constructor() { super('referrals'); }
}

export class SupabaseAlumniRepository extends SupabaseRepository<AlumniProfile> implements IAlumniRepository {
  constructor() { super('alumni_profiles'); }
}
