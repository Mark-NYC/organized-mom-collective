/** Imported occurrences → read-only calendar events (src/lib/calendar/feeds.ts). */
import { describe, expect, it } from 'vitest';
import { toCalendarEvents, type Feed, type FeedEvent } from '../src/lib/calendar/feeds';
import { occurrences } from '../src/lib/calendar/recurrence';
import { weekAhead } from '../src/lib/family-meeting-support';

const feed: Feed = { id: 'f1', kind: 'ical', name: 'Lincoln Elementary', visibility: 'household', member_id: 'maya', mine: true, url_host: null, status: 'ok', last_error: null, event_count: 2, last_success_at: null };
const ev = (o: Partial<FeedEvent>): FeedEvent => ({ feed_id: 'f1', uid: 'u', instance_key: 'k', title: 'Choir', location: null, all_day: false, starts_at: null, ends_at: null, start_date: null, end_date: null, status: 'confirmed', ...o });

describe('imported calendar events', () => {
  it('timed events land in the device zone, in the chosen person’s color, read-only', () => {
    const [e] = toCalendarEvents([ev({ starts_at: '2026-11-18T21:00:00Z', ends_at: '2026-11-18T22:00:00Z' })], [feed], 'America/New_York');
    expect(e).toMatchObject({ starts_on: '2026-11-18', start_time: '16:00', end_time: '17:00', member_ids: ['maya'], recurrence: null });
    expect(e.external).toEqual({ feed_id: 'f1', name: 'Lincoln Elementary', visibility: 'household', mine: true, tentative: false, uid: 'u', instance_key: 'k' });
    // Late evening UTC is the next day in Tokyo.
    expect(toCalendarEvents([ev({ starts_at: '2026-11-18T21:00:00Z', ends_at: '2026-11-18T22:00:00Z' })], [feed], 'Asia/Tokyo')[0].starts_on).toBe('2026-11-19');
  });

  it('all-day and multi-day events keep their dates; ending past midnight shows no end time', () => {
    const [a, b] = toCalendarEvents([
      ev({ uid: 'a', all_day: true, start_date: '2026-11-19', end_date: '2026-11-20' }),
      ev({ uid: 'b', starts_at: '2026-11-19T03:00:00Z', ends_at: '2026-11-19T06:00:00Z' }),
    ], [feed], 'America/New_York');
    expect(a).toMatchObject({ starts_on: '2026-11-19', ends_on: '2026-11-20', start_time: null });
    expect(occurrences([a], '2026-11-18', '2026-11-21').map((o) => o.date)).toEqual(['2026-11-19', '2026-11-20']);
    expect(b).toMatchObject({ starts_on: '2026-11-18', start_time: '22:00', end_time: null });
  });

  it('events of a calendar no longer listed are dropped', () => {
    expect(toCalendarEvents([ev({ feed_id: 'gone', all_day: true, start_date: '2026-11-19' })], [feed])).toEqual([]);
  });

  it('in the week ahead: labeled with the source, never "new" or "nobody handling it"', () => {
    const e = toCalendarEvents([ev({ all_day: true, start_date: '2026-11-19' })], [feed], 'America/New_York');
    const w = weekAhead(e, '2026-11-18', new Date('2026-11-18T12:00:00Z'));
    expect(w.unhandled).toBe(0);
    expect(w.changes).toEqual([]);
    expect(w.days.flatMap((d) => d.items)[0]).toMatchObject({ title: 'Choir', source: 'Lincoln Elementary' });
  });
});
