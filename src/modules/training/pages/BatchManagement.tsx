import { useState, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Card, SectionHeader, Badge } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { useTraining } from '../hooks/useTraining';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

// Workspace Navigation Tabs
type WorkspaceTab =
  | 'overview'
  | 'pipeline'
  | 'students'
  | 'attendance'
  | 'assessments'
  | 'certificates'
  | 'communication'
  | 'documents'
  | 'timeline';

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
  phone: string;
  email: string;
  college: string;
  department: string;
  attendancePct: number;
  attendanceStatus: 'Regular' | 'Irregular' | 'Critical';
  ass1: number;
  ass2: number;
  ass3: number;
  project: number;
  finalExam: number;
  overallScore: number;
  voucherId: string;
  voucherStatus: 'Assigned' | 'Unassigned' | 'Expired';
  certificateStatus: 'Generated' | 'Printed' | 'Dispatched' | 'Delivered' | 'Received';
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
  const { batches, courses } = useTraining();
  const { toast } = useNotifications();
  const [trainers, setTrainers] = useState<Employee[]>([]);
  
  // Batch selection
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  
  // Tab control
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  // Full Page student table overlay
  const [showFullStudentReport, setShowFullStudentReport] = useState(false);

  // Email composer modal state
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailTo, setEmailTo] = useState('coordinator@christcollege.edu');
  const [emailBody, setEmailBody] = useState('');

  // Checklist State per Stage
  const [checklist, setChecklist] = useState<Record<string, ChecklistItem[]>>({
    planning: [
      { id: 'c-1', task: 'College Confirmation Form Signed', checked: true, assigned: 'Operations Manager', dueDate: '2026-07-15', priority: 'High', commentsCount: 1 },
      { id: 'c-2', task: 'Trainer Assignment Completed', checked: true, assigned: 'Academic Head', dueDate: '2026-07-16', priority: 'High', commentsCount: 0 },
    ],
    prep: [
      { id: 'c-3', task: 'Syllabus & Material Dispatched', checked: true, assigned: 'Materials Dept', dueDate: '2026-07-18', priority: 'Medium', commentsCount: 2 },
      { id: 'c-4', task: 'Student Registry Uploaded', checked: true, assigned: 'Operations Executive', dueDate: '2026-07-20', priority: 'High', commentsCount: 0 },
      { id: 'c-5', task: 'Projector & Lab Systems Checked', checked: false, assigned: 'Lead Trainer', dueDate: '2026-07-22', priority: 'Medium', commentsCount: 3 },
    ],
    training: [
      { id: 'c-6', task: 'Day 1 Sessions Logged', checked: true, assigned: 'Lead Trainer', dueDate: '2026-07-22', priority: 'High', commentsCount: 0 },
      { id: 'c-7', task: 'Feedback link shared with students', checked: false, assigned: 'Lead Trainer', dueDate: '2026-07-25', priority: 'Low', commentsCount: 1 },
    ],
  });

  // Certificate tracker parameter state
  const [certificateDeliveryDate, setCertificateDeliveryDate] = useState('2026-07-28');
  const [certificateStatus, setCertificateStatus] = useState<'Generated' | 'Printed' | 'Dispatched' | 'Delivered' | 'Received'>('Printed');
  const [courierName, setCourierName] = useState('DTDC Express');
  const [trackingNumber, setTrackingNumber] = useState('DTDC-992019A');
  const [signedReceiptUploaded, setSignedReceiptUploaded] = useState(false);

  // Student list state
  const [students, setStudents] = useState<StudentRecord[]>([
    { id: 's-1', name: 'Albin Joseph', photo: '👨‍🎓', phone: '+91 98765 43210', email: 'albin.joseph@student.edu', college: 'Christ University', department: 'BCOM B', attendancePct: 88, attendanceStatus: 'Regular', ass1: 85, ass2: 78, ass3: 90, project: 82, finalExam: 84, overallScore: 83.4, voucherId: 'VOUCH-CHRIST-101', voucherStatus: 'Assigned', certificateStatus: 'Printed' },
    { id: 's-2', name: 'Merlin K Thomas', photo: '👩‍🎓', phone: '+91 94455 66778', email: 'merlin.t@student.edu', college: 'Christ University', department: 'BCOM B', attendancePct: 82, attendanceStatus: 'Irregular', ass1: 72, ass2: 65, ass3: 80, project: 75, finalExam: 0, overallScore: 58.4, voucherId: '', voucherStatus: 'Unassigned', certificateStatus: 'Generated' },
    { id: 's-3', name: 'Devanand P', photo: '👨‍🎓', phone: '+91 88990 11223', email: 'devanand.p@student.edu', college: 'Christ University', department: 'BCOM B', attendancePct: 94, attendanceStatus: 'Regular', ass1: 92, ass2: 88, ass3: 95, project: 90, finalExam: 88, overallScore: 90.6, voucherId: 'VOUCH-CHRIST-102', voucherStatus: 'Assigned', certificateStatus: 'Printed' },
    { id: 's-4', name: 'Riya Rose', photo: '👩‍🎓', phone: '+91 77889 90011', email: 'riya.rose@student.edu', college: 'Christ University', department: 'BCOM B', attendancePct: 76, attendanceStatus: 'Critical', ass1: 60, ass2: 54, ass3: 68, project: 62, finalExam: 0, overallScore: 48.8, voucherId: '', voucherStatus: 'Unassigned', certificateStatus: 'Generated' },
  ]);

  // Email communications log
  const [emailLogs, setEmailLogs] = useState<EmailHistoryItem[]>([
    { id: 'e-1', to: 'coordinator@christcollege.edu', subject: 'Christ BCOM Batch 1 — Student Details', sentAt: '2026-07-20 09:30 AM', status: 'Read' },
    { id: 'e-2', to: 'coordinator@christcollege.edu', subject: 'Christ BCOM Batch 1 — Daily Session Report (Day 1)', sentAt: '2026-07-21 05:00 PM', status: 'Delivered' }
  ]);

  // Uploaded documents
  const [documents, setDocuments] = useState<DocumentItem[]>([
    { id: 'd-1', name: 'Christ_BCOM_Student_Registry.xlsx', category: 'Material', uploadedAt: '2026-07-20', size: '24 KB' },
    { id: 'd-2', name: 'Power_BI_Syllabus_Outline.pdf', category: 'Material', uploadedAt: '2026-07-18', size: '1.2 MB' },
    { id: 'd-3', name: 'Christ_BCOM_Day1_Attendance.pdf', category: 'Report', uploadedAt: '2026-07-21', size: '120 KB' }
  ]);

  // Activity Timeline
  const [timeline, setTimeline] = useState([
    { id: 't-1', action: 'Daily Session Report Generated', user: 'Linto George', timestamp: '2026-07-21 05:00 PM' },
    { id: 't-2', action: 'Signed Confirmation Form Uploaded', user: 'Admin Operations', timestamp: '2026-07-20 02:15 PM' },
    { id: 't-3', action: 'Batch Scheduled & Coordinator Notified', user: 'Manager Operations', timestamp: '2026-07-15 11:30 AM' },
  ]);

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
    setEmailComposerOpen(true);
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
      message: `${reportType} downloaded as PDF successfully with official KVJ Analytics seal.`,
    });
  };

  // Calculating overall metrics
  const eligibleCount = students.filter((s) => s.attendancePct >= 84).length;
  const attendanceAvg = Math.round(students.reduce((acc, s) => acc + s.attendancePct, 0) / students.length);
  const scoreAvg = Math.round(students.reduce((acc, s) => acc + s.overallScore, 0) / students.length);

  return (
    <AppShell>
      {/* Top Header Card Workspace Details */}
      <Card style={{ marginBottom: 20, padding: 20, borderLeft: '4px solid var(--brand)', background: 'var(--bg-panel)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                {activeCourse ? activeCourse.title : 'Training Batch Overview'}
              </h1>
              <Badge tone="progress">Training Phase</Badge>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              🏢 College: <strong>{activeBatch?.code || 'Christ College'}</strong> · Coordinator: <strong>Sr. Coordinator Dept.</strong> · Trainer: <strong>{activeTrainer ? `${activeTrainer.firstName} ${activeTrainer.lastName}` : 'Linto George'}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              📅 Schedule: <strong>{activeBatch?.startDate} to {activeBatch?.endDate}</strong> · Status: <strong>Preparation stage</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" onClick={() => handleOpenComposer('Daily Session Report', 'Dear Coordinator, Attached is the Daily Report...')}>
              ✉️ Send Daily Report
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleOpenComposer('Student Details Registry', 'Attached are the student details...')}>
              ✉️ Send Student Details
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleOpenComposer('Final Course Completion Report', 'Attached is the final report...')}>
              ✉️ Send Final Report
            </Button>
            <Button size="sm" onClick={() => setShowFullStudentReport(true)}>
              📋 Show Student Report (Full Workspace)
            </Button>
          </div>
        </div>

        {/* Training Progress Bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            <span>Workspace Completion Progress</span>
            <span>68%</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: '68%', height: '100%', background: 'var(--brand)' }} />
          </div>
        </div>
      </Card>

      {/* Main Two-Column Content Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: 20, alignItems: 'start' }}>
        
        {/* Left Side: Navigation Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(
            [
              { id: 'overview', label: '📊 Overview Dashboard' },
              { id: 'pipeline', label: '⚙️ Training Pipeline' },
              { id: 'students', label: '👥 Student Records' },
              { id: 'attendance', label: '📅 Attendance logs' },
              { id: 'assessments', label: '📝 Assessments' },
              { id: 'certificates', label: '📜 Certificates Delivery' },
              { id: 'communication', label: '✉️ Communications Log' },
              { id: 'documents', label: '📁 Document Center' },
              { id: 'timeline', label: '🕒 Activity Timeline' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                textAlign: 'left',
                border: 'none',
                borderRadius: 6,
                background: activeTab === t.id ? 'var(--brand)' : 'transparent',
                color: activeTab === t.id ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Center: Content View Area */}
        <div>
          
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <SectionHeader title="Batch Overview Metrics" />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>👥 Enrolled Students</h3>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{students.length} Students</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Average attendance: <strong>{attendanceAvg}%</strong>
                  </div>
                </Card>

                <Card style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>🎯 Exam Eligibility</h3>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-success)' }}>
                    {eligibleCount} / {students.length} Eligible
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Requires at least <strong>84%</strong> attendance threshold.
                  </div>
                </Card>

                <Card style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>📜 Certificate Status</h3>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)' }}>{certificateStatus}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Tracking courier: <strong>{trackingNumber}</strong>
                  </div>
                </Card>

                <Card style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>📈 Average Performance Score</h3>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{scoreAvg}%</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    From 3 assessments + project + final exam.
                  </div>
                </Card>
              </div>

              {/* Photo & Video quick previews */}
              <Card style={{ padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🖼️ Media Galleries</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ border: '1px dashed var(--border)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 20 }}>📸</div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Photos (3 Uploaded)</div>
                  </div>
                  <div style={{ border: '1px dashed var(--border)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 20 }}>🎥</div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Videos (1 Logged)</div>
                  </div>
                </div>
              </Card>

              {/* Simple Batch Directory */}
              <Card style={{ padding: 18 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📋 Training Details Directory</h3>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: 10 }}>College</th>
                      <th style={{ padding: 10 }}>Course</th>
                      <th style={{ padding: 10 }}>Trainer</th>
                      <th style={{ padding: 10 }}>Marketing Converted (Status)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b, idx) => {
                      const courseObj = courses.find((c) => c.id === b.courseId);
                      const trainerObj = trainers.find((t) => t.id === b.trainerId);
                      // Alternate Yes, No, Yes, No as requested
                      const marketingStatus = idx % 2 === 0 ? 'Yes' : 'No';
                      
                      return (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedBatchId(b.id)}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            cursor: 'pointer',
                            background: selectedBatchId === b.id ? 'var(--bg-sunken)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: 10, fontWeight: 700 }}>{b.code}</td>
                          <td style={{ padding: 10 }}>{courseObj ? courseObj.title : 'General Training'}</td>
                          <td style={{ padding: 10 }}>{trainerObj ? `${trainerObj.firstName} ${trainerObj.lastName}` : 'Unassigned'}</td>
                          <td style={{ padding: 10 }}>
                            <Badge tone={marketingStatus === 'Yes' ? 'success' : 'danger'}>
                              {marketingStatus}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* TAB 2: TRAINING PIPELINE */}
          {activeTab === 'pipeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <SectionHeader title="Operational Training Pipeline Stage Tracker" />
              
              {/* Planning Stage */}
              <Card style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: 14 }}>1. Planning Stage</strong>
                  <Badge tone="success">100% Complete</Badge>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {checklist.planning.map((item) => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={item.checked} onChange={() => handleToggleCheck('planning', item.id)} />
                      <span>{item.task} (Assigned: <strong>{item.assigned}</strong>)</span>
                    </label>
                  ))}
                </div>
              </Card>

              {/* Preparation Stage */}
              <Card style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: 14 }}>2. Preparation Stage</strong>
                  <Badge tone="progress">66% Complete</Badge>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {checklist.prep.map((item) => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={item.checked} onChange={() => handleToggleCheck('prep', item.id)} />
                      <span>{item.task} (Assigned: <strong>{item.assigned}</strong>)</span>
                    </label>
                  ))}
                </div>
              </Card>

              {/* Training Stage */}
              <Card style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: 14 }}>3. Training Stage</strong>
                  <Badge tone="neutral">50% Complete</Badge>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {checklist.training.map((item) => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={item.checked} onChange={() => handleToggleCheck('training', item.id)} />
                      <span>{item.task} (Assigned: <strong>{item.assigned}</strong>)</span>
                    </label>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 3: STUDENT RECORDS */}
          {activeTab === 'students' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionHeader title="Students Enrolled Registry" />
                <Button size="sm" onClick={() => setShowFullStudentReport(true)}>
                  🔍 Full screen Workspace
                </Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {students.map((s) => (
                  <Card key={s.id} style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>{s.photo}</span>
                        <div>
                          <strong style={{ fontSize: 13.5 }}>{s.name}</strong>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email} · {s.phone}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Attendance</div>
                          <strong style={{ fontSize: 12.5 }}>{s.attendancePct}%</strong>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Voucher Status</div>
                          <Badge tone={s.voucherId ? 'success' : 'neutral'}>
                            {s.voucherId ? 'Assigned' : 'Unassigned'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ATTENDANCE LOGS */}
          {activeTab === 'attendance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionHeader title="Daily Attendance Registry" />
              <Card style={{ padding: 16 }}>
                <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: 8 }}>Student</th>
                      <th style={{ padding: 8 }}>Attendance Rate</th>
                      <th style={{ padding: 8 }}>Action Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 8, fontWeight: 700 }}>{s.name}</td>
                        <td style={{ padding: 8 }}>{s.attendancePct}%</td>
                        <td style={{ padding: 8 }}>
                          <Badge tone={s.attendancePct >= 84 ? 'success' : 'danger'}>
                            {s.attendancePct >= 84 ? 'Eligible' : 'Not Eligible'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* TAB 5: ASSESSMENTS */}
          {activeTab === 'assessments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionHeader title="Student Assessment Grades" />
              <Card style={{ padding: 16 }}>
                <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: 8 }}>Student Name</th>
                      <th style={{ padding: 8 }}>Ass 1</th>
                      <th style={{ padding: 8 }}>Ass 2</th>
                      <th style={{ padding: 8 }}>Ass 3</th>
                      <th style={{ padding: 8 }}>Final Exam</th>
                      <th style={{ padding: 8 }}>Overall Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 8, fontWeight: 700 }}>{s.name}</td>
                        <td style={{ padding: 8 }}>{s.ass1}</td>
                        <td style={{ padding: 8 }}>{s.ass2}</td>
                        <td style={{ padding: 8 }}>{s.ass3}</td>
                        <td style={{ padding: 8 }}>{s.finalExam || '—'}</td>
                        <td style={{ padding: 8, fontWeight: 700 }}>{s.overallScore}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* TAB 6: CERTIFICATE DELIVERY */}
          {activeTab === 'certificates' && (
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

          {/* TAB 7: COMMUNICATIONS LOG */}
          {activeTab === 'communication' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionHeader title="📧 Coordinator Communications & Email Logs" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {emailLogs.map((log) => (
                  <Card key={log.id} style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{log.subject}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>To: {log.to} · Sent: {log.sentAt}</div>
                      </div>
                      <Badge tone={log.status === 'Read' ? 'success' : 'progress'}>
                        {log.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: DOCUMENT CENTER */}
          {activeTab === 'documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionHeader title="📁 Document Center & Material Archives" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {documents.map((doc) => (
                  <Card key={doc.id} style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>📄 {doc.name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Uploaded: {doc.uploadedAt} · Size: {doc.size}</div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => toast({ variant: 'info', title: 'File Downloading', message: `Dispatched ${doc.name} to downloads.` })}>
                        Download
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: ACTIVITY TIMELINE */}
          {activeTab === 'timeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionHeader title="🕒 Activity Logs & Audit Timeline" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {timeline.map((item) => (
                  <div key={item.id} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand)', marginTop: 4 }} />
                    <div>
                      <strong>{item.action}</strong>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        Triggered by: {item.user} · Timestamp: {item.timestamp}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar: AI suggestions & Coordinator Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <Card style={{ padding: 16, borderLeft: '4px solid var(--brand)', background: 'var(--bg-sunken)' }}>
            <h3 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)', marginBottom: 8 }}>🤖 Workspace AI Assistant</h3>
            <div style={{ fontSize: 11.5, lineHeight: 1.4 }}>
              <div>💡 <strong>Attendance Warning:</strong> Merlin K Thomas & Riya Rose are below the required 84% pass threshold.</div>
              <div style={{ marginTop: 8 }}>💡 <strong>Voucher Status:</strong> 2 students have unassigned exam voucher IDs. Suggest matching them now.</div>
              <div style={{ marginTop: 8 }}>💡 <strong>Signed Receipt:</strong> Certificates are printed but receipt signature upload is pending.</div>
            </div>
          </Card>

          <Card style={{ padding: 16 }}>
            <h3 style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>📋 Coordinator Daily Remarks</h3>
            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              "Lab systems checked. Day 1 training session started on time. Need to schedule retest for students failing initial mock quiz."
            </p>
          </Card>

          <Card style={{ padding: 16 }}>
            <h3 style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>📜 Quick Report Download</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button size="sm" variant="secondary" onClick={() => exportPDFReport('Attendance Report')}>
                📥 PDF Attendance Report
              </Button>
              <Button size="sm" variant="secondary" onClick={() => exportPDFReport('Assessment Marks Grid')}>
                📥 PDF Assessment Report
              </Button>
              <Button size="sm" variant="secondary" onClick={() => exportPDFReport('Certificate Delivery Status')}>
                📥 PDF Certificates Report
              </Button>
            </div>
          </Card>

        </div>

      </div>

      {/* FULL PAGE STUDENT TABLE WORKSPACE OVERLAY */}
      {showFullStudentReport && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'var(--bg-surface)',
            zIndex: 2000,
            overflowY: 'auto',
            padding: 30,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>📊 Students Performance & Exam Eligibility Matrix</h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Attendance criteria requires a minimum threshold of <strong>84%</strong> to unlock Final Exam vouchers.
              </p>
            </div>
            <Button onClick={() => setShowFullStudentReport(false)}>
              Close Full Workspace
            </Button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" onClick={() => exportPDFReport('Full Registry List')}>
              📄 Export Spreadsheet
            </Button>
            <Button size="sm" variant="secondary" onClick={() => alert('Printing student registry...')}>
              🖨️ Print Matrix
            </Button>
          </div>

          {/* Full Screen Table */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)' }}>
                    <th style={{ padding: 10, position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 10, minWidth: 140 }}>Student Name</th>
                    <th style={{ padding: 10 }}>Contact Info</th>
                    <th style={{ padding: 10 }}>Attendance</th>
                    <th style={{ padding: 10 }}>Exam Eligibility</th>
                    <th style={{ padding: 10 }}>Ass 1</th>
                    <th style={{ padding: 10 }}>Ass 2</th>
                    <th style={{ padding: 10 }}>Ass 3</th>
                    <th style={{ padding: 10 }}>Final Exam</th>
                    <th style={{ padding: 10 }}>Overall Score</th>
                    <th style={{ padding: 10, minWidth: 240 }}>Voucher ID Management</th>
                    <th style={{ padding: 10 }}>Certificate status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const eligible = s.attendancePct >= 84;
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        
                        {/* Frozen Name Column */}
                        <td style={{ padding: 10, fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2 }}>
                          {s.photo} {s.name}
                        </td>

                        <td style={{ padding: 10 }}>
                          <div>{s.email}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.phone}</div>
                        </td>

                        <td style={{ padding: 10 }}>
                          <strong style={{ color: eligible ? 'var(--status-success)' : 'var(--status-danger)' }}>
                            {s.attendancePct}%
                          </strong>
                        </td>

                        <td style={{ padding: 10 }}>
                          <Badge tone={eligible ? 'success' : 'danger'}>
                            {eligible ? 'Eligible' : 'Not Eligible'}
                          </Badge>
                          {!eligible && (
                            <div style={{ fontSize: 10, color: 'var(--status-danger)', marginTop: 2 }}>
                              Missing {84 - s.attendancePct}% (Requires ~2 sessions)
                            </div>
                          )}
                        </td>

                        <td style={{ padding: 10 }}>{s.ass1}</td>
                        <td style={{ padding: 10 }}>{s.ass2}</td>
                        <td style={{ padding: 10 }}>{s.ass3}</td>
                        <td style={{ padding: 10 }}>{s.finalExam || '—'}</td>
                        <td style={{ padding: 10, fontWeight: 700 }}>{s.overallScore}%</td>
                        
                        {/* Voucher ID Management Column */}
                        <td style={{ padding: 10 }}>
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

                        <td style={{ padding: 10 }}>
                          <Badge tone={s.certificateStatus === 'Printed' ? 'success' : 'info'}>
                            {s.certificateStatus}
                          </Badge>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

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

    </AppShell>
  );
}

export default BatchManagement;
