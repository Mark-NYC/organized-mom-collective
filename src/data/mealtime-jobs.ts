/**
 * The Family Meal Responsibility Planner's jobs and rules (src/components/site/MealPlanner.astro and meal-planner.ts
 * beside it). Not recipes, not a meal plan: who makes each part of mealtime happen, including the thinking behind it.
 *
 * Mealtime has four parts: the weekly thinking (choosing meals, checking supplies, the grocery list, shopping), then
 * before, during and after each meal. Every job carries a suggested minimum age (a suggestion; a parent can still
 * choose), grown-ups-only or safety tags (a hot stove or oven, sharp knives, heavy pots, food-safety calls) that a
 * person's limits rule out, and a weight: how much it asks of someone over a week, thinking counted fully.
 *
 * The rules it keeps (after November's engine and the spring cleaning builder):
 * - The thinking is real work and is shared: planning jobs go to whoever has carried least, so two adults split them,
 *   and the account holder (usually Mom) leans last; a single parent keeps what only a grown-up can do, and the
 *   children take real parts of it (picking a dinner, checking the pantry, the list once they're old enough).
 * - Jobs only some people can do are placed first; the rest go to whoever has the least for their age.
 * - Everyone clears their own plate. Nothing falls to Mom by default: a job nobody can do says "Needs someone".
 * - With a food allergy at home, choosing meals, cooking and putting food away stay with grown-ups.
 */
import { ageOf, rankOf, type Helper } from '../lib/household-helpers';

export type Meal = 'breakfast' | 'lunch' | 'dinner';
export type Part = 'week' | 'before' | 'during' | 'after';
export type MealLimit = 'no-knives' | 'no-stove' | 'no-lift' | 'seated';
type Tag = 'knife' | 'stove' | 'lift' | 'food';
export type Mode = 'same' | 'rotate';

export interface MealJob {
  id: string;
  title: string;
  /** A short label for the weekly grid. */
  short: string;
  part: Part;
  /** The meals it belongs to; weekly thinking jobs list the meals they serve. */
  meals: Meal[];
  minAge: number;
  adultOnly?: true;
  tags?: Tag[];
  /** Can be done sitting down. */
  seated?: true;
  /** For a teen: with a grown-up nearby until they've got it. */
  supervised?: true;
  /** Everyone does their own (clearing your plate): no single owner. */
  everyone?: true;
  /** A teen's job (a teen cooks one dinner a week): only when the family has one, and only for them. */
  teenJob?: true;
  /** How much it asks over a week: thinking 3–4, a hot or heavy job 2–3, a quick one 1. */
  weight: number;
  /** In the starting plan, in priority order (lower first) when a small family needs fewer jobs. */
  priority: number;
  /** An illustration from src/data/responsibilities.ts. */
  illustration?: string;
}

export const mealOptions: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
];
export const partLabel: Record<Part, string> = { week: 'Every week: the thinking', before: 'Before the meal', during: 'During the meal', after: 'After the meal' };
export const mealLimitOptions: { id: MealLimit; label: string }[] = [
  { id: 'no-knives', label: 'No sharp knives yet' },
  { id: 'no-stove', label: 'No stove or oven yet' },
  { id: 'no-lift', label: 'No heavy pots or lifting' },
  { id: 'seated', label: 'Seated jobs only' },
];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ALL: Meal[] = ['breakfast', 'lunch', 'dinner'];
const D: Meal[] = ['dinner'];
const job = (x: Omit<MealJob, 'weight'> & { weight?: number }): MealJob => ({ weight: 1, ...x });

export const mealJobs: MealJob[] = [
  // The thinking, once a week.
  job({ id: 'choose-meals', title: 'Choose the week’s meals and write them in the calendar’s meal plan', short: 'Choose meals', part: 'week', meals: ALL, minAge: 15, tags: ['food'], seated: true, weight: 4, priority: 1 }),
  job({ id: 'check-supplies', title: 'Check the fridge and pantry for what’s missing', short: 'Check supplies', part: 'week', meals: ALL, minAge: 8, seated: true, weight: 3, priority: 2 }),
  job({ id: 'grocery-list', title: 'Keep the grocery list on the calendar up to date', short: 'Grocery list', part: 'week', meals: ALL, minAge: 10, seated: true, weight: 3, priority: 3 }),
  job({ id: 'shopping', title: 'Do the grocery shopping or the pickup order', short: 'Shopping', part: 'week', meals: ALL, minAge: 18, adultOnly: true, weight: 4, priority: 4 }),
  job({ id: 'pick-dinner', title: 'Pick one dinner for the week', short: 'Pick a dinner', part: 'week', meals: D, minAge: 4, seated: true, weight: 1, priority: 6 }),
  job({ id: 'cook-one', title: 'Cook one dinner this week, start to finish', short: 'Cook one dinner', part: 'week', meals: D, minAge: 13, tags: ['stove', 'knife', 'food'], supervised: true, teenJob: true, weight: 4, priority: 7 }),

  // Before the meal.
  job({ id: 'cook-main', title: 'Cook the main dish', short: 'Cook', part: 'before', meals: D, minAge: 13, tags: ['stove', 'food'], supervised: true, weight: 3, priority: 5 }),
  job({ id: 'wash-produce', title: 'Wash the fruit and vegetables', short: 'Wash produce', part: 'before', meals: ['lunch', 'dinner'], minAge: 4, weight: 1, priority: 12 }),
  job({ id: 'gather', title: 'Get out the ingredients and the pans', short: 'Ingredients', part: 'before', meals: D, minAge: 7, weight: 1, priority: 11 }),
  job({ id: 'simple-side', title: 'Make a simple side: salad, fruit or bread', short: 'Side dish', part: 'before', meals: D, minAge: 8, seated: true, weight: 2, priority: 14 }),
  job({ id: 'chop', title: 'Chop and slice with a sharp knife', short: 'Chopping', part: 'before', meals: D, minAge: 13, tags: ['knife'], supervised: true, weight: 2, priority: 30 }),
  job({ id: 'breakfast-out', title: 'Put out the bowls, spoons and cereal', short: 'Breakfast out', part: 'before', meals: ['breakfast'], minAge: 4, weight: 1, priority: 8 }),
  job({ id: 'toast', title: 'Make the toast', short: 'Toast', part: 'before', meals: ['breakfast'], minAge: 8, weight: 1, priority: 13 }),
  job({ id: 'hot-breakfast', title: 'Cook the eggs or pancakes', short: 'Hot breakfast', part: 'before', meals: ['breakfast'], minAge: 13, tags: ['stove', 'food'], supervised: true, weight: 2, priority: 31 }),
  job({ id: 'make-lunch', title: 'Make the sandwiches or wraps', short: 'Make lunch', part: 'before', meals: ['lunch'], minAge: 7, seated: true, weight: 2, priority: 9 }),
  job({ id: 'pack-lunches', title: 'Pack tomorrow’s lunches', short: 'Pack lunches', part: 'before', meals: ['lunch'], minAge: 8, weight: 2, priority: 10 }),

  // During the meal.
  job({ id: 'set-table', title: 'Set the table', short: 'Table', part: 'during', meals: ['lunch', 'dinner'], minAge: 5, weight: 1, priority: 15, illustration: 'set-the-table' }),
  job({ id: 'drinks-napkins', title: 'Drinks and napkins', short: 'Drinks', part: 'during', meals: ALL, minAge: 3, weight: 1, priority: 16 }),
  job({ id: 'serve', title: 'Bring the food to the table', short: 'Serve', part: 'during', meals: D, minAge: 11, tags: ['lift'], weight: 1, priority: 22 }),

  // After the meal.
  job({ id: 'own-plate', title: 'Everyone clears their own plate', short: 'Own plate', part: 'after', meals: ALL, minAge: 3, everyone: true, weight: 0, priority: 17, illustration: 'clear-the-table' }),
  job({ id: 'clear', title: 'Clear the serving dishes from the table', short: 'Clear', part: 'after', meals: ['lunch', 'dinner'], minAge: 7, weight: 1, priority: 18 , illustration: 'clear-the-table' }),
  job({ id: 'leftovers', title: 'Put away the leftovers', short: 'Leftovers', part: 'after', meals: D, minAge: 12, tags: ['food'], weight: 1, priority: 19 }),
  job({ id: 'dishwasher', title: 'Load the dishwasher (sharp knives go to a grown-up)', short: 'Dishwasher', part: 'after', meals: ALL, minAge: 8, weight: 2, priority: 20 }),
  job({ id: 'wipe', title: 'Wipe the table and counters', short: 'Wipe', part: 'after', meals: ALL, minAge: 5, weight: 1, priority: 21, illustration: 'wipe-the-counters' }),
  job({ id: 'pots', title: 'Wash the pots and pans', short: 'Pots', part: 'after', meals: D, minAge: 12, tags: ['lift'], weight: 2, priority: 23 }),
  job({ id: 'unload', title: 'Unload the dishwasher', short: 'Unload', part: 'after', meals: ALL, minAge: 7, weight: 1, priority: 24 }),
  job({ id: 'kitchen-reset', title: 'Last look: counters clear and the dishwasher running', short: 'Last look', part: 'after', meals: D, minAge: 13, weight: 1, priority: 25 }),
  job({ id: 'trash', title: 'Take out the kitchen trash', short: 'Trash', part: 'after', meals: D, minAge: 7, weight: 1, priority: 32, illustration: 'take-out-the-trash' }),
];
export const mealJobById = (id: string) => mealJobs.find((j) => j.id === id);

/** Why someone can't be given a job (or null): grown-ups only, a food allergy at home, an age suggestion, a limit. */
export function cannotDoMeal(j: MealJob, h: Helper, allergy = false): string | null {
  const age = ageOf(h);
  const tags = j.tags ?? [];
  if (j.adultOnly && h.group !== 'adult') return 'grown-ups only';
  if (j.teenJob && h.group !== 'teen') return 'a teen’s job';
  if (allergy && tags.includes('food') && h.group !== 'adult') return 'a grown-up, with the allergy at home';
  if (age !== null && age < j.minAge) return `suggested from age ${j.minAge}`;
  if (h.limits.includes('seated') && !j.seated) return 'not a seated job';
  if (h.limits.includes('no-knives') && tags.includes('knife')) return 'sharp knives';
  if (h.limits.includes('no-stove') && tags.includes('stove')) return 'stove or oven';
  if (h.limits.includes('no-lift') && tags.includes('lift')) return 'heavy pots';
  return null;
}
export const canDoMeal = (j: MealJob, h: Helper, allergy = false) => cannotDoMeal(j, h, allergy) === null;

export interface PlanJob {
  /** `${jobId}:${meal}` for a meal's job, the job id for a weekly one, or a custom id. */
  key: string;
  jobId: string | null;
  title: string;
  part: Part;
  /** The meal it's for, or 'week' for the thinking. */
  meal: Meal | 'week';
  /** A helper's id, 'everyone', or null ("Needs someone"). */
  owner: string | null;
  /** She chose the owner: re-planning keeps it. */
  pinned?: boolean;
}

/** How much a person can comfortably take on in a week, by group: shares are measured against it. */
const SHARE: Record<Helper['group'], number> = { adult: 10, teen: 7, school: 5, young: 3 };
/** Most jobs one person gets at one meal before others are asked first (a 5-year-old: one; a grown-up: three). */
const PER_MEAL: Record<Helper['group'], number> = { adult: 3, teen: 3, school: 2, young: 1 };
/** Added to the account holder's share when choosing, so she's picked last in near ties (not never). */
export const HOLDER_LEAN = 0.08;

/**
 * The jobs for these meals and this family: the weekly thinking, then each meal's jobs, trimmed to a manageable
 * number for the family's size (the highest-priority first; the rest can be added). A job nobody here could ever do
 * stays in, unassigned, only if it's thinking (someone has to); otherwise it's left out.
 */
export function mealJobsFor(meals: readonly Meal[], helpers: readonly Helper[], allergy = false): PlanJob[] {
  const hasTeen = helpers.some((h) => h.group === 'teen');
  // Meal jobs (the thinking comes on top): about two per person, a few more per extra meal, within reason.
  const limit = Math.min(14, Math.max(5, 2 + helpers.length * 2 + (meals.length - 1) * 3));
  const picked = mealJobs
    .filter((j) => j.priority < 30 && j.meals.some((m) => meals.includes(m)) && (!j.teenJob || hasTeen))
    .filter((j) => j.part === 'week' || helpers.some((h) => canDoMeal(j, h, allergy)) || j.everyone)
    .sort((a, b) => a.priority - b.priority);
  const out: PlanJob[] = [];
  for (const j of picked) {
    if (j.part === 'week') out.push({ key: j.id, jobId: j.id, title: j.title, part: j.part, meal: 'week', owner: null });
    else for (const m of meals) if (j.meals.includes(m)) out.push({ key: `${j.id}:${m}`, jobId: j.id, title: j.title, part: j.part, meal: m, owner: null });
  }
  // A small family gets a short list: thinking and "everyone" jobs always, then meal jobs taken in turn from before,
  // after and during the meal (each by priority), cleanup twice per round since it's the part most often left to
  // one person, so no part of mealtime is left without anyone.
  const keep = out.filter((x) => x.part === 'week' || mealJobById(x.jobId!)?.everyone);
  const queue = (part: Part) => out.filter((x) => x.part === part && !keep.includes(x));
  const byPart = { before: queue('before'), during: queue('during'), after: queue('after') };
  const turns = ['before', 'after', 'during', 'after'] as const;
  const chosen: PlanJob[] = [];
  for (let i = 0; chosen.length < limit && Object.values(byPart).some((q) => q.length); i++) {
    const q = byPart[turns[i % turns.length]];
    if (q.length) chosen.push(q.shift()!);
  }
  // Everyone who can help gets something: a person with no job they could do gets the first one that suits them.
  for (const h of helpers) {
    const mine = (x: PlanJob) => !mealJobById(x.jobId!)?.everyone && canDoMeal(mealJobById(x.jobId!)!, h, allergy);
    if ([...keep, ...chosen].some(mine)) continue;
    const extra = out.find((x) => !keep.includes(x) && !chosen.includes(x) && mine(x));
    if (extra) chosen.push(extra);
  }
  return [...keep, ...out.filter((x) => chosen.includes(x))];
}

const asJob = (x: PlanJob): MealJob =>
  (x.jobId && mealJobById(x.jobId)) || { id: x.key, title: x.title, short: x.title, part: x.part, meals: ALL, minAge: 0, weight: 1, priority: 50 };
export const planJobAsMealJob = asJob;

/**
 * Who owns each job, all week. Pinned owners stay; the rest are placed (the jobs fewest people can do first) with
 * whoever has the smallest share of the week for their group, the thinking weighed fully, the account holder leaning
 * last, then the less experienced. Returns new objects; never changes her pinned or custom jobs' wording.
 */
export function assignMealJobs(jobs: readonly PlanJob[], helpers: readonly Helper[], allergy = false): PlanJob[] {
  const load = new Map(helpers.map((h) => [h.id, 0]));
  const weightOf = (x: PlanJob) => asJob(x).weight;
  const out = jobs.map((x) => ({ ...x }));
  for (const x of out) {
    if (asJob(x).everyone) { x.owner = 'everyone'; continue; }
    if (x.pinned && x.owner && load.has(x.owner)) load.set(x.owner, load.get(x.owner)! + weightOf(x));
    else if (x.pinned) x.pinned = false;
  }
  const able = (x: PlanJob) => helpers.filter((h) => canDoMeal(asJob(x), h, allergy)).length;
  const open = out.filter((x) => !x.pinned && x.owner !== 'everyone').sort((a, b) => able(a) - able(b) || (a.meal === 'week' ? 0 : 1) - (b.meal === 'week' ? 0 : 1));
  for (const x of open) {
    const j = asJob(x);
    const share = (h: Helper) => load.get(h.id)! / SHARE[h.group] + (h.holder ? HOLDER_LEAN : 0);
    const full = (h: Helper) => x.meal !== 'week' && out.filter((y) => y.owner === h.id && y.meal === x.meal).length >= PER_MEAL[h.group];
    // Every-night stove and knife work goes to a grown-up when one can; a teen's turn is their weekly dinner.
    const lead = (h: Helper) => Number(x.meal !== 'week' && (j.tags ?? []).some((t) => t === 'stove' || t === 'knife') && h.group !== 'adult');
    const who = helpers.filter((h) => canDoMeal(j, h, allergy)).sort((a, b) => Number(full(a)) - Number(full(b)) || lead(a) - lead(b) || share(a) - share(b) || rankOf(a) - rankOf(b))[0];
    x.owner = who?.id ?? null;
    if (who) load.set(who.id, load.get(who.id)! + weightOf(x));
  }
  return out;
}

/** Each person's share of the week (weights), and how much of it is thinking: the plan's balance at a glance. */
export function mealShares(jobs: readonly PlanJob[], helpers: readonly Helper[]) {
  return helpers.map((h) => {
    const mine = jobs.filter((x) => x.owner === h.id);
    return { helper: h, jobs: mine.length, load: mine.reduce((n, x) => n + asJob(x).weight, 0), thinking: mine.filter((x) => x.meal === 'week').reduce((n, x) => n + asJob(x).weight, 0) };
  });
}

/**
 * A rotation for the days the family eats at home. The first day is the plan as it stands; after that each meal job
 * goes to whoever can do it and has done it least this week, then whoever has the smallest share of the day (the
 * account holder leaning last), so jobs change hands. Stove and knife work stays among the grown-ups. Nobody gets more than their share of one meal (a young child:
 * one job), and anyone who can help but ended a day with nothing takes a job from whoever has the most. Weekly thinking
 * and "everyone" jobs don't rotate; pinned jobs stay with their owner every day. Returns day → job key → owner.
 */
export function rotateMealJobs(jobs: readonly PlanJob[], helpers: readonly Helper[], days: readonly number[], allergy = false): Map<number, Map<string, string | null>> {
  const meal = jobs.filter((x) => x.meal !== 'week' && x.owner !== 'everyone');
  const pool = helpers.filter((h) => meal.some((x) => x.owner === h.id) || meal.some((x) => canDoMeal(asJob(x), h, allergy) && h.group !== 'adult'));
  // Stove and knife work moves among the grown-ups when a grown-up has it (a teen's turn is their weekly dinner).
  const hot = (x: PlanJob) => (asJob(x).tags ?? []).some((t) => t === 'stove' || t === 'knife');
  const startsAdult = new Set(meal.filter((x) => helpers.find((h) => h.id === x.owner)?.group === 'adult').map((x) => x.key));
  const can = (x: PlanJob, h: Helper) => canDoMeal(asJob(x), h, allergy) && !(hot(x) && startsAdult.has(x.key) && h.group !== 'adult');
  const order = [...meal].sort((a, b) => pool.filter((h) => can(a, h)).length - pool.filter((h) => can(b, h)).length);
  const done = new Map<string, number>();
  const out = new Map<number, Map<string, string | null>>();
  days.forEach((day, d) => {
    const today = new Map<string, string | null>();
    const mine = (h: Helper) => meal.filter((x) => today.get(x.key) === h.id);
    const atMeal = (h: Helper, m: PlanJob['meal']) => mine(h).filter((x) => x.meal === m).length;
    const share = (h: Helper) => mine(h).reduce((n, x) => n + asJob(x).weight, 0) / SHARE[h.group] + (h.holder ? HOLDER_LEAN : 0);
    for (const x of order) if (x.pinned || d === 0) today.set(x.key, x.owner);
    for (const x of order.filter((y) => !today.has(y.key))) {
      const who = pool.filter((h) => can(x, h)).sort((a, b) =>
        Number(atMeal(a, x.meal) >= PER_MEAL[a.group]) - Number(atMeal(b, x.meal) >= PER_MEAL[b.group])
        || (done.get(`${a.id}:${x.key}`) ?? 0) - (done.get(`${b.id}:${x.key}`) ?? 0)
        || share(a) - share(b) || rankOf(a) - rankOf(b))[0];
      today.set(x.key, who?.id ?? x.owner);
    }
    // Nobody who can help sits the day out while someone else has two: they take a job from whoever has most, or
    // from someone with one who then takes one from whoever has most.
    const ownerOf = (x: PlanJob) => pool.find((p) => p.id === today.get(x.key));
    const spare = (o: Helper, but: Helper) => order
      .filter((y) => !y.pinned && can(y, o) && atMeal(o, y.meal) < PER_MEAL[o.group] && ownerOf(y) && ownerOf(y) !== but && mine(ownerOf(y)!).length > 1)
      .sort((a, b) => mine(ownerOf(b)!).length - mine(ownerOf(a)!).length)[0];
    for (const h of pool) {
      if (mine(h).length) continue;
      const mineToTake = order.filter((x) => !x.pinned && can(x, h) && ownerOf(x));
      const direct = mineToTake.filter((x) => mine(ownerOf(x)!).length > 1).sort((a, b) => mine(ownerOf(b)!).length - mine(ownerOf(a)!).length)[0];
      if (direct) { today.set(direct.key, h.id); continue; }
      for (const x of mineToTake) {
        const o = ownerOf(x)!;
        const y = spare(o, h);
        if (y) { today.set(y.key, o.id); today.set(x.key, h.id); break; }
      }
    }
    for (const [k, o] of today) if (o) done.set(`${o}:${k}`, (done.get(`${o}:${k}`) ?? 0) + 1);
    out.set(day, today);
  });
  return out;
}

/** "Breakfast · Pour the drinks" when more than one meal is planned. */
export const jobLabel = (x: PlanJob, meals: readonly Meal[]) =>
  x.meal !== 'week' && meals.length > 1 ? `${mealOptions.find((m) => m.id === x.meal)!.label}: ${x.title}` : x.title;
