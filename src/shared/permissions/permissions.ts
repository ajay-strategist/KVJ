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

/** Helper: specific actions for a resource. */
function some(resource: Resource, actions: Action[]): Permission[] {
  return actions.map((a) => `${resource}:${a}` as Permission);
}

/**
 * Role → permission matrix (4-role model).
 *
 * ADMIN, CEO and MANAGER hold the wildcard '*' — full control + full visibility
 * across every module (the engine short-circuits on '*').
 *
 * EMPLOYEE is self-scoped ("user-level security"): it can view and manage its
 * OWN attendance, work sessions, leaves, tasks and expenses, but cannot approve,
 * manage, configure, or see other people's data. Row-level "own record only"
 * scoping is enforced in the data layer (services/repositories, and Supabase RLS
 * once connected) — this matrix controls module-level access.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[] | '*'> = {
  ADMIN: '*',
  CEO: '*',
  MANAGER: '*',

  EMPLOYEE: [
    ...some('dashboard', ['view']),
    ...some('attendance', ['view', 'create', 'update']), ...some('workSession', ['view', 'create', 'update']),
    ...some('leave', ['view', 'create']), ...some('task', ['view', 'update']),
    ...some('expense', ['view', 'create']), ...some('travel', ['view', 'create']),
    ...some('calendar', ['view']), ...some('training', ['view']),
    ...some('chat', ['view', 'create']), ...some('report', ['view']),
    ...some('announcement', ['view']), ...some('notification', ['view']),
  ],
};
