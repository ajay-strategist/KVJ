import { useState, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Card, SectionHeader, Badge } from '../../../shared/ui/components';
import { useTraining } from '../hooks/useTraining';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Batch } from '../training.repository';
import type { Employee } from '../../employee/employee.repository';

interface BatchPipelineDetails {
  initialWorks: boolean;
  photos: boolean;
  training: boolean;
  videos: boolean;
  feedback: boolean;
  certificateDeliveryDate: string;
  signedReceiptUploaded: boolean;
  coordinatorEmail: string;
}

interface StudentReportItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  attendancePct: number;
  mockTestScore: number;
  finalExamScore: number;
  voucherId: string;
}

const initialMockStudents: StudentReportItem[] = [
  { id: 's1', name: 'Albin Joseph', email: 'albin.joseph@student.edu', phone: '+91 98765 43210', attendancePct: 88, mockTestScore: 78, finalExamScore: 82, voucherId: 'VOUCH-CHRIST-01' },
  { id: 's2', name: 'Merlin K Thomas', email: 'merlin.t@student.edu', phone: '+91 94455 66778', attendancePct: 82, mockTestScore: 65, finalExamScore: 0, voucherId: '' },
  { id: 's3', name: 'Devanand P', email: 'devanand.p@student.edu', phone: '+91 88990 11223', attendancePct: 94, mockTestScore: 85, finalExamScore: 89, voucherId: 'VOUCH-CHRIST-02' },
  { id: 's4', name: 'Riya Rose', email: 'riya.rose@student.edu', phone: '+91 77889 90011', attendancePct: 76, mockTestScore: 54, finalExamScore: 0, voucherId: '' },
];

export function BatchManagement() {
  const { batches, courses, createBatch, loading } = useTraining();
  const { toast } = useNotifications();
  const [open, setOpen] = useState(false);
  const [trainers, setTrainers] = useState<Employee[]>([]);

  // Local state for pipeline data and student list per batch
  const [pipelineMap, setPipelineMap] = useState<Record<string, BatchPipelineDetails>>({});
  const [studentsMap, setStudentsMap] = useState<Record<string, StudentReportItem[]>>({});
  
  // Selected batch for detailed checklist tracking and report view
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [reportBatchId, setReportBatchId] = useState<string>('');

  useEffect(() => {
    container.resolve(EMPLOYEE_SERVICE_TOKEN).listEmployees().then((res) => {
      if (res.ok) setTrainers(res.value);
    });
  }, []);

  // Initialize selected batch once batches list is loaded
  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  const handleCreateSubmit = async (values: Record<string, unknown>) => {
    const res = await createBatch({
      courseId: values.courseId as string,
      code: values.code as string,
      capacity: Number(values.capacity),
      startDate: values.startDate as string,
      endDate: values.endDate as string,
      trainerId: values.trainerId as string || undefined,
      venue: values.venue as string || undefined,
      onlineLink: values.onlineLink as string || undefined,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Batch Scheduled', message: `Batch ${values.code} was scheduled.` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const getPipeline = (batchId: string): BatchPipelineDetails => {
    return pipelineMap[batchId] || {
      initialWorks: false,
      photos: false,
      training: true,
      videos: false,
      feedback: false,
      certificateDeliveryDate: '',
      signedReceiptUploaded: false,
      coordinatorEmail: 'coordinator@college.edu',
    };
  };

  const updatePipeline = (batchId: string, patch: Partial<BatchPipelineDetails>) => {
    setPipelineMap((prev) => ({
      ...prev,
      [batchId]: { ...getPipeline(batchId), ...patch },
    }));
  };

  const getStudentsList = (batchId: string): StudentReportItem[] => {
    return studentsMap[batchId] || initialMockStudents;
  };

  const updateStudentVoucher = (batchId: string, studentId: string, voucherId: string) => {
    const list = getStudentsList(batchId).map((s) =>
      s.id === studentId ? { ...s, voucherId } : s
    );
    setStudentsMap((prev) => ({
      ...prev,
      [batchId]: list,
    }));
  };

  const sendEmailToCoordinator = (reportType: string, batchCode: string, email: string) => {
    toast({
      variant: 'success',
      title: 'Email Sent Successfully',
      message: `Dispatched ${reportType} for batch "${batchCode}" to college coordinator at ${email}.`,
    });
  };

  const notifyTrainerVoucher = (studentName: string, voucherId: string, trainerId?: string) => {
    const trainerObj = trainers.find((t) => t.id === trainerId);
    const trainerNameStr = trainerObj ? `${trainerObj.firstName} ${trainerObj.lastName}` : 'Lead Trainer';
    toast({
      variant: 'success',
      title: 'Trainer Notified',
      message: `Sent Voucher notification for ${studentName} (${voucherId || 'Pending'}) to ${trainerNameStr}.`,
    });
  };

  const courseTitle = (courseId: string) => {
    return courses.find((c) => c.id === courseId)?.title || 'General Training';
  };

  const trainerName = (trainerId?: string) => {
    const t = trainers.find((tr) => tr.id === trainerId);
    return t ? `${t.firstName} ${t.lastName}` : 'Unassigned';
  };

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const activePipeline = selectedBatch ? getPipeline(selectedBatch.id) : null;

  return (
    <AppShell>
      <PageHeader
        title="Training Details & End-to-End Pipeline"
        subtitle="Manage batch checklists, upload signed receipts, email coordinator documents, and review exam eligibility."
        actions={<Button onClick={() => setOpen(true)}>Schedule New Training Batch</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr', gap: 24, alignItems: 'start' }}>
        
        {/* Left Side: Active Batches Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionHeader title="📚 Active College Batches" />
          {batches.map((b) => {
            const isSelected = selectedBatchId === b.id;
            const pipeline = getPipeline(b.id);
            const checklistCount = [
              pipeline.initialWorks,
              pipeline.photos,
              pipeline.training,
              pipeline.videos,
              pipeline.feedback
            ].filter(Boolean).length;
            const completionPct = Math.round((checklistCount / 5) * 100);

            return (
              <div
                key={b.id}
                onClick={() => setSelectedBatchId(b.id)}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  transform: isSelected ? 'scale(1.01)' : 'none',
                }}
              >
                <Card
                  style={{
                    borderLeft: isSelected ? '4px solid var(--brand)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--bg-panel)' : 'var(--bg-surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{b.code}</h3>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {courseTitle(b.courseId)}
                      </div>
                    </div>
                    <Badge tone={completionPct === 100 ? 'success' : 'progress'}>
                      {completionPct}% Complete
                    </Badge>
                  </div>

                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  <div>📅 Schedule: <strong>{b.startDate} to {b.endDate}</strong></div>
                  <div>👨‍🏫 Trainer: <strong>{trainerName(b.trainerId)}</strong></div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${completionPct}%`, height: '100%', background: 'var(--brand)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                {/* Batch Action Buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <Button
                    size="sm"
                    variant="primary"
                    style={{ flex: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportBatchId(b.id);
                    }}
                  >
                    📋 Show Student Report
                  </Button>
                  <div style={{ display: 'flex', gap: 4, width: '100%', marginTop: 6 }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      style={{ flex: 1, fontSize: 11 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        sendEmailToCoordinator('Student Data', b.code, pipeline.coordinatorEmail);
                      }}
                    >
                      ✉️ Send Student Data
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      style={{ flex: 1, fontSize: 11 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        sendEmailToCoordinator('Daily Reports', b.code, pipeline.coordinatorEmail);
                      }}
                    >
                      ✉️ Send Daily Report
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      style={{ flex: 1, fontSize: 11 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        sendEmailToCoordinator('Final Reports', b.code, pipeline.coordinatorEmail);
                      }}
                    >
                      ✉️ Send Final Report
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
            );
          })}
        </div>

        {/* Right Side: Customizable Checklist & Pipeline parameters */}
        {selectedBatch && activePipeline && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionHeader title={`⚙️ Pipeline Tracker: ${selectedBatch.code}`} />
            
            <Card style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📋 Customizable Pipeline Checklist</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={activePipeline.initialWorks}
                    onChange={(e) => updatePipeline(selectedBatch.id, { initialWorks: e.target.checked })}
                  />
                  <strong>Initial Works Checklist Completed</strong>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={activePipeline.photos}
                    onChange={(e) => updatePipeline(selectedBatch.id, { photos: e.target.checked })}
                  />
                  <strong>Group Photos Uploaded & Verified</strong>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={activePipeline.training}
                    onChange={(e) => updatePipeline(selectedBatch.id, { training: e.target.checked })}
                  />
                  <strong>Trainings Completed</strong>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={activePipeline.videos}
                    onChange={(e) => updatePipeline(selectedBatch.id, { videos: e.target.checked })}
                  />
                  <strong>Video Recordings Archived</strong>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={activePipeline.feedback}
                    onChange={(e) => updatePipeline(selectedBatch.id, { feedback: e.target.checked })}
                  />
                  <strong>Coordinator & Student Feedback Gathered</strong>
                </label>

              </div>
            </Card>

            {/* Delivery Dates and Receipt Upload */}
            <Card style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📜 Certificate Delivery & Signed Receipt</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Certificate Delivery Date
                  </label>
                  <input
                    type="date"
                    className="kvj-input"
                    value={activePipeline.certificateDeliveryDate}
                    onChange={(e) => updatePipeline(selectedBatch.id, { certificateDeliveryDate: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Signed Receipt Document
                  </label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => updatePipeline(selectedBatch.id, { signedReceiptUploaded: true })}
                    >
                      {activePipeline.signedReceiptUploaded ? '✅ Change Uploaded File' : '📤 Upload Signed Receipt'}
                    </Button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {activePipeline.signedReceiptUploaded ? 'Receipt-christ-signed.pdf' : 'No file uploaded yet'}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Coordinator Email Address
                  </label>
                  <input
                    type="email"
                    className="kvj-input"
                    value={activePipeline.coordinatorEmail}
                    onChange={(e) => updatePipeline(selectedBatch.id, { coordinatorEmail: e.target.value })}
                    placeholder="coordinator@college.edu"
                  />
                </div>

              </div>
            </Card>

          </div>
        )}

      </div>

      {/* Show Student Report Drawer */}
      {reportBatchId && (
        <Drawer
          open={true}
          onClose={() => setReportBatchId('')}
          title={`Student Report — ${batches.find((b) => b.id === reportBatchId)?.code}`}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
              Attendance eligibility requires a minimum threshold of <strong>84%</strong> to unlock the final exam.
            </p>

            <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: 10 }}>Student Info</th>
                  <th style={{ padding: 10 }}>Attendance</th>
                  <th style={{ padding: 10 }}>Mock / Final</th>
                  <th style={{ padding: 10 }}>Exam Eligibility</th>
                  <th style={{ padding: 10 }}>Voucher ID Management</th>
                </tr>
              </thead>
              <tbody>
                {getStudentsList(reportBatchId).map((student) => {
                  const isEligible = student.attendancePct >= 84;
                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 10 }}>
                        <div style={{ fontWeight: 700 }}>{student.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{student.email} · {student.phone}</div>
                      </td>
                      <td style={{ padding: 10 }}>
                        <strong style={{ color: isEligible ? 'var(--status-success)' : 'var(--status-danger)' }}>
                          {student.attendancePct}%
                        </strong>
                      </td>
                      <td style={{ padding: 10 }}>
                        <div>Mock: <strong>{student.mockTestScore}</strong></div>
                        <div>Final: <strong>{student.finalExamScore || '—'}</strong></div>
                      </td>
                      <td style={{ padding: 10 }}>
                        <Badge tone={isEligible ? 'success' : 'danger'}>
                          {isEligible ? 'Eligible' : 'Not Eligible'}
                        </Badge>
                      </td>
                      <td style={{ padding: 10 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="text"
                            className="kvj-input"
                            style={{ padding: '4px 8px', fontSize: 11, width: 130 }}
                            value={student.voucherId}
                            onChange={(e) => updateStudentVoucher(reportBatchId, student.id, e.target.value)}
                            placeholder="e.g. VOUCH-01"
                          />
                          <Button
                            size="sm"
                            style={{ padding: '4px 8px', fontSize: 10 }}
                            onClick={() =>
                              notifyTrainerVoucher(
                                student.name,
                                student.voucherId,
                                batches.find((b) => b.id === reportBatchId)?.trainerId
                              )
                            }
                          >
                            Notify
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onClick={() => setReportBatchId('')}>Close Report</Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Create Batch Drawer */}
      <Drawer open={open} onClose={() => setOpen(false)} title="Schedule New Training Batch">
        <Form initial={{ capacity: 30 }} onSubmit={handleCreateSubmit}>
          <SelectField name="courseId" label="Course Catalog" options={courses.map((c) => ({ value: c.id, label: `${c.code} - ${c.title}` }))} />
          <TextField name="code" label="Batch Code Identifier" placeholder="e.g. Christ Irinjalakkuda - BCOM Self Batch 1" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DatePickerField name="startDate" label="Start Date" />
            <DatePickerField name="endDate" label="End Date" />
          </div>
          <SelectField name="trainerId" label="Assign Lead Trainer" options={[{ value: '', label: 'Unassigned' }, ...trainers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName} (${t.designation})` }))]} />
          <TextField name="capacity" label="Maximum Seat Capacity" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Schedule & Send Confirmation Email</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}

export default BatchManagement;
