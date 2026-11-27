/**
 * V21 Today (docs/ios/V21_PREVIEW.md): one shared household plan, a personal view for each adult, in three layers:
 *
 *   What matters   decisions, requests, conflicts and changes that need THIS adult, plus a confirmation when someone took
 *                  something they were carrying. Quiet when nothing does: nothing is manufactured to fill it.
 *   Today's plan   the agreed responsibilities and checklist items due today, with owners and completion (mine first,
 *                  the whole family's one tap away). A quiet What matters never means an empty Today.
 *   Everyone's part  standing agreements and habits (Andrew's floor): always reachable, never a daily task for a parent.
 *
 * Our week is awareness only: a calendar event never creates an obligation. It offers an optional "Plan something"
 * and shows what the family chose. The widget state (widgetFor) is the single most relevant item for one adult, from
 * the same model, for a future native Home Screen widget to read.
 */
import { addDays, daysBetween, occurrences, timeLabel, type Occurrence } from '../calendar/recurrence';
import {
  DAY_NAMES, agreedParts, currentPriorities, dayName, eventsFor, isShared, linkOf, mondayOf, partDate, sharedOccurrences, type Part, type V16State,
} from '../v16/model';
import type { TodayInput } from '../v18/engine';
import { cueTime } from '../v19/engine';
import {
  decisionsOf, intelOf, intentKey, takeId, isDone, preferenceFor, requestsOf, rhythmOf, seen, t12, doneKey,
  type Decision, type HandRequest, type Intent,
} from './model';

export type MatterKind = 'request-in' | 'conflict' | 'needs-owner' | 'declined' | 'changed' | 'accepted' | 'waiting' | 'focus' | 'practice';

export interface Matter {
  key: string;
  kind: MatterKind;
  title: string;
  /** "Friday · 2:30 PM · From Meg". */
  meta: string;
  /** Text the icon is chosen from (src/components/v20/Badge.tsx badgeFor). */
  icon: string;
  /** Counts toward "needs your attention" (a confirmation or a waiting request doesn't). */
  attention: boolean;
  weight: number;
  date?: string | null;
  time?: string | null;
  request?: HandRequest;
  part?: Part;
  decision?: Decision;
  /** Conflict: what it overlaps. */
  overlaps?: string;
  /** Short name for headlines: "Friday pickup". */
  label?: string;
}

export interface PlanItem { part: Part; date: string; time: string | null; done: boolean; mine: boolean; dueTonight?: boolean; covering?: string; cleaningKey?: string }

export interface WeekItem { occ: Occurrence; link: string; intent: Intent | null; plannedPart: Part | null; preference: Decision | null; today: boolean }

export interface TodayV21 {
  viewer: string;
  headline: string;
  sub: string | null;
  matters: Matter[];
  plan: PlanItem[];
  week: WeekItem[];
  routines: Part[];
  weekly: Part[];
  /** Nothing needs this adult. */
  quiet: boolean;
  firstTime: boolean;
}

const WINDOW_DAYS = 2;
const NUM = ['', 'One thing needs', 'Two things need', 'Three things need', 'Four things need'];

const when = (date: string | null, time: string | null, today: string) =>
  [date ? (date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : dayName(date)) : null, time ? t12(time) : null].filter(Boolean).join(' · ');
const whenDay = (date: string | null, time: string | null) => [date ? dayName(date) : null, time ? t12(time) : null].filter(Boolean).join(' · ');
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/** A part's time today: its cue ("At 2:30 PM"), else its event's start. */
function partTime(s: V16State, monday: string, p: Part): string | null {
  const c = cueTime(p.cue);
  if (c) return c;
  if (p.eventLink) return sharedOccurrences(s, monday).find((o) => linkOf(o.event) === p.eventLink)?.event.start_time ?? null;
  return null;
}

/** Occurrences from today over the next days, across week boundaries (the shared calendar only). */
export function ahead(s: V16State, today: string, days: number): Occurrence[] {
  return occurrences(eventsFor(s, mondayOf(today)).filter(isShared), today, addDays(today, days));
}

// ------------------------------------------------------------------ today's plan

export function planFor(s: V16State, _monday: string, date: string, viewer: string): PlanItem[] {
  const monday = mondayOf(date);
  const intel = intelOf(s);
  const covers = intel.covers ?? {};
  const out: PlanItem[] = [];
  for (const p of agreedParts(s)) {
    const r = rhythmOf(p);
    if (r === 'routine') continue; // habits live in Everyone's part
    const d = partDate(s, monday, p);
    if (d !== date) continue;
    if (r === 'weekly' && covers[doneKey(p.id, date)]) continue; // someone else has it this time
    const cleaningKey = p.cleaningTask ? `zone:${monday}:${p.cleaningTask.zoneDay}:${p.cleaningTask.taskId}` : undefined;
    const done = cleaningKey ? Boolean(s.cleaning.checks[cleaningKey]) : isDone(s, p, date);
    const time = partTime(s, monday, p);
    const coveringFor = Object.entries(covers).find(([, id]) => id === p.id)?.[0].split('@')[0];
    const covered = coveringFor ? s.parts.find((x) => x.id === coveringFor) : undefined;
    out.push({ part: p, date, time, done, mine: p.ownerId === viewer, cleaningKey,
      dueTonight: r === 'weekly' && Boolean(time && toMin(time) >= 17 * 60),
      covering: covered?.ownerId ?? undefined });
  }
  return out.sort((a, b) => Number(b.mine) - Number(a.mine) || (a.time ?? '99').localeCompare(b.time ?? '99') || a.part.title.localeCompare(b.part.title));
}

// ------------------------------------------------------------------ what matters, for one adult

function eachTimeNeeds(inp: TodayInput, viewer: string, adults: string[], names: Record<string, string>): Matter[] {
  const { s, today } = inp;
  const out: Matter[] = [];
  for (const d of decisionsOf(s).filter((x) => x.kind === 'each-time' && x.eventLink)) {
    for (const o of ahead(s, today, WINDOW_DAYS - 1).filter((x) => linkOf(x.event) === d.eventLink)) {
      const owned = agreedParts(s).some((p) => p.eventLink === d.eventLink && p.ownerId && partDate(s, inp.monday, p) === o.date)
        || agreedParts(s).some((p) => p.onDate === o.date && p.title === d.title && p.ownerId);
      if (owned) continue;
      const open = requestsOf(s).find((r) => r.subject.kind === 'event' && r.subject.link === d.eventLink && r.subject.date === o.date && r.status === 'asked');
      if (open) continue; // the request carries it (request-in for one adult, waiting for the other)
      const declined = requestsOf(s).filter((r) => r.subject.kind === 'event' && r.subject.link === d.eventLink && r.subject.date === o.date && r.status === 'declined');
      // The adult who declined isn't asked again on Today; the one who asked sees "declined" until they've seen it,
      // then the need itself again, unless they left it for the Family Meeting.
      if (declined.some((r) => r.to === viewer || (r.from === viewer && (!r.acked || r.meeting)))) continue;
      if (!adults.includes(viewer)) continue;
      const label = `${dayName(o.date)} ${d.label ?? 'plan'}`;
      if (seen(s, viewer, `owner:${d.id}@${o.date}`)) continue; // chosen to decide at the meeting
      out.push({ key: `owner:${d.id}@${o.date}`, kind: 'needs-owner', title: d.text.endsWith('?') ? d.text : `Who’s ${lowerFirst(d.title ?? d.text).replace(/^pick/, 'picking').replace(/^drive/, 'driving').replace(/^take/, 'taking')}?`,
        meta: `${o.event.start_time ? t12(o.event.start_time) : dayName(o.date)} · Needs an owner`, icon: d.title ?? d.text, attention: true,
        weight: o.date === today ? 92 : 80, date: o.date, time: o.event.start_time ?? null, decision: { ...d, label } });
      void names;
    }
  }
  return out;
}

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/**
 * A concrete scheduling conflict: an agreed responsibility with a time, and its owner on a shared event that overlaps it
 * the same day. Shown to the owner (it's theirs to sort out); to every adult when the owner is a child.
 */
function conflicts(inp: TodayInput, viewer: string, adults: string[], names: Record<string, string>): Matter[] {
  const { s, today, monday } = inp;
  const out: Matter[] = [];
  const occ = ahead(s, today, WINDOW_DAYS - 1);
  for (const date of [today, addDays(today, 1)]) {
    for (const it of planFor(s, monday, date, viewer)) {
      const p = it.part;
      if (!it.time || !p.ownerId || it.done) continue;
      const t = toMin(it.time);
      const clash = occ.find((o) => o.date === date && o.event.start_time && o.event.member_ids.includes(p.ownerId!) && linkOf(o.event) !== p.eventLink
        && toMin(o.event.start_time) <= t && toMin(o.event.end_time ?? o.event.start_time) > t - 15);
      if (!clash) continue;
      const forViewer = p.ownerId === viewer || (!adults.includes(p.ownerId) && adults.includes(viewer));
      if (!forViewer) continue;
      const k = `conflict:${p.id}@${date}:${linkOf(clash.event)}`;
      if (seen(s, viewer, k)) continue;
      const open = requestsOf(s).some((r) => r.status === 'asked' && ((r.subject.kind === 'occurrence' && r.subject.partId === p.id && r.subject.date === date) || (r.subject.kind === 'part' && r.subject.partId === p.id)));
      if (open) continue;
      out.push({ key: k, kind: 'conflict', title: `${p.ownerId === viewer ? 'Your' : `${names[p.ownerId]}’s`} ${lowerFirst(clash.event.title)} overlaps “${p.title}”.`,
        meta: `${when(date, it.time, today)} · ${clash.event.title} ${timeLabel(clash.event)}`, icon: p.title, attention: true, weight: date === today ? 95 : 88,
        date, time: it.time, part: p, overlaps: clash.event.title });
    }
  }
  return out;
}

/** "Friday pickup" for a request about an each-time event, else its own words. */
function labelOf(s: V16State, r: HandRequest): string {
  if (r.subject.kind === 'event') {
    const sub = r.subject;
    const d = decisionsOf(s).find((x) => x.eventLink === sub.link && x.label);
    if (d) return `${dayName(sub.date)} ${d.label}`;
  }
  return r.title;
}

function requestMatters(inp: TodayInput, viewer: string, names: Record<string, string>): Matter[] {
  const { s, today } = inp;
  const out: Matter[] = [];
  for (const r of requestsOf(s)) {
    if (r.date && r.date < today && r.status !== 'asked') continue; // past and answered: history, not priorities
    const at = whenDay(r.date, r.time);
    if (r.status === 'asked' && r.to === viewer) {
      out.push({ key: `req:${r.id}`, kind: 'request-in', title: r.ask, meta: [at, `From ${names[r.from] ?? 'someone'}`].filter(Boolean).join(' · '), icon: r.title, attention: true,
        weight: 100 - out.filter((m) => m.kind === 'request-in').length, date: r.date, time: r.time, request: r });
    } else if (r.status === 'asked' && r.from === viewer) {
      out.push({ key: `req:${r.id}`, kind: 'waiting', title: `Waiting for ${names[r.to] ?? 'an answer'}`, meta: [r.title, at].filter(Boolean).join(' · '), icon: r.title, attention: false, weight: 20, date: r.date, time: r.time, request: r });
    } else if (r.status === 'declined' && r.from === viewer && !r.acked) {
      const stillMine = (r.subject.kind === 'occurrence' || r.subject.kind === 'part') && r.prevOwner === viewer;
      out.push({ key: `req:${r.id}`, kind: 'declined', title: `${names[r.to] ?? 'They'} can’t ${lowerFirst(r.title)}.`, meta: stillMine ? `${at ? `${at} · ` : ''}It’s still yours` : `${at ? `${at} · ` : ''}Still needs a plan`,
        icon: r.title, attention: !stillMine, weight: stillMine ? 55 : 85, date: r.date, time: r.time, request: r, label: labelOf(s, r) });
    } else if (r.status === 'accepted' && r.from === viewer && !r.acked) {
      out.push({ key: `req:${r.id}`, kind: 'accepted', title: `${names[r.to] ?? 'Someone'} has it`, meta: [r.title, at].filter(Boolean).join(' · '), icon: r.title, attention: false, weight: 50, date: r.date, time: r.time, request: r });
    }
  }
  return out;
}

/** A shared agreement someone else changed that affects this adult (theirs, or they used to hold it). */
function changedAgreements(inp: TodayInput, viewer: string, names: Record<string, string>): Matter[] {
  const { s, today } = inp;
  const acceptedParts = new Set(requestsOf(s).map((r) => r.partId).filter(Boolean));
  return agreedParts(s).filter((p) => p.lastChangedBy && p.lastChangedBy !== viewer && p.lastChangedOn && daysBetween(p.lastChangedOn, today) <= 2
    && p.ownerId === viewer && !acceptedParts.has(p.id) && !p.onDate && !seen(s, viewer, `changed:${p.id}:${p.agreedSignature}`))
    .map((p) => ({ key: `changed:${p.id}:${p.agreedSignature}`, kind: 'changed' as const, title: `${names[p.lastChangedBy!] ?? 'Someone'} updated ${lowerFirst(p.title)}`,
      meta: [p.weekday !== undefined ? `Every ${DAY_NAMES[p.weekday]}` : null, p.cue, p.finishLine ? `Done when: ${p.finishLine}` : null].filter(Boolean).join(' · '),
      icon: p.title, attention: true, weight: 60, part: p }));
}

function focusMatters(inp: TodayInput, viewer: string, names: Record<string, string>): Matter[] {
  const { s } = inp;
  const out: Matter[] = [];
  for (const pr of currentPriorities(s)) {
    const from = pr.from === 'last-meeting' ? 'Our focus from last time' : 'Our focus this week';
    if (pr.kind === 'note' && pr.text) out.push({ key: `focus:${pr.id}`, kind: 'focus', title: pr.text, meta: from, icon: pr.text, attention: false, weight: 10 });
    if (pr.kind === 'event' && pr.eventLink) {
      // An activity the family chose to focus on together stays visible on Today (V20's What matters), as awareness.
      const o = ahead(s, inp.today, 6).find((x) => linkOf(x.event) === pr.eventLink);
      if (o) out.push({ key: `focus:${pr.id}`, kind: 'focus', title: o.event.title, meta: `${from} · ${o.date === inp.today ? 'Today' : dayName(o.date)} · ${timeLabel(o.event)}`, icon: o.event.title, attention: false, weight: 11, date: o.date });
    }
  }
  // A habit the family chose to practice: shown as encouragement, never as a check a parent must police.
  const pr = s.practice;
  if (pr.memberId && pr.skill && !pr.nothing) {
    const p = agreedParts(s).find((x) => x.ownerId === pr.memberId && x.skill === pr.skill);
    if (p) out.push({ key: `practice:${p.id}`, kind: 'practice', title: `${names[p.ownerId!]} is practicing: ${lowerFirst(p.title)}`, meta: p.cue ?? 'This week', icon: p.title, attention: false, weight: 9, part: p });
  }
  void viewer;
  return out;
}

// ------------------------------------------------------------------ the model

export function buildTodayV21(inp: TodayInput): TodayV21 {
  const { s, monday, today, people } = inp;
  const viewer = intelOf(s).viewer;
  const names = Object.fromEntries(people.map((p) => [p.id, p.firstName]));
  const adults = people.filter((p) => p.kind === 'adult').map((p) => p.id);
  const matters = [...requestMatters(inp, viewer, names), ...conflicts(inp, viewer, adults, names), ...eachTimeNeeds(inp, viewer, adults, names),
    ...changedAgreements(inp, viewer, names), ...focusMatters(inp, viewer, names)].sort((a, b) => b.weight - a.weight);
  const plan = planFor(s, monday, today, viewer);
  const planned = new Set(matters.map((m) => m.request?.subject.kind === 'event' ? m.request.subject.link : m.decision?.eventLink).filter(Boolean));
  const week: WeekItem[] = ahead(s, today, 6).filter((o) => !/^(school|family meeting)$/i.test(o.event.title))
    .filter((o) => !(planned.has(linkOf(o.event)) && o.date <= addDays(today, 1)))
    .map((o) => {
      const link = linkOf(o.event);
      const intent = intelOf(s).intents?.[intentKey(link, o.date)] ?? null;
      const plannedPart = intent?.partId ? s.parts.find((p) => p.id === intent.partId) ?? null : agreedParts(s).find((p) => p.eventLink === link && partDate(s, mondayOf(o.date), p) === o.date) ?? null;
      return { occ: o, link, intent, plannedPart, preference: preferenceFor(s, link, o.event.title), today: o.date === today };
    });
  // Standing = everything agreed that isn't for one date: habits, weekly responsibilities, preparation that recurs with its event.
  const standing = agreedParts(s).filter((p) => !p.onDate);
  const routines = standing.filter((p) => rhythmOf(p) === 'routine');
  const weekly = standing.filter((p) => rhythmOf(p) !== 'routine');
  const attention = matters.filter((m) => m.attention);
  const firstTime = !agreedParts(s).length && !s.meeting.finishedOn;
  const { headline, sub } = headlineFor(matters, attention, plan, names, viewer, firstTime);
  return { viewer, headline, sub, matters, plan, week, routines, weekly, quiet: !attention.length, firstTime };
}

function headlineFor(matters: Matter[], attention: Matter[], plan: PlanItem[], names: Record<string, string>, viewer: string, firstTime: boolean): { headline: string; sub: string | null } {
  const sub = attention.length ? `${NUM[Math.min(attention.length, 4)]} your attention.` : null;
  const top = attention[0];
  const ins = attention.filter((m) => m.kind === 'request-in');
  if (top?.kind === 'request-in') {
    const from = [...new Set(ins.map((m) => m.request!.from))];
    return { headline: from.length === 1 ? `${names[from[0]] ?? 'Someone'} needs a hand.` : 'A few people need a hand.', sub };
  }
  if (top?.kind === 'conflict') return { headline: 'Something overlaps.', sub };
  if (top?.kind === 'needs-owner') return { headline: `${top.decision?.label ?? 'Something'} needs a plan.`.replace(/^./, (c) => c.toUpperCase()), sub };
  if (top?.kind === 'declined') return { headline: `${top.label ?? top.request!.title} still needs a plan.`.replace(/^./, (c) => c.toUpperCase()), sub };
  if (top?.kind === 'changed') return { headline: 'The plan changed.', sub };
  const accepted = matters.find((m) => m.kind === 'accepted');
  if (accepted) return { headline: `${names[accepted.request!.to] ?? 'Someone'} has it.`, sub: 'One less thing to carry.' };
  if (firstTime) return { headline: 'Let’s make your first plan.', sub: 'It starts with a ten-minute Family Meeting.' };
  const mine = plan.filter((p) => p.mine);
  if (mine.length && mine.every((p) => p.done)) return { headline: 'You’re all set today.', sub: null };
  const tonight = mine.find((p) => p.dueTonight && !p.done);
  if (tonight) return { headline: `${tonight.part.title} tonight.`, sub: tonight.time ? `It’s yours, ${tonight.part.cue && /^by /i.test(tonight.part.cue) ? lowerFirst(tonight.part.cue) : `at ${t12(tonight.time)}`}.` : 'It’s yours.' };
  void viewer;
  return { headline: 'Nothing needs you today.', sub: mine.length ? `${mine.length === 1 ? 'One thing' : `${mine.length} things`} on your plan.` : 'Everyone knows the plan.' };
}

// ------------------------------------------------------------------ widget state (for a future native widget)

export interface WidgetState {
  kind: 'request' | 'change' | 'decision' | 'handoff-confirmed' | 'waiting' | 'quiet';
  title: string;
  detail: string;
  /** A request can be answered from the widget (a native AppIntent later). */
  actions: ('got-it' | 'not-this-time')[];
  /** How many other things need this adult. */
  more: number;
  requestId?: string;
  key?: string;
}

const KIND: Partial<Record<MatterKind, WidgetState['kind']>> = {
  'request-in': 'request', conflict: 'change', changed: 'change', 'needs-owner': 'decision', declined: 'decision', accepted: 'handoff-confirmed', waiting: 'waiting',
};

/** The one most relevant item for this adult, with a subtle count of the rest. Quiet when nothing needs them. */
export function widgetFor(model: TodayV21): WidgetState {
  const items = model.matters.filter((m) => KIND[m.kind] && (m.attention || m.kind === 'accepted' || m.kind === 'waiting'));
  const top = items[0];
  if (!top) return { kind: 'quiet', title: 'Nothing needs you', detail: 'Everyone knows the plan.', actions: [], more: 0 };
  const more = items.filter((m) => m !== top && m.attention).length;
  const r = top.request;
  const detail = top.kind === 'request-in' || top.kind === 'waiting' || top.kind === 'accepted' ? [whenDay(top.date ?? null, top.time ?? null), top.kind === 'request-in' ? top.meta.split(' · ').pop() : null].filter(Boolean).join(' · ') || top.meta : top.meta;
  return { kind: KIND[top.kind]!, title: top.kind === 'accepted' ? `${top.title} ✓` : top.title, detail, actions: top.kind === 'request-in' ? ['got-it', 'not-this-time'] : [], more, requestId: r?.id, key: top.key };
}

// ------------------------------------------------------------------ Family Meeting continuity

export interface CarryItem { key: string; title: string; detail: string; kind: 'declined' | 'needs-owner' | 'waiting' | 'changed' | 'unplanned' }

/**
 * What the next meeting picks up without anyone reconstructing the last one: requests that were declined and still need
 * a plan, decisions made each time for the coming week, requests nobody has answered, and agreements changed since.
 * Not a review of every task: standing agreements stay in Everyone's Part, untouched unless the family opens them.
 */
export function carryForward(inp: TodayInput): CarryItem[] {
  const { s, today, people } = inp;
  const names = Object.fromEntries(people.map((p) => [p.id, p.firstName]));
  const out: CarryItem[] = [];
  const talked = intelOf(s).talked ?? {};
  for (const r of requestsOf(s)) {
    if (r.date && r.date < today) continue;
    if (r.status === 'declined') {
      const owned = agreedParts(s).some((p) => p.id === takeId(r.subject, r.title));
      if (!owned && !(r.prevOwner && (r.subject.kind === 'occurrence' || r.subject.kind === 'part'))) out.push({ key: `carry:req:${r.id}`, kind: 'declined', title: `${r.title}${r.date ? ` · ${dayName(r.date)}` : ''}`, detail: `${names[r.to] ?? 'They'} couldn’t take it. Who will?` });
    } else if (r.status === 'asked') out.push({ key: `carry:req:${r.id}`, kind: 'waiting', title: r.title, detail: `Asked ${names[r.to] ?? 'someone'} · no answer yet` });
  }
  for (const d of decisionsOf(s).filter((x) => x.kind === 'each-time' && x.eventLink)) {
    const next = ahead(s, today, 7).filter((o) => linkOf(o.event) === d.eventLink).filter((o) => !agreedParts(s).some((p) => p.eventLink === d.eventLink && p.ownerId && partDate(s, inp.monday, p) === o.date));
    if (next.length) out.push({ key: `carry:each:${d.id}`, kind: 'needs-owner', title: d.title ?? d.text, detail: `${next.map((o) => dayName(o.date)).join(', ')} · we decide this each week` });
  }
  return out.filter((x) => !talked[x.key]);
}
