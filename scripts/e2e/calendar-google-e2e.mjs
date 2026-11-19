#!/usr/bin/env node
/**
 * Connect Google Calendar end to end (docs/calendar/GOOGLE_CALENDAR.md): a build (website `dist/` or app bundle
 * `app-www/`) in Chromium at iPhone size, against the isolated test backend (scripts/e2e/test-backend.mjs, throwaway
 * database from family-db.sh + seed.sql) and a MOCK Google (scripts/e2e/google-mock.mjs). Never real Google, never
 * real credentials, never production.
 *
 * The app is served at http://localhost:4330, the origin the test backend lets Google's redirect return to.
 * Usage: node scripts/e2e/calendar-google-e2e.mjs [dist|app-www] [out=e2e-google]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { startGoogleMock } from './google-mock.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = process.argv[2] ?? 'dist';
const OUT = process.argv[3] ?? 'e2e-google';
const API = 'http://127.0.0.1:54321';
const MOCK = 'http://127.0.0.1:54323';
mkdirSync(OUT, { recursive: true });

// An iCal fixture beside Google, to prove links keep working (reached as https://school.calendar.e2e.test/…).
const nyToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const ICS = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:picture@school\r\nSUMMARY:Picture day\r\nDTSTART;VALUE=DATE:${nyToday.replaceAll('-', '')}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const fixtures = createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/calendar' }); r.end(ICS); });
await new Promise((r) => fixtures.listen(54322, '127.0.0.1', r));
const mock = await startGoogleMock(54323);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  // Google's redirect pages live on the website, also for the iPhone app (Safari's sheet opens the site): with the app
  // bundle, serve them from the website build, as production does.
  const site = /^\/app\/google-(callback|connected)\/?$/.test(p) && !existsSync(join(ROOT, p, 'index.html')) ? 'dist' : ROOT;
  const asset = extname(p) && !existsSync(join(ROOT, p)) && existsSync(join('dist', p)) ? join('dist', p) : join(ROOT, p); // the relay page's own scripts
  const file = extname(p) ? asset : existsSync(join(site, p, 'index.html')) ? join(site, p, 'index.html') : join(ROOT, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(4330, '127.0.0.1', r));
const base = 'http://localhost:4330';

const results = [];
let failures = 0;
const check = (step, ok, detail = '') => { results.push({ step, ok: Boolean(ok), detail }); if (!ok) failures++; console.log(`  ${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`); };
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;
const rpc = async (token, fn, body = {}) => { const r = await fetch(`${API}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) }); const t = await r.text(); return { status: r.status, body: t ? JSON.parse(t) : null }; };
const fn = async (token, body) => { const r = await fetch(`${API}/functions/v1/calendar-google`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
const mockNext = (o) => fetch(`${MOCK}/__mock/next`, { method: 'POST', body: JSON.stringify(o) });
const mockState = async () => (await fetch(`${MOCK}/__mock/state`)).json();
const shot = (page, name, full = false) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full });
const settle = (page, ms = 700) => page.waitForTimeout(ms);

const browser = await chromium.launch();
const phone = { ...devices['iPhone 15 Pro'], hasTouch: true, timezoneId: 'America/New_York' };
async function signIn(page, email) {
  await page.goto(`${base}/club/login`, { waitUntil: 'networkidle' });
  await page.fill('#club-email', email);
  await page.click('button:has-text("Email me a code")');
  await page.fill('#club-code', '123456');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
  return page.evaluate(() => JSON.parse(localStorage.getItem('omc:account:session')).access_token);
}
const openCalendar = async (page) => {
  await page.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-sync-status="synced"]', { timeout: 15000 }).catch(() => {});
  await page.click('[data-view="agenda"]');
  await settle(page);
};
const titles = (page) => page.locator('[data-calendar-event]').evaluateAll((els) => els.map((e) => e.getAttribute('data-calendar-event')));
const openSources = async (page) => { await page.click('[data-open-calendars]'); await page.waitForSelector('[data-calendar-sources]'); await settle(page, 600); };
const closeSources = async (page) => { await page.click('[data-calendar-sources] button:has-text("Done")'); await settle(page); };
/** Tap Connect, go through the (mock) Google screen, come back to the picker. */
async function connect(page, button = '[data-google-connect]') {
  await page.click(button);
  await page.waitForURL(/\/app\/family-calendar/, { timeout: 15000 });
  await page.waitForSelector('[data-google-picker], [data-feed-msg]:not(:empty)', { timeout: 15000 });
  await settle(page, 900);
}

console.log(`Google Calendar e2e (${ROOT}): app ${base}, backend ${API}, mock Google ${MOCK}`);

// ------------------------------------------------------------------ 1. Jen; Google is offered only to a Google test household
const jenCtx = await browser.newContext(phone);
const jen = await jenCtx.newPage();
const jenToken = await signIn(jen, 'jen@e2e.test');
const familyBefore = await sql(`select count(*) || '|' || coalesce(max(updated_at)::text, '-') from public.calendar_events`);
await sql(`insert into public.calendar_feed_testers (user_id, note) values ('00000000-0000-0000-0000-00000000e2e1', 'e2e')`);
await openCalendar(jen);
await openSources(jen);
check('iCal test household without the Google switch: no Connect Google button', (await jen.locator('[data-google-connect]').count()) === 0);
await closeSources(jen);
await sql(`update public.calendar_feed_testers set google = true where user_id = '00000000-0000-0000-0000-00000000e2e1'`);
await openCalendar(jen);
await openSources(jen);
await jen.waitForSelector('[data-google-connect]', { timeout: 10000 }).catch(() => {});
const connectText = await jen.locator('[data-google-connect]').innerText().catch(() => '(none)');
check('Google test household: Connect Google Calendar is the first, primary option', /connect google calendar/i.test(connectText), connectText);
check('Add calendar by link stays, as the secondary option', (await jen.locator('[data-feed-new]').innerText()).includes('by link'));
await shot(jen, '01-calendars-panel');

// ------------------------------------------------------------------ 2. Connect: Google's screen → back → picker
await mockNext({ account: 'personal' });
await connect(jen);
check('back from Google: the picker opens on the new account', await jen.locator('[data-google-picker]').isVisible());
check('no code, state or token left in the address bar', !/[?&](code|state|google|account)=|rt-|at-/.test(jen.url()), jen.url());
const hist = await jen.evaluate(() => history.length);
check('the relay page left no code in history (replaced, not pushed)', hist <= 4, `history length ${hist}`);
const names = await jen.locator('[data-google-calendar]').evaluateAll((els) => els.map((e) => e.getAttribute('data-google-calendar')));
check('her Google calendars, main one first', names.join(',') === 'Jen,Soccer team', names.join(','));
await shot(jen, '02-picker');
await jen.locator('[data-google-calendar="Jen"] [data-google-check]').check();
await jen.locator('[data-google-calendar="Soccer team"] [data-google-check]').check();
await jen.click('[data-google-calendar="Soccer team"] [data-google-member="Maya"]');
await jen.click('[data-google-calendar="Soccer team"] [data-google-visibility="household"]');
check('each chosen calendar: whose, and Only me (default) / Our household', (await jen.locator('[data-google-calendar="Jen"] [data-google-visibility="private"]').getAttribute('aria-pressed')) === 'true');
await shot(jen, '03-picker-chosen');
await jen.click('[data-google-save]');
await jen.waitForSelector('[data-google-picker]', { state: 'detached', timeout: 20000 });
await settle(jen, 900);
check('saved: back on Calendars with a confirmation', /2 Google calendars are on your family calendar/.test(await jen.locator('[data-feed-msg]').innerText()));
check('the account is listed with its calendars', /2 calendars/.test(await jen.locator('[data-google-account="jen.parks@gmail.test"]').innerText()));
await shot(jen, '04-connected');
await closeSources(jen);
await openCalendar(jen);
const t1 = await titles(jen);
check('events appear in the calendar automatically', t1.includes('Book club') && t1.includes('Soccer tournament') && t1.includes('Piano lesson'), t1.join(', '));
check('recurring: the moved occurrence at its new time, the cancelled one gone', t1.includes('Piano lesson (moved)') && t1.filter((x) => x.startsWith('Piano')).length === 2);
check('all-day: two-day event on both days (Google’s end date is exclusive)', t1.filter((x) => x === 'Soccer tournament').length === 2);
check('time zone: 7 PM in New York shows 7 PM', /7–8:30 PM|7 PM/.test(await jen.locator('[data-calendar-event="Book club"]').first().innerText()));
await jen.locator('[data-calendar-event="Book club"]').first().click();
await jen.waitForSelector('[data-external-event]');
check('a Google event opens read-only', (await jen.locator('[data-event-sheet]').count()) === 0 && /read-only/.test(await jen.locator('[data-external-event]').innerText()));
await jen.click('[data-external-event] button:has-text("Done")');
await shot(jen, '05-agenda-with-google', true);

// ------------------------------------------------------------------ 3. Security on the server
const tokenRows = await sql(`select count(*) from public.calendar_google_accounts a where to_jsonb(a)::text like '%rt-personal%'`);
const vaultRows = await sql(`select count(*) from vault.decrypted_secrets where name like 'calendar\\_google:%' and decrypted_secret like 'rt-personal-%'`);
check('the refresh token is only in Vault (encrypted in production), never in tables', tokenRows === '0' && vaultRows === '1', `${tokenRows}/${vaultRows}`);
const stored = await jen.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.documentElement.outerHTML);
// (The app's own Supabase sign-in session is in storage by design; Google's tokens must not be.)
check('no Google token anywhere in the app (storage, page)', !/rt-personal|at-personal|rt-work|at-work/.test(stored));
const accList = await rpc(jenToken, 'calendar_google_accounts');
check('the app’s account list carries no token', !/rt-|at-|refresh/.test(JSON.stringify(accList.body)));
const ms = await mockState();
check('Google saw only read-only GETs (no writes attempted)', ms.writes === 0 && ms.apiCalls.length > 0);
const forged = await fetch(`${API}/functions/v1/calendar-google/callback?state=forged-state-value&code=stolen-code`, { redirect: 'manual' });
check('a forged callback connects nothing', /google=expired/.test(forged.headers.get('location') ?? '') && (await sql(`select count(*) from public.calendar_google_accounts`)) === '1');
const startRes = await fn(jenToken, { action: 'start', return: 'web', origin: 'https://evil.example' });
const st = new URL(startRes.body.url).searchParams.get('state');
await mockNext({ account: 'personal' });
const consent = await fetch(startRes.body.url, { redirect: 'manual' });
const relayUrl = new URL(consent.headers.get('location'));
check('Google returns to the relay page on our own domain', relayUrl.origin + relayUrl.pathname === `${base}/app/google-callback/`, relayUrl.origin + relayUrl.pathname);
const cb1 = await fn(null, { action: 'callback', code: relayUrl.searchParams.get('code'), state: relayUrl.searchParams.get('state') });
check('a redirect never leaves the allowlisted site', new URL(cb1.body.location).origin === base, cb1.body.location);
const replay = await fetch(`${API}/functions/v1/calendar-google/callback?state=${encodeURIComponent(st)}&code=x`, { redirect: 'manual' });
check('a state works once (replay refused)', /google=expired/.test(replay.headers.get('location') ?? ''));
check('reconnecting the same Google account doesn’t duplicate it', (await sql(`select count(*) from public.calendar_google_accounts`)) === '1');
check('start needs a signed-in adult', (await fn(null, { action: 'start' })).status === 401);

// ------------------------------------------------------------------ 4. A second Google account
await openCalendar(jen);
await openSources(jen);
await mockNext({ account: 'work' });
await connect(jen, '[data-google-connect]');
check('Connect another account → its own picker', (await jen.locator('[data-google-calendar]').count()) === 1);
await jen.locator('[data-google-calendar="jen@work.test"] [data-google-check]').check();
await jen.click('[data-google-save]');
await jen.waitForSelector('[data-google-picker]', { state: 'detached', timeout: 20000 });
await settle(jen, 900);
check('two Google accounts connected', (await jen.locator('[data-google-account]').count()) === 2);
await closeSources(jen);
await openCalendar(jen);
check('both accounts’ events in one calendar', (await titles(jen)).includes('Quarterly review'));

// ------------------------------------------------------------------ 5. Cancel and partial permission
await openSources(jen);
await mockNext({ account: 'work', deny: true });
await connect(jen);
check('cancel on Google’s screen: nothing changes, she’s told', /didn’t connect Google/.test(await jen.locator('[data-feed-msg]').innerText()) && (await sql(`select count(*) from public.calendar_google_accounts`)) === '2');
await closeSources(jen);
await openSources(jen);
const revokedBefore = (await mockState()).revoked.length;
await mockNext({ account: 'personal', partial: true });
await connect(jen);
check('a grant without the calendar permissions is refused and revoked at Google', /allow both calendar permissions/.test(await jen.locator('[data-feed-msg]').innerText()) && (await mockState()).revoked.length === revokedBefore + 1);
await closeSources(jen);

// ------------------------------------------------------------------ 6. Privacy: the other adult and another household
const samId = await sql(`select id from public.club_family_members where first_name = 'Sam'`);
const invite = await rpc(jenToken, 'household_invite_create', { p_member_id: samId, p_email: 'sam@e2e.test' });
const samCtx = await browser.newContext(phone);
const sam = await samCtx.newPage();
const samToken = await signIn(sam, 'sam@e2e.test');
await rpc(samToken, 'household_invite_accept', { p_code: invite.body?.code });
await openCalendar(sam);
const st2 = await titles(sam);
check('Sam sees the shared Soccer team calendar', st2.includes('Soccer tournament'));
check('but not Jen’s private Google calendars', !st2.includes('Book club') && !st2.includes('Quarterly review'), st2.join(', '));
check('and not her Google accounts', (await rpc(samToken, 'calendar_google_accounts')).body?.length === 0);
check('nor can he list or disconnect them', (await fn(samToken, { action: 'calendars', account_id: JSON.parse(await sql(`select to_json(id) from public.calendar_google_accounts limit 1`)) })).status === 404);
const rosaCtx = await browser.newContext(phone);
const rosa = await rosaCtx.newPage();
const rosaToken = await signIn(rosa, 'rosa@e2e.test');
check('another household: no Google', (await rpc(rosaToken, 'calendar_google_accounts')).status >= 400);

// ------------------------------------------------------------------ 7. iCal links keep working beside Google
const ical = await rpc(jenToken, 'calendar_feed_add', { p: { url: 'https://school.calendar.e2e.test/school.ics', name: 'School', visibility: 'household', timezone: 'America/New_York' } });
await fetch(`${API}/functions/v1/calendar-feeds`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${jenToken}` }, body: JSON.stringify({ feed_id: ical.body.id }) });
await openCalendar(jen);
check('an iCal link added beside Google works as before', (await titles(jen)).includes('Picture day'));

// ------------------------------------------------------------------ 8. Scheduled refresh, revoked access, deleted calendar
await sql(`update public.calendar_feeds set last_attempt_at = now() - interval '1 day'`);
const due = await fetch(`${API}/functions/v1/calendar-feeds`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-calendar-cron': 'e2e-cron' }, body: JSON.stringify({ mode: 'due' }) });
check('the scheduled refresh updates Google and iCal calendars together', (await due.json()).refreshed >= 4);
check('unchanged Google calendars aren’t rewritten', (await sql(`select count(*) from public.calendar_feeds where kind = 'google' and status = 'ok'`)) === '3');
await fetch(`${MOCK}/__mock/revoke`, { method: 'POST', body: JSON.stringify({ account: 'work' }) });
await fetch(`${MOCK}/__mock/delete-calendar`, { method: 'POST', body: JSON.stringify({ id: 'parks-soccer@group.calendar.google.com' }) });
await sql(`update public.calendar_feeds set last_attempt_at = now() - interval '1 day'`);
await fetch(`${API}/functions/v1/calendar-feeds`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-calendar-cron': 'e2e-cron' }, body: JSON.stringify({ mode: 'due' }) });
check('access revoked in Google: the account asks to reconnect', (await sql(`select status from public.calendar_google_accounts where email = 'jen@work.test'`)) === 'reconnect');
check('and keeps its last events meanwhile', (await sql(`select count(*) from public.calendar_feed_events e join public.calendar_feeds f on f.id = e.feed_id where f.google_calendar_id = 'jen@work.test'`)) === '1');
const deletedState = await sql(`select status || '|' || event_count || '|' || coalesce(last_error, '') from public.calendar_feeds where google_calendar_id = 'parks-soccer@group.calendar.google.com'`);
check('a deleted calendar keeps its events through the first failure', deletedState.startsWith('error|1|'), deletedState); // one two-day event
await openCalendar(jen);
await openSources(jen);
check('the app shows Reconnect for that account', await jen.locator('[data-google-account="jen@work.test"] [data-google-reconnect]').count());
await shot(jen, '06-reconnect');
await mockNext({ account: 'work' });
await connect(jen, '[data-google-account="jen@work.test"] [data-google-reconnect]');
check('Reconnect fixes it (same account, no duplicate)', (await sql(`select status from public.calendar_google_accounts where email = 'jen@work.test'`)) === 'ok' && (await sql(`select count(*) from public.calendar_google_accounts`)) === '2');
await jen.click('[data-google-picker] button:has-text("Cancel")').catch(() => {});
await settle(jen);
await jen.click('[data-google-account="jen.parks@gmail.test"] [data-google-choose]');
await jen.waitForSelector('[data-google-missing]', { timeout: 15000 }).catch(() => {});
check('the picker tells her a calendar is gone from Google', /Soccer team/.test(await jen.locator('[data-google-missing]').innerText().catch(() => '')));
await jen.click('[data-google-picker] button:has-text("Cancel")');
await settle(jen);

// ------------------------------------------------------------------ 9. Disconnect
const revokes = (await mockState()).revoked.length;
await jen.click('[data-google-account="jen.parks@gmail.test"] [data-google-disconnect]');
check('disconnect asks once more', /Tap again/.test(await jen.locator('[data-google-account="jen.parks@gmail.test"] [data-google-disconnect]').innerText()));
await jen.click('[data-google-account="jen.parks@gmail.test"] [data-google-disconnect]');
await jen.waitForSelector('[data-google-account="jen.parks@gmail.test"]', { state: 'detached', timeout: 15000 });
check('disconnect revokes our access at Google', (await mockState()).revoked.length === revokes + 1);
check('and deletes the account, its token and its calendars', (await sql(`select count(*) from public.calendar_google_accounts where email = 'jen.parks@gmail.test'`)) === '0'
  && (await sql(`select count(*) from vault.secrets where name like 'calendar\\_google:%'`)) === '1'
  && (await sql(`select count(*) from public.calendar_feeds where google_calendar_id in ('jen.parks@gmail.test', 'parks-soccer@group.calendar.google.com')`)) === '0');
await shot(jen, '07-after-disconnect');
await closeSources(jen);
await openCalendar(jen);
const t9 = await titles(jen);
check('its events are gone; the other account and the iCal link stay', !t9.includes('Book club') && t9.includes('Quarterly review') && t9.includes('Picture day'), t9.join(', '));
check('family events untouched throughout', (await sql(`select count(*) || '|' || coalesce(max(updated_at)::text, '-') from public.calendar_events`)) === familyBefore, familyBefore);

writeFileSync(join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), root: ROOT, failures, results }, null, 2));
await browser.close();
server.close(); fixtures.close(); mock.server.close();
console.log(failures ? `\n${failures} failed` : `\nall ${results.length} passed`);
process.exit(failures ? 1 : 0);
