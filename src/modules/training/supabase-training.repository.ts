import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';
import type {
  Student, IStudentRepository,
  Course, ICourseRepository,
  Batch, IBatchRepository,
  College, ICollegeRepository,
  Enrollment, IEnrollmentRepository,
  SessionAttendanceRecord, ISessionAttendanceRepository,
  AssessmentRecord, IAssessmentRepository,
  ExamVoucher, IExamVoucherRepository,
  CertificateRecord, ICertificateRepository,
  ReferralRecord, IReferralRepository,
  AlumniProfile, IAlumniRepository
} from './training.repository';

export class SupabaseStudentRepository extends SupabaseRepository<Student> implements IStudentRepository {
  constructor() { super('student_records'); }
}

export class SupabaseCourseRepository extends SupabaseRepository<Course> implements ICourseRepository {
  constructor() { super('courses'); }
}

export class SupabaseBatchRepository extends SupabaseRepository<Batch> implements IBatchRepository {
  constructor() { super('batches'); }
}

export class SupabaseCollegeRepository extends SupabaseRepository<College> implements ICollegeRepository {
  constructor() { super('colleges'); }
}

export class SupabaseEnrollmentRepository extends SupabaseRepository<Enrollment> implements IEnrollmentRepository {
  constructor() { super('enrollments'); }
}

export class SupabaseSessionAttendanceRepository extends SupabaseRepository<SessionAttendanceRecord> implements ISessionAttendanceRepository {
  constructor() { super('schedule_sessions'); }

  async findByBatch(batchId: UUID, dateStr: string): Promise<SessionAttendanceRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('batch_id', batchId)
      .eq('date', dateStr)
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => toCamelCaseObject(row) as SessionAttendanceRecord);
  }
}

export class SupabaseAssessmentRepository extends SupabaseRepository<AssessmentRecord> implements IAssessmentRepository {
  constructor() { super('assessments'); }

  async findByEnrollment(enrollmentId: UUID): Promise<AssessmentRecord[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('enrollment_id', enrollmentId)
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => toCamelCaseObject(row) as AssessmentRecord);
  }
}

export class SupabaseExamVoucherRepository extends SupabaseRepository<ExamVoucher> implements IExamVoucherRepository {
  constructor() { super('vouchers'); }
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

