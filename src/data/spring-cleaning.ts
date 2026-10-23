/**
 * The Family Spring Cleaning Builder's rooms, jobs and rules (src/components/site/SpringCleaningBuilder.astro and
 * spring-cleaning-builder.ts beside it): pick rooms, who's helping (with any limits) and a session length, and it
 * divides each room's jobs among the people who can safely do them, in time-boxed sessions worked side by side.
 *
 * Every job carries what it takes: a suggested minimum age (a suggestion, never a judgment of ability: anyone can be
 * reassigned), how long it takes a practiced grown-up, whether it's for grown-ups only (cleaning chemicals, ladders
 * and high reaching, heavy lifting, sharp tools, appliances, medicines), and what it asks of the body (lifting, high
 * reaching, floor work, standing) so a person's limits rule it out. The room wording follows the site's spring
 * checklist (src/data/seasonal-cleaning.ts), with the detail a plan needs.
 *
 * The rules it keeps, after November's engine (src/lib/club/engines/responsibilities.ts):
 * - Jobs only some people can do are handed out first (grown-ups-only jobs to grown-ups), then the rest go to whoever
 *   has done least so far this session, so children get real jobs and no one stands around; younger helpers first
 *   when it's even.
 * - The account holder (usually Mom) leans last in near ties; nobody gets "everything left over": what doesn't fit
 *   becomes another session, and a job nobody can do says "Needs someone" rather than falling to her.
 * - People work side by side, so a session is as long as its busiest person, not the sum of every job.
 */

import { ageOf, groupAge, groupFor, groupLabel, rankOf as rank, type Group, type Helper } from '../lib/household-helpers';

export { groupAge, groupFor, groupLabel };
export type { Group, Helper };
export type Limit = 'no-lift' | 'no-high' | 'no-floor' | 'seated' | 'no-products';
export type SessionLength = 15 | 30 | 60;
type Tag = 'lift' | 'high' | 'floor' | 'products';

export interface CleaningJob {
  /** Stable once released: saved plans point at it. */
  id: string;
  title: string;
  /** For a practiced grown-up; younger helpers get more time (see `paceFor`). */
  minutes: number;
  /** Suggested from this age (ignored for grown-ups). */
  minAge: number;
  /** Grown-ups only, whatever a child's age. */
  adultOnly?: true;
  /** What it asks of the body or involves: a person's limits rule it out. */
  tags?: Tag[];
  /** Can be done sitting down (a seated-only helper gets only these). */
  seated?: true;
  /** 1 clear and sort, 2 clean and organize, 3 floors and trash: the order work happens in. */
  phase: 1 | 2 | 3;
  /** In the starting plan. Others are offered as "add a job". */
  core?: true;
  /** What to have ready. */
  supplies?: string;
}

export interface CleaningRoom {
  id: string;
  label: string;
  jobs: CleaningJob[];
}


export const limitOptions: { id: Limit; label: string }[] = [
  { id: 'no-lift', label: 'No heavy lifting' },
  { id: 'no-high', label: 'No ladders or high reaching' },
  { id: 'no-floor', label: 'No kneeling or floor work' },
  { id: 'seated', label: 'Seated jobs only' },
  { id: 'no-products', label: 'No cleaning products' },
];

export const sessionOptions: SessionLength[] = [15, 30, 60];

const j = (id: string, title: string, minutes: number, minAge: number, phase: 1 | 2 | 3, more: Partial<CleaningJob> = {}): CleaningJob =>
  ({ id, title, minutes, minAge, phase, ...more });
const CORE = { core: true } as const;
const ADULT = { adultOnly: true } as const;

export const cleaningRooms: CleaningRoom[] = [
  { id: 'kitchen', label: 'Kitchen', jobs: [
    j('k-counters-clear', 'Clear the counters: put away anything that doesn’t live there', 10, 4, 1, { ...CORE }),
    j('k-pantry', 'Sort the pantry and pull out anything expired', 10, 8, 1, { ...CORE, seated: true }),
    j('k-containers', 'Match food containers to lids and recycle the extras', 10, 6, 2, { ...CORE, seated: true }),
    j('k-wipe-counters', 'Wipe the counters and the table', 5, 6, 2, { ...CORE, supplies: 'damp cloths' }),
    j('k-cabinets', 'Wipe the cabinet fronts and handles', 10, 7, 2, { ...CORE, supplies: 'damp cloths' }),
    j('k-microwave', 'Clean inside the microwave', 10, 12, 2, { ...CORE }),
    j('k-trash', 'Take out the trash and recycling', 5, 7, 3, { ...CORE }),
    j('k-floor', 'Sweep or vacuum the floor', 10, 8, 3, { ...CORE, tags: ['floor'], supplies: 'a broom or the vacuum' }),
    j('k-oven', 'Clean the oven or stovetop', 20, 18, 2, { ...ADULT, tags: ['products'], supplies: 'oven or stovetop cleaner' }),
    j('k-fridge', 'Empty and wipe out the fridge', 20, 13, 2),
    j('k-high', 'Wipe the top of the fridge and the high cabinets', 10, 18, 2, { ...ADULT, tags: ['high'], supplies: 'a step stool' }),
    j('k-mop', 'Mop the floor', 10, 13, 3, { tags: ['floor'], supplies: 'a mop' }),
  ] },
  { id: 'living', label: 'Living room', jobs: [
    j('l-stray', 'Collect stray things and take them back to their rooms', 10, 3, 1, { ...CORE, supplies: 'a basket' }),
    j('l-toys-books', 'Put books and toys back on their shelves and in their bins', 10, 3, 1, { ...CORE }),
    j('l-cushions', 'Fold the throws and straighten the cushions', 5, 4, 2, { ...CORE }),
    j('l-tables', 'Wipe the coffee table and side tables', 5, 5, 2, { ...CORE, supplies: 'damp cloths' }),
    j('l-dust', 'Dust the shelves and surfaces you can reach', 10, 6, 2, { ...CORE, supplies: 'dusting cloths' }),
    j('l-high', 'Dust the ceiling fan, light fixtures and high shelves', 10, 18, 2, { ...CORE, ...ADULT, tags: ['high'], supplies: 'a step stool' }),
    j('l-vacuum', 'Vacuum the floor and rugs', 15, 10, 3, { ...CORE, tags: ['floor'], supplies: 'the vacuum' }),
    j('l-glass', 'Clean the glass and mirrors', 10, 10, 2, { supplies: 'glass cleaner and a cloth' }),
    j('l-storage', 'Straighten one shared basket or drawer', 10, 8, 2, { seated: true }),
    j('l-baseboards', 'Wipe the baseboards', 10, 7, 2, { tags: ['floor'] }),
    j('l-sofa', 'Move the sofa and vacuum underneath', 15, 18, 3, { ...ADULT, tags: ['lift', 'floor'] }),
  ] },
  { id: 'dining', label: 'Dining room', jobs: [
    j('d-clear', 'Clear the table of everything that doesn’t belong there', 5, 3, 1, { ...CORE }),
    j('d-drawer', 'Sort the sideboard or one drawer', 10, 9, 1, { ...CORE, seated: true }),
    j('d-wipe', 'Wipe the table and chairs', 10, 5, 2, { ...CORE, supplies: 'damp cloths' }),
    j('d-light', 'Dust the light fixture', 5, 18, 2, { ...CORE, ...ADULT, tags: ['high'] }),
    j('d-chairs', 'Push in the chairs and straighten the placemats', 5, 3, 3, { ...CORE }),
    j('d-floor', 'Sweep or vacuum under the table', 10, 8, 3, { ...CORE, tags: ['floor'], supplies: 'a broom or the vacuum' }),
    j('d-linens', 'Wash the tablecloth or placemats', 5, 10, 2),
  ] },
  { id: 'bathroom', label: 'Bathroom', jobs: [
    j('b-counter', 'Clear the counter and put things away', 5, 4, 1, { ...CORE }),
    j('b-under-sink', 'Sort under the sink and toss empty bottles', 10, 10, 1, { ...CORE, seated: true }),
    j('b-towels', 'Swap in fresh towels and the bath mat', 5, 5, 2, { ...CORE }),
    j('b-sink', 'Wipe the counter and faucet with a damp cloth', 5, 7, 2, { ...CORE, supplies: 'damp cloths' }),
    j('b-mirror', 'Clean the mirror', 5, 8, 2, { ...CORE }),
    j('b-toilet', 'Clean the toilet', 10, 18, 2, { ...CORE, ...ADULT, tags: ['products'], supplies: 'toilet cleaner and gloves' }),
    j('b-tub', 'Scrub the tub or shower', 15, 18, 2, { ...ADULT, tags: ['products', 'floor'], supplies: 'bathroom cleaner and gloves' }),
    j('b-medicine', 'Check the medicine cabinet for expired medicines', 10, 18, 1, { ...ADULT, seated: true }),
    j('b-trash', 'Empty the trash', 3, 4, 3, { ...CORE }),
    j('b-floor', 'Sweep and mop the floor', 10, 13, 3, { ...CORE, tags: ['floor'], supplies: 'a mop' }),
    j('b-curtain', 'Wash the shower curtain liner', 5, 13, 2),
  ] },
  { id: 'bedroom', label: 'Bedrooms', jobs: [
    j('r-floor-pickup', 'Pick up the floor and put things away', 10, 3, 1, { ...CORE }),
    j('r-outgrown', 'Sort outgrown clothes into a donation bag', 15, 6, 1, { ...CORE, seated: true, supplies: 'a donation bag' }),
    j('r-donate-toys', 'Gather toys and books to give away', 10, 4, 1, { ...CORE }),
    j('r-nightstand', 'Organize the nightstand or desk', 10, 6, 2, { ...CORE, seated: true }),
    j('r-dust', 'Dust the surfaces you can reach', 5, 5, 2, { ...CORE, supplies: 'dusting cloths' }),
    j('r-bedding', 'Change the bedding', 10, 11, 2, { ...CORE, supplies: 'clean sheets' }),
    j('r-vacuum', 'Vacuum or sweep, under the bed too', 10, 10, 3, { ...CORE, tags: ['floor'], supplies: 'the vacuum' }),
    j('r-mattress', 'Rotate the mattress', 10, 18, 2, { ...ADULT, tags: ['lift'] }),
    j('r-light-bedding', 'Swap winter bedding for lighter bedding', 10, 11, 2),
  ] },
  { id: 'entry', label: 'Entryway or mudroom', jobs: [
    j('e-shoes-coats', 'Put every shoe and coat in its spot', 10, 3, 1, { ...CORE }),
    j('e-outgrown', 'Pull out shoes and coats that don’t fit anymore', 10, 6, 1, { ...CORE, seated: true, supplies: 'a donation bag' }),
    j('e-winter', 'Pack winter hats, gloves and boots into a bin', 10, 8, 1, { ...CORE, supplies: 'a storage bin' }),
    j('e-bags', 'Organize the backpacks and bags', 5, 5, 2, { ...CORE }),
    j('e-wipe', 'Wipe the shelves, hooks and door handle', 5, 6, 2, { ...CORE, supplies: 'damp cloths' }),
    j('e-mat', 'Shake out the doormat', 3, 6, 2, { ...CORE }),
    j('e-floor', 'Sweep the floor', 5, 7, 3, { ...CORE, tags: ['floor'], supplies: 'a broom' }),
    j('e-store-high', 'Put the winter bin away up high', 5, 18, 3, { ...ADULT, tags: ['high', 'lift'] }),
  ] },
  { id: 'laundry', label: 'Laundry area', jobs: [
    j('la-socks', 'Match up the stray socks', 10, 4, 1, { ...CORE, seated: true }),
    j('la-fold', 'Fold a basket of simple laundry', 10, 6, 1, { ...CORE, seated: true }),
    j('la-lint', 'Clean the lint trap', 3, 8, 2, { ...CORE }),
    j('la-tops', 'Wipe the tops of the washer and dryer', 5, 7, 2, { ...CORE, supplies: 'damp cloths' }),
    j('la-supplies', 'Sort the detergents and toss empty bottles', 5, 18, 1, { ...CORE, ...ADULT, tags: ['products'] }),
    j('la-floor', 'Sweep the floor', 5, 7, 3, { ...CORE, tags: ['floor'], supplies: 'a broom' }),
    j('la-seal', 'Clean the washer seal and dispenser', 10, 18, 2, { ...ADULT, tags: ['products'] }),
    j('la-behind', 'Pull out the dryer and vacuum behind it', 15, 18, 3, { ...ADULT, tags: ['lift', 'floor'] }),
  ] },
  { id: 'playroom', label: 'Playroom', jobs: [
    j('p-bins', 'Put toys back in their bins', 10, 2, 1, { ...CORE }),
    j('p-sort', 'Sort toys into keep, give away and toss', 15, 5, 1, { ...CORE, seated: true, supplies: 'a donation bag' }),
    j('p-pieces', 'Check games and puzzles for missing pieces', 10, 6, 1, { ...CORE, seated: true }),
    j('p-books', 'Put the books back on the shelf', 10, 3, 2, { ...CORE }),
    j('p-wipe', 'Wipe the table and the toy bins', 5, 5, 2, { ...CORE, supplies: 'damp cloths' }),
    j('p-vacuum', 'Vacuum the floor and rug', 10, 10, 3, { ...CORE, tags: ['floor'], supplies: 'the vacuum' }),
    j('p-wash', 'Wash the plastic toys in soapy water', 15, 6, 2, { seated: true }),
  ] },
  { id: 'office', label: 'Home office', jobs: [
    j('o-desk', 'Clear the desk', 5, 6, 1, { ...CORE }),
    j('o-papers', 'Sort papers into file, recycle and shred piles', 15, 12, 1, { ...CORE, seated: true }),
    j('o-wipe', 'Wipe the desk and keyboard', 5, 8, 2, { ...CORE, supplies: 'damp cloths' }),
    j('o-restock', 'Restock pens, paper and tape', 5, 6, 2, { ...CORE, seated: true }),
    j('o-dust', 'Dust the shelves you can reach', 5, 6, 2, { ...CORE }),
    j('o-vacuum', 'Vacuum the floor', 10, 10, 3, { ...CORE, tags: ['floor'], supplies: 'the vacuum' }),
    j('o-shred', 'Shred old papers', 10, 18, 2, { ...ADULT, seated: true }),
    j('o-cords', 'Untangle and label unplugged chargers and cords', 10, 10, 2, { seated: true }),
  ] },
  { id: 'closet', label: 'Closets', jobs: [
    j('c-pull', 'Pull out what doesn’t fit or isn’t worn', 15, 6, 1, { ...CORE, seated: true }),
    j('c-donate', 'Bag up the clothes to give away', 10, 5, 1, { ...CORE, seated: true, supplies: 'a donation bag' }),
    j('c-shoes', 'Match the shoes and line them up', 5, 4, 2, { ...CORE }),
    j('c-rehang', 'Rehang and fold what stays', 15, 8, 2, { ...CORE }),
    j('c-top', 'Sort the top shelf', 10, 18, 2, { ...CORE, ...ADULT, tags: ['high'], supplies: 'a step stool' }),
    j('c-floor', 'Vacuum the closet floor', 5, 10, 3, { ...CORE, tags: ['floor'], supplies: 'the vacuum' }),
    j('c-swap', 'Swap winter clothes for spring clothes', 15, 10, 2, { tags: ['lift'] }),
  ] },
];

/** "Other": any space she names, with jobs that suit any room. */
export const otherRoomJobs: CleaningJob[] = [
  j('x-pickup', 'Pick up and return things to where they belong', 10, 3, 1, { ...CORE }),
  j('x-pile', 'Sort one pile into keep, give away and toss', 15, 6, 1, { ...CORE, seated: true }),
  j('x-dust', 'Dust the surfaces you can reach', 10, 5, 2, { ...CORE, supplies: 'dusting cloths' }),
  j('x-wipe', 'Wipe the surfaces with a damp cloth', 10, 6, 2, { ...CORE, supplies: 'damp cloths' }),
  j('x-high', 'Dust the high shelves and light fixtures', 10, 18, 2, { ...CORE, ...ADULT, tags: ['high'], supplies: 'a step stool' }),
  j('x-trash', 'Empty the trash', 3, 4, 3, { ...CORE }),
  j('x-floor', 'Vacuum or sweep the floor', 10, 9, 3, { ...CORE, tags: ['floor'], supplies: 'the vacuum or a broom' }),
];
export const OTHER_ROOM = 'other';

export const roomById = (id: string): CleaningRoom | undefined =>
  cleaningRooms.find((r) => r.id === id) ?? (id === OTHER_ROOM ? { id: OTHER_ROOM, label: 'Another space', jobs: otherRoomJobs } : undefined);
export const jobById = (id: string) => [...cleaningRooms.flatMap((r) => r.jobs), ...otherRoomJobs].find((x) => x.id === id);

/** Who's helping: src/lib/household-helpers.ts (shared with the meal planner); `limits` hold this tool's `Limit` ids. */

/** How much longer a job takes a younger helper. */
export function paceFor(h: Helper): number {
  const age = ageOf(h);
  return age === null || age >= 9 ? 1 : age >= 6 ? 1.25 : 1.5;
}

/** Why someone can't be given a job, or null when they can: their age or a limit. Grown-ups have no age limit. */
export function cannotDo(job: CleaningJob, h: Helper): string | null {
  const age = ageOf(h);
  if (job.adultOnly && h.group !== 'adult') return 'grown-ups only';
  if (age !== null && age < job.minAge) return `suggested from age ${job.minAge}`;
  const tags = job.tags ?? [];
  if (h.limits.includes('seated') && !job.seated) return 'not a seated job';
  if (h.limits.includes('no-lift') && tags.includes('lift')) return 'heavy lifting';
  if (h.limits.includes('no-high') && tags.includes('high')) return 'high reaching';
  if (h.limits.includes('no-floor') && tags.includes('floor')) return 'floor work';
  if (h.limits.includes('no-products') && tags.includes('products')) return 'cleaning products';
  return null;
}
export const canDo = (job: CleaningJob, h: Helper) => cannotDo(job, h) === null;

/** Minutes added to the account holder's load when choosing, so she's picked last in near ties (not never). */
export const HOLDER_LEAN = 3;


export interface PlannedJob {
  /** Unique within the plan: the job's id, or a custom id. */
  key: string;
  jobId: string | null;
  title: string;
  minutes: number;
  /** null: "Needs someone" (nobody here can safely do it). */
  owner: string | null;
  /** 0-based session within the room. */
  session: number;
}

/**
 * Divides a room's jobs into sessions of `length` minutes. Each session, people work side by side: the jobs fewest
 * people can do are placed first, each to whoever can do it, has time left and has done least (the account holder
 * leaning last, then the less experienced); the plan then reads in work order. Jobs nobody here can do are listed
 * once, unassigned.
 */
export function planRoom(jobs: readonly CleaningJob[], helpers: readonly Helper[], length: SessionLength): PlannedJob[] {
  // Hand out first the jobs fewest people can do (so the one grown-up isn't used up on easy ones), then show the plan
  // in the order the work happens: clear, clean, floors.
  const able = (job: CleaningJob) => helpers.filter((h) => canDo(job, h)).length;
  const phase = new Map(jobs.map((x) => [x.id, x.phase]));
  const order = [...jobs].sort((a, b) => able(a) - able(b) || a.phase - b.phase);
  const out: PlannedJob[] = [];
  let pending = order.filter((job) => helpers.some((h) => canDo(job, h)));
  for (const job of order) if (!helpers.some((h) => canDo(job, h))) out.push({ key: job.id, jobId: job.id, title: job.title, minutes: job.minutes, owner: null, session: 0 });
  for (let session = 0; pending.length && session < 12; session++) {
    const used = new Map(helpers.map((h) => [h.id, 0]));
    const left: CleaningJob[] = [];
    for (const job of pending) {
      const fits = helpers
        .filter((h) => canDo(job, h))
        .map((h) => ({ h, cost: job.minutes * paceFor(h), free: length - used.get(h.id)! }))
        .filter((c) => c.cost <= c.free);
      if (!fits.length) {
        left.push(job);
        continue;
      }
      const done = (c: (typeof fits)[number]) => length - c.free + (c.h.holder ? HOLDER_LEAN : 0);
      fits.sort((a, b) => done(a) - done(b) || rank(a.h) - rank(b.h));
      const pick = fits[0];
      used.set(pick.h.id, used.get(pick.h.id)! + pick.cost);
      out.push({ key: job.id, jobId: job.id, title: job.title, minutes: job.minutes, owner: pick.h.id, session });
    }
    // Nothing fit in a fresh session (one job longer than the session): give it its own session.
    if (left.length === pending.length) {
      const job = left.shift()!;
      const who = helpers.filter((h) => canDo(job, h)).sort((a, b) => rank(b) - rank(a) || Number(Boolean(a.holder)) - Number(Boolean(b.holder)))[0];
      out.push({ key: job.id, jobId: job.id, title: job.title, minutes: job.minutes, owner: who.id, session });
    }
    pending = left;
  }
  return out.sort((a, b) => a.session - b.session || (phase.get(a.key) ?? 2) - (phase.get(b.key) ?? 2));
}

/** About how long a session takes: its busiest person's work (people work at the same time), in whole minutes. */
export function sessionMinutes(jobs: readonly PlannedJob[], helpers: readonly Helper[], session: number): number {
  const per = new Map<string, number>();
  for (const x of jobs) {
    if (x.session !== session || !x.owner) continue;
    const h = helpers.find((p) => p.id === x.owner);
    per.set(x.owner, (per.get(x.owner) ?? 0) + x.minutes * (h ? paceFor(h) : 1));
  }
  return Math.round(Math.max(0, ...per.values()));
}

export const sessionCount = (jobs: readonly PlannedJob[]) => (jobs.length ? Math.max(...jobs.map((x) => x.session)) + 1 : 0);

/** What to have ready for a session. */
export function suppliesFor(jobs: readonly PlannedJob[], session?: number): string[] {
  const all = jobs.filter((x) => session === undefined || x.session === session).map((x) => (x.jobId ? jobById(x.jobId)?.supplies : undefined));
  return [...new Set(all.filter((s): s is string => Boolean(s)))];
}

/** The starting jobs for a room: its core list (the rest are offered to add). */
export const coreJobs = (room: CleaningRoom) => room.jobs.filter((x) => x.core);

/** A helper's label: "Sofia, 11", "Ana, adult". */
export const helperLabel = (h: Helper) => `${h.name}, ${h.group === 'adult' ? 'adult' : h.age !== null ? h.age : groupLabel[h.group].toLowerCase()}`;
