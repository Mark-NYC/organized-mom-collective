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
import { accountStore, clubHref, sampleStore } from '../store';
import { planKey } from './storage';

export type ReadyFamily = Extract<KitHousehold, { status: 'ready' }>;
export const PLAN_FAMILY_READY = 'club:plan-family-ready';

type FamilyRoot = HTMLElement & { planFamily?: ReadyFamily };

/** Run `callback` with the family once it is known, or now if it already is (scripts load in any order). */
export function onPlanFamily(root: HTMLElement, callback: (family: ReadyFamily) => void) {
  const known = (root as FamilyRoot).planFamily;
  if (known) callback(known);
  else root.addEventListener(PLAN_FAMILY_READY, (event) => callback((event as CustomEvent<ReadyFamily>).detail), { once: true });
}

/** "the Rivera family" for a sample, or the household's own name. */
export const familyLabel = (r: ReadyFamily) => (r.source === 'sample' ? r.sampleLabel.replace('Sample: ', '') : r.household.displayName ?? 'your family');

function gateMessage(gate: HTMLElement, month: string, result: Exclude<KitHousehold, { status: 'ready' }>) {
  const sample = 'sample' in result ? result.sample : null;
  const copy = {
    empty: ['Add your family first', `Your ${month} plan is prepared from your family profile: who lives at home and the children’s ages. Add them and the names and roles fill in for you.`, 'Add your family', clubHref(routes.clubFamily, sample)],
    'signed-out': ['Sign in to see your plan', `Your ${month} plan is prepared from your family profile. Sign in to see it.`, 'Sign in', routes.clubDashboard],
    denied: [`${month} isn’t open for your account`, 'This month’s kit isn’t available to your account.', 'See your kits', clubHref(routes.clubDashboard, sample)],
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

/** Load the family for a plan page root (`.club-plan` with data-kit-slug and data-plan-month). */
export function startPlanFamily(root: HTMLElement) {
  const month = root.dataset.planMonth ?? 'This month';
  const gate = root.querySelector<HTMLElement>('[data-plan-gate]');
  return loadKitHousehold(root.dataset.kitSlug ?? '', location.search, {
    accountsEnabled: clubAccountsEnabled,
    hasSession: async () => Boolean(await getSession()),
    accountStore,
    sampleStore,
  }).then((result) => {
    if (result.status !== 'ready') {
      if (gate) gateMessage(gate, month, result);
      root.dataset.planState = result.status;
      return result;
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
