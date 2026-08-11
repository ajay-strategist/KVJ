// =============================================================================
// Edge Function: refresh-session  (Phase 6.44)
//
// Exchanges a valid opaque refresh token for a fresh access JWT (with rotation),
// or revokes a refresh token on logout. Identity is derived ONLY from the stored
// token row (employee_id) — never from any client-supplied sub/role/id.
//
// DEPLOY: public, like issue-session:
//   supabase functions deploy refresh-session --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET,
//          (optional) ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { signJwtHS256, newRefreshToken, sha256hex } from '../_shared/jwt.ts';

const PROFILE_COLUMNS =
  'id, employee_id, username, first_name, last_name, email, phone, designation, role, avatar_url, must_change_password, status';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET');
  if (!SUPABASE_URL || !SERVICE_ROLE || !JWT_SECRET) {
    console.error('refresh-session misconfigured: missing secrets');
    return json(500, { error: 'server_misconfigured' });
  }
  const ACCESS_TTL = Number(Deno.env.get('ACCESS_TTL_SECONDS') ?? '3600');
  const REFRESH_TTL = Number(Deno.env.get('REFRESH_TTL_SECONDS') ?? '604800');

  let refreshToken = '';
  let action = 'refresh';
  try {
    const body = await req.json();
    refreshToken = String(body?.refresh_token ?? '');
    action = String(body?.action ?? 'refresh');
  } catch {
    return json(400, { error: 'invalid_body' });
  }
  if (!refreshToken) return json(400, { error: 'missing_refresh_token' });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const hash = await sha256hex(refreshToken);

  // Look up the token by hash. Never trust anything the client claims.
  const { data: row } = await admin
    .from('flwdsk_auth_refresh_tokens')
    .select('id, employee_id, expires_at, revoked_at')
    .eq('token_hash', hash)
    .maybeSingle();

  // Logout / revoke path — idempotent, always 200 so logout can't be probed.
  if (action === 'revoke') {
    if (row && !row.revoked_at) {
      await admin.from('flwdsk_auth_refresh_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', row.id);
    }
    return json(200, { ok: true });
  }

  if (!row) return json(401, { error: 'invalid_refresh_token' });
  if (row.revoked_at) {
    // Potential token reuse / replay attack. Revoke all active tokens for this employee for safety.
    await admin
      .from('flwdsk_auth_refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('employee_id', row.employee_id)
      .is('revoked_at', null);
    return json(401, { error: 'refresh_token_revoked' });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) return json(401, { error: 'refresh_token_expired' });

  // Re-verify the employee is still active (privilege/status changes take effect).
  const { data: profile } = await admin
    .from('flwdsk_employees')
    .select(PROFILE_COLUMNS)
    .eq('id', row.employee_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile) return json(401, { error: 'invalid_refresh_token' });
  if ((profile as { status?: string }).status && (profile as { status?: string }).status !== 'active') {
    await admin.from('flwdsk_auth_refresh_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', row.id);
    return json(403, { error: 'account_inactive' });
  }

  // Rotate: revoke the presented token, issue a new one.
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TTL;
  const access_token = await signJwtHS256(
    {
      sub: String(row.employee_id),
      role: 'authenticated',
      aud: 'authenticated',
      email: (profile as { email?: string }).email ?? undefined,
      iat: now,
      exp,
      app_metadata: { provider: 'flwdsk' },
    },
    JWT_SECRET,
  );

  const { token: refresh_token, hash: newHash } = await newRefreshToken();
  const refreshExpiresAt = new Date((now + REFRESH_TTL) * 1000).toISOString();
  // Insert the new token first, then revoke the old one (fail-safe ordering).
  const { error: insErr } = await admin.from('flwdsk_auth_refresh_tokens').insert({
    employee_id: row.employee_id,
    token_hash: newHash,
    expires_at: refreshExpiresAt,
  });
  if (insErr) {
    console.error('refresh-session: rotation insert failed');
    return json(500, { error: 'server_error' });
  }
  await admin.from('flwdsk_auth_refresh_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', row.id);

  return json(200, { access_token, token_type: 'bearer', expires_at: exp, refresh_token, employee: profile });
});
