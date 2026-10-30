/**
 * POST /functions/v1/club-billing (the Club's pages).
 *
 *   checkout        { plan: 'monthly', email? } (+ her access token if signed in; annual isn't offered yet)
 *                   → { url } (Stripe-hosted Checkout) | { error: 'already_member' | 'checkout_closed' | … }
 *                   Signed in: her verified email. Signed out: the email she typed (her account is created after
 *                   payment and opens only once she proves the inbox). Refuses a second live membership, reuses her
 *                   Stripe customer and any open Checkout for the same plan, so repeated clicks can't double-subscribe.
 *                   Your First Month FREE (club_checkout_state decides): a new household's checkout collects a card
 *                   and charges nothing; the subscription is a trial until the first charge (founding members,
 *                   joining before the 2027 program: February 1, 2027; later: one month after joining). Her free
 *                   month is granted by club-webhook. No free month (one per household): billing starts today, or on
 *                   the program's first day before it starts.
 *   checkout_status { session_id } → { paid, email } for /club/welcome (the session id is the bearer: it's only in
 *                   her own return URL)
 *   portal          (signed in) → { url } Stripe Billing Portal: card, invoices, cancel
 *   sync_email      (signed in) → { updated } after she changed her sign-in email in Supabase Auth: the Stripe
 *                   customer and receipts follow it
 *
 * Gate: CLUB_STRIPE_SECRET_KEY set, club_settings.checkout_mode 'test' (test keys) or 'live' (live keys, plus
 * CLUB_LIVE_CHECKOUT=enabled). The browser never sees a Stripe secret or decides access.
 */
import { clubStripeBlocked, CLUB_PRICES, isPlan, type ClubDeps, type ClubPlan } from '../club/deps.ts';
import { userFromRequest } from '../club/members.ts';
import { EMAIL_RE, LIVE_STATUSES } from '../club/stripe-map.ts';
import { clientIp, corsHeaders, json, readJson, type Handler } from '../http.ts';

interface CheckoutState {
  live_subscription: boolean;
  customer: string | null;
  settings: { checkout_mode: 'off' | 'test' | 'live'; portal_configuration_id: string | null };
  /** Her free month ("2027-01-01"), or null when she isn't eligible. */
  intro_month: string | null;
  /** When the first charge happens, or null for today. */
  trial_end: string | null;
}

// Checkout requires a trial to end at least 48 hours after the session is created.
const MIN_TRIAL_SECONDS = 49 * 60 * 60;

const SESSION = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

/** A Club price by lookup key, or null when stripe_setup hasn't made it yet. */
export async function clubPrice(deps: ClubDeps, plan: ClubPlan): Promise<string | null> {
  const r = await deps.stripe.request<{ data: { id: string }[] }>('GET', '/v1/prices', { 'lookup_keys[]': CLUB_PRICES[plan].lookupKey, active: true, limit: 1 });
  return r.data[0]?.id ?? null;
}

export function createClubBillingHandler(deps: ClubDeps): Handler {
  return async (req) => {
    const cors = corsHeaders(req, deps.env.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response(null, { status: cors['Access-Control-Allow-Origin'] ? 204 : 403, headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    const body = await readJson(req);
    if (!body) return json({ error: 'invalid' }, 400, cors);
    const blocked = clubStripeBlocked(deps);
    if (blocked) return json({ error: blocked }, 503, cors);
    try {
      switch (body.action) {
        case 'checkout':
          return json(await checkout(deps, req, body), 200, cors);
        case 'checkout_status':
          return json(await checkoutStatus(deps, body), 200, cors);
        case 'portal':
          return json(await portal(deps, req), 200, cors);
        case 'sync_email':
          return json(await syncEmail(deps, req), 200, cors);
        default:
          return json({ error: 'unknown_action' }, 400, cors);
      }
    } catch (err) {
      if (err instanceof Refusal) return json({ error: err.message }, err.status, cors);
      console.error('club-billing', body.action, err);
      return json({ error: 'billing_failed' }, 500, cors);
    }
  };
}

/** Where Stripe sends her back: the page's own origin when it's allowed (a Pages preview), else the site. */
export function returnBase(deps: ClubDeps, req: Request): string {
  const origin = req.headers.get('origin')?.replace(/\/$/, '') ?? '';
  return deps.env.allowedOrigins.includes(origin) ? origin : deps.env.siteUrl;
}

class Refusal extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

async function checkout(deps: ClubDeps, req: Request, body: Record<string, unknown>) {
  if (!isPlan(body.plan)) throw new Refusal('invalid_plan');
  const plan = body.plan;
  const user = await userFromRequest(deps, req);
  const email = user?.email ?? (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '');
  // Guests enter their email in Stripe Checkout. Signed-in members retain their verified address.\n  if (email && (!EMAIL_RE.test(email) || email.length > 254)) throw new Refusal('invalid_email');

  const state = await deps.db.rpc<CheckoutState>('club_checkout_state', { p_user: user?.id ?? null, p_email: email });
  const mode = state.settings.checkout_mode;
  if (mode === 'off' || (mode === 'test' && deps.stripe.mode !== 'test') || (mode === 'live' && deps.stripe.mode !== 'live')) {
    throw new Refusal('checkout_closed', 403);
  }
  if (state.live_subscription) throw new Refusal('already_member', 409);
  // Light abuse limit on guest checkouts (each one is a Stripe customer); same throttle table as the shop.
  if (!user) {
    const ok = await deps.db.rpc<boolean>('club_allow_checkout', { p_ip: clientIp(req) });
    if (!ok) throw new Refusal('rate_limited', 429);
  }

  const price = await clubPrice(deps, plan);
  if (!price) throw new Refusal('not_configured', 503);

  let customer = email ? state.customer : null;
  if (customer) {
    // Stripe is the authority: a live subscription there (e.g. a webhook still on its way) also refuses.
    const subs = await deps.stripe.request<{ data: { status: string }[] }>('GET', '/v1/subscriptions', { customer, status: 'all', limit: 20 });
    if (subs.data.some((s) => LIVE_STATUSES.includes(s.status) && s.status !== 'incomplete')) throw new Refusal('already_member', 409);
    // A second click or tab: the same open Checkout, not a new one.
    const open = await deps.db.rpc<{ url: string } | null>('club_checkout_open_session', { p_customer: customer, p_plan: plan });
    if (open?.url) return { url: open.url, reused: true };
  } else {
    const c = await deps.stripe.request<{ id: string }>('POST', '/v1/customers', {
      email,
      metadata: { club: 'organized-family-club', ...(user ? { user_id: user.id } : {}) },
    }, `club-customer:${email}`);
    customer = c.id;
    if (user) await deps.db.rpc('club_member_link', { p_user: user.id, p_email: email, p_customer: customer, p_livemode: deps.stripe.mode === 'live' });
  }

  const trialEnd = state.trial_end ? Math.max(Math.floor(Date.parse(state.trial_end) / 1000), deps.now() + MIN_TRIAL_SECONDS) : null;
  const meta = { club: 'organized-family-club', plan, ...(email ? { email } : {}), ...(user ? { user_id: user.id } : {}), ...(state.intro_month ? { intro_month: state.intro_month.slice(0, 10) } : {}) };
  const expiresAt = deps.now() + 60 * 60;
  const site = returnBase(deps, req);
  const session = await deps.stripe.request<{ id: string; url: string; livemode: boolean; expires_at: number }>('POST', '/v1/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: user?.id,
    line_items: [{ price, quantity: 1 }],
    shipping_address_collection: { allowed_countries: ['US'] },
    customer_update: { shipping: 'auto', address: 'auto' },
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
    expires_at: expiresAt,
    metadata: meta,
    // A trial: the card is saved now and nothing is charged until trial_end (cancelled if no card made it through).
    ...(trialEnd ? { payment_method_collection: 'always' } : {}),
    subscription_data: {
      metadata: meta,
      ...(trialEnd ? { trial_end: trialEnd, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } } : {}),
    },
    success_url: `${site}/club/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/club/#offer`,
  }, `club-checkout:${customer}:${plan}:${state.intro_month ? 'intro' : trialEnd ? 'trial' : 'pay'}:${Math.floor(deps.now() / 600)}`);
  // The empty guest email is replaced by Stripe's verified Checkout email during webhook fulfillment.\n  await deps.db.rpc('club_checkout_record', {
    p: { id: session.id, customer, user_id: user?.id ?? null, email, plan, url: session.url, livemode: session.livemode, expires_at: new Date(session.expires_at * 1000).toISOString() },
  });
  return { url: session.url };
}

async function checkoutStatus(deps: ClubDeps, body: Record<string, unknown>) {
  const id = typeof body.session_id === 'string' ? body.session_id : '';
  if (!SESSION.test(id)) throw new Refusal('invalid_session');
  const s = await deps.stripe.request<{ status: string; payment_status: string; customer_details?: { email?: string } | null; metadata?: Record<string, string> }>(
    'GET', `/v1/checkout/sessions/${id}`);
  if (s.metadata?.club !== 'organized-family-club') throw new Refusal('invalid_session', 404);
  return {
    paid: s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required'),
    open: s.status === 'open',
    email: (s.customer_details?.email ?? s.metadata?.email ?? '').toLowerCase(),
  };
}

async function signedIn(deps: ClubDeps, req: Request) {
  const user = await userFromRequest(deps, req);
  if (!user || !user.confirmed) throw new Refusal('not_signed_in', 401);
  return user;
}

async function portal(deps: ClubDeps, req: Request) {
  const user = await signedIn(deps, req);
  const state = await deps.db.rpc<CheckoutState>('club_checkout_state', { p_user: user.id, p_email: user.email });
  const [own] = await deps.db.select<{ stripe_customer_id: string }>('club_customers', `user_id=eq.${user.id}&select=stripe_customer_id`);
  if (!own) throw new Refusal('no_membership', 404);
  const session = await deps.stripe.request<{ url: string }>('POST', '/v1/billing_portal/sessions', {
    customer: own.stripe_customer_id,
    return_url: `${returnBase(deps, req)}/club/dashboard`,
    ...(state.settings.portal_configuration_id ? { configuration: state.settings.portal_configuration_id } : {}),
  });
  return { url: session.url };
}

async function syncEmail(deps: ClubDeps, req: Request) {
  const user = await signedIn(deps, req);
  const [own] = await deps.db.select<{ stripe_customer_id: string; email: string }>('club_customers', `user_id=eq.${user.id}&select=stripe_customer_id,email`);
  if (!own || own.email === user.email) return { updated: false };
  await deps.stripe.request('POST', `/v1/customers/${own.stripe_customer_id}`, { email: user.email });
  await deps.db.rpc('club_customer_email', { p_user: user.id, p_email: user.email });
  return { updated: true };
}

