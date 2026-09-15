import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export interface MobileUser {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  designation: string;
  role: string;
  avatarUrl?: string;
  phone?: string;
}

interface AuthContextType {
  user: MobileUser | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => ({ ok: false }),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmployeeProfile = async (email: string, authId: string): Promise<MobileUser | null> => {
    try {
      const { data, error } = await supabase
        .from('flwdsk_employees')
        .select('*')
        .or(`email.ilike.${email},user_id.eq.${authId}`)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          email: data.email || email,
          fullName: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Employee',
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          designation: data.designation || 'Staff Member',
          role: data.role || 'employee',
          avatarUrl: data.avatar_url,
          phone: data.phone,
        };
      }
    } catch (e) {
      console.warn('Profile fetch warning:', e);
    }
    return {
      id: authId,
      email,
      fullName: email.split('@')[0],
      firstName: email.split('@')[0],
      lastName: '',
      designation: 'Employee',
      role: 'employee',
    };
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchEmployeeProfile(session.user.email || '', session.user.id);
        setUser(profile);
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchEmployeeProfile(session.user.email || '', session.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (error) {
        setLoading(false);
        return { ok: false, error: error.message };
      }

      if (data.user) {
        const profile = await fetchEmployeeProfile(data.user.email || cleanEmail, data.user.id);
        setUser(profile);
        setLoading(false);
        return { ok: true };
      }

      setLoading(false);
      return { ok: false, error: 'User could not be loaded.' };
    } catch (err: any) {
      setLoading(false);
      return { ok: false, error: err.message || 'Login failed.' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
