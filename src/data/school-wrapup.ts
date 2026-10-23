/**
 * The School Year Wrap-Up Builder's tasks and rules (src/components/site/WrapUpBuilder.astro and wrap-up-builder.ts
 * beside it). Not a school planner: a short list of what to finish before the last day and after it, with a suggested
 * day and a person for each, so closing out the year isn't one person's job to remember.
 *
 * Dates reuse August's countdown (src/lib/club/countdown.ts): whole calendar days, the device's own date, a suggestion
 * that's already gone moves to the days left instead of showing as overdue, and a last day a day or two away keeps
 * only the essentials. Every date is a suggestion, never a school deadline; a date she enters is hers and is never moved.
 *
 * The rules it keeps:
 * - Children close out their own year: each child gets their own belongings, papers and supplies, in words for their
 *   age; a young child does it with a grown-up, and anything needing a signature, a payment or a decision is a
 *   grown-up's.
 * - Family tasks happen once, not once per child (the calendar, forms, school messages, the celebration when the
 *   children finish the same day).
 * - Grown-up tasks go to whoever has least; the account holder (usually Mom) leans last. A teen or a child of 10 or
 *   more can take the calendar.
 * - Only what she chose: the six kinds of closeout work are all on to start, and any can be switched off.
 */
import { addDays, daysBetween, isDay, planCountdown, type CountdownItem, type Day } from '../lib/club/countdown';
import { ageOf, rankOf, type Helper } from '../lib/household-helpers';

export type Pick = 'returns' | 'forms' | 'events' | 'belongings' | 'papers' | 'supplies';
export type Phase = 'before' | 'after';
type Stage = 'young' | 'school' | 'teen';

export const pickOptions: { id: Pick; label: string }[] = [
  { id: 'returns', label: 'Library books or borrowed items' },
  { id: 'forms', label: 'School forms or paperwork' },
  { id: 'events', label: 'End-of-year activities' },
  { id: 'belongings', label: 'School belongings to bring home' },
  { id: 'papers', label: 'School papers and artwork' },
  { id: 'supplies', label: 'School supplies to sort' },
];
export const PICKS = pickOptions.map((p) => p.id);

/** A child's last day of school: the family's, their own, or not in school this year. */
export type LastDay = { kind: 'family' } | { kind: 'own'; date: Day | '' } | { kind: 'none' };

export interface Student {
  helper: Helper;
  /** Resolved: the date that applies to them, or '' until one's entered. */
  lastDay: Day | '';
}

export interface WrapTask {
  /** `${template}:${childId}`, `${template}:family` or `${template}:${date}` (the celebration); custom ids for hers. */
  key: string;
  template: string | null;
  title: string;
  phase: Phase;
  /** The children it's about (a family task: all of them). */
  children: string[];
  /** A helper's id, 'everyone', 'each' (each child listed does their own), or null ("Needs someone"). */
  owner: string | null;
  /** The suggested day, or null (no last day yet). */
  suggested: Day | null;
  /** Her own date: kept as she entered it, never moved. */
  date?: Day;
  /** With a grown-up nearby (a young child's task). */
  withGrownUp?: boolean;
  /** The suggestion was already gone and moved to a day from today. */
  moved?: boolean;
  done?: boolean;
  /** She chose the owner: re-planning keeps it. */
  pinned?: boolean;
}

interface Template {
  id: string;
  pick: Pick | 'always';
  phase: Phase;
  /** Days from the last day: negative before it, positive after. */
  offset: number;
  /** Still worth doing when the last day is a day or two away. */
  essential?: true;
  /** A family task (once), or each child's own. */
  scope: 'family' | 'child';
  /** A child's own task, in words for their age; null leaves it out for that age. Family tasks: `family`. */
  words?: Partial<Record<Stage, string | null>>;
  family?: string;
  /** Who may own a family task. */
  who?: 'adult' | 'adult-or-older' | 'everyone';
  /** A young child's version is done with a grown-up; 'adult' means a grown-up owns it for them. */
  young?: 'with-grown-up' | 'adult';
  /** Teens only. */
  teen?: true;
  weight: number;
}

/** August's suggested spacing, as the brief sets it: before the last day, then after. */
const templates: Template[] = [
  { id: 'calendar', pick: 'always', phase: 'before', offset: -14, scope: 'family', who: 'adult-or-older', weight: 2,
    family: 'Add the last school events, celebrations and early pickups to the wall calendar' },
  { id: 'returns', pick: 'returns', phase: 'before', offset: -10, essential: true, scope: 'child', young: 'adult', weight: 1,
    words: { young: 'Look for library books and anything borrowed in {name}’s backpack', school: 'Check your backpack and desk for library books and anything borrowed', teen: 'Return your library books and anything you borrowed' } },
  { id: 'forms', pick: 'forms', phase: 'before', offset: -7, essential: true, scope: 'family', who: 'adult', weight: 3,
    family: 'Finish the school forms, sign-offs and any payments' },
  { id: 'teen-forms', pick: 'forms', phase: 'before', offset: -8, scope: 'child', teen: true, weight: 1,
    words: { teen: 'Check for forms of your own; ask a grown-up to sign anything that needs it' } },
  { id: 'messages', pick: 'events', phase: 'before', offset: -5, scope: 'family', who: 'adult', weight: 2,
    family: 'Check school messages for final-day plans, early dismissal and pickup' },
  { id: 'teen-messages', pick: 'events', phase: 'before', offset: -5, scope: 'child', teen: true, weight: 1,
    words: { teen: 'Check your school messages for final-day plans and tell a grown-up what’s changing' } },
  { id: 'belongings', pick: 'belongings', phase: 'before', offset: -3, essential: true, scope: 'child', young: 'with-grown-up', weight: 1,
    words: { young: 'Bring home your things from your cubby', school: 'Bring home everything from your desk and cubby', teen: 'Clear out your locker and bring everything home' } },
  { id: 'celebrate', pick: 'always', phase: 'after', offset: 0, scope: 'family', who: 'everyone', weight: 0,
    family: 'Celebrate the year: everyone shares one thing they’re proud of' },
  { id: 'backpack', pick: 'belongings', phase: 'after', offset: 1, scope: 'child', young: 'with-grown-up', weight: 1,
    words: { young: 'Empty your backpack', school: 'Empty your backpack and wash out your lunchbox', teen: 'Empty and clean your backpack and lunchbox' } },
  { id: 'papers', pick: 'papers', phase: 'after', offset: 3, scope: 'child', young: 'with-grown-up', weight: 1,
    words: { young: 'Choose your five favorite pictures to keep', school: 'Sort your school papers: keep five favorites, recycle the rest', teen: 'Sort your papers: keep what you need and a few favorites' } },
  { id: 'supplies', pick: 'supplies', phase: 'after', offset: 5, scope: 'child', young: 'with-grown-up', weight: 1,
    words: { young: 'Help put the crayons and supplies away for next year', school: 'Sort your school supplies: keep what still works for next year', teen: 'Set aside the supplies you’ll use again next year' } },
];
export const templateById = (id: string) => templates.find((t) => t.id === id);

/** Children who go to school: three and up (preschool counts), never grown-ups. */
export const isStudentAge = (h: Helper) => h.group !== 'adult' && (ageOf(h) ?? 0) >= 3;
const stageOf = (h: Helper): Stage => (h.group === 'teen' ? 'teen' : h.group === 'school' ? 'school' : 'young');

/** What she'd see for the last day: the family date, the child's own, or not in school. */
export function resolveLastDay(family: Day | '', own: LastDay | undefined): Day | '' | null {
  if (!own || own.kind === 'family') return isDay(family) ? family : '';
  if (own.kind === 'none') return null;
  return isDay(own.date) ? own.date : '';
}

export type Timing = 'undated' | 'ahead' | 'tight' | 'last-minute' | 'today' | 'over';

/** How close a last day is, in August's terms. */
export function timingFor(lastDay: Day | '', today: Day): Timing {
  if (!lastDay) return 'undated';
  const plan = planCountdown([{ text: '', daysBefore: 14 }], lastDay, today);
  return plan.status === 'started' ? 'over' : plan.status === 'undated' ? 'undated' : plan.status;
}

const fill = (s: string, name: string) => s.replace('{name}', name);

/**
 * The plan's tasks for these children and picks, as seen on `today`, with suggested days and no owners yet.
 * Before the last day: August's countdown places each child's tasks (a gone suggestion moves to the days left; a day
 * or two out keeps only the essentials, with bringing things home and returns combined). Once the last day has passed,
 * the before tasks drop and the after tasks start from today, a couple a day.
 */
export function wrapTasksFor(students: readonly Student[], picks: readonly Pick[], today: Day): WrapTask[] {
  const on = (t: Template) => t.pick === 'always' || picks.includes(t.pick);
  const dated = students.filter((s) => s.lastDay);
  const out: WrapTask[] = [];
  // Family before-tasks count back from the first last day still to come (or the first one, before any are dated).
  const upcoming = dated.filter((s) => daysBetween(today, s.lastDay as Day) >= 0).map((s) => s.lastDay as Day).sort();
  // None dated yet: undated tasks; every last day passed: no family before-tasks.
  const familyBasis: Day | '' | null = upcoming[0] ?? (dated.length ? null : '');

  /** Before-tasks as August's countdown would date them for one last day. */
  const placeBefore = (items: { t: Template; task: WrapTask }[], lastDay: Day | '') => {
    if (!items.length) return [];
    if (!lastDay) return items.map((x) => x.task);
    const timing = timingFor(lastDay, today);
    if (timing === 'over') return [];
    if (timing === 'today') return items.filter((x) => x.t.essential).map((x) => ({ ...x.task, suggested: today }));
    const plan = planCountdown(items.map((x): CountdownItem => ({ text: x.task.key, daysBefore: -x.t.offset, ...(x.t.essential ? { essential: true as const } : {}) })), lastDay, today);
    return items.flatMap((x, i) => {
      const l = plan.lines[i];
      if (l.later) return [];
      return [{ ...x.task, suggested: l.suggested, ...(l.moved ? { moved: true } : {}) }];
    });
  };

  // Family tasks.
  const familyBefore = templates.filter((t) => t.scope === 'family' && t.phase === 'before' && on(t));
  if (students.length && familyBasis !== null) {
    out.push(...placeBefore(familyBefore.map((t) => ({ t, task: { key: `${t.id}:family`, template: t.id, title: t.family!, phase: t.phase, children: students.map((s) => s.helper.id), owner: null, suggested: null } })), familyBasis));
  }

  // Each child's own.
  for (const s of students) {
    const h = s.helper;
    const stage = stageOf(h);
    const mine = templates.filter((t) => t.scope === 'child' && on(t) && (!t.teen || stage === 'teen') && t.words?.[stage]);
    const task = (t: Template): WrapTask => ({
      key: `${t.id}:${h.id}`, template: t.id, title: fill(t.words![stage]!, h.name), phase: t.phase, children: [h.id], owner: null, suggested: null,
      ...(stage === 'young' && t.young === 'with-grown-up' ? { withGrownUp: true } : {}),
    });
    let before = mine.filter((t) => t.phase === 'before').map((t) => ({ t, task: task(t) }));
    // A few days out: bringing things home and returning what's borrowed become one trip.
    const left = s.lastDay ? daysBetween(today, s.lastDay) : null;
    const ret = before.find((x) => x.t.id === 'returns');
    const bring = before.find((x) => x.t.id === 'belongings');
    if (left !== null && left >= 0 && left <= 4 && ret && bring && stage !== 'young') {
      bring.task.title = stage === 'teen' ? 'Clear out your locker, bring everything home and return what you borrowed' : 'Bring home everything from your desk and return library books';
      before = before.filter((x) => x !== ret);
    }
    out.push(...placeBefore(before, s.lastDay));
    out.push(...mine.filter((t) => t.phase === 'after').map((t) => ({ ...task(t), suggested: s.lastDay ? addDays(s.lastDay, t.offset) : null })));
  }

  // The celebration: once per last day the children share.
  const groups = [...new Set(students.map((s) => s.lastDay))];
  for (const d of groups) {
    const kids = students.filter((s) => s.lastDay === d).map((s) => s.helper.id);
    const t = templateById('celebrate')!;
    const names = list(students.filter((s) => kids.includes(s.helper.id)).map((s) => s.helper.name));
    out.push({ key: `celebrate:${d || 'undated'}`, template: 'celebrate', title: groups.length > 1 ? `Celebrate ${names}’s year: everyone shares one thing they’re proud of` : t.family!, phase: 'after', children: kids, owner: 'everyone', suggested: d || null });
  }

  return mergeSiblings(spreadAfter(out, today));
}

/**
 * Children doing the same thing on the same day share one line ("Sofia and Mateo, each their own") instead of one
 * line each. A young child's task done by a grown-up stays separate: it names the child.
 */
function mergeSiblings(tasks: WrapTask[]): WrapTask[] {
  const out: WrapTask[] = [];
  const seen = new Map<string, WrapTask>();
  for (const x of tasks) {
    const t = x.template ? templateById(x.template) : undefined;
    if (t?.scope !== 'child' || x.title.includes('’s backpack')) { out.push(x); continue; }
    const id = `${x.template}|${x.title}|${x.suggested}|${Boolean(x.withGrownUp)}`;
    const into = seen.get(id);
    if (into) {
      into.children = [...into.children, ...x.children];
      into.key = `${x.template}:${into.children.join('+')}`;
      if (x.moved) into.moved = true;
    } else {
      const copy = { ...x };
      seen.set(id, copy);
      out.push(copy);
    }
  }
  return out;
}

/** After-tasks whose day has already gone start from today, at most two a day per child, in order. */
function spreadAfter(tasks: WrapTask[], today: Day): WrapTask[] {
  const load = new Map<string, number>();
  const ordered = tasks.filter((x) => x.phase === 'after' && x.suggested).sort((a, b) => daysBetween(b.suggested!, a.suggested!));
  for (const x of ordered) {
    if (daysBetween(today, x.suggested!) >= 0) continue;
    let d = today;
    while ((load.get(`${x.children.join()}|${d}`) ?? 0) >= 2) d = addDays(d, 1);
    load.set(`${x.children.join()}|${d}`, (load.get(`${x.children.join()}|${d}`) ?? 0) + 1);
    x.suggested = d;
    x.moved = true;
  }
  return tasks;
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Why someone can't own a task (or null). */
export function cannotOwn(x: WrapTask, h: Helper): string | null {
  const t = x.template ? templateById(x.template) : undefined;
  if (!t) return null;
  if (t.scope === 'family') {
    if (t.who === 'adult' && h.group !== 'adult') return 'needs a grown-up';
    if (t.who === 'adult-or-older' && h.group !== 'adult' && h.group !== 'teen' && (ageOf(h) ?? 0) < 10) return 'from age 10';
    return null;
  }
  // A child's own task belongs to that child, or a grown-up helping them.
  if (h.group === 'adult') return null;
  if (!x.children.includes(h.id)) return 'another child’s';
  if (x.children.length > 1) return 'shared: choose “Each their own”';
  if (t.young === 'adult' && h.group === 'young') return 'a grown-up does this one';
  return null;
}

/** How much a person can comfortably take on, by group (as the meal planner weighs it). */
const SHARE: Record<Helper['group'], number> = { adult: 10, teen: 7, school: 5, young: 3 };
const HOLDER_LEAN = 0.08;

/**
 * Owners: pinned owners stay; a child's own task is theirs (a young child's returns go to a grown-up); family tasks
 * go to whoever can and has least, the account holder leaning last. Returns new objects.
 */
export function assignWrapTasks(tasks: readonly WrapTask[], helpers: readonly Helper[]): WrapTask[] {
  const out = tasks.map((x) => ({ ...x }));
  const load = new Map(helpers.map((h) => [h.id, 0]));
  const weight = (x: WrapTask) => (x.template ? templateById(x.template)?.weight ?? 1 : 1);
  const add = (id: string | null, x: WrapTask) => { if (id && load.has(id)) load.set(id, load.get(id)! + weight(x)); };
  for (const x of out) {
    if (x.template === 'celebrate') { x.owner = 'everyone'; continue; }
    if (x.pinned && x.owner && (x.owner === 'everyone' || x.owner === 'each' || load.has(x.owner))) { add(x.owner, x); continue; }
    x.pinned = false;
    const t = x.template ? templateById(x.template) : undefined;
    if (t?.scope === 'child' && x.children.length > 1) { x.owner = 'each'; for (const c of x.children) add(c, x); continue; }
    if (t?.scope === 'child' && t.young !== 'adult' && helpers.some((h) => h.id === x.children[0])) { x.owner = x.children[0]; add(x.owner, x); continue; }
    if (t?.scope === 'child' && t.young === 'adult') {
      const child = helpers.find((h) => h.id === x.children[0]);
      if (child && child.group !== 'young') { x.owner = child.id; add(x.owner, x); continue; }
    }
    x.owner = null;
  }
  const share = (h: Helper) => load.get(h.id)! / SHARE[h.group] + (h.holder ? HOLDER_LEAN : 0);
  const open = out.filter((x) => x.owner === null && !x.pinned && x.template !== 'celebrate')
    .sort((a, b) => helpers.filter((h) => !cannotOwn(a, h)).length - helpers.filter((h) => !cannotOwn(b, h)).length);
  for (const x of open) {
    // Prefer a grown-up for a young child's task; family tasks go to whoever has least.
    const able = helpers.filter((h) => !cannotOwn(x, h) && (x.template ? templateById(x.template)?.scope === 'family' || h.group === 'adult' : true));
    const who = able.sort((a, b) => share(a) - share(b) || rankOf(b) - rankOf(a))[0];
    x.owner = who?.id ?? null;
    add(x.owner, x);
  }
  return out;
}

/** The day that shows: hers, else the suggestion. */
export const shownDate = (x: WrapTask): Day | null => x.date ?? x.suggested;

/** Tasks in plan order: before the last day, then after; by day; family tasks first on a day. */
export function sortWrap(tasks: readonly WrapTask[]): WrapTask[] {
  const rank = (x: WrapTask) => (x.phase === 'before' ? 0 : 1);
  return [...tasks].sort((a, b) => rank(a) - rank(b)
    || (shownDate(a) && shownDate(b) ? daysBetween(shownDate(b)!, shownDate(a)!) : shownDate(a) ? -1 : shownDate(b) ? 1 : 0)
    || (b.children.length - a.children.length));
}
