import { useState, useEffect, useMemo } from 'react';
import { PageHeader, Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '../../../shared/permissions/react';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { isFullControl } from '../../../shared/permissions/roles';

import { useProject } from '../hooks/useProject';
import { useTaskSessions } from '../hooks/useTaskSessions';
import type { TaskWorkSession } from '../project.repository';
import { useEmployee } from '../../employee/hooks/useEmployee';
import type { UUID } from '../../../core/types';

// ── localStorage key used by the My Day task timer ────────────────────────────
const TASK_TIMER_KEY = 'kvj_task_timer_state_v1';

interface StoredTimer {
  secondsToday: number;
  active: boolean;
  lastStartTime?: number;
  underReview?: boolean;
}

function getTimerStates(): Record<string, StoredTimer> {
  try {
    const raw = localStorage.getItem(TASK_TIMER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export interface WorklogRecord {
  id: string;
  date: string;
  taskName: string;
  projectName: string;
  category: 'Office Task' | 'Project Task';
  employeeName: string;
  role: 'Assignee' | 'Supervisor';
  durationHrs: number;
  description: string;
  reviewStatus: 'Approved' | 'Pending Review';
  supervisorName: string;
  // synthetic flag — came from task actualHours rather than a timesheet row
  isSynthetic?: boolean;
}

export function TaskWorklogView({
  projectData,
  selectedEmployeeId,
}: {
  projectData?: any;
  selectedEmployeeId?: string;
}) {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { can } = usePermissions();
  const isSupervisor = can('task', 'approve');
  // Admin / CEO / Manager see ALL employees; regular employees see only themselves
  const isManagement = user ? isFullControl(user.role as any) : false;

  const [filterRole, setFilterRole] = useState<'all' | 'Assignee' | 'Supervisor'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'Office Task' | 'Project Task'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Approved' | 'Pending Review'>('all');

  // ── Work Sessions: try Supabase first, fall back to localStorage timer state ─
  const { listSessions } = useTaskSessions();
  const [dbSessions, setDbSessions] = useState<TaskWorkSession[]>([]);
  const [sessFrom, setSessFrom] = useState('');
  const [sessTo, setSessTo] = useState('');

  useEffect(() => {
    let active = true;
    const load = () => {
      listSessions()
        .then((s) => { if (active) setDbSessions(s); })
        .catch(() => {});
    };
    load();
    const iv = window.setInterval(load, 15000);
    return () => { active = false; window.clearInterval(iv); };
  }, [listSessions]);

  const [logs, setLogs] = useState<WorklogRecord[]>([]);

  const localProjectData = useProject();
  const actualProjectData = projectData || localProjectData;
  const { projects, tasks, allocations, timesheets, approveTimesheet } = actualProjectData;
  const { employees } = useEmployee();

  // ── Build synthetic sessions from localStorage when DB sessions are empty ────
  const sessions: TaskWorkSession[] = useMemo(() => {
    const rawList = dbSessions.length > 0 ? dbSessions : (() => {
      const timerStates = getTimerStates();
      const synth: TaskWorkSession[] = [];

      (tasks || []).forEach((t: any) => {
        const stored = timerStates[t.id];
        const actualSec = stored?.secondsToday || Math.round((t.actualHours || 0) * 3600);
        if (actualSec <= 0) return;

        // Scope: employees only see their own sessions
        if (!isManagement && user && t.assigneeId !== user.id && t.assigneeId !== user.email) return;

        const proj = (projects || []).find((p: any) => p.id === t.projectId);
        const now = Date.now();
        const isActive = stored?.active;
        const startMs = stored?.lastStartTime
          ? stored.lastStartTime - (stored.secondsToday - actualSec) * 1000
          : now - actualSec * 1000;
        const startISO = new Date(startMs).toISOString();
        const endISO = isActive ? undefined : new Date(startMs + actualSec * 1000).toISOString();
        const supervisorAlloc = proj
          ? (allocations || []).find(
              (a: any) =>
                a.projectId === proj.id &&
                (a.role?.toLowerCase().includes('lead') || a.role?.toLowerCase().includes('manager')),
            )
          : null;
        const supervisorEmp = supervisorAlloc
          ? employees.find((e) => e.id === supervisorAlloc.employeeId)
          : null;

        synth.push({
          id: `local-${t.id}`,
          taskId: t.id,
          projectId: t.projectId,
          employeeId: t.assigneeId || user?.id,
          supervisorId: t.supervisorId || supervisorAlloc?.employeeId,
          supervisorName: supervisorEmp
            ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}`
            : undefined,
          workTitle: t.title,
          workCode: t.title.split(/\s+/).filter(Boolean).map((w: string) => w[0]).join('').toUpperCase().slice(0, 6),
          startTime: startISO,
          endTime: endISO,
          durationMinutes: isActive ? undefined : Math.round(actualSec / 60),
          status:
            t.status === 'review' || (t as any).approvalStatus === 'pending_task_approval'
              ? 'completed'
              : isActive
              ? 'running'
              : 'paused',
          createdAt: startISO,
          updatedAt: new Date().toISOString(),
          deletedAt: undefined,
        } as any);
      });

      // Also pick up in_progress tasks not yet in timerStates
      (tasks || []).forEach((t: any) => {
        if (synth.find((s) => s.taskId === t.id)) return;
        if (t.status !== 'in_progress' && !((t.actualHours || 0) > 0)) return;
        if (!isManagement && user && t.assigneeId !== user.id && t.assigneeId !== user.email) return;
        const proj = (projects || []).find((p: any) => p.id === t.projectId);
        const actualSec = Math.round((t.actualHours || 0) * 3600);
        if (actualSec <= 0) return;
        const startISO = new Date(Date.now() - actualSec * 1000).toISOString();
        const supervisorAlloc = proj
          ? (allocations || []).find(
              (a: any) =>
                a.projectId === proj.id &&
                (a.role?.toLowerCase().includes('lead') || a.role?.toLowerCase().includes('manager')),
            )
          : null;
        const supervisorEmp = supervisorAlloc
          ? employees.find((e) => e.id === supervisorAlloc.employeeId)
          : null;
        synth.push({
          id: `local-db-${t.id}`,
          taskId: t.id,
          projectId: t.projectId,
          employeeId: t.assigneeId || user?.id,
          supervisorId: supervisorAlloc?.employeeId,
          supervisorName: supervisorEmp ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}` : undefined,
          workTitle: t.title,
          workCode: t.title.split(/\s+/).filter(Boolean).map((w: string) => w[0]).join('').toUpperCase().slice(0, 6),
          startTime: startISO,
          endTime: undefined,
          durationMinutes: Math.round(actualSec / 60),
          status: t.status === 'in_progress' ? 'running' : 'paused',
          createdAt: startISO,
          updatedAt: new Date().toISOString(),
          deletedAt: undefined,
        } as any);
      });

      return synth;
    })();

    return rawList.map((s: any) => {
      const t = (tasks || []).find((tk: any) => tk.id === s.taskId);
      const proj = t ? (projects || []).find((p: any) => p.id === t.projectId) : null;
      
      const pSupervisorId = proj ? (proj as any).supervisorId : null;
      let supervisorId = pSupervisorId || s.supervisorId || t?.supervisorId;
      let supervisorName = s.supervisorName || t?.supervisorName;

      if (!supervisorId) {
        const supervisorAlloc = proj
          ? (allocations || []).find(
              (a: any) =>
                a.projectId === proj.id &&
                (a.role?.toLowerCase().includes('lead') || a.role?.toLowerCase().includes('manager')),
            )
          : null;
        if (supervisorAlloc) {
          supervisorId = supervisorAlloc.employeeId;
        }
      }

      if (supervisorId && !supervisorName) {
        const supervisorEmp = employees.find((e) => e.id === supervisorId);
        if (supervisorEmp) {
          supervisorName = `${supervisorEmp.firstName} ${supervisorEmp.lastName}`;
        }
      }

      return {
        ...s,
        supervisorId,
        supervisorName: supervisorName || '—'
      };
    });
  }, [dbSessions, tasks, projects, employees, allocations, user, isManagement]);

  // ── Build worklog from timesheets + synthetic task-hour entries ───────────────
  const mappedLogs = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    // Timesheet-based entries
    const fromTimesheets = (timesheets || [])
      .filter((ts: any) => {
        // Specific employee filter (from parent dropdown)
        if (selectedEmployeeId && selectedEmployeeId !== 'all') {
          return ts.employeeId === selectedEmployeeId;
        }
        // Employees only see their own; management sees everyone
        if (!isManagement && user) {
          return ts.employeeId === user.id;
        }
        return true;
      })
      .map((ts: any) => {
        const project = (projects || []).find((p: any) => p.id === ts.projectId);
        const task = (tasks || []).find((t: any) => t.id === ts.taskId);
        const emp = employees.find((e) => e.id === ts.employeeId);
        const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Team Member';
        const supervisorAlloc = project
          ? (allocations || []).find(
              (a: any) =>
                a.projectId === project.id &&
                (a.role?.toLowerCase().includes('lead') || a.role?.toLowerCase().includes('manager')),
            )
          : null;
        const supervisorEmp = supervisorAlloc
          ? employees.find((e) => e.id === supervisorAlloc.employeeId)
          : null;
        const supervisorName = supervisorEmp ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}` : '';
        const isSuper = emp
          ? emp.designation.toLowerCase().includes('manager') ||
            emp.designation.toLowerCase().includes('ceo') ||
            emp.designation.toLowerCase().includes('lead')
          : false;

        return {
          id: ts.id,
          date: ts.workDate,
          taskName: task ? task.title : 'General Tasks',
          projectName: project ? project.title : 'Office Task',
          category: 'Project Task' as const,
          employeeName: empName,
          role: isSuper ? ('Supervisor' as const) : ('Assignee' as const),
          durationHrs: Number(ts.hoursLogged || 0),
          description: ts.notes || 'Daily work progress entry',
          reviewStatus: ts.status === 'approved' ? ('Approved' as const) : ('Pending Review' as const),
          supervisorName,
          isSynthetic: false,
        };
      });

    // Synthetic entries from tasks with actualHours when no timesheets exist
    const timerStates = getTimerStates();
    const fromTasks: WorklogRecord[] = (tasks || [])
      .filter((t: any) => {
        const actualSec =
          timerStates[t.id]?.secondsToday || Math.round((t.actualHours || 0) * 3600);
        if (actualSec <= 10) return false; // ignore tasks with <10s tracked
        // Employees only see their own tasks
        if (!isManagement && user) {
          const isMyTask =
            t.assigneeId === user.id ||
            t.assigneeId === user.email ||
            ((t as any).assignee &&
              user.fullName &&
              (t as any).assignee.toLowerCase() === user.fullName.toLowerCase());
          if (!isMyTask) return false;
        }
        // Management can further filter by a specific employee
        if (selectedEmployeeId && selectedEmployeeId !== 'all') {
          return t.assigneeId === selectedEmployeeId;
        }
        // Don't duplicate if there's already a timesheet for this task today
        const alreadyHasSheet = fromTimesheets.some(
          (l: WorklogRecord) => l.taskName === t.title && l.date === today,
        );
        return !alreadyHasSheet;
      })
      .map((t: any) => {
        const proj = (projects || []).find((p: any) => p.id === t.projectId);
        const emp = employees.find((e) => e.id === t.assigneeId);
        const empName = emp
          ? `${emp.firstName} ${emp.lastName}`
          : user?.fullName || 'Team Member';
        const supervisorAlloc = proj
          ? (allocations || []).find(
              (a: any) =>
                a.projectId === proj.id &&
                (a.role?.toLowerCase().includes('lead') ||
                  a.role?.toLowerCase().includes('manager')),
            )
          : null;
        const supervisorEmp = supervisorAlloc
          ? employees.find((e) => e.id === supervisorAlloc.employeeId)
          : null;
        const actualSec =
          timerStates[t.id]?.secondsToday || Math.round((t.actualHours || 0) * 3600);

        const isApproved =
          t.status === 'done' ||
          t.status === 'completed' ||
          (t as any).approvalStatus === 'approved';

        return {
          id: `synth-${t.id}`,
          date: today,
          taskName: t.title,
          projectName: proj ? proj.title : 'Office Task',
          category: 'Project Task' as const,
          employeeName: empName,
          role: 'Assignee' as const,
          durationHrs: actualSec / 3600,
          description:
            t.status === 'in_progress'
              ? '⏱ Task is currently in progress (timer running)'
              : t.status === 'review' || (t as any).approvalStatus === 'pending_task_approval'
              ? '🔍 Submitted for manager review'
              : 'Task work recorded today',
          reviewStatus: isApproved ? ('Approved' as const) : ('Pending Review' as const),
          supervisorName: supervisorEmp
            ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}`
            : '',
          isSynthetic: true,
        };
      });

    const combined = [...fromTimesheets, ...fromTasks];
    return combined.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
  }, [timesheets, tasks, projects, employees, allocations, selectedEmployeeId, isSupervisor, user]);

  useEffect(() => {
    setLogs(mappedLogs);
  }, [mappedLogs]);

  // Auto-refresh worklog every 30s so running timers update in-place
  useEffect(() => {
    const iv = window.setInterval(() => setLogs(mappedLogs), 30000);
    return () => window.clearInterval(iv);
  }, [mappedLogs]);

  const handleApprove = async (id: string) => {
    if (id.startsWith('synth-') || id.startsWith('local-')) {
      toast({ variant: 'info', title: 'Submit First', message: 'Click Submit on the task in My Day to route it to the approvals queue.' });
      return;
    }
    const res = await approveTimesheet(id as UUID);
    if (res.ok) {
      toast({ variant: 'success', title: 'Worklog Approved', message: 'Time entry status updated to Approved.' });
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error });
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (filterRole !== 'all' && l.role !== filterRole) return false;
    if (filterCategory !== 'all' && l.category !== filterCategory) return false;
    if (filterStatus !== 'all' && l.reviewStatus !== filterStatus) return false;
    return true;
  });

  const totalHoursLogged = filteredLogs.reduce((acc, l) => acc + l.durationHrs, 0);
  const pendingCount = filteredLogs.filter((l) => l.reviewStatus === 'Pending Review').length;

  // Helpers shared below
  const empName = (id?: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : '—';
  };
  const projName = (id?: string) => (projects || []).find((p: any) => p.id === id)?.title;
  const fmtDur = (m?: number) => {
    if (m == null) return '—';
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  };
  const dOnly = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return '—';
    }
  };
  const tOnly = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      : '—';
  const statusTone = (st?: string) =>
    st === 'running' ? 'success' : st === 'paused' ? 'warning' : 'neutral';

  const filteredSessions = sessions.filter((s) => {
    if (selectedEmployeeId && selectedEmployeeId !== 'all') {
      if (s.employeeId !== selectedEmployeeId) return false;
    }
    const d = (s.startTime || '').slice(0, 10);
    if (sessFrom && d < sessFrom) return false;
    if (sessTo && d > sessTo) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Work Sessions timeline ── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <SectionHeader title={`Work Sessions (${filteredSessions.length})`} />
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              background: 'var(--bg-sunken)', 
              border: '1px solid var(--border)', 
              borderRadius: 30, 
              padding: '4px 14px',
              gap: 8,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>📅</span>
            <input 
              type="date" 
              value={sessFrom} 
              onChange={(e) => setSessFrom(e.target.value)} 
              style={{ 
                border: 'none', 
                background: 'transparent', 
                outline: 'none', 
                fontSize: 12.5, 
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                cursor: 'pointer'
              }} 
              aria-label="From date" 
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>to</span>
            <input 
              type="date" 
              value={sessTo} 
              onChange={(e) => setSessTo(e.target.value)} 
              style={{ 
                border: 'none', 
                background: 'transparent', 
                outline: 'none', 
                fontSize: 12.5, 
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                cursor: 'pointer'
              }} 
              aria-label="To date" 
            />
            {(sessFrom || sessTo) && (
              <button 
                type="button"
                onClick={() => { setSessFrom(''); setSessTo(''); }}
                style={{ 
                  border: 'none', 
                  background: 'none', 
                  color: 'var(--status-danger)', 
                  cursor: 'pointer', 
                  fontSize: 12, 
                  fontWeight: 600,
                  padding: '0 4px',
                  marginLeft: 4
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>
                {['Employee', 'Supervisor', 'Project / Task', 'Date', 'Start Time', 'End Time', 'Duration', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>No work sessions recorded yet.</td></tr>
              ) : filteredSessions.map((s) => {
                const project = s.projectId && s.projectId !== 'OFFICE_TASK' ? (projects || []).find((p: any) => p.id === s.projectId) : null;
                const task = (tasks || []).find((tk: any) => tk.id === s.taskId);
                const pSupervisorId = project ? (project as any).supervisorId : null;
                const tSupervisorId = task?.supervisorId || (task as any)?.assignedByEmployeeId;
                const resolvedSupervisorId = pSupervisorId || tSupervisorId || s.supervisorId;
                const resolvedSupervisorName = s.supervisorName || empName(resolvedSupervisorId);

                return (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{empName(s.employeeId)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{resolvedSupervisorName || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <strong>{project ? `${project.title}: ` : 'Office Task: '}</strong>{s.workTitle}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{dOnly(s.startTime)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{tOnly(s.startTime)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{s.endTime ? tOnly(s.endTime) : '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {s.status === 'running' ? 'Running…' : fmtDur(s.durationMinutes)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge tone={statusTone(s.status)}>
                        {(s.status || 'completed').charAt(0).toUpperCase() + (s.status || 'completed').slice(1)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* KPI Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card style={{ borderLeft: '4px solid var(--brand)', padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Logged Entries</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>{filteredLogs.length} Entries</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--accent)', padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Hours Logged</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>⏱ {totalHoursLogged.toFixed(1)} hrs</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--status-warning)', padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Pending Approvals</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-warning)', marginTop: 4 }}>⏳ {pendingCount} Pending</div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>👤 Role:</span>
              <select className="kvj-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value as any)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 130 }}>
                <option value="all">All Roles</option>
                <option value="Assignee">Assignee</option>
                <option value="Supervisor">Supervisor</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>🏷 Type:</span>
              <select className="kvj-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 140 }}>
                <option value="all">All Categories</option>
                <option value="Office Task">Office Task</option>
                <option value="Project Task">Project Task</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>🔍 Status:</span>
              <select className="kvj-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 140 }}>
                <option value="all">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Pending Review">Pending Review</option>
              </select>
            </div>
          </div>

          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            Showing {filteredLogs.length} Work Log Records
          </span>
        </div>
      </Card>

      {/* Main Timeline Work Log Grid */}
      <Card style={{ padding: 16 }}>
        <SectionHeader title="Timeline of the Office" />
        <div style={{ position: 'relative', marginTop: 16, paddingLeft: 24, borderLeft: '2px solid var(--border)' }}>
          {filteredLogs.map((log) => (
            <div key={log.id} style={{ position: 'relative', marginBottom: 24 }}>
              {/* Timeline Dot */}
              <div style={{
                position: 'absolute',
                left: -33,
                top: 4,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: log.reviewStatus === 'Approved' ? 'var(--status-success)' : log.isSynthetic ? 'var(--brand)' : 'var(--status-warning)',
                border: '3px solid var(--bg-surface)',
              }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-sunken)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    📅 {log.date} — {log.employeeName}
                    {log.isSynthetic && (
                      <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-subtle)', padding: '2px 6px', borderRadius: 4 }}>
                        LIVE TRACKING
                      </span>
                    )}
                  </div>
                  <Badge tone={log.reviewStatus === 'Approved' ? 'success' : 'warning'}>
                    {log.reviewStatus}
                  </Badge>
                </div>

                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
                  {log.taskName} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>({log.projectName})</span>
                </div>

                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                  {log.description}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Badge tone={log.category === 'Office Task' ? 'warning' : 'info'}>{log.category}</Badge>
                    <Badge tone={log.role === 'Supervisor' ? 'info' : 'neutral'}>{log.role === 'Supervisor' ? 'Manager (Operations)' : 'Assignee'}</Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 13 }}>
                      ⏱ {(log.durationHrs || 0).toFixed(1)} hrs
                    </div>
                    {isSupervisor && log.reviewStatus === 'Pending Review' && (
                      <Button size="sm" onClick={() => handleApprove(log.id)} style={{ fontSize: 12 }}>
                        ✓ Approve
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>No work logs match the current filters.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default TaskWorklogView;
