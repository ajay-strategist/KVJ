/**
 * KVJ Analytics — Roles (Expanded Model with Coordinator & Trainer)
 * Layer: Shared/Permissions. Roles are DATA, not code branches.
 *
 * Roles:
 *   - ADMIN, CEO, MANAGER  → full control + full visibility everywhere.
 *   - COORDINATOR          → batch coordination & student management scope.
 *   - TRAINER              → session logging & evaluation scope.
 *   - EMPLOYEE             → self-scoped ("user-level security").
 */

export type RoleKey =
  | 'ADMIN'
  | 'CEO'
  | 'MANAGER'
  | 'COORDINATOR'
  | 'TRAINER'
  | 'EMPLOYEE';

export interface RoleDef {
  key: RoleKey;
  name: string;
  level: number;
  isSystem: boolean;
  workspace: 'employee' | 'supervisor' | 'manager' | 'ceo';
  fullControl: boolean;
  description: string;
}

export const ROLES: Record<RoleKey, RoleDef> = {
  ADMIN:       { key: 'ADMIN',       name: 'Admin',       level: 100, isSystem: true, workspace: 'ceo',      fullControl: true,  description: 'Full control and full visibility across the whole system.' },
  CEO:         { key: 'CEO',         name: 'CEO',         level: 90,  isSystem: true, workspace: 'ceo',      fullControl: true,  description: 'Full control and full visibility across the whole system.' },
  MANAGER:     { key: 'MANAGER',     name: 'Manager',     level: 80,  isSystem: true, workspace: 'manager',  fullControl: true,  description: 'Full control and full visibility across the whole system.' },
  COORDINATOR: { key: 'COORDINATOR', name: 'Coordinator', level: 50,  isSystem: true, workspace: 'supervisor',fullControl: false, description: 'Batch coordination, student enrollment & report management.' },
  TRAINER:     { key: 'TRAINER',     name: 'Trainer',     level: 40,  isSystem: true, workspace: 'supervisor',fullControl: false, description: 'Academic training sessions, student evaluations & attendance.' },
  EMPLOYEE:    { key: 'EMPLOYEE',    name: 'Employee',    level: 30,  isSystem: true, workspace: 'employee', fullControl: false, description: 'Self-scoped access: own attendance, tasks, expenses and leaves.' },
};

export const ALL_ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

export const FULL_CONTROL_ROLES: RoleKey[] = ALL_ROLE_KEYS.filter((k) => ROLES[k].fullControl);

export function isFullControl(role: RoleKey): boolean {
  return ROLES[role]?.fullControl === true;
}
