import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { Button, Card, SectionHeader, Badge, ProgressBar } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import Modal from '../../../shared/ui/Modal';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { isEligibleTrainer, sortEmployeesByCode } from '../../employee/employee.repository';
import { useTraining } from '../hooks/useTraining';
import { STUDENT_REPOSITORY_TOKEN, COLLEGE_REPOSITORY_TOKEN, type Batch, type TrainingPhase, TRAINING_PHASES, APPROVED_BATCH_STATUSES } from '../training.repository';
import { normalizeStudentKey } from '../supabase-training.repository';
import { supabase } from '../../../shared/integration/supabase';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { usePermissions } from '../../../shared/permissions/react';
import { useAuth } from '../../auth/AuthProvider';
import { todayISO } from '../../../shared/utils/date';
import { DailyReportBuilderModal } from '../report/DailyReportBuilderModal';
import { DailyReportPreview } from '../report/DailyReportPreview';
import type { DailyReportConfig, DailyReportData, TrainingDeliveryLogItem } from '../report/daily-report.types';
import { cleanBatchCode, formatBatchWithCourse } from '../utils/batch-formatter';
import { useDialog } from '../../../shared/feedback/DialogProvider';

import { BatchHeaderCard } from '../components/BatchHeaderCard';
import { toCardVM } from '../components/TrainingBatchCarousel';
import { StudentsTab } from '../tabs/StudentsTab';
import { AttendanceMatrixTab } from '../tabs/AttendanceMatrixTab';
import { ExamScoresTab } from '../tabs/ExamScoresTab';
import { RegistrationTab } from '../tabs/RegistrationTab';
import { CertificateDeliveryTab } from '../tabs/CertificateDeliveryTab';
import { ExamReconciliationDrawers } from '../components/ExamReconciliationDrawers';
import { BatchExpenseDetailsDrawer } from '../components/BatchExpenseDetailsDrawer';
import type { StudentRecord, RegistrationRecord, StudentSubTab, SortableCol } from '../types/batch-management.types';

export function BatchManagement() {
  const { confirm } = useDialog();
  const { can } = usePermissions();
  const { user } = useAuth();
  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const canCreateBatch = true;
  const canViewDailyReport = true;
  const {
    batches,
    courses,
    createBatch,
    updateBatch,
    enrollments,
    refresh: refreshBatches,
    registerStudent,
    removeBatch,
    getCertificateDelivery,
    saveCertificateDelivery,
    uploadCertificateReceipt,
    getCertificateReceiptUrl,
    logSessionAttendanceCell,
    updateSessionDate,
    updateSessionHour,
    deleteSessionColumn,
    issueVoucher,
    recordExamAttempt,
    updateStudentProfile,
    updateVoucherSentStatus,
    verifyRetestPayment,
    saveBatchEligibilityRules,
    resolveExamAttemptDiscrepancy,
    getBatchTrainingDeliveryLogs,
  } = useTraining({ fetchStudents: false });

  const { toast } = useNotifications();
  const [trainers, setTrainers] = useState<Employee[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<StudentSubTab | null>(null);
  const [dbColleges, setDbColleges] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshBatches(true);
      toast({ variant: 'success', title: 'Batches Synchronized', message: 'Loaded the latest batches from database.' });
    } catch (e: any) {
      toast({ variant: 'error', title: 'Refresh Failed', message: e?.message || 'Failed to refresh batches.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load Colleges
  useEffect(() => {
    try {
      const repo = container.resolve(COLLEGE_REPOSITORY_TOKEN);
      repo.findMany({ pageSize: 1000, page: 1 }).then((p) => {
        if (p.data && p.data.length > 0) {
          setDbColleges(p.data);
        }
      });
    } catch (e) {
      void e;
    }
  }, []);

  const availableColleges = useMemo(() => {
    const set = new Set<string>();
    (dbColleges || []).forEach((c: any) => {
      if (c?.deletedAt || c?.deleted_at) return;
      const name = c?.name || c?.title;
      if (name && typeof name === 'string' && name.trim()) set.add(name.trim());
    });
    return Array.from(set).sort();
  }, [dbColleges]);

  // Load Trainers
  useEffect(() => {
    try {
      const empService = container.resolve<any>(EMPLOYEE_SERVICE_TOKEN);
      const fetchPromise = typeof empService?.listEmployees === 'function'
        ? empService.listEmployees()
        : typeof empService?.getEmployees === 'function'
          ? empService.getEmployees()
          : null;

      if (fetchPromise) {
        fetchPromise.then((res: any) => {
          if (res?.ok && Array.isArray(res?.value)) {
            const activeTrainers = sortEmployeesByCode((res.value as Employee[]).filter(isEligibleTrainer));
            setTrainers(activeTrainers);
          }
        }).catch(() => {});
      }
    } catch (e) {
      void e;
    }
  }, []);

  const safeBatches = useMemo(() => {
    let list = batches || [];
    if (selectedTrainerId !== 'all') {
      list = list.filter((b) => b.trainerId === selectedTrainerId || b.coTrainerIds?.includes(selectedTrainerId));
    }
    return list;
  }, [batches, selectedTrainerId]);

  // Set default selected batch if none selected
  useEffect(() => {
    if (!selectedBatchId && safeBatches.length > 0) {
      setSelectedBatchId(safeBatches[0].id);
    }
  }, [safeBatches, selectedBatchId]);

  const activeBatch = useMemo(
    () => safeBatches.find((b) => b.id === selectedBatchId) || safeBatches[0] || null,
    [safeBatches, selectedBatchId]
  );

  const activeCourse = useMemo(
    () => courses.find((c) => c.id === activeBatch?.courseId),
    [courses, activeBatch]
  );

  const activeTrainer = useMemo(
    () => trainers.find((t) => t.id === activeBatch?.trainerId),
    [trainers, activeBatch]
  );

  const batchStudentIds = useMemo(() => {
    return new Set(
      (enrollments || [])
        .filter((e) => e && e.batchId === (activeBatch?.id || selectedBatchId))
        .map((e) => e.studentId)
    );
  }, [enrollments, activeBatch, selectedBatchId]);

  const isExecutive = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  // Student State
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const studentsRef = useRef<StudentRecord[]>([]);
  studentsRef.current = students;

  // Eligibility Criteria
  const [considerAttendance, setConsiderAttendance] = useState(true);
  const [attendanceThreshold, setAttendanceThreshold] = useState(84);
  const [courseMaxMarks, setCourseMaxMarks] = useState(100);
  const [coursePassPct, setCoursePassPct] = useState(60);
  const [eligibilityCriteria, setEligibilityCriteria] = useState<Array<{ assessment: SortableCol; threshold: number }>>([
    { assessment: 'ass1', threshold: 60 },
  ]);

  const assessmentLabelMap: Record<string, string> = {
    ass1: 'Assessment 1',
    ass2: 'Assessment 2',
    ass3: 'Assessment 3',
  };

  // Multi-date Attendance Matrix State
  const [attendanceSessions, setAttendanceSessions] = useState<Array<{ id: string; date: string; hour: number }>>([
    { id: 'sess-1', date: todayISO(), hour: 1 },
    { id: 'sess-2', date: todayISO(), hour: 2 },
  ]);
  const [attendanceMatrix, setAttendanceMatrix] = useState<Record<string, Record<string, string>>>({});

  // Registration Records
  const [registrationRecords, setRegistrationRecords] = useState<RegistrationRecord[]>([]);
  const [registrationSearchQuery, setRegistrationSearchQuery] = useState('');

  // Selected attempt types for exam module
  const [selectedAttemptTypes, setSelectedAttemptTypes] = useState<Record<string, string>>({});

  // Reconciliation report
  const [reconciliationReport, setReconciliationReport] = useState<Record<string, any>>({});
  const [reconciliationDrawerOpen, setReconciliationDrawerOpen] = useState(false);
  const [expenseDetailsOpen, setExpenseDetailsOpen] = useState(false);
  const [expenseBatchId, setExpenseBatchId] = useState<string | null>(null);

  const expenseBatch = useMemo(
    () => (expenseBatchId ? safeBatches.find((b) => b.id === expenseBatchId) : null) || activeBatch,
    [safeBatches, expenseBatchId, activeBatch]
  );

  const expenseBatchCardVM = useMemo(() => {
    if (!expenseBatch) return null;
    return toCardVM(expenseBatch, courses, trainers);
  }, [expenseBatch, courses, trainers]);

  // Load students for active batch
  useEffect(() => {
    if (!selectedBatchId) return;
    const fetchStudentsForBatch = async () => {
      try {
        const { data: enrollData, error: enrollErr } = await supabase
          .from('flwdsk_enrollments')
          .select('student_id, flwdsk_student_records(*)')
          .eq('batch_id', selectedBatchId)
          .is('deleted_at', null);

        if (enrollErr) throw enrollErr;

        if (enrollData) {
          const loaded: StudentRecord[] = enrollData.map((row: any) => {
            const st = row.flwdsk_student_records;
            const cf = (st?.custom_fields as any) || {};
            return {
              id: st?.id || row.student_id,
              name: `${st?.first_name || ''} ${st?.last_name || ''}`.trim() || 'Student',
              photo: '👤',
              photoUrl: st?.photo_url || st?.avatar_url || cf.photoUrl || '',
              phone: st?.phone || '',
              email: st?.email || '',
              college: cf.college || activeBatch?.college || '',
              department: cf.department || activeBatch?.program || '',
              course: cf.course || activeBatch?.trainingName || '',
              examDate: cf.examDate || '',
              examAttemptCount: cf.examAttemptCount || 1,
              attendancePct: cf.attendancePct !== undefined ? cf.attendancePct : 100,
              attendanceStatus: cf.attendanceStatus || 'Regular',
              ass1: cf.ass1 || 0,
              ass2: cf.ass2 || 0,
              ass3: cf.ass3 || 0,
              project: cf.project || 0,
              finalExam: cf.finalExam || 0,
              overallScore: cf.overallScore || 0,
              voucherId: cf.voucherId || '',
              retestVoucherId: cf.retestVoucherId || '',
              retestPaymentStatus: cf.retestPaymentStatus || 'Pending',
              retestCollectedAmount: cf.retestCollectedAmount || 0,
              retestScore: cf.retestScore || 0,
              voucherStatus: cf.voucherStatus || 'Unassigned',
              certificateStatus: cf.certificateStatus || 'Pending',
            };
          });
          setStudents(loaded);
        }
      } catch (err: any) {
        toast({ variant: 'error', title: 'Error Loading Students', message: err.message });
      }
    };
    fetchStudentsForBatch();
  }, [selectedBatchId, activeBatch]);

  // Save student to DB helper
  const saveStudentToDb = async (updated: StudentRecord) => {
    try {
      await updateStudentProfile(updated.id, {
        phone: updated.phone,
        email: updated.email,
        customFields: {
          college: updated.college,
          department: updated.department,
          course: updated.course,
          examDate: updated.examDate,
          examAttemptCount: updated.examAttemptCount,
          attendancePct: updated.attendancePct,
          attendanceStatus: updated.attendanceStatus,
          ass1: updated.ass1,
          ass2: updated.ass2,
          ass3: updated.ass3,
          project: updated.project,
          finalExam: updated.finalExam,
          overallScore: updated.overallScore,
          voucherId: updated.voucherId,
          retestVoucherId: updated.retestVoucherId,
          retestPaymentStatus: updated.retestPaymentStatus,
          retestCollectedAmount: updated.retestCollectedAmount,
          retestScore: updated.retestScore,
        },
      });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Save Failed', message: err.message });
    }
  };

  const handleUpdateStudent = (updated: StudentRecord) => {
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleAssignVoucher = async (studentId: string, val: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, voucherId: val, voucherStatus: val ? 'Assigned' : 'Unassigned' }
          : s
      )
    );
    try {
      await issueVoucher(studentId, selectedBatchId, val, 'Initial');
      toast({ variant: 'success', title: 'Voucher Assigned', message: `Voucher ID "${val}" saved.` });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Error', message: err.message });
    }
  };

  const handleNotifyVoucher = async (studentName: string, voucherId: string) => {
    const student = students.find((s) => s.name === studentName);
    if (!student) return;
    try {
      await supabase.from('flwdsk_email_logs').insert({
        student_id: student.id,
        batch_id: selectedBatchId || null,
        recipient: student.email || 'student@example.com',
        subject: `Exam Voucher for ${activeBatch?.trainingName || 'Course'}`,
        mail_type: 'Voucher Mail',
        status: 'Sent',
        sent_by: user?.id || null,
      });
      toast({ variant: 'success', title: 'Notification Sent', message: `Voucher email sent to ${student.name}.` });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed', message: err.message });
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    try {
      await supabase
        .from('flwdsk_enrollments')
        .delete()
        .eq('batch_id', selectedBatchId)
        .eq('student_id', studentId);

      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      toast({ variant: 'info', title: 'Student Removed', message: 'Student removed from this batch.' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Remove Failed', message: err.message });
    }
  };

  const handleBatchRemoveStudents = async (studentIds: string[]) => {
    try {
      await supabase
        .from('flwdsk_enrollments')
        .delete()
        .eq('batch_id', selectedBatchId)
        .in('student_id', studentIds);

      setStudents((prev) => prev.filter((s) => !studentIds.includes(s.id)));
      toast({ variant: 'success', title: 'Students Removed', message: `Removed ${studentIds.length} students.` });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed', message: err.message });
    }
  };

  const handleDedupeStudents = async () => {
    const phoneMap = new Map<string, string>();
    const duplicateIds: string[] = [];
    students.forEach((s) => {
      const norm = normalizeStudentKey(s.phone);
      if (phoneMap.has(norm)) {
        duplicateIds.push(s.id);
      } else {
        phoneMap.set(norm, s.id);
      }
    });
    if (duplicateIds.length === 0) {
      toast({ variant: 'info', title: 'No Duplicates', message: 'All student records in this batch have unique phone numbers.' });
      return;
    }
    await handleBatchRemoveStudents(duplicateIds);
  };

  // Multi-Date Attendance Actions
  const handleAddHourSessionColumn = () => {
    const today = todayISO();
    const currentCount = attendanceSessions.filter((s) => s.date === today).length;
    const newSession = {
      id: `sess-${Date.now()}`,
      date: today,
      hour: currentCount + 1,
    };
    setAttendanceSessions((prev) => [...prev, newSession]);
    toast({ variant: 'success', title: 'Session Column Added', message: `Hour ${newSession.hour} added for ${today}.` });
  };

  const handleDeleteSessionColumn = (colId: string) => {
    if (attendanceSessions.length <= 1) {
      toast({ variant: 'warning', title: 'Cannot Delete', message: 'At least one session column is required.' });
      return;
    }
    setAttendanceSessions((prev) => prev.filter((c) => c.id !== colId));
  };

  const handleToggleSessionStatus = (studentId: string, colId: string) => {
    setAttendanceMatrix((prev) => {
      const current = prev[studentId]?.[colId] || 'present';
      const next = current === 'present' ? 'absent' : current === 'absent' ? 'late' : 'present';
      return {
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [colId]: next,
        },
      };
    });
  };

  // Eligibility Criteria Actions
  const handleAddEligCriterion = () => {
    if (eligibilityCriteria.length >= 3) return;
    const unused = (['ass1', 'ass2', 'ass3'] as SortableCol[]).find(
      (a) => !eligibilityCriteria.some((c) => c.assessment === a)
    );
    if (unused) {
      setEligibilityCriteria((prev) => [...prev, { assessment: unused, threshold: 60 }]);
    }
  };

  const handleUpdateEligCriterion = (idx: number, field: 'assessment' | 'threshold', val: any) => {
    setEligibilityCriteria((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c))
    );
  };

  const handleRemoveEligCriterion = (idx: number) => {
    setEligibilityCriteria((prev) => prev.filter((_, i) => i !== idx));
  };

  // Download PDF
  const downloadPDF = async () => {
    if (!students || students.length === 0) {
      toast({ variant: 'warning', title: 'No Students', message: 'Cannot generate PDF without student records.' });
      return;
    }
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Student Performance & Exam Eligibility Report', 105, 16, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${activeBatch?.trainingName || 'Training Batch'} · ${activeBatch?.college || 'College'}`, 105, 23, { align: 'center' });

    const rows = students.map((s, idx) => [
      String(idx + 1),
      s.name,
      s.phone,
      `${s.attendancePct}%`,
      String(s.ass1 || 0),
      String(s.ass2 || 0),
      String(s.ass3 || 0),
      String(s.finalExam || 0),
      s.voucherStatus || 'Unassigned',
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['#', 'Name', 'Phone', 'Attendance %', 'Ass 1', 'Ass 2', 'Ass 3', 'Final Exam', 'Voucher Status']],
      body: rows,
    });
    doc.save(`${activeBatch?.code || 'Batch'}_Performance_Report.pdf`);
    toast({ variant: 'success', title: 'PDF Downloaded', message: 'Report generated successfully.' });
  };

  const downloadVoucherTemplate = () => {
    const csvHeader = 'Phone Number,Name,Voucher ID\n';
    const rows = students
      .map((s) => `"${s.phone}","${s.name}","${s.voucherId || ''}"`)
      .join('\n');
    const blob = new Blob([csvHeader + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Student_Voucher_ID_Template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ variant: 'success', title: 'Template Downloaded', message: 'Student_Voucher_ID_Template.csv downloaded.' });
  };

  // Modals
  const [createBatchModalOpen, setCreateBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [editBatchForm, setEditBatchForm] = useState({
    selectedCourseId: '',
    trainingName: '',
    college: '',
    collegeCourse: '',
    academicYear: '2026-2027',
    batchName: 'Batch 1',
    capacity: '',
    trainerId: '',
    coTrainerIds: [] as string[],
    coordinator: '',
    coordinatorEmail: '',
    startDate: '',
    endDate: '',
    phase: 'Scheduled' as TrainingPhase,
  });
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ name: '', email: '', phone: '', college: '' });
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Daily Report
  const [dailyReportBuilderOpen, setDailyReportBuilderOpen] = useState(false);
  const [dailyReportPreviewOpen, setDailyReportPreviewOpen] = useState(false);
  const [dailyReportConfig, setDailyReportConfig] = useState<DailyReportConfig | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<TrainingDeliveryLogItem[]>([]);

  useEffect(() => {
    if (activeBatch?.id) {
      getBatchTrainingDeliveryLogs(activeBatch.id).then((res) => {
        if (res.ok && res.value) {
          setDeliveryLogs(res.value);
        }
      });
    }
  }, [activeBatch?.id, getBatchTrainingDeliveryLogs]);

  const dailyReportFixture: DailyReportData = useMemo(() => {
    return {
      reportDate: todayISO(),
      batchId: activeBatch?.id || 'mock',
      batchCode: activeBatch?.code || 'BATCH-1',
      batchName: activeBatch?.trainingName || 'Batch 1',
      collegeName: activeBatch?.college || 'College',
      courseName: activeBatch?.trainingName || 'Course',
      academicYear: activeBatch?.academicYear || '2026-2027',
      trainerName: activeTrainer ? `${activeTrainer.firstName} ${activeTrainer.lastName}` : 'Trainer',
      coordinatorName: activeBatch?.coordinator || 'Coordinator',
      totalStudents: students.length,
      courseMaxMarks: 100,
      finalExamPassMarkPercent: 70,
      assessments: [],
      sessions: [],
      students: students.map((s) => ({
        id: s.id,
        registerNo: s.registerNo || s.id.slice(0, 8),
        phone: s.phone || '',
        name: s.name,
        email: s.email,
        college: activeBatch?.college || '',
        batch: activeBatch?.code || '',
        attendancePct: s.attendancePct,
        totalPresent: Math.round((s.attendancePct / 100) * 10),
        totalSessions: 10,
        assessmentScores: {},
        assessmentStatus: (s.overallScore >= 70 ? 'Completed' : 'Pending') as any,
        finalExamEligibility: (s.attendancePct >= attendanceThreshold ? 'Eligible' : 'Not Eligible') as any,
        finalExamMark: s.overallScore,
        finalExamResult: (s.overallScore >= 70 ? 'Passed' : 'Failed') as any,
      })),
      progressMilestones: [],
      riskItems: [],
      defaultTrainerNotes: 'Training proceeding as planned with active participation and practical lab exercises.',
      deliveryLogs: deliveryLogs.length > 0 ? deliveryLogs : undefined,
      batch: activeBatch ? {
        id: activeBatch.id,
        code: activeBatch.code,
        college: activeBatch.college,
        program: activeBatch.program,
        trainerName: activeTrainer ? `${activeTrainer.firstName} ${activeTrainer.lastName}` : 'Trainer',
        courseName: activeBatch.trainingName,
        academicYear: activeBatch.academicYear,
        startDate: activeBatch.startDate || todayISO(),
        endDate: activeBatch.endDate || todayISO(),
      } : {
        id: 'mock',
        code: 'BATCH-1',
        college: 'College',
        program: 'Analytics',
        trainerName: 'Trainer',
        courseName: 'Course',
        academicYear: '2026-2027',
        startDate: todayISO(),
        endDate: todayISO(),
      },
      currentSession: {
        date: todayISO(),
        dayNumber: 1,
        startTime: '09:30',
        endTime: '16:30',
        totalHours: 6,
        topicCovered: 'Data Analytics & Modeling',
        summaryNotes: 'Completed core modules and practical demonstrations.',
      },
      attendanceMetrics: {
        totalEnrolled: students.length,
        presentToday: students.filter((s) => s.attendancePct >= 80).length,
        absentToday: students.filter((s) => s.attendancePct < 80).length,
        overallPercentage: students.length > 0 ? Math.round(students.reduce((a, s) => a + s.attendancePct, 0) / students.length) : 100,
      },
      photoGallery: [],
    };
  }, [activeBatch, activeTrainer, students, attendanceThreshold, deliveryLogs]);

  // Create Batch Form
  const [newBatchForm, setNewBatchForm] = useState({
    code: '',
    selectedCourseId: '',
    trainingName: '',
    college: '',
    collegeCourse: '',
    academicYear: '2026-2027',
    batchName: 'Batch 1',
    capacity: '',
    trainerId: '',
    coTrainerIds: [] as string[],
    coordinator: '',
    coordinatorEmail: '',
    startDate: '',
    endDate: '',
    phase: 'Not Started' as TrainingPhase,
  });

  const handleOpenCreateBatch = () => {
    setNewBatchForm({
      code: '',
      selectedCourseId: courses[0]?.id || '',
      trainingName: '',
      college: '',
      collegeCourse: '',
      academicYear: '2026-2027',
      batchName: 'Batch 1',
      capacity: '',
      trainerId: '',
      coTrainerIds: [],
      coordinator: '',
      coordinatorEmail: '',
      startDate: '',
      endDate: '',
      phase: 'Not Started',
    });
    setCreateBatchModalOpen(true);
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const courseId = newBatchForm.selectedCourseId || courses[0]?.id;
    const trainerId = newBatchForm.trainerId ? newBatchForm.trainerId : undefined;
    const college = newBatchForm.college.trim();
    const program = newBatchForm.collegeCourse.trim();
    const batchNo = newBatchForm.batchName.trim() || 'Batch 1';

    if (!courseId) {
      toast({ variant: 'error', title: 'Missing Info', message: 'Course is required.' });
      return;
    }
    if (!college) {
      toast({ variant: 'error', title: 'Missing Info', message: 'College Name is required.' });
      return;
    }

    const res = await createBatch({
      code: `${college} - ${program} - ${batchNo}`,
      trainingName: newBatchForm.trainingName || courses.find((c) => c.id === courseId)?.title || 'Course',
      college,
      program,
      courseId,
      trainerId,
      coTrainerIds: newBatchForm.coTrainerIds,
      startDate: newBatchForm.startDate || undefined,
      endDate: newBatchForm.endDate || undefined,
      coordinator: newBatchForm.coordinator.trim(),
      coordinatorEmail: newBatchForm.coordinatorEmail.trim(),
      academicYear: newBatchForm.academicYear.trim() || '2026-2027',
      batchNo,
      capacity: newBatchForm.capacity ? Number(newBatchForm.capacity) : 0,
      phase: newBatchForm.phase || 'Not Started',
    });
    if (res.ok) {
      toast({ variant: 'success', title: 'Batch Created', message: 'New batch created successfully.' });
      setCreateBatchModalOpen(false);
      refreshBatches(true);
    } else {
      toast({ variant: 'error', title: 'Creation Failed', message: res.error });
    }
  };

  const handleOpenEditBatch = (b: Batch) => {
    const college = b.college || (b.code?.includes('-') ? b.code.split('-')[0].trim() : '') || '';
    const program = b.program || (b as any).collegeCourse || (b.code?.includes('-') ? b.code.split('-')[1]?.trim() : '') || '';
    const batchNo = b.batchNo || (b.code?.match(/Batch\s*\d+/i)?.[0]) || (b.code?.includes('-') ? b.code.split('-').pop()?.trim() : '') || 'Batch 1';
    const academicYear = b.academicYear || (b.code?.match(/20\d\d-20\d\d/)?.[0]) || '2026-2027';

    setEditingBatch(b);
    setEditBatchForm({
      selectedCourseId: b.courseId || '',
      trainingName: b.trainingName || '',
      college,
      collegeCourse: program,
      academicYear,
      batchName: batchNo,
      capacity: b.capacity !== undefined && b.capacity !== null ? String(b.capacity) : '',
      trainerId: b.trainerId || '',
      coTrainerIds: b.coTrainerIds || [],
      coordinator: b.coordinator || '',
      coordinatorEmail: b.coordinatorEmail || '',
      startDate: b.startDate ? b.startDate.split('T')[0] : '',
      endDate: b.endDate ? b.endDate.split('T')[0] : '',
      phase: (b.phase as TrainingPhase) || 'Scheduled',
    });
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    const courseId = editBatchForm.selectedCourseId || editingBatch.courseId;
    const college = editBatchForm.college.trim();
    const program = editBatchForm.collegeCourse.trim();
    const batchNo = editBatchForm.batchName.trim() || 'Batch 1';

    if (!courseId) {
      toast({ variant: 'error', title: 'Missing Info', message: 'Course is required.' });
      return;
    }
    if (!college) {
      toast({ variant: 'error', title: 'Missing Info', message: 'College Name is required.' });
      return;
    }

    const updatedCode = `${college} - ${program} - ${batchNo}`;
    const course = courses.find((c) => c.id === courseId);

    const res = await updateBatch(editingBatch.id, {
      code: updatedCode,
      trainingName: editBatchForm.trainingName || course?.title || editingBatch.trainingName || 'Course',
      college,
      program,
      courseId,
      trainerId: editBatchForm.trainerId ? editBatchForm.trainerId : undefined,
      coTrainerIds: editBatchForm.coTrainerIds,
      startDate: editBatchForm.startDate || undefined,
      endDate: editBatchForm.endDate || undefined,
      coordinator: editBatchForm.coordinator.trim(),
      coordinatorEmail: editBatchForm.coordinatorEmail.trim(),
      academicYear: editBatchForm.academicYear.trim() || '2026-2027',
      batchNo,
      capacity: editBatchForm.capacity ? Number(editBatchForm.capacity) : 0,
      phase: editBatchForm.phase,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Batch Updated', message: 'Training batch updated successfully.' });
      setEditingBatch(null);
      refreshBatches(true);
    } else {
      toast({ variant: 'error', title: 'Update Failed', message: res.error });
    }
  };

  const handleToggleCompleteBatch = async (batchId: string) => {
    const b = safeBatches.find((x) => x.id === batchId) || batches.find((x) => x.id === batchId);
    if (!b) return;
    const isCompleted = b.phase === 'Completed';
    const nextPhase: TrainingPhase = isCompleted ? 'In Progress' : 'Completed';

    const res = await updateBatch(batchId, { phase: nextPhase });
    if (res.ok) {
      toast({
        variant: 'success',
        title: isCompleted ? 'Batch Reopened' : 'Batch Closed',
        message: isCompleted
          ? 'Batch status changed back to In Progress.'
          : 'Batch successfully marked as Completed.',
      });
      refreshBatches(true);
    } else {
      toast({
        variant: 'error',
        title: 'Status Update Failed',
        message: res.error,
      });
    }
  };

  // Upload Roster (with mandatory Email and DB upsert)
  const handleFileUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length <= 1) {
          toast({ variant: 'error', title: 'Empty File', message: 'Spreadsheet has no data rows.' });
          return;
        }
        const header = rows[0].map((h: any) => String(h || '').toLowerCase().trim());
        const nameIdx = header.findIndex((h) => h.includes('name') || h.includes('student'));
        const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('number'));
        const emailIdx = header.findIndex((h) => h.includes('email') || h.includes('mail'));

        if (nameIdx === -1 || phoneIdx === -1 || emailIdx === -1) {
          toast({
            variant: 'error',
            title: 'Missing Required Columns',
            message: 'Spreadsheet must include Name, Phone Number, and Email Address columns.',
          });
          return;
        }

        const total = rows.length - 1;
        let processed = 0;
        const repo = container.resolve<any>(STUDENT_REPOSITORY_TOKEN);

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[nameIdx]) continue;
          const name = String(row[nameIdx]).trim();
          const phone = String(row[phoneIdx] || '').trim();
          const email = String(row[emailIdx] || '').trim();
          if (!name || !email) continue;

          setImportProgress({ current: i, total, message: `Upserting ${name}...` });

          const existing = await repo.findByRegisterNo(phone);
          let sid = existing?.id;
          if (existing) {
            await repo.update(existing.id, {
              email,
              phone,
            });
          } else {
            const names = name.split(' ');
            const res = await registerStudent({
              firstName: names[0] || 'Student',
              lastName: names.slice(1).join(' ') || '',
              phone,
              email,
              customFields: {
                college: activeBatch?.college || '',
                department: activeBatch?.program || '',
                attendancePct: 100,
                attendanceStatus: 'Regular',
              },
            });
            if (res.ok) sid = res.value.id;
          }

          if (sid && selectedBatchId) {
            await supabase
              .from('flwdsk_enrollments')
              .upsert({ batch_id: selectedBatchId, student_id: sid }, { onConflict: 'student_id,batch_id' });
          }
          processed++;
        }
        toast({ variant: 'success', title: 'Roster Uploaded', message: `Successfully upserted ${processed} student records.` });
        setUploadModalOpen(false);
        setImportProgress(null);
        refreshBatches(true);
      } catch (err: any) {
        toast({ variant: 'error', title: 'Upload Failed', message: err.message });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadExamMarks = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length <= 1) return;
        const header = rows[0].map((h: any) => String(h || '').toLowerCase().trim());
        const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('number'));
        const markIdx = header.findIndex((h) => h.includes('mark') || h.includes('score'));

        if (phoneIdx === -1 || markIdx === -1) {
          toast({ variant: 'error', title: 'Invalid Columns', message: 'Spreadsheet requires Phone and Mark columns.' });
          return;
        }

        let count = 0;
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const phone = String(row[phoneIdx] || '').trim();
          const mark = Number(row[markIdx]);
          if (!phone || isNaN(mark)) continue;

          const st = students.find((s) => normalizeStudentKey(s.phone) === normalizeStudentKey(phone));
          if (st) {
            const updated = { ...st, finalExam: mark };
            handleUpdateStudent(updated);
            await saveStudentToDb(updated);
            count++;
          }
        }
        toast({ variant: 'success', title: 'Marks Uploaded', message: `Updated marks for ${count} students.` });
      } catch (err: any) {
        toast({ variant: 'error', title: 'Upload Failed', message: err.message });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <AppShell>
      {/* ── Top Header & Training Batch Carousel ── */}
      <BatchHeaderCard
        activeBatch={activeBatch}
        safeBatches={safeBatches}
        courses={courses}
        trainers={trainers}
        safeTrainers={trainers}
        selectedTrainerId={selectedTrainerId}
        onSelectTrainerId={setSelectedTrainerId}
        selectedBatchId={selectedBatchId}
        onSelectBatchId={setSelectedBatchId}
        canCreateBatch={canCreateBatch}
        onOpenCreateBatch={handleOpenCreateBatch}
        onCarouselAction={(batchId, action) => {
          setSelectedBatchId(batchId);
          if (action.id === 'daily') setDailyReportPreviewOpen(true);
          else if (action.id === 'student') setActiveTab('matrix');
          else if (action.id === 'attendance') setActiveTab('attendance');
          else if (action.id === 'final') {
            setEmailSubject('Final Course Report');
            setEmailComposerOpen(true);
          }
          else if (action.id === 'expense-details') {
            setExpenseBatchId(batchId);
            setExpenseDetailsOpen(true);
          }
        }}
        onEditBatch={handleOpenEditBatch}
        onCopyBatch={() => toast({ variant: 'info', title: 'Copy Batch', message: 'Duplicate batch template initiated.' })}
        onDeleteBatch={userRole === 'ADMIN' ? async (id) => {
          const ok = await confirm({ title: 'Delete Batch?', message: 'Are you sure you want to delete this batch?' });
          if (ok) {
            await removeBatch(id);
            refreshBatches(true);
          }
        } : undefined}
        onToggleCompleteBatch={handleToggleCompleteBatch}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      {/* ── Drawers & Modals (Add/Edit Batch Centered Modals) ── */}
      {createBatchModalOpen && (
        <Modal open={true} onClose={() => setCreateBatchModalOpen(false)} title="➕ Create New Training Batch" size="lg">
          <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Live Batch Code Preview Banner */}
            <div style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Universal 5-Part Batch Code:</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', fontFamily: 'monospace' }}>
                {[newBatchForm.college || 'College', newBatchForm.collegeCourse || 'Stream', newBatchForm.academicYear || 'Year', newBatchForm.batchName || 'Batch', courses.find((c) => c.id === newBatchForm.selectedCourseId)?.code || 'Course'].join(' - ')}
              </span>
            </div>

            {/* Fieldset 1: College & Course */}
            <fieldset style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <legend style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand)', padding: '0 6px' }}>
                1. College & Course Details
              </legend>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Program / Course *</label>
                <select
                  className="kvj-select"
                  required
                  value={newBatchForm.selectedCourseId}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, selectedCourseId: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                >
                  <option value="">-- Choose Course --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>College Name *</label>
                  <select
                    className="kvj-select"
                    required
                    value={newBatchForm.college}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, college: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  >
                    <option value="">-- Choose College --</option>
                    {availableColleges.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                    {newBatchForm.college && !availableColleges.includes(newBatchForm.college) && (
                      <option value={newBatchForm.college}>{newBatchForm.college}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Program / Stream *</label>
                  <input
                    type="text"
                    className="kvj-input"
                    required
                    value={newBatchForm.collegeCourse}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, collegeCourse: e.target.value })}
                    placeholder="e.g. BCOM Self / BBA"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </fieldset>

            {/* Fieldset 2: Basic Batch Details */}
            <fieldset style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <legend style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand)', padding: '0 6px' }}>
                2. Batch Specifics & Capacity
              </legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Batch Name / No. *</label>
                  <input
                    type="text"
                    className="kvj-input"
                    required
                    value={newBatchForm.batchName}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, batchName: e.target.value })}
                    placeholder="e.g. Batch 1"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Academic Year</label>
                  <input
                    type="text"
                    className="kvj-input"
                    value={newBatchForm.academicYear}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, academicYear: e.target.value })}
                    placeholder="e.g. 2026-2027"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>No. of Students</label>
                  <input
                    type="number"
                    min="0"
                    className="kvj-input"
                    value={newBatchForm.capacity}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, capacity: e.target.value })}
                    placeholder="e.g. 60"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Status</label>
                  <select
                    className="kvj-select"
                    value={newBatchForm.phase}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, phase: e.target.value as TrainingPhase })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  >
                    {APPROVED_BATCH_STATUSES.map((ph) => (
                      <option key={ph} value={ph}>{ph}</option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Fieldset 3: Timeline & College Coordinator */}
            <fieldset style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <legend style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand)', padding: '0 6px' }}>
                3. Timeline &amp; College Coordinator
              </legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Start Date *</label>
                  <input
                    type="date"
                    required
                    className="kvj-input"
                    value={newBatchForm.startDate}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, startDate: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>End Date *</label>
                  <input
                    type="date"
                    required
                    className="kvj-input"
                    value={newBatchForm.endDate}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, endDate: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Coordinator Name</label>
                  <input
                    type="text"
                    className="kvj-input"
                    value={newBatchForm.coordinator}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, coordinator: e.target.value })}
                    placeholder="e.g. Prof. John Doe"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Coordinator Email</label>
                  <input
                    type="email"
                    className="kvj-input"
                    value={newBatchForm.coordinatorEmail}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, coordinatorEmail: e.target.value })}
                    placeholder="e.g. coordinator@college.edu"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </fieldset>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <Button variant="secondary" type="button" onClick={() => setCreateBatchModalOpen(false)}>Cancel</Button>
              <Button type="submit">➕ Create Batch</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Batch Modal */}
      {editingBatch && (
        <Modal open={true} onClose={() => setEditingBatch(null)} title="✏️ Edit Training Batch" size="lg">
          <form onSubmit={handleUpdateBatch} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Live Batch Code Preview Banner */}
            <div style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Universal 5-Part Batch Code:</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', fontFamily: 'monospace' }}>
                {[editBatchForm.college || 'College', editBatchForm.collegeCourse || 'Stream', editBatchForm.academicYear || 'Year', editBatchForm.batchName || 'Batch', courses.find((c) => c.id === editBatchForm.selectedCourseId)?.code || 'Course'].join(' - ')}
              </span>
            </div>

            {/* Fieldset 1: College & Course */}
            <fieldset style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <legend style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand)', padding: '0 6px' }}>
                1. College & Course Details
              </legend>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Program / Course *</label>
                <select
                  className="kvj-select"
                  required
                  value={editBatchForm.selectedCourseId}
                  onChange={(e) => setEditBatchForm({ ...editBatchForm, selectedCourseId: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                >
                  <option value="">-- Choose Course --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>College Name *</label>
                  <select
                    className="kvj-select"
                    required
                    value={editBatchForm.college}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, college: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  >
                    <option value="">-- Choose College --</option>
                    {availableColleges.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                    {editBatchForm.college && !availableColleges.includes(editBatchForm.college) && (
                      <option value={editBatchForm.college}>{editBatchForm.college}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Program / Stream *</label>
                  <input
                    type="text"
                    className="kvj-input"
                    required
                    value={editBatchForm.collegeCourse}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, collegeCourse: e.target.value })}
                    placeholder="e.g. 2 MCOM / BBA"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </fieldset>

            {/* Fieldset 2: Basic Batch Details */}
            <fieldset style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <legend style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand)', padding: '0 6px' }}>
                2. Batch Specifics & Status
              </legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Batch Name / No. *</label>
                  <input
                    type="text"
                    className="kvj-input"
                    required
                    value={editBatchForm.batchName}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, batchName: e.target.value })}
                    placeholder="e.g. Batch 1"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Academic Year</label>
                  <input
                    type="text"
                    className="kvj-input"
                    value={editBatchForm.academicYear}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, academicYear: e.target.value })}
                    placeholder="e.g. 2026-2027"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Phase / Status</label>
                  <select
                    className="kvj-select"
                    value={editBatchForm.phase}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, phase: e.target.value as TrainingPhase })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  >
                    {APPROVED_BATCH_STATUSES.map((ph) => (
                      <option key={ph} value={ph}>{ph}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>No. of Students</label>
                  <input
                    type="number"
                    min="0"
                    className="kvj-input"
                    value={editBatchForm.capacity}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, capacity: e.target.value })}
                    placeholder="e.g. 60"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </fieldset>

            {/* Fieldset 3: Timeline & College Coordinator */}
            <fieldset style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <legend style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand)', padding: '0 6px' }}>
                3. Timeline &amp; College Coordinator
              </legend>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Coordinator Name</label>
                  <input
                    type="text"
                    className="kvj-input"
                    value={editBatchForm.coordinator}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, coordinator: e.target.value })}
                    placeholder="e.g. Prof. Name"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Coordinator Email</label>
                  <input
                    type="email"
                    className="kvj-input"
                    value={editBatchForm.coordinatorEmail}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, coordinatorEmail: e.target.value })}
                    placeholder="e.g. coordinator@college.edu"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Start Date</label>
                  <input
                    type="date"
                    className="kvj-input"
                    value={editBatchForm.startDate}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, startDate: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>End Date</label>
                  <input
                    type="date"
                    className="kvj-input"
                    value={editBatchForm.endDate}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, endDate: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </fieldset>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <Button variant="secondary" type="button" onClick={() => setEditingBatch(null)}>Cancel</Button>
              <Button type="submit">💾 Save Changes</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Batch Expense Details Drawer */}
      <BatchExpenseDetailsDrawer
        open={expenseDetailsOpen}
        onClose={() => {
          setExpenseDetailsOpen(false);
          setExpenseBatchId(null);
        }}
        batch={expenseBatch}
        batchName={formatBatchWithCourse(
          {
            code: expenseBatchCardVM?.batchCode || expenseBatch?.code,
            batchNo: expenseBatch?.batchNo,
            trainingName: expenseBatch?.trainingName,
          },
          expenseBatchCardVM?.course
        )}
        batchCode={formatBatchWithCourse(
          {
            code: expenseBatchCardVM?.batchCode || expenseBatch?.code,
            batchNo: expenseBatch?.batchNo,
            trainingName: expenseBatch?.trainingName,
          },
          expenseBatchCardVM?.course
        )}
        studentCount={students.length > 0 ? students.length : (expenseBatch?.capacity ?? 0)}
        startDate={expenseBatch?.startDate}
        endDate={expenseBatch?.endDate}
        allBatches={safeBatches}
      />
    </AppShell>
  );
}

export default BatchManagement;
