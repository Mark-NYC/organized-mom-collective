#!/usr/bin/env node
/**
 * Screens for the two-tab redesign (docs/ios/TWO_TAB_REDESIGN.md): the Rivera demo household (Club, two adults, kids,
 * agreements, development records, a scheduled Family Meeting on the calendar) and a brand-new free household, on an
 * iPhone 15 Pro, against the isolated test backend. Saves a screenshot and the visible text of each screen to OUT with
 * LABEL as prefix ("before" / "after"). Never touches production.
 *
 *   PGHOST=localhost PGUSER=postgres bash scripts/e2e/family-db.sh
 *   E2E_DB=omc_family_e2e node scripts/e2e/test-backend.mjs &
 *   node scripts/e2e/redesign-screens.mjs <app-www|dist-qa> <out> <label>
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = process.argv[2] ?? 'app-www';
const OUT = process.argv[3] ?? 'redesign-screens';
const LABEL = process.argv[4] ?? 'after';
const API = 'http://127.0.0.1:54321';
const PASSWORD = 'e2e-test-password';
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
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;

await sql(`insert into auth.users (id, email, email_confirmed_at) values (gen_random_uuid(), '${OWNER}', now()), (gen_random_uuid(), '${ANA}', now()), (gen_random_uuid(), '${LUIS}', now()) on conflict do nothing;
insert into public.admin_users (user_id, role) select id, 'owner' from auth.users where email = '${OWNER}' on conflict do nothing;
update public.club_kits set status = 'scheduled', release_at = least(release_at, now()) where month = date_trunc('month', now())::date;`);
await sql(`select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = '${OWNER}'))::text, false); select public.demo_rivera_reset('${ANA}', '${LUIS}'); select set_config('request.jwt.claims', '', false);`);

const browser = await chromium.launch();
const errors = [];
const notes = [];
const page = await (async () => {
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], timezoneId: 'America/Chicago' });
  ctx.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  return ctx.newPage();
})();
const snap = async (name, full = true) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, `${LABEL}-${name}.png`), fullPage: full, timeout: 20000 }).catch(() => {});
  const text = await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText.replace(/\n{2,}/g, '\n'));
  notes.push(`## ${name} (${new URL(page.url()).pathname})\n${text}\n`);
};
await page.goto(`${base}/app/sign-in`, { waitUntil: 'networkidle' });
await page.click('[data-use-password]');
await page.fill('#ow-pw-email', ANA);
await page.fill('#ow-password', PASSWORD);
await page.click('[data-password-signin] button[type="submit"]');
await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
await page.goto(`${base}/app`, { waitUntil: 'networkidle' });
await snap('01-today-club');
await page.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' });
await snap('02-meeting-club');
// Into the meeting, to Everyone's Part.
const start = page.locator('[data-meeting-start]');
if (await start.count()) await start.click();
await page.waitForTimeout(800);
for (let i = 0; i < 2; i++) {
  const next = page.locator('[data-meeting-step-actions] button:has-text("Next")');
  if (await next.count()) await next.click();
  await page.waitForTimeout(700);
}
await snap('03-everyones-part');
// Back to the landing mid-meeting: Continue, only because this phone recorded an unfinished meeting.
const back = page.locator('[data-meeting-back-to-landing]');
if (await back.count()) { await back.click(); await snap('03b-meeting-continue', false); }
await page.goto(`${base}/app/family`, { waitUntil: 'networkidle' });
await snap('04-family');

// A brand-new free household: Today and the meeting before anything is agreed.
await page.evaluate(() => localStorage.clear());
await page.goto(`${base}/app/sign-in`, { waitUntil: 'networkidle' });
await page.fill('#ow-email', `new-free-${Date.now()}@e2e.test`);
await page.click('button:has-text("Email me a code")');
await page.fill('#ow-code', '123456');
await page.click('button[type="submit"]:has-text("Sign in")');
await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
await page.waitForTimeout(1500);
const fam = page.locator('label:has-text("What do you call your family?") input');
if (await fam.count()) {
  await fam.fill('The Parkers');
  await page.locator('input[autocomplete="given-name"]').fill('Jess');
  const kidRows = () => page.locator('form li').filter({ hasText: 'Birthday month' });
  if (!(await kidRows().count())) await page.click('button:has-text("+ Add a child")');
  await kidRows().nth(0).locator('input').fill('Ava');
  await kidRows().nth(0).locator('select').first().selectOption('9');
  await page.click('button:has-text("Save our family"), button:has-text("Save and continue")');
  await page.waitForTimeout(2000);
}
await page.goto(`${base}/app`, { waitUntil: 'networkidle' });
await snap('05-today-new-free');
await page.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' });
await snap('06-meeting-new-free');

writeFileSync(join(OUT, `${LABEL}-notes.md`), notes.join('\n') + (errors.length ? `\n## page errors\n${errors.join('\n')}\n` : ''));
await browser.close(); server.close();
console.log(`${LABEL}: screens in ${OUT}; page errors: ${errors.length}`);
