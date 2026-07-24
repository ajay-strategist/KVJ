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

/**
 * Normalise a phone number to the last 10 digits — the canonical form of the
 * student business key. Strips spaces, dashes, +91 country codes etc. so that
 * "+91 98470 12345", "098470-12345" and "9847012345" all resolve to one key.
 */
export function normalizeStudentKey(phone: string | undefined | null): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.slice(-10);
}

export class SupabaseStudentRepository extends SupabaseRepository<Student> implements IStudentRepository {
  constructor() { super('student_records'); }

  /**
   * BUSINESS RULE (locked): register_no IS the student's phone number and is the
   * unique business identifier. It is derived here rather than trusted from the
   * caller, so every write path — manual add, Excel/Sheet import, enrollment —
   * produces the same key and the UNIQUE NOT NULL constraint always holds.
   */
  private applyBusinessKey(data: Partial<Student>): Partial<Student> {
    // Prefer the phone; fall back to an already-supplied registerNo so an update
    // that only touches other fields does not blank the key.
    const source = data.phone ?? data.registerNo;
    if (source === undefined) return data;

    const key = normalizeStudentKey(source);
    if (!key) {
      throw new Error(
        'A student requires a valid phone number: it is the unique business ' +
        'identifier (register_no) and cannot be empty.',
      );
    }
    return { ...data, registerNo: key };
  }

  async create(data: Partial<Student>, actor: Parameters<SupabaseRepository<Student>['create']>[1]) {
    return super.create(this.applyBusinessKey(data), actor);
  }

  async update(id: UUID, patch: Partial<Student>, actor: Parameters<SupabaseRepository<Student>['update']>[2]) {
    return super.update(id, this.applyBusinessKey(patch), actor);
  }

  /** Look a student up by their business key (phone number). */
  async findByRegisterNo(phone: string): Promise<Student | null> {
    const key = normalizeStudentKey(phone);
    if (!key) return null;
    const { data, error } = await supabase
      .from('student_records')
      .select('*')
      .eq('register_no', key)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? (toCamelCaseObject(data) as Student) : null;
  }
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

    if (error) {
      console.warn(`Supabase findByBatch warning on ${this.tableName}:`, error.message);
      return [];
    }
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

    if (error) {
      console.warn(`Supabase findByEnrollment warning on ${this.tableName}:`, error.message);
      return [];
    }
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

