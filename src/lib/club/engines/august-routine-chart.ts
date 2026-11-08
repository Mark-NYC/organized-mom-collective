/**
 * August 2027 routine charts: the family's "Morning Routine" and "After-School Routine", one US Letter page each, shared
 * by all the children (the sheets: src/components/club/AugustSchoolRoutines.astro; the family plan and state:
 * ./august-school-routines.ts). Pure functions only. A family gets two charts, never a page per child: a step that's
 * only some children's (feeding the pet, a practice bag) names them in their colors; a step for everyone names no one.
 *
 * Every step can have a clock time and a habit trigger, and they mean different things: the time is when it's expected
 * to happen; the trigger is the familiar event that tells the child to start without being reminded. The chart shows
 * ONE of them per step, in the same white box on the right of the row: each chart has a mode (`modes`: the morning shows
 * times, after school shows triggers, because mornings race a departure and afternoons move with activities), and any
 * step can show the other instead (`show`). Nothing else to set per row.
 * Fewer, smarter triggers. The numbered sequence already says what comes next, so a trigger is prepared only where it
 * adds independent information:
 * - the routine's starting event (after school: "When I walk in the door"), a real transition, not the step before;
 * - a step that happens only on some days, with the days from her family page ("Pack my swim team bag" · On Mon, Wed &
 *   Fri), or "On swim team days" when she gave no days.
 * Every other row's box is empty. Nothing is invented: no routine, place or activity the profile doesn't support.
 * `stepIssues` checks what she types (only what the chart shows): a trigger that restates the step, says nothing,
 * repeats the chart's order ("After washing hands" right after washing hands), is a deadline or condition rather than
 * a starting event ("Before screen time"), or points at a later step; and times out of order or past out the door.
 *
 * Times: the morning is timed back from the out-the-door time (her family page's school start minus 20 minutes, the
 * earliest for children leaving together; a sample 7:50 marked as a default otherwise), in order, ending before it.
 * The after-school routine is event-based by default (no clock times: afternoons change with activities); she can turn
 * times on. Reordering keeps the times in order (times belong to the slots, the steps move between them).
 */
import { marchIconArt } from '../../../data/club/march-chore-icons';
import { activitiesOf, existingFor, wishedFor, type FamilyContext } from '../personalize/family';
import { CONDITION_TRIGGER, VAGUE_TRIGGER, clock, hhmm, minutes, overlaps, validTime, type SlotKind } from '../personalize/when';

export type Group = 'morning' | 'after';
export interface Step {
  id: string;
  /** 'HH:MM'. Kept even when hidden, so turning the time back on restores it. */
  time: string;
  label: string;
  icon: string;
  group: Group;
  removed?: boolean;
  /** The habit trigger ('' = none). Missing on routines saved before triggers: the step's prepared trigger applies. */
  cue?: string;
  /** This step shows the other kind than its chart's mode ('time' or 'trigger'). */
  show?: SlotKind;
  /** From the earlier chart (separate time and trigger switches); ignored now, kept so saved plans still read. */
  timeOff?: boolean;
  cueOff?: boolean;
  /** The children it's for (member ids); missing = every child. */
  who?: string[];
}
/** What a row's right-hand box shows (the shared timing model). */
export type { SlotKind } from '../personalize/when';
/** Each chart's default: mornings race a departure (times); afternoons move with activities (triggers). */
export const DEFAULT_MODES: Record<Group, SlotKind> = { morning: 'time', after: 'trigger' };

export interface Routine {
  steps: Step[];
  /** Her chart-level choice, when it isn't the default. */
  modes?: Partial<Record<Group, SlotKind>>;
  mode: 'standard' | 'simple';
  /** The line under the header ("Check the chart. Do the next thing."), when she changed it. */
  footer?: string;
  /** Her out-the-door time for the morning ('HH:MM'), when she set one. */
  leave?: string;
}

/** The approved icon-library art, cleaned of its alpha haze for print (scripts/prepare-routine-chart-icons.py). */
export const ICONS: Record<string, string> = {
  lunch: '/images/club/routine-icons/lunch-box.png', water: '/images/club/routine-icons/water-bottle.png',
  quiet: '/images/club/routine-icons/quiet-time.png', play: '/images/club/routine-icons/free-afternoon.png',
  wake: '/images/club/routine-icons/morning-start.png', clothes: '/images/club/routine-icons/getting-dressed.png',
  breakfast: '/images/club/routine-icons/breakfast-bowl.png', teeth: '/images/club/routine-icons/toothbrush.png',
  bag: '/images/club/routine-icons/backpack.png', shoes: '/images/club/routine-icons/sneakers.png',
  hands: '/images/club/routine-icons/washing-hands.png', snack: '/images/club/routine-icons/yogurt-cup.png',
  book: '/images/club/routine-icons/doing-homework.png', friends: '/images/club/routine-icons/playing-with-friends.png',
  // The approved March art for feeding pets (the icon library has none).
  pets: marchIconArt('feed-pets')?.src ?? '/images/club/routine-icons/morning-start.png',
};

// The clock helpers and the time-or-trigger kind are the Club's shared timing model (../personalize/when.ts).
export { validTime, minutes, hhmm, clock, clockParts } from '../personalize/when';

export const DEFAULT_LEAVE = '07:50';
export const DEFAULT_AFTER = '15:30';

/**
 * The morning, from the out-the-door time: minutes before leaving for each step. The last step ends five minutes
 * before it, so "Out the door by" is always the latest time on the page.
 */
const MORNING = [
  { id: 'wake', label: 'Wake up & stretch', icon: 'wake', before: 45, cue: '' },
  { id: 'dress', label: 'Get dressed', icon: 'clothes', before: 35, cue: '' },
  { id: 'eat', label: 'Eat breakfast', icon: 'breakfast', before: 30, cue: '' },
  { id: 'teeth', label: 'Brush teeth', icon: 'teeth', before: 15, cue: '' },
  { id: 'backpack', label: 'Grab backpack & lunch box', icon: 'bag', before: 10, cue: '' },
  { id: 'out', label: 'Shoes on & out the door', icon: 'shoes', before: 5, cue: '' },
] as const;
/** After school, by default event-based: the sample times show only if she turns them on. */
const AFTER = [
  // The one starting cue: a real transition. The rest follow the numbers.
  { id: 'shoes', label: 'Shoes & coat away', icon: 'shoes', after: 0, cue: 'When I walk in the door' },
  { id: 'unpack', label: 'Unpack backpack & lunch box', icon: 'bag', after: 5, cue: '' },
  { id: 'wash', label: 'Wash hands', icon: 'hands', after: 10, cue: '' },
  { id: 'snack', label: 'Have a snack', icon: 'snack', after: 15, cue: '' },
  { id: 'homework', label: 'Homework or reading', icon: 'book', after: 30, cue: '' },
  { id: 'free', label: 'Free play', icon: 'play', after: 60, cue: '' },
] as const;
/** Triggers for routines saved before triggers existed (by step id). */
export const LEGACY_CUES: Record<string, string> = Object.fromEntries([...MORNING, ...AFTER].filter((s) => s.cue).map((s) => [s.id, s.cue]));

/** What the bottom banner says: done, and what comes next. */
export const BANNERS: Record<Group, { title: string; line: string; icon: string }> = {
  morning: { title: 'Out the door!', line: 'Have a great day!', icon: 'shoes' },
  after: { title: 'Ready for free time!', line: 'Home, unpacked and reset.', icon: 'friends' },
};
export const HEADERS: Record<Group, { title: string; subtitle: string; icon: string }> = {
  morning: { title: 'Morning Routine', subtitle: 'One step at a time.', icon: 'wake' },
  after: { title: 'After-School Routine', subtitle: 'Home, reset, then free time.', icon: 'book' },
};
export const DEFAULT_TAGLINE = 'Check the chart. Do the next thing.';

export interface ChildFacts {
  id: string;
  age: number;
  /** She already takes care of the pet (profile step 3, owner). */
  pets?: boolean;
  /** Their sports or clubs by name: a bag to pack on those days. */
  practice?: string[];
  /** The days of that practice (0 = Sunday … 6), when her family page says. */
  practiceDays?: number[];
  /** A sport has gear to pack; a club only something to get ready (no equipment is assumed for it). */
  practiceKind?: 'sports' | 'clubs';
  /** Their lessons by name: practice after homework. */
  lessons?: string[];
}

/** What a child's profile says that adds a step for them (nothing when there's no profile). */
export function childFacts(ctx: FamilyContext | null, id: string, age: number): ChildFacts {
  if (!ctx) return { id, age };
  const named = (cat: string) => activitiesOf(ctx, id, cat).filter((a) => a.memberIds.includes(id)).map((a) => a.name?.trim()).filter((n): n is string => Boolean(n));
  return {
    id, age,
    pets: ctx.pets && existingFor(ctx, 'pet-care').owners.includes(id),
    ...(() => {
      const a = [...activitiesOf(ctx, id, 'sports'), ...activitiesOf(ctx, id, 'clubs')].find((x) => x.memberIds.includes(id) && x.name?.trim());
      return a ? { practice: [a.name!.trim()], practiceDays: a.days, practiceKind: a.category as 'sports' | 'clubs' } : { practice: [] };
    })(),
    lessons: named('lessons').slice(0, 1),
  };
}

const step = (group: Group, id: string, label: string, icon: string, time: string, cue: string, extra: Partial<Step> = {}): Step =>
  ({ id, time, label, icon, group, cue, ...extra });
const lower = (t: string) => t.toLowerCase();
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "On Mon, Wed & Fri" from her family page; "On swim team days" when she gave no days; nothing for every weekday. */
export function daysCue(days: readonly number[] | undefined, name: string): string {
  const list = [...new Set(days ?? [])].filter((d) => d >= 0 && d <= 6).sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7));
  if (!list.length) return `On ${name} days`;
  if (list.length >= 5) return '';
  const names = list.map((d) => DAY[d]);
  return `On ${names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0]}`;
}

/**
 * The family's two routines for its school-aged children (`kids`), the morning timed back from `leave`. Worded for the
 * whole group (the youngest and oldest can both follow it), with a step only some children do added for them by name:
 * feeding the pet for whoever already does, packing a practice bag on practice days, practicing lessons. At most eight
 * steps a chart.
 */
export function preparedFamilyRoutine(kids: readonly ChildFacts[], leave: string = DEFAULT_LEAVE): Routine {
  const out = validTime(leave) ? minutes(leave) : minutes(DEFAULT_LEAVE);
  const morning: Step[] = MORNING.map((m) => step('morning', m.id, m.label, m.icon, hhmm(out - m.before), m.cue));
  const after: Step[] = AFTER.map((a) => step('after', a.id, a.label, a.icon, hhmm(minutes(DEFAULT_AFTER) + a.after), a.cue));
  const m = (id: string) => morning.find((x) => x.id === id)!;
  const a = (id: string) => after.find((x) => x.id === id)!;
  const ages = kids.map((k) => k.age);
  // Only little ones: picture-book words, and free play follows their book (no homework to finish).
  if (ages.length && ages.every((x) => x <= 5)) { m('backpack').label = 'Get my school bag'; a('homework').label = 'Look at a book'; }
  if (ages.length && ages.every((x) => x >= 13)) { m('wake').label = 'Wake up to my alarm'; a('homework').label = 'Homework & study time'; a('free').label = 'Free time'; }
  const pets = kids.filter((k) => k.pets && k.age >= 4).map((k) => k.id);
  if (pets.length) {
    const t = m('teeth');
    morning.splice(morning.indexOf(t), 0, step('morning', 'pets', 'Feed the pets', 'pets', hhmm(minutes(t.time) - 5), '', { who: pets }));
  }
  for (const k of kids.filter((x) => x.lessons?.length && x.age >= 5).slice(0, 1)) {
    const f = a('free');
    after.splice(after.indexOf(f), 0, step('after', `practice-${k.id}`, `Practice ${lower(k.lessons![0])}`, 'book', hhmm(minutes(f.time) - 15), '', { who: [k.id] }));
  }
  for (const k of kids.filter((x) => x.practice?.length && x.age >= 6)) {
    const f = a('free');
    const name = lower(k.practice![0]);
    // Two children with the same practice share one row.
    const same = after.find((x) => x.id === `gear-${name}`);
    if (same) { same.who = [...(same.who ?? []), k.id]; continue; }
    if (after.length >= 8) break;
    after.splice(after.indexOf(f), 0, step('after', `gear-${name}`, k.practiceKind === 'clubs' ? `Get ready for ${name}` : `Pack my ${name} bag`, 'bag', hhmm(minutes(f.time) - 5), daysCue(k.practiceDays, name), { who: [k.id] }));
  }
  return { steps: [...morning, ...after], mode: 'standard' };
}

/** One child's routines (the standalone member copy, and tests): the family routine for just them. */
export const preparedRoutine = (age: number, leave: string = DEFAULT_LEAVE, facts: Partial<ChildFacts> = {}): Routine =>
  preparedFamilyRoutine([{ id: facts.id ?? 'child', ...facts, age }], leave);

/** Steps she can add, a short list for each routine (each with a trigger she can change). */
export const CHOICES: Record<Group, readonly { id: string; label: string; icon: string; cue: string }[]> = {
  morning: [
    { id: 'lunch', label: 'Grab my lunch box', icon: 'lunch', cue: '' }, { id: 'pack-lunch', label: 'Pack my lunch', icon: 'lunch', cue: '' },
    { id: 'water', label: 'Fill my water bottle', icon: 'water', cue: '' }, { id: 'make-bed', label: 'Make my bed', icon: 'wake', cue: '' },
    { id: 'read-early', label: 'Ready early? Read or draw', icon: 'book', cue: '' },
  ],
  after: [
    { id: 'put-backpack', label: 'Put my backpack away', icon: 'bag', cue: '' }, { id: 'quiet', label: 'Quiet time', icon: 'quiet', cue: '' },
    { id: 'lunchbox', label: 'Empty my lunch box', icon: 'lunch', cue: '' }, { id: 'read', label: 'Read for 20 minutes', icon: 'book', cue: '' },
    { id: 'friends', label: 'Play outside or with friends', icon: 'friends', cue: '' },
  ],
};

/** A step's trigger: hers, the prepared one, or none. */
export const cueOf = (s: Step) => (s.cue ?? LEGACY_CUES[s.id] ?? '').trim();
export const modeOf = (r: Routine, g: Group): SlotKind => r.modes?.[g] ?? DEFAULT_MODES[g];
/** What a step shows in its box: its own choice, else its chart's mode. */
export const slotKind = (r: Routine, s: Step): SlotKind => s.show ?? modeOf(r, s.group);

// ------------------------------------------------------------------ checks

/** Triggers that say nothing, and deadlines or conditions instead of events: the shared checks. */
const VAGUE = VAGUE_TRIGGER;
export interface StepIssue { stepId: string; kind: 'order' | 'deadline' | 'restates' | 'vague' | 'circular' | 'order-only' | 'condition' | 'missing'; text: string }
const CONDITION = CONDITION_TRIGGER;

/**
 * What doesn't add up on a routine (shown in the editor, never silently changed): a time earlier than the step before
 * it, a morning time at or after the out-the-door time, and triggers that restate the step, say nothing, or point at a
 * step that comes later.
 */
export function stepIssues(r: Routine, group: Group, leave?: string): StepIssue[] {
  // Only what the chart shows is checked: a hidden time can't be out of order, a hidden trigger can't confuse anyone.
  const list = r.steps.filter((x) => x.group === group && !x.removed && !(r.mode === 'simple' && x.id === SHORTER_HIDES[group]));
  const hidden = r.steps.filter((x) => x.group === group && !list.includes(x));
  const issues: StepIssue[] = [];
  let last: { label: string; time: string } | null = null;
  list.forEach((s, i) => {
    if (slotKind(r, s) === 'time' && validTime(s.time)) {
      if (last && minutes(s.time) < minutes(last.time)) issues.push({ stepId: s.id, kind: 'order', text: `“${s.label}” at ${clock(s.time)} is earlier than “${last.label}” at ${clock(last.time)}.` });
      if (group === 'morning' && leave && validTime(leave) && minutes(s.time) >= minutes(leave)) issues.push({ stepId: s.id, kind: 'deadline', text: `“${s.label}” at ${clock(s.time)} isn’t before out the door at ${clock(leave)}.` });
      last = { label: s.label, time: s.time };
    }
    const cue = slotKind(r, s) === 'trigger' ? cueOf(s) : '';
    if (!cue) return;
    const later = list.slice(i + 1);
    if (VAGUE.test(cue)) issues.push({ stepId: s.id, kind: 'vague', text: `“${cue}” doesn’t name an event. Try something that happens every day, like “After breakfast”, or leave it off.` });
    else if (/^before\b/i.test(cue) && later.length && overlaps(cue, later[0].label)) issues.push({ stepId: s.id, kind: 'order-only', text: `“${cue}” only repeats the order of the chart. Leave it empty: the numbers already say what’s next.` });
    else if (/^(after|once|when)\b/i.test(cue) && i > 0 && overlaps(cue, list[i - 1].label) && !list.slice(i + 1).some((l) => overlaps(cue, l.label))) issues.push({ stepId: s.id, kind: 'order-only', text: `“${cue}” just names the step before it. Leave it empty: the numbers already say what’s next.` });
    else if (CONDITION.test(cue)) issues.push({ stepId: s.id, kind: 'condition', text: `“${cue}” is a deadline or a condition, not the moment it starts. Use the event that starts it, like “When I walk in the door”, or leave it empty.` });
    else if (/^(after|once)\b/i.test(cue) && later.some((l) => overlaps(cue, l.label)) && !list.slice(0, i).some((e) => overlaps(cue, e.label))) issues.push({ stepId: s.id, kind: 'circular', text: `“${cue}” comes later on the chart. A trigger has to happen first.` });
    else if (/^(after|once)\b/i.test(cue) && !list.some((e) => overlaps(cue, e.label)) && hidden.some((h) => overlaps(cue, h.label))) issues.push({ stepId: s.id, kind: 'missing', text: `“${cue}” is about a step that isn’t on the chart now.` });
    // "On soccer days" for "Pack my soccer bag" names the day it happens: that's the trigger, not a repeat.
    else if (!/^on\b/i.test(cue) && overlaps(cue, s.label)) issues.push({ stepId: s.id, kind: 'restates', text: `“${cue}” says the same thing as “${s.label}”. Leave it off.` });
  });
  return issues;
}

/** Shorter routine: hides these without deleting them. */
export const SHORTER_HIDES: Record<Group, string> = { morning: 'wake', after: 'wash' };
export const shown = (r: Routine, g: Group) => r.steps.filter((x) => x.group === g && !x.removed && !(r.mode === 'simple' && x.id === SHORTER_HIDES[g]));

/** Keep a routine's times in order when steps move: the steps change places, the times stay with the slots. */
export function swapKeepingTimes(r: Routine, a: Step, b: Step) {
  const i = r.steps.indexOf(a), j = r.steps.indexOf(b);
  [r.steps[i], r.steps[j]] = [r.steps[j], r.steps[i]];
  [a.time, b.time] = [b.time, a.time];
}

/** A time for a new step placed before `next` (after `prev`): halfway, on five minutes; never out of order. */
export function timeBetween(prev?: Step, next?: Step): string {
  const p = prev && validTime(prev.time) ? minutes(prev.time) : null;
  const n = next && validTime(next.time) ? minutes(next.time) : null;
  if (p !== null && n !== null) return hhmm(Math.max(p, Math.floor((p + n) / 2 / 5) * 5));
  if (p !== null) return hhmm(p + 5);
  if (n !== null) return hhmm(n - 5);
  return DEFAULT_AFTER;
}
