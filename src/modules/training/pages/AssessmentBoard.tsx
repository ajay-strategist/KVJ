import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useTraining } from '../hooks/useTraining';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Enrollment } from '../training.repository';

export function AssessmentBoard() {
  const { enrollments, students, evaluateAssessment, claimVoucher, issueCertificate, loading } = useTraining();
  const { toast } = useNotifications();

  const [activeEnrolId, setActiveEnrolId] = useState<string | null>(null);
  const [openEval, setOpenEval] = useState(false);

  const handleEvaluateSubmit = async (values: Record<string, unknown>) => {
    if (!activeEnrolId) return;

    const res = await evaluateAssessment(activeEnrolId, {
      title: values.title as string,
      type: values.type as any,
      maxMarks: Number(values.maxMarks),
      marksObtained: Number(values.marksObtained),
      grade: values.grade as string || undefined,
      feedback: values.feedback as string || undefined,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Grade Recorded', message: `Evaluation saved for ${values.title}` });
      setOpenEval(false);
    } else {
      toast({ variant: 'error', title: 'Evaluation Failed', message: res.error });
    }
  };

  const handleClaimVoucher = async (enrolId: string) => {
    const res = await claimVoucher(enrolId);
    if (res.ok) {
      toast({ variant: 'success', title: 'Voucher Approved', message: `Voucher Code: ${res.value.voucherCode}` });
    } else {
      toast({ variant: 'error', title: 'Eligibility Check Failed', message: res.error });
    }
  };

  const handleIssueCertificate = async (enrolId: string) => {
    const res = await issueCertificate(enrolId);
    if (res.ok) {
      toast({ variant: 'success', title: 'Certificate Issued', message: `Certificate ID: ${res.value.certificateNumber}` });
    } else {
      toast({ variant: 'error', title: 'Failed issuing certificate', message: res.error });
    }
  };

  const studentName = (studentId: string) => {
    const s = students.find((st) => st.id === studentId);
    return s ? `${s.firstName} ${s.lastName}` : 'Unknown';
  };

  const columns: Column<Enrollment>[] = [
    { key: 'student', header: 'Student Name', render: (e) => studentName(e.studentId) },
    { key: 'seat', header: 'Allocated Seat', accessor: (e) => e.seatNumber ?? 'Pending' },
    { key: 'status', header: 'Status', render: (e) => (
      <span className="kvj-badge kvj-badge--success">{e.status}</span>
    )},
    { key: 'actions', header: 'Evaluation Actions', render: (e) => (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" variant="secondary" onClick={() => { setActiveEnrolId(e.id); setOpenEval(true); }}>
          Log Grade
        </Button>
        <Button size="sm" onClick={() => handleClaimVoucher(e.id)}>
          Voucher
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleIssueCertificate(e.id)}>
          Certificate
        </Button>
      </div>
    )},
  ];

  return (
    <AppShell>
      <PageHeader
        title="Evaluations & Certifications"
        subtitle="Manage student test grading, exam vouchers, and QR verified completion certificates"
      />

      <DataTable columns={columns} rows={enrollments} rowKey={(e) => e.id} loading={loading} />

      <Drawer open={openEval} onClose={() => setOpenEval(false)} title="Log Evaluation Grade">
        <Form initial={{ maxMarks: 100 }} onSubmit={handleEvaluateSubmit}>
          <TextField name="title" label="Assessment / Module Title" placeholder="e.g. SQL final test" />
          <SelectField
            name="type"
            label="Assessment Type"
            options={[
              { value: 'Assignment', label: 'Assignment Work' },
              { value: 'ModuleTest', label: 'Module Test' },
              { value: 'MockTest', label: 'Mock Exam' },
              { value: 'FinalExam', label: 'Final Examination' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TextField name="maxMarks" label="Maximum Marks" />
            <TextField name="marksObtained" label="Marks Obtained" />
          </div>
          <TextField name="grade" label="Allocated Grade Symbol" placeholder="e.g. A+" />
          <TextAreaField name="feedback" label="Trainer Feedback / Notes" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpenEval(false)}>Cancel</Button>
            <Button type="submit">Commit Grade</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default AssessmentBoard;
