/**
 * KVJ Analytics — Authentication service (Prompt 5 auth, Prompt 4 mock-first)
 * Layer: Service (business) + a Phase-1 Mock implementation.
 *
 * IAuthService is the stable contract. MockAuthService backs Phase 1 (dummy
 * users, no real DB). A SupabaseAuthService will implement the same interface
 * in Phase 2 — UI and guards never change. Account lock + reset use the
 * configurable thresholds in business-rules.ts (no hardcoded policy).
 */

import type { RoleKey } from '../../shared/permissions/roles';
import type { Permission } from '../../shared/permissions/permissions';
import { AppError } from '../../core/result';
import { businessRules } from '../../config/business-rules';
import { createToken } from '../../core/registry';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: RoleKey;
  avatarUrl?: string;
  grants?: Permission[];
  denies?: Permission[];
}

export interface Session {
  user: AuthUser;
  token: string;
  issuedAt: number;
  expiresAt: number;
  rememberMe: boolean;
}

export interface Credentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface IAuthService {
  login(creds: Credentials): Promise<Session>;
  logout(): Promise<void>;
  getSession(): Promise<Session | null>;
  refresh(): Promise<Session | null>;
  requestPasswordReset(email: string): Promise<{ sent: boolean }>;
  resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }>;
}

export const AUTH_SERVICE_TOKEN = createToken<IAuthService>('AuthService');

// ── Phase-1 mock users (dummy data; NOT real credentials) ────────────────────
interface MockRecord extends AuthUser { password: string }
const MOCK_USERS: MockRecord[] = [
  { id: 'u-admin', fullName: 'System Admin', email: 'admin@kvj.test', role: 'ADMIN', password: 'demo1234' },
  { id: 'u-ceo', fullName: 'Priya Nair', email: 'ceo@kvj.test', role: 'CEO', password: 'demo1234' },
  { id: 'u-mgr', fullName: 'Rahul Menon', email: 'manager@kvj.test', role: 'MANAGER', password: 'demo1234' },
  { id: 'u-emp', fullName: 'Sara Pillai', email: 'employee@kvj.test', role: 'EMPLOYEE', password: 'demo1234' },
];

const SESSION_KEY = 'kvj.session';
const now = () => Date.now();
const makeToken = (id: string) => `mock.${id}.${now().toString(36)}`;

export class MockAuthService implements IAuthService {
  private failedAttempts = new Map<string, { count: number; lockedUntil?: number }>();

  async login({ email, password, rememberMe }: Credentials): Promise<Session> {
    const key = email.toLowerCase();
    const lock = this.failedAttempts.get(key);
    if (lock?.lockedUntil && lock.lockedUntil > now()) {
      const mins = Math.ceil((lock.lockedUntil - now()) / 60000);
      throw AppError.forbidden(`Account locked. Try again in ${mins} minute(s).`);
    }

    const rec = MOCK_USERS.find((u) => u.email.toLowerCase() === key);
    if (!rec || rec.password !== password) {
      this.recordFailure(key);
      throw new AppError({ code: 'UNAUTHENTICATED' as never, message: 'Invalid email or password.', severity: 'warning' });
    }

    this.failedAttempts.delete(key);
    const remember = !!rememberMe;
    const ttlMs = (remember ? businessRules.auth.rememberMeDays * 24 * 60 : businessRules.auth.sessionTimeoutMinutes) * 60 * 1000;
    const { password: _pw, ...user } = rec;
    const session: Session = { user, token: makeToken(rec.id), issuedAt: now(), expiresAt: now() + ttlMs, rememberMe: remember };
    this.persist(session);
    return session;
  }

  async logout(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  async getSession(): Promise<Session | null> {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as Session;
      if (s.expiresAt <= now()) { await this.logout(); return null; } // inactive/expired session detection
      return s;
    } catch { return null; }
  }

  async refresh(): Promise<Session | null> {
    const s = await this.getSession();
    if (!s) return null;
    const ttlMs = (s.rememberMe ? businessRules.auth.rememberMeDays * 24 * 60 : businessRules.auth.sessionTimeoutMinutes) * 60 * 1000;
    const refreshed = { ...s, issuedAt: now(), expiresAt: now() + ttlMs };
    this.persist(refreshed);
    return refreshed;
  }

  async requestPasswordReset(email: string): Promise<{ sent: boolean }> {
    // Mock: always report sent (avoids user enumeration), no email actually dispatched.
    void email;
    return { sent: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
    if (!token || newPassword.length < businessRules.auth.passwordPolicy.minLength) {
      throw AppError.validation('Password does not meet the policy requirements.');
    }
    return { ok: true };
  }

  private recordFailure(key: string) {
    const entry = this.failedAttempts.get(key) ?? { count: 0 };
    entry.count += 1;
    if (entry.count >= businessRules.auth.maxFailedLoginAttempts) {
      entry.lockedUntil = now() + businessRules.auth.accountLockMinutes * 60 * 1000;
      entry.count = 0;
    }
    this.failedAttempts.set(key, entry);
  }

  private persist(session: Session) {
    const store = session.rememberMe ? localStorage : sessionStorage;
    store.setItem(SESSION_KEY, JSON.stringify(session));
  }
}
