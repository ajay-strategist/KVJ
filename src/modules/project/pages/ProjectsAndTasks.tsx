/**
 * Projects & Tasks — three main sub-tabs:
 *   1. Projects     — Master project cards, client breakdown, member hours, and reports
 *   2. Tasks        — Office & project tasks, due date sorting, date window filters, and daily time entries
 *   3. Task Worklog — Comprehensive audit log of daily work entries and role approvals
 */

import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader } from '../../../shared/ui/components';
import { Tabs } from '../../../shared/ui/Tabs';
import { ProjectList } from './ProjectList';
import { TaskBoard } from './TaskBoard';
import { TaskWorklogView } from './TaskWorklogView';
import { useProject } from '../hooks/useProject';
import { useEmployee } from '../../employee/hooks/useEmployee';
import { useAuth } from '../../auth/AuthProvider';

export function ProjectsAndTasks() {
  const { user } = useAuth();
  const { employees } = useEmployee();
  const projectData = useProject();

  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isMgmt = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(isMgmt ? 'all' : (user?.id || ''));

  return (
    <AppShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <PageHeader 
          title="Projects & Tasks" 
          subtitle="Manage projects, schedules, worklogs, and tasks"
        />
        {isMgmt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>👤 Filter by Employee:</span>
            <select
              className="kvj-select"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 180 }}
            >
              <option value="all">👥 All Employees</option>
              {user && <option value={user.id}>Me ({user.fullName})</option>}
              {(employees || []).filter(e => e.id !== user?.id).map((e) => {
                const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email;
                return <option key={e.id} value={e.id}>{name}</option>;
              })}
            </select>
          </div>
        )}
      </div>

      <Tabs
        items={[
          { 
            id: 'projects', 
            label: '🎴 Projects', 
            content: <ProjectList projectData={projectData} selectedEmployeeId={selectedEmployeeId} /> 
          },
          { 
            id: 'tasks', 
            label: '✅ Tasks', 
            content: <TaskBoard projectData={projectData} selectedEmployeeId={selectedEmployeeId} /> 
          },
          { 
            id: 'worklog', 
            label: '📋 Task Worklog', 
            content: <TaskWorklogView projectData={projectData} selectedEmployeeId={selectedEmployeeId} /> 
          },
        ]}
      />
    </AppShell>
  );
}

export default ProjectsAndTasks;
