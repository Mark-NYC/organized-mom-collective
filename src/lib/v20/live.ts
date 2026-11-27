/**
 * V20 in production: the approved screens run on the household's REAL data. Two pure functions (tests/v20-live.test.ts):
 *
 *   liveState(input)        the household's real records → the state the V20 screens render (src/lib/v16/model.ts)
 *   writesFor(prev, next)   what a V20 interaction changed → writes to the household's real stores
 *
 * The real stores stay the single source of truth, unchanged:
 *   agreements (household_agreements)      → agreed parts ("We agree", edits through the existing outbox)
 *   event responsibilities (calendar_event_tasks) → trackable preparation on imported events (shared checkboxes)
 *   priorities (household_priorities)      → What matters
 *   development records                    → Let's Practice (one explicit family decision each)
 *   meeting checkpoint                     → resume / finished
 *   cleaning marks + rhythm                → Everyone's part cleaning boxes, one-week moves
 *   calendar (own + connected)             → What matters, Plans, intelligence
 *   household_intelligence                 → memory, feedback, reports, history, shown, topics, claims, preferences,
 *                                            suggestions and handoffs not yet agreed, V20 details of agreements
 * No fictional family, no demo clock, no sample data: an empty household shows an empty, honest Today.
 */
import { weekStart, type CalendarEvent } from '../calendar/recurrence';
import type { EventTask } from '../calendar/event-tasks';
import type { AgreementRow } from '../agreements/store';
import type { Priority as DbPriority } from '../app/priorities';
import type { MeetingProgress } from '../app/meeting-progress';
import type { DevelopmentRecord } from '../family-development/records';
import type { ResponsibilityCategory } from '../../data/club/family-profile';
import { DAY_NAMES, signature, type Part, type Priority, type V16State } from '../v16/model';
import { emptyIntel, needsWork, type IntelState, type Person } from '../v18/engine';
import { emptyShared, type PartMeta, type SharedIntel } from './intel-sync';

export interface LiveInput {
  today: string;
  /** The signed-in adult's own family member id (the viewer). */
  viewer: string | null;
  adults: number;
  agreements: AgreementRow[];
  /** The family's own events and the connected calendars this adult may see (private ones are theirs only). */
  events: CalendarEvent[];
  tasks: EventTask[];
  tasksAvailable: boolean;
  priorities: DbPriority[];
  records: DevelopmentRecord[];
  meeting: MeetingProgress | null;
  cleaning: V16State['cleaning'];
  intel: SharedIntel | null;
  club: boolean;
  online: boolean;
  /** This device's meeting-session choices (Let's Practice answer, wall calendar), never shared. */
  session?: Pick<V16State, 'practice' | 'wall'> & { talkIndex?: number };
}

export const TASK = 'task:';
const NEEDS: [RegExp, string][] = [[/lunch/i, 'lunch'], [/drive|ride|pick ?up|drop ?off|carpool/i, 'ride'], [/gift|present/i, 'gift'], [/rsvp/i, 'rsvp'],
  [/card/i, 'card'], [/bag|gear|uniform|cleats/i, 'gear'], [/outfit|costume/i, 'outfit'], [/dinner|cook/i, 'dinner']];
export const needOf = (title: string) => NEEDS.find(([re]) => re.test(title))?.[1];
const weekdayOf = (when?: string | null) => {
  const i = when ? DAY_NAMES.findIndex((d) => new RegExp(`\\b${d}s?\\b`, 'i').test(when)) : -1;
  return i >= 0 ? i : undefined;
};

/** An agreement as a V20 part (agreed; edits make it "agree again", exactly as in the meeting). */
export function agreementPart(a: AgreementRow, meta: PartMeta | undefined, today: string): Part {
  const p: Part = {
    id: a.id, origin: a.source?.startsWith('club') ? 'month' : 'prepared', title: a.text, ownerId: a.owner_ids[0] ?? null, finishLine: a.finished ?? '',
    status: 'agreed', agreedOn: a.confirmed_at?.slice(0, 10), cue: meta?.cue ?? a.when ?? undefined,
    ...(meta?.eventLink ? { eventLink: meta.eventLink, offsetDays: meta.offsetDays ?? 0 } : meta?.onDate ? { onDate: meta.onDate } : { weekday: weekdayOf(a.when) }),
    need: meta?.need ?? needOf(a.text), askedBy: meta?.askedBy, lastChangedBy: meta?.lastChangedBy, lastChangedOn: meta?.lastChangedOn,
    done: Boolean(meta?.doneOn?.includes(today)),
  };
  return { ...p, agreedSignature: signature(p), agreedCopy: { ownerId: p.ownerId, title: p.title, finishLine: p.finishLine, offsetDays: p.offsetDays, weekday: p.weekday } };
}

/** An event responsibility (imported occurrence) as a V20 part: trackable, shared checkbox. */
export function taskPart(t: EventTask): Part {
  const p: Part = { id: `${TASK}${t.id}`, origin: 'prepared', title: t.title, ownerId: t.member_id, finishLine: '', eventLink: t.event_uid, offsetDays: 0,
    need: needOf(t.title), status: 'agreed', done: t.done, agreedOn: t.updated_at?.slice(0, 10) };
  return { ...p, agreedSignature: signature(p), agreedCopy: { ownerId: p.ownerId, title: p.title, finishLine: p.finishLine, offsetDays: 0 } };
}

const priority = (p: DbPriority, monday: string, latestEarlier: string | null): Priority | null => {
  const from = p.week_of === monday ? 'this-week' : p.week_of === latestEarlier ? 'last-meeting' : null;
  if (!from) return null;
  return p.kind === 'note' ? { id: p.id, kind: 'note', text: p.title, from } : { id: p.id, kind: 'event', eventLink: p.event_uid ?? undefined, from };
};

export function liveState(i: LiveInput): V16State {
  const monday = weekStart(i.today, 1);
  const shared = i.intel ?? emptyShared();
  const meta = shared.partMeta ?? {};
  const pendingById = shared.pendingParts ?? {};
  // An agreement being changed in a meeting shows as its edit (agree again) until the family agrees or ends it.
  const agreed = [...i.agreements.filter((a) => !a.deleted).map((a) => agreementPart(a, meta[a.id], i.today)), ...i.tasks.map(taskPart)]
    .map((p) => (pendingById[p.id] && pendingById[p.id].changedSinceAgreed ? { ...pendingById[p.id], agreedCopy: p.agreedCopy, agreedSignature: p.agreedSignature } : p));
  const pending = Object.values(pendingById).filter((p) => !agreed.some((a) => a.id === p.id));
  const earlier = [...new Set(i.priorities.map((p) => p.week_of).filter((w) => w < monday))].sort().pop() ?? null;
  const thisWeek = i.priorities.some((p) => p.week_of === monday);
  const priorities = i.priorities.map((p) => priority(p, monday, thisWeek ? null : earlier)).filter((p): p is Priority => Boolean(p));
  const intel: IntelState = { ...emptyIntel(i.viewer ?? ''), ...shared, viewer: i.viewer ?? '', aiAvailable: false };
  const m = i.meeting;
  const finishedOn = m?.completedAt ? m.completedAt.slice(0, 10) : undefined;
  return {
    v: 1, live: true,
    scenario: i.agreements.some((a) => !a.deleted && (a.confirmed_at ?? '') < monday) ? 'week4' : 'first',
    club: i.club, adults: i.adults > 1 ? 'two' : 'one', online: i.online, soccer: 'as-planned', feedVisibility: {},
    extraEvents: i.events, priorities, parts: [...agreed, ...pending], records: i.records,
    meeting: { step: (m && !m.completedAt ? m.step : 0) as V16State['meeting']['step'], started: Boolean(m && !m.completedAt), finishedOn, talkIndex: i.session?.talkIndex ?? 0, checkInDone: Boolean(finishedOn && finishedOn >= monday) },
    practice: i.session?.practice ?? {}, wall: i.session?.wall ?? { format: 'weekly', plan: null },
    cleaning: i.cleaning, intel,
  };
}

// ------------------------------------------------------------------ writes

export type Write =
  | { kind: 'agreement-save'; id?: string; replaces?: string; category: ResponsibilityCategory; text: string; ownerIds: string[]; finished?: string; when?: string; source?: string; meta: PartMeta }
  | { kind: 'task-save'; id?: string; replaces?: string; event?: CalendarEvent; title: string; memberId: string | null }
  | { kind: 'task-done'; id: string }
  | { kind: 'priority-add'; ref?: { source: 'family' | 'imported'; event_uid: string; instance_key: string }; note?: string }
  | { kind: 'priority-remove'; id: string }
  | { kind: 'development'; before: DevelopmentRecord | null; after: DevelopmentRecord }
  | { kind: 'meeting-step'; step: number }
  | { kind: 'meeting-finished' }
  | { kind: 'cleaning-check'; key: string }
  | { kind: 'cleaning-rhythm'; patch: Partial<V16State['cleaning']> }
  | { kind: 'event-save'; event: CalendarEvent }
  | { kind: 'intel'; update: (s: SharedIntel) => SharedIntel };

const CATEGORY: Record<string, ResponsibilityCategory> = { lunch: 'meals', dinner: 'meals', ride: 'transportation', pickup: 'transportation', gear: 'school-prep', outfit: 'belongings', gift: 'other', rsvp: 'other', card: 'other' };
export const categoryOf = (p: Part): ResponsibilityCategory =>
  (p.cleaningTask ? 'cleaning' : (p.need && CATEGORY[p.need]) || (p.skill === 'school-day-prep' ? 'school-prep' : p.skill === 'entryway' ? 'belongings' : 'other'));
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const metaOf = (p: Part): PartMeta => ({ eventLink: p.eventLink, offsetDays: p.eventLink ? p.offsetDays ?? 0 : undefined, need: p.need, onDate: p.onDate,
  askedBy: p.askedBy, lastChangedBy: p.lastChangedBy, lastChangedOn: p.lastChangedOn, cue: p.cue });
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** What the intelligence state stores (no per-device fields). */
export const sharedOf = (s: IntelState | undefined): Omit<SharedIntel, 'partMeta' | 'pendingParts'> => {
  if (!s) return {} as SharedIntel;
  const { viewer: _v, aiAvailable: _a, scenario: _s, clock: _c, ...rest } = s;
  return rest;
};

/**
 * What changed between two renders of the V20 state, as writes to the real stores. `eventOf` finds the occurrence a
 * part belongs to (imported events can carry a shared event responsibility).
 */
export function writesFor(prev: V16State, next: V16State, eventOf: (link: string) => CalendarEvent | null, ctx: { tasksAvailable: boolean; today: string }): Write[] {
  const out: Write[] = [];
  const before = new Map(prev.parts.map((p) => [p.id, p]));
  const metaChanges: Record<string, PartMeta | null> = {};
  const pendingChanges: Record<string, Part | null> = {};

  for (const p of next.parts) {
    const q = before.get(p.id);
    if (p.status === 'agreed') {
      const fresh = !q || q.status !== 'agreed' || q.agreedSignature !== p.agreedSignature || q.cue !== p.cue;
      if (fresh && p.ownerId) {
        if (p.id.startsWith(TASK)) {
          out.push({ kind: 'task-save', id: p.id.slice(TASK.length), title: p.title, memberId: p.ownerId });
        } else {
          const ev = p.eventLink ? eventOf(p.eventLink) : null;
          if (ev?.external?.uid && ev.external.instance_key && ctx.tasksAvailable && (p.offsetDays ?? 0) === 0 && !isUuid(p.id)) {
            // Preparation on an imported occurrence: a shared event responsibility with its own checkbox.
            out.push({ kind: 'task-save', replaces: p.id, event: ev, title: p.title, memberId: p.ownerId });
          } else {
            const id = isUuid(p.id) ? p.id : undefined;
            out.push({ kind: 'agreement-save', id, replaces: id ? undefined : p.id, category: categoryOf(p), text: p.title, ownerIds: [p.ownerId], finished: p.finishLine || undefined,
              when: p.cue ?? (p.weekday !== undefined ? `Every ${DAY_NAMES[p.weekday]}` : undefined), source: p.origin === 'month' ? 'club:month' : undefined,
              meta: clean(metaOf(p)) });
          }
        }
      }
      if (q && q.status !== 'agreed') pendingChanges[p.id] = null;
      if (q && Boolean(q.done) !== Boolean(p.done)) {
        if (p.id.startsWith(TASK)) out.push({ kind: 'task-done', id: p.id.slice(TASK.length) });
        else metaChanges[p.id] = { ...(metaChanges[p.id] ?? {}), doneOn: p.done ? [ctx.today] : [] };
      }
    } else if (!q || !sameJson(q, p)) {
      // A suggestion, a handoff, a kept idea: shared with the other adult until the family agrees.
      if (p.origin !== 'month' || p.status !== 'suggested') pendingChanges[p.id] = p;
    }
  }
  for (const q of prev.parts) if (!next.parts.some((p) => p.id === q.id) && q.status !== 'agreed') pendingChanges[q.id] = null;

  // What matters (this week's choices only; last meeting's stay as they were).
  const ids = (s: V16State) => new Set(s.priorities.filter((p) => p.from === 'this-week').map((p) => p.id));
  const was = ids(prev), now = ids(next);
  for (const p of next.priorities.filter((x) => x.from === 'this-week' && !was.has(x.id))) {
    if (p.kind === 'note') out.push({ kind: 'priority-add', note: p.text });
    else if (p.eventLink) {
      const ev = eventOf(p.eventLink);
      if (ev) out.push({ kind: 'priority-add', ref: ev.external?.uid ? { source: 'imported', event_uid: ev.external.uid, instance_key: ev.external.instance_key ?? ev.starts_on } : { source: 'family', event_uid: ev.id, instance_key: ev.starts_on } });
    }
  }
  for (const id of was) if (!now.has(id) && !id.startsWith('pr-')) out.push({ kind: 'priority-remove', id });

  // Let's Practice: one explicit family decision per changed record.
  for (const r of next.records) {
    const old = prev.records.find((x) => x.id === r.id) ?? null;
    if (!old || old.history.length !== r.history.length || old.stage !== r.stage || old.status !== r.status) out.push({ kind: 'development', before: old, after: r });
  }

  // The meeting checkpoint.
  if (next.meeting.finishedOn && next.meeting.finishedOn !== prev.meeting.finishedOn) out.push({ kind: 'meeting-finished' });
  else if (next.meeting.started && (!prev.meeting.started || next.meeting.step !== prev.meeting.step)) out.push({ kind: 'meeting-step', step: next.meeting.step });

  // Cleaning: one shared check per task; one-week moves.
  const keys = new Set([...Object.keys(prev.cleaning.checks), ...Object.keys(next.cleaning.checks)]);
  for (const k of keys) if (Boolean(prev.cleaning.checks[k]) !== Boolean(next.cleaning.checks[k])) out.push({ kind: 'cleaning-check', key: k });
  if (!sameJson(prev.cleaning.moved, next.cleaning.moved) || prev.cleaning.mode !== next.cleaning.mode || prev.cleaning.mainDay !== next.cleaning.mainDay) {
    out.push({ kind: 'cleaning-rhythm', patch: { moved: next.cleaning.moved, mode: next.cleaning.mode, mainDay: next.cleaning.mainDay } });
  }

  // The family's own events (a planned intention, a new event from Plans).
  for (const e of next.extraEvents) if (!e.external && !prev.extraEvents.some((x) => x.id === e.id)) out.push({ kind: 'event-save', event: e });

  // The household's intelligence state.
  const intelChanged = !sameJson(sharedOf(prev.intel), sharedOf(next.intel));
  if (intelChanged || Object.keys(metaChanges).length || Object.keys(pendingChanges).length) {
    const shared = sharedOf(next.intel);
    const base = sharedOf(prev.intel);
    out.push({ kind: 'intel', update: (s) => {
      // Field by field: only what this interaction changed, on top of the latest copy.
      let n: SharedIntel = { ...s };
      if (intelChanged) for (const k of Object.keys({ ...shared, ...base }) as (keyof typeof shared)[]) {
        if (!sameJson(shared[k], base[k])) (n as Record<string, unknown>)[k] = shared[k];
      }
      if (Object.keys(metaChanges).length) {
        const pm = { ...(n.partMeta ?? {}) };
        for (const [id, m] of Object.entries(metaChanges)) { if (m === null) delete pm[id]; else pm[id] = { ...(pm[id] ?? {}), ...m }; }
        n = { ...n, partMeta: pm };
      }
      if (Object.keys(pendingChanges).length) {
        const pp = { ...(n.pendingParts ?? {}) };
        for (const [id, p] of Object.entries(pendingChanges)) { if (p === null) delete pp[id]; else pp[id] = p; }
        n = { ...n, pendingParts: pp };
      }
      return n;
    } });
  }
  return out;
}

/**
 * Prepared suggestions for Everyone's Part from the family's REAL calendar: what this week's activities usually need
 * and nobody has yet (the V18 playbooks, the household's memory and development records), as Suggested proposals.
 * Never agreed, never assigned: the family keeps, changes, skips or agrees in the meeting.
 */
export function preparedParts(s: V16State, monday: string, today: string, people: Person[]): Part[] {
  const names = Object.fromEntries(people.map((p) => [p.id, p.firstName]));
  const until = Math.max(0, Math.round((Date.parse(`${monday}T12:00:00Z`) + 6 * 86_400_000 - Date.parse(`${today}T12:00:00Z`)) / 86_400_000));
  const out: Part[] = [];
  for (const i of needsWork({ s, monday, today, people }, names, { days: until, maxDue: until })) {
    const day = i.date ? DAY_NAMES[new Date(`${i.date}T12:00:00Z`).getUTCDay()] : '';
    for (const p of i.possibilities.filter((x) => !x.partId)) {
      const id = `prep:${p.eventLink}:${p.need}:${i.date}`;
      if (s.parts.some((x) => x.id === id || (x.eventLink === p.eventLink && x.need === p.need))) continue;
      out.push({ id, origin: 'prepared', title: p.title, ownerId: p.ownerId, finishLine: p.finish, eventLink: p.eventLink, offsetDays: p.offsetDays, need: p.need,
        skill: p.skill, status: 'suggested', why: `${i.evidence[0] ?? ''}${p.ownerWhy ? ` ${p.ownerWhy}` : ''}`.trim() || `For ${day}.` });
    }
  }
  return out;
}
