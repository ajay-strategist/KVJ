import { container, createToken } from '../../core/registry';
import { toLocalISODate } from '../../shared/utils/date';
import { AppError, Err, Ok, type Result, ErrorCode } from '../../core/result';
import type { Actor, UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';
import { calculateFinalExamEligibility } from './utils/eligibility';
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
  ALUMNI_REPOSITORY_TOKEN,
  type Student, type Course, type Batch, type Enrollment,
  type SessionAttendanceRecord, type AssessmentRecord, type ExamVoucher,
  type CertificateRecord, type ReferralRecord, type AlumniProfile
} from './training.repository';
import { ACTIVITY_ENGINE_TOKEN } from '../../core/engines/activity';
import { AUDIT_ENGINE_TOKEN } from '../../core/engines/audit';
import { TEMPLATE_ENGINE_TOKEN } from '../../core/engines/template';
import { WORKFLOW_ENGINE_TOKEN } from '../../core/engines/workflow';
import { NOTIFICATION_ENGINE_TOKEN } from '../../core/engines/notification';

export interface RetestPaymentVerification {
  id: UUID;
  studentId: UUID;
  batchId: UUID;
  voucherId?: UUID;
  status: 'Pending' | 'Verified';
  verifiedAt?: string;
  verifiedBy?: UUID;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ITrainingService {
  registerStudent(data: Partial<Student>, actor: Actor): Promise<Result<Student>>;
  updateStudentProfile(studentId: UUID, data: Partial<Student>, actor: Actor): Promise<Result<Student>>;
  createCourse(data: Partial<Course>, actor: Actor): Promise<Result<Course>>;
  updateCourse(id: UUID, data: Partial<Course>, actor: Actor): Promise<Result<Course>>;
  createBatch(data: Partial<Batch>, actor: Actor): Promise<Result<Batch>>;
  updateBatch(id: UUID, data: Partial<Batch>, actor: Actor): Promise<Result<Batch>>;
  enrollStudent(studentId: UUID, batchId: UUID, actor: Actor): Promise<Result<Enrollment>>;
  logSessionAttendance(batchId: UUID, dateStr: string, records: Partial<SessionAttendanceRecord>[], actor: Actor): Promise<Result<SessionAttendanceRecord[]>>;
  evaluateAssessment(enrollmentId: UUID, data: Partial<AssessmentRecord>, actor: Actor): Promise<Result<AssessmentRecord>>;
  claimVoucher(enrollmentId: UUID, actor: Actor): Promise<Result<ExamVoucher>>;
  issueCertificate(enrollmentId: UUID, actor: Actor): Promise<Result<CertificateRecord>>;
  trackReferral(referrerId: UUID, code: string, email: string, actor: Actor): Promise<Result<ReferralRecord>>;
  graduateStudent(studentId: UUID, gradDate: string, employer?: string, designation?: string, pkg?: number, testimonial?: string, actor?: Actor): Promise<Result<AlumniProfile>>;
  createRetestPaymentVerification(data: Partial<RetestPaymentVerification>, actor: Actor): Promise<Result<RetestPaymentVerification>>;
  getRetestPaymentVerificationsForBatch(batchId: UUID): Promise<Result<RetestPaymentVerification[]>>;
  getCertificateDelivery(enrollmentId: UUID): Promise<Result<CertificateRecord | null>>;
  saveCertificateDelivery(enrollmentId: UUID, studentId: UUID, deliveryDate: string, collectedBy: string, certificateCount: number, certificateReceiptPath: string, actor: Actor): Promise<Result<CertificateRecord>>;
  uploadCertificateReceipt(file: File, path: string): Promise<Result<string>>;
  getCertificateReceiptUrl(path: string): Promise<Result<string>>;
  deleteCertificateReceipt(path: string): Promise<Result<void>>;
  removeEnrollment(studentId: UUID, batchId: UUID, actionType: 'ENROLLMENT_REMOVED' | 'ENROLLMENT_BULK_REMOVED' | 'ENROLLMENT_DEDUPLICATED', actor: Actor): Promise<Result<void>>;
  removeBatch(batchId: UUID, actor: Actor): Promise<Result<void>>;
  issueVoucher(studentId: UUID, batchId: UUID, voucherCode: string, voucherType: 'Initial' | 'Retest', actor: Actor): Promise<Result<any>>;
  deleteVoucher(studentId: UUID, batchId: UUID, voucherType: 'Initial' | 'Retest', actor: Actor): Promise<Result<void>>;
  recordExamAttempt(studentId: UUID, batchId: UUID, attemptType: 'Initial' | 'Retest', score: number, voucherCode: string | null, screenshotUrl: string | null, submittedBy: string, actor: Actor, allowVoucherReuse?: boolean): Promise<Result<any>>;
  logSessionAttendanceCell(batchId: UUID, studentId: UUID, dateStr: string, sessionTitle: string, status: string, actor: Actor): Promise<Result<void>>;
  updateSessionDate(batchId: UUID, oldDate: string, newDate: string, sessionTitle: string, actor: Actor): Promise<Result<void>>;
  updateSessionHour(batchId: UUID, dateStr: string, oldSessionTitle: string, newSessionTitle: string, actor: Actor): Promise<Result<void>>;
  deleteSessionColumn(batchId: UUID, dateStr: string, sessionTitle: string, actor: Actor): Promise<Result<void>>;
  updateVoucherSentStatus(voucherId: UUID, sentStatus: 'Pending' | 'Sent', actor: Actor): Promise<Result<any>>;
  verifyRetestPayment(studentId: UUID, batchId: UUID, status: 'Pending' | 'Verified', actor: Actor): Promise<Result<RetestPaymentVerification>>;
  saveBatchEligibilityRules(batchId: UUID, considerAttendance: boolean, attendancePassPercentage: number, assessmentPassPercentage: number, eligibilityCriteria: any[], actor: Actor): Promise<Result<any>>;
  resolveExamAttemptDiscrepancy(studentId: UUID, batchId: UUID, attemptType: 'Initial' | 'Retest', category: string, resolutionAction: string, resolutionReason: string, selectedDuplicateId: UUID | null, dbMark: number | null, cacheMark: number | null, coursePassPct: number, actor: Actor): Promise<Result<any>>;
  syncVoucher(studentId: UUID, batchId: UUID, voucherType: 'Initial' | 'Retest', voucherCode: string, paymentVerified: 'Pending' | 'Verified', actor: Actor): Promise<Result<any>>;
  syncExamAttempt(studentId: UUID, batchId: UUID, attemptType: 'Initial' | 'Retest', mark: number, actor: Actor): Promise<Result<any>>;
  saveCalendarSession(session: any, actor: Actor): Promise<Result<any>>;
  deleteCalendarSession(sessionId: UUID, actor: Actor): Promise<Result<any>>;
}


export const TRAINING_SERVICE_TOKEN = createToken<ITrainingService>('TrainingService');

export class TrainingService implements ITrainingService {
  private get studentRepo() { return container.resolve(STUDENT_REPOSITORY_TOKEN); }
  private get courseRepo() { return container.resolve(COURSE_REPOSITORY_TOKEN); }
  private get batchRepo() { return container.resolve(BATCH_REPOSITORY_TOKEN); }
  private get enrollmentRepo() { return container.resolve(ENROLLMENT_REPOSITORY_TOKEN); }
  private get attendanceRepo() { return container.resolve(SESSION_ATTENDANCE_REPOSITORY_TOKEN); }
  private get assessmentRepo() { return container.resolve(ASSESSMENT_REPOSITORY_TOKEN); }
  private get voucherRepo() { return container.resolve(EXAM_VOUCHER_REPOSITORY_TOKEN); }
  private get certificateRepo() { return container.resolve(CERTIFICATE_REPOSITORY_TOKEN); }
  private get referralRepo() { return container.resolve(REFERRAL_REPOSITORY_TOKEN); }
  private get alumniRepo() { return container.resolve(ALUMNI_REPOSITORY_TOKEN); }

  private get activity() { return container.resolve(ACTIVITY_ENGINE_TOKEN); }
  private get audit() { return container.resolve(AUDIT_ENGINE_TOKEN); }
  private get template() { return container.resolve(TEMPLATE_ENGINE_TOKEN); }
  private get workflow() { return container.resolve(WORKFLOW_ENGINE_TOKEN); }
  private get notification() { return container.resolve(NOTIFICATION_ENGINE_TOKEN); }

  private uuid(): UUID {
    return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID;
  }

  async registerStudent(data: Partial<Student>, actor: Actor): Promise<Result<Student>> {
    try {
      const student = await this.studentRepo.create(data, actor);
      await this.activity.log('student', student.id, actor, 'create', `Registered student ${student.firstName} ${student.lastName}`);
      await this.audit.log(actor, 'create', 'students', student.id, { newValues: student });
      return Ok(student);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updateStudentProfile(
    studentId: UUID,
    data: Partial<Student>,
    actor: Actor
  ): Promise<Result<Student>> {
    try {
      if (!actor || !actor.id) {
        return Err(new AppError({ code: ErrorCode.UNAUTHENTICATED, message: 'Actor not authenticated.', severity: 'warning' }));
      }

      const currentStudent = await this.studentRepo.findById(studentId);
      if (!currentStudent) {
        return Err(AppError.notFound('Student not found.'));
      }

      const patch: Partial<Student> = {};
      if (data.firstName !== undefined) patch.firstName = data.firstName;
      if (data.lastName !== undefined) patch.lastName = data.lastName;
      if (data.phone !== undefined) patch.phone = data.phone;
      if (data.email !== undefined) patch.email = data.email;
      if (data.notes !== undefined) patch.notes = data.notes;
      if (data.photoUrl !== undefined) patch.photoUrl = data.photoUrl;

      // Safe merge customFields
      const incomingCustomFields = data.customFields ?? (data as any).custom_fields;
      if (incomingCustomFields !== undefined) {
        patch.customFields = {
          ...(currentStudent.customFields || {}),
          ...incomingCustomFields
        };
      }

      const updatedStudent = await this.studentRepo.update(studentId, patch, actor);

      const fieldsChanged = Object.keys(patch);
      await this.audit.log(actor, 'update', 'students', studentId, {
        newValues: updatedStudent,
        oldValues: currentStudent,
        reason: 'Student profile update'
      });
      await this.activity.log('student', studentId, actor, 'update', `Updated student profile fields: ${fieldsChanged.join(', ')}`);

      return Ok(updatedStudent);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async createCourse(data: Partial<Course>, actor: Actor): Promise<Result<Course>> {
    try {
      const course = await this.courseRepo.create(data, actor);
      await this.activity.log('training', course.id, actor, 'create', `Created course catalog ${course.title}`);
      await this.audit.log(actor, 'create', 'courses', course.id, { newValues: course });
      return Ok(course);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updateCourse(id: UUID, data: Partial<Course>, actor: Actor): Promise<Result<Course>> {
    try {
      const course = await this.courseRepo.update(id, data, actor);
      await this.activity.log('training', course.id, actor, 'update', `Updated course catalog ${course.title}`);
      await this.audit.log(actor, 'update', 'courses', course.id, { newValues: course });
      return Ok(course);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async createBatch(data: Partial<Batch>, actor: Actor): Promise<Result<Batch>> {
    try {
      const batch = await this.batchRepo.create(data, actor);
      await this.activity.log('training', batch.id, actor, 'create', `Scheduled training batch ${batch.code}`);
      await this.audit.log(actor, 'create', 'batches', batch.id, { newValues: batch });
      return Ok(batch);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updateBatch(id: UUID, data: Partial<Batch>, actor: Actor): Promise<Result<Batch>> {
    try {
      const batch = await this.batchRepo.update(id, data, actor);
      await this.activity.log('training', batch.id, actor, 'update', `Updated training batch ${batch.code}`);
      await this.audit.log(actor, 'update', 'batches', batch.id, { newValues: batch });
      return Ok(batch);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async enrollStudent(studentId: UUID, batchId: UUID, actor: Actor): Promise<Result<Enrollment>> {
    try {
      const enrollment = await this.enrollmentRepo.create({ studentId, batchId, status: 'admitted', seatNumber: `SEAT-${Math.floor(100 + Math.random() * 900)}` }, actor);
      
      const student = await this.studentRepo.findById(studentId);
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'Student';

      await this.activity.log('student', studentId, actor, 'assign', `Enrolled student in batch ${enrollment.seatNumber}`);
      await this.audit.log(actor, 'assign', 'enrollments', enrollment.id, { newValues: enrollment });
      
      await this.notification.send({
        recipientId: studentId,
        title: 'Batch Enrollment Confirmed',
        body: `Congratulations ${studentName}! Your course enrollment has been successfully approved.`,
        channels: ['in_app', 'email']
      });

      return Ok(enrollment);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async logSessionAttendance(batchId: UUID, dateStr: string, records: Partial<SessionAttendanceRecord>[], actor: Actor): Promise<Result<SessionAttendanceRecord[]>> {
    try {
      const logged: SessionAttendanceRecord[] = [];
      for (const r of records) {
        const item = await this.attendanceRepo.create({ ...r, batchId, sessionDate: dateStr }, actor);
        logged.push(item);
      }

      // Synchronize compatibility cache for each unique student in the logged records
      try {
        const uniqueStudentIds = Array.from(new Set(records.map(r => r.studentId).filter(Boolean))) as UUID[];
        for (const studentId of uniqueStudentIds) {
          const { data: allSessions, error: queryErr } = await supabase
            .from('flwdsk_schedule_sessions')
            .select('status')
            .eq('batch_id', batchId)
            .eq('student_id', studentId)
            .is('deleted_at', null);

          if (!queryErr && allSessions) {
            const total = allSessions.length;
            const attended = allSessions.filter((s: any) => s.status && s.status.toLowerCase() !== 'absent').length;
            const calcPct = total > 0 ? Math.round((attended / total) * 100) : 100;

            let considerAttendance = true;
            let attendanceThreshold = 85;

            const { data: rules } = await supabase
              .from('flwdsk_batch_eligibility_rules')
              .select('*')
              .eq('batch_id', batchId)
              .maybeSingle();

            if (rules) {
              considerAttendance = rules.consider_attendance;
              attendanceThreshold = rules.attendance_pass_percentage;
            }

            const attendanceStatus = (!considerAttendance || calcPct >= attendanceThreshold) ? 'Regular' : 'Irregular';

            const { data: studentData, error: fetchErr } = await supabase
              .from('flwdsk_student_records')
              .select('custom_fields')
              .eq('id', studentId)
              .maybeSingle();

            if (!fetchErr && studentData) {
              const currentFields = studentData.custom_fields || {};
              const updatedFields = {
                ...currentFields,
                attendancePct: calcPct,
                attendance_pct: calcPct,
                attendanceStatus,
                attendance_status: attendanceStatus,
              };

              await supabase
                .from('flwdsk_student_records')
                .update({ custom_fields: updatedFields })
                .eq('id', studentId);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to update student attendance cache:', err);
      }

      await this.activity.log('attendance', batchId, actor, 'create', `Logged session attendance for ${dateStr}`);
      return Ok(logged);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async evaluateAssessment(enrollmentId: UUID, data: Partial<AssessmentRecord>, actor: Actor): Promise<Result<AssessmentRecord>> {
    try {
      // 1. Validate actor
      if (!actor || !actor.id) {
        return Err(AppError.validation('Actor is not authenticated.'));
      }

      // 2. Validate enrollment exists, is active, and fetch student/batch
      const { data: enrollment, error: enrolErr } = await supabase
        .from('flwdsk_enrollments')
        .select('*')
        .eq('id', enrollmentId)
        .is('deleted_at', null)
        .maybeSingle();

      if (enrolErr) throw enrolErr;
      if (!enrollment) {
        return Err(AppError.notFound('Active enrollment not found.'));
      }

      // 3. Verify student exists
      const student = await this.studentRepo.findById(enrollment.student_id);
      if (!student) {
        return Err(AppError.notFound('Student record not found.'));
      }

      // 4. Verify batch exists
      const batch = await this.batchRepo.findById(enrollment.batch_id);
      if (!batch) {
        return Err(AppError.notFound('Batch record not found.'));
      }

      // 5. Validate assessment fields
      const { type, maxMarks, marksObtained } = data;
      if (!type) {
        return Err(AppError.validation('Assessment type is required.'));
      }
      const allowedTypes = ['Assignment', 'ModuleTest', 'MockTest', 'FinalExam'];
      if (!allowedTypes.includes(type)) {
        return Err(AppError.validation(`Invalid assessment type: ${type}`));
      }

      if (maxMarks === undefined || maxMarks === null || !Number.isFinite(Number(maxMarks)) || Number(maxMarks) <= 0) {
        return Err(AppError.validation('Maximum marks must be a finite number greater than 0.'));
      }

      if (marksObtained === undefined || marksObtained === null || !Number.isFinite(Number(marksObtained))) {
        return Err(AppError.validation('Marks obtained must be a finite number.'));
      }

      if (Number(marksObtained) < 0) {
        return Err(AppError.validation('Marks obtained cannot be negative.'));
      }

      if (Number(marksObtained) > Number(maxMarks)) {
        return Err(AppError.validation('Marks obtained cannot exceed maximum marks.'));
      }

      // 6. Write assessment record via repository
      const assessment = await this.assessmentRepo.create(
        { ...data, enrollmentId, evaluatedBy: actor.id, evaluatedAt: new Date().toISOString() },
        actor
      );

      // 7. Synchronize compatibility cache for coursework assessment
      try {
        const { data: studentRecord } = await supabase
          .from('flwdsk_student_records')
          .select('custom_fields')
          .eq('id', enrollment.student_id)
          .maybeSingle();

        if (studentRecord) {
          const currentFields = studentRecord.custom_fields || {};

          const { data: allAssessments } = await supabase
            .from('flwdsk_assessments')
            .select('*')
            .eq('enrollment_id', enrollmentId)
            .is('deleted_at', null);

          if (allAssessments) {
            const sorted = [...allAssessments].sort((a, b) =>
              (a.created_at || '').localeCompare(b.created_at || '')
            );

            const assignments = sorted.filter(
              (r) => r.type === 'Assignment' || r.type === 'ModuleTest'
            );
            const mockTests = sorted.filter((r) => r.type === 'MockTest');
            const finalExams = sorted.filter((r) => r.type === 'FinalExam');

            const ass1 = assignments[0]?.marks_obtained ?? currentFields.ass1 ?? 0;
            const ass2 = assignments[1]?.marks_obtained ?? currentFields.ass2 ?? 0;
            const ass3 = assignments[2]?.marks_obtained ?? currentFields.ass3 ?? 0;
            const project = mockTests[0]?.marks_obtained ?? currentFields.project ?? 0;
            const finalExam = finalExams[0]?.marks_obtained ?? currentFields.finalExam ?? currentFields.final_exam ?? 0;

            const overallScore = Math.round((ass1 + ass2 + ass3 + project + finalExam) / 5);

            const updatedFields = {
              ...currentFields,
              ass1,
              ass2,
              ass3,
              project,
              finalExam,
              final_exam: finalExam,
              overallScore,
              overall_score: overallScore,
            };

            await supabase
              .from('flwdsk_student_records')
              .update({ custom_fields: updatedFields })
              .eq('id', enrollment.student_id);
          }
        }
      } catch (err) {
        console.warn('Failed to update student assessment cache:', err);
      }

      // 8. Log database audit log row
      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: 'ASSESSMENT_CREATED',
        entity_type: 'assessments',
        entity_id: assessment.id,
        new_value: assessment,
        reason: 'Trainer records student coursework assessment grade'
      });

      await this.activity.log('student', enrollmentId, actor, 'update', `Evaluated assessment: ${assessment.title} - Marks: ${assessment.marksObtained}/${assessment.maxMarks}`);
      await this.audit.log(actor, 'update', 'assessments', assessment.id, { newValues: assessment });
      return Ok(assessment);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async claimVoucher(enrollmentId: UUID, actor: Actor): Promise<Result<ExamVoucher>> {
    try {
      const enrol = await this.enrollmentRepo.findById(enrollmentId);
      if (!enrol) return Err(AppError.notFound('Enrollment not found.'));

      const student = await this.studentRepo.findById(enrol.studentId);
      if (!student) return Err(AppError.notFound('Student not found.'));

      if (!enrol.batchId) return Err(AppError.businessRule('Enrollment is not linked to any batch.'));

      // Fetch dynamic batch eligibility configurations from flwdsk_batch_eligibility_rules
      const { data: rules } = await supabase
        .from('flwdsk_batch_eligibility_rules')
        .select('*')
        .eq('batch_id', enrol.batchId)
        .maybeSingle();

      const mappedStudent = {
        ...student,
        ...(student.customFields || {})
      };

      const eligRes = calculateFinalExamEligibility(mappedStudent, rules || undefined);
      if (!eligRes.eligible) {
        return Err(AppError.businessRule(`Student is not eligible for voucher: ${eligRes.reason}`));
      }

      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 3);

      const voucher = await this.voucherRepo.create({
        enrollmentId,
        voucherCode: `VOUCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        expiryDate: toLocalISODate(expiry),
        approvedBy: actor.id,
        approvedAt: new Date().toISOString()
      }, actor);

      await this.activity.log('student', enrollmentId, actor, 'approve', `Exam voucher issued: ${voucher.voucherCode}`);
      await this.audit.log(actor, 'approve', 'exam_vouchers', voucher.id, { newValues: voucher });
      return Ok(voucher);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async issueCertificate(enrollmentId: UUID, actor: Actor): Promise<Result<CertificateRecord>> {
    try {
      const enrol = await this.enrollmentRepo.findById(enrollmentId);
      if (!enrol) return Err(AppError.notFound('Enrollment not found.'));

      const student = await this.studentRepo.findById(enrol.studentId);
      if (!student) return Err(AppError.notFound('Student not found.'));

      // Check if a certificate has already been issued for this enrollment
      const { data: existingCert } = await supabase
        .from('flwdsk_certificates')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingCert) {
        return Err(AppError.businessRule('Certificate has already been issued for this enrollment.'));
      }

      if (!enrol.batchId) return Err(AppError.businessRule('Enrollment is not linked to any batch.'));

      // Fetch dynamic batch eligibility configurations from flwdsk_batch_eligibility_rules
      const { data: rules } = await supabase
        .from('flwdsk_batch_eligibility_rules')
        .select('*')
        .eq('batch_id', enrol.batchId)
        .maybeSingle();

      // Evaluate student final exam eligibility
      const mappedStudent = {
        ...student,
        ...(student.customFields || {})
      };
      const eligRes = calculateFinalExamEligibility(mappedStudent, rules || undefined);

      if (!eligRes.eligible) {
        return Err(AppError.businessRule(`Student is not eligible for certificate: ${eligRes.reason}`));
      }

      // Fetch course pass percentage
      const batch = await this.batchRepo.findById(enrol.batchId);
      if (!batch) return Err(AppError.notFound('Batch not found.'));

      const course = await this.courseRepo.findById(batch.courseId);
      const passMark = course?.passPercentage ?? 70;

      // Fetch highest active exam attempt score
      const { data: attempts } = await supabase
        .from('flwdsk_exam_attempts')
        .select('score')
        .eq('student_id', enrol.studentId)
        .eq('batch_id', enrol.batchId)
        .is('deleted_at', null);

      const scores = (attempts || []).map(a => Number(a.score ?? 0));
      const highestScore = scores.length > 0 ? Math.max(...scores) : 0;

      if (scores.length === 0 || highestScore < passMark) {
        return Err(AppError.businessRule(`Student has not passed the exam. Highest score: ${highestScore}, required: ${passMark}`));
      }

      const certNumber = `CERT-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      const cert = await this.certificateRepo.create({
        enrollmentId,
        certificateNumber: certNumber,
        verificationQrUrl: `https://kvj-analytics.co/verify/${certNumber}`,
        digitalSignature: `SIG-${this.uuid().substring(0, 8).toUpperCase()}`,
        issuedAt: new Date().toISOString()
      }, actor);

      // Synchronize compatibility cache on student record
      try {
        const currentFields = student.customFields || {};
        const updatedFields = {
          ...currentFields,
          certificateStatus: 'issued',
          certificate_status: 'issued',
        };
        await supabase
          .from('flwdsk_student_records')
          .update({ custom_fields: updatedFields })
          .eq('id', enrol.studentId);
      } catch (err) {
        console.warn('Failed to update student certificate status cache:', err);
      }

      await this.activity.log('student', enrol.studentId, actor, 'approve', `Generated digital graduation certificate: ${certNumber}`);
      await this.audit.log(actor, 'approve', 'certificates', cert.id, { newValues: cert });
      return Ok(cert);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async trackReferral(referrerId: UUID, code: string, email: string, actor: Actor): Promise<Result<ReferralRecord>> {
    try {
      const referral = await this.referralRepo.create({
        referrerStudentId: referrerId,
        referralCode: code,
        refereeEmail: email,
        rewardAmount: 1000.00,
        payoutEligible: false
      }, actor);
      await this.activity.log('student', referrerId, actor, 'create', `Generated referral link for ${email}`);
      return Ok(referral);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async graduateStudent(studentId: UUID, gradDate: string, employer?: string, designation?: string, pkg?: number, testimonial?: string, actor?: Actor): Promise<Result<AlumniProfile>> {
    try {
      const act = actor ?? { id: studentId, role: 'Employee' };
      const alumni = await this.alumniRepo.create({
        studentId,
        graduationDate: gradDate,
        currentEmployer: employer,
        currentDesignation: designation,
        packageAmount: pkg,
        testimonial
      }, act);
      await this.activity.log('student', studentId, act, 'update', `Moved student status to Alumni network.`);
      return Ok(alumni);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async createRetestPaymentVerification(data: Partial<RetestPaymentVerification>, actor: Actor): Promise<Result<RetestPaymentVerification>> {
    try {
      const studentId = data.studentId;
      const batchId = data.batchId;
      const status = data.status || 'Pending';

      if (!studentId || !batchId) {
        return Err(AppError.validation('Student ID and Batch ID are required.'));
      }

      const allowedStatuses = ['Pending', 'Verified'];
      if (!allowedStatuses.includes(status)) {
        return Err(AppError.validation(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`));
      }

      // Check if student exists
      const { data: student } = await supabase
        .from('flwdsk_student_records')
        .select('id')
        .eq('id', studentId)
        .maybeSingle();
      if (!student) return Err(AppError.notFound('Student record not found.'));

      // Check if batch exists
      const { data: batch } = await supabase
        .from('flwdsk_batches')
        .select('id')
        .eq('id', batchId)
        .maybeSingle();
      if (!batch) return Err(AppError.notFound('Batch not found.'));

      // Check if student is enrolled in that batch
      const { data: enrollment } = await supabase
        .from('flwdsk_enrollments')
        .select('id')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!enrollment) return Err(AppError.businessRule('Student is not enrolled in the specified batch.'));

      // If voucher_id is supplied, check that it matches student and batch
      if (data.voucherId) {
        const { data: voucher } = await supabase
          .from('flwdsk_vouchers')
          .select('id, student_id, batch_id')
          .eq('id', data.voucherId)
          .maybeSingle();
        if (!voucher) {
          return Err(AppError.notFound('Voucher not found.'));
        }
        if (voucher.student_id !== studentId || voucher.batch_id !== batchId) {
          return Err(AppError.businessRule('Voucher student/batch mismatch.'));
        }
      }

      const payload = {
        student_id: studentId,
        batch_id: batchId,
        voucher_id: data.voucherId || null,
        status,
        verified_at: status === 'Verified' ? new Date().toISOString() : null,
        verified_by: status === 'Verified' ? actor.id : null,
      };

      // Check if an active record already exists for this student and batch to prevent duplicate rows
      const { data: existingVerification } = await supabase
        .from('flwdsk_retest_payment_verifications')
        .select('id')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .is('deleted_at', null)
        .maybeSingle();

      let newVerification;
      let dbError;

      if (existingVerification) {
        const { data: updated, error: uErr } = await supabase
          .from('flwdsk_retest_payment_verifications')
          .update({
            status,
            voucher_id: data.voucherId || null,
            verified_at: status === 'Verified' ? new Date().toISOString() : null,
            verified_by: status === 'Verified' ? actor.id : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingVerification.id)
          .select('*')
          .single();
        newVerification = updated;
        dbError = uErr;
      } else {
        const { data: inserted, error: iErr } = await supabase
          .from('flwdsk_retest_payment_verifications')
          .insert(payload)
          .select('*')
          .single();
        newVerification = inserted;
        dbError = iErr;
      }

      if (dbError || !newVerification) {
        throw new Error(dbError?.message || 'Failed to persist verification record.');
      }

      const mappedVerification: RetestPaymentVerification = {
        id: newVerification.id,
        studentId: newVerification.student_id,
        batchId: newVerification.batch_id,
        voucherId: newVerification.voucher_id || undefined,
        status: newVerification.status,
        verifiedAt: newVerification.verified_at || undefined,
        verifiedBy: newVerification.verified_by || undefined,
        createdAt: newVerification.created_at,
        updatedAt: newVerification.updated_at,
        deletedAt: newVerification.deleted_at || undefined,
      };

      await this.activity.log('student', studentId, actor, 'approve', `Verified external retest payment with status ${status}`);
      await this.audit.log(actor, 'create', 'retest_payment_verifications', mappedVerification.id, { newValues: mappedVerification });

      return Ok(mappedVerification);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async getRetestPaymentVerificationsForBatch(batchId: UUID): Promise<Result<RetestPaymentVerification[]>> {
    try {
      const { data: dbVerifications, error } = await supabase
        .from('flwdsk_retest_payment_verifications')
        .select('*')
        .eq('batch_id', batchId)
        .is('deleted_at', null);

      if (error) throw error;

      const mapped = (dbVerifications || []).map((v: any) => ({
        id: v.id,
        studentId: v.student_id,
        batchId: v.batch_id,
        voucherId: v.voucher_id || undefined,
        status: v.status,
        verifiedAt: v.verified_at || undefined,
        verifiedBy: v.verified_by || undefined,
        createdAt: v.createdAt || v.created_at,
        updatedAt: v.updated_at,
        deletedAt: v.deleted_at || undefined,
      }));

      return Ok(mapped);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async getCertificateDelivery(enrollmentId: UUID): Promise<Result<CertificateRecord | null>> {
    try {
      const { data: dbCert, error } = await supabase
        .from('flwdsk_certificates')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) throw error;
      if (!dbCert) return Ok(null);

      return Ok({
        id: dbCert.id,
        status: dbCert.status || 'active',
        enrollmentId: dbCert.enrollment_id,
        certificateNumber: dbCert.certificate_number,
        verificationQrUrl: dbCert.verification_qr_url,
        digitalSignature: dbCert.digital_signature,
        issuedAt: dbCert.issued_at,
        deliveryDate: dbCert.delivery_date || undefined,
        collectedBy: dbCert.collected_by || undefined,
        certificateCount: dbCert.certificate_count || undefined,
        certificateReceiptPath: dbCert.certificate_receipt_path || undefined,
        createdAt: dbCert.created_at,
        updatedAt: dbCert.updated_at,
        createdBy: dbCert.created_by || null,
        updatedBy: dbCert.updated_by || null,
        deletedAt: dbCert.deleted_at || null,
        deletedBy: dbCert.deleted_by || null,
      });
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async saveCertificateDelivery(
    enrollmentId: UUID,
    studentId: UUID,
    deliveryDate: string,
    collectedBy: string,
    certificateCount: number,
    certificateReceiptPath: string,
    actor: Actor
  ): Promise<Result<CertificateRecord>> {
    try {
      // Validate deliveryDate
      if (!deliveryDate) {
        return Err(AppError.businessRule('Delivery Date is required.'));
      }

      // Validate collectedBy
      const trimmedCollector = (collectedBy || '').trim();
      if (!trimmedCollector) {
        return Err(AppError.businessRule('Collected By is required.'));
      }

      // Validate certificateCount
      if (!Number.isInteger(certificateCount) || certificateCount <= 0) {
        return Err(AppError.businessRule('Number of certificates must be an integer greater than 0.'));
      }

      // Validate certificateReceiptPath
      if (!certificateReceiptPath) {
        return Err(AppError.businessRule('Certificate Receipt is required.'));
      }

      // Check if certificate already exists
      const { data: existingCert } = await supabase
        .from('flwdsk_certificates')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .is('deleted_at', null)
        .maybeSingle();

      let cert: any;
      if (existingCert) {
        const { data, error } = await supabase
          .from('flwdsk_certificates')
          .update({
            delivery_date: deliveryDate,
            collected_by: trimmedCollector,
            certificate_count: certificateCount,
            certificate_receipt_path: certificateReceiptPath,
            updated_at: new Date().toISOString(),
            updated_by: actor.id
          })
          .eq('id', existingCert.id)
          .select()
          .single();

        if (error) throw error;
        cert = data;
      } else {
        const certNumber = `CERT-2026-${Math.floor(100000 + Math.random() * 900000)}`;
        const { data, error } = await supabase
          .from('flwdsk_certificates')
          .insert({
            enrollment_id: enrollmentId,
            student_id: studentId,
            certificate_number: certNumber,
            verification_qr_url: `https://kvj-analytics.co/verify/${certNumber}`,
            digital_signature: `SIG-${this.uuid().substring(0, 8).toUpperCase()}`,
            issued_at: new Date().toISOString(),
            delivery_date: deliveryDate,
            collected_by: trimmedCollector,
            certificate_count: certificateCount,
            certificate_receipt_path: certificateReceiptPath,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: actor.id,
            updated_by: actor.id
          })
          .select()
          .single();

        if (error) throw error;
        cert = data;
      }

      // Audit log
      await this.audit.log(actor, 'update', 'certificates', cert.id, {
        newValues: {
          delivery_date: deliveryDate,
          collected_by: trimmedCollector,
          certificate_count: certificateCount,
          certificate_receipt_path: certificateReceiptPath
        }
      });

      return Ok({
        id: cert.id,
        status: cert.status || 'active',
        enrollmentId: cert.enrollment_id,
        certificateNumber: cert.certificate_number,
        verificationQrUrl: cert.verification_qr_url,
        digitalSignature: cert.digital_signature,
        issuedAt: cert.issued_at,
        deliveryDate: cert.delivery_date,
        collectedBy: cert.collected_by,
        certificateCount: cert.certificate_count,
        certificateReceiptPath: cert.certificate_receipt_path,
        createdAt: cert.created_at,
        updatedAt: cert.updated_at,
        createdBy: cert.created_by || null,
        updatedBy: cert.updated_by || null,
        deletedAt: cert.deleted_at || null,
        deletedBy: cert.deleted_by || null,
      });
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async uploadCertificateReceipt(file: File, path: string): Promise<Result<string>> {
    try {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        return Err(AppError.businessRule('Invalid file type. Only JPEG, PNG, WEBP and PDF files are supported.'));
      }

      const maxSize = 5 * 1024 * 1024; // 5 MB
      if (file.size > maxSize) {
        return Err(AppError.businessRule('File size exceeds the maximum limit of 5 MB.'));
      }

      const { data, error } = await supabase.storage
        .from('certificate-receipts')
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;
      return Ok(data.path);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async getCertificateReceiptUrl(path: string): Promise<Result<string>> {
    try {
      const { data, error } = await supabase.storage
        .from('certificate-receipts')
        .createSignedUrl(path, 3600); // 1 hour validity

      if (error) throw error;
      return Ok(data.signedUrl);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async deleteCertificateReceipt(path: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.storage
        .from('certificate-receipts')
        .remove([path]);

      if (error) throw error;
      return Ok(undefined);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async removeEnrollment(
    studentId: UUID,
    batchId: UUID,
    actionType: 'ENROLLMENT_REMOVED' | 'ENROLLMENT_BULK_REMOVED' | 'ENROLLMENT_DEDUPLICATED',
    actor: Actor
  ): Promise<Result<void>> {
    try {
      const ts = new Date().toISOString();

      // Find active enrollment
      const { data: enrollment, error: findErr } = await supabase
        .from('flwdsk_enrollments')
        .select('*')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .is('deleted_at', null)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!enrollment) {
        return Err(AppError.notFound('Active enrollment not found for this student and batch.'));
      }

      // Update deleted_at and deleted_by
      const { error: updateErr } = await supabase
        .from('flwdsk_enrollments')
        .update({
          deleted_at: ts,
          deleted_by: actor.id,
          status: 'cancelled'
        })
        .eq('id', enrollment.id);

      if (updateErr) throw updateErr;

      // Log to database audit table
      const { error: auditErr } = await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: actionType,
        entity_type: 'enrollments',
        entity_id: enrollment.id,
        old_value: enrollment,
        new_value: { ...enrollment, deleted_at: ts, deleted_by: actor.id, status: 'cancelled' },
        reason: actionType === 'ENROLLMENT_DEDUPLICATED'
          ? 'Duplicate enrollment deactivated during auto-cleanup'
          : actionType === 'ENROLLMENT_BULK_REMOVED'
            ? 'Bulk student removal from batch'
            : 'Single student removal from batch'
      });

      if (auditErr) {
        console.warn('Failed to insert database audit log:', auditErr.message);
      }

      // Log to in-memory core audit engine
      await this.activity.log('student', studentId, actor, 'unassign', `Removed student from batch ${batchId}`);
      await this.audit.log(actor, 'delete', 'enrollments', enrollment.id, {
        oldValues: enrollment,
        newValues: { ...enrollment, deleted_at: ts, deleted_by: actor.id, status: 'cancelled' }
      });

      return Ok(undefined);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async removeBatch(batchId: UUID, actor: Actor): Promise<Result<void>> {
    try {
      const ts = new Date().toISOString();

      // 1. Soft-delete all active enrollments for this batch
      const { data: activeEnrollments, error: findEnrErr } = await supabase
        .from('flwdsk_enrollments')
        .select('*')
        .eq('batch_id', batchId)
        .is('deleted_at', null);

      if (findEnrErr) throw findEnrErr;

      if (activeEnrollments && activeEnrollments.length > 0) {
        const enrIds = activeEnrollments.map(e => e.id);
        const { error: updEnrErr } = await supabase
          .from('flwdsk_enrollments')
          .update({
            deleted_at: ts,
            deleted_by: actor.id,
            status: 'cancelled'
          })
          .in('id', enrIds);

        if (updEnrErr) throw updEnrErr;

        // Log audit log for bulk deactivation
        for (const enrollment of activeEnrollments) {
          await supabase.from('flwdsk_audit_logs').insert({
            actor_id: actor.id,
            action: 'BATCH_ENROLLMENTS_DEACTIVATED',
            entity_type: 'enrollments',
            entity_id: enrollment.id,
            old_value: enrollment,
            new_value: { ...enrollment, deleted_at: ts, deleted_by: actor.id, status: 'cancelled' },
            reason: 'Batch deactivation / soft-delete'
          });
        }
      }

      // 2. Soft-delete the batch itself
      const { error: updBatchErr } = await supabase
        .from('flwdsk_batches')
        .update({
          deleted_at: ts,
          deleted_by: actor.id,
          phase: 'Completed'
        })
        .eq('id', batchId);

      if (updBatchErr) throw updBatchErr;

      // Log activity and audit trail for batch deletion
      await this.activity.log('training', batchId, actor, 'delete', `Soft-deleted batch ${batchId}`);
      await this.audit.log(actor, 'delete', 'batches', batchId, {
        newValues: {
          deletedAt: ts,
          deletedBy: actor.id
        }
      });

      return Ok(undefined);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async issueVoucher(
    studentId: UUID,
    batchId: UUID,
    voucherCode: string,
    voucherType: 'Initial' | 'Retest',
    actor: Actor
  ): Promise<Result<any>> {
    try {
      // 1. Verify student and active enrollment
      const student = await this.studentRepo.findById(studentId);
      if (!student) return Err(AppError.notFound('Student not found.'));

      const { data: enrol, error: enrolErr } = await supabase
        .from('flwdsk_enrollments')
        .select('*')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .is('deleted_at', null)
        .maybeSingle();

      if (enrolErr) throw enrolErr;
      if (!enrol) {
        return Err(AppError.businessRule('Student is not enrolled in this batch.'));
      }

      // 2. Prevent duplicate voucher assignment of the same type for this batch
      const { data: existingV, error: exErr } = await supabase
        .from('flwdsk_vouchers')
        .select('*')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .eq('voucher_type', voucherType)
        .maybeSingle();

      if (exErr) throw exErr;
      if (existingV) {
        return Err(AppError.businessRule(`A voucher of type "${voucherType}" is already assigned to this student in this batch.`));
      }

      // 3. Validation based on type
      if (voucherType === 'Initial') {
        const { data: rules } = await supabase
          .from('flwdsk_batch_eligibility_rules')
          .select('*')
          .eq('batch_id', batchId)
          .maybeSingle();

        const mappedStudent = {
          ...student,
          ...(student.customFields || {})
        };

        const eligRes = calculateFinalExamEligibility(mappedStudent, rules || undefined);
        if (!eligRes.eligible) {
          return Err(AppError.businessRule(`Student is not eligible for voucher: ${eligRes.reason}`));
        }
      } else if (voucherType === 'Retest') {
        // Resolve pass mark dynamically
        const { data: batch } = await supabase.from('flwdsk_batches').select('course_id').eq('id', batchId).single();
        if (!batch) return Err(AppError.notFound('Batch not found.'));
        const { data: course } = await supabase.from('flwdsk_courses').select('pass_percentage, passPercentage').eq('id', batch.course_id).single();
        if (!course) return Err(AppError.notFound('Course not found.'));
        const passMark = course.passPercentage ?? course.pass_percentage ?? 70;

        // Verify they failed the initial exam attempt
        const { data: initialAttempts } = await supabase
          .from('flwdsk_exam_attempts')
          .select('mark')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .eq('attempt_type', 'Initial')
          .is('deleted_at', null);

        const hasInitial = initialAttempts && initialAttempts.length > 0;
        const highestInitial = hasInitial ? Math.max(...initialAttempts.map(a => a.mark)) : 0;
        if (!hasInitial || highestInitial >= passMark) {
          return Err(AppError.businessRule('Student has not failed the initial exam attempt.'));
        }

        // Verify payment is marked Verified
        const { data: payVer } = await supabase
          .from('flwdsk_retest_payment_verifications')
          .select('*')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .maybeSingle();

        if (!payVer || payVer.verification_status !== 'Verified') {
          return Err(AppError.businessRule('Retest voucher assignment is blocked: payment verification is pending or missing.'));
        }
      }

      // 4. Create voucher
      const { data: voucher, error: insErr } = await supabase
        .from('flwdsk_vouchers')
        .insert({
          student_id: studentId,
          batch_id: batchId,
          enrollment_id: enrol.id,
          voucher_code: voucherCode,
          voucher_type: voucherType,
          status: 'Assigned',
          assigned_date: new Date().toISOString(),
          assigned_by: actor.id
        })
        .select()
        .single();

      if (insErr) throw insErr;

      // 5. Log audit details
      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: 'VOUCHER_CREATED',
        entity_type: 'vouchers',
        entity_id: voucher.id,
        new_value: voucher,
        reason: 'Manual trainer assignment'
      });

      await this.activity.log('student', studentId, actor, 'approve', `Voucher issued: ${voucherCode} (${voucherType})`);
      await this.audit.log(actor, 'approve', 'vouchers', voucher.id, { newValues: voucher });

      return Ok(voucher);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async deleteVoucher(
    studentId: UUID,
    batchId: UUID,
    voucherType: 'Initial' | 'Retest',
    actor: Actor
  ): Promise<Result<void>> {
    try {
      // 1. Verify existence of the voucher
      const { data: voucher, error: getErr } = await supabase
        .from('flwdsk_vouchers')
        .select('*')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .eq('voucher_type', voucherType)
        .maybeSingle();

      if (getErr) throw getErr;
      if (!voucher) return Err(AppError.notFound('Voucher not found.'));

      // 2. Prevent deleting already redeemed vouchers
      if (voucher.status === 'Redeemed') {
        return Err(AppError.businessRule('Cannot delete a voucher that has already been redeemed.'));
      }

      // 3. Delete the voucher
      const { error: delErr } = await supabase
        .from('flwdsk_vouchers')
        .delete()
        .eq('id', voucher.id);

      if (delErr) throw delErr;

      // 4. Log to audit trails
      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: 'VOUCHER_DELETED',
        entity_type: 'vouchers',
        entity_id: voucher.id,
        old_value: voucher,
        reason: 'Manual trainer revoke'
      });

      await this.activity.log('student', studentId, actor, 'reject', `Voucher revoked: ${voucher.voucher_code}`);
      await this.audit.log(actor, 'reject', 'vouchers', voucher.id, { oldValues: voucher });

      return Ok(undefined);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async recordExamAttempt(
    studentId: UUID,
    batchId: UUID,
    attemptType: 'Initial' | 'Retest',
    score: number,
    voucherCode: string | null,
    screenshotUrl: string | null,
    submittedBy: string,
    actor: Actor,
    allowVoucherReuse?: boolean
  ): Promise<Result<any>> {
    try {
      // 1. Verify student and active enrollment
      const student = await this.studentRepo.findById(studentId);
      if (!student) return Err(AppError.notFound('Student not found.'));

      const { data: enrol, error: enrolErr } = await supabase
        .from('flwdsk_enrollments')
        .select('*')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .is('deleted_at', null)
        .maybeSingle();

      if (enrolErr) throw enrolErr;
      if (!enrol) {
        return Err(AppError.businessRule('Student is not enrolled in this batch.'));
      }

      // 2. Fetch pass mark dynamically
      const { data: batch } = await supabase.from('flwdsk_batches').select('course_id').eq('id', batchId).single();
      if (!batch) return Err(AppError.notFound('Batch not found.'));
      const { data: course } = await supabase.from('flwdsk_courses').select('pass_percentage, passPercentage').eq('id', batch.course_id).single();
      if (!course) return Err(AppError.notFound('Course not found.'));
      const passMark = course.passPercentage ?? course.pass_percentage ?? 70;

      // 3. Resolve and validate voucher if provided
      let voucherRecord: any = null;
      if (voucherCode) {
        const { data: vRecord, error: vErr } = await supabase
          .from('flwdsk_vouchers')
          .select('*')
          .eq('voucher_code', voucherCode)
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .maybeSingle();

        if (vErr) throw vErr;
        if (!vRecord) {
          return Err(AppError.notFound('Voucher code not found or student/batch mismatch.'));
        }
        if (vRecord.status === 'Redeemed' && !allowVoucherReuse) {
          return Err(AppError.businessRule('Voucher has already been redeemed.'));
        }
        if (vRecord.voucher_type !== attemptType) {
          return Err(AppError.businessRule('Voucher type does not match attempt type.'));
        }
        voucherRecord = vRecord;
      }

      // 4. Validate by attempt type
      if (attemptType === 'Initial') {
        const { data: rules } = await supabase
          .from('flwdsk_batch_eligibility_rules')
          .select('*')
          .eq('batch_id', batchId)
          .maybeSingle();

        const mappedStudent = {
          ...student,
          ...(student.customFields || {})
        };

        const eligRes = calculateFinalExamEligibility(mappedStudent, rules || undefined);
        if (!eligRes.eligible) {
          return Err(AppError.businessRule(`Student is not eligible for initial exam: ${eligRes.reason}`));
        }
      } else if (attemptType === 'Retest') {
        // Must have failed the initial exam attempt
        const { data: initialAttempts } = await supabase
          .from('flwdsk_exam_attempts')
          .select('mark')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .eq('attempt_type', 'Initial')
          .is('deleted_at', null);

        const hasInitial = initialAttempts && initialAttempts.length > 0;
        const highestInitial = hasInitial ? Math.max(...initialAttempts.map(a => a.mark)) : 0;
        if (!hasInitial || highestInitial >= passMark) {
          return Err(AppError.businessRule('Student has not failed the initial exam attempt.'));
        }

        // Must be payment verified
        const { data: payVer } = await supabase
          .from('flwdsk_retest_payment_verifications')
          .select('*')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .maybeSingle();

        if (!payVer || payVer.verification_status !== 'Verified') {
          return Err(AppError.businessRule('Retest attempt is blocked: payment verification is pending or missing.'));
        }
      }

      // 5. Calculate attempt number
      const { data: existingAttempts, error: attErr } = await supabase
        .from('flwdsk_exam_attempts')
        .select('attempt_number')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .eq('attempt_type', attemptType)
        .is('deleted_at', null);

      if (attErr) throw attErr;

      const attemptNum = (existingAttempts?.length ?? 0) + 1;

      // 6. Concurrency / duplicate submission protection
      const { data: duplicateCheck } = await supabase
        .from('flwdsk_exam_attempts')
        .select('id')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .eq('attempt_type', attemptType)
        .eq('attempt_number', attemptNum)
        .is('deleted_at', null)
        .maybeSingle();

      if (duplicateCheck) {
        return Err(AppError.businessRule('This exam attempt number has already been recorded.'));
      }

      // 7. Insert the exam attempt
      const finalResult = score >= passMark ? 'Passed' : 'Failed';
      const { data: attempt, error: insErr } = await supabase
        .from('flwdsk_exam_attempts')
        .insert({
          student_id: studentId,
          batch_id: batchId,
          attempt_type: attemptType,
          attempt_number: attemptNum,
          mark: score,
          result: finalResult,
          screenshot_url: screenshotUrl || null,
          submitted_by: submittedBy,
          updated_by: actor.id,
          remarks: submittedBy === 'Trainer Manual Entry' ? 'Manual entry by trainer.' : 'Uploaded by student via secure portal.'
        })
        .select()
        .single();

      if (insErr) throw insErr;

      // 8. Update compatibility custom fields cache
      const currentFields = student.customFields || {};
      const updatedFields = {
        ...currentFields,
        ...(attemptType === 'Initial'
          ? {
              finalExam: score,
              finalExamResult: finalResult,
              examAttemptCount: attemptNum,
            }
          : {
              retestScore: score,
              examAttemptCount: attemptNum,
            })
      };

      await supabase
        .from('flwdsk_student_records')
        .update({ custom_fields: updatedFields })
        .eq('id', studentId);

      // 9. Redeem voucher if present
      if (voucherRecord) {
        await supabase
          .from('flwdsk_vouchers')
          .update({ status: 'Redeemed', sent_status: 'Sent' })
          .eq('id', voucherRecord.id);
      }

      // 10. Audit trace
      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: attemptType === 'Initial' ? 'EXAM_ATTEMPT_CREATED' : 'RETEST_ATTEMPT_CREATED',
        entity_type: 'exam_attempts',
        entity_id: attempt.id,
        new_value: attempt,
        reason: submittedBy === 'Trainer Manual Entry' ? 'Manual trainer entry' : 'Student portal exam submission'
      });

      await this.activity.log('student', studentId, actor, 'approve', `Recorded ${attemptType} exam attempt: score ${score}%`);
      await this.audit.log(actor, 'approve', 'exam_attempts', attempt.id, { newValues: attempt });

      return Ok(attempt);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async logSessionAttendanceCell(
    batchId: UUID,
    studentId: UUID,
    dateStr: string,
    sessionTitle: string,
    status: string,
    actor: Actor
  ): Promise<Result<void>> {
    try {
      // 1. Verify student and active enrollment
      const student = await this.studentRepo.findById(studentId);
      if (!student) return Err(AppError.notFound('Student not found.'));

      const { data: enrol, error: enrolErr } = await supabase
        .from('flwdsk_enrollments')
        .select('*')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .is('deleted_at', null)
        .maybeSingle();

      if (enrolErr) throw enrolErr;
      if (!enrol) {
        return Err(AppError.businessRule('Student is not enrolled in this batch.'));
      }

      // 2. Check for existing session attendance cell
      const { data: existing, error: findErr } = await supabase
        .from('flwdsk_schedule_sessions')
        .select('*')
        .eq('batch_id', batchId)
        .eq('student_id', studentId)
        .eq('date', dateStr)
        .eq('session_title', sessionTitle)
        .maybeSingle();

      if (findErr) throw findErr;

      const payload = {
        batch_id: batchId,
        student_id: studentId,
        date: dateStr,
        status: status.toUpperCase(),
        topic: 'Batch Session',
        session_title: sessionTitle,
        updated_at: new Date().toISOString()
      };

      let oldStatus: string | null = null;
      if (existing) {
        oldStatus = existing.status;
        const { error: updErr } = await supabase
          .from('flwdsk_schedule_sessions')
          .update(payload)
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('flwdsk_schedule_sessions')
          .insert(payload);
        if (insErr) throw insErr;
      }

      // 3. Recalculate student attendance compatibility cache
      const { data: allSessions } = await supabase
        .from('flwdsk_schedule_sessions')
        .select('status')
        .eq('batch_id', batchId)
        .eq('student_id', studentId)
        .is('deleted_at', null);

      if (allSessions) {
        const total = allSessions.length;
        const attended = allSessions.filter((s: any) => s.status && s.status.toLowerCase() !== 'absent').length;
        const calcPct = total > 0 ? Math.round((attended / total) * 100) : 100;

        let considerAttendance = true;
        let attendanceThreshold = 85;

        const { data: rules } = await supabase
          .from('flwdsk_batch_eligibility_rules')
          .select('*')
          .eq('batch_id', batchId)
          .maybeSingle();

        if (rules) {
          considerAttendance = rules.consider_attendance;
          attendanceThreshold = rules.attendance_pass_percentage;
        }

        const attendanceStatus = (!considerAttendance || calcPct >= attendanceThreshold) ? 'Regular' : 'Irregular';

        const { data: studentData } = await supabase
          .from('flwdsk_student_records')
          .select('custom_fields')
          .eq('id', studentId)
          .maybeSingle();

        if (studentData) {
          const currentFields = studentData.custom_fields || {};
          const updatedFields = {
            ...currentFields,
            attendancePct: calcPct,
            attendance_pct: calcPct,
            attendanceStatus,
            attendance_status: attendanceStatus,
          };

          await supabase
            .from('flwdsk_student_records')
            .update({ custom_fields: updatedFields })
            .eq('id', studentId);
        }
      }

      // 4. Log database audit log row
      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: existing ? 'ATTENDANCE_UPDATED' : 'ATTENDANCE_RECORDED',
        entity_type: 'attendance',
        entity_id: studentId,
        old_value: existing ? { status: oldStatus } : null,
        new_value: { status: status.toUpperCase(), date: dateStr, sessionTitle },
        reason: 'Trainer logs session attendance'
      });

      await this.activity.log('attendance', batchId, actor, 'update', `Logged attendance status ${status} for student ${studentId} on ${dateStr} (${sessionTitle})`);

      return Ok(undefined);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updateSessionDate(
    batchId: UUID,
    oldDate: string,
    newDate: string,
    sessionTitle: string,
    actor: Actor
  ): Promise<Result<void>> {
    try {
      const { error: updErr } = await supabase
        .from('flwdsk_schedule_sessions')
        .update({ date: newDate })
        .eq('batch_id', batchId)
        .eq('date', oldDate)
        .eq('session_title', sessionTitle);

      if (updErr) throw updErr;

      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: 'ATTENDANCE_UPDATED',
        entity_type: 'attendance_sessions',
        entity_id: batchId,
        old_value: { date: oldDate, sessionTitle },
        new_value: { date: newDate, sessionTitle },
        reason: 'Trainer updates session date'
      });

      await this.activity.log('attendance', batchId, actor, 'update', `Updated session date from ${oldDate} to ${newDate} for ${sessionTitle}`);

      return Ok(undefined);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updateSessionHour(
    batchId: UUID,
    dateStr: string,
    oldSessionTitle: string,
    newSessionTitle: string,
    actor: Actor
  ): Promise<Result<void>> {
    try {
      const { error: updErr } = await supabase
        .from('flwdsk_schedule_sessions')
        .update({ session_title: newSessionTitle })
        .eq('batch_id', batchId)
        .eq('date', dateStr)
        .eq('session_title', oldSessionTitle);

      if (updErr) throw updErr;

      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: 'ATTENDANCE_UPDATED',
        entity_type: 'attendance_sessions',
        entity_id: batchId,
        old_value: { date: dateStr, sessionTitle: oldSessionTitle },
        new_value: { date: dateStr, sessionTitle: newSessionTitle },
        reason: 'Trainer updates session hour'
      });

      await this.activity.log('attendance', batchId, actor, 'update', `Updated session hour from ${oldSessionTitle} to ${newSessionTitle} for ${dateStr}`);

      return Ok(undefined);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async deleteSessionColumn(
    batchId: UUID,
    dateStr: string,
    sessionTitle: string,
    actor: Actor
  ): Promise<Result<void>> {
    try {
      // Find affected students to update their cache afterwards
      const { data: affectedStudents, error: findErr } = await supabase
        .from('flwdsk_schedule_sessions')
        .select('student_id')
        .eq('batch_id', batchId)
        .eq('date', dateStr)
        .eq('session_title', sessionTitle);

      if (findErr) throw findErr;

      const { error: delErr } = await supabase
        .from('flwdsk_schedule_sessions')
        .delete()
        .eq('batch_id', batchId)
        .eq('date', dateStr)
        .eq('session_title', sessionTitle);

      if (delErr) throw delErr;

      // Recalculate cache for each affected student
      if (affectedStudents && affectedStudents.length > 0) {
        const uniqueStudentIds = Array.from(new Set(affectedStudents.map(s => s.student_id))) as UUID[];
        for (const studentId of uniqueStudentIds) {
          const { data: allSessions } = await supabase
            .from('flwdsk_schedule_sessions')
            .select('status')
            .eq('batch_id', batchId)
            .eq('student_id', studentId)
            .is('deleted_at', null);

          const total = allSessions ? allSessions.length : 0;
          const attended = allSessions ? allSessions.filter((s: any) => s.status && s.status.toLowerCase() !== 'absent').length : 0;
          const calcPct = total > 0 ? Math.round((attended / total) * 100) : 100;

          let considerAttendance = true;
          let attendanceThreshold = 85;

          const { data: rules } = await supabase
            .from('flwdsk_batch_eligibility_rules')
            .select('*')
            .eq('batch_id', batchId)
            .maybeSingle();

          if (rules) {
            considerAttendance = rules.consider_attendance;
            attendanceThreshold = rules.attendance_pass_percentage;
          }

          const attendanceStatus = (!considerAttendance || calcPct >= attendanceThreshold) ? 'Regular' : 'Irregular';

          const { data: studentData } = await supabase
            .from('flwdsk_student_records')
            .select('custom_fields')
            .eq('id', studentId)
            .maybeSingle();

          if (studentData) {
            const currentFields = studentData.custom_fields || {};
            const updatedFields = {
              ...currentFields,
              attendancePct: calcPct,
              attendance_pct: calcPct,
              attendanceStatus,
              attendance_status: attendanceStatus,
            };

            await supabase
              .from('flwdsk_student_records')
              .update({ custom_fields: updatedFields })
              .eq('id', studentId);
          }
        }
      }

      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: 'ATTENDANCE_DELETED',
        entity_type: 'attendance_sessions',
        entity_id: batchId,
        old_value: { date: dateStr, sessionTitle },
        reason: 'Trainer deletes session column'
      });

      return Ok(undefined);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updateVoucherSentStatus(
    voucherId: UUID,
    sentStatus: 'Pending' | 'Sent',
    actor: Actor
  ): Promise<Result<any>> {
    try {
      if (!actor || !actor.id) {
        return Err(new AppError({ code: ErrorCode.UNAUTHENTICATED, message: 'Actor not authenticated.', severity: 'warning' }));
      }

      const isAllowed = actor.role === 'ADMIN' || actor.role === 'TRAINER';
      if (!isAllowed) {
        return Err(AppError.forbidden('You do not have permission to update voucher status.'));
      }

      const { data: voucher, error: getErr } = await supabase
        .from('flwdsk_vouchers')
        .select('*')
        .eq('id', voucherId)
        .maybeSingle();

      if (getErr) throw getErr;
      if (!voucher) return Err(AppError.notFound('Voucher not found.'));

      const payload = {
        sent_status: sentStatus,
        sent_time: sentStatus === 'Sent' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        updated_by: actor.id
      };

      const { data: updated, error: updErr } = await supabase
        .from('flwdsk_vouchers')
        .update(payload)
        .eq('id', voucherId)
        .select()
        .single();

      if (updErr) throw updErr;

      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: 'VOUCHER_SENT_STATUS_UPDATED',
        entity_type: 'vouchers',
        entity_id: voucherId,
        new_value: updated,
        reason: 'Voucher notification status changed'
      });

      return Ok({
        id: updated.id,
        studentId: updated.student_id,
        batchId: updated.batch_id,
        voucherCode: updated.voucher_code,
        voucherType: updated.voucher_type,
        status: updated.status,
        sentStatus: updated.sent_status,
        sentTime: updated.sent_time
      });
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async verifyRetestPayment(
    studentId: UUID,
    batchId: UUID,
    status: 'Pending' | 'Verified',
    actor: Actor
  ): Promise<Result<RetestPaymentVerification>> {
    try {
      if (!actor || !actor.id) {
        return Err(new AppError({ code: ErrorCode.UNAUTHENTICATED, message: 'Actor not authenticated.', severity: 'warning' }));
      }

      const { data: voucher } = await supabase
        .from('flwdsk_vouchers')
        .select('id')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .eq('voucher_type', 'Retest')
        .maybeSingle();

      return this.createRetestPaymentVerification({
        studentId,
        batchId,
        status,
        voucherId: voucher?.id || undefined
      }, actor);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async saveBatchEligibilityRules(
    batchId: UUID,
    considerAttendance: boolean,
    attendancePassPercentage: number,
    assessmentPassPercentage: number,
    eligibilityCriteria: any[],
    actor: Actor
  ): Promise<Result<any>> {
    try {
      if (!actor || !actor.id) {
        return Err(new AppError({ code: ErrorCode.UNAUTHENTICATED, message: 'Actor not authenticated.', severity: 'warning' }));
      }

      const isAllowed = actor.role === 'ADMIN' || actor.role === 'TRAINER';
      if (!isAllowed) {
        return Err(AppError.forbidden('You do not have permission to manage batch eligibility rules.'));
      }

      const { data: batch } = await supabase
        .from('flwdsk_batches')
        .select('id')
        .eq('id', batchId)
        .maybeSingle();
      if (!batch) return Err(AppError.notFound('Batch not found.'));

      if (
        isNaN(attendancePassPercentage) ||
        attendancePassPercentage < 0 ||
        attendancePassPercentage > 100
      ) {
        return Err(AppError.validation('Attendance pass percentage must be a valid number between 0 and 100.'));
      }

      if (
        isNaN(assessmentPassPercentage) ||
        assessmentPassPercentage < 0 ||
        assessmentPassPercentage > 100
      ) {
        return Err(AppError.validation('Assessment pass percentage must be a valid number between 0 and 100.'));
      }

      const cleanCriteria = (eligibilityCriteria || []).filter((c: any) => c.assessment !== 'finalExam');

      const { data: existing } = await supabase
        .from('flwdsk_batch_eligibility_rules')
        .select('*')
        .eq('batch_id', batchId)
        .maybeSingle();

      const payload = {
        batch_id: batchId,
        consider_attendance: considerAttendance,
        attendance_pass_percentage: attendancePassPercentage,
        assessment_pass_percentage: assessmentPassPercentage,
        eligibility_criteria: cleanCriteria,
        updated_at: new Date().toISOString()
      };

      let resultRecord;
      let dbError;

      if (existing) {
        const { data: updated, error: uErr } = await supabase
          .from('flwdsk_batch_eligibility_rules')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();
        resultRecord = updated;
        dbError = uErr;
      } else {
        const { data: inserted, error: iErr } = await supabase
          .from('flwdsk_batch_eligibility_rules')
          .insert(payload)
          .select()
          .single();
        resultRecord = inserted;
        dbError = iErr;
      }

      if (dbError || !resultRecord) {
        throw new Error(dbError?.message || 'Failed to save eligibility configuration.');
      }

      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: 'BATCH_ELIGIBILITY_RULES_UPDATED',
        entity_type: 'batch_eligibility_rules',
        entity_id: resultRecord.id,
        new_value: resultRecord,
        reason: 'Eligibility rule configuration saved'
      });

      return Ok({
        id: resultRecord.id,
        batchId: resultRecord.batch_id,
        considerAttendance: resultRecord.consider_attendance,
        attendancePassPercentage: resultRecord.attendance_pass_percentage,
        assessmentPassPercentage: resultRecord.assessment_pass_percentage,
        eligibilityCriteria: resultRecord.eligibility_criteria
      });
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async resolveExamAttemptDiscrepancy(
    studentId: UUID,
    batchId: UUID,
    attemptType: 'Initial' | 'Retest',
    category: string,
    resolutionAction: string,
    resolutionReason: string,
    selectedDuplicateId: UUID | null,
    dbMark: number | null,
    cacheMark: number | null,
    coursePassPct: number,
    actor: Actor
  ): Promise<Result<any>> {
    try {
      if (!actor || !actor.id) {
        return Err(new AppError({ code: ErrorCode.UNAUTHENTICATED, message: 'Actor not authenticated.', severity: 'warning' }));
      }

      const isAllowed = actor.role === 'ADMIN' || actor.role === 'TRAINER';
      if (!isAllowed) {
        return Err(AppError.forbidden('You do not have permission to resolve exam discrepancies.'));
      }

      const { data: currentStudent, error: checkStudentErr } = await supabase
        .from('flwdsk_student_records')
        .select('custom_fields')
        .eq('id', studentId)
        .single();

      if (checkStudentErr || !currentStudent) {
        return Err(AppError.notFound('Student record no longer exists.'));
      }

      const cf = currentStudent.custom_fields || {};
      const currentCacheMark = attemptType === 'Initial'
        ? (cf.finalExam ?? cf.final_exam ?? 0)
        : (cf.retestScore ?? cf.retest_score ?? 0);

      const { data: currentAttempts, error: checkAttemptsErr } = await supabase
        .from('flwdsk_exam_attempts')
        .select('*')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .eq('attempt_type', attemptType)
        .is('deleted_at', null);

      if (checkAttemptsErr) {
        return Err(AppError.internal('Attempts log fetch failed.'));
      }
      const currentDbMark = (currentAttempts && currentAttempts.length > 0) ? currentAttempts[0].mark : null;

      if (currentCacheMark !== cacheMark || currentDbMark !== dbMark) {
        return Err(AppError.businessRule('Stale Data Detected: Data has changed. Please refresh.'));
      }

      if (category === 'LEGACY_ONLY') {
        if (currentAttempts && currentAttempts.length > 0) {
          return Err(AppError.businessRule('An active attempt log now exists for this student.'));
        }
      }

      if (category === 'DUPLICATE_ATTEMPT') {
        if (!selectedDuplicateId) {
          return Err(AppError.validation('Duplicate ID is required for reconciliation.'));
        }
        const selectedAttempt = currentAttempts?.find(a => a.id === selectedDuplicateId);
        if (!selectedAttempt) {
          return Err(AppError.notFound('Selected duplicate attempt no longer exists.'));
        }
        
        const otherIds = currentAttempts
          ?.map(a => a.id)
          .filter(id => id !== selectedDuplicateId) || [];

        if (otherIds.length === 0) {
          return Err(AppError.businessRule('No other duplicate records remain to be resolved.'));
        }

        if (otherIds.includes(selectedDuplicateId)) {
          return Err(AppError.businessRule('Selected attempt cannot be deleted.'));
        }
      }

      let targetNewValue: number | null = null;
      let targetOldValue: number | null = null;

      if (category === 'CONFLICT') {
        if (resolutionAction === 'USE_LOG_SCORE') {
          targetNewValue = dbMark;
          targetOldValue = cacheMark;

          const customFields = cf || {};
          if (attemptType === 'Initial') {
            customFields.final_exam = dbMark;
            customFields.finalExam = dbMark;
          } else {
            customFields.retest_score = dbMark;
            customFields.retestScore = dbMark;
          }

          const res = await this.updateStudentProfile(studentId, {
            customFields: customFields
          }, actor);
          if (!res.ok) throw new Error(res.error.message);
        } else if (resolutionAction === 'USE_CACHE_SCORE') {
          targetNewValue = cacheMark;
          targetOldValue = dbMark;

          if (!currentAttempts || currentAttempts.length === 0) {
            return Err(AppError.notFound('No database attempt row found.'));
          }

          const { error: updateAttemptErr } = await supabase
            .from('flwdsk_exam_attempts')
            .update({
              mark: cacheMark,
              result: (cacheMark ?? 0) >= coursePassPct ? 'Passed' : 'Failed',
              updated_at: new Date().toISOString(),
              updated_by: actor.id,
              remarks: `Updated via manual reconciliation. Reason: ${resolutionReason}`
            })
            .eq('id', currentAttempts[0].id);

          if (updateAttemptErr) throw updateAttemptErr;
        } else {
          return Err(AppError.validation('Invalid resolution action selected.'));
        }
      } else if (category === 'ATTEMPT_ONLY') {
        if (resolutionAction === 'SYNC_TO_CACHE') {
          targetNewValue = dbMark;
          targetOldValue = cacheMark;

          const customFields = cf || {};
          if (attemptType === 'Initial') {
            customFields.final_exam = dbMark;
            customFields.finalExam = dbMark;
          } else {
            customFields.retest_score = dbMark;
            customFields.retestScore = dbMark;
          }

          const res = await this.updateStudentProfile(studentId, {
            customFields: customFields
          }, actor);
          if (!res.ok) throw new Error(res.error.message);
        } else {
          return Err(AppError.validation('Invalid resolution action selected.'));
        }
      } else if (category === 'LEGACY_ONLY') {
        if (resolutionAction === 'CREATE_LOG') {
          targetNewValue = cacheMark;
          targetOldValue = null;

          const payload = {
            student_id: studentId,
            batch_id: batchId,
            attempt_type: attemptType,
            attempt_number: attemptType === 'Initial' ? 1 : 2,
            mark: cacheMark,
            result: (cacheMark ?? 0) >= coursePassPct ? 'Passed' : 'Failed',
            submitted_by: 'Trainer Manual Entry',
            remarks: `Historical attempt reconstruction. Reason: ${resolutionReason}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { error: insertAttemptErr } = await supabase
            .from('flwdsk_exam_attempts')
            .insert(payload);

          if (insertAttemptErr) throw insertAttemptErr;
        } else {
          return Err(AppError.validation('Invalid resolution action selected.'));
        }
      } else if (category === 'DUPLICATE_ATTEMPT') {
        if (resolutionAction === 'KEEP_SELECTED_DUPLICATE') {
          const selectedAttempt = currentAttempts?.find(a => a.id === selectedDuplicateId);
          if (!selectedAttempt) return Err(AppError.notFound('Selected attempt not found.'));

          targetNewValue = selectedAttempt.mark;
          targetOldValue = dbMark;

          const otherIds = currentAttempts
            ?.map(a => a.id)
            .filter(id => id !== selectedDuplicateId) || [];

          if (otherIds.length > 0) {
            const { error: deleteErr } = await supabase
              .from('flwdsk_exam_attempts')
              .update({ deleted_at: new Date().toISOString() })
              .in('id', otherIds);

            if (deleteErr) throw deleteErr;
          }
        } else {
          return Err(AppError.validation('Invalid resolution action selected.'));
        }
      }

      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: 'FINAL_EXAM_RECONCILIATION_RESOLVED',
        entity_type: 'exam_attempts',
        entity_id: studentId,
        new_value: {
          batchId: batchId,
          attemptType,
          category,
          action: resolutionAction,
          selectedValue: targetNewValue,
          selectedDuplicateId: selectedDuplicateId || null
        },
        old_value: {
          previousValue: targetOldValue
        },
        reason: resolutionReason
      });

      return Ok(true);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async syncVoucher(
    studentId: UUID,
    batchId: UUID,
    voucherType: 'Initial' | 'Retest',
    voucherCode: string,
    paymentVerified: 'Pending' | 'Verified',
    actor: Actor
  ): Promise<Result<any>> {
    try {
      if (!actor || !actor.id) {
        return Err(new AppError({ code: ErrorCode.UNAUTHENTICATED, message: 'Actor not authenticated.', severity: 'warning' }));
      }

      const isAllowed = actor.role === 'ADMIN' || actor.role === 'TRAINER';
      if (!isAllowed) {
        return Err(AppError.forbidden('You do not have permission to sync vouchers.'));
      }

      const student = await this.studentRepo.findById(studentId);
      if (!student) return Err(AppError.notFound('Student record not found.'));

      const { data: existing, error: findErr } = await supabase
        .from('flwdsk_vouchers')
        .select('*')
        .eq('student_id', studentId)
        .eq('voucher_type', voucherType)
        .eq('batch_id', batchId)
        .maybeSingle();

      if (findErr) throw findErr;

      const payload = {
        student_id: studentId,
        batch_id: batchId,
        voucher_code: voucherCode,
        voucher_type: voucherType,
        payment_verified: paymentVerified,
        status: 'Assigned',
        assigned_date: new Date().toISOString(),
        assigned_by: actor.id,
        updated_at: new Date().toISOString(),
        updated_by: actor.id
      };

      let resultRecord;
      if (existing) {
        const { data: updated, error: uErr } = await supabase
          .from('flwdsk_vouchers')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();
        if (uErr) throw uErr;
        resultRecord = updated;
      } else {
        const { data: inserted, error: iErr } = await supabase
          .from('flwdsk_vouchers')
          .insert(payload)
          .select()
          .single();
        if (iErr) throw iErr;
        resultRecord = inserted;
      }

      const currentFields = student.customFields || {};
      const updatedFields = { ...currentFields };
      if (voucherType === 'Initial') {
        updatedFields.voucherId = voucherCode;
      } else {
        updatedFields[`retestPaymentStatus_${batchId}`] = paymentVerified === 'Verified' ? 'Paid' : 'Pending';
      }

      const res = await this.updateStudentProfile(studentId, {
        customFields: updatedFields
      }, actor);
      if (!res.ok) throw new Error(res.error.message);

      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: existing ? 'VOUCHER_UPDATED' : 'VOUCHER_CREATED',
        entity_type: 'vouchers',
        entity_id: resultRecord.id,
        new_value: resultRecord,
        reason: 'Roster save synchronization'
      });

      return Ok({
        id: resultRecord.id,
        studentId: resultRecord.student_id,
        batchId: resultRecord.batch_id,
        voucherCode: resultRecord.voucher_code,
        voucherType: resultRecord.voucher_type,
        status: resultRecord.status,
        sentStatus: resultRecord.sent_status,
        sentTime: resultRecord.sent_time
      });
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async syncExamAttempt(
    studentId: UUID,
    batchId: UUID,
    attemptType: 'Initial' | 'Retest',
    mark: number,
    actor: Actor
  ): Promise<Result<any>> {
    try {
      if (!actor || !actor.id) {
        return Err(new AppError({ code: ErrorCode.UNAUTHENTICATED, message: 'Actor not authenticated.', severity: 'warning' }));
      }

      const isAllowed = actor.role === 'ADMIN' || actor.role === 'TRAINER';
      if (!isAllowed) {
        return Err(AppError.forbidden('You do not have permission to sync exam attempts.'));
      }

      const student = await this.studentRepo.findById(studentId);
      if (!student) return Err(AppError.notFound('Student record not found.'));

      const { data: batch } = await supabase.from('flwdsk_batches').select('course_id').eq('id', batchId).single();
      if (!batch) return Err(AppError.notFound('Batch not found.'));
      const { data: course } = await supabase.from('flwdsk_courses').select('pass_percentage, passPercentage').eq('id', batch.course_id).single();
      if (!course) return Err(AppError.notFound('Course not found.'));
      const coursePassPct = course.passPercentage ?? course.pass_percentage ?? 70;

      const { data: existing, error: findErr } = await supabase
        .from('flwdsk_exam_attempts')
        .select('*')
        .eq('student_id', studentId)
        .eq('batch_id', batchId)
        .eq('attempt_type', attemptType)
        .is('deleted_at', null)
        .maybeSingle();

      if (findErr) throw findErr;

      const payload = {
        student_id: studentId,
        batch_id: batchId,
        attempt_type: attemptType,
        attempt_number: attemptType === 'Initial' ? 1 : 2,
        mark,
        result: mark >= coursePassPct ? 'Passed' : 'Failed',
        submitted_by: 'Trainer Manual Entry',
        updated_by: actor.id,
        remarks: 'Manually logged/updated by trainer in Batch Management.',
        updated_at: new Date().toISOString()
      };

      let resultRecord;
      if (existing) {
        const { data: updated, error: uErr } = await supabase
          .from('flwdsk_exam_attempts')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();
        if (uErr) throw uErr;
        resultRecord = updated;
      } else {
        const { data: inserted, error: iErr } = await supabase
          .from('flwdsk_exam_attempts')
          .insert({
            ...payload,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        if (iErr) throw iErr;
        resultRecord = inserted;
      }

      const currentFields = student.customFields || {};
      const updatedFields = { ...currentFields };
      if (attemptType === 'Initial') {
        updatedFields.finalExam = mark;
        updatedFields.final_exam = mark;
      } else {
        updatedFields.retestScore = mark;
        updatedFields.retest_score = mark;
      }

      const res = await this.updateStudentProfile(studentId, {
        customFields: updatedFields
      }, actor);
      if (!res.ok) throw new Error(res.error.message);

      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: existing ? 'EXAM_ATTEMPT_UPDATED' : 'EXAM_ATTEMPT_CREATED',
        entity_type: 'exam_attempts',
        entity_id: resultRecord.id,
        new_value: resultRecord,
        reason: 'Roster save synchronization'
      });

      return Ok({
        id: resultRecord.id,
        studentId: resultRecord.student_id,
        batchId: resultRecord.batch_id,
        attemptType: resultRecord.attempt_type,
        attemptNumber: resultRecord.attempt_number,
        mark: resultRecord.mark,
        result: resultRecord.result,
        submittedBy: resultRecord.submitted_by,
        remarks: resultRecord.remarks,
        createdAt: resultRecord.created_at,
        updatedAt: resultRecord.updated_at
      });
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async saveCalendarSession(session: any, actor: Actor): Promise<Result<any>> {
    try {
      if (!actor || !actor.id) {
        return Err(new AppError({ code: ErrorCode.UNAUTHENTICATED, message: 'Actor not authenticated.', severity: 'warning' }));
      }
      if (actor.role !== 'ADMIN' && actor.role !== 'TRAINER') {
        return Err(new AppError({ code: ErrorCode.FORBIDDEN, message: 'Only trainers or admins can modify calendars.', severity: 'warning' }));
      }

      if (!session.batch_id || !session.trainer_id) {
        return Err(AppError.validation('Batch ID and Trainer ID are required.'));
      }

      const { data: existing } = await supabase
        .from('flwdsk_calendar_sessions')
        .select('*')
        .eq('id', session.id)
        .maybeSingle();

      const { data: resultRecord, error: saveError } = await supabase
        .from('flwdsk_calendar_sessions')
        .upsert(session)
        .select('*')
        .single();

      if (saveError) {
        return Err(AppError.internal(saveError.message));
      }

      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: existing ? 'CALENDAR_SESSION_UPDATED' : 'CALENDAR_SESSION_CREATED',
        entity_type: 'calendar_sessions',
        entity_id: resultRecord.id,
        new_value: resultRecord,
        reason: 'Trainer calendar assignment'
      });

      return Ok(resultRecord);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async deleteCalendarSession(sessionId: UUID, actor: Actor): Promise<Result<any>> {
    try {
      if (!actor || !actor.id) {
        return Err(new AppError({ code: ErrorCode.UNAUTHENTICATED, message: 'Actor not authenticated.', severity: 'warning' }));
      }
      if (actor.role !== 'ADMIN' && actor.role !== 'TRAINER') {
        return Err(new AppError({ code: ErrorCode.FORBIDDEN, message: 'Only trainers or admins can delete calendar events.', severity: 'warning' }));
      }

      const { data: existing } = await supabase
        .from('flwdsk_calendar_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (!existing) {
        return Err(AppError.notFound('Calendar session not found.'));
      }

      const { error: deleteError } = await supabase
        .from('flwdsk_calendar_sessions')
        .delete()
        .eq('id', sessionId);

      if (deleteError) {
        return Err(AppError.internal(deleteError.message));
      }

      await supabase.from('flwdsk_audit_logs').insert({
        actor_id: actor.id,
        action: 'CALENDAR_SESSION_DELETED',
        entity_type: 'calendar_sessions',
        entity_id: sessionId,
        old_value: existing,
        reason: 'Trainer calendar cancellation'
      });

      return Ok({ id: sessionId });
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }
}

