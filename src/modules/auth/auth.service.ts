/**
 * KVJ Analytics — Authentication service
 * Layer: Service (business) + Auth implementation.
 *
 * Supports Admin login (Username: Admin, Password: AjayThomas), Admin user creation
 * (default password: "password", mustChangePassword: true), and first-time forced password reset.
 */

import type { RoleKey } from '../../shared/permissions/roles';
import type { Permission } from '../../shared/permissions/permissions';
import { AppError } from '../../core/result';
import { businessRules } from '../../config/business-rules';
import { createToken } from '../../core/registry';

export interface AuthUser {
  id: string;
  username?: string;
  fullName: string;
  email: string;
  role: RoleKey;
  avatarUrl?: string;
  mustChangePassword?: boolean;
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
  email: string; // accepts email or username
  password: string;
  rememberMe?: boolean;
}

export interface NewUserInput {
  username: string;
  fullName: string;
  email: string;
  role: RoleKey;
}

export interface IAuthService {
  login(creds: Credentials): Promise<Session>;
  logout(): Promise<void>;
  getSession(): Promise<Session | null>;
  refresh(): Promise<Session | null>;
  requestPasswordReset(email: string): Promise<{ sent: boolean }>;
  resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }>;
  createUser(input: NewUserInput): Promise<AuthUser>;
  updateUser(userId: string, data: Partial<NewUserInput & { password?: string }>): Promise<AuthUser>;
  deleteUser(userId: string): Promise<{ ok: boolean }>;
  updateUserPassword(userId: string, newPassword: string): Promise<{ ok: boolean }>;
  resetToDefaultPassword(userId: string): Promise<{ ok: boolean }>;
  getUsers(): Promise<AuthUser[]>;
}

export const AUTH_SERVICE_TOKEN = createToken<IAuthService>('AuthService');

interface MockRecord extends AuthUser { password: string }

const DEFAULT_USERS: MockRecord[] = [
  {
    id: 'u-admin',
    username: 'Admin',
    fullName: 'System Admin',
    email: 'admin@kvjanalytics.com',
    role: 'ADMIN',
    password: 'AjayThomas',
    mustChangePassword: false,
  },
];

const USERS_STORAGE_KEY = 'kvj.users.db';
const SESSION_KEY = 'kvj.session';
const now = () => Date.now();
const makeToken = (id: string) => `mock.${id}.${now().toString(36)}`;

function loadStoredUsers(): MockRecord[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_USERS;
  }
}

function saveStoredUsers(users: MockRecord[]) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

export class MockAuthService implements IAuthService {
  private failedAttempts = new Map<string, { count: number; lockedUntil?: number }>();

  private getUsersList(): MockRecord[] {
    return loadStoredUsers();
  }

  async getUsers(): Promise<AuthUser[]> {
    const records = this.getUsersList();
    return records.map(({ password: _, ...user }) => user);
  }

  async login({ email: identifier, password, rememberMe }: Credentials): Promise<Session> {
    const key = identifier.trim().toLowerCase();
    const lock = this.failedAttempts.get(key);
    if (lock?.lockedUntil && lock.lockedUntil > now()) {
      const mins = Math.ceil((lock.lockedUntil - now()) / 60000);
      throw AppError.forbidden(`Account locked. Try again in ${mins} minute(s).`);
    }

    const users = this.getUsersList();
    const rec = users.find(
      (u) => u.email.toLowerCase() === key || u.username?.toLowerCase() === key,
    );

    if (!rec || rec.password !== password) {
      this.recordFailure(key);
      throw new AppError({
        code: 'UNAUTHENTICATED' as never,
        message: 'Invalid username/email or password.',
        severity: 'warning',
      });
    }

    this.failedAttempts.delete(key);
    const remember = !!rememberMe;
    const ttlMs = (remember ? businessRules.auth.rememberMeDays * 24 * 60 : businessRules.auth.sessionTimeoutMinutes) * 60 * 1000;
    const { password: _pw, ...user } = rec;
    const session: Session = { user, token: makeToken(rec.id), issuedAt: now(), expiresAt: now() + ttlMs, rememberMe: remember };
    this.persist(session);
    return session;
  }

  async createUser(input: NewUserInput): Promise<AuthUser> {
    const users = this.getUsersList();
    const existing = users.find(
      (u) => u.username?.toLowerCase() === input.username.toLowerCase() || u.email.toLowerCase() === input.email.toLowerCase(),
    );

    if (existing) {
      throw new AppError({
        code: 'VALIDATION_FAILED' as never,
        message: `User with username "${input.username}" or email "${input.email}" already exists.`,
        severity: 'warning',
      });
    }

    const newUser: MockRecord = {
      id: `u-${Date.now()}`,
      username: input.username,
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      password: 'password', // Default password for new users
      mustChangePassword: true,
    };

    const updated = [...users, newUser];
    saveStoredUsers(updated);

    const { password: _, ...result } = newUser;
    return result;
  }

  async updateUser(userId: string, data: Partial<NewUserInput & { password?: string }>): Promise<AuthUser> {
    const users = this.getUsersList();
    let updatedRecord: MockRecord | undefined;

    const updated = users.map((u) => {
      if (u.id === userId) {
        updatedRecord = {
          ...u,
          ...(data.username ? { username: data.username } : {}),
          ...(data.fullName ? { fullName: data.fullName } : {}),
          ...(data.email ? { email: data.email } : {}),
          ...(data.role ? { role: data.role } : {}),
          ...(data.password ? { password: data.password, mustChangePassword: false } : {}),
        };
        return updatedRecord;
      }
      return u;
    });

    if (!updatedRecord) {
      throw new AppError({ code: 'NOT_FOUND' as never, message: 'User not found', severity: 'warning' });
    }

    saveStoredUsers(updated);
    const { password: _, ...res } = updatedRecord;
    return res;
  }

  async deleteUser(userId: string): Promise<{ ok: boolean }> {
    const users = this.getUsersList();
    const filtered = users.filter((u) => u.id !== userId);
    saveStoredUsers(filtered);
    return { ok: true };
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<{ ok: boolean }> {
    const users = this.getUsersList();
    let found = false;

    const updated = users.map((u) => {
      if (u.id === userId) {
        found = true;
        return {
          ...u,
          password: newPassword,
          mustChangePassword: false,
        };
      }
      return u;
    });

    if (!found) {
      throw new AppError({ code: 'NOT_FOUND' as never, message: 'User not found', severity: 'warning' });
    }

    saveStoredUsers(updated);

    // Update active session if logged in
    const activeRaw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    if (activeRaw) {
      try {
        const s = JSON.parse(activeRaw) as Session;
        if (s.user.id === userId) {
          s.user.mustChangePassword = false;
          this.persist(s);
        }
      } catch {
        // ignore
      }
    }

    return { ok: true };
  }

  async resetToDefaultPassword(userId: string): Promise<{ ok: boolean }> {
    const users = this.getUsersList();
    let found = false;

    const updated = users.map((u) => {
      if (u.id === userId) {
        found = true;
        return {
          ...u,
          password: 'password',
          mustChangePassword: true,
        };
      }
      return u;
    });

    if (!found) {
      throw new AppError({ code: 'NOT_FOUND' as never, message: 'User not found', severity: 'warning' });
    }

    saveStoredUsers(updated);
    return { ok: true };
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
      if (s.expiresAt < now()) {
        await this.logout();
        return null;
      }
      return s;
    } catch {
      await this.logout();
      return null;
    }
  }

  async refresh(): Promise<Session | null> {
    const s = await this.getSession();
    if (!s) return null;
    const ttlMs = (s.rememberMe ? businessRules.auth.rememberMeDays * 24 * 60 : businessRules.auth.sessionTimeoutMinutes) * 60 * 1000;
    s.expiresAt = now() + ttlMs;
    this.persist(s);
    return s;
  }

  async requestPasswordReset(email: string): Promise<{ sent: boolean }> {
    const key = email.toLowerCase();
    const users = this.getUsersList();
    const rec = users.find((u) => u.email.toLowerCase() === key || u.username?.toLowerCase() === key);
    if (!rec) return { sent: true };
    return { sent: true };
  }

  async resetPassword(_token: string, newPassword: string): Promise<{ ok: boolean }> {
    const users = this.getUsersList();
    if (users.length > 0) {
      users[0].password = newPassword;
      users[0].mustChangePassword = false;
      saveStoredUsers(users);
    }
    return { ok: true };
  }

  private recordFailure(key: string) {
    const prev = this.failedAttempts.get(key) ?? { count: 0 };
    const count = prev.count + 1;
    let lockedUntil: number | undefined;
    if (count >= businessRules.auth.maxFailedLoginAttempts) {
      lockedUntil = now() + businessRules.auth.accountLockMinutes * 60 * 1000;
    }
    this.failedAttempts.set(key, { count, lockedUntil });
  }

  private persist(s: Session) {
    const raw = JSON.stringify(s);
    if (s.rememberMe) {
      localStorage.setItem(SESSION_KEY, raw);
    } else {
      sessionStorage.setItem(SESSION_KEY, raw);
    }
  }
}
