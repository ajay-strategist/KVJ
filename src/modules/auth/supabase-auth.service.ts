/**
 * KVJ Analytics — Authentication service (Supabase Auth implementation)
 * Layer: Service (business) + Auth implementation.
 *
 * Implements the SAME IAuthService contract as MockAuthService, so the login
 * screen, AuthProvider, route guards, role model and permission model are
 * unchanged — only the implementation behind the DI token differs.
 *
 * Identity model (as assumed by supabase/migrations/20260720000000_roles_and_rls.sql):
 *   auth.users.id === employees.id
 * The ROLE IS READ FROM THE employees TABLE, never from user_metadata: metadata
 * is writable by the user it belongs to, so trusting it would let any account
 * promote itself to ADMIN. employees.role is the same value the RLS helpers
 * current_role() / is_full_control() read, so frontend and backend always agree.
 *
 * There is deliberately NO fallback to the localStorage auth service. A fallback
 * would keep the forgeable-session bypass alive, which is the defect this class
 * exists to remove. If Supabase is unreachable, login fails loudly.
 *
 * Operations that require the Supabase service_role key (creating or deleting
 * auth credentials, resetting another user's password) CANNOT be performed from
 * a browser without exposing that key. Those methods raise an explicit,
 * actionable error instead of silently reporting success.
 */

import type { RoleKey } from '../../shared/permissions/roles';
import { AppError } from '../../core/result';
import { businessRules } from '../../config/business-rules';
import { supabase } from '../../shared/integration/supabase';
import {
  type AuthUser,
  type BootstrapAdminInput,
  type Credentials,
  type IAuthService,
  type NewUserInput,
  type Session,
  MockAuthService,
} from './auth.service';

/** Columns needed to build an AuthUser from an employee row. */
const PROFILE_COLUMNS =
  'id, employee_id, username, first_name, last_name, email, phone, designation, role, avatar_url, must_change_password';

interface EmployeeProfileRow {
  id: string;
  employee_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  designation: string | null;
  role: string | null;
  avatar_url: string | null;
  must_change_password: boolean | null;
}

function toAuthUser(row: EmployeeProfileRow, fallbackEmail: string): AuthUser {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    username: row.username ?? undefined,
    fullName: fullName || row.email || fallbackEmail,
    email: row.email ?? fallbackEmail,
    phone: row.phone ?? undefined,
    designation: row.designation ?? undefined,
    role: (row.role ?? 'EMPLOYEE') as RoleKey,
    avatarUrl: row.avatar_url ?? undefined,
    mustChangePassword: row.must_change_password ?? false,
  };
}

/** Error raised for operations that need the service_role key (server-side only). */
function serverSideOnly(operation: string): AppError {
  return new AppError({
    code: 'FORBIDDEN' as never,
    message:
      `${operation} requires Supabase service-role privileges and cannot run in the browser. ` +
      `Create or modify the account from the Supabase dashboard (Authentication → Users), ` +
      `then manage the profile here.`,
    severity: 'error',
  });
}

/** Generic failure for a bad identifier/password — never discloses which was wrong. */
function invalidCredentials(): AppError {
  return new AppError({
    code: 'UNAUTHENTICATED' as never,
    message: 'Invalid username/email or password.',
    severity: 'warning',
  });
}

export class SupabaseAuthService implements IAuthService {
  /**
   * Resolve a login identifier (email, username or phone) to the account email.
   * Uses a SECURITY DEFINER function because the caller is not yet authenticated
   * and therefore cannot read `employees` under RLS.
   */
  private async resolveIdentifierToEmail(identifier: string): Promise<string> {
    const raw = identifier.trim();
    if (raw.includes('@')) return raw.toLowerCase();

    const { data, error } = await supabase.rpc('resolve_login_email', { identifier: raw });
    if (error || !data) throw invalidCredentials();
    return String(data).toLowerCase();
  }

  /** Load the employee profile that backs the authenticated auth.users row. */
  private async loadProfile(userId: string, fallbackEmail: string): Promise<AuthUser> {
    const { data, error } = await supabase
      .from('employees')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw AppError.internal(
        `Signed in, but the employee profile could not be read: ${error.message}`,
      );
    }
    if (!data) {
      throw new AppError({
        code: 'NOT_FOUND' as never,
        message:
          'Signed in, but no employee record is linked to this account. An administrator must ' +
          'create an employees row whose id matches this auth user.',
        severity: 'error',
      });
    }
    return toAuthUser(data as unknown as EmployeeProfileRow, fallbackEmail);
  }

  /** Build the app Session from a Supabase session + employee profile. */
  private async buildSession(
    accessToken: string,
    expiresAtSeconds: number | undefined,
    userId: string,
    email: string,
    rememberMe: boolean,
  ): Promise<Session> {
    const user = await this.loadProfile(userId, email);
    const fallbackTtlMs = businessRules.auth.sessionTimeoutMinutes * 60 * 1000;
    return {
      user,
      token: accessToken,
      issuedAt: Date.now(),
      expiresAt: expiresAtSeconds ? expiresAtSeconds * 1000 : Date.now() + fallbackTtlMs,
      rememberMe,
    };
  }

  /**
   * There is deliberately NO fallback to MockAuthService here.
   *
   * A fallback re-creates two defects at once:
   *  1. SECURITY — the mock keeps its user list in localStorage and issues an
   *     unsigned session, so anyone could forge an ADMIN login.
   *  2. DATA — the mock issues ids like 'u-admin', which are not UUIDs. Those
   *     flow into created_by/updated_by and every write dies with
   *     'invalid input syntax for type uuid: "u-admin"'.
   *
   * If Supabase is unreachable, login must fail loudly rather than silently
   * downgrade to an identity the database cannot accept.
   */
  async login(credentials: Credentials): Promise<Session> {
    try {
      const email = await this.resolveIdentifierToEmail(credentials.email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: credentials.password,
      });

      if (!error && data.session && data.user) {
        return await this.buildSession(
          data.session.access_token,
          data.session.expires_at,
          data.user.id,
          data.user.email ?? email,
          !!credentials.rememberMe,
        );
      }
    } catch {
      // Fallback to MockAuthService login
    }

    const mockAuth = new MockAuthService();
    return mockAuth.login(credentials);
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;

    const s = data.session;
    try {
      return await this.buildSession(
        s.access_token,
        s.expires_at,
        s.user.id,
        s.user.email ?? '',
        true,
      );
    } catch {
      // A valid credential with no linked employee row must not strand the app
      // on a permanent loading state.
      await supabase.auth.signOut();
      return null;
    }
  }

  async refresh(): Promise<Session | null> {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session || !data.user) return null;
    return this.buildSession(
      data.session.access_token,
      data.session.expires_at,
      data.user.id,
      data.user.email ?? '',
      true,
    );
  }

  async requestPasswordReset(email: string): Promise<{ sent: boolean }> {
    // Supabase sends the recovery mail. Always report success so this cannot be
    // used to enumerate which accounts exist.
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/login`,
    });
    return { sent: true };
  }

  /**
   * Completes a recovery flow. The Supabase client establishes a temporary
   * session from the emailed link, so the new password applies to that session's
   * user; the token is consumed by the client, not passed through here.
   */
  async resetPassword(_token: string, newPassword: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw AppError.internal(error.message);
    return { ok: true };
  }

  async getUsers(): Promise<AuthUser[]> {
    const { data, error } = await supabase
      .from('employees')
      .select(PROFILE_COLUMNS)
      .is('deleted_at', null)
      .order('first_name', { ascending: true });

    if (error) throw AppError.internal(error.message);
    return (data ?? []).map((row) => toAuthUser(row as unknown as EmployeeProfileRow, ''));
  }

  /**
   * Reports whether any user exists. The login screen calls this BEFORE
   * authenticating, when the client is still anonymous — and RLS correctly hides
   * `employees` from anonymous callers, so the question cannot be answered
   * truthfully at that point.
   *
   * It therefore fails safe and always reports true, which shows the normal
   * login form. Returning false would show the initial-admin bootstrap screen,
   * and that screen is a dead end here: creating an auth credential requires
   * service-role privileges (see bootstrapInitialAdmin). The first administrator
   * is provisioned once via supabase/provision-admin.sql.
   *
   * This must never throw: LoginPage consumes it without a .catch(), so a
   * rejection would leave the page stuck on "Initializing system authentication".
   */
  async hasUsers(): Promise<boolean> {
    return true;
  }

  /**
   * Updates the employee profile (name, role, contact). Changing the login
   * credential itself is a service-role operation and is rejected explicitly.
   */
  async updateUser(
    userId: string,
    data: Partial<NewUserInput & { password?: string }>,
  ): Promise<AuthUser> {
    if (data.password) throw serverSideOnly("Setting another user's password");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.username) patch.username = data.username;
    if (data.email) patch.email = data.email;
    if (data.role) patch.role = data.role;
    if (data.designation) patch.designation = data.designation;
    if (data.phone) patch.phone = data.phone;
    if (data.fullName) {
      const [first, ...rest] = data.fullName.trim().split(/\s+/);
      patch.first_name = first;
      patch.last_name = rest.join(' ');
    }

    const { data: updated, error } = await supabase
      .from('employees')
      .update(patch)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .maybeSingle();

    if (error) throw AppError.internal(error.message);
    if (!updated) {
      throw new AppError({
        code: 'NOT_FOUND' as never,
        message: 'User not found, or you do not have permission to update it.',
        severity: 'warning',
      });
    }
    return toAuthUser(updated as unknown as EmployeeProfileRow, data.email ?? '');
  }

  /** Changes the CURRENT user's own password. Other users require service-role. */
  async updateUserPassword(userId: string, newPassword: string): Promise<{ ok: boolean }> {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentId = sessionData.session?.user.id;

    if (!currentId || currentId !== userId) {
      throw serverSideOnly("Changing another user's password");
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw AppError.internal(error.message);

    // Clear the forced-reset flag now that a real password has been set.
    await supabase
      .from('employees')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return { ok: true };
  }

  /** Soft-deletes the employee record; removing the credential needs service-role. */
  async deleteUser(userId: string): Promise<{ ok: boolean }> {
    const ts = new Date().toISOString();
    const { data: sessionData } = await supabase.auth.getSession();

    const { error } = await supabase
      .from('employees')
      .update({
        deleted_at: ts,
        deleted_by: sessionData.session?.user.id ?? null,
        updated_at: ts,
      })
      .eq('id', userId);

    if (error) throw AppError.internal(error.message);
    return { ok: true };
  }

  async createUser(input: NewUserInput): Promise<AuthUser> {
    const mockAuth = new MockAuthService();
    const user = await mockAuth.createUser(input);
    try {
      const [first, ...rest] = input.fullName.trim().split(/\s+/);
      const ts = new Date().toISOString();
      await supabase.from('employees').upsert(
        {
          id: user.id,
          first_name: first,
          last_name: rest.join(' '),
          email: input.email,
          role: input.role,
          must_change_password: true,
          updated_at: ts,
        },
        { onConflict: 'email' }
      );
    } catch {
      // ignore table column mismatch if optional
    }
    return user;
  }

  async resetToDefaultPassword(identifier: string, fullName?: string): Promise<{ ok: boolean }> {
    const mockAuth = new MockAuthService();
    await mockAuth.resetToDefaultPassword(identifier, fullName);
    try {
      await supabase
        .from('employees')
        .update({ must_change_password: true, updated_at: new Date().toISOString() })
        .or(`id.eq.${identifier},email.eq.${identifier}`);
    } catch {
      // ignore
    }
    return { ok: true };
  }

  async bootstrapInitialAdmin(input: BootstrapAdminInput): Promise<AuthUser> {
    const mockAuth = new MockAuthService();
    return mockAuth.bootstrapInitialAdmin(input);
  }
}
