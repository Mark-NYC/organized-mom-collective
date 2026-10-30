/**
 * A signed-in member's plan on /app/club/<month>, saved to her account.
 *
 * Every monthly tool keeps its plan in this tab under the page's storage key (data-plan-key on `.club-plan`; most
 * through ./storage.ts, a few through sessionStorage directly). This mirrors that one key to her saved version of the
 * month in the database (club_resource_versions, through club_resource_get / club_resource_save, the same row her
 * copy at /club/resources/<slug> and the mailing read), the way bridgeResourceState (../membership.ts) does for that
 * page. The tools themselves don't change: they read and write the tab as before.
 *
 * - Before the tool reads its family: her saved plan for this tool goes into the tab. With none saved yet, a plan she
 *   saved on her copy of the same tool (/club/resources/<slug>) is offered instead; the tool's own validation decides
 *   whether it fits, and nothing is written until she changes something.
 * - Her saved version is one object of storage entries. Saving merges this tool's entry into it, so entries saved
 *   from her copy of the month stay as they are.
 * - Only her own changes save: nothing until she has clicked or typed on the page, and never a value the tool merely
 *   wrote back on opening. Like a change on her copy, a saved change clears that month's approval for printing.
 * - Another device saved first (conflict): stop saving here and say so; nothing is overwritten.
 */
import { clubResourceBySlug, memberStorageKey } from '../../../data/club/resources';
import { routes } from '../../../routes';
import type { ResourceVersion } from '../membership';

export type PlanSaveStatus = 'loading' | 'saved' | 'saving' | 'read' | 'conflict' | 'printed' | 'error' | 'unavailable';
export const PLAN_SAVE = 'club:plan-save';

/**
 * Months whose copy at /club/resources/<slug> renders the same tool as the app page, so a plan saved there can open
 * here. February and March render the same tools once PR #268's member copies land; until then their saved state
 * doesn't pass the tool's validation and the tool starts fresh. January and September render a different tool on
 * the copy (docs/club/RESOURCE_CONSISTENCY.md on PR #268); November's tool is only on the copy.
 */
export const SAME_TOOL_AS_COPY = new Set([
  '2026-12-christmas-mission', '2027-02-better-together', '2027-03-spring-clean-together', '2027-04-everybody-helps-at-mealtime',
  '2027-05-finish-the-school-year', '2027-06-summer-with-a-plan', '2027-07-ready-to-go', '2027-08-school-year', '2027-10-home-works-together',
]);

export interface PlanAccountDeps {
  load(slug: string): Promise<ResourceVersion>;
  save(slug: string, state: ResourceVersion['state'], revision: number): Promise<number>;
  /** The tab's storage the tools use (sessionStorage). */
  storage: Storage;
  /** Calls `cb` the first time she clicks, taps or types on the page. */
  onUserAction(cb: () => void): void;
  onStatus(status: PlanSaveStatus): void;
  /** Debounce before saving, ms. */
  wait?: number;
}

export interface PlanAccount {
  status: PlanSaveStatus;
  /** A plan for a different tool saved on her copy of this month: it stays there (null when there's none). */
  earlierCopy: boolean;
  stop(): void;
}

/** What to put in the tab before the tool opens: her saved plan for this tool, else her copy's if it's the same tool. */
export function initialValue(state: ResourceVersion['state'], key: string, slug: string): string | null {
  const own = state[key];
  if (own) return own.v;
  const copy = state[memberStorageKey(slug)];
  return copy && SAME_TOOL_AS_COPY.has(slug) ? copy.v : null;
}

export async function connectPlanAccount(slug: string, key: string, deps: PlanAccountDeps): Promise<PlanAccount> {
  const { storage } = deps;
  const result: PlanAccount = { status: 'loading', earlierCopy: false, stop: () => undefined };
  const set = (s: PlanSaveStatus) => {
    result.status = s;
    deps.onStatus(s);
  };
  let res: ResourceVersion;
  try {
    res = await deps.load(slug);
  } catch {
    // Can't reach her saved plan: she can still use the page in this tab, and nothing of hers is overwritten.
    set('unavailable');
    return result;
  }
  let saved = { ...res.state };
  let revision = res.revision;
  const copy = saved[memberStorageKey(slug)];
  result.earlierCopy = Boolean(copy && !SAME_TOOL_AS_COPY.has(slug) && !saved[key]);

  const original = Object.getPrototypeOf(storage).setItem as Storage['setItem'];
  const start = initialValue(saved, key, slug);
  if (start !== null) original.call(storage, key, start);
  if (res.can !== 'edit') {
    set('read');
    return result;
  }

  // What's on the page without a change from her: the plan she opened, or the first thing the tool writes.
  let baseline: string | null = saved[key]?.v ?? null;
  let acted = false;
  let stopped = false;
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> = Promise.resolve();
  deps.onUserAction(() => { acted = true; });

  const flush = () => {
    const value = pending;
    pending = null;
    if (value === null || stopped || value === saved[key]?.v) return;
    inFlight = inFlight.then(async () => {
      if (stopped) return;
      const next = { ...saved, [key]: { s: 's' as const, v: value } };
      set('saving');
      try {
        revision = await deps.save(slug, next, revision);
        saved = next;
        set('saved');
      } catch (e) {
        const m = (e as Error).message;
        if (m === 'conflict' || m === 'already_printed' || m === 'read_only') stopped = true;
        set(m === 'conflict' ? 'conflict' : m === 'already_printed' ? 'printed' : m === 'read_only' ? 'read' : 'error');
      }
    });
  };

  const proto = Object.getPrototypeOf(storage) as Storage;
  const patched = function (this: Storage, k: string, v: string) {
    original.call(this, k, v);
    if (this !== storage || k !== key || stopped) return;
    if (baseline === null) baseline = v;
    if (!acted || v === baseline) return;
    pending = v;
    clearTimeout(timer);
    timer = setTimeout(flush, deps.wait ?? 900);
  };
  proto.setItem = patched;
  // Leaving the page with a change still waiting: send it now.
  const leave = () => { clearTimeout(timer); flush(); };
  globalThis.addEventListener?.('pagehide', leave);
  result.stop = () => {
    if (proto.setItem === patched) proto.setItem = original;
    globalThis.removeEventListener?.('pagehide', leave);
    clearTimeout(timer);
  };
  set('saved');
  return result;
}

/** Her plan's line under the rail and the phone screen. */
export function saveText(status: PlanSaveStatus | undefined): string {
  switch (status) {
    case 'saving': return 'Saving to your account…';
    case 'read': return 'Your saved plan, read only: editing isn’t open for your account.';
    case 'conflict': return 'This plan changed on another device. Reload the page to see the latest; your last change here wasn’t saved.';
    case 'printed': return 'This month is printed, so changes here aren’t saved. You can still print a copy.';
    case 'error': return 'Couldn’t save your last change. Check your connection; it saves with your next change.';
    case 'unavailable': return 'We couldn’t reach your saved plan. Changes stay in this browser tab until you reload.';
    default: return 'Changes save to your account.';
  }
}

/** Her copy of this month saved with a different tool (see connectPlanAccount): a link to it, so it's never out of reach. */
export function earlierCopyLink(root: HTMLElement): (Node | string)[] {
  const href = root.dataset.planEarlier;
  if (!href) return [];
  const a = document.createElement('a');
  a.href = href;
  a.textContent = 'Open the copy you saved earlier';
  a.style.textDecoration = 'underline';
  return [' ', a, '.'];
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/**
 * Where a member opens a month she holds: its tool at /app/club/<month>, saved to her account. November's tool has no
 * app page (/app/club/november is its meeting), and months outside the app's year (src/data/club/resources.ts) stay
 * on her copy at /club/resources/<slug>.
 */
export function memberPlanHref(slug: string): string {
  const r = clubResourceBySlug(slug);
  const month = r ? MONTHS[Number(r.month.slice(5, 7)) - 1] : null;
  return month && month !== 'november' ? `${routes.appClub}/${month}` : routes.clubResource(slug);
}
