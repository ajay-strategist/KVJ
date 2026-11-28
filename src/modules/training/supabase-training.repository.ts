import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';
import { normalizeBatchCode } from './utils/batch-formatter';
import type {
  Student, IStudentRepository,
  Course, ICourseRepository,
  Batch, IBatchRepository,
  BatchChecklistItem,
  BatchIntegrationRecord,
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
  constructor() { super('flwdsk_student_records'); }

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
    return { ...data, registerNo: key, phone: key };
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
      .from('flwdsk_student_records')
      .select('*')
      .eq('phone', key)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? (toCamelCaseObject(data) as Student) : null;
  }
}

export class SupabaseCourseRepository extends SupabaseRepository<Course> implements ICourseRepository {
  constructor() { super('flwdsk_courses'); }
}

export class SupabaseBatchRepository extends SupabaseRepository<Batch> implements IBatchRepository {
  constructor() { super('flwdsk_batches'); }

  async findByCode(code: string): Promise<Batch | null> {
    const normalized = normalizeBatchCode(code);
    if (!normalized) return null;
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .ilike('code', normalized)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('Supabase findByCode warning on flwdsk_batches:', error.message);
      return null;
    }
    return data ? (toCamelCaseObject(data) as Batch) : null;
  }

  async listIntegrationRecords(options?: {
    collegeId?: UUID;
    courseId?: UUID;
    includeDeleted?: boolean;
  }): Promise<BatchIntegrationRecord[]> {
    let query = supabase.from('flwdsk_batches_integration_v1').select('*');
    if (!options?.includeDeleted) {
      query = query.is('deleted_at', null);
    }
    if (options?.collegeId) {
      query = query.eq('college_id', options.collegeId);
    }
    if (options?.courseId) {
      query = query.eq('course_id', options.courseId);
    }
    const { data, error } = await query.order('updated_at', { ascending: false });
    if (!error && data) {
      return data.map((row) => toCamelCaseObject(row) as BatchIntegrationRecord);
    }

    // Fallback to direct table join if view is not yet deployed in target DB
    let fallback = supabase
      .from('flwdsk_batches')
      .select('*, flwdsk_colleges(id, code, name, location), flwdsk_courses(id, code, title, checklist)');
    if (!options?.includeDeleted) fallback = fallback.is('deleted_at', null);
    if (options?.collegeId) fallback = fallback.eq('college_id', options.collegeId);
    if (options?.courseId) fallback = fallback.eq('course_id', options.courseId);
    const fbRes = await fallback.order('updated_at', { ascending: false });
    if (fbRes.error || !fbRes.data) return [];

    return fbRes.data.map((row: any) => {
      const col = row.flwdsk_colleges;
      const crs = row.flwdsk_courses;
      return {
        id: row.id,
        batchCode: row.code,
        batchNo: row.batch_no,
        program: row.program,
        academicYear: row.academic_year,
        trainingName: row.training_name,
        startDate: row.start_date,
        endDate: row.end_date,
        capacity: row.capacity,
        phase: row.phase,
        coordinator: row.coordinator,
        coordinatorEmail: row.coordinator_email,
        coordinator2: row.coordinator2,
        coordinatorEmail2: row.coordinator_email2,
        completedTasks: row.completed_tasks,
        totalTasks: row.total_tasks,
        collegeId: row.college_id ?? col?.id,
        collegeNameLegacy: row.college,
        collegeCode: col?.code,
        collegeName: col?.name ?? row.college,
        collegeLocation: col?.location,
        courseId: row.course_id ?? crs?.id,
        courseCode: crs?.code,
        courseTitle: crs?.title ?? row.training_name,
        courseChecklistTemplate: Array.isArray(crs?.checklist) ? crs.checklist : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? null,
      } as BatchIntegrationRecord;
    });
  }

  async findUpdatedSince(sinceIso: string, options?: { includeDeleted?: boolean }): Promise<BatchIntegrationRecord[]> {
    let query = supabase
      .from('flwdsk_batches_integration_v1')
      .select('*')
      .gt('updated_at', sinceIso)
      .order('updated_at', { ascending: true });
    if (options?.includeDeleted === false) {
      query = query.is('deleted_at', null);
    }
    const { data, error } = await query;
    if (!error && data) {
      return data.map((row) => toCamelCaseObject(row) as BatchIntegrationRecord);
    }
    // Fallback to listIntegrationRecords filtered by updatedAt
    const all = await this.listIntegrationRecords({ includeDeleted: options?.includeDeleted !== false });
    return all
      .filter((r) => r.updatedAt > sinceIso)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }
}

export async function fetchBatchChecklistItems(batchId: UUID): Promise<BatchChecklistItem[]> {
  try {
    const { data, error } = await supabase
      .from('flwdsk_batch_checklist_items')
      .select('*')
      .eq('batch_id', batchId);
    if (error || !data) return [];
    return data.map((row) => toCamelCaseObject(row) as BatchChecklistItem);
  } catch {
    return [];
  }
}

export async function toggleBatchChecklistItemAtomic(params: {
  batchId: UUID;
  taskLabel: string;
  isDone: boolean;
  actorId?: UUID;
  actorName?: string;
  sourceApp?: string;
  totalTasks?: number;
}): Promise<BatchChecklistItem | null> {
  try {
    const { data, error } = await supabase.rpc('toggle_batch_checklist_item', {
      p_batch_id: params.batchId,
      p_task_label: params.taskLabel,
      p_is_done: params.isDone,
      p_actor_id: params.actorId ?? null,
      p_actor_name: params.actorName ?? null,
      p_source_app: params.sourceApp ?? 'flowdesk',
      p_total_tasks: params.totalTasks ?? null,
    });
    if (error) {
      console.warn('toggle_batch_checklist_item RPC fallback:', error.message);
      return null;
    }
    return data ? (toCamelCaseObject(data) as BatchChecklistItem) : null;
  } catch {
    return null;
  }
}

export class SupabaseCollegeRepository extends SupabaseRepository<College> implements ICollegeRepository {
  constructor() { super('flwdsk_colleges'); }
}

export class SupabaseEnrollmentRepository extends SupabaseRepository<Enrollment> implements IEnrollmentRepository {
  constructor() { super('flwdsk_enrollments'); }
}

export class SupabaseSessionAttendanceRepository extends SupabaseRepository<SessionAttendanceRecord> implements ISessionAttendanceRepository {
  constructor() { super('flwdsk_schedule_sessions'); }

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
  constructor() { super('flwdsk_assessments'); }

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

  /** Fetch all assessment records for an entire batch in one round-trip. */
  async findByBatch(enrollmentIds: UUID[]): Promise<AssessmentRecord[]> {
    if (!enrollmentIds.length) return [];
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .in('enrollment_id', enrollmentIds)
      .is('deleted_at', null);

    if (error) {
      console.warn(`Supabase findByBatch warning on ${this.tableName}:`, error.message);
      return [];
    }
    return (data ?? []).map((row) => toCamelCaseObject(row) as AssessmentRecord);
  }
}

export class SupabaseExamVoucherRepository extends SupabaseRepository<ExamVoucher> implements IExamVoucherRepository {
  constructor() { super('flwdsk_vouchers'); }
}

export class SupabaseCertificateRepository extends SupabaseRepository<CertificateRecord> implements ICertificateRepository {
  constructor() { super('flwdsk_certificates'); }
}

export class SupabaseReferralRepository extends SupabaseRepository<ReferralRecord> implements IReferralRepository {
  constructor() { super('flwdsk_referrals'); }
}

export class SupabaseAlumniRepository extends SupabaseRepository<AlumniProfile> implements IAlumniRepository {
  constructor() { super('flwdsk_alumni_profiles'); }
}

