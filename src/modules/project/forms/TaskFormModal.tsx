import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useDevice } from '../../../shared/hooks/responsive';
import { container } from '../../../core/registry';
import { PROJECT_REPOSITORY_TOKEN, type Project } from '../project.repository';
import { PROJECT_SERVICE_TOKEN } from '../project.service';
import { EMPLOYEE_REPOSITORY_TOKEN } from '../../employee/employee.repository';

export interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultProjectId?: string;
  defaultAssigneeId?: string;
}

export function TaskFormModal({
  open,
  onClose,
  onSuccess,
  defaultProjectId,
  defaultAssigneeId,
}: TaskFormModalProps) {
  const { user } = useAuth();
  const device = useDevice();
  const isMobile = device === 'mobile';
  const { toast } = useNotifications();

  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    title: '',
    category: defaultProjectId || 'Office Task',
    assigneeId: defaultAssigneeId || user?.id || '',
    supervisorId: '',
    startDate: todayStr,
    dueDate: todayStr,
    estimatedHours: '',
    description: '',
  });

  // Load project & employee repositories
  useEffect(() => {
    if (!open) return;

    let active = true;
    const loadDependencies = async () => {
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
        console.error('Error loading task dependencies:', err);
      }
    };

    loadDependencies();
    return () => {
      active = false;
    };
  }, [open]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      const initialAssignee = defaultAssigneeId || user?.id || '';
      const initialCat = defaultProjectId || 'Office Task';

      setForm({
        title: '',
        category: initialCat,
        assigneeId: initialAssignee,
        supervisorId: '',
        startDate: todayStr,
        dueDate: todayStr,
        estimatedHours: '',
        description: '',
      });
    }
  }, [open, defaultProjectId, defaultAssigneeId, user?.id, todayStr]);

  // Dynamic Supervisor Resolution based on KVJ Business Logic:
  // 1. In Project Task -> Project Supervisor
  // 2. In Office Task & self-assigned -> Assignee can choose supervisor
  // 3. If Assigning to another employee -> Assignor (logged-in user) is the supervisor
  const isOfficeTask = form.category === 'Office Task';
  const isAssigningToOther = Boolean(form.assigneeId && user?.id && form.assigneeId !== user.id);

  const resolvedSupervisorId = useMemo(() => {
    if (!isOfficeTask) {
      const p = projects.find((proj) => proj.id === form.category);
      if (p?.supervisorId) return p.supervisorId;
    }
    if (isAssigningToOther) {
      return user?.id || '';
    }
    return form.supervisorId;
  }, [isOfficeTask, form.category, projects, isAssigningToOther, user?.id, form.supervisorId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast({ variant: 'error', title: 'Title Required', message: 'Please enter a task title.' });
      return;
    }

    const estHrs = Number(form.estimatedHours);
    if (!form.estimatedHours || isNaN(estHrs) || estHrs <= 0) {
      toast({
        variant: 'error',
        title: 'Estimated Hours Required',
        message: 'Estimated hours is mandatory and must be greater than zero.',
      });
      return;
    }

    if (form.dueDate < todayStr) {
      toast({
        variant: 'error',
        title: 'Invalid Due Date',
        message: 'Task due date must be today or a future date (no backdating allowed).',
      });
      return;
    }

    setLoading(true);
    try {
      const projectId = isOfficeTask ? undefined : form.category;
      const proj = projects.find((p) => p.id === projectId);
      const prjCode = proj?.code || 'TSK';
      const autoTaskCode = `${prjCode}-T${Math.floor(100 + Math.random() * 900)}`;

      const isCeo = user?.role?.toUpperCase() === 'CEO';
      const approvalStatus = (!isCeo && isAssigningToOther) ? 'pending_assignment_approval' : null;

      const projectService = container.resolve(PROJECT_SERVICE_TOKEN);
      const res = await projectService.createTask(
        {
          code: autoTaskCode,
          title: form.title.trim(),
          projectId,
          assigneeId: form.assigneeId || user?.id,
          assignedByEmployeeId: user?.id,
          supervisorId: resolvedSupervisorId || form.supervisorId || undefined,
          startDate: form.startDate,
          dueDate: form.dueDate,
          description: form.description.trim() || undefined,
          proposedHours: estHrs,
          estimatedHours: estHrs,
          status: 'todo',
          priority: 'medium', // Defaults internally to medium (selector removed from UI)
          approvalStatus,
        } as any,
        { id: user?.id || '', role: user?.role || 'employee' }
      );

      if (res.ok) {
        const msg = approvalStatus
          ? `Task "${form.title}" created. Peer assignment sent for Manager/Admin approval.`
          : `Task "${form.title}" created successfully.`;

        toast({
          variant: approvalStatus ? 'warning' : 'success',
          title: approvalStatus ? 'Assignment Pending Approval' : 'Task Created',
          message: msg,
        });

        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast({ variant: 'error', title: 'Creation Failed', message: res.error?.message || 'Could not create task.' });
      }
    } catch (err: any) {
      console.error('Error in TaskFormModal submit:', err);
      toast({ variant: 'error', title: 'Submission Error', message: err?.message || 'Failed to create task.' });
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
        backgroundColor: 'var(--bg-overlay, rgba(15, 23, 42, 0.6))',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
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
          maxWidth: '560px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-panel, #f8fafc)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
            ➕ Create New Task
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Task Title */}
          <div>
            <label className="kvj-label">
              Task Title <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="text"
              required
              className="kvj-input"
              placeholder="e.g. Q3 Power BI Syllabus Audit"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>

          {/* Category (Office Task vs Project) */}
          <div>
            <label className="kvj-label">Category</label>
            <select
              className="kvj-select"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="Office Task">🏢 Office Task (General Company Task)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  📁 Project: {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee & Supervisor Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="kvj-label">Assignee</label>
              <select
                className="kvj-select"
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                style={{ width: '100%' }}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName || emp.lastName ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : emp.email}
                    {emp.id === user?.id ? ' (You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="kvj-label">Supervisor</label>
              <select
                className="kvj-select"
                disabled={!isOfficeTask || isAssigningToOther}
                value={resolvedSupervisorId}
                onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}
                style={{
                  width: '100%',
                  backgroundColor: (!isOfficeTask || isAssigningToOther) ? 'var(--bg-sunken)' : undefined,
                }}
              >
                <option value="">Select Supervisor...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName || emp.lastName ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : emp.email}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                {!isOfficeTask && 'Auto-linked to Project Lead.'}
                {isOfficeTask && isAssigningToOther && 'Auto-linked to you (Task Assignor).'}
                {isOfficeTask && !isAssigningToOther && 'Select your reporting supervisor.'}
              </div>
            </div>
          </div>

          {/* Peer Assignment Notice */}
          {isAssigningToOther && user?.role?.toUpperCase() !== 'CEO' && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: 'var(--status-warning-bg, #fffbeb)',
                border: '1px solid var(--status-warning, #f59e0b)',
                fontSize: 11,
                color: 'var(--status-warning-text, #92400e)',
              }}
            >
              ℹ️ Peer Delegation: Assigning to a colleague requires Manager sign-off before entering "To Do".
            </div>
          )}

          {/* Start Date & Due Date (No Backdating min={todayStr}) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="kvj-label">Start Date</label>
              <input
                type="date"
                className="kvj-input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="kvj-label">
                Due Date <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <input
                type="date"
                required
                min={todayStr}
                className="kvj-input"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Estimated Hours (Mandatory) */}
          <div>
            <label className="kvj-label">
              Estimated Hours <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="number"
              required
              min="0.5"
              step="0.5"
              placeholder="e.g. 4.0"
              className="kvj-input"
              value={form.estimatedHours}
              onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="kvj-label">Description</label>
            <textarea
              rows={3}
              className="kvj-input"
              placeholder="Detailed instructions or context for this task..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Footer Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="kvj-button kvj-button-secondary"
              style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="kvj-button kvj-button-primary"
              style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
export default TaskFormModal;
