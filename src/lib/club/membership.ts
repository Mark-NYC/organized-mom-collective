/**
 * The paid membership from the browser: checkout and billing through the club-billing Edge Function, and her
 * membership, address and saved resource versions through the Club's database functions with her account session
 * (supabase/migrations/20261104000000_club_membership.sql). The database and the functions decide every access
 * question; nothing here is a security boundary. docs/club/MEMBERSHIP.md.
 */
import { accountRpc, getSession } from '../account';
import { MEMBER_STORAGE_PREFIX } from '../../data/club/resources';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../supabase-config';
import { CLUB_OFFER, CLUB_OFFER_LINE, CLUB_PROGRAM_START, clubFoundingOpen, rollingFirstCharge } from '../../data/club/config';

const URL_ = SUPABASE_URL;
const KEY = SUPABASE_ANON_KEY;

/** Shows the join page's plans (the server still decides whether checkout is open). */
export const clubCheckoutEnabled = () => import.meta.env.PUBLIC_CLUB_CHECKOUT_ENABLED === 'true';

/** Plans a membership can be on (an annual one is handled, but checkout sells monthly only). */
export type Plan = 'monthly' | 'annual';
/** What the join page offers. Annual isn't offered yet (club-billing refuses it too). */
export type OfferedPlan = 'monthly';
export const PLANS: Record<OfferedPlan, { price: string; per: string; summary: string; points: string[] }> = {
  monthly: {
    price: '$5.90',
    per: 'a month',
    summary: 'One personalized resource and one printed mailing for each month you’re a member.',
    points: ['This month’s resource, prepared for your family', 'A printed mailing each paid month', 'Cancel any time; what you received stays yours'],
  },
};

/**
 * The monthly plan as a new household sees it: Your First Month FREE, nothing charged today, and the exact first
 * charge date (a founding member: February 1, 2027; later: one month after she joins). club-billing decides.
 */
export function introPlan(now = new Date()): (typeof PLANS)['monthly'] & { label: string } {
  const founding = clubFoundingOpen(now.getTime());
  const first = founding ? CLUB_PROGRAM_START.foundingFirstCharge : rollingFirstCharge(now);
  return {
    label: CLUB_OFFER,
    price: '$0',
    per: 'today',
    summary: CLUB_OFFER_LINE,
    points: founding
      ? [
          'Now: your personalized Family Vision welcome print, mailed free',
          `${CLUB_PROGRAM_START.label}: your first monthly plan, printed and mailed free`,
          `First charge: $5.90 on ${first}, then $5.90/month`,
          `Cancel before ${first} and you pay nothing`,
          'One free first month per household',
        ]
      : [
          'This month’s personalized plan, printed and mailed free',
          'Your personalized Family Vision welcome print, free',
          `First charge: $5.90 on ${first}, then $5.90/month`,
          `Cancel before ${first} and you pay nothing`,
          'One free first month per household',
        ],
  };
}

async function billing<T>(action: string, body: Record<string, unknown> = {}, signedIn = true): Promise<T> {
  const s = signedIn ? await getSession() : null;
  const res = await fetch(`${URL_}/functions/v1/club-billing`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${s?.access_token ?? KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `error_${res.status}`);
  return data;
}

export const startCheckout = (plan: OfferedPlan, email?: string) => billing<{ url: string }>('checkout', { plan, ...(email ? { email } : {}) });
export const checkoutStatus = (sessionId: string) => billing<{ paid: boolean; open: boolean; email: string }>('checkout_status', { session_id: sessionId }, false);
export const openPortal = () => billing<{ url: string }>('portal');
export const syncEmail = () => billing<{ updated: boolean }>('sync_email');

/** Plain words for the errors checkout and billing can return. */
export const billingErrorText = (code: string) =>
  ({
    already_member: 'This email already has a membership. Log in to see your resources.',
    checkout_closed: 'Enrollment isn’t open yet. Please check back soon.',
    invalid_email: 'Check the email address and try again.',
    invalid_plan: 'Choose the monthly membership.',
    rate_limited: 'Too many tries from this connection. Wait a few minutes and try again.',
    not_signed_in: 'Please sign in again.',
    no_membership: 'We couldn’t find a membership for this account.',
    not_configured: 'Checkout isn’t set up yet.',
    stripe_not_configured: 'Checkout isn’t set up yet.',
    live_checkout_disabled: 'Enrollment isn’t open yet. Please check back soon.',
  })[code] ?? 'Something went wrong. Please try again in a minute.';

/** Her sign-in email: Supabase sends a confirmation to the new address (and the old one) before it changes. */
export async function changeEmail(email: string): Promise<'sent' | 'invalid' | 'error'> {
  const s = await getSession();
  if (!s) return 'error';
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return 'invalid';
  const res = await fetch(`${URL_}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: clean }),
  });
  return res.ok ? 'sent' : res.status === 422 || res.status === 400 ? 'invalid' : 'error';
}

// ------------------------------------------------------------------ her membership

/** A month she bought: its resource is open, still being finished, or (a first December) her welcome print. */
export type MonthState = 'available' | 'preparing' | 'welcome_vision';

export interface MembershipMonth {
  month: string;
  /** Her free first month (Your First Month FREE). */
  free?: boolean;
  slug: string | null;
  title: string | null;
  published: boolean;
  can: 'edit' | 'read' | 'none';
  state: MonthState;
  membership_year: number | null;
  plan: string | null;
  fulfilled_by: 'monthly_resource' | 'welcome_vision';
  /** Its printed copy. batch: 'regular' (paid by the month's cutoff) or 'catch_up' (paid after it, mailed after). */
  mailing: { status: string; readiness: string; late: boolean; batch?: string; approved: boolean; mailed_at: string | null } | null;
}

/** Her Family Vision welcome print. satisfies_month: the first December it stands in for. */
export interface WelcomePrint {
  status: string;
  readiness: string;
  approved: boolean;
  personalized: boolean;
  satisfies_month: string | null;
  mailed_at: string | null;
}

export interface Membership {
  access: boolean;
  grant: string | null;
  member: boolean;
  plan: Plan | null;
  status: string | null;
  payment_problem: boolean;
  renews: string | null;
  ends: string | null;
  ended_at: string | null;
  revoked: boolean;
  onboarded: boolean;
  has_address: boolean;
  enrolled_at: string | null;
  first_paid_month: string | null;
  current_month: string;
  membership_year: number | null;
  welcome: WelcomePrint | null;
  /** The next month she'd receive, paid for on payment_on (only while the membership continues). */
  next: { month: string; payment_on: string | null; slug: string | null; title: string | null; regular_cutoff_at: string | null } | null;
  /** Only the months she has bought. */
  months: MembershipMonth[];
  /** Her free first month and, while it's still free, when the first charge is. */
  intro?: { month: string; trial_ends: string | null } | null;
}

export const loadMembership = () => accountRpc<Membership>('club_me');

export interface Address {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  paused?: boolean;
}

export async function loadAddress(): Promise<Address | null> {
  const s = await getSession();
  if (!s) return null;
  const res = await fetch(`${URL_}/rest/v1/club_mailing_addresses?select=name,line1,line2,city,state,postal_code,paused`, {
    headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Address[];
  return rows[0] ?? null;
}
export const saveAddress = (a: Address) => accountRpc<Address>('club_address_save', { p: a });

export interface ResourceVersion {
  can: 'edit' | 'read';
  month: string;
  state: Record<string, { s: 'l' | 's'; v: string }>;
  revision: number;
  approved_at: string | null;
  mailing: { status: string; readiness: string; approved: boolean } | null;
}
export const loadResource = (slug: string) => accountRpc<ResourceVersion>('club_resource_get', { p_kit: slug });
export const saveResource = (slug: string, state: ResourceVersion['state'], revision: number) =>
  accountRpc<number>('club_resource_save', { p_kit: slug, p_state: state, p_revision: revision });
export const approveResource = (slug: string) => accountRpc<boolean>('club_fulfillment_approve', { p_kit: slug });

export interface Vision { family_name: string; value: string }
export interface WelcomeOrder {
  status: string;
  readiness: string;
  personalization: Vision | null;
  approved: boolean;
  satisfies_month: string | null;
  printed_at: string | null;
  mailed_at: string | null;
  editable: boolean;
  display_name: string | null;
}
export const loadWelcome = () => accountRpc<WelcomeOrder | null>('club_welcome_get');
export const saveWelcome = (v: Vision) => accountRpc<WelcomeOrder>('club_welcome_save', { p: v });
export const approveWelcome = () => accountRpc<WelcomeOrder>('club_welcome_approve');

/** Her welcome print's status, in plain words. */
export function welcomeText(w: Pick<WelcomeOrder, 'status' | 'readiness' | 'approved'>): string {
  if (w.status === 'mailed') return 'Mailed';
  if (w.status === 'printed') return 'Printed, mailing soon';
  if (w.status === 'approved') return 'Approved for printing';
  if (w.status === 'returned') return 'Returned to us: check your address';
  return ({
    needs_vision: w.approved ? 'Waiting for your approval' : 'Choose your family’s word and approve it',
    needs_address: 'Add your mailing address so we can mail it',
    mail_paused: 'Printed mailings paused',
    needs_pdf: 'You approved it. We’re preparing it for print',
    ready: 'You approved it. We’re preparing it for print',
  } as Record<string, string>)[w.readiness] ?? 'Being prepared';
}

// ------------------------------------------------------------------ her printable's state, mirrored to the server

/**
 * Restores her saved version into the browser storage the printable reads (before it gets her household), then
 * mirrors every later write under the member prefix back to the server, about a second after the last one. The
 * printables don't know about accounts: they keep using the storage key the page hands them.
 */
export function bridgeResourceState(opts: {
  saved: ResourceVersion['state'];
  onChange: (state: ResourceVersion['state']) => void;
}): () => void {
  const state: ResourceVersion['state'] = { ...opts.saved };
  for (const [key, { s, v }] of Object.entries(state)) {
    try {
      (s === 'l' ? localStorage : sessionStorage).setItem(key, v);
    } catch {
      /* private mode: the page still opens from her household */
    }
  }
  const proto = Storage.prototype;
  const original = proto.setItem;
  let timer: ReturnType<typeof setTimeout> | undefined;
  proto.setItem = function (this: Storage, key: string, value: string) {
    original.call(this, key, value);
    if (!key.startsWith(MEMBER_STORAGE_PREFIX)) return;
    state[key] = { s: this === globalThis.localStorage ? 'l' : 's', v: value };
    clearTimeout(timer);
    timer = setTimeout(() => opts.onChange({ ...state }), 900);
  };
  return () => {
    proto.setItem = original;
    clearTimeout(timer);
  };
}

/** "November 2026" */
export const monthName = (iso: string) =>
  new Date(`${iso.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** Billing and mailing dates are New York days (a February 1 midnight charge is February 1 everywhere). */
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

/** The mailing line under a month: what's happening to her printed copy. */
export function mailingText(m: MembershipMonth['mailing']): string | null {
  if (!m) return null;
  if (m.status === 'mailed') return 'Mailed';
  if (m.status === 'printed') return 'Printed, mailing soon';
  if (m.status === 'returned') return 'Returned to us: check your address';
  if (m.status === 'skipped') return 'Not mailed this month';
  if (m.status === 'canceled') return null;
  if (m.status === 'approved') return 'Approved for printing';
  return ({
    needs_profile: 'Waiting for your family details',
    needs_address: 'Add your mailing address so we can mail it',
    mail_paused: 'Printed mailings paused',
    needs_resource: 'Being prepared',
    needs_pdf: m.approved ? 'You approved it. Preparing to print' : 'Being prepared for printing',
    ready: m.approved ? 'You approved it. Preparing to print' : 'Ready for printing',
  } as Record<string, string>)[m.readiness] ?? 'Being prepared';
}
