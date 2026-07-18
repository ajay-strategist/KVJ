import { useState, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
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

  const columns: Column<Batch>[] = [
    { key: 'code', header: 'Batch Code', sortable: true, accessor: (b) => b.code },
    { key: 'course', header: 'Course', render: (b) => courseTitle(b.courseId) },
    { key: 'trainer', header: 'Assigned Trainer', render: (b) => trainerName(b.trainerId) },
    { key: 'dates', header: 'Schedules', render: (b) => `${b.startDate} to ${b.endDate}` },
    { key: 'capacity', header: 'Capacity', accessor: (b) => String(b.capacity) },
  ];

  const courseOptions = courses.map((c) => ({ value: c.id, label: `${c.code} - ${c.title}` }));
  const trainerOptions = trainers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName} (${t.designation})` }));

  return (
    <AppShell>
      <PageHeader
        title="Batch Scheduling"
        subtitle="Schedule new classes, assign venues, resources, and trainers"
        actions={<Button onClick={() => setOpen(true)}>Schedule Batch</Button>}
      />

      <DataTable columns={columns} rows={batches} rowKey={(b) => b.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Schedule New Training Batch">
        <Form initial={{ capacity: 30 }} onSubmit={handleCreateSubmit}>
          <SelectField name="courseId" label="Course Catalog" options={courseOptions} />
          <TextField name="code" label="Batch Code Identifier" placeholder="e.g. KVJ-BATCH-2026-A" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DatePickerField name="startDate" label="Start Date" />
            <DatePickerField name="endDate" label="End Date" />
          </div>
          <SelectField name="trainerId" label="Assign Trainer" options={[{ value: '', label: 'Unassigned' }, ...trainerOptions]} />
          <TextField name="capacity" label="Maximum Seat Capacity" />
          <TextField name="venue" label="Physical Venue Location (Optional)" />
          <TextField name="onlineLink" label="Online Meeting Link (Optional)" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Schedule Batch</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default BatchManagement;
