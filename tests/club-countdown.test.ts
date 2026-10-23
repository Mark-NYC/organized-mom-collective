/**
 * The dated Back-to-School Countdown (src/lib/club/countdown.ts): suggested days counted back from the first day of
 * school, practical when time is short, never overwriting her own dates, and calendar-day safe in any time zone.
 */
import { describe, expect, it } from 'vitest';
import { kit as august } from '../src/data/club/kits/2027-08-school-year';
import {
  addDays, basisStart, countdownIcs, countdownText, daysBetween, dayLabel, isDay, localToday, longLabel, planCountdown, readCountdown, resetChanges,
  type CountdownState,
} from '../src/lib/club/countdown';

const items = august.action!.items;
const fresh = (): CountdownState => readCountdown(null, items.length);
const dates = (start: string, today: string, own: (string | null)[] = []) => planCountdown(items, start, today, own).lines.map((l) => l.date);

describe('calendar days', () => {
  it('subtracts across month and year boundaries', () => {
    expect(addDays('2027-09-03', -14)).toBe('2027-08-20');
    expect(addDays('2027-01-05', -10)).toBe('2026-12-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-12-25', '2027-01-04')).toBe(10);
  });

  it('knows leap years', () => {
    expect(addDays('2028-03-07', -7)).toBe('2028-02-29');
    expect(addDays('2027-03-07', -7)).toBe('2027-02-28');
    expect(addDays('2100-03-01', -1)).toBe('2100-02-28');
    expect(addDays('2000-03-01', -1)).toBe('2000-02-29');
    expect(isDay('2028-02-29')).toBe(true);
    expect(isDay('2027-02-29')).toBe(false);
    expect(isDay('2027-13-01')).toBe(false);
  });

  it('never shifts across a daylight-saving change or time zone', () => {
    // US clocks change on 2027-03-14 and 2027-11-07; whole-day arithmetic doesn't care.
    expect(addDays('2027-03-20', -14)).toBe('2027-03-06');
    expect(addDays('2027-11-10', -7)).toBe('2027-11-03');
    // Today is her local date: late evening in Los Angeles is still that day, even when UTC is already tomorrow.
    const lateEvening = new Date(2027, 7, 25, 23, 30);
    expect(localToday(lateEvening)).toBe('2027-08-25');
    expect(localToday(new Date(2027, 0, 1, 0, 5))).toBe('2027-01-01');
  });

  it('labels days as real dates', () => {
    expect(dayLabel('2027-08-24')).toBe('August 24');
    expect(longLabel('2027-08-25')).toBe('Wednesday, August 25');
    expect(longLabel('2028-09-05')).toBe('Tuesday, September 5');
  });
});

describe('planning the countdown', () => {
  it('without a first day: six lines, no dates', () => {
    const p = planCountdown(items, '', '2027-07-01');
    expect(p.status).toBe('undated');
    expect(p.lines.map((l) => l.date)).toEqual([null, null, null, null, null, null]);
  });

  it('with plenty of time: the owner’s schedule, as real dates', () => {
    const p = planCountdown(items, '2027-08-25', '2027-07-20');
    expect(p.status).toBe('ahead');
    expect(p.lines.map((l) => l.date)).toEqual(['2027-08-11', '2027-08-15', '2027-08-18', '2027-08-18', '2027-08-20', '2027-08-24']);
  });

  it('works for any school year, not just 2027', () => {
    expect(dates('2031-09-02', '2031-06-01')).toEqual(['2031-08-19', '2031-08-23', '2031-08-26', '2031-08-26', '2031-08-28', '2031-09-01']);
    expect(dates('2027-01-05', '2026-12-01')[0]).toBe('2026-12-22');
  });

  it('school in three days: past days move to today and tomorrow, two or three a day, the night before stays', () => {
    const p = planCountdown(items, '2027-08-25', '2027-08-22');
    expect(p.status).toBe('tight');
    expect(p.lines.map((l) => l.date)).toEqual(['2027-08-22', '2027-08-22', '2027-08-22', '2027-08-23', '2027-08-23', '2027-08-24']);
    expect(p.lines.slice(0, 5).every((l) => l.moved)).toBe(true);
    expect(p.lines.every((l) => l.date && daysBetween('2027-08-22', l.date) >= 0)).toBe(true);
  });

  it('nothing is ever overdue: no date before today', () => {
    for (let left = 3; left <= 20; left++) {
      const today = '2027-08-01';
      const p = planCountdown(items, addDays(today, left), today);
      for (const l of p.lines) expect(daysBetween(today, l.date!), `${left} days`).toBeGreaterThanOrEqual(0);
      const perDay = new Map<string, number>();
      for (const l of p.lines) perDay.set(l.date!, (perDay.get(l.date!) ?? 0) + 1);
      expect(Math.max(...perDay.values()), `${left} days`).toBeLessThanOrEqual(3);
    }
  });

  it('school starts tomorrow: only the essentials, today; the rest when you can', () => {
    const p = planCountdown(items, '2027-08-25', '2027-08-24');
    expect(p.status).toBe('last-minute');
    expect(p.lines.map((l) => l.date)).toEqual([null, '2027-08-24', null, '2027-08-24', null, '2027-08-24']);
    expect(p.lines.filter((l) => l.later).length).toBe(3);
  });

  it('school starts today, or already started: no dates, the countdown is done', () => {
    expect(planCountdown(items, '2027-08-25', '2027-08-25').status).toBe('today');
    const after = planCountdown(items, '2027-08-25', '2027-09-02');
    expect(after.status).toBe('started');
    expect(after.daysLeft).toBe(-8);
    expect(after.lines.every((l) => l.date === null)).toBe(true);
  });

  it('keeps her own dates when the first day changes, and says what a reset would change', () => {
    const own = [null, '2027-08-12', null, null, null, null];
    const before = planCountdown(items, '2027-08-25', '2027-07-01', own);
    expect(before.lines[1]).toMatchObject({ date: '2027-08-12', edited: true, suggested: '2027-08-15' });
    const after = planCountdown(items, '2027-09-01', '2027-07-01', own);
    expect(after.lines[1].date).toBe('2027-08-12');
    expect(after.lines[0].date).toBe('2027-08-18');
    expect(resetChanges(items, after)).toEqual([{ text: items[1].text, from: '2027-08-12', to: '2027-08-22' }]);
    // A date she picked that matches the suggestion isn't a change.
    expect(resetChanges(items, planCountdown(items, '2027-08-25', '2027-07-01', [null, '2027-08-15']))).toEqual([]);
  });
});

describe('saved countdown', () => {
  it('reads saved state safely and always has the family start', () => {
    const s = readCountdown({
      done: [true, 'yes'], helpers: ['Dad', 7, '  Ava   and   Ben '], dates: ['2027-08-11', '2027-02-30', 5],
      starts: [{ id: 'child-leo', label: 'Leo', childId: 'leo', date: '2027-09-02' }, { id: 'BAD ID', label: 'x', date: '' }], basis: 'child-leo',
    }, 6);
    expect(s.done).toEqual([true, false, false, false, false, false]);
    expect(s.helpers.slice(0, 3)).toEqual(['Dad', '', ' Ava and Ben ']);
    expect(s.dates).toEqual(['2027-08-11', null, null, null, null, null]);
    expect(s.starts.map((x) => x.id)).toEqual(['family', 'child-leo']);
    expect(basisStart(s)).toMatchObject({ label: 'Leo', date: '2027-09-02' });
    expect(readCountdown(null, 6)).toEqual(fresh());
    expect(basisStart(fresh()).id).toBe('family');
  });

  it('survives a save and reload with checks, dates, helpers and first days', () => {
    const s: CountdownState = { ...fresh(), done: [true, false, true, false, false, false], helpers: ['Luis', '', '', 'Ana', '', ''], dates: [null, '2027-08-14', null, null, null, null] };
    s.starts = [{ id: 'family', label: 'Everyone', date: '2027-08-25' }, { id: 'child-sofia', label: 'Sofia', childId: 'sofia', date: '2027-09-01' }];
    s.basis = 'child-sofia';
    expect(readCountdown(JSON.parse(JSON.stringify(s)), 6)).toEqual(s);
  });

  it('children on different days: one countdown, counted back from the start she picks', () => {
    const s = readCountdown({ starts: [{ id: 'family', label: 'Everyone', date: '2027-08-25' }, { id: 'child-leo', label: 'Leo', childId: 'leo', date: '2027-09-07' }] }, 6);
    expect(planCountdown(items, basisStart(s).date, '2027-07-01').lines[0].date).toBe('2027-08-11');
    const leo = { ...s, basis: 'child-leo' };
    expect(planCountdown(items, basisStart(leo).date, '2027-07-01').lines[0].date).toBe('2027-08-24');
    // A removed start falls back to the family's.
    expect(basisStart(readCountdown({ ...leo, starts: [s.starts[0]] }, 6)).id).toBe('family');
  });
});

describe('putting it on the family calendar', () => {
  const s: CountdownState = { ...fresh(), helpers: ['Luis', '', '', '', '', ''], done: [true, false, false, false, false, false] };
  const plan = planCountdown(items, '2027-08-25', '2027-07-20');

  it('copies as plain text with real dates', () => {
    const text = countdownText(august.action!.title, items, plan, s);
    expect(text.split('\n').slice(0, 4)).toEqual([
      'Our Back-to-School Countdown',
      'First day of school: Wednesday, August 25',
      '',
      '[x] Aug 11: Add school dates and activities to the family calendar. (Luis)',
    ]);
  });

  it('exports all-day events a phone calendar can import, with no account', () => {
    const ics = countdownIcs(august.slug, august.action!.title, items, plan, s, '20270720T120000Z');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(7);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270811\r\nDTEND;VALUE=DATE:20270812');
    expect(ics).toContain('SUMMARY:First day of school');
    expect(ics).toContain('SUMMARY:Add school dates and activities to the family calendar (Luis)');
    expect(ics).toContain('Decide who’s handling drop-off and pick-up');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    // Undated: only what has a date goes in.
    expect(countdownIcs(august.slug, 't', items, planCountdown(items, '', '2027-07-20'), s, '20270720T120000Z').match(/BEGIN:VEVENT/g)).toBeNull();
  });
});
