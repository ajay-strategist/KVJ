/**
 * KVJ Analytics — Authorization UI helpers (Prompt 5/6, Prompt 11 "verify everywhere")
 * Layer: Shared. All consume the central RBAC engine (permission-engine.ts).
 *
 *   const { can } = usePermissions();
 *   <Can resource="expense" action="approve"> <ApproveButton/> </Can>
 *   <Authorize roles={['MANAGER','CEO']}> ... </Authorize>
 *   <ProtectedRoute resource="training" action="view"> <TrainingPage/> </ProtectedRoute>
 */

import { type ReactNode, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { can as engineCan, canAny, canAll } from './permission-engine';
import type { Action, Resource } from './permissions';
import type { RoleKey } from './roles';
import { useAuth } from '../../modules/auth/AuthProvider';

/** Centered loading indicator shown while the session resolves (never a blank screen). */
function AuthSplash() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-app)' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid var(--border)', borderTopColor: 'var(--brand)',
        animation: 'kvj-spin 0.8s linear infinite',
      }} />
      <style>{'@keyframes kvj-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

/** Hook: permission checks bound to the current principal. */
export function usePermissions() {
  const { principal } = useAuth();

  const can = useCallback(
    (resource: Resource, action: Action) => engineCan(principal, resource, action),
    [principal]
  );

  const canAnyCall = useCallback(
    (perms: Array<[Resource, Action]>) => canAny(principal, perms),
    [principal]
  );

  const canAllCall = useCallback(
    (perms: Array<[Resource, Action]>) => canAll(principal, perms),
    [principal]
  );

  const hasRole = useCallback(
    (roles: RoleKey[]) => !!principal && roles.includes(principal.role as RoleKey),
    [principal]
  );

  return useMemo(
    () => ({
      principal,
      can,
      canAny: canAnyCall,
      canAll: canAllCall,
      hasRole,
    }),
    [principal, can, canAnyCall, canAllCall, hasRole]
  );
}

/** Render children only if the current user holds resource:action. */
export function Can({ resource, action, fallback = null, children }: {
  resource: Resource; action: Action; fallback?: ReactNode; children: ReactNode;
}) {
  const { can } = usePermissions();
  return <>{can(resource, action) ? children : fallback}</>;
}

/** Render children only if the user has one of the given roles (or a permission). */
export function Authorize({ roles, resource, action, fallback = null, children }: {
  roles?: RoleKey[]; resource?: Resource; action?: Action; fallback?: ReactNode; children: ReactNode;
}) {
  const { hasRole, can } = usePermissions();
  const byRole = roles ? hasRole(roles) : true;
  const byPerm = resource && action ? can(resource, action) : true;
  return <>{byRole && byPerm ? children : fallback}</>;
}

/** Route guard: requires auth, and optionally a permission. Redirects otherwise. */
export function ProtectedRoute({ resource, action, redirectTo = '/login', children }: {
  resource?: Resource; action?: Action; redirectTo?: string; children: ReactNode;
}) {
  const { status } = useAuth();
  const { can } = usePermissions();
  if (status === 'loading') return <AuthSplash />; // never a blank screen while auth resolves
  if (status === 'unauthenticated') return <Navigate to={redirectTo} replace />;
  if (resource && action && !can(resource, action)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}
