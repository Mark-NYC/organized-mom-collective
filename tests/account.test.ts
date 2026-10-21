import { describe, expect, it } from 'vitest';
import { labelFromKey, reconcile, safeNext, syncableKey } from '../src/lib/account';
import { createDownloadHandler } from '../supabase/functions/_shared/handlers/download.ts';
import { DbError } from '../supabase/functions/_shared/db.ts';
import type { ShopDeps } from '../supabase/functions/_shared/deps.ts';

describe('account sync keys', () => {
  it('syncs tool and element keys', () => {
    expect(syncableKey('omc:chore-chart:v1')).toBe(true);
    expect(syncableKey('omc:organized-family-habits-builder:v1')).toBe(true);
    expect(syncableKey('omc:skylight-vs-paper-picker:v1')).toBe(true);
  });
  it('never syncs the companion, the session or the download gate (same rule as the database)', () => {
    expect(syncableKey('omc:v1:progress')).toBe(false);
    expect(syncableKey('omc:v1:admin')).toBe(false);
    expect(syncableKey('omc:account:session')).toBe(false);
    expect(syncableKey('omc:account:sync')).toBe(false);
    expect(syncableKey('omc:tool-download-access:v1')).toBe(false);
    expect(syncableKey('somebody-else')).toBe(false);
    expect(syncableKey('omc:Upper:v1')).toBe(false);
    expect(syncableKey(`omc:${'a'.repeat(130)}:v1`)).toBe(false);
  });
  it('labels a key without a recorded page title', () => {
    expect(labelFromKey('omc:organized-family-habits-builder:v1')).toBe('Organized family habits builder');
  });
});

describe('sign-in return path', () => {
  it('accepts only on-site paths', () => {
    expect(safeNext('/resources/organized-family-habits')).toBe('/resources/organized-family-habits');
    expect(safeNext('/chore-chart')).toBe('/chore-chart');
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext('/x?y=javascript:1')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe('reconcile', () => {
  const at1 = '2026-10-21T10:00:00Z';
  const at2 = '2026-10-21T12:00:00Z';

  it('a new device takes the account copy, even if it has its own', () => {
    expect(reconcile({}, ['omc:chore-chart:v1'], [{ key: 'omc:chore-chart:v1', updated_at: at1 }])).toEqual({ pull: ['omc:chore-chart:v1'], push: [] });
  });
  it('uploads what only this browser has', () => {
    expect(reconcile({}, ['omc:planner:v1'], [])).toEqual({ pull: [], push: ['omc:planner:v1'] });
  });
  it('downloads what only the account has', () => {
    expect(reconcile({}, [], [{ key: 'omc:planner:v1', updated_at: at1 }])).toEqual({ pull: ['omc:planner:v1'], push: [] });
  });
  it('uploads a change made here since the last sync', () => {
    expect(reconcile({ 'omc:planner:v1': { at: at1, dirty: true } }, ['omc:planner:v1'], [{ key: 'omc:planner:v1', updated_at: at1 }])).toEqual({ pull: [], push: ['omc:planner:v1'] });
  });
  it('downloads a change made on another device', () => {
    expect(reconcile({ 'omc:planner:v1': { at: at1 } }, ['omc:planner:v1'], [{ key: 'omc:planner:v1', updated_at: at2 }])).toEqual({ pull: ['omc:planner:v1'], push: [] });
  });
  it('does nothing when both match', () => {
    expect(reconcile({ 'omc:planner:v1': { at: at1 } }, ['omc:planner:v1'], [{ key: 'omc:planner:v1', updated_at: at1 }])).toEqual({ pull: [], push: [] });
  });
  it('leaves a save she removed from her account alone until she changes it again', () => {
    expect(reconcile({ 'omc:planner:v1': { at: at1 } }, ['omc:planner:v1'], [])).toEqual({ pull: [], push: [] });
    expect(reconcile({ 'omc:planner:v1': { at: at1, dirty: true } }, ['omc:planner:v1'], [])).toEqual({ pull: [], push: ['omc:planner:v1'] });
  });
});

describe('shop-download from her account', () => {
  const USER = '22222222-2222-4222-8222-222222222222';
  const ORDER = '33333333-3333-4333-8333-333333333333';
  const calls: { name: string; args: Record<string, unknown> }[] = [];

  const deps = (opts: { authOk?: boolean; rpcError?: string } = {}) =>
    ({
      env: { supabaseUrl: 'https://p.supabase.test', anonKey: 'anon', serviceRoleKey: 'service', allowedOrigins: ['https://organizedmomcollective.com'] },
      fetch: async (url: string | URL) => {
        const u = String(url);
        if (u.endsWith('/auth/v1/user')) return opts.authOk === false ? new Response('{}', { status: 401 }) : Response.json({ id: USER, email: 'mia@example.com' });
        if (u.includes('/storage/v1/object/sign/')) return Response.json({ signedURL: '/object/sign/shop-downloads/guide.pdf?token=t' });
        return new Response('not found', { status: 404 });
      },
      db: {
        rpc: async (name: string, args: Record<string, unknown>) => {
          calls.push({ name, args });
          if (opts.rpcError) throw new DbError(opts.rpcError, 400);
          return { order_number: 1001, livemode: true, expires_at: null, files: [{ path: 'weekly-reset/guide.pdf', label: 'The guide', product: 'The Weekly Reset System' }] };
        },
      },
    }) as unknown as ShopDeps;

  const req = (body: object, token?: string) =>
    new Request('https://p.supabase.test/functions/v1/shop-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'https://organizedmomcollective.com', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });

  it('trades her verified sign-in and an order id for signed file links, with no expiry', async () => {
    calls.length = 0;
    const res = await createDownloadHandler(deps())(req({ order: ORDER }, 'customer-token'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files[0].url).toContain('/storage/v1/object/sign/');
    expect(data.expires_at).toBeNull();
    expect(calls[0]).toMatchObject({ name: 'shop_account_download', args: { p_user: USER, p_order: ORDER } });
  });
  it('refuses a token Supabase Auth rejects, before touching the database', async () => {
    calls.length = 0;
    const res = await createDownloadHandler(deps({ authOk: false }))(req({ order: ORDER }, 'bad-token'));
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it('refuses an order that isn’t hers (the database says invalid_link)', async () => {
    const res = await createDownloadHandler(deps({ rpcError: 'invalid_link' }))(req({ order: ORDER }, 'customer-token'));
    expect(res.status).toBe(404);
  });
  it('refuses a malformed order id', async () => {
    const res = await createDownloadHandler(deps())(req({ order: 'nope' }, 'customer-token'));
    expect(res.status).toBe(404);
  });
  it('an order id without a sign-in is not enough', async () => {
    calls.length = 0;
    const res = await createDownloadHandler(deps())(req({ order: ORDER }));
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });
  it('emailed links still work the old way', async () => {
    calls.length = 0;
    await createDownloadHandler(deps())(req({ token: 'a'.repeat(48) }));
    expect(calls[0].name).toBe('shop_download');
  });
});
