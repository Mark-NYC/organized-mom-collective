/** Connect Google Calendar: OAuth (supabase/functions/_shared/handlers/calendar-google.ts), the Google module
 *  (_shared/calendar/google.ts) and the refresher's Google branch (handlers/calendar-feeds.ts), with a fake Google. */
import { describe, expect, it, vi } from 'vitest';
import { GOOGLE_SCOPES, authorizeUrl, exchangeCode, pkceChallenge, toInstances, type GoogleConfig } from '../supabase/functions/_shared/calendar/google';
import { createCalendarGoogleHandler } from '../supabase/functions/_shared/handlers/calendar-google';
import { syncGoogleFeed, createCalendarFeedsHandler } from '../supabase/functions/_shared/handlers/calendar-feeds';

const G: GoogleConfig = { clientId: 'client-123.apps.googleusercontent.com', clientSecret: 'shh', redirectUri: 'https://proj.supabase.co/functions/v1/calendar-google/callback',
  authorizeUrl: 'https://accounts.test/auth', tokenUrl: 'https://oauth.test/token', revokeUrl: 'https://oauth.test/revoke', apiBase: 'https://api.test/calendar/v3' };
const CAL = ['https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.readonly'];
const idToken = (claims: Record<string, unknown>) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const goodToken = (extra: Record<string, unknown> = {}) => ({ access_token: 'ACCESS', refresh_token: 'REFRESH', scope: ['openid', 'email', ...CAL].join(' '),
  id_token: idToken({ iss: 'https://accounts.google.com', aud: G.clientId, sub: 'g-sub-1', email: 'mom@gmail.test', email_verified: true }), ...extra });

/** A fake Google: records calls; answers by URL. */
function fakeGoogle(answers: Record<string, (body: string, url: URL) => Response>) {
  const calls: { url: string; body: string }[] = [];
  const f = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = typeof init?.body === 'string' ? init.body : '';
    calls.push({ url: url.toString(), body });
    const key = Object.keys(answers).find((k) => url.toString().startsWith(k));
    return key ? answers[key](body, url) : new Response('{}', { status: 404 });
  });
  return { f: f as unknown as typeof fetch, calls };
}
const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Google module', () => {
  it('asks for read-only calendar scopes only, offline, with consent, state and PKCE S256', async () => {
    const url = new URL(await authorizeUrl(G, 'STATE', 'v'.repeat(64)));
    const p = url.searchParams;
    expect(p.get('scope')!.split(' ').sort()).toEqual([...GOOGLE_SCOPES].sort());
    expect(GOOGLE_SCOPES.every((s) => !/calendar$|calendar\.events$|\.calendarlist$|app\.created|acls/.test(s))).toBe(true); // nothing that can write
    expect([p.get('response_type'), p.get('access_type'), p.get('state'), p.get('code_challenge_method'), p.get('include_granted_scopes')]).toEqual(['code', 'offline', 'STATE', 'S256', 'false']);
    expect(p.get('prompt')).toContain('consent');
    expect(p.get('code_challenge')).toBe(await pkceChallenge('v'.repeat(64)));
    expect(p.get('redirect_uri')).toBe(G.redirectUri);
  });

  it('exchanges the code with the verifier; binds to the Google account; refuses partial grants and foreign tokens', async () => {
    const ok = fakeGoogle({ 'https://oauth.test/token': () => jsonRes(goodToken()) });
    expect(await exchangeCode(G, ok.f, 'CODE', 'VERIFIER')).toMatchObject({ refreshToken: 'REFRESH', sub: 'g-sub-1', email: 'mom@gmail.test' });
    expect(new URLSearchParams(ok.calls[0].body).get('code_verifier')).toBe('VERIFIER');
    const partial = fakeGoogle({ 'https://oauth.test/token': () => jsonRes(goodToken({ scope: `openid email ${CAL[0]}` })) });
    await expect(exchangeCode(G, partial.f, 'CODE', 'V')).rejects.toMatchObject({ kind: 'scopes', refresh: 'REFRESH' });
    const wrongAud = fakeGoogle({ 'https://oauth.test/token': () => jsonRes(goodToken({ id_token: idToken({ iss: 'https://accounts.google.com', aud: 'someone-else', sub: 'x' }) })) });
    await expect(exchangeCode(G, wrongAud.f, 'CODE', 'V')).rejects.toMatchObject({ message: 'wrong_audience' });
    const badCode = fakeGoogle({ 'https://oauth.test/token': () => jsonRes({ error: 'invalid_grant' }, 400) });
    await expect(exchangeCode(G, badCode.f, 'CODE', 'V')).rejects.toMatchObject({ kind: 'invalid_grant' });
  });

  it('turns Google events into the shared read-only instances', () => {
    const out = toInstances([
      { id: 'a', iCalUID: 'trip@google.com', summary: 'Beach trip', start: { date: '2026-11-20' }, end: { date: '2026-11-23' }, status: 'confirmed' },
      { id: 'b_20261121T150000Z', iCalUID: 'soccer@google.com', recurringEventId: 'b', summary: 'Soccer', location: 'Field 3',
        start: { dateTime: '2026-11-21T10:00:00-05:00', timeZone: 'America/New_York' }, end: { dateTime: '2026-11-21T11:00:00-05:00' }, status: 'confirmed' },
      // A moved occurrence keeps its original-start key (no duplicate, same identity as the iCal link would give).
      { id: 'b_20261128T150000Z', iCalUID: 'soccer@google.com', recurringEventId: 'b', summary: 'Soccer (moved)', originalStartTime: { dateTime: '2026-11-28T15:00:00Z' },
        start: { dateTime: '2026-11-29T15:00:00Z' }, end: { dateTime: '2026-11-29T16:00:00Z' }, status: 'tentative' },
      { id: 'c', iCalUID: 'gone@google.com', status: 'cancelled', start: { date: '2026-11-22' }, end: { date: '2026-11-23' } },
      { id: 'd', iCalUID: 'private@google.com', start: { dateTime: '2026-11-22T12:00:00Z' }, end: { dateTime: '2026-11-22T13:00:00Z' } },
      { id: 'a-copy', iCalUID: 'trip@google.com', summary: 'Beach trip', start: { date: '2026-11-20' }, end: { date: '2026-11-23' } },
    ]);
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({ uid: 'trip@google.com', all_day: true, start_date: '2026-11-20', end_date: '2026-11-22', instance_key: '2026-11-20' });
    expect(out[1]).toMatchObject({ starts_at: '2026-11-21T15:00:00.000Z', ends_at: '2026-11-21T16:00:00.000Z', location: 'Field 3', instance_key: '2026-11-21T15:00:00.000Z' });
    expect(out[2]).toMatchObject({ title: 'Soccer (moved)', starts_at: '2026-11-29T15:00:00.000Z', instance_key: '2026-11-28T15:00:00.000Z', status: 'tentative' });
    expect(out.find((e) => e.uid === 'gone@google.com')).toBeUndefined();
    expect(out[3].title).toBe('Busy'); // an event without a visible title
  });
});

// ------------------------------------------------------------------------------------------------ the OAuth function
function oauth(googleAnswers: Record<string, (body: string, url: URL) => Response> = {}, opts: { configured?: boolean } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const states = new Map<string, Record<string, unknown>>();
  const accounts: Record<string, { owner: string; refresh: string; imported: unknown[] }> = { 'aaaaaaaa-0000-4000-8000-000000000001': { owner: 'user-1', refresh: 'REFRESH-1', imported: [{ google_calendar_id: 'mom@gmail.test', feed_id: 'f1', visibility: 'private', member_id: null, name: 'Mom' }] } };
  const db = {
    rpc: async <T,>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
      calls.push({ name, args });
      if (name === 'calendar_google_state_save') {
        if (args.p_user === 'user-off') throw new Error('not_enabled');
        states.set(String(args.p_state_hash), { user_id: args.p_user, code_verifier: args.p_verifier, return_to: args.p_return_to, return_origin: args.p_origin });
        return true as T;
      }
      if (name === 'calendar_google_state_take') { const s = states.get(String(args.p_state_hash)) ?? null; states.delete(String(args.p_state_hash)); return s as T; }
      if (name === 'calendar_google_account_save') return 'aaaaaaaa-0000-4000-8000-000000000009' as T;
      if (name === 'calendar_google_account_token') {
        const a = accounts[String(args.p_account)];
        return (a && a.owner === args.p_owner ? { id: args.p_account, refresh_token: a.refresh, status: 'ok', imported: a.imported } : null) as T;
      }
      return true as T;
    },
  };
  const g = fakeGoogle({
    'https://oauth.test/token': (body) => (new URLSearchParams(body).get('grant_type') === 'refresh_token' ? jsonRes({ access_token: 'ACCESS-2' }) : jsonRes(goodToken())),
    'https://oauth.test/revoke': () => new Response('', { status: 200 }),
    'https://api.test/calendar/v3/users/me/calendarList': () => jsonRes({ items: [
      { id: 'family@group.calendar.google.com', summary: 'Family', backgroundColor: '#16a765', timeZone: 'America/New_York', accessRole: 'owner' },
      { id: 'mom@gmail.test', summary: 'mom@gmail.test', summaryOverride: 'Mom', primary: true, timeZone: 'America/New_York', accessRole: 'owner' },
    ] }),
    ...googleAnswers,
  });
  const h = createCalendarGoogleHandler({
    db, fetch: g.f, getUser: async (t) => (t === 'tok-1' ? { id: 'user-1' } : t === 'tok-2' ? { id: 'user-2' } : t === 'tok-off' ? { id: 'user-off' } : null),
    google: opts.configured === false ? null : G, returnOrigins: ['https://organizedmomcollective.com', 'https://claude-calendar.pages.test'],
  });
  return { h, calls, g, states };
}
const post = (body: unknown, token?: string) => new Request('https://proj.supabase.co/functions/v1/calendar-google', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const cb = (q: Record<string, string>) => new Request(`https://proj.supabase.co/functions/v1/calendar-google/callback?${new URLSearchParams(q)}`);
async function start(t: ReturnType<typeof oauth>, body: Record<string, unknown> = {}, token = 'tok-1') {
  const res = await t.h(post({ action: 'start', return: 'web', origin: 'https://organizedmomcollective.com', ...body }, token));
  return { res, url: res.ok ? new URL((await res.json()).url) : null };
}

describe('calendar-google: connect', () => {
  it('start needs a signed-in adult with Google switched on, and a configured client', async () => {
    const t = oauth();
    expect((await t.h(post({ action: 'start' }))).status).toBe(401);
    expect((await start(t, {}, 'tok-off')).res.status).toBe(403);
    expect((await oauth({}, { configured: false }).h(post({ action: 'start' }, 'tok-1'))).status).toBe(503);
    const { url } = await start(t);
    expect(url!.origin + url!.pathname).toBe('https://accounts.test/auth');
    expect(url!.searchParams.get('state')!.length).toBeGreaterThanOrEqual(43);
    // Only the state's hash is stored; the verifier stays server-side and matches the challenge sent to Google.
    const saved = t.calls.filter((c) => c.name === 'calendar_google_state_save').at(-1)!.args;
    expect(saved.p_state_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(saved.p_state_hash).not.toBe(url!.searchParams.get('state'));
    expect(await pkceChallenge(String(saved.p_verifier))).toBe(url!.searchParams.get('code_challenge'));
  });

  it('never redirects outside the allowlist', async () => {
    const t = oauth();
    await start(t, { origin: 'https://evil.example' });
    expect(t.calls.find((c) => c.name === 'calendar_google_state_save')!.args.p_origin).toBe('https://organizedmomcollective.com');
  });

  it('the callback connects the adult who started, once; no token or code reaches the browser', async () => {
    const t = oauth();
    const { url } = await start(t);
    const res = await t.h(cb({ state: url!.searchParams.get('state')!, code: 'CODE-1' }));
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin + loc.pathname).toBe('https://organizedmomcollective.com/app/family-calendar/');
    expect(Object.fromEntries(loc.searchParams)).toEqual({ google: 'connected', account: 'aaaaaaaa-0000-4000-8000-000000000009' });
    expect(res.headers.get('location')).not.toMatch(/REFRESH|ACCESS|CODE/);
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(t.calls.find((c) => c.name === 'calendar_google_account_save')!.args).toMatchObject({ p_user: 'user-1', p_sub: 'g-sub-1', p_refresh_token: 'REFRESH' });
    // Replay: the same state again connects nothing and doesn't call Google.
    const before = t.g.calls.length;
    const again = await t.h(cb({ state: url!.searchParams.get('state')!, code: 'CODE-1' }));
    expect(new URL(again.headers.get('location')!).searchParams.get('google')).toBe('expired');
    expect(t.g.calls.length).toBe(before);
  });

  it('the relay page on our own domain hands the redirect over by POST, without a sign-in', async () => {
    const t = oauth();
    const { url } = await start(t);
    const res = await t.h(post({ action: 'callback', code: 'CODE-R', state: url!.searchParams.get('state') }));
    const { location } = await res.json();
    expect(new URL(location).searchParams.get('google')).toBe('connected');
    const replay = await (await t.h(post({ action: 'callback', code: 'CODE-R', state: url!.searchParams.get('state') }))).json();
    expect(new URL(replay.location).searchParams.get('google')).toBe('expired');
  });

  it('a forged state, a cancel, and the iPhone app return', async () => {
    const t = oauth();
    const forged = await t.h(cb({ state: 'made-up-state-value', code: 'CODE' }));
    expect(new URL(forged.headers.get('location')!).searchParams.get('google')).toBe('expired');
    expect(t.calls.some((c) => c.name === 'calendar_google_account_save')).toBe(false);
    expect(t.g.calls.length).toBe(0);
    const { url } = await start(t);
    const denied = await t.h(cb({ state: url!.searchParams.get('state')!, error: 'access_denied' }));
    expect(new URL(denied.headers.get('location')!).searchParams.get('google')).toBe('cancelled');
    const app = await start(t, { return: 'app', origin: 'capacitor://localhost' });
    const back = await t.h(cb({ state: app.url!.searchParams.get('state')!, code: 'CODE-2' }));
    expect(new URL(back.headers.get('location')!).pathname).toBe('/app/google-connected/');
  });

  it('a failure on Google’s redirect still lands her back in the app with a plain message', async () => {
    const h = createCalendarGoogleHandler({ db: { rpc: async () => { throw new Error('connect ECONNREFUSED db'); } }, getUser: async () => ({ id: 'user-1' }), fetch,
      google: G, returnOrigins: ['https://organizedmomcollective.com'] });
    const res = await h(cb({ state: 'whatever-state', code: 'CODE' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://organizedmomcollective.com/app/family-calendar/?google=error');
    const api = await h(post({ action: 'calendars', account_id: 'aaaaaaaa-0000-4000-8000-000000000001' }, 'tok-1'));
    expect([api.status, (await api.json()).error]).toEqual([500, 'unavailable']); // no internal detail
  });

  it('a grant without both calendar permissions is revoked and not saved', async () => {
    const t = oauth({ 'https://oauth.test/token': () => jsonRes(goodToken({ scope: `openid email ${CAL[1]}` })) });
    const { url } = await start(t);
    const res = await t.h(cb({ state: url!.searchParams.get('state')!, code: 'CODE' }));
    expect(new URL(res.headers.get('location')!).searchParams.get('google')).toBe('permissions');
    expect(t.g.calls.some((c) => c.url.startsWith('https://oauth.test/revoke') && new URLSearchParams(c.body).get('token') === 'REFRESH')).toBe(true);
    expect(t.calls.some((c) => c.name === 'calendar_google_account_save')).toBe(false);
  });
});

describe('calendar-google: calendars and disconnect', () => {
  const A = 'aaaaaaaa-0000-4000-8000-000000000001';
  it('lists her calendars (primary first), marks imported ones, never returns tokens; only for the owner', async () => {
    const t = oauth();
    expect((await t.h(post({ action: 'calendars', account_id: A }, 'tok-2'))).status).toBe(404);
    const res = await t.h(post({ action: 'calendars', account_id: A }, 'tok-1'));
    const body = await res.json();
    expect(body.calendars.map((c: { name: string; imported: boolean }) => `${c.name}:${c.imported}`)).toEqual(['Mom:true', 'Family:false']);
    expect(JSON.stringify(body)).not.toMatch(/REFRESH|ACCESS/);
  });

  it('a token Google no longer accepts asks her to reconnect', async () => {
    const t = oauth({ 'https://oauth.test/token': () => jsonRes({ error: 'invalid_grant' }, 400) });
    const res = await t.h(post({ action: 'calendars', account_id: A }, 'tok-1'));
    expect([res.status, (await res.json()).error]).toEqual([409, 'reconnect']);
    expect(t.calls.find((c) => c.name === 'calendar_google_account_status')!.args).toMatchObject({ p_status: 'reconnect' });
  });

  it('disconnect revokes at Google, then deletes everything for that account (even if Google is unreachable)', async () => {
    const t = oauth();
    expect(await (await t.h(post({ action: 'disconnect', account_id: A }, 'tok-1'))).json()).toEqual({ ok: true, revoked: true });
    expect(new URLSearchParams(t.g.calls.find((c) => c.url.startsWith('https://oauth.test/revoke'))!.body).get('token')).toBe('REFRESH-1');
    expect(t.calls.find((c) => c.name === 'calendar_google_forget')!.args).toEqual({ p_account: A, p_owner: 'user-1' });
    const down = oauth({ 'https://oauth.test/revoke': () => { throw new Error('offline'); } });
    expect(await (await down.h(post({ action: 'disconnect', account_id: A }, 'tok-1'))).json()).toEqual({ ok: true, revoked: false });
    expect(down.calls.some((c) => c.name === 'calendar_google_forget')).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------ the refresher
describe('refresher: Google calendars', () => {
  const feed = (cal: string, extra = {}) => ({ id: `feed-${cal}`, kind: 'google' as const, google_account_id: 'acc-1', google_calendar_id: cal, refresh_token: 'REFRESH', url: '', etag: null, last_modified: null, timezone: 'UTC', content_hash: null, ...extra });
  const events = { items: [{ id: 'e1', iCalUID: 'e1@google.com', summary: 'Practice', start: { dateTime: '2026-11-21T15:00:00Z' }, end: { dateTime: '2026-11-21T16:00:00Z' } }] };
  const deps = (answers: Record<string, (body: string, url: URL) => Response>) => {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const g = fakeGoogle(answers);
    return { calls, g, d: { db: { rpc: async <T,>(name: string, args: Record<string, unknown> = {}) => { calls.push({ name, args }); return 1 as T; } }, getUser: async () => null, fetch: g.f, now: () => Date.UTC(2026, 10, 19), cronSecret: 's', google: G } };
  };

  it('one token refresh per account per run; read-only GETs with singleEvents; unchanged calendars aren’t rewritten', async () => {
    const t = deps({ 'https://oauth.test/token': () => jsonRes({ access_token: 'ACCESS' }), 'https://api.test/calendar/v3/calendars/': () => jsonRes(events) });
    const tokens = new Map();
    const a = await syncGoogleFeed(feed('a@x'), t.d, tokens);
    const b = await syncGoogleFeed(feed('b@x'), t.d, tokens);
    expect([a.result, b.result]).toEqual(['ok', 'ok']);
    expect(t.g.calls.filter((c) => c.url.startsWith('https://oauth.test/token'))).toHaveLength(1);
    const api = t.g.calls.filter((c) => c.url.startsWith('https://api.test'));
    expect(api.every((c) => new URL(c.url).searchParams.get('singleEvents') === 'true' && c.body === '')).toBe(true);
    const again = await syncGoogleFeed(feed('a@x', { content_hash: a.content_hash }), t.d, new Map());
    expect(again.result).toBe('not_modified');
  });

  it('deleted or unshared calendar, rate limits, revoked access', async () => {
    const gone = deps({ 'https://oauth.test/token': () => jsonRes({ access_token: 'A' }), 'https://api.test': () => jsonRes({ error: { code: 404 } }, 404) });
    expect(await syncGoogleFeed(feed('x'), gone.d, new Map())).toMatchObject({ result: 'gone' });
    const busy = deps({ 'https://oauth.test/token': () => jsonRes({ access_token: 'A' }), 'https://api.test': () => jsonRes({ error: { errors: [{ reason: 'rateLimitExceeded' }] } }, 403) });
    expect(await syncGoogleFeed(feed('x'), busy.d, new Map())).toMatchObject({ result: 'error' });
    const revoked = deps({ 'https://oauth.test/token': () => jsonRes({ error: 'invalid_grant' }, 400) });
    expect(await syncGoogleFeed(feed('x'), revoked.d, new Map())).toMatchObject({ result: 'error' }); // keeps her events
    expect(revoked.calls.find((c) => c.name === 'calendar_google_account_status')!.args).toMatchObject({ p_account: 'acc-1', p_status: 'reconnect' });
  });

  it('the scheduled run refreshes Google and iCal calendars together', async () => {
    const queue: unknown[] = [feed('a@x'), { id: 'ical-1', kind: 'ical', url: 'https://school.example.org/cal.ics', etag: null, last_modified: null, timezone: 'UTC', content_hash: null }];
    const g = fakeGoogle({ 'https://oauth.test/token': () => jsonRes({ access_token: 'A' }), 'https://api.test': () => jsonRes(events),
      'https://school.example.org': () => new Response('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:s@x\r\nSUMMARY:Picture day\r\nDTSTART;VALUE=DATE:20261120\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n') });
    const stored: string[] = [];
    const h = createCalendarFeedsHandler({ db: { rpc: async <T,>(name: string, args: Record<string, unknown> = {}) => (name === 'calendar_feed_claim' ? queue.splice(0, 1) : (stored.push(`${args.p_feed}:${(args.p as { result: string }).result}`), 1)) as T },
      getUser: async () => null, fetch: g.f, resolve: async () => ['93.184.216.34'], now: () => Date.UTC(2026, 10, 19), cronSecret: 's', google: G });
    const res = await h(new Request('https://x/', { method: 'POST', headers: { 'x-calendar-cron': 's' }, body: JSON.stringify({ mode: 'due' }) }));
    expect(await res.json()).toEqual({ refreshed: 2 });
    expect(stored.sort()).toEqual(['feed-a@x:ok', 'ical-1:ok']);
  });
});
