import { useState, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Card, SectionHeader } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useTraining } from '../hooks/useTraining';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Batch } from '../training.repository';
import type { Employee } from '../../employee/employee.repository';

export function BatchManagement() {
  const { batches, courses, createBatch, loading } = useTraining();
  const { toast } = useNotifications();
  const [open, setOpen] = useState(false);
  const [trainers, setTrainers] = useState<Employee[]>([]);

  useEffect(() => {
    const empService = container.resolve(EMPLOYEE_SERVICE_TOKEN);
    empService.listEmployees().then((res) => {
      if (res.ok) {
        setTrainers(res.value);
      }
    });
  }, []);

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

  const trainerName = (trainerId?: string) => {
    const t = trainers.find((tr) => tr.id === trainerId);
    return t ? `${t.firstName} ${t.lastName}` : 'Unassigned';
  };

  const courseTitle = (courseId: string) => {
    const c = courses.find((co) => co.id === courseId);
    return c ? c.title : 'Unknown';
  };

  const pipelineSteps = [
    'Initial Works', 'Photos', 'Training', 'Videos', 'Feedback',
    'Students Uploaded', 'Mock Test', 'Final Exam', 'Retest',
    'Report', 'Invoice', 'Payment', 'Retest Amount',
    'Certificate Printed', 'Certificate Delivered', 'Certificate Delivered Date'
  ];

  const columns: Column<Batch>[] = [
    { key: 'code', header: 'College / Batch', sortable: true, render: (b) => <div><strong>{b.code}</strong><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{courseTitle(b.courseId)}</div></div> },
    { key: 'trainer', header: 'Assigned Trainer & Manager', render: (b) => <div><div>👨‍🏫 {trainerName(b.trainerId)}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>👔 Manager: Operations</div></div> },
    { key: 'dates', header: 'Schedules', render: (b) => `${b.startDate} to ${b.endDate}` },
    { key: 'marketing', header: 'Marketing Converted', render: () => <span className="kvj-badge kvj-badge--success">Yes (Converted)</span> },
    { key: 'expense', header: 'Total Expense', render: () => <strong>₹ 4,806.00</strong> },
    { key: 'completion', header: 'Completion %', render: () => <div style={{ fontWeight: 700, color: 'var(--brand)' }}>56%</div> },
    {
      key: 'actions',
      header: 'Actions',
      render: () => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="secondary" onClick={() => alert('Sending session report to college coordinators...')}>
            ✉️ Send Report
          </Button>
        </div>
      ),
    },
  ];

  const courseOptions = courses.map((c) => ({ value: c.id, label: `${c.code} - ${c.title}` }));
  const trainerOptions = trainers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName} (${t.designation})` }));

  return (
    <AppShell>
      <PageHeader
        title="Training Details & End-to-End Pipeline"
        subtitle="16-step process checklist, marketing conversion tracking, and coordinator communication"
        actions={<Button onClick={() => setOpen(true)}>Schedule New Training Batch</Button>}
      />

      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title="Active Process Pipelines Overview (Marketing ➔ Certificate Delivery)" />
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0F4C81', color: 'white', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>College / Program</th>
                {pipelineSteps.map((step) => (
                  <th key={step} style={{ padding: 8, fontSize: 11, whiteSpace: 'nowrap' }}>{step}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 8, fontWeight: 600 }}>Christ Irinjalakkuda - BCOM Self (Data Analytics)</td>
                {pipelineSteps.map((step, idx) => (
                  <td key={step} style={{ padding: 8, textAlign: 'center' }}>
                    {idx < 7 ? '✅ Yes' : idx === 7 ? '⏳ Pending' : '—'}
                  </td>
                ))}
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 8, fontWeight: 600 }}>Vimala College - 2 BCA (Excel Expert)</td>
                {pipelineSteps.map((step, idx) => (
                  <td key={step} style={{ padding: 8, textAlign: 'center' }}>
                    {idx < 4 ? '✅ Yes' : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <DataTable columns={columns} rows={batches} rowKey={(b) => b.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Schedule New Training Batch">
        <Form initial={{ capacity: 30 }} onSubmit={handleCreateSubmit}>
          <SelectField name="courseId" label="Course Catalog" options={courseOptions} />
          <TextField name="code" label="Batch Code Identifier" placeholder="e.g. Christ Irinjalakkuda - BCOM Self Batch 1" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DatePickerField name="startDate" label="Start Date" />
            <DatePickerField name="endDate" label="End Date" />
          </div>
          <SelectField name="trainerId" label="Assign Lead Trainer" options={[{ value: '', label: 'Unassigned' }, ...trainerOptions]} />
          <TextField name="coordinators" label="College Coordinators (Emails, comma separated)" placeholder="coordinator1@christ.edu, coordinator2@christ.edu" />
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
