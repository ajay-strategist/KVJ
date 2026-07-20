/**
 * KVJ Analytics — Roles (4-role model)
 * Layer: Shared/Permissions. Roles are DATA, not code branches.
 *
 * Four roles, per the confirmed model:
 *   - ADMIN, CEO, MANAGER  → full control + full visibility everywhere.
 *   - EMPLOYEE             → self-scoped ("user-level security"): own attendance,
 *                            tasks, expenses, leaves, unless a module says otherwise.
 *
 * `level` is a coarse hierarchy used for scoping/escalation ordering only; it is
 * NOT a substitute for explicit permissions (see permissions.ts).
 */

export type RoleKey =
  | 'ADMIN'
  | 'CEO'
  | 'MANAGER'
  | 'EMPLOYEE';

export interface RoleDef {
  key: RoleKey;
  name: string;
  level: number; // higher = broader authority (for scoping/escalation only)
  isSystem: boolean; // system roles cannot be deleted
  workspace: 'employee' | 'supervisor' | 'manager' | 'ceo'; // default landing workspace
  /** Full control + full visibility across every module. */
  fullControl: boolean;
  description: string;
}

export const ROLES: Record<RoleKey, RoleDef> = {
  ADMIN:    { key: 'ADMIN',    name: 'Admin',    level: 100, isSystem: true, workspace: 'ceo',      fullControl: true,  description: 'Full control and full visibility across the whole system.' },
  CEO:      { key: 'CEO',      name: 'CEO',      level: 90,  isSystem: true, workspace: 'ceo',      fullControl: true,  description: 'Full control and full visibility across the whole system.' },
  MANAGER:  { key: 'MANAGER',  name: 'Manager',  level: 80,  isSystem: true, workspace: 'manager',  fullControl: true,  description: 'Full control and full visibility across the whole system.' },
  EMPLOYEE: { key: 'EMPLOYEE', name: 'Employee', level: 30,  isSystem: true, workspace: 'employee', fullControl: false, description: 'Self-scoped access: own attendance, tasks, expenses and leaves.' },
};

export const ALL_ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

/** The roles with full control + full visibility (Admin, CEO, Manager). */
export const FULL_CONTROL_ROLES: RoleKey[] = ALL_ROLE_KEYS.filter((k) => ROLES[k].fullControl);

/** True when the role has full control + full visibility everywhere. */
export function isFullControl(role: RoleKey): boolean {
  return ROLES[role]?.fullControl === true;
}
