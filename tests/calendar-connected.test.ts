/**
 * Connected calendars on the screen (src/lib/calendar/connected.ts): imported rows become read-only events in local
 * time, the same event on two calendars shows once, and the Family Meeting week includes them without counting them
 * as "nobody handling it".
 */
import { describe, expect, it } from 'vitest';
import { toDisplayEvents, sourceIndex, type ImportedRow, type SourceList } from '../src/lib/calendar/connected';
import { occurrences } from '../src/lib/calendar/recurrence';
import { weekAhead } from '../src/lib/family-meeting-support';

process.env.TZ = 'America/Chicago';

const sources: SourceList = {
  mine: [{ id: 'c1', provider: 'google', label: 'ana@gmail.com', status: 'active', last_error: null, calendars: [
    { id: 's-ana', name: 'Ana', color: null, selected: true, shared: true, member_ids: ['m-ana'], last_synced_at: null, sync_error: null },
    { id: 's-soccer', name: 'Sofia soccer', color: null, selected: true, shared: true, member_ids: ['m-sofia'], last_synced_at: null, sync_error: null },
  ] }],
  shared_with_me: [{ id: 's-school', name: 'Lincoln Elementary', provider: 'ical', member_ids: [], last_synced_at: null, stale: false }],
};
const row = (o: Partial<ImportedRow>): ImportedRow => ({
  id: Math.random().toString(16).slice(2), source_id: 's-ana', uid: 'u', title: 'x', location: null, notes: null, url: null, all_day: false,
  start_date: null, end_date: null, starts_at: null, ends_at: null, timezone: null, recurring: false, mine: true, ...o,
});

describe('connected events on the family calendar', () => {
  const idx = sourceIndex(sources);
  it('timed events land on the right local day and time, with the family colors of whose calendar it is', () => {
    const [e] = toDisplayEvents([row({ uid: 'game', title: 'U8 game', source_id: 's-soccer', starts_at: '2026-11-21T15:00:00Z', ends_at: '2026-11-21T16:30:00Z' })], idx);
    expect(e).toMatchObject({ starts_on: '2026-11-21', start_time: '09:00', end_time: '10:30', member_ids: ['m-sofia'], source: 'google', recurrence: null });
    expect(e.external).toMatchObject({ provider: 'google', sourceName: 'Sofia soccer', mine: true });
  });
  it('a late-evening UTC event stays on its local day; an overnight one spans both days', () => {
    expect(toDisplayEvents([row({ starts_at: '2026-11-21T03:30:00Z' })], idx)[0].starts_on).toBe('2026-11-20');
    const [trip] = toDisplayEvents([row({ title: 'Tournament', starts_at: '2026-11-20T23:00:00Z', ends_at: '2026-11-22T20:00:00Z' })], idx);
    expect(trip).toMatchObject({ starts_on: '2026-11-20', ends_on: '2026-11-22', end_time: null });
    expect(occurrences([trip], '2026-11-19', '2026-11-23').map((o) => `${o.date}${o.continued ? '+' : ''}`)).toEqual(['2026-11-20', '2026-11-21+', '2026-11-22+']);
  });
  it('all-day days off span their dates as written', () => {
    const [b] = toDisplayEvents([row({ source_id: 's-school', all_day: true, start_date: '2026-11-25', end_date: '2026-11-27', title: 'Thanksgiving Break', mine: false })], idx);
    expect(b).toMatchObject({ starts_on: '2026-11-25', ends_on: '2026-11-27', start_time: null });
    expect(occurrences([b], '2026-11-23', '2026-11-29')).toHaveLength(3);
  });
  it('the same event on two calendars shows once, preferring her own copy (with its link)', () => {
    const list = toDisplayEvents([
      row({ uid: 'same', source_id: 's-school', mine: false, title: 'Concert', starts_at: '2026-12-03T00:00:00Z' }),
      row({ uid: 'same', source_id: 's-ana', mine: true, title: 'Concert', starts_at: '2026-12-03T00:00:00Z', url: 'https://www.google.com/calendar/event?eid=1' }),
    ], idx);
    expect(list).toHaveLength(1);
    expect(list[0].external).toMatchObject({ sourceName: 'Ana', mine: true, url: 'https://www.google.com/calendar/event?eid=1', alsoOn: ['Lincoln Elementary'] });
  });
  it('rows from a calendar no longer listed are not shown', () => {
    expect(toDisplayEvents([row({ source_id: 'gone', starts_at: '2026-12-03T00:00:00Z' })], idx)).toHaveLength(0);
  });
  it('the Family Meeting week includes them, named by calendar, and never as "nobody handling it"', () => {
    const imported = toDisplayEvents([row({ source_id: 's-school', mine: false, all_day: true, start_date: '2026-11-20', end_date: '2026-11-20', title: 'No school' })], idx);
    const w = weekAhead(imported, '2026-11-18', new Date('2026-11-18T12:00:00Z'));
    expect(w.count).toBe(1);
    expect(w.unhandled).toBe(0);
    expect(w.changes).toEqual([]);
    expect(w.days.flatMap((d) => d.items)[0]).toMatchObject({ title: 'No school', from: 'Lincoln Elementary' });
  });
});
