import { useState, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Badge } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useTraining } from '../hooks/useTraining';
import Drawer from '../../../shared/ui/Drawer';
import Tabs from '../../../shared/ui/Tabs';
import { Form, TextField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Course } from '../training.repository';

export interface College {
  id: string;
  name: string;
  code: string;
  location: string;
  principalName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

const INITIAL_COLLEGES: College[] = [
  {
    id: 'col-1',
    name: 'Christ Irinjalakkuda',
    code: 'CHRIST-IRK',
    location: 'Irinjalakkuda, Thrissur',
    principalName: 'Dr. Fr. Jolly Andrews',
    contactEmail: 'info@christcollegeijk.edu.in',
    contactPhone: '+91 480 2825258',
  },
  {
    id: 'col-2',
    name: 'MIM Kuttikkanam',
    code: 'MIM-KUTT',
    location: 'Kuttikkanam, Idukki',
    principalName: 'Dr. Joby Thomas',
    contactEmail: 'info@mim.edu',
    contactPhone: '+91 4869 232203',
  },
  {
    id: 'col-3',
    name: 'St. Thomas College',
    code: 'STC-THR',
    location: 'Thrissur',
    principalName: 'Dr. Martin K. A.',
    contactEmail: 'info@stthomas.ac.in',
    contactPhone: '+91 487 2420435',
  },
];

export function CourseList({ defaultTab = 'courses' }: { defaultTab?: 'courses' | 'colleges' }) {
  const { courses, createCourse, updateCourse, loading } = useTraining();
  const { toast } = useNotifications();

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'courses' | 'colleges'>(defaultTab);

  // Courses Modal State
  const [openCourseModal, setOpenCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Colleges Management State (Persisted in localStorage)
  const [colleges, setColleges] = useState<College[]>(() => {
    try {
      const saved = localStorage.getItem('kvj.colleges');
      return saved ? JSON.parse(saved) : INITIAL_COLLEGES;
    } catch {
      return INITIAL_COLLEGES;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('kvj.colleges', JSON.stringify(colleges));
    } catch {}
  }, [colleges]);

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
  });

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

  const handleOpenEditCourse = (c: Course) => {
    setEditingCourse(c);
    setChecklistItems(
      c.checklist && c.checklist.length > 0
        ? [...c.checklist]
        : DEFAULT_COURSE_CHECKLIST
    );
  };

  const handleOpenCreateCourse = () => {
    setOpenCourseModal(true);
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
      toast({ variant: 'error', title: 'Error', message: res.error });
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
      toast({ variant: 'error', title: 'Error', message: res.error });
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
    });
    setOpenCollegeModal(true);
  };

  const handleSaveCollege = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeForm.name.trim() || !collegeForm.code.trim()) {
      toast({ variant: 'error', title: 'Required Fields', message: 'College name and code are required.' });
      return;
    }

    if (editingCollege) {
      setColleges((prev) =>
        prev.map((c) =>
          c.id === editingCollege.id
            ? {
                ...c,
                name: collegeForm.name.trim(),
                code: collegeForm.code.trim().toUpperCase(),
                location: collegeForm.location.trim(),
                principalName: collegeForm.principalName.trim(),
                contactEmail: collegeForm.contactEmail.trim(),
                contactPhone: collegeForm.contactPhone.trim(),
              }
            : c
        )
      );
      toast({ variant: 'success', title: 'College Updated', message: `${collegeForm.name} updated successfully.` });
    } else {
      const newCollege: College = {
        id: `col-${Date.now()}`,
        name: collegeForm.name.trim(),
        code: collegeForm.code.trim().toUpperCase(),
        location: collegeForm.location.trim(),
        principalName: collegeForm.principalName.trim(),
        contactEmail: collegeForm.contactEmail.trim(),
        contactPhone: collegeForm.contactPhone.trim(),
      };
      setColleges((prev) => [newCollege, ...prev]);
      toast({ variant: 'success', title: 'College Added', message: `${collegeForm.name} added to catalog successfully.` });
    }
    setOpenCollegeModal(false);
  };

  const handleDeleteCollege = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      setColleges((prev) => prev.filter((c) => c.id !== id));
      toast({ variant: 'info', title: 'College Deleted', message: `${name} removed from catalog.` });
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
        <Button variant="secondary" size="sm" onClick={() => handleOpenEditCourse(c)}>
          Edit Course & Tasks
        </Button>
      ),
    },
  ];

  const collegeColumns: Column<College>[] = [
    { key: 'code', header: 'College Code', sortable: true, accessor: (c) => c.code },
    {
      key: 'name',
      header: 'College Name',
      sortable: true,
      accessor: (c) => c.name,
      render: (c) => (
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
          🏛️ {c.name}
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

  const tabItems = [
    {
      id: 'courses',
      label: `📚 Courses Catalog (${courses.length})`,
      content: (
        <DataTable columns={courseColumns} rows={courses} rowKey={(c) => c.id} loading={loading} />
      ),
    },
    {
      id: 'colleges',
      label: `🏛️ Colleges Catalog (${colleges.length})`,
      content: (
        <DataTable columns={collegeColumns} rows={colleges} rowKey={(c) => c.id} />
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Courses & Colleges"
        subtitle={
          activeTab === 'colleges'
            ? 'Manage affiliated colleges, locations, head details, and contact information'
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
