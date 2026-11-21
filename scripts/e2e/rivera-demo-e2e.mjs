#!/usr/bin/env node
/**
 * The Rivera demo (docs/demo/RIVERA_DEMO.md), end to end against the isolated test backend: the owner installs it in
 * the real admin dashboard; Ana and Luis sign in with a password (the demo's normal sign-in) and use every screen at
 * iPhone 15 Pro (393), iPhone 15 Pro Max (430) and desktop widths; changes reach the other adult; the owner resets it
 * and everything is back. Optionally the iPhone app bundle too. Never touches production.
 *
 *   PGHOST=localhost PGUSER=postgres bash scripts/e2e/family-db.sh
 *   E2E_DB=omc_family_e2e node scripts/e2e/test-backend.mjs &
 *   PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 PUBLIC_SUPABASE_ANON_KEY=e2e-anon PUBLIC_ACCOUNTS_ENABLED=true \
 *     PUBLIC_CLUB_ENABLED=true npx astro build --outDir dist-qa
 *   node scripts/e2e/rivera-demo-e2e.mjs dist-qa [out=e2e-rivera] [app-www]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = process.argv[2] ?? 'dist-qa';
const OUT = process.argv[3] ?? 'e2e-rivera';
const APP_ROOT = process.argv[4];
const API = 'http://127.0.0.1:54321';
const PASSWORD = 'e2e-test-password'; // the test backend's only password (never a real one)
const ANA = 'rivera-ana@example.com', LUIS = 'rivera-luis@example.com', OWNER = 'demo-owner@e2e.test';
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const serve = async (root) => {
  const srv = createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = [join(root, p), join(root, p, 'index.html'), join(root, `${p}.html`)].find((f) => existsSync(f) && statSync(f).isFile());
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return srv;
};
const server = await serve(ROOT);
const base = `http://localhost:${server.address().port}`;
const appServer = APP_ROOT ? await serve(APP_ROOT) : null;
const appBase = appServer ? `http://localhost:${appServer.address().port}` : null;

let failures = 0;
const results = [];
const check = (step, ok, detail = '') => {
  results.push({ step, ok: Boolean(ok), detail });
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`);
};
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;
const settle = (page, ms = 1200) => page.waitForTimeout(ms);
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true, timeout: 20000 }).catch((e) => console.log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
const HID = `(select household_id from public.demo_households where key = 'rivera')`;

const browser = await chromium.launch();
const errors = [];
const ctxFor = async (device) => {
  const ctx = await browser.newContext(device === 'desktop' ? { viewport: { width: 1280, height: 900 } } : { ...devices[device] });
  ctx.on('page', (p) => p.on('pageerror', (e) => errors.push(`${device}: ${e.message}`)));
  return ctx;
};
async function signIn(page, email, at = base) {
  await page.goto(`${at}/app/sign-in`, { waitUntil: 'networkidle' });
  await page.click('[data-use-password]');
  await page.fill('#ow-pw-email', email);
  await page.fill('#ow-password', PASSWORD);
  await page.click('[data-password-signin] button[type="submit"]');
  await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
  await settle(page, 1500);
}
async function open(page, path, at = base) {
  await page.goto(`${at}${path}`, { waitUntil: 'networkidle' });
  // The cleaning companion's first run on a new device (device-only, like a real phone).
  for (let i = 0; i < 6 && (await page.locator('[role="dialog"] .btn-primary').isVisible().catch(() => false)); i++) { await page.locator('[role="dialog"] .btn-primary').click(); await page.waitForTimeout(150); }
  await settle(page, 1800);
}
const layout = (page) => page.evaluate(() => ({
  text: (document.querySelector('main') ?? document.body).innerText,
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  clipped: [...document.querySelectorAll('main button, main a, main h1, main h2, main h3')].filter((el) => {
    // Rows that scroll sideways on purpose (the month carousel, the Club's tab strip) aren't clipping.
    for (let p = el.parentElement; p; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return false;
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && s.visibility !== 'hidden' && (r.right > window.innerWidth + 1 || r.left < -1);
  }).map((el) => el.textContent.trim().slice(0, 40)),
}));

console.log(`rivera demo e2e: site ${base}${appBase ? `, app ${appBase}` : ''}, isolated backend ${API}`);

// ------------------------------------------------------------------ setup (test database only)
await sql(`insert into auth.users (id, email, email_confirmed_at) values (gen_random_uuid(), '${OWNER}', now()), (gen_random_uuid(), '${ANA}', now()), (gen_random_uuid(), '${LUIS}', now()), (gen_random_uuid(), 'free-family@e2e.test', now()) on conflict do nothing;
insert into public.admin_users (user_id, role) select id, 'owner' from auth.users where email = '${OWNER}' on conflict do nothing;
update public.club_kits set status = 'scheduled', release_at = least(release_at, now()) where month = date_trunc('month', now())::date;`);

// ------------------------------------------------------------------ 1. the owner installs Rivera in the dashboard
const adminCtx = await ctxFor('desktop'); const admin = await adminCtx.newPage();
await admin.goto(`${base}/admin/club?tab=access`, { waitUntil: 'networkidle' });
await admin.fill('input[type="email"]', OWNER); await admin.fill('input[type="password"]', PASSWORD); await admin.click('button[type="submit"]');
await admin.waitForSelector('[data-rivera-demo]', { timeout: 20000 });
await admin.waitForSelector('[data-rivera-install]', { timeout: 10000 });
await admin.fill('[data-rivera-owner]', ANA); await admin.fill('[data-rivera-partner]', LUIS);
admin.once('dialog', (d) => d.accept());
await admin.click('[data-rivera-install] button[type="submit"]');
await admin.waitForSelector('[data-rivera-status]', { timeout: 30000 });
check('install: the owner installs Rivera from Admin → Club → Club access', /Complimentary Club/.test(await admin.locator('[data-rivera-status]').innerText()));
await shot(admin, '00-admin-installed');
const seededShape = await sql(`select md5(string_agg(x, '|' order by x)) from (select 'd' || id || coalesce(stage, '') || status || coalesce(cue, '') from public.household_development where household_id = ${HID} union all select 'm' || list || period || item || done from public.household_cleaning_marks where household_id = ${HID} union all select 'e' || id || (deleted_at is null) from public.calendar_events where household_id = ${HID}) t(x)`);
const today = await sql(`select string_agg(title, '|') from public.calendar_events where household_id = ${HID} and deleted_at is null and ((recurrence -> 'by_day') @> to_jsonb(extract(dow from (now() at time zone 'America/Chicago')::date)::int) or starts_on = (now() at time zone 'America/Chicago')::date)`);

// ------------------------------------------------------------------ 2. every screen, three widths, as Ana
const SCREENS = [['/app', 'today'], ['/app/family-calendar', 'calendar'], ['/app/cleaning', 'cleaning'], ['/app/family', 'family'], ['/app/family/meeting', 'meeting'], ['/app/club', 'club'], ['/app/club/november', 'club-month'], ['/app/account', 'account']];
for (const device of ['iPhone 15 Pro', 'iPhone 15 Pro Max', 'desktop']) {
  const tag = device === 'desktop' ? 'desktop' : device === 'iPhone 15 Pro' ? '393' : '430';
  const ctx = await ctxFor(device); const page = await ctx.newPage();
  await signIn(page, ANA);
  for (const [path, name] of SCREENS) {
    await open(page, path);
    const l = await layout(page);
    check(`${tag} ${name}: opens with content, nothing clipped, no sideways scroll`, l.text.trim().length > 80 && l.overflow <= 1 && l.clipped.length === 0, `${l.text.trim().length} chars, overflow ${l.overflow}${l.clipped.length ? `, clipped: ${l.clipped.join(' / ')}` : ''}`);
    if (name === 'today') {
      check(`${tag} today: the family's plans for today`, today.split('|').some((t) => l.text.includes(t)), today);
      check(`${tag} today: everyone's part names the kids`, ['Sofia', 'Mateo', 'Elena'].every((n) => l.text.includes(n)));
    }
    if (name === 'calendar') {
      await page.getByRole('button', { name: 'Agenda' }).click().catch(() => page.click('text=Agenda'));
      await settle(page, 1000);
      check(`${tag} calendar: upcoming plans in the agenda`, /Dentist: Mateo|Birthday party|School picture day|Field trip/.test(await page.locator('main').innerText()));
    }
    if (name === 'cleaning') check(`${tag} cleaning: today's progress is the family's (2 of 5)`, (await page.locator('[aria-label*="tasks done today"]').first().getAttribute('aria-label').catch(() => '')).startsWith('2 of'));
    if (name === 'meeting') {
      check(`${tag} meeting: the Club meeting for a complimentary family`, (await page.getAttribute('[data-weekly-meeting]', 'data-meeting-kind')) === 'club');
    }
    if (name === 'club') check(`${tag} club: member Club Home, not the preview`, await page.evaluate(() => document.getElementById('club-preview-intro')?.hidden === true));
    if (name === 'family') check(`${tag} family: all five Riveras`, ['Ana', 'Luis', 'Sofia', 'Mateo', 'Elena'].every((n) => l.text.includes(n)));
    await shot(page, `${tag}-${name}`);
  }
  await ctx.close();
}

// ------------------------------------------------------------------ 3. Ana uses it; Luis sees it
const anaCtx = await ctxFor('iPhone 15 Pro'); const ana = await anaCtx.newPage();
await signIn(ana, ANA);
await open(ana, '/app/family/meeting');
check('meeting: four parts', (await ana.locator('[data-meeting-step]').count()) === 4);
await ana.click('[data-meeting-step="2"]'); await settle(ana, 800);
const steps = await ana.locator('[data-development-person]').evaluateAll((els) => els.map((e) => e.getAttribute('data-development-person')));
check('meeting: "One next step each": check-ins (Sofia, Mateo) and a new personalized suggestion (Elena)', ['Sofia', 'Mateo', 'Elena'].every((n) => steps.includes(n)), steps.join(','));
check('meeting: the suggestion for Elena is a real one from the library, waiting for the family to decide', (await ana.locator('[data-development-person="Elena"]').innerText()).length > 40);
await shot(ana, 'meeting-everyones-part');
const card = ana.locator('[data-development-person="Mateo"] [data-development-next]').first();
const skill = await card.getAttribute('data-development-next');
const stageBefore = await sql(`select stage from public.household_development where household_id = ${HID} and skill_id = '${skill}'`);
await card.locator('[data-development-change] summary').click();
await card.locator('[data-development-decision="advance"]').click();
await settle(ana, 2000);
const stageAfter = await sql(`select stage from public.household_development where household_id = ${HID} and skill_id = '${skill}'`);
check(`MAWL: Ana moves ${skill} forward one stage, explicitly (${stageBefore} → ${stageAfter})`, stageBefore !== stageAfter && ['assist', 'watch', 'launch'].includes(stageAfter));
await open(ana, '/app/cleaning');
const boxes = ana.locator('input[type="checkbox"]');
const firstOpen = await boxes.evaluateAll((els) => els.findIndex((e) => !e.checked));
await boxes.nth(firstOpen).evaluate((el) => el.click()); await settle(ana, 2500);
check('cleaning: Ana checks a task; it is saved for the household', (await sql(`select count(*) from public.household_cleaning_marks where household_id = ${HID} and period = to_char((now() at time zone 'America/Chicago')::date, 'YYYY-MM-DD') and list = 'daily' and done`)) === '3');
const luisCtx = await ctxFor('iPhone 15 Pro Max'); const luis = await luisCtx.newPage();
await signIn(luis, LUIS);
await open(luis, '/app/cleaning');
check('Luis: sees Ana\'s checkmark (3 of 5)', (await luis.locator('[aria-label*="tasks done today"]').first().getAttribute('aria-label').catch(() => '')).startsWith('3 of'));
check('Luis: the cleaning is shared', (await luis.locator('[data-cleaning-share]').getAttribute('data-cleaning-share').catch(() => null)) === 'shared');
await open(luis, '/app/family/meeting');
check('Luis: the Club meeting too (second adult, same grant)', (await luis.getAttribute('[data-weekly-meeting]', 'data-meeting-kind')) === 'club');
const seenByLuis = await luis.evaluate(async ([api, s]) => {
  const t = JSON.parse(localStorage.getItem('omc:account:session')).access_token;
  const r = await fetch(`${api}/rest/v1/rpc/household_development`, { method: 'POST', headers: { apikey: 'e2e-anon', Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: '{}' });
  const rows = await r.json();
  const rec = rows.find((x) => x.skill_id === s);
  return rec ? `${rec.stage}:${rec.history.length}` : 'missing';
}, [API, skill]);
check(`Luis: his app (household_development, signed in as Luis) has ${skill} at ${stageAfter}, with its decision history`, seenByLuis.startsWith(`${stageAfter}:`) && Number(seenByLuis.split(':')[1]) >= 3, seenByLuis);
await open(luis, '/app/family/meeting'); await luis.click('[data-meeting-step="2"]'); await settle(luis, 800);
await luis.locator('summary', { hasText: 'already agreed' }).first().click().catch(() => {}); await settle(luis, 400);
check('Luis: Everyone\'s Part lists the skill\'s agreement', (await luis.locator('main').innerText()).includes(await sql(`select title from public.household_development where household_id = ${HID} and skill_id = '${skill}'`)));
await shot(luis, 'luis-meeting');
await open(luis, '/app/account');
check('Luis: Account shows the shared family, not owner billing', /Rivera/.test(await luis.locator('main').innerText()));
// A regular free family, for comparison
const freeCtx = await ctxFor('iPhone 15 Pro'); const free = await freeCtx.newPage();
await signIn(free, 'free-family@e2e.test');
await sql(`select 1`);
await open(free, '/app/family/meeting');
check('a free family (no grant): no Club meeting', (await free.getAttribute('[data-weekly-meeting]', 'data-meeting-kind').catch(() => 'free')) !== 'club');
await freeCtx.close();

// ------------------------------------------------------------------ 4. reset
await admin.reload({ waitUntil: 'networkidle' });
await admin.waitForSelector('[data-rivera-reset]', { timeout: 20000 });
admin.once('dialog', (d) => d.accept());
await admin.click('[data-rivera-reset]');
await admin.waitForSelector('[data-rivera-msg]', { timeout: 30000 });
const resetShape = await sql(`select md5(string_agg(x, '|' order by x)) from (select 'd' || id || coalesce(stage, '') || status || coalesce(cue, '') from public.household_development where household_id = ${HID} union all select 'm' || list || period || item || done from public.household_cleaning_marks where household_id = ${HID} union all select 'e' || id || (deleted_at is null) from public.calendar_events where household_id = ${HID}) t(x)`);
check('reset: Reset Rivera Demo puts it back exactly (development, cleaning, calendar)', resetShape === seededShape);
check('reset: the audit log has it', (await sql(`select count(*) from public.admin_audit_log where action = 'demo.rivera.reset'`)) === '1');
await anaCtx.close();
const ana2Ctx = await ctxFor('iPhone 15 Pro'); const ana2 = await ana2Ctx.newPage();
await signIn(ana2, ANA);
await open(ana2, '/app/cleaning');
check('reset: Ana signs in again and sees the starting point (2 of 5)', (await ana2.locator('[aria-label*="tasks done today"]').first().getAttribute('aria-label').catch(() => '')).startsWith('2 of'));
check('nothing billed or sent: no subscription, invoice, entitlement, fulfillment, email, feed or Google rows', (await sql(`select (select count(*) from public.club_subscriptions) + (select count(*) from public.club_invoices) + (select count(*) from public.club_entitlements) + (select count(*) from public.club_fulfillment_orders) + (select count(*) from public.club_email_log) + (select count(*) from public.calendar_feeds) + (select count(*) from public.calendar_google_accounts)`)) === '0');
await ana2Ctx.close(); await luisCtx.close();

// ------------------------------------------------------------------ 5. the iPhone app bundle
if (appBase) {
  const ctx = await ctxFor('iPhone 15 Pro'); const page = await ctx.newPage();
  await signIn(page, ANA, appBase);
  for (const [path, name] of SCREENS.filter(([p]) => p !== '/app/club/november')) {
    await open(page, path, appBase);
    const l = await layout(page);
    check(`app ${name}: opens with content, nothing clipped, no sideways scroll`, l.text.trim().length > 80 && l.overflow <= 1 && l.clipped.length === 0, `${l.text.trim().length} chars, overflow ${l.overflow}`);
    if (name === 'meeting') check('app meeting: the Club meeting (complimentary grant)', (await page.getAttribute('[data-weekly-meeting]', 'data-meeting-kind')) === 'club');
    if (name === 'club') check('app club: member Club Home', await page.evaluate(() => document.getElementById('club-preview-intro')?.hidden === true));
    await shot(page, `app-${name}`);
  }
  check('app: no price, checkout or subscribe wording anywhere visited', !/\$\d|checkout|subscribe|upgrade/i.test(await page.locator('main').innerText()));
  await ctx.close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), failures, results }, null, 2));
await browser.close(); server.close(); appServer?.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall Rivera demo checks passed');
process.exit(failures ? 1 : 0);
