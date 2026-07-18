import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useTraining } from '../hooks/useTraining';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, TextAreaField } from '../../../shared/forms/form';
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
      category: values.category as any,
      type: values.type as any,
      durationWeeks: Number(values.durationWeeks),
      description: values.description as string,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Course Created', message: `${values.title} added to registry.` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const columns: Column<Course>[] = [
    { key: 'code', header: 'Code', sortable: true, accessor: (c) => c.code },
    { key: 'title', header: 'Course Title', sortable: true, accessor: (c) => c.title },
    { key: 'category', header: 'Category', accessor: (c) => c.category },
    { key: 'type', header: 'Type', accessor: (c) => c.type },
    { key: 'duration', header: 'Duration (Weeks)', accessor: (c) => String(c.durationWeeks) },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Training Catalog"
        subtitle="Manage available training courses, bootcamps, and workshops"
        actions={<Button onClick={() => setOpen(true)}>Create Course</Button>}
      />

      <DataTable columns={columns} rows={courses} rowKey={(c) => c.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Create New Course Catalog">
        <Form initial={{ category: 'public', type: 'online' }} onSubmit={handleCreateSubmit}>
          <TextField name="title" label="Course Title" />
          <TextField name="code" label="Course Code" placeholder="e.g. KVJ-PY-101" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelectField
              name="category"
              label="Category"
              options={[
                { value: 'public', label: 'Public' },
                { value: 'corporate', label: 'Corporate' },
                { value: 'college', label: 'College' },
                { value: 'individual', label: 'Individual' },
              ]}
            />
            <SelectField
              name="type"
              label="Format Type"
              options={[
                { value: 'online', label: 'Online' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'workshop', label: 'Workshop' },
                { value: 'bootcamp', label: 'Bootcamp' },
                { value: 'certification', label: 'Certification' },
              ]}
            />
          </div>
          <TextField name="durationWeeks" label="Duration (in Weeks)" placeholder="e.g. 12" />
          <TextAreaField name="description" label="Syllabus & Description" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create Catalog</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default CourseList;
