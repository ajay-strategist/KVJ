/**
 * Projects & Tasks — two tabs, per the confirmed spec:
 *   1. Projects — projects, their tasks, hours and work log
 *   2. Tasks    — office tasks (recurring and one-day-only) and their work log
 *
 * Replaces the separate Project Catalog / Task Board sidebar entries.
 */

import { AppShell } from '../../../shared/layout/AppShell';
import { Tabs } from '../../../shared/ui/Tabs';
import { ProjectList } from './ProjectList';
import { TaskBoard } from './TaskBoard';

export function ProjectsAndTasks() {
  return (
    <AppShell>
      <Tabs
        items={[
          { id: 'projects', label: 'Projects', content: <ProjectList /> },
          { id: 'tasks', label: 'Tasks', content: <TaskBoard /> },
        ]}
      />
    </AppShell>
  );
}

export default ProjectsAndTasks;
