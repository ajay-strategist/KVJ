import { useState, useEffect } from 'react';
import { TrainingBatchCarousel, type BatchAction } from '../components/TrainingBatchCarousel';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Card, SectionHeader, Badge, ProgressBar } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { useTraining } from '../hooks/useTraining';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { usePermissions } from '../../../shared/permissions/react';
import { todayISO } from '../../../shared/utils/date';
import { makeDailyReportFixture } from '../report/daily-report.fixture';
import { DailyReportBuilderModal } from '../report/DailyReportBuilderModal';
import { DailyReportPreview } from '../report/DailyReportPreview';
import type { DailyReportConfig } from '../report/daily-report.types';

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
  voucherStatus: string;
  certificateStatus: string;
  retestApproved?: boolean;
  retestDate?: string;
  retestScore?: number;
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
  const { can } = usePermissions();
  const canViewDailyReport = can('training', 'view');
  const { batches, courses, createBatch } = useTraining();
  const { toast } = useNotifications();
  const [trainers, setTrainers] = useState<Employee[]>([]);

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

    const courseId = newBatchForm.selectedCourseId || courses[0]?.id || 'c-1';
    const selectedCourse = courses.find(c => c.id === courseId);
    const trainerId = trainers[0]?.id || 'u-admin';

    const res = await createBatch({
      code: newBatchForm.code,
      trainingName: newBatchForm.trainingName || selectedCourse?.title || newBatchForm.code,
      college: newBatchForm.college,
      courseId,
      trainerId,
      startDate: newBatchForm.startDate,
      endDate: newBatchForm.endDate,
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

  // Daily Report Builder & Preview States
  const [dailyReportBuilderOpen, setDailyReportBuilderOpen] = useState(false);
  const [dailyReportPreviewOpen, setDailyReportPreviewOpen] = useState(false);
  const [dailyReportFixture] = useState(() => makeDailyReportFixture());
  const [dailyReportConfig, setDailyReportConfig] = useState<DailyReportConfig>(() => ({
    selectedSections: [
      'executive-summary',
      'datewise-attendance',
      'assessment-status',
      'final-exam-eligibility',
      'student-data',
    ],
    selectedAssessmentIds: ['ass-1', 'ass-2', 'ass-3', 'ass-4'],
    selectedStudentColumns: ['studentName', 'gender', 'hasComputer', 'learnedBefore', 'attendancePct', 'ass-1', 'ass-2', 'ass-3', 'ass-4', 'assessmentStatus', 'finalExamEligibility'],
    trainerNotes: makeDailyReportFixture().defaultTrainerNotes,
  }));
  
  // Batch selection
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  
  // Edit Batch modal state
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    trainingName: '',
    program: '',
    batchNo: '',
    academicYear: '',
    trainer: '',
    coordinator: '',
    coordinatorEmail: '',
    coordinator2: '',
    coordinatorEmail2: '',
  });

  const handleOpenEditBatch = (id: string) => {
    const target = batches.find((b) => b.id === id);
    setEditingBatchId(id);
    setEditForm({
      trainingName: target?.trainingName || '2 CS Power BI',
      program: (target as any)?.program || 'Computer Science & Analytics',
      batchNo: target?.batchNo || target?.code || 'Batch 2',
      academicYear: target?.academicYear || '2026-2027',
      trainer: 'Priya Nair',
      coordinator: target?.coordinator || 'Prof. Anil Kumar',
      coordinatorEmail: target?.coordinatorEmail || 'anil@christcollege.edu',
      coordinator2: target?.coordinator2 || '',
      coordinatorEmail2: target?.coordinatorEmail2 || '',
    });
  };

  const handleSaveEditBatch = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      variant: 'success',
      title: 'Training Batch Updated',
      message: `Batch "${editForm.trainingName}" details successfully updated.`,
    });
    setEditingBatchId(null);
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

  // Certificate tracker parameter state
  const [certificateDeliveryDate, setCertificateDeliveryDate] = useState('2026-07-28');
  const [certificateStatus, setCertificateStatus] = useState<'Generated' | 'Printed' | 'Dispatched' | 'Delivered' | 'Received'>('Printed');
  const [courierName, setCourierName] = useState('DTDC Express');
  const [trackingNumber, setTrackingNumber] = useState('DTDC-992019A');
  const [signedReceiptUploaded, setSignedReceiptUploaded] = useState(false);

  // Modals & Action Handlers for Student Data Management
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    email: '',
    phone: '',
    college: 'Christ University',
    department: 'BCOM B',
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

  const handleAddFinalExamStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFinalExamStudentForm.name.trim()) return;

    const newStudent: StudentRecord = {
      id: `s-${Date.now()}`,
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
      voucherStatus: '',
      certificateStatus: '',
      examAttemptCount: 1,
    };

    setStudents((prev) => [...prev, newStudent]);
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
      message: `Student "${newStudent.name}" added to Final Exam registry successfully.`,
    });
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

  const [examScheduleDates, setExamScheduleDates] = useState<Record<string, string>>({
    's-1': '2026-08-01',
    's-2': '2026-08-05',
    's-3': '2026-08-01',
    's-4': '2026-08-05',
  });

  // Hour-based Multi-Date Attendance Column Matrix State
  const [attendanceSessions, setAttendanceSessions] = useState<Array<{ id: string; date: string; hour: number }>>(() => {
    try {
      const saved = localStorage.getItem('kvj.batch.attendanceSessions');
      return saved ? JSON.parse(saved) : [
        { id: 'col-1', date: '2026-07-20', hour: 1 },
        { id: 'col-2', date: '2026-07-20', hour: 2 },
        { id: 'col-3', date: '2026-07-21', hour: 1 },
        { id: 'col-4', date: '2026-07-22', hour: 1 },
        { id: 'col-5', date: '2026-07-23', hour: 1 },
      ];
    } catch {
      return [
        { id: 'col-1', date: '2026-07-20', hour: 1 },
        { id: 'col-2', date: '2026-07-20', hour: 2 },
        { id: 'col-3', date: '2026-07-21', hour: 1 },
        { id: 'col-4', date: '2026-07-22', hour: 1 },
        { id: 'col-5', date: '2026-07-23', hour: 1 },
      ];
    }
  });

  useEffect(() => {
    try { localStorage.setItem('kvj.batch.attendanceSessions', JSON.stringify(attendanceSessions)); } catch {}
  }, [attendanceSessions]);

  const [attendanceMatrix, setAttendanceMatrix] = useState<Record<string, Record<string, 'present' | 'absent' | 'late'>>>(() => {
    try {
      const saved = localStorage.getItem('kvj.batch.attendanceMatrix');
      return saved ? JSON.parse(saved) : {
        's-1': { 'col-1': 'present', 'col-2': 'present', 'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
        's-2': { 'col-1': 'present', 'col-2': 'absent',  'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
        's-3': { 'col-1': 'present', 'col-2': 'present', 'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
        's-4': { 'col-1': 'absent',  'col-2': 'absent',  'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
      };
    } catch {
      return {
        's-1': { 'col-1': 'present', 'col-2': 'present', 'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
        's-2': { 'col-1': 'present', 'col-2': 'absent',  'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
        's-3': { 'col-1': 'present', 'col-2': 'present', 'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
        's-4': { 'col-1': 'absent',  'col-2': 'absent',  'col-3': 'present', 'col-4': 'present', 'col-5': 'present' },
      };
    }
  });

  useEffect(() => {
    try { localStorage.setItem('kvj.batch.attendanceMatrix', JSON.stringify(attendanceMatrix)); } catch {}
  }, [attendanceMatrix]);

  const toggleSessionStatus = (studentId: string, colId: string, statusOverride?: 'present' | 'absent' | 'late') => {
    setAttendanceMatrix((prev) => {
      const sMap = prev[studentId] || {};
      const current = sMap[colId] || 'present';
      const nextStatus = statusOverride || (current === 'present' ? 'absent' : current === 'absent' ? 'late' : 'present');
      
      const updatedSMap = { ...sMap, [colId]: nextStatus };
      const updatedMatrix = { ...prev, [studentId]: updatedSMap };

      // Calculate attendance % for this student across all attendanceSessions
      const total = attendanceSessions.length;
      const attended = attendanceSessions.filter((c) => (updatedSMap[c.id] || 'present') !== 'absent').length;
      const calcPct = Math.round((attended / total) * 100);

      setStudents((sList) =>
        sList.map((st) => st.id === studentId ? { ...st, attendancePct: calcPct } : st)
      );

      return updatedMatrix;
    });
  };

  const handleUpdateSessionDate = (colId: string, newDateVal: string) => {
    if (!newDateVal) return;
    setAttendanceSessions((prev) =>
      prev.map((c) => c.id === colId ? { ...c, date: newDateVal } : c)
    );
  };

  const handleUpdateSessionHour = (colId: string, newHourVal: number) => {
    setAttendanceSessions((prev) =>
      prev.map((c) => c.id === colId ? { ...c, hour: newHourVal } : c)
    );
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

  const handleDeleteSessionColumn = (colId: string) => {
    if (attendanceSessions.length <= 1) {
      toast({
        variant: 'warning',
        title: 'Minimum Column Limit',
        message: 'At least 1 session column must remain in the matrix.',
      });
      return;
    }
    setAttendanceSessions((prev) => prev.filter((c) => c.id !== colId));
    toast({
      variant: 'info',
      title: 'Session Column Deleted',
      message: 'Session column removed from attendance matrix.',
    });
  };

  const [uploadVoucherModalOpen, setUploadVoucherModalOpen] = useState(false);
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

  // Attendance threshold (editable, default 84%)
  const [attendanceThreshold, setAttendanceThreshold] = useState(84);

  // Course Maximum Marks & Pass % Criteria (editable, default 100 max, 70%)
  const [courseMaxMarks, setCourseMaxMarks] = useState<number>(100);
  const [coursePassPct, setCoursePassPct] = useState<number>(70);

  // Google Sheet Auto-Sync State (Registration & Student Photos)
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

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

  // Sync Google Sheet Registration Data & Student Photos
  const syncGoogleSheetData = async (showToastNotice = false) => {
    setIsSyncingSheet(true);
    try {
      // Fetch public Registration sheet CSV
      const regRes = await fetch(
        'https://docs.google.com/spreadsheets/d/1XCQGySwzEqpOV-MpGtc2lvhgcW3byTqKjLpOPcOYEvg/gviz/tq?tqx=out:csv&sheet=Registration'
      );
      const regText = await regRes.text();
      const regRows = parseCSV(regText);

      if (regRows.length < 2) {
        setIsSyncingSheet(false);
        return;
      }

      // Headers: ["Timestamp","Email address","College","Batch","Register No.","Phone No.","Mail ID","Full Name","Gender","Previous Qualification","Do you have a computer","Learned before","Certiport User","Certiport Pass","Photo","Image","Rounded Image"]
      const uniqueRegMap = new Map<string, RegistrationRecord>();

      for (let i = 1; i < regRows.length; i++) {
        const row = regRows[i];
        if (row.length < 6) continue;
        const timestamp = (row[0] || '').trim();
        const email = (row[1] || row[6] || '').trim();
        const college = (row[2] || 'MIM Kuttikkanam').trim();
        const batch = (row[3] || 'Batch 1').trim();
        const registerNo = (row[4] || '').trim();
        const phone = (row[5] || '').trim();
        const name = (row[7] || '').trim();
        const gender = (row[8] || '').trim();
        const qualification = (row[9] || '').trim();
        const hasComputer = (row[10] || '').trim();
        const learnedBefore = (row[11] || '').trim();
        const certiportUser = (row[12] || '').trim();
        const rawPhoto = (row[15] || row[16] || row[14] || '').trim();
        const photoUrl = convertDriveUrlToDirectImg(rawPhoto);

        if (name || phone) {
          const record: RegistrationRecord = {
            timestamp,
            email,
            college,
            batch,
            registerNo,
            phone,
            name,
            gender,
            qualification,
            hasComputer,
            learnedBefore,
            certiportUser,
            photoUrl,
          };

          // Primary key: 10-digit phone number (or normalized name as fallback)
          const phoneDigits = phone.replace(/\D/g, '').slice(-10);
          const key = phoneDigits && phoneDigits.length >= 10 ? phoneDigits : name.toLowerCase().trim();

          if (key) {
            // Overwrite earlier rows to keep only the latest registration submission
            uniqueRegMap.set(key, record);
          }
        }
      }

      const regStudents = Array.from(uniqueRegMap.values());
      setRegistrationRecords(regStudents);

      // Enrich existing students (uploaded via Excel) with photos & contact info from Google Sheet.
      // Do NOT auto-insert new students — Performance Matrix shows only Excel-uploaded data.
      setStudents((prevStudents) => {
        const updated = [...prevStudents];

        regStudents.forEach((reg) => {
          const regPhoneDigits = reg.phone.replace(/\D/g, '');
          const normRegName = reg.name.toLowerCase().trim();

          // Match primarily by Phone Number (last 10 digits as primary key)
          const existingIdx = updated.findIndex((st) => {
            const stPhoneDigits = st.phone.replace(/\D/g, '');
            const stName = st.name.toLowerCase().trim();
            if (regPhoneDigits && stPhoneDigits && regPhoneDigits.length >= 10 && stPhoneDigits.length >= 10) {
              return regPhoneDigits.slice(-10) === stPhoneDigits.slice(-10);
            }
            return normRegName && stName && normRegName === stName;
          });

          // Only update existing students — never auto-insert from Google Sheet
          if (existingIdx >= 0) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              photoUrl: reg.photoUrl || updated[existingIdx].photoUrl,
              photo: reg.photoUrl ? '📷' : updated[existingIdx].photo,
              phone: reg.phone || updated[existingIdx].phone,
              email: reg.email || updated[existingIdx].email,
              college: reg.college || updated[existingIdx].college,
              department: reg.batch || updated[existingIdx].department,
            };
          }
          // Registration-only students (no Excel match) are shown in the Registration tab only
        });

        return updated;
      });

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncedTime(nowStr);

      if (showToastNotice) {
        toast({
          variant: 'success',
          title: 'Google Sheet Synced',
          message: `Synced ${regStudents.length} student registration records & photos from live Google Sheet.`,
        });
      }
    } catch (err) {
      console.error('Failed to sync Google Sheet Registration data:', err);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Hourly Auto-Sync Effect (1 hour = 3,600,000 milliseconds)
  useEffect(() => {
    syncGoogleSheetData();

    const interval = setInterval(() => {
      syncGoogleSheetData();
    }, 3600000);

    return () => clearInterval(interval);
  }, []);

  // Active student ID for displaying course completion checklist popover
  const [activeChecklistStudentId, setActiveChecklistStudentId] = useState<string | null>(null);

  // Assessment eligibility criteria rows
  const [eligibilityCriteria, setEligibilityCriteria] = useState<EligibilityCriterion[]>([
    { assessment: 'ass1', threshold: 40 },
    { assessment: 'ass2', threshold: 40 },
    { assessment: 'ass3', threshold: 40 },
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
    if (nextAssess) setEligibilityCriteria((prev) => [...prev, { assessment: nextAssess, threshold: 40 }]);
  };
  const handleRemoveEligCriterion = (idx: number) => {
    setEligibilityCriteria((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleUpdateEligCriterion = (idx: number, field: 'assessment' | 'threshold', value: string | number) => {
    setEligibilityCriteria((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  // Compute eligibility: attendance >= editable threshold + all criteria met
  const isStudentEligible = (s: StudentRecord) => {
    const attendanceOk = s.attendancePct >= attendanceThreshold;
    const assessmentsOk = eligibilityCriteria.every((crit) => {
      const score = s[crit.assessment as keyof StudentRecord] as number;
      return score >= crit.threshold;
    });
    return attendanceOk && assessmentsOk;
  };



  // Download 3-Field Voucher Template CSV (Phone Number, Name, Voucher ID)
  const downloadVoucherTemplate = () => {
    const csvHeader = "Phone Number,Name,Voucher ID\n";
    const rows = students.map((s) => `"${s.phone}","${s.name}","${s.voucherId || ''}"`).join("\n");
    
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

  const handleVoucherUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast({
        variant: 'info',
        title: 'Processing Voucher File',
        message: `Importing Voucher IDs from "${file.name}"...`,
      });

      setTimeout(() => {
        setStudents((prev) =>
          prev.map((s, idx) => ({
            ...s,
            voucherId: s.voucherId || `VOUCH-CHRIST-${105 + idx}`,
            voucherStatus: 'Assigned',
          }))
        );
        setUploadVoucherModalOpen(false);
        toast({
          variant: 'success',
          title: 'Voucher IDs Updated',
          message: `Voucher IDs successfully assigned to student records from ${file.name}.`,
        });
      }, 500);
    }
  };

  const handleAddStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentForm.name.trim()) return;

    const eligible = Number(newStudentForm.attendancePct) >= 84;
    const newStudent: StudentRecord = {
      id: `s-${Date.now()}`,
      name: newStudentForm.name,
      photo: '👨‍🎓',
      phone: newStudentForm.phone || '+91 90000 00000',
      email: newStudentForm.email || `${newStudentForm.name.toLowerCase().replace(/\s+/g, '.')}@student.edu`,
      college: newStudentForm.college,
      department: newStudentForm.department,
      attendancePct: Number(newStudentForm.attendancePct),
      attendanceStatus: Number(newStudentForm.attendancePct) >= 84 ? 'Regular' : 'Irregular',
      ass1: Number(newStudentForm.ass1),
      ass2: Number(newStudentForm.ass2),
      ass3: Number(newStudentForm.ass3),
      project: 80,
      finalExam: 0,
      overallScore: Math.round((Number(newStudentForm.ass1) + Number(newStudentForm.ass2) + Number(newStudentForm.ass3)) / 3),
      voucherId: eligible ? `VOUCH-CHRIST-${Math.floor(100 + Math.random() * 900)}` : '',
      voucherStatus: eligible ? 'Assigned' : 'Unassigned',
      certificateStatus: 'Generated',
    };

    setStudents((prev) => [...prev, newStudent]);
    setAddStudentModalOpen(false);
    setNewStudentForm({
      name: '',
      email: '',
      phone: '',
      college: 'Christ University',
      department: 'BCOM B',
      attendancePct: 85,
      ass1: 80,
      ass2: 80,
      ass3: 80,
    });
    toast({
      variant: 'success',
      title: 'Student Record Added',
      message: `Student "${newStudent.name}" added to registry successfully.`,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast({
        variant: 'info',
        title: 'Processing Excel File',
        message: `Importing records from "${file.name}"...`,
      });

      setTimeout(() => {
        const importedStudents: StudentRecord[] = [
          { id: `s-imp-${Date.now()}-1`, name: 'Anoop Varghese', photo: '👨‍🎓', phone: '+91 98950 12345', email: 'anoop.v@student.edu', college: 'Christ University', department: 'BCOM B', attendancePct: 90, attendanceStatus: 'Regular', ass1: 88, ass2: 84, ass3: 92, project: 85, finalExam: 86, overallScore: 87.5, voucherId: 'VOUCH-CHRIST-105', voucherStatus: 'Assigned', certificateStatus: 'Printed' },
          { id: `s-imp-${Date.now()}-2`, name: 'Sneha Kurian', photo: '👩‍🎓', phone: '+91 94960 67890', email: 'sneha.k@student.edu', college: 'Christ University', department: 'BCOM B', attendancePct: 86, attendanceStatus: 'Regular', ass1: 80, ass2: 78, ass3: 85, project: 82, finalExam: 80, overallScore: 81.2, voucherId: 'VOUCH-CHRIST-106', voucherStatus: 'Assigned', certificateStatus: 'Generated' },
        ];

        setStudents((prev) => [...prev, ...importedStudents]);
        setUploadModalOpen(false);
        toast({
          variant: 'success',
          title: 'Excel Import Successful',
          message: `Imported ${importedStudents.length} student records from ${file.name}.`,
        });
      }, 500);
    }
  };

  // Student list state — initialized from and saved to localStorage
  const [students, setStudents] = useState<StudentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('kvj.batch.students');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { localStorage.setItem('kvj.batch.students', JSON.stringify(students)); } catch {}
  }, [students]);

  // Final Exam student ID list — separate from master students array
  const [finalExamStudentIds, setFinalExamStudentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kvj.batch.finalExamStudentIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { localStorage.setItem('kvj.batch.finalExamStudentIds', JSON.stringify(finalExamStudentIds)); } catch {}
  }, [finalExamStudentIds]);

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
          attendanceStatus: newPct >= 84 ? 'Regular' : newPct >= 70 ? 'Irregular' : 'Critical',
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

  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  const activeBatch = batches.find((b) => b.id === selectedBatchId);
  const activeCourse = activeBatch ? courses.find((c) => c.id === activeBatch.courseId) : null;
  const activeTrainer = activeBatch ? trainers.find((t) => t.id === activeBatch.trainerId) : null;

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

  const notifyTrainerVoucher = (studentName: string, voucherId: string) => {
    const trainerNameStr = activeTrainer ? `${activeTrainer.firstName} ${activeTrainer.lastName}` : 'Lead Trainer';
    toast({
      variant: 'success',
      title: 'Trainer Notified',
      message: `Voucher notification for "${studentName}" (${voucherId || 'Pending'}) dispatched to ${trainerNameStr}.`,
    });
  };

  const exportPDFReport = (reportType: string) => {
    toast({
      variant: 'success',
      title: 'Report Downloaded',
      message: `${reportType} downloaded as PDF successfully with official seal.`,
    });
  };

  // Calculating overall metrics
  const eligibleCount = students.filter((s) => s.attendancePct >= 84).length;
  const attendanceAvg = Math.round(students.reduce((acc, s) => acc + s.attendancePct, 0) / students.length);
  const scoreAvg = Math.round(students.reduce((acc, s) => acc + s.overallScore, 0) / students.length);

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
                Active Batch: <strong>{activeBatch?.code || 'Christ 3BBA Data Analytics B1'}</strong> ({activeBatch?.college || 'Christ College'}) · Minimum attendance for voucher: <strong>84%</strong>.
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
              <Button size="sm" variant="secondary" onClick={() => exportPDFReport('Full Registry List')}>
                📄 Export Spreadsheet
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
                        style={{ fontSize: 11.5, padding: '4px 8px', minWidth: 130, fontWeight: 600 }}
                      >
                        <option value="all">All Students</option>
                        <option value="eligible">✅ Eligible Only</option>
                        <option value="not-eligible">❌ Not Eligible Only</option>
                      </select>
                    </div>
                  </div>

                  {/* Right: Action Buttons (Sync Google Sheet + Eligibility + Sort) */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => syncGoogleSheetData(true)}
                      disabled={isSyncingSheet}
                      title="Fetch live Registration photos and student data from Google Sheet (Auto-synced every 1 hour)"
                      style={{
                        fontSize: 11.5, padding: '5px 12px', borderRadius: 6, fontWeight: 700, cursor: isSyncingSheet ? 'not-allowed' : 'pointer',
                        border: '1px solid var(--brand)', background: 'var(--bg-sunken)', color: 'var(--brand)',
                        display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms',
                      }}
                    >
                      <span style={{ display: 'inline-block', transform: isSyncingSheet ? 'rotate(180deg)' : 'none', transition: 'transform 300ms' }}>🔄</span>
                      {isSyncingSheet ? 'Syncing...' : 'Sync Google Sheet'}
                    </button>

                    {lastSyncedTime && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        🟢 Auto-synced 1h • {lastSyncedTime}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowEligibilityPanel((p) => !p);
                        if (showSortPanel) setShowSortPanel(false);
                      }}
                      style={{
                        fontSize: 11.5, padding: '5px 14px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
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
                        fontSize: 11.5, padding: '5px 14px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
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
                        style={{ fontSize: 10, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--brand)', background: 'var(--brand)', color: '#fff', cursor: eligibilityCriteria.length >= 3 ? 'not-allowed' : 'pointer', opacity: eligibilityCriteria.length >= 3 ? 0.5 : 1 }}
                      >
                        ➕ Add Assessment
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {/* Attendance row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', flex: '1 1 270px' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>📊 Attendance</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>≥</span>
                        <input
                          type="number"
                          className="kvj-input"
                          value={attendanceThreshold}
                          onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
                          min={0}
                          max={100}
                          style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 'auto' }}>default: 84%</span>
                      </div>

                      {/* Course Max Marks & Pass % Criteria row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', flex: '1 1 270px' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>🎓 Max Marks</span>
                        <input
                          type="number"
                          className="kvj-input"
                          value={courseMaxMarks}
                          onChange={(e) => setCourseMaxMarks(Number(e.target.value))}
                          min={1}
                          style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                        />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 6 }}>Pass %</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>≥</span>
                        <input
                          type="number"
                          className="kvj-input"
                          value={coursePassPct}
                          onChange={(e) => setCoursePassPct(Number(e.target.value))}
                          min={0}
                          max={100}
                          style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 'auto' }}>
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
                            style={{ fontSize: 11.5, padding: '3px 6px', fontWeight: 600 }}
                          >
                            {(['ass1', 'ass2', 'ass3'] as SortableCol[]).map((a) => (
                              <option key={a} value={a} disabled={eligibilityCriteria.some((c, i) => i !== idx && c.assessment === a)}>
                                {assessmentLabelMap[a]}
                              </option>
                            ))}
                          </select>
                          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>≥</span>
                          <input
                            type="number"
                            className="kvj-input"
                            value={crit.threshold}
                            onChange={(e) => handleUpdateEligCriterion(idx, 'threshold', Number(e.target.value))}
                            min={0}
                            max={100}
                            style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>marks</span>
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
                          <button type="button" onClick={() => setMatrixSortLevels([])} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-sunken)', cursor: 'pointer', color: 'var(--status-danger)' }}>
                            ✕ Clear All
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleAddSortLevel}
                          disabled={matrixSortLevels.length >= allSortableCols.length}
                          style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--brand)', background: 'var(--brand)', color: '#fff', cursor: matrixSortLevels.length >= allSortableCols.length ? 'not-allowed' : 'pointer', opacity: matrixSortLevels.length >= allSortableCols.length ? 0.5 : 1 }}
                        >
                          ➕ Add Level
                        </button>
                      </div>
                    </div>

                    {matrixSortLevels.length === 0 && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '6px 0' }}>No sort levels configured. Click "➕ Add Level" to start.</div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {matrixSortLevels.map((lvl, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 50 }}>Level {idx + 1}</span>
                          <select
                            className="kvj-input"
                            value={lvl.col}
                            onChange={(e) => handleUpdateSortLevel(idx, 'col', e.target.value)}
                            style={{ fontSize: 11.5, padding: '3px 6px', flex: 1, fontWeight: 600 }}
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
                            style={{ fontSize: 11.5, padding: '3px 6px', minWidth: 110, fontWeight: 600 }}
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
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // 1. Filter
                      let filtered = students.filter((s) => {
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
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
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
                                  onBlur={(e) => { e.currentTarget.style.border = '1px dashed var(--border)'; e.currentTarget.style.background = 'transparent'; }}
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
                                style={{ fontSize: 11.5, padding: '3px 8px', width: 120, color: 'var(--text-primary)', border: '1px dashed var(--border)', background: 'transparent', borderRadius: 5 }}
                                onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--brand)'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                                onBlur={(e) => { e.currentTarget.style.border = '1px dashed var(--border)'; e.currentTarget.style.background = 'transparent'; }}
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
                                style={{ fontSize: 11.5, padding: '3px 8px', width: 160, border: '1px dashed var(--border)', background: 'transparent', borderRadius: 5 }}
                                onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--brand)'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                                onBlur={(e) => { e.currentTarget.style.border = '1px dashed var(--border)'; e.currentTarget.style.background = 'transparent'; }}
                              />
                            </td>

                            {/* Attendance */}
                            <td style={{ padding: 12, textAlign: 'center' }}>
                              <strong style={{ color: s.attendancePct >= attendanceThreshold ? 'var(--status-success)' : 'var(--status-danger)' }}>
                                {s.attendancePct}%
                              </strong>
                            </td>

                            {/* Exam Eligibility (dynamic) */}
                            <td style={{ padding: 12 }}>
                              <Badge tone={eligible ? 'success' : 'danger'}>
                                {eligible ? 'Eligible' : 'Not Eligible'}
                              </Badge>
                              {!eligible && (
                                <div style={{ fontSize: 10, color: 'var(--status-danger)', marginTop: 2 }}>
                                  {s.attendancePct < 84 ? `Attendance: ${s.attendancePct}% (need 84%)` : 'Missing assessments'}
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
                                          fontSize: 11, padding: '2px 6px', borderRadius: 5,
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
                                          <strong style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>📋 Pass Criteria & Course Tasks</strong>
                                          <button
                                            type="button"
                                            onClick={() => setActiveChecklistStudentId(null)}
                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}
                                          >
                                            ✕
                                          </button>
                                        </div>

                                        <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
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

                                          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--border)', fontSize: 10, color: 'var(--text-muted)' }}>
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
                                  style={{ padding: '4px 8px', fontSize: 11, width: 140 }}
                                  value={s.voucherId}
                                  onChange={(e) => assignVoucherId(s.id, e.target.value)}
                                  placeholder="Assign Voucher ID"
                                />
                                <Button
                                  size="sm"
                                  style={{ padding: '4px 8px', fontSize: 10 }}
                                  onClick={() => notifyTrainerVoucher(s.name, s.voucherId)}
                                >
                                  Notify
                                </Button>
                              </div>
                            </td>
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
                              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
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
                                  fontSize: 11,
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
                                  fontSize: 11,
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
                                  color: 'var(--status-success, #10b981)',
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  padding: '2px 5px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 800,
                                }} title={`${presentCount} Present`}>
                                  🟢 {presentCount}
                                </span>
                                <span style={{
                                  color: 'var(--status-danger, #ef4444)',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  padding: '2px 5px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 800,
                                }} title={`${absentCount} Absent`}>
                                  🔴 {absentCount}
                                </span>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: sessionPct >= 80 ? 'var(--status-success, #10b981)' : 'var(--status-danger, #ef4444)',
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
                                  background: sessionPct >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #ef4444, #f87171)',
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
                        <Button size="sm" variant="secondary" onClick={handleAddHourSessionColumn} style={{ fontSize: 11, padding: '4px 8px' }}>
                          ➕ Add Hour Column
                        </Button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const studentRecord = attendanceMatrix[s.id] || {};
                      const eligible = s.attendancePct >= 84;

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
                              ? 'var(--status-success, #10b981)'
                              : status === 'absent'
                              ? 'var(--status-danger, #ef4444)'
                              : 'var(--status-warning, #f59e0b)';

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
                                    fontSize: 11,
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
                <Button size="sm" onClick={handleAddFinalExamStudentRow} style={{ fontSize: 11.5 }}>
                  ➕ Add Student
                </Button>
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
                    {students.map((s) => {
                      const examDateVal = s.examDate || '2026-07-25';
                      const collegeVal = s.college || 'Christ University';
                      const courseVal = s.course || 'Data Analytics';
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
                                setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, examDate: newD } : st));
                              }}
                              style={{ fontSize: 11.5, padding: '3px 6px', width: 125 }}
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
                              style={{ fontSize: 11.5, padding: '3px 6px', width: 140, fontWeight: 600 }}
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

                                // Match against other student records in the registry
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
                                      return {
                                        ...st,
                                        phone: typedPhone,
                                        name: match.name,
                                        college: match.college,
                                        course: match.course || 'Data Analytics',
                                        voucherId: match.voucherId || `VOUCH-CHRIST-${Math.floor(100 + Math.random() * 900)}`,
                                        retestVoucherId: match.retestVoucherId || `VOUCH-RETEST-${Math.floor(100 + Math.random() * 900)}`,
                                      };
                                    }
                                    return { ...st, phone: typedPhone };
                                  })
                                );
                              }}
                              placeholder="+91 98765 00000"
                              style={{ fontSize: 11.5, padding: '3px 6px', width: 130, color: 'var(--text-muted)' }}
                            />
                            <datalist id={`phone-autofill-${s.id}`}>
                              {students.map((st) => (
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
                                style={{ fontSize: 11.5, padding: '3px 6px', width: 125, fontWeight: 700 }}
                              />
                            </div>
                          </td>

                          {/* 5. Course */}
                          <td style={{ padding: 12 }}>
                            <select
                              value={courseVal}
                              onChange={(e) => {
                                const cVal = e.target.value;
                                setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, course: cVal } : st));
                              }}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 6px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'var(--bg-surface)',
                                color: 'var(--brand)',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="Data Analytics">Data Analytics</option>
                              <option value="Power BI & Tableau">Power BI & Tableau</option>
                              <option value="Fullstack Web Dev">Fullstack Web Dev</option>
                              <option value="Cloud Architecture">Cloud Architecture</option>
                              <option value="AI & Machine Learning">AI & Machine Learning</option>
                            </select>
                          </td>

                          {/* 6. Exam Mark (Updates Final Exam + Retest Mark in Sync!) */}
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <input
                                type="number"
                                className="kvj-input"
                                value={s.finalExam || ''}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, finalExam: val, retestScore: val } : st));
                                }}
                                placeholder="Mark"
                                style={{ fontSize: 11.5, padding: '3px 6px', width: 65, textAlign: 'center', fontWeight: 700 }}
                              />
                              {s.finalExam > 0 && (
                                <Badge tone={hasPassed ? 'success' : 'danger'}>
                                  {hasPassed ? 'Passed 🏆' : 'Failed ❌'}
                                </Badge>
                              )}
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
                                  setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, examAttemptCount: nextAttempt, retestApproved: nextAttempt === 2 } : st));
                                  toast({
                                    variant: 'info',
                                    title: 'Exam Attempt Updated',
                                    message: `Set ${s.name} to ${nextAttempt === 2 ? 'Retest (2nd Attempt)' : 'Initial Test (1st Attempt)'}.`,
                                  });
                                }}
                                style={{
                                  fontSize: 10,
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
                                  setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, selectedVoucherId: vCode } : st));
                                  toast({
                                    variant: 'info',
                                    title: 'Retest Voucher Selected',
                                    message: `Selected voucher "${vCode}" for ${s.name}.`,
                                  });
                                }}
                                style={{
                                  fontSize: 11,
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
                                  placeholder="VOUCH-XXX-000"
                                  style={{ fontSize: 11, padding: '3px 6px', width: 135 }}
                                />
                                <Button
                                  size="sm"
                                  style={{ padding: '3px 8px', fontSize: 10 }}
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
                                color: 'var(--status-danger, #ef4444)',
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
                    })}
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
                    {students.map((s) => {
                      const pStatus = s.retestPaymentStatus || (s.attendancePct >= 84 ? 'Paid' : 'Pending');
                      const collectedAmt = s.retestCollectedAmount !== undefined ? s.retestCollectedAmount : (pStatus === 'Paid' ? 500 : 0);
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
                                onChange={(e) => {
                                  const nextP = e.target.value as 'Paid' | 'Pending';
                                  setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, retestPaymentStatus: nextP } : st));
                                }}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '3px 6px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-surface)',
                                  color: pStatus === 'Paid' ? 'var(--status-success, #10b981)' : 'var(--status-warning, #f59e0b)',
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="Paid">Paid</option>
                                <option value="Pending">Pending</option>
                              </select>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
                                <input
                                  type="number"
                                  className="kvj-input"
                                  value={collectedAmt}
                                  onChange={(e) => {
                                    const amt = Number(e.target.value);
                                    setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, retestCollectedAmount: amt } : st));
                                  }}
                                  placeholder="Amount"
                                  style={{ fontSize: 11.5, padding: '3px 6px', width: 70, fontWeight: 700 }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* 4. Retest Mark */}
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <input
                              type="number"
                              className="kvj-input"
                              value={s.retestScore !== undefined ? (s.retestScore || '') : (s.finalExam || '')}
                              onChange={(e) => {
                                const markVal = e.target.value === '' ? 0 : Number(e.target.value);
                                setStudents((prev) =>
                                  prev.map((st) =>
                                    st.id === s.id
                                      ? {
                                          ...st,
                                          retestScore: markVal,
                                          finalExam: markVal,
                                          examAttemptCount: 2,
                                        }
                                      : st
                                  )
                                );
                              }}
                              placeholder="Mark"
                              style={{ fontSize: 11.5, padding: '3px 6px', width: 65, textAlign: 'center', fontWeight: 700 }}
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
                              placeholder="New Voucher ID"
                              style={{ fontSize: 11, padding: '3px 6px', width: 155 }}
                            />
                          </td>

                          {/* 6. Send Voucher */}
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <Button
                              size="sm"
                              style={{ padding: '4px 10px', fontSize: 11 }}
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
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
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
                          style={{ fontSize: 11.5, padding: '5px 10px', width: 220, borderRadius: 6 }}
                        />
                        <Button
                          size="sm"
                          onClick={() => syncGoogleSheetData(true)}
                          disabled={isSyncingSheet}
                          style={{ fontSize: 11.5 }}
                        >
                          🔄 {isSyncingSheet ? 'Syncing...' : 'Sync Google Sheet'}
                        </Button>
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
                                <td style={{ padding: 10, color: 'var(--text-muted)', fontSize: 11 }}>{r.timestamp || '—'}</td>
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
              <SectionHeader title="📜 Certificate Logistics & Delivery tracking" />
              
              <Card style={{ padding: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Logistics Delivery Status
                      </label>
                      <select
                        className="kvj-select"
                        value={certificateStatus}
                        onChange={(e) => setCertificateStatus(e.target.value as any)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                      >
                        <option value="Generated">Generated</option>
                        <option value="Printed">Printed</option>
                        <option value="Dispatched">Dispatched</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Received">Received</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Expected/Delivered Date
                      </label>
                      <input
                        type="date"
                        className="kvj-input"
                        value={certificateDeliveryDate}
                        onChange={(e) => setCertificateDeliveryDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Courier Name
                      </label>
                      <input
                        type="text"
                        className="kvj-input"
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Tracking reference ID
                      </label>
                      <input
                        type="text"
                        className="kvj-input"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Signed Courier Receipt Document
                    </label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSignedReceiptUploaded(true);
                          toast({ variant: 'success', title: 'Receipt Uploaded', message: 'Signed receipt has been linked successfully.' });
                        }}
                      >
                        {signedReceiptUploaded ? '✅ Change Uploaded Document' : '📤 Upload Signed Receipt'}
                      </Button>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {signedReceiptUploaded ? 'receipt_christ_signed_co.pdf' : 'Pending upload'}
                      </span>
                    </div>
                  </div>
                </div>
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
            Batch: <strong>{activeBatch?.code || 'Christ 3BBA Data Analytics B1'}</strong> ({activeBatch?.college || 'Christ College'})
          </p>
        </div>

        <Button onClick={() => setCreateBatchModalOpen(true)}>
          ➕ Add New Batch
        </Button>
      </div>

      {/* Training Batch Overview Carousel — one card per assigned batch.
          Selecting a card sets the active batch for every section below. */}
      <TrainingBatchCarousel
        batches={batches}
        courses={courses}
        trainers={trainers}
        activeId={selectedBatchId}
        onSelect={setSelectedBatchId}
        onAction={handleCarouselAction}
        onEdit={handleOpenEditBatch}
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
                Training Course Name
              </label>
              <input
                type="text"
                className="kvj-input"
                required
                value={editForm.trainingName}
                onChange={(e) => setEditForm({ ...editForm, trainingName: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Program
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  value={editForm.program}
                  onChange={(e) => setEditForm({ ...editForm, program: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Batch No.
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
                  Academic Year
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
                <input
                  type="text"
                  className="kvj-input"
                  required
                  value={editForm.trainer}
                  onChange={(e) => setEditForm({ ...editForm, trainer: e.target.value })}
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
                  required
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
        <Drawer open={true} onClose={() => setUploadModalOpen(false)} title="📤 Upload Students Data (Excel / CSV)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Select an Excel file (<code>.xlsx</code> / <code>.csv</code>) to import multiple student records directly into the active batch registry.
            </p>
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
                onChange={handleFileUpload}
                style={{ marginTop: 12 }}
              />
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
                Training Course Title (Program)
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
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
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
                  let savedColleges: Array<{ id: string; name: string; code: string }> = [
                    { id: 'col-1', name: 'Christ Irinjalakkuda', code: 'CHRIST-IRK' },
                    { id: 'col-2', name: 'MIM Kuttikkanam', code: 'MIM-KUTT' },
                    { id: 'col-3', name: 'St. Thomas College', code: 'STC-THR' },
                  ];
                  try {
                    const raw = localStorage.getItem('kvj.colleges');
                    if (raw) savedColleges = JSON.parse(raw);
                  } catch {}

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

    </AppShell>
  );
}

export default BatchManagement;
