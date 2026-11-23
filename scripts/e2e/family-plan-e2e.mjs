#!/usr/bin/env node
/**
 * The curated family plan, end to end (docs/ios/FAMILY_PLAN.md), on the Rivera demo household in the isolated test
 * backend: Ana and Luis on two phones (iPhone 15 Pro and Pro Max). In the Family Meeting, Ana highlights an event
 * from the coming week and adds a few words; the meeting ends on "We have a plan."; Luis sees the same priorities on
 * Today and adds one himself; Today stays short (priorities, everyone's part today, tools). Never touches production.
 *
 *   PGHOST=localhost PGUSER=postgres bash scripts/e2e/family-db.sh
 *   E2E_DB=omc_family_e2e node scripts/e2e/test-backend.mjs &
 *   node scripts/e2e/family-plan-e2e.mjs [app-www] [out=e2e-family-plan]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = process.argv[2] ?? 'app-www';
const OUT = process.argv[3] ?? 'e2e-family-plan';
const API = 'http://127.0.0.1:54321';
const PASSWORD = 'e2e-test-password'; // the test backend's only password (never a real one)
const ANA = 'rivera-ana@example.com', LUIS = 'rivera-luis@example.com', OWNER = 'demo-owner@e2e.test';
mkdirSync(OUT, { recursive: true });
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
const settle = (page, ms = 1200) => page.waitForTimeout(ms);
const shot = (page, name, full = true) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full, timeout: 20000 }).catch(() => {});
const HID = `(select household_id from public.demo_households where key = 'rivera')`;
const browser = await chromium.launch();
const errors = [];
const phone = async (device) => {
  const ctx = await browser.newContext({ ...devices[device], timezoneId: 'America/Chicago' });
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
  await settle(page, 800);
}
// A tap the way a person does it: the control in the middle of the screen, clear of the sticky Back/Next bar.
const tap = async (page, sel) => {
  await page.locator(sel).first().evaluate((el) => { const d = el.closest('details'); if (d && !d.open) d.open = true; el.scrollIntoView({ block: 'center' }); });
  await page.click(sel);
};
const layout = (page) => page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth }));
const priorities = () => sql(`select coalesce(string_agg(kind || ':' || title, '|' order by created_at), '') from public.household_priorities where household_id = ${HID}`);

console.log(`family plan e2e: app ${base}, isolated backend ${API}`);
await sql(`insert into auth.users (id, email, email_confirmed_at) values (gen_random_uuid(), '${OWNER}', now()), (gen_random_uuid(), '${ANA}', now()), (gen_random_uuid(), '${LUIS}', now()) on conflict do nothing;
insert into public.admin_users (user_id, role) select id, 'owner' from auth.users where email = '${OWNER}' on conflict do nothing;`);
await sql(`select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = '${OWNER}'))::text, false); select public.demo_rivera_reset('${ANA}', '${LUIS}'); select set_config('request.jwt.claims', '', false);`);

// ------------------------------------------------------------------ 1. Today before the meeting: nothing chosen yet
const ana = await phone('iPhone 15 Pro');
await signIn(ana, ANA);
await ana.goto(`${base}/app`, { waitUntil: 'networkidle' });
await ana.waitForSelector('[data-today-priorities]', { timeout: 15000 });
check('Today, before the meeting: priorities aren\'t invented from the calendar', (await ana.getAttribute('[data-today-priorities]', 'data-today-priorities')) === 'none'
  && (await ana.locator('[data-today-priority]').count()) === 0 && (await priorities()) === '');
const rows = await ana.locator('[data-today-responsibilities] .of-row').count();
check('Everyone\'s part today: a short list (about six), with the full list one tap away', rows > 0 && rows <= 6 && (await ana.locator('[data-all-parts]').count()) === 1, `${rows} rows`);
await shot(ana, '01-today-before-meeting');

// ------------------------------------------------------------------ 2. Our Focus: look ahead, choose what matters
await ana.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' });
await ana.click('[data-meeting-start]');
await ana.waitForSelector('[data-meeting-priorities]', { timeout: 15000 });
const weekCount = await ana.locator('[data-highlight]').count();
check('Our Focus: the coming week, each with Highlight (nothing pre-chosen)', weekCount >= 3 && (await ana.locator('[data-highlight][aria-pressed="true"]').count()) === 0, `${weekCount} events`);
// What a family would pick: a one-off they need to get ready for (the field trip slip), else the first thing.
const trip = ana.locator('[data-highlight*="Field trip"]').first();
const first = (await trip.count()) ? trip : ana.locator('[data-highlight]').first();
const chosenTitle = await first.getAttribute('data-highlight');
await first.click();
await ana.waitForSelector(`[data-meeting-priority="${chosenTitle}"]`, { timeout: 10000 });
await ana.fill('[data-priority-note]', 'Calmer mornings, together');
await ana.click('[data-priority-add]');
await ana.waitForSelector('[data-meeting-priority="Calmer mornings, together"]', { timeout: 10000 });
check('Ana highlights an event and adds a few words: saved for the household', (await priorities()) === `event:${chosenTitle}|note:Calmer mornings, together`, await priorities());
await shot(ana, '02-our-focus-priorities');
// Everyone's Part: getting ready is there for the highlighted event (optional).
await ana.click('[data-meeting-step="2"]'); await settle(ana, 800);
check('Everyone\'s Part: "Getting ready for our priorities" lists the highlighted event', /Getting ready for our priorities/i.test(await ana.locator('[data-getting-ready]').innerText().catch(() => '')) && (await ana.locator(`[data-getting-ready-item="${chosenTitle}"]`).count()) === 1);
await shot(ana, '03-everyones-part-getting-ready');
await ana.click('[data-meeting-step="3"]'); await settle(ana, 500);
await ana.click('[data-meeting-finish]');
await ana.waitForSelector('[data-plan-summary]', { timeout: 10000 });
const summary = await ana.locator('[data-plan-summary]').innerText();
check('Finish: "We have a plan." with this week\'s priorities and who owns what', /We have a plan\./.test(summary) && summary.includes(chosenTitle) && summary.includes('Calmer mornings, together') && ['Sofia', 'Mateo', 'Elena'].every((n) => summary.includes(n)));
check('…restrained: no badges, scores, streaks or confetti; printable', !/badge|score|streak|points|confetti/i.test(summary) && (await ana.locator('[data-plan-print]').count()) === 1);
await shot(ana, '04-we-have-a-plan');

// ------------------------------------------------------------------ 3. Luis: the same plan, and he adds to it
const luis = await phone('iPhone 15 Pro Max');
await signIn(luis, LUIS);
await luis.goto(`${base}/app`, { waitUntil: 'networkidle' });
await luis.waitForSelector('[data-today-priority]', { timeout: 15000 });
const luisSees = await luis.locator('[data-today-priority]').evaluateAll((els) => els.map((e) => e.getAttribute('data-today-priority')));
check('Luis\'s Today: the same priorities, without Ana doing anything for him', luisSees.includes(chosenTitle) && luisSees.includes('Calmer mornings, together'), luisSees.join(' | '));
await luis.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' });
await luis.click('[data-meeting-start]');
await luis.waitForSelector('[data-highlight]');
const second = luis.locator('[data-highlight][aria-pressed="false"]').first();
const luisTitle = await second.getAttribute('data-highlight');
await second.click();
await luis.waitForSelector(`[data-meeting-priority="${luisTitle}"]`, { timeout: 10000 });
check('Luis highlights one too (either adult can)', (await priorities()).split('|').length === 3);
check('three chosen: a note that three is usually plenty, with room for a busy week', /Three is usually plenty/.test(await luis.locator('[data-priority-rule]').innerText().catch(() => '')) && (await luis.locator('[data-priority-note-form]').count()) === 1);
await ana.goto(`${base}/app`, { waitUntil: 'networkidle' });
await ana.waitForSelector('[data-today-priority]');
check('Ana\'s Today: Luis\'s too (one shared plan)', (await ana.locator('[data-today-priority]').count()) === 3 && (await ana.locator(`[data-today-priority="${luisTitle}"]`).count()) === 1);
await shot(ana, '05-today-with-plan');
// Ana removes one in the meeting; gone for Luis too.
await ana.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' });
await ana.click('[data-meeting-start]');
await ana.locator('[data-meeting-priority="Calmer mornings, together"] [data-priority-remove]').click();
await settle(ana, 1000);
await luis.goto(`${base}/app`, { waitUntil: 'networkidle' });
await luis.waitForSelector('[data-today-priority]');
check('a priority removed by Ana is gone from Luis\'s Today', (await luis.locator('[data-today-priority="Calmer mornings, together"]').count()) === 0 && (await priorities()).split('|').length === 2);

// ------------------------------------------------------------------ 3b. Two adults at once, the limit, stale screens
const tokenOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('omc:account:session')).access_token);
const rpc = async (token, fn, body = {}) => {
  const r = await fetch(`${API}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const t = await r.text(); return { status: r.status, body: t ? JSON.parse(t) : null };
};
const openFocus = async (page) => { await page.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' }); await page.click('[data-meeting-start]'); await page.waitForSelector('[data-meeting-priorities]'); await settle(page, 600); };
const count = async () => Number(await sql(`select count(*) from public.household_priorities where household_id = ${HID}`));
await sql(`delete from public.household_priorities where household_id = ${HID}`);
await openFocus(ana); await openFocus(luis);
// Both tap Highlight on the same event at the same moment: one priority, both screens agree after a refresh.
const same = (await ana.locator('[data-highlight]').nth(1).getAttribute('data-highlight'));
await Promise.all([tap(ana, `[data-highlight="${same}"]`), tap(luis, `[data-highlight="${same}"]`)]);
await settle(ana, 1500);
check('both adults highlight the same event at once: one priority, not two', (await count()) === 1, String(await count()));
// Both add a few words at the same moment: both kept.
await ana.fill('[data-priority-note]', 'Grandma visits Saturday');
await luis.fill('[data-priority-note]', 'Science fair poster');
await Promise.all([tap(ana, '[data-priority-add]'), tap(luis, '[data-priority-add]')]);
await settle(ana, 1500);
check('both add a priority at the same moment: both kept', (await count()) === 3 && /Grandma visits Saturday/.test(await priorities()) && /Science fair poster/.test(await priorities()));
await openFocus(luis);
check('three chosen: a gentle note, and still room for a busy week (no disabled buttons)', /Three is usually plenty/.test(await luis.locator('[data-priority-rule]').innerText())
  && (await luis.locator('[data-priority-note-form]').count()) === 1 && (await luis.locator('[data-highlight][disabled]').count()) === 0);
await luis.fill('[data-priority-note]', 'Fourth');
await tap(luis, '[data-priority-add]');
await luis.waitForSelector('[data-meeting-priority="Fourth"]');
await luis.fill('[data-priority-note]', 'Fifth'); await tap(luis, '[data-priority-add]'); await luis.waitForSelector('[data-meeting-priority="Fifth"]');
check('five: the most for one week, said in words; Highlight only on chosen ones, no Add', /the most for one week/.test(await luis.locator('[data-priority-rule]').innerText())
  && (await luis.locator('[data-priority-note-form]').count()) === 0 && (await luis.locator('[data-highlight][aria-pressed="false"]').count()) === 0 && (await luis.locator('[data-highlight][aria-pressed="true"]').count()) === 1);
// Ana's screen is stale (it still shows room): her sixth is refused plainly, nothing breaks.
await ana.fill('[data-priority-note]', 'Sixth'); await tap(ana, '[data-priority-add]'); await settle(ana, 1200);
check('a stale screen adding a sixth: refused in plain words, still five', /most|for this week/i.test(await ana.locator('[data-priority-error]').innerText().catch(() => '')) && (await count()) === 5);
// Today with five: the top three, the other two one tap away in place.
await ana.goto(`${base}/app`, { waitUntil: 'networkidle' }); await ana.waitForSelector('[data-today-priority]');
const before3 = await ana.locator('[data-today-priority]').count();
await tap(ana, '[data-priorities-more]');
check('Today with five: the top three, "Show 2 more" opens the rest in place', before3 === 3 && (await ana.locator('[data-today-priority]').count()) === 5);
await shot(ana, '06-today-five-priorities');
// Ana removes one Luis added; Luis's stale screen taps Remove on it too: no error, the same plan.
await openFocus(ana);
await tap(ana, '[data-meeting-priority="Fifth"] [data-priority-remove]'); await settle(ana, 1000);
await tap(luis, '[data-meeting-priority="Fifth"] [data-priority-remove]'); await settle(luis, 1000);
check('one adult removes the other\'s; the other\'s stale screen removing it too: no error, one plan', (await count()) === 4 && (await luis.locator('[data-priority-error]').count()) === 0);
await sql(`delete from public.household_priorities where household_id = ${HID} and kind = 'note' and title in ('Fourth', 'Science fair poster')`);

// ------------------------------------------------------------------ 3c. A shared calendar's event: moved, unshared, offline, cancelled
const dayN = (n) => { const d = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date()) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
await sql(`insert into public.calendar_feed_testers (user_id, note) select id, 'e2e plan' from auth.users where email = '${ANA}'`);
const anaTok = await tokenOf(ana);
const feed = (await rpc(anaTok, 'calendar_feed_add', { p: { url: 'https://rivera.calendar.e2e.test/trips.ics', name: 'Rivera trips', visibility: 'household', timezone: 'America/Chicago' } })).body;
const storeTrip = (day) => sql(`select public.calendar_feed_store('${feed.id}', jsonb_build_object('result', 'ok', 'events', jsonb_build_array(
  jsonb_build_object('uid', 'lake@rivera', 'instance_key', '${dayN(3)}', 'title', 'Family trip to the lake', 'all_day', true, 'start_date', '${day}', 'end_date', '${day}'),
  jsonb_build_object('uid', 'other@rivera', 'instance_key', '${dayN(10)}', 'title', 'Later trip', 'all_day', true, 'start_date', '${dayN(10)}', 'end_date', '${dayN(10)}'))))`);
await storeTrip(dayN(3));
await openFocus(ana);
await tap(ana, '[data-highlight="Family trip to the lake"]');
await ana.waitForSelector('[data-meeting-priority="Family trip to the lake"]');
await luis.goto(`${base}/app`, { waitUntil: 'networkidle' }); await luis.waitForSelector('[data-today-priority="Family trip to the lake"]', { timeout: 15000 });
check('a shared calendar\'s event, highlighted by Ana, is on Luis\'s Today', true);
// Getting ready, agreed in Everyone's Part (event responsibilities on for this test household): the trip's parts.
await sql(`update public.calendar_feed_testers set event_tasks = true where user_id = (select id from auth.users where email = '${ANA}')`);
await openFocus(ana);
await shot(ana, '02b-our-focus-with-trip');
await ana.click('[data-meeting-step="2"]'); await settle(ana, 1200);
await tap(ana, '[data-getting-ready-item="Family trip to the lake"] summary');
for (const [what, who] of [['Get the car ready', 'Luis'], ['Pack my clothes', 'Mateo'], ['Pick the games and snacks', 'Sofia']]) {
  await tap(ana, '[data-getting-ready-item="Family trip to the lake"] [data-task-add]');
  await ana.fill('[data-getting-ready-item="Family trip to the lake"] [data-task-title]', what);
  await tap(ana, `[data-getting-ready-item="Family trip to the lake"] [data-task-member="${who}"]`);
  await tap(ana, '[data-getting-ready-item="Family trip to the lake"] [data-task-save]');
  await ana.waitForSelector(`[data-event-task="${what}"]`, { timeout: 10000 });
}
check('Everyone\'s Part: the family agrees who gets ready for the trip (Luis, Mateo, Sofia)', (await sql(`select count(*) from public.calendar_event_tasks where event_uid = 'lake@rivera'`)) === '3');
await ana.locator('[data-getting-ready-item="Family trip to the lake"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
await shot(ana, '03b-getting-ready-trip', false);
await ana.click('[data-meeting-step="3"]'); await settle(ana, 500);
await tap(ana, '[data-meeting-finish]'); await ana.waitForSelector('[data-plan-summary]');
const plan2 = await ana.locator('[data-plan-priorities]').innerText();
check('"We have a plan.": the trip once, with who gets ready for it under it', (plan2.match(/Family trip to the lake/g) ?? []).length === 1 && /Luis · Get the car ready/.test(plan2) && /Mateo · Pack my clothes/.test(plan2));
await shot(ana, '04b-we-have-a-plan-with-trip');
await ana.goto(`${base}/app`, { waitUntil: 'networkidle' }); await ana.waitForSelector('[data-today-priority="Family trip to the lake"]');
check('Today: the trip as a priority, "0 of 3 ready"', /0 of 3 ready/.test(await ana.locator('[data-today-priority="Family trip to the lake"]').innerText()));
await shot(ana, '05b-today-with-trip');
// Desktop: the same plan, wider.
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Chicago' });
const dp = await desk.newPage(); dp.on('pageerror', (e) => errors.push(`desktop: ${e.message}`));
await signIn(dp, ANA);
await dp.goto(`${base}/app`, { waitUntil: 'networkidle' }); await dp.waitForSelector('[data-today-priority]'); await settle(dp, 1500);
await shot(dp, '09-desktop-today');
await openFocus(dp); await shot(dp, '10-desktop-our-focus');
check('desktop: Today and Our Focus without sideways scroll', (await layout(dp)).overflow <= 0);
await desk.close();
await sql(`delete from public.calendar_event_tasks where event_uid = 'lake@rivera'`);
const dayName = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
await storeTrip(dayN(4));
await sql(`update public.calendar_feeds set events_at = now() where id = '${feed.id}'`);
await luis.reload({ waitUntil: 'networkidle' }); await luis.waitForSelector('[data-today-priority="Family trip to the lake"]');
check('the trip moves a day at the source: Today shows the new day (a link, not a copy)', (await luis.locator('[data-today-priority="Family trip to the lake"]').innerText()).includes(dayName(dayN(4))));
// Luis goes offline; Ana makes the calendar private; Luis comes back: the trip is gone from his Today and his storage.
await luis.context().setOffline(true);
await rpc(anaTok, 'calendar_feed_update', { p_id: feed.id, p: { visibility: 'private' } });
await luis.context().setOffline(false);
await luis.reload({ waitUntil: 'networkidle' }); await settle(luis, 2500);
const luisStore = await luis.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter((k) => /priorities|feeds|event-tasks/.test(k)).map((k) => [k, localStorage.getItem(k)]))));
check('calendar made private while Luis was offline: back online, it\'s gone from his Today and from his device', (await luis.locator('[data-today-priority="Family trip to the lake"]').count()) === 0 && !luisStore.includes('Family trip to the lake'));
await ana.goto(`${base}/app`, { waitUntil: 'networkidle' }); await ana.waitForSelector('[data-today-priority="Family trip to the lake"]', { timeout: 15000 });
check('…while Ana, who chose it from her own calendar, still sees it', true);
// The meeting summary and the printed plan come from the same list: Luis's has no trip either.
await luis.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' }); await luis.click('[data-meeting-step="3"]'); await settle(luis, 600);
await tap(luis, '[data-meeting-finish]'); await luis.waitForSelector('[data-plan-summary]');
check('Luis\'s "We have a plan." (what he would print) has no private trip', !(await luis.locator('[data-plan-summary]').innerText()).includes('Family trip to the lake'));
await rpc(anaTok, 'calendar_feed_update', { p_id: feed.id, p: { visibility: 'household' } });
// Cancelled at the source: Ana sees it's no longer on the calendar; Luis doesn't get a stale title.
await sql(`select public.calendar_feed_store('${feed.id}', jsonb_build_object('result', 'ok', 'events', jsonb_build_array(jsonb_build_object('uid', 'other@rivera', 'instance_key', '${dayN(10)}', 'title', 'Later trip', 'all_day', true, 'start_date', '${dayN(10)}', 'end_date', '${dayN(10)}'))))`);
await sql(`update public.calendar_feeds set events_at = now() where id = '${feed.id}'`);
await ana.reload({ waitUntil: 'networkidle' }); await ana.waitForSelector('[data-today-priority="Family trip to the lake"]');
check('cancelled at the source: the adult who chose it sees "No longer on the calendar"', /No longer on the calendar/.test(await ana.locator('[data-today-priority="Family trip to the lake"]').innerText()));
await luis.goto(`${base}/app`, { waitUntil: 'networkidle' }); await settle(luis, 2000);
check('…and the other adult never sees a stale title for it', (await luis.locator('[data-today-priority="Family trip to the lake"]').count()) === 0);
await sql(`delete from public.household_priorities where household_id = ${HID} and source = 'imported'`);

// ------------------------------------------------------------------ 3d. Sign-out and another family on the same device
await luis.goto(`${base}/app/account`, { waitUntil: 'networkidle' }); await settle(luis, 1200);
await luis.click('[data-sign-out]'); await settle(luis, 1500);
const left = await luis.evaluate(() => Object.keys(localStorage).filter((k) => /omc:priorities|omc:calendar:event-tasks|omc:calendar:feeds/.test(k)));
check('Luis signs out: the household\'s priorities, event responsibilities and imported events leave the device', left.length === 0, left.join(','));
const solo = `solo-${Date.now()}@e2e.test`;
await luis.goto(`${base}/app/sign-in`, { waitUntil: 'networkidle' });
await luis.fill('#ow-email', solo); await luis.click('button:has-text("Email me a code")'); await luis.fill('#ow-code', '123456');
await luis.click('button[type="submit"]:has-text("Sign in")');
await luis.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
const soloTok = await tokenOf(luis);
await rpc(soloTok, 'club_household_save', { p_display_name: 'The Okafors', p_preferences: {}, p_members: [{ first_name: 'Nia', kind: 'adult', role: 'parent', is_account_holder: true }, { first_name: 'Dev', kind: 'adult', role: 'partner' }, { first_name: 'Zuri', kind: 'child', role: 'child', birth_year: 2017, birth_month: 4 }] });
// The other grown-up is invited but never accepts: the household works fully with one adult.
const dev = await sql(`select m.id from public.club_family_members m join public.household_adults a on a.household_id = m.household_id join auth.users u on u.id = a.user_id where u.email = '${solo}' and m.first_name = 'Dev'`);
await rpc(soloTok, 'household_invite_create', { p_member_id: dev, p_email: 'dev-never@e2e.test' });
await luis.goto(`${base}/app`, { waitUntil: 'networkidle' }); await settle(luis, 2000);
check('another family signs in on the same device: nothing of the Riveras\' plan shows', !/Grandma visits|Calmer mornings|Rivera/.test(await luis.locator('main').innerText()) && (await luis.locator('[data-today-priority]').count()) === 0);
await openFocus(luis);
await luis.fill('[data-priority-note]', 'Zuri\'s recital'); await tap(luis, '[data-priority-add]'); await luis.waitForSelector('[data-meeting-priority="Zuri\'s recital"]');
await luis.goto(`${base}/app`, { waitUntil: 'networkidle' }); await luis.waitForSelector('[data-today-priority]');
check('one adult (the other invited, never joined): the same plan, on Today', (await luis.locator('[data-today-priority="Zuri\'s recital"]').count()) === 1);
await shot(luis, '07-single-adult-today');

// ------------------------------------------------------------------ 3e. A long-list household: Today stays short
const big = `big-${Date.now()}@e2e.test`;
const bigCtx = await browser.newContext({ ...devices['iPhone 15 Pro'], timezoneId: 'America/Chicago' });
bigCtx.on('page', (p) => p.on('pageerror', (e) => errors.push(`big: ${e.message}`)));
const bigPage = await bigCtx.newPage();
await bigPage.goto(`${base}/app/sign-in`, { waitUntil: 'networkidle' });
await bigPage.fill('#ow-email', big); await bigPage.click('button:has-text("Email me a code")'); await bigPage.fill('#ow-code', '123456');
await bigPage.click('button[type="submit"]:has-text("Sign in")');
await bigPage.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
const bigTok = await tokenOf(bigPage);
const kids = ['Amara', 'Ben', 'Cleo', 'Dami', 'Eli', 'Femi'];
await rpc(bigTok, 'club_household_save', { p_display_name: 'The Adeyemis', p_preferences: {}, p_members: [{ first_name: 'Ada', kind: 'adult', role: 'parent', is_account_holder: true }, { first_name: 'Obi', kind: 'adult', role: 'partner' },
  ...kids.map((k, i) => ({ first_name: k, kind: 'child', role: 'child', birth_year: 2010 + i, birth_month: 3 }))] });
const ids = Object.fromEntries((await sql(`select string_agg(m.first_name || '=' || m.id, ',') from public.club_family_members m join public.household_adults a on a.household_id = m.household_id join auth.users u on u.id = a.user_id where u.email = '${big}'`)).split(',').map((x) => x.split('=')));
const jobs = ['Feed the dog', 'Empty the dishwasher', 'Pack my bag', 'Laundry to my room', 'Set the table', 'Wipe the counters', 'Water the plants', 'Take out recycling'];
let n = 0;
for (const who of [...kids, 'Ada', 'Obi']) for (const j of jobs.slice(0, 3)) {
  await rpc(bigTok, 'household_agreement_save', { p: { id: crypto.randomUUID(), category: 'other', text: `${j}${n++ % 2 ? '' : ' (weekdays)'}`, when: 'After school', owner_ids: [ids[who]] } });
}
await bigPage.goto(`${base}/app`, { waitUntil: 'networkidle' }); await bigPage.waitForSelector('[data-today-responsibilities]'); await settle(bigPage, 2000);
const bigRows = await bigPage.locator('[data-today-responsibilities] .of-row').count();
const allLink = await bigPage.locator('[data-all-parts]').innerText().catch(() => '');
check('a family of eight with 24 agreements: Today shows six rows, children first, and the rest one tap away', bigRows === 6 && /\(24\)/.test(allLink)
  && (await bigPage.locator('[data-part-person]').first().getAttribute('data-part-person')) === 'Amara', `${bigRows} rows · ${allLink}`);
check('long list: no sideways scroll', (await layout(bigPage)).overflow <= 0);
await shot(bigPage, '08-long-list-today');
await bigCtx.close();

// ------------------------------------------------------------------ 4. Layout and boundaries
for (const [page, name] of [[ana, '393'], [luis, '430']]) {
  await page.goto(`${base}/app`, { waitUntil: 'networkidle' }); await settle(page);
  check(`${name} Today: no sideways scroll`, (await layout(page)).overflow <= 0);
  await page.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' }); await page.click('[data-meeting-start]'); await settle(page);
  check(`${name} Our Focus with priorities: no sideways scroll`, (await layout(page)).overflow <= 0);
}
check('no billing rows', (await sql(`select (select count(*) from public.club_subscriptions) + (select count(*) from public.club_invoices)`)) === '0');
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ failures, results }, null, 2));
await browser.close(); server.close();
console.log(failures ? `\nfamily plan e2e: ${failures} failure(s)` : '\nall family plan checks passed');
process.exit(failures ? 1 : 0);
