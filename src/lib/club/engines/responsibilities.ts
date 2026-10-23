/**
 * The responsibilities engine: a family profile plus a kit's job rules → who owns what (docs/club/IMPLEMENTATION_PLAN.md
 * → Personalization engine). Pure and deterministic: the same family, rules and month always give the same chart,
 * with ties broken by a stable hash, never randomness and never an AI call.
 *
 * The rules it keeps:
 * - Every household job has one owner, or is honestly marked "Needs an owner".
 * - Weekly capacity by age is guidance, not a limit. Jobs are spread within it first; a core job nobody has room
 *   for may stretch someone else a little (STRETCH), but never the account holder: what's left says
 *   "Needs an owner" rather than falling to her by default. The parent can assign anything to anyone.
 * - Adults aren't forced to equal counts. The account holder leans last in ties and choices (HOLDER_LEAN); real
 *   imbalance is surfaced as optional moves (balanceSuggestions), never applied by itself.
 * - Adults and teens get whole jobs; children's jobs are theirs too, at an ownership level for their age
 *   (learning → with-check → owns). Each child job that isn't fully theirs yet names a coach, spread across the
 *   adults and older teens, so checking doesn't land on one person either.
 * - With one adult, children's ownership levels move up a year (never their eligibility).
 * - Children get their own room and self-care jobs ("each" items) on top, not counted against family load.
 */
import type { ChartSection, Frequency, KitItem, OwnershipLevel } from '../../../data/club/types';
import { stableHash } from '../hash';
import { planMembers, type Household, type HouseholdPreferences, type PlannedMember } from '../profile';

/** A chart row the family already has (from saved edits): the engine places around it, never over it. */
export interface PinnedRow {
  rowId: string;
  itemId: string;
  ownerId: string | null;
}

export interface Assignment {
  /** Household jobs: the item id. Personal jobs: `${itemId}~${memberId}`. Stable for saved edits. */
  rowId: string;
  itemId: string;
  title: string;
  doneMeans: string;
  section: KitItem['section'];
  scope: KitItem['scope'];
  frequency: Frequency;
  effort: number;
  core: boolean;
  illustration?: string;
  /** null: "Needs an owner" (nobody had room or was old enough). */
  ownerId: string | null;
  level: OwnershipLevel | null;
  /** Who stands beside a child who's still learning or checks a with-check job. Never the owner. */
  coachId: string | null;
  /** True when it came from `pinned` (already on her chart). */
  pinned: boolean;
}

export interface PersonSummary extends PlannedMember {
  load: number;
  /** Guidance, not a limit. */
  capacity: number;
  coaching: number;
  /** Load is past capacity (a stretched core job, or her own assignments). */
  over: boolean;
}

export interface OwnershipPlan {
  month: string;
  rows: Assignment[];
  people: PersonSummary[];
}

/** Weekly family-job capacity in effort points, by age. Adults: whole jobs fit; a 4-year-old: a couple of small ones. */
export function capacityFor(p: Pick<PlannedMember, 'stage' | 'age'>): number {
  if (p.stage === 'adult') return 16;
  if (p.stage === 'teen') return 11;
  const age = p.age ?? 0;
  if (age < 4) return 2;
  if (age < 6) return 4;
  if (age < 9) return 6;
  return 8;
}

/** How many personal (room, self-care) jobs go on a child's row. */
export function personalLimit(age: number): number {
  return age < 6 ? 4 : age < 9 ? 5 : 4;
}

/** How far past their guidance capacity a teen or adult other than the account holder may go for a core job. */
export const STRETCH = 1.25;
/** Added to the account holder's score when other adults could take a job: a lean, not a cap. */
export const HOLDER_LEAN = 0.2;
/** Adults whose weekly loads differ by at least this many effort points get balance suggestions. */
export const BALANCE_GAP = 4;

/** Teens this old can coach a younger sibling. */
export const COACH_FROM_AGE = 14;

const meetsRequirements = (item: KitItem, prefs: HouseholdPreferences) => {
  const r = item.requires;
  if (!r) return true;
  if (r.pets && prefs.pets !== true) return false;
  if (r.faith_content && prefs.faith_content !== true) return false;
  if (r.school && prefs.school !== r.school && prefs.school !== 'mixed') return false;
  return true;
};

export function eligible(item: KitItem, p: PlannedMember, prefs: HouseholdPreferences): boolean {
  if (!meetsRequirements(item, prefs)) return false;
  if (p.stage === 'adult') return item.for !== 'child';
  if (item.for === 'adult') return false;
  // A child's own school item fits only their school type (household items are checked against every child).
  if (item.scope === 'each' && item.requires?.childSchool && !(p.school && item.requires.childSchool.includes(p.school))) return false;
  const age = p.age ?? 0;
  return age >= (item.minAge ?? 0) && age <= (item.maxAge ?? Infinity);
}

/** A household item that needs a school type (a supply list, school forms) fits when at least one child has it. */
export const householdHasSchool = (item: KitItem, people: readonly PlannedMember[]) =>
  !item.requires?.childSchool || people.some((p) => p.stage !== 'adult' && p.school !== undefined && item.requires!.childSchool!.includes(p.school));

/**
 * How personal ("each") items are placed:
 * - 'limit' (charts): a few per child, alternating their space and taking care of themselves (personalLimit).
 * - 'all' (routines): every step that fits the child (up to `perSection`), in the kit's order, which is the routine's order.
 * Routines also skip coaches (a routine chart is the child's own, not a job someone checks).
 */
export interface GenerateOptions {
  personal?: 'limit' | 'all';
  /** false: no workload balance suggestions (routines: nothing to balance). */
  balance?: boolean;
  /**
   * Routines: at most this many steps per child in each section, the lowest `priority` first, shown in the kit's
   * order. The rest stay one tap away as suggestions.
   */
  perSection?: number;
}

/**
 * A routine from the steps that fit a child: with a `cap`, at most that many per section (fewer by what `used` says
 * is already there), the lowest `priority` first; always returned in the kit's order, which is the routine's order.
 */
export function routineSteps(fits: readonly KitItem[], cap?: number, used: (section: ChartSection) => number = () => 0): KitItem[] {
  if (cap === undefined) return [...fits];
  const order = new Map(fits.map((i, n) => [i, n]));
  const chosen = new Set(
    [...new Set(fits.map((i) => i.section))].flatMap((section) =>
      fits
        .filter((i) => i.section === section)
        .sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity) || order.get(a)! - order.get(b)!)
        .slice(0, Math.max(0, cap - used(section))),
    ),
  );
  return fits.filter((i) => chosen.has(i));
}

/** The ownership level for this person. Adults always own; `boost` moves children up (one-adult homes). */
export function levelFor(item: KitItem, p: PlannedMember, boost = 0): OwnershipLevel {
  if (p.stage === 'adult') return 'owns';
  const age = (p.age ?? 0) + boost;
  if (!item.levels?.length) return p.stage === 'teen' ? 'owns' : 'with-check';
  let level: OwnershipLevel = 'learning';
  for (const [from, l] of item.levels) if (age >= from) level = l;
  return level;
}

export function generateOwnership(
  household: Household,
  items: readonly KitItem[],
  month: string,
  pinned: readonly PinnedRow[] = [],
  options: GenerateOptions = {},
): OwnershipPlan {
  const people = planMembers(household, month);
  const routine = options.personal === 'all';
  const byId = new Map(people.map((p) => [p.id, p]));
  const prefs = household.preferences;
  const itemById = new Map(items.map((i) => [i.id, i]));
  const order = new Map(items.map((i, n) => [i.id, n]));
  const adults = people.filter((p) => p.stage === 'adult');
  const boost = adults.length === 1 ? 1 : 0;
  const load = new Map(people.map((p) => [p.id, 0]));
  const coaching = new Map(people.map((p) => [p.id, 0]));
  const capacity = new Map(people.map((p) => [p.id, capacityFor(p)]));
  const tie = (itemId: string, personId: string) => stableHash(`${household.id}:${itemId}:${personId}`);

  const rows: Assignment[] = [];
  const row = (item: KitItem, rowId: string, owner: PlannedMember | null, isPinned: boolean): Assignment => ({
    rowId,
    itemId: item.id,
    title: item.title,
    doneMeans: item.doneMeans,
    section: item.section,
    scope: item.scope,
    frequency: item.frequency,
    effort: item.effort,
    core: Boolean(item.core),
    ...(item.illustration ? { illustration: item.illustration } : {}),
    ownerId: owner?.id ?? null,
    level: owner ? levelFor(item, owner, boost) : null,
    coachId: null,
    pinned: isPinned,
  });

  // 1. What she already has keeps its owner and counts toward that owner's load. An open pinned row (no owner, or
  //    an owner who's left the family) is placed again below, under the same row id.
  const taken = new Set<string>();
  const reopen = new Map<string, string>();
  for (const pin of pinned) {
    const item = itemById.get(pin.itemId);
    if (!item) continue;
    const owner = pin.ownerId ? byId.get(pin.ownerId) ?? null : null;
    if (owner) {
      // A household job is on her chart once, whatever row it sits in (a replacement keeps the old row id).
      if (item.scope === 'household') {
        load.set(owner.id, load.get(owner.id)! + item.effort);
        taken.add(item.id);
      }
      rows.push(row(item, pin.rowId, owner, true));
      taken.add(pin.rowId);
    } else if (item.scope === 'household') {
      reopen.set(item.id, pin.rowId);
    }
  }

  // 2. Personal jobs: each child and teen gets their own, alternating their space and taking care of themselves,
  //    up to their limit. Within each, what they're still learning comes first (that's what a chart is for), then a
  //    stable per-child order, so siblings don't all get the same list.
  for (const p of people) {
    if (p.stage === 'adult') continue;
    if (routine) {
      const fits = items.filter((i) => i.scope === 'each' && eligible(i, p, prefs) && !taken.has(`${i.id}~${p.id}`));
      const used = (section: ChartSection) => rows.filter((r) => r.ownerId === p.id && r.section === section).length;
      const chosen = new Set(routineSteps(fits, options.perSection, used));
      for (const item of fits) {
        if (!chosen.has(item)) continue;
        const rowId = `${item.id}~${p.id}`;
        rows.push(row(item, rowId, p, false));
        taken.add(rowId);
      }
      continue;
    }
    const already = rows.filter((r) => r.ownerId === p.id && r.scope === 'each').length;
    let room = personalLimit(p.age ?? 0) - already;
    const rank = { learning: 0, 'with-check': 1, owns: 2 } as const;
    const open = (section: KitItem['section']) =>
      items
        .filter((i) => i.scope === 'each' && i.section === section && eligible(i, p, prefs) && !taken.has(`${i.id}~${p.id}`))
        .sort((a, b) => rank[levelFor(a, p, boost)] - rank[levelFor(b, p, boost)] || tie(a.id, p.id) - tie(b.id, p.id));
    const space = open('space');
    const self = open('self');
    for (let n = 0; room > 0 && (space.length || self.length); n++) {
      const item = (n % 2 === 0 ? space.shift() ?? self.shift() : self.shift() ?? space.shift())!;
      const rowId = `${item.id}~${p.id}`;
      rows.push(row(item, rowId, p, false));
      taken.add(rowId);
      room--;
    }
  }

  // 3. Household jobs, most constrained first: core before extras, fewest possible owners, biggest, then id.
  const household_ = items
    .filter((i) => i.scope === 'household' && !taken.has(i.id) && householdHasSchool(i, people) && people.some((p) => eligible(i, p, prefs)))
    .map((i) => ({ item: i, candidates: people.filter((p) => eligible(i, p, prefs)) }))
    .sort((a, b) =>
      Number(Boolean(b.item.core)) - Number(Boolean(a.item.core)) ||
      a.candidates.length - b.candidates.length ||
      b.item.effort - a.item.effort ||
      (a.item.id < b.item.id ? -1 : 1));

  // Jobs on the chart (pinned or placed), for `excludes`.
  const placed = new Set(rows.filter((r) => r.scope === 'household').map((r) => r.itemId));
  const overlaps = (item: KitItem) =>
    (item.excludes ?? []).some((id) => placed.has(id)) || [...placed].some((id) => itemById.get(id)?.excludes?.includes(item.id));

  const lean = (p: PlannedMember) => (p.isAccountHolder && adults.length > 1 ? HOLDER_LEAN : 0);
  const score = (p: PlannedMember, item: KitItem) =>
    (load.get(p.id)! + item.effort) / capacity.get(p.id)! + (p.stage === 'adult' ? 0.5 : 0) + lean(p);
  const best = (list: PlannedMember[], item: KitItem) =>
    [...list].sort((a, b) =>
      score(a, item) - score(b, item) ||
      Number(a.isAccountHolder) - Number(b.isAccountHolder) ||
      tie(item.id, a.id) - tie(item.id, b.id))[0] ?? null;

  for (const { item, candidates } of household_) {
    if (overlaps(item)) continue;
    const after = (p: PlannedMember) => load.get(p.id)! + item.effort;
    // Within guidance first; then, for a core job only, a little past it: teens and adults other than the account
    // holder. Children are never stretched.
    let owner = best(candidates.filter((p) => after(p) <= capacity.get(p.id)!), item);
    if (!owner && (item.core || reopen.has(item.id))) {
      owner = best(candidates.filter((p) => p.stage !== 'child' && !p.isAccountHolder && after(p) <= capacity.get(p.id)! * STRETCH), item);
    }
    // Extras only go to someone with room; a core job nobody can take shows as "Needs an owner".
    if (!owner && !item.core && !reopen.has(item.id)) continue;
    if (owner) load.set(owner.id, load.get(owner.id)! + item.effort);
    rows.push(row(item, reopen.get(item.id) ?? item.id, owner, false));
    placed.add(item.id);
  }

  // 4. Coaches for children's jobs that aren't fully theirs yet.
  const coaches = people.filter((p) => p.stage === 'adult' || (p.stage === 'teen' && (p.age ?? 0) >= COACH_FROM_AGE));
  const memberOrder = new Map(household.members.map((m, n) => [m.id, n]));
  const sectionOrder = { family: 0, space: 1, self: 2, morning: 3, 'after-school': 4, commitment: 5 } as const;
  rows.sort((a, b) =>
    (a.ownerId === null ? 1 : 0) - (b.ownerId === null ? 1 : 0) ||
    (memberOrder.get(a.ownerId ?? '') ?? 0) - (memberOrder.get(b.ownerId ?? '') ?? 0) ||
    sectionOrder[a.section] - sectionOrder[b.section] ||
    (order.get(a.itemId) ?? 0) - (order.get(b.itemId) ?? 0));
  for (const r of rows) {
    const owner = r.ownerId ? byId.get(r.ownerId) : undefined;
    if (routine || !owner || owner.stage === 'adult' || r.level === 'owns') continue;
    const options = coaches.filter((c) => c.id !== owner.id && (c.stage === 'adult' || (c.age ?? 0) - (owner.age ?? 0) >= 3));
    options.sort((a, b) =>
      coaching.get(a.id)! - coaching.get(b.id)! ||
      Number(a.isAccountHolder) - Number(b.isAccountHolder) ||
      tie(`coach:${r.rowId}`, a.id) - tie(`coach:${r.rowId}`, b.id));
    const coach = options[0];
    if (coach) {
      r.coachId = coach.id;
      coaching.set(coach.id, coaching.get(coach.id)! + 1);
    }
  }

  return {
    month,
    rows,
    people: people.map((p) => ({ ...p, load: load.get(p.id)!, capacity: capacity.get(p.id)!, coaching: coaching.get(p.id)!, over: load.get(p.id)! > capacity.get(p.id)! })),
  };
}

/** A chart row as balancing sees it: whose it is now, and whether she chose that owner herself. */
export interface BalanceRow {
  rowId: string;
  itemId: string | null;
  ownerId: string | null;
  /** She assigned this owner herself: never suggested to move. */
  locked: boolean;
}

export interface BalanceMove {
  rowId: string;
  fromId: string;
  toId: string;
  /** Weekly effort points, before and after the move, for the two people. */
  from: { before: number; after: number };
  to: { before: number; after: number };
}

/**
 * Optional moves that even out real imbalance on a chart: between adults whose loads differ by BALANCE_GAP or
 * more, or off anyone past their guidance capacity onto someone with room. Each move takes the job that best
 * closes the gap; moves are worked out one after another (so they don't fight), at most `limit`, deterministic.
 * Never moves a job she assigned herself, never moves anything onto the account holder or onto someone past
 * capacity, never applied for her.
 */
export function balanceSuggestions(
  household: Household,
  items: readonly KitItem[],
  month: string,
  rows: readonly BalanceRow[],
  limit = 3,
): BalanceMove[] {
  const people = planMembers(household, month);
  const byId = new Map(people.map((p) => [p.id, p]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const capacity = new Map(people.map((p) => [p.id, capacityFor(p)]));
  const load = new Map(people.map((p) => [p.id, 0]));
  const movable: { row: BalanceRow; item: KitItem }[] = [];
  for (const r of rows) {
    const item = r.itemId ? itemById.get(r.itemId) : undefined;
    if (!item || item.scope !== 'household' || !r.ownerId || !byId.has(r.ownerId)) continue;
    load.set(r.ownerId, load.get(r.ownerId)! + item.effort);
    if (!r.locked) movable.push({ row: r, item });
  }
  const moves: BalanceMove[] = [];
  const moved = new Set<string>();
  const tie = (a: string) => stableHash(`${household.id}:balance:${a}`);

  while (moves.length < limit) {
    let pick: { score: number; key: number; move: BalanceMove } | null = null;
    for (const { row, item } of movable) {
      if (moved.has(row.rowId)) continue;
      const from = byId.get(row.ownerId!)!;
      const fromLoad = load.get(from.id)!;
      const fromOver = fromLoad > capacity.get(from.id)!;
      for (const to of people) {
        // Balancing takes work off the account holder; it never suggests she take more.
        if (to.id === from.id || to.isAccountHolder || !eligible(item, to, household.preferences)) continue;
        const toLoad = load.get(to.id)!;
        if (toLoad + item.effort > capacity.get(to.id)!) continue;
        const adultsGap = from.stage === 'adult' && to.stage === 'adult' && fromLoad - toLoad >= BALANCE_GAP;
        if (!adultsGap && !fromOver) continue;
        // A move has to make things more even, not just shift who's heavier.
        const gapBefore = fromLoad - toLoad;
        const gapAfter = Math.abs(fromLoad - item.effort - (toLoad + item.effort));
        if (gapAfter >= gapBefore && !fromOver) continue;
        const score = gapAfter - (fromOver ? 100 : 0);
        const key = tie(`${row.rowId}:${to.id}`);
        if (!pick || score < pick.score || (score === pick.score && key < pick.key)) {
          pick = {
            score,
            key,
            move: { rowId: row.rowId, fromId: from.id, toId: to.id, from: { before: fromLoad, after: fromLoad - item.effort }, to: { before: toLoad, after: toLoad + item.effort } },
          };
        }
      }
    }
    if (!pick) break;
    const m = pick.move;
    const effort = m.from.before - m.from.after;
    load.set(m.fromId, load.get(m.fromId)! - effort);
    load.set(m.toId, load.get(m.toId)! + effort);
    moved.add(m.rowId);
    moves.push(m);
  }
  return moves;
}
