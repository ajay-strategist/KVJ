import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, StatCard, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { Tabs } from '../../../shared/ui/Tabs';
import { useTraining } from '../hooks/useTraining';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Student, Enrollment } from '../training.repository';

export function StudentLifecycle() {
  const { students, enrollments, batches, registerStudent, enrollStudent, loading } = useTraining();
  const { toast } = useNotifications();

  const [studentOpen, setStudentOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const handleRegisterSubmit = async (values: Record<string, unknown>) => {
    const res = await registerStudent({
      firstName: values.firstName as string,
      lastName: values.lastName as string,
      email: values.email as string,
      phone: values.phone as string,
      guardianName: values.guardianName as string || undefined,
      guardianPhone: values.guardianPhone as string || undefined,
      academicQualification: values.academicQualification as string || undefined,
      employmentStatus: values.employmentStatus as string || undefined,
      notes: values.notes as string || undefined,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Student Registered', message: `${values.firstName} added to master registry.` });
      setStudentOpen(false);
    } else {
      toast({ variant: 'error', title: 'Registration Failed', message: res.error });
    }
  };

  const handleEnrollSubmit = async (values: Record<string, unknown>) => {
    const res = await enrollStudent(
      values.studentId as string,
      values.batchId as string
    );

    if (res.ok) {
      toast({ variant: 'success', title: 'Student Enrolled', message: `Assigned seat ${res.value.seatNumber}` });
      setEnrollOpen(false);
    } else {
      toast({ variant: 'error', title: 'Enrollment Failed', message: res.error });
    }
  };

  const studentName = (studentId: string) => {
    const s = students.find((st) => st.id === studentId);
    return s ? `${s.firstName} ${s.lastName}` : 'Unknown';
  };

  const batchCode = (batchId?: string) => {
    const b = batches.find((ba) => ba.id === batchId);
    return b ? b.code : 'Unassigned';
  };

  const studentColumns: Column<Student>[] = [
    { key: 'name', header: 'Student Name', render: (s) => `${s.firstName} ${s.lastName}` },
    { key: 'email', header: 'Email Address', accessor: (s) => s.email },
    { key: 'phone', header: 'Phone Number', accessor: (s) => s.phone },
    { key: 'qualification', header: 'Academics', accessor: (s) => s.academicQualification ?? 'N/A' },
  ];

  const enrollmentColumns: Column<Enrollment>[] = [
    { key: 'student', header: 'Student', render: (e) => studentName(e.studentId) },
    { key: 'batch', header: 'Batch Code', render: (e) => batchCode(e.batchId) },
    { key: 'seat', header: 'Allocated Seat', accessor: (e) => e.seatNumber ?? 'Pending' },
    { key: 'status', header: 'Status', render: (e) => (
      <span className={`kvj-badge kvj-badge--${e.status === 'admitted' ? 'success' : 'neutral'}`}>{e.status}</span>
    )},
  ];

  const studentOptions = students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }));
  const batchOptions = batches.map((b) => ({ value: b.id, label: b.code }));

  const tabs = [
    {
      id: 'active',
      label: 'Student Directory',
      content: <DataTable columns={studentColumns} rows={students} rowKey={(s) => s.id} loading={loading} />,
    },
    {
      id: 'enrollments',
      label: 'Enrollment Logs',
      content: <DataTable columns={enrollmentColumns} rows={enrollments} rowKey={(e) => e.id} loading={loading} />,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Student Lifecycle Master"
        subtitle="Manage student admissions, batch enrollments, referrals, and alumni networking"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setEnrollOpen(true)}>Course Enrollment</Button>
            <Button onClick={() => setStudentOpen(true)}>Register Student</Button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Registered Students" value={students.length} tone="info" icon="🧑" />
        <StatCard label="Active Enrollments" value={enrollments.length} tone="success" icon="✓" />
      </div>

      <Tabs items={tabs} />

      {/* Register Student Drawer */}
      <Drawer open={studentOpen} onClose={() => setStudentOpen(false)} title="Register Student Profile">
        <Form initial={{}} onSubmit={handleRegisterSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TextField name="firstName" label="First Name" />
            <TextField name="lastName" label="Last Name" />
          </div>
          <TextField name="email" label="Email Address" type="email" />
          <TextField name="phone" label="Contact Phone Number" />
          <TextField name="academicQualification" label="Highest Academic Qualification" placeholder="e.g. B.Tech Computer Science" />
          <SelectField
            name="employmentStatus"
            label="Employment Status"
            options={[
              { value: 'unemployed', label: 'Seeking Placement' },
              { value: 'employed', label: 'Employed' },
            ]}
          />
          <TextField name="guardianName" label="Guardian Full Name" />
          <TextField name="guardianPhone" label="Guardian Phone" />
          <TextAreaField name="notes" label="Additional Profile Notes" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setStudentOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Registration</Button>
          </div>
        </Form>
      </Drawer>

      {/* Enroll Student Drawer */}
      <Drawer open={enrollOpen} onClose={() => setEnrollOpen(false)} title="Assign Course & Batch Seat">
        <Form initial={{}} onSubmit={handleEnrollSubmit}>
          <SelectField name="studentId" label="Select Student Profile" options={studentOptions} />
          <SelectField name="batchId" label="Select Target Scheduled Batch" options={batchOptions} />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button type="submit">Approve Enrollment</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default StudentLifecycle;
