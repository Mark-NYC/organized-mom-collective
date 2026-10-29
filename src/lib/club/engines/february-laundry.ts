/**
 * February 2027 laundry ownership: which guide each child gets, laundry days and who runs the machines, for the
 * printable (src/components/club/FebruaryLaundryGuides.astro), the desktop rail and the mobile plan screen
 * (FebruaryPlanMobile.astro). Pure functions only.
 *
 * Two guides: "My Clothes, My Job" (younger) and "I Can Do My Own Laundry" (older). Age in February 2027 suggests
 * the level (9 and up: older); Mom can change any child's level. One page per level in use, never one per child:
 * children at the same level share a page. Children and the operator are by member ID; archived members never print.
 */
import { ageInMonth } from '../profile';
import type { PlanResource } from '../plan/resource';

export const KIT_MONTH = '2027-02';
export type Level = 'young' | 'older';
export const LEVELS: readonly Level[] = ['young', 'older'];
export const LEVEL_INFO: Record<Level, { guide: string; short: string }> = {
  young: { guide: 'My Clothes, My Job', short: 'My clothes, my responsibility' },
  older: { guide: 'I Can Do My Own Laundry', short: 'I can do my own laundry' },
};
export const OLDER_FROM = 9;
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const AS_NEEDED = 'As needed';
export const ANY_GROWN_UP = 'grown-up';

export interface LaundryMember { id: string; firstName: string; kind: string; role?: string; birthYear?: number; birthMonth?: number; archived?: boolean; isAccountHolder?: boolean }
export interface LaundryState { levels: Record<string, Level>; days: string[]; operator: string }

export const kidsOf = <M extends LaundryMember>(members: readonly M[]) => members.filter((m) => m.kind === 'child' && !m.archived && m.firstName.trim());
export const adultsOf = <M extends LaundryMember>(members: readonly M[]) => members.filter((m) => m.kind === 'adult' && !m.archived);
/** Age in February 2027, or null when no birth year is saved. */
export const ageOf = (m: LaundryMember) => (m.birthYear ? ageInMonth(m.birthYear, m.birthMonth, KIT_MONTH) : null);
export const suggestedLevel = (m: LaundryMember): Level => ((ageOf(m) ?? 0) >= OLDER_FROM ? 'older' : 'young');

/** What children call the operator: the first two parents or partners are Mom and Dad, other grown-ups by name. */
export const operatorLabel = (id: string, members: readonly LaundryMember[]) => {
  const parents = adultsOf(members).filter((m) => m.role === 'parent' || m.role === 'partner');
  const i = parents.findIndex((m) => m.id === id);
  if (i === 0) return 'Mom';
  if (i === 1) return 'Dad';
  return adultsOf(members).find((m) => m.id === id)?.firstName ?? 'a grown-up';
};

export const freshState = (): LaundryState => ({ levels: {}, days: ['Saturday'], operator: ANY_GROWN_UP });
export const levelOf = (s: LaundryState, kid: LaundryMember): Level => s.levels[kid.id] ?? suggestedLevel(kid);

/** Keep the plan to this family: drop levels for children who left, and an operator who isn't a grown-up here. */
export const applyFamily = (s: LaundryState, members: readonly LaundryMember[]) => {
  const ids = new Set(kidsOf(members).map((k) => k.id));
  for (const id of Object.keys(s.levels)) if (!ids.has(id)) delete s.levels[id];
  if (s.operator !== ANY_GROWN_UP && !adultsOf(members).some((m) => m.id === s.operator)) s.operator = ANY_GROWN_UP;
  s.days = cleanDays(s.days);
  return s;
};

const cleanDays = (days: readonly string[]) => {
  if (days.includes(AS_NEEDED)) return [AS_NEEDED];
  const picked = WEEKDAYS.filter((d) => days.includes(d));
  return picked.length ? [...picked] : [AS_NEEDED];
};

export const laundryView = (s: LaundryState, members: readonly LaundryMember[]) => {
  const kids = kidsOf(members).map((k) => ({ id: k.id, name: k.firstName, age: ageOf(k), level: levelOf(s, k), suggested: suggestedLevel(k) }));
  const guides = LEVELS.map((level) => ({ level, names: kids.filter((k) => k.level === level).map((k) => k.name) })).filter((g) => g.names.length);
  const days = cleanDays(s.days);
  return {
    kids,
    /** The pages that print, younger first: one per level in use. */
    guides,
    days,
    daysLine: days.join(' · '),
    operator: s.operator,
    operatorName: operatorLabel(s.operator, members),
    operators: [{ id: ANY_GROWN_UP, name: 'Any grown-up', firstName: '' }, ...adultsOf(members).map((m) => ({ id: m.id, name: operatorLabel(m.id, members), firstName: m.firstName }))],
  };
};
export type LaundryView = ReturnType<typeof laundryView>;

/** The printed callout lines: unchanged wording unless a named grown-up runs the machines. */
export const machineLine = (level: Level, operator: string) => {
  if (operator === 'a grown-up') return level === 'young' ? 'Grown-ups handle the machines until you are ready.' : 'Only operate machines after training. Ask an adult about anything unfamiliar.';
  return level === 'young' ? `${operator} handles the machines until you are ready.` : `Only operate machines after training with ${operator}. Ask about anything unfamiliar.`;
};

export const laundryFingerprint = (s: LaundryState, members: readonly LaundryMember[]) => {
  const v = laundryView(s, members);
  return JSON.stringify([v.guides, v.daysLine, v.operatorName]);
};

export const setLevel = (s: LaundryState, id: string, level: Level, members: readonly LaundryMember[]) => {
  const kid = kidsOf(members).find((k) => k.id === id);
  if (!kid) return s;
  if (level === suggestedLevel(kid)) delete s.levels[id];
  else s.levels[id] = level;
  return s;
};
/** Turn a day on or off. "As needed" replaces scheduled days; picking a day replaces "As needed". */
export const toggleDay = (s: LaundryState, day: string) => {
  const on = cleanDays(s.days).includes(day);
  if (day === AS_NEEDED) s.days = on ? ['Saturday'] : [AS_NEEDED];
  else if ((WEEKDAYS as readonly string[]).includes(day)) s.days = cleanDays(on ? s.days.filter((d) => d !== day) : [...s.days.filter((d) => d !== AS_NEEDED), day]);
  return s;
};
export const setOperator = (s: LaundryState, id: string, members: readonly LaundryMember[]) => {
  if (id === ANY_GROWN_UP || adultsOf(members).some((m) => m.id === id)) s.operator = id;
  return s;
};
export const restoreSuggested = (s: LaundryState) => Object.assign(s, freshState());
export const planChanged = (s: LaundryState, members: readonly LaundryMember[]) => JSON.stringify(applyFamily(structuredClone(s), members)) !== JSON.stringify(freshState());

export const isLaundryState = (x: unknown): x is LaundryState => {
  const s = x as Partial<LaundryState> | null;
  return Boolean(s && s.levels && typeof s.levels === 'object' && Object.values(s.levels).every((l) => l === 'young' || l === 'older')
    && Array.isArray(s.days) && s.days.every((d) => typeof d === 'string') && typeof s.operator === 'string');
};

/**
 * The earlier February page kept { familyId, profileVersion, edits: { children: [{ id, level }], days | day, operator } }
 * in this tab, the operator by first name. Read once for the same family; the caller removes it.
 */
export const fromLegacy = (raw: string | null, householdId: string, members: readonly LaundryMember[]): LaundryState | null => {
  try {
    const old = JSON.parse(raw ?? 'null') as { familyId?: string; edits?: { children?: { id?: string; level?: string }[]; days?: unknown; day?: unknown; operator?: unknown } } | null;
    if (!old?.edits || old.familyId !== householdId) return null;
    const s = freshState();
    for (const c of old.edits.children ?? []) if (c?.id && (c.level === 'young' || c.level === 'older')) setLevel(s, c.id, c.level, members);
    const days = Array.isArray(old.edits.days) ? old.edits.days.filter((d): d is string => typeof d === 'string') : typeof old.edits.day === 'string' ? [old.edits.day] : ['Saturday'];
    s.days = cleanDays(days);
    const op = adultsOf(members).find((m) => m.firstName === old.edits!.operator);
    if (op) s.operator = op.id;
    return applyFamily(s, members);
  } catch {
    return null;
  }
};

export interface LaundryPlan extends PlanResource<LaundryState> {
  members: () => LaundryMember[];
  view: () => LaundryView;
  setLocked: (on: boolean) => void;
  openEditor: () => void;
}
