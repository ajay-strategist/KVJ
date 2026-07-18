/**
 * KVJ Analytics — Permission engine (Prompt 5 RBAC, Prompt 11 "verify everywhere")
 * Layer: Shared/Permissions.
 *
 * The single authority for "can this user do X?". Used by:
 *   • the API layer (mandatory backend check — never trust the UI)
 *   • route guards (gate whole screens)
 *   • the `usePermissions` hook / <Can> component (gate buttons & actions)
 *
 * Same logic runs on client and server so the UI and API never disagree.
 */

import { ROLE_PERMISSIONS, type Action, type Permission, type Resource } from './permissions';
import type { RoleKey } from './roles';

export interface PrincipalLike {
  id: string;
  role: RoleKey;
  /** Optional per-user permission overrides (grants/denies) for Phase-2 custom roles. */
  grants?: Permission[];
  denies?: Permission[];
}

/** Core check: does the principal hold `resource:action`? */
export function can(principal: PrincipalLike | null | undefined, resource: Resource, action: Action): boolean {
  if (!principal) return false;
  const perm = `${resource}:${action}` as Permission;

  // explicit deny always wins
  if (principal.denies?.includes(perm)) return false;
  // explicit grant
  if (principal.grants?.includes(perm)) return true;

  const rolePerms = ROLE_PERMISSIONS[principal.role];
  if (rolePerms === '*') return true; // SUPER_ADMIN
  return rolePerms?.includes(perm) ?? false;
}

/** True if the principal holds ANY of the given permissions. */
export function canAny(principal: PrincipalLike | null | undefined, perms: Array<[Resource, Action]>): boolean {
  return perms.some(([r, a]) => can(principal, r, a));
}

/** True if the principal holds ALL of the given permissions. */
export function canAll(principal: PrincipalLike | null | undefined, perms: Array<[Resource, Action]>): boolean {
  return perms.every(([r, a]) => can(principal, r, a));
}

/** Assert a permission or throw (used at the API edge). Import AppError where thrown. */
export function assertCan(principal: PrincipalLike | null | undefined, resource: Resource, action: Action): void {
  if (!can(principal, resource, action)) {
    const who = principal ? `Role ${principal.role}` : 'Unauthenticated user';
    throw new Error(`${who} is not permitted to ${action} ${resource}.`);
  }
}

/** Flatten every permission a principal effectively holds (for debugging/UX). */
export function effectivePermissions(principal: PrincipalLike): Permission[] | '*' {
  const base = ROLE_PERMISSIONS[principal.role];
  if (base === '*') return '*';
  const set = new Set<Permission>(base ?? []);
  principal.grants?.forEach((p) => set.add(p));
  principal.denies?.forEach((p) => set.delete(p));
  return [...set];
}
