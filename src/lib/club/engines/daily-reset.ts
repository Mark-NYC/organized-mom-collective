/**
 * October 2027 Daily Reset ("Less asking. More doing."; September until Oct 2026): the rules behind the two-sided
 * printable (src/components/club/OctoberDailyReset.astro): a child-facing front with one cue, two or three cleanup
 * jobs and a finish line, and a parent-facing back. Pure functions only, so the printable, the desktop rail and the
 * mobile plan screen (OctoberPlanMobile.astro) read one plan. Children by member ID; archived children never print.
 */
import { ageInMonth } from '../profile';
import type { PlanResource } from '../plan/resource';

export const KIT_MONTH = '2027-10';
export type Area = 'whole' | 'bedroom' | 'playroom' | 'living';
export const AREAS: Record<Area, { label: string; description: string; icon: string }> = {
  whole: { label: 'Whole House', description: 'whole-house cleanup', icon: '/images/club/september/whole-house.png' },
  bedroom: { label: 'Bedroom', description: 'bedroom cleanup', icon: '/images/club/september/bedroom.png' },
  playroom: { label: 'Playroom', description: 'playroom cleanup', icon: '/images/club/september/playroom.png' },
  living: { label: 'Living Room', description: 'living room cleanup', icon: '/images/club/september/living-room.png' },
};
export const TRIGGERS = ['Before Dinner', 'After Dinner', 'Before Bedtime', 'After School', 'Before the Next Play Activity'] as const;
export const OTHER_TRIGGERS = ['After our afternoon snack', 'When our daily cleanup alarm rings', 'When screen time ends'] as const;
export const JOB_OPTIONS = ['Toys Put Away', 'Clothes in Hamper', 'Personal Belongings Put Away', 'Floor Vacuum-Ready', 'Backpack Put Away', 'Books Put Away', 'Play Area Cleared'];
const AREA_JOBS: Record<Area, string[]> = {
  whole: ['Toys Put Away', 'Clothes in Hamper', 'Floor Vacuum-Ready'],
  bedroom: ['Toys Put Away', 'Clothes in Hamper', 'Floor Vacuum-Ready'],
  playroom: ['Toys Put Away', 'Books Put Away', 'Play Area Cleared'],
  living: ['Toys Put Away', 'Personal Belongings Put Away', 'Floor Vacuum-Ready'],
};
export const JOB_ICONS: Record<string, string> = {
  'Toys Put Away': '/images/club/icon-library/toys-in-toy-basket.png',
  'Clothes in Hamper': '/images/club/september/clothes-in-hamper.png',
  'Personal Belongings Put Away': '/images/club/september/personal-belongings-put-away.png',
  'Floor Vacuum-Ready': '/images/club/icon-library/clear-floor.png',
  'Backpack Put Away': '/images/club/icon-library/backpack.png',
  'Books Put Away': '/images/club/icon-library/book.png',
  'Play Area Cleared': '/images/club/icon-library/clear-floor.png',
};
const COACHING: Record<string, string> = {
  'Before Dinner': "It's almost dinnertime. Let's get our cleanup jobs done.",
  'After Dinner': "Dinner's finished. Time to put our things away.",
  'Before Bedtime': "Before we get ready for bed, let's finish our cleanup jobs.",
  'After School': "Now that we're home, let's put our things where they belong.",
  'Before the Next Play Activity': "Before starting something new, let's put away what we've been using.",
};
/** Words she can retype on the sheet; each falls back to the prepared wording. */
export const TEXT_IDS = ['owner', 'cue', 'duration', 'count', 'start', 'finish'] as const;
export type TextId = (typeof TEXT_IDS)[number];
export const TEXT_LIMIT = 160;
export const EVERYONE = 'everyone';

export interface ResetMember { id: string; firstName: string; kind: string; birthYear?: number; birthMonth?: number; archived?: boolean }
export interface ResetState { owner: string; area: Area; trigger: string; jobs: string[]; jobOwners?: (string | null)[]; custom?: boolean; text?: Partial<Record<TextId, string>> }

export const kidsOf = <M extends ResetMember>(members: readonly M[]) => members.filter((m) => m.kind === 'child' && !m.archived);
/** Age in October 2027 (at least 2); 8 when no birth year is saved. */
export const ageOf = (m?: ResetMember) => (m?.birthYear ? Math.max(2, ageInMonth(m.birthYear, m.birthMonth, KIT_MONTH)) : 8);
/** Whose age sets the plan: the chosen child, or the youngest child for the family plan. */
export const planAge = (s: ResetState, members: readonly ResetMember[]) => {
  const kids = kidsOf(members);
  return s.owner === 'family' ? (kids.length ? Math.min(...kids.map((k) => ageOf(k))) : 8) : ageOf(kids.find((k) => k.id === s.owner));
};
const prepareJobs = (area: Area, age: number) => {
  const jobs = [...AREA_JOBS[area]];
  if (age <= 5) { jobs[0] = 'Toys Put Away'; jobs[1] = 'Clothes in Hamper'; }
  return jobs;
};
const prepare = (s: ResetState, members: readonly ResetMember[]) => { s.jobs = prepareJobs(s.area, planAge(s, members)); s.jobOwners = []; s.custom = false; return s; };
export const freshState = (members: readonly ResetMember[]): ResetState => prepare({ owner: 'family', area: 'whole', trigger: 'Before Dinner', jobs: [], jobOwners: [] }, members);

/** Keep the plan to this family: a gone child is no longer the owner or a job's person; untouched jobs follow age. */
export const applyFamily = (s: ResetState, members: readonly ResetMember[]) => {
  const ids = new Set(kidsOf(members).map((k) => k.id));
  if (s.owner !== 'family' && !ids.has(s.owner)) s.owner = 'family';
  s.jobOwners = (s.jobOwners ?? []).map((id) => (id && (id === EVERYONE || ids.has(id)) ? id : null));
  if (!s.custom) prepare(s, members);
  return s;
};

export const resetView = (s: ResetState, members: readonly ResetMember[]) => {
  const kids = kidsOf(members);
  const age = planAge(s, members);
  const count = age <= 5 ? 2 : 3;
  const selected = kids.find((k) => k.id === s.owner);
  const text = (id: TextId, prepared: string) => s.text?.[id] ?? prepared;
  const personFor = (i: number) => {
    const key = s.jobOwners?.[i];
    if (key === EVERYONE) return 'Everyone';
    const chosen = kids.find((k) => k.id === key);
    if (chosen) return chosen.firstName;
    if (selected) return selected.firstName;
    return kids.length > 1 ? (i === count - 1 ? 'Everyone' : kids[i % kids.length].firstName) : kids.length === 1 ? kids[0].firstName : 'Our kids';
  };
  /** The person a job's chooser shows: her choice, or the prepared one. */
  const ownerIdFor = (i: number) => s.jobOwners?.[i] ?? (s.owner !== 'family' ? s.owner : kids.length > 1 ? (i === count - 1 ? EVERYONE : kids[i % kids.length].id) : kids.length === 1 ? kids[0].id : EVERYONE);
  const jobs = s.jobs.slice(0, count).map((label, i) => ({ label, icon: JOB_ICONS[label] ?? JOB_ICONS['Toys Put Away'], person: personFor(i), ownerId: ownerIdFor(i) }));
  return {
    age,
    count,
    owner: text('owner', selected ? `${selected.firstName}'s ${AREAS[s.area].description}` : `Our family's ${AREAS[s.area].description}`),
    cue: text('cue', s.trigger),
    duration: text('duration', age <= 5 ? 'A small reset. A grown-up helps me start.' : age >= 10 ? 'I own this reset and check my own work.' : 'A few minutes to put our things away.'),
    countLine: text('count', count === 2 ? 'Two little jobs. Then we’re done.' : 'Three things. Then we’re done.'),
    jobs,
    finish: text('finish', s.jobs.includes('Floor Vacuum-Ready') ? 'Toys, clothes, and loose belongings are off the floor so it could be vacuumed.' : 'Each item is back where it belongs.'),
    start: text('start', age <= 5 ? 'Start with just one toy.' : age >= 10 ? 'Start by scanning the floor and putting away what you see.' : 'Start with the toys nearest your feet.'),
    checks: jobs.map((j) => `✓ ${j.label}`),
    coaching: COACHING[s.trigger] ?? `It's cleanup time: ${s.trigger}. Let's put our things away.`,
    summary: { owner: selected?.firstName ?? 'Our kids together', area: AREAS[s.area].label, trigger: s.trigger },
    area: s.area,
    trigger: s.trigger,
    kids: kids.map((k) => ({ id: k.id, name: k.firstName })),
  };
};
export type ResetView = ReturnType<typeof resetView>;

export const resetFingerprint = (s: ResetState, members: readonly ResetMember[]) => {
  const v = resetView(s, members);
  return JSON.stringify([v.owner, v.cue, v.duration, v.countLine, v.jobs.map((j) => [j.label, j.person]), v.finish, v.start, v.coaching]);
};

// Edits. Each changes `s` in place and returns it.
export const setTrigger = (s: ResetState, trigger: string) => {
  const t = trigger.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
  if (t) { s.trigger = t; if (s.text) delete s.text.cue; }
  return s;
};
export const setArea = (s: ResetState, area: Area, members: readonly ResetMember[]) => {
  if (!(area in AREAS)) return s;
  s.area = area;
  s.text = {};
  return prepare(s, members);
};
export const setJob = (s: ResetState, i: number, label: string) => {
  const v = label.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
  if (v && i >= 0 && i < 3) { s.jobs[i] = v; s.custom = true; }
  return s;
};
export const setJobOwner = (s: ResetState, i: number, id: string, members: readonly ResetMember[]) => {
  if (id === EVERYONE || kidsOf(members).some((k) => k.id === id)) { (s.jobOwners ??= [])[i] = id; s.custom = true; }
  return s;
};
/** Retyped words on the sheet; typing the cue also changes the trigger. Blank goes back to the prepared wording. */
export const setText = (s: ResetState, id: TextId, value: string) => {
  const v = value.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
  if (id === 'cue') return setTrigger(s, v);
  s.text ??= {};
  if (v) s.text[id] = v;
  else delete s.text[id];
  return s;
};
export const restorePlan = (s: ResetState, members: readonly ResetMember[]) => Object.assign(s, freshState(members), { text: {} });
export const planChanged = (s: ResetState, members: readonly ResetMember[]) => resetFingerprint(s, members) !== resetFingerprint(freshState(members), members);

export const isResetState = (x: unknown): x is ResetState => {
  const s = x as Partial<ResetState> | null;
  return Boolean(s && typeof s.owner === 'string' && typeof s.area === 'string' && s.area in AREAS && typeof s.trigger === 'string'
    && Array.isArray(s.jobs) && s.jobs.length === 3 && s.jobs.every((j) => typeof j === 'string'));
};
/** The earlier page kept { familyKey, state } in this tab under its September key: read once for the same family. */
export const fromLegacy = (raw: string | null, familyKey: string, members: readonly ResetMember[]): ResetState | null => {
  try {
    const old = JSON.parse(raw ?? 'null') as { familyKey?: string; state?: unknown } | null;
    if (!old || old.familyKey !== familyKey || !isResetState(old.state)) return null;
    return applyFamily(structuredClone(old.state), members);
  } catch {
    return null;
  }
};

export interface ResetPlan extends PlanResource<ResetState> {
  members: () => ResetMember[];
  view: () => ResetView;
  setLocked: (on: boolean) => void;
  openEditor: () => void;
}
