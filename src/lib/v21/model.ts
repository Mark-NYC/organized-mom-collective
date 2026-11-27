/**
 * V21 (docs/ios/V21_PREVIEW.md): the shared-responsibility layer on top of the V20 state. Pure functions, so the rules
 * are pinned by tests (tests/v21.test.ts) and the preview, the meeting and a future native widget read the same facts.
 *
 *   requests   explicit handoffs. Asking never moves responsibility; only the person asked can accept. Completion is a
 *              separate action. A declined request leaves the previous owner exactly as they were.
 *   intents    what the family chose to do about a calendar event (or "nothing needed"). Events never create
 *              obligations on their own; suggestions are offered, never required, and never need dismissing.
 *   decisions  household memory of decisions the family actually made: a remembered preference ("we usually text
 *              Johan") or a decision made each time ("who picks up Friday"). Standing responsibilities are the agreed
 *              parts themselves. Nothing one-time becomes standing without an explicit "make it the usual".
 *   done       completion of standing weekly parts per date (event and one-time parts keep Part.done).
 *   covers     a standing part covered by someone else for one date (an accepted one-time handoff).
 *   cards      routine-card drafts, saved with the agreement they print.
 *
 * Every map is keyed by a stable id, so the household document merges per key across two adults' devices
 * (src/lib/v20/intel-sync.ts merge3) instead of duplicating list items.
 */
import { addDays, weekday as weekdayOf } from '../calendar/recurrence';
import { partReducer, signature, type Part, type V16State } from '../v16/model';
import { emptyIntel, type IntelState } from '../v18/engine';

// ------------------------------------------------------------------ types

/** What a request is about. */
export type Subject =
  /** One date of a standing weekly part ("just this Friday"): accepting covers that date only. */
  | { kind: 'occurrence'; partId: string; date: string }
  /** A standing part from now on: accepting changes its owner. Always explicit. */
  | { kind: 'part'; partId: string }
  /** A calendar event that needs an owner this time (a decision made each time, or a chosen intent). */
  | { kind: 'event'; link: string; date: string; need?: string }
  /** A one-off task. */
  | { kind: 'task'; date: string | null };

export interface HandRequest {
  id: string;
  from: string;
  to: string;
  subject: Subject;
  /** The responsibility in a few words: "Pick up the boys". */
  title: string;
  /** What the person asked sees: "Can you pick up the boys?". */
  ask: string;
  date: string | null;
  /** 'HH:MM' when it has a time. */
  time: string | null;
  status: 'asked' | 'accepted' | 'declined' | 'withdrawn';
  askedOn: string;
  /** Order of asking on the asker's device (several requests on one day keep their order). */
  seq?: number;
  answeredOn?: string;
  /** Who held it before (unchanged on decline). */
  prevOwner: string | null;
  /** The part that holds the accepted responsibility. */
  partId?: string;
  /** The asker has seen the answer: it leaves their priorities and stays in the plan. */
  acked?: string;
  /** Declined and left for the Family Meeting to decide (carried forward, off Today). */
  meeting?: string;
}

export interface Intent {
  choice: string;
  label: string;
  by: string;
  on: string;
  partId?: string;
  requestId?: string;
  nothing?: boolean;
}

export type DecisionKind = 'preference' | 'each-time';
export interface Decision {
  id: string;
  kind: DecisionKind;
  /** In the family's words: "We usually send Johan a birthday text". */
  text: string;
  /** Matching: an event link, or a normalized event title ("johan's birthday"). */
  eventLink?: string;
  titleKey?: string;
  /** Preference: the option the family usually chooses, and by whom. */
  choice?: string;
  ownerId?: string | null;
  /** Each-time: the responsibility asked for every occurrence ("Pick up the boys"), its short label ("pickup"). */
  title?: string;
  label?: string;
  need?: string;
  by: string;
  on: string;
}

export interface CardDraft {
  ownerId: string | null;
  heading: string;
  title: string;
  when: string;
  what: string;
  done: string;
  badge: string;
  palette: string;
  zone?: boolean;
}

export interface V21Intel {
  requests?: Record<string, HandRequest>;
  intents?: Record<string, Intent>;
  decisions?: Record<string, Decision>;
  done?: Record<string, string>;
  covers?: Record<string, string>;
  cards?: Record<string, CardDraft>;
  /** `${viewer}|${key}` → date: confirmations and changes this adult has seen. */
  acked?: Record<string, string>;
  /** Preview only: which weekday the demo is pinned to (1 = Monday … 5 = Friday). */
  demoDay?: number;
}

export type Intel = IntelState & V21Intel;
export const intelOf = (s: V16State): Intel => (s.intel ?? emptyIntel('m-meg')) as Intel;
const withIntel = (s: V16State, patch: Partial<Intel>): V16State => ({ ...s, intel: { ...intelOf(s), ...patch } as IntelState });

// ------------------------------------------------------------------ ids

/**
 * A stable UUID from a seed: the same request accepted on two phones makes the same agreement id, so the agreements
 * store (which takes the client's id) keeps one row. Not cryptographic; 128 bits from four independent string hashes.
 */
export function uuidFrom(seed: string): string {
  const h = (salt: number) => { let x = 2166136261 ^ salt; for (let i = 0; i < seed.length; i++) { x ^= seed.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16).padStart(8, '0'); };
  const hex = h(1) + h(2) + h(3) + h(4);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89ab'[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** A request id two phones can't both produce (they may ask at the same moment). */
export const newRequestId = () => {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return `rq-${crypto.randomUUID()}`; } catch { /* fall through */ }
  return `rq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

// ------------------------------------------------------------------ parts: rhythm and today's plan

/**
 * routine: a habit with a cue and no fixed day ("after I get dressed"): Everyone's Part, never a daily task for a parent.
 * weekly: a time-sensitive weekly responsibility ("Thursday trash"): on Today's plan when it's due.
 * one-time: one date. event: preparation for an event (or the event itself), on the day it falls.
 */
export type Rhythm = 'routine' | 'weekly' | 'one-time' | 'event';
export const rhythmOf = (p: Part): Rhythm => (p.eventLink ? 'event' : p.onDate ? 'one-time' : p.weekday !== undefined ? 'weekly' : 'routine');

export const doneKey = (partId: string, date: string) => `${partId}@${date}`;

/** Is this agreed part done for this date? Weekly parts track each date; one-time and event parts carry Part.done. */
export function isDone(s: V16State, p: Part, date: string): boolean {
  if (rhythmOf(p) === 'weekly') return Boolean(intelOf(s).done?.[doneKey(p.id, date)]);
  return Boolean(p.done);
}

export function toggleDone(s: V16State, partId: string, date: string, by: string): V16State {
  const p = s.parts.find((x) => x.id === partId);
  if (!p || p.status !== 'agreed') return s;
  if (rhythmOf(p) === 'weekly') {
    const done = { ...(intelOf(s).done ?? {}) };
    const k = doneKey(partId, date);
    if (done[k]) delete done[k]; else done[k] = by;
    return withIntel(s, { done });
  }
  if (rhythmOf(p) === 'routine') return s; // habits are never checked off by a parent
  return { ...s, parts: s.parts.map((x) => (x.id === partId ? { ...x, done: !x.done } : x)) };
}

// ------------------------------------------------------------------ requests

const clean = (t: string) => t.trim().replace(/\s+/g, ' ');
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
/** "Pick up the boys" → "Can you pick up the boys?". */
export const askFor = (title: string) => `Can you ${lower(clean(title)).replace(/[.?!]+$/, '')}?`;

const subjectKey = (x: Subject) => (x.kind === 'occurrence' ? `occ:${x.partId}@${x.date}` : x.kind === 'part' ? `part:${x.partId}` : x.kind === 'event' ? `event:${x.link}@${x.date}` : '');

export const requestsOf = (s: V16State) => Object.values(intelOf(s).requests ?? {}).sort((a, b) => a.askedOn.localeCompare(b.askedOn) || (a.seq ?? 0) - (b.seq ?? 0) || a.id.localeCompare(b.id));
export const openRequestFor = (s: V16State, x: Subject) => {
  const k = subjectKey(x);
  return k ? requestsOf(s).find((r) => r.status === 'asked' && subjectKey(r.subject) === k) ?? null : null;
};

export interface AskInput { id?: string; from: string; to: string; subject: Subject; title: string; ask?: string; date: string | null; time: string | null; today: string }

/** Ask someone for a hand. Never moves responsibility. Asking again for the same thing while it's open does nothing. */
export function askHelp(s: V16State, a: AskInput): { state: V16State; id: string | null } {
  if (!a.from || !a.to || a.from === a.to || !clean(a.title)) return { state: s, id: null };
  const open = openRequestFor(s, a.subject);
  if (open) return { state: s, id: open.id };
  const prevOwner = a.subject.kind === 'occurrence' || a.subject.kind === 'part' ? s.parts.find((p) => p.id === (a.subject as { partId: string }).partId)?.ownerId ?? null : null;
  const id = a.id ?? newRequestId();
  const seq = Math.max(0, ...Object.values(intelOf(s).requests ?? {}).filter((x) => x.askedOn === a.today).map((x) => x.seq ?? 0)) + 1;
  const r: HandRequest = { id, from: a.from, to: a.to, subject: a.subject, title: clean(a.title).slice(0, 80), ask: clean(a.ask ?? askFor(a.title)).slice(0, 120),
    date: a.date, time: a.time, status: 'asked', askedOn: a.today, seq, prevOwner };
  return { state: withIntel(s, { requests: { ...(intelOf(s).requests ?? {}), [id]: r } }), id };
}

export type AnswerResult = { state: V16State; ok: boolean; reason?: 'not-found' | 'not-yours' | 'already-answered' };

/**
 * The person asked answers. Only they can; answering twice changes nothing (idempotent, so two devices tapping the same
 * notification can't double-apply). Accept moves responsibility to them; decline leaves everything as it was.
 */
export function answer(s: V16State, id: string, by: string, choice: 'accept' | 'decline', today: string): AnswerResult {
  const r = intelOf(s).requests?.[id];
  if (!r) return { state: s, ok: false, reason: 'not-found' };
  if (r.to !== by) return { state: s, ok: false, reason: 'not-yours' };
  if (r.status !== 'asked') return { state: s, ok: false, reason: 'already-answered' };
  let next = s;
  let partId: string | undefined;
  if (choice === 'accept') {
    const sub = r.subject;
    if (sub.kind === 'part') {
      const p = s.parts.find((x) => x.id === sub.partId);
      if (p) {
        partId = p.id;
        let parts = partReducer(s.parts, { type: 'edit', id: p.id, patch: { ownerId: by } }, s.online);
        parts = partReducer(parts, { type: 'agree', id: p.id, today }, s.online);
        parts = parts.map((x) => (x.id === p.id ? { ...x, lastChangedBy: by, lastChangedOn: today } : x));
        next = { ...s, parts };
      }
    } else {
      // One date: a one-time agreed part owned by the person who said yes. The standing part (if any) is covered.
      // One date only: a one-time part, never linked to a recurring event (that would quietly repeat every week).
      partId = uuidFrom(`request:${r.id}`);
      const base = sub.kind === 'occurrence' ? s.parts.find((x) => x.id === sub.partId) : undefined;
      const part: Part = {
        id: partId, origin: 'prepared', title: r.title, ownerId: by, finishLine: base?.finishLine ?? '', status: 'suggested', onDate: r.date ?? today,
        ...(sub.kind === 'event' && sub.need ? { need: sub.need } : base?.need ? { need: base.need } : {}),
        ...(r.time ? { cue: `At ${t12(r.time)}` } : base?.cue ? { cue: base.cue } : {}),
      };
      const agreed = partReducer([...s.parts.filter((x) => x.id !== partId), part], { type: 'agree', id: partId, today }, s.online)
        .map((x) => (x.id === partId ? { ...x, lastChangedBy: by, lastChangedOn: today } : x));
      next = { ...s, parts: agreed };
      if (sub.kind === 'occurrence') next = withIntel(next, { covers: { ...(intelOf(next).covers ?? {}), [doneKey(sub.partId, sub.date)]: partId } });
    }
  }
  const updated: HandRequest = { ...r, status: choice === 'accept' ? 'accepted' : 'declined', answeredOn: today, ...(partId ? { partId } : {}) };
  return { state: withIntel(next, { requests: { ...(intelOf(next).requests ?? {}), [id]: updated } }), ok: true };
}

/** The asker saw the answer (or took it back while still open). */
export function acknowledge(s: V16State, id: string, by: string, today: string): V16State {
  const r = intelOf(s).requests?.[id];
  if (!r || r.from !== by || r.status === 'asked' || r.acked) return s;
  return withIntel(s, { requests: { ...intelOf(s).requests, [id]: { ...r, acked: today } } });
}

/** "Decide at the Family Meeting": the asker leaves a declined request for the meeting. */
export function toMeeting(s: V16State, id: string, by: string, today: string): V16State {
  const r = intelOf(s).requests?.[id];
  if (!r || r.from !== by || r.status !== 'declined') return s;
  return withIntel(s, { requests: { ...intelOf(s).requests, [id]: { ...r, acked: today, meeting: today } } });
}

export function withdraw(s: V16State, id: string, by: string, today: string): V16State {
  const r = intelOf(s).requests?.[id];
  if (!r || r.from !== by || r.status !== 'asked') return s;
  return withIntel(s, { requests: { ...intelOf(s).requests, [id]: { ...r, status: 'withdrawn', answeredOn: today, acked: today } } });
}

export const takeId = (sub: Subject, title: string, date?: string | null) => uuidFrom(`take:${subjectKey(sub) || `${title}@${date ?? ''}`}`);

/** After a decline, the asker takes it themselves: for a standing part nothing changes (it was theirs); otherwise a one-time part. */
export function takeIt(s: V16State, a: { by: string; title: string; subject: Subject; date: string | null; time: string | null; today: string; cue?: string }): V16State {
  const sub = a.subject;
  if (sub.kind === 'occurrence' || sub.kind === 'part') {
    const p = s.parts.find((x) => x.id === sub.partId);
    if (p?.ownerId === a.by) return s;
  }
  const id = takeId(sub, a.title, a.date);
  if (s.parts.some((x) => x.id === id)) return s;
  const part: Part = { id, origin: 'prepared', title: clean(a.title), ownerId: a.by, finishLine: '', status: 'suggested', onDate: a.date ?? a.today,
    ...(sub.kind === 'event' && sub.need ? { need: sub.need } : {}),
    ...(a.time ? { cue: `At ${t12(a.time)}` } : a.cue ? { cue: a.cue } : {}) };
  const parts = partReducer([...s.parts, part], { type: 'agree', id, today: a.today }, s.online).map((x) => (x.id === id ? { ...x, lastChangedBy: a.by, lastChangedOn: a.today } : x));
  return { ...s, parts };
}

// ------------------------------------------------------------------ household memory

export const decisionsOf = (s: V16State) => Object.values(intelOf(s).decisions ?? {}).sort((a, b) => a.on.localeCompare(b.on) || a.id.localeCompare(b.id));

export function remember(s: V16State, d: Decision): V16State {
  return withIntel(s, { decisions: { ...(intelOf(s).decisions ?? {}), [d.id]: { ...d, text: clean(d.text).slice(0, 140) } } });
}
export function editDecision(s: V16State, id: string, patch: Partial<Pick<Decision, 'text' | 'ownerId' | 'choice'>>): V16State {
  const d = intelOf(s).decisions?.[id];
  if (!d) return s;
  return remember(s, { ...d, ...patch });
}
export function forgetDecision(s: V16State, id: string): V16State {
  const decisions = { ...(intelOf(s).decisions ?? {}) };
  delete decisions[id];
  return withIntel(s, { decisions });
}

/**
 * "Make this the usual": an explicit choice that turns an each-time decision into a standing weekly responsibility
 * for one person. The each-time decision is replaced by the agreement (it no longer needs asking every week).
 */
export function makeUsual(s: V16State, a: { decisionId: string; ownerId: string; time: string | null; today: string; by: string }): V16State {
  const d = intelOf(s).decisions?.[a.decisionId];
  if (!d || d.kind !== 'each-time' || !d.eventLink) return s;
  const id = uuidFrom(`usual:${d.id}`);
  const part: Part = { id, origin: 'prepared', title: d.title ?? d.text, ownerId: a.ownerId, finishLine: '', eventLink: d.eventLink, offsetDays: 0, need: d.need, status: 'suggested',
    ...(a.time ? { cue: `At ${t12(a.time)}` } : {}) };
  let parts = partReducer([...s.parts.filter((x) => x.id !== id), part], { type: 'agree', id, today: a.today }, s.online);
  parts = parts.map((x) => (x.id === id ? { ...x, lastChangedBy: a.by, lastChangedOn: a.today } : x));
  return forgetDecision({ ...s, parts }, d.id);
}

/** Change a standing agreement's words outside the meeting: re-agreed at once by the adult who changed it (owner unchanged). */
export function editStanding(s: V16State, partId: string, patch: Partial<Pick<Part, 'title' | 'finishLine' | 'cue'>>, by: string, today: string): V16State {
  const p = s.parts.find((x) => x.id === partId);
  if (!p || p.status !== 'agreed') return s;
  const next = { ...p, ...patch };
  return { ...s, parts: s.parts.map((x) => (x.id === partId ? { ...next, agreedSignature: signature(next), agreedOn: today, lastChangedBy: by, lastChangedOn: today,
    agreedCopy: { ownerId: next.ownerId, title: next.title, finishLine: next.finishLine, offsetDays: next.offsetDays, weekday: next.weekday } } : x)) };
}

// ------------------------------------------------------------------ event intent (no automatic obligations)

export type EventFamily = 'birthday' | 'holiday' | 'school' | 'appointment' | 'sports' | 'travel' | 'other';
export function familyOf(title: string): EventFamily {
  if (/birthday|b-?day/i.test(title)) return 'birthday';
  if (/thanksgiving|christmas|hanukkah|easter|holiday|new year|halloween|break\b/i.test(title)) return 'holiday';
  if (/concert|recital|play\b|performance|conference|field trip|school|teacher|class/i.test(title)) return 'school';
  if (/dentist|doctor|appointment|checkup|orthodont|vet\b/i.test(title)) return 'appointment';
  if (/soccer|practice|game|swim|match|tournament|lesson/i.test(title)) return 'sports';
  if (/trip|flight|travel|vacation|visit/i.test(title)) return 'travel';
  return 'other';
}

export interface IntentOption { id: string; label: string; title: string; lead: number; owner: 'adult' | 'child' | 'either' }

/** Possessor of a birthday: "Johan's birthday" → "Johan". */
const whose = (title: string) => title.match(/^(.+?)['’]s\b/)?.[1]?.trim() ?? null;

/** Contextual options for an event. Offered, never required. Always includes "Nothing needed". */
export function intentOptions(title: string): IntentOption[] {
  const f = familyOf(title);
  const name = whose(title);
  const them = name ?? 'them';
  const o = (id: string, label: string, t: string, lead: number, owner: IntentOption['owner'] = 'adult'): IntentOption => ({ id, label, title: t, lead, owner });
  switch (f) {
    case 'birthday': return [o('text', 'Send a text', `Send ${them} a birthday text`, 0), o('card', 'Mail a card', `Mail ${name ? `${name}’s` : 'the'} birthday card`, 2, 'either'),
      o('gift', 'Get a gift', `Get a gift for ${them}`, 2), o('party', 'Go to the party', `Go to ${name ? `${name}’s` : 'the'} party`, 0)];
    case 'holiday': return [o('plan', 'Plan something', `Plan our ${title}`, 3), o('host', 'Host or travel', `Sort out plans for ${title}`, 7)];
    case 'school': return [o('attend', 'Who’s going', `Go to the ${lower(title)}`, 0), o('ride', 'Arrange a ride', `Drive to the ${lower(title)}`, 0), o('outfit', 'Get ready the night before', `Lay out clothes for the ${lower(title)}`, 1, 'child')];
    case 'appointment': return [o('take', 'Who’s taking them', `Take them to the ${lower(title)}`, 0), o('forms', 'Paperwork', `Fill in forms for the ${lower(title)}`, 1)];
    case 'sports': return [o('gear', 'Pack the bag', `Pack the bag for ${lower(title)}`, 1, 'child'), o('ride', 'Arrange a ride', `Drive to ${lower(title)}`, 0)];
    case 'travel': return [o('pack', 'Packing', `Pack for the ${lower(title)}`, 1, 'either'), o('care', 'Home and pets', `Arrange care while we’re away`, 3)];
    default: return [o('task', 'Something to do', `Get ready for ${lower(title)}`, 0)];
  }
}

export const titleKey = (title: string) => clean(title).toLowerCase().replace(/[’']/g, "'");
export const intentKey = (link: string, date: string) => `${link}@${date}`;

/** A remembered preference for this event (by link, then by title). */
export function preferenceFor(s: V16State, link: string, title: string): Decision | null {
  const k = titleKey(title);
  return decisionsOf(s).find((d) => d.kind === 'preference' && (d.eventLink === link || d.titleKey === k)) ?? null;
}

/**
 * The family chose what to do about an event: a one-time agreed part for its owner (on the lead day), or "nothing
 * needed". When the owner is another adult, it becomes a request instead (no transfer until they accept).
 */
export function chooseIntent(s: V16State, a: { link: string; date: string; eventTitle: string; option: IntentOption | 'nothing'; ownerId: string | null; by: string; today: string; time?: string | null; adults: string[] }): V16State {
  const key = intentKey(a.link, a.date);
  const intents = { ...(intelOf(s).intents ?? {}) };
  if (a.option === 'nothing') {
    intents[key] = { choice: 'nothing', label: 'Nothing needed', by: a.by, on: a.today, nothing: true };
    return withIntel(s, { intents });
  }
  const opt = a.option;
  const when = addDays(a.date, -opt.lead);
  const due = when < a.today ? a.today : when;
  if (a.ownerId && a.ownerId !== a.by && a.adults.includes(a.ownerId)) {
    const r = askHelp(s, { from: a.by, to: a.ownerId, subject: { kind: 'event', link: a.link, date: a.date, need: opt.id }, title: opt.title, date: due, time: a.time ?? null, today: a.today });
    const st = r.state;
    return withIntel(st, { intents: { ...(intelOf(st).intents ?? {}), [key]: { choice: opt.id, label: opt.label, by: a.by, on: a.today, requestId: r.id ?? undefined } } });
  }
  const id = uuidFrom(`intent:${a.link}@${a.date}:${opt.id}`);
  // On its date only: preparing for this occurrence never repeats with a recurring event.
  const part: Part = { id, origin: 'prepared', title: opt.title, ownerId: a.ownerId ?? a.by, finishLine: '', onDate: due, need: opt.id, status: 'suggested' };
  let parts = partReducer([...s.parts.filter((x) => x.id !== id), part], { type: 'agree', id, today: a.today }, s.online);
  parts = parts.map((x) => (x.id === id ? { ...x, lastChangedBy: a.by, lastChangedOn: a.today } : x));
  intents[key] = { choice: opt.id, label: opt.label, by: a.by, on: a.today, partId: id };
  return withIntel({ ...s, parts }, { intents });
}

/** Take back a choice (the part goes too, if nobody has done it yet). */
export function clearIntent(s: V16State, link: string, date: string): V16State {
  const key = intentKey(link, date);
  const it = intelOf(s).intents?.[key];
  if (!it) return s;
  const intents = { ...intelOf(s).intents };
  delete intents[key];
  const parts = it.partId ? s.parts.filter((p) => !(p.id === it.partId && !p.done)) : s.parts;
  return withIntel({ ...s, parts }, { intents });
}

// ------------------------------------------------------------------ acknowledgements (per adult)

export const ackKey = (viewer: string, key: string) => `${viewer}|${key}`;
export const seen = (s: V16State, viewer: string, key: string) => Boolean(intelOf(s).acked?.[ackKey(viewer, key)]);
export const markSeen = (s: V16State, viewer: string, key: string, today: string) => withIntel(s, { acked: { ...(intelOf(s).acked ?? {}), [ackKey(viewer, key)]: today } });

// ------------------------------------------------------------------ routine cards

export const cardOf = (s: V16State, partId: string) => intelOf(s).cards?.[partId] ?? null;
export const saveCard = (s: V16State, partId: string, d: CardDraft) => withIntel(s, { cards: { ...(intelOf(s).cards ?? {}), [partId]: d } });

// ------------------------------------------------------------------ keeping the household document small

/** Old answered requests, past choices, completions and seen-markers leave the document; decisions and cards stay. */
export function pruneV21<T extends V21Intel>(x: T, today: string): T {
  const keep = (d: string | null | undefined, days: number) => !d || d >= addDays(today, -days);
  const req = x.requests && Object.fromEntries(Object.entries(x.requests).filter(([, r]) => r.status === 'asked' ? keep(r.date ?? r.askedOn, 14) : keep(r.date ?? r.answeredOn ?? r.askedOn, 21)));
  const dated = <V,>(o: Record<string, V> | undefined, days: number, field?: (v: V) => string) => o && Object.fromEntries(Object.entries(o).filter(([k, v]) => keep(field ? field(v) : k.split('@').pop(), days)));
  return { ...x, requests: req, intents: dated(x.intents, 30), done: dated(x.done, 60), covers: dated(x.covers, 30), acked: dated(x.acked, 30, (v) => v as unknown as string) };
}

// ------------------------------------------------------------------ small helpers

export const t12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
export const sameWeekday = (date: string, wd: number) => weekdayOf(date) === wd;
