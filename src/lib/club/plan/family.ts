/**
 * Which family a Club plan page is prepared for, and what to show until it's known.
 *
 * Uses the Club's own stores through loadKitHousehold (../kit-household.ts): a labeled sample, or the signed-in
 * member's household, never a sample in her place. On success it marks the page root (`.club-plan`) with
 * data-plan-state="ready" plus data-plan-for / -source / -label, sends the household to the printable
 * ('omc:club-preview-household', the same event ClubMonthAccess sends) and dispatches PLAN_FAMILY_READY.
 * Otherwise it fills the gate (ClubFamilyGate.astro) and the page shows nothing else.
 */
import { clubAccountsEnabled } from '../../../data/club/config';
import { routes } from '../../../routes';
import { getSession } from '../../account';
import { loadKitHousehold, type KitHousehold } from '../kit-household';
import { loadMembership, loadResource, saveResource, shortDate, type Membership } from '../membership';
import { accountStore, clubHref, fromDb, sampleStore } from '../store';
import { adminRpc, loadSession as loadAdminSession } from '../../admin/session';
import { MEMBER_STORAGE_PREFIX } from '../../../data/club/resources';
import { connectPlanAccount, PLAN_SAVE } from './account';
import { planKey } from './storage';

export type ReadyFamily = Extract<KitHousehold, { status: 'ready' }>;
export const PLAN_FAMILY_READY = 'club:plan-family-ready';
/** What counts as her acting on the page (only then does a change save to her account). */
const ACTIONS = ['pointerdown', 'keydown', 'input', 'change'] as const;

type FamilyRoot = HTMLElement & { planFamily?: ReadyFamily };

/** Run `callback` with the family once it is known, or now if it already is (scripts load in any order). */
export function onPlanFamily(root: HTMLElement, callback: (family: ReadyFamily) => void) {
  const known = (root as FamilyRoot).planFamily;
  if (known) callback(known);
  else root.addEventListener(PLAN_FAMILY_READY, (event) => callback((event as CustomEvent<ReadyFamily>).detail), { once: true });
}

/** "the Rivera family" for a sample, or the household's own name. */
export const familyLabel = (r: ReadyFamily) => (r.source === 'sample' ? r.sampleLabel.replace('Sample: ', '') : r.household.displayName ?? 'your family');

/** Why a member can't open this month yet, in her terms: the payment that brings it, or that it isn't part of hers. */
export function deniedCopy(month: string, slug: string, me: Pick<Membership, 'next' | 'months' | 'access'> | null): [string, string, string, string] {
  const base: [string, string, string, string] = [`${month} isn’t open for your account`, 'This month’s plan isn’t part of your membership.', 'Go to Club Home', routes.appClub];
  if (!me) return base;
  if (me.next?.slug === slug && me.next.payment_on) {
    return [`${month} opens ${shortDate(me.next.payment_on)}`, `${month} comes with your ${shortDate(me.next.payment_on)} payment. It opens here that day, prepared with your family’s names.`, 'Go to Club Home', routes.appClub];
  }
  if (!me.access) return [`${month} isn’t open for your account`, 'Your membership has ended. The months you received stay in your Club to view and print.', 'Go to Club Home', routes.appClub];
  return base;
}

function gateMessage(gate: HTMLElement, month: string, result: Exclude<KitHousehold, { status: 'ready' }>, denied?: [string, string, string, string]) {
  const sample = 'sample' in result ? result.sample : null;
  const copy = {
    empty: ['Add your family first', `Your ${month} plan is prepared from your family profile: who lives at home and the children’s ages. Add them and the names and roles fill in for you.`, 'Add your family', clubHref(routes.clubFamily, sample)],
    'signed-out': ['Sign in to see your plan', `Your ${month} plan is prepared from your family profile. Sign in to see it.`, 'Sign in', routes.clubDashboard],
    denied: denied ?? [`${month} isn’t open for your account`, 'This month’s kit isn’t available to your account.', 'See your kits', clubHref(routes.clubDashboard, sample)],
    error: ['We couldn’t load your family’s plan', 'Check your connection and try again. Nothing you changed earlier in this tab is lost.', 'Try again', ''],
  }[result.status];
  const [title, text, action, href] = copy;
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = text;
  const a = document.createElement(href ? 'a' : 'button');
  a.className = 'plan-gate-action';
  a.textContent = action;
  if (a instanceof HTMLAnchorElement) a.href = href;
  else {
    (a as HTMLButtonElement).type = 'button';
    a.addEventListener('click', () => location.reload());
  }
  gate.replaceChildren(h, p, a);
}

/** The order id when this page is the owner's fulfillment print view (?fulfillment=<order id>). */
export const fulfillmentOrder = (search = typeof location === 'undefined' ? '' : location.search) => {
  const id = new URLSearchParams(search).get('fulfillment');
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
};

interface Bundle {
  order: { id: string; kit_slug: string | null; display_name: string | null; email: string; resource_month: string; status: string; readiness: string; pdf_status: string; in_welcome_kit?: boolean };
  household: Parameters<typeof fromDb>[0];
  state: Record<string, { s: 'l' | 's'; v: string }> | null;
}

/**
 * The owner's print view of one member's plan (/admin/club → Welcome Kits or a month's list → Print view): her family
 * and her SAVED version of this tool, exactly what she approved, restored before the tool reads it. Nothing saves
 * back (no account connection); the owner prints to PDF and marks the PDF ready. Admin session only.
 */
async function startFulfillment(root: HTMLElement, order: string) {
  const gate = root.querySelector<HTMLElement>('[data-plan-gate]');
  const fail = (title: string, text: string) => {
    if (gate) {
      const h = document.createElement('h2');
      h.textContent = title;
      const p = document.createElement('p');
      p.textContent = text;
      gate.replaceChildren(h, p);
    }
    root.dataset.planState = 'error';
  };
  const session = loadAdminSession();
  if (!session) return fail('Sign in to the admin first', 'Open this print view from /admin/club after signing in.');
  let b: Bundle;
  try {
    b = await adminRpc<Bundle>(session, 'club_admin_fulfillment_bundle', { p_order: order });
  } catch (e) {
    return fail('We couldn’t load this mailing', (e as Error).message);
  }
  if (b.order.kit_slug !== root.dataset.kitSlug) return fail('This mailing is for another month', `Order ${order} is ${b.order.kit_slug ?? 'not a monthly resource'}.`);
  // Her saved plan only: nothing from this browser's own tabs or previews.
  for (const store of [sessionStorage, localStorage]) {
    for (const k of Object.keys(store)) if (k.startsWith(MEMBER_STORAGE_PREFIX) || k === root.dataset.planKey) store.removeItem(k);
  }
  for (const [k, { s, v }] of Object.entries(b.state ?? {})) {
    try { (s === 'l' ? localStorage : sessionStorage).setItem(k, v); } catch { /* fine */ }
  }
  const household = fromDb(b.household);
  const result: ReadyFamily = { status: 'ready', source: 'fulfillment', sample: null, sampleLabel: '', household, profile: null };
  root.dataset.planFor = planKey(null, household.id);
  root.dataset.planSource = 'fulfillment';
  root.dataset.planLabel = household.displayName ?? 'her family';
  root.dataset.planFulfillment = order;
  (root as FamilyRoot).planFamily = result;
  root.dispatchEvent(new CustomEvent<ReadyFamily>(PLAN_FAMILY_READY, { detail: result }));
  const detail = { household, sample: null };
  (window as Window & { __ofcPreviewHousehold?: typeof detail }).__ofcPreviewHousehold = detail;
  window.dispatchEvent(new CustomEvent('omc:club-preview-household', { detail }));
  root.dataset.planState = 'ready';
  fulfillmentBar(root, b, session);
  window.dispatchEvent(new Event('resize'));
  return result;
}

/** The owner's bar above the plan (never printed): whose mailing, Print, Mark PDF ready. */
function fulfillmentBar(root: HTMLElement, b: Bundle, session: NonNullable<ReturnType<typeof loadAdminSession>>) {
  const bar = document.createElement('div');
  bar.dataset.clubChrome = '';
  bar.dataset.planFulfillmentBar = '';
  bar.className = 'print:hidden';
  bar.style.cssText = 'background:#fdf6e6;border-bottom:1px solid #e8d9b8;padding:10px 16px;font-size:14px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center';
  const who = document.createElement('strong');
  who.textContent = `Fulfillment · ${b.order.display_name ?? b.order.email} · ${b.order.resource_month.slice(0, 7)}${b.order.in_welcome_kit ? ' · Welcome Kit' : ''}`;
  const state = document.createElement('span');
  state.textContent = `Her saved plan (${b.state && Object.keys(b.state).length ? 'with her changes' : 'as prepared, no changes saved'}) · ${b.order.status} (${b.order.readiness})`;
  const print = document.createElement('button');
  print.type = 'button';
  print.textContent = 'Print / Save PDF';
  print.style.cssText = 'text-decoration:underline';
  print.addEventListener('click', () => window.print());
  const ready = document.createElement('button');
  ready.type = 'button';
  ready.textContent = b.order.pdf_status === 'ready' ? 'PDF marked ready ✓' : 'Mark PDF ready';
  ready.disabled = b.order.pdf_status === 'ready';
  ready.style.cssText = 'text-decoration:underline';
  ready.addEventListener('click', () => {
    ready.disabled = true;
    adminRpc(session, 'club_admin_set_fulfillment', { p_order: b.order.id, p_status: null, p_note: null, p_pdf: 'ready' })
      .then(() => { ready.textContent = 'PDF marked ready ✓'; }, (e: Error) => { ready.disabled = false; state.textContent = e.message; });
  });
  bar.append(who, state, print, ready);
  // Never on paper, and taking no space there (the plan's print rules hide by visibility, which keeps the box).
  const style = document.createElement('style');
  style.textContent = '@media print{[data-plan-fulfillment-bar]{display:none!important}}';
  bar.append(style);
  root.before(bar);
}

/** Load the family for a plan page root (`.club-plan` with data-kit-slug and data-plan-month). */
export function startPlanFamily(root: HTMLElement) {
  const month = root.dataset.planMonth ?? 'This month';
  const gate = root.querySelector<HTMLElement>('[data-plan-gate]');
  const order = fulfillmentOrder();
  if (order) return startFulfillment(root, order);
  return loadKitHousehold(root.dataset.kitSlug ?? '', location.search, {
    accountsEnabled: clubAccountsEnabled,
    hasSession: async () => Boolean(await getSession()),
    accountStore,
    sampleStore,
  }).then(async (result) => {
    if (result.status !== 'ready') {
      const denied = result.status === 'denied' && result.source === 'account'
        ? deniedCopy(month, root.dataset.kitSlug ?? '', await loadMembership().catch(() => null))
        : undefined;
      if (gate) gateMessage(gate, month, result, denied);
      root.dataset.planState = result.status;
      return result;
    }
    // A member's own plan: her saved version goes into the tab before the tool reads it, and her changes save to
    // her account (./account.ts). Samples and previews stay in this tab.
    const slug = root.dataset.kitSlug;
    const key = root.dataset.planKey;
    if (result.source === 'account' && slug && key) {
      const account = await connectPlanAccount(slug, key, {
        load: loadResource,
        save: saveResource,
        storage: sessionStorage,
        onUserAction: (cb) => {
          const once = () => { cb(); for (const t of ACTIONS) document.removeEventListener(t, once, true); };
          for (const t of ACTIONS) document.addEventListener(t, once, true);
        },
        onStatus: (status) => {
          root.dataset.planSave = status;
          root.dispatchEvent(new Event(PLAN_SAVE));
        },
      });
      if (account.earlierCopy) root.dataset.planEarlier = routes.clubResource(slug);
    }
    root.dataset.planFor = planKey(result.sample, result.household.id);
    root.dataset.planSource = result.source;
    root.dataset.planLabel = familyLabel(result);
    (root as FamilyRoot).planFamily = result;
    root.dispatchEvent(new CustomEvent<ReadyFamily>(PLAN_FAMILY_READY, { detail: result }));
    const detail = { household: result.household, sample: result.sample };
    (window as Window & { __ofcPreviewHousehold?: typeof detail }).__ofcPreviewHousehold = detail;
    window.dispatchEvent(new CustomEvent('omc:club-preview-household', { detail }));
    root.dataset.planState = 'ready';
    window.dispatchEvent(new Event('resize'));
    return result;
  });
}
