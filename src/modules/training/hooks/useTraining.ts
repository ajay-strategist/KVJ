import { useEffect, useState, useCallback, useMemo } from 'react';
import { container } from '../../../core/registry';
import { TRAINING_SERVICE_TOKEN, type RetestPaymentVerification } from '../training.service';
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

let cachedStudents: Student[] | null = null;
let cachedCourses: Course[] | null = null;
let cachedBatches: Batch[] | null = null;
let cachedEnrollments: Enrollment[] | null = null;

let activeStudentsPromise: Promise<Student[]> | null = null;
let activeCoursesPromise: Promise<Course[]> | null = null;
let activeBatchesPromise: Promise<Batch[]> | null = null;
let activeEnrollmentsPromise: Promise<Enrollment[]> | null = null;

export function useTraining(options?: {
  fetchStudents?: boolean;
  fetchCourses?: boolean;
  fetchBatches?: boolean;
  fetchEnrollments?: boolean;
}) {
  const service = useMemo(() => container.resolve(TRAINING_SERVICE_TOKEN), []);
  const { user } = useAuth();

  const fetchStudents = options?.fetchStudents !== false;
  const fetchCourses = options?.fetchCourses !== false;
  const fetchBatches = options?.fetchBatches !== false;
  const fetchEnrollments = options?.fetchEnrollments !== false;

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const studentRepo = container.resolve(STUDENT_REPOSITORY_TOKEN);
      const courseRepo = container.resolve(COURSE_REPOSITORY_TOKEN);
      const batchRepo = container.resolve(BATCH_REPOSITORY_TOKEN);
      const enrollmentRepo = container.resolve(ENROLLMENT_REPOSITORY_TOKEN);

      const fetchAllPages = async (repo: any, sort?: any[]) => {
        let allData: any[] = [];
        let page = 1;
        const pageSize = 1000;
        while (true) {
          const res = await repo.findMany({ pageSize, page, sort });
          if (res && Array.isArray(res.data)) {
            allData = allData.concat(res.data);
            if (res.data.length < pageSize) {
              break;
            }
            page++;
          } else {
            break;
          }
        }
        return allData;
      };

      const getOrFetch = async (
        type: 'students' | 'courses' | 'batches' | 'enrollments',
        repo: any,
        sort?: any[]
      ) => {
        if (forceRefresh) {
          if (type === 'students') {
            activeStudentsPromise = fetchAllPages(repo, sort).then(r => { cachedStudents = r; activeStudentsPromise = null; return r; });
            return activeStudentsPromise;
          }
          if (type === 'courses') {
            activeCoursesPromise = fetchAllPages(repo, sort).then(r => { cachedCourses = r; activeCoursesPromise = null; return r; });
            return activeCoursesPromise;
          }
          if (type === 'batches') {
            activeBatchesPromise = fetchAllPages(repo, sort).then(r => { cachedBatches = r; activeBatchesPromise = null; return r; });
            return activeBatchesPromise;
          }
          if (type === 'enrollments') {
            activeEnrollmentsPromise = fetchAllPages(repo, sort).then(r => { cachedEnrollments = r; activeEnrollmentsPromise = null; return r; });
            return activeEnrollmentsPromise;
          }
        }

        if (type === 'students' && cachedStudents) return cachedStudents;
        if (type === 'courses' && cachedCourses) return cachedCourses;
        if (type === 'batches' && cachedBatches) return cachedBatches;
        if (type === 'enrollments' && cachedEnrollments) return cachedEnrollments;

        if (type === 'students') {
          if (!activeStudentsPromise) {
            activeStudentsPromise = fetchAllPages(repo, sort).then(r => { cachedStudents = r; activeStudentsPromise = null; return r; });
          }
          return activeStudentsPromise;
        }
        if (type === 'courses') {
          if (!activeCoursesPromise) {
            activeCoursesPromise = fetchAllPages(repo, sort).then(r => { cachedCourses = r; activeCoursesPromise = null; return r; });
          }
          return activeCoursesPromise;
        }
        if (type === 'batches') {
          if (!activeBatchesPromise) {
            activeBatchesPromise = fetchAllPages(repo, sort).then(r => { cachedBatches = r; activeBatchesPromise = null; return r; });
          }
          return activeBatchesPromise;
        }
        if (type === 'enrollments') {
          if (!activeEnrollmentsPromise) {
            activeEnrollmentsPromise = fetchAllPages(repo, sort).then(r => { cachedEnrollments = r; activeEnrollmentsPromise = null; return r; });
          }
          return activeEnrollmentsPromise;
        }
        return [];
      };

      const promises: Promise<any>[] = [];
      if (fetchStudents) promises.push(getOrFetch('students', studentRepo));
      else promises.push(Promise.resolve([]));

      if (fetchCourses) promises.push(getOrFetch('courses', courseRepo));
      else promises.push(Promise.resolve([]));

      if (fetchBatches) promises.push(getOrFetch('batches', batchRepo, [{ field: 'createdAt', dir: 'desc' }]));
      else promises.push(Promise.resolve([]));

      if (fetchEnrollments) promises.push(getOrFetch('enrollments', enrollmentRepo));
      else promises.push(Promise.resolve([]));

      const [sData, cData, bData, eData] = await Promise.all(promises);

      setStudents(sData);
      setCourses(cData);
      setBatches(bData);
      setEnrollments(eData);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [fetchStudents, fetchCourses, fetchBatches, fetchEnrollments]);


  const registerStudent = useCallback(async (data: Partial<Student>): Promise<CallbackResult<Student>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.registerStudent(data, { id: user.id, role: user.role });
    if (res.ok) {
      cachedStudents = [res.value, ...(cachedStudents || [])];
      setStudents((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const updateStudentProfile = useCallback(async (studentId: UUID, data: Partial<Student>): Promise<CallbackResult<Student>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateStudentProfile(studentId, data, { id: user.id, role: user.role });
    if (res.ok) {
      if (cachedStudents) {
        cachedStudents = cachedStudents.map((s) => (s.id === studentId ? res.value : s));
      }
      setStudents((prev) => prev.map((s) => (s.id === studentId ? res.value : s)));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const createCourse = useCallback(async (data: Partial<Course>): Promise<CallbackResult<Course>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createCourse(data, { id: user.id, role: user.role });
    if (res.ok) {
      const merged = { ...res.value, ...data };
      if (data.checklist) merged.checklist = data.checklist;
      cachedCourses = [merged, ...(cachedCourses || [])];
      setCourses((prev) => [merged, ...prev]);
      return { ok: true, value: merged };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const updateCourse = useCallback(async (id: UUID, data: Partial<Course>): Promise<CallbackResult<Course>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateCourse(id, data, { id: user.id, role: user.role });
    if (res.ok) {
      const merged = { ...res.value, ...data };
      if (data.checklist) merged.checklist = data.checklist;
      if (cachedCourses) {
        cachedCourses = cachedCourses.map((c) => (c.id === id ? merged : c));
      }
      setCourses((prev) => prev.map((c) => (c.id === id ? merged : c)));
      return { ok: true, value: merged };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const createBatch = useCallback(async (data: Partial<Batch>): Promise<CallbackResult<Batch>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createBatch(data, { id: user.id, role: user.role });
    if (res.ok) {
      const merged = { ...res.value, ...data };
      if (data.program) merged.program = data.program;
      if (data.startDate) merged.startDate = data.startDate;
      if (data.endDate) merged.endDate = data.endDate;

      cachedBatches = [merged, ...(cachedBatches || [])];
      setBatches((prev) => [merged, ...prev]);
      return { ok: true, value: merged };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const updateBatch = useCallback(async (id: UUID, data: Partial<Batch>): Promise<CallbackResult<Batch>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateBatch(id, data, { id: user.id, role: user.role });
    if (res.ok) {
      const merged = { ...res.value, ...data };
      if (data.program) merged.program = data.program;
      if (data.startDate) merged.startDate = data.startDate;
      if (data.endDate) merged.endDate = data.endDate;

      if (cachedBatches) {
        cachedBatches = cachedBatches.map((b) => (b.id === id ? merged : b));
      }
      setBatches((prev) => prev.map((b) => (b.id === id ? merged : b)));
      return { ok: true, value: merged };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const enrollStudent = useCallback(async (studentId: UUID, batchId: UUID): Promise<CallbackResult<Enrollment>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.enrollStudent(studentId, batchId, { id: user.id, role: user.role });
    if (res.ok) {
      cachedEnrollments = [res.value, ...(cachedEnrollments || [])];
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

  const getCertificateDelivery = useCallback(async (enrollmentId: UUID): Promise<CallbackResult<CertificateRecord | null>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.getCertificateDelivery(enrollmentId);
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const saveCertificateDelivery = useCallback(async (
    enrollmentId: UUID,
    studentId: UUID,
    deliveryDate: string,
    collectedBy: string,
    certificateCount: number,
    certificateReceiptPath: string
  ): Promise<CallbackResult<CertificateRecord>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.saveCertificateDelivery(
      enrollmentId,
      studentId,
      deliveryDate,
      collectedBy,
      certificateCount,
      certificateReceiptPath,
      { id: user.id, role: user.role }
    );
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const uploadCertificateReceipt = useCallback(async (file: File, path: string): Promise<CallbackResult<string>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.uploadCertificateReceipt(file, path);
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const getCertificateReceiptUrl = useCallback(async (path: string): Promise<CallbackResult<string>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.getCertificateReceiptUrl(path);
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const deleteCertificateReceipt = useCallback(async (path: string): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.deleteCertificateReceipt(path);
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const removeEnrollment = useCallback(async (studentId: UUID, batchId: UUID, actionType?: 'ENROLLMENT_REMOVED' | 'ENROLLMENT_BULK_REMOVED' | 'ENROLLMENT_DEDUPLICATED'): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.removeEnrollment(studentId, batchId, actionType || 'ENROLLMENT_REMOVED', { id: user.id, role: user.role });
    if (res.ok) {
      if (cachedEnrollments) {
        cachedEnrollments = cachedEnrollments.filter(e => !(e.studentId === studentId && e.batchId === batchId));
      }
      setEnrollments((prev) => prev.filter(e => !(e.studentId === studentId && e.batchId === batchId)));
      return { ok: true, value: undefined };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const removeBatch = useCallback(async (batchId: UUID): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.removeBatch(batchId, { id: user.id, role: user.role });
    if (res.ok) {
      if (cachedBatches) {
        cachedBatches = cachedBatches.filter(b => b.id !== batchId);
      }
      setBatches((prev) => prev.filter(b => b.id !== batchId));
      return { ok: true, value: undefined };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const issueVoucher = useCallback(async (studentId: UUID, batchId: UUID, voucherCode: string, voucherType: 'Initial' | 'Retest'): Promise<CallbackResult<any>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.issueVoucher(studentId, batchId, voucherCode, voucherType, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const deleteVoucher = useCallback(async (studentId: UUID, batchId: UUID, voucherType: 'Initial' | 'Retest'): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.deleteVoucher(studentId, batchId, voucherType, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: undefined } : { ok: false, error: res.error.message };
  }, [service, user]);

  const recordExamAttempt = useCallback(async (studentId: UUID, batchId: UUID, attemptType: 'Initial' | 'Retest', score: number, voucherCode: string | null, screenshotUrl: string | null, submittedBy: string, allowVoucherReuse?: boolean): Promise<CallbackResult<any>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.recordExamAttempt(studentId, batchId, attemptType, score, voucherCode, screenshotUrl, submittedBy, { id: user.id, role: user.role }, allowVoucherReuse);
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const logSessionAttendanceCell = useCallback(async (batchId: UUID, studentId: UUID, dateStr: string, sessionTitle: string, status: string): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.logSessionAttendanceCell(batchId, studentId, dateStr, sessionTitle, status, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: undefined } : { ok: false, error: res.error.message };
  }, [service, user]);

  const updateSessionDate = useCallback(async (batchId: UUID, oldDate: string, newDate: string, sessionTitle: string): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateSessionDate(batchId, oldDate, newDate, sessionTitle, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: undefined } : { ok: false, error: res.error.message };
  }, [service, user]);

  const updateSessionHour = useCallback(async (batchId: UUID, dateStr: string, oldSessionTitle: string, newSessionTitle: string): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateSessionHour(batchId, dateStr, oldSessionTitle, newSessionTitle, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: undefined } : { ok: false, error: res.error.message };
  }, [service, user]);

  const deleteSessionColumn = useCallback(async (batchId: UUID, dateStr: string, sessionTitle: string): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.deleteSessionColumn(batchId, dateStr, sessionTitle, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: undefined } : { ok: false, error: res.error.message };
  }, [service, user]);

  const updateVoucherSentStatus = useCallback(async (voucherId: UUID, sentStatus: 'Pending' | 'Sent'): Promise<CallbackResult<any>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateVoucherSentStatus(voucherId, sentStatus, { id: user.id, role: user.role });
    if (res.ok) return { ok: true, value: res.value };
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const verifyRetestPayment = useCallback(async (studentId: UUID, batchId: UUID, status: 'Pending' | 'Verified'): Promise<CallbackResult<RetestPaymentVerification>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.verifyRetestPayment(studentId, batchId, status, { id: user.id, role: user.role });
    if (res.ok) return { ok: true, value: res.value };
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const saveBatchEligibilityRules = useCallback(async (batchId: UUID, considerAttendance: boolean, attendancePassPercentage: number, assessmentPassPercentage: number, eligibilityCriteria: any[]): Promise<CallbackResult<any>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.saveBatchEligibilityRules(batchId, considerAttendance, attendancePassPercentage, assessmentPassPercentage, eligibilityCriteria, { id: user.id, role: user.role });
    if (res.ok) return { ok: true, value: res.value };
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const resolveExamAttemptDiscrepancy = useCallback(async (
    studentId: UUID,
    batchId: UUID,
    attemptType: 'Initial' | 'Retest',
    category: string,
    resolutionAction: string,
    resolutionReason: string,
    selectedDuplicateId: UUID | null,
    dbMark: number | null,
    cacheMark: number | null,
    coursePassPct: number
  ): Promise<CallbackResult<any>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.resolveExamAttemptDiscrepancy(
      studentId,
      batchId,
      attemptType,
      category,
      resolutionAction,
      resolutionReason,
      selectedDuplicateId,
      dbMark,
      cacheMark,
      coursePassPct,
      { id: user.id, role: user.role }
    );
    if (res.ok) return { ok: true, value: res.value };
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const syncVoucher = useCallback(async (
    studentId: UUID,
    batchId: UUID,
    voucherType: 'Initial' | 'Retest',
    voucherCode: string,
    paymentVerified: 'Pending' | 'Verified'
  ): Promise<CallbackResult<any>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.syncVoucher(studentId, batchId, voucherType, voucherCode, paymentVerified, { id: user.id, role: user.role });
    if (res.ok) return { ok: true, value: res.value };
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const syncExamAttempt = useCallback(async (
    studentId: UUID,
    batchId: UUID,
    attemptType: 'Initial' | 'Retest',
    mark: number
  ): Promise<CallbackResult<any>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.syncExamAttempt(studentId, batchId, attemptType, mark, { id: user.id, role: user.role });
    if (res.ok) return { ok: true, value: res.value };
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const saveCalendarSession = useCallback(async (session: any): Promise<CallbackResult<any>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.saveCalendarSession(session, { id: user.id, role: user.role });
    if (res.ok) return { ok: true, value: res.value };
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const deleteCalendarSession = useCallback(async (sessionId: UUID): Promise<CallbackResult<any>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.deleteCalendarSession(sessionId, { id: user.id, role: user.role });
    if (res.ok) return { ok: true, value: res.value };
    return { ok: false, error: res.error.message };
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
    updateStudentProfile,
    createCourse,
    updateCourse,
    createBatch,
    updateBatch,
    enrollStudent,
    evaluateAssessment,
    claimVoucher,
    issueCertificate,
    trackReferral,
    graduateStudent,
    getCertificateDelivery,
    saveCertificateDelivery,
    uploadCertificateReceipt,
    getCertificateReceiptUrl,
    deleteCertificateReceipt,
    removeEnrollment,
    removeBatch,
    issueVoucher,
    deleteVoucher,
    recordExamAttempt,
    logSessionAttendanceCell,
    updateSessionDate,
    updateSessionHour,
    deleteSessionColumn,
    updateVoucherSentStatus,
    verifyRetestPayment,
    saveBatchEligibilityRules,
    resolveExamAttemptDiscrepancy,
    syncVoucher,
    syncExamAttempt,
    saveCalendarSession,
    deleteCalendarSession,
    refresh: fetchAll,
  };
}

