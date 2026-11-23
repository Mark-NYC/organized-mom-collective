#!/usr/bin/env node
/**
 * Responsibilities on imported calendar events, end to end (docs/calendar/EVENT_RESPONSIBILITIES.md), on the Rivera
 * demo household (Ana, Luis; Sofia, Mateo, Elena) installed in the isolated test backend. Ana's phone and Luis's phone
 * (Chromium at iPhone size, the app bundle), America/Chicago. The Riveras' calendars are iCal fixtures served on this
 * machine (:54322) and fetched by the real calendar-feeds handler, like Google or a school calendar; nothing is ever
 * written back to them. Never touches production.
 *
 *   PGHOST=localhost PGUSER=postgres bash scripts/e2e/family-db.sh
 *   E2E_DB=omc_family_e2e node scripts/e2e/test-backend.mjs &
 *   npm run build:app   (against the test backend: PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 …)
 *   node scripts/e2e/event-tasks-e2e.mjs [app-www] [out=e2e-event-tasks]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = process.argv[2] ?? 'app-www';
const OUT = process.argv[3] ?? 'e2e-event-tasks';
const API = 'http://127.0.0.1:54321';
const PASSWORD = 'e2e-test-password'; // the test backend's only password (never a real one)
const ANA = 'rivera-ana@example.com', LUIS = 'rivera-luis@example.com', OWNER = 'demo-owner@e2e.test', OTHER = 'other-family@e2e.test';
const TZ = 'America/Chicago';
// The backend reaches *.calendar.e2e.test at E2E_CAL_FIXTURES (default :54322); same port here.
const FIXTURE_PORT = Number(new URL(process.env.E2E_CAL_FIXTURES ?? 'http://127.0.0.1:54322').port);
mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ the Riveras' calendars, relative to today (Chicago)
const ymd = (d) => d.toISOString().slice(0, 10);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const day = (n) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const c = (d) => d.replaceAll('-', '');
const ics = (name, lines) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//e2e//EN\r\nX-WR-CALNAME:${name}\r\nX-WR-TIMEZONE:${TZ}\r\n${lines.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
const at = (d, hhmm) => `TZID=${TZ}:${c(d)}T${hhmm}00`;
// What each calendar says right now; the test changes it (reschedule, cancel) and refreshes.
const cal = {
  // 1. Soccer practice: every other day, 4 times, starting today at 5:30 PM (a repeating event).
  soccer: { moveFirst: false },
  // 2. School field trip: a one-off, in two days, 9 AM.
  school: { tripDay: 2 },
  // 3. Family game night: every other day from tomorrow, 3 times (a repeating family event).
  family: { cancelSecond: false },
};
const FIX = {
  '/soccer.ics': () => ics('Mateo soccer', [
    'BEGIN:VEVENT', 'UID:practice@riverside-fc', 'SUMMARY:Soccer practice', 'LOCATION:Riverside Park field 3', `DTSTART;${at(day(0), '1730')}`, `DTEND;${at(day(0), '1900')}`,
    'RRULE:FREQ=DAILY;INTERVAL=2;COUNT=4', 'END:VEVENT',
    ...(cal.soccer.moveFirst ? ['BEGIN:VEVENT', 'UID:practice@riverside-fc', `RECURRENCE-ID;${at(day(0), '1730')}`, 'SUMMARY:Soccer practice (field 5)', 'LOCATION:Riverside Park field 5',
      `DTSTART;${at(day(0), '1830')}`, `DTEND;${at(day(0), '2000')}`, 'END:VEVENT'] : []),
  ]),
  '/school.ics': () => ics('Lincoln Elementary', [
    'BEGIN:VEVENT', 'UID:fieldtrip@lincoln', 'SUMMARY:Field trip: Science Museum', `DTSTART;${at(day(cal.school.tripDay), '0900')}`, `DTEND;${at(day(cal.school.tripDay), '1400')}`, 'END:VEVENT',
  ]),
  '/family.ics': () => ics('Rivera family', [
    'BEGIN:VEVENT', 'UID:gamenight@rivera', 'SUMMARY:Family game night', `DTSTART;${at(day(1), '1900')}`, `DTEND;${at(day(1), '2030')}`, 'RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3',
    ...(cal.family.cancelSecond ? [`EXDATE;${at(day(3), '1900')}`] : []), 'END:VEVENT',
  ]),
};
const methods = new Set();
const fixtures = createServer((req, res) => {
  methods.add(req.method);
  const body = FIX[new URL(req.url, 'http://x').pathname];
  if (!body) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/calendar' });
  res.end(body());
});
await new Promise((r) => fixtures.listen(FIXTURE_PORT, '127.0.0.1', r));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = [join(ROOT, p), join(ROOT, p, 'index.html'), join(ROOT, `${p}.html`)].find((f) => existsSync(f) && statSync(f).isFile());
  if (!file) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;

let failures = 0;
const results = [];
const check = (step, ok, detail = '') => { results.push({ step, ok: Boolean(ok), detail }); if (!ok) failures++; console.log(`  ${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`); };
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;
const call = async (path, token, body) => {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};
const rpc = (token, fn, body = {}) => call(`/rest/v1/rpc/${fn}`, token, body);
const settle = (page, ms = 1200) => page.waitForTimeout(ms);
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false }).catch(() => {});
const HID = `(select household_id from public.demo_households where key = 'rivera')`;
const tasksSql = (where = 'true') => sql(`select coalesce(string_agg(title || '|' || coalesce((select first_name from public.club_family_members m where m.id = t.member_id), '-') || '|' || (done_at is not null), ',' order by title), '') from public.calendar_event_tasks t where household_id = ${HID} and ${where}`);

const browser = await chromium.launch();
const errors = [];
const phone = async (device = 'iPhone 15 Pro') => {
  const ctx = await browser.newContext({ ...devices[device], timezoneId: TZ });
  ctx.on('page', (p) => p.on('pageerror', (e) => errors.push(`${device}: ${e.message}`)));
  return ctx.newPage();
};
async function signIn(page, email) {
  await page.goto(`${base}/app/sign-in`, { waitUntil: 'networkidle' });
  await page.click('[data-use-password]');
  await page.fill('#ow-pw-email', email);
  await page.fill('#ow-password', PASSWORD);
  await page.click('[data-password-signin] button[type="submit"]');
  await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
  await settle(page, 1000);
  return page.evaluate(() => JSON.parse(localStorage.getItem('omc:account:session')).access_token);
}
const openCalendar = async (page) => {
  await page.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' });
  await page.click('[data-view="agenda"]');
  await page.waitForSelector('[data-calendar-event="Soccer practice"], [data-calendar-event="Soccer practice (field 5)"]', { timeout: 15000 });
  await settle(page);
};
/** Open the nth occurrence of an imported event in the agenda. */
const openEvent = async (page, title, nth = 0) => {
  await page.locator(`[data-calendar-event="${title}"]:has([data-event-source])`).nth(nth).click();
  await page.waitForSelector('[data-external-event]');
};
const closeSheet = (page) => page.click('[data-external-event] button:has-text("Done")');
const addTask = async (page, title, who) => {
  await page.click('[data-task-add]');
  await page.fill('[data-task-title]', title);
  if (who) await page.click(`[data-task-member="${who}"]`);
  await page.click('[data-task-save]');
  await page.waitForSelector(`[data-event-task="${title}"]`, { timeout: 10000 });
};
const refreshAll = async (token) => {
  await sql(`update public.calendar_feeds set last_attempt_at = now() - interval '1 hour' where household_id = ${HID}`);
  for (const id of (await sql(`select string_agg(id::text, ',') from public.calendar_feeds where household_id = ${HID}`)).split(',')) await call('/functions/v1/calendar-feeds', token, { feed_id: id });
};

console.log(`event responsibilities e2e: app ${base}, isolated backend ${API}, fixtures :${FIXTURE_PORT}`);

// ------------------------------------------------------------------ setup (test database only): the Rivera demo, their calendars
await sql(`insert into auth.users (id, email, email_confirmed_at) values (gen_random_uuid(), '${OWNER}', now()), (gen_random_uuid(), '${ANA}', now()), (gen_random_uuid(), '${LUIS}', now()), (gen_random_uuid(), '${OTHER}', now()) on conflict do nothing;
insert into public.admin_users (user_id, role) select id, 'owner' from auth.users where email = '${OWNER}' on conflict do nothing;`);
await sql(`select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = '${OWNER}'))::text, false); select public.demo_rivera_reset('${ANA}', '${LUIS}'); select set_config('request.jwt.claims', '', false);`);
check('the Rivera demo household is installed (Ana, Luis, Sofia, Mateo, Elena)', (await sql(`select string_agg(first_name, ',' order by first_name) from public.club_family_members where household_id = ${HID} and archived_at is null`)) === 'Ana,Elena,Luis,Mateo,Sofia');
await sql(`insert into public.calendar_feed_testers (user_id, note) select id, 'e2e: Rivera' from auth.users where email = '${ANA}'`);
const ownBefore = await sql(`select md5(string_agg(id || revision, ',' order by id)) from public.calendar_events where household_id = ${HID}`);

const ana = await phone();
const anaToken = await signIn(ana, ANA);
const member = (n) => sql(`select id from public.club_family_members where household_id = ${HID} and first_name = '${n}'`);
for (const [path, name, who] of [['soccer', 'Mateo soccer', 'Mateo'], ['school', 'Lincoln Elementary', 'Sofia'], ['family', 'Rivera family', null]]) {
  const f = await rpc(anaToken, 'calendar_feed_add', { p: { url: `https://rivera.calendar.e2e.test/${path}.ics`, name, visibility: 'household', member_id: who ? await member(who) : null, timezone: TZ } });
  await call('/functions/v1/calendar-feeds', anaToken, { feed_id: f.body?.id });
}
check('three calendars imported: soccer (repeats), school field trip (one-off), family game night (repeats)',
  (await sql(`select count(*) from public.calendar_feed_events where household_id = ${HID}`)) === '8', await sql(`select count(*) from public.calendar_feed_events where household_id = ${HID}`));
const importedBefore = await sql(`select md5(string_agg(uid || instance_key || title, ',' order by uid, instance_key)) from public.calendar_feed_events where household_id = ${HID}`);

// ------------------------------------------------------------------ 1. staged rollout: off until the test household has it
await openCalendar(ana);
await openEvent(ana, 'Soccer practice');
check('off by default: the event opens read-only, with no responsibilities section', (await ana.locator('[data-event-tasks]').count()) === 0 && /read-only here/.test(await ana.locator('[data-external-event]').innerText()));
await closeSheet(ana);
await sql(`update public.calendar_feed_testers set event_tasks = true where user_id = (select id from auth.users where email = '${ANA}')`);

// ------------------------------------------------------------------ 2. Soccer practice: three responsibilities, a few taps
await openCalendar(ana);
await openEvent(ana, 'Soccer practice');
const sheet = await ana.locator('[data-external-event]').innerText();
check('the event: title, day and time, place, its calendar, and an empty "Who’s doing what"',
  /Soccer practice/.test(sheet) && /5:30/.test(sheet) && /Riverside Park field 3/.test(sheet) && /Mateo soccer/.test(sheet) && /Who’s doing what/i.test(sheet) && (await ana.locator('[data-task-add]').count()) === 1, sheet.replace(/\n/g, ' | ').slice(0, 200));
await shot(ana, '01-event-empty');
await addTask(ana, 'Pack soccer bag', 'Mateo');
await addTask(ana, 'Drive to practice', 'Luis');
await addTask(ana, 'Prepare dinner', 'Ana');
await shot(ana, '02-soccer-three');
check('soccer practice: Pack soccer bag · Mateo, Drive to practice · Luis, Prepare dinner · Ana (saved for the household)',
  (await tasksSql(`event_uid = 'practice@riverside-fc'`)) === 'Drive to practice|Luis|false,Pack soccer bag|Mateo|false,Prepare dinner|Ana|false');
check('each shows who, by name', /Mateo/.test(await ana.locator('[data-event-task="Pack soccer bag"] [data-task-who]').innerText()));
// Complete one; the sheet and the calendar row both say so.
await ana.click('[data-event-task="Pack soccer bag"] [data-task-done]');
await settle(ana, 800);
check('check one off: done at once, and saved', (await ana.locator('[data-event-task="Pack soccer bag"] [data-task-done]').getAttribute('aria-checked')) === 'true'
  && (await tasksSql(`title = 'Pack soccer bag'`)) === 'Pack soccer bag|Mateo|true');
await closeSheet(ana);
check('the calendar row says how far along it is, in words (no controls on the grid)',
  (await ana.locator('[data-calendar-event="Soccer practice"]:has([data-event-source])').first().locator('[data-event-tasks-label]').innerText()) === '1 of 3 done'
  && (await ana.locator('[data-calendar-event] [data-task-done]').count()) === 0);
// Only that occurrence: the next practice has none.
await openEvent(ana, 'Soccer practice', 1);
check('a repeating event: the next practice has its own (none yet)', (await ana.locator('[data-event-task]').count()) === 0);
await closeSheet(ana);

// ------------------------------------------------------------------ 3. School field trip: two, then edit, reassign, remove
await openEvent(ana, 'Field trip: Science Museum');
await addTask(ana, 'Sign permission slip', 'Ana');
await addTask(ana, 'Pack lunch', 'Sofia');
await ana.click('[data-event-task="Pack lunch"] [data-task-edit]');
await ana.fill('[data-task-title]', 'Pack a nut-free lunch');
await ana.click('[data-task-member="Luis"]');
await ana.click('[data-task-save]');
await ana.waitForSelector('[data-event-task="Pack a nut-free lunch"]');
check('edit the words and reassign Sofia → Luis', (await tasksSql(`event_uid = 'fieldtrip@lincoln'`)) === 'Pack a nut-free lunch|Luis|false,Sign permission slip|Ana|false');
await ana.click('[data-event-task="Pack a nut-free lunch"] [data-task-edit]');
await ana.click('[data-task-member="Sofia"]');
await ana.click('[data-task-save]');
await settle(ana, 600);
await addTask(ana, 'Extra item', null);
check('a responsibility for anyone (no one assigned) says "Anyone"', /Anyone/.test(await ana.locator('[data-event-task="Extra item"] [data-task-who]').innerText()));
await ana.click('[data-event-task="Extra item"] [data-task-edit]');
await ana.click('[data-task-remove]');
await ana.waitForSelector('[data-event-task="Extra item"]', { state: 'detached' });
check('remove one', (await tasksSql(`event_uid = 'fieldtrip@lincoln'`)) === 'Pack a nut-free lunch|Sofia|false,Sign permission slip|Ana|false');
await ana.click('[data-task-add]');
await ana.click('[data-task-save]');
check('an empty one is refused, with a plain message', /Write what needs doing/.test(await ana.locator('[data-task-error]').innerText()));
await ana.click('[data-task-form] button:has-text("Cancel")');
await shot(ana, '03-field-trip');
await closeSheet(ana);

// ------------------------------------------------------------------ 4. Family game night (repeating): per-occurrence, by keyboard
await openEvent(ana, 'Family game night', 0);
await ana.focus('[data-task-add]');
await ana.keyboard.press('Enter');
await ana.keyboard.type('Pick the game');
await ana.click('[data-task-member="Sofia"]');
await ana.focus('[data-task-title]');
await ana.keyboard.press('Enter');
await ana.waitForSelector('[data-event-task="Pick the game"]', { timeout: 10000 });
check('keyboard: Enter opens the form, typing and Enter saves it', (await tasksSql(`title = 'Pick the game'`)) === 'Pick the game|Sofia|false');
await ana.keyboard.press('Escape');
await settle(ana, 400);
check('Escape closes the event', (await ana.locator('[data-external-event]').count()) === 0);
await openEvent(ana, 'Family game night', 1);
await addTask(ana, 'Make popcorn', 'Mateo');
await closeSheet(ana);
check('each game night has its own responsibilities', (await sql(`select count(distinct instance_key) from public.calendar_event_tasks where event_uid = 'gamenight@rivera'`)) === '2');

// ------------------------------------------------------------------ 5. Luis's phone: Today shows them; he checks off; Ana sees it
const luis = await phone('iPhone 15 Pro Max');
const luisToken = await signIn(luis, LUIS);
await luis.goto(`${base}/app`, { waitUntil: 'networkidle' });
await luis.waitForSelector('[data-today-trackable]', { timeout: 15000 });
const tile = await luis.locator('[data-today-responsibilities]').innerText();
// Two-tab redesign: Today's Responsibilities lists today's (with a checkbox), and says how many more this week.
check('Luis’s Today: today’s responsibilities with person, task and event; the rest of the week counted',
  /Drive to practice/.test(tile) && /Luis\s+Drive to practice\s+Soccer practice/.test(tile) && /Pack soccer bag/.test(tile) && !/Sign permission slip/.test(tile)
  && /more this week/i.test(await luis.locator('[data-today-later]').innerText().catch(() => '')),
  JSON.stringify({ luisRow: /Luis\s+Drive to practice\s+Soccer practice/.test(tile), bag: /Pack soccer bag/.test(tile), noSlip: !/Sign permission slip/.test(tile), later: await luis.locator('[data-today-later]').innerText().catch(() => 'none') }));
await shot(luis, '04-luis-today');
await luis.click('[data-today-task="Drive to practice"] [data-task-done]');
await settle(luis, 800);
check('Luis checks off "Drive to practice" on Today', (await tasksSql(`title = 'Drive to practice'`)) === 'Drive to practice|Luis|true');
await openCalendar(ana);
await openEvent(ana, 'Soccer practice');
check('Ana’s phone: done too (across devices)', (await ana.locator('[data-event-task="Drive to practice"] [data-task-done]').getAttribute('aria-checked')) === 'true'
  && /2 of 3 done/.test(await ana.locator('[data-event-tasks-count]').innerText()));
await ana.click('[data-event-task="Drive to practice"] [data-task-done]');
await settle(ana, 800);
await closeSheet(ana);
await luis.reload({ waitUntil: 'networkidle' });
await luis.waitForSelector('[data-today-trackable]');
check('and back: Ana unchecks it, Luis’s Today shows it open again', (await luis.locator('[data-today-task="Drive to practice"] [data-task-done]').getAttribute('aria-checked')) === 'false');

// ------------------------------------------------------------------ 6. The calendar changes underneath
const snapshot = () => sql(`select string_agg(title || ':' || coalesce(member_id::text, '-') || ':' || (done_at is not null), ',' order by id) from public.calendar_event_tasks where household_id = ${HID}`);
const before = await snapshot();
await refreshAll(anaToken);
await refreshAll(anaToken);
check('two refreshes: every responsibility unchanged', (await snapshot()) === before && (await sql(`select count(*) from public.calendar_event_tasks where household_id = ${HID}`)) === '7');
// A failed refresh keeps the events and the responsibilities.
await sql(`update public.calendar_feeds set last_attempt_at = now() - interval '1 hour' where household_id = ${HID}`);
fixtures.close(); await new Promise((r) => setTimeout(r, 200));
for (const id of (await sql(`select string_agg(id::text, ',') from public.calendar_feeds where household_id = ${HID}`)).split(',')) await call('/functions/v1/calendar-feeds', anaToken, { feed_id: id });
check('a failed refresh (the calendar server is down): events and responsibilities kept',
  (await sql(`select count(*) from public.calendar_feed_events where household_id = ${HID}`)) === '8' && (await snapshot()) === before && (await sql(`select count(*) from public.calendar_feeds where household_id = ${HID} and status = 'error'`)) === '3',
  (await snapshot()) + ' VS ' + before + ' / ' + await sql(`select (select count(*) from public.calendar_feed_events where household_id = ${HID}) || ' events; ' || string_agg(name || ':' || status || ':' || coalesce(last_error, ''), ', ') from public.calendar_feeds where household_id = ${HID}`));
await new Promise((r) => fixtures.listen(FIXTURE_PORT, '127.0.0.1', r));
// Rescheduled: this practice moves to 6:30 on field 5 (one occurrence); the field trip moves two days later.
cal.soccer.moveFirst = true; cal.school.tripDay = 4;
await refreshAll(anaToken);
await openCalendar(ana);
await openEvent(ana, 'Soccer practice (field 5)');
const moved = await ana.locator('[data-external-event]').innerText();
check('a moved practice (same occurrence): new time and place, the same three responsibilities', /6:30/.test(moved) && /field 5/.test(moved) && (await ana.locator('[data-event-task]').count()) === 3);
await closeSheet(ana);
await openEvent(ana, 'Field trip: Science Museum');
check('a rescheduled one-off (field trip, two days later): its responsibilities follow',
  new RegExp(new Date(`${day(4)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })).test(await ana.locator('[data-event-when]').innerText())
  && (await ana.locator('[data-event-task]').count()) === 2 && (await sql(`select string_agg(distinct event_on::text, ',') from public.calendar_event_tasks where event_uid = 'fieldtrip@lincoln'`)) === day(4));
await closeSheet(ana);
// Cancelled: the second game night (with "Make popcorn") is taken off the family calendar.
cal.family.cancelSecond = true;
await refreshAll(anaToken);
check('a cancelled game night: its responsibility is kept, never moved to another night',
  (await sql(`select event_on from public.calendar_event_tasks where title = 'Make popcorn'`)) === day(3) && (await sql(`select count(*) from public.calendar_feed_events where uid = 'gamenight@rivera'`)) === '2');
await ana.goto(`${base}/app`, { waitUntil: 'networkidle' });
await ana.waitForSelector('[data-today-trackable]');
const orphan = ana.locator('[data-today-task="Make popcorn"]');
check('Today says it’s no longer on the calendar, with Remove', /No longer on the calendar/.test(await orphan.innerText()));
await shot(ana, '05-ana-today-cancelled');
await orphan.locator('[data-task-orphan-remove]').click();
await settle(ana, 800);
check('Remove: gone', (await sql(`select count(*) from public.calendar_event_tasks where title = 'Make popcorn'`)) === '0');
// Reconnected: Ana removes the soccer calendar and adds it again.
const soccerId = await sql(`select id from public.calendar_feeds where household_id = ${HID} and name = 'Mateo soccer'`);
await rpc(anaToken, 'calendar_feed_remove', { p_id: soccerId });
check('unsubscribed: the practices leave the calendar; their responsibilities are kept', (await sql(`select count(*) from public.calendar_feed_events where uid = 'practice@riverside-fc'`)) === '0'
  && (await sql(`select count(*) from public.calendar_event_tasks where event_uid = 'practice@riverside-fc'`)) === '3');
const again = await rpc(anaToken, 'calendar_feed_add', { p: { url: 'https://rivera.calendar.e2e.test/soccer.ics', name: 'Mateo soccer', visibility: 'household', member_id: await member('Mateo'), timezone: TZ } });
await call('/functions/v1/calendar-feeds', anaToken, { feed_id: again.body?.id });
await openCalendar(ana);
await openEvent(ana, 'Soccer practice (field 5)');
check('reconnected: the same three are back on the practice, nothing duplicated',
  (await ana.locator('[data-event-task]').count()) === 3 && (await sql(`select count(*) from public.calendar_event_tasks where event_uid = 'practice@riverside-fc'`)) === '3');
await closeSheet(ana);

// ------------------------------------------------------------------ 7. Isolation and boundaries
const other = await phone();
const otherToken = await signIn(other, OTHER);
await rpc(otherToken, 'club_household_save', { p_display_name: 'Others', p_preferences: {}, p_members: [{ first_name: 'Ola', kind: 'adult', role: 'parent', is_account_holder: true }] });
await sql(`insert into public.calendar_feed_testers (user_id, event_tasks) select id, true from auth.users where email = '${OTHER}'`);
const someId = await sql(`select id from public.calendar_event_tasks where household_id = ${HID} limit 1`);
const otherList = await rpc(otherToken, 'calendar_event_tasks', { p_from: day(-5), p_to: day(30) });
const otherDone = await rpc(otherToken, 'calendar_event_task_done', { p_id: someId, p_done: true });
check('another household (switched on too) sees none of the Riveras’ responsibilities and can’t change one',
  Array.isArray(otherList.body) && otherList.body.length === 0 && otherDone.status >= 400, `list ${otherList.status}, done ${otherDone.status}`);
check('signed out: refused', (await rpc(null, 'calendar_event_tasks', { p_from: day(-5), p_to: day(30) })).status >= 400);
check('the source calendars are only ever read (GET), never written', [...methods].every((m) => m === 'GET'), [...methods].join(','));
check('the family’s own calendar events are untouched', (await sql(`select md5(string_agg(id || revision, ',' order by id)) from public.calendar_events where household_id = ${HID}`)) === ownBefore);
check('nothing billed: no subscription, invoice or entitlement rows', (await sql(`select (select count(*) from public.club_subscriptions) + (select count(*) from public.club_invoices) + (select count(*) from public.club_entitlements)`)) === '0');
void importedBefore; void luisToken;

// ------------------------------------------------------------------ 8. Layout, and the rest of the app still works
for (const [page, name] of [[ana, 'iPhone 15 Pro'], [luis, 'iPhone 15 Pro Max']]) {
  await openCalendar(page);
  await openEvent(page, 'Field trip: Science Museum');
  const m = await page.evaluate(() => {
    const s = document.querySelector('[data-external-event]');
    const small = [...s.querySelectorAll('button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43.5).map((b) => b.textContent.trim() || b.getAttribute('aria-label'));
    return { overflow: document.documentElement.scrollWidth - innerWidth, sheet: s.scrollWidth - s.clientWidth, small };
  });
  check(`${name}: the event sheet fits, no sideways scroll, every button at least 44pt tall`, m.overflow <= 0 && m.sheet <= 0 && m.small.length === 0, JSON.stringify(m));
  await closeSheet(page);
}
await shot(ana, '06-calendar-labels');
await ana.goto(`${base}/app/cleaning`, { waitUntil: 'networkidle' });
check('Cleaning: today’s checklist, unchanged', (await ana.locator('text=Daily reset').count()) > 0 || /Today’s cleaning/i.test(await ana.locator('main').innerText()));
await ana.goto(`${base}/app/family`, { waitUntil: 'networkidle' });
await settle(ana);
check('Family: opens with the family', /Mateo/.test(await ana.locator('main').innerText()));
await ana.goto(`${base}/app`, { waitUntil: 'networkidle' });
await ana.waitForSelector('[data-today-responsibilities]');
check('Today: responsibilities, Plans · Cleaning · Resources and the next Family Meeting still there', (await ana.locator('[data-today-responsibilities]').count()) === 1 && (await ana.locator('[data-today-shortcut]').count()) === 3 && (await ana.locator('[data-next-meeting]').count()) === 1);
const own = await rpc(anaToken, 'calendar_event_save', { p_event: { id: crypto.randomUUID(), title: 'Dentist', starts_on: day(5), start_time: '09:00', timezone: TZ, member_ids: [await member('Elena')] }, p_base_revision: null });
check('the family calendar still saves its own events', own.status === 200);
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

writeFileSync(join(OUT, 'results.json'), JSON.stringify({ failures, results }, null, 2));
await browser.close(); server.close(); fixtures.close();
console.log(failures ? `\nevent responsibilities e2e: ${failures} failure(s)` : '\nall event responsibilities checks passed');
process.exit(failures ? 1 : 0);
