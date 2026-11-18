/**
 * Connected calendars, the pure parts (docs/ios/CALENDAR_INTEGRATION.md): time zones, repeat rules, .ics feeds, Google
 * events, feed-link safety and secret sealing.
 */
import { describe, expect, it } from 'vitest';
import { instantToZoned, normalizeZone, zonedToInstant } from '../supabase/functions/_shared/calendar/tz';
import { expandDates, parseRule } from '../supabase/functions/_shared/calendar/rrule';
import { expandFeed } from '../supabase/functions/_shared/calendar/ics';
import { authUrl, emailFromIdToken, fromGoogle, googleTrouble, sourcesFromList } from '../supabase/functions/_shared/calendar/google';
import { checkFeedUrl, feedFingerprint } from '../supabase/functions/_shared/calendar/feed-url';
import { open, pkceChallenge, randomToken, seal } from '../supabase/functions/_shared/calendar/secrets';

const NY = 'America/New_York';
const at = (iso: string) => Date.parse(iso);
const win = { from: at('2026-11-01T00:00:00Z'), to: at('2027-03-31T23:59:59Z'), familyZone: NY };
const ics = (...body: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...body, 'END:VCALENDAR'].join('\r\n');
const vevent = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

describe('time zones', () => {
  it('maps wall time to instants across daylight saving', () => {
    expect(new Date(zonedToInstant('2026-11-02', '17:30:00', NY)).toISOString()).toBe('2026-11-02T22:30:00.000Z'); // EST
    expect(new Date(zonedToInstant('2026-10-30', '17:30:00', NY)).toISOString()).toBe('2026-10-30T21:30:00.000Z'); // EDT
    expect(instantToZoned(at('2026-11-02T22:30:00Z'), 'America/Chicago')).toEqual({ date: '2026-11-02', time: '16:30:00' });
  });
  it('moves a skipped spring-forward time later and takes the first of a repeated fall-back time', () => {
    expect(new Date(zonedToInstant('2027-03-14', '02:30:00', NY)).toISOString()).toBe('2027-03-14T07:30:00.000Z');
    expect(new Date(zonedToInstant('2026-11-01', '01:30:00', NY)).toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });
  it('understands Outlook and mozilla zone names', () => {
    expect(normalizeZone('Eastern Standard Time')).toBe(NY);
    expect(normalizeZone('/mozilla.org/20050126_1/America/Denver')).toBe('America/Denver');
    expect(normalizeZone('"America/Chicago"')).toBe('America/Chicago');
    expect(normalizeZone('Not/AZone')).toBeNull();
  });
});

describe('repeat rules', () => {
  const run = (rule: string, start: string, last = '2027-12-31') => expandDates(parseRule(rule), start, last, () => false);
  it('weekly on two days, every other week, with COUNT', () => {
    expect(run('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=5', '2026-11-03')).toEqual(['2026-11-03', '2026-11-05', '2026-11-17', '2026-11-19', '2026-12-01']);
  });
  it('the second Monday and the last Friday of the month', () => {
    expect(run('FREQ=MONTHLY;BYDAY=2MO;COUNT=3', '2026-11-09')).toEqual(['2026-11-09', '2026-12-14', '2027-01-11']);
    expect(run('FREQ=MONTHLY;BYDAY=-1FR;COUNT=3', '2026-11-27')).toEqual(['2026-11-27', '2026-12-25', '2027-01-29']);
  });
  it('the last weekday of the month (BYSETPOS)', () => {
    expect(run('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=3', '2026-11-30')).toEqual(['2026-11-30', '2026-12-31', '2027-01-29']);
  });
  it('the 31st skips short months; BYMONTHDAY=-1 is the last day', () => {
    expect(run('FREQ=MONTHLY;COUNT=3', '2027-01-31')).toEqual(['2027-01-31', '2027-03-31', '2027-05-31']);
    expect(run('FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3', '2027-01-31')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });
  it('yearly birthdays, Feb 29 only in leap years', () => {
    expect(run('FREQ=YEARLY', '2024-02-29', '2032-12-31')).toEqual(['2024-02-29', '2028-02-29', '2032-02-29']);
  });
  it('stops at UNTIL and at the window, and keeps only the first of rules it cannot show faithfully', () => {
    expect(expandDates(parseRule('FREQ=DAILY'), '2026-11-01', '2026-11-30', (d) => d > '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(run('FREQ=HOURLY;COUNT=5', '2026-11-01')).toEqual(['2026-11-01']);
  });
  it('a hostile rule cannot run away', () => {
    const r = expandDates(parseRule('FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30'), '2026-01-01', '9999-12-31', () => false, 500);
    expect(r).toEqual(['2026-01-01']);
  });
});

describe('.ics feeds', () => {
  it('reads a school calendar: name, all-day days off, timed games in their zone', () => {
    const r = expandFeed(ics(
      'X-WR-CALNAME:Lincoln Elementary', 'X-WR-TIMEZONE:America/Chicago',
      vevent('UID:break@school', 'DTSTART;VALUE=DATE:20261125', 'DTEND;VALUE=DATE:20261128', 'SUMMARY:Thanksgiving Break\\, no school'),
      vevent('UID:game@league', 'DTSTART;TZID=America/Chicago:20261121T090000', 'DTEND;TZID=America/Chicago:20261121T103000', 'SUMMARY:U8 Soccer vs. Hawks', 'LOCATION:Field 3'),
      vevent('UID:old@school', 'DTSTART;VALUE=DATE:20250101', 'SUMMARY:Too old'),
    ), win);
    expect(r.name).toBe('Lincoln Elementary');
    expect(r.events).toHaveLength(2);
    const game = r.events.find((e) => e.uid === 'game@league')!;
    expect(game).toMatchObject({ all_day: false, starts_at: '2026-11-21T15:00:00.000Z', ends_at: '2026-11-21T16:30:00.000Z', timezone: 'America/Chicago', location: 'Field 3', title: 'U8 Soccer vs. Hawks' });
    expect(r.events.find((e) => e.uid === 'break@school')).toMatchObject({ all_day: true, start_date: '2026-11-25', end_date: '2026-11-27', title: 'Thanksgiving Break, no school' });
  });
  it('folded lines and escaped text', () => {
    const r = expandFeed(ics(vevent('UID:f', 'DTSTART:20261201T150000Z', 'SUMMARY:Winter con', ' cert\\nBring snacks')), win);
    expect(r.events[0].title).toBe('Winter concert\nBring snacks');
  });
  it('a weekly practice keeps its wall time across DST, minus a skipped date, with one moved and one cancelled', () => {
    const r = expandFeed(ics(
      vevent('UID:swim', 'DTSTART;TZID=America/New_York:20261026T161500', 'DURATION:PT1H', 'RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261124T045959Z', 'EXDATE;TZID=America/New_York:20261109T161500', 'SUMMARY:Swim'),
      vevent('UID:swim', 'RECURRENCE-ID;TZID=America/New_York:20261116T161500', 'DTSTART;TZID=America/New_York:20261117T170000', 'DTEND;TZID=America/New_York:20261117T180000', 'SUMMARY:Swim (moved)'),
      vevent('UID:swim', 'RECURRENCE-ID;TZID=America/New_York:20261102T161500', 'DTSTART;TZID=America/New_York:20261102T161500', 'STATUS:CANCELLED', 'SUMMARY:Swim'),
    ), { ...win, from: at('2026-10-20T00:00:00Z') });
    const local = r.events.map((e) => `${instantToZoned(Date.parse(e.starts_at!), NY).date} ${instantToZoned(Date.parse(e.starts_at!), NY).time.slice(0, 5)} ${e.title}`);
    expect(local).toEqual(['2026-10-26 16:15 Swim', '2026-11-17 17:00 Swim (moved)', '2026-11-23 16:15 Swim']);
    expect(new Set(r.events.map((e) => e.instance_key)).size).toBe(3);
    expect(r.events.every((e) => e.recurring && e.uid === 'swim')).toBe(true);
  });
  it('floating times use the family zone; UTC stays UTC', () => {
    const r = expandFeed(ics(vevent('UID:a', 'DTSTART:20261201T180000', 'SUMMARY:Floating'), vevent('UID:b', 'DTSTART:20261201T180000Z', 'SUMMARY:UTC')), win);
    expect(r.events.find((e) => e.uid === 'a')!.starts_at).toBe('2026-12-01T23:00:00.000Z');
    expect(r.events.find((e) => e.uid === 'b')!.starts_at).toBe('2026-12-01T18:00:00.000Z');
  });
  it('a re-published event (higher SEQUENCE) replaces the old copy; a reused UID on different dates stays two events', () => {
    const r = expandFeed(ics(
      vevent('UID:x', 'SEQUENCE:0', 'DTSTART;VALUE=DATE:20261205', 'SUMMARY:Bake sale'),
      vevent('UID:x', 'SEQUENCE:1', 'DTSTART;VALUE=DATE:20261205', 'SUMMARY:Bake sale (gym)'),
      vevent('UID:dup', 'DTSTART;VALUE=DATE:20261210', 'SUMMARY:Early release'),
      vevent('UID:dup', 'DTSTART;VALUE=DATE:20261217', 'SUMMARY:Early release'),
    ), win);
    expect(r.events.filter((e) => e.uid === 'x').map((e) => e.title)).toEqual(['Bake sale (gym)']);
    expect(r.events.filter((e) => e.uid === 'dup')).toHaveLength(2);
    expect(new Set(r.events.map((e) => e.instance_key)).size).toBe(r.events.length);
  });
  it('private events are flagged; cancelled events and non-https links dropped', () => {
    const r = expandFeed(ics(
      vevent('UID:p', 'DTSTART:20261201T150000Z', 'CLASS:PRIVATE', 'SUMMARY:Therapy', 'URL:javascript:alert(1)'),
      vevent('UID:c', 'DTSTART:20261201T150000Z', 'STATUS:CANCELLED', 'SUMMARY:Gone'),
    ), win);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ private: true, url: null });
  });
  it('an HTML page is not a calendar', () => {
    expect(expandFeed('<html><body>Sign in</body></html>', win)).toMatchObject({ notCalendar: true, events: [] });
  });
});

describe('Google', () => {
  it('builds a read-only PKCE consent link', () => {
    const u = new URL(authUrl({ clientId: 'cid', redirectUri: 'https://x.supabase.co/functions/v1/calendar-connect', state: 's', challenge: 'c' }));
    expect(u.searchParams.get('scope')).toContain('calendar.events.readonly');
    expect(u.searchParams.get('scope')).not.toMatch(/auth\/calendar(\s|$)/); // never the read-write scope
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('access_type')).toBe('offline');
  });
  it('reads timed, all-day, recurring and private occurrences; drops cancelled ones', () => {
    expect(fromGoogle({ id: 'a_20261121T150000Z', recurringEventId: 'a', iCalUID: 'a@google.com', summary: 'Soccer', start: { dateTime: '2026-11-21T09:00:00-06:00', timeZone: 'America/Chicago' }, end: { dateTime: '2026-11-21T10:30:00-06:00' }, htmlLink: 'https://www.google.com/calendar/event?eid=x' }, null))
      .toMatchObject({ instance_key: 'a_20261121T150000Z', uid: 'a@google.com', starts_at: '2026-11-21T15:00:00.000Z', ends_at: '2026-11-21T16:30:00.000Z', recurring: true, url: 'https://www.google.com/calendar/event?eid=x' });
    expect(fromGoogle({ id: 'b', start: { date: '2026-12-24' }, end: { date: '2026-12-27' }, visibility: 'private' }, NY))
      .toMatchObject({ all_day: true, start_date: '2026-12-24', end_date: '2026-12-26', private: true, title: '(No title)' });
    expect(fromGoogle({ id: 'c', status: 'cancelled', start: { date: '2026-12-24' } }, NY)).toBeNull();
  });
  it('lists calendars primary first and reads the email from the id token', () => {
    expect(sourcesFromList([{ id: 'b', summary: 'Work' }, { id: 'me@gmail.com', summary: 'me@gmail.com', primary: true, backgroundColor: '#9FC6E7' }, { id: 'x', deleted: true }]).map((s) => s.external_id)).toEqual(['me@gmail.com', 'b']);
    const tok = `h.${btoa(JSON.stringify({ email: 'Jen@Gmail.com' })).replace(/=+$/, '')}.s`;
    expect(emailFromIdToken(tok)).toBe('jen@gmail.com');
  });
  it('says when to ask her to reconnect', () => {
    expect(googleTrouble(400, { error: 'invalid_grant' })).toBe('reauth');
    expect(googleTrouble(401, null)).toBe('reauth');
    expect(googleTrouble(404, null)).toBe('gone');
    expect(googleTrouble(503, null)).toBe('retry');
  });
});

describe('feed links and secrets', () => {
  it('accepts webcal and https feeds, refuses private hosts and odd links', () => {
    expect(checkFeedUrl('webcal://calendar.school.org/feed.ics?k=abc')).toEqual({ ok: true, url: 'https://calendar.school.org/feed.ics?k=abc', host: 'calendar.school.org' });
    for (const bad of ['http://localhost/x.ics', 'https://10.0.0.5/x.ics', 'https://169.254.169.254/latest', 'http://[::1]/', 'https://printer.local/a', 'https://192.168.1.2/a']) expect(checkFeedUrl(bad)).toMatchObject({ ok: false, error: 'private_host' });
    for (const bad of ['ftp://x.org/a', 'https://u:p@x.org/a', 'https://x.org:8443/a', 'file:///etc/passwd']) expect(checkFeedUrl(bad).ok).toBe(false);
  });
  it('fingerprints ignore scheme and host case', async () => {
    expect(await feedFingerprint('https://X.org/a.ics?k=1')).toBe(await feedFingerprint('http://x.org/a.ics?k=1'));
  });
  it('seals secrets so only the same connection can open them', async () => {
    const k = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const sealed = await seal(k, 'refresh-token', 'conn-1');
    expect(sealed).not.toContain('refresh-token');
    expect(await open(k, sealed, 'conn-1')).toBe('refresh-token');
    await expect(open(k, sealed, 'conn-2')).rejects.toThrow();
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'); // RFC 7636 example
  });
});
