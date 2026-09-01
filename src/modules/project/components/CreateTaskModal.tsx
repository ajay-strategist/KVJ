import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useDevice } from '../../../shared/hooks/responsive';
import { container } from '../../../core/registry';
import { PROJECT_REPOSITORY_TOKEN, TASK_REPOSITORY_TOKEN } from '../project.repository';
import { EMPLOYEE_REPOSITORY_TOKEN } from '../../employee/employee.repository';

export interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultProjectId?: string;
  defaultAssigneeId?: string;
}

export function CreateTaskModal({
  open,
  onClose,
  onSuccess,
  defaultProjectId,
  defaultAssigneeId,
}: CreateTaskModalProps) {
  const { user } = useAuth();
  const device = useDevice();
  const isMobile = device === 'mobile';
  const { toast } = useNotifications();

  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    title: '',
    category: defaultProjectId ? defaultProjectId : 'Office Task',
    assigneeId: defaultAssigneeId || '',
    supervisorId: '',
    startDate: todayStr,
    dueDate: todayStr,
    proposedHours: '',
    description: '',
  });

  useEffect(() => {
    if (!open) return;

    let active = true;
    const loadData = async () => {
      try {
        const projRepo = container.resolve(PROJECT_REPOSITORY_TOKEN);
        const empRepo = container.resolve(EMPLOYEE_REPOSITORY_TOKEN);

        const [projRes, empRes] = await Promise.all([
          projRepo.findMany({ pageSize: 500 }),
          empRepo.findMany({ pageSize: 500 }),
        ]);

        if (active) {
          setProjects(projRes.data || []);
          setEmployees(empRes.data || []);
        }
      } catch (err) {
        console.error('Error loading task modal dependencies:', err);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        category: defaultProjectId ? defaultProjectId : 'Office Task',
        assigneeId: defaultAssigneeId || prev.assigneeId || user?.id || '',
        startDate: todayStr,
        dueDate: todayStr,
      }));
    }
  }, [open, defaultProjectId, defaultAssigneeId, user?.id, todayStr]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast({ variant: 'error', title: 'Task Title Required', message: 'Please enter a task title.' });
      return;
    }

    setLoading(true);
    try {
      const taskRepo = container.resolve(TASK_REPOSITORY_TOKEN);
      const isProject = form.category !== 'Office Task' && form.category !== '';
      const projectId = isProject ? form.category : undefined;

      const proposedHrs = Number(form.proposedHours) || 0;

      const res = await taskRepo.create({
        title: form.title.trim(),
        projectId,
        assigneeId: form.assigneeId || user?.id,
        assignedByEmployeeId: user?.id,
        supervisorId: form.supervisorId || undefined,
        startDate: form.startDate,
        dueDate: form.dueDate,
        description: form.description.trim() || undefined,
        proposedHours: proposedHrs,
        estimatedHours: proposedHrs,
        status: 'todo',
        priority: 'medium',
        approvalStatus: 'approved',
      }, { id: user?.id, role: user?.role || 'employee' } as any);

      if (res) {
        toast({ variant: 'success', title: 'Task Created', message: `Task "${form.title}" created successfully.` });
        if (onSuccess) onSuccess();
        onClose();
        setForm({
          title: '',
          category: 'Office Task',
          assigneeId: '',
          supervisorId: '',
          startDate: todayStr,
          dueDate: todayStr,
          proposedHours: '',
          description: '',
        });
      }
    } catch (err: any) {
      console.error('Create task error:', err);
      toast({ variant: 'error', title: 'Creation Failed', message: err.message || 'Could not create task.' });
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        backgroundColor: 'var(--bg-overlay)',
        backdropFilter: 'blur(var(--overlay-blur, 3px))',
        WebkitBackdropFilter: 'blur(var(--overlay-blur, 3px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-panel)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Create New Task
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-xs)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Task Title */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Task Title <span style={{ color: 'var(--tone-danger-text)' }}>*</span>
            </label>
            <input
              type="text"
              required
              className="kvj-input"
              placeholder="e.g. Q3 Power BI Syllabus Audit"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* Category */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Category (Office Task or Project) <span style={{ color: 'var(--tone-danger-text)' }}>*</span>
            </label>
            <select
              className="kvj-select"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              <option value="Office Task">Office Task</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  Project: {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee & Supervisor Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Assignee Name
              </label>
              <select
                className="kvj-select"
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="">Select...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName || emp.lastName ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : emp.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Supervisor Name
              </label>
              <select
                className="kvj-select"
                value={form.supervisorId}
                onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="">Select...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName || emp.lastName ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : emp.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Start Date & Due Date Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Start Date
              </label>
              <input
                type="date"
                className="kvj-input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-sunken)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Due Date
              </label>
              <input
                type="date"
                className="kvj-input"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-sunken)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Proposed Time */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Proposed Time (Hours)
            </label>
            <input
              type="text"
              className="kvj-input"
              placeholder="e.g. 8 (or 4.5)"
              value={form.proposedHours}
              onChange={(e) => setForm({ ...form, proposedHours: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Task Description (Optional)
            </label>
            <textarea
              className="kvj-input"
              rows={3}
              placeholder="Describe the objectives or details of the task..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-panel)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 24px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--brand)',
                color: '#fff',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Submitting...' : 'Submit Task'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
