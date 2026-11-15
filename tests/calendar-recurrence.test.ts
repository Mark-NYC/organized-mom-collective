import { describe, expect, it } from 'vitest';
import { addDays, isDate, occurrences, repeatLabel, timeLabel, weekStart, weekday, type CalendarEvent } from '../src/lib/calendar/recurrence';

const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({ id: p.id ?? 'e', title: p.title ?? 'Swim', starts_on: '2026-11-16', timezone: 'America/New_York', member_ids: [], revision: 0, ...p });
const dates = (e: CalendarEvent | CalendarEvent[], from: string, to: string) => occurrences(Array.isArray(e) ? e : [e], from, to).map((o) => o.date);

describe('calendar dates', () => {
  it('does date math on calendar days, across DST and leap days', () => {
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02'); // US DST ends Nov 1, 2026
    expect(addDays('2027-03-13', 1)).toBe('2027-03-14'); // and starts Mar 14, 2027
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(weekday('2026-11-16')).toBe(1);
    expect(weekStart('2026-11-18')).toBe('2026-11-15');
    expect(weekStart('2026-11-18', 1)).toBe('2026-11-16');
    expect(isDate('2026-02-30')).toBe(false);
  });
});

describe('repeats', () => {
  it('weekly on Mon and Wed, starting mid-week, until a date, with a skipped day', () => {
    const swim = ev({ starts_on: '2026-11-18', recurrence: { freq: 'weekly', by_day: [1, 3], until: '2026-12-02' }, skip_dates: ['2026-11-25'] });
    expect(dates(swim, '2026-11-15', '2026-12-31')).toEqual(['2026-11-18', '2026-11-23', '2026-11-30', '2026-12-02']);
  });
  it('every 2 weeks keeps its days paired in the same week', () => {
    const e = ev({ starts_on: '2026-11-17', recurrence: { freq: 'weekly', interval: 2, by_day: [2, 4] } });
    expect(dates(e, '2026-11-15', '2026-12-13')).toEqual(['2026-11-17', '2026-11-19', '2026-12-01', '2026-12-03']);
  });
  it('weekly with no days repeats on the first date\'s weekday', () => {
    expect(dates(ev({ starts_on: '2026-11-20', recurrence: { freq: 'weekly' } }), '2026-11-15', '2026-12-05')).toEqual(['2026-11-20', '2026-11-27', '2026-12-04']);
  });
  it('daily every 3 days', () => {
    expect(dates(ev({ recurrence: { freq: 'daily', interval: 3 } }), '2026-11-16', '2026-11-25')).toEqual(['2026-11-16', '2026-11-19', '2026-11-22', '2026-11-25']);
  });
  it('monthly on the 31st lands on the last day of short months', () => {
    expect(dates(ev({ starts_on: '2027-01-31', recurrence: { freq: 'monthly' } }), '2027-01-01', '2027-05-31'))
      .toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
  });
  it('yearly on Feb 29 shows on Feb 28 in other years', () => {
    expect(dates(ev({ starts_on: '2028-02-29', recurrence: { freq: 'yearly' } }), '2028-01-01', '2030-12-31')).toEqual(['2028-02-29', '2029-02-28', '2030-02-28']);
  });
  it('never before its first date', () => {
    expect(dates(ev({ starts_on: '2026-12-01', recurrence: { freq: 'daily' } }), '2026-11-28', '2026-12-02')).toEqual(['2026-12-01', '2026-12-02']);
  });
});

describe('one-off and multi-day', () => {
  it('a one-off shows once; a deleted one never', () => {
    expect(dates(ev({ starts_on: '2026-11-18' }), '2026-11-15', '2026-11-21')).toEqual(['2026-11-18']);
    expect(dates(ev({ starts_on: '2026-11-18', deleted: true }), '2026-11-15', '2026-11-21')).toEqual([]);
  });
  it('an all-day trip spans its days, marked as continued after the first', () => {
    const trip = ev({ starts_on: '2026-11-26', ends_on: '2026-11-29', title: 'Grandma' });
    const o = occurrences([trip], '2026-11-22', '2026-11-28');
    expect(o.map((x) => [x.date, x.continued])).toEqual([['2026-11-26', false], ['2026-11-27', true], ['2026-11-28', true]]);
  });
  it('sorts all-day first, then by time', () => {
    const list = [ev({ id: 'b', title: 'Practice', start_time: '17:30' }), ev({ id: 'a', title: 'School', start_time: '08:00' }), ev({ id: 'c', title: 'Spirit day' })];
    expect(occurrences(list, '2026-11-16', '2026-11-16').map((o) => o.event.title)).toEqual(['Spirit day', 'School', 'Practice']);
  });
});

describe('labels', () => {
  it('times', () => {
    expect(timeLabel({ start_time: '16:15', end_time: '17:30' })).toBe('4:15–5:30 PM');
    expect(timeLabel({ start_time: '11:30', end_time: '13:00' })).toBe('11:30 AM–1 PM');
    expect(timeLabel({ start_time: '08:00' })).toBe('8 AM');
    expect(timeLabel({})).toBe('All day');
  });
  it('repeats', () => {
    expect(repeatLabel({ starts_on: '2026-11-16', recurrence: { freq: 'weekly', by_day: [3, 1] } })).toBe('Every Mon and Wed');
    expect(repeatLabel({ starts_on: '2026-11-17', recurrence: { freq: 'weekly', interval: 2, by_day: [2] } })).toBe('Every 2 weeks on Tue');
    expect(repeatLabel({ starts_on: '2026-11-22', recurrence: { freq: 'monthly' } })).toBe('Monthly on the 22nd');
    expect(repeatLabel({ starts_on: '2026-11-11', recurrence: { freq: 'monthly' } })).toBe('Monthly on the 11th');
    expect(repeatLabel({ starts_on: '2026-11-16', recurrence: { freq: 'daily', until: '2026-12-19' } })).toBe('Every day until Dec 19');
    expect(repeatLabel({ starts_on: '2026-11-16', recurrence: null })).toBeNull();
  });
});
