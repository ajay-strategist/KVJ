/**
 * KVJ Analytics — Permission model (Prompt 5 authorization, Prompt 11 mandatory backend checks)
 * Layer: Shared/Permissions. Permissions are DATA (resource + action) and are
 * NOT hardcoded into screens. Every screen/API validates against this matrix.
 *
 * A permission is `${Resource}:${Action}`. The role→permission matrix below is a
 * safe Phase-1 default; in Phase 2 it becomes editable (role management) so custom
 * roles and permission changes need no code change.
 */

import type { RoleKey } from './roles';

/** The 10 standard actions from Prompt 5. */
export type Action =
  | 'view' | 'create' | 'update' | 'delete'
  | 'approve' | 'export' | 'import' | 'assign' | 'manage' | 'configure';

/** Resources = business modules + platform areas. */
export type Resource =
  | 'employee' | 'attendance' | 'workSession' | 'leave' | 'calendar'
  | 'training' | 'student' | 'assessment' | 'voucher' | 'certificate' | 'alumni'
  | 'project' | 'task'
  | 'expense' | 'travel' | 'payroll' | 'asset' | 'procurement' | 'vendor' | 'budget'
  | 'chat' | 'announcement' | 'notification' | 'email' | 'template'
  | 'report' | 'dashboard' | 'kpi' | 'analytics'
  | 'settings' | 'role' | 'auditLog' | 'health';

export type Permission = `${Resource}:${Action}`;

const ALL: Action[] = ['view', 'create', 'update', 'delete', 'approve', 'export', 'import', 'assign', 'manage', 'configure'];

/** Helper: expand `resource:*` to all actions. */
function all(resource: Resource): Permission[] {
  return ALL.map((a) => `${resource}:${a}` as Permission);
}
/** Helper: specific actions for a resource. */
function some(resource: Resource, actions: Action[]): Permission[] {
  return actions.map((a) => `${resource}:${a}` as Permission);
}

/**
 * Role → permission matrix (Phase-1 default).
 * SUPER_ADMIN is granted the wildcard and short-circuits in the engine.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[] | '*'> = {
  SUPER_ADMIN: '*',

  CEO: [
    ...some('dashboard', ['view', 'manage', 'configure']),
    ...some('analytics', ['view', 'export']), ...some('kpi', ['view', 'configure']),
    ...some('report', ['view', 'export', 'create']),
    ...some('employee', ['view', 'export']), ...some('attendance', ['view', 'export']),
    ...some('training', ['view', 'export']), ...some('project', ['view', 'export']),
    ...some('expense', ['view', 'approve', 'export']), ...some('payroll', ['view', 'approve']),
    ...some('budget', ['view', 'approve', 'configure']),
    ...some('announcement', ['view', 'create']), ...some('auditLog', ['view']),
  ],

  OPERATIONS_MANAGER: [
    ...some('dashboard', ['view']), ...some('analytics', ['view', 'export']),
    ...all('training'), ...all('student'), ...all('assessment'),
    ...some('voucher', ['view', 'assign', 'manage']), ...some('certificate', ['view', 'create']),
    ...all('project'), ...all('task'),
    ...some('employee', ['view', 'export', 'assign']), ...some('attendance', ['view', 'update', 'export', 'approve']),
    ...some('leave', ['view', 'approve']), ...some('expense', ['view', 'approve', 'export']),
    ...all('report'), ...some('announcement', ['view', 'create', 'update']),
    ...some('calendar', ['view', 'manage']), ...some('auditLog', ['view']),
  ],

  HR: [
    ...all('employee'), ...some('attendance', ['view', 'update', 'export', 'approve']),
    ...all('leave'), ...some('calendar', ['view', 'manage']),
    ...some('payroll', ['view', 'create', 'update']),
    ...some('report', ['view', 'export']), ...some('dashboard', ['view']),
    ...some('announcement', ['view', 'create']), ...some('auditLog', ['view']),
  ],

  FINANCE: [
    ...all('expense'), ...all('travel'), ...all('payroll'),
    ...all('asset'), ...all('procurement'), ...all('vendor'), ...all('budget'),
    ...some('report', ['view', 'export']), ...some('dashboard', ['view']),
    ...some('analytics', ['view', 'export']), ...some('auditLog', ['view']),
  ],

  LEAD_TRAINER: [
    ...some('training', ['view', 'create', 'update', 'manage', 'assign']),
    ...all('student'), ...all('assessment'),
    ...some('voucher', ['view', 'assign']), ...some('certificate', ['view', 'create']),
    ...some('attendance', ['view', 'update']), ...some('report', ['view', 'export', 'create']),
    ...some('dashboard', ['view']), ...some('announcement', ['view', 'create']),
    ...some('chat', ['view', 'create']),
  ],

  PROJECT_SUPERVISOR: [
    ...some('project', ['view', 'create', 'update', 'manage', 'assign']),
    ...all('task'), ...some('workSession', ['view']),
    ...some('employee', ['view']), ...some('report', ['view', 'export', 'create']),
    ...some('dashboard', ['view']), ...some('expense', ['view', 'approve']),
    ...some('chat', ['view', 'create']), ...some('announcement', ['view', 'create']),
  ],

  TRAINER: [
    ...some('training', ['view']), ...some('student', ['view', 'update']),
    ...some('assessment', ['view', 'create', 'update']), ...some('attendance', ['view', 'update']),
    ...some('certificate', ['view']), ...some('report', ['view', 'create']),
    ...some('dashboard', ['view']), ...some('chat', ['view', 'create']),
    ...some('workSession', ['view', 'create', 'update']),
  ],

  ASSISTANT_TRAINER: [
    ...some('training', ['view']), ...some('student', ['view']),
    ...some('assessment', ['view', 'update']), ...some('attendance', ['view', 'update']),
    ...some('dashboard', ['view']), ...some('chat', ['view', 'create']),
    ...some('workSession', ['view', 'create', 'update']),
  ],

  MARKETING_EXECUTIVE: [
    ...some('dashboard', ['view']), ...some('project', ['view']),
    ...some('expense', ['view', 'create']), ...some('report', ['view']),
    ...some('chat', ['view', 'create']), ...some('announcement', ['view']),
    ...some('workSession', ['view', 'create', 'update']),
  ],

  EMPLOYEE: [
    ...some('dashboard', ['view']),
    ...some('attendance', ['view', 'create', 'update']), ...some('workSession', ['view', 'create', 'update']),
    ...some('leave', ['view', 'create']), ...some('task', ['view', 'update']),
    ...some('expense', ['view', 'create']), ...some('calendar', ['view']),
    ...some('chat', ['view', 'create']), ...some('report', ['view']),
    ...some('announcement', ['view']),
  ],

  INTERN: [
    ...some('dashboard', ['view']),
    ...some('attendance', ['view', 'create', 'update']), ...some('workSession', ['view', 'create', 'update']),
    ...some('leave', ['view', 'create']), ...some('task', ['view', 'update']),
    ...some('calendar', ['view']), ...some('chat', ['view', 'create']),
    ...some('announcement', ['view']),
  ],
};
