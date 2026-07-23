/**
 * KVJ Analytics — Auth context (Prompt 5, Prompt 6 permission components)
 * Layer: Application. Wraps IAuthService (mock in Phase 1) and exposes session
 * + a permission-checking principal to the whole app.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AUTH_SERVICE_TOKEN, type Credentials, type IAuthService, type Session } from './auth.service';
import { eventBus } from '../../core/event-bus';
import { container } from '../../core/registry';
import type { PrincipalLike } from '../../shared/permissions/permission-engine';

interface AuthContextValue {
  session: Session | null;
  user: Session['user'] | null;
  principal: PrincipalLike | null; // fed to the permission engine
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (creds: Credentials) => Promise<Session>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ sent: boolean }>;
  createUser: (input: import('./auth.service').NewUserInput) => Promise<import('./auth.service').AuthUser>;
  updateUser: (userId: string, data: Partial<import('./auth.service').NewUserInput & { password?: string }>) => Promise<import('./auth.service').AuthUser>;
  deleteUser: (userId: string) => Promise<{ ok: boolean }>;
  updateUserPassword: (userId: string, newPassword: string) => Promise<{ ok: boolean }>;
  resetToDefaultPassword: (userId: string) => Promise<{ ok: boolean }>;
  getUsers: () => Promise<import('./auth.service').AuthUser[]>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** The auth service is injected; defaults to the Phase-1 mock. Swap in Phase 2. */
export function AuthProvider({ children, service }: { children: ReactNode; service?: IAuthService }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  const authService = useMemo(() => service ?? container.resolve(AUTH_SERVICE_TOKEN), [service]);

  useEffect(() => {
    let active = true;
    authService
      .getSession()
      .then((s) => {
        if (!active) return;
        setSession(s);
        setStatus(s ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        // Never leave the app stuck on a blank loading state if session lookup fails.
        if (!active) return;
        setSession(null);
        setStatus('unauthenticated');
      });
    return () => { active = false; };
  }, [authService]);

  const login = useCallback(async (creds: Credentials) => {
    const s = await authService.login(creds);
    setSession(s);
    setStatus('authenticated');
    eventBus.emit('auth.login', { userId: s.user.id, role: s.user.role });
    return s;
  }, [authService]);

  const logout = useCallback(async () => {
    const id = session?.user.id;
    // Clear session state synchronously to prevent render of protected pages with stale auth state
    setSession(null);
    setStatus('unauthenticated');

    // Redirect immediately to login page
    navigate('/login', { replace: true });

    // Call backend/localStorage teardown asynchronously
    await authService.logout();
    if (id) eventBus.emit('auth.logout', { userId: id });
  }, [authService, session, navigate]);

  const principal = useMemo<PrincipalLike | null>(
    () => (session ? { id: session.user.id, role: session.user.role, grants: session.user.grants, denies: session.user.denies } : null),
    [session],
  );

  const createUser = useCallback(async (input: import('./auth.service').NewUserInput) => {
    return authService.createUser(input);
  }, [authService]);

  const updateUser = useCallback(async (userId: string, data: Partial<import('./auth.service').NewUserInput & { password?: string }>) => {
    return authService.updateUser(userId, data);
  }, [authService]);

  const deleteUser = useCallback(async (userId: string) => {
    return authService.deleteUser(userId);
  }, [authService]);

  const updateUserPassword = useCallback(async (userId: string, newPassword: string) => {
    const res = await authService.updateUserPassword(userId, newPassword);
    if (session && session.user.id === userId) {
      setSession((prev) => prev ? { ...prev, user: { ...prev.user, mustChangePassword: false } } : null);
    }
    return res;
  }, [authService, session]);

  const resetToDefaultPassword = useCallback(async (userId: string) => {
    return authService.resetToDefaultPassword(userId);
  }, [authService]);

  const getUsers = useCallback(async () => {
    return authService.getUsers();
  }, [authService]);

  const value = useMemo<AuthContextValue>(() => ({
    session, user: session?.user ?? null, principal, status, login, logout,
    requestPasswordReset: authService.requestPasswordReset.bind(authService),
    createUser, updateUser, deleteUser, updateUserPassword, resetToDefaultPassword, getUsers,
  }), [session, principal, status, login, logout, authService, createUser, updateUser, deleteUser, updateUserPassword, resetToDefaultPassword, getUsers]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
