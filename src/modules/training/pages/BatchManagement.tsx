import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TrainingBatchCarousel, type BatchAction } from '../components/TrainingBatchCarousel';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Card, SectionHeader, Badge, ProgressBar } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { useTraining } from '../hooks/useTraining';
import { STUDENT_REPOSITORY_TOKEN, ASSESSMENT_REPOSITORY_TOKEN, COLLEGE_REPOSITORY_TOKEN, type Batch } from '../training.repository';
import { normalizeStudentKey } from '../supabase-training.repository';
import type { Page, UUID } from '../../../core/types';
import { supabase } from '../../../shared/integration/supabase';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { usePermissions } from '../../../shared/permissions/react';
import { useAuth } from '../../auth/AuthProvider';
import { todayISO } from '../../../shared/utils/date';
import { DailyReportBuilderModal } from '../report/DailyReportBuilderModal';
import { DailyReportPreview } from '../report/DailyReportPreview';
import type { DailyReportConfig, DailyReportData } from '../report/daily-report.types';
import { useMemo } from 'react';
import { cleanBatchCode } from '../utils/batch-formatter';
import { calculateFinalExamEligibility } from '../utils/eligibility';
import { useDialog } from '../../../shared/feedback/DialogProvider';

// Workspace Navigation Tabs
type WorkspaceTab =
  | 'students'
  | 'mark-attendance'
  | 'final-exam'
  | 'retest'
  | 'registration'
  | 'attendance'
  | 'assessments'
  | 'certificates'
  | 'communication'
  | 'documents'
  | 'timeline';

export interface RegistrationRecord {
  timestamp: string;
  email: string;
  college: string;
  batch: string;
  registerNo: string;
  phone: string;
  name: string;
  gender: string;
  qualification: string;
  hasComputer: string;
  learnedBefore: string;
  certiportUser: string;
  photoUrl: string;
}

interface ChecklistItem {
  id: string;
  task: string;
  checked: boolean;
  assigned: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  commentsCount: number;
}

interface StudentRecord {
  id: string;
  name: string;
  photo: string;
  photoUrl?: string;
  phone: string;
  email: string;
  college: string;
  department: string;
  course?: string;
  examDate?: string;
  examAttemptCount?: number;
  attendancePct: number;
  attendanceStatus: 'Regular' | 'Irregular' | 'Critical';
  ass1: number;
  ass2: number;
  ass3: number;
  project: number;
  finalExam: number;
  overallScore: number;
  voucherId: string;
  retestVoucherId?: string;
  selectedVoucherId?: string;
  retestPaymentStatus?: 'Paid' | 'Pending';
  retestCollectedAmount?: number;
  retestApproved?: boolean;
  retestDate?: string;
  retestScore?: number;
  gender?: 'Male' | 'Female';
  qualification?: string;
  hasComputer?: 'Yes' | 'No';
  learnedBefore?: 'Yes' | 'No';
  voucherStatus: string;
  certificateStatus: string;
}

interface EmailHistoryItem {
  id: string;
  to: string;
  subject: string;
  sentAt: string;
  status: 'Delivered' | 'Pending' | 'Read';
}

interface DocumentItem {
  id: string;
  name: string;
  category: 'Material' | 'Report' | 'Receipt' | 'Certificate';
  uploadedAt: string;
  size: string;
}

export function BatchManagement() {
  const { confirm } = useDialog();
  const { can } = usePermissions();
  const { user } = useAuth();
  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const canCreateBatch = true;
  const canViewDailyReport = true;
  const { batches, courses, createBatch, updateBatch, students: dbStudents, enrollments, loading: batchesLoading, error: batchesError, refresh: refreshBatches, registerStudent, enrollStudent, removeEnrollment, removeBatch, getCertificateDelivery, saveCertificateDelivery, uploadCertificateReceipt, getCertificateReceiptUrl, logSessionAttendanceCell, updateSessionDate, updateSessionHour, deleteSessionColumn, issueVoucher, recordExamAttempt, updateStudentProfile, updateVoucherSentStatus, verifyRetestPayment, saveBatchEligibilityRules, resolveExamAttemptDiscrepancy, syncVoucher, syncExamAttempt } = useTraining({ fetchStudents: false });
  const { toast } = useNotifications();
  const [trainers, setTrainers] = useState<Employee[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  const batchStudentIds = useMemo(() => {
    return new Set(
      (enrollments || [])
        .filter((e) => e && e.batchId === selectedBatchId)
        .map((e) => e.studentId)
    );
  }, [enrollments, selectedBatchId]);
  const isExecutive = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('all');

  // Create Batch Modal State
  const [createBatchModalOpen, setCreateBatchModalOpen] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({
    code: '',
    selectedCourseId: '',
    trainingName: '',
    college: 'Christ Irinjalakkuda',
    collegeCourse: 'BCOM Self',
    academicYear: '2026-2027',
    batchName: 'Batch 2',
    coordinator: 'Prof. Anil Kumar',
    coordinatorEmail: 'anil@christcollege.edu',
    coordinator2: '',
    coordinatorEmail2: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    setNewBatchForm(prev => ({
      ...prev,
      code: `${prev.college} - ${prev.collegeCourse} - ${prev.academicYear} - ${prev.batchName}`
    }));
  }, [newBatchForm.college, newBatchForm.collegeCourse, newBatchForm.academicYear, newBatchForm.batchName]);

  const handleCreateBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchForm.code.trim()) return;

    const courseId = newBatchForm.selectedCourseId || courses[0]?.id;
    const selectedCourse = courses.find(c => c.id === courseId);
    const trainerId = trainers[0]?.id;

    // Both courseId and trainerId must be real UUIDs before sending to Supabase
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!courseId || !UUID_RE.test(courseId)) {
      toast({ variant: 'error', title: 'No Course Selected', message: 'Please select a valid course before creating a batch.' });
      return;
    }
    if (!trainerId || !UUID_RE.test(trainerId)) {
      toast({ variant: 'error', title: 'No Trainer Available', message: 'Please ensure at least one trainer employee exists before creating a batch.' });
      return;
    }

    const res = await createBatch({
      code: newBatchForm.code,
      trainingName: newBatchForm.trainingName || selectedCourse?.title || newBatchForm.code,
      college: newBatchForm.college,
      program: newBatchForm.collegeCourse || newBatchForm.trainingName || 'Computer Science & Analytics',
      courseId,
      trainerId,
      startDate: newBatchForm.startDate || undefined,
      endDate: newBatchForm.endDate || undefined,
      coordinator: newBatchForm.coordinator,
      coordinatorEmail: newBatchForm.coordinatorEmail,
      coordinator2: newBatchForm.coordinator2 || undefined,
      coordinatorEmail2: newBatchForm.coordinatorEmail2 || undefined,
      academicYear: newBatchForm.academicYear,
      batchNo: newBatchForm.batchName,
      phase: 'Scheduled',
    });


    if (res.ok) {
      toast({
        variant: 'success',
        title: 'Training Batch Created',
        message: `Batch "${newBatchForm.code}" created successfully.`,
      });
      setSelectedBatchId(res.value.id);
      setCreateBatchModalOpen(false);
      setNewBatchForm({
        code: '',
        selectedCourseId: '',
        trainingName: '',
        college: 'Christ Irinjalakkuda',
        collegeCourse: 'BCOM Self',
        academicYear: '2026-2027',
        batchName: 'Batch 2',
        coordinator: 'Prof. Anil Kumar',
        coordinatorEmail: 'anil@christcollege.edu',
        coordinator2: '',
        coordinatorEmail2: '',
        startDate: '',
        endDate: '',
      });
    } else {
      toast({
        variant: 'error',
        title: 'Failed to Create Batch',
        message: res.error,
      });
    }
  };

  // dailyReportFixture and dailyReportConfig states are defined lower down.

  // Batch selection - declared at the top of the component
  
  // Edit Batch modal state
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    selectedCourseId: '',
    trainingName: '',
    college: '',
    collegeCourse: '',
    program: '',
    batchNo: '',
    academicYear: '',
    trainerId: '',
    coordinator: '',
    coordinatorEmail: '',
    coordinator2: '',
    coordinatorEmail2: '',
    startDate: '',
    endDate: '',
  });

  const handleOpenEditBatch = (id: string) => {
    const target = batches.find((b) => b.id === id);
    setEditingBatchId(id);
    const resolvedProg = target?.program || (target as any)?.collegeCourse || (target as any)?.program_stream || (target as any)?.trainingName || '';
    setEditForm({
      selectedCourseId: target?.courseId || '',
      trainingName: target?.trainingName || target?.code || '',
      college: target?.college || '',
      collegeCourse: (target as any)?.collegeCourse || resolvedProg,
      program: resolvedProg,
      batchNo: target?.batchNo || (target?.code?.match(/Batch\s*\d+/i)?.[0]) || 'Batch 1',
      academicYear: target?.academicYear || '2026-2027',
      trainerId: target?.trainerId || '',
      coordinator: target?.coordinator || '',
      coordinatorEmail: target?.coordinatorEmail || '',
      coordinator2: target?.coordinator2 || '',
      coordinatorEmail2: target?.coordinatorEmail2 || '',
      startDate: target?.startDate || (target as any)?.start_date || '',
      endDate: target?.endDate || (target as any)?.end_date || '',
    });
  };

  const handleSaveEditBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatchId) return;

    const selectedCourse = courses.find((c) => c.id === editForm.selectedCourseId);
    const updatedCode = `${editForm.college} - ${editForm.program} - ${editForm.academicYear} - ${editForm.batchNo}`;

    const res = await updateBatch(editingBatchId as UUID, {
      code: updatedCode,
      courseId: editForm.selectedCourseId as UUID || undefined,
      trainingName: editForm.trainingName || selectedCourse?.title,
      college: editForm.college,
      program: editForm.program,
      batchNo: editForm.batchNo,
      academicYear: editForm.academicYear,
      trainerId: editForm.trainerId as UUID || undefined,
      coordinator: editForm.coordinator,
      coordinatorEmail: editForm.coordinatorEmail,
      coordinator2: editForm.coordinator2 || undefined,
      coordinatorEmail2: editForm.coordinatorEmail2 || undefined,
      startDate: editForm.startDate || undefined,
      endDate: editForm.endDate || undefined,
    } as any);

    if (res.ok) {
      toast({
        variant: 'success',
        title: 'Training Batch Updated',
        message: `Batch "${editForm.trainingName}" details successfully updated.`,
      });
      setEditingBatchId(null);
    } else {
      toast({
        variant: 'error',
        title: 'Update Failed',
        message: res.error,
      });
    }
  };

  const handleCopyBatch = async (batchId: string) => {
    const target = batches.find((b) => b.id === batchId);
    if (!target) return;

    const rawBatch = target.batchNo || target.code || '';
    const match = rawBatch.match(/Batch\s*(\d+)/i);
    let nextBatchNo = 'Batch 2';
    if (match) {
      nextBatchNo = `Batch ${parseInt(match[1], 10) + 1}`;
    }

    const cleanBaseCode = (target.code || '')
      .replace(/(\s*-\s*Copy|\s*\(Copy\))+/gi, '')
      .replace(/Batch\s*\d+/gi, nextBatchNo)
      .trim();

    const copyCode = cleanBaseCode || `${target.college || 'Batch'} - ${nextBatchNo}`;
    const copyBatchNo = nextBatchNo;
    const copyTrainingName = (target.trainingName || '')
      .replace(/(\s*-\s*Copy|\s*\(Copy\))+/gi, '')
      .trim() || copyCode;

    const newBatchPayload: Partial<Batch> = {
      code: copyCode,
      courseId: target.courseId,
      college: target.college,
      program: target.program || (target as any).collegeCourse || '',
      batchNo: copyBatchNo,
      trainingName: copyTrainingName,
      academicYear: target.academicYear || '2026-2027',
      trainerId: target.trainerId,
      coordinator: target.coordinator,
      coordinatorEmail: target.coordinatorEmail,
      coordinator2: target.coordinator2,
      coordinatorEmail2: target.coordinatorEmail2,
      startDate: target.startDate,
      endDate: target.endDate,
      phase: target.phase || 'Scheduled',
      capacity: target.capacity || 40,
      venue: target.venue || '',
      onlineLink: target.onlineLink || '',
    };

    const res = await createBatch(newBatchPayload);
    if (res.ok) {
      toast({
        variant: 'success',
        title: 'Training Details Card Copied',
        message: `Created duplicate batch: "${copyTrainingName}"`,
      });
      setSelectedBatchId(res.value.id);
    } else {
      toast({
        variant: 'error',
        title: 'Copy Failed',
        message: res.error,
      });
    }
  };

  /** Permanently delete a batch (Admin only). Removes from flwdsk_batches + all enrollments. */
  const handleDeleteBatch = async (batchId: string) => {
    const target = batches.find((b) => b.id === batchId);
    if (!target) return;
    const label = target.trainingName || target.code || batchId;
    const ok = await confirm({
      title: 'Delete Batch?',
      message: `Are you sure you want to permanently delete batch "${label}"?\n\nThis will also remove ALL student enrollments for this batch. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'delete',
    });
    if (!ok) return;
    try {
      const res = await removeBatch(batchId);
      if (!res.ok) throw new Error(res.error);

      // If deleted batch was selected, clear selection
      if (selectedBatchId === batchId) setSelectedBatchId(safeBatches.find((b) => b.id !== batchId)?.id ?? '');
      refreshBatches();
      toast({ variant: 'success', title: 'Batch Deleted', message: `"${label}" has been permanently deleted.` });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Delete Failed', message: err?.message || 'Could not delete the batch.' });
    }
  };

  // Tab control
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('students');

  // Full Page student table overlay
  const [showFullStudentReport, setShowFullStudentReport] = useState(false);

  // Email composer modal state
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailTo, setEmailTo] = useState('coordinator@christcollege.edu');
  const [emailBody, setEmailBody] = useState('');

  // Course Execution Checklist State per Stage (Configured in Course Catalog)
  const [checklist, setChecklist] = useState<Record<string, ChecklistItem[]>>({
    planning: [
      { id: 'c-1', task: 'College Confirmation Form Signed', checked: true, assigned: 'Operations Manager', dueDate: '2026-07-15', priority: 'High', commentsCount: 1 },
      { id: 'c-2', task: 'Trainer Assigned', checked: true, assigned: 'Academic Head', dueDate: '2026-07-16', priority: 'High', commentsCount: 0 },
      { id: 'c-3', task: 'Student Registry Uploaded', checked: true, assigned: 'Operations Executive', dueDate: '2026-07-20', priority: 'High', commentsCount: 0 },
    ],
    prep: [
      { id: 'c-4', task: 'Syllabus Dispatched', checked: true, assigned: 'Materials Dept', dueDate: '2026-07-18', priority: 'Medium', commentsCount: 2 },
      { id: 'c-5', task: 'Daily Sessions Logged', checked: true, assigned: 'Lead Trainer', dueDate: '2026-07-22', priority: 'High', commentsCount: 0 },
      { id: 'c-6', task: 'Final Report Generated', checked: true, assigned: 'Operations Lead', dueDate: '2026-07-25', priority: 'High', commentsCount: 1 },
    ],
    training: [
      { id: 'c-7', task: 'Certificates Dispatched', checked: true, assigned: 'Logistics Dept', dueDate: '2026-07-27', priority: 'Medium', commentsCount: 0 },
      { id: 'c-8', task: 'Signed Receipt Uploaded', checked: true, assigned: 'Field Co-ordinator', dueDate: '2026-07-28', priority: 'High', commentsCount: 0 },
    ],
  });

  // Certificate delivery per-student state
  const [certSelectedStudentId, setCertSelectedStudentId] = useState<string>('');
  const [certDeliveryDate, setCertDeliveryDate] = useState<string>('');
  const [certCollectedBy, setCertCollectedBy] = useState<string>('');
  const [certCount, setCertCount] = useState<string>('');
  const [certReceiptFile, setCertReceiptFile] = useState<File | null>(null);
  const [certReceiptPath, setCertReceiptPath] = useState<string>('');
  const [certSaving, setCertSaving] = useState(false);
  const [certUploading, setCertUploading] = useState(false);
  const [certRecord, setCertRecord] = useState<any>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certReceiptUrl, setCertReceiptUrl] = useState<string>('');

  // Modals & Action Handlers for Student Data Management
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    email: '',
    phone: '',
    college: '',
    department: '',
    attendancePct: 0,
    ass1: 0,
    ass2: 0,
    ass3: 0,
  });

  // Add Final Exam Student modal state
  const [addFinalExamModalOpen, setAddFinalExamModalOpen] = useState(false);
  const [newFinalExamStudentForm, setNewFinalExamStudentForm] = useState({
    name: '',
    phone: '',
    college: 'Christ University',
    course: 'Data Analytics',
    examDate: '2026-07-25',
    finalExam: 0,
    voucherId: '',
  });

  const handleAddFinalExamStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFinalExamStudentForm.name.trim()) return;

    const names = newFinalExamStudentForm.name.trim().split(' ');
    const firstName = names[0] || 'Student';
    const lastName = names.slice(1).join(' ') || '';

    const payload = {
      first_name: firstName,
      last_name: lastName,
      phone: newFinalExamStudentForm.phone || '+91 90000 00000',
      email: `${newFinalExamStudentForm.name.toLowerCase().replace(/\s+/g, '.')}@student.edu`,
      custom_fields: {
        college: newFinalExamStudentForm.college || 'Christ University',
        department: 'BCOM B',
        course: newFinalExamStudentForm.course,
        examDate: newFinalExamStudentForm.examDate,
        attendancePct: 0,
        attendanceStatus: 'Critical',
        ass1: 0,
        ass2: 0,
        ass3: 0,
        project: 0,
        finalExam: Number(newFinalExamStudentForm.finalExam) || 0,
        retestScore: Number(newFinalExamStudentForm.finalExam) || 0,
        overallScore: Number(newFinalExamStudentForm.finalExam) || 0,
        voucherId: newFinalExamStudentForm.voucherId || '',
        voucherStatus: newFinalExamStudentForm.voucherId ? 'Assigned' : '',
        certificateStatus: '',
        examAttemptCount: 1,
      }
    };

    try {
      const phone = newFinalExamStudentForm.phone || '+91 90000 00000';
      const repo = container.resolve(STUDENT_REPOSITORY_TOKEN);
      const existing = await repo.findByRegisterNo(phone);
      let studentId = '';

      if (existing) {
        studentId = existing.id;
        const res = await updateStudentProfile(studentId, {
          customFields: payload.custom_fields
        });
        if (!res.ok) throw new Error(res.error);
      } else {
        const res = await registerStudent({
          firstName,
          lastName,
          phone,
          email: `${newFinalExamStudentForm.name.toLowerCase().replace(/\s+/g, '.')}@student.edu`,
          customFields: payload.custom_fields,
        });
        if (res.ok) {
          studentId = res.value.id;
        } else {
          throw new Error(res.error);
        }
      }

      const newId = studentId || `s-${Date.now()}`;

      if (selectedBatchId && studentId) {
        const alreadyEnrolled = enrollments.some(e => e.batchId === selectedBatchId && e.studentId === studentId);
        if (!alreadyEnrolled) {
          await enrollStudent(studentId, selectedBatchId);
        }
      }

      const newStudent: StudentRecord = {
        id: newId,
        name: newFinalExamStudentForm.name,
        photo: '👨‍🎓',
        phone: newFinalExamStudentForm.phone || '+91 90000 00000',
        email: `${newFinalExamStudentForm.name.toLowerCase().replace(/\s+/g, '.')}@student.edu`,
        college: newFinalExamStudentForm.college || 'Christ University',
        department: 'BCOM B',
        course: newFinalExamStudentForm.course,
        examDate: newFinalExamStudentForm.examDate,
        attendancePct: 0,
        attendanceStatus: 'Critical',
        ass1: 0,
        ass2: 0,
        ass3: 0,
        project: 0,
        finalExam: Number(newFinalExamStudentForm.finalExam) || 0,
        retestScore: Number(newFinalExamStudentForm.finalExam) || 0,
        overallScore: Number(newFinalExamStudentForm.finalExam) || 0,
        voucherId: newFinalExamStudentForm.voucherId || '',
        voucherStatus: newFinalExamStudentForm.voucherId ? 'Assigned' : '',
        certificateStatus: '',
        examAttemptCount: 1,
      };

      setStudents((prev) => {
        const exists = prev.some((s) => s.id === newId);
        if (exists) {
          return prev.map((s) => (s.id === newId ? { ...s, ...newStudent } : s));
        }
        return [...prev, newStudent];
      });
      setAddFinalExamModalOpen(false);
      setNewFinalExamStudentForm({
        name: '',
        phone: '',
        college: 'Christ University',
        course: 'Data Analytics',
        closeReason: '',
        examDate: '2026-07-25',
        finalExam: 0,
        voucherId: '',
      } as any);
      
      toast({
        variant: 'success',
        title: 'Final Exam Student Added',
        message: `Student "${newStudent.name}" added to Final Exam registry and database successfully.`,
      });
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Failed to Add Student',
        message: err.message,
      });
    }
  };

  const handleAddFinalExamStudentRow = () => {
    const newId = `s-${Date.now()}`;
    const newStudent: StudentRecord = {
      id: newId,
      name: 'New Student',
      photo: '👨‍🎓',
      phone: '+91 98765 00000',
      email: 'new.student@student.edu',
      college: 'Christ University',
      department: 'BCOM B',
      course: 'Data Analytics',
      examDate: new Date().toISOString().split('T')[0],
      attendancePct: 0,
      attendanceStatus: 'Critical',
      ass1: 0,
      ass2: 0,
      ass3: 0,
      project: 0,
      finalExam: 0,
      retestScore: 0,
      overallScore: 0,
      voucherId: '',
      retestVoucherId: '',
      voucherStatus: '',
      certificateStatus: '',
      examAttemptCount: 1,
    };

    // Add to master students list AND the Final Exam ID list
    setStudents((prev) => [...prev, newStudent]);
    setFinalExamStudentIds((prev) => [...prev, newId]);
    toast({
      variant: 'success',
      title: 'New Student Row Added',
      message: 'Added a new student row to the Final Exam table. Edit fields directly inline.',
    });
  };

  const handleDeleteStudentRow = (studentId: string, studentName: string) => {
    // Only remove from Final Exam ID list — NOT from master students array
    // Performance Matrix (master table) retains all students
    setFinalExamStudentIds((prev) => prev.filter((id) => id !== studentId));
    toast({
      variant: 'info',
      title: 'Removed from Final Exam',
      message: `Removed "${studentName}" from Final Exam table. Student still exists in Performance Matrix.`,
    });
  };

  const [dbColleges, setDbColleges] = useState<any[]>([]);

  useEffect(() => {
    try {
      const repo = container.resolve(COLLEGE_REPOSITORY_TOKEN);
      repo.findMany({ pageSize: 1000, page: 1 }).then((p) => {
        if (p.data && p.data.length > 0) {
          setDbColleges(p.data);
        }
      });
    } catch {}
  }, []);

  const [examScheduleDates, setExamScheduleDates] = useState<Record<string, string>>({
    's-1': '2026-08-01',
    's-2': '2026-08-05',
    's-3': '2026-08-01',
    's-4': '2026-08-05',
  });

  // Hour-based Multi-Date Attendance Column Matrix State
  const [attendanceSessions, setAttendanceSessions] = useState<Array<{ id: string; date: string; hour: number }>>([
    { id: 'col-1', date: '2026-07-20', hour: 1 },
    { id: 'col-2', date: '2026-07-20', hour: 2 },
    { id: 'col-3', date: '2026-07-21', hour: 1 },
    { id: 'col-4', date: '2026-07-22', hour: 1 },
    { id: 'col-5', date: '2026-07-23', hour: 1 },
  ]);

  const [attendanceMatrix, setAttendanceMatrix] = useState<Record<string, Record<string, 'present' | 'absent' | 'late'>>>({
    's-1': { 'col-1': 'present', 'col-2': 'present', 'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
    's-2': { 'col-1': 'present', 'col-2': 'absent',  'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
    's-3': { 'col-1': 'present', 'col-2': 'present', 'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
    's-4': { 'col-1': 'absent',  'col-2': 'absent',  'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
  });

  // Load attendance sessions and status matrix from schedule_sessions
  useEffect(() => {
    if (!selectedBatchId) return;
    async function loadAttendanceFromDb() {
      try {
        const { data, error } = await supabase
          .from('flwdsk_schedule_sessions')
          .select('*')
          .eq('batch_id', selectedBatchId);
        
        if (!error && data && data.length > 0) {
          const sessionMap = new Map();
          const matrix: Record<string, Record<string, 'present' | 'absent' | 'late'>> = {};
          
          data.forEach((row: any) => {
            const dateStr = row.date;
            let hourVal = 1;
            if (row.session_title && row.session_title.startsWith('Hour ')) {
              hourVal = parseInt(row.session_title.replace('Hour ', ''), 10) || 1;
            }
            const sessKey = `${dateStr}-h${hourVal}`;
            
            sessionMap.set(sessKey, {
              id: sessKey,
              date: dateStr,
              hour: hourVal,
            });
            
            if (row.student_id && row.status) {
              if (!matrix[row.student_id]) {
                matrix[row.student_id] = {};
              }
              const normalizedStatus = row.status.toLowerCase();
              if (['present', 'absent', 'late'].includes(normalizedStatus)) {
                matrix[row.student_id][sessKey] = normalizedStatus as any;
              }
            }
          });
          
          if (sessionMap.size > 0) {
            setAttendanceSessions(Array.from(sessionMap.values()));
          }
          if (Object.keys(matrix).length > 0) {
            setAttendanceMatrix(matrix);
          }
        }
      } catch (e) {
        console.warn('Could not load attendance from schedule_sessions:', e);
      }
    }
    loadAttendanceFromDb();
  }, [selectedBatchId]);

  const saveAttendanceCellToDb = async (studentId: string, colId: string, status: string) => {
    const isRealUuid = studentId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
    if (!isRealUuid || !selectedBatchId) return;

    const col = attendanceSessions.find((c) => c.id === colId);
    if (!col) return;

    const sessionTitle = `Hour ${col.hour || 1}`;
    try {
      const res = await logSessionAttendanceCell(selectedBatchId, studentId, col.date, sessionTitle, status);
      if (!res.ok) {
        console.error('Failed to sync attendance cell:', res.error);
      }
    } catch (err) {
      console.warn('Failed to sync attendance cell:', err);
    }
  };

  const toggleSessionStatus = (studentId: string, colId: string, statusOverride?: 'present' | 'absent' | 'late') => {
    const studentSessions = attendanceMatrix[studentId] || {};
    const current = studentSessions[colId] || 'present';
    const nextStatus = statusOverride || (current === 'present' ? 'absent' : current === 'absent' ? 'late' : 'present');

    setAttendanceMatrix((prev) => {
      const sMap = prev[studentId] || {};
      const updatedSMap = { ...sMap, [colId]: nextStatus };
      const updatedMatrix = { ...prev, [studentId]: updatedSMap };

      // Calculate attendance % for this student across all attendanceSessions
      const total = attendanceSessions.length;
      const attended = attendanceSessions.filter((c) => (updatedSMap[c.id] || 'present') !== 'absent').length;
      const calcPct = Math.round((attended / total) * 100);

      setStudents((sList) =>
        sList.map((st) => {
          if (st.id === studentId) {
            const updated: StudentRecord = {
              ...st,
              attendancePct: calcPct,
              attendanceStatus: (!considerAttendance || calcPct >= attendanceThreshold) ? 'Regular' : 'Irregular',
            };
            saveStudentToDb(updated);
            return updated;
          }
          return st;
        })
      );

      return updatedMatrix;
    });

    saveAttendanceCellToDb(studentId, colId, nextStatus);
  };

  const handleUpdateSessionDate = async (colId: string, newDateVal: string) => {
    if (!newDateVal) return;
    const col = attendanceSessions.find((c) => c.id === colId);
    if (!col) return;
    const oldDate = col.date;
    const sessionTitle = `Hour ${col.hour || 1}`;

    setAttendanceSessions((prev) =>
      prev.map((c) => c.id === colId ? { ...c, date: newDateVal } : c)
    );

    if (selectedBatchId) {
      try {
        const res = await updateSessionDate(selectedBatchId, oldDate, newDateVal, sessionTitle);
        if (!res.ok) {
          console.error('Failed to sync session date update:', res.error);
        }
      } catch (err) {
        console.error('Failed to sync session date update:', err);
      }
    }
  };

  const handleUpdateSessionHour = async (colId: string, newHourVal: number) => {
    const col = attendanceSessions.find((c) => c.id === colId);
    if (!col) return;
    const oldHour = col.hour;
    const oldSessionTitle = `Hour ${oldHour || 1}`;
    const newSessionTitle = `Hour ${newHourVal}`;

    setAttendanceSessions((prev) =>
      prev.map((c) => c.id === colId ? { ...c, hour: newHourVal } : c)
    );

    if (selectedBatchId) {
      try {
        const res = await updateSessionHour(selectedBatchId, col.date, oldSessionTitle, newSessionTitle);
        if (!res.ok) {
          console.error('Failed to sync session hour update:', res.error);
        }
      } catch (err) {
        console.error('Failed to sync session hour update:', err);
      }
    }
  };

  const handleAddHourSessionColumn = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const sameDateCols = attendanceSessions.filter((c) => c.date === todayStr);
    const maxHour = sameDateCols.length > 0 ? Math.max(...sameDateCols.map((c) => c.hour)) : 0;
    const nextHour = maxHour + 1 > 8 ? 1 : maxHour + 1;

    const newColId = `col-${Date.now()}`;
    const newCol = { id: newColId, date: todayStr, hour: nextHour };

    setAttendanceSessions((prev) => [...prev, newCol]);
    toast({
      variant: 'success',
      title: 'Hour / Session Column Added',
      message: `Added new session column for ${todayStr} (Hour ${nextHour}).`,
    });
  };

  const handleDeleteSessionColumn = async (colId: string) => {
    if (attendanceSessions.length <= 1) {
      toast({
        variant: 'warning',
        title: 'Minimum Column Limit',
        message: 'At least 1 session column must remain in the matrix.',
      });
      return;
    }

    const col = attendanceSessions.find((c) => c.id === colId);
    if (!col) return;
    const sessionTitle = `Hour ${col.hour || 1}`;

    setAttendanceSessions((prev) => prev.filter((c) => c.id !== colId));

    if (selectedBatchId) {
      try {
        const res = await deleteSessionColumn(selectedBatchId, col.date, sessionTitle);
        if (!res.ok) {
          console.error('Failed to sync session column deletion:', res.error);
        }
      } catch (err) {
        console.error('Failed to sync session column deletion:', err);
      }
    }

    toast({
      variant: 'info',
      title: 'Session Column Deleted',
      message: 'Session column removed from attendance matrix.',
    });
  };

  const [uploadVoucherModalOpen, setUploadVoucherModalOpen] = useState(false);
  const [voucherSummary, setVoucherSummary] = useState<{
    totalRows: number;
    updated: number;
    invalidPhoneNumbers: number;
    missingStudents: number;
    duplicatePhoneNumbers: number;
    failedRows: number;
  } | null>(null);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkEmailType, setBulkEmailType] = useState<'Voucher Mail' | 'Congratulations' | 'Reminder' | 'Retest'>('Voucher Mail');
  const [bulkEmailTarget, setBulkEmailTarget] = useState<'selected' | 'eligible' | 'all'>('selected');
  const [bulkEmailSending, setBulkEmailSending] = useState(false);

  const handleSendBulkEmails = async () => {
    const list = filteredStudents;
    let recipients: StudentRecord[] = [];
    if (bulkEmailTarget === 'selected') {
      recipients = list.filter(s => selectedMatrixIds.has(s.id));
      if (recipients.length === 0) {
        toast({ variant: 'error', title: 'No Students Selected', message: 'Please select one or more student rows using checkboxes.' });
        return;
      }
    } else if (bulkEmailTarget === 'eligible') {
      recipients = list.filter(s => isStudentEligible(s));
    } else {
      recipients = list;
    }

    if (recipients.length === 0) {
      toast({ variant: 'info', title: 'No Recipients', message: 'No students matched the chosen criteria.' });
      return;
    }

    setBulkEmailSending(true);
    let sentCount = 0;
    try {
      for (const student of recipients) {
        const voucherVal = bulkEmailType === 'Retest' ? (student.retestVoucherId || 'Pending') : (student.voucherId || 'Pending');
        
        await supabase.from('flwdsk_email_logs').insert({
          student_id: student.id,
          batch_id: selectedBatchId || null,
          recipient: student.email || 'student@example.com',
          subject: `${bulkEmailType} for ${activeBatch?.trainingName || 'Course'}`,
          mail_type: bulkEmailType,
          status: 'Sent',
          sent_by: user?.id || null
        });

        if (bulkEmailType === 'Voucher Mail' && student.voucherId) {
          const { data: v } = await supabase.from('flwdsk_vouchers').select('id').eq('student_id', student.id).eq('voucher_type', 'Initial').maybeSingle();
          if (v) {
            await updateVoucherSentStatus(v.id, 'Sent');
          }
        } else if (bulkEmailType === 'Retest' && student.retestVoucherId) {
          const { data: v } = await supabase.from('flwdsk_vouchers').select('id').eq('student_id', student.id).eq('voucher_type', 'Retest').maybeSingle();
          if (v) {
            await updateVoucherSentStatus(v.id, 'Sent');
          }
        }

        await supabase.from('flwdsk_audit_logs').insert({
          action: 'Email Dispatch',
          entity_type: 'students',
          entity_id: student.id,
          new_value: { mailType: bulkEmailType, voucher: voucherVal },
          reason: 'Bulk notification'
        });

        sentCount++;
      }

      toast({
        variant: 'success',
        title: 'Bulk Email Dispatched',
        message: `Successfully processed and dispatched ${sentCount} "${bulkEmailType}" emails.`,
      });
      setBulkEmailOpen(false);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Dispatch Failed', message: err.message });
    }
    setBulkEmailSending(false);
  };

  const [studentSubTab, setStudentSubTab] = useState<'matrix' | 'attendance' | 'final-exam' | 'retest' | 'registration' | 'certificates'>('matrix');
  const [registrationRecords, setRegistrationRecords] = useState<RegistrationRecord[]>([]);
  const [registrationSearchQuery, setRegistrationSearchQuery] = useState('');

  // --- Performance Matrix: Filter, Sort, Eligibility Config ---
  type EligibilityFilter = 'all' | 'eligible' | 'not-eligible';
  type SortableCol = 'ass1' | 'ass2' | 'ass3' | 'finalExam' | 'attendancePct';
  interface SortLevel { col: SortableCol; dir: 'asc' | 'desc' }
  interface EligibilityCriterion { assessment: SortableCol; threshold: number }

  const [matrixEligFilter, setMatrixEligFilter] = useState<EligibilityFilter>('all');
  const [matrixSortLevels, setMatrixSortLevels] = useState<SortLevel[]>([]);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showEligibilityPanel, setShowEligibilityPanel] = useState(false);

  // Attendance config
  const [considerAttendance, setConsiderAttendance] = useState(false);
  const [attendanceThreshold, setAttendanceThreshold] = useState(84);
  const [assessmentPassPercentage, setAssessmentPassPercentage] = useState(84);
  const [selectedAttemptTypes, setSelectedAttemptTypes] = useState<Record<string, 'Initial' | 'Retest' | ''>>({});

  interface ReconciledStudentState {
    studentId: string;
    batchId: string;
    testAttemptMark: number | null;
    retestAttemptMark: number | null;
    cachedTestScore: number;
    cachedRetestScore: number;
    testStatus: 'MATCHED' | 'ATTEMPT_ONLY' | 'LEGACY_ONLY' | 'CONFLICT' | 'AMBIGUOUS_ZERO' | 'CONFIRMED_ZERO_ATTEMPT' | 'DUPLICATE_ATTEMPT';
    retestStatus: 'MATCHED' | 'ATTEMPT_ONLY' | 'LEGACY_ONLY' | 'CONFLICT' | 'AMBIGUOUS_ZERO' | 'CONFIRMED_ZERO_ATTEMPT' | 'DUPLICATE_ATTEMPT';
    conflict: boolean;
    duplicate: boolean;
  }

  const [reconciliationReport, setReconciliationReport] = useState<Record<string, ReconciledStudentState>>({});
  const [reconciliationDrawerOpen, setReconciliationDrawerOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'MATCHED' | 'ATTEMPT_ONLY' | 'LEGACY_ONLY' | 'CONFLICT' | 'AMBIGUOUS_ZERO' | 'CONFIRMED_ZERO_ATTEMPT' | 'DUPLICATE_ATTEMPT'>('ALL');

  const [resolvingDiscrepancy, setResolvingDiscrepancy] = useState<{
    studentId: string;
    studentName: string;
    attemptType: 'Initial' | 'Retest';
    category: 'CONFLICT' | 'ATTEMPT_ONLY' | 'LEGACY_ONLY' | 'DUPLICATE_ATTEMPT';
    dbMark: number | null;
    cacheMark: number;
    duplicateAttemptsList?: any[];
  } | null>(null);

  const [resolutionAction, setResolutionAction] = useState<'SYNC_TO_CACHE' | 'CREATE_LOG' | 'USE_LOG_SCORE' | 'USE_CACHE_SCORE' | 'KEEP_SELECTED_DUPLICATE' | ''>('');
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string>('');
  const [resolutionReason, setResolutionReason] = useState<string>('');
  const [resolutionConfirmState, setResolutionConfirmState] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [isSavingResolution, setIsSavingResolution] = useState<boolean>(false);

  // Course Maximum Marks & Pass % Criteria (editable, default 100 max, 70%)
  const [courseMaxMarks, setCourseMaxMarks] = useState<number>(100);
  const [coursePassPct, setCoursePassPct] = useState<number>(70);

  // Load eligibility config from database with localStorage fallback on batch change
  useEffect(() => {
    if (!selectedBatchId) return;

    let isMounted = true;

    async function loadConfig() {
      try {
        const { data, error } = await supabase
          .from('flwdsk_batch_eligibility_rules')
          .select('*')
          .eq('batch_id', selectedBatchId)
          .maybeSingle();

        if (error) {
          console.warn('Error loading eligibility rules from DB:', error.message);
        }

        if (data) {
          // Found in database, this is the source of truth!
          if (!isMounted) return;
          setConsiderAttendance(data.consider_attendance);
          setAttendanceThreshold(data.attendance_pass_percentage);
          setAssessmentPassPercentage(data.assessment_pass_percentage);
          if (Array.isArray(data.eligibility_criteria)) {
            const clean: EligibilityCriterion[] = data.eligibility_criteria
              .filter((c: any) => c && c.assessment && c.assessment !== 'finalExam')
              .map((c: any) => ({
                assessment: c.assessment as SortableCol,
                threshold: Number(c.threshold !== undefined ? c.threshold : data.assessment_pass_percentage)
              }));
            setEligibilityCriteria(clean);
          }
        } else {
          // Fallback to localStorage
          const saved = localStorage.getItem(`kvj_eligibility_config_${selectedBatchId}`);
          let loadedConsiderAttendance = false;
          let loadedAttendanceThreshold = 84;
          let loadedCriteria: EligibilityCriterion[] = [
            { assessment: 'ass1', threshold: 84 },
            { assessment: 'ass2', threshold: 84 },
            { assessment: 'ass3', threshold: 84 },
          ];

          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (typeof parsed.considerAttendance === 'boolean') {
                loadedConsiderAttendance = parsed.considerAttendance;
              }
              if (typeof parsed.attendanceThreshold === 'number') {
                loadedAttendanceThreshold = parsed.attendanceThreshold;
              }
              if (Array.isArray(parsed.eligibilityCriteria)) {
                loadedCriteria = parsed.eligibilityCriteria
                  .filter((c: any) => c && c.assessment && c.assessment !== 'finalExam')
                  .map((c: any) => ({
                    assessment: c.assessment as SortableCol,
                    threshold: Number(c.threshold || 0)
                  }));
              }
            } catch (jsonErr) {
              console.warn('Failed to parse localStorage config', jsonErr);
            }
          }

          if (!isMounted) return;
          setConsiderAttendance(loadedConsiderAttendance);
          setAttendanceThreshold(loadedAttendanceThreshold);
          setAssessmentPassPercentage(84);
          setEligibilityCriteria(loadedCriteria);

          // Initialize DB row
          const initRes = await saveBatchEligibilityRules(
            selectedBatchId,
            loadedConsiderAttendance,
            loadedAttendanceThreshold,
            84,
            loadedCriteria
          );

          if (!initRes.ok) {
            console.error('Failed to auto-initialize DB eligibility rules:', initRes.error);
          }
        }
      } catch (err) {
        console.error('Error in loadConfig flow:', err);
      }
    }

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, [selectedBatchId]);

  const saveEligibilityConfig = async (
    cAttendance: boolean,
    aThreshold: number,
    criteria: EligibilityCriterion[]
  ) => {
    if (!selectedBatchId) return;
    try {
      const res = await saveBatchEligibilityRules(
        selectedBatchId,
        cAttendance,
        aThreshold,
        assessmentPassPercentage,
        criteria
      );

      if (!res.ok) {
        console.error('Failed to save eligibility config to DB:', res.error);
      }
    } catch (e) {
      console.warn('Failed to save eligibility config', e);
    }
  };

  const [importProgress, setImportProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // Convert Google Drive open URL or view link to direct viewable image URL
  const convertDriveUrlToDirectImg = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.includes('lh3.googleusercontent.com') || trimmed.includes('images.weserv.nl')) return trimmed;
    const match = trimmed.match(/[?&]id=([^&]+)/) || trimmed.match(/\/d\/([^/]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    return trimmed;
  };

  // Robust CSV Parser
  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/);
    const result: string[][] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const row: string[] = [];
      let insideQuote = false;
      let entry = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (insideQuote && line[i + 1] === '"') {
            entry += '"';
            i++;
          } else {
            insideQuote = !insideQuote;
          }
        } else if (char === ',' && !insideQuote) {
          row.push(entry.trim());
          entry = '';
        } else {
          entry += char;
        }
      }
      row.push(entry.trim());
      result.push(row);
    }
    return result;
  };

  // Google Sheet sync removed — data is managed manually.

  /**
   * Load assessment scores from the flwdsk_assessments DB table.
   * Maps assessment records back to StudentRecord fields:
   *   Assignment / ModuleTest (by order) → ass1, ass2, ass3
   *   MockTest                           → project
   *   FinalExam                          → finalExam
   */
  const loadAssessmentsFromDb = async () => {
    if (!selectedBatchId || enrollmentsRef.current.length === 0) return;

    const batchEnrollments = enrollmentsRef.current.filter(
      (e) => e.batchId === selectedBatchId
    );
    if (batchEnrollments.length === 0) return;

    try {
      const assessmentRepo = container.resolve(ASSESSMENT_REPOSITORY_TOKEN);
      const enrollmentIds = batchEnrollments.map((e) => e.id);
      const allAssessments = await assessmentRepo.findByBatch(enrollmentIds);

      if (allAssessments.length === 0) return;

      // Group assessments by enrollmentId
      const byEnrollment = new Map<string, typeof allAssessments>();
      for (const a of allAssessments) {
        const arr = byEnrollment.get(a.enrollmentId) ?? [];
        arr.push(a);
        byEnrollment.set(a.enrollmentId, arr);
      }

      // Build enrollmentId → studentId lookup
      const enrollmentToStudent = new Map(
        batchEnrollments.map((e) => [e.id, e.studentId])
      );

      setStudents((prev) =>
        prev.map((student) => {
          // Find this student's enrollment in the active batch
          const enrollment = batchEnrollments.find(
            (e) => e.studentId === student.id
          );
          if (!enrollment) return student;

          const recs = byEnrollment.get(enrollment.id);
          if (!recs || recs.length === 0) return student;

          // Sort by createdAt so we assign ass1/ass2/ass3 in chronological order
          const sorted = [...recs].sort((a, b) =>
            (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
          );

          let ass1 = student.ass1;
          let ass2 = student.ass2;
          let ass3 = student.ass3;
          let project = student.project;
          let finalExam = student.finalExam;

          const assignments = sorted.filter(
            (r) => r.type === 'Assignment' || r.type === 'ModuleTest'
          );
          if (assignments[0]) ass1 = assignments[0].marksObtained ?? ass1;
          if (assignments[1]) ass2 = assignments[1].marksObtained ?? ass2;
          if (assignments[2]) ass3 = assignments[2].marksObtained ?? ass3;

          const mockTests = sorted.filter((r) => r.type === 'MockTest');
          if (mockTests[0]) project = mockTests[0].marksObtained ?? project;

          const finalExams = sorted.filter((r) => r.type === 'FinalExam');
          if (finalExams[0]) finalExam = finalExams[0].marksObtained ?? finalExam;

          const overallScore = Math.round(
            (ass1 + ass2 + ass3 + project + finalExam) / 5
          );

          return { ...student, ass1, ass2, ass3, project, finalExam, overallScore };
        })
      );
    } catch (err) {
      console.warn('Failed to load assessments from DB:', err);
    }
  };

  // Load assessment scores from DB whenever the active batch or enrollments change
  useEffect(() => {
    if (!selectedBatchId) return;
    loadAssessmentsFromDb();
  }, [selectedBatchId, enrollments]);

  // Active student ID for displaying course completion checklist popover
  const [activeChecklistStudentId, setActiveChecklistStudentId] = useState<string | null>(null);

  // Assessment eligibility criteria rows
  const [eligibilityCriteria, setEligibilityCriteria] = useState<EligibilityCriterion[]>([
    { assessment: 'ass1', threshold: 84 },
    { assessment: 'ass2', threshold: 84 },
    { assessment: 'ass3', threshold: 84 },
  ]);

  const allSortableCols: SortableCol[] = ['ass1', 'ass2', 'ass3', 'finalExam', 'attendancePct'];
  const assessmentLabelMap: Record<SortableCol, string> = {
    ass1: 'Assessment 1',
    ass2: 'Assessment 2',
    ass3: 'Assessment 3',
    finalExam: 'Final Exam',
    attendancePct: 'Attendance %',
  };

  // --- Sort Panel Handlers ---
  const handleAddSortLevel = () => {
    const usedCols = matrixSortLevels.map((l) => l.col);
    const nextCol = allSortableCols.find((c) => !usedCols.includes(c));
    if (nextCol) setMatrixSortLevels((prev) => [...prev, { col: nextCol, dir: 'asc' }]);
  };
  const handleRemoveSortLevel = (idx: number) => {
    setMatrixSortLevels((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleUpdateSortLevel = (idx: number, field: 'col' | 'dir', value: string) => {
    setMatrixSortLevels((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  // --- Eligibility Criteria Handlers ---
  const handleAddEligCriterion = () => {
    const usedAssess = eligibilityCriteria.map((c) => c.assessment);
    const nextAssess = (['ass1', 'ass2', 'ass3'] as SortableCol[]).find((a) => !usedAssess.includes(a));
    if (nextAssess) {
      const nextCriteria = [...eligibilityCriteria, { assessment: nextAssess, threshold: assessmentPassPercentage }];
      setEligibilityCriteria(nextCriteria);
      saveEligibilityConfig(considerAttendance, attendanceThreshold, nextCriteria);
    }
  };
  const handleRemoveEligCriterion = (idx: number) => {
    const nextCriteria = eligibilityCriteria.filter((_, i) => i !== idx);
    setEligibilityCriteria(nextCriteria);
    saveEligibilityConfig(considerAttendance, attendanceThreshold, nextCriteria);
  };
  const handleUpdateEligCriterion = (idx: number, field: 'assessment' | 'threshold', value: string | number) => {
    const nextCriteria = eligibilityCriteria.map((c, i) => i === idx ? { ...c, [field]: value } : c);
    setEligibilityCriteria(nextCriteria);
    saveEligibilityConfig(considerAttendance, attendanceThreshold, nextCriteria);
  };

  // Compute eligibility using the shared engine
  const isStudentEligible = (s: StudentRecord) => {
    const rules = {
      consider_attendance: considerAttendance,
      attendance_pass_percentage: attendanceThreshold,
      eligibility_criteria: eligibilityCriteria
    };
    return calculateFinalExamEligibility(s, rules).eligible;
  };

  const getEligibilityReason = (s: StudentRecord) => {
    const rules = {
      consider_attendance: considerAttendance,
      attendance_pass_percentage: attendanceThreshold,
      eligibility_criteria: eligibilityCriteria
    };
    const res = calculateFinalExamEligibility(s, rules);
    return res.eligible ? '' : res.reason;
  };



  // Download 3-Field Voucher Template CSV (Phone Number, Name, Voucher ID)
  const downloadVoucherTemplate = () => {
    const csvHeader = "Phone Number,Name,Voucher ID\n";
    const rows = students
      .filter((s) => !selectedBatchId || batchStudentIds.has(s.id))
      .map((s) => `"${s.phone}","${s.name}","${s.voucherId || ''}"`)
      .join("\n");
    
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvHeader + rows);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Student_Voucher_ID_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      variant: 'success',
      title: '3-Field Voucher Template Downloaded',
      message: 'Student_Voucher_ID_Template.csv containing Phone Number, Name, and Voucher ID downloaded.',
    });
  };

  const handleVoucherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportProgress({ current: 0, total: 100, message: 'Reading file...' });
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const parsed = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

          if (parsed.length <= 1) {
            toast({ variant: 'error', title: 'Empty Sheet', message: 'The uploaded file contains no data rows.' });
            setImportProgress(null);
            return;
          }

          const headerRow = parsed[0].map(h => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
          const phoneIdx = headerRow.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('number'));
          const voucherIdx = headerRow.findIndex(h => h.includes('voucher') || h.includes('vouch'));

          if (voucherIdx === -1 || phoneIdx === -1) {
            toast({
              variant: 'error',
              title: 'Invalid Spreadsheet Format',
              message: 'Spreadsheet must contain "Phone Number" and "Voucher ID" columns.',
            });
            setImportProgress(null);
            return;
          }

          let updatedCount = 0;
          let invalidPhones = 0;
          let missingStudents = 0;
          let duplicatePhones = 0;
          let failedRows = 0;
          const totalRows = parsed.length - 1;

          const updatedStudents = [...students];
          const seenPhones = new Set<string>();

          for (let i = 1; i < parsed.length; i++) {
            const row = parsed[i];
            if (!row || row.length === 0) continue;

            const rawPhone = String(row[phoneIdx] || '').trim();
            const filePhone = normalizeStudentKey(rawPhone);
            const fileVoucher = String(row[voucherIdx] || '').trim();

            if (!rawPhone || !filePhone || filePhone.length < 10) {
              invalidPhones++;
              failedRows++;
              continue;
            }

            if (seenPhones.has(filePhone)) {
              duplicatePhones++;
              failedRows++;
              continue;
            }
            seenPhones.add(filePhone);

            if (!fileVoucher) {
              failedRows++;
              continue;
            }

            const sIdx = updatedStudents.findIndex(st => normalizeStudentKey(st.phone) === filePhone);

            if (sIdx === -1) {
              missingStudents++;
              failedRows++;
              continue;
            }

            try {
              const res = await issueVoucher(updatedStudents[sIdx].id, selectedBatchId, fileVoucher, 'Initial');
              if (res.ok) {
                const updated = {
                  ...updatedStudents[sIdx],
                  voucherId: fileVoucher,
                  voucherStatus: 'Assigned',
                };
                updatedStudents[sIdx] = updated;
                updatedCount++;
              } else {
                console.error(`Failed to assign voucher to student ${filePhone}:`, res.error);
                failedRows++;
              }
            } catch (err) {
              console.error('Failed to update student:', err);
              failedRows++;
            }
          }

          setStudents(updatedStudents);
          setVoucherSummary({
            totalRows,
            updated: updatedCount,
            invalidPhoneNumbers: invalidPhones,
            missingStudents,
            duplicatePhoneNumbers: duplicatePhones,
            failedRows
          });
          setUploadVoucherModalOpen(false);
          setImportProgress(null);
        } catch (err: any) {
          setImportProgress(null);
          toast({ variant: 'error', title: 'Parsing Failed', message: err.message });
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setImportProgress(null);
      toast({ variant: 'error', title: 'Upload Failed', message: err.message });
    }
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parts = newStudentForm.name.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || 'Student';

    const eligible = !considerAttendance || Number(newStudentForm.attendancePct) >= attendanceThreshold;
    const finalCollege = activeBatch?.college || 'Christ College';
    const finalDept = activeBatch?.program || 'BBA';

    const customFields = {
      college: finalCollege,
      department: finalDept,
      attendancePct: Number(newStudentForm.attendancePct),
      attendanceStatus: (!considerAttendance || Number(newStudentForm.attendancePct) >= attendanceThreshold) ? 'Regular' : 'Irregular',
      ass1: Number(newStudentForm.ass1),
      ass2: Number(newStudentForm.ass2),
      ass3: Number(newStudentForm.ass3),
      project: 0,
      finalExam: 0,
      overallScore: Math.round((Number(newStudentForm.ass1) + Number(newStudentForm.ass2) + Number(newStudentForm.ass3)) / 3),
      voucherId: eligible ? `VOUCH-CHRIST-${Math.floor(100 + Math.random() * 900)}` : '',
      voucherStatus: eligible ? 'Assigned' : 'Unassigned',
      certificateStatus: 'Pending',
    };

    const phone = newStudentForm.phone || '+91 90000 00000';
    const email = newStudentForm.email || `${newStudentForm.name.toLowerCase().replace(/\s+/g, '.')}@student.edu`;

    const repo = container.resolve(STUDENT_REPOSITORY_TOKEN);
    const existing = await repo.findByRegisterNo(phone);
    let studentId = '';

    if (existing) {
      studentId = existing.id;
      const alreadyEnrolled = enrollments.some(e => e.batchId === selectedBatchId && e.studentId === studentId);
      if (alreadyEnrolled) {
        toast({
          variant: 'warning',
          title: 'Already Enrolled',
          message: `Student with phone "${phone}" is already enrolled in this batch.`,
        });
        setAddStudentModalOpen(false);
        return;
      }
    } else {
      const res = await registerStudent({
        firstName,
        lastName,
        phone,
        email,
        customFields,
      });
      if (res.ok) {
        studentId = res.value.id;
      } else {
        toast({
          variant: 'error',
          title: 'Student Creation Failed',
          message: res.error,
        });
        return;
      }
    }

    if (studentId) {
      const alreadyEnrolled = enrollments.some(e => e.batchId === selectedBatchId && e.studentId === studentId);
      if (!alreadyEnrolled && selectedBatchId) {
        await enrollStudent(studentId, selectedBatchId);
      }

      const newStudent: StudentRecord = {
        id: studentId,
        name: newStudentForm.name,
        photo: '👨‍🎓',
        phone: phone,
        email: email,
        college: finalCollege,
        department: finalDept,
        attendancePct: Number(newStudentForm.attendancePct),
        attendanceStatus: (!considerAttendance || Number(newStudentForm.attendancePct) >= attendanceThreshold) ? 'Regular' : 'Irregular',
        ass1: Number(newStudentForm.ass1),
        ass2: Number(newStudentForm.ass2),
        ass3: Number(newStudentForm.ass3),
        project: 0,
        finalExam: 0,
        overallScore: Math.round((Number(newStudentForm.ass1) + Number(newStudentForm.ass2) + Number(newStudentForm.ass3)) / 3),
        voucherId: customFields.voucherId,
        voucherStatus: customFields.voucherStatus,
        certificateStatus: 'Pending',
      };

      const alreadyInState = students.some(s => s.id === studentId);
      if (!alreadyInState) {
        setStudents((prev) => [...prev, newStudent]);
      }
      refreshBatches();
      toast({
        variant: 'success',
        title: 'Student Record Added',
        message: `Student "${newStudent.name}" registered and enrolled successfully.`,
      });
    }

    setAddStudentModalOpen(false);
    setNewStudentForm({
      name: '',
      email: '',
      phone: '',
      college: '',
      department: '',
      attendancePct: 0,
      ass1: 0,
      ass2: 0,
      ass3: 0,
    });
  };

  // ── Update Final Exam marks from an Excel/CSV file (matched by phone) ──
  const examMarkFileRef = useRef<HTMLInputElement>(null);
  const handleExamMarkUpload = async (file: File) => {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (rows.length < 2) {
            toast({ variant: 'error', title: 'Empty File', message: 'The file has no data rows.' });
            return;
          }
          const header = (rows[0] || []).map((h) => String(h ?? '').toLowerCase().trim());
          const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('register') || h.includes('mobile') || h.includes('number'));
          const markIdx = header.findIndex((h) => h.includes('mark') || h.includes('score') || h.includes('final') || h.includes('result'));
          if (phoneIdx === -1 || markIdx === -1) {
            toast({ variant: 'error', title: 'Columns Not Found', message: 'The file needs a "Phone" column and a "Mark" (final exam mark) column.' });
            return;
          }

          // Build phone → mark map from the sheet.
          const markMap = new Map<string, number>();
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i] || [];
            const key = normalizeStudentKey(r[phoneIdx]);
            const mark = Number(r[markIdx]);
            if (key && !isNaN(mark)) markMap.set(key, mark);
          }
          if (markMap.size === 0) {
            toast({ variant: 'error', title: 'No Valid Rows', message: 'No rows had a valid phone number and numeric mark.' });
            return;
          }

          // Fetch existing attempts for this batch to determine attempt type and handle duplicates/idempotency
          const { data: batchAttempts, error: attemptsErr } = await supabase
            .from('flwdsk_exam_attempts')
            .select('*')
            .eq('batch_id', selectedBatchId)
            .is('deleted_at', null);

          if (attemptsErr) throw attemptsErr;

          let successCount = 0;
          let skipCount = 0;
          let warningCount = 0;

          const updatedStudents = [...students];

          for (const st of students) {
            if (!batchStudentIds.has(st.id)) continue;
            const key = normalizeStudentKey(st.phone);
            if (!markMap.has(key)) continue;

            const mark = markMap.get(key)!;
            const studentAttempts = batchAttempts?.filter(a => a.student_id === st.id) || [];
            
            // Determine attempt type: if 'Initial' already exists, it is a Retest
            const hasInitial = studentAttempts.some(a => a.attempt_type === 'Initial');
            const attemptType = hasInitial ? 'Retest' : 'Initial';

            // Duplicate safety / Idempotency check:
            // If the same attempt score is already recorded, skip to prevent duplicate updates.
            const existingAttempt = studentAttempts.find(a => a.attempt_type === attemptType);
            if (existingAttempt && existingAttempt.mark === mark) {
              skipCount++;
              continue;
            }

            try {
              const res = await recordExamAttempt(
                st.id,
                selectedBatchId,
                attemptType,
                mark,
                null,
                null,
                'Trainer CSV Import'
              );

              if (res.ok) {
                const currentFields = (st as any).custom_fields || {};
                const updatedFields = {
                  ...currentFields,
                  ...(attemptType === 'Initial'
                    ? {
                        finalExam: mark,
                        // Pass threshold scaled to the course's mark scale.
                        finalExamResult: mark >= Math.round((coursePassPct / 100) * (courseMaxMarks || 100)) ? 'Passed' : 'Failed',
                        examAttemptCount: 1
                      }
                    : {
                        retestScore: mark,
                        examAttemptCount: 2
                      })
                };

                const stIdx = updatedStudents.findIndex(s => s.id === st.id);
                if (stIdx !== -1) {
                  updatedStudents[stIdx] = {
                    ...st,
                    finalExam: attemptType === 'Initial' ? mark : st.finalExam,
                    retestScore: attemptType === 'Retest' ? mark : st.retestScore,
                    custom_fields: updatedFields
                  } as any;
                }
                successCount++;
              } else {
                console.error('Failed to sync CSV record for student:', st.id, res.error);
                warningCount++;
              }
            } catch (err) {
              console.error('Failed to sync CSV record for student:', st.id, err);
              warningCount++;
            }
          }

          setStudents(updatedStudents);

          if (successCount > 0) {
            toast({
              variant: 'success',
              title: 'CSV Import Completed',
              message: `Successfully processed ${successCount} marks. Skipped ${skipCount} identical records. Warnings/failures: ${warningCount}.`
            });
            setRefreshTrigger(prev => prev + 1);
          } else if (skipCount > 0) {
            toast({
              variant: 'info',
              title: 'No Updates Found',
              message: `Skipped ${skipCount} records because they are already in sync with the database.`
            });
          } else {
            toast({
              variant: 'error',
              title: 'CSV Import Failed',
              message: 'No marks could be processed successfully.'
            });
          }
        } catch (err: any) {
          toast({ variant: 'error', title: 'Parsing Failed', message: err?.message || 'Could not read the file.' });
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Upload Failed', message: err?.message || 'Could not read the file.' });
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    toast({
      variant: 'info',
      title: 'Importing Student Roster',
      message: `Reading Name & Phone from "${file.name}"...`,
    });

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const parsed: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          if (parsed.length <= 1) {
            toast({ variant: 'error', title: 'Upload Failed', message: 'The spreadsheet is empty or has only a header row.' });
            return;
          }

          const headerRow = parsed[0].map((h: any) => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
          const nameIdx  = headerRow.findIndex((h: string) => h.includes('name') || h.includes('student'));
          const phoneIdx = headerRow.findIndex((h: string) => h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('number'));

          if (nameIdx === -1) {
            toast({
              variant: 'error',
              title: 'Missing "Name" Column',
              message: 'Your Excel must have a "Name" column. Phone is strongly recommended as the student key.',
            });
            return;
          }

          let importedCount = 0;
          const newStudentsList: StudentRecord[] = [];
          const totalRows = parsed.length - 1;
          const processedPhones = new Set<string>();

          for (let i = 1; i < parsed.length; i++) {
            const row = parsed[i];
            if (!row || row.length === 0) continue;

            const name = String(row[nameIdx] || '').trim();
            if (!name) continue;

            // Use phone as primary key; generate a unique placeholder if absent
            const rawPhone = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '';
            const phone = rawPhone || `0000000${String(i).padStart(3, '0')}`;
            const normalizedPhone = normalizeStudentKey(phone);

            if (processedPhones.has(normalizedPhone)) continue;
            processedPhones.add(normalizedPhone);

            // Skip if already enrolled in this batch
            const alreadyInBatch = studentsRef.current.some(
              (s) => normalizeStudentKey(s.phone) === normalizedPhone && batchStudentIds.has(s.id)
            );
            if (alreadyInBatch) continue;

            setImportProgress({
              current: i,
              total: totalRows,
              message: `Registering ${name} (${i} of ${totalRows})...`,
            });

            const names = name.split(' ');
            const firstName = names[0] || 'Student';
            const lastName = names.slice(1).join(' ') || '';

            // Minimal customFields — scores & details will be loaded from DB/Sheet later
            const customFields = {
              college: activeBatchRef.current?.college || '',
              department: activeBatchRef.current?.program || '',
              attendancePct: 100,
              attendanceStatus: 'Regular',
              ass1: 0, ass2: 0, ass3: 0, project: 0, finalExam: 0, overallScore: 0,
              voucherId: '', voucherStatus: 'Unassigned', certificateStatus: 'Pending',
            };

            const repo = container.resolve(STUDENT_REPOSITORY_TOKEN);
            const existing = await repo.findByRegisterNo(phone);
            let studentId = '';

            if (existing) {
              studentId = existing.id;
            } else {
              const res = await registerStudent({
                firstName,
                lastName,
                phone,
                email: `${firstName.toLowerCase()}.${lastName.toLowerCase() || 'student'}@student.edu`,
                customFields,
              });
              if (res.ok) studentId = res.value.id;
            }

            if (studentId) {
              const alreadyEnrolled = enrollmentsRef.current.some(
                (e) => e.batchId === selectedBatchId && e.studentId === studentId
              );
              if (!alreadyEnrolled && selectedBatchId) {
                await enrollStudent(studentId, selectedBatchId);
              }

              newStudentsList.push({
                id: studentId,
                name,
                photo: '👨‍🎓',
                photoUrl: undefined,
                phone,
                email: '',
                college: activeBatchRef.current?.college || '',
                department: activeBatchRef.current?.program || '',
                attendancePct: 100,
                attendanceStatus: 'Regular',
                ass1: 0, ass2: 0, ass3: 0,
                project: 0, finalExam: 0, overallScore: 0,
                voucherId: '', voucherStatus: 'Unassigned', certificateStatus: 'Pending',
              });
              importedCount++;
            }
          }

          setImportProgress(null);
          setSelectedUploadFile(null);
          setStudents((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            const uniqueNew = newStudentsList.filter((s) => !existingIds.has(s.id));
            return [...prev, ...uniqueNew];
          });
          setUploadModalOpen(false);
          refreshBatches();
          toast({
            variant: 'success',
            title: 'Roster Import Complete',
            message: `${importedCount} student(s) added to batch. Sync Google Sheet to fill in basic details.`,
          });
          // Remove any accidental duplicates the import may have introduced.
          setTimeout(() => { dedupeBatchStudents({ silent: true }); }, 600);
        } catch (err: any) {
          setImportProgress(null);
          toast({ variant: 'error', title: 'Parsing Failed', message: err.message });
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setImportProgress(null);
      toast({ variant: 'error', title: 'Import Failed', message: err.message });
    }
  };

  // Student list state — initialized from and saved to localStorage with DB sync fallback
  const [students, setStudents] = useState<StudentRecord[]>([]);

  const filteredStudents = useMemo(() => {
    const enrolled = students.filter((s) => !selectedBatchId || batchStudentIds.has(s.id));
    const seenPhones = new Set<string>();
    const unique: StudentRecord[] = [];
    for (const student of enrolled) {
      const phoneKey = normalizeStudentKey(student.phone);
      if (!seenPhones.has(phoneKey)) {
        seenPhones.add(phoneKey);
        unique.push(student);
      }
    }
    return unique;
  }, [students, selectedBatchId, batchStudentIds]);

  const dailyReportFixture = useMemo<DailyReportData>(() => {
    const selectedBatch = (batches || []).find((b) => b.id === selectedBatchId);
    
    // Resolve active trainer name dynamically
    const safeTrainers = Array.isArray(trainers) ? trainers : [];
    const activeTrainer = selectedBatch ? safeTrainers.find((t) => t && t.id === selectedBatch.trainerId) : null;
    const trainerNameStr = activeTrainer ? `${activeTrainer.firstName} ${activeTrainer.lastName}` : 'Lead Trainer';

    // Resolve pass mark percentages from eligibility criteria, defaulting to 84%
    const ass1PassThreshold = eligibilityCriteria.find(c => c.assessment === 'ass1')?.threshold ?? 84;
    const ass2PassThreshold = eligibilityCriteria.find(c => c.assessment === 'ass2')?.threshold ?? 84;
    const ass3PassThreshold = eligibilityCriteria.find(c => c.assessment === 'ass3')?.threshold ?? 84;

    const assessments = [
      { id: 'ass1', title: 'Assessment 1', type: 'MCQ Test', maxMarks: 100, passMarkPercent: ass1PassThreshold },
      { id: 'ass2', title: 'Assessment 2', type: 'Practical Lab', maxMarks: 100, passMarkPercent: ass2PassThreshold },
      { id: 'ass3', title: 'Assessment 3', type: 'Project Viva', maxMarks: 100, passMarkPercent: ass3PassThreshold },
    ];

    // Populate sessions based on logged attendance sessions
    const sessions = attendanceSessions.map((sess) => {
      const absentStudentIds = filteredStudents
        .filter((st) => attendanceMatrix[st.id]?.[sess.id] === 'absent')
        .map((st) => st.id);
      
      const totalCount = filteredStudents.length;
      const absentCount = absentStudentIds.length;
      const presentCount = Math.max(0, totalCount - absentCount);
      const lateCount = filteredStudents.filter((st) => attendanceMatrix[st.id]?.[sess.id] === 'late').length;
      const attendancePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;

      return {
        date: sess.date,
        presentCount,
        absentCount,
        lateCount,
        totalStudents: totalCount,
        attendancePct,
        absentStudentIds,
      };
    });

    // Populate milestones based on sessions
    const progressMilestones = attendanceSessions.length > 0
      ? attendanceSessions.map((sess, idx) => ({
          date: sess.date,
          sessionNo: idx + 1,
          topicCovered: `Session ${idx + 1}: Core Curriculum Module`,
          practicalDone: idx % 2 === 0,
          status: 'Completed' as const,
        }))
      : [
          { date: todayISO(), sessionNo: 1, topicCovered: 'Introduction & Foundations', practicalDone: true, status: 'Completed' as const },
        ];

    // Map students with their dynamic assessment records and eligibility status
    const studentsList = filteredStudents.map((s) => {
      const studentSessions = attendanceMatrix[s.id] || {};
      const totalSessionsVal = attendanceSessions.length;
      const totalPresentVal = attendanceSessions.filter((c) => (studentSessions[c.id] || 'present') !== 'absent').length;

      const ass1Attempted = s.ass1 !== undefined && s.ass1 > 0;
      const ass2Attempted = s.ass2 !== undefined && s.ass2 > 0;
      const ass3Attempted = s.ass3 !== undefined && s.ass3 > 0;

      const passAss1 = s.ass1 >= ass1PassThreshold;
      const passAss2 = s.ass2 >= ass2PassThreshold;
      const passAss3 = s.ass3 >= ass3PassThreshold;

      const allPassed = eligibilityCriteria
        .filter((crit) => crit.assessment !== 'finalExam')
        .every((crit) => {
          const score = s[crit.assessment as keyof StudentRecord] as number;
          return score >= crit.threshold;
        });

      const eligible = isStudentEligible(s);

      return {
        id: s.id,
        avatarUrl: s.photoUrl || '',
        registerNo: s.phone || '',
        phone: s.phone || '',
        name: s.name,
        email: s.email || '',
        college: selectedBatch?.college || '',
        batch: selectedBatch?.trainingName || '',
        gender: (s.gender || 'Female') as 'Male' | 'Female',
        qualification: s.qualification || '',
        hasComputer: (s.hasComputer || 'Yes') as 'Yes' | 'No',
        learnedBefore: (s.learnedBefore || 'No') as 'Yes' | 'No',
        attendancePct: s.attendancePct,
        totalPresent: totalPresentVal,
        totalSessions: totalSessionsVal,
        assessmentScores: {
          ass1: { marks: s.ass1 || 0, maxMarks: 100, grade: passAss1 ? 'A' : 'F', passed: passAss1, attempted: ass1Attempted },
          ass2: { marks: s.ass2 || 0, maxMarks: 100, grade: passAss2 ? 'A' : 'F', passed: passAss2, attempted: ass2Attempted },
          ass3: { marks: s.ass3 || 0, maxMarks: 100, grade: passAss3 ? 'A' : 'F', passed: passAss3, attempted: ass3Attempted },
        },
        assessmentStatus: allPassed ? 'Completed' as const : 'Pending' as const,
        finalExamEligibility: (eligible ? 'Eligible' : 'Not Eligible') as 'Eligible' | 'Not Eligible',
        finalExamMark: s.finalExam || 0,
        // Pass = raw mark >= (pass % of the course's maximum marks). coursePassPct
        // is a percentage, so it must be scaled to the mark scale — comparing a
        // raw mark like 754 directly against 70 wrongly passed almost everyone.
        finalExamResult: ((s.finalExam || 0) >= Math.round((coursePassPct / 100) * (courseMaxMarks || 100)) ? 'Passed' : 'Failed') as 'Passed' | 'Failed',
        eligibilityReason: !eligible
          ? (considerAttendance && s.attendancePct < attendanceThreshold)
            ? `Low attendance (<${attendanceThreshold}%)`
            : 'Failed prerequisite assessment(s)'
          : undefined,
      };
    });

    // Populate risk items dynamically
    const riskItems = filteredStudents
      .map((st) => {
        const lowAttendance = considerAttendance && st.attendancePct < attendanceThreshold;
        const failedCount = eligibilityCriteria
          .filter((crit) => crit.assessment !== 'finalExam')
          .filter((crit) => {
            const score = st[crit.assessment as keyof StudentRecord] as number;
            return score < crit.threshold;
          }).length;
        
        let riskReason: 'Low Attendance (<75%)' | 'Failed Assessments' | 'Pending Assessments' | 'Multiple Issues' | null = null;
        let severity: 'High' | 'Medium' | 'Low' = 'Low';

        if (lowAttendance && failedCount > 0) {
          riskReason = 'Multiple Issues';
          severity = 'High';
        } else if (lowAttendance) {
          riskReason = 'Low Attendance (<75%)';
          severity = 'High';
        } else if (failedCount > 0) {
          riskReason = 'Failed Assessments';
          severity = 'Medium';
        }

        if (!riskReason) return null;

        return {
          studentId: st.id,
          studentName: st.name,
          registerNo: st.phone,
          riskReason,
          attendancePct: st.attendancePct,
          failedCount,
          severity,
        };
      })
      .filter(Boolean) as any[];

    return {
      reportDate: todayISO(),
      batchId: selectedBatchId,
      batchCode: selectedBatch?.code || '',
      batchName: selectedBatch?.trainingName || '',
      collegeName: selectedBatch?.college || '',
      // Human-readable course name (resolved from the batch's courseId) — never
      // the raw course UUID. Academic year comes from the batch, not hardcoded.
      courseName:
        (Array.isArray(courses) ? courses : []).find((c) => c && c.id === selectedBatch?.courseId)?.title ||
        selectedBatch?.program ||
        selectedBatch?.trainingName ||
        '',
      academicYear: selectedBatch?.academicYear || '',
      trainerName: trainerNameStr,
      coordinatorName: selectedBatch?.coordinator || 'Coordinator',
      totalStudents: filteredStudents.length,
      courseMaxMarks: courseMaxMarks,
      finalExamPassMarkPercent: coursePassPct,
      assessments,
      sessions,
      students: studentsList,
      progressMilestones,
      riskItems,
      defaultTrainerNotes: 'No notes registered.',
    };
  }, [selectedBatchId, batches, courses, filteredStudents, trainers, attendanceSessions, attendanceMatrix]);

  // Daily Report Builder & Preview States
  const [dailyReportBuilderOpen, setDailyReportBuilderOpen] = useState(false);
  const [dailyReportPreviewOpen, setDailyReportPreviewOpen] = useState(false);

  const [dailyReportConfig, setDailyReportConfig] = useState<DailyReportConfig>(() => ({
    selectedSections: [
      'executive-summary',
      'datewise-attendance',
      'assessment-status',
      'final-exam-eligibility',
      'student-data',
    ],
    selectedAssessmentIds: [],
    selectedStudentColumns: ['studentName', 'gender', 'hasComputer', 'learnedBefore', 'attendancePct', 'assessmentStatus', 'finalExamEligibility'],
    trainerNotes: 'No notes registered.',
  }));

  useEffect(() => {
    setDailyReportConfig((prev) => ({
      ...prev,
      trainerNotes: dailyReportFixture.defaultTrainerNotes,
      selectedAssessmentIds: dailyReportFixture.assessments.map((a) => a.id),
      selectedStudentColumns: [
        'studentName',
        'gender',
        'hasComputer',
        'learnedBefore',
        'attendancePct',
        ...dailyReportFixture.assessments.map((a) => a.id),
        'assessmentStatus',
        'finalExamEligibility',
      ],
    }));
  }, [dailyReportFixture]);

  useEffect(() => {
    if (dbStudents) {
      const mapped: StudentRecord[] = dbStudents.map((s: any) => {
        const fields = s.customFields || {};
        return {
          id: s.id,
          name: s.firstName || s.lastName ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : s.fullName || s.name || 'Student',
          photo: s.photo && !s.photo.startsWith('http') ? s.photo : '🎓',
          photoUrl: s.photoUrl,
          phone: s.phone || '',
          email: s.email || '',
          college: fields.college || 'Christ Irinjalakkuda',
          department: fields.department || 'BBA',
          attendancePct: fields.attendancePct ?? 100,
          attendanceStatus: fields.attendanceStatus || 'Regular',
          ass1: fields.ass1 ?? 0,
          ass2: fields.ass2 ?? 0,
          ass3: fields.ass3 ?? 0,
          project: fields.project ?? 0,
          finalExam: fields.finalExam ?? 0,
          overallScore: fields.overallScore ?? 0,
          voucherId: fields.voucherId || '',
          voucherStatus: fields.voucherStatus || 'unassigned',
          certificateStatus: fields.certificateStatus || 'unissued',
          examAttemptCount: fields.examAttemptCount ?? 1,
          retestScore: fields.retestScore ?? 0,
          retestApproved: fields.retestApproved ?? false,
          retestPaymentStatus: (selectedBatchId && fields[`retestPaymentStatus_${selectedBatchId}`]) || fields.retestPaymentStatus || 'Pending',
          retestCollectedAmount: (selectedBatchId && fields[`retestCollectedAmount_${selectedBatchId}`]) ?? fields.retestCollectedAmount ?? 0,
          retestVoucherId: fields.retestVoucherId || '',
          gender: fields.gender || 'Female',
          qualification: fields.qualification || s.academicQualification || '',
          hasComputer: fields.hasComputer || 'Yes',
          learnedBefore: fields.learnedBefore || 'No',
        };
      });
      setStudents(mapped);
    }
  }, [dbStudents]);

  // Load and merge student records enrolled in the active batch to bypass the 1000-student fetch limit.
  useEffect(() => {
    if (!selectedBatchId) return;

    let active = true;

    const fetchBatchStudents = async () => {
      try {
        const { data, error } = await supabase
          .from('flwdsk_enrollments')
          .select('student_id, student:flwdsk_student_records(*)')
          .eq('batch_id', selectedBatchId)
          .is('deleted_at', null);

        if (error) throw error;
        if (!data || !active) return;

        const { data: dbVerifications } = await supabase
          .from('flwdsk_retest_payment_verifications')
          .select('*')
          .eq('batch_id', selectedBatchId)
          .is('deleted_at', null);

        const batchStudents = data
          .map((d: any) => d.student)
          .filter(Boolean);

        const mappedBatchStudents: StudentRecord[] = batchStudents.map((s: any) => {
          const firstName = s.first_name || s.firstName || '';
          const lastName = s.last_name || s.lastName || '';
          const fullName = s.full_name || s.fullName || s.name || '';
          const photoUrl = s.photo_url || s.photoUrl;
          const phone = s.phone || '';
          const email = s.email || '';
          
          const customFields = s.custom_fields || s.customFields || {};
          
          // Resolve verification from ledger prioritizing the latest record
          const studentVerification = dbVerifications?.filter((v: any) => v.student_id === s.id)
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

          const resolvedStatus = studentVerification
            ? (studentVerification.status === 'Verified' ? 'Paid' : 'Pending')
            : (customFields[`retestPaymentStatus_${selectedBatchId}`] || customFields.retest_payment_status || customFields.retestPaymentStatus || 'Pending');

          const resolvedAmount = customFields[`retestCollectedAmount_${selectedBatchId}`] ?? customFields.retest_collected_amount ?? customFields.retestCollectedAmount ?? 0;
          
          return {
            id: s.id,
            name: firstName || lastName ? `${firstName} ${lastName}`.trim() : fullName || 'Student',
            photo: s.photo && !s.photo.startsWith('http') ? s.photo : '🎓',
            photoUrl: photoUrl,
            phone: phone,
            email: email,
            college: customFields.college || 'Christ Irinjalakkuda',
            department: customFields.department || 'BBA',
            attendancePct: customFields.attendance_pct ?? customFields.attendancePct ?? 100,
            attendanceStatus: customFields.attendance_status || customFields.attendanceStatus || 'Regular',
            ass1: customFields.ass1 ?? 0,
            ass2: customFields.ass2 ?? 0,
            ass3: customFields.ass3 ?? 0,
            project: customFields.project ?? 0,
            finalExam: customFields.final_exam ?? customFields.finalExam ?? 0,
            overallScore: customFields.overall_score ?? customFields.overallScore ?? 0,
            voucherId: customFields.voucher_id || customFields.voucherId || '',
            voucherStatus: customFields.voucher_status || customFields.voucherStatus || 'unassigned',
            certificateStatus: customFields.certificate_status || customFields.certificateStatus || 'unissued',
            examAttemptCount: customFields.exam_attempt_count ?? customFields.examAttemptCount ?? 1,
            retestScore: customFields.retest_score ?? customFields.retestScore ?? 0,
            retestApproved: customFields.retest_approved ?? customFields.retestApproved ?? false,
            retestPaymentStatus: resolvedStatus,
            retestCollectedAmount: resolvedAmount,
            retestVoucherId: customFields.retest_voucher_id || customFields.retestVoucherId || '',
            gender: customFields.gender || 'Female',
            qualification: customFields.qualification || s.academic_qualification || s.academicQualification || '',
            hasComputer: customFields.has_computer || customFields.hasComputer || 'Yes',
            learnedBefore: customFields.learned_before || customFields.learnedBefore || 'No',
          };
        });

        setStudents((prev) => {
          const existingMap = new Map(prev.map((s) => [s.id, s]));
          for (const s of mappedBatchStudents) {
            existingMap.set(s.id, s);
          }
          return Array.from(existingMap.values());
        });
      } catch (err: any) {
        console.error('Error fetching batch students:', err.message);
      }
    };

    fetchBatchStudents();
    return () => {
      active = false;
    };
  }, [selectedBatchId, dbStudents, enrollments, refreshTrigger]);

  // Trigger Final Exam attempts reconciliation only when the user enters the Final Exam or Retest management tab
  useEffect(() => {
    if (!selectedBatchId || !students.length) return;
    if (activeTab !== 'final-exam' && activeTab !== 'retest') return;

    let active = true;
    const fetchAttemptsAndReconcile = async () => {
      try {
        const { data: attempts, error: attemptsErr } = await supabase
          .from('flwdsk_exam_attempts')
          .select('*')
          .eq('batch_id', selectedBatchId)
          .is('deleted_at', null);

        if (!attemptsErr && attempts && active) {
          runInMemoryReconciliation(attempts, students.filter(s => batchStudentIds.has(s.id)));
        }
      } catch (err: any) {
        console.error('Error fetching attempts for reconciliation:', err.message);
      }
    };

    fetchAttemptsAndReconcile();
    return () => {
      active = false;
    };
  }, [selectedBatchId, activeTab, students, batchStudentIds, refreshTrigger]);

  /**
   * Remove duplicate students from the ACTIVE batch by normalized phone number.
   * Keeps the FIRST enrolled student (oldest createdAt) and un-enrolls the rest.
   * Only the enrollment is deleted (the student record itself is preserved).
   */
  const dedupeBatchStudents = useCallback(async (opts?: { silent?: boolean }): Promise<number> => {
    if (!selectedBatchId) return 0;
    const enrolled = students.filter((s) => batchStudentIds.has(s.id));

    // 1) Get unique enrolled students by ID first to prevent React array duplicates from triggering DB deletes
    const uniqueEnrolled: StudentRecord[] = [];
    const seenIds = new Set<string>();
    for (const student of enrolled) {
      if (!seenIds.has(student.id)) {
        seenIds.add(student.id);
        uniqueEnrolled.push(student);
      }
    }

    // 2) Group enrolled students by normalized phone (last 10 digits).
    const groups: Record<string, StudentRecord[]> = {};
    for (const student of uniqueEnrolled) {
      const key = normalizeStudentKey(student.phone);
      if (!key) continue;
      (groups[key] ||= []).push(student);
    }

    // 2) In each group, keep the oldest (first enrolled) and mark the rest.
    const duplicateIds: string[] = [];
    for (const list of Object.values(groups)) {
      if (list.length <= 1) continue;
      const sorted = [...list].sort((a, b) => {
        const ta = new Date((a as any).createdAt || 0).getTime();
        const tb = new Date((b as any).createdAt || 0).getTime();
        return ta - tb; // oldest first → kept
      });
      duplicateIds.push(...sorted.slice(1).map((s) => s.id));
    }

    if (duplicateIds.length === 0) {
      if (!opts?.silent) {
        toast({ variant: 'info', title: 'No Duplicates', message: 'No duplicate students were found in this batch.' });
      }
      return 0;
    }

    try {
      // 3) Soft-delete the duplicate ENROLLMENTS for this batch (not the students).
      for (const studentId of duplicateIds) {
        const res = await removeEnrollment(studentId, selectedBatchId, 'ENROLLMENT_DEDUPLICATED');
        if (!res.ok) throw new Error(res.error);
      }

      // 4) Remove them from local state.
      setStudents((prev) => prev.filter((s) => !duplicateIds.includes(s.id)));
      refreshBatches();
      toast({
        variant: opts?.silent ? 'info' : 'success',
        title: 'Duplicates Removed',
        message: `Removed ${duplicateIds.length} duplicate student${duplicateIds.length > 1 ? 's' : ''} from this batch.`,
      });
      return duplicateIds.length;
    } catch (err: any) {
      if (!opts?.silent) {
        toast({ variant: 'error', title: 'Cleanup Failed', message: err?.message || 'Could not remove duplicates.' });
      }
      console.error('Error removing duplicate enrollments:', err?.message);
      return 0;
    }
  }, [selectedBatchId, students, batchStudentIds, refreshBatches, toast]);

  // Auto-clean duplicates whenever the batch/students/enrollments change.
  useEffect(() => {
    if (!selectedBatchId || students.length === 0 || enrollments.length === 0) return;
    dedupeBatchStudents({ silent: true });
  }, [selectedBatchId, students, enrollments, batchStudentIds, dedupeBatchStudents]);

  // Which student row is showing the inline "remove from batch?" confirm.
  const [confirmRemoveStudentId, setConfirmRemoveStudentId] = useState<string | null>(null);
  // Batch-select state for the Performance Matrix
  const [selectedMatrixIds, setSelectedMatrixIds] = useState<Set<string>>(new Set());
  const [batchRemovingMatrix, setBatchRemovingMatrix] = useState(false);

  /** Un-enrol a single student from the active batch (keeps the student record). */
  const handleRemoveStudentFromBatch = useCallback(async (student: StudentRecord) => {
    if (!selectedBatchId) return;
    try {
      const res = await removeEnrollment(student.id, selectedBatchId, 'ENROLLMENT_REMOVED');
      if (!res.ok) throw new Error(res.error);
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      setConfirmRemoveStudentId(null);
      toast({ variant: 'success', title: 'Student Removed', message: 'Student removed from batch.' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Remove Failed', message: err?.message || 'Could not remove the student.' });
    }
  }, [selectedBatchId, toast]);

  /** Batch-remove all selectedMatrixIds from the active batch. */
  const handleBatchRemoveStudents = async () => {
    if (!selectedBatchId || selectedMatrixIds.size === 0) return;
    const ids = Array.from(selectedMatrixIds);
    const names = students
      .filter((s) => ids.includes(s.id))
      .map((s) => s.name)
      .join(', ');
    const confirmOk = await confirm({
      title: 'Remove Students from Batch?',
      message: `Are you sure you want to remove ${ids.length} student(s) from this batch?\n\n${names}\n\nThis only removes them from the batch, not from the system.`,
      confirmLabel: 'Remove',
      variant: 'delete',
    });
    if (!confirmOk) return;

    setBatchRemovingMatrix(true);
    let ok = 0; let fail = 0;
    for (const id of ids) {
      try {
        const res = await removeEnrollment(id, selectedBatchId, 'ENROLLMENT_BULK_REMOVED');
        if (!res.ok) throw new Error(res.error);
        ok++;
      } catch { fail++; }
    }
    setStudents((prev) => prev.filter((s) => !selectedMatrixIds.has(s.id)));
    setSelectedMatrixIds(new Set());
    setBatchRemovingMatrix(false);
    if (ok > 0) {
      toast({ variant: 'success', title: 'Batch Remove Complete', message: `${ok} student(s) removed from batch.${fail > 0 ? ` ${fail} failed.` : ''}` });
    } else {
      toast({ variant: 'error', title: 'Batch Remove Failed', message: 'Could not remove selected students.' });
    }
  };

  const syncVouchersToDb = async (studentId: string, voucherCode: string, type: 'Initial' | 'Retest', paymentVerified?: string) => {
    if (!voucherCode.trim() || !selectedBatchId) return;
    try {
      const res = await syncVoucher(
        studentId,
        selectedBatchId,
        type,
        voucherCode.trim(),
        (paymentVerified || 'Pending') as 'Pending' | 'Verified'
      );
      if (!res.ok) {
        console.error('Error syncing voucher to DB:', res.error);
      }
    } catch (e) {
      console.error('Error syncing voucher to DB:', e);
    }
  };

  const syncExamAttemptToDb = async (
    studentId: string,
    batchId: string,
    attemptType: 'Initial' | 'Retest',
    mark: number
  ) => {
    try {
      const res = await syncExamAttempt(
        studentId,
        batchId,
        attemptType,
        mark
      );
      if (!res.ok) {
        console.error('Failed to sync exam attempt:', res.error);
      }
    } catch (err) {
      console.warn('Failed to sync exam attempt:', err);
    }
  };

  const runInMemoryReconciliation = (attempts: any[], studentList: StudentRecord[]) => {
    const report: Record<string, ReconciledStudentState> = {};
    if (!selectedBatchId) return;

    for (const s of studentList) {
      const studentAttempts = attempts.filter(a => a.student_id === s.id);
      const initialAttempts = studentAttempts.filter(a => a.attempt_type === 'Initial');
      const retestAttempts = studentAttempts.filter(a => a.attempt_type === 'Retest');

      const legacyTest = s.finalExam || 0;
      const legacyRetest = s.retestScore || 0;

      const initCount = initialAttempts.length;
      const retCount = retestAttempts.length;

      let testAttemptMark: number | null = null;
      let retestAttemptMark: number | null = null;
      let testStatus: ReconciledStudentState['testStatus'] = 'AMBIGUOUS_ZERO';
      let retestStatus: ReconciledStudentState['retestStatus'] = 'AMBIGUOUS_ZERO';

      // Reconcile Initial / Test
      if (initCount > 1) {
        testStatus = 'DUPLICATE_ATTEMPT';
        testAttemptMark = initialAttempts[0].mark;
      } else if (initCount === 1) {
        const attemptMark = initialAttempts[0].mark;
        testAttemptMark = attemptMark;
        if (attemptMark === 0) {
          testStatus = 'CONFIRMED_ZERO_ATTEMPT';
        } else if (attemptMark === legacyTest) {
          testStatus = 'MATCHED';
        } else if (legacyTest === 0) {
          testStatus = 'ATTEMPT_ONLY';
        } else {
          testStatus = 'CONFLICT';
        }
      } else {
        if (legacyTest === 0) {
          testStatus = 'AMBIGUOUS_ZERO';
        } else {
          testStatus = 'LEGACY_ONLY';
        }
      }

      // Reconcile Retest
      if (retCount > 1) {
        retestStatus = 'DUPLICATE_ATTEMPT';
        retestAttemptMark = retestAttempts[0].mark;
      } else if (retCount === 1) {
        const attemptMark = retestAttempts[0].mark;
        retestAttemptMark = attemptMark;
        if (attemptMark === 0) {
          retestStatus = 'CONFIRMED_ZERO_ATTEMPT';
        } else if (attemptMark === legacyRetest) {
          retestStatus = 'MATCHED';
        } else if (legacyRetest === 0) {
          retestStatus = 'ATTEMPT_ONLY';
        } else {
          retestStatus = 'CONFLICT';
        }
      } else {
        if (legacyRetest === 0) {
          retestStatus = 'AMBIGUOUS_ZERO';
        } else {
          retestStatus = 'LEGACY_ONLY';
        }
      }

      const conflict = testStatus === 'CONFLICT' || retestStatus === 'CONFLICT';
      const duplicate = testStatus === 'DUPLICATE_ATTEMPT' || retestStatus === 'DUPLICATE_ATTEMPT';

      report[s.id] = {
        studentId: s.id,
        batchId: selectedBatchId,
        testAttemptMark,
        retestAttemptMark,
        cachedTestScore: legacyTest,
        cachedRetestScore: legacyRetest,
        testStatus,
        retestStatus,
        conflict,
        duplicate
      };
    }

    setReconciliationReport(report);
  };

  const renderReconciliationDrawer = () => {
    if (!reconciliationDrawerOpen) return null;

    // Calculate Summary counts directly from in-memory reconciliation report
    const summary = {
      matched: 0,
      attemptOnly: 0,
      legacyOnly: 0,
      conflict: 0,
      ambiguousZero: 0,
      confirmedZero: 0,
      duplicate: 0,
      total: 0
    };

    Object.values(reconciliationReport).forEach((rep) => {
      summary.total++;
      
      // Initial (Test) attempt check
      if (rep.testStatus === 'MATCHED') summary.matched++;
      else if (rep.testStatus === 'ATTEMPT_ONLY') summary.attemptOnly++;
      else if (rep.testStatus === 'LEGACY_ONLY') summary.legacyOnly++;
      else if (rep.testStatus === 'CONFLICT') summary.conflict++;
      else if (rep.testStatus === 'AMBIGUOUS_ZERO') summary.ambiguousZero++;
      else if (rep.testStatus === 'CONFIRMED_ZERO_ATTEMPT') summary.confirmedZero++;
      else if (rep.testStatus === 'DUPLICATE_ATTEMPT') summary.duplicate++;

      // Retest attempt check (if retest is relevant)
      if (rep.retestStatus === 'MATCHED') summary.matched++;
      else if (rep.retestStatus === 'ATTEMPT_ONLY') summary.attemptOnly++;
      else if (rep.retestStatus === 'LEGACY_ONLY') summary.legacyOnly++;
      else if (rep.retestStatus === 'CONFLICT') summary.conflict++;
      else if (rep.retestStatus === 'AMBIGUOUS_ZERO') summary.ambiguousZero++;
      else if (rep.retestStatus === 'CONFIRMED_ZERO_ATTEMPT') summary.confirmedZero++;
      else if (rep.retestStatus === 'DUPLICATE_ATTEMPT') summary.duplicate++;
    });

    const enrolled = students.filter(s => batchStudentIds.has(s.id));
    const filteredList = enrolled.filter((s) => {
      const rep = reconciliationReport[s.id];
      if (!rep) return false;
      if (selectedFilter === 'ALL') return true;
      return rep.testStatus === selectedFilter || rep.retestStatus === selectedFilter;
    });

    return (
      <Drawer
        open={true}
        onClose={() => setReconciliationDrawerOpen(false)}
        title="🔍 Final Exam Attempts Reconciliation"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', padding: '0 4px' }}>
          {/* Summary Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {[
              { label: 'Matched', count: summary.matched, color: 'var(--status-success, var(--status-success))', bg: 'rgba(16, 185, 129, 0.1)' },
              { label: 'Conflict', count: summary.conflict, color: 'var(--status-danger, var(--status-danger))', bg: 'rgba(239, 68, 68, 0.1)' },
              { label: 'Duplicate', count: summary.duplicate, color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
              { label: 'Attempt Only', count: summary.attemptOnly, color: 'var(--status-info, var(--brand))', bg: 'rgba(59, 130, 246, 0.1)' },
              { label: 'Legacy Only', count: summary.legacyOnly, color: 'var(--accent)', bg: 'rgba(139, 92, 246, 0.1)' },
              { label: 'Confirmed Zero', count: summary.confirmedZero, color: '#4b5563', bg: 'rgba(75, 85, 99, 0.1)' },
              { label: 'Ambiguous Zero', count: summary.ambiguousZero, color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
            ].map((c) => (
              <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.color}`, borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: c.color, whiteSpace: 'nowrap' }}>{c.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: c.color }}>{c.count}</div>
              </div>
            ))}
          </div>

          {/* Filter Selector & Refresh Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'MATCHED', label: 'Matched' },
                { id: 'CONFLICT', label: 'Conflicts' },
                { id: 'DUPLICATE_ATTEMPT', label: 'Duplicates' },
                { id: 'ATTEMPT_ONLY', label: 'Attempt Only' },
                { id: 'LEGACY_ONLY', label: 'Legacy Only' },
                { id: 'CONFIRMED_ZERO_ATTEMPT', label: 'Confirmed Zero' },
                { id: 'AMBIGUOUS_ZERO', label: 'Ambiguous Zero' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFilter(f.id as any)}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: selectedFilter === f.id ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                    background: selectedFilter === f.id ? 'var(--brand)' : 'var(--bg-sunken)',
                    color: selectedFilter === f.id ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const { data: attempts } = await supabase
                    .from('flwdsk_exam_attempts')
                    .select('*')
                    .eq('batch_id', selectedBatchId)
                    .is('deleted_at', null);
                  if (attempts) {
                    runInMemoryReconciliation(attempts, enrolled);
                    toast({ variant: 'success', title: 'Reconciliation Refreshed', message: 'Calculations updated in-memory.' });
                  }
                } catch (e: any) {
                  toast({ variant: 'error', title: 'Refresh Failed', message: e.message });
                }
              }}
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
            >
              🔄 Refresh
            </Button>
          </div>

          {/* Reconciliation List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
            {filteredList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                🎉 No students found matching this filter.
              </div>
            ) : (
              filteredList.map((s) => {
                const rep = reconciliationReport[s.id];
                if (!rep) return null;
                
                return (
                  <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text-primary)' }}>{s.photo} {s.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Phone: {s.phone}</div>
                      </div>
                      <div>
                        <Badge tone={rep.conflict ? 'danger' : rep.duplicate ? 'warning' : 'success'}>
                          {rep.conflict ? 'Conflict 🚨' : rep.duplicate ? 'Duplicate 🔄' : 'Consistent ✅'}
                        </Badge>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      {/* Test Attempt Section */}
                      <div style={{ paddingRight: 6, borderRight: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)', marginBottom: 4 }}>📝 Initial Test (Attempt 1)</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                          <div><strong>Attempts Log:</strong> {rep.testAttemptMark !== null ? `${rep.testAttemptMark} marks` : 'None'}</div>
                          <div><strong>Legacy Cache:</strong> {rep.cachedTestScore} marks</div>
                          <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Badge tone={
                              rep.testStatus === 'MATCHED' ? 'success' :
                              rep.testStatus === 'CONFLICT' ? 'danger' :
                              rep.testStatus === 'DUPLICATE_ATTEMPT' ? 'warning' :
                              rep.testStatus === 'AMBIGUOUS_ZERO' ? 'neutral' : 'info'
                            }>
                              {rep.testStatus.replace('_', ' ')}
                            </Badge>
                            {['CONFLICT', 'ATTEMPT_ONLY', 'LEGACY_ONLY', 'DUPLICATE_ATTEMPT'].includes(rep.testStatus) && (
                              <button
                                type="button"
                                onClick={() => handleOpenResolutionModal(s, 'Initial', rep.testStatus as any)}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  border: '1.5px solid var(--brand)',
                                  background: 'transparent',
                                  color: 'var(--brand)',
                                  cursor: 'pointer',
                                }}
                              >
                                🛠️ Resolve
                              </button>
                            )}
                          </div>
                          {rep.testStatus === 'AMBIGUOUS_ZERO' && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                              Ambiguous Zero: Cache has 0 but no database attempt row exists.
                            </div>
                          )}
                          {rep.testStatus === 'ATTEMPT_ONLY' && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                              Attempt exists in database attempts log but legacy score cache is 0 or missing.
                            </div>
                          )}
                          {rep.testStatus === 'LEGACY_ONLY' && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                              Legacy score cache has a value, but no attempts log exists in database.
                            </div>
                          )}
                          {rep.testStatus === 'CONFLICT' && (
                            <div style={{ fontSize: 12, color: 'var(--status-danger, var(--status-danger))', marginTop: 4, fontStyle: 'italic' }}>
                              Discrepancy detected between database attempt row and legacy cache.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Retest Attempt Section */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#b45309', marginBottom: 4 }}>🔄 Retest (Attempt 2)</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                          <div><strong>Attempts Log:</strong> {rep.retestAttemptMark !== null ? `${rep.retestAttemptMark} marks` : 'None'}</div>
                          <div><strong>Legacy Cache:</strong> {rep.cachedRetestScore} marks</div>
                          <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Badge tone={
                              rep.retestStatus === 'MATCHED' ? 'success' :
                              rep.retestStatus === 'CONFLICT' ? 'danger' :
                              rep.retestStatus === 'DUPLICATE_ATTEMPT' ? 'warning' :
                              rep.retestStatus === 'AMBIGUOUS_ZERO' ? 'neutral' : 'info'
                            }>
                              {rep.retestStatus.replace('_', ' ')}
                            </Badge>
                            {['CONFLICT', 'ATTEMPT_ONLY', 'LEGACY_ONLY', 'DUPLICATE_ATTEMPT'].includes(rep.retestStatus) && (
                              <button
                                type="button"
                                onClick={() => handleOpenResolutionModal(s, 'Retest', rep.retestStatus as any)}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  border: '1.5px solid var(--brand)',
                                  background: 'transparent',
                                  color: 'var(--brand)',
                                  cursor: 'pointer',
                                }}
                              >
                                🛠️ Resolve
                              </button>
                            )}
                          </div>
                          {rep.retestStatus === 'AMBIGUOUS_ZERO' && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                              Ambiguous Zero: Cache has 0 but no database attempt row exists.
                            </div>
                          )}
                          {rep.retestStatus === 'ATTEMPT_ONLY' && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                              Attempt exists in database attempts log but legacy score cache is 0 or missing.
                            </div>
                          )}
                          {rep.retestStatus === 'LEGACY_ONLY' && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                              Legacy score cache has a value, but no attempts log exists in database.
                            </div>
                          )}
                          {rep.retestStatus === 'CONFLICT' && (
                            <div style={{ fontSize: 12, color: 'var(--status-danger, var(--status-danger))', marginTop: 4, fontStyle: 'italic' }}>
                              Discrepancy detected between database attempt row and legacy cache.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Drawer>
    );
  };

  const handleOpenResolutionModal = async (
    student: StudentRecord,
    attemptType: 'Initial' | 'Retest',
    category: 'CONFLICT' | 'ATTEMPT_ONLY' | 'LEGACY_ONLY' | 'DUPLICATE_ATTEMPT'
  ) => {
    try {
      const { data: attempts, error } = await supabase
        .from('flwdsk_exam_attempts')
        .select('*')
        .eq('student_id', student.id)
        .eq('batch_id', selectedBatchId)
        .eq('attempt_type', attemptType)
        .is('deleted_at', null);

      if (error) throw error;

      const dbMark = (attempts && attempts.length > 0) ? attempts[0].mark : null;
      const cacheMark = attemptType === 'Initial' ? student.finalExam : (student.retestScore ?? 0);

      setResolvingDiscrepancy({
        studentId: student.id,
        studentName: student.name,
        attemptType,
        category,
        dbMark,
        cacheMark,
        duplicateAttemptsList: attempts || []
      });

      setResolutionAction('');
      setSelectedDuplicateId('');
      setResolutionReason('');
      setResolutionConfirmState(false);
    } catch (e: any) {
      toast({ variant: 'error', title: 'Failed to Load Details', message: e.message });
    }
  };

  const handleExecuteResolution = async () => {
    if (!resolvingDiscrepancy) return;
    const { studentId, attemptType, category, dbMark, cacheMark } = resolvingDiscrepancy;

    setIsSavingResolution(true);
    try {
      const res = await resolveExamAttemptDiscrepancy(
        studentId,
        selectedBatchId,
        attemptType,
        category,
        resolutionAction,
        resolutionReason,
        selectedDuplicateId,
        dbMark,
        cacheMark,
        coursePassPct
      );

      if (!res.ok) {
        throw new Error(res.error);
      }

      toast({ variant: 'success', title: 'Resolution Successful', message: 'Exam reconciliation discrepancy resolved.' });

      // Close modal and increment trigger to refresh student list and reconciliation drawer
      setResolvingDiscrepancy(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Resolution Failed', message: err.message });
    } finally {
      setIsSavingResolution(false);
    }
  };

  const renderResolutionModal = () => {
    if (!resolvingDiscrepancy) return null;
    const { studentName, attemptType, category, dbMark, cacheMark, duplicateAttemptsList } = resolvingDiscrepancy;

    const isConfirmDisabled =
      !resolutionAction ||
      !resolutionReason.trim() ||
      (category === 'DUPLICATE_ATTEMPT' && !selectedDuplicateId);

    const activeBatchCode = activeBatch?.code || 'Active Batch';

    return (
      <Drawer
        open={true}
        onClose={() => setResolvingDiscrepancy(null)}
        title="🛠️ Resolve Exam Attempt Discrepancy"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 4px', height: '100%' }}>
          {!resolutionConfirmState ? (
            <>
              {/* Info panel */}
              <div style={{ background: 'var(--bg-sunken)', borderRadius: 8, padding: 12, fontSize: 12, border: '1px solid var(--border)' }}>
                <div><strong>Student:</strong> {studentName}</div>
                <div><strong>Batch:</strong> {activeBatchCode}</div>
                <div><strong>Attempt Type:</strong> {attemptType === 'Initial' ? 'Initial Test' : 'Retest'}</div>
                <div><strong>Reconciliation Category:</strong> {category.replace('_', ' ')}</div>
              </div>

              {/* Side-by-side comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)', marginBottom: 4 }}>💻 Database Attempt Log</div>
                  <div style={{ fontSize: 12 }}>
                    {category === 'DUPLICATE_ATTEMPT' ? (
                      <span style={{ color: 'var(--status-warning, #d97706)', fontWeight: 700 }}>Multiple Rows Detected</span>
                    ) : dbMark !== null ? (
                      `${dbMark} marks`
                    ) : (
                      'None'
                    )}
                  </div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>💾 Legacy Student Cache</div>
                  <div style={{ fontSize: 12 }}>{cacheMark} marks</div>
                </div>
              </div>

              {/* Duplicate List Selector */}
              {category === 'DUPLICATE_ATTEMPT' && duplicateAttemptsList && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Select Attempt Row to Keep:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {duplicateAttemptsList.map((a: any) => (
                      <label key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, cursor: 'pointer', padding: '6px 8px', borderRadius: 4, background: selectedDuplicateId === a.id ? 'var(--bg-sunken)' : 'transparent', border: selectedDuplicateId === a.id ? '1px solid var(--brand)' : '1px solid transparent' }}>
                        <input
                          type="radio"
                          name="duplicate_select"
                          value={a.id}
                          checked={selectedDuplicateId === a.id}
                          onChange={() => {
                            setSelectedDuplicateId(a.id);
                            setResolutionAction('KEEP_SELECTED_DUPLICATE');
                          }}
                          style={{ marginTop: 2 }}
                        />
                        <div>
                          <div><strong>ID:</strong> {a.id.slice(0, 8)}... | <strong>Mark:</strong> {a.mark} marks ({a.result})</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            Submitted by: {a.submitted_by} | Created: {new Date(a.created_at).toLocaleString()}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Action selectors */}
              {category === 'CONFLICT' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>Choose Action:</div>
                  {[
                    { id: 'USE_LOG_SCORE', label: `Use Attempts Log score (${dbMark} marks) & update cache` },
                    { id: 'USE_CACHE_SCORE', label: `Use Legacy Cache score (${cacheMark} marks) & update database log` }
                  ].map(opt => (
                    <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="resolution_action"
                        value={opt.id}
                        checked={resolutionAction === opt.id}
                        onChange={() => setResolutionAction(opt.id as any)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}

              {category === 'ATTEMPT_ONLY' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>Choose Action:</div>
                  {[
                    { id: 'SYNC_TO_CACHE', label: `Sync attempts log score (${dbMark} marks) to student record cache` }
                  ].map(opt => (
                    <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="resolution_action"
                        value={opt.id}
                        checked={resolutionAction === opt.id}
                        onChange={() => setResolutionAction(opt.id as any)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}

              {category === 'LEGACY_ONLY' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>Choose Action:</div>
                  {[
                    { id: 'CREATE_LOG', label: `Reconstruct historical attempt log in database with cache score (${cacheMark} marks)` }
                  ].map(opt => (
                    <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="resolution_action"
                        value={opt.id}
                        checked={resolutionAction === opt.id}
                        onChange={() => setResolutionAction(opt.id as any)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}

              {/* Mandatory Reason */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Resolution Reason *</label>
                <textarea
                  className="kvj-input"
                  rows={3}
                  required
                  placeholder="Provide brief explanation/remarks for the audit trail..."
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  style={{ fontSize: 12, resize: 'vertical' }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <Button variant="secondary" size="sm" disabled={isSavingResolution} onClick={() => setResolvingDiscrepancy(null)}>Cancel</Button>
                <Button size="sm" disabled={isConfirmDisabled || isSavingResolution} onClick={() => setResolutionConfirmState(true)}>Confirm Details</Button>
              </div>
            </>
          ) : (
            <>
              {/* Step 2: Final Confirmation View */}
              <div style={{ border: '2px solid var(--status-warning, #d97706)', background: 'rgba(217,119,6,0.06)', borderRadius: 8, padding: 14, fontSize: 12 }}>
                <strong style={{ display: 'block', fontSize: 13, color: 'var(--status-warning, #d97706)', marginBottom: 8 }}>
                  ⚠️ You are about to modify exam reconciliation data.
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><strong>Student:</strong> {studentName}</div>
                  <div><strong>Batch:</strong> {activeBatchCode}</div>
                  <div><strong>Attempt Type:</strong> {attemptType === 'Initial' ? 'Initial Test' : 'Retest'}</div>
                  <div><strong>Reconciliation Category:</strong> {category.replace('_', ' ')}</div>
                  <div><strong>Resolution Action:</strong> {resolutionAction.replace(/_/g, ' ')}</div>
                  <div>
                    <strong>New Value Authority:</strong> {
                      resolutionAction === 'USE_LOG_SCORE' || resolutionAction === 'SYNC_TO_CACHE' ? `${dbMark} marks (DB Attempts Log)` : `${cacheMark} marks (Legacy Cache)`
                    }
                  </div>
                  <div style={{ marginTop: 6, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 6 }}>
                    <strong>Trainer Reason:</strong> {resolutionReason}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <Button variant="secondary" size="sm" disabled={isSavingResolution} onClick={() => setResolutionConfirmState(false)}>Cancel / Go Back</Button>
                <Button size="sm" disabled={isSavingResolution} onClick={handleExecuteResolution}>
                  {isSavingResolution ? 'Saving...' : 'Confirm Resolution'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Drawer>
    );
  };

  const saveRetestPaymentVerificationLedger = async (studentId: string, status: 'Paid' | 'Pending') => {
    if (!selectedBatchId) return;

    const dbStatus = status === 'Paid' ? 'Verified' : 'Pending';

    try {
      const res = await verifyRetestPayment(studentId, selectedBatchId, dbStatus);
      if (!res.ok) {
        console.error('Failed to save retest payment verification to ledger:', res.error);
      }
    } catch (err) {
      console.error('Failed to save retest payment verification to ledger:', err);
    }
  };

  const saveStudentToDb = async (student: StudentRecord) => {
    try {
      const names = (student.name || '').trim().split(' ').filter(Boolean);
      const firstName = names[0] || 'Student';
      const lastName = names.slice(1).join(' ') || '';
      
      const isRealUuid = student.id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
      
      // Fetch current custom_fields to prevent wiping other batch-scoped keys
      let dbCustomFields: Record<string, any> = {};
      if (isRealUuid) {
        const { data: currentRecord } = await supabase
          .from('flwdsk_student_records')
          .select('custom_fields')
          .eq('id', student.id)
          .maybeSingle();
        if (currentRecord?.custom_fields) {
          dbCustomFields = currentRecord.custom_fields;
        }
      }

      const mergedCustomFields = {
        ...dbCustomFields,
        college: student.college,
        department: student.department,
        course: student.course || '',
        examDate: student.examDate || '',
        photoUrl: student.photoUrl || '',
        gender: (student as any).gender || 'Female',
        qualification: (student as any).qualification || '',
        hasComputer: (student as any).hasComputer || 'Yes',
        learnedBefore: (student as any).learnedBefore || 'No',
        ass1: student.ass1,
        ass2: student.ass2,
        ass3: student.ass3,
        project: student.project,
        finalExam: student.finalExam,
        retestScore: student.retestScore,
        examAttemptCount: student.examAttemptCount,
        retestApproved: student.retestApproved,
        voucherId: student.voucherId,
        retestVoucherId: student.retestVoucherId,
        voucherStatus: student.voucherStatus,
        certificateStatus: student.certificateStatus,
        selectedVoucherId: (student as any).selectedVoucherId || '',
        attendancePct: student.attendancePct,
        attendanceStatus: student.attendanceStatus,
        overallScore: student.overallScore,
      } as any;

      if (selectedBatchId) {
        mergedCustomFields[`retestPaymentStatus_${selectedBatchId}`] = student.retestPaymentStatus;
        mergedCustomFields[`retestCollectedAmount_${selectedBatchId}`] = student.retestCollectedAmount;
        // Keep the student-global legacy fields for fallback compatibility:
        mergedCustomFields.retestPaymentStatus = student.retestPaymentStatus;
        mergedCustomFields.retestCollectedAmount = student.retestCollectedAmount;
      }

      const payload = {
        first_name: firstName,
        last_name: lastName,
        phone: normalizeStudentKey(student.phone || '9876500000'),
        email: student.email,
        photo_url: student.photoUrl || '',
        notes: (student as any).notes || '',
        custom_fields: mergedCustomFields
      };

      let finalStudentId = student.id;
      if (isRealUuid) {
        const res = await updateStudentProfile(student.id, {
          firstName,
          lastName,
          phone: normalizeStudentKey(student.phone || '9876500000'),
          email: student.email,
          photoUrl: student.photoUrl || '',
          notes: (student as any).notes || '',
          customFields: mergedCustomFields
        });
        if (!res.ok) throw new Error(res.error);
      } else {
        const res = await registerStudent({
          firstName,
          lastName,
          phone: student.phone || '9876500000',
          email: student.email,
          photoUrl: student.photoUrl || '',
          notes: (student as any).notes || '',
          customFields: mergedCustomFields
        });
        if (res.ok) {
          finalStudentId = res.value.id;
          student.id = res.value.id;
          if (selectedBatchId) {
            await enrollStudent(res.value.id, selectedBatchId);
          }
        } else {
          // Registration failed — stop here so we don't sync vouchers/exam
          // attempts against a student that was never saved, and so the caller's
          // catch surfaces the failure to the user.
          throw new Error(res.error || 'Failed to register student.');
        }
      }

      // Sync initial and retest vouchers to DB
      if (student.voucherId) {
        await syncVouchersToDb(finalStudentId, student.voucherId, 'Initial', 'Verified');
      }
      if (student.retestVoucherId) {
        const payStatus = student.retestPaymentStatus === 'Paid' ? 'Verified' : 'Pending';
        await syncVouchersToDb(finalStudentId, student.retestVoucherId, 'Retest', payStatus);
      }

      // Sync initial and retest exam attempts to structured table based on explicit selection
      if (selectedBatchId) {
        const activeMode = selectedAttemptTypes[student.id];
        if (activeMode === 'Initial' && student.finalExam !== undefined) {
          await syncExamAttemptToDb(finalStudentId, selectedBatchId, 'Initial', student.finalExam);
        }
        if (activeMode === 'Retest' && student.retestScore !== undefined) {
          await syncExamAttemptToDb(finalStudentId, selectedBatchId, 'Retest', student.retestScore);
        }
      }
    } catch (err) {
      console.warn('Failed to save student to Supabase:', err);
      toast({
        variant: 'error',
        title: 'Save Failed',
        message: `Could not save "${student.name}" to the database. Your last change may not be stored. ${(err as any)?.message || ''}`.trim(),
      });
    }
  };

  const parseCsv = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(cell.trim());
        result.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
    if (cell || row.length > 0) {
      row.push(cell.trim());
      result.push(row);
    }
    return result.filter(r => r.length > 0);
  };

  // Final Exam student ID list — separate from master students array
  const [finalExamStudentIds, setFinalExamStudentIds] = useState<string[]>([]);

  // Email communications log
  const [emailLogs, setEmailLogs] = useState<EmailHistoryItem[]>([]);

  // Uploaded documents
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // Activity Timeline
  const [timeline, setTimeline] = useState<{ id: string; action: string; user: string; timestamp: string }[]>([]);

  // Attendance Session Logging State
  const [sessionLogDate, setSessionLogDate] = useState(() => todayISO());
  const [sessionTopic, setSessionTopic] = useState('Day 1: Orientation');
  const [sessionStatuses, setSessionStatuses] = useState<Record<string, 'present' | 'absent' | 'late' | 'leave'>>({});
  const [sessionLogsHistory, setSessionLogsHistory] = useState<{ id: string; date: string; topic: string; presentCount: number; absentCount: number; trainer: string }[]>([]);

  const handleSaveSessionAttendance = () => {
    const presentCount = Object.values(sessionStatuses).filter((st) => st === 'present' || st === 'late').length;
    const absentCount = Object.values(sessionStatuses).filter((st) => st === 'absent' || st === 'leave').length;

    setSessionLogsHistory((prev) => [
      { id: `sl-${Date.now()}`, date: sessionLogDate, topic: sessionTopic, presentCount, absentCount, trainer: 'Linto George' },
      ...prev,
    ]);

    setStudents((prev) =>
      prev.map((s) => {
        const st = sessionStatuses[s.id] || 'present';
        const delta = st === 'present' ? 2 : st === 'late' ? 0 : -3;
        const newPct = Math.min(100, Math.max(40, s.attendancePct + delta));
        return {
          ...s,
          attendancePct: newPct,
          attendanceStatus: (!considerAttendance || newPct >= attendanceThreshold) ? 'Regular' : newPct >= 70 ? 'Irregular' : 'Critical',
        };
      })
    );

    toast({
      variant: 'success',
      title: 'Session Attendance Logged',
      message: `Saved attendance sheet for ${sessionLogDate} (${presentCount} Present, ${absentCount} Absent).`,
    });
  };

  const handleMarkAllPresent = () => {
    const next: Record<string, 'present'> = {};
    students.forEach((s) => { next[s.id] = 'present'; });
    setSessionStatuses(next);
  };

  useEffect(() => {
    container.resolve(EMPLOYEE_SERVICE_TOKEN).listEmployees().then((res) => {
      if (res.ok) setTrainers(res.value);
    });
  }, []);

  const safeTrainers = Array.isArray(trainers) ? trainers : [];
  const safeBatches = useMemo(() => {
    const raw = Array.isArray(batches) ? batches : [];
    if (selectedTrainerId && selectedTrainerId !== 'all') {
      return raw.filter((b) => b && b.trainerId === selectedTrainerId);
    }
    return raw;
  }, [batches, isExecutive, selectedTrainerId, user]);
  const safeCourses = Array.isArray(courses) ? courses : [];

  useEffect(() => {
    if (safeBatches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(safeBatches[0].id);
    }
  }, [safeBatches, selectedBatchId]);

  const activeBatch = safeBatches.find((b) => b && b.id === selectedBatchId);
  const activeCourse = activeBatch ? safeCourses.find((c) => c && c.id === activeBatch.courseId) : null;
  const activeTrainer = activeBatch ? safeTrainers.find((t) => t && t.id === activeBatch.trainerId) : null;

  const studentsRef = useRef(students);
  const enrollmentsRef = useRef(enrollments);
  const activeBatchRef = useRef(activeBatch);

  useEffect(() => { studentsRef.current = students; }, [students]);
  useEffect(() => { enrollmentsRef.current = enrollments; }, [enrollments]);
  useEffect(() => { activeBatchRef.current = activeBatch; }, [activeBatch]);

  // Sync Course Max Marks and Pass Percentage from activeCourse
  useEffect(() => {
    if (activeCourse) {
      setCourseMaxMarks(activeCourse.maxMarks ?? 100);
      setCoursePassPct(activeCourse.passPercentage ?? 70);
    }
  }, [activeCourse]);

  const handleToggleCheck = (stage: string, itemId: string) => {
    const list = checklist[stage].map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    setChecklist((prev) => ({ ...prev, [stage]: list }));
    toast({ variant: 'success', title: 'Task Updated', message: 'Checklist parameter updated.' });
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const newLog: EmailHistoryItem = {
      id: `e-${Date.now()}`,
      to: emailTo,
      subject: emailSubject,
      sentAt: 'Just Now',
      status: 'Pending'
    };
    setEmailLogs([newLog, ...emailLogs]);
    setEmailComposerOpen(false);
    toast({
      variant: 'success',
      title: 'Email Dispatched',
      message: `Sent "${emailSubject}" to college coordinator at ${emailTo}.`,
    });
  };

  const handleOpenComposer = (subject: string, defaultBody: string) => {
    setEmailSubject(subject);
    setEmailBody(defaultBody);
    
    const emails = [];
    if (activeBatch?.coordinatorEmail) emails.push(activeBatch.coordinatorEmail);
    if (activeBatch?.coordinatorEmail2) emails.push(activeBatch.coordinatorEmail2);
    
    setEmailTo(emails.length > 0 ? emails.join(', ') : 'coordinator@christcollege.edu');
    setEmailComposerOpen(true);
  };

  /**
   * Quick actions on a carousel card. The card is made active first, then the
   * action either opens the mail composer or jumps to the matching workspace
   * section — everything stays on this page.
   */
  const handleCarouselAction = (batchId: string, action: BatchAction) => {
    setSelectedBatchId(batchId);
    switch (action.id) {
      case 'daily':
        if (canViewDailyReport) {
          setDailyReportPreviewOpen(true);
        } else {
          toast({ variant: 'warning', title: 'Access Denied', message: 'You do not have permission to view daily reports.' });
        }
        break;
      case 'final':
        handleOpenComposer('Final Course Completion Report', 'Attached is the final report...');
        break;
      case 'student':
        setShowFullStudentReport(true);
        break;
      case 'attendance':
        setActiveTab('attendance');
        break;
      case 'assessments':
        setActiveTab('assessments');
        break;
      case 'documents':
        setActiveTab('documents');
        break;
    }
  };

  const assignVoucherId = (studentId: string, val: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, voucherId: val, voucherStatus: val ? 'Assigned' : 'Unassigned' }
          : s
      )
    );
  };

  const notifyTrainerVoucher = async (studentName: string, voucherId: string) => {
    const student = students.find(s => s.name === studentName);
    if (!student) return;
    try {
      await supabase.from('flwdsk_email_logs').insert({
        student_id: student.id,
        batch_id: selectedBatchId || null,
        recipient: student.email || 'student@example.com',
        subject: `Exam Voucher for ${activeBatch?.trainingName || 'Course'}`,
        mail_type: 'Voucher Mail',
        status: 'Sent',
        sent_by: user?.id || null
      });

      const { data: v } = await supabase
        .from('flwdsk_vouchers')
        .select('id')
        .eq('student_id', student.id)
        .eq('voucher_type', 'Initial')
        .maybeSingle();

      if (v) {
        await updateVoucherSentStatus(v.id, 'Sent');
      }

      toast({
        variant: 'success',
        title: 'Voucher Notified',
        message: `Voucher notification for "${studentName}" (${voucherId || 'Pending'}) dispatched successfully.`,
      });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Notification Failed', message: err.message });
    }
  };

  /** Generate a clean, spacious A4 Student Performance Report (crisp vector PDF). */
  const downloadPDF = () => {
    const list = filteredStudents;
    if (!list || list.length === 0) {
      toast({
        variant: 'warning',
        title: 'No Students Found',
        message: 'Cannot generate a performance report for a batch with no students.'
      });
      return;
    }
    const b = activeBatch;
    const trainerName = activeTrainer ? `${activeTrainer.firstName} ${activeTrainer.lastName}` : 'N/A';

    const batchName = b?.trainingName || b?.batchNo || b?.code || 'Training Batch';
    const batchCode = b?.code || b?.batchNo || 'BATCH';
    const college = b?.college || '—';
    const program = b?.program || '—';
    const academicYear = b?.academicYear || '—';
    const startDate = String(b?.startDate || '—');
    const endDate = String(b?.endDate || '—');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();   // 210
    const pageH = doc.internal.pageSize.getHeight();  // 297
    const M = 20;                                     // 20mm margins
    const contentW = pageW - M * 2;
    let y = M;

    // ── HEADER ──
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(0, 0, 0);
    doc.text('Student Performance Report', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(85, 85, 85);
    doc.text(`${batchName}  ·  ${college}`, pageW / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(10); doc.setTextColor(119, 119, 119);
    doc.text(`Academic Year: ${academicYear}    ·    Program: ${program}`, pageW / 2, y, { align: 'center' });
    y += 8;
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
    doc.line(M, y, pageW - M, y);
    y += 8;

    // ── BATCH INFO BOX ──
    const boxH = 26;
    doc.setFillColor(245, 245, 245);
    doc.rect(M, y, contentW, boxH, 'F');
    const colLx = M + 8;
    const colRx = M + contentW / 2 + 8;
    const infoRow = (x: number, yy: number, label: string, value: string) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(51, 51, 51);
      doc.text(label, x, yy);
      doc.setFont('helvetica', 'normal');
      doc.text(value, x + 28, yy);
    };
    let by = y + 8;
    infoRow(colLx, by, 'Trainer:', trainerName); infoRow(colRx, by, 'College:', college); by += 6;
    infoRow(colLx, by, 'Start Date:', startDate); infoRow(colRx, by, 'Program:', program); by += 6;
    infoRow(colLx, by, 'End Date:', endDate); infoRow(colRx, by, 'Total Students:', String(list.length));
    y += boxH + 6;

    // ── SUMMARY STATS ──
    const total = list.length;
    const eligible = list.filter((s) => !considerAttendance || s.attendancePct >= attendanceThreshold).length;
    const avgAtt = total ? Math.round(list.reduce((a, s) => a + (s.attendancePct || 0), 0) / total) : 0;
    const avgOverall = total ? Math.round(list.reduce((a, s) => a + (s.overallScore || 0), 0) / total) : 0;
    const stats = [
      { n: String(total), l: 'Total Students' },
      { n: String(eligible), l: 'Eligible for Voucher' },
      { n: `${avgAtt}%`, l: 'Avg Attendance' },
      { n: String(avgOverall), l: 'Avg Overall Score' },
    ];
    const gap = 4;
    const sw = (contentW - gap * 3) / 4;
    const sh = 18;
    stats.forEach((st, i) => {
      const sx = M + i * (sw + gap);
      doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.3);
      doc.rect(sx, y, sw, sh);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 41, 59);
      doc.text(st.n, sx + sw / 2, y + 8, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text(st.l, sx + sw / 2, y + 14, { align: 'center' });
    });
    y += sh + 8;

    // ── STUDENT TABLE ──
    const body = list.map((s, i) => [
      String(i + 1),
      s.name || '—',
      s.phone || '—',
      `${s.attendancePct !== undefined && s.attendancePct !== null ? s.attendancePct : 0}%`,
      String(s.ass1 ?? 0),
      String(s.ass2 ?? 0),
      String(s.ass3 ?? 0),
      String(s.overallScore ?? 0),
      s.voucherStatus || 'Unassigned',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Name', 'Phone', 'Attendance %', 'Ass 1', 'Ass 2', 'Ass 3', 'Overall', 'Voucher Status']],
      body,
      margin: { left: M, right: M, bottom: M },
      styles: { font: 'helvetica', fontSize: 12, cellPadding: 2.6, textColor: [26, 26, 26], minCellHeight: 9, valign: 'middle', lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 12, minCellHeight: 9, halign: 'center' },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        0: { cellWidth: 6, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 24 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 16, halign: 'center' },
        8: { cellWidth: 26, halign: 'center' },
      },
      didParseCell: (d: any) => {
        if (d.section !== 'body') return;
        const s = list[d.row.index];
        if (!s) return;
        if (d.column.index === 3) {
          d.cell.styles.textColor = (!considerAttendance || s.attendancePct >= attendanceThreshold) ? [22, 163, 74] : [220, 38, 38];
          d.cell.styles.fontStyle = 'bold';
        }
        if (d.column.index === 8) {
          const v = (s.voucherStatus || '').toLowerCase();
          d.cell.styles.textColor = v === 'assigned' ? [22, 163, 74] : v.includes('pend') ? [217, 119, 6] : [120, 120, 120];
        }
      },
    });

    // ── FOOTER on every page (with accurate "Page X of Y") ──
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const fy = pageH - 12;
      doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.3);
      doc.line(M, fy - 3, pageW - M, fy - 3);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(153, 153, 153);
      doc.text('KVJ Platform | Confidential', M, fy);
      doc.text(batchCode, pageW / 2, fy, { align: 'center' });
      doc.text(`Page ${p} of ${totalPages}`, pageW - M, fy, { align: 'right' });
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const fileName = `${batchCode}_Student_Report_${dd}${mm}${now.getFullYear()}.pdf`;
    doc.save(fileName);
    toast({ variant: 'success', title: 'PDF Downloaded', message: `Student report for ${batchName} generated.` });
  };

  // Calculating overall metrics
  const eligibleCount = students.filter((s) => !considerAttendance || s.attendancePct >= attendanceThreshold).length;
  const attendanceAvg = students.length ? Math.round(students.reduce((acc, s) => acc + s.attendancePct, 0) / students.length) : 0;
  const scoreAvg = students.length ? Math.round(students.reduce((acc, s) => acc + s.overallScore, 0) / students.length) : 0;

  // Dedicated Full Page for Student Data Matrix
  if (showFullStudentReport) {
    return (
      <AppShell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowFullStudentReport(false)}
                style={{ marginBottom: 10 }}
              >
                ← Back to Batch Overview
              </Button>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                📊 Students Performance & Exam Eligibility Matrix
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Active Batch: <strong>{cleanBatchCode(activeBatch?.code, activeBatch?.batchNo) || 'Christ 3BBA Data Analytics B1'}</strong> ({activeBatch?.college || 'Christ College'}) · Minimum attendance for voucher: <strong>{considerAttendance ? `${attendanceThreshold}%` : 'Not considered'}</strong>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {canViewDailyReport && (
                <Button size="sm" onClick={() => setDailyReportBuilderOpen(true)}>
                  📊 Daily Report
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={downloadVoucherTemplate}>
                📥 Download Voucher Template (3 Fields)
              </Button>
              <Button size="sm" onClick={() => setUploadVoucherModalOpen(true)}>
                📤 Upload Voucher File
              </Button>
              <Button size="sm" onClick={() => setUploadModalOpen(true)}>
                📤 Upload Students Data
              </Button>
              <Button size="sm" onClick={() => setAddStudentModalOpen(true)}>
                ➕ Add Student Data
              </Button>
              <Button size="sm" onClick={() => setBulkEmailOpen(true)}>
                ✉️ Send Emails
              </Button>
              <Button size="sm" variant="secondary" onClick={downloadPDF}>
                📄 Download PDF
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowFullStudentReport(false)}>
                Close Workspace
              </Button>
            </div>
          </div>

          {/* Sub-Tabs Bar */}
          <div style={{ display: 'flex', gap: 10, borderBottom: '1.5px solid var(--border)', paddingBottom: 10 }}>
            {[
              { id: 'matrix', label: '📊 Performance Matrix' },
              { id: 'attendance', label: '📝 Attendance' },
              { id: 'final-exam', label: '🎓 Final Exam' },
              { id: 'retest', label: '🔄 Retest' },
              { id: 'registration', label: '📋 Registration' },
              { id: 'certificates', label: '📜 Certificate Receipt' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStudentSubTab(tab.id as any)}
                style={{
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: studentSubTab === tab.id ? '1px solid var(--brand)' : '1px solid var(--border)',
                  background: studentSubTab === tab.id ? 'var(--brand)' : 'var(--bg-sunken)',
                  color: studentSubTab === tab.id ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* SUB TAB 1: PERFORMANCE MATRIX */}
          {studentSubTab === 'matrix' && (
            <Card style={{ padding: 0, overflow: 'hidden' }}>

              {/* ─── Toolbar: Filter + Sort Button + Eligibility Config ─── */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
                {/* Row 1: Filter + Sort Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  {/* Left: Filter */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>🔍 Filter:</span>
                      <select
                        className="kvj-input"
                        value={matrixEligFilter}
                        onChange={(e) => setMatrixEligFilter(e.target.value as EligibilityFilter)}
                        style={{ fontSize: 12, padding: '4px 8px', minWidth: 130, fontWeight: 600 }}
                      >
                        <option value="all">All Students</option>
                        <option value="eligible">✅ Eligible Only</option>
                        <option value="not-eligible">❌ Not Eligible Only</option>
                      </select>
                    </div>
                    {isExecutive && (
                      <button
                        type="button"
                        onClick={() => dedupeBatchStudents()}
                        title="Find and remove students enrolled more than once (by phone number)"
                        style={{
                          fontSize: 12, padding: '5px 12px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
                          background: 'transparent', color: 'var(--status-danger)',
                          border: '1px solid var(--status-danger)',
                        }}
                      >
                        🧹 Remove Duplicates
                      </button>
                    )}
                    {isExecutive && selectedMatrixIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleBatchRemoveStudents}
                        disabled={batchRemovingMatrix}
                        title="Remove all selected students from this batch"
                        style={{
                          fontSize: 12, padding: '5px 14px', borderRadius: 6, fontWeight: 700,
                          cursor: batchRemovingMatrix ? 'not-allowed' : 'pointer',
                          background: 'var(--status-danger)', color: '#fff',
                          border: '1px solid var(--status-danger)',
                          display: 'flex', alignItems: 'center', gap: 6,
                          opacity: batchRemovingMatrix ? 0.7 : 1,
                        }}
                      >
                        {batchRemovingMatrix
                          ? `⏳ Removing ${selectedMatrixIds.size}…`
                          : `🗑️ Delete Selected (${selectedMatrixIds.size})`}
                      </button>
                    )}
                  </div>

                  {/* Right: Action Buttons (Eligibility + Sort) */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

                    <button
                      type="button"
                      onClick={() => {
                        setShowEligibilityPanel((p) => !p);
                        if (showSortPanel) setShowSortPanel(false);
                      }}
                      style={{
                        fontSize: 12, padding: '5px 14px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
                        border: showEligibilityPanel ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                        background: showEligibilityPanel ? 'var(--brand)' : 'var(--bg-surface)',
                        color: showEligibilityPanel ? '#fff' : 'var(--text-primary)',
                        transition: 'all 150ms',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      ⚙️ Eligibility Criteria {showEligibilityPanel ? '▲' : '▼'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSortPanel((p) => !p);
                        if (showEligibilityPanel) setShowEligibilityPanel(false);
                      }}
                      style={{
                        fontSize: 12, padding: '5px 14px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
                        border: matrixSortLevels.length > 0 ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                        background: matrixSortLevels.length > 0 ? 'var(--brand)' : 'var(--bg-surface)',
                        color: matrixSortLevels.length > 0 ? '#fff' : 'var(--text-primary)',
                        transition: 'all 150ms',
                      }}
                    >
                      ↕ Sort {matrixSortLevels.length > 0 ? `(${matrixSortLevels.length} level${matrixSortLevels.length > 1 ? 's' : ''})` : ''}
                    </button>
                  </div>
                </div>

                {/* ─── Eligibility Panel (collapsible, compact 2-column layout) ─── */}
                {showEligibilityPanel && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 10, border: '1px solid var(--brand)', background: 'var(--bg-surface)', maxWidth: 640, marginLeft: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <strong style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>⚙️ Final Exam Eligibility Criteria</strong>
                      <button
                        type="button"
                        onClick={handleAddEligCriterion}
                        disabled={eligibilityCriteria.length >= 3}
                        style={{ fontSize: 12, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--brand)', background: 'var(--brand)', color: '#fff', cursor: eligibilityCriteria.length >= 3 ? 'not-allowed' : 'pointer', opacity: eligibilityCriteria.length >= 3 ? 0.5 : 1 }}
                      >
                        ➕ Add Assessment
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {/* Attendance row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', flex: '1 1 270px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={considerAttendance}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setConsiderAttendance(checked);
                              saveEligibilityConfig(checked, attendanceThreshold, eligibilityCriteria);
                            }}
                          />
                          📊 Attendance
                        </label>
                        {considerAttendance && (
                          <>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>≥</span>
                            <input
                              type="number"
                              className="kvj-input"
                              value={attendanceThreshold}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setAttendanceThreshold(val);
                                saveEligibilityConfig(considerAttendance, val, eligibilityCriteria);
                              }}
                              min={0}
                              max={100}
                              style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                          </>
                        )}
                        {!considerAttendance && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8, fontStyle: 'italic' }}>(Not Considered)</span>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 'auto' }}>default: 84%</span>
                      </div>

                      {/* Course Max Marks & Pass % Criteria row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', flex: '1 1 270px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>🎓 Max Marks</span>
                        <input
                          type="number"
                          className="kvj-input"
                          value={courseMaxMarks}
                          onChange={(e) => setCourseMaxMarks(Number(e.target.value))}
                          min={1}
                          style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                        />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 6 }}>Pass %</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>≥</span>
                        <input
                          type="number"
                          className="kvj-input"
                          value={coursePassPct}
                          onChange={(e) => setCoursePassPct(Number(e.target.value))}
                          min={0}
                          max={100}
                          style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                        />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 'auto' }}>
                          Pass: {Math.round((courseMaxMarks * coursePassPct) / 100)}m
                        </span>
                      </div>

                      {/* Assessment criteria rows */}
                      {eligibilityCriteria.map((crit, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', flex: '1 1 270px' }}>
                          <select
                            className="kvj-input"
                            value={crit.assessment}
                            onChange={(e) => handleUpdateEligCriterion(idx, 'assessment', e.target.value as SortableCol)}
                            style={{ fontSize: 12, padding: '3px 6px', fontWeight: 600 }}
                          >
                            {(['ass1', 'ass2', 'ass3'] as SortableCol[]).map((a) => (
                              <option key={a} value={a} disabled={eligibilityCriteria.some((c, i) => i !== idx && c.assessment === a)}>
                                {assessmentLabelMap[a]}
                              </option>
                            ))}
                          </select>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>≥</span>
                          <input
                            type="number"
                            className="kvj-input"
                            value={crit.threshold}
                            onChange={(e) => handleUpdateEligCriterion(idx, 'threshold', Number(e.target.value))}
                            min={0}
                            max={100}
                            style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>marks</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEligCriterion(idx)}
                            style={{ fontSize: 13, padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--status-danger)', marginLeft: 'auto' }}
                          >🗑️</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── Sort Panel (collapsible, compact right-aligned layout) ─── */}
                {showSortPanel && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 10, border: '1px solid var(--brand)', background: 'var(--bg-surface)', maxWidth: 640, marginLeft: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <strong style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>↕ Multi-Level Sort Configuration</strong>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {matrixSortLevels.length > 0 && (
                          <button type="button" onClick={() => setMatrixSortLevels([])} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-sunken)', cursor: 'pointer', color: 'var(--status-danger)' }}>
                            ✕ Clear All
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleAddSortLevel}
                          disabled={matrixSortLevels.length >= allSortableCols.length}
                          style={{ fontSize: 12, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--brand)', background: 'var(--brand)', color: '#fff', cursor: matrixSortLevels.length >= allSortableCols.length ? 'not-allowed' : 'pointer', opacity: matrixSortLevels.length >= allSortableCols.length ? 0.5 : 1 }}
                        >
                          ➕ Add Level
                        </button>
                      </div>
                    </div>

                    {matrixSortLevels.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>No sort levels configured. Click "➕ Add Level" to start.</div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {matrixSortLevels.map((lvl, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', minWidth: 50 }}>Level {idx + 1}</span>
                          <select
                            className="kvj-input"
                            value={lvl.col}
                            onChange={(e) => handleUpdateSortLevel(idx, 'col', e.target.value)}
                            style={{ fontSize: 12, padding: '3px 6px', flex: 1, fontWeight: 600 }}
                          >
                            {allSortableCols.map((c) => (
                              <option key={c} value={c} disabled={matrixSortLevels.some((l, i) => i !== idx && l.col === c)}>
                                {assessmentLabelMap[c]}
                              </option>
                            ))}
                          </select>
                          <select
                            className="kvj-input"
                            value={lvl.dir}
                            onChange={(e) => handleUpdateSortLevel(idx, 'dir', e.target.value)}
                            style={{ fontSize: 12, padding: '3px 6px', minWidth: 110, fontWeight: 600 }}
                          >
                            <option value="asc">Ascending ▲</option>
                            <option value="desc">Descending ▼</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveSortLevel(idx)}
                            style={{ fontSize: 13, padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--status-danger)' }}
                          >🗑️</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* ─── Table ─── */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)' }}>
                      {isExecutive && (
                        <th style={{ padding: 12, textAlign: 'center', width: 40 }}>
                          <input
                            type="checkbox"
                            title="Select all"
                            checked={(() => {
                              const filtered = students.filter((s) => {
                                if (selectedBatchId && !batchStudentIds.has(s.id)) return false;
                                if (matrixEligFilter === 'all') return true;
                                const elig = isStudentEligible(s);
                                return matrixEligFilter === 'eligible' ? elig : !elig;
                              });
                              return filtered.length > 0 && filtered.every((s) => selectedMatrixIds.has(s.id));
                            })()}
                            onChange={() => {
                              const filtered = students.filter((s) => {
                                if (selectedBatchId && !batchStudentIds.has(s.id)) return false;
                                if (matrixEligFilter === 'all') return true;
                                const elig = isStudentEligible(s);
                                return matrixEligFilter === 'eligible' ? elig : !elig;
                              });
                              const isAllSelected = filtered.length > 0 && filtered.every((s) => selectedMatrixIds.has(s.id));
                              setSelectedMatrixIds((prev) => {
                                const next = new Set(prev);
                                if (isAllSelected) {
                                  filtered.forEach((s) => next.delete(s.id));
                                } else {
                                  filtered.forEach((s) => next.add(s.id));
                                }
                                return next;
                              });
                            }}
                            style={{ cursor: 'pointer', width: 15, height: 15 }}
                          />
                        </th>
                      )}
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 65 }}>Photo</th>
                      <th style={{ padding: 12, position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 10, minWidth: 160, textAlign: 'left' }}>Student Name</th>
                      <th style={{ padding: 12, textAlign: 'left', minWidth: 120 }}>Phone</th>
                      <th style={{ padding: 12, textAlign: 'left', minWidth: 160 }}>Email</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 80 }}>Attendance</th>
                      <th style={{ padding: 12, textAlign: 'left', minWidth: 130 }}>Exam Eligibility</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 70 }}>Ass 1</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 70 }}>Ass 2</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 70 }}>Ass 3</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 80 }}>Final Exam</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 155 }}>Final Result</th>
                      <th style={{ padding: 12, minWidth: 240, textAlign: 'left' }}>Voucher ID Management</th>
                      {isExecutive && <th style={{ padding: 12, textAlign: 'center', minWidth: 70 }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                       let filtered = students.filter((s) => {
                        if (selectedBatchId && !batchStudentIds.has(s.id)) return false;
                        if (matrixEligFilter === 'all') return true;
                        const elig = isStudentEligible(s);
                        return matrixEligFilter === 'eligible' ? elig : !elig;
                      });

                      // 2. Multi-level Sort
                      if (matrixSortLevels.length > 0) {
                        filtered = [...filtered].sort((a, b) => {
                          for (const lvl of matrixSortLevels) {
                            const valA = a[lvl.col] as number;
                            const valB = b[lvl.col] as number;
                            if (valA !== valB) return lvl.dir === 'asc' ? valA - valB : valB - valA;
                          }
                          return 0;
                        });
                      }

                      return filtered.map((s) => {
                        const eligible = isStudentEligible(s);
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', background: selectedMatrixIds.has(s.id) ? 'color-mix(in srgb, var(--brand) 8%, transparent)' : undefined }}>
                            {isExecutive && (
                              <td style={{ padding: '8px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedMatrixIds.has(s.id)}
                                  onChange={() => {
                                    setSelectedMatrixIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                                      return next;
                                    });
                                  }}
                                  style={{ cursor: 'pointer', width: 15, height: 15 }}
                                />
                              </td>
                            )}
                            {/* Photo Thumbnail Column */}
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {s.photoUrl ? (
                                <img
                                  src={s.photoUrl}
                                  alt={s.name}
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '1.5px solid var(--brand)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
                                    display: 'inline-block',
                                    verticalAlign: 'middle',
                                  }}
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                    const fallback = (e.target as HTMLElement).nextElementSibling;
                                    if (fallback) (fallback as HTMLElement).style.display = 'inline-flex';
                                  }}
                                />
                              ) : null}
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  background: 'var(--bg-sunken)',
                                  border: '1px solid var(--border)',
                                  display: s.photoUrl ? 'none' : 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: 13,
                                  color: 'var(--brand)',
                                  margin: '0 auto',
                                }}
                              >
                                {s.name ? s.name.charAt(0) : '👤'}
                              </div>
                            </td>

                            {/* Student Name (editable) */}
                            <td style={{ padding: 12, fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  type="text"
                                  className="kvj-input"
                                  value={s.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, name: val } : st));
                                  }}
                                  style={{ fontSize: 12, padding: '3px 8px', fontWeight: 700, border: '1px dashed var(--border)', background: 'transparent', width: 130, borderRadius: 5 }}
                                  onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--brand)'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                                  onBlur={(e) => {
                                    e.currentTarget.style.border = '1px dashed var(--border)';
                                    e.currentTarget.style.background = 'transparent';
                                    saveStudentToDb(s);
                                  }}
                                />
                              </div>
                            </td>

                            {/* Phone (editable) */}
                            <td style={{ padding: 12 }}>
                              <input
                                type="text"
                                className="kvj-input"
                                value={s.phone}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, phone: val } : st));
                                }}
                                style={{ fontSize: 12, padding: '3px 8px', width: 120, color: 'var(--text-primary)', border: '1px dashed var(--border)', background: 'transparent', borderRadius: 5 }}
                                onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--brand)'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                                onBlur={(e) => {
                                  e.currentTarget.style.border = '1px dashed var(--border)';
                                  e.currentTarget.style.background = 'transparent';
                                  saveStudentToDb(s);
                                }}
                              />
                            </td>

                            {/* Email (editable) */}
                            <td style={{ padding: 12 }}>
                              <input
                                type="text"
                                className="kvj-input"
                                value={s.email}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, email: val } : st));
                                }}
                                style={{ fontSize: 12, padding: '3px 8px', width: 160, border: '1px dashed var(--border)', background: 'transparent', borderRadius: 5 }}
                                onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--brand)'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                                onBlur={(e) => {
                                  e.currentTarget.style.border = '1px dashed var(--border)';
                                  e.currentTarget.style.background = 'transparent';
                                  saveStudentToDb(s);
                                }}
                              />
                            </td>

                            {/* Attendance */}
                            <td style={{ padding: 12, textAlign: 'center' }}>
                              <strong style={{ color: !considerAttendance ? 'var(--text-primary)' : s.attendancePct >= attendanceThreshold ? 'var(--status-success)' : 'var(--status-danger)' }}>
                                {s.attendancePct}%
                              </strong>
                            </td>

                            {/* Exam Eligibility (dynamic) */}
                            <td style={{ padding: 12 }}>
                              <Badge tone={eligible ? 'success' : 'danger'}>
                                {eligible ? 'Eligible' : 'Not Eligible'}
                              </Badge>
                              {!eligible && (
                                <div style={{ fontSize: 12, color: 'var(--status-danger)', marginTop: 2 }}>
                                  {getEligibilityReason(s)}
                                </div>
                              )}
                            </td>

                            {/* Ass 1 */}
                            <td style={{ padding: 12, textAlign: 'center' }}>{s.ass1}</td>
                            {/* Ass 2 */}
                            <td style={{ padding: 12, textAlign: 'center' }}>{s.ass2}</td>
                            {/* Ass 3 */}
                            <td style={{ padding: 12, textAlign: 'center' }}>{s.ass3}</td>
                            {/* Final Exam */}
                            <td style={{ padding: 12, textAlign: 'center' }}>{s.finalExam || '—'}</td>

                            {/* Final Result & Course Checklist */}
                            <td style={{ padding: 12, textAlign: 'center', position: 'relative' }}>
                              {(() => {
                                const attendanceOk = s.attendancePct >= attendanceThreshold;
                                const hasTakenExam = (s.finalExam || 0) > 0 || (s.retestScore || 0) > 0;
                                const examScore = Math.max(s.finalExam || 0, s.retestScore || 0);
                                const requiredPassScore = Math.round((courseMaxMarks * coursePassPct) / 100);
                                const isCoursePassed = hasTakenExam && examScore >= requiredPassScore;
                                const isCourseFailed = hasTakenExam && examScore < requiredPassScore;
                                const isShowChecklist = activeChecklistStudentId === s.id;

                                return (
                                  <>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                      <Badge tone={isCoursePassed ? 'success' : isCourseFailed ? 'danger' : 'warning'}>
                                        {isCoursePassed ? 'Passed' : isCourseFailed ? 'Failed' : 'Not Attended'}
                                      </Badge>
                                      <button
                                        type="button"
                                        title="View Course Pass Details & Checklist"
                                        onClick={() => setActiveChecklistStudentId(isShowChecklist ? null : s.id)}
                                        style={{
                                          border: isShowChecklist ? '1px solid var(--brand)' : '1px solid var(--border)',
                                          background: isShowChecklist ? 'var(--brand)' : 'var(--bg-sunken)',
                                          color: isShowChecklist ? '#fff' : 'var(--text-primary)',
                                          cursor: 'pointer',
                                          fontSize: 12, padding: '2px 6px', borderRadius: 5,
                                          fontWeight: 600, transition: 'all 120ms',
                                        }}
                                      >
                                        📋
                                      </button>
                                    </div>

                                    {/* Course Pass Criteria & Execution Checklist Details Popover */}
                                    {isShowChecklist && (
                                      <div
                                        style={{
                                          position: 'absolute', top: '100%', right: 10, zIndex: 100,
                                          background: 'var(--bg-surface)', border: '1.5px solid var(--brand)',
                                          borderRadius: 8, padding: 12, width: 275, textAlign: 'left',
                                          boxShadow: '0 8px 24px rgba(0,0,0,0.18)', marginTop: 4
                                        }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                          <strong style={{ fontSize: 12, color: 'var(--text-primary)' }}>📋 Pass Criteria & Course Tasks</strong>
                                          <button
                                            type="button"
                                            onClick={() => setActiveChecklistStudentId(null)}
                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}
                                          >
                                            ✕
                                          </button>
                                        </div>

                                        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: (hasTakenExam && examScore >= requiredPassScore) ? 'var(--status-success)' : 'var(--status-danger)' }}>
                                            <span>{(hasTakenExam && examScore >= requiredPassScore) ? '✅' : '❌'}</span>
                                            <span>Final Exam: <strong>{hasTakenExam ? `${examScore} / ${courseMaxMarks} marks (${Math.round((examScore / courseMaxMarks) * 100)}%)` : 'Not Attended'}</strong> (Pass: {requiredPassScore}m / {coursePassPct}%)</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: attendanceOk ? 'var(--status-success)' : 'var(--status-danger)' }}>
                                            <span>{attendanceOk ? '✅' : '❌'}</span>
                                            <span>Attendance: <strong>{s.attendancePct}%</strong> (Target: ≥{attendanceThreshold}%)</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: eligible ? 'var(--status-success)' : 'var(--status-danger)' }}>
                                            <span>{eligible ? '✅' : '❌'}</span>
                                            <span>Assessments Met: <strong>{eligible ? 'Passed' : 'Failed'}</strong></span>
                                          </div>

                                          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                                            <em>Pass Criteria set in Course Catalog ({coursePassPct}% of {courseMaxMarks} Max Marks).</em>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </td>

                            {/* Voucher ID Management */}
                            <td style={{ padding: 12 }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="text"
                                  className="kvj-input"
                                  style={{ padding: '4px 8px', fontSize: 12, width: 140 }}
                                  value={s.voucherId}
                                  onChange={(e) => assignVoucherId(s.id, e.target.value)}
                                  placeholder="Assign Voucher ID"
                                />
                                <Button
                                  size="sm"
                                  style={{ padding: '4px 8px', fontSize: 12 }}
                                  onClick={() => notifyTrainerVoucher(s.name, s.voucherId)}
                                >
                                  Notify
                                </Button>
                              </div>
                            </td>
                            {isExecutive && (
                              <td style={{ padding: 12, textAlign: 'center' }}>
                                {confirmRemoveStudentId === s.id ? (
                                  <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'stretch', minWidth: 150, background: 'var(--bg-panel)', border: '1px solid var(--status-danger-border)', borderRadius: 8, padding: 8, boxShadow: 'var(--e2)' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Remove <strong>{s.name}</strong> from batch?</span>
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                      <button type="button" onClick={() => setConfirmRemoveStudentId(null)} style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                                      <button type="button" onClick={() => handleRemoveStudentFromBatch(s)} style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 5, border: 'none', background: 'var(--status-danger)', color: '#fff', cursor: 'pointer' }}>Remove</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    title="Remove student from this batch"
                                    onClick={() => setConfirmRemoveStudentId(s.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
                                  >
                                    🗑️
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* SUB TAB 2: MULTI-DATE ATTENDANCE MATRIX */}
          {studentSubTab === 'attendance' && (
            <Card style={{ padding: 18, overflow: 'hidden' }}>
              {/* Header Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>📅 Hour-Based Multi-Date Attendance Session Matrix</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Displaying dates and hour sessions (Hour 1, 2, 3...). Click date/hour to edit header, or click ➕ Add Hour Column.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button size="sm" onClick={handleAddHourSessionColumn}>
                    ➕ Add Hour Column
                  </Button>
                </div>
              </div>

              {/* Multi-Date Matrix Table with Sticky Headers & Freeze Panes */}
              <div style={{ overflow: 'auto', maxHeight: '72vh' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                      {/* Frozen Heading 1: Phone Number */}
                      <th style={{
                        padding: 12,
                        position: 'sticky',
                        top: 0,
                        left: 0,
                        background: 'var(--bg-sunken)',
                        zIndex: 30,
                        minWidth: 140,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      }}>
                        Phone Number
                      </th>

                      {/* Frozen Heading 2: Name */}
                      <th style={{
                        padding: 12,
                        position: 'sticky',
                        top: 0,
                        left: 140,
                        background: 'var(--bg-sunken)',
                        zIndex: 30,
                        minWidth: 160,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      }}>
                        Name
                      </th>

                      {/* Frozen Heading 3: Attendance % (Separator shadow) */}
                      <th style={{
                        padding: 12,
                        position: 'sticky',
                        top: 0,
                        left: 300,
                        background: 'var(--bg-sunken)',
                        zIndex: 30,
                        minWidth: 120,
                        textAlign: 'center',
                        borderRight: '2px solid var(--border)',
                        boxShadow: '3px 2px 6px -2px rgba(0,0,0,0.12)',
                      }}>
                        Overall Attn %
                      </th>

                      {/* Dynamic Editable Date & Hour Heading Columns with Top Summary Stats */}
                      {attendanceSessions.map((col, idx) => {
                        // Calculate Session Summary Metrics (Present, Absent, % for this session)
                        let presentCount = 0;
                        let absentCount = 0;
                        students.forEach((st) => {
                          const status = attendanceMatrix[st.id]?.[col.id] || 'present';
                          if (status === 'absent') absentCount++;
                          else presentCount++;
                        });
                        const totalStudents = students.length;
                        const sessionPct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

                        return (
                          <th key={col.id} style={{
                            padding: '10px 10px',
                            textAlign: 'center',
                            minWidth: 165,
                            position: 'sticky',
                            top: 0,
                            background: 'var(--bg-sunken)',
                            zIndex: 20,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                          }}>
                            {/* Session Header Top Bar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                Session {idx + 1}
                              </span>
                              <button
                                type="button"
                                title="Delete this session column"
                                onClick={() => handleDeleteSessionColumn(col.id)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--status-danger)',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  padding: '0 2px',
                                  lineHeight: 1,
                                }}
                              >
                                🗑️
                              </button>
                            </div>

                            {/* Date Picker & Bracketed Hour Selector Side by Side */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                              <input
                                type="date"
                                className="kvj-input"
                                value={col.date}
                                onChange={(e) => handleUpdateSessionDate(col.id, e.target.value)}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  padding: '2px 4px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-surface)',
                                  color: 'var(--text-primary)',
                                  textAlign: 'center',
                                  cursor: 'pointer',
                                  flex: 1,
                                  minWidth: 105,
                                }}
                              />
                              <select
                                value={col.hour}
                                onChange={(e) => handleUpdateSessionHour(col.id, Number(e.target.value))}
                                title="Select Hour Number"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  padding: '2px 4px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-surface)',
                                  color: 'var(--brand)',
                                  cursor: 'pointer',
                                }}
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                                  <option key={h} value={h}>
                                    ({h})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Session Summary Card: Present/Absent Badges + Percentage + Green Progress Bar */}
                            <div style={{
                              background: 'var(--bg-surface)',
                              borderRadius: 8,
                              padding: '5px 8px',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 5,
                              alignItems: 'center',
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                width: '100%',
                              }}>
                                <span style={{
                                  color: 'var(--status-success, var(--status-success))',
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  padding: '2px 5px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  fontWeight: 800,
                                }} title={`${presentCount} Present`}>
                                  🟢 {presentCount}
                                </span>
                                <span style={{
                                  color: 'var(--status-danger, var(--status-danger))',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  padding: '2px 5px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  fontWeight: 800,
                                }} title={`${absentCount} Absent`}>
                                  🔴 {absentCount}
                                </span>
                                <span style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: sessionPct >= 80 ? 'var(--status-success, var(--status-success))' : 'var(--status-danger, var(--status-danger))',
                                  marginLeft: 2,
                                }}>
                                  {sessionPct}%
                                </span>
                              </div>

                              {/* Sleek Green Progress Bar */}
                              <div style={{
                                width: '100%',
                                height: 5,
                                borderRadius: 999,
                                background: 'rgba(0,0,0,0.06)',
                                overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: `${sessionPct}%`,
                                  height: '100%',
                                  borderRadius: 999,
                                  background: sessionPct >= 80 ? 'linear-gradient(90deg, var(--status-success), #34d399)' : 'linear-gradient(90deg, var(--status-danger), #f87171)',
                                  transition: 'width 300ms ease-in-out',
                                }} />
                              </div>
                            </div>
                          </th>
                        );
                      })}

                      <th style={{
                        padding: 12,
                        textAlign: 'center',
                        minWidth: 140,
                        position: 'sticky',
                        top: 0,
                        background: 'var(--bg-sunken)',
                        zIndex: 20,
                      }}>
                        <Button size="sm" variant="secondary" onClick={handleAddHourSessionColumn} style={{ fontSize: 12, padding: '4px 8px' }}>
                          ➕ Add Hour Column
                        </Button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.filter((s) => !selectedBatchId || batchStudentIds.has(s.id)).map((s) => {
                      const studentRecord = attendanceMatrix[s.id] || {};
                      const eligible = !considerAttendance || s.attendancePct >= attendanceThreshold;

                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          {/* Frozen 1. Phone Number */}
                          <td style={{ padding: 12, position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2, color: 'var(--text-muted)' }}>
                            {s.phone}
                          </td>

                          {/* Frozen 2. Name */}
                          <td style={{ padding: 12, position: 'sticky', left: 140, background: 'var(--bg-surface)', zIndex: 2, fontWeight: 700 }}>
                            {s.photo} {s.name}
                          </td>

                          {/* Frozen 3. Attendance % (Separator shadow) */}
                          <td style={{
                            padding: 12,
                            position: 'sticky',
                            left: 300,
                            background: 'var(--bg-surface)',
                            zIndex: 2,
                            textAlign: 'center',
                            borderRight: '2px solid var(--border)',
                            boxShadow: '3px 0 6px -2px rgba(0,0,0,0.1)',
                          }}>
                            <Badge tone={eligible ? 'success' : 'danger'}>
                              {s.attendancePct}%
                            </Badge>
                          </td>

                          {/* 4. Session Date & Hour Status Buttons */}
                          {attendanceSessions.map((col) => {
                            const status = studentRecord[col.id] || 'present';
                            const badgeBg = status === 'present'
                              ? 'var(--status-success, var(--status-success))'
                              : status === 'absent'
                              ? 'var(--status-danger, var(--status-danger))'
                              : 'var(--status-warning, var(--status-warning))';

                            const badgeText = status === 'present'
                              ? '🟢 Present'
                              : status === 'absent'
                              ? '🔴 Absent'
                              : '🟡 Late';

                            return (
                              <td key={col.id} style={{ padding: '10px 8px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  title={`Click to toggle status for ${col.date} Hour ${col.hour}`}
                                  onClick={() => toggleSessionStatus(s.id, col.id)}
                                  style={{
                                    padding: '5px 12px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    borderRadius: 999,
                                    border: 'none',
                                    background: badgeBg,
                                    color: '#fff',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    transition: 'transform 120ms',
                                  }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                                >
                                  {badgeText}
                                </button>
                              </td>
                            );
                          })}

                          <td style={{ padding: 12 }}></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* SUB TAB 3: FINAL EXAM */}
          {studentSubTab === 'final-exam' && (
            <Card style={{ padding: 18, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>🎓 Final Exam Management Registry</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Track exam dates, scores, course details, attempt status (Initial Test vs Retest), and voucher codes.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    ref={examMarkFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleExamMarkUpload(f);
                      e.target.value = '';
                    }}
                  />
                  <Button size="sm" variant="secondary" onClick={() => examMarkFileRef.current?.click()} title="Upload an Excel/CSV with Phone and Mark columns to set final exam marks" style={{ fontSize: 12 }}>
                    📤 Upload Exam Marks
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReconciliationDrawerOpen(true)}
                    style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    🔍 Reconcile Attempts
                  </Button>
                  <Button size="sm" onClick={handleAddFinalExamStudentRow} style={{ fontSize: 12 }}>
                    ➕ Add Student
                  </Button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', textAlign: 'left', borderBottom: '1.5px solid var(--border)' }}>
                      <th style={{ padding: 12, minWidth: 135 }}>Date</th>
                      <th style={{ padding: 12, minWidth: 150 }}>College</th>
                      <th style={{ padding: 12, minWidth: 130 }}>Phone Number</th>
                      <th style={{ padding: 12, position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 10, minWidth: 160 }}>
                        Student Name
                      </th>
                      <th style={{ padding: 12, minWidth: 160 }}>Course</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 120 }}>Exam Mark</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 165 }}>Test / Retest</th>
                      <th style={{ padding: 12, minWidth: 200 }}>Voucher ID</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 80 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const batchFiltered = students.filter((s) => !selectedBatchId || batchStudentIds.has(s.id));
                      // Only show students who have actually attended (have a recorded exam score)
                      const attended = batchFiltered.filter((s) => (s.finalExam || 0) > 0);
                      const initialGroup = attended.filter((s) => !((s.examAttemptCount && s.examAttemptCount > 1) || s.retestApproved));
                      const retestGroup  = attended.filter((s) =>  (s.examAttemptCount && s.examAttemptCount > 1) || s.retestApproved);

                      const renderRow = (s: typeof students[0]) => {
                        const examDateVal = s.examDate || '2026-07-25';
                        const collegeVal = s.college || 'Christ University';
                        // The course is the BATCH's course (from the batch card), the same for
                        // every student in the batch — not a per-student editable value.
                        const courseVal = activeCourse?.title || activeBatch?.trainingName || s.course || 'Course';
                        const isRetestAttempt = (s.examAttemptCount && s.examAttemptCount > 1) || (s.retestScore && s.retestScore > 0) || s.retestApproved || (s.finalExam > 0 && s.finalExam < 60);
                        const hasPassed = s.finalExam >= 60;
                        const firstVoucher = s.voucherId || `VOUCH-CHRIST-${s.id.replace('s-', '10')}`;
                        const retestVoucher = s.retestVoucherId || `VOUCH-RETEST-${s.id.replace('s-', '10')}`;
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          {/* 1. Date */}
                          <td style={{ padding: 12 }}>
                            <input
                              type="date"
                              className="kvj-input"
                              value={examDateVal}
                              onChange={(e) => {
                                const newD = e.target.value;
                                const updated = { ...s, examDate: newD };
                                setStudents((prev) => prev.map((st) => st.id === s.id ? updated : st));
                                saveStudentToDb(updated);
                              }}
                              style={{ fontSize: 12, padding: '3px 6px', width: 125 }}
                            />
                          </td>

                          {/* 2. College */}
                          <td style={{ padding: 12 }}>
                            <input
                              type="text"
                              className="kvj-input"
                              value={collegeVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, college: val } : st));
                              }}
                              onBlur={() => saveStudentToDb(s)}
                              style={{ fontSize: 12, padding: '3px 6px', width: 140, fontWeight: 600 }}
                            />
                          </td>

                          {/* 3. Phone Number with Auto-fill Suggestion Datalist */}
                          <td style={{ padding: 12 }}>
                            <input
                              type="text"
                              className="kvj-input"
                              list={`phone-autofill-${s.id}`}
                              value={s.phone}
                              onChange={(e) => {
                                const typedPhone = e.target.value;
                                const digits = typedPhone.replace(/\D/g, '');

                                const match = students.find(
                                  (st) => st.id !== s.id && digits.length >= 5 && st.phone.replace(/\D/g, '').includes(digits)
                                );

                                setStudents((prev) =>
                                  prev.map((st) => {
                                    if (st.id !== s.id) return st;
                                    if (match) {
                                      toast({
                                        variant: 'success',
                                        title: 'Student Auto-Filled',
                                        message: `Auto-filled details for "${match.name}" (${match.college}).`,
                                      });
                                      const updated = {
                                        ...st,
                                        phone: typedPhone,
                                        name: match.name,
                                        college: match.college,
                                        course: match.course || 'Data Analytics',
                                        voucherId: match.voucherId || `VOUCH-CHRIST-${Math.floor(100 + Math.random() * 900)}`,
                                        retestVoucherId: match.retestVoucherId || `VOUCH-RETEST-${Math.floor(100 + Math.random() * 900)}`,
                                      };
                                      saveStudentToDb(updated);
                                      return updated;
                                    }
                                    return { ...st, phone: typedPhone };
                                  })
                                );
                              }}
                              onBlur={() => saveStudentToDb(s)}
                              placeholder="+91 98765 00000"
                              style={{ fontSize: 12, padding: '3px 6px', width: 130, color: 'var(--text-muted)' }}
                            />
                            <datalist id={`phone-autofill-${s.id}`}>
                              {students.filter((st) => !selectedBatchId || batchStudentIds.has(st.id)).map((st) => (
                                <option key={st.id} value={st.phone}>
                                  {st.name} — {st.college} ({st.course || 'Data Analytics'})
                                </option>
                              ))}
                            </datalist>
                          </td>

                          {/* 4. Student Name */}
                          <td style={{ padding: 12, fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{s.photo}</span>
                              <input
                                type="text"
                                className="kvj-input"
                                value={s.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, name: val } : st));
                                }}
                                onBlur={() => saveStudentToDb(s)}
                                style={{ fontSize: 12, padding: '3px 6px', width: 125, fontWeight: 700 }}
                              />
                            </div>
                          </td>

                          {/* 5. Course — comes from the batch (read-only; same for the whole batch) */}
                          <td style={{ padding: 12 }}>
                            <span
                              title="Course is set on the batch"
                              style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}
                            >
                              {courseVal}
                            </span>
                          </td>

                           {/* 6. Exam Mark (Manual Entry with Explicit Attempt Type Select) */}
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <select
                                className="kvj-input"
                                value={selectedAttemptTypes[s.id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value as 'Initial' | 'Retest' | '';
                                  setSelectedAttemptTypes(prev => ({ ...prev, [s.id]: val }));
                                }}
                                style={{ fontSize: 12, padding: '2px 4px', width: 90, borderRadius: 5, fontWeight: 600 }}
                              >
                                <option value="">Select Type</option>
                                <option value="Initial">Test</option>
                                <option value="Retest">Retest</option>
                              </select>

                              <input
                                type="number"
                                className="kvj-input"
                                disabled={!selectedAttemptTypes[s.id]}
                                value={
                                  selectedAttemptTypes[s.id] === 'Initial'
                                    ? (s.finalExam || '')
                                    : selectedAttemptTypes[s.id] === 'Retest'
                                    ? (s.retestScore || '')
                                    : ''
                                }
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  const mode = selectedAttemptTypes[s.id];
                                  if (!mode) return;
                                  
                                  setStudents((prev) =>
                                    prev.map((st) => {
                                      if (st.id !== s.id) return st;
                                      if (mode === 'Initial') {
                                        return { ...st, finalExam: val };
                                      } else {
                                        return { ...st, retestScore: val, examAttemptCount: 2 };
                                      }
                                    })
                                  );
                                }}
                                onBlur={() => {
                                  if (selectedAttemptTypes[s.id]) {
                                    saveStudentToDb(s);
                                  }
                                }}
                                placeholder={selectedAttemptTypes[s.id] ? "Mark" : "Type?"}
                                style={{ fontSize: 12, padding: '3px 6px', width: 65, textAlign: 'center', fontWeight: 700 }}
                              />
                              {(() => {
                                const mode = selectedAttemptTypes[s.id];
                                const scoreToCheck = mode === 'Initial' ? (s.finalExam || 0) : mode === 'Retest' ? (s.retestScore || 0) : 0;
                                const checkPassed = scoreToCheck >= coursePassPct;
                                return scoreToCheck > 0 ? (
                                  <Badge tone={checkPassed ? 'success' : 'danger'}>
                                    {checkPassed ? 'Passed 🏆' : 'Failed ❌'}
                                  </Badge>
                                ) : null;
                              })()}
                            </div>
                          </td>

                          {/* 7. Test/Retest (Calculated) */}
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <Badge tone={isRetestAttempt ? 'warning' : 'info'}>
                                {isRetestAttempt ? 'Retest 🔄 (2nd Exam)' : 'Initial Test 📝 (1st Exam)'}
                              </Badge>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextAttempt = isRetestAttempt ? 1 : 2;
                                  const updated = { ...s, examAttemptCount: nextAttempt, retestApproved: nextAttempt === 2 };
                                  setStudents((prev) => prev.map((st) => st.id === s.id ? updated : st));
                                  saveStudentToDb(updated);
                                  toast({
                                    variant: 'info',
                                    title: 'Exam Attempt Updated',
                                    message: `Set ${s.name} to ${nextAttempt === 2 ? 'Retest (2nd Attempt)' : 'Initial Test (1st Attempt)'}.`,
                                  });
                                }}
                                style={{
                                  fontSize: 12,
                                  color: 'var(--brand)',
                                  background: 'transparent',
                                  border: 'none',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                }}
                              >
                                {isRetestAttempt ? 'Switch to 1st Attempt' : 'Switch to 2nd (Retest)'}
                              </button>
                            </div>
                          </td>

                          {/* 8. Voucher ID: Show allotted vouchers select for Retest, or 1st Voucher only if not Retest */}
                          <td style={{ padding: 12 }}>
                            {isRetestAttempt ? (
                              <select
                                value={s.selectedVoucherId || retestVoucher}
                                onChange={(e) => {
                                  const vCode = e.target.value;
                                  const updated = { ...s, selectedVoucherId: vCode };
                                  setStudents((prev) => prev.map((st) => st.id === s.id ? updated : st));
                                  saveStudentToDb(updated);
                                  toast({
                                    variant: 'info',
                                    title: 'Retest Voucher Selected',
                                    message: `Selected voucher "${vCode}" for ${s.name}.`,
                                  });
                                }}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  padding: '3px 6px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-surface)',
                                  color: 'var(--brand)',
                                  cursor: 'pointer',
                                  width: '100%',
                                  minWidth: 165,
                                }}
                              >
                                <option value={firstVoucher}>1st: {firstVoucher}</option>
                                <option value={retestVoucher}>Retest: {retestVoucher}</option>
                              </select>
                            ) : (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="text"
                                  className="kvj-input"
                                  value={firstVoucher}
                                  onChange={(e) => assignVoucherId(s.id, e.target.value)}
                                  onBlur={() => saveStudentToDb(s)}
                                  placeholder="VOUCH-XXX-000"
                                  style={{ fontSize: 12, padding: '3px 6px', width: 135 }}
                                />
                                <Button
                                  size="sm"
                                  style={{ padding: '3px 8px', fontSize: 12 }}
                                  onClick={() => notifyTrainerVoucher(s.name, firstVoucher)}
                                >
                                  Notify
                                </Button>
                              </div>
                            )}
                          </td>

                          {/* 9. Action: Delete Row */}
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <button
                              type="button"
                              title="Delete row"
                              onClick={() => handleDeleteStudentRow(s.id, s.name)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--status-danger, var(--status-danger))',
                                cursor: 'pointer',
                                fontSize: 14,
                                padding: '4px 6px',
                                borderRadius: 4,
                              }}
                            >
                              🗑️
                            </button>
                          </td>
                          </tr>
                        );
                      };

                      return (
                        <>
                          {initialGroup.map((s) => renderRow(s))}
                          {retestGroup.length > 0 && (
                            <tr key="retest-divider">
                              <td colSpan={9} style={{
                                padding: '10px 16px',
                                background: 'linear-gradient(90deg, rgba(245,158,11,0.10) 0%, transparent 100%)',
                                borderTop: '2px dashed var(--border)',
                                borderBottom: '2px dashed var(--border)',
                              }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  🔄 Attended Again (Retest) — {retestGroup.length} student{retestGroup.length !== 1 ? 's' : ''}
                                </span>
                              </td>
                            </tr>
                          )}
                          {retestGroup.map((s) => renderRow(s))}
                          {attended.length === 0 && (
                            <tr key="empty">
                              <td colSpan={9} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                No students have attended the exam yet.
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* SUB TAB 4: RETEST */}
          {studentSubTab === 'retest' && (
            <Card style={{ padding: 18, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>🔄 Retest Candidate Management</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Manage retest candidates, payment status, retest marks, and new voucher IDs.
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', textAlign: 'left', borderBottom: '1.5px solid var(--border)' }}>
                      <th style={{ padding: 12, minWidth: 130 }}>Phone Number</th>
                      <th style={{ padding: 12, position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 10, minWidth: 160 }}>
                        Student Name
                      </th>
                      <th style={{ padding: 12, minWidth: 200 }}>Payment Status</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 140 }}>Retest Mark</th>
                      <th style={{ padding: 12, minWidth: 180 }}>New Retest Voucher ID</th>
                      <th style={{ padding: 12, textAlign: 'center', minWidth: 140 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.filter((s) => !selectedBatchId || batchStudentIds.has(s.id)).map((s) => {
                      const pStatus = s.retestPaymentStatus === 'Paid' ? 'Paid' : 'Pending';
                      const collectedAmt = s.retestCollectedAmount !== undefined ? s.retestCollectedAmount : 0;
                      const retestVouch = s.retestVoucherId || s.voucherId || `VOUCH-RETEST-${s.id.replace('s-', '10')}`;

                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          {/* 1. Phone Number */}
                          <td style={{ padding: 12, color: 'var(--text-muted)' }}>
                            {s.phone}
                          </td>

                          {/* 2. Student Name */}
                          <td style={{ padding: 12, fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2 }}>
                            {s.photo} {s.name}
                          </td>

                          {/* 3. Payment Status & Editable Collected Amount */}
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <select
                                value={pStatus}
                                onChange={async (e) => {
                                  const nextP = e.target.value as 'Paid' | 'Pending';
                                  const updated = { ...s, retestPaymentStatus: nextP };
                                  setStudents((prev) => prev.map((st) => st.id === s.id ? updated : st));
                                  await saveRetestPaymentVerificationLedger(s.id, nextP);
                                  saveStudentToDb(updated);
                                }}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  padding: '3px 6px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-surface)',
                                  color: pStatus === 'Paid' ? 'var(--status-success, var(--status-success))' : 'var(--status-warning, var(--status-warning))',
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="Paid">Verified</option>
                                <option value="Pending">Pending Verification</option>
                              </select>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }} title="External Fee reference">₹</span>
                                <input
                                  type="number"
                                  className="kvj-input"
                                  value={collectedAmt}
                                  onChange={(e) => {
                                    const amt = Number(e.target.value);
                                    setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, retestCollectedAmount: amt } : st));
                                  }}
                                  onBlur={async () => {
                                    const latest = students.find(st => st.id === s.id);
                                    if (latest) {
                                      const resolvedStatus = latest.retestPaymentStatus === 'Paid' ? 'Paid' : 'Pending';
                                      await saveRetestPaymentVerificationLedger(latest.id, resolvedStatus);
                                      saveStudentToDb(latest);
                                    }
                                  }}
                                  placeholder="Fee Ref"
                                  title="External Payment Fee Amount Reference"
                                  style={{ fontSize: 12, padding: '3px 6px', width: 70, fontWeight: 700 }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* 4. Retest Mark */}
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <input
                              type="number"
                              className="kvj-input"
                              value={s.retestScore || ''}
                              onChange={(e) => {
                                const markVal = e.target.value === '' ? 0 : Number(e.target.value);
                                setSelectedAttemptTypes(prev => ({ ...prev, [s.id]: 'Retest' }));
                                setStudents((prev) =>
                                  prev.map((st) =>
                                    st.id === s.id
                                      ? {
                                          ...st,
                                          retestScore: markVal,
                                          examAttemptCount: 2,
                                        }
                                      : st
                                  )
                                );
                              }}
                              onBlur={() => saveStudentToDb(s)}
                              placeholder="Mark"
                              style={{ fontSize: 12, padding: '3px 6px', width: 65, textAlign: 'center', fontWeight: 700 }}
                            />
                          </td>

                          {/* 5. New Retest Voucher ID */}
                          <td style={{ padding: 12 }}>
                            <input
                              type="text"
                              className="kvj-input"
                              value={retestVouch}
                              onChange={(e) => {
                                const vCode = e.target.value;
                                setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, retestVoucherId: vCode } : st));
                              }}
                              onBlur={() => saveStudentToDb(s)}
                              placeholder="New Voucher ID"
                              style={{ fontSize: 12, padding: '3px 6px', width: 155 }}
                            />
                          </td>

                          {/* 6. Send Voucher */}
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <Button
                              size="sm"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              onClick={() => {
                                toast({
                                  variant: 'success',
                                  title: 'Retest Voucher Sent',
                                  message: `Sent new Retest Voucher (${retestVouch}) to ${s.name} (${s.phone}).`,
                                });
                              }}
                            >
                              📩 Send Voucher
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {studentSubTab === 'registration' && (
            <Card style={{ padding: 18 }}>
              {(() => {
                // Filter registration records to show ONLY latest registration for students matched in the master student dataset
                const matchedRegistrations = (() => {
                  const map = new Map<string, RegistrationRecord>();

                  registrationRecords.forEach((r) => {
                    const regPhoneDigits = r.phone.replace(/\D/g, '');
                    const regNameNorm = r.name.toLowerCase().trim();

                    const isMatched = students.some((st) => {
                      const stPhoneDigits = st.phone.replace(/\D/g, '');
                      const stNameNorm = st.name.toLowerCase().trim();
                      if (regPhoneDigits && stPhoneDigits && regPhoneDigits.length >= 10 && stPhoneDigits.length >= 10) {
                        return regPhoneDigits.slice(-10) === stPhoneDigits.slice(-10);
                      }
                      return regNameNorm && stNameNorm && regNameNorm === stNameNorm;
                    });

                    if (isMatched) {
                      const key = regPhoneDigits && regPhoneDigits.length >= 10 ? regPhoneDigits.slice(-10) : regNameNorm;
                      // Overwrite so only latest registration entry is kept
                      map.set(key, r);
                    }
                  });

                  return Array.from(map.values());
                })();

                const q = registrationSearchQuery.toLowerCase().trim();
                const filtered = matchedRegistrations.filter((r) =>
                  !q ||
                  r.name.toLowerCase().includes(q) ||
                  r.phone.includes(q) ||
                  r.email.toLowerCase().includes(q) ||
                  r.registerNo.toLowerCase().includes(q) ||
                  r.college.toLowerCase().includes(q)
                );

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <SectionHeader title="📋 Matched Student Registration Records (Google Sheet)" />
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          Showing only registrations matched with current students data using Phone Number as Primary Key.
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="kvj-input"
                          value={registrationSearchQuery}
                          onChange={(e) => setRegistrationSearchQuery(e.target.value)}
                          placeholder="🔍 Search Name, Phone, Email, Reg No..."
                          style={{ fontSize: 12, padding: '5px 10px', width: 220, borderRadius: 6 }}
                        />

                        <Badge tone="success">
                          ✅ {matchedRegistrations.length} Matched / {registrationRecords.length} Total
                        </Badge>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }} className="kvj-table">
                        <thead>
                          <tr style={{ background: 'var(--bg-sunken)' }}>
                            <th style={{ padding: 10, textAlign: 'center', minWidth: 60 }}>Photo</th>
                            <th style={{ padding: 10, textAlign: 'left', minWidth: 150 }}>Full Name</th>
                            <th style={{ padding: 10, textAlign: 'left', minWidth: 120 }}>Phone (Primary Key)</th>
                            <th style={{ padding: 10, textAlign: 'left', minWidth: 160 }}>Email Address</th>
                            <th style={{ padding: 10, textAlign: 'left', minWidth: 130 }}>College Name</th>
                            <th style={{ padding: 10, textAlign: 'left', minWidth: 90 }}>Batch / Dept</th>
                            <th style={{ padding: 10, textAlign: 'center', minWidth: 100 }}>Register No.</th>
                            <th style={{ padding: 10, textAlign: 'center', minWidth: 80 }}>Gender</th>
                            <th style={{ padding: 10, textAlign: 'center', minWidth: 110 }}>Qualification</th>
                            <th style={{ padding: 10, textAlign: 'center', minWidth: 90 }}>Has Computer</th>
                            <th style={{ padding: 10, textAlign: 'center', minWidth: 90 }}>Learned Before</th>
                            <th style={{ padding: 10, textAlign: 'left', minWidth: 130 }}>Certiport User</th>
                            <th style={{ padding: 10, textAlign: 'left', minWidth: 130 }}>Reg Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 ? (
                            <tr>
                              <td colSpan={13} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                                No matched registration records found for current students...
                              </td>
                            </tr>
                          ) : (
                            filtered.map((r, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  {r.photoUrl ? (
                                    <img
                                      src={r.photoUrl}
                                      alt={r.name}
                                      style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '1.5px solid var(--brand)',
                                        display: 'inline-block',
                                      }}
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                        const fb = (e.target as HTMLElement).nextElementSibling;
                                        if (fb) (fb as HTMLElement).style.display = 'inline-flex';
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: '50%',
                                      background: 'var(--bg-sunken)',
                                      border: '1px solid var(--border)',
                                      display: r.photoUrl ? 'none' : 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 700,
                                      fontSize: 12,
                                      color: 'var(--brand)',
                                      margin: '0 auto',
                                    }}
                                  >
                                    {r.name ? r.name.charAt(0) : '👤'}
                                  </div>
                                </td>
                                <td style={{ padding: 10, fontWeight: 700 }}>{r.name}</td>
                                <td style={{ padding: 10, color: 'var(--brand)', fontWeight: 600 }}>{r.phone}</td>
                                <td style={{ padding: 10 }}>{r.email}</td>
                                <td style={{ padding: 10 }}>{r.college}</td>
                                <td style={{ padding: 10 }}>{r.batch}</td>
                                <td style={{ padding: 10, textAlign: 'center', fontWeight: 600 }}>{r.registerNo || '—'}</td>
                                <td style={{ padding: 10, textAlign: 'center' }}>{r.gender || '—'}</td>
                                <td style={{ padding: 10, textAlign: 'center' }}>{r.qualification || '—'}</td>
                                <td style={{ padding: 10, textAlign: 'center' }}>
                                  <Badge tone={r.hasComputer === 'Yes' ? 'success' : 'warning'}>
                                    {r.hasComputer || 'No'}
                                  </Badge>
                                </td>
                                <td style={{ padding: 10, textAlign: 'center' }}>
                                  <Badge tone={r.learnedBefore === 'Yes' ? 'info' : 'neutral'}>
                                    {r.learnedBefore || 'No'}
                                  </Badge>
                                </td>
                                <td style={{ padding: 10 }}>{r.certiportUser || '—'}</td>
                                <td style={{ padding: 10, color: 'var(--text-muted)', fontSize: 12 }}>{r.timestamp || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </Card>
          )}

          {studentSubTab === 'certificates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <SectionHeader title="📜 Certificate Delivery Record" />

              {/* Student selector */}
              <Card style={{ padding: 18 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Select Student
                  </label>
                  <select
                    className="kvj-select"
                    value={certSelectedStudentId}
                    onChange={async (e) => {
                      const sid = e.target.value;
                      setCertSelectedStudentId(sid);
                      setCertDeliveryDate('');
                      setCertCollectedBy('');
                      setCertCount('');
                      setCertReceiptFile(null);
                      setCertReceiptPath('');
                      setCertRecord(null);
                      setCertReceiptUrl('');
                      if (!sid) return;
                      const enrollment = enrollments.find(
                        (en) => en.batchId === selectedBatchId && en.studentId === sid
                      );
                      if (!enrollment) return;
                      setCertLoading(true);
                      const res = await getCertificateDelivery(enrollment.id);
                      if (res.ok && res.value) {
                        const rec = res.value;
                        setCertRecord(rec);
                        setCertDeliveryDate(rec.deliveryDate || '');
                        setCertCollectedBy(rec.collectedBy || '');
                        setCertCount(rec.certificateCount != null ? String(rec.certificateCount) : '');
                        setCertReceiptPath(rec.certificateReceiptPath || '');
                        if (rec.certificateReceiptPath) {
                          const urlRes = await getCertificateReceiptUrl(rec.certificateReceiptPath);
                          if (urlRes.ok) setCertReceiptUrl(urlRes.value);
                        }
                      }
                      setCertLoading(false);
                    }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                  >
                    <option value="">— Select a student —</option>
                    {filteredStudents.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>

                {certLoading && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
                    Loading delivery record…
                  </div>
                )}

                {certSelectedStudentId && !certLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                    {certRecord && (
                      <div style={{ fontSize: 12, color: 'var(--success)', background: 'var(--success-bg, rgba(34,197,94,0.08))', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--success)' }}>
                        ✅ Existing delivery record loaded. Saving will update it.
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {/* Delivery Date */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          Delivery Date <span style={{ color: 'var(--error)' }}>*</span>
                        </label>
                        <input
                          type="date"
                          className="kvj-input"
                          value={certDeliveryDate}
                          onChange={(e) => setCertDeliveryDate(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                        />
                      </div>

                      {/* Collected By */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          Collected By <span style={{ color: 'var(--error)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="kvj-input"
                          placeholder="Name of recipient at College"
                          value={certCollectedBy}
                          onChange={(e) => setCertCollectedBy(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                        />
                      </div>
                    </div>

                    {/* No. of Certificates */}
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        No. of Certificates <span style={{ color: 'var(--error)' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        className="kvj-input"
                        placeholder="e.g. 1"
                        value={certCount}
                        onChange={(e) => setCertCount(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                      />
                    </div>

                    {/* Certificate Receipt upload */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        Certificate Receipt <span style={{ color: 'var(--error)' }}>*</span>
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                          (JPEG, PNG, WEBP or PDF — max 5 MB)
                        </span>
                      </label>

                      {certReceiptPath && (
                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--success)' }}>✅ Receipt on file:</span>
                          {certReceiptUrl ? (
                            <a
                              href={certReceiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'underline' }}
                            >
                              View / Download
                            </a>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {certReceiptPath.split('/').pop()}
                            </span>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                          id="cert-receipt-file-input"
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            setCertReceiptFile(f);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={certUploading}
                          onClick={() => document.getElementById('cert-receipt-file-input')?.click()}
                        >
                          {certReceiptFile ? `📎 ${certReceiptFile.name}` : certReceiptPath ? '🔄 Replace Receipt' : '📤 Attach Receipt'}
                        </Button>
                        {certReceiptFile && !certUploading && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              if (!certReceiptFile || !certSelectedStudentId) return;
                              setCertUploading(true);
                              const ext = certReceiptFile.name.split('.').pop() || 'pdf';
                              const path = `${certSelectedStudentId}/${Date.now()}.${ext}`;
                              const res = await uploadCertificateReceipt(certReceiptFile, path);
                              if (res.ok) {
                                setCertReceiptPath(res.value);
                                toast({ variant: 'success', title: 'Receipt Uploaded', message: 'Receipt file uploaded successfully.' });
                                const urlRes = await getCertificateReceiptUrl(res.value);
                                if (urlRes.ok) setCertReceiptUrl(urlRes.value);
                              } else {
                                toast({ variant: 'error', title: 'Upload Failed', message: res.error });
                              }
                              setCertUploading(false);
                            }}
                          >
                            {certUploading ? 'Uploading…' : '☁️ Upload Now'}
                          </Button>
                        )}
                        {certUploading && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Uploading…</span>
                        )}
                      </div>
                    </div>

                    {/* Save button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={certSaving || !certDeliveryDate || !certCollectedBy || !certCount || !certReceiptPath}
                        onClick={async () => {
                          if (!certSelectedStudentId) return;
                          const enrollment = enrollments.find(
                            (en) => en.batchId === selectedBatchId && en.studentId === certSelectedStudentId
                          );
                          if (!enrollment) {
                            toast({ variant: 'error', title: 'Enrollment Not Found', message: 'Cannot find enrollment for this student in the selected batch.' });
                            return;
                          }
                          const count = parseInt(certCount, 10);
                          if (isNaN(count) || count <= 0) {
                            toast({ variant: 'error', title: 'Invalid Count', message: 'Number of certificates must be a positive integer.' });
                            return;
                          }
                          if (!certReceiptPath) {
                            toast({ variant: 'error', title: 'Receipt Required', message: 'Please upload the certificate receipt before saving.' });
                            return;
                          }
                          setCertSaving(true);
                          const res = await saveCertificateDelivery(
                            enrollment.id,
                            certSelectedStudentId,
                            certDeliveryDate,
                            certCollectedBy,
                            count,
                            certReceiptPath
                          );
                          if (res.ok) {
                            setCertRecord(res.value);
                            toast({ variant: 'success', title: 'Delivery Recorded', message: 'Certificate delivery record saved successfully.' });
                          } else {
                            toast({ variant: 'error', title: 'Save Failed', message: res.error });
                          }
                          setCertSaving(false);
                        }}
                      >
                        {certSaving ? 'Saving…' : certRecord ? '💾 Update Delivery Record' : '💾 Save Delivery Record'}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>

      {/* Daily Report Builder Modal */}
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

      {/* Daily Report Full Preview Modal */}
      {dailyReportPreviewOpen && (
        <DailyReportPreview
          isOpen={dailyReportPreviewOpen}
          onClose={() => setDailyReportPreviewOpen(false)}
          data={dailyReportFixture}
          initialConfig={dailyReportConfig}
        />
      )}

      {/* UPLOAD EXCEL FILE MODAL */}
      {uploadModalOpen && (
        <Drawer
          open={true}
          onClose={() => {
            setUploadModalOpen(false);
            setSelectedUploadFile(null);
            setImportProgress(null);
          }}
          title="📤 Upload Student Roster (Excel / CSV)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>📋 Required columns: <code>Name</code> &amp; <code>Phone</code></p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Students are stored in the database and enrolled into this batch. Basic details (photo, email, gender) will be auto-enriched by syncing with Google Sheet.</p>
            </div>

            {!importProgress ? (
              <>
                <div style={{
                  border: '2px dashed var(--brand)',
                  borderRadius: 12,
                  padding: 30,
                  textAlign: 'center',
                  background: 'var(--bg-sunken)',
                }}>
                  <span style={{ fontSize: 32 }}>📄</span>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>Choose Excel / CSV File</div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedUploadFile(file);
                      }
                    }}
                    style={{ marginTop: 12 }}
                  />
                  {selectedUploadFile && (
                    <div style={{
                      marginTop: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--brand)',
                      background: 'rgba(99, 102, 241, 0.1)',
                      padding: '6px 12px',
                      borderRadius: 6,
                      display: 'inline-block'
                    }}>
                      📁 Selected: {selectedUploadFile.name} ({(selectedUploadFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setUploadModalOpen(false);
                      setSelectedUploadFile(null);
                      setImportProgress(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={!selectedUploadFile}
                    onClick={() => {
                      if (selectedUploadFile) {
                        handleFileUpload(selectedUploadFile);
                      }
                    }}
                  >
                    📤 Start Upload
                  </Button>
                </div>
              </>
            ) : (
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 24,
                background: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>⏳</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Uploading and Parsing File...
                  </span>
                </div>
                
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  {importProgress.message}
                </p>

                <ProgressBar
                  value={importProgress.current}
                  max={importProgress.total}
                  tone="brand"
                  size="md"
                  showLabel
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  <span>{Math.round((importProgress.current / importProgress.total) * 100)}% Complete</span>
                  <span>{importProgress.current} / {importProgress.total} records</span>
                </div>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* VOUCHER UPLOAD SUMMARY MODAL */}
      {voucherSummary && (
        <Drawer open={true} onClose={() => setVoucherSummary(null)} title="📊 Voucher ID Import Summary">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 4 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              The voucher spreadsheet import has completed. Here is the detailed summary:
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              background: 'var(--bg-sunken)',
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--border)'
            }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Rows Processed</span>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{voucherSummary.totalRows}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Successfully Updated</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--status-success)' }}>{voucherSummary.updated}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Invalid Phone Numbers</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--status-danger)' }}>{voucherSummary.invalidPhoneNumbers}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Missing Students</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--status-warning)' }}>{voucherSummary.missingStudents}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Duplicate Phones in Upload</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--status-warning)' }}>{voucherSummary.duplicatePhoneNumbers}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Failed Rows</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--status-danger)' }}>{voucherSummary.failedRows}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button onClick={() => setVoucherSummary(null)}>Dismiss</Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* BULK EMAIL DISPATCH DRAWER */}
      {bulkEmailOpen && (
        <Drawer open={true} onClose={() => setBulkEmailOpen(false)} title="✉️ Bulk Email Dispatcher">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 4 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Select the email type and the target list of students to bulk notify. KVJ Analytics template will be sent automatically.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Email Template Type</label>
              <select
                className="kvj-select"
                value={bulkEmailType}
                onChange={(e) => setBulkEmailType(e.target.value as any)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 8 }}
              >
                <option value="Voucher Mail">Voucher Details (Initial Test)</option>
                <option value="Congratulations">Congratulations (Passed Students)</option>
                <option value="Reminder">Exam Deadline Reminder</option>
                <option value="Retest">Retest Voucher Details</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Target Recipients</label>
              <select
                className="kvj-select"
                value={bulkEmailTarget}
                onChange={(e) => setBulkEmailTarget(e.target.value as any)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 8 }}
              >
                <option value="selected">Selected Students Only ({selectedMatrixIds.size} checked)</option>
                <option value="eligible">Eligible Students Only</option>
                <option value="all">Entire Batch ({filteredStudents.length} students)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <Button type="button" variant="secondary" onClick={() => setBulkEmailOpen(false)}>Cancel</Button>
              <Button onClick={handleSendBulkEmails} disabled={bulkEmailSending}>
                {bulkEmailSending ? 'Sending...' : '⚡ Send Emails'}
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* ADD STUDENT DATA INDIVIDUAL MODAL */}
      {addStudentModalOpen && (
        <Drawer open={true} onClose={() => setAddStudentModalOpen(false)} title="➕ Add Student Record">
          <form onSubmit={handleAddStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Student Full Name</label>
              <input
                type="text"
                className="kvj-input"
                required
                value={newStudentForm.name}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                placeholder="e.g. Anoop Varghese"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Email Address</label>
              <input
                type="email"
                className="kvj-input"
                value={newStudentForm.email}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                placeholder="anoop.v@student.edu"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Phone Number</label>
              <input
                type="text"
                className="kvj-input"
                value={newStudentForm.phone}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, phone: e.target.value })}
                placeholder="+91 98950 12345"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Initial Attendance %</label>
              <input
                type="number"
                className="kvj-input"
                value={newStudentForm.attendancePct}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, attendancePct: Number(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <Button type="button" variant="secondary" onClick={() => setAddStudentModalOpen(false)}>Cancel</Button>
              <Button type="submit">Add Student</Button>
            </div>
          </form>
        </Drawer>
      )}

      {/* UPLOAD VOUCHER FILE MODAL */}
      {uploadVoucherModalOpen && (
        <Drawer open={true} onClose={() => setUploadVoucherModalOpen(false)} title="📤 Upload Voucher IDs File (3 Fields)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Select the returned Voucher ID CSV file (containing columns <code>Phone Number</code>, <code>Name</code>, <code>Voucher ID</code>) to update student voucher assignments automatically.
            </p>
            <div style={{
              border: '2px dashed var(--brand)',
              borderRadius: 12,
              padding: 30,
              textAlign: 'center',
              background: 'var(--bg-sunken)',
            }}>
              <span style={{ fontSize: 32 }}>📜</span>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>Choose Voucher Template CSV File</div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleVoucherUpload}
                style={{ marginTop: 12 }}
              />
            </div>
          </div>
        </Drawer>
      )}

      {/* ADD FINAL EXAM STUDENT MODAL */}
      {addFinalExamModalOpen && (
        <Drawer open={true} onClose={() => setAddFinalExamModalOpen(false)} title="🎓 Add Student for Final Exam">
          <form onSubmit={handleAddFinalExamStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Student Full Name</label>
              <input
                type="text"
                className="kvj-input"
                required
                placeholder="e.g. Rahul Sharma"
                value={newFinalExamStudentForm.name}
                onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Phone Number</label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="+91 98765 00000"
                  value={newFinalExamStudentForm.phone}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>College Name</label>
                <input
                  type="text"
                  className="kvj-input"
                  value={newFinalExamStudentForm.college}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, college: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Course</label>
                <select
                  className="kvj-input"
                  value={newFinalExamStudentForm.course}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, course: e.target.value })}
                >
                  <option value="Data Analytics">Data Analytics</option>
                  <option value="Power BI & Tableau">Power BI BI & Tableau</option>
                  <option value="Fullstack Web Dev">Fullstack Web Dev</option>
                  <option value="Cloud Architecture">Cloud Architecture</option>
                  <option value="AI & Machine Learning">AI & Machine Learning</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Exam Date</label>
                <input
                  type="date"
                  className="kvj-input"
                  value={newFinalExamStudentForm.examDate}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, examDate: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Exam Mark</label>
                <input
                  type="number"
                  className="kvj-input"
                  placeholder="e.g. 85"
                  value={newFinalExamStudentForm.finalExam}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, finalExam: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Voucher ID (Optional)</label>
                <input
                  type="text"
                  className="kvj-input"
                  placeholder="VOUCH-CHRIST-108"
                  value={newFinalExamStudentForm.voucherId}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, voucherId: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <Button type="button" variant="secondary" onClick={() => setAddFinalExamModalOpen(false)}>Cancel</Button>
              <Button type="submit">➕ Save Student Record</Button>
            </div>
          </form>
        </Drawer>
      )}
      {renderReconciliationDrawer()}
      {renderResolutionModal()}
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Top Bar with Add Batch Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            🎓 Training Batch Management & Analytics
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Batch: <strong>{cleanBatchCode(activeBatch?.code, activeBatch?.batchNo) || 'Christ 3BBA Data Analytics B1'}</strong> ({activeBatch?.college || 'Christ College'})
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {safeTrainers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>👤 Trainer:</span>
              <select
                className="kvj-select"
                value={selectedTrainerId}
                onChange={(e) => {
                  setSelectedTrainerId(e.target.value);
                  setSelectedBatchId('');
                }}
                style={{ padding: '4px 8px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 160 }}
              >
                <option value="all">👥 All Trainers</option>
                {safeTrainers.map((emp) => {
                  const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                  return <option key={emp.id} value={emp.id}>{name}</option>;
                })}
              </select>
            </div>
          )}

          {canCreateBatch && (
            <Button onClick={() => setCreateBatchModalOpen(true)}>
              ➕ Add New Batch
            </Button>
          )}
        </div>
      </div>

      {/* Training Batch Overview Carousel — one card per assigned batch.
          Selecting a card sets the active batch for every section below. */}
      <TrainingBatchCarousel
        batches={safeBatches}
        courses={courses}
        trainers={trainers}
        activeId={selectedBatchId}
        onSelect={setSelectedBatchId}
        onAction={handleCarouselAction}
        onEdit={handleOpenEditBatch}
        onCopy={handleCopyBatch}
        onDelete={userRole === 'ADMIN' ? handleDeleteBatch : undefined}
      />

      {/* EMAIL COMPOSER MODAL */}
      {emailComposerOpen && (
        <Drawer
          open={true}
          onClose={() => setEmailComposerOpen(false)}
          title="📧 Send Professional Document to College Coordinator"
        >
          <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Recipient Coordinator Email
              </label>
              <input
                type="email"
                className="kvj-input"
                required
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Subject
              </label>
              <input
                type="text"
                className="kvj-input"
                required
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Message Body
              </label>
              <textarea
                className="kvj-input"
                rows={6}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Type your message details here..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
              <Button variant="secondary" type="button" onClick={() => setEmailComposerOpen(false)}>Cancel</Button>
              <Button type="submit">Dispatch Email Report</Button>
            </div>
          </form>
        </Drawer>
      )}

      {/* EDIT BATCH MODAL */}
      {editingBatchId && (
        <Drawer
          open={true}
          onClose={() => setEditingBatchId(null)}
          title="✏️ Edit Training Batch Details"
        >
          <form onSubmit={handleSaveEditBatch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Training Course Name *
              </label>
              <select
                className="kvj-select"
                required
                value={editForm.selectedCourseId}
                onChange={(e) => {
                  const selected = courses.find(c => c.id === e.target.value);
                  setEditForm({
                    ...editForm,
                    selectedCourseId: e.target.value,
                    trainingName: selected ? selected.title : editForm.trainingName,
                  });
                }}
              >
                <option value="" disabled>— Select a Course from Course Catalog —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title} ({c.code})</option>
                ))}
              </select>
              {courses.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  No courses in catalog yet. Add courses in the Course Catalog first.
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Name
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  value={editForm.college}
                  onChange={(e) => setEditForm({ ...editForm, college: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Program / Stream *
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="e.g. Computer Science & Analytics"
                  value={editForm.program}
                  onChange={(e) => setEditForm({ ...editForm, program: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Batch Name / No. *
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  value={editForm.batchNo}
                  onChange={(e) => setEditForm({ ...editForm, batchNo: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Academic Year *
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  value={editForm.academicYear}
                  onChange={(e) => setEditForm({ ...editForm, academicYear: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Lead Trainer
                </label>
                <select
                  className="kvj-select"
                  value={editForm.trainerId}
                  onChange={(e) => setEditForm({ ...editForm, trainerId: e.target.value })}
                >
                  <option value="">-- Choose Trainer --</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.designation})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Start Date
                </label>
                <input
                  type="date"
                  className="kvj-input"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  End Date
                </label>
                <input
                  type="date"
                  className="kvj-input"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Coordinator 1 Name
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  value={editForm.coordinator}
                  onChange={(e) => setEditForm({ ...editForm, coordinator: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Coordinator 1 Email
                </label>
                <input
                  type="email"
                  className="kvj-input"
                  value={editForm.coordinatorEmail}
                  onChange={(e) => setEditForm({ ...editForm, coordinatorEmail: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Coordinator 2 Name (Optional)
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  value={editForm.coordinator2}
                  onChange={(e) => setEditForm({ ...editForm, coordinator2: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Coordinator 2 Email (Optional)
                </label>
                <input
                  type="email"
                  className="kvj-input"
                  value={editForm.coordinatorEmail2}
                  onChange={(e) => setEditForm({ ...editForm, coordinatorEmail2: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
              <Button variant="secondary" type="button" onClick={() => setEditingBatchId(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Drawer>
      )}

      {/* UPLOAD EXCEL FILE MODAL */}
      {uploadModalOpen && (
        <Drawer
          open={true}
          onClose={() => {
            setUploadModalOpen(false);
            setSelectedUploadFile(null);
            setImportProgress(null);
          }}
          title="📤 Upload Student Roster (Excel / CSV)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>📋 Required columns: <code>Name</code> &amp; <code>Phone</code></p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Students are stored in the database and enrolled into this batch. Basic details (photo, email, gender) will be auto-enriched by syncing with Google Sheet.</p>
            </div>

            {!importProgress ? (
              <>
                <div style={{
                  border: '2px dashed var(--brand)',
                  borderRadius: 12,
                  padding: 30,
                  textAlign: 'center',
                  background: 'var(--bg-sunken)',
                }}>
                  <span style={{ fontSize: 32 }}>📄</span>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>Choose Excel / CSV File</div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedUploadFile(file);
                      }
                    }}
                    style={{ marginTop: 12 }}
                  />
                  {selectedUploadFile && (
                    <div style={{
                      marginTop: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--brand)',
                      background: 'rgba(99, 102, 241, 0.1)',
                      padding: '6px 12px',
                      borderRadius: 6,
                      display: 'inline-block'
                    }}>
                      📁 Selected: {selectedUploadFile.name} ({(selectedUploadFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setUploadModalOpen(false);
                      setSelectedUploadFile(null);
                      setImportProgress(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={!selectedUploadFile}
                    onClick={() => {
                      if (selectedUploadFile) {
                        handleFileUpload(selectedUploadFile);
                      }
                    }}
                  >
                    📤 Start Upload
                  </Button>
                </div>
              </>
            ) : (
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 24,
                background: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>⏳</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Uploading and Parsing File...
                  </span>
                </div>
                
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  {importProgress.message}
                </p>

                <ProgressBar
                  value={importProgress.current}
                  max={importProgress.total}
                  tone="brand"
                  size="md"
                  showLabel
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  <span>{Math.round((importProgress.current / importProgress.total) * 100)}% Complete</span>
                  <span>{importProgress.current} / {importProgress.total} records</span>
                </div>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* ADD STUDENT DATA INDIVIDUAL MODAL */}
      {addStudentModalOpen && (
        <Drawer open={true} onClose={() => setAddStudentModalOpen(false)} title="➕ Add Student Record">
          <form onSubmit={handleAddStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Student Full Name</label>
              <input
                type="text"
                className="kvj-input"
                required
                value={newStudentForm.name}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                placeholder="e.g. Anoop Varghese"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Email Address</label>
              <input
                type="email"
                className="kvj-input"
                value={newStudentForm.email}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                placeholder="anoop.v@student.edu"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Phone Number</label>
              <input
                type="text"
                className="kvj-input"
                value={newStudentForm.phone}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, phone: e.target.value })}
                placeholder="+91 98950 12345"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Initial Attendance %</label>
              <input
                type="number"
                className="kvj-input"
                value={newStudentForm.attendancePct}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, attendancePct: Number(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <Button type="button" variant="secondary" onClick={() => setAddStudentModalOpen(false)}>Cancel</Button>
              <Button type="submit">Add Student</Button>
            </div>
          </form>
        </Drawer>
      )}

      {/* UPLOAD VOUCHER FILE MODAL */}
      {uploadVoucherModalOpen && (
        <Drawer open={true} onClose={() => setUploadVoucherModalOpen(false)} title="📤 Upload Voucher IDs File (3 Fields)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Select the returned Voucher ID CSV file (containing columns <code>Phone Number</code>, <code>Name</code>, <code>Voucher ID</code>) to update student voucher assignments automatically.
            </p>
            <div style={{
              border: '2px dashed var(--brand)',
              borderRadius: 12,
              padding: 30,
              textAlign: 'center',
              background: 'var(--bg-sunken)',
            }}>
              <span style={{ fontSize: 32 }}>📜</span>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>Choose Voucher Template CSV File</div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleVoucherUpload}
                style={{ marginTop: 12 }}
              />
            </div>
          </div>
        </Drawer>
      )}

      {/* ADD FINAL EXAM STUDENT MODAL */}
      {addFinalExamModalOpen && (
        <Drawer open={true} onClose={() => setAddFinalExamModalOpen(false)} title="🎓 Add Student for Final Exam">
          <form onSubmit={handleAddFinalExamStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Student Full Name</label>
              <input
                type="text"
                className="kvj-input"
                required
                placeholder="e.g. Rahul Sharma"
                value={newFinalExamStudentForm.name}
                onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Phone Number</label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="+91 98765 00000"
                  value={newFinalExamStudentForm.phone}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>College Name</label>
                <input
                  type="text"
                  className="kvj-input"
                  value={newFinalExamStudentForm.college}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, college: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Course</label>
                <select
                  className="kvj-input"
                  value={newFinalExamStudentForm.course}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, course: e.target.value })}
                >
                  <option value="Data Analytics">Data Analytics</option>
                  <option value="Power BI & Tableau">Power BI & Tableau</option>
                  <option value="Fullstack Web Dev">Fullstack Web Dev</option>
                  <option value="Cloud Architecture">Cloud Architecture</option>
                  <option value="AI & Machine Learning">AI & Machine Learning</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Exam Date</label>
                <input
                  type="date"
                  className="kvj-input"
                  value={newFinalExamStudentForm.examDate}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, examDate: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Exam Mark</label>
                <input
                  type="number"
                  className="kvj-input"
                  placeholder="e.g. 85"
                  value={newFinalExamStudentForm.finalExam}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, finalExam: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Voucher ID (Optional)</label>
                <input
                  type="text"
                  className="kvj-input"
                  placeholder="VOUCH-CHRIST-108"
                  value={newFinalExamStudentForm.voucherId}
                  onChange={(e) => setNewFinalExamStudentForm({ ...newFinalExamStudentForm, voucherId: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <Button type="button" variant="secondary" onClick={() => setAddFinalExamModalOpen(false)}>Cancel</Button>
              <Button type="submit">➕ Save Student Record</Button>
            </div>
          </form>
        </Drawer>
      )}
      {renderReconciliationDrawer()}
      {renderResolutionModal()}

      {/* Daily Report Builder Modal */}
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

      {/* Daily Report Full Preview Modal */}
      {dailyReportPreviewOpen && (
        <DailyReportPreview
          isOpen={dailyReportPreviewOpen}
          onClose={() => setDailyReportPreviewOpen(false)}
          data={dailyReportFixture}
          initialConfig={dailyReportConfig}
        />
      )}

      {/* CREATE NEW BATCH MODAL */}
      {createBatchModalOpen && (
        <Drawer
          open={true}
          onClose={() => setCreateBatchModalOpen(false)}
          title="➕ Create New Training Batch"
        >
          <form onSubmit={handleCreateBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Generated Batch Code (Automatic)
              </label>
              <input
                type="text"
                className="kvj-input"
                readOnly
                disabled
                style={{ background: 'var(--bg-sunken)', cursor: 'not-allowed', opacity: 0.8 }}
                value={newBatchForm.code}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Training Course Name *
              </label>
              <select
                className="kvj-input"
                required
                value={newBatchForm.selectedCourseId}
                onChange={(e) => {
                  const cId = e.target.value;
                  const selected = courses.find(c => c.id === cId);
                  setNewBatchForm({ ...newBatchForm, selectedCourseId: cId, trainingName: selected?.title || '' });
                }}
                style={{ appearance: 'auto' }}
              >
                <option value="" disabled>— Select a Program from Course Catalog —</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title} ({c.code})</option>
                ))}
              </select>
              {courses.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  No courses in catalog yet. Add courses in the Course Catalog first.
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Name
                </label>
                {(() => {
                  const savedColleges = dbColleges.length > 0 ? dbColleges : [
                    { id: 'col-1', name: 'Christ Irinjalakkuda', code: 'CHRIST-IRK' },
                    { id: 'col-2', name: 'MIM Kuttikkanam', code: 'MIM-KUTT' },
                    { id: 'col-3', name: 'St. Thomas College', code: 'STC-THR' },
                  ];

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <select
                        className="kvj-input"
                        value={savedColleges.some(c => c.name === newBatchForm.college) ? newBatchForm.college : 'Custom'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== 'Custom') {
                            setNewBatchForm({ ...newBatchForm, college: val });
                          }
                        }}
                      >
                        {savedColleges.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        <option value="Custom">✏️ Type Custom College Name...</option>
                      </select>
                      {(!savedColleges.some(c => c.name === newBatchForm.college) || newBatchForm.college === 'Custom') && (
                        <input
                          type="text"
                          className="kvj-input"
                          required
                          placeholder="Type College Name..."
                          value={newBatchForm.college === 'Custom' ? '' : newBatchForm.college}
                          onChange={(e) => setNewBatchForm({ ...newBatchForm, college: e.target.value })}
                        />
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Course
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="e.g. BCOM Self"
                  value={newBatchForm.collegeCourse}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, collegeCourse: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Academic Year (Year)
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="e.g. 2026-2027"
                  value={newBatchForm.academicYear}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, academicYear: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Batch Number / Name (Batch)
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="e.g. Batch 2"
                  value={newBatchForm.batchName}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, batchName: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Coordinator 1 Name
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="e.g. Prof. Anil Kumar"
                  value={newBatchForm.coordinator}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, coordinator: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Coordinator 1 Email
                </label>
                <input
                  type="email"
                  className="kvj-input"
                  required
                  placeholder="e.g. anil@christcollege.edu"
                  value={newBatchForm.coordinatorEmail}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, coordinatorEmail: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Coordinator 2 Name (Optional)
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  placeholder="e.g. Dr. Priya Nair"
                  value={newBatchForm.coordinator2}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, coordinator2: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  College Coordinator 2 Email (Optional)
                </label>
                <input
                  type="email"
                  className="kvj-input"
                  placeholder="e.g. priya@christcollege.edu"
                  value={newBatchForm.coordinatorEmail2}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, coordinatorEmail2: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Start Date (Optional)
                </label>
                <input
                  type="date"
                  className="kvj-input"
                  value={newBatchForm.startDate}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, startDate: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  className="kvj-input"
                  value={newBatchForm.endDate}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, endDate: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
              <Button variant="secondary" type="button" onClick={() => setCreateBatchModalOpen(false)}>Cancel</Button>
              <Button type="submit">➕ Create Batch</Button>
            </div>
          </form>
        </Drawer>
      )}

      {importProgress && !uploadModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--bg-overlay)',
          backdropFilter: 'blur(var(--overlay-blur, 3px))',
          WebkitBackdropFilter: 'blur(var(--overlay-blur, 3px))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <Card style={{ padding: 30, width: '100%', maxWidth: 450, textAlign: 'center', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              ⏳ Processing & Syncing Data
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {importProgress.message}
            </p>
            <div style={{ height: 8, background: 'var(--bg-sunken)', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{
                height: '100%',
                width: `${(importProgress.current / importProgress.total) * 100}%`,
                background: 'var(--brand)',
                borderRadius: 99,
                transition: 'width 200ms ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
              <span>{Math.round((importProgress.current / importProgress.total) * 100)}% Complete</span>
              <span>{importProgress.current} / {importProgress.total} records</span>
            </div>
          </Card>
        </div>
      )}

    </AppShell>
  );
}

export default BatchManagement;
