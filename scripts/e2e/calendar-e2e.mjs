#!/usr/bin/env node
/**
 * Calendar subscriptions end to end (docs/calendar/CALENDAR_INTEGRATION.md): the app bundle in Chromium at iPhone
 * size against the isolated test backend (scripts/e2e/test-backend.mjs, throwaway database from family-db.sh +
 * seed.sql, with migration 20261205 included). iCal fixtures are served on this machine (:54322) and reached as
 * https://<name>.calendar.e2e.test/… (the backend maps that host to the fixtures). Never touches production.
 *
 * Jen and Sam are two phones in America/New_York. The school fixture is in America/Los_Angeles to check time zones.
 *
 * Usage: node scripts/e2e/calendar-e2e.mjs [app-www] [out=e2e-calendar]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = process.argv[2] ?? 'app-www';
const OUT = process.argv[3] ?? 'e2e-calendar';
const API = 'http://127.0.0.1:54321';
mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ fixtures, relative to today (New York)
const ymd = (d) => d.toISOString().slice(0, 10);
const nyToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const day = (n) => { const d = new Date(`${nyToday}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const compact = (d) => d.replaceAll('-', '');
const ics = (name, body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//e2e//EN\r\nX-WR-CALNAME:${name}\r\n${body}END:VCALENDAR\r\n`;
const FIX = {
  // Choir every day for 6 days at 1:00 PM Los Angeles (4:00 PM New York); skipped tomorrow (EXDATE); day 2 cancelled
  // (an override with STATUS:CANCELLED); day 3 moved to 2:00 PM LA. Plus a two-day all-day "No school".
  '/school.ics': ics('Lincoln Elementary', [
    'BEGIN:VEVENT', 'UID:choir@lincoln', 'SUMMARY:Choir', `DTSTART;TZID=America/Los_Angeles:${compact(day(0))}T130000`, `DTEND;TZID=America/Los_Angeles:${compact(day(0))}T140000`,
    'RRULE:FREQ=DAILY;COUNT=6', `EXDATE;TZID=America/Los_Angeles:${compact(day(1))}T130000`, 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:choir@lincoln', `RECURRENCE-ID;TZID=America/Los_Angeles:${compact(day(2))}T130000`, 'SUMMARY:Choir', 'STATUS:CANCELLED',
    `DTSTART;TZID=America/Los_Angeles:${compact(day(2))}T130000`, 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:choir@lincoln', `RECURRENCE-ID;TZID=America/Los_Angeles:${compact(day(3))}T130000`, 'SUMMARY:Choir (moved)',
    `DTSTART;TZID=America/Los_Angeles:${compact(day(3))}T140000`, `DTEND;TZID=America/Los_Angeles:${compact(day(3))}T150000`, 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:noschool@lincoln', 'SUMMARY:No school', `DTSTART;VALUE=DATE:${compact(day(1))}`, `DTEND;VALUE=DATE:${compact(day(3))}`, 'END:VEVENT',
    '',
  ].join('\r\n')),
  '/work.ics': ics('Jen work', ['BEGIN:VEVENT', 'UID:board@work', 'SUMMARY:Board review', `DTSTART:${compact(day(0))}T150000Z`, `DTEND:${compact(day(0))}T160000Z`, 'END:VEVENT', ''].join('\r\n')),
};
let goneStatus = 200;
const fixtures = createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/broken.ics') { res.writeHead(503); return res.end(); }
  if (p === '/html.ics') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html>Please sign in</html>'); }
  if (p === '/gone.ics') {
    if (goneStatus !== 200) { res.writeHead(goneStatus); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/calendar' });
    return res.end(ics('Soccer', ['BEGIN:VEVENT', 'UID:game@soccer', 'SUMMARY:Soccer game', `DTSTART;VALUE=DATE:${compact(day(0))}`, 'END:VEVENT', ''].join('\r\n')));
  }
  const body = FIX[p];
  if (!body) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/calendar', ETag: `"${p}-1"` });
  res.end(body);
});
await new Promise((r) => fixtures.listen(54322, '127.0.0.1', r));

// ------------------------------------------------------------------ the app bundle
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = extname(p) ? join(ROOT, p) : existsSync(join(ROOT, p, 'index.html')) ? join(ROOT, p, 'index.html') : join(ROOT, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;

const results = [];
let failures = 0;
const check = (step, ok, detail = '') => {
  results.push({ step, ok: Boolean(ok), detail });
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`);
};
const note = (step, detail) => { results.push({ step, ok: null, detail }); console.log(`  • ${step} — ${detail}`); };
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;
const call = async (path, token, body, headers = {}) => {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};
const rpc = (token, fn, body = {}) => call(`/rest/v1/rpc/${fn}`, token, body);
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
const openCalendar = async (page, view = 'agenda') => {
  await page.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-sync-status="synced"]', { timeout: 15000 }).catch(() => {});
  await page.click(`[data-view="${view}"]`);
  await settle(page);
};
const titles = (page) => page.locator('[data-calendar-event]').evaluateAll((els) => els.map((e) => e.getAttribute('data-calendar-event')));

console.log(`calendar e2e: app ${base}, isolated backend ${API}, fixtures :54322`);

// ------------------------------------------------------------------ 1. Jen, with a family event of her own
const jenCtx = await browser.newContext(phone);
const jen = await jenCtx.newPage();
const jenToken = await signIn(jen, 'jen@e2e.test');
const maya = await sql(`select id from public.club_family_members where first_name = 'Maya'`);
const ownSave = await rpc(jenToken, 'calendar_event_save', { p_event: { id: 'ca000000-0000-0000-0000-000000000001', title: 'Dentist', starts_on: day(0), start_time: '09:00', timezone: 'America/New_York', member_ids: [maya] }, p_base_revision: null });
check('a family event saves as before (existing calendar unchanged)', ownSave.status === 200, `status ${ownSave.status}`);
await openCalendar(jen);
check('the Calendars entry appears once the server has subscriptions', await jen.locator('[data-open-calendars]').count());

// ------------------------------------------------------------------ 2. Jen subscribes to the school calendar in the app
await jen.click('[data-open-calendars]');
await jen.waitForSelector('[data-calendar-sources]');
await jen.fill('[data-field="feed-url"]', 'webcal://lincoln.calendar.e2e.test/school.ics');
await jen.fill('[data-field="feed-name"]', 'Lincoln Elementary');
await jen.click('[data-calendar-sources] [data-feed-member="Maya"]');
await jen.click('[data-feed-add] [data-visibility="household"]');
await shot(jen, '01-add-calendar');
await jen.click('[data-feed-save]');
await jen.waitForSelector('[data-feed="Lincoln Elementary"] [data-feed-status="ok"]', { timeout: 15000 }).catch(() => {});
check('webcal link accepted, stored as https, fetched at once', (await sql(`select url || '|' || status || '|' || visibility from public.calendar_feeds where name = 'Lincoln Elementary'`)) === 'https://lincoln.calendar.e2e.test/school.ics|ok|household');
check('its status shows in the panel', /events · updated/.test(await jen.locator('[data-feed="Lincoln Elementary"] [data-feed-status]').innerText()));
await shot(jen, '02-calendars-panel');
await jen.click('[data-calendar-sources] button:has-text("Done")');
await settle(jen);

// ------------------------------------------------------------------ 3. The unified calendar
const t = await titles(jen);
const choir = t.filter((x) => x === 'Choir').length;
check('imported and family events in one calendar', t.includes('Dentist') && t.includes('Choir'), t.join(', '));
check('recurrence: 6 days − EXDATE − cancelled − moved = 3 plain Choir rows', choir === 3, `${choir}`);
check('a moved occurrence shows at its new time', t.includes('Choir (moved)'));
const firstChoir = jen.locator('[data-calendar-event="Choir"]').first();
check('time zone: 1:00 PM in Los Angeles shows as 4 PM in New York', /^4–5 PM/.test(await firstChoir.innerText()), (await firstChoir.innerText()).split('\n')[0]);
check('multi-day all-day event shows on both days', (await jen.locator('[data-calendar-event="No school"]').count()) === 2);
check('imported rows say where they came from', /Lincoln Elementary/.test(await firstChoir.innerText()));
await shot(jen, '03-agenda-unified', true);
await firstChoir.click();
await jen.waitForSelector('[data-external-event]');
const sheet = await jen.locator('[data-external-event]').innerText();
check('an imported event opens read-only (no edit sheet)', (await jen.locator('[data-event-sheet]').count()) === 0 && /read-only/.test(sheet) && /Maya’s calendar/.test(sheet));
await shot(jen, '04-imported-event');
await jen.click('[data-external-event] button:has-text("Done")');
check('imported events never enter the family calendar table', (await sql(`select count(*) from public.calendar_events where title like 'Choir%' or title = 'No school'`)) === '0');

// ------------------------------------------------------------------ 4. Private work calendar, broken links
const work = await rpc(jenToken, 'calendar_feed_add', { p: { url: 'https://work.calendar.e2e.test/work.ics', name: 'Jen work', visibility: 'private', member_id: null, timezone: 'America/New_York' } });
const workId = work.body?.id;
await call('/functions/v1/calendar-feeds', jenToken, { feed_id: workId });
const broken = (await rpc(jenToken, 'calendar_feed_add', { p: { url: 'https://broken.calendar.e2e.test/broken.ics', name: 'Swim club', visibility: 'household', member_id: null, timezone: 'America/New_York' } })).body;
const brokenRun = await call('/functions/v1/calendar-feeds', jenToken, { feed_id: broken.id });
check('a calendar that errors is kept, with a plain reason', brokenRun.body?.result === 'error' && /try again/.test(brokenRun.body?.error ?? ''), brokenRun.body?.error);
const html = (await rpc(jenToken, 'calendar_feed_add', { p: { url: 'https://html.calendar.e2e.test/html.ics', name: 'Not a calendar', visibility: 'private', member_id: null, timezone: 'America/New_York' } })).body;
const htmlRun = await call('/functions/v1/calendar-feeds', jenToken, { feed_id: html.id });
check('a web page instead of a calendar says so', /didn’t return a calendar/.test(htmlRun.body?.error ?? ''));
const gone = (await rpc(jenToken, 'calendar_feed_add', { p: { url: 'https://soccer.calendar.e2e.test/gone.ics', name: 'Soccer', visibility: 'household', member_id: null, timezone: 'America/New_York' } })).body;
await call('/functions/v1/calendar-feeds', jenToken, { feed_id: gone.id });
check('local addresses are refused when adding', (await rpc(jenToken, 'calendar_feed_add', { p: { url: 'http://127.0.0.1:54322/school.ics', name: 'x', visibility: 'private', timezone: 'America/New_York' } })).status >= 400);

// ------------------------------------------------------------------ 5. Sam: household calendars only, duplicates once
const samId = await sql(`select id from public.club_family_members where first_name = 'Sam'`);
const invite = await rpc(jenToken, 'household_invite_create', { p_member_id: samId, p_email: 'sam@e2e.test' });
const samCtx = await browser.newContext(phone);
const sam = await samCtx.newPage();
const samToken = await signIn(sam, 'sam@e2e.test');
const joined = await rpc(samToken, 'household_invite_accept', { p_code: invite.body?.code });
check('Sam joins the household (second adult)', joined.status === 200, `status ${joined.status}`);
// Sam subscribes to the same school calendar himself.
const dup = await rpc(samToken, 'calendar_feed_add', { p: { url: 'https://lincoln.calendar.e2e.test/school.ics', name: 'School (Sam)', visibility: 'household', member_id: maya, timezone: 'America/New_York' } });
await call('/functions/v1/calendar-feeds', samToken, { feed_id: dup.body?.id });
await openCalendar(sam);
const st = await titles(sam);
check('Sam sees Jen’s shared school calendar', st.includes('Choir'));
check('the same calendar subscribed twice shows once', st.filter((x) => x === 'Choir').length === 3, `${st.filter((x) => x === 'Choir').length}`);
check('Jen’s private work calendar is not in Sam’s calendar', !st.includes('Board review'));
const samFeeds = await rpc(samToken, 'calendar_feeds');
const jenSchool = samFeeds.body?.find((f) => f.name === 'Lincoln Elementary');
check('Sam never gets Jen’s calendar link', jenSchool && jenSchool.url === null && jenSchool.mine === false);
check('Sam can’t change or remove Jen’s calendar', (await rpc(samToken, 'calendar_feed_update', { p_id: jenSchool?.id, p: { visibility: 'private' } })).status >= 400
  && (await rpc(samToken, 'calendar_feed_remove', { p_id: jenSchool?.id })).body !== true);
check('Sam can’t refresh Jen’s calendar', (await call('/functions/v1/calendar-feeds', samToken, { feed_id: jenSchool?.id })).status === 404);
await sam.click('[data-open-calendars]');
await sam.waitForSelector('[data-calendar-sources]');
check('Jen’s shared calendars are listed for Sam by name only', await sam.locator('[data-feed-shared="Lincoln Elementary"]').count() && !(await sam.locator('[data-calendar-sources]').innerText()).includes('school.ics'));
await shot(sam, '05-sam-calendars');
await sam.click('[data-calendar-sources] button:has-text("Done")');

// Rosa (another household) sees nothing of the Parks'.
const rosaCtx = await browser.newContext(phone);
const rosa = await rosaCtx.newPage();
const rosaToken = await signIn(rosa, 'rosa@e2e.test');
const rosaEvents = await rpc(rosaToken, 'calendar_feed_events', { p_from: `${day(-1)}T00:00:00Z`, p_to: `${day(10)}T00:00:00Z`, p_scope: 'mine' });
check('another household sees none of the Parks’ calendars', Array.isArray(rosaEvents.body) && rosaEvents.body.length === 0 && (await rpc(rosaToken, 'calendar_feeds')).body?.length === 0);

// ------------------------------------------------------------------ 6. Jen's view: private too
await openCalendar(jen);
const jt = await titles(jen);
check('Jen sees her own private work calendar', jt.includes('Board review'));
check('Jen also sees each school event once (her copy + Sam’s)', jt.filter((x) => x === 'Choir').length === 3);

let eventCalls = 0;
jen.on('request', (r) => { if (r.url().includes('/rpc/calendar_feed_events')) eventCalls++; });
await openCalendar(jen);
check('nothing changed: reopening downloads the list, not the events again', eventCalls === 0, `${eventCalls} events downloads`);
const tap1 = await call('/functions/v1/calendar-feeds', jenToken, { feed_id: work.body?.id });
const tap = await call('/functions/v1/calendar-feeds', jenToken, { feed_id: work.body?.id });
note('Refresh, then Refresh again at once', `${tap1.body?.result} → ${tap.body?.result}`);
check('a second Refresh within 30 s doesn’t fetch again', tap.body?.result === 'not_modified');
const cached = await jen.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('omc:calendar:feeds')).map((k) => localStorage.getItem(k)).join(''));
check('the device copy never holds a calendar link', cached.includes('Board review') && !/e2e\.test|webcal:|https?:\/\//.test(cached), cached.match(/.{0,50}(e2e\.test|webcal:|https?:\/\/).{0,30}/)?.[0] ?? `Board review in copy: ${cached.includes('Board review')}`);

// Offline: the imported events stay (the device copy), and nothing is lost when the connection comes back.
await jenCtx.route(`${API}/**`, (route) => route.abort('internetdisconnected'));
await jen.reload({ waitUntil: 'domcontentloaded' });
await jen.waitForSelector('[data-calendar-event="Choir"]', { timeout: 15000 }).catch(() => {});
await jen.click('[data-view="agenda"]').catch(() => {});
await settle(jen);
const off = await titles(jen);
check('offline: imported and family events still show', off.includes('Choir') && off.includes('Board review') && off.includes('Dentist'), off.join(', '));
await shot(jen, '05b-offline');
await jenCtx.unroute(`${API}/**`);
await openCalendar(jen);
check('back online: same calendar', (await titles(jen)).filter((x) => x === 'Choir').length === 3);

// ------------------------------------------------------------------ 7. Weekly Family Meeting: shared calendars only
await jen.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' });
await jen.waitForSelector('[data-meeting-week]', { timeout: 15000 }).catch(() => {});
await settle(jen, 1200);
const week = await jen.locator('[data-meeting-week]').textContent().catch(() => '') ?? '';
check('the meeting shows shared school events', /Choir · Lincoln Elementary/.test(week), week.replace(/\s+/g, ' ').slice(0, 160));
check('the meeting leaves out private calendars', !/Board review/.test(week));
check('imported events aren’t flagged “nobody handling it”', !/Choir · nobody/.test(week));
await shot(jen, '06-meeting-week', true);

// ------------------------------------------------------------------ 8. Today shows them too
await jen.goto(`${base}/app`, { waitUntil: 'networkidle' });
await settle(jen, 1200);
check('Today lists today’s imported events beside family ones', await jen.locator('[data-today-event="Choir"]').count() && await jen.locator('[data-today-event="Dentist"]').count());
await shot(jen, '07-today');

// ------------------------------------------------------------------ 9. Privacy switch, disconnection, removal
await openCalendar(jen);
await jen.click('[data-open-calendars]');
await jen.waitForSelector('[data-calendar-sources]');
await jen.click('[data-feed="Lincoln Elementary"] [data-visibility="private"]');
await settle(jen, 900);
check('Jen makes the school calendar private', (await sql(`select visibility from public.calendar_feeds where name = 'Lincoln Elementary'`)) === 'private');
await jen.click('[data-calendar-sources] button:has-text("Done")');
const afterPrivate = await rpc(samToken, 'calendar_feeds');
check('Sam no longer sees it listed', !afterPrivate.body?.some((f) => f.name === 'Lincoln Elementary'));

goneStatus = 404;
// Each refresh as if the backoff had passed (a manual Refresh within 30 s is answered from what's stored).
const refreshGone = async () => { await sql(`update public.calendar_feeds set last_attempt_at = now() - interval '1 hour' where id = '${gone.id}'`); return call('/functions/v1/calendar-feeds', jenToken, { feed_id: gone.id }); };
await refreshGone();
await refreshGone();
check('a link that stops working keeps its events through two failed refreshes', (await sql(`select status || '|' || event_count from public.calendar_feeds where id = '${gone.id}'`)) === 'error|1'
  && (await sql(`select count(*) from public.calendar_feed_events where feed_id = '${gone.id}'`)) === '1');
const goneRun = await refreshGone();
check('the third in a row marks it disconnected', goneRun.body?.result === 'gone' && (await sql(`select status || '|' || event_count from public.calendar_feeds where id = '${gone.id}'`)) === 'disconnected|0');
check('a disconnected calendar’s events are cleared', (await sql(`select count(*) from public.calendar_feed_events where feed_id = '${gone.id}'`)) === '0');
await openCalendar(jen);
await jen.click('[data-open-calendars]');
await jen.waitForSelector('[data-feed="Soccer"]');
check('the panel tells her it stopped working', /stopped working|no longer exists/.test(await jen.locator('[data-feed="Soccer"] [data-feed-status]').innerText()));
await shot(jen, '08-disconnected');
goneStatus = 200;
await jen.click('[data-feed="Soccer"] [data-feed-refresh]');
await jen.waitForSelector('[data-feed="Soccer"] [data-feed-status="ok"]', { timeout: 15000 }).catch(() => {});
check('Refresh reconnects it once the link works again', (await sql(`select status from public.calendar_feeds where id = '${gone.id}'`)) === 'ok');
await jen.click('[data-feed="Jen work"] [data-feed-remove]');
await settle(jen, 900);
check('removing a calendar deletes it and its events', (await sql(`select count(*) from public.calendar_feeds where id = '${workId}'`)) === '0' && (await sql(`select count(*) from public.calendar_feed_events where feed_id = '${workId}'`)) === '0');
await jen.click('[data-calendar-sources] button:has-text("Done")');
await settle(jen);
check('…and it leaves the calendar', !(await titles(jen)).includes('Board review'));

// ------------------------------------------------------------------ 10. Scheduled refresh, and the family calendar still edits
const cronBad = await call('/functions/v1/calendar-feeds', null, { mode: 'due' }, { 'x-calendar-cron': 'nope' });
await sql(`update public.calendar_feeds set last_attempt_at = now() - interval '1 day'`);
const cron = await call('/functions/v1/calendar-feeds', null, { mode: 'due' }, { 'x-calendar-cron': 'e2e-cron' });
check('scheduled refresh needs its secret, then refreshes due calendars', cronBad.status === 401 && cron.body?.refreshed >= 3, JSON.stringify(cron.body));
check('unchanged calendars are not re-read (ETag → 304 path)', (await sql(`select count(*) from public.calendar_feeds where etag is not null`)) !== '0');

await jen.click('[data-view="week"]');
await jen.locator('[data-calendar-day]').filter({ hasText: 'Today' }).locator('button.cal-add').click();
await jen.fill('[data-event-sheet] [data-field="title"]', 'Piano');
await jen.click('[data-save-event]');
await settle(jen, 1500);
check('creating a family event still works beside imported ones', (await sql(`select count(*) from public.calendar_events where title = 'Piano' and deleted_at is null`)) === '1');
await jen.locator('[data-calendar-event="Piano"]').first().click();
await jen.waitForSelector('[data-event-sheet]');
check('family events still open the edit sheet', await jen.locator('[data-event-sheet]').count());
await shot(jen, '09-family-event-edit');

// ------------------------------------------------------------------ 11. Rollback: imported calendars vanish, family events stay
await jen.click('[data-event-sheet] button:has-text("Cancel"), [data-event-sheet] [aria-label="Close"]').catch(() => {});
await jen.keyboard.press('Escape').catch(() => {});
await sql(readFileSync('supabase/rollout/calendar/rollback.sql', 'utf8'));
check('rollback removes subscriptions only (family events intact)', (await sql(`select to_regclass('public.calendar_feeds') is null`)) === 't'
  && (await sql(`select count(*) from public.calendar_events where title in ('Dentist', 'Piano') and deleted_at is null`)) === '2');
await openCalendar(jen);
const rb = await titles(jen);
check('after a rollback the app shows no imported events and no Calendars entry; family events remain', !rb.includes('Choir') && rb.includes('Dentist') && rb.includes('Piano') && !(await jen.locator('[data-open-calendars]').count()), rb.join(', '));
check('…and forgets its device copy (nothing stale offline)', !(await jen.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('omc:calendar:feeds')))));

writeFileSync(join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), failures, results }, null, 2));
await browser.close();
server.close();
fixtures.close();
console.log(failures ? `\n${failures} failed` : `\nall ${results.length} passed`);
process.exit(failures ? 1 : 0);
