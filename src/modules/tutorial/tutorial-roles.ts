/**
 * FlowDesk — Role-Based Tutorial Authorization Engine
 *
 * Implements strict role-based visibility rules for FlowDesk Tutorials:
 * - Admin, CEO, and Manager: Full access to all tutorials, workflows, and administrative features.
 * - Supervisor: Access to Employee tutorials plus Supervisor-specific workflows (Approvals, Team Attendance, Batch oversight).
 * - Employee: Strictly limited to self-scoped operational tutorials (My Day, Status, Attendance, Leave, Tasks, Expense submission, Chat).
 *             Employees are strictly barred from viewing Admin, Management, or Approval tutorials.
 */

export type UserRoleFilter = 'ALL' | 'EMPLOYEE' | 'SUPERVISOR' | 'MANAGER' | 'ADMIN' | 'CEO';

/**
 * Normalizes an arbitrary role string into a canonical UserRoleFilter.
 */
export function normalizeUserRole(role?: string | null): UserRoleFilter {
  if (!role) return 'EMPLOYEE';
  const upper = String(role).toUpperCase().trim();
  if (upper === 'ADMIN' || upper === 'SUPER_ADMIN') return 'ADMIN';
  if (upper === 'CEO') return 'CEO';
  if (upper === 'MANAGER') return 'MANAGER';
  if (upper === 'SUPERVISOR') return 'SUPERVISOR';
  return 'EMPLOYEE';
}

/**
 * Returns the list of role views that the current user is authorized to preview.
 * An Employee can ONLY see their own role.
 * A Supervisor can preview Supervisor and Employee.
 * An Admin / CEO / Manager can preview any role.
 */
export function getAllowedRoleFilters(currentUserRole?: string | null): UserRoleFilter[] {
  const norm = normalizeUserRole(currentUserRole);
  if (norm === 'ADMIN' || norm === 'CEO' || norm === 'MANAGER') {
    return ['ALL', 'EMPLOYEE', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'CEO'];
  }
  if (norm === 'SUPERVISOR') {
    return ['ALL', 'SUPERVISOR', 'EMPLOYEE'];
  }
  return ['ALL', 'EMPLOYEE'];
}

/**
 * Checks whether a given tutorial module is authorized for the given user role.
 * Accepts either an array of role strings or a module object with `rolesAllowed`.
 */
export function isModuleAllowedForUser(
  moduleOrRoles: (UserRoleFilter | string)[] | { rolesAllowed?: (UserRoleFilter | string)[] },
  currentUserRole?: string | null
): boolean {
  const norm = normalizeUserRole(currentUserRole);

  // Full control executive roles have visibility across all modules
  if (norm === 'ADMIN' || norm === 'CEO' || norm === 'MANAGER') {
    return true;
  }

  const rolesAllowed = Array.isArray(moduleOrRoles)
    ? moduleOrRoles
    : (moduleOrRoles?.rolesAllowed || []);

  const rolesUpper = rolesAllowed.map((r) => String(r).toUpperCase().trim());

  // Supervisor can access ALL, EMPLOYEE, or SUPERVISOR items
  if (norm === 'SUPERVISOR') {
    return (
      rolesUpper.includes('ALL') ||
      rolesUpper.includes('EMPLOYEE') ||
      rolesUpper.includes('SUPERVISOR')
    );
  }

  // Employee can ONLY access ALL or EMPLOYEE items
  return rolesUpper.includes('ALL') || rolesUpper.includes('EMPLOYEE');
}

/**
 * Checks whether a specific workflow within a module is authorized for the given user role.
 * Accepts either whoCanUse string array or a workflow object.
 */
export function isWorkflowAllowedForUser(
  workflowOrWhoCanUse: string[] | { whoCanUse?: string[]; rolesAllowed?: (UserRoleFilter | string)[] },
  currentUserRole?: string | null
): boolean {
  const norm = normalizeUserRole(currentUserRole);

  if (norm === 'ADMIN' || norm === 'CEO' || norm === 'MANAGER') {
    return true;
  }

  let whoList: string[] = [];
  if (Array.isArray(workflowOrWhoCanUse)) {
    whoList = workflowOrWhoCanUse;
  } else if (workflowOrWhoCanUse?.whoCanUse) {
    whoList = workflowOrWhoCanUse.whoCanUse;
  } else if (workflowOrWhoCanUse?.rolesAllowed) {
    whoList = workflowOrWhoCanUse.rolesAllowed.map(String);
  }

  const str = whoList.join(' ').toLowerCase();

  if (norm === 'SUPERVISOR') {
    return (
      str.includes('all') ||
      str.includes('employee') ||
      str.includes('trainer') ||
      str.includes('supervisor')
    );
  }

  // Employee: cannot access supervisor or admin-exclusive workflows
  if (
    str.includes('supervisor only') ||
    str.includes('admin only') ||
    str.includes('manager only') ||
    (whoList.every((r) => ['SUPERVISOR', 'ADMIN', 'CEO', 'MANAGER'].includes(String(r).toUpperCase())) && whoList.length > 0)
  ) {
    return false;
  }

  return str.includes('all') || str.includes('employee') || str.includes('trainer') || str === '';
}
