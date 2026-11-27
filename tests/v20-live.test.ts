/**
 * V20 in production (docs/ios/V20_LAUNCH.md): the live adapter. Real household records → the V20 state, and V20
 * interactions → writes to the real stores. Plus the intelligence document's three-way merge and pruning.
 */
import { describe, expect, test } from 'vitest';
import type { AgreementRow } from '../src/lib/agreements/store';
import type { EventTask } from '../src/lib/calendar/event-tasks';
import type { CalendarEvent } from '../src/lib/calendar/recurrence';
import { agreedParts, partReducer, signature, sharedOccurrences, type V16State } from '../src/lib/v16/model';
import { TASK, agreementPart, categoryOf, liveState, needOf, preparedParts, taskPart, writesFor, type LiveInput } from '../src/lib/v20/live';
import { emptyShared, merge3, prune, type SharedIntel } from '../src/lib/v20/intel-sync';
import { buildTodayV19 } from '../src/lib/v19/engine';

const today = '2026-11-27'; // a Friday
const monday = '2026-11-23';
const JEN = '11111111-1111-4111-8111-111111111111', SAM = '22222222-2222-4222-8222-222222222222', MAYA = '33333333-3333-4333-8333-333333333333';
const people = [{ id: JEN, firstName: 'Jen', kind: 'adult' as const }, { id: SAM, firstName: 'Sam', kind: 'adult' as const }, { id: MAYA, firstName: 'Maya', kind: 'child' as const, age: 11 }];
const agreement = (p: Partial<AgreementRow>): AgreementRow => ({ id: 'aaaaaaaa-0000-4000-8000-000000000001', category: 'meals', owner_ids: [JEN], text: 'Make dinner', when: 'Every Friday at 5:30 PM', revision: 3, confirmed_at: '2026-11-01T10:00:00Z', ...p });
const event = (p: Partial<CalendarEvent>): CalendarEvent => ({ id: 'ext:f:trip@school:2026-11-28', title: 'School field trip', starts_on: '2026-11-28', start_time: '08:30', end_time: '14:00', timezone: 'America/Chicago', member_ids: [MAYA], revision: 0,
  external: { feed_id: 'f', name: 'School', visibility: 'household', mine: true, tentative: false, uid: 'trip@school', instance_key: '2026-11-28' }, ...p });
const input = (p: Partial<LiveInput> = {}): LiveInput => ({
  today, viewer: JEN, adults: 2, agreements: [agreement({})], events: [], tasks: [], tasksAvailable: true, priorities: [], records: [], meeting: null,
  cleaning: { mode: 'printed', mainDay: 6, dailyReset: true, moved: {}, checks: {} }, intel: null, club: false, online: true, ...p,
});
const eventOf = (events: CalendarEvent[]) => (link: string) => events.find((e) => (e.external?.uid ?? e.id) === link) ?? null;

describe('real records → the V20 state', () => {
  test('a household with no records is an honest, empty state (no fictional family)', () => {
    const s = liveState(input({ agreements: [] }));
    expect(s.live).toBe(true);
    expect(s.parts).toEqual([]);
    expect(sharedOccurrences(s, monday)).toEqual([]);
    const { soccer: _demoFlag, ...data } = s; // the preview's demo switch (unused in production)
    expect(JSON.stringify(data)).not.toMatch(/Rivera|Sofia|Mateo|Luis|soccer/i);
    const m = buildTodayV19({ s, monday, today, people });
    expect(m.card).toBeNull();
  });

  test('an agreement keeps its words, owner and day; its V20 details come from the household’s state', () => {
    const p = agreementPart(agreement({}), { cue: 'Start at 5:30 PM', need: 'dinner' }, today);
    expect(p).toMatchObject({ status: 'agreed', title: 'Make dinner', ownerId: JEN, weekday: 5, cue: 'Start at 5:30 PM', need: 'dinner', agreedSignature: signature(p) });
  });

  test('an event responsibility is trackable preparation on its imported occurrence', () => {
    const t: EventTask = { id: 't1', event_uid: 'trip@school', instance_key: '2026-11-28', feed_id: 'f', single: true, event_title: 'School field trip', event_on: '2026-11-28', title: 'Pack lunch', member_id: MAYA, done: false, done_at: null, updated_at: '2026-11-26T10:00:00Z' };
    expect(taskPart(t)).toMatchObject({ id: `${TASK}t1`, eventLink: 'trip@school', ownerId: MAYA, need: 'lunch', status: 'agreed', done: false });
  });

  test('suggestions and handoffs come from the shared state; an edit in progress shows instead of its agreement', () => {
    const editing = { ...agreementPart(agreement({}), undefined, today), title: 'Make dinner early', status: 'kept' as const, changedSinceAgreed: true };
    const intel: SharedIntel = { ...emptyShared(), pendingParts: { [editing.id]: editing, 'p-v19-x': { id: 'p-v19-x', origin: 'prepared', title: 'Make dinner tonight', ownerId: SAM, finishLine: '', onDate: today, askedBy: JEN, status: 'suggested' } } };
    const s = liveState(input({ intel }));
    expect(s.parts.find((p) => p.id === editing.id)?.title).toBe('Make dinner early');
    expect(s.parts.find((p) => p.id === 'p-v19-x')).toMatchObject({ ownerId: SAM, askedBy: JEN, status: 'suggested' });
  });

  test('the viewer is the signed-in adult; the interpreter is off in production', () => {
    const s = liveState(input());
    expect(s.intel).toMatchObject({ viewer: JEN, aiAvailable: false });
  });

  test('meeting progress: in progress resumes, finished this week means checked in', () => {
    expect(liveState(input({ meeting: { step: 2, startedAt: '2026-11-27T10:00:00Z', updatedAt: '2026-11-27T10:05:00Z', completedAt: null } })).meeting).toMatchObject({ started: true, step: 2 });
    expect(liveState(input({ meeting: { step: 3, startedAt: '2026-11-23T10:00:00Z', updatedAt: '2026-11-23T10:30:00Z', completedAt: '2026-11-23T10:30:00Z' } })).meeting).toMatchObject({ started: false, finishedOn: '2026-11-23', checkInDone: true });
  });
});

describe('V20 interactions → writes to the real stores', () => {
  const base = liveState(input({ events: [event({})] }));

  test('"We agree" on a suggestion for an imported event: a shared event responsibility', () => {
    const next: V16State = { ...base, parts: [...base.parts, { id: 'prep:trip@school:lunch:2026-11-28', origin: 'prepared', title: 'Pack lunch', ownerId: MAYA, finishLine: '', eventLink: 'trip@school', offsetDays: 0, need: 'lunch', status: 'suggested' }] };
    const agreed = { ...next, parts: partReducer(partReducer(next.parts, { type: 'keep', id: 'prep:trip@school:lunch:2026-11-28' }, true), { type: 'agree', id: 'prep:trip@school:lunch:2026-11-28', today }, true) };
    const w = writesFor(next, agreed, eventOf([event({})]), { tasksAvailable: true, today });
    expect(w.map((x) => x.kind)).toContain('task-save');
    expect(w.find((x) => x.kind === 'task-save')).toMatchObject({ title: 'Pack lunch', memberId: MAYA, replaces: 'prep:trip@school:lunch:2026-11-28' });
  });

  test('"We agree" on a standing suggestion: a real agreement, with its V20 details kept for the household', () => {
    const next: V16State = { ...base, parts: [...base.parts, { id: 'p-v19-x', origin: 'prepared', title: 'Make dinner tonight', ownerId: SAM, finishLine: '', onDate: today, askedBy: JEN, need: 'dinner', status: 'kept' }] };
    const agreed = { ...next, parts: partReducer(next.parts, { type: 'agree', id: 'p-v19-x', today }, true) };
    const w = writesFor(next, agreed, eventOf([]), { tasksAvailable: true, today }).find((x) => x.kind === 'agreement-save');
    expect(w).toMatchObject({ kind: 'agreement-save', text: 'Make dinner tonight', ownerIds: [SAM], category: 'meals', replaces: 'p-v19-x', meta: { onDate: today, askedBy: JEN, need: 'dinner' } });
  });

  test('editing an agreement from a resolution (edit + agree) saves the same agreement', () => {
    const id = base.parts[0].id;
    let parts = partReducer(base.parts, { type: 'edit', id, patch: { cue: 'Start at 6:30 PM' } }, true);
    parts = partReducer(parts, { type: 'agree', id, today }, true);
    const w = writesFor(base, { ...base, parts }, eventOf([]), { tasksAvailable: true, today });
    expect(w.find((x) => x.kind === 'agreement-save')).toMatchObject({ id, when: 'Start at 6:30 PM' });
  });

  test('checking off preparation and cleaning, moving a zone', () => {
    const t = taskPart({ id: 't1', event_uid: 'trip@school', instance_key: '2026-11-28', feed_id: 'f', single: true, event_title: 'x', event_on: '2026-11-28', title: 'Pack lunch', member_id: MAYA, done: false, done_at: null, updated_at: '' });
    const s0 = { ...base, parts: [...base.parts, t] };
    const s1 = { ...s0, parts: partReducer(s0.parts, { type: 'toggle-done', id: t.id }, true), cleaning: { ...s0.cleaning, checks: { 'daily:2026-11-27:dishes': true as const }, moved: { [monday]: { 4: 5 } } } };
    const kinds = writesFor(s0, s1, eventOf([event({})]), { tasksAvailable: true, today }).map((x) => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(['task-done', 'cleaning-check', 'cleaning-rhythm']));
  });

  test('feedback, reports and preferences become one household-state write; nothing else is touched', () => {
    const next = { ...base, intel: { ...base.intel!, reports: [{ date: today, kind: 'lighter' as const, by: JEN }], notifyPrefs: { [JEN]: { meeting: true } } } };
    const w = writesFor(base, next, eventOf([]), { tasksAvailable: true, today });
    expect(w.map((x) => x.kind)).toEqual(['intel']);
    const applied = (w[0] as { update: (s: SharedIntel) => SharedIntel }).update({ ...emptyShared(), feedback: [{ key: 'k', fingerprint: 'f', pattern: 'p', kind: 'handled', on: today }] });
    expect(applied.reports).toHaveLength(1);
    expect(applied.feedback).toHaveLength(1); // the other adult's feedback survives
    expect(applied.notifyPrefs?.[JEN]).toEqual({ meeting: true });
  });

  test('a meeting that moves on and finishes writes the shared checkpoint', () => {
    const started = { ...base, meeting: { ...base.meeting, started: true, step: 1 as const } };
    expect(writesFor(base, started, eventOf([]), { tasksAvailable: true, today }).map((x) => x.kind)).toEqual(['meeting-step']);
    const done = { ...started, meeting: { ...started.meeting, started: false, finishedOn: today } };
    expect(writesFor(started, done, eventOf([]), { tasksAvailable: true, today }).map((x) => x.kind)).toEqual(['meeting-finished']);
  });

  test('nothing changed → no writes', () => {
    expect(writesFor(base, base, eventOf([]), { tasksAvailable: true, today })).toEqual([]);
  });

  test('categories for real agreements', () => {
    expect(categoryOf({ id: 'x', origin: 'prepared', title: 'Drive to soccer', ownerId: SAM, finishLine: '', need: 'ride', status: 'suggested' })).toBe('transportation');
    expect(needOf('Pick up after the field trip')).toBe('ride');
  });
});

describe('prepared suggestions from the real calendar', () => {
  test('this week’s field trip: lunch is suggested, grounded in the event', () => {
    const s = liveState(input({ events: [event({})] }));
    const p = preparedParts(s, monday, today, people);
    expect(p.map((x) => [x.title, x.status, x.eventLink, x.need])).toEqual([['Pack lunch for the field trip', 'suggested', 'trip@school', 'lunch']]);
    expect(agreedParts({ parts: p })).toEqual([]);
  });
  test('nothing on the calendar → no suggestions', () => {
    expect(preparedParts(liveState(input()), monday, today, people)).toEqual([]);
  });
});

describe('household intelligence: three-way merge and pruning', () => {
  test('two adults’ concurrent changes both survive', () => {
    const base: SharedIntel = { ...emptyShared(), feedback: [] , notifyPrefs: {} };
    const mine = { ...base, feedback: [{ key: 'a', fingerprint: '1', pattern: 'p', kind: 'handled' as const, on: today }], notifyPrefs: { [JEN]: { meeting: true } } };
    const theirs = { ...base, feedback: [{ key: 'b', fingerprint: '2', pattern: 'p', kind: 'dismissed' as const, on: today }], notifyPrefs: { [SAM]: { changed: false } } };
    const m = merge3(base, mine, theirs);
    expect(m.feedback?.map((f) => f.key).sort()).toEqual(['a', 'b']);
    expect(m.notifyPrefs).toEqual({ [JEN]: { meeting: true }, [SAM]: { changed: false } });
  });
  test('a removal on one side is respected', () => {
    const base = { ...emptyShared(), pendingParts: { x: { id: 'x' } as never, y: { id: 'y' } as never } };
    const mine = { ...base, pendingParts: { y: { id: 'y' } as never } };
    const theirs = { ...base, pendingParts: { ...base.pendingParts, z: { id: 'z' } as never } };
    expect(Object.keys(merge3(base, mine, theirs).pendingParts ?? {}).sort()).toEqual(['y', 'z']);
  });
  test('prune keeps the family’s lasting choices, drops old noise', () => {
    const s = prune({ ...emptyShared(), reports: [{ date: '2026-10-01', kind: 'lighter', by: JEN }], feedback: [{ key: 'a', fingerprint: '', pattern: 'p', kind: 'never', on: '2026-01-01' }, { key: 'b', fingerprint: '', pattern: 'p', kind: 'dismissed', on: '2026-01-01' }] }, today);
    expect(s.reports).toEqual([]);
    expect(s.feedback?.map((f) => f.key)).toEqual(['a']);
  });
});
