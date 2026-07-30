import { useState, useEffect, useMemo } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Badge } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useTraining } from '../hooks/useTraining';
import Drawer from '../../../shared/ui/Drawer';
import Tabs from '../../../shared/ui/Tabs';
import { Form, TextField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Course } from '../training.repository';
import { COLLEGE_REPOSITORY_TOKEN, COURSE_REPOSITORY_TOKEN } from '../training.repository';
import { container } from '../../../core/registry';
import { useAuth } from '../../auth/AuthProvider';

export interface College {
  id: string;
  name: string;
  code: string;
  location: string;
  principalName?: string;
  contactEmail?: string;
  contactPhone?: string;
  logoUrl?: string;
  imageUrl?: string;
}

export function CourseList({ defaultTab = 'courses' }: { defaultTab?: 'courses' | 'colleges' }) {
  const { courses, createCourse, updateCourse, loading, refresh } = useTraining();
  const { toast } = useNotifications();

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'courses' | 'colleges'>(defaultTab);

  // Courses Modal State
  const [openCourseModal, setOpenCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const { user } = useAuth();
  const courseRepo = useMemo(() => container.resolve(COURSE_REPOSITORY_TOKEN), []);
  const collegeRepo = useMemo(() => container.resolve(COLLEGE_REPOSITORY_TOKEN), []);

  // Colleges Management State (Persisted in Supabase DB)
  const [colleges, setColleges] = useState<College[]>([]);

  useEffect(() => {
    async function fetchColleges() {
      try {
        const p = await collegeRepo.findMany({ pageSize: 1000, page: 1 });
        setColleges((p.data as any) || []);
      } catch (e) {
        console.warn('Could not fetch colleges from Supabase:', e);
      }
    }
    fetchColleges();
  }, [collegeRepo]);

  // College Modal State
  const [openCollegeModal, setOpenCollegeModal] = useState(false);
  const [editingCollege, setEditingCollege] = useState<College | null>(null);
  const [collegeForm, setCollegeForm] = useState({
    name: '',
    code: '',
    location: '',
    principalName: '',
    contactEmail: '',
    contactPhone: '',
    logoUrl: '',
    imageUrl: '',
  });

  // Dynamic checklist builder state for create/edit drawers (Stored in Supabase DB)
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newCheckitemText, setNewCheckitemText] = useState('');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleOpenEditCourse = (c: Course) => {
    setEditingCourse(c);
    setNewCheckitemText('');
    setChecklistItems(Array.isArray(c.checklist) ? [...c.checklist] : []);
  };

  const handleOpenCreateCourse = () => {
    setEditingCourse(null);
    setNewCheckitemText('');
    setChecklistItems([]);
    setOpenCourseModal(true);
  };

  const handleAddChecklistItem = () => {
    if (!newCheckitemText.trim()) return;
    setChecklistItems((prev) => [...prev, newCheckitemText.trim()]);
    setNewCheckitemText('');
  };

  const handleRemoveChecklistItem = (idx: number) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMoveUpChecklistItem = (idx: number) => {
    if (idx <= 0) return;
    setChecklistItems((prev) => {
      const next = [...prev];
      const temp = next[idx - 1];
      next[idx - 1] = next[idx];
      next[idx] = temp;
      return next;
    });
  };

  const handleMoveDownChecklistItem = (idx: number) => {
    setChecklistItems((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[idx + 1];
      next[idx + 1] = next[idx];
      next[idx] = temp;
      return next;
    });
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    setChecklistItems((prev) => {
      const next = [...prev];
      const item = next.splice(draggedIdx, 1)[0];
      next.splice(targetIdx, 0, item);
      return next;
    });
    setDraggedIdx(targetIdx);
  };

  const handleCreateCourseSubmit = async (values: Record<string, unknown>) => {
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
      setOpenCourseModal(false);
    } else {
      const isDuplicate = res.error?.includes('courses_code_key') || res.error?.includes('unique constraint');
      const msg = isDuplicate
        ? `A course with code "${values.code}" already exists in the catalog. Please use a unique Course Code.`
        : (res.error || 'Failed to create course.');
      toast({ variant: 'error', title: isDuplicate ? 'Duplicate Course Code' : 'Error', message: msg });
    }
  };

  const handleEditCourseSubmit = async (values: Record<string, unknown>) => {
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
      const isDuplicate = res.error?.includes('courses_code_key') || res.error?.includes('unique constraint');
      const msg = isDuplicate
        ? `A course with code "${values.code}" already exists in the catalog. Please use a unique Course Code.`
        : (res.error || 'Failed to update course.');
      toast({ variant: 'error', title: isDuplicate ? 'Duplicate Course Code' : 'Error', message: msg });
    }
  };

  // College Handlers
  const handleOpenCreateCollege = () => {
    setEditingCollege(null);
    setCollegeForm({
      name: '',
      code: '',
      location: '',
      principalName: '',
      contactEmail: '',
      contactPhone: '',
      logoUrl: '',
      imageUrl: '',
    });
    setOpenCollegeModal(true);
  };

  const handleOpenEditCollege = (c: College) => {
    setEditingCollege(c);
    setCollegeForm({
      name: c.name,
      code: c.code,
      location: c.location || '',
      principalName: c.principalName || '',
      contactEmail: c.contactEmail || '',
      contactPhone: c.contactPhone || '',
      logoUrl: c.logoUrl || '',
      imageUrl: c.imageUrl || '',
    });
    setOpenCollegeModal(true);
  };

  const handleSaveCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeForm.name.trim() || !collegeForm.code.trim()) {
      toast({ variant: 'error', title: 'Required Fields', message: 'College name and code are required.' });
      return;
    }

    try {
      if (editingCollege) {
        const val = await collegeRepo.update(editingCollege.id, {
          name: collegeForm.name.trim(),
          code: collegeForm.code.trim().toUpperCase(),
          location: collegeForm.location.trim(),
          contactEmail: collegeForm.contactEmail.trim(),
          contactPhone: collegeForm.contactPhone.trim(),
          principalName: collegeForm.principalName.trim() || undefined,
          logoUrl: collegeForm.logoUrl.trim() || undefined,
          imageUrl: collegeForm.imageUrl.trim() || undefined,
        } as any, { id: user?.id || 'system', role: user?.role || 'EMPLOYEE' });

        setColleges((prev) => prev.map((c) => (c.id === editingCollege.id ? (val as any) : c)));
        toast({ variant: 'success', title: 'College Updated', message: `${collegeForm.name} updated successfully.` });
      } else {
        const val = await collegeRepo.create({
          name: collegeForm.name.trim(),
          code: collegeForm.code.trim().toUpperCase(),
          location: collegeForm.location.trim(),
          contactEmail: collegeForm.contactEmail.trim(),
          contactPhone: collegeForm.contactPhone.trim(),
          principalName: collegeForm.principalName.trim() || undefined,
          logoUrl: collegeForm.logoUrl.trim() || undefined,
          imageUrl: collegeForm.imageUrl.trim() || undefined,
          isActive: true,
        } as any, { id: user?.id || 'system', role: user?.role || 'EMPLOYEE' });

        setColleges((prev) => [val as any, ...prev]);
        toast({ variant: 'success', title: 'College Added', message: `${collegeForm.name} added to catalog successfully.` });
      }
      setOpenCollegeModal(false);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Save Failed', message: err.message || 'Error occurred.' });
    }
  };

  const handleDeleteCourse = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete ${title}?`)) {
      try {
        await courseRepo.softDelete(id, { id: user?.id || 'system', role: user?.role || 'EMPLOYEE' });
        toast({ variant: 'info', title: 'Course Deleted', message: `${title} removed from catalog.` });
        refresh();
      } catch (err: any) {
        toast({ variant: 'error', title: 'Delete Failed', message: err.message || 'Error occurred.' });
      }
    }
  };

  const handleDeleteCollege = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        await collegeRepo.softDelete(id, { id: user?.id || 'system', role: user?.role || 'EMPLOYEE' });
        setColleges((prev) => prev.filter((c) => c.id !== id));
        toast({ variant: 'info', title: 'College Deleted', message: `${name} removed from catalog.` });
      } catch (err: any) {
        toast({ variant: 'error', title: 'Delete Failed', message: err.message || 'Error occurred.' });
      }
    }
  };

  const courseColumns: Column<Course>[] = [
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
        const items = Array.isArray(c.checklist) ? c.checklist : [];
        return (
          <Badge tone={items.length > 0 ? 'info' : 'neutral'}>
            📋 {items.length} Course Task{items.length !== 1 ? 's' : ''} Configured
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="secondary" size="sm" onClick={() => handleOpenEditCourse(c)}>
            Edit Course & Tasks
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleDeleteCourse(c.id, c.title)} style={{ color: 'var(--status-danger)' }}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const collegeColumns: Column<College>[] = [
    { key: 'code', header: 'College Code', sortable: true, accessor: (c) => c.code },
    {
      key: 'name',
      header: 'College Name & Logo',
      sortable: true,
      accessor: (c) => c.name,
      render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {c.logoUrl ? (
            <img src={c.logoUrl} alt={c.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
          ) : (
            <span style={{ fontSize: 18 }}>🏛️</span>
          )}
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{c.name}</div>
            {c.imageUrl && (
              <a href={c.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none' }}>
                🖼️ View Campus Image
              </a>
            )}
          </div>
        </div>
      ),
    },
    { key: 'location', header: 'Location', sortable: true, accessor: (c) => c.location || '—' },
    { key: 'principalName', header: 'Principal / Head', accessor: (c) => c.principalName || '—' },
    {
      key: 'contact',
      header: 'Contact Info',
      render: (c) => (
        <div style={{ fontSize: 11.5 }}>
          {c.contactEmail && <div>📧 {c.contactEmail}</div>}
          {c.contactPhone && <div style={{ color: 'var(--text-muted)' }}>📞 {c.contactPhone}</div>}
          {!c.contactEmail && !c.contactPhone && '—'}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="secondary" size="sm" onClick={() => handleOpenEditCollege(c)}>
            Edit
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleDeleteCollege(c.id, c.name)} style={{ color: 'var(--status-danger)' }}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeColleges = Array.isArray(colleges) ? colleges : [];

  const tabItems = [
    {
      id: 'courses',
      label: `📚 Courses Catalog (${safeCourses.length})`,
      content: (
        <DataTable columns={courseColumns} rows={safeCourses} rowKey={(c) => c.id} loading={loading} />
      ),
    },
    {
      id: 'colleges',
      label: `🏛️ Colleges Catalog (${safeColleges.length})`,
      content: (
        <DataTable columns={collegeColumns} rows={safeColleges} rowKey={(c) => c.id} />
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Courses & Colleges"
        subtitle={
          activeTab === 'colleges'
            ? 'Manage affiliated colleges, locations, logos, images, head details, and contact information'
            : 'Manage courses master list, maximum marks, pass criteria, and execution task checklists'
        }
        actions={
          activeTab === 'colleges' ? (
            <Button onClick={handleOpenCreateCollege}>➕ Add New College</Button>
          ) : (
            <Button onClick={handleOpenCreateCourse}>➕ Create Course</Button>
          )
        }
      />

      <Tabs
        items={tabItems}
        defaultTabId={activeTab}
        onChange={(id) => setActiveTab(id as 'courses' | 'colleges')}
      />

      {/* Create New Course Drawer */}
      <Drawer open={openCourseModal} onClose={() => setOpenCourseModal(false)} title="Create New Course">
        <Form initial={{ maxMarks: 100, passPercentage: 70 }} onSubmit={handleCreateCourseSubmit}>
          <TextField name="title" label="Course Title" />
          <TextField name="code" label="Course Code" placeholder="e.g. KVJ-PY-101" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TextField name="maxMarks" label="Maximum Marks" type="number" placeholder="100" />
            <TextField name="passPercentage" label="Pass % Criteria" type="number" placeholder="70" />
          </div>

          {/* Checklist Builder */}
          <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
              📋 Course Execution Checklist Tasks (Drag or use ⬆️⬇️ to reorder)
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {checklistItems.map((item, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)',
                    border: '1px solid var(--border)', fontSize: 11.5, cursor: 'grab',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text-muted)', cursor: 'grab' }}>⣿</span>
                    <span>✓ {item}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" onClick={() => handleMoveUpChecklistItem(idx)} disabled={idx === 0} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: idx === 0 ? 0.3 : 1 }}>⬆️</button>
                    <button type="button" onClick={() => handleMoveDownChecklistItem(idx)} disabled={idx === checklistItems.length - 1} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: idx === checklistItems.length - 1 ? 0.3 : 1 }}>⬇️</button>
                    <button type="button" onClick={() => handleRemoveChecklistItem(idx)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--status-danger)', fontSize: 12 }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpenCourseModal(false)}>Cancel</Button>
            <Button type="submit">Create Course</Button>
          </div>
        </Form>
      </Drawer>

      {/* Edit Existing Course Drawer */}
      <Drawer open={editingCourse !== null} onClose={() => setEditingCourse(null)} title="Edit Course Details">
        {editingCourse && (
          <Form initial={{ title: editingCourse.title, code: editingCourse.code, maxMarks: editingCourse.maxMarks ?? 100, passPercentage: editingCourse.passPercentage ?? 70 }} onSubmit={handleEditCourseSubmit}>
            <TextField name="title" label="Course Title" />
            <TextField name="code" label="Course Code" placeholder="e.g. KVJ-PY-101" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <TextField name="maxMarks" label="Maximum Marks" type="number" placeholder="100" />
              <TextField name="passPercentage" label="Pass % Criteria" type="number" placeholder="70" />
            </div>

            {/* Checklist Builder */}
            <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                📋 Course Execution Checklist Tasks (Drag or use ⬆️⬇️ to reorder)
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {checklistItems.map((item, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)',
                      border: '1px solid var(--border)', fontSize: 11.5, cursor: 'grab',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text-muted)', cursor: 'grab' }}>⣿</span>
                      <span>✓ {item}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button type="button" onClick={() => handleMoveUpChecklistItem(idx)} disabled={idx === 0} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: idx === 0 ? 0.3 : 1 }}>⬆️</button>
                      <button type="button" onClick={() => handleMoveDownChecklistItem(idx)} disabled={idx === checklistItems.length - 1} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: idx === checklistItems.length - 1 ? 0.3 : 1 }}>⬇️</button>
                      <button type="button" onClick={() => handleRemoveChecklistItem(idx)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--status-danger)', fontSize: 12 }}>🗑️</button>
                    </div>
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

      {/* Create / Edit College Drawer */}
      <Drawer
        open={openCollegeModal}
        onClose={() => setOpenCollegeModal(false)}
        title={editingCollege ? '🏛️ Edit College Details' : '🏛️ Add New College'}
      >
        <form onSubmit={handleSaveCollege} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              College Name *
            </label>
            <input
              type="text"
              className="kvj-input"
              required
              placeholder="e.g. Christ Irinjalakkuda"
              value={collegeForm.name}
              onChange={(e) => setCollegeForm({ ...collegeForm, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                College Code *
              </label>
              <input
                type="text"
                className="kvj-input"
                required
                placeholder="e.g. CHRIST-IRK"
                value={collegeForm.code}
                onChange={(e) => setCollegeForm({ ...collegeForm, code: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Location / City
              </label>
              <input
                type="text"
                className="kvj-input"
                placeholder="e.g. Irinjalakkuda, Thrissur"
                value={collegeForm.location}
                onChange={(e) => setCollegeForm({ ...collegeForm, location: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Principal / Head Name
            </label>
            <input
              type="text"
              className="kvj-input"
              placeholder="e.g. Dr. Fr. Jolly Andrews"
              value={collegeForm.principalName}
              onChange={(e) => setCollegeForm({ ...collegeForm, principalName: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                College Logo Link (URL / Image)
              </label>
              <input
                type="url"
                className="kvj-input"
                placeholder="https://... logo link"
                value={collegeForm.logoUrl}
                onChange={(e) => setCollegeForm({ ...collegeForm, logoUrl: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                College Building / Campus Image Link
              </label>
              <input
                type="url"
                className="kvj-input"
                placeholder="https://... campus image link"
                value={collegeForm.imageUrl}
                onChange={(e) => setCollegeForm({ ...collegeForm, imageUrl: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Contact Email
              </label>
              <input
                type="email"
                className="kvj-input"
                placeholder="e.g. info@christcollegeijk.edu.in"
                value={collegeForm.contactEmail}
                onChange={(e) => setCollegeForm({ ...collegeForm, contactEmail: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Contact Phone
              </label>
              <input
                type="tel"
                className="kvj-input"
                placeholder="e.g. +91 480 2825258"
                value={collegeForm.contactPhone}
                onChange={(e) => setCollegeForm({ ...collegeForm, contactPhone: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpenCollegeModal(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingCollege ? 'Save Changes' : '➕ Create College'}
            </Button>
          </div>
        </form>
      </Drawer>
    </AppShell>
  );
}

export default CourseList;
