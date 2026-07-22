import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Badge } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useTraining } from '../hooks/useTraining';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Course } from '../training.repository';

export function CourseList() {
  const { courses, createCourse, updateCourse, loading } = useTraining();
  const { toast } = useNotifications();
  const [open, setOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const DEFAULT_COURSE_CHECKLIST = [
    'College Confirmation Form Signed',
    'Trainer Assigned',
    'Student Registry Uploaded',
    'Syllabus Dispatched',
    'Daily Sessions Logged',
    'Final Report Generated',
    'Certificates Dispatched',
    'Signed Receipt Uploaded',
  ];

  // Dynamic checklist builder state for create/edit drawers
  const [checklistItems, setChecklistItems] = useState<string[]>(DEFAULT_COURSE_CHECKLIST);
  const [newCheckitemText, setNewCheckitemText] = useState('');

  const handleOpenEdit = (c: Course) => {
    setEditingCourse(c);
    setChecklistItems(
      c.checklist && c.checklist.length > 0
        ? [...c.checklist]
        : DEFAULT_COURSE_CHECKLIST
    );
  };

  const handleOpenCreate = () => {
    setOpen(true);
    setChecklistItems(DEFAULT_COURSE_CHECKLIST);
  };

  const handleAddChecklistItem = () => {
    if (!newCheckitemText.trim()) return;
    setChecklistItems((prev) => [...prev, newCheckitemText.trim()]);
    setNewCheckitemText('');
  };

  const handleRemoveChecklistItem = (idx: number) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateSubmit = async (values: Record<string, unknown>) => {
    const maxMarks = Number(values.maxMarks) || 100;
    const passPct = Number(values.passPercentage) || 70;
    const res = await createCourse({
      title: values.title as string,
      code: values.code as string,
      maxMarks,
      passPercentage: passPct,
      checklist: checklistItems,
    } as any);

    if (res.ok) {
      toast({ variant: 'success', title: 'Course Created', message: `${values.title} added with Max Marks: ${maxMarks}, Pass Criteria: ${passPct}%.` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const handleEditSubmit = async (values: Record<string, unknown>) => {
    if (!editingCourse) return;
    const maxMarks = Number(values.maxMarks) || 100;
    const passPct = Number(values.passPercentage) || 70;
    const res = await updateCourse(editingCourse.id, {
      title: values.title as string,
      code: values.code as string,
      maxMarks,
      passPercentage: passPct,
      checklist: checklistItems,
    } as any);

    if (res.ok) {
      toast({ variant: 'success', title: 'Course Updated', message: `${values.title} details updated successfully.` });
      setEditingCourse(null);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const columns: Column<Course>[] = [
    { key: 'code', header: 'Code', sortable: true, accessor: (c) => c.code },
    { key: 'title', header: 'Course Title', sortable: true, accessor: (c) => c.title },
    {
      key: 'maxMarks',
      header: 'Max Marks & Pass Criteria',
      render: (c) => {
        const max = c.maxMarks ?? 100;
        const pct = c.passPercentage ?? 70;
        const passMarks = Math.round((max * pct) / 100);
        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>
              Max Marks: <strong>{max}</strong>
            </div>
            <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>
              Pass Criteria: 🎯 {pct}% (<strong>{passMarks} marks</strong>)
            </div>
          </div>
        );
      },
    },
    {
      key: 'checklist',
      header: 'Course Execution Checklist',
      render: (c) => {
        const items = c.checklist && c.checklist.length > 0 ? c.checklist : DEFAULT_COURSE_CHECKLIST;
        return (
          <Badge tone="info">
            📋 {items.length} Course Task{items.length > 1 ? 's' : ''} Configured
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) => (
        <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(c)}>
          Edit Course & Tasks
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Courses Catalog"
        subtitle="Manage courses master list, maximum marks, pass criteria, and execution task checklists"
        actions={<Button onClick={handleOpenCreate}>Create Course</Button>}
      />

      <DataTable columns={columns} rows={courses} rowKey={(c) => c.id} loading={loading} />

      {/* Create New Course Drawer */}
      <Drawer open={open} onClose={() => setOpen(false)} title="Create New Course">
        <Form initial={{ maxMarks: 100, passPercentage: 70 }} onSubmit={handleCreateSubmit}>
          <TextField name="title" label="Course Title" />
          <TextField name="code" label="Course Code" placeholder="e.g. KVJ-PY-101" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TextField name="maxMarks" label="Maximum Marks" type="number" placeholder="100" />
            <TextField name="passPercentage" label="Pass % Criteria" type="number" placeholder="70" />
          </div>

          {/* Checklist Builder */}
          <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
              📋 Course Execution Checklist Tasks
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input
                type="text"
                className="kvj-input"
                value={newCheckitemText}
                onChange={(e) => setNewCheckitemText(e.target.value)}
                placeholder="Type new required task..."
                style={{ fontSize: 11.5, flex: 1, padding: '4px 8px' }}
              />
              <Button type="button" size="sm" onClick={handleAddChecklistItem}>➕ Add Task</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {checklistItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', fontSize: 11.5 }}>
                  <span>✓ {item}</span>
                  <button type="button" onClick={() => handleRemoveChecklistItem(idx)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--status-danger)', fontSize: 12 }}>🗑️</button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create Course</Button>
          </div>
        </Form>
      </Drawer>

      {/* Edit Existing Course Drawer */}
      <Drawer open={editingCourse !== null} onClose={() => setEditingCourse(null)} title="Edit Course Details">
        {editingCourse && (
          <Form initial={{ title: editingCourse.title, code: editingCourse.code, maxMarks: editingCourse.maxMarks ?? 100, passPercentage: editingCourse.passPercentage ?? 70 }} onSubmit={handleEditSubmit}>
            <TextField name="title" label="Course Title" />
            <TextField name="code" label="Course Code" placeholder="e.g. KVJ-PY-101" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <TextField name="maxMarks" label="Maximum Marks" type="number" placeholder="100" />
              <TextField name="passPercentage" label="Pass % Criteria" type="number" placeholder="70" />
            </div>

            {/* Checklist Builder */}
            <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                📋 Course Execution Checklist Tasks
              </label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                  type="text"
                  className="kvj-input"
                  value={newCheckitemText}
                  onChange={(e) => setNewCheckitemText(e.target.value)}
                  placeholder="Type new required task..."
                  style={{ fontSize: 11.5, flex: 1, padding: '4px 8px' }}
                />
                <Button type="button" size="sm" onClick={handleAddChecklistItem}>➕ Add Task</Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {checklistItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', fontSize: 11.5 }}>
                    <span>✓ {item}</span>
                    <button type="button" onClick={() => handleRemoveChecklistItem(idx)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--status-danger)', fontSize: 12 }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setEditingCourse(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </Form>
        )}
      </Drawer>
    </AppShell>
  );
}

export default CourseList;
