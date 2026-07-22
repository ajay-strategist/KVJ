import { container, createToken } from '../../core/registry';
import { toLocalISODate } from '../../shared/utils/date';
import { AppError, Err, Ok, type Result } from '../../core/result';
import type { Actor, UUID } from '../../core/types';
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

export interface ITrainingService {
  registerStudent(data: Partial<Student>, actor: Actor): Promise<Result<Student>>;
  createCourse(data: Partial<Course>, actor: Actor): Promise<Result<Course>>;
  updateCourse(id: UUID, data: Partial<Course>, actor: Actor): Promise<Result<Course>>;
  createBatch(data: Partial<Batch>, actor: Actor): Promise<Result<Batch>>;
  enrollStudent(studentId: UUID, batchId: UUID, actor: Actor): Promise<Result<Enrollment>>;
  logSessionAttendance(batchId: UUID, dateStr: string, records: Partial<SessionAttendanceRecord>[], actor: Actor): Promise<Result<SessionAttendanceRecord[]>>;
  evaluateAssessment(enrollmentId: UUID, data: Partial<AssessmentRecord>, actor: Actor): Promise<Result<AssessmentRecord>>;
  claimVoucher(enrollmentId: UUID, actor: Actor): Promise<Result<ExamVoucher>>;
  issueCertificate(enrollmentId: UUID, actor: Actor): Promise<Result<CertificateRecord>>;
  trackReferral(referrerId: UUID, code: string, email: string, actor: Actor): Promise<Result<ReferralRecord>>;
  graduateStudent(studentId: UUID, gradDate: string, employer?: string, designation?: string, pkg?: number, testimonial?: string, actor?: Actor): Promise<Result<AlumniProfile>>;
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
      await this.activity.log('attendance', batchId, actor, 'create', `Logged session attendance for ${dateStr}`);
      return Ok(logged);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async evaluateAssessment(enrollmentId: UUID, data: Partial<AssessmentRecord>, actor: Actor): Promise<Result<AssessmentRecord>> {
    try {
      const assessment = await this.assessmentRepo.create({ ...data, enrollmentId, evaluatedBy: actor.id, evaluatedAt: new Date().toISOString() }, actor);
      await this.activity.log('student', enrollmentId, actor, 'update', `Evaluated assessment: ${assessment.title} - Marks: ${assessment.marksObtained}/${assessment.maxMarks}`);
      await this.audit.log(actor, 'update', 'assessments', assessment.id, { newValues: assessment });
      return Ok(assessment);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async claimVoucher(enrollmentId: UUID, actor: Actor): Promise<Result<ExamVoucher>> {
    try {
      const assessments = await this.assessmentRepo.findByEnrollment(enrollmentId);
      const passedAll = assessments.length > 0 && assessments.every((a) => (a.marksObtained ?? 0) >= (a.maxMarks * 0.5));
      
      if (!passedAll) {
        return Err(AppError.businessRule('Student must complete and pass all modules tests to claim voucher.'));
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
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'Graduate';

      const certNumber = `CERT-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      const cert = await this.certificateRepo.create({
        enrollmentId,
        certificateNumber: certNumber,
        verificationQrUrl: `https://kvj-analytics.co/verify/${certNumber}`,
        digitalSignature: `SIG-${this.uuid().substring(0, 8).toUpperCase()}`,
        issuedAt: new Date().toISOString()
      }, actor);

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
}
