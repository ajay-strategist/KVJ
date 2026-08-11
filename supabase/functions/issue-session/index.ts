// =============================================================================
// Edge Function: issue-session  (Phase 6.44)
//
// Bridges the app's intentional app-level auth (flwdsk_employees.password_hash)
// to a Supabase-compatible JWT so that PostgreSQL `auth.uid()` reliably equals
// the employee id and the 6.30/6.40/6.42 RLS policies become effective.
//
// SECURITY INVARIANTS (do not weaken):
//   * The employee identity is derived ONLY from server-side credential
//     verification (flwdsk_authenticate). The client cannot choose `sub`.
//   * The Postgres role claim is ALWAYS 'authenticated' — never an app role.
//     Authorization stays DB-derived (is_training_admin() reads employees.role
//     by auth.uid()). No ADMIN/CEO/MANAGER claim is ever minted from client input.
//   * Secrets (service-role key, JWT secret) stay in the function environment and
//     are never returned or logged. Password hashes are never returned.
//
// DEPLOY: must be public (no Supabase JWT gate) because it runs pre-auth:
//   supabase functions deploy issue-session --no-verify-jwt
// Required function secrets (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
//   (optional) ACCESS_TTL_SECONDS (default 3600), REFRESH_TTL_SECONDS (default 604800)
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { signJwtHS256, newRefreshToken } from '../_shared/jwt.ts';

const PROFILE_COLUMNS =
  'id, employee_id, username, first_name, last_name, email, phone, designation, role, avatar_url, must_change_password';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET');
  if (!SUPABASE_URL || !SERVICE_ROLE || !JWT_SECRET) {
    // Do not leak which secret is missing beyond the server logs.
    console.error('issue-session misconfigured: missing SUPABASE_URL / SERVICE_ROLE / JWT_SECRET');
    return json(500, { error: 'server_misconfigured' });
  }
  const ACCESS_TTL = Number(Deno.env.get('ACCESS_TTL_SECONDS') ?? '3600');
  const REFRESH_TTL = Number(Deno.env.get('REFRESH_TTL_SECONDS') ?? '604800');

  let identifier = '';
  let password = '';
  try {
    const body = await req.json();
    identifier = String(body?.identifier ?? '').trim();
    password = String(body?.password ?? '');
  } catch {
    return json(400, { error: 'invalid_body' });
  }
  if (!identifier || !password) return json(400, { error: 'missing_credentials' });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // 1. Resolve identifier (email / username / phone) -> account email.
  const { data: email } = await admin.rpc('resolve_login_email', { identifier });
  if (!email) return json(401, { error: 'invalid_credentials' });

  // 2. Verify credentials against the app-level store (bcrypt) — server side only.
  //    flwdsk_authenticate returns the employee id on success, NULL otherwise.
  const { data: employeeId, error: authErr } = await admin.rpc('flwdsk_authenticate', {
    p_email: email,
    p_password: password,
  });
  if (authErr || !employeeId) return json(401, { error: 'invalid_credentials' });

  // 3. Load the minimal profile (service role bypasses RLS). Never expose hashes.
  const { data: profile, error: profErr } = await admin
    .from('flwdsk_employees')
    .select(`${PROFILE_COLUMNS}, status`)
    .eq('id', employeeId)
    .is('deleted_at', null)
    .maybeSingle();
  if (profErr || !profile) return json(401, { error: 'invalid_credentials' });
  if ((profile as { status?: string }).status && (profile as { status?: string }).status !== 'active') {
    return json(403, { error: 'account_inactive' });
  }

  // 4. Mint the Supabase-compatible JWT. sub is the SERVER-verified id.
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TTL;
  const access_token = await signJwtHS256(
    {
      sub: String(employeeId),
      role: 'authenticated',      // Postgres role — NOT the app role
      aud: 'authenticated',
      email: (profile as { email?: string }).email ?? undefined,
      iat: now,
      exp,
      app_metadata: { provider: 'flwdsk' },
    },
    JWT_SECRET,
  );

  // 5. Issue an opaque refresh token; persist only its hash.
  const { token: refresh_token, hash } = await newRefreshToken();
  const refreshExpiresAt = new Date((now + REFRESH_TTL) * 1000).toISOString();
  const { error: rtErr } = await admin.from('flwdsk_auth_refresh_tokens').insert({
    employee_id: employeeId,
    token_hash: hash,
    expires_at: refreshExpiresAt,
  });
  if (rtErr) {
    console.error('issue-session: refresh token persist failed'); // no token in log
    return json(500, { error: 'server_error' });
  }

  return json(200, {
    access_token,
    token_type: 'bearer',
    expires_at: exp,            // seconds since epoch
    refresh_token,
    employee: profile,          // safe profile columns only (no password_hash)
  });
});
