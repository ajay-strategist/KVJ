import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useTraining } from '../hooks/useTraining';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Course } from '../training.repository';

export function CourseList() {
  const { courses, createCourse, loading } = useTraining();
  const { toast } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleCreateSubmit = async (values: Record<string, unknown>) => {
    const res = await createCourse({
      title: values.title as string,
      code: values.code as string,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Course Created', message: `${values.title} added to the catalog.` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const columns: Column<Course>[] = [
    { key: 'code', header: 'Code', sortable: true, accessor: (c) => c.code },
    { key: 'title', header: 'Course Title', sortable: true, accessor: (c) => c.title },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Courses Catalog"
        subtitle="Manage the available courses"
        actions={<Button onClick={() => setOpen(true)}>Create Course</Button>}
      />

      <DataTable columns={columns} rows={courses} rowKey={(c) => c.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Create New Course">
        <Form initial={{}} onSubmit={handleCreateSubmit}>
          <TextField name="title" label="Course Title" />
          <TextField name="code" label="Course Code" placeholder="e.g. KVJ-PY-101" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create Course</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default CourseList;
