/**
 * KVJ Analytics — Permission model v2 (Phase 2 Enterprise Upgrade)
 * Layer: Shared/Permissions. Permissions are DATA (resource + action) and are
 * NOT hardcoded into screens. Every screen/API validates against this matrix.
 *
 * A permission is `${Resource}:${Action}`. The role→permission matrix is a
 * data-driven default; custom roles + permission changes need no code change.
 */

import type { RoleKey } from './roles';

/** Actions expanded to cover upload, download, email, and lock operations. */
export type Action =
  | 'view' | 'create' | 'update' | 'delete'
  | 'approve' | 'reject' | 'export' | 'import' | 'assign' | 'manage' | 'configure'
  | 'upload' | 'download' | 'email' | 'lock';

/** Resources — business modules + platform areas (Phase 2 additions marked). */
export type Resource =
  | 'employee' | 'attendance' | 'workSession' | 'leave' | 'calendar'
  | 'training' | 'student' | 'assessment' | 'voucher' | 'certificate' | 'alumni'
  | 'project' | 'task' | 'taskApproval'              // taskApproval: Phase 2
  | 'expense' | 'travel' | 'payroll' | 'asset' | 'procurement' | 'vendor' | 'budget'
  | 'chat' | 'announcement' | 'notification' | 'email' | 'template'
  | 'report' | 'dashboard' | 'kpi' | 'analytics'
  | 'registration'                                    // Phase 2: Registration DB
  | 'finalExam'                                       // Phase 2: Final Exam workflow
  | 'settings' | 'role' | 'auditLog' | 'health';

export type Permission = `${Resource}:${Action}`;

/** Helper: specific actions for a resource. */
function some(resource: Resource, actions: Action[]): Permission[] {
  return actions.map((a) => `${resource}:${a}` as Permission);
}

/**
 * Role → permission matrix (6-role model).
 *
 * ADMIN, CEO and MANAGER hold the wildcard '*' — full control + full visibility.
 * COORDINATOR: can manage their own assigned batches, students, attendance, reports.
 * TRAINER: can view training content, log sessions, manage their batches.
 * EMPLOYEE: self-scoped (own attendance, tasks, expenses, leaves).
 *
 * Row-level "own record only" scoping is enforced in the data layer
 * (services/repositories, and Supabase RLS once connected) — this matrix
 * controls module-level access.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[] | '*'> = {
  ADMIN:   '*',
  CEO:     '*',
  MANAGER: '*',

  COORDINATOR: [
    ...some('dashboard', ['view']),
    ...some('training', ['view', 'update']),
    ...some('student', ['view', 'create', 'update', 'import']),
    ...some('attendance', ['view', 'create', 'update']),
    ...some('assessment', ['view', 'create', 'update']),
    ...some('voucher', ['view']),
    ...some('certificate', ['view', 'update']),
    ...some('report', ['view', 'export', 'email']),
    ...some('registration', ['view', 'create']),
    ...some('finalExam', ['view']),
    ...some('calendar', ['view']),
    ...some('chat', ['view', 'create']),
    ...some('notification', ['view']),
    ...some('announcement', ['view']),
  ],

  TRAINER: [
    ...some('dashboard', ['view']),
    ...some('training', ['view']),
    ...some('student', ['view']),
    ...some('attendance', ['view', 'create', 'update']),
    ...some('assessment', ['view', 'create', 'update']),
    ...some('report', ['view']),
    ...some('finalExam', ['view', 'update']),
    ...some('calendar', ['view']),
    ...some('leave', ['view', 'create']),
    ...some('task', ['view', 'update']),
    ...some('chat', ['view', 'create']),
    ...some('notification', ['view']),
    ...some('announcement', ['view']),
  ],

  EMPLOYEE: [
    ...some('dashboard', ['view']),
    ...some('attendance', ['view', 'create', 'update']),
    ...some('workSession', ['view', 'create', 'update']),
    ...some('leave', ['view', 'create']),
    ...some('task', ['view', 'create', 'update']),
    ...some('taskApproval', ['view']),                 // can see their pending tasks
    ...some('expense', ['view', 'create', 'upload']),
    ...some('travel', ['view', 'create']),
    ...some('calendar', ['view']),
    ...some('training', ['view']),
    ...some('chat', ['view', 'create']),
    ...some('report', ['view']),
    ...some('announcement', ['view']),
    ...some('notification', ['view']),
  ],
};
