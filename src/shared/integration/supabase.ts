import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as { env?: Record<string, string> }).env ?? {};
export const SUPABASE_URL = metaEnv.VITE_SUPABASE_URL || 'https://yzlyeuikvbwhgjrjntvi.supabase.co';
export const SUPABASE_ANON_KEY = metaEnv.VITE_SUPABASE_ANON_KEY || 'sb_publishable_he_GbjYhcIO6KjiUQDdaoA_xHnDKG1z';

/**
 * Phase 6.44 — auth mode.
 *   'legacy' (default): unchanged behavior; Supabase Auth (GoTrue) manages
 *                       whatever session signInWithPassword establishes.
 *   'jwt':              custom JWT minted by the issue-session Edge Function
 *                       drives PostgREST via the supabase-js v2 `accessToken`
 *                       option, so `auth.uid()` reliably equals the employee id.
 * Selected at build time so no code path is silently removed.
 */
export const AUTH_MODE = (metaEnv.VITE_AUTH_MODE === 'jwt' ? 'jwt' : 'legacy') as 'legacy' | 'jwt';

const ACCESS_TOKEN_KEY = 'kvj_jwt';

// Module-level token store for jwt mode. Seeded from localStorage so a page
// reload restores the authenticated Supabase identity before the first request.
let currentAccessToken: string | null = null;
try {
  currentAccessToken = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
} catch {
  currentAccessToken = null;
}

/** Set (or clear) the JWT used by the Supabase client in jwt mode. */
export function setSupabaseAccessToken(token: string | null): void {
  currentAccessToken = token;
  try {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    /* storage unavailable — in-memory token still applies for this tab */
  }
}

export function getSupabaseAccessToken(): string | null {
  return currentAccessToken;
}

/**
 * In jwt mode, hand supabase-js an async `accessToken` provider. supabase-js then
 * attaches this token to every PostgREST/Storage/Realtime request and disables
 * its own GoTrue session management (the auth service manages tokens instead).
 * In legacy mode, the client is created exactly as before.
 */
export const supabase =
  AUTH_MODE === 'jwt'
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        accessToken: async () => currentAccessToken,
      })
    : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
