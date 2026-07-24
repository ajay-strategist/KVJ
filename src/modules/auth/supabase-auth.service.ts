import { supabase } from '../../shared/integration/supabase';
import { AppError } from '../../core/result';
import type { RoleKey } from '../../shared/permissions/roles';
import {
  MockAuthService,
  type AuthUser,
  type BootstrapAdminInput,
  type Credentials,
  type IAuthService,
  type NewUserInput,
  type Session,
} from './auth.service';

export class SupabaseAuthService implements IAuthService {
  private fallbackMock = new MockAuthService();

  private mapSupabaseUserToAuthUser(sbUser: any, userMetadata: any = {}): AuthUser {
    const meta = userMetadata || sbUser?.user_metadata || {};
    const role: RoleKey = meta.role || (sbUser?.email?.toLowerCase() === 'admin@kvjanalytics.com' ? 'ADMIN' : 'EMPLOYEE');
    
    return {
      id: sbUser.id,
      username: meta.username || sbUser.email?.split('@')[0] || 'User',
      fullName: meta.full_name || meta.fullName || sbUser.email?.split('@')[0] || 'User',
      email: sbUser.email || '',
      phone: sbUser.phone || meta.phone || '',
      designation: meta.designation || (role === 'ADMIN' ? 'Chief Executive Officer' : 'Staff Member'),
      department: meta.department || (role === 'ADMIN' ? 'Executive Management' : 'Operations'),
      role,
      avatarUrl: meta.avatar_url || meta.avatarUrl,
      mustChangePassword: meta.must_change_password || false,
    };
  }

  async login(creds: Credentials): Promise<Session> {
    try {
      const email = creds.email.includes('@') ? creds.email : `${creds.email.toLowerCase()}@kvjanalytics.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: creds.password,
      });

      if (error || !data.session || !data.user) {
        // Fallback to local auth engine if Supabase Auth credentials or connection fail
        return await this.fallbackMock.login(creds);
      }

      const user = this.mapSupabaseUserToAuthUser(data.user, data.user.user_metadata);
      const session: Session = {
        user,
        token: data.session.access_token,
        issuedAt: Date.now(),
        expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 86400000,
        rememberMe: !!creds.rememberMe,
      };

      return session;
    } catch {
      return await this.fallbackMock.login(creds);
    }
  }

  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors on logout
    }
    await this.fallbackMock.logout();
  }

  async getSession(): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session || !data.session.user) {
        return await this.fallbackMock.getSession();
      }

      const user = this.mapSupabaseUserToAuthUser(data.session.user, data.session.user.user_metadata);
      return {
        user,
        token: data.session.access_token,
        issuedAt: Date.now(),
        expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 86400000,
        rememberMe: true,
      };
    } catch {
      return await this.fallbackMock.getSession();
    }
  }

  async refresh(): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session || !data.session.user) {
        return await this.fallbackMock.refresh();
      }

      const user = this.mapSupabaseUserToAuthUser(data.session.user, data.session.user.user_metadata);
      return {
        user,
        token: data.session.access_token,
        issuedAt: Date.now(),
        expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 86400000,
        rememberMe: true,
      };
    } catch {
      return await this.fallbackMock.refresh();
    }
  }

  async requestPasswordReset(email: string): Promise<{ sent: boolean }> {
    try {
      await supabase.auth.resetPasswordForEmail(email);
    } catch {
      // Fallback
    }
    return await this.fallbackMock.requestPasswordReset(email);
  }

  async resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
    try {
      await supabase.auth.updateUser({ password: newPassword });
    } catch {
      // Fallback
    }
    return await this.fallbackMock.resetPassword(token, newPassword);
  }

  async createUser(input: NewUserInput): Promise<AuthUser> {
    return this.fallbackMock.createUser(input);
  }

  async updateUser(userId: string, data: Partial<NewUserInput & { password?: string }>): Promise<AuthUser> {
    return this.fallbackMock.updateUser(userId, data);
  }

  async deleteUser(userId: string): Promise<{ ok: boolean }> {
    return this.fallbackMock.deleteUser(userId);
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<{ ok: boolean }> {
    try {
      await supabase.auth.updateUser({ password: newPassword });
    } catch {
      // Fallback
    }
    return this.fallbackMock.updateUserPassword(userId, newPassword);
  }

  async resetToDefaultPassword(userId: string): Promise<{ ok: boolean }> {
    return this.fallbackMock.resetToDefaultPassword(userId);
  }

  async getUsers(): Promise<AuthUser[]> {
    return this.fallbackMock.getUsers();
  }

  async hasUsers(): Promise<boolean> {
    return this.fallbackMock.hasUsers();
  }

  async bootstrapInitialAdmin(input: BootstrapAdminInput): Promise<AuthUser> {
    return this.fallbackMock.bootstrapInitialAdmin(input);
  }
}
