/**
 * August 2027 School Day Routines: the rules behind the one-page "My School Day" printable
 * (src/components/club/AugustSchoolRoutines.astro). Pure functions only, so the printable, the desktop rail and the
 * mobile plan screen (AugustPlanMobile.astro) read one plan.
 *
 * Two picture routines (before school, after school) of timed steps. Each child keeps their own routine, prepared for
 * their age in August 2027; the sheet prints the selected child's. Steps can be renamed, retimed, reordered, removed
 * (and restored) or added from a short list. Children are by member ID.
 */
import { ageInMonth } from '../profile';
import type { PlanResource } from '../plan/resource';

export const KIT_MONTH = '2027-08';
export type Group = 'morning' | 'after';
export const GROUPS: readonly Group[] = ['morning', 'after'];
export const GROUP_INFO: Record<Group, { title: string; tab: string }> = { morning: { title: 'Before School', tab: 'Before school' }, after: { title: 'After School', tab: 'After school' } };
export const LABEL_LIMIT = 55;
export const FOOTER_LIMIT = 120;
export const DEFAULT_FOOTER = "Check my routine. Do my part. Then I'm ready!";
/** Shorter routine: hides these without deleting them. */
export const SHORTER_HIDES: Record<Group, string> = { morning: 'wake', after: 'wash' };

export const ICONS: Record<string, string> = {
  lunch: '/images/club/icon-library/lunch-box.png', water: '/images/club/icon-library/water-bottle.png',
  quiet: '/images/club/icon-library/quiet-time.png', play: '/images/club/icon-library/free-afternoon.png',
  wake: '/images/club/icon-library/morning-start.png', clothes: '/images/club/icon-library/getting-dressed.png',
  breakfast: '/images/club/icon-library/breakfast-bowl.png', teeth: '/images/club/icon-library/toothbrush.png',
  bag: '/images/club/icon-library/backpack.png', shoes: '/images/club/icon-library/sneakers.png',
  hands: '/images/club/icon-library/washing-hands.png', snack: '/images/club/icon-library/yogurt-cup.png',
  book: '/images/club/icon-library/doing-homework.png',
};

export interface Step { id: string; time: string; label: string; icon: string; group: Group; removed?: boolean }
const SEEDS: readonly Step[] = [
  { id: 'wake', time: '07:00', label: 'Wake up & stretch', icon: 'wake', group: 'morning' },
  { id: 'dress', time: '07:15', label: 'Get dressed', icon: 'clothes', group: 'morning' },
  { id: 'eat', time: '07:25', label: 'Eat breakfast', icon: 'breakfast', group: 'morning' },
  { id: 'teeth', time: '07:45', label: 'Brush teeth', icon: 'teeth', group: 'morning' },
  { id: 'lunch', time: '07:48', label: 'Grab My Lunch Box', icon: 'lunch', group: 'morning' },
  { id: 'water', time: '07:49', label: 'Grab My Water Bottle', icon: 'water', group: 'morning' },
  { id: 'backpack', time: '07:50', label: 'Grab backpack & shoes', icon: 'bag', group: 'morning' },
  { id: 'shoes', time: '15:30', label: 'Shoes & coat away', icon: 'shoes', group: 'after' },
  { id: 'unpack', time: '15:35', label: 'Unpack backpack & lunch box', icon: 'bag', group: 'after' },
  { id: 'wash', time: '15:40', label: 'Wash hands', icon: 'hands', group: 'after' },
  { id: 'snack', time: '15:45', label: 'Snack', icon: 'snack', group: 'after' },
  { id: 'homework', time: '16:00', label: 'Homework & reading', icon: 'book', group: 'after' },
];
/** Steps she can add, a short list for each routine. */
export const CHOICES: Record<Group, readonly { id: string; label: string; icon: string }[]> = {
  morning: [
    { id: 'lunch', label: 'Grab My Lunch Box', icon: 'lunch' }, { id: 'pack-lunch', label: 'Pack My Lunch', icon: 'lunch' },
    { id: 'stow-lunch', label: 'Put Lunch Box in Backpack', icon: 'lunch' }, { id: 'water', label: 'Grab My Water Bottle', icon: 'water' },
    { id: 'fill-water', label: 'Fill My Water Bottle', icon: 'water' }, { id: 'stow-water', label: 'Put Water Bottle in Backpack', icon: 'water' },
    { id: 'read-early', label: 'Ready Early? Read or Draw.', icon: 'book' },
  ],
  after: [
    { id: 'put-backpack', label: 'Put My Backpack Away', icon: 'bag' }, { id: 'snack', label: 'Have a Snack', icon: 'snack' },
    { id: 'quiet', label: 'Quiet Time', icon: 'quiet' }, { id: 'free', label: 'Free Time', icon: 'play' },
    { id: 'homework', label: 'Homework', icon: 'book' }, { id: 'snack-free', label: 'Snack & Free Time', icon: 'snack' },
  ],
};
const LUNCH = ['lunch', 'pack-lunch', 'stow-lunch'];
const WATER = ['water', 'fill-water', 'stow-water'];

export interface Routine { steps: Step[]; mode: 'standard' | 'simple'; footer?: string }
export interface AugState { child: string; boards: Record<string, Routine> }
export interface AugMember { id: string; firstName: string; kind: string; birthYear?: number; birthMonth?: number; archived?: boolean }

export const kidsOf = <M extends AugMember>(members: readonly M[]) => members.filter((m) => m.kind === 'child' && !m.archived);
/** Age in August 2027, at least 3; the family routine is pitched at 8. */
export const ageFor = (child: string, members: readonly AugMember[]) => {
  const kid = kidsOf(members).find((k) => k.id === child);
  return kid?.birthYear ? Math.max(3, ageInMonth(kid.birthYear, kid.birthMonth, KIT_MONTH)) : 8;
};
export const preparedRoutine = (age: number): Routine => {
  const steps = SEEDS.map((s) => ({ ...s }));
  const set = (id: string, label: string) => { steps.find((s) => s.id === id)!.label = label; };
  if (age <= 5) { set('homework', 'Look at a book'); set('backpack', 'Get my school bag'); }
  if (age >= 11) { set('backpack', 'Check bag & school supplies'); set('homework', 'Homework & study time'); }
  return { steps, mode: 'standard' };
};
export const freshState = (members: readonly AugMember[]): AugState => ({ child: kidsOf(members)[0]?.id ?? 'family', boards: {} });
export const routineOf = (s: AugState, members: readonly AugMember[]) => (s.boards[s.child] ??= preparedRoutine(ageFor(s.child, members)));

export const applyFamily = (s: AugState, members: readonly AugMember[]) => {
  const ids = new Set(kidsOf(members).map((k) => k.id));
  for (const id of Object.keys(s.boards)) if (id !== 'family' && !ids.has(id)) delete s.boards[id];
  if (s.child !== 'family' && !ids.has(s.child)) s.child = kidsOf(members)[0]?.id ?? 'family';
  routineOf(s, members);
  return s;
};

export const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const clock = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` : t;
};
/** The steps that print, in order. */
export const shown = (r: Routine, g: Group) => r.steps.filter((x) => x.group === g && !x.removed && !(r.mode === 'simple' && x.id === SHORTER_HIDES[g]));

const isStep = (x: unknown): x is Step => {
  const s = x as Partial<Step> | null;
  return Boolean(s && typeof s.id === 'string' && typeof s.time === 'string' && typeof s.label === 'string' && typeof s.icon === 'string' && (s.group === 'morning' || s.group === 'after'));
};
const isRoutine = (x: unknown): x is Routine => {
  const r = x as Partial<Routine> | null;
  return Boolean(r && Array.isArray(r.steps) && r.steps.every(isStep) && (r.mode === 'standard' || r.mode === 'simple') && (r.footer === undefined || typeof r.footer === 'string'));
};
export const isAugState = (x: unknown): x is AugState => {
  const s = x as Partial<AugState> | null;
  return Boolean(s && typeof s.child === 'string' && s.boards && typeof s.boards === 'object' && Object.values(s.boards).every(isRoutine));
};

export const augView = (s: AugState, members: readonly AugMember[]) => {
  const r = routineOf(s, members);
  const kid = kidsOf(members).find((k) => k.id === s.child);
  return {
    child: s.child,
    childName: kid?.firstName ?? 'Our family',
    title: kid ? `${kid.firstName}'s morning & after-school routines` : 'Our morning & after-school routines',
    age: ageFor(s.child, members),
    groups: Object.fromEntries(GROUPS.map((g) => [g, shown(r, g).map((x) => ({ ...x, clock: clock(x.time) }))])) as Record<Group, (Step & { clock: string })[]>,
    footer: r.footer ?? DEFAULT_FOOTER,
    routine: r,
    kids: kidsOf(members).map((k) => ({ id: k.id, name: k.firstName })),
  };
};
export type AugView = ReturnType<typeof augView>;

export const augFingerprint = (s: AugState, members: readonly AugMember[]) => {
  const v = augView(s, members);
  return JSON.stringify([v.title, GROUPS.map((g) => v.groups[g].map((x) => [x.icon, x.label, x.time])), v.footer]);
};

// Edits on the selected routine. Each changes `s` in place and returns it.

export const setChild = (s: AugState, child: string, members: readonly AugMember[]) => {
  if (child === 'family' || kidsOf(members).some((k) => k.id === child)) s.child = child;
  routineOf(s, members);
  return s;
};
const stepOf = (s: AugState, id: string, members: readonly AugMember[]) => routineOf(s, members).steps.find((x) => x.id === id);
export const setLabel = (s: AugState, id: string, label: string, members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  if (st) st.label = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT) || st.label;
  return s;
};
export const setTime = (s: AugState, id: string, time: string, members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  if (st && validTime(time)) st.time = time;
  return s;
};
export const setRemoved = (s: AugState, id: string, removed: boolean, members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  if (st && removed) st.removed = true;
  else if (st) delete st.removed;
  return s;
};
/** Swap with the next shown step in the same routine, earlier (-1) or later (+1). */
export const move = (s: AugState, id: string, dir: -1 | 1, members: readonly AugMember[]) => {
  const r = routineOf(s, members);
  const st = r.steps.find((x) => x.id === id);
  if (!st) return s;
  const list = shown(r, st.group);
  const near = list[list.indexOf(st) + dir];
  if (near) { const a = r.steps.indexOf(st), b = r.steps.indexOf(near); [r.steps[a], r.steps[b]] = [r.steps[b], r.steps[a]]; }
  return s;
};
/** Add a listed step (only one lunch step and one water step at a time) or bring a removed one back. */
export const addStep = (s: AugState, group: Group, id: string, members: readonly AugMember[]) => {
  const choice = CHOICES[group].find((c) => c.id === id);
  if (!choice) return s;
  const r = routineOf(s, members);
  const family = group === 'morning' ? (LUNCH.includes(id) ? LUNCH : WATER.includes(id) ? WATER : []) : [];
  for (const other of r.steps) if (other.group === group && family.includes(other.id) && other.id !== id) other.removed = true;
  const prior = r.steps.find((x) => x.id === id && x.group === group);
  if (prior) { delete prior.removed; prior.label = choice.label; }
  else r.steps.push({ id, time: r.steps.filter((x) => x.group === group).at(-1)?.time ?? (group === 'morning' ? '07:50' : '16:00'), label: choice.label, icon: choice.icon, group });
  return s;
};
export const addCustom = (s: AugState, group: Group, label: string, id: string, members: readonly AugMember[]) => {
  const r = routineOf(s, members);
  const clean = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT);
  if (clean) r.steps.push({ id, time: r.steps.filter((x) => x.group === group).at(-1)?.time ?? (group === 'morning' ? '07:50' : '16:00'), label: clean, icon: group === 'morning' ? 'bag' : 'book', group });
  return s;
};
export const setMode = (s: AugState, simple: boolean, members: readonly AugMember[]) => { routineOf(s, members).mode = simple ? 'simple' : 'standard'; return s; };
export const setFooter = (s: AugState, value: string, members: readonly AugMember[]) => {
  const r = routineOf(s, members);
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, FOOTER_LIMIT);
  if (!clean || clean === DEFAULT_FOOTER) delete r.footer;
  else r.footer = clean;
  return s;
};
export const restoreRoutine = (s: AugState, members: readonly AugMember[]) => { s.boards[s.child] = preparedRoutine(ageFor(s.child, members)); return s; };
export const routineChanged = (s: AugState, members: readonly AugMember[]) => JSON.stringify(routineOf(s, members)) !== JSON.stringify(preparedRoutine(ageFor(s.child, members)));

/**
 * The earlier August page kept { profile, boards, active } in localStorage, boards carrying `child` and `footer`.
 * Read once for the same family; the caller removes the localStorage copy.
 */
export const fromLegacy = (raw: string | null, profile: string, members: readonly AugMember[]): AugState | null => {
  try {
    const old = JSON.parse(raw ?? 'null') as { profile?: string; boards?: Record<string, Record<string, unknown>>; active?: unknown } | null;
    if (!old?.boards || old.profile !== profile) return null;
    const s = freshState(members);
    for (const [id, b] of Object.entries(old.boards)) {
      if (!b || !Array.isArray(b.steps) || !(b.steps as unknown[]).every(isStep)) continue;
      const r: Routine = { steps: (b.steps as Step[]).map(({ removed, ...x }) => ({ ...x, label: x.label.slice(0, LABEL_LIMIT), ...(removed ? { removed: true } : {}) })), mode: b.mode === 'simple' ? 'simple' : 'standard' };
      if (typeof b.footer === 'string' && b.footer.trim() && b.footer !== DEFAULT_FOOTER) r.footer = b.footer.slice(0, FOOTER_LIMIT);
      s.boards[id] = r;
    }
    if (typeof old.active === 'string' && old.active in s.boards) s.child = old.active;
    return applyFamily(s, members);
  } catch {
    return null;
  }
};

export interface AugPlan extends PlanResource<AugState> {
  members: () => AugMember[];
  view: () => AugView;
  setLocked: (on: boolean) => void;
  /** The desktop routine editor. */
  openEditor: () => void;
}
