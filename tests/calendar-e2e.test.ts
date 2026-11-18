/**
 * Connected calendars end to end (docs/ios/CALENDAR_INTEGRATION.md): the real calendar-connect handler against a real
 * Postgres with every migration (RLS, grants, the SQL functions), a fake Google (OAuth + Calendar API), fake feed hosts
 * and fake Supabase Auth. Needs a throwaway database:
 *
 *   PGHOST=… PGUSER=postgres npm run test:calendar
 *
 * Skipped without CLUB_E2E_PSQL (plain `npm test`).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createCalendarHandler } from '../supabase/functions/_shared/handlers/calendar';
import { readCalendarEnv, type CalendarDeps } from '../supabase/functions/_shared/calendar/deps';
import { PSQL, psqlDb, sql } from './club/harness';

const SITE = 'https://www.organizedmomcollective.com';
const SUPABASE = 'https://proj.supabase.test';
const MOM = '00000000-0000-0000-0000-0000000ce101';
const DAD = '00000000-0000-0000-0000-0000000ce102';
const tokens = new Map([['tok-mom', MOM], ['tok-dad', DAD]]);
const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString('base64');
const NOW = Date.parse('2026-11-18T12:00:00Z');

// ------------------------------------------------------------------ fake Google and feed hosts

const google = {
  refreshValid: true,
  revoked: [] as string[],
  calendars: [
    { id: 'ana@gmail.com', summary: 'ana@gmail.com', primary: true, backgroundColor: '#9fc6e7', timeZone: 'America/Chicago' },
    { id: 'family123@group.calendar.google.com', summary: 'Sofia soccer' },
  ],
  events: {
    'ana@gmail.com': [
      { id: 'e1', iCalUID: 'e1@google.com', summary: 'Dentist', start: { dateTime: '2026-11-20T09:00:00-06:00' }, end: { dateTime: '2026-11-20T10:00:00-06:00' }, htmlLink: 'https://www.google.com/calendar/event?eid=e1' },
      { id: 'r1_20261121', recurringEventId: 'r1', iCalUID: 'r1@google.com', summary: 'Piano', start: { dateTime: '2026-11-21T10:00:00-06:00' }, end: { dateTime: '2026-11-21T10:30:00-06:00' } },
      { id: 'r1_20261128', recurringEventId: 'r1', iCalUID: 'r1@google.com', summary: 'Piano', start: { dateTime: '2026-11-28T10:00:00-06:00' }, end: { dateTime: '2026-11-28T10:30:00-06:00' } },
      { id: 'x', status: 'cancelled', start: { date: '2026-11-22' } },
    ],
  } as Record<string, unknown[]>,
};
const feeds = new Map<string, { status: number; body?: string; headers?: Record<string, string> }>();
const ics = (...ev: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Lincoln Elementary', ...ev, 'END:VCALENDAR'].join('\r\n');
const SCHOOL = ics(
  'BEGIN:VEVENT', 'UID:break@lincoln', 'DTSTART;VALUE=DATE:20261125', 'DTEND;VALUE=DATE:20261128', 'SUMMARY:Thanksgiving Break', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:pta@lincoln', 'DTSTART;TZID=America/New_York:20261202T183000', 'DURATION:PT1H', 'RRULE:FREQ=MONTHLY;BYDAY=1WE;COUNT=6', 'SUMMARY:PTA', 'END:VEVENT',
);
feeds.set('https://calendar.lincoln.example/school.ics', { status: 200, body: SCHOOL, headers: { etag: '"v1"' } });
feeds.set('https://intranet-redirect.example/feed.ics', { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } });
feeds.set('https://login.example/feed.ics', { status: 200, body: '<html>Please sign in</html>' });

const calls: string[] = [];
const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : (input as Request).url);
  const href = url.href;
  calls.push(href);
  const jsonRes = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (href === `${SUPABASE}/auth/v1/user`) {
    const tok = new Headers(init?.headers).get('authorization')?.replace(/^Bearer /, '') ?? '';
    const id = tokens.get(tok);
    return id ? jsonRes({ id, email: `${id}@example.com` }) : jsonRes({ msg: 'bad jwt' }, 401);
  }
  if (href === 'https://oauth2.googleapis.com/token') {
    const form = new URLSearchParams(String(init?.body));
    if (form.get('grant_type') === 'authorization_code') {
      if (form.get('code') !== 'good-code' || !form.get('code_verifier')) return jsonRes({ error: 'invalid_grant' }, 400);
      const idTok = `h.${Buffer.from(JSON.stringify({ email: 'Ana@Gmail.com' })).toString('base64url')}.s`;
      return jsonRes({ access_token: 'at-1', refresh_token: 'rt-secret-123', id_token: idTok, scope: 'openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.readonly' });
    }
    if (form.get('refresh_token') !== 'rt-secret-123' || !google.refreshValid) return jsonRes({ error: 'invalid_grant' }, 400);
    return jsonRes({ access_token: 'at-2' });
  }
  if (href.startsWith('https://oauth2.googleapis.com/revoke')) {
    google.revoked.push(new URLSearchParams(String(init?.body)).get('token') ?? '');
    return jsonRes({});
  }
  if (url.origin === 'https://www.googleapis.com') {
    if (!/^Bearer at-/.test(new Headers(init?.headers).get('authorization') ?? '')) return jsonRes({ error: { status: 'UNAUTHENTICATED' } }, 401);
    if (url.pathname.endsWith('/users/me/calendarList')) return jsonRes({ items: google.calendars });
    const m = url.pathname.match(/\/calendars\/([^/]+)\/events$/);
    if (m) {
      expect(url.searchParams.get('singleEvents')).toBe('true');
      return jsonRes({ items: google.events[decodeURIComponent(m[1])] ?? [], timeZone: 'America/Chicago' });
    }
  }
  const feed = feeds.get(href);
  if (feed) {
    if (feed.headers?.etag && new Headers(init?.headers).get('if-none-match') === feed.headers.etag) return new Response(null, { status: 304 });
    return new Response(feed.body ?? null, { status: feed.status, headers: feed.headers });
  }
  return new Response('not found', { status: 404 });
};

const env = readCalendarEnv((k) => ({
  SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon', SHOP_SITE_URL: SITE,
  GOOGLE_CALENDAR_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_CALENDAR_CLIENT_SECRET: 'csecret', CALENDAR_TOKEN_KEY: KEY, CALENDAR_CRON_SECRET: 'cron-secret',
} as Record<string, string>)[k]);
const deps: CalendarDeps = { env, db: psqlDb, fetch: fakeFetch, now: () => NOW, resolves: async (h) => (h.includes('private-dns') ? ['10.1.2.3'] : ['93.184.216.34']) };
const handler = createCalendarHandler(deps);

const post = (body: unknown, token?: string, origin = SITE) => handler(new Request(`${SUPABASE}/functions/v1/calendar-connect`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
})).then(async (r) => ({ status: r.status, headers: r.headers, body: (await r.json()) as Record<string, any> }));
const get = (q: string) => handler(new Request(`${SUPABASE}/functions/v1/calendar-connect?${q}`));
const as = (uid: string, q: string) => sql(`select set_config('request.jwt.claims', '{"sub":"${uid}"}', false); set role authenticated; ${q}`).split('\n').pop()!;
const count = (q: string) => Number(sql(`select count(*) from (${q}) x`));

describe.skipIf(!PSQL)('connected calendars, end to end', () => {
  beforeAll(() => {
    sql(`insert into auth.users (id, email, email_confirmed_at) values ('${MOM}', 'ce-mom@example.com', now()), ('${DAD}', 'ce-dad@example.com', now()) on conflict do nothing`);
    as(MOM, `select public.club_household_save('The Reyes', '{}', '[{"first_name":"Ana","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Luis","kind":"adult","role":"partner"}]')`);
    const code = as(MOM, `select public.household_invite_create((select id from public.club_family_members where first_name = 'Luis' and household_id = public.household_id_for('${MOM}')), 'ce-dad@example.com') ->> 'code'`);
    as(DAD, `select public.household_invite_accept('${code}')`);
  });

  it('status says what can be connected; the app and the site may call it, others may not', async () => {
    expect((await post({ action: 'status' })).body).toEqual({ google: true, feeds: true });
    expect((await post({ action: 'status' }, undefined, 'capacitor://localhost')).headers.get('access-control-allow-origin')).toBe('capacitor://localhost');
    expect((await post({ action: 'status' }, undefined, 'https://evil.example')).headers.get('access-control-allow-origin')).toBeNull();
    expect((await post({ action: 'refresh' })).status).toBe(401);
  });

  let state = '';
  it('Google: consent link with PKCE and one-time state', async () => {
    const r = await post({ action: 'google_start', return_to: 'web' }, 'tok-mom');
    const u = new URL(r.body.url);
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('redirect_uri')).toBe(`${SUPABASE}/functions/v1/calendar-connect`);
    state = u.searchParams.get('state')!;
    expect(state.length).toBeGreaterThanOrEqual(40);
  });

  it('Google: the redirect connects her account, seals the refresh token and imports her primary calendar', async () => {
    const r = await get(`code=good-code&state=${state}`);
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(`${SITE}/app/family-calendar?calendar=connected`);
    expect(sql(`select label || ' ' || status from public.calendar_connections where user_id = '${MOM}'`)).toBe('ana@gmail.com active');
    const sealed = sql(`select sealed from public.calendar_connection_secrets`);
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain('rt-secret-123');
    expect(sql(`select string_agg(name || ':' || selected || ':' || shared, ',' order by selected desc) from public.calendar_sources where user_id = '${MOM}'`)).toBe('ana@gmail.com:true:false,Sofia soccer:false:false');
    expect(count(`select 1 from public.calendar_imported_events`)).toBe(3); // cancelled one skipped
  });

  it('a replayed or forged redirect connects nothing', async () => {
    expect((await get(`code=good-code&state=${state}`)).headers.get('location')).toBe(`${SITE}/app/family-calendar?calendar=expired`);
    expect((await get('code=good-code&state=short')).headers.get('location')).toContain('calendar=failed');
    const s2 = new URL((await post({ action: 'google_start', return_to: 'app' }, 'tok-mom')).body.url).searchParams.get('state');
    expect((await get(`error=access_denied&state=${s2}`)).headers.get('location')).toBe(`${SITE}/app/calendar-connected?result=denied`);
    expect(count(`select 1 from public.calendar_connections`)).toBe(1);
  });

  it('the other adult sees nothing of hers until she shares it, and cannot disconnect it', async () => {
    expect(JSON.parse(as(DAD, `select public.calendar_imported_feed('2026-11-15', '2026-12-31')`)).events).toHaveLength(0);
    const conn = sql(`select id from public.calendar_connections where user_id = '${MOM}'`);
    expect((await post({ action: 'disconnect', connection_id: conn }, 'tok-dad')).status).toBe(404);
    const cal = sql(`select id from public.calendar_sources where name = 'ana@gmail.com'`);
    as(MOM, `select public.calendar_source_update('${cal}', true, true, null)`);
    const seen = JSON.parse(as(DAD, `select public.calendar_imported_feed('2026-11-15', '2026-12-31')`)).events as { title: string; url: string | null }[];
    expect(seen.map((e) => e.title).sort()).toEqual(['Dentist', 'Piano', 'Piano']);
    expect(seen.every((e) => e.url === null)).toBe(true);
  });

  it('a feed: refused if private, not a calendar or a redirect inward; subscribed once; the link sealed', async () => {
    expect((await post({ action: 'ical_subscribe', url: 'http://localhost:8080/x.ics' }, 'tok-dad')).body.error).toBe('unsupported_url');
    expect((await post({ action: 'ical_subscribe', url: 'https://10.0.0.8/x.ics' }, 'tok-dad')).body.error).toBe('private_host');
    expect((await post({ action: 'ical_subscribe', url: 'https://private-dns.example/x.ics' }, 'tok-dad')).body.error).toBe('private_host');
    expect((await post({ action: 'ical_subscribe', url: 'https://intranet-redirect.example/feed.ics' }, 'tok-dad')).body.error).toBe('private_host');
    expect((await post({ action: 'ical_subscribe', url: 'https://login.example/feed.ics' }, 'tok-dad')).body.error).toBe('not_a_calendar');
    const ok = await post({ action: 'ical_subscribe', url: 'webcal://calendar.lincoln.example/school.ics', zone: 'America/New_York' }, 'tok-dad');
    expect(ok.body).toMatchObject({ name: 'Lincoln Elementary', events: 7 }); // the break + six PTA nights (Dec–May)
    expect((await post({ action: 'ical_subscribe', url: 'https://CALENDAR.lincoln.example/school.ics' }, 'tok-dad')).body.error).toBe('duplicate');
    expect(sql(`select sealed from public.calendar_connection_secrets s join public.calendar_connections c on c.id = s.connection_id where c.provider = 'ical'`)).not.toContain('lincoln');
    expect(sql(`select label from public.calendar_connections where provider = 'ical'`)).toBe('calendar.lincoln.example');
    expect(count(`select 1 from public.calendar_connections where provider = 'ical'`)).toBe(1);
  });

  it('scheduled sync: needs the cron secret; an unchanged feed is a 304; Google changes arrive and cancellations leave', async () => {
    expect((await post({ action: 'sync_due' }, 'wrong')).status).toBe(401);
    google.events['ana@gmail.com'] = google.events['ana@gmail.com'].filter((e) => (e as { id: string }).id !== 'r1_20261128');
    sql(`update public.calendar_sources set next_sync_at = now() - interval '1 minute', last_synced_at = now() - interval '1 hour'`);
    const before = calls.length;
    const r = await post({ action: 'sync_due' }, 'cron-secret');
    expect(r.body).toEqual({ synced: 2, failed: 0 });
    expect(calls.slice(before).filter((c) => c.includes('lincoln'))).toHaveLength(1);
    expect(count(`select 1 from public.calendar_imported_events e join public.calendar_sources s on s.id = e.source_id where s.name = 'ana@gmail.com'`)).toBe(2);
    expect(count(`select 1 from public.calendar_imported_events where title = 'Thanksgiving Break'`)).toBe(1); // kept on 304
  });

  it('refresh is throttled per calendar', async () => {
    expect((await post({ action: 'refresh' }, 'tok-mom')).body).toEqual({ synced: 0, failed: 0 });
  });

  it('a revoked Google grant asks her to reconnect and keeps what was there; reconnecting fixes it', async () => {
    google.refreshValid = false;
    sql(`update public.calendar_sources set next_sync_at = now() - interval '1 minute', last_synced_at = now() - interval '1 hour'`);
    await post({ action: 'sync_due' }, 'cron-secret');
    expect(sql(`select status from public.calendar_connections where provider = 'google'`)).toBe('reauth');
    expect(count(`select 1 from public.calendar_imported_events e join public.calendar_sources s on s.id = e.source_id where s.name = 'ana@gmail.com'`)).toBe(2);
    const list = JSON.parse(as(MOM, `select public.calendar_sources_list()`));
    expect(list.mine[0].status).toBe('reauth');
    expect(JSON.stringify(list)).not.toContain('sealed');
    google.refreshValid = true;
    const s = new URL((await post({ action: 'google_start', return_to: 'web' }, 'tok-mom')).body.url).searchParams.get('state');
    await get(`code=good-code&state=${s}`);
    expect(sql(`select count(*) || ' ' || min(status) from public.calendar_connections where provider = 'google'`)).toBe('1 active');
  });

  it('disconnecting revokes Google access and removes everything copied; family-owned events stay', async () => {
    const hid = sql(`select household_id from public.household_adults where user_id = '${MOM}'`);
    sql(`insert into public.calendar_events (id, household_id, title, starts_on) values ('33333333-0000-0000-0000-000000000001', '${hid}', 'Family dinner', '2026-11-20')`);
    const conn = sql(`select id from public.calendar_connections where provider = 'google'`);
    expect((await post({ action: 'disconnect', connection_id: conn }, 'tok-mom')).body).toEqual({ removed: conn });
    expect(google.revoked).toEqual(['rt-secret-123']);
    expect(count(`select 1 from public.calendar_connections where provider = 'google'`)).toBe(0);
    expect(count(`select 1 from public.calendar_connection_secrets`)).toBe(1); // only the feed's
    expect(count(`select 1 from public.calendar_imported_events e join public.calendar_sources s on s.id = e.source_id join public.calendar_connections c on c.id = s.connection_id where c.provider = 'google'`)).toBe(0);
    expect(count(`select 1 from public.calendar_events where title = 'Family dinner'`)).toBe(1);
  });
});
