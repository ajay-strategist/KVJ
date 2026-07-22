import { useEffect, useState, useCallback, useMemo } from 'react';
import { container } from '../../../core/registry';
import { TRAINING_SERVICE_TOKEN } from '../training.service';
import {
  STUDENT_REPOSITORY_TOKEN,
  COURSE_REPOSITORY_TOKEN,
  BATCH_REPOSITORY_TOKEN,
  ENROLLMENT_REPOSITORY_TOKEN,
  type Student, type Course, type Batch, type Enrollment,
  type AssessmentRecord,
  type ExamVoucher,
  type CertificateRecord,
  type ReferralRecord,
  type AlumniProfile
} from '../training.repository';
import type { UUID } from '../../../core/types';
import { useAuth } from '../../auth/AuthProvider';

type CallbackResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function useTraining() {
  const service = useMemo(() => container.resolve(TRAINING_SERVICE_TOKEN), []);
  const { user } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const studentRepo = container.resolve(STUDENT_REPOSITORY_TOKEN);
      const courseRepo = container.resolve(COURSE_REPOSITORY_TOKEN);
      const batchRepo = container.resolve(BATCH_REPOSITORY_TOKEN);
      const enrollmentRepo = container.resolve(ENROLLMENT_REPOSITORY_TOKEN);

      const [sPage, cPage, bPage, ePage] = await Promise.all([
        studentRepo.findMany(),
        courseRepo.findMany(),
        batchRepo.findMany(),
        enrollmentRepo.findMany(),
      ]);

      setStudents(sPage.data);
      setCourses(cPage.data);
      setBatches(bPage.data);
      setEnrollments(ePage.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  const registerStudent = useCallback(async (data: Partial<Student>): Promise<CallbackResult<Student>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.registerStudent(data, { id: user.id, role: user.role });
    if (res.ok) {
      setStudents((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const createCourse = useCallback(async (data: Partial<Course>): Promise<CallbackResult<Course>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createCourse(data, { id: user.id, role: user.role });
    if (res.ok) {
      setCourses((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const updateCourse = useCallback(async (id: UUID, data: Partial<Course>): Promise<CallbackResult<Course>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateCourse(id, data, { id: user.id, role: user.role });
    if (res.ok) {
      setCourses((prev) => prev.map((c) => (c.id === id ? res.value : c)));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const createBatch = useCallback(async (data: Partial<Batch>): Promise<CallbackResult<Batch>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createBatch(data, { id: user.id, role: user.role });
    if (res.ok) {
      setBatches((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const enrollStudent = useCallback(async (studentId: UUID, batchId: UUID): Promise<CallbackResult<Enrollment>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.enrollStudent(studentId, batchId, { id: user.id, role: user.role });
    if (res.ok) {
      setEnrollments((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const evaluateAssessment = useCallback(async (enrollmentId: UUID, data: Partial<AssessmentRecord>): Promise<CallbackResult<AssessmentRecord>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.evaluateAssessment(enrollmentId, data, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const claimVoucher = useCallback(async (enrollmentId: UUID): Promise<CallbackResult<ExamVoucher>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.claimVoucher(enrollmentId, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const issueCertificate = useCallback(async (enrollmentId: UUID): Promise<CallbackResult<CertificateRecord>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.issueCertificate(enrollmentId, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const trackReferral = useCallback(async (referrerId: UUID, code: string, email: string): Promise<CallbackResult<ReferralRecord>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.trackReferral(referrerId, code, email, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const graduateStudent = useCallback(async (studentId: UUID, dateStr: string, employer?: string, designation?: string, pkg?: number, testimonial?: string): Promise<CallbackResult<AlumniProfile>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.graduateStudent(studentId, dateStr, employer, designation, pkg, testimonial, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    students,
    courses,
    batches,
    enrollments,
    loading,
    error,
    registerStudent,
    createCourse,
    updateCourse,
    createBatch,
    enrollStudent,
    evaluateAssessment,
    claimVoucher,
    issueCertificate,
    trackReferral,
    graduateStudent,
    refresh: fetchAll,
  };
}
