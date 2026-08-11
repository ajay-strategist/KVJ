// CORS for the browser-called auth Edge Functions.
// NOTE: '*' is acceptable here because these endpoints authenticate via a request
// body (app credentials / refresh token) and the anon apikey header — they do NOT
// use cookies, so there is no ambient-credential CSRF surface. For defense in
// depth, restrict `Access-Control-Allow-Origin` to your deployed app origin(s)
// before production (see PHASE_6_44 report §13).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
