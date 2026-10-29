/**
 * December Christmas Mission: who the kid-facing mission and its two cards are for, and who helps deliver them
 * (src/components/club/DecemberMissionPrototype.astro; pages drawn by src/lib/december/layout.ts). Pure functions only,
 * so the printable, the desktop rail and the mobile plan screen (DecemberPlanMobile.astro) read one plan.
 *
 * The wording on the pages is the prepared mission; the plan only chooses names. Children and the helper are by
 * member ID; archived members never print.
 */
import type { PlanResource } from '../plan/resource';

export interface DecMember { id: string; firstName: string; kind: string; role?: string; archived?: boolean }
export interface DecState { kids: string[]; helper: string }
export const ANY_GROWN_UP = 'grown-up';

const active = <M extends DecMember>(members: readonly M[]) => members.filter((m) => !m.archived);
export const kidsOf = <M extends DecMember>(members: readonly M[]) => active(members).filter((m) => m.kind === 'child');
export const adultsOf = <M extends DecMember>(members: readonly M[]) => active(members).filter((m) => m.kind === 'adult');
const parentsOf = (members: readonly DecMember[]) => adultsOf(members).filter((m) => m.role === 'parent' || m.role === 'partner');

/** What children call the helper on the mission: the first two parents or partners are Mom and Dad, other grown-ups by name. */
export const helperLabel = (id: string, members: readonly DecMember[]) => {
  const i = parentsOf(members).findIndex((m) => m.id === id);
  if (i === 0) return 'Mom';
  if (i === 1) return 'Dad';
  return adultsOf(members).find((m) => m.id === id)?.firstName ?? 'a grown-up';
};
/** The prepared helper, as the earlier page chose: Dad when there are two parents, else Mom, else the first grown-up. */
export const preparedHelper = (members: readonly DecMember[]) => {
  const parents = parentsOf(members);
  return (parents[1] ?? parents[0] ?? adultsOf(members)[0])?.id ?? ANY_GROWN_UP;
};
export const freshState = (members: readonly DecMember[]): DecState => ({ kids: kidsOf(members).map((k) => k.id), helper: preparedHelper(members) });

/** Drop people who left or were archived; with no child left on the mission, every child is on it again. */
export const applyFamily = (s: DecState, members: readonly DecMember[]) => {
  const kids = kidsOf(members).map((k) => k.id);
  s.kids = s.kids.filter((id) => kids.includes(id));
  if (!s.kids.length) s.kids = kids;
  if (s.helper !== ANY_GROWN_UP && !adultsOf(members).some((m) => m.id === s.helper)) s.helper = preparedHelper(members);
  return s;
};

export const joinNames = (names: readonly string[]) => names.length <= 2 ? names.join(' & ') : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;

export const decView = (s: DecState, members: readonly DecMember[]) => {
  const kids = kidsOf(members);
  const on = kids.filter((k) => s.kids.includes(k.id));
  const names = on.map((k) => k.firstName);
  const helper = helperLabel(s.helper, members);
  return {
    names: names.length ? names : ['Our family'],
    forLine: names.length ? joinNames(names) : 'Our family',
    helper,
    kids: kids.map((k) => ({ id: k.id, name: k.firstName, on: s.kids.includes(k.id) })),
    helpers: [...adultsOf(members).map((m) => ({ id: m.id, name: helperLabel(m.id, members), firstName: m.firstName })), { id: ANY_GROWN_UP, name: 'Any grown-up', firstName: '' }],
    /** What src/lib/december/layout.ts draws from: [grown-up, helper, ...children]. */
    layout: { members: [adultsOf(members)[0]?.firstName ?? 'A parent', helper, ...(names.length ? names : ['Our family'])] },
  };
};
export type DecView = ReturnType<typeof decView>;
export const decFingerprint = (s: DecState, members: readonly DecMember[]) => JSON.stringify(decView(s, members).layout.members.slice(1));

/** Add or take a child off the mission; at least one child stays on it. */
export const toggleKid = (s: DecState, id: string, members: readonly DecMember[]) => {
  if (!kidsOf(members).some((k) => k.id === id)) return s;
  if (s.kids.includes(id)) { if (s.kids.length > 1) s.kids = s.kids.filter((k) => k !== id); }
  else s.kids = kidsOf(members).map((k) => k.id).filter((k) => k === id || s.kids.includes(k));
  return s;
};
export const setHelper = (s: DecState, id: string, members: readonly DecMember[]) => {
  if (id === ANY_GROWN_UP || adultsOf(members).some((m) => m.id === id)) s.helper = id;
  return s;
};
export const restoreMission = (s: DecState, members: readonly DecMember[]) => Object.assign(s, freshState(members));
export const missionChanged = (s: DecState, members: readonly DecMember[]) => JSON.stringify(s) !== JSON.stringify(freshState(members));
export const isDecState = (x: unknown): x is DecState => {
  const s = x as Partial<DecState> | null;
  return Boolean(s && Array.isArray(s.kids) && s.kids.every((k) => typeof k === 'string') && typeof s.helper === 'string');
};

export interface DecPlan extends PlanResource<DecState> {
  members: () => DecMember[];
  view: () => DecView;
  setLocked: (on: boolean) => void;
  openEditor: () => void;
}
