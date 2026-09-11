import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppShell } from '../../../shared/layout/AppShell';
import { Button, Card, SectionHeader, Badge, ProgressBar } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { useTraining } from '../hooks/useTraining';
import { STUDENT_REPOSITORY_TOKEN, COLLEGE_REPOSITORY_TOKEN, type Batch } from '../training.repository';
import { normalizeStudentKey } from '../supabase-training.repository';
import { supabase } from '../../../shared/integration/supabase';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { usePermissions } from '../../../shared/permissions/react';
import { useAuth } from '../../auth/AuthProvider';
import { todayISO } from '../../../shared/utils/date';
import { DailyReportBuilderModal } from '../report/DailyReportBuilderModal';
import { DailyReportPreview } from '../report/DailyReportPreview';
import type { DailyReportConfig, DailyReportData, TrainingDeliveryLogItem } from '../report/daily-report.types';
import { cleanBatchCode } from '../utils/batch-formatter';
import { useDialog } from '../../../shared/feedback/DialogProvider';

// Decomposed Components & Sub-Tabs
import { BatchHeaderCard } from '../components/BatchHeaderCard';
import { StudentsTab } from '../tabs/StudentsTab';
import { AttendanceMatrixTab } from '../tabs/AttendanceMatrixTab';
import { ExamScoresTab } from '../tabs/ExamScoresTab';
import { RegistrationTab } from '../tabs/RegistrationTab';
import { CertificateDeliveryTab } from '../tabs/CertificateDeliveryTab';
import { ExamReconciliationDrawers } from '../components/ExamReconciliationDrawers';
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
  const [activeTab, setActiveTab] = useState<StudentSubTab>('matrix');
  const [dbColleges, setDbColleges] = useState<any[]>([]);

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

  // Load Trainers
  useEffect(() => {
    try {
      const empService = container.resolve<any>(EMPLOYEE_SERVICE_TOKEN);
      empService.getEmployees().then((res: any) => {
        if (res.ok && res.value) {
          setTrainers(res.value);
        }
      });
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

  // Load students for active batch
  useEffect(() => {
    if (!selectedBatchId) return;
    const fetchStudentsForBatch = async () => {
      try {
        const { data: enrollData, error: enrollErr } = await supabase
          .from('flwdsk_batch_enrollments')
          .select('student_id, flwdsk_students(*)')
          .eq('batch_id', selectedBatchId);

        if (enrollErr) throw enrollErr;

        if (enrollData) {
          const loaded: StudentRecord[] = enrollData.map((row: any) => {
            const st = row.flwdsk_students;
            const cf = (st?.custom_fields as any) || {};
            return {
              id: st?.id || row.student_id,
              name: `${st?.first_name || ''} ${st?.last_name || ''}`.trim() || 'Student',
              photo: '👤',
              photoUrl: st?.avatar_url || cf.photoUrl || '',
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
        .from('flwdsk_batch_enrollments')
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
        .from('flwdsk_batch_enrollments')
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
  const downloadPDF = () => {
    if (!students || students.length === 0) {
      toast({ variant: 'warning', title: 'No Students', message: 'Cannot generate PDF without student records.' });
      return;
    }
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
    URL.revokeObjectURL(a);
    toast({ variant: 'success', title: 'Template Downloaded', message: 'Student_Voucher_ID_Template.csv downloaded.' });
  };

  // Modals
  const [createBatchModalOpen, setCreateBatchModalOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
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
    college: 'Christ Irinjalakkuda',
    collegeCourse: 'BCOM Self',
    academicYear: '2026-2027',
    batchName: 'Batch 1',
    trainerId: '',
    coTrainerIds: [] as string[],
    coordinator: 'Prof. Anil Kumar',
    coordinatorEmail: 'anil@christcollege.edu',
    startDate: '',
    endDate: '',
  });

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const courseId = newBatchForm.selectedCourseId || courses[0]?.id;
    const trainerId = newBatchForm.trainerId || trainers[0]?.id;
    if (!courseId || !trainerId) {
      toast({ variant: 'error', title: 'Missing Info', message: 'Course and Lead Trainer are required.' });
      return;
    }
    const res = await createBatch({
      code: `${newBatchForm.college} - ${newBatchForm.collegeCourse} - ${newBatchForm.batchName}`,
      trainingName: newBatchForm.trainingName || courses.find((c) => c.id === courseId)?.title || 'Course',
      college: newBatchForm.college,
      program: newBatchForm.collegeCourse,
      courseId,
      trainerId,
      coTrainerIds: newBatchForm.coTrainerIds,
      startDate: newBatchForm.startDate || undefined,
      endDate: newBatchForm.endDate || undefined,
      coordinator: newBatchForm.coordinator,
      coordinatorEmail: newBatchForm.coordinatorEmail,
      academicYear: newBatchForm.academicYear,
      batchNo: newBatchForm.batchName,
      phase: 'Scheduled',
    });
    if (res.ok) {
      toast({ variant: 'success', title: 'Batch Created', message: 'New batch created successfully.' });
      setCreateBatchModalOpen(false);
      refreshBatches();
    } else {
      toast({ variant: 'error', title: 'Creation Failed', message: res.error });
    }
  };

  // Upload Roster (with mandatory Email and DB upsert)
  const handleFileUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
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
              .from('flwdsk_batch_enrollments')
              .upsert({ batch_id: selectedBatchId, student_id: sid }, { onConflict: 'batch_id,student_id' });
          }
          processed++;
        }
        toast({ variant: 'success', title: 'Roster Uploaded', message: `Successfully upserted ${processed} student records.` });
        setUploadModalOpen(false);
        setImportProgress(null);
        refreshBatches();
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
        onOpenCreateBatch={() => setCreateBatchModalOpen(true)}
        onCarouselAction={(batchId, action) => {
          setSelectedBatchId(batchId);
          if (action.id === 'daily') setDailyReportPreviewOpen(true);
          else if (action.id === 'student') setActiveTab('matrix');
          else if (action.id === 'attendance') setActiveTab('attendance');
          else if (action.id === 'final') {
            setEmailSubject('Final Course Report');
            setEmailComposerOpen(true);
          }
        }}
        onEditBatch={(b) => setEditingBatchId(b.id)}
        onCopyBatch={() => toast({ variant: 'info', title: 'Copy Batch', message: 'Duplicate batch template initiated.' })}
        onDeleteBatch={userRole === 'ADMIN' ? async (id) => {
          const ok = await confirm({ title: 'Delete Batch?', message: 'Are you sure you want to delete this batch?' });
          if (ok) {
            await removeBatch(id);
            refreshBatches();
          }
        } : undefined}
      />

      {/* ── Quick Action Bar & Summary Stats ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {/* Workspace Sub-Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'matrix', label: '📊 Performance Matrix' },
            { id: 'attendance', label: '📅 Attendance Matrix' },
            { id: 'final-exam', label: '🎓 Final Exam' },
            { id: 'retest', label: '🔄 Retest (Unlocked)' },
            { id: 'registration', label: '📋 Registration' },
            { id: 'certificates', label: '📜 Certificates' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as StudentSubTab)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                border: activeTab === tab.id ? '1px solid var(--brand)' : '1px solid var(--border)',
                background: activeTab === tab.id ? 'var(--brand)' : 'var(--bg-surface)',
                color: activeTab === tab.id ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Toolbar Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {canViewDailyReport && (
            <Button size="sm" onClick={() => setDailyReportBuilderOpen(true)}>
              📊 Daily Report
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={downloadVoucherTemplate}>
            📥 Voucher Template
          </Button>
          <Button size="sm" onClick={() => setUploadModalOpen(true)}>
            📤 Upload Students (Excel)
          </Button>
          <Button size="sm" onClick={() => setAddStudentModalOpen(true)}>
            ➕ Add Student
          </Button>
          <Button size="sm" variant="secondary" onClick={downloadPDF}>
            📄 Download PDF
          </Button>
        </div>
      </div>

      {/* ── Sub-Tab Body ── */}
      {activeTab === 'matrix' && (
        <StudentsTab
          students={students}
          selectedBatchId={selectedBatchId}
          batchStudentIds={batchStudentIds}
          activeBatch={activeBatch}
          considerAttendance={considerAttendance}
          attendanceThreshold={attendanceThreshold}
          eligibilityCriteria={eligibilityCriteria}
          courseMaxMarks={courseMaxMarks}
          coursePassPct={coursePassPct}
          isExecutive={isExecutive}
          onAssignVoucher={handleAssignVoucher}
          onNotifyVoucher={handleNotifyVoucher}
          onRemoveStudent={handleRemoveStudent}
          onBatchRemoveStudents={handleBatchRemoveStudents}
          onDedupeStudents={handleDedupeStudents}
          onSaveEligibilityConfig={async (cond, thr, crit) => {
            setConsiderAttendance(cond);
            setAttendanceThreshold(thr);
            setEligibilityCriteria(crit);
            if (selectedBatchId) {
              await saveBatchEligibilityRules(selectedBatchId, thr, crit);
            }
          }}
          onSetConsiderAttendance={setConsiderAttendance}
          onSetAttendanceThreshold={setAttendanceThreshold}
          onSetCourseMaxMarks={setCourseMaxMarks}
          onSetCoursePassPct={setCoursePassPct}
          onAddEligCriterion={handleAddEligCriterion}
          onUpdateEligCriterion={handleUpdateEligCriterion}
          onRemoveEligCriterion={handleRemoveEligCriterion}
          assessmentLabelMap={assessmentLabelMap}
          onOpenUploadModal={() => setUploadModalOpen(true)}
          onOpenAddStudentModal={() => setAddStudentModalOpen(true)}
          onOpenUploadVoucherModal={() => setUploadModalOpen(true)}
          onDownloadVoucherTemplate={downloadVoucherTemplate}
          onDownloadPDF={downloadPDF}
          onOpenDailyReport={() => setDailyReportBuilderOpen(true)}
          onOpenBulkEmail={() => setEmailComposerOpen(true)}
          canViewDailyReport={canViewDailyReport}
        />
      )}

      {activeTab === 'attendance' && (
        <AttendanceMatrixTab
          students={students}
          selectedBatchId={selectedBatchId}
          batchStudentIds={batchStudentIds}
          considerAttendance={considerAttendance}
          attendanceThreshold={attendanceThreshold}
          attendanceSessions={attendanceSessions}
          attendanceMatrix={attendanceMatrix}
          onAddHourSession={handleAddHourSessionColumn}
          onDeleteSession={handleDeleteSessionColumn}
          onUpdateSessionDate={(colId, date) => {
            setAttendanceSessions((prev) =>
              prev.map((c) => (c.id === colId ? { ...c, date } : c))
            );
          }}
          onUpdateSessionHour={(colId, hour) => {
            setAttendanceSessions((prev) =>
              prev.map((c) => (c.id === colId ? { ...c, hour } : c))
            );
          }}
          onToggleStatus={handleToggleSessionStatus}
        />
      )}

      {activeTab === 'final-exam' && (
        <ExamScoresTab
          mode="final-exam"
          students={students}
          selectedBatchId={selectedBatchId}
          batchStudentIds={batchStudentIds}
          activeCourse={activeCourse}
          activeBatch={activeBatch}
          selectedAttemptTypes={selectedAttemptTypes}
          onSetSelectedAttemptTypes={setSelectedAttemptTypes}
          onUpdateStudent={handleUpdateStudent}
          onSaveStudentToDb={saveStudentToDb}
          onRemoveStudent={handleRemoveStudent}
          onAddStudent={() => setAddStudentModalOpen(true)}
          onOpenReconciliation={() => setReconciliationDrawerOpen(true)}
          onUploadMarks={handleUploadExamMarks}
          onSaveRetestPaymentLedger={async (sid, st) => {
            await verifyRetestPayment(sid, selectedBatchId, st === 'Paid');
          }}
          toast={toast}
          isExecutive={isExecutive}
        />
      )}

      {activeTab === 'retest' && (
        <ExamScoresTab
          mode="retest"
          students={students}
          selectedBatchId={selectedBatchId}
          batchStudentIds={batchStudentIds}
          activeCourse={activeCourse}
          activeBatch={activeBatch}
          selectedAttemptTypes={selectedAttemptTypes}
          onSetSelectedAttemptTypes={setSelectedAttemptTypes}
          onUpdateStudent={handleUpdateStudent}
          onSaveStudentToDb={saveStudentToDb}
          onRemoveStudent={handleRemoveStudent}
          onAddStudent={() => setAddStudentModalOpen(true)}
          onOpenReconciliation={() => setReconciliationDrawerOpen(true)}
          onUploadMarks={handleUploadExamMarks}
          onSaveRetestPaymentLedger={async (sid, st) => {
            await verifyRetestPayment(sid, selectedBatchId, st === 'Paid');
          }}
          toast={toast}
          isExecutive={isExecutive}
        />
      )}

      {activeTab === 'registration' && (
        <RegistrationTab
          students={students}
          registrationRecords={registrationRecords}
          registrationSearchQuery={registrationSearchQuery}
          onSearchChange={setRegistrationSearchQuery}
        />
      )}

      {activeTab === 'certificates' && (
        <CertificateDeliveryTab
          filteredStudents={students}
          selectedBatchId={selectedBatchId}
          enrollments={enrollments || []}
          getCertificateDelivery={getCertificateDelivery}
          getCertificateReceiptUrl={getCertificateReceiptUrl}
          saveCertificateDelivery={saveCertificateDelivery}
          uploadCertificateReceipt={uploadCertificateReceipt}
          toast={toast}
        />
      )}

      {/* ── Drawers & Modals ── */}
      {createBatchModalOpen && (
        <Drawer open={true} onClose={() => setCreateBatchModalOpen(false)} title="➕ Create New Training Batch">
          <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                  {(dbColleges.length > 0 ? dbColleges : [{ name: 'Christ Irinjalakkuda' }, { name: 'MIM Kuttikkanam' }, { name: 'St. Thomas College' }]).map((c: any, i: number) => (
                    <option key={i} value={c.name}>{c.name}</option>
                  ))}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Lead Trainer *</label>
                <select
                  className="kvj-select"
                  required
                  value={newBatchForm.trainerId}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, trainerId: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                >
                  <option value="">-- Choose Lead Trainer --</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.designation})</option>
                  ))}
                </select>
              </div>

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
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <Button variant="secondary" type="button" onClick={() => setCreateBatchModalOpen(false)}>Cancel</Button>
              <Button type="submit">➕ Create Batch</Button>
            </div>
          </form>
        </Drawer>
      )}

      {/* Upload Student Roster Drawer */}
      {uploadModalOpen && (
        <Drawer open={true} onClose={() => setUploadModalOpen(false)} title="📤 Upload Student Roster (Excel / CSV)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                📋 Required columns: <code>Name</code>, <code>Phone Number</code>, and <code>Email Address</code>
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Existing records are automatically updated with the latest details. New students are enrolled in this batch.
              </p>
            </div>

            {!importProgress ? (
              <>
                <div style={{ border: '2px dashed var(--brand)', borderRadius: 12, padding: 30, textAlign: 'center', background: 'var(--bg-sunken)' }}>
                  <span style={{ fontSize: 32 }}>📄</span>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>Choose Excel / CSV File</div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setSelectedUploadFile(e.target.files?.[0] || null)}
                    style={{ marginTop: 12 }}
                  />
                  {selectedUploadFile && (
                    <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: 'var(--brand)', background: 'rgba(99, 102, 241, 0.1)', padding: '6px 12px', borderRadius: 6, display: 'inline-block' }}>
                      📁 Selected: {selectedUploadFile.name} ({(selectedUploadFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                  <Button variant="secondary" onClick={() => setUploadModalOpen(false)}>Cancel</Button>
                  <Button disabled={!selectedUploadFile} onClick={() => selectedUploadFile && handleFileUpload(selectedUploadFile)}>
                    📤 Start Upload
                  </Button>
                </div>
              </>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 24, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{importProgress.message}</p>
                <ProgressBar value={importProgress.current} max={importProgress.total} tone="brand" size="md" showLabel />
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* Add Single Student Drawer */}
      {addStudentModalOpen && (
        <Drawer open={true} onClose={() => setAddStudentModalOpen(false)} title="➕ Add Student Record">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newStudentForm.name.trim() || !newStudentForm.email.trim()) return;
              try {
                const names = newStudentForm.name.split(' ');
                const res = await registerStudent({
                  firstName: names[0] || 'Student',
                  lastName: names.slice(1).join(' ') || '',
                  phone: newStudentForm.phone,
                  email: newStudentForm.email,
                  customFields: {
                    college: newStudentForm.college || activeBatch?.college || '',
                    attendancePct: 100,
                    attendanceStatus: 'Regular',
                  },
                });
                if (res.ok && selectedBatchId) {
                  await supabase
                    .from('flwdsk_batch_enrollments')
                    .insert({ batch_id: selectedBatchId, student_id: res.value.id });
                  toast({ variant: 'success', title: 'Student Added', message: 'Student registered and enrolled.' });
                  setAddStudentModalOpen(false);
                  refreshBatches();
                }
              } catch (err: any) {
                toast({ variant: 'error', title: 'Failed', message: err.message });
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Full Name *</label>
              <input
                type="text"
                className="kvj-input"
                required
                value={newStudentForm.name}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                placeholder="e.g. Rahul Sharma"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Email Address *</label>
              <input
                type="email"
                className="kvj-input"
                required
                value={newStudentForm.email}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                placeholder="rahul@example.com"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Phone Number</label>
              <input
                type="text"
                className="kvj-input"
                value={newStudentForm.phone}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, phone: e.target.value })}
                placeholder="+91 98765 00000"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setAddStudentModalOpen(false)}>Cancel</Button>
              <Button type="submit">➕ Register Student</Button>
            </div>
          </form>
        </Drawer>
      )}

      {/* Daily Report Builder & Preview Modals */}
      {dailyReportBuilderOpen && (
        <DailyReportBuilderModal
          isOpen={dailyReportBuilderOpen}
          onClose={() => setDailyReportBuilderOpen(false)}
          data={dailyReportFixture}
          onGenerate={(generatedConfig) => {
            setDailyReportConfig(generatedConfig);
            setDailyReportBuilderOpen(false);
            setDailyReportPreviewOpen(true);
          }}
        />
      )}

      {dailyReportPreviewOpen && (
        <DailyReportPreview
          isOpen={dailyReportPreviewOpen}
          onClose={() => setDailyReportPreviewOpen(false)}
          data={dailyReportFixture}
          initialConfig={dailyReportConfig}
        />
      )}

      {/* Attempts Reconciliation Drawers */}
      <ExamReconciliationDrawers
        isOpen={reconciliationDrawerOpen}
        onClose={() => setReconciliationDrawerOpen(false)}
        reconciliationReport={reconciliationReport}
        students={students}
        batchStudentIds={batchStudentIds}
        activeBatch={activeBatch}
        onResolveDiscrepancy={async (res) => {
          await resolveExamAttemptDiscrepancy(res);
        }}
        toast={toast}
      />
    </AppShell>
  );
}

export default BatchManagement;
