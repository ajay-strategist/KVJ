import { useState, useMemo } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader } from '../../../shared/ui/components';
import { Tabs } from '../../../shared/ui/Tabs';
import { ProjectList } from './ProjectList';
import { TaskBoard } from './TaskBoard';
import { TaskWorklogView } from './TaskWorklogView';
import { SupervisorApprovalsView } from './SupervisorApprovalsView';
import { ProjectCommonFilterHeader, type ProjectCommonFiltersState } from '../components/ProjectCommonFilterHeader';
import { useProject } from '../hooks/useProject';
import { useEmployee } from '../../employee/hooks/useEmployee';
import { useAuth } from '../../auth/AuthProvider';

export function ProjectsAndTasks() {
  const { user } = useAuth();
  const { employees } = useEmployee();
  const projectData = useProject();

  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isMgmt = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  const initialFilters: ProjectCommonFiltersState = {
    searchQuery: '',
    selectedProjectId: 'all',
    selectedEmployeeId: isMgmt ? 'all' : (user?.id || ''),
    selectedStatus: 'all',
    selectedClient: 'all',
    selectedDate: '',
  };

  const [commonFilters, setCommonFilters] = useState<ProjectCommonFiltersState>(initialFilters);

  const handleFilterChange = (updated: Partial<ProjectCommonFiltersState>) => {
    setCommonFilters((prev) => ({ ...prev, ...updated }));
  };

  const handleResetFilters = () => {
    setCommonFilters(initialFilters);
  };

  // Compute pending approval count for Supervisor Approvals badge
  const pendingApprovalCount = useMemo(() => {
    const tasks = projectData?.tasks || [];
    const projects = projectData?.projects || [];
    return tasks.filter((t: any) => {
      const proj = projects.find((p: any) => p.id === t.projectId);
      const isSupervisor = (proj && proj.supervisorId === user?.id) || t.supervisorId === user?.id || isMgmt;
      if (!isSupervisor) return false;
      const isPendingStart = t.approvalStatus === 'pending_assignment_approval' || t.status === 'Pending Approval' || t.status === 'pending_approval';
      const isPendingReview = t.approvalStatus === 'pending_task_approval' || t.status === 'Under Review' || t.status === 'review';
      return isPendingStart || isPendingReview;
    }).length;
  }, [projectData?.tasks, projectData?.projects, user?.id, isMgmt]);

  return (
    <AppShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <PageHeader 
          title="Projects & Tasks" 
          subtitle="Manage projects, schedules, worklogs, and supervisor approvals"
        />
      </div>

      {/* Common Filter Header */}
      <ProjectCommonFilterHeader
        filters={commonFilters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        projects={projectData?.projects || []}
        clients={projectData?.clients || []}
      />

      <Tabs
        items={[
          { 
            id: 'projects', 
            label: '🎴 Projects', 
            content: (
              <ProjectList
                projectData={projectData}
                selectedEmployeeId={commonFilters.selectedEmployeeId}
                commonFilters={commonFilters}
              />
            ) 
          },
          { 
            id: 'tasks', 
            label: '✅ Tasks', 
            content: (
              <TaskBoard
                projectData={projectData}
                selectedEmployeeId={commonFilters.selectedEmployeeId}
                commonFilters={commonFilters}
              />
            ) 
          },
          { 
            id: 'worklog', 
            label: '📋 Task Worklog', 
            content: (
              <TaskWorklogView
                projectData={projectData}
                selectedEmployeeId={commonFilters.selectedEmployeeId}
                commonFilters={commonFilters}
              />
            ) 
          },
          {
            id: 'approvals',
            label: `⚡ Supervisor Approvals ${pendingApprovalCount > 0 ? `(${pendingApprovalCount})` : ''}`,
            content: (
              <SupervisorApprovalsView
                projectData={projectData}
                commonFilters={commonFilters}
              />
            )
          }
        ]}
      />
    </AppShell>
  );
}

export default ProjectsAndTasks;
