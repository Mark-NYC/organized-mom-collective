import { describe, it, expect, vi, afterEach } from 'vitest';
import { routes } from '../src/routes';
import { KIT_MINUTES, STARTER_KIT_KIT_PATH, STARTER_KIT_PATH, starterKitBonuses, starterKitSteps } from '../src/data/starter-kit';
import { entrySource, signUp } from '../src/lib/starter-kit';
import { starterKitEmail, createStarterKitHandler } from '../supabase/functions/_shared/handlers/starter-kit';
import { readEnv } from '../supabase/functions/_shared/env';
import { existsSync } from 'node:fs';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('starter kit data', () => {
  it('is a 30-minute reset on the real routes, with existing previews', () => {
    expect(STARTER_KIT_PATH).toBe(routes.starterKit);
    expect(STARTER_KIT_KIT_PATH).toBe(routes.starterKitKit);
    expect(starterKitSteps.map((s) => s.minutes)).toEqual([5, 10, 10, 5]);
    expect(starterKitSteps.reduce((t, s) => t + s.minutes, 0)).toBe(KIT_MINUTES);
    expect(starterKitSteps.map((s) => s.tool?.href)).toEqual([routes.mentalLoad, routes.planner, routes.choreChart, undefined]);
    expect(starterKitSteps[3].questions).toEqual(['What’s happening this week?', 'Who’s responsible for what?', 'Where do we need to help each other?']);
    expect(starterKitBonuses.map((b) => b.href)).toEqual([routes.commandCenterSetup, routes.routineChart]);
    const previews = [...starterKitSteps.flatMap((s) => (s.tool ? [s.tool.preview] : [])), ...starterKitBonuses.map((b) => b.preview)];
    for (const p of previews) expect(existsSync(`public/images/tools/previews/${p}.webp`)).toBe(true);
    const ids = [...starterKitSteps.map((s) => s.id), ...starterKitBonuses.map((b) => b.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of starterKitSteps) expect(s.outcome.length).toBeGreaterThan(10);
  });
});

describe('entry source', () => {
  it('prefers ?source=, then the session, then the old members-site referrer', () => {
    expect(entrySource('?source=QR', '', null)).toBe('qr');
    expect(entrySource('?source=weird', '', 'qr')).toBe('other');
    expect(entrySource('', '', 'email')).toBe('email');
    expect(entrySource('', 'https://members.organizedmomcollective.com/landing-starter-kit-free-qr/', null)).toBe('qr');
    expect(entrySource('', 'https://www.google.com/', null)).toBe('direct');
  });
});

describe('signup client', () => {
  it('sends only the email, consent and honeypot, and reads the email outcome', async () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon');
    vi.resetModules();
    const { signUp: fresh } = await import('../src/lib/starter-kit');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', email: 'sent' }) });
    vi.stubGlobal('fetch', fetcher);
    expect(await fresh(' Mom@Example.com ', false, '')).toEqual({ ok: true, email: 'sent' });
    expect(fetcher.mock.calls[0][0]).toBe('https://x.supabase.co/functions/v1/starter-kit-signup');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ email: 'mom@example.com', marketing: false, website: '' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fresh('a@b.com', true, '')).toEqual({ ok: false, reason: 'error' });
  });
  it('rejects a bad address without calling the server', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await signUp('nope', false, '')).toEqual({ ok: false, reason: 'invalid' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('starter kit email', () => {
  it('is a delivery email: the kit link, every step, no sales pitch', () => {
    const msg = starterKitEmail('https://organizedmomcollective.com', 'help@example.com');
    expect(msg.subject).toBe('Your Free 30-Minute Weekly Starter Kit Is Here');
    expect(msg.text).toContain('Take back control in 30 minutes');
    expect(msg.html).toContain('https://organizedmomcollective.com/starter-kit/kit?source=email');
    for (const s of starterKitSteps) expect(msg.text).toContain(`${s.title} (${s.minutes} min)`);
    expect(msg.text).toContain('one-time delivery email');
    expect(msg.text.toLowerCase()).not.toMatch(/calendar|buy|shop|\$/);
  });
});

function harness(opts: { signup: unknown; sendFails?: (from: string) => Error | null; configured?: boolean }) {
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const sends: { to: string; from?: string; key?: string }[] = [];
  const env = readEnv((k) => ({ SHOP_EMAIL_FROM: 'OMC <orders@organizedmomcollective.com>', SHOP_EMAIL_REPLY_TO: 'help@example.com' } as Record<string, string>)[k]);
  const deps = {
    env,
    db: {
      rpc: async (name: string, args: Record<string, unknown> = {}) => { rpcs.push({ name, args }); return name === 'starter_kit_signup' ? opts.signup : null; },
      select: async () => [],
    },
    mailer: {
      configured: opts.configured ?? true,
      send: async (to: string, _msg: unknown, key?: string, o?: { from?: string }) => {
        sends.push({ to, from: o?.from, key });
        const err = opts.sendFails?.(o?.from ?? env.emailFrom);
        if (err) throw err;
        return { id: `email_${sends.length}` };
      },
    },
    stripe: {} as never,
    fetch,
    now: () => 1_792_000_000,
  };
  const handler = createStarterKitHandler(deps as never);
  const call = (body: unknown) => handler(new Request('https://fn/starter-kit-signup', { method: 'POST', headers: { origin: 'https://organizedmomcollective.com', 'x-forwarded-for': '1.2.3.4' }, body: JSON.stringify(body) }));
  return { call, rpcs, sends, env };
}

describe('starter-kit-signup function', () => {
  it('saves the signup with its consent, sends from hello@ and records the result', async () => {
    const h = harness({ signup: { status: 'ok', send: true } });
    const res = await h.call({ email: 'Mom@Example.com', marketing: true, website: '' });
    expect(await res.json()).toEqual({ status: 'ok', email: 'sent' });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://organizedmomcollective.com');
    expect(h.rpcs[0]).toEqual({ name: 'starter_kit_signup', args: { p_email: 'Mom@Example.com', p_marketing: true, p_client: '1.2.3.4', p_website: '' } });
    expect(h.sends).toEqual([{ to: 'mom@example.com', from: 'Organized Mom Collective <hello@organizedmomcollective.com>', key: expect.stringContaining('starter-kit/mom@example.com/') }]);
    expect(h.rpcs[1]).toEqual({ name: 'starter_kit_email_result', args: { p_email: 'mom@example.com', p_status: 'sent', p_provider_id: 'email_1' } });
  });
  it('falls back to the verified shop sender when Resend refuses hello@', async () => {
    const h = harness({ signup: { status: 'ok', send: true }, sendFails: (from) => (from.includes('hello@') ? new Error('The organizedmomcollective.com domain is not verified') : null) });
    expect(await (await h.call({ email: 'a@b.com', marketing: false })).json()).toEqual({ status: 'ok', email: 'sent' });
    expect(h.sends.map((s) => s.from)).toEqual(['Organized Mom Collective <hello@organizedmomcollective.com>', undefined]);
  });
  it('reports a failed email (the page still opens the kit) and releases the claim', async () => {
    const h = harness({ signup: { status: 'ok', send: true }, sendFails: () => new Error('Service unavailable') });
    expect(await (await h.call({ email: 'a@b.com', marketing: false })).json()).toEqual({ status: 'ok', email: 'failed' });
    expect(h.rpcs[1].args.p_status).toBe('failed');
  });
  it('sends nothing when one already went out today, or the signup is refused', async () => {
    const recent = harness({ signup: { status: 'ok', send: false } });
    expect(await (await recent.call({ email: 'a@b.com', marketing: false })).json()).toEqual({ status: 'ok', email: 'recent' });
    expect(recent.sends).toHaveLength(0);
    const limited = harness({ signup: { status: 'rate_limited', send: false } });
    const res = await limited.call({ email: 'a@b.com', marketing: false });
    expect(res.status).toBe(429);
    expect(limited.sends).toHaveLength(0);
    const bad = harness({ signup: { status: 'ok', send: true } });
    expect((await bad.call({ email: 'a@b.com', marketing: 'yes' })).status).toBe(400);
    expect(bad.rpcs).toHaveLength(0);
  });
  it('skips the email when no provider is configured', async () => {
    const h = harness({ signup: { status: 'ok', send: true }, configured: false });
    expect(await (await h.call({ email: 'a@b.com', marketing: false })).json()).toEqual({ status: 'ok', email: 'skipped' });
    expect(h.sends).toHaveLength(0);
  });
});
