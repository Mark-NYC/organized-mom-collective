import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { ADMIN_IDLE_MS, ADMIN_SECTIONS } from '../src/data/admin';
import {
  clearSession,
  cleanCode,
  createAdminAuth,
  idleExpired,
  isCode,
  loadSession,
  needsRefresh,
  saveSession,
  tokenClaims,
  type AdminSession,
} from '../src/lib/admin/session';
import { safeAdminLink, sortAlerts, usd, type AlertRow } from '../src/lib/admin/overview';
import { filterPages, liveUrl, sourceUrl, type PageRow } from '../src/lib/admin/pages';
import { auditDetail, createAdminHandler, tokenAal } from '../supabase/functions/_shared/handlers/admin.ts';
import { depsFromEnv } from '../supabase/functions/_shared/deps.ts';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (claims: Record<string, unknown>) => `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`;

class MemoryStorage {
  data = new Map<string, string>();
  getItem = (k: string) => this.data.get(k) ?? null;
  setItem = (k: string, v: string) => void this.data.set(k, v);
  removeItem = (k: string) => void this.data.delete(k);
}

const session = (over: Partial<AdminSession> = {}): AdminSession => ({
  access_token: token({ sub: 'u1', aal: 'aal2' }),
  refresh_token: 'r1',
  expires_at: Date.now() + 3600_000,
  email: 'owner@example.com',
  aal: 'aal2',
  ...over,
});

/** A fake Supabase Auth: records calls, answers from `routes` ("METHOD /path" → [status, body]). */
function fakeAuth(routes: Record<string, [number, unknown]>) {
  const calls: { method: string; path: string; body: unknown; auth: string | null }[] = [];
  const f = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const path = url.pathname.replace('/auth/v1', '') + url.search;
    calls.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : null, auth: new Headers(init.headers).get('authorization') });
    const hit = routes[`${method} ${path}`] ?? routes[`${method} ${url.pathname.replace('/auth/v1', '')}`];
    if (!hit) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(hit[1]), { status: hit[0] });
  }) as typeof fetch;
  return { f, calls, auth: createAdminAuth(f, 'https://p.supabase.test', 'anon') };
}

describe('admin session', () => {
  it('reads the aal claim from a token, defaulting to aal1', () => {
    expect(tokenClaims(token({ aal: 'aal2', sub: 'x' })).aal).toBe('aal2');
    expect(tokenClaims(token({ aal: 'aal1' })).aal).toBe('aal1');
    expect(tokenClaims('not-a-jwt').aal).toBe('aal1');
  });

  it('accepts only 6-digit codes, ignoring spaces', () => {
    expect(isCode('123 456')).toBe(true);
    expect(cleanCode(' 12 34 56 ')).toBe('123456');
    expect(isCode('12345')).toBe(false);
    expect(isCode('12345a')).toBe(false);
  });

  it('refreshes under five minutes left and signs out after 30 idle minutes', () => {
    const now = 1_000_000_000;
    expect(needsRefresh(session({ expires_at: now + 4 * 60_000 }), now)).toBe(true);
    expect(needsRefresh(session({ expires_at: now + 10 * 60_000 }), now)).toBe(false);
    expect(ADMIN_IDLE_MS).toBe(30 * 60_000);
    expect(idleExpired(now - 29 * 60_000, now)).toBe(false);
    expect(idleExpired(now - 31 * 60_000, now)).toBe(true);
    expect(idleExpired(0, now)).toBe(true);
  });

  it('keeps the session per tab and drops it when idle, clearing the old per-page sessions too', () => {
    const store = new MemoryStorage() as unknown as Storage;
    store.setItem('omc:v1:shop-admin', '{"access_token":"old"}');
    saveSession(session(), store);
    expect(loadSession(Date.now(), store)?.email).toBe('owner@example.com');
    expect(loadSession(Date.now() + ADMIN_IDLE_MS + 1000, store)).toBeNull();
    expect(store.getItem('omc:v1:admin')).toBeNull();
    expect(store.getItem('omc:v1:shop-admin')).toBeNull();
    saveSession(session(), store);
    clearSession(store);
    expect(loadSession(Date.now(), store)).toBeNull();
  });

  it('signs in with a password and reports the session as aal1', async () => {
    const { auth, calls } = fakeAuth({
      'POST /token?grant_type=password': [200, { access_token: token({ aal: 'aal1' }), refresh_token: 'r', expires_in: 3600, user: { email: 'owner@example.com' } }],
    });
    const s = await auth.signIn('owner@example.com', 'pw');
    expect(s.aal).toBe('aal1');
    expect(calls[0].body).toEqual({ email: 'owner@example.com', password: 'pw' });
  });

  it('turns wrong passwords and rate limits into plain messages', async () => {
    await expect(fakeAuth({ 'POST /token?grant_type=password': [400, { msg: 'Invalid login credentials' }] }).auth.signIn('a@b.c', 'x')).rejects.toThrow(
      'didn’t match',
    );
    await expect(fakeAuth({ 'POST /token?grant_type=password': [429, {}] }).auth.signIn('a@b.c', 'x')).rejects.toThrow('Too many attempts');
  });

  it('enrolls an authenticator after removing unfinished attempts', async () => {
    const { auth, calls } = fakeAuth({
      'DELETE /factors/old': [200, {}],
      'POST /factors': [200, { id: 'f1', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABC', uri: 'otpauth://x' } }],
    });
    const s = session({ aal: 'aal1' });
    const e = await auth.enroll(s, [
      { id: 'old', factor_type: 'totp', status: 'unverified' },
      { id: 'keep', factor_type: 'totp', status: 'verified' },
    ]);
    expect(e).toEqual({ id: 'f1', qr: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABC' });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['DELETE /factors/old', 'POST /factors']);
    expect((calls[1].body as { factor_type: string }).factor_type).toBe('totp');
    expect(calls.every((c) => c.auth === `Bearer ${s.access_token}`)).toBe(true);
  });

  it('verifies a code and returns the upgraded aal2 session', async () => {
    const { auth, calls } = fakeAuth({
      'POST /factors/f1/challenge': [200, { id: 'c1' }],
      'POST /factors/f1/verify': [200, { access_token: token({ aal: 'aal2' }), refresh_token: 'r2', expires_in: 3600, user: { email: 'owner@example.com' } }],
    });
    const s = await auth.verify(session({ aal: 'aal1' }), 'f1', '123456');
    expect(s.aal).toBe('aal2');
    expect(s.refresh_token).toBe('r2');
    expect(calls[1].body).toEqual({ challenge_id: 'c1', code: '123456' });
  });

  it('explains a wrong code', async () => {
    const { auth } = fakeAuth({ 'POST /factors/f1/challenge': [200, { id: 'c1' }], 'POST /factors/f1/verify': [422, { msg: 'Invalid TOTP code entered' }] });
    await expect(auth.verify(session(), 'f1', '000000')).rejects.toThrow('That code didn’t work');
  });

  it('lists only authenticator-app factors', async () => {
    const { auth } = fakeAuth({
      'GET /user': [200, { factors: [{ id: 'a', factor_type: 'totp', status: 'verified' }, { id: 'b', factor_type: 'phone', status: 'verified' }] }],
    });
    expect((await auth.factors(session())).map((x) => x.id)).toEqual(['a']);
  });
});

describe('shop-admin requires an MFA session and audit-logs changes', () => {
  const ADMIN = '11111111-1111-4111-8111-111111111111';
  const setup = () => {
    const rpcs: { name: string; body: Record<string, unknown> }[] = [];
    const f = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: ADMIN, email: 'owner@example.com' }));
      const rpc = url.match(/\/rest\/v1\/rpc\/(\w+)$/)?.[1];
      if (rpc) {
        rpcs.push({ name: rpc, body: JSON.parse(String(init.body ?? '{}')) });
        return new Response(rpc === 'shop_is_admin_user' ? 'true' : 'null');
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;
    const env: Record<string, string> = { SUPABASE_URL: 'https://p.supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' };
    const handler = createAdminHandler(depsFromEnv((k) => env[k], f));
    const call = (tok: string, body: unknown) =>
      handler(new Request('https://fn.test/', { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    return { rpcs, call };
  };

  it('refuses a password-only (aal1) session before touching data', async () => {
    const { rpcs, call } = setup();
    const res = await call(token({ sub: ADMIN, aal: 'aal1' }), { action: 'whoami' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'mfa_required' });
    expect(rpcs).toEqual([]);
  });

  it('records a change in the audit log without notes or addresses', async () => {
    const { rpcs, call } = setup();
    const orderId = '22222222-2222-4222-8222-222222222222';
    const res = await call(token({ sub: ADMIN, aal: 'aal2' }), { action: 'note', order_id: orderId, note: 'Customer lives at 1 Main St' });
    expect(res.status).toBe(200);
    const log = rpcs.find((r) => r.name === 'admin_log_service');
    expect(log?.body).toEqual({ p_actor: ADMIN, p_action: 'shop.note', p_target: `order:${orderId}`, p_detail: {} });
    expect(JSON.stringify(log)).not.toContain('Main St');
  });

  it('does not log read-only actions', async () => {
    const { rpcs, call } = setup();
    expect((await call(token({ sub: ADMIN, aal: 'aal2' }), { action: 'whoami' })).status).toBe(200);
    expect(rpcs.map((r) => r.name)).toEqual(['shop_is_admin_user']);
  });

  it('keeps only small, known fields in the audit detail', () => {
    expect(tokenAal(token({ aal: 'aal2' }))).toBe('aal2');
    expect(tokenAal('garbage')).toBeNull();
    const d = auditDetail({ action: 'fulfillment', order_id: 'o1', status: 'shipped', carrier: 'USPS', tracking_number: '9400', notify: true, address: 'x' });
    expect(d).toEqual({ target: 'order:o1', detail: { status: 'shipped', carrier: 'USPS', notify: true } });
    expect(auditDetail({ action: 'product', product_id: 'p1', fields: { price_cents: 100, name: 'x' } }).detail).toEqual({ fields: ['price_cents', 'name'] });
  });
});

describe('overview helpers', () => {
  const alert = (key: string, severity: AlertRow['severity'], first_seen: string, acked_at: string | null = null): AlertRow => ({
    key,
    severity,
    area: 'orders',
    title: key,
    detail: null,
    link: null,
    first_seen,
    last_seen: first_seen,
    acked_at,
  });

  it('puts unseen critical alerts first, oldest first', () => {
    const sorted = sortAlerts([
      alert('info', 'info', '2026-10-01'),
      alert('warn-new', 'warning', '2026-10-10'),
      alert('crit-seen', 'critical', '2026-10-01', '2026-10-02'),
      alert('crit', 'critical', '2026-10-05'),
      alert('warn-old', 'warning', '2026-10-02'),
    ]);
    expect(sorted.map((a) => a.key)).toEqual(['crit', 'warn-old', 'warn-new', 'info', 'crit-seen']);
  });

  it('links only inside the admin', () => {
    expect(safeAdminLink('/admin/orders?tab=inventory')).toBe('/admin/orders?tab=inventory');
    expect(safeAdminLink('/admin')).toBe('/admin');
    expect(safeAdminLink('https://evil.example/admin')).toBeNull();
    expect(safeAdminLink('javascript:alert(1)')).toBeNull();
    expect(safeAdminLink('/administrator')).toBeNull();
  });

  it('formats money', () => {
    expect(usd(3400)).toBe('$34');
    expect(usd(3450)).toBe('$34.50');
  });
});

describe('pages helpers', () => {
  const page = (over: Partial<PageRow>): PageRow => ({
    path: '/x',
    title: 'X',
    h1: null,
    type: 'page',
    indexable: true,
    redirect_to: null,
    in_sitemap: true,
    in_nav: false,
    inbound_links: 1,
    orphan: false,
    ctas: [],
    source_file: 'src/pages/x.astro',
    build_sha: 'abc1234',
    first_seen: '',
    last_seen: '',
    removed_at: null,
    ...over,
  });

  it('filters by type, status and search', () => {
    const rows = [
      page({ path: '/weekly-reset', type: 'offer', indexable: false }),
      page({ path: '/real-life-reset-kit', type: 'offer', indexable: false, orphan: true }),
      page({ path: '/calendar', type: 'offer', ctas: [{ placement: 'p', label: 'Buy', href: '/gone', broken: 'missing page' }] }),
      page({ path: '/resources/a', type: 'article', title: 'Meal planning' }),
    ];
    expect(filterPages(rows, { type: 'offer', status: '', q: '' })).toHaveLength(3);
    expect(filterPages(rows, { type: '', status: 'orphan', q: '' }).map((r) => r.path)).toEqual(['/real-life-reset-kit']);
    expect(filterPages(rows, { type: '', status: 'problems', q: '' }).map((r) => r.path)).toEqual(['/calendar']);
    expect(filterPages(rows, { type: '', status: 'noindex', q: '' })).toHaveLength(2);
    expect(filterPages(rows, { type: '', status: '', q: 'meal' }).map((r) => r.path)).toEqual(['/resources/a']);
  });

  it('builds GitHub and live links only from safe values', () => {
    expect(sourceUrl({ source_file: 'src/pages/planner/[access].astro', build_sha: 'abc1234' })).toBe(
      'https://github.com/Mark-NYC/organized-mom-collective/blob/abc1234/src/pages/planner/[access].astro',
    );
    expect(sourceUrl({ source_file: '../../etc/passwd', build_sha: null })).toBeNull();
    expect(sourceUrl({ source_file: null, build_sha: null })).toBeNull();
    expect(liveUrl('/calendar')).toBe('https://www.organizedmomcollective.com/calendar');
    expect(liveUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('admin nav', () => {
  it('links only to pages that exist', () => {
    const files = new Set(readdirSync('src/pages/admin').map((f) => `/admin/${f.replace(/\.astro$/, '')}`.replace(/\/index$/, '')));
    files.add('/survey/admin');
    for (const s of ADMIN_SECTIONS.filter((x) => x.href)) expect(files, s.label).toContain(s.href!.split('?')[0]);
    for (const s of ADMIN_SECTIONS.filter((x) => !x.href)) expect(s.pending, s.label).toBeTruthy();
  });
});

describe('relative times', () => {
  it('reads naturally', async () => {
    const { ago } = await import('../src/lib/admin/overview');
    const now = Date.parse('2026-10-16T12:00:00Z');
    expect(ago('2026-10-16T11:59:30Z', now)).toBe('just now');
    expect(ago('2026-10-15T12:00:00Z', now)).toBe('1 day ago');
    expect(ago('2026-10-13T12:00:00Z', now)).toBe('3 days ago');
  });
});
