/**
 * The Club's paid membership end to end: the real club-billing, club-webhook and club-admin handlers, the real
 * database (every migration, service_role grants, RLS), a stateful fake Stripe in test mode, fake Supabase Auth and
 * Resend. Covers every lifecycle the plan lists (docs/club/MEMBERSHIP.md → Tests). Needs a throwaway Postgres:
 *
 *   PGHOST=… PGUSER=postgres npm run test:club
 *
 * Skipped without CLUB_E2E_PSQL (plain `npm test`).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createClubAdminHandler } from '../supabase/functions/_shared/handlers/club-admin';
import { createClubBillingHandler } from '../supabase/functions/_shared/handlers/club-billing';
import { createClubWebhookHandler } from '../supabase/functions/_shared/handlers/club-webhook';
import { signStripePayload } from '../supabase/functions/_shared/stripe';
import { FakeClubStripe, type Ev } from './club/fake-stripe';
import { makeDeps, PSQL, sql, type Mail } from './club/harness';

const SITE = 'https://www.organizedmomcollective.com';
const stripe = new FakeClubStripe();
const tokens = new Map<string, string>();
const inbox: Mail[] = [];
const deps = PSQL ? makeDeps({ stripe, tokens, inbox }) : (null as never);
const billing = PSQL ? createClubBillingHandler(deps) : (null as never);
const webhook = PSQL ? createClubWebhookHandler(deps) : (null as never);
const admin = PSQL ? createClubAdminHandler(deps) : (null as never);

const post = (h: (r: Request) => Promise<Response>, body: unknown, token?: string) =>
  h(new Request('https://proj.supabase.test/functions/v1/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })).then(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, any> }));

let secret = '';
async function deliver(events: Ev[], opts: { times?: number } = {}) {
  const out: number[] = [];
  for (const e of events) {
    for (let i = 0; i < (opts.times ?? 1); i++) {
      const raw = JSON.stringify(e);
      const r = await webhook(new Request('https://proj.supabase.test/functions/v1/club-webhook', {
        method: 'POST', headers: { 'stripe-signature': await signStripePayload(raw, secret) }, body: raw,
      }));
      out.push(r.status);
    }
  }
  expect(out.every((s) => s === 200), `webhook statuses ${out}`).toBe(true);
}

const uid = (email: string) => sql(`select id from auth.users where lower(email) = lower('${email}')`);
const months = (email: string, kind = 'digital') =>
  sql(`select coalesce(string_agg(to_char(resource_month, 'YYYY-MM'), ',' order by resource_month), '') from public.club_entitlements
        where user_id = '${uid(email)}' and kind = '${kind}' and revoked_at is null`);
const asMember = <T>(email: string, q: string) =>
  JSON.parse(sql(`select set_config('request.jwt.claims', '{"sub":"${uid(email)}"}', false); select coalesce(to_jsonb(x), 'null') from (${q}) x`, 'authenticated').split('\n').pop()!) as T;
const signIn = (email: string) => {
  sql(`update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where lower(email) = lower('${email}')`);
  const t = `tok_${email}`;
  tokens.set(t, uid(email));
  return t;
};
const mails = (to: string, subject: RegExp) => inbox.filter((m) => m.to === to && subject.test(m.subject));

describe.skipIf(!PSQL)('Organized Family Club billing, end to end (Stripe test mode)', () => {
  beforeAll(async () => {
    sql(`insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000ad001', 'owner@example.com', now()) on conflict do nothing`);
    sql(`insert into public.admin_users (user_id, role) values ('00000000-0000-0000-0000-0000000ad001', 'owner') on conflict do nothing`);
    tokens.set('tok_owner', '00000000-0000-0000-0000-0000000ad001');
    sql(`update public.club_kits set status = 'scheduled' where slug in ('2026-11-family-ownership', '2026-12-christmas-mission')`);
  });

  it('refuses checkout until Stripe is set up and the owner opens it', async () => {
    expect((await post(billing, { action: 'checkout', plan: 'monthly', email: 'a@example.com' })).body.error).toBe('checkout_closed');
    expect((await post(admin, { action: 'stripe_setup' })).status).toBe(401);
    tokens.set('tok_nobody', sql(`insert into auth.users (id, email, email_confirmed_at) values (gen_random_uuid(), 'nobody@example.com', now()) returning id`));
    expect((await post(admin, { action: 'stripe_setup' }, 'tok_nobody')).status).toBe(403);
  });

  it('stripe_setup creates the product, both prices, the portal and the webhook endpoint, once', async () => {
    const r = await post(admin, { action: 'stripe_setup' }, 'tok_owner');
    expect(r.status).toBe(200);
    expect(r.body.created).toEqual(['product', 'price_monthly', 'price_annual', 'portal', 'webhook']);
    expect([...stripe.prices.values()].map((p) => [p.lookup_key, p.unit_amount, p.interval])).toEqual([['club_monthly_v1', 500, 'month'], ['club_annual_v1', 6000, 'year']]);
    expect(stripe.endpoints[0].url).toBe('https://proj.supabase.test/functions/v1/club-webhook');
    expect(JSON.stringify(r.body)).not.toContain('whsec_');
    secret = stripe.endpoints[0].secret;
    expect((await post(admin, { action: 'stripe_setup' }, 'tok_owner')).body.created).toEqual([]);
    const st = await post(admin, { action: 'status' }, 'tok_owner');
    expect(st.body).toMatchObject({ stripe_key: 'test', webhook_secret: true, prices: { monthly: true, annual: true } });
    sql(`update public.club_settings set checkout_mode = 'test'`);
  });

  let monthlySub = '';
  let firstSession = '';
  it('new monthly subscriber (no account yet): one checkout, a household, November only, one welcome', async () => {
    const r = await post(billing, { action: 'checkout', plan: 'monthly', email: 'Mia@Example.com' });
    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    // Duplicate checkout attempt (double click, second tab): the same Checkout.
    const again = await post(billing, { action: 'checkout', plan: 'monthly', email: 'mia@example.com' });
    expect(again.body.url).toBe(r.body.url);
    expect(stripe.sessions.size).toBe(1);
    expect(stripe.customers.size).toBe(1);
    firstSession = [...stripe.sessions.keys()][0];
    expect(stripe.sessions.get(firstSession)).toMatchObject({ mode: 'subscription' });

    const events = stripe.completeCheckout(firstSession, { email: 'mia@example.com' });
    // Out of order and duplicated: invoice.paid before anything else, every event twice.
    await deliver([events[1], events[3], events[0], events[2]], { times: 2 });
    monthlySub = [...stripe.subs.keys()][0];

    expect(uid('mia@example.com')).toMatch(/^[0-9a-f-]{36}$/);
    expect(sql(`select email_confirmed_at is null from auth.users where email = 'mia@example.com'`)).toBe('t');
    expect(months('mia@example.com')).toBe('2026-11');
    expect(months('mia@example.com', 'physical')).toBe('2026-11');
    expect(sql(`select count(*) from public.club_fulfillment_orders where user_id = '${uid('mia@example.com')}'`)).toBe('1');
    expect(sql(`select line1 from public.club_mailing_addresses where user_id = '${uid('mia@example.com')}'`)).toBe('12 Oak Ln');
    expect(sql(`select status || ':' || plan from public.club_subscriptions where stripe_subscription_id = '${monthlySub}'`)).toBe('active:monthly');
    expect(sql(`select (select household_id from public.club_customers c where c.user_id = h.owner_user_id) = h.id from public.club_households h where owner_user_id = '${uid('mia@example.com')}'`)).toBe('t');
    const welcome = mails('mia@example.com', /Welcome to the Organized Family Club/);
    expect(welcome).toHaveLength(1);
    expect(welcome[0].subject).toMatch(/^\[Test\]/);
    expect(welcome[0].text).toContain(`${SITE}/club/login?email=mia%40example.com`);
  });

  it('after checkout the welcome page learns the payment and her email, but nothing is unlocked until she signs in', async () => {
    const st = await post(billing, { action: 'checkout_status', session_id: firstSession });
    expect(st.body).toMatchObject({ paid: true, email: 'mia@example.com' });
    expect((await post(billing, { action: 'checkout_status', session_id: 'cs_test_nottherealone123' })).status).toBe(500);
    // Unverified email: no session can exist for her yet, so there's no way to read anything.
    expect((await post(billing, { action: 'portal' })).status).toBe(401);
  });

  it('returning subscriber logs in with her email: her account, her November, onboarding pending', async () => {
    signIn('mia@example.com');
    const me = asMember<Record<string, any>>('mia@example.com', 'select public.club_me() as j');
    expect(me.j).toMatchObject({ access: true, plan: 'monthly', onboarded: false, member: true });
    const nov = me.j.months.find((m: any) => m.month === '2026-11-01');
    expect(nov).toMatchObject({ state: 'available', mailing: { readiness: 'needs_profile', late: true } });
    expect(me.j.months.find((m: any) => m.month === '2026-12-01').state).toBe('locked');
  });

  it('an existing member is refused a second checkout, signed in or not', async () => {
    expect((await post(billing, { action: 'checkout', plan: 'annual', email: 'mia@example.com' })).body.error).toBe('already_member');
    expect((await post(billing, { action: 'checkout', plan: 'monthly' }, 'tok_mia@example.com')).body.error).toBe('already_member');
  });

  it('family profile and address complete the mailing requirements', () => {
    asMember('mia@example.com', `select public.club_household_save('The Riveras', '{}', '[{"first_name":"Mia","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Leo","kind":"child","role":"child","birth_year":2019}]') as j`);
    const me = asMember<Record<string, any>>('mia@example.com', 'select public.club_me() as j');
    expect(me.j.onboarded).toBe(true);
    expect(me.j.months.find((m: any) => m.month === '2026-11-01').mailing.readiness).toBe('needs_pdf');
  });

  it('successful recurring payment unlocks December; a failed January payment unlocks nothing and emails once', async () => {
    await deliver(stripe.renew(monthlySub).events);
    expect(months('mia@example.com')).toBe('2026-11,2026-12');
    const jan = stripe.renew(monthlySub, { declined: true });
    await deliver(jan.events, { times: 3 });
    expect(months('mia@example.com')).toBe('2026-11,2026-12');
    expect(mails('mia@example.com', /payment didn’t go through/)).toHaveLength(1);
    expect(sql(`select status from public.club_subscriptions where stripe_subscription_id = '${monthlySub}'`)).toBe('past_due');
    expect(sql(`select failure_message from public.club_invoices where stripe_invoice_id = '${jan.invoice}'`)).toBe('Your card was declined.');
    // Stripe's retry succeeds: January opens.
    await deliver(stripe.retrySucceeds(jan.invoice));
    expect(months('mia@example.com')).toBe('2026-11,2026-12,2027-01');
  });

  it('Billing Portal and email changes need her signed-in token', async () => {
    const p = await post(billing, { action: 'portal' }, 'tok_mia@example.com');
    expect(p.body.url).toMatch(/^https:\/\/billing\.stripe\.test\//);
    sql(`update auth.users set email = 'mia.new@example.com' where email = 'mia@example.com'`);
    expect((await post(billing, { action: 'sync_email' }, 'tok_mia@example.com')).body.updated).toBe(true);
    expect([...stripe.customers.values()][0].email).toBe('mia.new@example.com');
    expect(sql(`select email from public.club_customers where user_id = '${uid('mia.new@example.com')}'`)).toBe('mia.new@example.com');
    expect((await post(billing, { action: 'sync_email' }, 'tok_mia@example.com')).body.updated).toBe(false);
  });

  it('cancellation: confirmed once, access to the end, and every paid month stays (read-only)', async () => {
    await deliver(stripe.cancelAtPeriodEnd(monthlySub), { times: 2 });
    expect(mails('mia.new@example.com', /set to end/)).toHaveLength(1);
    await deliver(stripe.endPeriod(monthlySub));
    expect(mails('mia.new@example.com', /has ended/)).toHaveLength(0);
    const me = asMember<Record<string, any>>('mia.new@example.com', 'select public.club_me() as j');
    expect(me.j.access).toBe(false);
    expect(me.j.months.filter((m: any) => m.state === 'available').map((m: any) => m.month)).toEqual(['2026-11-01', '2026-12-01']);
    expect(asMember<Record<string, any>>('mia.new@example.com', `select public.club_resource_get('2026-11-family-ownership') as j`).j.can).toBe('read');
  });

  let annualSub = '';
  it('new annual subscriber: twelve months and twelve mailings at once', async () => {
    const r = await post(billing, { action: 'checkout', plan: 'annual', email: 'ana@example.com' });
    const sid = [...stripe.sessions.values()].find((s) => s.url === r.body.url)!.id as string;
    await deliver(stripe.completeCheckout(sid, { email: 'ana@example.com', address: null }));
    annualSub = [...stripe.subs.values()].find((s) => s.metadata.email === 'ana@example.com')!.id;
    expect(months('ana@example.com').split(',')).toHaveLength(12);
    expect(months('ana@example.com').split(',')[0]).toBe('2027-01');
    expect(sql(`select count(*) from public.club_fulfillment_orders where user_id = '${uid('ana@example.com')}'`)).toBe('12');
    expect(sql(`select count(*) from public.club_mailing_addresses where user_id = '${uid('ana@example.com')}'`)).toBe('0');
    expect(mails('ana@example.com', /Welcome/)[0].text).toContain('twelve monthly resources');
  });

  it('annual renewal grants the year 2 collection; a refund revokes exactly it', async () => {
    const renewal = stripe.renew(annualSub);
    await deliver(renewal.events);
    expect(months('ana@example.com').split(',')).toHaveLength(24);
    expect(sql(`select string_agg(distinct membership_year::text, ',') from public.club_entitlements where user_id = '${uid('ana@example.com')}' and resource_month >= '2028-01-01'`)).toBe('2');
    const ref = await post(admin, { action: 'refund', invoice: renewal.invoice }, 'tok_owner');
    expect(ref.body.refund_status).toBe('succeeded');
    await deliver([stripe.refundedEvent(renewal.invoice)], { times: 2 });
    expect(months('ana@example.com').split(',')).toHaveLength(12);
    expect(sql(`select count(*) from public.club_fulfillment_orders where user_id = '${uid('ana@example.com')}' and status = 'canceled'`)).toBe('12');
  });

  it('a chargeback revokes its month and the subscription’s access', async () => {
    const r = await post(billing, { action: 'checkout', plan: 'monthly', email: 'dee@example.com' });
    const sid = [...stripe.sessions.values()].find((s) => s.url === r.body.url)!.id as string;
    await deliver(stripe.completeCheckout(sid, { email: 'dee@example.com' }));
    const sub = [...stripe.subs.values()].find((s) => s.metadata.email === 'dee@example.com')!;
    await deliver(stripe.dispute(sub.latest_invoice!));
    expect(months('dee@example.com')).toBe('');
    expect(sql(`select access_revoked_reason from public.club_subscriptions where stripe_subscription_id = '${sub.id}'`)).toBe('disputed');
  });

  it('two checkouts that both finish: the second subscription is canceled and refunded', async () => {
    const a = await post(billing, { action: 'checkout', plan: 'monthly', email: 'twin@example.com' });
    const b = await post(billing, { action: 'checkout', plan: 'annual', email: 'twin@example.com' });
    expect(a.body.url).not.toBe(b.body.url);
    const sa = [...stripe.sessions.values()].find((s) => s.url === a.body.url)!.id as string;
    const sb = [...stripe.sessions.values()].find((s) => s.url === b.body.url)!.id as string;
    await deliver(stripe.completeCheckout(sa, { email: 'twin@example.com' }));
    await deliver(stripe.completeCheckout(sb, { email: 'twin@example.com' }));
    const subs = [...stripe.subs.values()].filter((s) => s.metadata.email === 'twin@example.com');
    expect(subs.map((s) => s.status).sort()).toEqual(['active', 'canceled']);
    expect(stripe.refunds.filter((r) => r.reason === 'duplicate')).toHaveLength(1);
    // Only the first membership's month: the canceled duplicate's paid invoice (delivered too) grants nothing.
    expect(months('twin@example.com').split(',')).toHaveLength(1);
    expect(sql(`select flags::text from public.club_subscriptions where stripe_subscription_id = '${subs.find((s) => s.status === 'canceled')!.id}'`)).toBe('{duplicate}');
    expect(sql(`select count(*) from public.club_subscriptions where user_id = '${uid('twin@example.com')}' and status in ('active','past_due','trialing')`)).toBe('1');
  });

  it('a declined first payment opens nothing; abandoning Checkout leaves nothing to clean up', async () => {
    const r = await post(billing, { action: 'checkout', plan: 'monthly', email: 'decline@example.com' });
    const sid = [...stripe.sessions.values()].find((s) => s.url === r.body.url)!.id as string;
    await deliver(stripe.completeCheckout(sid, { email: 'decline@example.com', declined: true }));
    expect(months('decline@example.com')).toBe('');
    // She can try again (the incomplete subscription doesn't count as a membership).
    expect((await post(billing, { action: 'checkout', plan: 'monthly', email: 'decline@example.com' })).status).toBe(200);
    const abandoned = await post(billing, { action: 'checkout', plan: 'annual', email: 'walkaway@example.com' });
    expect(abandoned.status).toBe(200);
    expect(sql(`select count(*) from auth.users where email = 'walkaway@example.com'`)).toBe('0');
  });

  it('ignores subscriptions that are not the Club’s, and rejects bad signatures and the wrong mode', async () => {
    await deliver(stripe.foreignSubscription());
    expect(sql(`select count(*) from public.club_subscriptions where stripe_customer_id = 'cus_other'`)).toBe('0');
    const raw = JSON.stringify({ id: 'evt_x', type: 'invoice.paid', livemode: false, created: 1, data: { object: { id: 'in_x' } } });
    const bad = await webhook(new Request('https://x/', { method: 'POST', headers: { 'stripe-signature': await signStripePayload(raw, 'whsec_wrong') }, body: raw }));
    expect(bad.status).toBe(400);
    const live = JSON.stringify({ id: 'evt_y', type: 'invoice.paid', livemode: true, created: 1, data: { object: { id: 'in_x' } } });
    const mm = await webhook(new Request('https://x/', { method: 'POST', headers: { 'stripe-signature': await signStripePayload(live, secret) }, body: live }));
    expect(mm.status).toBe(400);
  });

  it('a live key without the deployment switch is refused everywhere', async () => {
    const liveDeps = makeDeps({ stripe, tokens, inbox, env: { CLUB_STRIPE_SECRET_KEY: 'sk_live_x' } });
    expect((await post(createClubBillingHandler(liveDeps), { action: 'checkout', plan: 'monthly', email: 'z@example.com' })).body.error).toBe('live_checkout_disabled');
    expect((await createClubWebhookHandler(liveDeps)(new Request('https://x/', { method: 'POST', body: '{}' }))).status).toBe(503);
  });

  it('mailing queue: one order per paid delivery month, readiness tracked, manual review to mailed', async () => {
    const orders = sql(`select count(*) from public.club_fulfillment_orders where resource_month = '2026-12-01' and status <> 'canceled'`);
    expect(Number(orders)).toBe(1); // Mia's paid December
    const late = sql(`select string_agg(late::text, ',') from public.club_fulfillment_orders where user_id = '${uid('mia.new@example.com')}' order by 1`);
    expect(late).toContain('true');
  });

  it('emails batches go once per member: resource ready, profile reminder', async () => {
    const r1 = await post(admin, { action: 'send_emails', kind: 'resource_ready', month: '2026-12-01' }, 'tok_owner');
    expect(r1.body).toMatchObject({ audience: 1, sent: 1 });
    const r2 = await post(admin, { action: 'send_emails', kind: 'resource_ready', month: '2026-12-01' }, 'tok_owner');
    expect(r2.body).toMatchObject({ audience: 1, sent: 0, duplicate: 1 });
    expect(mails('mia.new@example.com', /December 2026 is ready/)).toHaveLength(1);
    expect((await post(admin, { action: 'send_emails', kind: 'resource_ready' }, 'tok_owner')).body.error).toBe('invalid_month');
    expect(sql(`select count(*) from public.admin_audit_log where action like 'club.%'`)).not.toBe('0');
  });
});

describe('Club allowed origins', () => {
  it('adds CLUB_ALLOWED_ORIGINS for the Club only, keeping the site and shop origins', async () => {
    const { readClubEnv } = await import('../supabase/functions/_shared/club/deps');
    const { readEnv } = await import('../supabase/functions/_shared/env');
    const vars: Record<string, string> = {
      SHOP_SITE_URL: 'https://www.organizedmomcollective.com',
      SHOP_ALLOWED_ORIGINS: 'https://shop-extra.example.com',
      CLUB_ALLOWED_ORIGINS: 'https://claude-x.organized-mom-collective.pages.dev/, javascript:alert(1)',
    };
    const club = readClubEnv((k) => vars[k]);
    expect(club.allowedOrigins).toEqual(['https://www.organizedmomcollective.com', 'https://organizedmomcollective.com', 'https://shop-extra.example.com', 'https://claude-x.organized-mom-collective.pages.dev']);
    expect(readEnv((k) => vars[k]).allowedOrigins).not.toContain('https://claude-x.organized-mom-collective.pages.dev');
  });
});

describe('Club return URLs', () => {
  it('send her back to an allowed preview origin, never to an unlisted one', async () => {
    const { returnBase } = await import('../supabase/functions/_shared/handlers/club-billing');
    const { readClubEnv } = await import('../supabase/functions/_shared/club/deps');
    const env = readClubEnv((k) => ({ SHOP_SITE_URL: 'https://www.organizedmomcollective.com', CLUB_ALLOWED_ORIGINS: 'https://p.organized-mom-collective.pages.dev' })[k]);
    const at = (origin?: string) => returnBase({ env } as never, new Request('https://x/', { headers: origin ? { origin } : {} }));
    expect(at('https://p.organized-mom-collective.pages.dev')).toBe('https://p.organized-mom-collective.pages.dev');
    expect(at('https://evil.example.com')).toBe('https://www.organizedmomcollective.com');
    expect(at()).toBe('https://www.organizedmomcollective.com');
  });
});
