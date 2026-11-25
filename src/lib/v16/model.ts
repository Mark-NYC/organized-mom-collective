/**
 * V16 experiment (docs/ios/V16_EXPERIMENT.md): the preview's whole state and every rule it follows, as pure functions
 * so tests can pin them (tests/v16-model.test.ts). The UI (src/components/v16/) only renders this and dispatches.
 *
 * Nothing here is a second production store. It is an in-memory, single-device stand-in for the real ones, with the
 * same contracts, so the design can be judged before it is wired to them:
 *   parts + agreement state  → stands in for agreements (src/lib/agreements) and event responsibilities
 *                              (src/lib/calendar/event-tasks.ts)
 *   priorities               → src/lib/app/priorities.ts (3 shown, 5 max, never automatic)
 *   development records      → the REAL engine rules: applyDecision / availableDecisions (records.ts)
 *   cleaning checks          → the cleaning companion's one canonical check per task (src/lib/storage.ts keys)
 *   calendar                 → the REAL recurrence code (src/lib/calendar/recurrence.ts) over demo events
 *
 * State honesty (V16 contract §4, §11): suggested ≠ kept ≠ agreed. Only "We agree" makes an agreement; changing the
 * owner, the task, the finish line or the day of an agreement takes it back to "needs agreement". Skip never touches
 * the calendar event. Done exists only for trackable tasks, never for a standing agreement.
 */
import { addDays, occurrences, weekStart, weekday, type CalendarEvent, type Occurrence } from '../calendar/recurrence';
import { applyDecision, availableDecisions, type DevelopmentDecision, type DevelopmentRecord } from '../family-development/records';
import type { MawlStage } from '../family-development/framework';
import { MAX_PER_WEEK, SHOWN } from '../app/priorities';
import { ANA, LUIS, MATEO, SOFIA, demoEvents, type Adults, type Scenario } from './demo';

export { MAX_PER_WEEK, SHOWN };
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const STORAGE_KEY = 'omc:v16-preview:v1';

// ------------------------------------------------------------------ types

/** suggested: prepared or proposed, nobody agreed · kept: kept for discussion · agreed: the family said "We agree" · skipped. */
export type PartStatus = 'suggested' | 'kept' | 'agreed' | 'skipped';
/** prepared by the app from the calendar or the cleaning rhythm · idea: a family member's own words · month: the Club month. */
export type PartOrigin = 'prepared' | 'idea' | 'month';

export interface Part {
  id: string;
  origin: PartOrigin;
  title: string;
  ownerId: string | null;
  finishLine: string;
  /** Preparation for an event: the event's stable identity (external UID, or our own event id) and days before it. */
  eventLink?: string;
  offsetDays?: number;
  /** A standing weekly agreement: its weekday (0 = Sunday). */
  weekday?: number;
  /** Linked to the cleaning companion's canonical task (one shared check). */
  cleaningTask?: { zoneDay: 1 | 2 | 3 | 4; taskId: string };
  /** Why the app prepared it, in plain words ("Why this?"). */
  why?: string;
  /** Who suggested it, for an idea. */
  ideaBy?: string;
  /** A cue in words when there's no fixed day ("When I come in"), from the Club month. */
  cue?: string;
  /** Canonical skill (src/lib/family-development/skills.ts) for Let's Practice. */
  skill?: string;
  status: PartStatus;
  /** 'YYYY-MM-DD' the family agreed. */
  agreedOn?: string;
  /** The words agreed (owner/task/finish/day), so any change is detectable. */
  agreedSignature?: string;
  /** It was agreed once and then changed: needs agreeing again. */
  changedSinceAgreed?: boolean;
  /** Saved here but not yet shared with the other adult's phone (offline). */
  pending?: boolean;
  /** Trackable prep only: done for this week's occurrence. */
  done?: boolean;
}

export interface Priority { id: string; kind: 'event' | 'note'; eventLink?: string; text?: string; from: 'this-week' | 'last-meeting' }

export type MeetingStep = 0 | 1 | 2 | 3;
export type CleaningMode = 'printed' | 'one-day' | 'off';

export interface V16State {
  v: 1;
  scenario: Scenario;
  club: boolean;
  adults: Adults;
  online: boolean;
  /** Demo: what happened to this week's soccer practice in its source calendar. */
  soccer: 'as-planned' | 'moved' | 'cancelled';
  /** Ana's choice per calendar she connected: shared with the household or private. */
  feedVisibility: Record<string, 'household' | 'private'>;
  extraEvents: CalendarEvent[];
  priorities: Priority[];
  parts: Part[];
  records: DevelopmentRecord[];
  meeting: {
    step: MeetingStep;
    /** A meeting was opened and not finished (resumable, no penalty). */
    started: boolean;
    finishedOn?: string;
    checkInDone?: boolean;
    talkIndex: number;
  };
  practice: { memberId?: string; skill?: string; outcome?: string; nothing?: boolean };
  wall: { format: 'weekly' | 'monthly'; plan: 'together' | 'later' | 'other' | null };
  cleaning: {
    mode: CleaningMode;
    mainDay: number;
    dailyReset: boolean;
    /** monday → zone day → the weekday this week's session moved to. One week only. */
    moved: Record<string, Record<number, number>>;
    /** One check per canonical task: 'daily:DATE:id' or 'zone:MONDAY:zoneDay:id'. */
    checks: Record<string, true>;
  };
}

// ------------------------------------------------------------------ dates

export const mondayOf = (today: string) => weekStart(today, 1);
export const dateOfWeekday = (monday: string, wd: number) => addDays(monday, (wd + 6) % 7);
export const dayName = (date: string) => DAY_NAMES[weekday(date)];

// ------------------------------------------------------------------ parts

export const signature = (p: Pick<Part, 'ownerId' | 'title' | 'finishLine' | 'offsetDays' | 'weekday'>) =>
  JSON.stringify([p.ownerId, p.title.trim(), p.finishLine.trim(), p.offsetDays ?? null, p.weekday ?? null]);

/** The words a row shows for its state. Never "agreed" unless the family said so. */
export function statusLabel(p: Part): string {
  if (p.status === 'agreed') return p.pending ? 'Agreed · waiting to share' : 'Agreed';
  if (p.status === 'skipped') return 'Skipped';
  if (p.changedSinceAgreed) return 'Changed · agree again';
  if (p.status === 'kept') return 'Kept for discussion';
  return p.origin === 'idea' ? 'An idea · not agreed yet' : 'Suggested';
}

export type PartAction =
  | { type: 'keep'; id: string }
  | { type: 'agree'; id: string; today: string }
  | { type: 'skip'; id: string }
  | { type: 'unskip'; id: string }
  | { type: 'edit'; id: string; patch: Partial<Pick<Part, 'ownerId' | 'title' | 'finishLine' | 'offsetDays' | 'weekday'>> }
  | { type: 'toggle-done'; id: string };

export function partReducer(parts: Part[], a: PartAction, online: boolean): Part[] {
  return parts.map((p) => {
    if (p.id !== a.id) return p;
    switch (a.type) {
      case 'keep':
        return p.status === 'agreed' ? p : { ...p, status: 'kept' };
      case 'agree':
        if (!p.ownerId || !p.title.trim()) return p; // an agreement needs someone and something
        return { ...p, status: 'agreed', agreedOn: a.today, agreedSignature: signature(p), changedSinceAgreed: false, pending: !online };
      case 'skip':
        return { ...p, status: 'skipped' };
      case 'unskip':
        return { ...p, status: 'suggested' };
      case 'edit': {
        const next = { ...p, ...a.patch };
        const changed = Boolean(p.agreedSignature) && signature(next) !== p.agreedSignature;
        // Changing an agreement invalidates it: it is back to a proposal the family keeps discussing.
        if (p.status === 'agreed' && changed) return { ...next, status: 'kept', changedSinceAgreed: true, done: false };
        if (p.changedSinceAgreed && !changed) return { ...next, status: 'agreed', changedSinceAgreed: false };
        return next;
      }
      case 'toggle-done':
        // Only an agreed, trackable preparation has a done state.
        return p.status === 'agreed' && p.eventLink ? { ...p, done: !p.done } : p;
    }
  });
}

// ------------------------------------------------------------------ calendar

export const linkOf = (e: CalendarEvent) => e.external?.uid ?? e.id;
export const isReadOnly = (e: CalendarEvent) => Boolean(e.external);
/** Ana's phone: her own private calendars (marked), never anyone else's private ones. */
const visibleToMe = (e: CalendarEvent) => !e.external || e.external.mine || e.external.visibility === 'household';
export const isShared = (e: CalendarEvent) => !e.external || e.external.visibility === 'household';

/** The events as Ana's phone sees them this week, after her sharing choices and the source calendar's changes. */
export function eventsFor(s: V16State, monday: string): CalendarEvent[] {
  const thursday = addDays(monday, 3);
  const list = [...demoEvents(monday, s.scenario, s.adults), ...s.extraEvents].map((e) => {
    const v = e.external && s.feedVisibility[e.external.feed_id];
    let out = v && e.external ? { ...e, external: { ...e.external, visibility: v } } : e;
    if (out.id === 'e-soccer' && s.soccer !== 'as-planned') out = { ...out, skip_dates: [...(out.skip_dates ?? []), thursday] };
    return out;
  });
  if (s.soccer === 'moved') {
    const soccer = list.find((e) => e.id === 'e-soccer')!;
    // The source calendar moved this one occurrence: same UID and original instance, a new day.
    list.push({ ...soccer, id: 'e-soccer-moved', starts_on: addDays(monday, 4), recurrence: null, skip_dates: [],
      external: { ...soccer.external!, instance_key: thursday } });
  }
  return list.filter(visibleToMe);
}

export const weekOccurrences = (s: V16State, monday: string): Occurrence[] => occurrences(eventsFor(s, monday), monday, addDays(monday, 6));
/** What the family plans with together: shared calendars and the family's own events only. */
export const sharedOccurrences = (s: V16State, monday: string) => weekOccurrences(s, monday).filter((o) => isShared(o.event));

export const occurrenceOf = (s: V16State, monday: string, link: string) =>
  sharedOccurrences(s, monday).find((o) => linkOf(o.event) === link) ?? null;

/** Why a linked event isn't on the shared plan this week. */
export function missingReason(s: V16State, monday: string, link: string): 'cancelled' | 'private' | 'not-this-week' {
  const mine = weekOccurrences(s, monday).find((o) => linkOf(o.event) === link);
  if (mine && !isShared(mine.event)) return 'private';
  if (link === 'practice@riverside-fc' && s.soccer === 'cancelled') return 'cancelled';
  const any = demoEvents(monday, s.scenario, s.adults).find((e) => linkOf(e) === link);
  if (any?.external && (s.feedVisibility[any.external.feed_id] ?? any.external.visibility) === 'private') return 'private';
  return 'not-this-week';
}

/** An event's title by its link, even when it isn't on this week's shared plan. */
export const titleOf = (s: V16State, monday: string, link: string) =>
  [...demoEvents(monday, s.scenario, s.adults), ...s.extraEvents].find((e) => linkOf(e) === link)?.title ?? 'An activity';

/** The day a part happens this week: event prep follows its event (moved → follows; gone → null). */
export function partDate(s: V16State, monday: string, p: Part): string | null {
  if (p.eventLink) {
    const o = occurrenceOf(s, monday, p.eventLink);
    return o ? addDays(o.date, p.offsetDays ?? 0) : null;
  }
  if (p.weekday !== undefined) return dateOfWeekday(monday, p.weekday);
  return null;
}

/** "Thursday soccer practice", "Cleaning", "Family plan", "Mateo's idea". */
export function partContext(s: V16State, monday: string, p: Part, names: Record<string, string>): string {
  if (p.eventLink) {
    const o = occurrenceOf(s, monday, p.eventLink);
    return o ? `${dayName(o.date)} · ${o.event.title}` : 'Activity not on this week’s shared plan';
  }
  if (p.cleaningTask) return 'Cleaning';
  if (p.origin === 'idea') return `${names[p.ideaBy ?? ''] ?? 'Someone'}’s idea`;
  if (p.origin === 'month') return 'This month’s Club idea';
  return 'Family plan';
}

// ------------------------------------------------------------------ priorities (Our Focus)

export const priorityCount = (s: V16State) => s.priorities.filter((p) => p.from === 'this-week').length;

export function togglePriority(s: V16State, link: string): Priority[] {
  const thisWeek = s.priorities.filter((p) => p.from === 'this-week');
  if (thisWeek.some((p) => p.eventLink === link)) return s.priorities.filter((p) => !(p.from === 'this-week' && p.eventLink === link));
  if (thisWeek.length >= MAX_PER_WEEK) return s.priorities; // five at most, never more
  // Choosing this week's focus replaces last meeting's carried-over list.
  return [...thisWeek, { id: `pr-${link}`, kind: 'event', eventLink: link, from: 'this-week' }];
}

export function addNotePriority(s: V16State, text: string): Priority[] {
  const t = text.trim().slice(0, 120);
  const thisWeek = s.priorities.filter((p) => p.from === 'this-week');
  if (!t || thisWeek.length >= MAX_PER_WEEK) return s.priorities;
  return [...thisWeek, { id: `pr-note-${thisWeek.length}-${t.length}`, kind: 'note', text: t, from: 'this-week' }];
}

/** Today's "What matters": this week's choices, else what the family chose last time (labeled as such). */
export function currentPriorities(s: V16State): Priority[] {
  const thisWeek = s.priorities.filter((p) => p.from === 'this-week');
  return thisWeek.length ? thisWeek : s.priorities.filter((p) => p.from === 'last-meeting');
}

// ------------------------------------------------------------------ Let's Practice (MAWL stays invisible)

export interface PracticeQuestion {
  memberId: string;
  partId: string;
  skill: string;
  title: string;
  text: string;
  /** Each choice is one explicit family decision, validated by the real engine rule. */
  choices: { label: string; decision: DevelopmentDecision; stage?: MawlStage; primary?: boolean }[];
}

const recordFor = (s: V16State, memberId: string, skill: string) =>
  s.records.find((r) => r.memberId === memberId && r.skillId === skill && r.status !== 'dismissed') ?? null;

/** One natural question per child, only about a responsibility the family has AGREED to. Owned skills are not asked. */
export function practiceQuestions(s: V16State, names: Record<string, string>, kids: Set<string>): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  for (const p of s.parts) {
    if (p.status !== 'agreed' || !p.skill || !p.ownerId || !kids.has(p.ownerId)) continue;
    if (out.some((q) => q.memberId === p.ownerId)) continue; // one per child
    const name = names[p.ownerId];
    const r = recordFor(s, p.ownerId, p.skill);
    const t = `“${p.title}”`;
    if (!r) {
      out.push({ memberId: p.ownerId, partId: p.id, skill: p.skill, title: p.title, text: `How much help will ${name} need with ${t} at first?`, choices: [
        { label: `Show ${name} how first`, decision: 'start', stage: 'model' },
        { label: 'We’ll do it together', decision: 'start', stage: 'assist', primary: true },
        { label: `${name} can mostly do it`, decision: 'start', stage: 'watch' },
        { label: `${name} already owns it`, decision: 'start', stage: 'launch' },
      ] });
      continue;
    }
    if (r.status === 'launched' || r.stage === 'launch') continue; // theirs already: nobody asks permission again
    const can = availableDecisions(r);
    if (!can.includes('stay')) continue;
    const advance = can.includes('advance');
    const q = r.stage === 'model'
      ? { text: `Could ${name} do ${t} with you this week?`, yes: 'Let’s try', no: 'Keep showing' }
      : r.stage === 'assist'
        ? { text: `Could ${name} try ${t} without help?`, yes: 'Let’s try', no: 'Keep helping' }
        : { text: `Is ${t} ${name}’s now, start to finish?`, yes: 'Hand it over', no: 'Keep practicing' };
    out.push({ memberId: p.ownerId, partId: p.id, skill: p.skill, title: p.title, text: q.text, choices: [
      ...(advance ? [{ label: q.yes, decision: 'advance' as const }] : []),
      { label: q.no, decision: 'stay', primary: true },
    ] });
  }
  return out;
}

/** Records one family decision through the engine's own transition rule. Throws (DecisionError) on an invalid one. */
export function decide(s: V16State, q: PracticeQuestion, choice: PracticeQuestion['choices'][number], today: string): DevelopmentRecord[] {
  const current = recordFor(s, q.memberId, q.skill);
  const next = applyDecision(current, { decision: choice.decision, stage: choice.stage });
  const event = { decision: choice.decision, fromStage: current?.stage ?? null, toStage: next.stage, fromStatus: current?.status ?? null,
    toStatus: next.status, variationPracticed: false, decidedAt: `${today}T18:00:00Z` };
  if (!current) {
    return [...s.records, { id: `rec-${q.memberId}-${q.skill}`, memberId: q.memberId, skillId: q.skill, title: q.title, stage: next.stage, status: next.status,
      variationsPracticed: 0, category: 'other', agreementId: q.partId, agreementLive: true, libraryVersion: 1, revision: 1, lastCheckInOn: today, history: [event] }];
  }
  return s.records.map((r) => (r === current ? { ...r, ...next, lastCheckInOn: today, revision: r.revision + 1, history: [...r.history, event].slice(-12) } : r));
}

// ------------------------------------------------------------------ cleaning (one canonical check per task)

export const dailyKey = (date: string, id: string) => `daily:${date}:${id}`;
export const zoneKey = (monday: string, zoneDay: number, id: string) => `zone:${monday}:${zoneDay}:${id}`;

/** The weekday this week's session for a zone happens on. A move is for one week only. */
export function sessionDay(s: V16State, monday: string, zoneDay: number): number {
  if (s.cleaning.mode === 'one-day') return s.cleaning.mainDay;
  return s.cleaning.moved[monday]?.[zoneDay] ?? zoneDay;
}

/** Mon–Thu zone sessions happening on a weekday this week (by their usual zone day). */
export function sessionsOn(s: V16State, monday: string, wd: number): number[] {
  if (s.cleaning.mode === 'off') return [];
  return [1, 2, 3, 4].filter((z) => sessionDay(s, monday, z) === wd);
}

export function moveSession(s: V16State, monday: string, zoneDay: number, to: number | null): V16State['cleaning']['moved'] {
  const week = { ...(s.cleaning.moved[monday] ?? {}) };
  if (to === null || to === zoneDay) delete week[zoneDay]; else week[zoneDay] = to;
  return { ...s.cleaning.moved, [monday]: week };
}

// ------------------------------------------------------------------ seeds

const W = (monday: string, n: number) => addDays(monday, n);

export function seed(scenario: Scenario, opts: { club: boolean; adults: Adults; today: string }): V16State {
  const monday = mondayOf(opts.today);
  const adultOwner = opts.adults === 'two' ? LUIS : ANA;
  const soccerBag: Part = {
    id: 'p-soccer-bag', origin: 'prepared', title: 'Pack soccer bag', ownerId: SOFIA,
    finishLine: 'Cleats, shin guards, uniform and water bottle in the bag by the door', eventLink: 'practice@riverside-fc', offsetDays: -1,
    why: 'Soccer practice is Thursday at 4:00 PM, right after school. Packing the evening before keeps Thursday afternoon calm.',
    skill: 'school-day-prep', status: 'suggested',
  };
  const entry: Part = {
    id: 'p-entry', origin: 'prepared', title: 'Put shoes and bags away', ownerId: MATEO,
    finishLine: 'Shoes on the rack, bags on their hooks, walkway clear', weekday: 3, cleaningTask: { zoneDay: 3, taskId: 'wed-shoes' },
    why: 'Wednesday is Entry/Bathroom on the printed calendar, and this is one of its tasks.', skill: 'entryway', status: 'suggested',
  };
  const pickup: Part = {
    id: 'p-pickup', origin: 'prepared', title: opts.adults === 'two' ? 'Pick up Mateo and Elena during the conference' : 'Arrange pickup for Mateo and Elena',
    ownerId: adultOwner, finishLine: 'Pickup confirmed, with a time', eventLink: 'e-conf', offsetDays: 0,
    why: 'The parent-teacher conference is Monday at 3:15 PM, the same time as school pickup.', status: 'suggested',
  };
  const base: V16State = {
    v: 1, scenario, club: opts.club, adults: opts.adults, online: true, soccer: 'as-planned', feedVisibility: {}, extraEvents: [],
    priorities: [], parts: [soccerBag, entry, pickup], records: [],
    meeting: { step: 0, started: false, talkIndex: 0 }, practice: {}, wall: { format: 'weekly', plan: null },
    cleaning: { mode: 'printed', mainDay: 6, dailyReset: true, moved: {}, checks: {} },
  };
  if (scenario === 'first') return base;

  // Week four: three weeks ago the family agreed these. They stay in force; nobody re-confirms them.
  const agreedOn = W(monday, -20);
  const agreed = (p: Part): Part => ({ ...p, status: 'agreed', agreedOn, agreedSignature: signature(p) });
  const trash: Part = {
    id: 'p-trash', origin: 'prepared', title: 'Take out trash and recycling', ownerId: adultOwner, finishLine: 'Bins at the curb and new bags in',
    weekday: 2, status: 'suggested',
  };
  const lunch: Part = {
    id: 'p-lunch', origin: 'prepared', title: 'Pack lunch for the field trip', ownerId: SOFIA,
    finishLine: 'Lunch and water bottle packed in the backpack', eventLink: 'fieldtrip@lincoln', offsetDays: -1,
    why: 'The field trip on Friday runs from 8:30 AM to 2:00 PM, through lunch. Thursday evening is the last evening before.',
    skill: 'school-day-prep', status: 'suggested',
  };
  return {
    ...base,
    priorities: [{ id: 'pr-soccer', kind: 'event', eventLink: 'practice@riverside-fc', from: 'last-meeting' }],
    parts: [agreed(soccerBag), agreed(entry), agreed(trash), lunch],
    records: [
      // What the family decided before (engine records). Stages are internal; the screen never names them.
      { id: 'rec-mateo-entry', memberId: MATEO, skillId: 'entryway', title: 'Put shoes and bags away', stage: 'assist', status: 'active', cue: 'When arriving home',
        variationsPracticed: 0, category: 'belongings', agreementId: 'p-entry', agreementLive: true, libraryVersion: 1, revision: 3, lastCheckInOn: W(monday, -6),
        history: [] },
      { id: 'rec-sofia-prep', memberId: SOFIA, skillId: 'school-day-prep', title: 'Pack soccer bag', stage: 'launch', status: 'launched',
        variationsPracticed: 1, category: 'school', agreementId: 'p-soccer-bag', agreementLive: true, libraryVersion: 1, revision: 4, lastCheckInOn: W(monday, -6),
        history: [] },
    ],
    meeting: { step: 0, started: false, talkIndex: 0, finishedOn: W(monday, -1) },
  };
}

export { ANA, LUIS, MATEO, SOFIA };
