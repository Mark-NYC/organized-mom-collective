/**
 * August 2027 routine charts: the family's "Morning Routine" and "After-School Routine", one US Letter page each, shared
 * by all the children (the sheets: src/components/club/AugustSchoolRoutines.astro; the family plan and state:
 * ./august-school-routines.ts). Pure functions only. A family gets two charts, never a page per child: a step that's
 * only some children's (feeding the pet, a practice bag) names them in their colors; a step for everyone names no one.
 *
 * Every step has an optional clock time and an optional habit trigger, and they mean different things:
 * - the time is when it's expected to happen (the right-hand column);
 * - the trigger is the familiar event that tells the child to start without being reminded (WHEN, under the step).
 * A trigger prints only when it adds something: never one that restates the step ("Wake up" · When I wake up), a vague
 * one ("When I'm ready"), or one that only repeats the order ("Grab backpack" · Before shoes on). `stepIssues` checks
 * her own triggers and times the same way, so the editor can say what's wrong; the prepared routines have none.
 *
 * Times: the morning is timed back from the out-the-door time (her family page's school start minus 20 minutes, the
 * earliest for children leaving together; a sample 7:50 marked as a default otherwise), in order, ending before it.
 * The after-school routine is event-based by default (no clock times: afternoons change with activities); she can turn
 * times on. Reordering keeps the times in order (times belong to the slots, the steps move between them).
 */
import { marchIconArt } from '../../../data/club/march-chore-icons';
import { activitiesOf, existingFor, wishedFor, type FamilyContext } from '../personalize/family';

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
  /** No clock time on the chart (event-based). */
  timeOff?: boolean;
  /** Trigger hidden on the chart (kept for later). */
  cueOff?: boolean;
  /** The children it's for (member ids); missing = every child. */
  who?: string[];
}
export interface Routine {
  steps: Step[];
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

export const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const hhmm = (m: number) => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
export const clock = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` : t;
};
/** '7:30 AM' → ['7:30', 'AM'] for the chart's time box. */
export const clockParts = (t: string): [string, string] => { const c = clock(t); const i = c.lastIndexOf(' '); return i > 0 ? [c.slice(0, i), c.slice(i + 1)] : [c, '']; };

export const DEFAULT_LEAVE = '07:50';
export const DEFAULT_AFTER = '15:30';

/**
 * The morning, from the out-the-door time: minutes before leaving for each step. The last step ends five minutes
 * before it, so "Out the door by" is always the latest time on the page.
 */
const MORNING = [
  { id: 'wake', label: 'Wake up & stretch', icon: 'wake', before: 45, cue: '' },
  { id: 'dress', label: 'Get dressed', icon: 'clothes', before: 35, cue: 'After I get up' },
  { id: 'eat', label: 'Eat breakfast', icon: 'breakfast', before: 30, cue: 'After I’m dressed' },
  { id: 'teeth', label: 'Brush teeth', icon: 'teeth', before: 15, cue: 'After breakfast' },
  { id: 'backpack', label: 'Grab backpack & lunch box', icon: 'bag', before: 10, cue: 'After brushing teeth' },
  { id: 'out', label: 'Shoes on & out the door', icon: 'shoes', before: 5, cue: '' },
] as const;
/** After school, by default event-based: the sample times show only if she turns them on. */
const AFTER = [
  { id: 'shoes', label: 'Shoes & coat away', icon: 'shoes', after: 0, cue: 'When I get home' },
  { id: 'unpack', label: 'Unpack backpack & lunch box', icon: 'bag', after: 5, cue: '' },
  { id: 'wash', label: 'Wash hands', icon: 'hands', after: 10, cue: 'After unpacking' },
  { id: 'snack', label: 'Have a snack', icon: 'snack', after: 15, cue: 'After washing hands' },
  { id: 'homework', label: 'Homework or reading', icon: 'book', after: 30, cue: 'After snack' },
  { id: 'free', label: 'Free play', icon: 'play', after: 60, cue: 'When homework is finished' },
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
    practice: [...named('sports'), ...named('clubs')].slice(0, 1),
    lessons: named('lessons').slice(0, 1),
  };
}

const step = (group: Group, id: string, label: string, icon: string, time: string, cue: string, extra: Partial<Step> = {}): Step =>
  ({ id, time, label, icon, group, cue, ...extra });
const lower = (t: string) => t.toLowerCase();

/**
 * The family's two routines for its school-aged children (`kids`), the morning timed back from `leave`. Worded for the
 * whole group (the youngest and oldest can both follow it), with a step only some children do added for them by name:
 * feeding the pet for whoever already does, packing a practice bag on practice days, practicing lessons. At most eight
 * steps a chart.
 */
export function preparedFamilyRoutine(kids: readonly ChildFacts[], leave: string = DEFAULT_LEAVE): Routine {
  const out = validTime(leave) ? minutes(leave) : minutes(DEFAULT_LEAVE);
  const morning: Step[] = MORNING.map((m) => step('morning', m.id, m.label, m.icon, hhmm(out - m.before), m.cue));
  const after: Step[] = AFTER.map((a) => step('after', a.id, a.label, a.icon, hhmm(minutes(DEFAULT_AFTER) + a.after), a.cue, { timeOff: true }));
  const m = (id: string) => morning.find((x) => x.id === id)!;
  const a = (id: string) => after.find((x) => x.id === id)!;
  const ages = kids.map((k) => k.age);
  // Only little ones: picture-book words, and free play follows their book (no homework to finish).
  if (ages.length && ages.every((x) => x <= 5)) { m('backpack').label = 'Get my school bag'; a('homework').label = 'Look at a book'; a('free').cue = 'After my book'; }
  if (ages.length && ages.every((x) => x >= 13)) { m('wake').label = 'Wake up to my alarm'; a('homework').label = 'Homework & study time'; a('free').label = 'Free time'; }
  const pets = kids.filter((k) => k.pets && k.age >= 4).map((k) => k.id);
  if (pets.length) {
    const t = m('teeth');
    morning.splice(morning.indexOf(t), 0, step('morning', 'pets', 'Feed the pets', 'pets', hhmm(minutes(t.time) - 5), 'After breakfast', { who: pets }));
  }
  for (const k of kids.filter((x) => x.lessons?.length && x.age >= 5).slice(0, 1)) {
    const f = a('free');
    after.splice(after.indexOf(f), 0, step('after', `practice-${k.id}`, `Practice ${lower(k.lessons![0])}`, 'book', hhmm(minutes(f.time) - 15), 'When homework is finished', { timeOff: true, who: [k.id] }));
  }
  for (const k of kids.filter((x) => x.practice?.length && x.age >= 6)) {
    const f = a('free');
    const name = lower(k.practice![0]);
    // Two children with the same practice share one row.
    const same = after.find((x) => x.id === `gear-${name}`);
    if (same) { same.who = [...(same.who ?? []), k.id]; continue; }
    if (after.length >= 8) break;
    after.splice(after.indexOf(f), 0, step('after', `gear-${name}`, `Pack my ${name} bag`, 'bag', hhmm(minutes(f.time) - 5), `On ${name} days`, { timeOff: true, who: [k.id] }));
  }
  return { steps: [...morning, ...after], mode: 'standard' };
}

/** One child's routines (the standalone member copy, and tests): the family routine for just them. */
export const preparedRoutine = (age: number, leave: string = DEFAULT_LEAVE, facts: Partial<ChildFacts> = {}): Routine =>
  preparedFamilyRoutine([{ id: facts.id ?? 'child', ...facts, age }], leave);

/** Steps she can add, a short list for each routine (each with a trigger she can change). */
export const CHOICES: Record<Group, readonly { id: string; label: string; icon: string; cue: string }[]> = {
  morning: [
    { id: 'lunch', label: 'Grab my lunch box', icon: 'lunch', cue: '' }, { id: 'pack-lunch', label: 'Pack my lunch', icon: 'lunch', cue: 'After breakfast' },
    { id: 'water', label: 'Fill my water bottle', icon: 'water', cue: '' }, { id: 'make-bed', label: 'Make my bed', icon: 'wake', cue: 'After I get dressed' },
    { id: 'read-early', label: 'Ready early? Read or draw', icon: 'book', cue: 'If there’s time left' },
  ],
  after: [
    { id: 'put-backpack', label: 'Put my backpack away', icon: 'bag', cue: '' }, { id: 'quiet', label: 'Quiet time', icon: 'quiet', cue: 'After snack' },
    { id: 'lunchbox', label: 'Empty my lunch box', icon: 'lunch', cue: '' }, { id: 'read', label: 'Read for 20 minutes', icon: 'book', cue: 'After homework' },
    { id: 'friends', label: 'Play outside or with friends', icon: 'friends', cue: 'When homework is finished' },
  ],
};

/** The trigger that prints for a step: hers, the prepared one, or none. */
export const cueOf = (s: Step) => (s.cueOff ? '' : (s.cue ?? LEGACY_CUES[s.id] ?? '').trim());

// ------------------------------------------------------------------ checks

const STOP = new Set(['when', 'after', 'before', 'i', 'im', 'i’m', "i'm", 'my', 'the', 'a', 'an', 'and', 'to', 'on', 'of', 'is', 'are', 'it', 'get', 'got', 'getting', 'go', 'do', '&', 'for', 'at', 'in', 'up', 'out', 'with', 'all', 'done', 'finished', 'ready']);
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '');
const words = (t: string) => t.toLowerCase().replace(/[’']/g, '').split(/[^a-z]+/).filter((w) => w && !STOP.has(w)).map(stem).filter((w) => w.length > 1);
const overlaps = (a: string, b: string) => { const x = new Set(words(b)); return words(a).some((w) => x.has(w)); };
/** Triggers that say nothing: there's no event in them. */
const VAGUE = /^(when|once)\s+(i[’']?m|i am|we[’']?re|we are)\s+ready$|^(now|later|soon|then|next|when it[’']?s time)$/i;

export interface StepIssue { stepId: string; kind: 'order' | 'deadline' | 'restates' | 'vague' | 'circular' | 'order-only' | 'missing'; text: string }

/**
 * What doesn't add up on a routine (shown in the editor, never silently changed): a time earlier than the step before
 * it, a morning time at or after the out-the-door time, and triggers that restate the step, say nothing, or point at a
 * step that comes later.
 */
export function stepIssues(r: Routine, group: Group, leave?: string): StepIssue[] {
  const list = r.steps.filter((x) => x.group === group && !x.removed && !(r.mode === 'simple' && x.id === SHORTER_HIDES[group]));
  const hidden = r.steps.filter((x) => x.group === group && !list.includes(x));
  const issues: StepIssue[] = [];
  let last: { label: string; time: string } | null = null;
  list.forEach((s, i) => {
    if (!s.timeOff && validTime(s.time)) {
      if (last && minutes(s.time) < minutes(last.time)) issues.push({ stepId: s.id, kind: 'order', text: `“${s.label}” at ${clock(s.time)} is earlier than “${last.label}” at ${clock(last.time)}.` });
      if (group === 'morning' && leave && validTime(leave) && minutes(s.time) >= minutes(leave)) issues.push({ stepId: s.id, kind: 'deadline', text: `“${s.label}” at ${clock(s.time)} isn’t before out the door at ${clock(leave)}.` });
      last = { label: s.label, time: s.time };
    }
    const cue = cueOf(s);
    if (!cue) return;
    const later = list.slice(i + 1);
    if (VAGUE.test(cue)) issues.push({ stepId: s.id, kind: 'vague', text: `“${cue}” doesn’t name an event. Try something that happens every day, like “After breakfast”, or leave it off.` });
    else if (/^before\b/i.test(cue) && later.length && overlaps(cue, later[0].label)) issues.push({ stepId: s.id, kind: 'order-only', text: `“${cue}” only repeats the order of the chart. Leave it off, or use the event that comes before.` });
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
