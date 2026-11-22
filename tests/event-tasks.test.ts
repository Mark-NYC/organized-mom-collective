import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { doneLabel, occurrenceOf, taskError, tasksFor, upcomingTasks, type EventTask } from '../src/lib/calendar/event-tasks';
import { toCalendarEvents, type Feed, type FeedEvent } from '../src/lib/calendar/feeds';

const src = (p: string) => readFileSync(p, 'utf8');
const feed: Feed = { id: 'f1', kind: 'google', name: 'Mateo soccer', visibility: 'household', member_id: 'mateo', mine: true, url_host: null, status: 'ok', last_error: null, event_count: 3, last_success_at: null };
const fe = (uid: string, key: string, starts: string, title = 'Soccer practice'): FeedEvent => ({
  feed_id: 'f1', uid, instance_key: key, title, location: null, all_day: false, starts_at: starts, ends_at: new Date(Date.parse(starts) + 3_600_000).toISOString(), start_date: null, end_date: null, status: 'confirmed',
});
const events = toCalendarEvents([
  fe('practice@team', '2026-12-01T23:30:00.000Z', '2026-12-01T23:30:00.000Z'),
  fe('practice@team', '2026-12-03T23:30:00.000Z', '2026-12-03T23:30:00.000Z'),
  fe('dinner@team', '2026-12-06T23:00:00.000Z', '2026-12-06T23:00:00.000Z', 'Sunday dinner'),
], [feed], 'America/Chicago');
const task = (o: Partial<EventTask>): EventTask => ({
  id: Math.random().toString(36), event_uid: 'practice@team', instance_key: '2026-12-01T23:30:00.000Z', feed_id: 'f1', single: false,
  event_title: 'Soccer practice', event_on: '2026-12-01', title: 'Pack soccer bag', member_id: 'mateo', done: false, done_at: null, updated_at: '', ...o,
});

describe('responsibilities on imported events', () => {
  it('each imported occurrence carries its source identity (UID + occurrence); the family’s own events have none', () => {
    expect(occurrenceOf(events[0])).toEqual({ uid: 'practice@team', instance_key: '2026-12-01T23:30:00.000Z' });
    expect(occurrenceOf({ external: undefined })).toBeNull();
  });
  it('a repeating event: each occurrence has its own responsibilities', () => {
    const list = [task({ title: 'Pack bag' }), task({ title: 'Drive', instance_key: '2026-12-03T23:30:00.000Z', event_on: '2026-12-03' })];
    expect(tasksFor(list, events[0]).map((t) => t.title)).toEqual(['Pack bag']);
    expect(tasksFor(list, events[1]).map((t) => t.title)).toEqual(['Drive']);
    expect(tasksFor(list, events[2])).toEqual([]);
  });
  it('the calendar row says how far along it is, in words', () => {
    expect(doneLabel([])).toBeNull();
    expect(doneLabel([task({ done: true }), task({}), task({})])).toBe('1 of 3 done');
    expect(doneLabel([task({ done: true })])).toBe('All done');
  });
  it('Today: the next 7 days in order, with their events; nothing before today or after the week', () => {
    const list = [
      task({ title: 'Bake flan', event_uid: 'dinner@team', instance_key: '2026-12-06T23:00:00.000Z', event_on: '2026-12-06' }),
      task({ title: 'Pack bag' }),
      task({ title: 'Next month', event_uid: 'x', instance_key: '2027-01-10', event_on: '2027-01-10' }),
      task({ title: 'Last week', event_uid: 'y', instance_key: '2026-11-20', event_on: '2026-11-20' }),
    ];
    const up = upcomingTasks(list, events, '2026-12-01');
    expect(up.map((x) => x.task.title)).toEqual(['Pack bag', 'Bake flan']);
    expect(up[0].event?.title).toBe('Soccer practice');
    expect(up[1].date).toBe('2026-12-06');
  });
  it('Today: an event that left the calendar shows its unfinished responsibilities (to remove), not finished ones', () => {
    const gone = [task({ title: 'Sign slip', event_uid: 'trip@lincoln', instance_key: '2026-12-04', event_on: '2026-12-04' }),
      task({ title: 'Done already', event_uid: 'trip@lincoln', instance_key: '2026-12-04', event_on: '2026-12-04', done: true })];
    const up = upcomingTasks(gone, events, '2026-12-01');
    expect(up.map((x) => [x.task.title, x.event])).toEqual([['Sign slip', null]]);
  });
  it('refusals read plainly', () => {
    expect(taskError(new Error('too_many'))).toMatch(/most for one event/);
    expect(taskError(new Error('not_found'))).toMatch(/isn’t on your calendar/);
    expect(taskError(new TypeError('Failed to fetch'))).toMatch(/offline/);
  });
});

describe('rollout and boundaries', () => {
  const sql = src('supabase/migrations/20261211000000_calendar_event_tasks.sql');
  it('off for everyone by default; on only for a tester household', () => {
    expect(sql).toMatch(/add column event_tasks boolean not null default false/);
    expect(sql).toMatch(/add column event_tasks_everyone boolean not null default false/);
    expect(sql).toMatch(/calendar_feeds_enabled\(p_uid\) and/);
  });
  it('never writes to imported events, subscriptions or the refresher; no table grants to the app', () => {
    expect(sql).not.toMatch(/(insert into|update|delete from) public\.calendar_feed_events/);
    expect(sql).not.toMatch(/(insert into|update|delete from) public\.calendar_feeds\b/);
    expect(sql).not.toMatch(/calendar_feed_store|calendar_feed_claim/);
    expect(sql).not.toMatch(/grant (select|insert|update|delete|all) on public\.calendar_event_tasks to (authenticated|anon)/);
    expect(sql).not.toMatch(/club_subscriptions|club_entitlements|club_invoices|stripe/i);
  });
  it('the app shows them only when available, never in the demo', () => {
    for (const f of ['src/components/calendar/FamilyCalendar.tsx', 'src/components/app/TodayDashboard.tsx']) {
      expect(src(f)).toMatch(/useEventTasks\(cal\.state\.scope !== 'local' && cal\.signedIn && !isDemo\(\) \? cal\.state\.scope : null\)/);
    }
    expect(src('src/components/calendar/CalendarSources.tsx')).toMatch(/tasks\?\.available && occurrenceOf\(e\)/);
  });
  it('the calendar grid gets words, not controls', () => {
    expect(src('src/components/calendar/FamilyCalendar.tsx')).toMatch(/data-event-tasks-label>\{tasksLabel\}<\/span>/);
  });
});
