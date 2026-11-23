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
check('three chosen: no more Highlight or Add until one is removed (about three)', (await luis.locator('[data-highlight][aria-pressed="false"]:not([disabled])').count()) === 0 && (await luis.locator('[data-priority-note-form]').count()) === 0);
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
