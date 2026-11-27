/**
 * V20 household notifications (docs/ios/V20_BASELINE.md → Notification rules). An extension of V19's attention
 * management, not a second system: the same shared state, the same insights (built per recipient, so privacy and
 * relevance hold), the same suppression. Pure functions; delivery is simulated in the preview.
 *
 * Only three purposes, ever:
 *   needs-you   someone asked you for a hand, or a responsibility needs an owner
 *   changed     something important changed: an imminent conflict in your plan, a shared agreement someone updated
 *   handled     something you were carrying is now handled ("Luis has dinner tonight ✓")
 * plus an optional Family Meeting reminder (off unless the adult turns it on).
 *
 * Never: routine chore or cleaning reminders, suggestions from the intelligence layer (invisible work, opportunities,
 * friction, ownership, seasons), completion notices for things the recipient wasn't carrying, anything to the person
 * who caused it, anything from someone else's private calendar, or a messaging thread.
 */
import { addDays } from '../calendar/recurrence';
import { partReducer, type Part, type V16State } from '../v16/model';
import { emptyIntel, nextMeeting, type TodayInput } from '../v18/engine';
import { buildTodayV19 } from '../v19/engine';
import { addFeedback } from '../v19/resolve';
import { answer, type V21Intel } from '../v21/model';

export type Purpose = 'needs-you' | 'changed' | 'handled' | 'meeting';
export type PushAction = 'got-it' | 'not-tonight' | 'open';

export interface NotifyPrefs { needsYou: boolean; changed: boolean; handled: boolean; meeting: boolean; quietStart: string; quietEnd: string }
export const DEFAULT_PREFS: NotifyPrefs = { needsYou: true, changed: true, handled: true, meeting: false, quietStart: '21:00', quietEnd: '07:00' };

export interface PushNote {
  /** Dedupe identity: kind + subject + its facts + recipient. The same facts never alert twice. */
  key: string;
  to: string;
  purpose: Purpose;
  kind: 'help' | 'handoff' | 'conflict' | 'agreement' | 'handled' | 'declined' | 'meeting';
  title: string;
  body: string;
  actions: PushAction[];
  urgent: boolean;
  partId?: string;
  /** V21: the handoff request this is about (src/lib/v21/model.ts). */
  requestId?: string;
  insightKey?: string;
  /** The insight's fingerprint (conflicts), to find everyone it reached. */
  insightFp?: string;
  status: 'deliver' | 'held' | 'scheduled' | 'off' | 'sent' | 'quiet';
  /** When it reaches the phone (held: after quiet hours; scheduled: a reminder). */
  at: { date: string; time: string };
  why: string;
}

/** Non-urgent alerts per adult per day before the rest arrive silently (never dropped). */
export const DAILY_ALERTS = 4;

const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const t12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`; };
const inQuiet = (now: string, p: NotifyPrefs) => (p.quietStart > p.quietEnd ? now >= p.quietStart || now < p.quietEnd : now >= p.quietStart && now < p.quietEnd);
export const prefsFor = (s: V16State, id: string): NotifyPrefs => ({ ...DEFAULT_PREFS, ...(s.intel?.notifyPrefs?.[id] ?? {}) });
const allowed = (p: NotifyPrefs, purpose: Purpose) => ({ 'needs-you': p.needsYou, changed: p.changed, handled: p.handled, meeting: p.meeting }[purpose]);

export interface NotifyInput extends TodayInput { now: string }

/** What the household's phones should show right now, per adult, with the rule that decided each one. */
export function outbox(inp: NotifyInput): PushNote[] {
  const { s, today, now, people } = inp;
  const intel = s.intel ?? emptyIntel('m-ana');
  const adults = people.filter((p) => p.kind === 'adult');
  const name = (id?: string | null) => people.find((p) => p.id === id)?.firstName ?? 'Someone';
  const isAdult = (id?: string | null) => adults.some((a) => a.id === id);
  const notes: Omit<PushNote, 'status' | 'at' | 'why'>[] = [];
  const live = (p: Part) => (p.onDate ?? today) >= today;

  // needs-you: a direct request, or a responsibility someone offered up without an owner.
  for (const p of s.parts.filter((x) => x.askedBy && (x.status === 'suggested' || x.status === 'kept') && live(x))) {
    if (p.ownerId && isAdult(p.ownerId) && p.ownerId !== p.askedBy) {
      notes.push({ key: `help:${p.id}:${p.ownerId}`, to: p.ownerId, purpose: 'needs-you', kind: 'help', urgent: (p.onDate ?? today) === today, partId: p.id, actions: ['got-it', 'not-tonight'],
        title: `${name(p.askedBy)} asked for a hand`, body: `${p.title}${p.cue ? ` · ${p.cue}` : ''}${p.onDate && p.onDate !== today ? ` · ${p.onDate === addDays(today, 1) ? 'tomorrow' : p.onDate}` : ''}` });
    } else if (!p.ownerId) {
      for (const a of adults.filter((x) => x.id !== p.askedBy)) {
        notes.push({ key: `handoff:${p.id}:${a.id}`, to: a.id, purpose: 'needs-you', kind: 'handoff', urgent: (p.onDate ?? today) === today, partId: p.id, actions: ['got-it', 'open'],
          title: 'Someone’s needed', body: `Who can take “${p.title}”?` });
      }
    }
  }
  // V21 requests (one explicit ask between adults): the person asked gets it with both answers; the asker hears the
  // answer once (unless they've already seen it on Today).
  const when = (date: string | null, time: string | null) => [date ? (date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : DAY[new Date(`${date}T12:00:00Z`).getUTCDay()]) : null, time ? t12(time) : null].filter(Boolean).join(' · ');
  const requestParts = new Set<string>();
  for (const r of Object.values((intel as V21Intel).requests ?? {})) {
    if (r.partId) requestParts.add(r.partId);
    if ((r.date && r.date < today) || !isAdult(r.to) || !isAdult(r.from)) continue;
    if (r.status === 'asked') {
      notes.push({ key: `request:${r.id}:${r.to}`, to: r.to, purpose: 'needs-you', kind: 'help', urgent: (r.date ?? today) === today, requestId: r.id, actions: ['got-it', 'not-tonight'],
        title: r.ask, body: [when(r.date, r.time), `From ${name(r.from)}`].filter(Boolean).join(' · ') });
    } else if (r.status === 'accepted' && !r.acked) {
      notes.push({ key: `request-handled:${r.id}:${r.from}`, to: r.from, purpose: 'handled', kind: 'handled', urgent: false, requestId: r.id, actions: [],
        title: `${name(r.to)} has it ✓`, body: [r.title, when(r.date, r.time)].filter(Boolean).join(' · ') });
    } else if (r.status === 'declined' && !r.acked) {
      const stillYours = (r.subject.kind === 'occurrence' || r.subject.kind === 'part') && r.prevOwner === r.from;
      notes.push({ key: `request-declined:${r.id}:${r.from}`, to: r.from, purpose: 'changed', kind: 'declined', urgent: (r.date ?? today) === today, requestId: r.id, actions: ['open'],
        title: `${name(r.to)} can’t take it`, body: `${r.title}${stillYours ? ' stays with you.' : ' still needs a plan.'}` });
    }
  }
  // handled: only to the person who was carrying it (the one who asked).
  for (const p of s.parts.filter((x) => x.askedBy && x.ownerId && x.ownerId !== x.askedBy && live(x))) {
    if (!isAdult(p.askedBy)) continue;
    if (p.status === 'agreed') notes.push({ key: `handled:${p.id}:${p.askedBy}`, to: p.askedBy!, purpose: 'handled', kind: 'handled', urgent: false, partId: p.id, actions: [], title: `${name(p.ownerId)} has it ✓`, body: p.title });
    if (p.status === 'skipped') notes.push({ key: `declined:${p.id}:${p.askedBy}`, to: p.askedBy!, purpose: 'changed', kind: 'declined', urgent: true, partId: p.id, actions: ['open'], title: `${name(p.ownerId)} can’t take it`, body: `${p.title} still needs someone.` });
  }
  // changed: an imminent conflict in a plan you own, from the same insights Today uses, built for each recipient.
  for (const a of adults) {
    const m = buildTodayV19({ ...inp, s: { ...s, intel: { ...intel, viewer: a.id } } });
    const stopped = new Set(m.suppressed.map((x) => x.insight.key));
    for (const i of m.all.filter((x) => x.category === 'changed' && x.urgent && x.affected.length && x.destination === 'today' && !stopped.has(x.key))) {
      const owners = i.affected.map((x) => x.current?.ownerId).filter((id): id is string => Boolean(id) && isAdult(id));
      // The adult whose plan it is; if it's a child's or nobody's, both adults.
      if (owners.length ? !owners.includes(a.id) : false) continue;
      if (intel.claims?.[i.key]) continue;
      // Spoken to the recipient: "Your transportation plan", never their own name.
      const you = (t: string) => t.replace(new RegExp(`(^|\\. )${a.firstName}’s`, 'g'), '$1Your').replace(new RegExp(`${a.firstName}’s`, 'g'), 'your');
      notes.push({ key: `conflict:${i.fingerprint}:${a.id}`, to: a.id, purpose: 'changed', kind: 'conflict', urgent: true, insightKey: i.key, insightFp: i.fingerprint, actions: ['got-it', 'open'],
        title: you(i.title), body: you(i.body) });
    }
  }
  // handled: someone took care of a change you were also carrying.
  for (const [key, c] of Object.entries(intel.claims ?? {})) {
    if (c.on !== today) continue;
    for (const a of adults.filter((x) => x.id !== c.by && c.notified.includes(x.id))) {
      notes.push({ key: `claimed:${key}:${a.id}`, to: a.id, purpose: 'handled', kind: 'handled', urgent: false, insightKey: key, actions: [], title: `${name(c.by)} has it ✓`, body: c.title });
    }
  }
  // changed: a shared agreement someone else updated today (never to the person who changed it).
  // Standing agreements only: a one-time plan or an accepted request already has its own notice.
  for (const p of s.parts.filter((x) => x.status === 'agreed' && x.lastChangedBy && x.lastChangedOn === today && !requestParts.has(x.id) && !(x.onDate && !x.askedBy))) {
    for (const a of adults.filter((x) => x.id !== p.lastChangedBy)) {
      notes.push({ key: `agreement:${p.id}:${p.agreedSignature}:${a.id}`, to: a.id, purpose: 'changed', kind: 'agreement', urgent: false, partId: p.id, actions: ['open'],
        title: `${name(p.lastChangedBy)} updated a shared plan`, body: `${p.ownerId ? `${name(p.ownerId)} · ` : ''}${p.title}${p.cue ? ` · ${p.cue}` : ''}` });
    }
  }
  // meeting (optional): an hour before a Family Meeting that's on the calendar.
  const meeting = nextMeeting(inp);
  if (meeting?.event.start_time) {
    for (const a of adults.filter((x) => prefsFor(s, x.id).meeting)) {
      const agenda = buildTodayV19({ ...inp, s: { ...s, intel: { ...intel, viewer: a.id } } }).agenda.length;
      notes.push({ key: `meeting:${meeting.date}:${a.id}`, to: a.id, purpose: 'meeting', kind: 'meeting', urgent: false, actions: ['open'],
        title: `Family Meeting at ${t12(meeting.event.start_time)}`, body: agenda ? `${agenda} thing${agenda === 1 ? '' : 's'} to talk about.` : 'Your plan for the week ahead.' });
    }
  }

  // Delivery rules, per recipient.
  const sent = intel.sent ?? {};
  const alertsToday: Record<string, number> = {};
  for (const v of Object.values(sent)) if (v.date === today && !v.urgent) alertsToday[v.to] = (alertsToday[v.to] ?? 0) + 1;
  return notes.map((n) => {
    const p = prefsFor(s, n.to);
    const base = { ...n, at: { date: today, time: now } };
    if (!allowed(p, n.purpose)) return { ...base, status: 'off' as const, why: 'Turned off in their notification settings.' };
    if (sent[n.key]) return { ...base, status: 'sent' as const, at: { date: sent[n.key].date, time: sent[n.key].time }, why: 'Already delivered; the same facts never alert twice.' };
    if (n.kind === 'meeting') {
      const [h, m] = meeting!.event.start_time!.split(':').map(Number);
      const time = `${String(h - 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (meeting!.date > today || now < time) return { ...base, status: 'scheduled' as const, at: { date: meeting!.date, time }, why: 'An hour before the meeting.' };
      if (now >= meeting!.event.start_time!) return { ...base, status: 'off' as const, why: 'The meeting has started.' };
    }
    if (inQuiet(now, p)) return { ...base, status: 'held' as const, at: { date: now >= p.quietStart ? addDays(today, 1) : today, time: p.quietEnd }, why: 'Quiet hours: it waits until morning.' };
    if (!n.urgent && (alertsToday[n.to] ?? 0) >= DAILY_ALERTS) return { ...base, status: 'quiet' as const, why: 'Delivered without sound: enough alerts today.' };
    return { ...base, status: 'deliver' as const, why: n.urgent ? 'Needs attention today.' : 'Worth knowing now.' };
  });
}

/** Record delivery (dedupe across renders and devices). */
export function markSent(s: V16State, notes: PushNote[], today: string, now: string): V16State {
  const fresh = notes.filter((n) => n.status === 'deliver' || n.status === 'quiet');
  if (!fresh.length) return s;
  const intel = s.intel ?? emptyIntel('m-ana');
  const sent = { ...(intel.sent ?? {}) };
  for (const n of fresh) sent[n.key] = { to: n.to, date: today, time: now, urgent: n.urgent };
  return { ...s, intel: { ...intel, sent } };
}

/**
 * "I've got it": the recipient confirms ownership, and the shared plan changes for everyone.
 *   help     → their agreement to the request (the same "We agree" as anywhere else)
 *   handoff  → they become the owner, and agree
 *   conflict → they're handling it: the insight is resolved for the household, and whoever else was carrying it hears so
 */
export function gotIt(s: V16State, n: PushNote, ctx: { today: string; people: { id: string; kind: string }[] }): V16State {
  if (n.requestId) return answer(s, n.requestId, n.to, 'accept', ctx.today).state;
  if (n.kind === 'help' || n.kind === 'handoff') {
    let parts = s.parts;
    if (n.kind === 'handoff') parts = partReducer(parts, { type: 'edit', id: n.partId!, patch: { ownerId: n.to } }, s.online);
    parts = partReducer(parts, { type: 'agree', id: n.partId!, today: ctx.today }, s.online);
    return { ...s, parts };
  }
  if (n.kind === 'conflict') {
    const intel = s.intel ?? emptyIntel('m-ana');
    const adults = ctx.people.filter((p) => p.kind === 'adult').map((p) => p.id);
    const notified = Object.entries(intel.sent ?? {}).filter(([k]) => k.startsWith(`conflict:${n.insightFp}:`)).map(([, v]) => v.to);
    const next = { ...s, intel: { ...intel, claims: { ...(intel.claims ?? {}), [n.insightKey!]: { by: n.to, on: ctx.today, title: n.title, notified: notified.length ? notified : adults } } } };
    return addFeedback(next, { key: n.insightKey!, fingerprint: n.insightFp!, pattern: 'chg' }, 'handled', ctx.today);
  }
  return s;
}

/** "Not tonight": the request is declined; the person who asked hears it still needs someone. */
export function notTonight(s: V16State, n: PushNote): V16State {
  if (n.requestId) return answer(s, n.requestId, n.to, 'decline', n.at.date).state;
  return { ...s, parts: partReducer(s.parts, { type: 'skip', id: n.partId! }, s.online) };
}
