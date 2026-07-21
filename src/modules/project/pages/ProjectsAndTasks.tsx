/**
 * Projects & Tasks — three main sub-tabs:
 *   1. Projects     — Master project cards, client breakdown, member hours, and reports
 *   2. Tasks        — Office & project tasks, due date sorting, date window filters, and daily time entries
 *   3. Task Worklog — Comprehensive audit log of daily work entries and role approvals
 */

import { AppShell } from '../../../shared/layout/AppShell';
import { Tabs } from '../../../shared/ui/Tabs';
import { ProjectList } from './ProjectList';
import { TaskBoard } from './TaskBoard';
import { TaskWorklogView } from './TaskWorklogView';

export function ProjectsAndTasks() {
  return (
    <AppShell>
      <Tabs
        items={[
          { id: 'projects', label: '🎴 Projects', content: <ProjectList /> },
          { id: 'tasks', label: '✅ Tasks', content: <TaskBoard /> },
          { id: 'worklog', label: '📋 Task Worklog', content: <TaskWorklogView /> },
        ]}
      />
    </AppShell>
  );
}

export default ProjectsAndTasks;
