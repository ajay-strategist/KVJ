import { useEffect, useState, useCallback, useMemo } from 'react';
import { container } from '../../../core/registry';
import { PROJECT_SERVICE_TOKEN } from '../project.service';
import {
  CLIENT_REPOSITORY_TOKEN,
  PROJECT_REPOSITORY_TOKEN,
  MILESTONE_REPOSITORY_TOKEN,
  RESOURCE_ALLOCATION_REPOSITORY_TOKEN,
  TASK_REPOSITORY_TOKEN,
  TIMESHEET_REPOSITORY_TOKEN,
  type Client, type Project, type Milestone, type ResourceAllocation,
  type Task, type TimesheetRecord
} from '../project.repository';
import type { UUID } from '../../../core/types';
import { useAuth } from '../../auth/AuthProvider';

type CallbackResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function useProject() {
  const service = useMemo(() => container.resolve(PROJECT_SERVICE_TOKEN), []);
  const { user } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const clientRepo = container.resolve(CLIENT_REPOSITORY_TOKEN);
      const projectRepo = container.resolve(PROJECT_REPOSITORY_TOKEN);
      const allocationRepo = container.resolve(RESOURCE_ALLOCATION_REPOSITORY_TOKEN);
      const taskRepo = container.resolve(TASK_REPOSITORY_TOKEN);
      const timesheetRepo = container.resolve(TIMESHEET_REPOSITORY_TOKEN);

      const [clPage, prPage, alPage, tkPage, tsPage] = await Promise.all([
        clientRepo.findMany(),
        projectRepo.findMany(),
        allocationRepo.findMany(),
        taskRepo.findMany(),
        timesheetRepo.findMany(),
      ]);

      setClients(clPage.data);
      setProjects(prPage.data);
      setAllocations(alPage.data);
      setTasks(tkPage.data);
      setTimesheets(tsPage.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  const createClient = useCallback(async (data: Partial<Client>): Promise<CallbackResult<Client>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createClient(data, { id: user.id, role: user.role });
    if (res.ok) {
      setClients((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const createProject = useCallback(async (data: Partial<Project>): Promise<CallbackResult<Project>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createProject(data, { id: user.id, role: user.role });
    if (res.ok) {
      setProjects((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const addMilestone = useCallback(async (projectId: UUID, title: string, dueDate: string): Promise<CallbackResult<Milestone>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.addMilestone(projectId, title, dueDate, { id: user.id, role: user.role });
    return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error.message };
  }, [service, user]);

  const allocateResource = useCallback(async (projectId: UUID, employeeId: UUID, role: string, capacity: number): Promise<CallbackResult<ResourceAllocation>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.allocateResource(projectId, employeeId, role, capacity, { id: user.id, role: user.role });
    if (res.ok) {
      setAllocations((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const createTask = useCallback(async (data: Partial<Task>): Promise<CallbackResult<Task>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createTask(data, { id: user.id, role: user.role });
    if (res.ok) {
      setTasks((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const logTimesheet = useCallback(async (data: Partial<TimesheetRecord>): Promise<CallbackResult<TimesheetRecord>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.logTimesheet(data, { id: user.id, role: user.role });
    if (res.ok) {
      setTimesheets((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const approveTimesheet = useCallback(async (timesheetId: UUID): Promise<CallbackResult<TimesheetRecord>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.approveTimesheet(timesheetId, { id: user.id, role: user.role });
    if (res.ok) {
      setTimesheets((prev) => prev.map((t) => t.id === timesheetId ? res.value : t));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    clients,
    projects,
    allocations,
    tasks,
    timesheets,
    loading,
    error,
    createClient,
    createProject,
    addMilestone,
    allocateResource,
    createTask,
    logTimesheet,
    approveTimesheet,
    refresh: fetchAll,
  };
}
export default useProject;
