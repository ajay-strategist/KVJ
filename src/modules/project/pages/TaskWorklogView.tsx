import { useState, useEffect, useMemo } from 'react';
import { PageHeader, Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '../../../shared/permissions/react';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

import { useProject } from '../hooks/useProject';
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

export function TaskWorklogView() {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { can } = usePermissions();
  const isSupervisor = can('task', 'approve');

  const [filterRole, setFilterRole] = useState<'all' | 'Assignee' | 'Supervisor'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'Office Task' | 'Project Task'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Approved' | 'Pending Review'>('all');

  const [logs, setLogs] = useState<WorklogRecord[]>([]);

  const { projects, tasks, allocations, timesheets, approveTimesheet } = useProject();
  const { employees } = useEmployee();

  const mappedLogs = useMemo(() => {
    return timesheets.map((ts) => {
      const project = projects.find((p) => p.id === ts.projectId);
      const task = tasks.find((t) => t.id === ts.taskId);
      const emp = employees.find((e) => e.id === ts.employeeId);
      const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Team Member';
      
      const supervisorAlloc = project ? allocations.find((a) => a.projectId === project.id && (a.role.toLowerCase().includes('lead') || a.role.toLowerCase().includes('manager'))) : null;
      const supervisorEmp = supervisorAlloc ? employees.find((e) => e.id === supervisorAlloc.employeeId) : null;
      const supervisorName = supervisorEmp ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}` : 'Manager (Operations)';

      const isSuper = emp ? (emp.designation.toLowerCase().includes('manager') || emp.designation.toLowerCase().includes('ceo') || emp.designation.toLowerCase().includes('lead')) : false;

      return {
        id: ts.id,
        date: ts.workDate,
        taskName: task ? task.title : 'General Tasks',
        projectName: project ? project.title : 'General Project',
        category: 'Project Task' as const,
        employeeName: empName,
        role: isSuper ? ('Supervisor' as const) : ('Assignee' as const),
        durationHrs: ts.hoursLogged,
        description: ts.notes || 'Daily work progress entry',
        reviewStatus: ts.status === 'approved' ? ('Approved' as const) : ('Pending Review' as const),
        supervisorName,
      };
    });
  }, [timesheets, projects, tasks, employees, allocations]);

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

      {/* Main Tabular Work Log Grid */}
      <Card style={{ padding: 16 }}>
        <SectionHeader title="Daily Task Work Log & Time Audit" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 14px' }}>Date</th>
                <th style={{ padding: '10px 14px' }}>Task Name & Project</th>
                <th style={{ padding: '10px 14px' }}>Category</th>
                <th style={{ padding: '10px 14px' }}>Employee / Logged By</th>
                <th style={{ padding: '10px 14px' }}>Role</th>
                <th style={{ padding: '10px 14px' }}>Description</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Hours Worked</th>
                <th style={{ padding: '10px 14px' }}>Review Status</th>
                {isSupervisor && <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>📅 {log.date}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{log.taskName}</div>
                    <div style={{ fontSize: 11, color: 'var(--brand)', marginTop: 2 }}>{log.projectName}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Badge tone={log.category === 'Office Task' ? 'warning' : 'info'}>
                      {log.category}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>👤 {log.employeeName}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <Badge tone={log.role === 'Supervisor' ? 'info' : 'neutral'}>
                      {log.role}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', maxWidth: 280 }}>{log.description}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>⏱ {log.durationHrs.toFixed(1)} hrs</td>
                  <td style={{ padding: '10px 14px' }}>
                    <Badge tone={log.reviewStatus === 'Approved' ? 'success' : 'warning'}>
                      {log.reviewStatus}
                    </Badge>
                  </td>
                  {isSupervisor && (
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {log.reviewStatus === 'Pending Review' ? (
                        <Button size="sm" onClick={() => handleApprove(log.id)} style={{ fontSize: 11 }}>
                          ✓ Approve
                        </Button>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Done</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default TaskWorklogView;
