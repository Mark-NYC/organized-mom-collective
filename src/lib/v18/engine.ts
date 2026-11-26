/**
 * V18 Intelligent Today (docs/ios/V18_TODAY_INTELLIGENCE.md): one deterministic engine that reads the family's real
 * state (calendar, parts, agreements, development records, cleaning, the last meeting) and decides what, if
 * anything, Today should say.
 *
 * Detectors produce Insights (internal metadata, never shown as such). Then, in order:
 *   1. confidence gate: below 0.5 dropped; below 0.7 only ever a meeting topic
 *   2. consolidation: one insight per event occurrence (its needs merge)
 *   3. suppression: dismissed with the same fingerprint, already handled, or already a meeting topic
 *   4. ranking: 0.4·urgency + 0.2·consequence + 0.2·confidence + 0.2·relevance (to the adult looking)
 *   5. at most ONE heads-up card; other Today items become a quiet line under their activity in What matters;
 *      meeting-venue items wait for the family to choose "Bring it up Sunday"
 * Saying nothing is a valid answer: with no insight, the headline is grounded in the day and there is no card.
 *
 * Never: assign a responsibility, change an event, modify an agreement, or advance a development record. Every
 * action routes to an existing workflow (a proposal the family agrees to, the week view, a meeting topic).
 */
import { addDays, daysBetween, occurrences, timeLabel, type CalendarEvent, type Occurrence } from '../calendar/recurrence';
import type { DevelopmentRecord } from '../family-development/records';
import {
  agreedParts, currentPriorities, dayName, durable, eventsFor, isShared, linkOf, mondayOf, partDate, sessionsOn, sharedOccurrences, type Part, type V16State,
} from '../v16/model';
import { weekday } from '../calendar/recurrence';
import { allMemory, emptyMemory, memoryFor, type Memory, type MemoryState } from './memory';
import { ASK_BELOW, eventFingerprint, minimize, type Interpretation, type InterpreterInput } from './interpret';
import { PLAYBOOKS, classify, type EventKind, type Need } from './playbooks';

// ------------------------------------------------------------------ state

export type InsightType = 'exception' | 'invisible-work' | 'open-loop' | 'capacity' | 'development';
export type ActionId = 'make-plan' | 'finish-plan' | 'review-plan' | 'review-week' | 'bring-up' | 'handled' | 'dismiss';

export interface Resolution { key: string; fingerprint: string; status: 'dismissed' | 'handled' | 'topic'; on: string }
export interface Topic { key: string; text: string; on: string; type: InsightType }

/** What the shared plan looked like when the family last met, so "changed since your meeting" is a real diff. */
export interface Baseline { taken: string; items: Record<string, { date: string; start: string | null; end: string | null; title: string }> }

export interface IntelState {
  memory: MemoryState;
  resolutions: Resolution[];
  topics: Topic[];
  baseline: Baseline | null;
  /** Cached interpretations by event fingerprint (never re-asked per Today open). */
  interpretations: Record<string, Interpretation>;
  /** Preview control: whether the (simulated) interpreter answers. */
  aiAvailable: boolean;
  /** The adult looking at Today. */
  viewer: string;
  /** Which demo scenario seeded this (preview only). */
  scenario?: string;
  // ---------------------------------------------------------------- V19 (src/lib/v19): optional, absent in V18 state
  /** What the family told us about an insight (richer than a resolution): see src/lib/v19/attention.ts. */
  feedback?: import('../v19/attention').Feedback[];
  /** Circumstances someone reported today ("Something changed?"). Household facts, shared with both adults. */
  reports?: import('../v19/attention').Report[];
  /** Completion history: when standing parts were actually done (late, moved), for recurring friction. */
  history?: import('../v19/attention').HistoryEntry[];
  /** insight key → the day it first appeared as the Today card (the attention budget). */
  shown?: Record<string, import('../v19/attention').Shown>;
  /** The family's own choice in Account: how much Today brings up. */
  assistance?: 'fewer' | 'standard' | 'more';
  /** Meeting agenda items the family has talked about (key → date). */
  talked?: Record<string, string>;
  // ---------------------------------------------------------------- V20 (src/lib/v20/notify.ts): optional
  /** Each adult's notification choices (purposes, the meeting reminder, quiet hours). */
  notifyPrefs?: Record<string, Partial<import('../v20/notify').NotifyPrefs>>;
  /** Delivered notifications by dedupe key (shared, so the same facts never alert twice on any device). */
  sent?: Record<string, { to: string; date: string; time: string; urgent: boolean }>;
  /** "I've got it" on a change: who took it, and who else had been told. */
  claims?: Record<string, { by: string; on: string; title: string; notified: string[] }>;
  /** Preview only: the demo clock ('HH:MM'). */
  clock?: string;
}

export const emptyIntel = (viewer: string): IntelState =>
  ({ memory: emptyMemory(), resolutions: [], topics: [], baseline: null, interpretations: {}, aiAvailable: true, viewer });

export interface Possibility {
  need: string;
  label: string;
  title: string;
  finish: string;
  eventLink: string;
  offsetDays: number;
  ownerId: string | null;
  /** Why this person, in plain words, grounded in memory or a development record. Never an assignment. */
  ownerWhy?: string;
  memoryId?: string;
  skill?: string;
  /** The existing proposal for this need, if there is one. */
  partId?: string;
  state: 'missing' | 'proposed' | 'discussed';
}

export interface Insight {
  /** Dedupe identity: stable for "this thing about this occurrence". */
  key: string;
  /** Changes whenever the facts behind it change (a dismissal only holds for the same facts). */
  fingerprint: string;
  type: InsightType;
  eventLink?: string;
  date?: string;
  /** The kind the activity was read as (needs only), for "Not needed for us". */
  kind?: EventKind;
  partIds: string[];
  members: string[];
  confidence: number;
  urgency: number;
  consequence: number;
  relevance: number;
  score: number;
  venue: 'today' | 'meeting';
  expiresOn: string;
  /** Plain-language provenance for "Why am I seeing this?". */
  evidence: string[];
  source: 'calendar' | 'rules' | 'memory' | 'records' | 'simulated-interpreter';
  eyebrow: string;
  title: string;
  body: string;
  /** The quiet line under the activity in What matters. */
  attention: string;
  action: ActionId;
  secondary?: ActionId;
  possibilities: Possibility[];
  memories: Memory[];
}

export interface Person { id: string; firstName: string; kind: 'adult' | 'child'; age?: number }

export interface TodayInput { s: V16State; monday: string; today: string; people: Person[] }

// ------------------------------------------------------------------ helpers

export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const t12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
export const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
export const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
export const article = (label: string) => (label === 'RSVP' ? 'an RSVP' : /^(A |An |Lunch|Gear|Pickup)/.test(label) ? label.toLowerCase() : /^[AEIOU]/i.test(label) ? `an ${label.toLowerCase()}` : `a ${label.toLowerCase()}`);
/** '15:00' → '3 PM', '15:30' → '3:30 PM'. */
export const short = (t: string) => t12(t).replace(':00', '');
export const ROUTINE = /^(school|family meeting)$/i;

export const occKey = (o: Occurrence) => `${linkOf(o.event)}@${o.event.external?.instance_key ?? o.date}`;

/** "Today", "Tomorrow", "Saturday". */
export function whenWord(date: string, today: string) {
  const d = daysBetween(today, date);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayName(date);
}
/** "Tomorrow’s school field trip", or "Zoe’s party on Saturday" when the title is already possessive. */
export const possessive = (date: string, today: string, title: string) => {
  const w = whenWord(date, today);
  if (/[’']s\b/.test(title)) return `${title} ${w === 'Today' || w === 'Tomorrow' ? w.toLowerCase() : `on ${w}`}`;
  return `${w}’s ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
};

/** Snapshot of the shared plan (taken when a meeting finishes). */
export function snapshot(s: V16State, monday: string, taken: string): Baseline {
  const items: Baseline['items'] = {};
  for (const o of sharedOccurrences(s, monday)) items[occKey(o)] = { date: o.date, start: o.event.start_time ?? null, end: o.event.end_time ?? null, title: o.event.title };
  return { taken, items };
}

export const intelOf = (s: V16State) => s.intel ?? emptyIntel('m-ana');

/** The family's kind for an event: a cached interpretation when it's more confident than the rules. */
export function kindOf(s: V16State, o: Occurrence): { kind: EventKind; confidence: number; interp: Interpretation | null } {
  const rules = classify(o.event.title);
  const intel = intelOf(s);
  const cached = intel.interpretations[eventFingerprint(o.event, o.date)];
  if (cached && cached.confidence >= 0.6 && cached.confidence > rules.confidence) return { kind: cached.kind, confidence: cached.confidence, interp: cached };
  return { kind: rules.kind, confidence: rules.confidence, interp: null };
}

/** Events the rules aren't sure about and nobody has interpreted yet: what the optional interpreter is asked. */
export function pendingInterpretations({ s, monday, today, people }: TodayInput): { fingerprint: string; input: InterpreterInput }[] {
  const intel = intelOf(s);
  const out: { fingerprint: string; input: InterpreterInput }[] = [];
  for (const o of upcoming(s, monday, today, 3)) {
    const fp = eventFingerprint(o.event, o.date);
    const c = classify(o.event.title).confidence;
    // Only a weak rule match is worth asking about; a title the rules don't recognize at all is left alone.
    if (intel.interpretations[fp] || c >= ASK_BELOW || c < 0.5 || out.some((x) => x.fingerprint === fp)) continue;
    const attendees = people.filter((p) => o.event.member_ids.includes(p.id)).map((p) => ({ kind: p.kind, age: p.age }));
    out.push({ fingerprint: fp, input: minimize(o.event, attendees, people.map((p) => p.firstName)) });
  }
  return out;
}

export function upcoming(s: V16State, monday: string, today: string, days: number) {
  const last = addDays(today, days);
  // Beyond this week (V19's longer preparation windows), read the same calendar over the longer range.
  const occ = last > addDays(monday, 6) ? occurrences(eventsFor(s, monday), today, last).filter((o) => isShared(o.event)) : sharedOccurrences(s, monday);
  return occ.filter((o) => o.date >= today && o.date <= last && !ROUTINE.test(o.event.title));
}

export function relevanceFor(viewer: string, members: string[], adultTask: boolean): number {
  if (members.includes(viewer)) return 1;
  return adultTask ? 0.8 : 0.5;
}

export const NEED_VERB: Record<string, [string, string]> = {
  ride: ['drives', 'drove'], lunch: ['packs lunch', 'packed lunch'], card: ['makes the card', 'made the card'], gift: ['picks the gift', 'picked the gift'],
  rsvp: ['RSVPs', 'RSVPed'], gear: ['packs the bag', 'packed the bag'], pickup: ['does pickup', 'did pickup'], outfit: ['lays out the outfit', 'laid out the outfit'],
};
export function memoryLine(m: Memory, names: Record<string, string>): string {
  const who = names[m.memberId ?? ''] ?? 'Someone';
  const [now, past] = NEED_VERB[m.need] ?? ['does this', 'did this'];
  if (m.effect === 'not-needed') return 'You told us this isn’t needed for your family.';
  return m.kind === 'confirmed' ? `${who} ${now}.` : `${who} ${past} the last ${m.evidence.length} times.`;
}

// ------------------------------------------------------------------ detectors

/** F. What changed in the shared plan since the family last met. */
function exceptions(inp: TodayInput, names: Record<string, string>): Insight[] {
  const { s, monday, today } = inp;
  const intel = intelOf(s);
  if (!intel.baseline) return [];
  const now = new Map(sharedOccurrences(s, monday).map((o) => [occKey(o), o]));
  const out: Insight[] = [];
  for (const [key, was] of Object.entries(intel.baseline.items)) {
    if (was.date < today || ROUTINE.test(was.title)) continue;
    const o = now.get(key);
    const link = key.slice(0, key.lastIndexOf('@'));
    const parts = agreedParts(s).filter((p) => p.eventLink === link);
    const owners = [...new Set(parts.map((p) => p.ownerId).filter((x): x is string => Boolean(x)))];
    const d = daysBetween(today, o?.date ?? was.date);
    // Someone already owns what this change affects: it's mostly theirs to handle, so it ranks lower for everyone else.
    const involved = !owners.length || owners.includes(intel.viewer);
    const urgency = (d <= 0 ? 1 : d === 1 ? 0.8 : 0.5) * (involved ? 1 : 0.7);
    if (!o) {
      out.push(base({
        key: `exc:cancel:${key}`, type: 'exception', eventLink: link, date: was.date, partIds: parts.map((p) => p.id), members: owners,
        confidence: 1, urgency, consequence: parts.length ? 0.5 : 0.3, adultTask: true, viewer: intel.viewer, expiresOn: was.date,
        evidence: [`${was.title} on ${dayName(was.date)} is no longer in its calendar.`],
        source: 'calendar', eyebrow: 'Changed since your meeting', title: `${possessive(was.date, today, was.title)} is cancelled.`,
        body: parts.length ? `${list(parts.map((p) => `${names[p.ownerId ?? ''] ?? 'Someone'}’s “${p.title}”`))} isn’t needed this time. The agreement stays for next time.` : 'Nothing else on your plan depends on it.',
        attention: 'Cancelled in its calendar.', action: 'review-week', fp: `${key}|gone`,
      }));
      continue;
    }
    const start = o.event.start_time ?? null;
    if (o.date === was.date && start === was.start) continue;
    const sameDay = o.date === was.date;
    const title = sameDay
      ? `${o.event.title} starts at ${short(start!)} ${whenWord(o.date, today).toLowerCase()}, not ${short(was.start!)}.`
      : `${o.event.title} moved to ${dayName(o.date)}.`;
    const lines: string[] = [];
    for (const p of parts.filter((p) => p.need === 'ride' || p.cue)) {
      const at = p.cue?.match(/\d{1,2}:\d{2}\s?[AP]M/i)?.[0];
      if (at) lines.push(`${names[p.ownerId ?? ''] ?? 'Someone'} planned to leave at ${at}.`);
    }
    // A conflict with another commitment of the same people that day (school ending right when it starts).
    if (start) {
      const clash = sharedOccurrences(s, monday).find((x) => x !== o && x.date === o.date && x.event.end_time && x.event.start_time
        && x.event.member_ids.some((m) => o.event.member_ids.includes(m)) && x.event.end_time >= start && x.event.start_time < start);
      if (clash) lines.push(clash.event.end_time === start
        ? `${clash.event.title} ends at ${short(start)}, right when ${o.event.title.toLowerCase()} starts.`
        : `It overlaps ${clash.event.title}, which ends at ${t12(clash.event.end_time!)}.`);
    }
    if (!lines.length && parts.length) lines.push(`${list(parts.map((p) => `“${p.title}”`))} follows it to the new time.`);
    out.push(base({
      key: `exc:move:${key}`, type: 'exception', eventLink: link, date: o.date, partIds: parts.map((p) => p.id), members: [...owners, ...o.event.member_ids],
      confidence: 1, urgency, consequence: lines.length > 1 ? 0.9 : parts.length ? 0.7 : 0.4, adultTask: true, viewer: intel.viewer, expiresOn: o.date,
      evidence: [`When you last met, ${was.title} was ${dayName(was.date)} at ${was.start ? t12(was.start) : 'all day'}. Its calendar now says ${dayName(o.date)} at ${start ? t12(start) : 'all day'}.`],
      source: 'calendar', eyebrow: 'Changed since your meeting', title, body: lines.join(' ') || 'Nothing else on your plan depends on it.',
      attention: sameDay ? `Now at ${short(start!)}.` : `Moved to ${dayName(o.date)}.`, action: parts.length ? 'review-plan' : 'review-week', fp: `${key}|${o.date}|${start}|${lines.join('')}`,
    }));
  }
  return out;
}

/** A + B. What an activity needs that nobody has (or that was talked about and never agreed), one insight per occurrence. */
export function needsWork(inp: TodayInput, names: Record<string, string>, opts: { days?: number; maxDue?: number } = {}): Insight[] {
  const { s, monday, today, people } = inp;
  const intel = intelOf(s);
  const out: Insight[] = [];
  for (const o of upcoming(s, monday, today, opts.days ?? 3)) {
    const link = linkOf(o.event);
    const { kind, confidence, interp } = kindOf(s, o);
    if (confidence < 0.5) continue;
    const parts = s.parts.filter((p) => p.eventLink === link && p.status !== 'skipped');
    const wanted = interp ? PLAYBOOKS[kind].filter((n) => interp.needs.includes(n.id)) : PLAYBOOKS[kind].filter((n) => n.core);
    // Needs the family's own parts point at count too (the pickup someone mentioned).
    const extra = PLAYBOOKS[kind].filter((n) => !wanted.includes(n) && parts.some((p) => p.need === n.id));
    const poss: Possibility[] = [];
    const mems: Memory[] = [];
    let earliestDue = Infinity;
    for (const need of [...wanted, ...extra]) {
      const part = parts.find((p) => p.need === need.id);
      if (part?.status === 'agreed') continue;
      const mem = memoryFor(intel.memory, kind, need.id);
      if (mem?.effect === 'not-needed') continue;
      const due = daysBetween(today, addDays(o.date, -need.leadDays));
      if (o.date < today) continue;
      earliestDue = Math.min(earliestDue, Math.max(due, 0));
      const owner = possibleOwner(s, need, mem, people, names, part);
      if (mem) mems.push(mem);
      poss.push({
        need: need.id, label: need.label, title: part?.title ?? need.title, finish: part?.finishLine ?? need.finish, eventLink: link, offsetDays: part?.offsetDays ?? -need.leadDays,
        ownerId: part?.ownerId ?? owner.id, ownerWhy: owner.why, memoryId: mem?.id, skill: need.skill, partId: part?.id,
        state: !part ? 'missing' : part.discussed ? 'discussed' : 'proposed',
      });
    }
    if (!poss.length || earliestDue > (opts.maxDue ?? 2)) continue;
    const loop = poss.some((p) => p.state === 'discussed');
    const sure = confidence >= 0.8;
    const what = possessive(o.date, today, o.event.title);
    const lunchHours = o.event.start_time && o.event.end_time && o.event.start_time <= '11:30' && o.event.end_time >= '13:00';
    let title: string;
    if (loop) {
      const p = poss.find((x) => x.state === 'discussed')!;
      title = `You talked about ${p.label.toLowerCase()} for ${what.charAt(0).toLowerCase()}${what.slice(1)}, but nobody has it yet.`;
    } else if (poss.length === 1 && poss[0].need === 'lunch' && lunchHours) {
      title = `${what} runs through lunch.`;
    } else {
      title = `${what} ${sure ? 'needs' : 'may need'} ${list(poss.map((p) => article(p.label)))}.`;
    }
    const lines: string[] = [];
    lines.push(loop ? 'It was kept to talk over, and nobody agreed to do it.' : poss.every((p) => p.state === 'missing') ? 'Nobody has it on their plan yet.' : 'Nobody has agreed to it yet.');
    for (const p of poss) if (p.ownerWhy) lines.push(p.ownerWhy);
    const due = earliestDue;
    const adultTask = poss.some((p) => PLAYBOOKS[kind].find((n) => n.id === p.need)?.owner !== 'child');
    const members = [...new Set([...o.event.member_ids, ...poss.map((p) => p.ownerId).filter((x): x is string => Boolean(x))])];
    const consequence = Math.max(...poss.map((p) => ({ ride: 0.8, pickup: 0.9, lunch: 0.7, rsvp: 0.6, gift: 0.5, gear: 0.6, card: 0.3, outfit: 0.5 }[p.need] ?? 0.4)));
    out.push(base({
      key: `need:${occKey(o)}`, type: loop ? 'open-loop' : 'invisible-work', eventLink: link, date: o.date, kind, partIds: poss.map((p) => p.partId).filter((x): x is string => Boolean(x)),
      members, confidence, urgency: due <= 0 ? 0.85 : due === 1 ? 0.65 : 0.45, consequence, adultTask, viewer: intel.viewer, expiresOn: o.date,
      evidence: [
        `${o.event.title} is on ${dayName(o.date)}${o.event.start_time ? `, ${timeLabel(o.event)}` : ''}.`,
        interp ? `Read as a ${kind.replace('-', ' ')} by the interpreter (SIMULATED in this preview), then checked against our list of what those need.` : `Activities like this usually need ${list(poss.map((p) => p.label.toLowerCase()))}.`,
        ...poss.map((p) => p.state === 'missing' ? `No one has “${p.label}” on their plan.` : p.state === 'discussed' ? `“${p.title}” was talked about and never agreed.` : `“${p.title}” is suggested, not agreed.`),
      ],
      source: interp ? 'simulated-interpreter' : mems.length ? 'memory' : 'rules',
      eyebrow: loop ? 'Still open' : due <= 0 ? 'Worth doing today' : 'Getting ahead',
      title, body: lines.join(' '), attention: `${list(poss.map((p) => p.label))} ${poss.length > 1 ? 'need' : 'needs'} attention.`.replace(/^./, (c) => c.toUpperCase()),
      action: poss.some((p) => p.partId) ? 'finish-plan' : 'make-plan', secondary: 'handled', possibilities: poss, memories: mems,
      fp: `${occKey(o)}|${o.date}|${o.event.start_time}|${o.event.end_time}|${kind}|${poss.map((p) => `${p.need}:${p.state}:${p.ownerId}`).join(',')}`,
    }));
  }
  return out;
}

/** Who could own a need: what the family told us, a repeated pattern, or a child who already owns the same skill. */
export function possibleOwner(s: V16State, need: Need, mem: Memory | null, people: Person[], names: Record<string, string>, part?: Part): { id: string | null; why?: string } {
  // The reason is said only when it's grounded; a proposal that already names someone keeps its owner either way.
  const fixed = part?.ownerId ?? null;
  if (mem?.effect === 'owner' && mem.memberId && names[mem.memberId] && (!fixed || fixed === mem.memberId)) return { id: mem.memberId, why: memoryLine(mem, names) };
  if (need.skill && need.owner !== 'adult') {
    const rec = s.records.find((r) => r.skillId === need.skill && (r.status === 'launched' || r.stage === 'watch') && people.some((p) => p.id === r.memberId && p.kind === 'child')
      && (!fixed || fixed === r.memberId));
    if (rec) return { id: rec.memberId, why: `“${rec.title}” is already ${names[rec.memberId]}’s, so this could be too.` };
  }
  return { id: fixed };
}

/** B. Something the family talked about (Keep) and never agreed, with no activity attached. */
export function looseLoops(inp: TodayInput, names: Record<string, string>): Insight[] {
  const { s, monday } = inp;
  const intel = intelOf(s);
  return s.parts.filter((p) => !p.eventLink && p.discussed && p.status !== 'agreed' && p.status !== 'skipped').map((p) => base({
    key: `loop:${p.id}`, type: 'open-loop', partIds: [p.id], members: p.ownerId ? [p.ownerId] : [], confidence: 0.9, urgency: 0.2, consequence: 0.3,
    adultTask: false, viewer: intel.viewer, expiresOn: addDays(monday, 6), venue: 'meeting',
    evidence: ['It was kept to talk over in a meeting and never agreed.'], source: 'rules', eyebrow: 'Still open',
    title: `“${p.title}” was talked about, not agreed.`, body: `${p.ownerId ? `${names[p.ownerId]} ` : ''}could pick it up at your next meeting.`.trim(),
    attention: 'Talked about, not agreed.', action: 'bring-up', fp: `${p.id}|${p.status}|${p.ownerId}`,
  }));
}

/** E. Several full days in a row, especially when a cleaning session lands on the fullest one. */
export function capacity(inp: TodayInput): Insight[] {
  const { s, monday, today } = inp;
  const intel = intelOf(s);
  const days = [0, 1, 2, 3].map((i) => addDays(today, i)).filter((d) => d <= addDays(monday, 6));
  const by = days.map((d) => ({ d, occ: sharedOccurrences(s, monday).filter((o) => o.date === d && !ROUTINE.test(o.event.title) && (o.event.start_time ?? '') >= '08:00') }));
  const total = by.reduce((n, x) => n + x.occ.length, 0);
  // Three or more full days in a row starting today, with real volume (not one practice a day).
  const run = by.findIndex((x) => !x.occ.length);
  const streak = run === -1 ? by.length : run;
  if (streak < 3 || total < 6) return [];
  const fullest = [...by].sort((a, b) => b.occ.length - a.occ.length)[0];
  const cleaning = sessionsOn(s, monday, weekday(fullest.d)).length;
  const tomorrow = by[1]?.occ.length ?? 0;
  const lines = [`Something every day through ${dayName(by[streak - 1].d)}, and ${dayName(fullest.d)} is the fullest, with ${fullest.occ.length} activities.`];
  if (cleaning) lines.push(`${dayName(fullest.d)} is also a cleaning day. Moving it or making it lighter is an option.`);
  return [base({
    key: `cap:${monday}:${days[0]}`, type: 'capacity', date: fullest.d, partIds: [], members: [], confidence: 0.9, urgency: tomorrow >= 2 ? 0.6 : 0.45, consequence: cleaning ? 0.6 : 0.4,
    adultTask: true, viewer: intel.viewer, expiresOn: days[days.length - 1],
    evidence: by.map((x) => `${dayName(x.d)}: ${x.occ.map((o) => o.event.title).join(', ') || 'nothing'}`), source: 'calendar',
    eyebrow: 'A full stretch', title: `${['', 'One', 'Two', 'Three', 'Four'][streak]} full days in a row.`, body: lines.join(' '),
    attention: '', action: 'review-week', secondary: 'bring-up', fp: by.map((x) => `${x.d}:${x.occ.length}`).join('|') + `|c${cleaning}`,
    meta: { tomorrowBusy: tomorrow >= 2 },
  })];
}

/** D. Mental-ownership development, family-reported only: worth noticing together, never urgent, never a stage. */
export function development(inp: TodayInput, names: Record<string, string>): Insight[] {
  const { s, monday } = inp;
  const intel = intelOf(s);
  return s.records.filter((r) => r.status === 'active').flatMap((r: DevelopmentRecord) => {
    const checks = r.history.filter((h) => h.decision === 'check-in');
    const last = checks.slice(-3);
    if (last.length < 3 || !last.every((h) => h.value === 'strong')) return [];
    const who = names[r.memberId] ?? 'Someone';
    return [base({
      key: `dev:${r.id}:${r.revision}`, type: 'development', partIds: r.agreementId ? [r.agreementId] : [], members: [r.memberId], confidence: 0.9, urgency: 0.2, consequence: 0.3,
      adultTask: false, viewer: intel.viewer, expiresOn: addDays(monday, 13), venue: 'meeting',
      evidence: [`Your last 3 check-ins about “${r.title}” all said it went well.`, 'That’s what the family reported; the app didn’t measure anything.'], source: 'records',
      eyebrow: 'Worth noticing', title: `${who} has done “${r.title}” well three check-ins in a row.`,
      body: `Worth noticing together. Whether ${who} wants more of it is the family’s call.`, attention: '', action: 'bring-up', fp: `${r.id}|${r.revision}`,
    })];
  });
}

export interface BaseArgs extends Omit<Insight, 'fingerprint' | 'relevance' | 'score' | 'venue' | 'possibilities' | 'memories'> {
  adultTask: boolean; viewer: string; fp: string; venue?: 'today' | 'meeting'; possibilities?: Possibility[]; memories?: Memory[]; meta?: Record<string, unknown>;
}
const META = new WeakMap<Insight, Record<string, unknown>>();
export function base(a: BaseArgs): Insight {
  const { adultTask, viewer, fp, meta, ...rest } = a;
  const relevance = relevanceFor(viewer, a.members, adultTask);
  const confidence = clamp(a.confidence);
  const i: Insight = {
    ...rest, possibilities: a.possibilities ?? [], memories: a.memories ?? [], confidence, relevance,
    venue: a.venue ?? (confidence < 0.7 ? 'meeting' : 'today'), fingerprint: `${a.key}#${hash(fp)}`,
    score: 0.4 * a.urgency + 0.2 * a.consequence + 0.2 * confidence + 0.2 * relevance,
  };
  if (meta) META.set(i, meta);
  return i;
}

// ------------------------------------------------------------------ Today

export interface TodayModel {
  headline: string;
  sub?: string;
  card: Insight | null;
  /** Other Today-venue insights (shown only as a line under their activity). */
  queued: Insight[];
  /** Meeting-venue insights not yet brought up. */
  forMeeting: Insight[];
  /** eventLink → the quiet attention line (kept after a dismissal; gone once handled). */
  attention: Record<string, string>;
  topics: Topic[];
  /** Everything detected, before suppression (tests and the doc's audit). */
  all: Insight[];
  suppressed: { insight: Insight; why: 'dismissed' | 'handled' | 'topic' | 'low-confidence' | 'expired' }[];
}

export function detect(inp: TodayInput): Insight[] {
  const names = Object.fromEntries(inp.people.map((p) => [p.id, p.firstName]));
  const raw = [...exceptions(inp, names), ...needsWork(inp, names), ...looseLoops(inp, names), ...capacity(inp), ...development(inp, names)];
  // Consolidate: one insight per event occurrence. An exception about an event outranks its needs; the needs ride along.
  const byEvent = new Map<string, Insight>();
  const out: Insight[] = [];
  for (const i of raw.sort((a, b) => b.score - a.score)) {
    const id = i.eventLink && i.date ? `${i.eventLink}|${i.date}` : null;
    if (!id) { if (!out.some((x) => x.key === i.key)) out.push(i); continue; }
    const kept = byEvent.get(id);
    if (!kept) { byEvent.set(id, i); out.push(i); continue; }
    if (i.possibilities.length && !kept.possibilities.length) {
      kept.possibilities = i.possibilities;
      kept.body = `${kept.body} ${i.title}`.trim();
      kept.evidence = [...kept.evidence, ...i.evidence];
    }
  }
  return out;
}

export function buildToday(inp: TodayInput): TodayModel {
  const { s, today } = inp;
  const intel = intelOf(s);
  const all = detect(inp);
  const suppressed: TodayModel['suppressed'] = [];
  const live: Insight[] = [];
  const attention: Record<string, string> = {};
  for (const i of all) {
    const res = intel.resolutions.filter((r) => r.key === i.key);
    if (i.expiresOn < today) { suppressed.push({ insight: i, why: 'expired' }); continue; }
    if (i.confidence < 0.5) { suppressed.push({ insight: i, why: 'low-confidence' }); continue; }
    if (res.some((r) => r.status === 'handled')) { suppressed.push({ insight: i, why: 'handled' }); continue; }
    if (res.some((r) => r.status === 'topic') || intel.topics.some((t) => t.key === i.key)) { suppressed.push({ insight: i, why: 'topic' }); continue; }
    if (i.eventLink && i.attention && i.venue === 'today') attention[i.eventLink] = i.attention;
    if (res.some((r) => r.status === 'dismissed' && r.fingerprint === i.fingerprint)) { suppressed.push({ insight: i, why: 'dismissed' }); continue; }
    live.push(i);
  }
  const ranked = live.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const todayItems = ranked.filter((i) => i.venue === 'today');
  const forMeeting = ranked.filter((i) => i.venue === 'meeting');
  const meetingSoon = nextMeeting(inp);
  let card: Insight | null = todayItems[0] ?? null;
  // A meeting topic may be the card only when nothing else needs the family today and the meeting is close.
  if (!card && forMeeting.length && meetingSoon && daysBetween(today, meetingSoon.date) <= 4) card = forMeeting[0];
  const { headline, sub } = headlineFor(inp, card, todayItems);
  return { headline, sub, card, queued: todayItems.filter((i) => i !== card), forMeeting: forMeeting.filter((i) => i !== card), attention, topics: intel.topics, all, suppressed };
}

export function nextMeeting({ s, monday, today }: TodayInput): Occurrence | null {
  return sharedOccurrences(s, monday).find((o) => o.event.title === 'Family Meeting' && o.date >= today) ?? null;
}

function headlineFor(inp: TodayInput, card: Insight | null, todayItems: Insight[]): { headline: string; sub?: string } {
  const { s, monday, today } = inp;
  const todays = sharedOccurrences(s, monday).filter((o) => o.date === today && !ROUTINE.test(o.event.title));
  const ground = todays.length ? `Today: ${list(todays.map((o) => `${o.event.title}${o.event.start_time ? ` at ${t12(o.event.start_time).replace(':00', '')}` : ''}`))}.` : undefined;
  if (s.meeting.started) return { headline: 'You’re partway through this week’s plan.', sub: ground };
  if (card?.type === 'exception') return { headline: 'Your plans have changed.' };
  if (todayItems.length >= 2) return { headline: 'A couple of things need attention.' };
  if (card?.type === 'capacity') return { headline: META.get(card)?.tomorrowBusy ? 'Tomorrow’s a busy one.' : 'A full few days ahead.', sub: ground };
  if (card && (card.type === 'invisible-work' || card.type === 'open-loop') && card.venue === 'today') {
    return card.urgency >= 0.85 ? { headline: 'You’re on track.', sub: 'One thing worth getting ahead of today.' } : { headline: 'A little preparation will help.', sub: ground };
  }
  if (card) return { headline: 'You’re on track.', sub: 'One thing worth bringing up at your meeting.' };
  const mine = agreedParts(s).filter((p) => p.eventLink && partDate(s, monday, p) === today);
  if (mine.length && mine.every((p) => p.done)) return { headline: 'Everything’s taken care of today.', sub: ground };
  if (!todays.length) return { headline: 'It’s a lighter day.', sub: 'Nothing on the shared calendar after school.' };
  return { headline: 'You’re on track.', sub: ground };
}

// ------------------------------------------------------------------ What matters / Everyone's part

export interface MatterRow { link: string; occ: Occurrence; priority: boolean; preps: { part: Part; date: string | null; doneYesterday: boolean }[]; attention?: string }

/** Priorities the family chose, then (separately, never as a priority) activities with a live attention line. */
export function matterRows(inp: TodayInput, model: TodayModel): MatterRow[] {
  const { s, monday, today } = inp;
  const shared = sharedOccurrences(s, monday);
  const rows: MatterRow[] = [];
  const add = (link: string, priority: boolean) => {
    const occ = shared.find((o) => linkOf(o.event) === link && o.date >= addDays(today, -1)) ?? shared.find((o) => linkOf(o.event) === link);
    if (!occ || rows.some((r) => r.link === link)) return;
    const preps = s.parts.filter((p) => p.eventLink === link && p.status !== 'skipped' && p.origin !== 'idea').map((p) => durable(p) ?? p)
      .map((p) => { const date = partDate(s, monday, p); return { part: p, date, doneYesterday: Boolean(p.done && date === addDays(today, -1)) }; });
    rows.push({ link, occ, priority, preps, attention: model.attention[link] });
  };
  for (const pr of currentPriorities(s)) if (pr.eventLink) add(pr.eventLink, true);
  for (const link of Object.keys(model.attention)) add(link, false);
  return rows;
}

/** The viewer's own parts first, then what happens today or tomorrow, then everything else. */
export function orderParts(inp: TodayInput): Part[] {
  const { s, monday, today } = inp;
  const viewer = intelOf(s).viewer;
  const rank = (p: Part) => {
    const d = partDate(s, monday, p);
    const soon = d && (d === today || d === addDays(today, 1)) ? 0 : 1;
    return (p.ownerId === viewer ? 0 : 2) + soon;
  };
  return agreedParts(s).filter((p) => !p.eventLink || partDate(s, monday, p)).sort((a, b) => rank(a) - rank(b));
}

// ------------------------------------------------------------------ actions (pure: the UI dispatches these)

export function resolve(s: V16State, i: Insight, status: Resolution['status'], today: string): V16State {
  const intel = intelOf(s);
  const resolutions = [...intel.resolutions.filter((r) => !(r.key === i.key && r.status === status)), { key: i.key, fingerprint: i.fingerprint, status, on: today }];
  const topics = status === 'topic' && !intel.topics.some((t) => t.key === i.key) ? [...intel.topics, { key: i.key, text: i.title, on: today, type: i.type }] : intel.topics;
  return { ...s, intel: { ...intel, resolutions, topics } };
}

/** "Suggest it": a labeled proposal for the family to Keep / Change / agree. Never an agreement, never assigned. */
export function propose(s: V16State, p: Possibility, eventTitle: string): { state: V16State; partId: string } {
  if (p.partId) return { state: s, partId: p.partId };
  const id = `p-v18-${p.eventLink}-${p.need}`;
  if (s.parts.some((x) => x.id === id)) return { state: s, partId: id };
  const part: Part = {
    id, origin: 'prepared', title: p.title, ownerId: p.ownerId, finishLine: p.finish, eventLink: p.eventLink, offsetDays: p.offsetDays, need: p.need,
    skill: p.skill, status: 'suggested', why: `${eventTitle} usually needs this.${p.ownerWhy ? ` ${p.ownerWhy}` : ''}`,
  };
  return { state: { ...s, parts: [...s.parts, part] }, partId: id };
}

/** Completing an agreed, need-linked part is an observation for household memory (C). */
export function observe(s: V16State, p: Part, date: string): V16State {
  if (!p.need || !p.ownerId || !p.eventLink || p.status !== 'agreed') return s;
  const intel = intelOf(s);
  const ev = sharedOccurrences(s, mondayOf(date)).find((o) => linkOf(o.event) === p.eventLink);
  const kind = ev ? kindOf(s, ev).kind : classify(p.title).kind;
  if (intel.memory.observations.some((o) => o.date === date && o.need === p.need && o.eventKind === kind)) return s;
  return { ...s, intel: { ...intel, memory: { ...intel.memory, observations: [...intel.memory.observations, { date, eventKind: kind, need: p.need, ownerId: p.ownerId }] } } };
}

export { allMemory };
export type { CalendarEvent };
