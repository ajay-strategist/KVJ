// Shared JWT + hashing helpers for the Phase 6.44 auth Edge Functions.
// Uses the Web Crypto API only (no external signing dependency) so the function
// stays small and auditable. HS256 is the Supabase "legacy JWT secret" scheme;
// if the project has migrated to ASYMMETRIC signing keys, sign with the current
// private signing key instead (see PHASE_6_44 report §6, open question 1).

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface JwtClaims {
  sub: string;            // MUST be the server-verified employee id -> auth.uid()
  role: string;          // Postgres role for PostgREST: always 'authenticated'
  aud: string;           // 'authenticated'
  iat: number;
  exp: number;
  email?: string;
  [k: string]: unknown;
}

/** Sign a compact JWS (HS256) with the given shared secret. */
export async function signJwtHS256(claims: JwtClaims, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput)));
  return `${signingInput}.${base64url(sig)}`;
}

/** Opaque refresh token (random) + its SHA-256 hash (only the hash is stored). */
export async function newRefreshToken(): Promise<{ token: string; hash: string }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = base64url(raw);
  return { token, hash: await sha256hex(token) };
}

export async function sha256hex(input: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
  return Array.from(digest).map((b) => b.toString(16).padStart(2, '0')).join('');
}
