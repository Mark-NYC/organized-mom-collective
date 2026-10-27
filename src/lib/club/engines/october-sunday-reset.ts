/**
 * October 2027 Sunday Reset: the personalization rules behind the two-sided printable
 * (src/components/club/OctoberSundayReset.astro). Pure functions only, so the printable, the
 * /app/club/october page and later mobile screens all read the same plan.
 *
 * Saved shape and key are unchanged from the original inline script: sessionStorage[storageKey] =
 * { current: '<sample>:<householdId>', state }. That is this browser tab only, never an account.
 */

export interface PlanMember {
  id: string;
  firstName: string;
  kind: string;
  birthYear?: number;
  birthMonth?: number;
  role?: string;
  isAccountHolder?: boolean;
  archived?: boolean;
}

export interface FallJob {
  id: string;
  title: string;
  description: string;
  icon: string;
  ownerId: string;
  removed?: boolean;
}

export interface PlanState {
  trigger: string;
  assignments: Record<string, string>;
  fallJobs: FallJob[];
  text?: Record<string, string>;
  names?: Record<string, string>;
}

export interface SavedPlan {
  current: string;
  state: PlanState;
}

import type { PlanResource } from '../plan/resource';
import { planKey } from '../plan/storage';

export { planKey };

export const DEFAULT_TRIGGER = 'Sunday after lunch';
export const DEFAULT_TAGLINE = 'Look ahead. Get ready. Share the work.';
export const TRIGGER_CHOICES = ['Sunday after breakfast', 'Sunday after church', 'Sunday after lunch', 'Sunday evening'] as const;

/** The kit's year: ages on the sheet are as of October 2027. */
const KIT_YEAR = 2027;

export const FALL_TEMPLATES: readonly Omit<FallJob, 'ownerId'>[] = [
  { id: 'warm', title: 'Check warmer clothes', description: 'Try on long sleeves, pants, sweaters, and jackets. Set aside what no longer fits.', icon: '/images/club/october/clothes-for-cooler-mornings.webp' },
  { id: 'summer', title: 'Sort summer clothes', description: 'Gather summer clothes. Keep what may fit next year, store it, and set aside outgrown items for adult review.', icon: '/images/club/october/school-and-activity-gear.webp' },
  { id: 'gear', title: 'Check seasonal gear', description: 'Check coats, boots, hats, and gloves where needed. Flag anything missing or outgrown.', icon: '/images/club/october/a-home-for-everything.webp' },
];

/** People who appear on the sheet: current adults and children (archived members never print). */
export const planMembers = <M extends PlanMember>(members: readonly M[]): M[] =>
  members.filter((m) => (m.kind === 'adult' || m.kind === 'child') && !m.archived);

export const ageOf = (m: PlanMember) =>
  m.birthYear ? Math.max(1, KIT_YEAR - m.birthYear - ((m.birthMonth ?? 1) > 10 ? 1 : 0)) : 8;

export const weeklyRole = (m: PlanMember, i: number) =>
  m.kind === 'adult'
    ? m.isAccountHolder
      ? 'Review our shared plans and prepare my own commitments.'
      : 'Own upcoming transportation, supplies, and logistics.'
    : ageOf(m) <= 5
      ? 'Look at the picture calendar with an adult and get my clothes ready.'
      : ageOf(m) <= 10
        ? i % 2 === 0
          ? 'Check school and activity days; spot what I need.'
          : 'Prepare my clothes, bag, and belongings for the week.'
        : 'Review my calendar, prepare for commitments, and ask for help early.';

/** Children by first name; the first two parents/partners are Mom and Dad unless renamed. */
export const displayName = (m: PlanMember, members: readonly PlanMember[], names?: Record<string, string>) => {
  if (m.kind === 'child') return names?.[m.id] ?? m.firstName;
  const parents = members.filter((x) => x.kind === 'adult' && (x.role === 'parent' || x.role === 'partner'));
  const ix = parents.findIndex((x) => x.id === m.id);
  return names?.[m.id] ?? (ix === 0 ? 'Mom' : ix === 1 ? 'Dad' : m.firstName);
};

export const defaultFallJobs = (members: readonly PlanMember[]): FallJob[] => {
  const children = members.filter((m) => m.kind === 'child');
  const adults = members.filter((m) => m.kind === 'adult');
  const otherAdult = adults.find((m) => !m.isAccountHolder) ?? adults[0];
  return FALL_TEMPLATES.map((item, i) => ({
    ...item,
    ownerId: (i === 2 ? otherAdult?.id : children[i]?.id ?? adults[i % Math.max(1, adults.length)]?.id) ?? members[i % Math.max(1, members.length)]?.id ?? '',
  }));
};

export const emptyState = (): PlanState => ({ trigger: DEFAULT_TRIGGER, assignments: {}, fallJobs: [] });

/** Fill in prepared roles and fall jobs she hasn't set. Mutates and returns `state`. */
export const applyDefaults = (state: PlanState, members: readonly PlanMember[]): PlanState => {
  members.forEach((m, i) => {
    if (state.assignments[m.id] === undefined) state.assignments[m.id] = weeklyRole(m, i);
  });
  if (!state.fallJobs?.length) state.fallJobs = defaultFallJobs(members);
  return state;
};

export const preparedState = (members: readonly PlanMember[]) => applyDefaults(emptyState(), members);

/** The saved plan for this family, if the stored JSON is one and is well-formed. */
export const readSavedPlan = (raw: string | null, key: string): PlanState | null => {
  try {
    const previous = JSON.parse(raw ?? 'null') as Partial<SavedPlan> | null;
    const s = previous?.state;
    if (previous?.current === key && s && typeof s.trigger === 'string' && s.assignments && Array.isArray(s.fallJobs)) return s;
  } catch {
    /* not a plan */
  }
  return null;
};

/** True when the plan differs from what we prepared for these members (her own changes). */
export const hasChanges = (state: PlanState, members: readonly PlanMember[]) => {
  const prepared = preparedState(members);
  if (state.trigger !== prepared.trigger) return true;
  const cue = state.text?.cue;
  if (cue !== undefined && cue !== state.trigger) return true;
  const family = state.text?.family;
  if (family !== undefined && family !== DEFAULT_TAGLINE) return true;
  if (members.some((m) => state.names?.[m.id] !== undefined && state.names[m.id] !== displayName(m, members))) return true;
  if (members.some((m) => (state.assignments[m.id] ?? prepared.assignments[m.id]) !== prepared.assignments[m.id])) return true;
  const fall = (jobs: FallJob[]) => JSON.stringify(jobs.map(({ id, title, description, ownerId, removed }) => [id, title, description, ownerId, Boolean(removed)]));
  return fall(state.fallJobs) !== fall(prepared.fallJobs);
};

/** The three Sunday steps, as printed on the front (fixed content: shown, never edited). */
export const SUNDAY_STEPS = [
  { title: 'Look ahead', text: 'What’s coming up this week? Look at our wall calendar.', icon: '/images/club/october/what-is-coming.webp' },
  { title: 'Prepare early', text: 'What can we pack, check, or prepare before we need it?', icon: '/images/club/october/what-will-I-need.webp' },
  { title: 'Share the work', text: 'Who owns each step? Ask for help when needed.', icon: '/images/club/october/what-can-I-prepare.webp' },
] as const;

/** Sensible weekly parts for this person: the prepared one first, then two more that fit their age. */
export const roleSuggestions = (m: PlanMember, i: number): string[] => {
  const age = ageOf(m);
  const more =
    m.kind === 'adult'
      ? m.isAccountHolder
        ? ['Lead our Sunday check-in and make sure everyone has a part.', 'Look ahead for appointments, school events, and deadlines.']
        : ['Check the week’s activities and plan rides and gear.', 'Help the kids get their bags and belongings ready.']
      : age <= 5
        ? ['Choose my clothes for the week with a grown-up.', 'Put my shoes and bag by the door.']
        : age <= 10
          ? ['Check school and activity days; spot what I need.', 'Prepare my clothes, bag, and belongings for the week.', 'Pack my bag the night before and ask for help early.']
          : ['Plan my week and pack what I need.', 'Tell someone early what I need help with.'];
  return [...new Set([weeklyRole(m, i), ...more])].slice(0, 3);
};

/** Edits from the mobile sheets. Each returns the same state object, changed. */
export const setTrigger = (s: PlanState, trigger: string) => {
  s.trigger = trigger.replace(/\s+/g, ' ').trim().slice(0, 85) || DEFAULT_TRIGGER;
  if (s.text) delete s.text.cue;
  return s;
};
export const setRole = (s: PlanState, memberId: string, role: string) => {
  s.assignments[memberId] = role.replace(/\s+/g, ' ').slice(0, 105);
  return s;
};
export const setName = (s: PlanState, memberId: string, name: string) => {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 35);
  if (clean) (s.names ??= {})[memberId] = clean;
  else if (s.names) delete s.names[memberId];
  return s;
};
export const setFallJob = (s: PlanState, jobId: string, patch: Partial<Pick<FallJob, 'title' | 'description' | 'ownerId' | 'removed'>>) => {
  const job = s.fallJobs.find((j) => j.id === jobId);
  if (job) Object.assign(job, patch);
  return s;
};

/** What she approves: everything that prints. Same plan, same fingerprint. */
export const planFingerprint = (s: PlanState) =>
  JSON.stringify([
    s.trigger,
    Object.entries(s.assignments).sort(),
    s.fallJobs.map(({ id, title, description, ownerId, removed }) => [id, title, description, ownerId, Boolean(removed)]),
    Object.entries(s.text ?? {}).sort(),
    Object.entries(s.names ?? {}).sort(),
  ]);

/**
 * The live plan on a page, published by the printable (OctoberSundayReset.astro) on its `.osr` root as
 * `clubPlan`: the shared PlanResource (src/lib/club/plan/resource.ts) plus October's family helpers.
 * It fires PLAN_CHANGE (bubbling) after every repaint once a family is loaded.
 */
export interface OsrPlan extends PlanResource<PlanState> {
  members: () => PlanMember[];
  nameOf: (m: PlanMember) => string;
}
