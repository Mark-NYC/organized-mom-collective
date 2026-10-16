import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { routes } from '../src/routes';
import { FAQS, LIMITS, POLICY, RETURNS_LINE, SUPPORT_TOPICS, greetingName, normalizeSupport, validateSupport } from '../src/data/support';
import { photoName, sendSupportRequest } from '../src/lib/support';
import { acknowledgmentEmail, createSupportHandler, inboxEmail, readPhoto } from '../supabase/functions/_shared/handlers/support';
import { readEnv } from '../supabase/functions/_shared/env';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const good = { name: 'Jane  Doe', email: ' Jane@Example.com ', order: '3123456789', topic: 'damaged', message: 'The corner of my calendar arrived bent.' };
const jpeg = '/9j/' + 'A'.repeat(400);

describe('support data', () => {
  it('holds the approved calendar terms', () => {
    expect(POLICY.returnWindowDays).toBe(14);
    expect(POLICY.refundStartBusinessDays).toBe(5);
    expect(POLICY.effective).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(RETURNS_LINE).toBe('14-day returns on unused calendars. If your order arrives damaged or incorrect, we’ll make it right.');
    expect(SUPPORT_TOPICS.map((t) => t.label)).toEqual([
      'Orders & Shipping',
      'Returns & Refunds',
      'Damaged or Incorrect Orders',
      'Using Your Calendar',
      'Cleaning Companion Website',
      'Other Questions',
    ]);
  });
  it('answers every required question, without app or future-feature language', () => {
    const qs = FAQS.map((f) => f.q);
    for (const q of ['How do I return my calendar?', 'What if my calendar arrives damaged?', 'Can I cancel my order?', 'When will I receive my refund?', 'How do I track my order?', 'How do I access the cleaning companion website?', 'Is the companion website included with my calendar?', 'Do I need to download an app?', 'Can I exchange my calendar?', 'How do I contact someone?']) {
      expect(qs).toContain(q);
    }
    for (const f of FAQS) {
      // "an app" appears only to say it isn't one.
      if (f.q !== 'Do I need to download an app?') expect(f.a).not.toMatch(/\bapp\b/i);
      expect(f.a).not.toMatch(/coming soon|will be able|\bsync/i);
      expect(SUPPORT_TOPICS.some((t) => t.id === f.topic)).toBe(true);
    }
  });
  it('the database migration accepts exactly the same topics and limits', () => {
    const sql = readFileSync('supabase/migrations/20261019000000_support_requests.sql', 'utf8');
    const ids = SUPPORT_TOPICS.map((t) => `'${t.id}'`).join(', ');
    expect(sql.split(`in (${ids})`).length).toBe(3);
    expect(sql).toContain(`char_length(message) between ${LIMITS.messageMin} and ${LIMITS.message}`);
    expect(sql).toContain(`char_length(name) between 1 and ${LIMITS.name}`);
    expect(sql).toContain(`char_length(order_number) <= ${LIMITS.order}`);
    // Never readable or writable from the browser.
    expect(sql).toContain('revoke all on public.support_requests from public, anon, authenticated');
    expect(sql).not.toMatch(/grant [^;]* to (anon|authenticated)/);
  });
  it('routes, and /refunds redirects permanently to /returns', () => {
    expect(routes.support).toBe('/support');
    expect(routes.returns).toBe('/returns');
    expect(readFileSync('astro.config.mjs', 'utf8')).toContain(`'/refunds': '/returns'`);
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(vercel.redirects).toContainEqual({ source: '/refunds', destination: '/returns', permanent: true });
  });
  it('keeps the downloads’ 30-day guarantee word for word', () => {
    const page = readFileSync('src/pages/returns.astro', 'utf8').replace(/\s+/g, ' ');
    expect(page).toContain(
      'Every download (the Weekly Reset System, Take Back Control, the Essential Routines Bundle and the Real Life Reset Kit) comes with a 30-day money-back guarantee. Use it for 30 days from your purchase. If it isn’t helping, email us and we’ll refund every penny. No questions asked, nothing to send back. Once you’re refunded, your download link stops working.',
    );
  });
  it('damage has no cutoff; change-of-mind has no exchanges', () => {
    const damaged = FAQS.find((f) => f.q === 'What if my calendar arrives damaged?')!.a;
    expect(damaged).toContain('no 14-day cutoff');
    expect(damaged).not.toMatch(/within \d+ days/);
    expect(FAQS.find((f) => f.q === 'Can I exchange my calendar?')!.a).toMatch(/don’t offer direct exchanges for change-of-mind returns.*replace it for free/);
    const page = readFileSync('src/pages/returns.astro', 'utf8').replace(/\s+/g, ' ');
    expect(page).toContain('return window doesn’t apply here');
    expect(page).toContain('Etsy orders through Etsy, website orders through our secure checkout');
  });
  it('never touches marketing contacts', () => {
    for (const f of ['supabase/migrations/20261019000000_support_requests.sql', 'supabase/functions/_shared/handlers/support.ts', 'src/lib/support.ts', 'src/pages/support.astro']) {
      const code = readFileSync(f, 'utf8');
      expect(code).not.toMatch(/tool_email|marketing_opt_in|tool_email_signup|starter_kit_signup/);
    }
  });
});

describe('validation', () => {
  it('normalizes and accepts a good request', () => {
    const v = normalizeSupport(good);
    expect(v).toEqual({ name: 'Jane Doe', email: 'jane@example.com', order: '3123456789', topic: 'damaged', message: 'The corner of my calendar arrived bent.' });
    expect(validateSupport(v)).toEqual({});
    expect(validateSupport(normalizeSupport({ ...good, order: '' }))).toEqual({});
  });
  it('names each bad field', () => {
    const e = validateSupport(normalizeSupport({ name: '', email: 'nope', order: '<b>', topic: 'refund-me', message: 'hi' }));
    expect(Object.keys(e).sort()).toEqual(['email', 'message', 'name', 'order', 'topic']);
    expect(validateSupport(normalizeSupport({ ...good, message: 'x'.repeat(LIMITS.message + 1) })).message).toBeTruthy();
  });
  it('greets by a plain first name only', () => {
    expect(greetingName('Jane Doe')).toBe('Jane');
    expect(greetingName('Zoë')).toBe('Zoë');
    expect(greetingName('http://spam.example')).toBe('');
    expect(greetingName('Win$$$ now')).toBe('');
  });
});

describe('photos', () => {
  it('accepts a small JPEG only', () => {
    expect(readPhoto(undefined)).toBeNull();
    expect(readPhoto({ name: 'IMG 0042.HEIC', data: jpeg })).toEqual({ filename: 'img-0042.jpg', content: jpeg });
    expect(readPhoto({ name: 'x.png', data: 'iVBORw0KGgo' + 'A'.repeat(400) })).toBe('bad');
    expect(readPhoto({ name: 'x', data: '/9j/<script>' })).toBe('bad');
    expect(readPhoto({ name: 'x', data: '/9j/' + 'A'.repeat(Math.ceil(LIMITS.photoBytes * 1.4)) })).toBe('bad');
    expect(photoName('My Photo!.png')).toBe('my-photo.jpg');
  });
});

describe('emails', () => {
  const input = normalizeSupport(good);
  it('acknowledgment: the approved copy and reference, never her message', () => {
    const msg = acknowledgmentEmail(input, 'OMC-ABC234', 'https://organizedmomcollective.com');
    expect(msg.subject).toBe('We received your message | Organized Mom Collective');
    expect(msg.text).toContain('Hi Jane,');
    expect(msg.text).toContain('Thanks for reaching out! We’ve received your message and will take a look.');
    expect(msg.text).toContain('We aim to respond within one business day.');
    expect(msg.text).toContain('Thanks for being part of Organized Mom Collective!');
    expect(msg.text).toContain('OMC-ABC234');
    expect(msg.text).not.toContain('arrived bent');
  });
  it('inbox copy: every detail, escaped', () => {
    const msg = inboxEmail({ ...input, message: 'It was <b>bent</b> & torn' }, 'OMC-ABC234', true, 'https://organizedmomcollective.com');
    expect(msg.subject).toBe('[OMC-ABC234] Damaged or Incorrect Orders: Jane Doe');
    expect(msg.html).toContain('It was &lt;b&gt;bent&lt;/b&gt; &amp; torn');
    expect(msg.text).toContain('Order number: 3123456789');
    expect(msg.text).toContain('Photo: Attached');
  });
});

function harness(opts: { submit?: unknown; sendFails?: (to: string, from?: string) => Error | null; configured?: boolean; dbFails?: boolean }) {
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const sends: { to: string; subject: string; key?: string; from?: string; replyTo?: string; attachments?: unknown[] }[] = [];
  const env = readEnv((k) => ({ SHOP_EMAIL_FROM: 'OMC <orders@organizedmomcollective.com>', SHOP_EMAIL_REPLY_TO: 'help@example.com' } as Record<string, string>)[k]);
  const deps = {
    env,
    db: {
      rpc: async (name: string, args: Record<string, unknown> = {}) => {
        rpcs.push({ name, args });
        if (opts.dbFails) throw new Error('db down');
        return name === 'support_submit' ? (opts.submit ?? { status: 'ok', id: '11111111-1111-1111-1111-111111111111', reference: 'OMC-ABC234', ack: true }) : null;
      },
      select: async () => [],
    },
    mailer: {
      configured: opts.configured ?? true,
      send: async (to: string, msg: { subject: string }, key?: string, o?: { from?: string; replyTo?: string; attachments?: unknown[] }) => {
        sends.push({ to, subject: msg.subject, key, from: o?.from, replyTo: o?.replyTo, attachments: o?.attachments });
        const err = opts.sendFails?.(to, o?.from);
        if (err) throw err;
        return { id: `email_${sends.length}` };
      },
    },
    stripe: {} as never,
    fetch,
    now: () => 1_792_000_000,
  };
  const handler = createSupportHandler(deps as never);
  const call = (body: unknown) =>
    handler(new Request('https://fn/support-request', { method: 'POST', headers: { origin: 'https://www.organizedmomcollective.com', 'x-forwarded-for': '1.2.3.4' }, body: JSON.stringify(body) }));
  return { call, rpcs, sends, env };
}

describe('support-request function', () => {
  it('saves the request, emails the inbox (reply-to her, photo attached) and acknowledges her', async () => {
    const h = harness({});
    const res = await h.call({ ...good, website: '', photo: { name: 'bent.jpg', data: jpeg } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', reference: 'OMC-ABC234', acknowledged: true });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://www.organizedmomcollective.com');
    expect(h.rpcs[0]).toEqual({
      name: 'support_submit',
      args: { p_name: 'Jane Doe', p_email: 'jane@example.com', p_order: '3123456789', p_topic: 'damaged', p_message: good.message, p_has_photo: true, p_client: '1.2.3.4', p_website: '' },
    });
    const [inbox, ack] = h.sends;
    expect(inbox).toMatchObject({ to: 'help@example.com', replyTo: 'jane@example.com', from: 'Organized Mom Collective <hello@organizedmomcollective.com>', attachments: [{ filename: 'bent.jpg', content: jpeg }] });
    expect(ack).toMatchObject({ to: 'jane@example.com', replyTo: 'help@example.com', subject: 'We received your message | Organized Mom Collective' });
    expect(ack.attachments).toBeUndefined();
    expect(h.rpcs.slice(1).map((r) => r.args)).toEqual([
      { p_id: '11111111-1111-1111-1111-111111111111', p_kind: 'notify', p_status: 'sent' },
      { p_id: '11111111-1111-1111-1111-111111111111', p_kind: 'ack', p_status: 'sent' },
    ]);
  });
  it('SUPPORT_INBOX wins over the reply-to address', () => {
    expect(readEnv((k) => ({ SUPPORT_INBOX: 'support@x.com', SHOP_EMAIL_REPLY_TO: 'help@x.com' } as Record<string, string>)[k]).supportInbox).toBe('support@x.com');
    expect(readEnv(() => undefined).supportInbox).toBe('contact@organizedmomcollective.com');
  });
  it('rejects bad input before touching the database', async () => {
    const h = harness({});
    const res = await h.call({ ...good, email: 'nope' });
    expect(res.status).toBe(400);
    expect((await res.json()).fields.email).toBeTruthy();
    const photo = await h.call({ ...good, photo: { name: 'x', data: 'not-an-image' } });
    expect(await photo.json()).toEqual({ status: 'photo' });
    expect(h.rpcs).toHaveLength(0);
    expect(h.sends).toHaveLength(0);
  });
  it('rate limits, and treats the honeypot as invalid', async () => {
    const limited = harness({ submit: { status: 'rate_limited' } });
    const res = await limited.call(good);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ status: 'rate_limited' });
    expect(limited.sends).toHaveLength(0);
    const bot = harness({ submit: { status: 'invalid' } });
    expect((await bot.call({ ...good, website: 'spam.example' })).status).toBe(400);
    expect(bot.rpcs[0].args.p_website).toBe('spam.example');
  });
  it('a saved request still succeeds when an email fails; the failure is recorded', async () => {
    const h = harness({ sendFails: (to) => (to === 'help@example.com' ? new Error('Service unavailable') : null) });
    expect(await (await h.call(good)).json()).toEqual({ status: 'ok', reference: 'OMC-ABC234', acknowledged: true });
    expect(h.rpcs.find((r) => r.args.p_kind === 'notify')?.args.p_status).toBe('failed');
  });
  it('falls back to the shop sender when Resend refuses the support sender', async () => {
    const h = harness({ sendFails: (_to, from) => (from?.includes('hello@') ? new Error('domain is not verified') : null) });
    expect((await (await h.call(good)).json()).acknowledged).toBe(true);
    expect(h.sends.filter((s) => !s.from)).toHaveLength(2);
  });
  it('skips the acknowledgment once an address has had enough today', async () => {
    const h = harness({ submit: { status: 'ok', id: '11111111-1111-1111-1111-111111111111', reference: 'OMC-ABC234', ack: false } });
    expect(await (await h.call(good)).json()).toEqual({ status: 'ok', reference: 'OMC-ABC234', acknowledged: false });
    expect(h.sends.map((s) => s.to)).toEqual(['help@example.com']);
    expect(h.rpcs.find((r) => r.args.p_kind === 'ack')?.args.p_status).toBe('limited');
  });
  it('skips emails without a provider, and reports a database failure as an error', async () => {
    const off = harness({ configured: false });
    expect(await (await off.call(good)).json()).toEqual({ status: 'ok', reference: 'OMC-ABC234', acknowledged: false });
    expect(off.sends).toHaveLength(0);
    const down = harness({ dbFails: true });
    expect((await down.call(good)).status).toBe(500);
  });
});

describe('support form client', () => {
  it('sends the cleaned fields and reads the outcome', async () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon');
    vi.resetModules();
    const { sendSupportRequest: fresh } = await import('../src/lib/support');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', reference: 'OMC-ABC234', acknowledged: true }) });
    vi.stubGlobal('fetch', fetcher);
    expect(await fresh(good, '', null)).toEqual({ ok: true, reference: 'OMC-ABC234', acknowledged: true });
    expect(fetcher.mock.calls[0][0]).toBe('https://x.supabase.co/functions/v1/support-request');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ ...normalizeSupport(good), website: '', photo: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ status: 'rate_limited' }) }));
    expect(await fresh(good, '', null)).toEqual({ ok: false, reason: 'rate_limited' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fresh(good, '', null)).toEqual({ ok: false, reason: 'error' });
  });
  it('catches bad fields without calling the server', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const r = await sendSupportRequest({ ...good, topic: '' }, '', null);
    expect(r).toEqual({ ok: false, reason: 'invalid', fields: { topic: 'Please choose a topic.' } });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ approved returns

import { addressLines, createSupportReturnHandler, returnInstructionsEmail } from '../supabase/functions/_shared/handlers/support-return';
import { readdirSync, statSync } from 'node:fs';

const ADDRESS = 'Test Return Desk|1 Example Lane|Sampletown, NY 10000';
const claimedRow = { reference: 'OMC-ABC234', name: 'Jane Doe', email: 'jane@example.com', order_number: '3123', topic: 'returns' };

function returnHarness(opts: { address?: string; secret?: string; claimed?: unknown[]; sendFails?: boolean; configured?: boolean }) {
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const sends: { to: string; text: string; replyTo?: string }[] = [];
  const env = readEnv((k) => ({
    SHOP_EMAIL_FROM: 'OMC <orders@organizedmomcollective.com>',
    SHOP_EMAIL_REPLY_TO: 'help@example.com',
    RETURN_ADDRESS: opts.address ?? ADDRESS,
    SUPPORT_WEBHOOK_SECRET: opts.secret ?? 'hook-secret',
  } as Record<string, string>)[k]);
  const errors: unknown[] = [];
  vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a); });
  const deps = {
    env,
    db: {
      rpc: async (name: string, args: Record<string, unknown> = {}) => {
        rpcs.push({ name, args });
        return name === 'support_return_claim' ? (opts.claimed ?? [claimedRow]) : null;
      },
      select: async () => [],
    },
    mailer: {
      configured: opts.configured ?? true,
      send: async (to: string, msg: { text: string }, _key?: string, o?: { replyTo?: string }) => {
        sends.push({ to, text: msg.text, replyTo: o?.replyTo });
        if (opts.sendFails) throw new Error('Service unavailable');
        return { id: 'e1' };
      },
    },
    stripe: {} as never,
    fetch,
    now: () => 1_792_000_000,
  };
  const handler = createSupportReturnHandler(deps as never);
  const id = '11111111-1111-1111-1111-111111111111';
  const call = (record: Record<string, unknown> = { id, return_status: 'approved' }, secret = 'hook-secret', extra: Record<string, unknown> = {}) =>
    handler(new Request('https://fn/support-return', { method: 'POST', headers: { 'x-webhook-secret': secret }, body: JSON.stringify({ type: 'UPDATE', table: 'support_requests', schema: 'public', record, old_record: {}, ...extra }) }));
  return { call, rpcs, sends, errors };
}

describe('return address: approved returns only', () => {
  it('parses the secret into lines and rejects junk', () => {
    expect(addressLines(ADDRESS)).toEqual(['Test Return Desk', '1 Example Lane', 'Sampletown, NY 10000']);
    expect(addressLines('Test Return Desk\n1 Example Lane\nSampletown, NY 10000')).toHaveLength(3);
    expect(addressLines('')).toBeNull();
    expect(addressLines('just one line')).toBeNull();
  });
  it('emails the approved customer once, with the address, reply-to the support inbox', async () => {
    const h = returnHarness({});
    expect(await (await h.call()).json()).toEqual({ status: 'sent', reference: 'OMC-ABC234' });
    expect(h.sends).toHaveLength(1);
    expect(h.sends[0]).toMatchObject({ to: 'jane@example.com', replyTo: 'help@example.com' });
    expect(h.sends[0].text).toContain('1 Example Lane');
    expect(h.sends[0].text).toContain('OMC-ABC234');
    expect(h.sends[0].text).toContain('Return postage is yours to cover');
    expect(h.rpcs.map((r) => [r.name, r.args.p_status])).toEqual([['support_return_claim', undefined], ['support_return_result', 'sent']]);
  });
  it('never sends twice: an already-claimed request sends nothing', async () => {
    const h = returnHarness({ claimed: [] });
    expect(await (await h.call()).json()).toEqual({ status: 'already_sent' });
    expect(h.sends).toHaveLength(0);
  });
  it('requires approval and the webhook secret', async () => {
    const h = returnHarness({});
    expect(await (await h.call({ id: '11111111-1111-1111-1111-111111111111', return_status: 'requested' })).json()).toEqual({ status: 'ignored' });
    expect((await h.call(undefined, 'wrong')).status).toBe(401);
    expect((await returnHarness({ secret: '' }).call()).status).toBe(503);
    expect(await (await h.call(undefined, 'hook-secret', { table: 'shop_orders' })).json()).toEqual({ status: 'ignored' });
    expect(h.sends).toHaveLength(0);
    expect(h.rpcs).toHaveLength(0);
  });
  it('without a configured address: nothing sent, recorded as no_address, address never logged', async () => {
    const h = returnHarness({ address: '' });
    expect(await (await h.call()).json()).toEqual({ status: 'no_address' });
    expect(h.sends).toHaveLength(0);
    expect(h.rpcs[1].args.p_status).toBe('no_address');
  });
  it('a failed send releases the claim and logs no address', async () => {
    const h = returnHarness({ sendFails: true });
    expect(await (await h.call()).json()).toEqual({ status: 'failed' });
    expect(h.rpcs[1].args.p_status).toBe('failed');
    expect(JSON.stringify(h.errors)).not.toContain('Example Lane');
  });
  it('damaged or incorrect orders: no postage for the customer', () => {
    const msg = returnInstructionsEmail({ ...claimedRow, topic: 'damaged' }, ['A', 'B'], 'https://organizedmomcollective.com');
    expect(msg.text).toContain('you won’t pay for postage');
    expect(msg.text).not.toContain('Return postage is yours');
  });
  it('the acknowledgment and the inbox copy never carry the address, even when it is configured', async () => {
    const h = harness({});
    await h.call({ ...good, topic: 'returns' });
    const all = JSON.stringify(h.sends);
    expect(all).not.toContain('Example Lane');
    expect(acknowledgmentEmail(normalizeSupport(good), 'OMC-X', 'https://x').text).not.toMatch(/return address|Example Lane/);
  });
  it('only the support-return function reads RETURN_ADDRESS; never the site or a PUBLIC_ variable', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const path = `${dir}/${f}`;
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    const readers = [...walk('src'), ...walk('supabase/functions'), ...walk('scripts'), ...walk('public').filter((f) => /\.(js|html|json|txt)$/.test(f))]
      .filter((f) => /RETURN_ADDRESS|returnAddress/.test(readFileSync(f, 'utf8')));
    expect(readers.sort()).toEqual(['supabase/functions/_shared/env.ts', 'supabase/functions/_shared/handlers/support-return.ts']);
    expect(readFileSync('.env.example', 'utf8')).not.toMatch(/RETURN_ADDRESS/);
  });
});
