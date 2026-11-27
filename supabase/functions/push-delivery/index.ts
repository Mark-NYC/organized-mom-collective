/**
 * push-delivery (docs/ios/V20_LAUNCH.md): sends one queued household notification by Web Push.
 *
 * Called only by the database dispatcher (push_private.dispatch, via pg_net) with the one-time token it wrote on the
 * row; anything else is refused. Reads the row and the recipient adult's devices with the service role, sends the
 * payload (title, body, the notification id and its actions; never private calendar text) with VAPID, removes devices
 * the push service says are gone, and settles the row.
 *
 * Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
 * provided by Supabase.
 */
import webpush from 'npm:web-push@3.6.7';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@organizedmomcollective.com';

const rest = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, {
  ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Row { id: string; household_id: string; to_member: string; kind: string; purpose: string; title: string; body: string; data: { actions?: string[] }; status: string }
interface Sub { id: string; endpoint: string; p256dh: string; auth: string; failures: number }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'not_configured' }, 503);
  let token = '';
  try { token = String((await req.json()).token ?? ''); } catch { /* invalid */ }
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: 'invalid' }, 400);

  const rows = (await (await rest(`household_notifications?dispatch_token=eq.${token}&status=eq.queued&select=id,household_id,to_member,kind,purpose,title,body,data,status`)).json()) as Row[];
  const n = rows[0];
  if (!n) return json({ ok: true, skipped: 'not_found' });
  const subs = (await (await rest(`household_push_subscriptions?household_id=eq.${n.household_id}&member_id=eq.${n.to_member}&select=id,endpoint,p256dh,auth,failures`)).json()) as Sub[];
  if (!subs.length) {
    await rest(`household_notifications?id=eq.${n.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'no_device' }) });
    return json({ ok: true, sent: 0 });
  }
  webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
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
