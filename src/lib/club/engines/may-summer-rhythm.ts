/**
 * May 2027, Our Summer Day: the rules behind the one-page rhythm (src/components/club/MaySummerRhythm.astro). Pure
 * functions only, so the printable, the desktop rail and the mobile plan screen (MayPlanMobile.astro) read one plan.
 * Built on the shared personalization foundation (../personalize/, docs/club/PERSONALIZATION_FOUNDATION.md).
 *
 * A reusable day of anchors, not an hourly schedule: Morning Start, Move & Play, Lunch & Reset, Quiet Time, a
 * flexible afternoon, Snack & Reset and Evening Reset (Create & Explore on camp days), with suggested times she can
 * turn off. Prepared from the family:
 * - Quiet time by the children's ages (rest for under-fives, an independent recharge when everyone is 12 or older).
 * - Independent activities from the children's interests (the sports, lessons and clubs on her family page, by name).
 * - Shared family responsibilities on the anchors they belong to (beds, lunch, the table, snack cleanup, dinner,
 *   the dishes, pets), each child's own jobs by age and the shared ones spread out, grown-ups' too; the account
 *   holder is never the default. She can change who, the wording, or leave one off.
 * Saved means settled: the profile snapshot used is kept with the plan.
 *
 * When it happens: every block shows ONE thing in its right-hand box, a clock time ("8:00 AM") or a familiar trigger
 * ("After lunch"), chosen per block (August's model, ../personalize/when.ts). Defaults: Morning Start and Lunch & Reset
 * by the clock, the rest by what comes before (a relaxed day: triggers only; a more structured day: times, with the
 * evening still by its trigger; camp mornings by the clock). A block keeps its time while it shows a trigger, so
 * switching back restores it and the day's colors (which follow the time of day) never move. Evening Reset is one
 * flexible block: its time or trigger is when the evening begins, not a deadline for each job in it.
 * Saved plans from before triggers read as they were: a time she set keeps the block on its time; her wording for the
 * jobs' moment becomes the block's trigger.
 */
import type { PlanResource } from '../plan/resource';
import { activitiesOf, familyContext, isFamilySnapshot, type ContextMember, type FamilyContext, type FamilySnapshot } from '../personalize/family';
import { assignTasks, type PlanTask } from '../personalize/assign';
import { isTaskEdits, pruneTaskEdits, withEdits, type PlannedTask, type TaskEdits } from '../personalize/edits';
import { CUE } from '../personalize/cues';
import { CUE_LIMIT, tidyCue } from '../personalize/marks-text';
import { CONDITION_TRIGGER, TRIGGER_LIMIT, VAGUE_TRIGGER, clock as clockOf, minutes, overlaps, validTime, type SlotKind } from '../personalize/when';
export { TRIGGER_LIMIT, validTime, type SlotKind };
/** Her trigger, tidied and kept to the box: a long one ends at the last whole word, never mid-word. */
export const tidyTrigger = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim().replace(/[.]$/, '');
  if (t.length <= TRIGGER_LIMIT) return t;
  const cut = t.slice(0, TRIGGER_LIMIT + 1).replace(/\s+\S*$/, '');
  return (cut || t.slice(0, TRIGGER_LIMIT)).trim();
};

export const KIT_MONTH = '2027-05';
export type MayKey = 'morning' | 'move' | 'create' | 'lunch' | 'quiet' | 'free' | 'snack' | 'evening';
export const MAY_KEYS: readonly MayKey[] = ['morning', 'move', 'create', 'lunch', 'quiet', 'free', 'snack', 'evening'];
/**
 * Her changes to one block. `when`: time or trigger for its box (missing = the prepared choice); `trigger`: her words
 * for it. `cue`: from before triggers (her moment for the block's jobs); read as the trigger, never written now.
 */
export type MayEdit = { title?: string; desc?: string; time?: string; cue?: string; when?: SlotKind; trigger?: string };
export interface MayOptions {
  start: number;
  quiet: 'independent' | 'rest' | 'older';
  play: 'outdoors' | 'active' | 'creative' | 'mixed';
  structure: 'relaxed' | 'balanced' | 'structured';
  days: 'home' | 'mixed' | 'camp';
  snack: boolean;
}
export const TITLE_LIMIT = 38;
export const DESC_LIMIT = 78;
export const START_TIMES = [7, 7.5, 8, 8.5, 9, 9.5] as const;
export const DEFAULT_OPTIONS: MayOptions = { start: 8, quiet: 'independent', play: 'outdoors', structure: 'balanced', days: 'home', snack: true };
export const LABELS: Record<MayKey, string> = { morning: 'Morning Start', move: 'Move & Play', create: 'Create & Explore', lunch: 'Lunch & Reset', quiet: 'Quiet Time', free: 'Flexible Afternoon', snack: 'Snack & Reset', evening: 'Evening Reset' };
export const BASE_DESC: Record<MayKey, string> = {
  morning: 'Breakfast · Get dressed · Make beds',
  move: 'Outside · Bikes · Park · Backyard',
  create: 'Read · Build · Draw · Make',
  lunch: 'Eat · Clear dishes · Tidy up',
  quiet: 'Read · Puzzles · Quiet play',
  free: 'Friends · Park · Outing · Home play',
  snack: 'Have a snack · Put things away · Reset your space',
  evening: 'Pick up · Wash up · Wind down',
};
/** The anchor's own color before it's timed (the printable tints timed rows by the time of day). */
export const TINTS: Record<MayKey, string> = { morning: '#F8E8B5', move: '#F4DEA3', create: '#F0D493', lunch: '#DDEBDB', quiet: '#D1E5D6', free: '#C3DDCF', snack: '#E4E9D5', evening: '#D1D7EA' };

export interface MayMember extends ContextMember { kind: 'adult' | 'child' }
/**
 * A printed block. `time` is kept even when the box shows the trigger (it sets the block's color). `slot`: what the box
 * shows, or null (no set time).
 */
export interface MayRow {
  key: MayKey; title: string; desc: string; time: string; parts: PlannedTask[];
  when: SlotKind; trigger: string; slot: { kind: 'time'; text: string } | { kind: 'trigger'; text: string } | null;
}
export interface MayState {
  options: MayOptions;
  edits: Partial<Record<MayKey, MayEdit>>;
  order: MayKey[];
  removed: MayKey[];
  /** What prints, in order (derived; kept in the state for the plan screen). */
  rows: MayRow[];
  familyLabel: string;
  /** Her changes to who does the family jobs, by part id. */
  parts?: TaskEdits;
  /** The profile answers the rhythm was prepared from (saved means settled). */
  snapshot?: FamilySnapshot;
}

const hhmm = (n: number) => { const v = (n + 24) % 24; const h = Math.floor(v); const m = Math.round((v - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
export const clock = (time: string) => (time ? clockOf(time) : 'Evening');
export const startClock = (start: number) => clock(hhmm(start));

export const mayContext = (members: readonly MayMember[], prefs: { pets?: boolean } | undefined, snapshot?: FamilySnapshot): FamilyContext =>
  familyContext(members, prefs, KIT_MONTH, snapshot);

const ages = (ctx: FamilyContext) => ctx.children.map((c) => c.age).filter((a): a is number => a !== null);

/** Interests from her family page: the children's sports, lessons and clubs, by name. */
export function interestsOf(ctx: FamilyContext) {
  const of = (cat: string) => [...new Set(ctx.children.flatMap((c) => activitiesOf(ctx, c.id, cat).map((a) => a.name?.trim()).filter((n): n is string => Boolean(n))))];
  return { sports: of('sports'), lessons: of('lessons'), clubs: of('clubs'), any: ctx.children.some((c) => ['sports', 'lessons', 'clubs'].some((cat) => activitiesOf(ctx, c.id, cat).length)) };
}

/** The prepared day for this family: quiet time by ages, play by interests. */
export function familyDefaults(ctx: FamilyContext): MayOptions {
  const a = ages(ctx);
  const quiet: MayOptions['quiet'] = a.length && Math.min(...a) < 5 ? 'rest' : a.length && Math.min(...a) > 11 ? 'older' : 'independent';
  const i = interestsOf(ctx);
  const sporty = i.sports.length > 0, making = i.lessons.length + i.clubs.length > 0;
  const play: MayOptions['play'] = sporty && making ? 'mixed' : sporty ? 'active' : making ? 'creative' : 'outdoors';
  return { ...DEFAULT_OPTIONS, quiet, play };
}

const join = (xs: string[]) => xs.filter(Boolean).join(' · ');
const fit = (desc: string) => {
  if (desc.length <= DESC_LIMIT) return desc;
  const parts = desc.split(' · ');
  while (parts.length > 2 && parts.join(' · ').length > DESC_LIMIT) parts.pop();
  return parts.join(' · ').slice(0, DESC_LIMIT);
};

/** An anchor as prepared for the options and the family (her edits go on top). */
export function starter(key: MayKey, o: MayOptions, ctx?: FamilyContext): Required<Pick<MayEdit, 'title' | 'desc' | 'time'>> {
  let title = LABELS[key], desc = BASE_DESC[key];
  const idx = MAY_KEYS.indexOf(key);
  let time = key === 'evening' ? '' : hhmm(o.start + [0, 1, 2.5, 4, 5, 6, 8, 10][idx]);
  const i = ctx ? interestsOf(ctx) : { sports: [], lessons: [], clubs: [], any: false };
  const kids = ctx?.children ?? [];
  const young = kids.filter((c) => c.age !== null && c.age < 5);
  const older = kids.filter((c) => c.age === null || c.age >= 5);
  if (o.days === 'camp') {
    const names: Partial<Record<MayKey, [string, string]>> = {
      move: ['Pack & Head Out', 'Pack bag · Water bottle · Shoes'],
      create: ['Camp or Program', 'Play · Learn · Explore · Friends'],
      lunch: ['Lunch & Reset', 'Lunch · Pack things · Tidy up'],
      quiet: ['Recharge', 'Snack · Quiet time · Rest'],
      free: ['Free Time', 'Friends · Outside · Home play'],
      snack: ['Home & Snack', 'Have a snack · Unpack · Reset your space'],
    };
    if (names[key]) [title, desc] = names[key]!;
    time = key === 'evening' ? '' : hhmm(o.start + [0, 0.5, 1, 4, 7.5, 8.5, 9, 10][idx]);
  } else {
    if (o.days === 'mixed') {
      const mixed: Partial<Record<MayKey, [string, string]>> = { move: ['Home Play or Outing', 'Outside · Park · Friends · Home play'], create: ['Choose & Explore', 'Read · Build · Draw · Make'], free: ['Flexible Afternoon', 'Friends · Park · Outing · Home play'] };
      if (mixed[key]) [title, desc] = mixed[key]!;
    }
    if (key === 'quiet') {
      desc = o.quiet === 'rest' ? 'Nap · Rest · Quiet books' : o.quiet === 'older' ? 'Read · Recharge · Independent time' : 'Read · Puzzles · Quiet play';
      // Mixed ages: the little ones rest while the older ones choose a quiet activity of their own.
      if (o.quiet === 'rest' && young.length && older.length) desc = `${young.map((c) => c.name).join(' & ')} ${young.length > 1 ? 'rest' : 'rests'} · Books, puzzles, quiet play`;
    }
    if (key === 'move') {
      desc = o.play === 'active' ? 'Ball games · Movement · Outdoors' : o.play === 'creative' ? 'Explore · Move · Make something' : o.play === 'mixed' ? 'Get moving · Choose how to play' : BASE_DESC.move;
      if (i.sports.length) desc = join(['Outside', ...i.sports.slice(0, 2).map((s) => `${s} practice`), 'Bikes']);
    }
    if (key === 'create' && (i.lessons.length || i.clubs.length)) desc = join(['Read · Build', ...i.lessons.slice(0, 1).map((s) => `${s} practice`), ...i.clubs.slice(0, 1).map((s) => `${s} project`), 'Draw']);
    if (key === 'free' && o.days === 'home') desc = o.play === 'creative' ? 'Art · Make · Friends · Home play' : o.play === 'active' ? 'Friends · Sports · Park · Home play' : BASE_DESC.free;
    // Free time leans on what they already love doing.
    if (key === 'free' && (i.lessons.length || i.clubs.length) && o.days !== 'mixed') desc = join(['Friends', ...i.lessons.slice(0, 1).map((s) => `${s} for fun`), 'Park', 'Home play']);
  }
  return { title, desc: fit(desc), time };
}

/** Which anchors show: Snack & Reset is optional; relaxed days drop the activity blocks; camp days swap lunch and quiet for the program. */
export const visibleKeys = (order: readonly MayKey[], o: MayOptions) =>
  order.filter((k) => (o.snack || k !== 'snack') && (o.structure !== 'relaxed' || (k !== 'create' && k !== 'move')) && (o.days === 'camp' ? k !== 'lunch' && k !== 'quiet' : k !== 'create'));

// ------------------------------------------------------------------ shared family responsibilities

export type MayPart = PlanTask & { block: MayKey };
/** The family jobs that belong to the day's anchors. Children's own jobs are 'each'; the shared ones one owner each. */
export const MAY_PARTS: readonly MayPart[] = [
  { block: 'morning', id: 'beds', title: 'Make my bed', mode: 'each', who: 'child', minAge: 4, wishes: ['tidy-room'] },
  { block: 'morning', id: 'pets', title: 'Feed the pets', mode: 'one', who: 'child', minAge: 4, areas: ['pet-care'], wishes: ['pet-care'] },
  { block: 'morning', id: 'breakfast', title: 'Breakfast', mode: 'one', who: 'any', minAge: 12, prefer: 'adult', areas: ['meals'] },
  { block: 'lunch', id: 'make-lunch', title: 'Make lunch', mode: 'one', who: 'any', minAge: 11, areas: ['meals'], wishes: ['help-with-meals'] },
  { block: 'lunch', id: 'set-table', title: 'Set the table', mode: 'one', who: 'child', minAge: 4, wishes: ['help-with-meals'] },
  { block: 'lunch', id: 'clear', title: 'Clear the dishes', mode: 'one', who: 'child', minAge: 4, wishes: ['help-with-meals'] },
  { block: 'snack', id: 'snack-away', title: 'Put my snack things away', mode: 'each', who: 'child', minAge: 3 },
  { block: 'evening', id: 'dinner', title: 'Make dinner', mode: 'one', who: 'any', minAge: 14, prefer: 'adult', areas: ['meals'] },
  { block: 'evening', id: 'dishes', title: 'Do the dishes', mode: 'one', who: 'any', minAge: 12, prefer: 'adult', areas: ['meals', 'cleaning'] },
  { block: 'evening', id: 'pickup', title: 'Pick up my things', mode: 'each', who: 'child', minAge: 2, wishes: ['tidy-room'] },
];
export const partRules = Object.fromEntries(MAY_PARTS.map((p) => [p.id, { who: p.who, minAge: p.minAge, maxAge: p.maxAge }]));
const PART_BLOCK = new Map(MAY_PARTS.map((p) => [p.id, p.block]));

/**
 * The cue for each anchor's family jobs: one existing moment the jobs on that anchor share, printed once below them
 * (WHEN). Anchors without family jobs have no cue: the anchor itself is the moment.
 */
export const BLOCK_CUES: Partial<Record<MayKey, string>> = { morning: CUE.wake, lunch: CUE.lunchtime, snack: CUE.snack, evening: CUE.dinnertime };
export const cueOf = (key: MayKey, edits: MayState['edits']) => (edits[key]?.cue && tidyCue(edits[key]!.cue!)) || BLOCK_CUES[key];
export { CUE_LIMIT };

/** Every prepared family job with her changes, in order. Jobs nobody can do yet (or pets without pets) aren't listed. */
export function mayParts(ctx: FamilyContext, edits?: TaskEdits): (PlannedTask & { block: MayKey })[] {
  const tasks = MAY_PARTS.filter((p) => p.id !== 'pets' || ctx.pets);
  const prepared = assignTasks(tasks, ctx, { seed: 'may' }).filter((a) => a.ownerIds.length);
  return withEdits(prepared, edits, ctx).map((t) => ({ ...t, block: PART_BLOCK.get(t.id)! }));
}

// ------------------------------------------------------------------ when it happens

/** Familiar events to choose from (and her own words). */
export const TRIGGER_CHOICES = [
  'When we wake up', 'After breakfast', 'After getting dressed', 'After morning play', 'After lunch', 'After quiet time',
  'After afternoon play', 'When we get home', 'After snack', 'When we’re ready for dinner',
] as const;
/** The prepared trigger for each block: the event that comes before it on an ordinary summer day. */
export function defaultTrigger(key: MayKey, o: MayOptions): string {
  if (o.days === 'camp') return ({ morning: 'When we wake up', move: 'After breakfast', create: 'When we get there', lunch: 'After lunch', quiet: 'When we get home', free: 'After a snack', snack: 'When we get home', evening: 'When we’re ready for dinner' } as Record<MayKey, string>)[key];
  return ({ morning: 'When we wake up', move: 'After getting dressed', create: 'After morning play', lunch: 'After morning play', quiet: 'After lunch', free: 'After quiet time', snack: 'After afternoon play', evening: 'When we’re ready for dinner' } as Record<MayKey, string>)[key];
}
/**
 * The prepared choice for each block's box. Balanced (the default): the morning and lunch by the clock, everything
 * else by what comes before. Relaxed: no clock at all. More structured: the clock, with the evening still flexible.
 * Camp days: the morning out the door is timed (programs start on time).
 */
export function defaultKind(key: MayKey, o: MayOptions): SlotKind {
  if (o.structure === 'relaxed') return 'trigger';
  if (key === 'evening') return 'trigger';
  if (o.structure === 'structured') return 'time';
  if (o.days === 'camp') return key === 'morning' || key === 'move' || key === 'create' ? 'time' : 'trigger';
  return key === 'morning' || key === 'lunch' ? 'time' : 'trigger';
}
/** A time for the evening when she switches it to the clock (it has none prepared: it's "the evening"). */
export const EVENING_TIME = '17:30';

/**
 * What a block's box shows, read from her edits on top of the prepared choice. Plans saved before triggers: a time she
 * set keeps the block on its time (except on a relaxed day, which never showed times); her moment for the block's jobs
 * becomes its trigger.
 */
export function whenOf(key: MayKey, edit: MayEdit | undefined, o: MayOptions): { when: SlotKind; trigger: string } {
  const legacyTime = edit?.when === undefined && typeof edit?.time === 'string' && validTime(edit.time) && o.structure !== 'relaxed';
  const when: SlotKind = edit?.when ?? (legacyTime ? 'time' : defaultKind(key, o));
  const trigger = (edit?.trigger !== undefined ? tidyTrigger(edit.trigger) : '') || (edit?.cue ? tidyTrigger(edit.cue) : '') || defaultTrigger(key, o);
  return { when, trigger };
}

/** What prints, in order, with each anchor's family jobs and its one time or trigger. */
export function mayRows(s: Pick<MayState, 'options' | 'edits' | 'order' | 'parts'>, ctx?: FamilyContext): MayRow[] {
  const parts = ctx ? mayParts(ctx, s.parts) : [];
  return visibleKeys(s.order, s.options).map((key) => {
    const { cue: _cue, when: _when, trigger: _trigger, ...edit } = s.edits[key] ?? {};
    const mine = parts.filter((p) => p.block === key && !p.skipped);
    const base = { ...starter(key, s.options, ctx), ...edit };
    const { when, trigger } = whenOf(key, s.edits[key], s.options);
    const slot = when === 'trigger' ? { kind: 'trigger' as const, text: trigger } : validTime(base.time) ? { kind: 'time' as const, text: clock(base.time) } : null;
    return { key, ...base, parts: mine, when, trigger, slot };
  });
}

export interface MayIssue { key: MayKey; kind: 'order' | 'vague' | 'condition' | 'restates' | 'circular' | 'long'; text: string }
/**
 * What doesn't add up on the printed day (shown in the editor, never changed for her): a time earlier than the timed
 * block before it, and a trigger that says nothing, is a deadline or condition rather than an event, repeats the
 * block's own name, or names a block that comes later. Evening Reset is one flexible block: making dinner and cleaning
 * up inside it are never a contradiction.
 */
export function mayIssues(rows: readonly MayRow[]): MayIssue[] {
  const issues: MayIssue[] = [];
  let last: MayRow | null = null;
  rows.forEach((r, i) => {
    if (r.slot?.kind === 'time') {
      if (last && minutes(r.time) < minutes(last.time)) issues.push({ key: r.key, kind: 'order', text: `“${r.title}” at ${clock(r.time)} is earlier than “${last.title}” at ${clock(last.time)}.` });
      last = r;
      return;
    }
    if (r.slot?.kind !== 'trigger') return;
    const t = r.slot.text;
    const later = rows.slice(i + 1), earlier = rows.slice(0, i);
    if (VAGUE_TRIGGER.test(t)) issues.push({ key: r.key, kind: 'vague', text: `“${t}” doesn’t name an event. Try something that happens every day, like “After lunch”.` });
    else if (CONDITION_TRIGGER.test(t)) issues.push({ key: r.key, kind: 'condition', text: `“${t}” is a deadline or a condition, not the moment it starts. Use the event that starts it, like “After quiet time”.` });
    else if (/^(after|once)\b/i.test(t) && later.some((l) => overlaps(t, l.title)) && !earlier.some((e) => overlaps(t, e.title))) issues.push({ key: r.key, kind: 'circular', text: `“${t}” is about a block that comes later in the day. A trigger has to happen first.` });
    else if (/^(after|once)\b/i.test(t) && overlaps(t, r.title)) issues.push({ key: r.key, kind: 'restates', text: `“${t}” is this block itself. Use what comes just before it.` });
  });
  return issues;
}

/** Everything that prints, as a stable string: what approval is checked against. */
export const mayFingerprint = (s: Pick<MayState, 'options' | 'edits' | 'order' | 'parts' | 'familyLabel'>, ctx?: FamilyContext) =>
  JSON.stringify({ familyLabel: s.familyLabel, days: s.options.days, structure: s.options.structure, rows: mayRows(s, ctx).map((r) => ({ key: r.key, title: r.title, desc: r.desc, time: r.time, slot: r.slot, parts: r.parts.map((p) => [p.label, p.who, p.owners.map((o) => o.color.id)]) })) });

/** Her saved change to one block, checked; anything malformed is dropped (shared by the printable and its tests). */
export function readEdit(obj: unknown): MayEdit | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const edit: MayEdit = {};
  if (typeof o.title === 'string') edit.title = o.title.slice(0, TITLE_LIMIT);
  if (typeof o.desc === 'string') edit.desc = o.desc.slice(0, DESC_LIMIT);
  if (typeof o.cue === 'string' && o.cue.trim()) edit.cue = tidyCue(o.cue);
  if (typeof o.time === 'string' && (validTime(o.time) || o.time === '')) edit.time = o.time;
  if (o.when === 'time' || o.when === 'trigger') edit.when = o.when;
  if (typeof o.trigger === 'string') edit.trigger = tidyTrigger(o.trigger);
  return edit;
}

// ------------------------------------------------------------------ edits on the state (the editor's changes)

/**
 * Move a block earlier (-1) or later (+1) among the blocks this day shows. Like August, times stay in order: when the
 * two blocks trading places both show a time, they trade times too (the times belong to the slots). Triggers belong to
 * their block and move with it.
 */
export function moveBlock(s: Pick<MayState, 'edits' | 'options' | 'order'>, key: MayKey, dir: -1 | 1, ctx?: FamilyContext) {
  const shown = visibleKeys(s.order, s.options);
  const i = shown.indexOf(key), other = shown[i + dir];
  if (i < 0 || !other) return;
  const a = s.order.indexOf(key), b = s.order.indexOf(other);
  [s.order[a], s.order[b]] = [s.order[b], s.order[a]];
  const timeOf = (k: MayKey) => s.edits[k]?.time ?? starter(k, s.options, ctx).time;
  const timed = (k: MayKey) => whenOf(k, s.edits[k], s.options).when === 'time' && validTime(timeOf(k));
  if (timed(key) && timed(other)) {
    const [t1, t2] = [timeOf(key), timeOf(other)];
    s.edits[key] = { ...(s.edits[key] ?? {}), time: t2, when: 'time' };
    s.edits[other] = { ...(s.edits[other] ?? {}), time: t1, when: 'time' };
  }
}

/** Show the block's time or its trigger. Switching to the clock gives the evening a time if it has none. */
export function setWhen(s: Pick<MayState, 'edits' | 'options'>, key: MayKey, when: SlotKind) {
  const e = { ...(s.edits[key] ?? {}) };
  // Keep what she sees: a plan saved before triggers carries its words over once she chooses.
  const cur = whenOf(key, e, s.options);
  if (e.trigger === undefined && e.cue) e.trigger = cur.trigger;
  e.when = when;
  if (when === 'time' && key === 'evening' && !validTime(e.time ?? '')) e.time = EVENING_TIME;
  s.edits[key] = e;
}
export function setTime(s: Pick<MayState, 'edits'>, key: MayKey, time: string) {
  if (!validTime(time) && time !== '') return;
  s.edits[key] = { ...(s.edits[key] ?? {}), time, when: 'time' };
}
export function setTrigger(s: Pick<MayState, 'edits' | 'options'>, key: MayKey, text: string) {
  const t = tidyTrigger(text);
  const e = { ...(s.edits[key] ?? {}), when: 'trigger' as const };
  if (t && t !== defaultTrigger(key, s.options)) e.trigger = t; else delete e.trigger;
  delete e.cue;
  s.edits[key] = e;
}

/** Her saved plan's parts and snapshot, checked; anything malformed is dropped. */
export function readSaved(stored: { parts?: unknown; snapshot?: unknown }): Pick<MayState, 'parts' | 'snapshot'> {
  return {
    ...(isTaskEdits(stored.parts) ? { parts: stored.parts } : {}),
    ...(isFamilySnapshot(stored.snapshot) ? { snapshot: stored.snapshot } : {}),
  };
}
export const keepToFamily = (parts: TaskEdits | undefined, ctx: FamilyContext) => (parts ? pruneTaskEdits(parts, ctx) : parts);

export interface MayPlan extends PlanResource<MayState> {
  /** Past the editing cutoff: the sheet stops taking edits and the editor stays closed. */
  setLocked: (on: boolean) => void;
  /** The desktop editor: an area ('day', 'when', 'jobs'), and a block to open it at. */
  openEditor: (section?: 'day' | 'when' | 'jobs', key?: MayKey) => void;
  /** The family for the shared owner editor (names, ages). */
  context: () => FamilyContext | null;
  /** Back to the rhythm prepared from her newest family-page answers. */
  restore: () => void;
}
