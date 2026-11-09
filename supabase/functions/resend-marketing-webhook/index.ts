/**
 * Resend contact unsubscribe and abuse feedback. Safe to deploy before enabling marketing.
 * Resend uses Svix HMAC-SHA256 over the EXACT raw body, id and timestamp.
 * No contact syncing or sending happens in this function.
 */
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
});
const encoder = new TextEncoder();
function b64Bytes(v: string): Uint8Array {
  const bytes = atob(v.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bytes, c => c.charCodeAt(0));
}
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function verify(body: string, req: Request, secret: string): Promise<boolean> {
  const id = req.headers.get('svix-id') ?? '';
  const timestamp = req.headers.get('svix-timestamp') ?? '';
  const signatures = req.headers.get('svix-signature') ?? '';
  const seconds = Number(timestamp);
  if (!id || !/^\d+$/.test(timestamp) || !signatures || !Number.isFinite(seconds)
      || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  try {
    const key = await crypto.subtle.importKey('raw', b64Bytes(secret.replace(/^whsec_/, '')),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const actual = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${id}.${timestamp}.${body}`)));
    return signatures.split(' ').some(part => {
      if (!part.startsWith('v1,')) return false;
      try { return constantTimeEqual(actual, b64Bytes(part.slice(3))); }
      catch { return false; }
    });
  } catch { return false; }
}
Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !url || !serviceKey) return json({ error: 'not_configured' }, 503);
  const raw = await req.text();
  if (!(await verify(raw, req, secret))) return json({ error: 'invalid_signature' }, 401);
  let event: { type?: string; data?: { email?: string; unsubscribed?: boolean; to?: string | string[] } };
  try { event = JSON.parse(raw); } catch { return json({ error: 'invalid_json' }, 400); }
  let reason: string | undefined;
  let email: string | undefined;
  if (event.type === 'contact.updated' && event.data?.unsubscribed === true) {
    reason = 'unsubscribed'; email = event.data.email;
  } else if (event.type === 'email.complained' || event.type === 'email.bounced') {
    reason = event.type === 'email.complained' ? 'complained' : 'bounced';
    email = Array.isArray(event.data?.to) ? event.data.to[0] : event.data?.to;
  }
  if (!reason || !email) return json({ ok: true, ignored: true });
  const response = await fetch(`${url}/rest/v1/rpc/marketing_record_suppression`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_email: email.toLowerCase().trim(), p_reason: reason }),
  });
  if (!response.ok) return json({ error: 'database_error' }, 500);
  return json({ ok: true });
});
