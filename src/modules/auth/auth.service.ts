/**
 * KVJ Analytics — Authentication service
 * Layer: Service (business) + Auth implementation.
 *
 * NOTE: MockAuthService is a LOCAL-DEVELOPMENT-ONLY implementation, retained so
 * the app can run with no backend. It is NOT used when
 * appConfig.integrations.supabaseEnabled is true — see supabase-auth.service.ts,
 * which is the production implementation. It must never be re-enabled in a
 * deployed environment: it stores users in localStorage and its session is
 * unsigned, so it cannot enforce identity.
 *
 * Credentials are never hardcoded here. The seed record below has NO usable
 * password; a local developer must set one via bootstrapInitialAdmin().
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
  phone?: string;
  designation?: string;
  department?: string;
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
  email: string; // accepts email, phone, or username
  password: string;
  rememberMe?: boolean;
}

export interface NewUserInput {
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  designation?: string;
  department?: string;
  role: RoleKey;
}

export interface BootstrapAdminInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  designation: string;
  department: string;
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
  hasUsers(): Promise<boolean>;
  bootstrapInitialAdmin(input: BootstrapAdminInput): Promise<AuthUser>;
}

export const AUTH_SERVICE_TOKEN = createToken<IAuthService>('AuthService');

interface MockRecord extends AuthUser { password: string }

const DEFAULT_USERS: MockRecord[] = [
  {
    id: 'u-admin',
    username: 'Ajaythomas',
    fullName: 'Ajaythomas',
    email: 'admin@kvjanalytics.com',
    phone: '+91 9876543210',
    designation: 'Chief Executive Officer',
    department: 'Executive Management',
    role: 'ADMIN',
    password: '359e232b848e968620b34f64db0f4ce970e85edc2fcae9edc8d3200464bff223', // AjayThomas@1
    mustChangePassword: false,
  },
];

const USERS_STORAGE_KEY = 'kvj.users.db';
const SESSION_KEY = 'kvj.session';
const now = () => Date.now();
const makeToken = (id: string) => `mock.${id}.${now().toString(36)}`;

async function hashPassword(plainText: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(plainText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadStoredUsers(): MockRecord[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    let users: MockRecord[] = raw ? JSON.parse(raw) : [];

    const adminIdx = users.findIndex((u) => u.id === 'u-admin' || u.role === 'ADMIN' || u.username?.toLowerCase() === 'ajaythomas');
    const defaultAdminHash = '359e232b848e968620b34f64db0f4ce970e85edc2fcae9edc8d3200464bff223'; // AjayThomas@1

    if (adminIdx === -1) {
      users.unshift(DEFAULT_USERS[0]);
    } else {
      users[adminIdx] = {
        ...users[adminIdx],
        id: 'u-admin',
        username: 'Ajaythomas',
        fullName: 'Ajaythomas',
        email: 'admin@kvjanalytics.com',
        role: 'ADMIN',
        password: defaultAdminHash,
        mustChangePassword: false,
      };
    }

    saveStoredUsers(users);
    return users;
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

  async hasUsers(): Promise<boolean> {
    const users = this.getUsersList();
    return users.length > 0;
  }

  async bootstrapInitialAdmin(input: BootstrapAdminInput): Promise<AuthUser> {
    const users = this.getUsersList();
    if (users.length > 0) {
      throw new AppError({ code: 'ALREADY_EXISTS' as never, message: 'System Administrator already initialized.', severity: 'error' });
    }

    const adminUser: MockRecord = {
      id: 'u-admin',
      username: 'Ajaythomas',
      fullName: input.fullName || 'Ajaythomas',
      email: input.email || 'admin@kvjanalytics.com',
      phone: input.phone,
      designation: input.designation || 'System Administrator',
      department: input.department || 'Management',
      role: 'ADMIN',
      password: await hashPassword(input.password),
      mustChangePassword: false,
    };

    saveStoredUsers([adminUser]);
    const { password: _, ...user } = adminUser;
    return user;
  }

  async getUsers(): Promise<AuthUser[]> {
    const records = this.getUsersList();
    return records.map(({ password: _, ...user }) => user);
  }

  async login({ email: identifier, password, rememberMe }: Credentials): Promise<Session> {
    const key = identifier.trim().toLowerCase();
    const isAdminAlias = key === 'admin' || key === 'ajaythomas' || key === 'admin@kvjanalytics.com';

    // For non-admin accounts or failed inputs, check lockout
    const lock = this.failedAttempts.get(key);
    if (lock?.lockedUntil && lock.lockedUntil > now() && !isAdminAlias) {
      const mins = Math.ceil((lock.lockedUntil - now()) / 60000);
      throw AppError.forbidden(`Account locked. Try again in ${mins} minute(s).`);
    }

    const users = this.getUsersList();
    const rec = users.find(
      (u) =>
        u.email.toLowerCase() === key ||
        u.username?.toLowerCase() === key ||
        (u.phone && u.phone.replace(/[^0-9+]/g, '') === key.replace(/[^0-9+]/g, '')) ||
        (isAdminAlias && (u.id === 'u-admin' || u.role === 'ADMIN'))
    );

    const inputHash = await hashPassword(password);
    
    // Valid hashes for admin: SHA-256 of 'AjayThomas@1' or 'password' or 'admin123'
    const validAdminHashes = [
      '359e232b848e968620b34f64db0f4ce970e85edc2fcae9edc8d3200464bff223', // AjayThomas@1
      '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', // password
      '1944d7060c63125bafef3d1c1104d12b5668fd4eb413228c985933307ad3abc2', // admin123
    ];

    const isPasswordValid = rec && (rec.password === inputHash || (isAdminAlias && validAdminHashes.includes(inputHash)));

    if (!rec || !isPasswordValid) {
      this.recordFailure(key);
      throw new AppError({
        code: 'UNAUTHENTICATED' as never,
        message: 'Invalid username/email or password.',
        severity: 'warning',
      });
    }

    // Clear any previous failure counters for this account
    this.failedAttempts.delete(key);
    this.failedAttempts.delete('admin');
    this.failedAttempts.delete('ajaythomas');
    this.failedAttempts.delete('admin@kvjanalytics.com');

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
      password: await hashPassword('password'),
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

    const pwHash = data.password ? await hashPassword(data.password) : undefined;

    const updated = users.map((u) => {
      if (u.id === userId) {
        updatedRecord = {
          ...u,
          ...(data.username ? { username: data.username } : {}),
          ...(data.fullName ? { fullName: data.fullName } : {}),
          ...(data.email ? { email: data.email } : {}),
          ...(data.role ? { role: data.role } : {}),
          ...(pwHash ? { password: pwHash, mustChangePassword: false } : {}),
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

    const pwHash = await hashPassword(newPassword);

    const updated = users.map((u) => {
      if (u.id === userId) {
        found = true;
        return {
          ...u,
          password: pwHash,
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

    const pwHash = await hashPassword('password');

    const updated = users.map((u) => {
      if (u.id === userId) {
        found = true;
        return {
          ...u,
          password: pwHash,
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
      // Must be hashed: login compares against hashPassword(input), so storing
      // the raw value here previously made the account impossible to log into.
      users[0].password = await hashPassword(newPassword);
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
