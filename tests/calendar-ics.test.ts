/**
 * The iCal engine behind calendar subscriptions (supabase/functions/_shared/calendar/ics.ts): what a school or sports
 * calendar sends, and what the family should see.
 */
import { describe, expect, it } from 'vitest';
import { parseIcs } from '../supabase/functions/_shared/calendar/ics';

const cal = (body: string, head = '') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\n${head}${body}END:VCALENDAR\r\n`;
const ev = (lines: string[]) => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT\r\n`;
const window = { fromMs: Date.UTC(2026, 9, 1), toMs: Date.UTC(2027, 0, 31), householdTz: 'America/New_York' };

describe('iCal feeds', () => {
  it('a weekly practice keeps its local time across the daylight-saving change', () => {
    const r = parseIcs(cal(ev(['UID:soccer@club', 'SUMMARY:Soccer practice', 'DTSTART;TZID=America/New_York:20261006T163000',
      'DTEND;TZID=America/New_York:20261006T173000', 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261119T235959Z'])), window);
    const starts = r.instances.map((i) => i.starts_at);
    expect(starts[0]).toBe('2026-10-06T20:30:00.000Z'); // EDT, UTC-4
    expect(starts).toContain('2026-10-29T20:30:00.000Z');
    expect(starts).toContain('2026-11-03T21:30:00.000Z'); // EST after Nov 1, UTC-5: still 4:30 PM at home
    expect(starts.at(-1)).toBe('2026-11-19T21:30:00.000Z');
    expect(r.instances).toHaveLength(14);
    expect(r.instances[0].ends_at).toBe('2026-10-06T21:30:00.000Z');
  });

  it('a skipped date, a moved practice and a cancelled game', () => {
    const body = ev(['UID:p@club', 'SUMMARY:Practice', 'DTSTART;TZID=America/New_York:20261005T170000', 'DURATION:PT1H',
      'RRULE:FREQ=WEEKLY;COUNT=4', 'EXDATE;TZID=America/New_York:20261012T170000'])
      + ev(['UID:p@club', 'RECURRENCE-ID;TZID=America/New_York:20261019T170000', 'SUMMARY:Practice (moved to the gym)',
        'DTSTART;TZID=America/New_York:20261019T180000', 'DTEND;TZID=America/New_York:20261019T190000'])
      + ev(['UID:p@club', 'RECURRENCE-ID;TZID=America/New_York:20261026T170000', 'SUMMARY:Practice', 'STATUS:CANCELLED',
        'DTSTART;TZID=America/New_York:20261026T170000']);
    const r = parseIcs(cal(body), window);
    expect(r.instances.map((i) => [i.title, i.starts_at])).toEqual([
      ['Practice', '2026-10-05T21:00:00.000Z'],
      ['Practice (moved to the gym)', '2026-10-19T22:00:00.000Z'],
    ]);
    // The moved one keeps its original slot as its key, so a later edit replaces it rather than adding a copy.
    expect(r.instances[1].instance_key).toBe('2026-10-19T21:00:00.000Z');
  });

  it('all-day and multi-day events (DTEND is exclusive)', () => {
    const r = parseIcs(cal(ev(['UID:break@school', 'SUMMARY:Thanksgiving break', 'DTSTART;VALUE=DATE:20261125', 'DTEND;VALUE=DATE:20261128'])
      + ev(['UID:pic@school', 'SUMMARY:Picture day', 'DTSTART;VALUE=DATE:20261015'])), window);
    const brk = r.instances.find((i) => i.uid === 'break@school')!;
    expect(brk).toMatchObject({ all_day: true, start_date: '2026-11-25', end_date: '2026-11-27', starts_at: null });
    expect(r.instances.find((i) => i.uid === 'pic@school')).toMatchObject({ start_date: '2026-10-15', end_date: '2026-10-15' });
  });

  it('UTC, floating (calendar zone) and Outlook zone names', () => {
    const r = parseIcs(cal(ev(['UID:a', 'SUMMARY:UTC', 'DTSTART:20261020T150000Z', 'DTEND:20261020T160000Z'])
      + ev(['UID:b', 'SUMMARY:Floating', 'DTSTART:20261020T090000'])
      + ev(['UID:c', 'SUMMARY:Outlook', 'DTSTART;TZID=Eastern Standard Time:20261020T090000']), 'X-WR-TIMEZONE:America/Chicago\r\n'), window);
    const at = (uid: string) => r.instances.find((i) => i.uid === uid)!.starts_at;
    expect(at('a')).toBe('2026-10-20T15:00:00.000Z');
    expect(at('b')).toBe('2026-10-20T14:00:00.000Z'); // 9 AM Chicago (CDT)
    expect(at('c')).toBe('2026-10-20T13:00:00.000Z'); // 9 AM New York (EDT)
  });

  it('monthly by weekday ordinal, yearly, and a cancelled event', () => {
    const r = parseIcs(cal(ev(['UID:pta', 'SUMMARY:PTA', 'DTSTART;TZID=America/New_York:20261013T190000', 'RRULE:FREQ=MONTHLY;BYDAY=2TU'])
      + ev(['UID:bday', 'SUMMARY:Grandma’s birthday', 'DTSTART;VALUE=DATE:20201203', 'RRULE:FREQ=YEARLY'])
      + ev(['UID:gone', 'SUMMARY:Cancelled tournament', 'STATUS:CANCELLED', 'DTSTART;VALUE=DATE:20261107'])), window);
    expect(r.instances.filter((i) => i.uid === 'pta').map((i) => i.starts_at)).toEqual([
      '2026-10-13T23:00:00.000Z', '2026-11-11T00:00:00.000Z', '2026-12-09T00:00:00.000Z', '2027-01-13T00:00:00.000Z']);
    expect(r.instances.filter((i) => i.uid === 'bday').map((i) => i.start_date)).toEqual(['2026-12-03']);
    expect(r.instances.some((i) => i.uid === 'gone')).toBe(false);
  });

  it('folded lines, escaped text and the calendar name', () => {
    const r = parseIcs(cal(ev(['UID:f', 'SUMMARY:Field trip\\, museum', ' of science', 'LOCATION:Main St\\; Gate B', 'DTSTART;VALUE=DATE:20261022']), 'X-WR-CALNAME:Lincoln Elementary\r\n'), window);
    expect(r.name).toBe('Lincoln Elementary');
    expect(r.instances[0]).toMatchObject({ title: 'Field trip, museumof science', location: 'Main St; Gate B' });
  });

  it('refuses what it can’t expand, never guesses; refuses non-calendars', () => {
    const r = parseIcs(cal(ev(['UID:x', 'SUMMARY:Odd', 'DTSTART:20261020T150000Z', 'RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO,TU'])
      + ev(['UID:y', 'SUMMARY:No date'])), window);
    expect(r.instances).toHaveLength(0);
    expect(r.skipped).toBe(2);
    expect(() => parseIcs('<html>Sign in</html>', window)).toThrow('not_ical');
    expect(() => parseIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nDTSTART:20261120T100000Z\r\nEND:VEVENT\r\n', window)).toThrow('incomplete');
  });

  it('only the window, and never one occurrence twice', () => {
    const r = parseIcs(cal(ev(['UID:d', 'SUMMARY:Daily', 'DTSTART:20200101T120000Z', 'RRULE:FREQ=DAILY'])
      + ev(['UID:d2', 'SUMMARY:Dup', 'DTSTART:20261010T120000Z']) + ev(['UID:d2', 'SUMMARY:Dup', 'DTSTART:20261010T120000Z'])), window);
    const daily = r.instances.filter((i) => i.uid === 'd');
    expect(daily[0].starts_at).toBe('2026-10-01T12:00:00.000Z');
    expect(daily.at(-1)!.starts_at).toBe('2027-01-30T12:00:00.000Z');
    expect(r.instances.filter((i) => i.uid === 'd2')).toHaveLength(1);
  });
});
