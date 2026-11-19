// Supabase Edge Function entry point. Logic: ../_shared/handlers/calendar-feeds.ts.
// Setup (secrets, schedule): docs/calendar/ROLLOUT.md. Security: docs/calendar/SECURITY_REVIEW.md.
import { createDb } from '../_shared/db.ts';
import { createCalendarFeedsHandler } from '../_shared/handlers/calendar-feeds.ts';
import { httpGet } from '../_shared/calendar/pinned-http.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const supabaseUrl = env('SUPABASE_URL');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = env('SUPABASE_ANON_KEY');
const MAX_BYTES = 5 * 1024 * 1024;

let lastResolver: string | null = null;

/** A and AAAA records. Deno's resolver when the runtime has it, otherwise DNS over HTTPS. Throws if neither answers. */
async function resolve(host: string): Promise<string[]> {
  const d = Deno as unknown as { resolveDns?: (h: string, t: 'A' | 'AAAA') => Promise<string[]> };
  if (typeof d.resolveDns === 'function') {
    try {
      const [a, aaaa] = await Promise.allSettled([d.resolveDns(host, 'A'), d.resolveDns(host, 'AAAA')]);
      const out = [...(a.status === 'fulfilled' ? a.value : []), ...(aaaa.status === 'fulfilled' ? aaaa.value : [])];
      if (out.length) { lastResolver = 'deno'; return out; }
    } catch { /* fall through to DNS over HTTPS */ }
  }
  const ask = async (type: 'A' | 'AAAA') => {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('dns');
    const j = await res.json() as { Answer?: { type: number; data: string }[] };
    return (j.Answer ?? []).filter((r) => r.type === (type === 'A' ? 1 : 28)).map((r) => r.data);
  };
  const [a, aaaa] = await Promise.all([ask('A'), ask('AAAA').catch(() => [])]);
  lastResolver = 'doh';
  return [...a, ...aaaa];
}

/** GET over a socket opened to the checked address; TLS is verified for the real host name over that socket. */
async function pinnedFetch(url: URL, ip: string, init: { headers: Record<string, string>; signal: AbortSignal }): Promise<Response> {
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  let conn: Deno.Conn | Deno.TlsConn = await Deno.connect({ hostname: ip, port });
  const abort = () => { try { conn.close(); } catch { /* already closed */ } };
  init.signal.addEventListener('abort', abort, { once: true });
  try {
    if (url.protocol === 'https:') conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: url.hostname });
    return await httpGet(conn, url, init.headers, MAX_BYTES);
  } catch (e) {
    if (init.signal.aborted) throw new Error('timeout');
    throw e;
  } finally {
    init.signal.removeEventListener('abort', abort);
    abort();
  }
}

Deno.serve(createCalendarFeedsHandler({
  db: createDb(supabaseUrl, serviceKey),
  async getUser(token) {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.id ? { id: u.id } : null;
  },
  fetch,
  resolve,
  resolverName: () => lastResolver,
  pinnedFetch,
  now: () => Date.now(),
  cronSecret: env('CALENDAR_CRON_SECRET') || null,
}));
