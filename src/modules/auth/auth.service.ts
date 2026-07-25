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
  resetToDefaultPassword(userIdOrEmail: string, fullName?: string): Promise<{ ok: boolean }>;
  getUsers(): Promise<AuthUser[]>;
  hasUsers(): Promise<boolean>;
  bootstrapInitialAdmin(input: BootstrapAdminInput): Promise<AuthUser>;
}

export const AUTH_SERVICE_TOKEN = createToken<IAuthService>('AuthService');


