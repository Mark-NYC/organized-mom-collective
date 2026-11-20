/**
 * A MOCK Google for the Connect Google Calendar e2e (scripts/e2e/calendar-google-e2e.mjs) and the isolated test
 * backend. It behaves like Google's OAuth 2.0 + Calendar API for what the app uses, and checks what Google checks:
 * client id and secret, redirect URI, one-time codes, PKCE S256 (the verifier must match the challenge), refresh
 * tokens (revocable), bearer tokens per account, read-only GETs only. Never real Google; never real credentials.
 *
 *   GET  /o/oauth2/v2/auth       "consent screen": approves as the account chosen with POST /__mock/next
 *   POST /token                  authorization_code (PKCE) and refresh_token grants
 *   POST /revoke                 revokes a refresh token
 *   GET  /calendar/v3/users/me/calendarList
 *   GET  /calendar/v3/calendars/:id/events
 *   POST /__mock/next  {account, deny?, partial?}   how the next consent goes
 *   POST /__mock/revoke {account}                  the user revokes our access in her Google account
 *   POST /__mock/delete-calendar {id}              a calendar is deleted / unshared
 *   GET  /__mock/state                             what happened (revocations, token grants, API calls)
 */
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';

export const CLIENT_ID = 'e2e-google-client.apps.googleusercontent.test';
const CLIENT_SECRET = 'e2e-google-secret';
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.readonly'];

const day = (n) => { const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Accounts and their calendars, with events relative to today (New York times). */
function accounts() {
  return {
    personal: {
      sub: 'mock-sub-personal', email: 'jen.parks@gmail.test',
      calendars: [
        { id: 'jen.parks@gmail.test', summary: 'jen.parks@gmail.test', summaryOverride: 'Jen', primary: true, backgroundColor: '#7986cb', timeZone: 'America/New_York', accessRole: 'owner',
          events: [
            { id: 'book1', iCalUID: 'book1@google.com', summary: 'Book club', location: 'Library', start: { dateTime: `${day(0)}T19:00:00-05:00` }, end: { dateTime: `${day(0)}T20:30:00-05:00` } },
            // A weekly series, expanded by Google (singleEvents=true); one occurrence moved, one cancelled.
            { id: 'piano_1', iCalUID: 'piano@google.com', recurringEventId: 'piano', summary: 'Piano lesson', start: { dateTime: `${day(1)}T16:00:00-05:00` }, end: { dateTime: `${day(1)}T16:30:00-05:00` } },
            { id: 'piano_2', iCalUID: 'piano@google.com', recurringEventId: 'piano', summary: 'Piano lesson (moved)', originalStartTime: { dateTime: `${day(8)}T21:00:00Z` }, start: { dateTime: `${day(9)}T16:00:00-05:00` }, end: { dateTime: `${day(9)}T16:30:00-05:00` } },
            { id: 'piano_3', iCalUID: 'piano@google.com', recurringEventId: 'piano', status: 'cancelled', originalStartTime: { dateTime: `${day(15)}T21:00:00Z` } },
          ] },
        { id: 'parks-soccer@group.calendar.google.com', summary: 'Soccer team', backgroundColor: '#16a765', timeZone: 'America/New_York', accessRole: 'reader',
          events: [
            { id: 'game1', iCalUID: 'game1@google.com', summary: 'Soccer tournament', start: { date: day(2) }, end: { date: day(4) } }, // two days, end exclusive
          ] },
      ],
    },
    work: {
      sub: 'mock-sub-work', email: 'jen@work.test',
      calendars: [
        { id: 'jen@work.test', summary: 'jen@work.test', primary: true, backgroundColor: '#f6bf26', timeZone: 'America/Chicago', accessRole: 'owner',
          events: [{ id: 'qr1', iCalUID: 'qr1@work.test', summary: 'Quarterly review', start: { dateTime: `${day(0)}T10:00:00-06:00` }, end: { dateTime: `${day(0)}T11:00:00-06:00` } }] },
      ],
    },
  };
}

export function startGoogleMock(port = 54323) {
  const data = accounts();
  const codes = new Map(); // code -> { account, challenge, redirect_uri, scopes }
  const refresh = new Map(); // refresh token -> { account, revoked }
  const access = new Map(); // access token -> account
  const deleted = new Set();
  const state = { next: { account: 'personal', deny: false, partial: false }, revoked: [], grants: [], apiCalls: [], writes: 0 };

  const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
  const json = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const b64url = (buf) => Buffer.from(buf).toString('base64url');

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;
    if (req.method !== 'GET' && p.startsWith('/calendar/')) { state.writes++; return json(res, 403, { error: { message: 'read-only scopes' } }); }

    if (p === '/__mock/next' && req.method === 'POST') { state.next = { account: 'personal', deny: false, partial: false, ...JSON.parse(await body(req)) }; return json(res, 200, state.next); }
    if (p === '/__mock/revoke' && req.method === 'POST') { const { account } = JSON.parse(await body(req)); for (const v of refresh.values()) if (v.account === account) v.revoked = true; return json(res, 200, {}); }
    if (p === '/__mock/delete-calendar' && req.method === 'POST') { deleted.add(JSON.parse(await body(req)).id); return json(res, 200, {}); }
    if (p === '/__mock/state') return json(res, 200, { ...state, refreshTokens: [...refresh.entries()].map(([t, v]) => ({ t, ...v })) });

    if (p === '/o/oauth2/v2/auth') {
      const q = url.searchParams;
      const scopes = (q.get('scope') ?? '').split(' ');
      if (q.get('client_id') !== CLIENT_ID || q.get('response_type') !== 'code' || q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge') || !q.get('state')) {
        res.writeHead(400); return res.end('bad authorization request');
      }
      if (scopes.some((s) => !SCOPES.includes(s))) { res.writeHead(400); return res.end('unexpected scope'); }
      const back = new URL(q.get('redirect_uri'));
      back.searchParams.set('state', q.get('state'));
      if (state.next.deny) back.searchParams.set('error', 'access_denied');
      else {
        const code = `code-${randomBytes(8).toString('hex')}`;
        codes.set(code, { account: state.next.account, challenge: q.get('code_challenge'), redirect_uri: q.get('redirect_uri'),
          scopes: state.next.partial ? scopes.filter((s) => !s.includes('events')) : scopes });
        back.searchParams.set('code', code);
      }
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }

    if (p === '/token' && req.method === 'POST') {
      const f = new URLSearchParams(await body(req));
      if (f.get('client_id') !== CLIENT_ID || f.get('client_secret') !== CLIENT_SECRET) return json(res, 401, { error: 'invalid_client' });
      if (f.get('grant_type') === 'authorization_code') {
        const c = codes.get(f.get('code'));
        codes.delete(f.get('code'));
        if (!c || c.redirect_uri !== f.get('redirect_uri')) return json(res, 400, { error: 'invalid_grant' });
        const challenge = createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url');
        if (challenge !== c.challenge) return json(res, 400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
        const acc = data[c.account];
        const rt = `rt-${c.account}-${randomBytes(6).toString('hex')}`;
        const at = `at-${c.account}-${randomBytes(6).toString('hex')}`;
        refresh.set(rt, { account: c.account, revoked: false });
        access.set(at, c.account);
        state.grants.push(c.account);
        const idToken = `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify({ iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: acc.sub, email: acc.email, email_verified: true }))}.sig`;
        return json(res, 200, { access_token: at, refresh_token: rt, expires_in: 3599, token_type: 'Bearer', scope: c.scopes.join(' '), id_token: idToken });
      }
      if (f.get('grant_type') === 'refresh_token') {
        const r = refresh.get(f.get('refresh_token'));
        if (!r || r.revoked) return json(res, 400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
        const at = `at-${r.account}-${randomBytes(6).toString('hex')}`;
        access.set(at, r.account);
        return json(res, 200, { access_token: at, expires_in: 3599, token_type: 'Bearer' });
      }
      return json(res, 400, { error: 'unsupported_grant_type' });
    }

    if (p === '/revoke' && req.method === 'POST') {
      const t = new URLSearchParams(await body(req)).get('token');
      const r = refresh.get(t);
      if (!r) return json(res, 400, { error: 'invalid_token' });
      r.revoked = true;
      state.revoked.push(r.account);
      return json(res, 200, {});
    }

    if (p.startsWith('/calendar/v3/')) {
      const account = access.get((/^Bearer (.+)$/.exec(req.headers.authorization ?? '') ?? [])[1]);
      state.apiCalls.push(p);
      if (!account) return json(res, 401, { error: { code: 401 } });
      const acc = data[account];
      if (p === '/calendar/v3/users/me/calendarList') {
        return json(res, 200, { items: acc.calendars.filter((c) => !deleted.has(c.id)).map(({ events: _e, ...c }) => c) });
      }
      const m = /^\/calendar\/v3\/calendars\/([^/]+)\/events$/.exec(p);
      if (m) {
        const id = decodeURIComponent(m[1]);
        const cal = acc.calendars.find((c) => c.id === id);
        if (!cal || deleted.has(id)) return json(res, 404, { error: { code: 404, message: 'Not Found' } });
        if (url.searchParams.get('singleEvents') !== 'true') return json(res, 400, { error: { message: 'expected singleEvents=true' } });
        return json(res, 200, { items: cal.events });
      }
    }
    json(res, 404, { error: 'not found' });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port, state })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await startGoogleMock(Number(process.env.E2E_GOOGLE_MOCK_PORT ?? 54323));
  console.log(`mock Google on http://127.0.0.1:${port}`);
}
