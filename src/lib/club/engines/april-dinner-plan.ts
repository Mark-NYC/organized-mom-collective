/**
 * April 2027 Dinner Team: the personalization rules behind the two-sided printable
 * (src/components/club/AprilDinnerPlan.astro). Pure functions only, so the printable, the desktop rail and the
 * mobile plan screen (AprilPlanMobile.astro) all read one plan.
 *
 * State is what she chose; everything printed is derived by `aprilView`. Assignments are member IDs; names are
 * resolved at render, parents as Mom and Dad on this child-facing sheet.
 */
import { aprilDinners, type DinnerEffort, type DinnerOption } from '../../../data/club/april-dinners';
import { ageInMonth } from '../profile';
import type { PlanResource } from '../plan/resource';

export type Role = 'captain' | 'checker' | 'table' | 'cook';
export const ROLES: readonly Role[] = ['captain', 'checker', 'table', 'cook'];
export const ROLE_INFO: Record<Role, { title: string; note: string; rule: string }> = {
  captain: { title: 'Dinner captain', note: 'Owns the whole plan', rule: 'Grown-ups only. Owns the whole job, not just one step.' },
  checker: { title: 'Ingredients checker', note: 'Checks and gathers', rule: 'Age 7 and up. Checks the pantry and gathers food.' },
  table: { title: 'Table captain', note: 'Gets the table ready', rule: 'Age 3 and up. Sets dishes and toppings, then clears.' },
  cook: { title: 'Cooking lead', note: 'Handles adult cooking', rule: 'Grown-ups only. Handles stove use and knives.' },
};

export const KIT_MONTH = '2027-04';
export const DEFAULT_MEAL = 'tacos-b';
export const DEFAULT_STEPS = ['Check ingredients & assign helpers', 'Cook safely using the directions on the back', 'Set out the food and call the family', 'Eat together; captain leads the cleanup'] as const;
export const DEFAULT_RULE = 'Ask the Dinner Captain what’s next, not Mom. The captain leads the plan and finishes with the team.';
export const DEFAULT_INTRO = 'Follow these directions for tonight’s meal. The Cooking Lead handles hot or sharp tasks; everyone else does their part.';
export const EFFORTS: readonly { id: DinnerEffort; label: string }[] = [
  { id: 'full', label: 'Full night · time to prepare' },
  { id: 'quick', label: 'Quick night · around 15–20 minutes' },
  { id: 'minimal', label: 'Minimal-effort · almost no prep' },
];

/** Wording she can change on the sheet, and its limit. Keys ending in ':' take an index. */
export const TEXT_LIMITS: Record<string, number> = { meal: 90, time: 180, servings: 180, rule: 180, intro: 180, 'step:': 180, 'ingredient:': 95, 'instruction:': 260 };
/** Wording that belongs to the chosen recipe: a different dinner replaces it. Everything else stays. */
export const isRecipeText = (key: string) => /^(meal|time|servings|ingredient:\d+|instruction:\d+)$/.test(key);
export const limitFor = (key: string) => TEXT_LIMITS[key] ?? TEXT_LIMITS[key.replace(/\d+$/, '')] ?? 180;

export interface AprilMember {
  id: string;
  firstName: string;
  kind: string;
  role?: string;
  birthYear?: number;
  birthMonth?: number;
  isAccountHolder?: boolean;
  archived?: boolean;
}

export interface AprilState {
  meal: string;
  assignments: Record<Role, string>;
  /** Roles she chose herself; the rest follow the family. */
  customized: Role[];
  text: Record<string, string>;
}

export const mealById = (id: string): DinnerOption => aprilDinners.find((m) => m.id === id) ?? aprilDinners.find((m) => m.id === DEFAULT_MEAL)!;
export const mealsFor = (effort: DinnerEffort, category: string) => aprilDinners.filter((m) => m.effort === effort && m.category === category);

/** Current adults and children: archived members never print or get a job. */
export const planMembers = <M extends AprilMember>(members: readonly M[]): M[] =>
  members.filter((m) => (m.kind === 'adult' || m.kind === 'child') && !m.archived);

export const ageOf = (m: AprilMember) => (m.kind === 'child' ? ageInMonth(m.birthYear ?? 2027, m.birthMonth, KIT_MONTH) : null);

export const eligible = (role: Role, m: AprilMember) => {
  if (m.archived) return false;
  if (role === 'captain' || role === 'cook') return m.kind === 'adult';
  const age = ageOf(m);
  if (age === null) return m.kind === 'adult';
  return role === 'checker' ? age >= 7 : age >= 3;
};

/** Children by first name; the first two parents or partners are Mom and Dad, other adults by name. */
export const displayName = (m: AprilMember, members: readonly AprilMember[]) => {
  if (m.kind === 'child') return m.firstName;
  const parents = members.filter((x) => x.kind === 'adult' && !x.archived && (x.role === 'parent' || x.role === 'partner'));
  const i = parents.findIndex((x) => x.id === m.id);
  return i === 0 ? 'Mom' : i === 1 ? 'Dad' : m.firstName;
};

/** The prepared person for a role, given the roles already filled before it (in ROLES order). */
export const suggested = (role: Role, members: readonly AprilMember[], filled: Partial<Record<Role, string>>) => {
  const live = planMembers(members);
  const adults = live.filter((m) => m.kind === 'adult');
  const kids = live.filter((m) => m.kind === 'child' && eligible(role, m));
  const firstAdult = adults[0]?.id ?? '';
  if (role === 'captain') return adults.find((m) => !m.isAccountHolder)?.id ?? firstAdult;
  if (role === 'cook') return adults.find((m) => m.id !== filled.captain)?.id ?? firstAdult;
  if (role === 'checker') return kids[0]?.id ?? firstAdult;
  return kids.find((m) => m.id !== filled.checker)?.id ?? kids[0]?.id ?? firstAdult;
};

export const freshState = (): AprilState => ({ meal: DEFAULT_MEAL, assignments: { captain: '', checker: '', table: '', cook: '' }, customized: [], text: {} });

/** Fill every role she hasn't chosen (or whose person can't do it any more) from the family. Mutates `s`. */
export const applyFamily = (s: AprilState, members: readonly AprilMember[]) => {
  const live = planMembers(members);
  for (const role of ROLES) {
    const kept = s.customized.includes(role) && live.some((m) => m.id === s.assignments[role] && eligible(role, m));
    if (!kept) {
      s.assignments[role] = suggested(role, live, s.assignments);
      s.customized = s.customized.filter((r) => r !== role);
    }
  }
  return s;
};

export const isAprilState = (x: unknown): x is AprilState => {
  const s = x as Partial<AprilState> | null;
  return Boolean(s && typeof s.meal === 'string' && s.assignments && typeof s.assignments === 'object'
    && ROLES.every((r) => typeof s.assignments![r] === 'string')
    && Array.isArray(s.customized) && s.text && typeof s.text === 'object');
};

/**
 * The plan saved by the published April page before the shared plan shell (sessionStorage, same key):
 * { profile: '<sample|account>:<householdId>', meal, assignments, customized, textEdits }.
 * Read once for the same family so earlier changes in this tab survive the update.
 */
export const fromLegacy = (raw: string | null, sample: string | null, householdId: string): AprilState | null => {
  try {
    const old = JSON.parse(raw ?? 'null') as { profile?: string; meal?: string; assignments?: Record<string, unknown>; customized?: unknown; textEdits?: unknown } | null;
    if (!old || old.profile !== `${sample ?? 'account'}:${householdId}`) return null;
    const s = freshState();
    if (typeof old.meal === 'string' && aprilDinners.some((m) => m.id === old.meal)) s.meal = old.meal;
    for (const r of ROLES) if (typeof old.assignments?.[r] === 'string') s.assignments[r] = old.assignments[r] as string;
    s.customized = ROLES.filter((r) => Array.isArray(old.customized) && old.customized.includes(r));
    if (old.textEdits && typeof old.textEdits === 'object') {
      for (const [k, v] of Object.entries(old.textEdits as Record<string, unknown>)) if (typeof v === 'string') s.text[k] = v.slice(0, limitFor(k));
    }
    return s;
  } catch {
    return null;
  }
};

/** Everything the sheet shows, resolved. */
export const aprilView = (s: AprilState, members: readonly AprilMember[]) => {
  const meal = mealById(s.meal);
  const t = (key: string, fallback: string) => s.text[key] ?? fallback;
  const live = planMembers(members);
  const person = (role: Role) => {
    const m = live.find((x) => x.id === s.assignments[role] && eligible(role, x));
    return { id: m?.id ?? '', name: m ? displayName(m, live) : 'Our family' };
  };
  return {
    meal,
    name: t('meal', meal.name),
    time: t('time', meal.time),
    servings: t('servings', meal.servings),
    ingredients: meal.ingredients.map((x, i) => t(`ingredient:${i}`, x)),
    instructions: meal.instructions.map((x, i) => t(`instruction:${i}`, x)),
    steps: DEFAULT_STEPS.map((x, i) => t(`step:${i}`, x)),
    rule: t('rule', DEFAULT_RULE),
    intro: t('intro', DEFAULT_INTRO),
    roles: Object.fromEntries(ROLES.map((r) => [r, person(r)])) as Record<Role, { id: string; name: string }>,
  };
};
export type AprilView = ReturnType<typeof aprilView>;

/** What she approves: everything that prints, as names (a renamed member changes the sheet). */
export const aprilFingerprint = (s: AprilState, members: readonly AprilMember[]) => {
  const v = aprilView(s, members);
  return JSON.stringify([v.meal.id, v.name, v.time, v.servings, v.ingredients, v.instructions, v.steps, v.rule, v.intro, ROLES.map((r) => v.roles[r].name)]);
};

// Edits. Each changes `s` in place and returns it.

/** A different dinner: its recipe wording replaces the old one; team, plan steps, rule and intro stay. */
export const chooseMeal = (s: AprilState, id: string) => {
  if (!aprilDinners.some((m) => m.id === id) || id === s.meal) return s;
  s.meal = id;
  for (const key of Object.keys(s.text)) if (isRecipeText(key)) delete s.text[key];
  return s;
};

export const assign = (s: AprilState, role: Role, memberId: string, members: readonly AprilMember[]) => {
  if (!planMembers(members).some((m) => m.id === memberId && eligible(role, m))) return s;
  s.assignments[role] = memberId;
  if (!s.customized.includes(role)) s.customized.push(role);
  return s;
};

/** The original wording for a key, from the chosen recipe or the sheet's own text. */
export const defaultText = (s: AprilState, key: string) => {
  const meal = mealById(s.meal);
  const [name, at] = key.split(':');
  const i = Number(at);
  switch (name) {
    case 'meal': return meal.name;
    case 'time': return meal.time;
    case 'servings': return meal.servings;
    case 'ingredient': return meal.ingredients[i] ?? '';
    case 'instruction': return meal.instructions[i] ?? '';
    case 'step': return DEFAULT_STEPS[i] ?? '';
    case 'rule': return DEFAULT_RULE;
    case 'intro': return DEFAULT_INTRO;
    default: return '';
  }
};

/** Set wording; empty or unchanged-from-default wording goes back to the default. */
export const setText = (s: AprilState, key: string, value: string) => {
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, limitFor(key));
  if (!clean || clean === defaultText(s, key)) delete s.text[key];
  else s.text[key] = clean;
  return s;
};

/** Only the team goes back to the suggested people. */
export const restoreTeam = (s: AprilState, members: readonly AprilMember[]) => {
  s.customized = [];
  return applyFamily(s, members);
};

/** Only her wording goes back to the original text, for this dinner and the shared lines. */
export const restoreWording = (s: AprilState) => {
  s.text = {};
  return s;
};

export const teamChanged = (s: AprilState) => s.customized.length > 0;
export const wordingChanged = (s: AprilState) => Object.keys(s.text).length > 0;

export interface AprilPlan extends PlanResource<AprilState> {
  members: () => AprilMember[];
  view: () => AprilView;
  /** Past the editing cutoff: the sheet stops taking typed edits and the dialogs stay closed. */
  setLocked: (on: boolean) => void;
  /** The desktop editors: choose the dinner, or the Dinner Team. */
  openEditor: (which: 'dinner' | 'team') => void;
}
