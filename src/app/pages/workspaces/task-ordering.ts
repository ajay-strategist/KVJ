export type UserIdentity = {
  id?: string;
  fullName?: string;
};

export interface OrderableTask {
  id: string;
  title?: string;
  createdAt?: string;
  assigneeId?: string;
  assignee?: string;
  supervisor?: string;
  supervisorId?: string;
}

/**
 * Checks whether a task is assigned to the specified user.
 * If assigneeId or assignee name does not match the user, the task is considered
 * a supervisor-view task (i.e. not assigned to the current user).
 */
export const isTaskAssignedToUser = (
  task: { assigneeId?: string; assignee?: string },
  user?: UserIdentity | null
): boolean => {
  if (!user?.id) return true;

  if (task.assigneeId) {
    return task.assigneeId === user.id;
  }

  if (typeof task.assignee === 'string' && task.assignee.trim() && user.fullName) {
    return task.assignee.trim().toLowerCase() === user.fullName.trim().toLowerCase();
  }

  // If neither assigneeId nor assignee is provided, default to user's task
  return !task.assigneeId && !task.assignee;
};

export const getTaskOrderStorageKey = (userId?: string): string => {
  return userId ? `flwdsk_task_order_${userId}` : 'flwdsk_task_order_guest';
};

export const getStoredTaskOrder = (userId?: string): string[] => {
  try {
    const key = getTaskOrderStorageKey(userId);
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    // Legacy fallback
    const legacy = localStorage.getItem('kvj_task_order_v1');
    return legacy ? JSON.parse(legacy) : [];
  } catch {
    return [];
  }
};

export const saveStoredTaskOrder = (order: string[], userId?: string) => {
  try {
    const key = getTaskOrderStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(order));
  } catch (e) {
    void e;
  }
};

export const clearStoredTaskOrder = (userId?: string) => {
  try {
    const key = getTaskOrderStorageKey(userId);
    localStorage.removeItem(key);
    localStorage.removeItem('kvj_task_order_v1');
  } catch (e) {
    void e;
  }
};

/**
 * Sorts tasks according to the following rules:
 * 1. If both tasks have been manually positioned via drag & drop (exist in savedOrder),
 *    preserve their user-defined manual order (idxA - idxB).
 * 2. When a new task is added:
 *    - If it is user's own task, place it at the TOP (before saved tasks).
 *    - If it is a supervisor task, place it at the BOTTOM (after saved tasks).
 * 3. When tasks are not in savedOrder (or order is reset):
 *    - User's own tasks go to the top, sorted newest first.
 *    - Supervisor tasks go to the bottom, sorted newest first.
 */
export function sortTasksWithSupervisorTier<T extends { id: string; createdAt?: string; assigneeId?: string; assignee?: string }>(
  tasks: T[],
  savedOrder: string[],
  user?: UserIdentity | null
): T[] {
  return [...tasks].sort((a, b) => {
    const idxA = savedOrder.indexOf(a.id);
    const idxB = savedOrder.indexOf(b.id);
    const inSavedA = idxA !== -1;
    const inSavedB = idxB !== -1;

    // 1. Both tasks are in user's saved manual order
    if (inSavedA && inSavedB) {
      return idxA - idxB;
    }

    const isOwnA = isTaskAssignedToUser(a, user);
    const isOwnB = isTaskAssignedToUser(b, user);

    // 2. One task is new (not in savedOrder) and one is saved:
    if (!inSavedA && inSavedB) {
      // If task A is own task -> moves to top (before saved tasks)
      // If task A is supervisor task -> moves to bottom (after saved tasks)
      return isOwnA ? -1 : 1;
    }
    if (inSavedA && !inSavedB) {
      // Mirror of above
      return isOwnB ? 1 : -1;
    }

    // 3. Neither task is in savedOrder (e.g. newly added tasks or after order reset):
    // Priority 1: User's own tasks at top, Supervisor tasks at bottom
    if (isOwnA !== isOwnB) {
      return isOwnA ? -1 : 1;
    }

    // Priority 2: Within the same tier, newest created first
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;

    return a.id.localeCompare(b.id);
  });
}
