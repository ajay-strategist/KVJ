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
import { isFullControl } from '../../../shared/permissions/roles';

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
        clientRepo.findMany({ pageSize: 1000 }),
        projectRepo.findMany({ pageSize: 1000 }),
        allocationRepo.findMany({ pageSize: 1000 }),
        taskRepo.findMany({ pageSize: 1000 }),
        timesheetRepo.findMany({ pageSize: 1000 }),
      ]);

      let allClients = Array.isArray(clPage?.data) ? clPage.data : [];
      let allProjects = Array.isArray(prPage?.data) ? prPage.data : [];
      let allAllocations = Array.isArray(alPage?.data) ? alPage.data : [];
      let allTasks = Array.isArray(tkPage?.data) ? tkPage.data : [];
      let allTimesheets = Array.isArray(tsPage?.data) ? tsPage.data : [];

      if (user && !isFullControl(user.role as any)) {
        const supervisedProjectIds = new Set(allProjects.filter(p => (p as any).supervisorId === user.id).map(p => p.id));
        const userAllocations = allAllocations.filter(a => a.employeeId === user.id);
        const allocatedProjectIds = new Set(userAllocations.map(a => a.projectId));
        
        const userAssociatedProjectIds = new Set<string>([
          ...Array.from(allocatedProjectIds),
          ...Array.from(supervisedProjectIds),
        ]);
        
        allTasks.forEach(t => {
          if (t.projectId && (t.assigneeId === user.id || t.assigneeId === user.email || t.supervisorId === user.id)) {
            userAssociatedProjectIds.add(t.projectId);
          }
        });

        allTasks = allTasks.filter(t => 
          t.assigneeId === user.id || 
          t.assigneeId === user.email ||
          t.supervisorId === user.id ||
          (t as any).assignedByEmployeeId === user.id ||
          (t as any).supervisorName === user.fullName ||
          (t.projectId && userAssociatedProjectIds.has(t.projectId))
        );
        allTimesheets = allTimesheets.filter(t => t.employeeId === user.id || (t.projectId && userAssociatedProjectIds.has(t.projectId)));
      }

      setClients(allClients);
      setProjects(allProjects);
      setAllocations(allAllocations);
      setTasks(allTasks);
      setTimesheets(allTimesheets);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [user]);

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

  const updateProject = useCallback(async (projectId: UUID, data: Partial<Project>): Promise<CallbackResult<Project>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateProject(projectId, data, { id: user.id, role: user.role });
    if (res.ok) {
      setProjects((prev) => prev.map((p) => (p.id === projectId ? res.value : p)));
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

  const updateTask = useCallback(async (taskId: UUID, data: Partial<Task>): Promise<CallbackResult<Task>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateTask(taskId, data, { id: user.id, role: user.role });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? res.value : t)));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const deleteTask = useCallback(async (taskId: UUID): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.deleteTask(taskId, { id: user.id, role: user.role });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      return { ok: true, value: undefined };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const deleteProject = useCallback(async (projectId: UUID): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    // Soft-delete via the service: the project and its tasks are hidden but kept
    // in the database (recoverable). No hard delete — no data is destroyed.
    const res = await service.deleteProject(projectId, { id: user.id, role: user.role });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setAllocations((prev) => prev.filter((a) => a.projectId !== projectId));
      setTasks((prev) => prev.filter((t) => t.projectId !== projectId));
      setTimesheets((prev) => prev.filter((ts) => ts.projectId !== projectId));
      return { ok: true, value: undefined };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const submitTask = useCallback(async (taskId: UUID, notes: string): Promise<CallbackResult<Task>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.submitTask(taskId, notes, { id: user.id, role: user.role });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? res.value : t));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const requestRework = useCallback(async (taskId: UUID, notes: string): Promise<CallbackResult<Task>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.requestRework(taskId, notes, { id: user.id, role: user.role });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? res.value : t));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const approveTaskSubmission = useCallback(async (taskId: UUID): Promise<CallbackResult<Task>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.approveTaskSubmission(taskId, { id: user.id, role: user.role });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? res.value : t));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const requestTaskAssignment = useCallback(async (taskId: UUID, assigneeId: UUID, assignedByEmployeeId: UUID): Promise<CallbackResult<Task>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.requestTaskAssignment(taskId, assigneeId, assignedByEmployeeId, { id: user.id, role: user.role });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? res.value : t));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const approveTaskAssignment = useCallback(async (taskId: UUID): Promise<CallbackResult<Task>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.approveTaskAssignment(taskId, { id: user.id, role: user.role });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? res.value : t));
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
    updateProject,
    addMilestone,
    allocateResource,
    createTask,
    updateTask,
    deleteTask,
    deleteProject,
    submitTask,
    requestRework,
    approveTaskSubmission,
    requestTaskAssignment,
    approveTaskAssignment,
    logTimesheet,
    approveTimesheet,
    refresh: fetchAll,
  };
}
export default useProject;
