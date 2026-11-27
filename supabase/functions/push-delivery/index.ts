/**
 * push-delivery (docs/ios/V20_LAUNCH.md): sends one queued household notification by Web Push.
 *
 * Called only by the database dispatcher (push_private.dispatch, via pg_net) with the one-time token it wrote on the
 * row; anything else is refused. Reads the row and the recipient adult's devices with the service role, sends the
 * payload (title, body, the notification id and its actions; never private calendar text) with VAPID, removes devices
 * the push service says are gone, and settles the row.
 *
 * VAPID keys: generated here on first use and kept in public.household_push_keys (service role only), so the private key
 * never leaves Supabase. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 */
import webpush from 'npm:web-push@3.6.7';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUBJECT = 'mailto:hello@organizedmomcollective.com';

const rest = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, {
  ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Row { id: string; household_id: string; to_member: string; kind: string; purpose: string; title: string; body: string; data: { actions?: string[] }; status: string }
interface Sub { id: string; endpoint: string; p256dh: string; auth: string; failures: number }

/** The household push key pair: made once, then read. Idempotent (two first calls keep one pair). */
async function keys(): Promise<{ public_key: string; private_key: string }> {
  const read = async () => ((await (await rest('household_push_keys?id=eq.true&select=public_key,private_key')).json()) as { public_key: string; private_key: string }[])[0];
  const have = await read();
  if (have) return have;
  const k = webpush.generateVAPIDKeys();
  await rest('household_push_keys', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ id: true, public_key: k.publicKey, private_key: k.privateKey }) });
  return (await read())!;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body: { token?: unknown; init?: unknown } = {};
  try { body = await req.json(); } catch { /* invalid */ }
  // Make sure the key pair exists (returns only the public key, which is public by design).
  if (body.init === true) return json({ public_key: (await keys()).public_key });
  const token = String(body.token ?? '');
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: 'invalid' }, 400);

  const rows = (await (await rest(`household_notifications?dispatch_token=eq.${token}&status=eq.queued&select=id,household_id,to_member,kind,purpose,title,body,data,status`)).json()) as Row[];
  const n = rows[0];
  if (!n) return json({ ok: true, skipped: 'not_found' });
  const subs = (await (await rest(`household_push_subscriptions?household_id=eq.${n.household_id}&member_id=eq.${n.to_member}&select=id,endpoint,p256dh,auth,failures`)).json()) as Sub[];
  if (!subs.length) {
    await rest(`household_notifications?id=eq.${n.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'no_device' }) });
    return json({ ok: true, sent: 0 });
  }
  const k = await keys();
  webpush.setVapidDetails(SUBJECT, k.public_key, k.private_key);
  const payload = JSON.stringify({ id: n.id, title: n.title, body: n.body, actions: (n.data?.actions ?? []).filter((a) => a !== 'open'), url: '/app' });
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12, urgency: 'high' });
      sent++;
      await rest(`household_push_subscriptions?id=eq.${s.id}`, { method: 'PATCH', body: JSON.stringify({ last_sent_at: new Date().toISOString(), failures: 0 }) });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode ?? 0;
      if (code === 404 || code === 410 || s.failures >= 5) await rest(`household_push_subscriptions?id=eq.${s.id}`, { method: 'DELETE' });
      else await rest(`household_push_subscriptions?id=eq.${s.id}`, { method: 'PATCH', body: JSON.stringify({ failures: s.failures + 1 }) });
    }
  }
  await rest(`household_notifications?id=eq.${n.id}`, { method: 'PATCH', body: JSON.stringify(sent ? { status: 'sent', sent_at: new Date().toISOString() } : {}) });
  return json({ ok: true, sent });
});
