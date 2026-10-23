/**
 * The shared rules behind the site's idea pickers (the Family Christmas Traditions Picker, src/data/
 * christmas-traditions.ts; the Family Connection Planner, src/data/connection-ideas.ts): which ideas fit a family's
 * children's ages, time, budget and setting, and in what order. Each picker keeps its own ideas, labels and the way it
 * chooses three; nothing here knows about a month or the Club.
 */

/** A child's age band: under 5, 5–8, 9 and up. */
export type KidBand = 'little' | 'young' | 'older';
/** Which ages an idea suits: the youngest helper's band, or 'teens' when every child is 13 or older. */
export type AgeFocus = KidBand | 'teens';

export interface Idea {
  id: string;
  /** One of the picker's time levels, shortest first (see `IdeaScale`). */
  time: string;
  /** One of the picker's cost levels, cheapest first. */
  cost: string;
  setting: 'home' | 'out';
  /** Suggested only when the youngest child is at least this old. */
  minAge?: number;
  /** Not suggested when every child is a teenager. */
  young?: true;
  /** Ages it's especially good for: ranked higher. */
  suits?: AgeFocus[];
}

export interface IdeaPrefs {
  /** Children's ages; empty when unknown. */
  ages: number[];
  time: string;
  cost: string;
  setting: 'home' | 'out' | 'either';
}

/** A picker's time and cost levels, lowest first: an idea fits when it's at or under her answer. */
export interface IdeaScale {
  time: readonly string[];
  cost: readonly string[];
}

/** Who a "kids can" line is for: the youngest child old enough to help (2 and up), so everyone can join in. */
export function kidBand(ages: readonly number[]): KidBand {
  const helpers = ages.filter((a) => a >= 2);
  if (!ages.length) return 'young';
  const youngest = helpers.length ? Math.min(...helpers) : 2;
  return youngest < 5 ? 'little' : youngest < 9 ? 'young' : 'older';
}

export function ageFocus(ages: readonly number[]): AgeFocus | null {
  const kids = ages.filter((a) => a >= 2);
  if (!kids.length) return null;
  return kids.every((a) => a >= 13) ? 'teens' : kidBand(kids);
}

/** True when the idea fits: within her time and budget, where she wants it, and right for her children's ages. */
export function ideaFits(t: Idea, p: IdeaPrefs, scale: IdeaScale): boolean {
  if (scale.time.indexOf(t.time) > scale.time.indexOf(p.time)) return false;
  if (scale.cost.indexOf(t.cost) > scale.cost.indexOf(p.cost)) return false;
  if (p.setting !== 'either' && t.setting !== p.setting) return false;
  const kids = p.ages.filter((a) => a >= 2);
  if (t.minAge !== undefined && kids.length && Math.min(...kids) < t.minAge) return false;
  if (t.young && kids.length && kids.every((a) => a >= 13)) return false;
  return true;
}

/** Every age band among her children (teens as their own), for pickers that weigh the whole family. */
export function ageBands(ages: readonly number[]): AgeFocus[] {
  return [...new Set(ages.filter((a) => a >= 2).map((a): AgeFocus => (a >= 13 ? 'teens' : kidBand([a]))))];
}

/**
 * Best first: the time she has (not much less), then ideas that suit her children's ages, then her budget. Ages:
 * the youngest helper's band by default; with `wholeFamily`, how many of the family's age bands the idea suits, so a
 * family with a preschooler and teenagers gets ideas that work for both.
 */
function score(t: Idea, p: IdeaPrefs, scale: IdeaScale, wholeFamily: boolean) {
  const timeGap = scale.time.indexOf(p.time) - scale.time.indexOf(t.time);
  const costGap = scale.cost.indexOf(p.cost) - scale.cost.indexOf(t.cost);
  let ages = 0;
  if (wholeFamily) {
    const bands = ageBands(p.ages);
    if (bands.length) ages = (1.5 * bands.filter((b) => t.suits?.includes(b)).length) / bands.length;
  } else {
    const focus = ageFocus(p.ages);
    ages = focus && t.suits?.includes(focus) ? 1.5 : 0;
  }
  return (timeGap === 0 ? 4 : timeGap === 1 ? 2 : 0) + ages + (costGap === 0 ? 1 : 0.5);
}

/** Every idea that fits, best first. Ties keep the list's order. */
export function rankIdeas<T extends Idea>(ideas: readonly T[], p: IdeaPrefs, scale: IdeaScale, opts: { wholeFamily?: boolean } = {}): T[] {
  return ideas
    .map((t, i) => ({ t, i, s: score(t, p, scale, Boolean(opts.wholeFamily)) }))
    .filter(({ t }) => ideaFits(t, p, scale))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ t }) => t);
}
