#!/usr/bin/env node
/**
 * The whole family experience end to end (docs/ios/FAMILY_E2E.md): the iPhone app bundle (app-www, built with
 * PUBLIC_SUPABASE_URL=http://127.0.0.1:54321) in Chromium at iPhone size, against the isolated test backend
 * (scripts/e2e/test-backend.mjs on a throwaway database from family-db.sh + seed.sql). Two browser contexts are two
 * phones: Jen's and Sam's. Never touches production.
 *
 * Network loss is simulated the way the app sees it: the app's own files keep loading (they're inside the app), only
 * the backend is unreachable, then reachable again.
 *
 * Usage: node scripts/e2e/family-e2e.mjs [app-www] [out=e2e-family]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = process.argv[2] ?? 'app-www';
const OUT = process.argv[3] ?? 'e2e-family';
const API = 'http://127.0.0.1:54321';
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = extname(p) ? join(ROOT, p) : existsSync(join(ROOT, p, 'index.html')) ? join(ROOT, p, 'index.html') : join(ROOT, 'index.html');
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
const rpc = async (token, fn, body = {}) => {
  const r = await fetch(`${API}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};
const MONTH = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][new Date().getMonth()];
const shot = (page, name, full = false) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full });
const settle = (page, ms = 600) => page.waitForTimeout(ms);

const browser = await chromium.launch();
const phone = { ...devices['iPhone 15 Pro'], hasTouch: true };
const newPhone = (state) => browser.newContext({ ...phone, ...(state ? { storageState: state } : {}) });

/** Backend down / back, as the app sees it: its files still load, the backend doesn't answer. */
const offline = (ctx) => ctx.route(`${API}/**`, (route) => route.abort('internetdisconnected'));
const online = async (ctx, page) => { await ctx.unroute(`${API}/**`); await page.evaluate(() => window.dispatchEvent(new Event('online'))); };

async function signIn(page, email) {
  await page.goto(`${base}/club/login`, { waitUntil: 'networkidle' });
  await page.fill('#club-email', email);
  await page.click('button:has-text("Email me a code")');
  await page.fill('#club-code', '123456');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
  return page.evaluate(() => JSON.parse(localStorage.getItem('omc:account:session')).access_token);
}

console.log(`family e2e: app ${base}, isolated backend ${API}`);

// ------------------------------------------------------------------ 1. Jen signs in on her phone
const jenCtx = await newPhone();
const jen = await jenCtx.newPage();
const jenToken = await signIn(jen, 'jen@e2e.test');
check('Jen signs in with the email code (test backend)', jenToken);
await jen.goto(`${base}/app`, { waitUntil: 'networkidle' });
await jen.click('[data-calendar-unlock-button]').catch(() => {});
await jen.goto(`${base}/app`, { waitUntil: 'networkidle' });

// ------------------------------------------------------------------ 2. Four people, four colors
await jen.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' });
await jen.waitForSelector('[data-sync-status="synced"]', { timeout: 15000 }).catch(() => {});
const todayRow = jen.locator('[data-calendar-day]').filter({ hasText: 'Today' });
await todayRow.locator('button.cal-add').click();
const chips = jen.locator('[data-member-chip]');
const people = await chips.allInnerTexts();
const colors = await chips.evaluateAll((els) => els.map((e) => getComputedStyle(e.querySelector('span')).backgroundColor));
check('the household has two adults and two children', ['Jen', 'Sam', 'Maya', 'Leo'].every((n) => people.some((p) => p.includes(n))), people.join(', '));
check('each person has a distinct family color', new Set(colors).size === 4 && colors.length === 4, colors.join(' · '));

// ------------------------------------------------------------------ 3. A calendar event
await jen.fill('[data-event-sheet] [data-field="title"]', 'Soccer practice');
await jen.fill('[data-event-sheet] [data-field="start"]', '17:30');
await jen.click('[data-member-chip="Maya"]');
await jen.selectOption('[data-event-sheet] [data-field="owner"]', { label: 'Sam' });
await shot(jen, '01-add-event');
await jen.click('[data-save-event]');
const soccer = jen.locator('[data-calendar-event="Soccer practice"]').first();
await soccer.waitFor({ timeout: 10000 });
await jen.waitForSelector('[data-sync-status="synced"]', { timeout: 15000 }).catch(() => {});
const soccerText = await soccer.innerText();
const mayaColor = colors[people.findIndex((p) => p.includes('Maya'))];
const bar = await soccer.evaluate((b) => getComputedStyle(b.querySelector('span')).backgroundColor);
check('the event shows on its day with Maya, "Sam handles it" and Maya\'s color', /Maya/.test(soccerText) && /Sam handles it/.test(soccerText) && bar === mayaColor, `${soccerText.replace(/\s+/g, ' ')} · bar ${bar}`);
check('the event is saved in the household database', (await sql(`select count(*) from public.calendar_events where title = 'Soccer practice' and deleted_at is null`)) === '1');
await shot(jen, '02-calendar-event', true);

// ------------------------------------------------------------------ 4. Sam joins as the second adult (invitation)
await jen.goto(`${base}/app/account`, { waitUntil: 'networkidle' });
await jen.waitForSelector('[data-invite-form]', { timeout: 15000 });
const who = await jen.locator('[data-invite-form] select option').allInnerTexts();
check('the invitation offers Sam, never Jen herself', who.join() === 'Sam', who.join(', '));
await jen.fill('[data-invite-form] input[type="email"]', 'sam@e2e.test');
await jen.click('[data-invite-form] button[type="submit"]');
const link = (await jen.locator('[data-invite-link]').innerText()).trim();
const samCtx = await newPhone();
const sam = await samCtx.newPage();
const samToken = await signIn(sam, 'sam@e2e.test');
const u = new URL(link);
await sam.goto(`${base}${u.pathname}${u.search}`, { waitUntil: 'networkidle' });
await sam.waitForSelector('[data-invite-state="joined"]', { timeout: 15000 }).catch(() => {});
check('Sam accepts the invitation on his phone', await sam.locator('[data-invite-state="joined"]').count());
check('Sam is linked to his existing family row (one profile, same ids)', (await sql(`select f.first_name from public.household_adults a join public.club_family_members f on f.id = a.member_id where a.role = 'partner'`)) === 'Sam');
await sam.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' });
await sam.waitForSelector('[data-calendar-event="Soccer practice"]', { timeout: 15000 }).catch(() => {});
check('Sam\'s phone shows Jen\'s event with the same color', (await sam.locator('[data-calendar-event="Soccer practice"]').count()) > 0
  && (await sam.locator('[data-calendar-event="Soccer practice"]').first().evaluate((b) => getComputedStyle(b.querySelector('span')).backgroundColor)) === mayaColor);

// ------------------------------------------------------------------ 5. "We agreed" in the existing Family Meeting
await jen.goto(`${base}/app/club/${MONTH}?view=meeting`, { waitUntil: 'networkidle' });
await jen.waitForSelector('[data-fm-ready="true"]', { timeout: 20000 });
const sections = await jen.locator('[data-fm-screen] .fm-sec h3').allInnerTexts();
check('the meeting keeps its four parts in order', sections.join() === 'Our Focus,Let’s Talk,Everyone’s Part,Let’s Practice', sections.join(' · '));
const mayaAgree = jen.locator('[data-fm-screen] [data-fm-agree="Maya"]');
const suggestion = (await mayaAgree.locator('xpath=..').locator('.fm-item-text').innerText()).trim();
note('Maya\'s suggestion this month', suggestion);
await mayaAgree.scrollIntoViewIfNeeded();
await shot(jen, '03-meeting-before');
await mayaAgree.click();
await jen.waitForSelector('[data-fm-screen] [data-fm-undo="Maya"]', { timeout: 15000 }).catch(() => {});
check('"We agreed" saves it as agreed on the meeting', await jen.locator('[data-fm-screen] [data-fm-undo="Maya"]').count());
const row = (await sql(`select json_build_object('status', status, 'category', category, 'owner', (select first_name from public.club_family_members f where f.id = owner_ids[1]), 'month', agreed_month, 'source', agreed_source)::text from public.club_responsibilities where agreed_text = ${`'${suggestion.replace(/'/g, "''")}'`}`));
const saved = row ? JSON.parse(row) : null;
check('saved as a confirmed responsibility for Maya\'s member id, with month and source', saved?.status === 'confirmed' && saved?.owner === 'Maya' && saved?.month, row);
check('suggestions for others stay suggestions (nothing else confirmed)', (await sql(`select count(*) from public.club_responsibilities r join public.household_adults a on a.household_id = r.household_id where a.user_id = '00000000-0000-0000-0000-00000000e2e1' and r.status = 'confirmed'`)) === '1');
await jen.locator('[data-fm-screen] [data-fm-undo="Maya"]').scrollIntoViewIfNeeded();
await shot(jen, '04-meeting-we-agreed');

// ------------------------------------------------------------------ 6. Everywhere it belongs
const isCleaning = ['cleaning', 'laundry'].includes(saved?.category);
async function everywhere(page, person, text, label) {
  await page.goto(`${base}/app`, { waitUntil: 'networkidle' }); await settle(page, 1200);
  const today = await page.locator('[data-everyones-part]').innerText().catch(() => '');
  check(`${label}: Today shows it for ${person}`, today.includes(text) && today.includes(person));
  await page.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' }); await settle(page, 1200);
  await page.click('[data-calendar-agreements] summary').catch(() => {});
  const cal = await page.locator('[data-calendar-agreements]').innerText().catch(() => '');
  check(`${label}: Calendar shows it for ${person}`, cal.includes(text) && cal.includes(person));
  await page.goto(`${base}/app/cleaning`, { waitUntil: 'networkidle' }); await settle(page, 1500);
  const clean = await page.locator('[data-cleaning-parts]').innerText().catch(() => '');
  if (isCleaning) check(`${label}: Cleaning shows it for ${person} (a cleaning part)`, clean.includes(text) && clean.includes(person));
  else check(`${label}: Cleaning leaves it out (not a cleaning part)`, !clean.includes(text));
}
await everywhere(jen, 'Maya', suggestion, 'after agreeing');
await jen.goto(`${base}/app`, { waitUntil: 'networkidle' }); await settle(jen, 1200);
await jen.locator('[data-everyones-part]').scrollIntoViewIfNeeded().catch(() => {});
await shot(jen, '05-today-agreed');
await jen.goto(`${base}/app/cleaning`, { waitUntil: 'networkidle' }); await settle(jen, 1500);
await jen.locator('[data-cleaning-parts]').scrollIntoViewIfNeeded().catch(() => {});
await shot(jen, '06-cleaning-agreed');

// ------------------------------------------------------------------ 7. Sam edits and reassigns it on his phone
await sam.goto(`${base}/app/family/responsibilities`, { waitUntil: 'networkidle' }); await settle(sam, 1500);
const samRow = sam.locator(`[data-agreement-row="${suggestion}"]`);
check('Sam sees the agreement on Family Responsibilities', await samRow.count());
await samRow.locator('[data-edit-agreement]').click();
const edited = 'Take the trash and recycling out on Tuesday night.';
await sam.fill('[data-agreement-text]', edited);
await sam.fill('[data-agreement-when]', 'Tuesday night');
await sam.click('[data-owner-chip="Maya"]');
await sam.click('[data-owner-chip="Leo"]');
await shot(sam, '07-edit-reassign');
await sam.click('[data-save-agreement]');
await sam.waitForSelector(`[data-agreement-row="${edited}"]`, { timeout: 10000 }).catch(() => {});
check('edit + reassign saved to the household', (await sql(`select (select first_name from public.club_family_members f where f.id = owner_ids[1]) || '|' || agreed_text || '|' || agreed_when from public.club_responsibilities where status = 'confirmed' and agreed_text like 'Take the trash%'`)) === `Leo|${edited}|Tuesday night`);
await everywhere(jen, 'Leo', edited, 'on Jen\'s phone after Sam\'s edit');
const todayText = await (async () => { await jen.goto(`${base}/app`, { waitUntil: 'networkidle' }); await settle(jen, 1200); return jen.locator('[data-everyones-part]').innerText().catch(() => ''); })();
check('Maya no longer listed for it', !todayText.includes('Maya'));
await jen.goto(`${base}/app/club/${MONTH}?view=meeting`, { waitUntil: 'networkidle' });
await jen.waitForSelector('[data-fm-ready="true"]', { timeout: 20000 });
const leoCard = await jen.locator('[data-fm-screen] .fm-person').filter({ hasText: 'Leo' }).innerText();
check('the meeting shows it agreed under Leo, in the new words', leoCard.includes(edited) && /Agreed by our family/i.test(leoCard));

// ------------------------------------------------------------------ 8. Close and reopen
const state = await jenCtx.storageState();
await jenCtx.close();
const jen2Ctx = await newPhone(state);
const jen2 = await jen2Ctx.newPage();
await jen2.goto(`${base}/app`, { waitUntil: 'networkidle' }); await settle(jen2, 1500);
check('reopened: still signed in, agreement on Today', (await jen2.locator('[data-everyones-part]').innerText().catch(() => '')).includes(edited));
await jen2.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' }); await settle(jen2, 1200);
check('reopened: the event is still on the calendar', await jen2.locator('[data-calendar-event="Soccer practice"]').count());

// ------------------------------------------------------------------ 9. Offline, reconnection, two phones
await offline(jen2Ctx);
await jen2.goto(`${base}/app`, { waitUntil: 'networkidle' }); await settle(jen2, 1500);
check('offline: Today still shows the agreement (kept on the phone)', (await jen2.locator('[data-everyones-part]').innerText().catch(() => '')).includes(edited));
await jen2.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' }); await settle(jen2, 1500);
check('offline: the calendar still shows the event', await jen2.locator('[data-calendar-event="Soccer practice"]').count());
// Offline: Jen renames the event and adds another.
await jen2.locator('[data-calendar-event="Soccer practice"]').first().click();
await jen2.fill('[data-event-sheet] [data-field="title"]', 'Soccer practice (field 2)');
await jen2.click('[data-save-event]');
await jen2.locator('[data-calendar-day]').filter({ hasText: 'Today' }).locator('button.cal-add').click();
await jen2.fill('[data-event-sheet] [data-field="title"]', 'Dentist');
await jen2.fill('[data-event-sheet] [data-field="start"]', '09:00');
await jen2.click('[data-member-chip="Leo"]');
await jen2.click('[data-save-event]');
await settle(jen2, 1500);
const status = await jen2.getAttribute('[data-sync-status]', 'data-sync-status');
const statusText = await jen2.locator('[data-sync-status]').innerText();
check('offline: changes saved on the phone and waiting', status === 'offline' && /2 changes saved here/.test(statusText), statusText);
await shot(jen2, '08-offline-waiting');
// Meanwhile Sam changes the same event on his phone.
await sam.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' }); await settle(sam, 1200);
await sam.locator('[data-calendar-event="Soccer practice"]').first().click();
await sam.fill('[data-event-sheet] [data-field="start"]', '18:00');
await sam.click('[data-save-event]');
await sam.waitForSelector('[data-sync-status="synced"]', { timeout: 15000 }).catch(() => {});
check('Sam\'s change saved while Jen is offline', (await sql(`select to_char(start_time, 'HH24:MI') from public.calendar_events where title = 'Soccer practice'`)) === '18:00');
// Offline agreement change: saved on Jen's phone, waiting to sync.
await jen2.goto(`${base}/app/family/responsibilities`, { waitUntil: 'networkidle' }); await settle(jen2, 1200);
await jen2.locator('[data-edit-agreement]').first().click();
await jen2.fill('[data-agreement-when]', 'Tuesday after dinner');
await jen2.click('[data-save-agreement]');
await settle(jen2, 1200);
const waitingAg = await jen2.locator('[data-agreements-waiting]').innerText().catch(() => '');
check('offline: an agreement change is saved on the phone and waiting', /1 change saved on this phone/.test(waitingAg), waitingAg);
check('offline: Jen\'s phone shows her change right away', /Tuesday after dinner/.test(await jen2.locator('[data-agreement-row]').first().innerText()));
check('offline: nothing reached the household yet', (await sql(`select coalesce(agreed_when, '') from public.club_responsibilities where status = 'confirmed' and deleted_at is null and agreed_text like 'Take the trash%'`)) === 'Tuesday night');
// Meanwhile Sam changes the same agreement on his phone.
await sam.goto(`${base}/app/family/responsibilities`, { waitUntil: 'networkidle' }); await settle(sam, 1500);
await sam.locator('[data-edit-agreement]').first().click();
await sam.fill('[data-agreement-text]', 'Take the trash and recycling out every Tuesday.');
await sam.click('[data-save-agreement]');
await settle(sam, 2000);
check('Sam\'s agreement edit reached the household while Jen is offline', (await sql(`select agreed_text from public.club_responsibilities where status = 'confirmed' and deleted_at is null and agreed_text not like 'Ruiz%'`)).includes('every Tuesday'));
// Back online.
await jen2.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' });
await online(jen2Ctx, jen2);
await jen2.reload({ waitUntil: 'networkidle' });
await jen2.waitForSelector('[data-sync-status="synced"]', { timeout: 20000 }).catch(() => {});
await settle(jen2, 1500);
const conflict = await jen2.locator('[data-calendar-conflict]').innerText().catch(() => '');
check('reconnect: Jen is told Sam changed the event first; nothing silently overwritten', /changed by the other grown-up first/.test(conflict), conflict.replace(/\s+/g, ' '));
check('reconnect: the event keeps Sam\'s version (6 PM, original title)', (await sql(`select title || '|' || to_char(start_time, 'HH24:MI') from public.calendar_events where id = (select id from public.calendar_events where title like 'Soccer practice%' limit 1)`)) === 'Soccer practice|18:00');
check('reconnect: Jen\'s offline Dentist uploaded', (await sql(`select count(*) from public.calendar_events where title = 'Dentist' and deleted_at is null`)) === '1');
await shot(jen2, '09-reconnect-conflict');
await sam.goto(`${base}/app/family-calendar`, { waitUntil: 'networkidle' });
await sam.waitForSelector('[data-calendar-event="Dentist"]', { timeout: 15000 }).catch(() => {});
check('Sam\'s phone gets the Dentist', await sam.locator('[data-calendar-event="Dentist"]').count());
// Jen's offline agreement edit on reconnect: Sam got there first, so his stays and she's told.
await jen2.goto(`${base}/app/family/responsibilities`, { waitUntil: 'networkidle' });
await jen2.waitForSelector('[data-agreements-conflict]', { timeout: 20000 }).catch(() => {});
const agConflict = await jen2.locator('[data-agreements-conflict]').innerText().catch(() => '');
check('reconnect: Jen is told Sam changed the agreement first', /changed by the other grown-up first/.test(agConflict), agConflict.replace(/\s+/g, ' '));
check('reconnect: the household keeps Sam\'s agreement (nothing overwritten)', (await sql(`select agreed_text || '|' || coalesce(agreed_when, '') from public.club_responsibilities where status = 'confirmed' and deleted_at is null and agreed_text not like 'Ruiz%'`)) === 'Take the trash and recycling out every Tuesday.|Tuesday night');
check('reconnect: Jen\'s phone now shows Sam\'s version', /every Tuesday/.test(await jen2.locator('[data-agreement-row]').first().innerText()));
await shot(jen2, '10-agreement-conflict');
// An offline change with no conflict syncs on reconnect.
await jen2.click('[data-agreements-conflict] button');
await offline(jen2Ctx);
await jen2.locator('[data-edit-agreement]').first().click();
await jen2.fill('[data-agreement-when]', 'Tuesday after dinner');
await jen2.click('[data-save-agreement]');
await settle(jen2, 800);
await online(jen2Ctx, jen2);
await settle(jen2, 3000);
check('reconnect: an offline agreement edit with no conflict syncs to the household', (await sql(`select coalesce(agreed_when, '') from public.club_responsibilities where status = 'confirmed' and deleted_at is null and agreed_text not like 'Ruiz%'`)) === 'Tuesday after dinner');


// ------------------------------------------------------------------ 10. No household sees another's
const rosaToken = (await (await fetch(`${API}/auth/v1/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'email', email: 'rosa@e2e.test', token: '123456' }) })).json()).access_token;
const ruizEvent = 'ee000000-0000-0000-0000-000000000001';
const ruizAgreement = await sql(`select id from public.club_responsibilities where agreed_text = 'Ruiz private chore'`);
const parksAgreement = await sql(`select id from public.club_responsibilities where agreed_text like 'Take the trash%'`);
const parksEvent = await sql(`select id from public.calendar_events where title = 'Dentist'`);
for (const [name, token] of [['Jen', jenToken], ['Sam', samToken]]) {
  const changes = await rpc(token, 'calendar_changes', { p_since: null });
  const profile = await rpc(token, 'club_family_profile');
  const remove = await rpc(token, 'household_agreement_remove', { p_id: ruizAgreement });
  const edit = await rpc(token, 'calendar_event_save', { p_event: { id: ruizEvent, title: 'hijacked', starts_on: '2026-11-20', timezone: 'UTC', member_ids: [] }, p_base_revision: 1 });
  check(`${name} can't read the Ruizes' calendar or agreements`, changes.status === 200 && !JSON.stringify(changes.body).includes('Ruiz') && !JSON.stringify(profile.body).includes('Ruiz'));
  check(`${name} can't remove or edit the Ruizes' data`, remove.status >= 400 && edit.status >= 400, `${remove.body?.message} / ${edit.body?.message}`);
}
check('the Ruizes\' event and agreement are unchanged', (await sql(`select title from public.calendar_events where id = '${ruizEvent}'`)) === 'Ruiz private appointment' && (await sql(`select count(*) from public.club_responsibilities where id = '${ruizAgreement}'`)) === '1');
const rosaChanges = await rpc(rosaToken, 'calendar_changes', { p_since: null });
const rosaRemove = await rpc(rosaToken, 'household_agreement_remove', { p_id: parksAgreement });
const rosaEdit = await rpc(rosaToken, 'calendar_event_delete', { p_id: parksEvent, p_base_revision: 1 });
// Deleting an id that isn't in your household is a no-op (null), by design: the delete is idempotent.
const parksDentist = await sql(`select deleted_at is null from public.calendar_events where id = '${parksEvent}'`);
check('the Ruizes can\'t read, remove or delete the Parks\' data', !JSON.stringify(rosaChanges.body).includes('Soccer') && rosaRemove.status >= 400 && rosaEdit.body === null && parksDentist === 't',
  `remove: ${rosaRemove.body?.message} · delete: ${JSON.stringify(rosaEdit.body)} · Parks event still there: ${parksDentist}`);
const samMeeting = await rpc(samToken, 'club_me');
note('Sam opening the Club\'s monthly meeting', samMeeting.body?.access ? 'has access' : 'no Club access (partner Club access is an open owner decision); he uses Family Responsibilities instead');

// ------------------------------------------------------------------ 11. Free Our Week onboarding (no Club, no purchase)
{
  const ctx = await newPhone();
  const nora = await ctx.newPage();
  await nora.goto(`${base}/app/sign-in`, { waitUntil: 'networkidle' });
  await nora.fill('#ow-email', 'nora@e2e.test');
  await nora.click('button:has-text("Email me a code")');
  await nora.fill('#ow-code', '123456');
  await nora.click('button[type="submit"]:has-text("Sign in")');
  await nora.waitForURL(/\/app\/family\/setup/, { timeout: 15000 }).catch(() => {});
  check('free sign-in: a new person lands in Our Week family setup, not Club onboarding', /\/app\/family\/setup$/.test(new URL(nora.url()).pathname), nora.url());
  await nora.waitForSelector('[data-ourweek-setup]', { timeout: 15000 });
  await nora.fill('label:has-text("What do you call your family?") input', 'The Okoyes');
  await nora.fill('label:has-text("Your first name") input', 'Nora');
  await nora.click('button:has-text("Add a grown-up")');
  const adultRow = nora.locator('label:has-text("Who they are")').first().locator('xpath=..');
  await adultRow.locator('label:has-text("First name") input').fill('Owen');
  const kidNames = nora.locator('label:has-text("Age")').locator('xpath=..').locator('label:has-text("First name") input');
  await kidNames.first().fill('Ada');
  await nora.locator('label:has-text("Age") select').first().selectOption('9');
  await nora.click('button:has-text("Add a child")');
  await kidNames.nth(1).fill('Ben');
  await nora.locator('label:has-text("Age") select').nth(1).selectOption('5');
  await nora.click('button[type="submit"]:has-text("Save and continue")');
  await nora.waitForSelector('[data-setup-saved]', { timeout: 15000 }).catch(() => {});
  const colors = await sql(`select coalesce((select count(distinct v) || '/' || count(*) from jsonb_each_text(h.preferences -> 'colors') e(k, v)), '0/0') from public.club_households h join auth.users u on u.id = h.owner_user_id where u.email = 'nora@e2e.test'`);
  check('free setup: family saved (2 adults, 2 children), each with a permanent, distinct color', colors === '4/4', colors);
  check('free setup: no Club membership was needed or created', (await sql(`select count(*) from public.club_subscriptions s join auth.users u on u.id = s.user_id where u.email = 'nora@e2e.test'`)) === '0');
  await nora.locator('[data-setup-step="partner"]').scrollIntoViewIfNeeded().catch(() => {});
  await shot(nora, '11-free-setup', true);
  // Invite the second adult from setup.
  await nora.waitForSelector('[data-invite-form]', { timeout: 15000 });
  await nora.fill('[data-invite-form] input[type="email"]', 'owen@e2e.test');
  await nora.click('[data-invite-form] button[type="submit"]');
  const link = new URL((await nora.locator('[data-invite-link]').innerText()).trim());
  const owenCtx = await newPhone();
  const owen = await owenCtx.newPage();
  await owen.goto(`${base}/app/sign-in?next=${encodeURIComponent(link.pathname + link.search)}`, { waitUntil: 'networkidle' });
  await owen.fill('#ow-email', 'owen@e2e.test');
  await owen.click('button:has-text("Email me a code")');
  await owen.fill('#ow-code', '123456');
  await owen.click('button[type="submit"]:has-text("Sign in")');
  await owen.waitForSelector('[data-invite-state="joined"]', { timeout: 20000 }).catch(() => {});
  check('free: the second adult signs in and joins from the invitation', await owen.locator('[data-invite-state="joined"]').count());
  // Start using it: cleaning, the weekly meeting, the calendar.
  await nora.goto(`${base}/app/family/setup`, { waitUntil: 'networkidle' });
  await nora.click('[data-start="cleaning"]');
  await nora.waitForLoadState('networkidle');
  for (let i = 0; i < 6 && (await nora.locator('[role="dialog"] .btn-primary').isVisible().catch(() => false)); i++) { await nora.locator('[role="dialog"] .btn-primary').click(); await nora.waitForTimeout(150); }
  check('free: the complete cleaning companion opens, no wall calendar needed', (await nora.locator('input[type="checkbox"]').count()) > 0 && /\/app\/cleaning/.test(nora.url()));
  await nora.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' }); await settle(nora, 1200);
  const parts = await nora.locator('[data-meeting-part]').evaluateAll((els) => els.map((e) => e.getAttribute('data-meeting-part')));
  check('free: the weekly Family Meeting has the four parts in order', parts.join() === 'Our Focus,Let’s Talk,Everyone’s Part,Let’s Practice', parts.join(' · '));
  check('free: no Club card or upgrade on the free meeting', (await nora.locator('[data-club-month-meeting]').count()) === 0 && !/upgrade|subscribe|join the club/i.test(await nora.locator('body').innerText()));
  await nora.fill('[data-agreement-new]', 'Feed the cat before school');
  await nora.click('[data-owner-chip="Ada"]');
  await nora.click('[data-save-new-agreement]');
  await settle(nora, 2500);
  check('free: "We agreed" in the free meeting saves to the household', (await sql(`select count(*) from public.club_responsibilities r join public.club_households h on h.id = r.household_id join auth.users u on u.id = h.owner_user_id where u.email = 'nora@e2e.test' and r.status = 'confirmed' and r.agreed_text = 'Feed the cat before school'`)) === '1');
  await shot(nora, '12-free-meeting', true);
  await ctx.close(); await owenCtx.close();
}
// An existing Club subscriber signing in through Our Week keeps everything and lands in Our Week.
{
  const ctx = await newPhone();
  const page = await ctx.newPage();
  await page.goto(`${base}/app/sign-in`, { waitUntil: 'networkidle' });
  await page.fill('#ow-email', 'jen@e2e.test');
  await page.click('button:has-text("Email me a code")');
  await page.fill('#ow-code', '123456');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForURL(/\/app$/, { timeout: 15000 }).catch(() => {});
  check('Club subscriber: Our Week sign-in lands on Today (not Club onboarding)', new URL(page.url()).pathname === '/app', page.url());
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('omc:account:session')).access_token);
  const me = await rpc(token, 'club_me');
  check('Club subscriber: membership and entitlements unchanged', me.body?.access === true && JSON.stringify(me.body?.kits ?? []).includes('2026-11'), JSON.stringify(me.body?.kits));
  await ctx.close();
}

await browser.close();
server.close();
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), failures, results }, null, 2));
console.log(failures ? `\nfamily e2e: ${failures} failure(s)` : '\nfamily e2e passed');
process.exit(failures ? 1 : 0);
