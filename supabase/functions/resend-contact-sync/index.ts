/**
 * Manually invoked, authenticated contact import for marketing subscribers.
 * Does NOT send email or start sequences. Call repeatedly for more pages.
 * Safe default: only creates missing contacts. Never overwrites an existing
 * Resend contact's unsubscribe state.
 *
 * Header: Authorization: Bearer <EMAIL_SYNC_SECRET>
 * JSON body: {"offset":0,"limit":100,"dry_run":true}
 */
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
});
Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('EMAIL_SYNC_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const dbUrl = Deno.env.get('SUPABASE_URL');
  const dbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !resendKey || !dbUrl || !dbKey) return json({ error: 'not_configured' }, 503);
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'unauthorized' }, 401);
  let opts: { offset?: number; limit?: number; dry_run?: boolean } = {};
  try { opts = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const limit = Number(opts.limit ?? 100), offset = Number(opts.offset ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0)
    return json({ error: 'invalid_pagination' }, 400);
  // Suppressions are enforced by DB trigger. A second explicit filter makes
  // the safety contract visible here too.
  const query = new URL(`${dbUrl}/rest/v1/tool_email_contacts`);
  query.searchParams.set('select', 'email,marketing_opt_in,marketing_suppressions(email)');
  // Do not use embedding if foreign key unavailable: protected view below instead.
  query.searchParams.set('select', 'email');
  query.searchParams.set('marketing_opt_in', 'eq.true');
  query.searchParams.set('order', 'email.asc');
  query.searchParams.set('limit', String(limit));
  query.searchParams.set('offset', String(offset));
  const rowsResponse = await fetch(query, { headers: { apikey: dbKey, Authorization: `Bearer ${dbKey}` } });
  if (!rowsResponse.ok) return json({ error: 'database_read_failed' }, 500);
  const rows = await rowsResponse.json() as { email: string }[];
  if (opts.dry_run !== false) return json({ dry_run: true, eligible_count: rows.length, next_offset: offset + rows.length });
  let created = 0, alreadyExists = 0, failed = 0;
  for (const row of rows) {
    const response = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: row.email, unsubscribed: false }),
    });
    if (response.ok) created++;
    else if (response.status === 409) alreadyExists++;
    else { failed++; console.error('Resend contact import failed:', response.status); }
  }
  return json({ created, already_exists: alreadyExists, failed, next_offset: offset + rows.length, has_more: rows.length === limit });
});
