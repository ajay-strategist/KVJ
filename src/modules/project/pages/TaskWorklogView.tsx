import { useState, useEffect, useMemo } from 'react';
import { PageHeader, Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '../../../shared/permissions/react';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

import { useProject } from '../hooks/useProject';
import { useTaskSessions } from '../hooks/useTaskSessions';
import type { TaskWorkSession } from '../project.repository';
import { useEmployee } from '../../employee/hooks/useEmployee';
import type { UUID } from '../../../core/types';

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

  const [filterRole, setFilterRole] = useState<'all' | 'Assignee' | 'Supervisor'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'Office Task' | 'Project Task'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Approved' | 'Pending Review'>('all');

  // ── Work Sessions timeline (real per-interval Start → Pause/Submit records) ──
  const { listSessions } = useTaskSessions();
  const [sessions, setSessions] = useState<TaskWorkSession[]>([]);
  const [sessFrom, setSessFrom] = useState('');
  const [sessTo, setSessTo] = useState('');
  useEffect(() => {
    let active = true;
    const load = () => { listSessions().then((s) => { if (active) setSessions(s); }).catch(() => {}); };
    load();
    const iv = window.setInterval(load, 15000); // keep running sessions fresh
    return () => { active = false; window.clearInterval(iv); };
  }, [listSessions]);

  const [logs, setLogs] = useState<WorklogRecord[]>([]);

  const localProjectData = useProject();
  const actualProjectData = projectData || localProjectData;
  const { projects, tasks, allocations, timesheets, approveTimesheet } = actualProjectData;
  const { employees } = useEmployee();

  const mappedLogs = useMemo(() => {
    const filteredTimesheets = timesheets.filter((ts: any) => {
      if (selectedEmployeeId && selectedEmployeeId !== 'all') {
        return ts.employeeId === selectedEmployeeId;
      }
      if (!isSupervisor && user) {
        return ts.employeeId === user.id;
      }
      return true;
    });

    const list = filteredTimesheets.map((ts: any) => {
      const project = projects.find((p: any) => p.id === ts.projectId);
      const task = tasks.find((t: any) => t.id === ts.taskId);
      const emp = employees.find((e) => e.id === ts.employeeId);
      const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Team Member';
      
      const supervisorAlloc = project ? allocations.find((a: any) => a.projectId === project.id && (a.role.toLowerCase().includes('lead') || a.role.toLowerCase().includes('manager'))) : null;
      const supervisorEmp = supervisorAlloc ? employees.find((e) => e.id === supervisorAlloc.employeeId) : null;
      const supervisorName = supervisorEmp ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}` : '';

      const isSuper = emp ? (emp.designation.toLowerCase().includes('manager') || emp.designation.toLowerCase().includes('ceo') || emp.designation.toLowerCase().includes('lead')) : false;

      return {
        id: ts.id,
        date: ts.workDate,
        taskName: task ? task.title : 'General Tasks',
        projectName: project ? project.title : 'General Project',
        category: 'Project Task' as const,
        employeeName: empName,
        role: isSuper ? ('Supervisor' as const) : ('Assignee' as const),
        durationHrs: Number(ts.hoursLogged || 0),
        description: ts.notes || 'Daily work progress entry',
        reviewStatus: ts.status === 'approved' ? ('Approved' as const) : ('Pending Review' as const),
        supervisorName,
      };
    });
    
    return list.sort((a: any, b: any) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
  }, [timesheets, projects, tasks, employees, allocations, selectedEmployeeId, isSupervisor, user]);

  useEffect(() => {
    setLogs(mappedLogs);
  }, [mappedLogs]);

  const handleApprove = async (id: string) => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Task Worklog & Time Entries Audit"
        subtitle="Role-differentiated daily work logs, hours worked, and supervisor approval workflow"
      />

      {/* ── Work Sessions timeline (real Start → Pause/Submit intervals) ── */}
      {(() => {
        const empName = (id?: string) => {
          const e = employees.find((x) => x.id === id);
          return e ? `${e.firstName} ${e.lastName}` : '—';
        };
        const projName = (id?: string) => projects.find((p: any) => p.id === id)?.title;
        const fmtDur = (m?: number) => {
          if (m == null) return '—';
          const h = Math.floor(m / 60); const mm = m % 60;
          return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
        };
        const dOnly = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-') : '—');
        const tOnly = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
        const rows = sessions.filter((s) => {
          const d = (s.startTime || '').slice(0, 10);
          if (sessFrom && d < sessFrom) return false;
          if (sessTo && d > sessTo) return false;
          return true;
        });
        const statusTone = (st?: string) =>
          st === 'running' ? 'success' : st === 'paused' ? 'warning' : 'neutral';
        return (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <SectionHeader title={`Work Sessions (${rows.length})`} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" className="kvj-input" value={sessFrom} onChange={(e) => setSessFrom(e.target.value)} style={{ maxWidth: 160 }} aria-label="From date" />
                <input type="date" className="kvj-input" value={sessTo} onChange={(e) => setSessTo(e.target.value)} style={{ maxWidth: 160 }} aria-label="To date" />
                {(sessFrom || sessTo) && <Button variant="ghost" size="sm" onClick={() => { setSessFrom(''); setSessTo(''); }}>Show All</Button>}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                    {['Employee', 'Supervisor', 'Work Code', 'Work / Project', 'Start Date', 'Start Time', 'End Date', 'End Time', 'Duration', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>No work sessions recorded yet.</td></tr>
                  ) : rows.map((s) => (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{empName(s.employeeId)}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{s.supervisorName || empName(s.supervisorId) || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.workCode || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{s.workTitle}{projName(s.projectId) ? <span style={{ color: 'var(--text-muted)' }}> · {projName(s.projectId)}</span> : null}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{dOnly(s.startTime)}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{tOnly(s.startTime)}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{dOnly(s.endTime)}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{s.endTime ? tOnly(s.endTime) : '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.status === 'running' ? 'Running…' : fmtDur(s.durationMinutes)}</td>
                      <td style={{ padding: '10px 12px' }}><Badge tone={statusTone(s.status)}>{(s.status || 'completed').charAt(0).toUpperCase() + (s.status || 'completed').slice(1)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })()}

      {/* KPI Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card style={{ borderLeft: '4px solid var(--brand)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Logged Entries</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>{filteredLogs.length} Entries</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--accent)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Hours Logged</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>⏱ {totalHoursLogged.toFixed(1)} hrs</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--status-warning)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Pending Approvals</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-warning)', marginTop: 4 }}>⏳ {pendingCount} Pending</div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>👤 Role:</span>
              <select
                className="kvj-select"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 130 }}
              >
                <option value="all">All Roles</option>
                <option value="Assignee">Assignee</option>
                <option value="Supervisor">Supervisor</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>🏷 Type:</span>
              <select
                className="kvj-select"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 140 }}
              >
                <option value="all">All Categories</option>
                <option value="Office Task">Office Task</option>
                <option value="Project Task">Project Task</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>🔍 Status:</span>
              <select
                className="kvj-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 140 }}
              >
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
                background: log.reviewStatus === 'Approved' ? 'var(--status-success)' : 'var(--status-warning)',
                border: '3px solid var(--bg-surface)'
              }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-sunken)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    📅 {log.date} — {log.employeeName}
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
                    <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 13 }}>⏱ {(log.durationHrs || 0).toFixed(1)} hrs</div>
                    {isSupervisor && log.reviewStatus === 'Pending Review' && (
                      <Button size="sm" onClick={() => handleApprove(log.id)} style={{ fontSize: 11 }}>
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
