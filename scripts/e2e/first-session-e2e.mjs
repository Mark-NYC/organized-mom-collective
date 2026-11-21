#!/usr/bin/env node
/**
 * First sessions for five brand-new families (docs/pilot/PILOT_TESTING.md → "A successful first session"), against the
 * isolated test backend: never signed up before, iPhone-size screens, the iPhone app bundle and the website. Each one
 * goes from first open through family setup to a first useful action, the Family Meeting, the Club, feedback, and
 * coming back. Every screen visited is checked for clipping and sideways scrolling. Never touches production.
 *
 *   PGHOST=localhost PGUSER=postgres bash scripts/e2e/family-db.sh
 *   E2E_DB=omc_family_e2e node scripts/e2e/test-backend.mjs &
 *   (website build into dist, app bundle into app-www, both against the test backend; see FAMILY_E2E.md)
 *   node scripts/e2e/first-session-e2e.mjs <dist> <app-www> [out=e2e-first-session]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const [SITE = 'dist', APP = 'app-www', OUT = 'e2e-first-session'] = process.argv.slice(2);
const API = 'http://127.0.0.1:54321';
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
const siteSrv = await serve(SITE); const appSrv = await serve(APP);
const BASES = { site: `http://localhost:${siteSrv.address().port}`, app: `http://localhost:${appSrv.address().port}` };

let failures = 0;
const results = [];
const check = (step, ok, detail = '') => {
  results.push({ step, ok: Boolean(ok), detail });
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`);
};
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;
const settle = (page, ms = 1300) => page.waitForTimeout(ms);
const layout = (page) => page.evaluate(() => ({
  text: (document.querySelector('main') ?? document.body).innerText,
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  clipped: [...document.querySelectorAll('main button, main a, main h1, main h2, main input, main select')].filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return false;
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && s.visibility !== 'hidden' && (r.right > window.innerWidth + 1 || r.left < -1);
  }).map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40)),
}));

const PERSONAS = [
  { id: 'two-parents', where: 'app', device: 'iPhone 15 Pro', family: 'The Parkers', me: 'Jess', adults: ['Sam'], kids: [['Ava', '9'], ['Leo', '6']] },
  { id: 'single-mom', where: 'site', device: 'iPhone 15 Pro Max', family: 'The Gomez Family', me: 'Maria', adults: [], kids: [['Sofia', '11'], ['Diego', '8'], ['Lucia', '5']] },
  { id: 'teen-and-little', where: 'app', device: 'iPhone 15 Pro Max', family: 'Team Okafor', me: 'Dana', adults: ['Chris'], kids: [['Mia', '15'], ['Noah', '7'], ['Lily', '3']] },
  { id: 'google-calendar', where: 'site', device: 'iPhone 15 Pro', family: 'The Chens', me: 'Amy', adults: ['Ben'], kids: [['Ella', '10'], ['Max', '7']], google: true },
  { id: 'free-only', where: 'app', device: 'iPhone 15 Pro', family: 'The Browns', me: 'Kate', adults: [], kids: [['Owen', '6']] },
];

const browser = await chromium.launch();
const errors = [];
for (const p of PERSONAS) {
  console.log(`\n${p.id} (${p.where === 'app' ? 'iPhone app bundle' : 'website'}, ${p.device})`);
  const base = BASES[p.where];
  const email = `${p.id}@first.e2e.test`;
  const ctx = await browser.newContext({ ...devices[p.device] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${p.id}: ${e.message}`));
  const shot = (n) => page.screenshot({ path: join(OUT, `${p.id}-${n}.png`), fullPage: true, timeout: 20000 }).catch(() => {});
  const visit = async (path, name) => {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }); await settle(page);
    const l = await layout(page);
    check(`${p.id} ${name}: nothing clipped, no sideways scroll`, l.overflow <= 1 && l.clipped.length === 0, l.clipped.join(' / '));
    return l;
  };

  // 1. First open: what is this? (30 seconds)
  let l = await visit('/app', 'first open');
  check(`${p.id} first open: Today says what the app is for and offers ONE first step`, (await page.locator('[data-start-here="household"]').count()) === 1 && /One shared plan for your family’s week/.test(l.text) && (await page.locator('[data-start-next="household"]').count()) === 1);
  await shot('01-first-open');

  // 2. Account: the emailed code, no password
  await page.click('[data-start-next="household"]');
  await page.waitForURL(/\/app\/sign-in/, { timeout: 15000 });
  await page.fill('#ow-email', email);
  await page.click('button:has-text("Email me a code")');
  await page.fill('#ow-code', '123456');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForURL(/\/app\/family\/setup/, { timeout: 20000 });
  check(`${p.id} account: created with an emailed code, straight to family setup`, (await sql(`select count(*) from auth.users where email = '${email}'`)) === '1');

  // 3. Family setup, without feeling overwhelmed
  await page.waitForSelector('[data-ourweek-setup]'); await settle(page, 800);
  l = await layout(page);
  check(`${p.id} setup: one title, no Club wording (welcome gift, kits, illustration style)`, (await page.locator('h1').count()) === 1 && !/welcome gift|monthly family resources|illustration|kits will/i.test(l.text));
  await page.fill('label:has-text("What do you call your family?") input', p.family);
  await page.fill('label:has-text("Your first name") input', p.me);
  for (const [i, a] of p.adults.entries()) {
    await page.click('button:has-text("+ Add a grown-up")');
    await page.locator('form li').filter({ hasText: 'Who they are' }).nth(i).locator('input').fill(a);
  }
  const kidRows = () => page.locator('form li').filter({ hasText: 'Birthday month' });
  for (const [i, [name, age]] of p.kids.entries()) {
    if ((await kidRows().count()) <= i) await page.click('button:has-text("+ Add a child")');
    await kidRows().nth(i).locator('input').fill(name);
    await kidRows().nth(i).locator('select').first().selectOption(age);
  }
  await shot('02-setup');
  await page.click('button[type="submit"]:has-text("Save our family")');
  await page.waitForSelector('[data-setup-done]', { timeout: 15000 }).catch(() => {});
  l = await layout(page);
  check(`${p.id} setup done: "You're set up" with one next step`, (await page.locator('[data-setup-done]').count()) === 1 && (await page.locator('[data-setup-next]').count()) === 1, l.text.split('\n').slice(0, 3).join(' | '));
  check(`${p.id} setup done: the invitation only when there's another grown-up`, (await page.locator('[data-setup-step="partner"]').count()) === (p.adults.length ? 1 : 0));
  check(`${p.id} setup done: page is short (no long form)`, (await page.evaluate(() => document.documentElement.scrollHeight)) < 2600);
  await shot('03-setup-done');

  // 4. Today: the next step
  await page.click('[data-setup-next]');
  await page.waitForURL(/\/app$/, { timeout: 15000 }); await settle(page, 1800);
  const next = await page.getAttribute('[data-start-here]', 'data-start-here').catch(() => null);
  check(`${p.id} Today: "Getting started" points to this week's plans next`, next === 'week', String(next));
  check(`${p.id} Today: the Family Meeting is right there, no instructions needed`, (await page.locator('a:has-text("Start our Family Meeting")').count()) >= 1);
  await shot('04-today');

  // 5. A first useful action: today's cleaning (straight to the checklist, no walkthrough)
  l = await visit('/app/cleaning', 'cleaning');
  check(`${p.id} cleaning: the checklist right away (no paper-calendar walkthrough)`, (await page.locator('input[type="checkbox"]').count()) > 0 && !/Put the calendar and a set of colored pens/.test(l.text));
  await page.locator('input[type="checkbox"]').first().evaluate((el) => el.click()); await settle(page, 2500);
  check(`${p.id} cleaning: a first task checked and saved for the family`, Number(await sql(`select count(*) from public.household_cleaning_marks c join public.household_adults a on a.household_id = c.household_id join auth.users u on u.id = a.user_id where u.email = '${email}' and c.done`)) >= 1);
  await shot('05-cleaning');

  // 6. This week on the calendar: a plan with a person
  await visit('/app/family-calendar', 'calendar');
  if (p.google) {
    await sql(`insert into public.calendar_feed_testers (user_id, google) select id, true from auth.users where email = '${email}' on conflict do nothing`);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 1500);
    await page.click('[data-open-calendars]').catch(() => {}); await settle(page, 800);
    check(`${p.id} calendar: a Google Calendar family can connect it (pilot testers)`, (await page.locator('[data-google-connect]').count()) === 1);
    await shot('06-google');
    await page.keyboard.press('Escape').catch(() => {});
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 1200);
  }
  await page.locator('[data-add-event]:visible').first().click();
  await page.waitForSelector('[data-event-sheet]');
  await page.fill('[data-event-sheet] [data-field="title"]', `${p.kids[0][0]}'s practice`);
  await page.fill('[data-event-sheet] [data-field="start"]', '16:30').catch(() => {});
  await page.click(`[data-event-sheet] [data-member-chip="${p.kids[0][0]}"]`).catch(() => {});
  await page.click('[data-event-sheet] [data-save-event]');
  await settle(page, 2500);
  const plans = await sql(`select count(*) from public.calendar_events e join public.household_adults a on a.household_id = e.household_id join auth.users u on u.id = a.user_id where u.email = '${email}'`);
  check(`${p.id} calendar: a plan added for the week`, Number(plans) >= 1, plans);
  await shot('06-calendar');

  // 7. Tomorrow: coming back
  l = await visit('/app', 'today again');
  const nextAfter = await page.getAttribute('[data-start-here]', 'data-start-here').catch(() => null);
  check(`${p.id} coming back: Today picks up where she left off (${p.adults.length ? 'invite' : 'first meeting'} next)`, nextAfter === (p.adults.length ? 'adult' : 'meeting'), String(nextAfter));
  if (p.adults.length) {
    check(`${p.id} coming back: inviting can be skipped`, (await page.locator('[data-start-skip]').count()) === 1);
  }

  // 8. The Family Meeting
  await visit('/app/family/meeting', 'meeting');
  for (let i = 1; i < 4; i++) { await page.click(`[data-meeting-step="${i}"]`); await settle(page, 400); }
  check(`${p.id} meeting: all four parts open`, (await page.getAttribute('[data-meeting-part]', 'data-meeting-part')) === 'Let’s Practice');
  await page.click('a:has-text("Finish meeting")'); await settle(page, 1500);

  // 9. Club: what it adds, no pressure
  l = await visit('/app/club', 'club');
  if (p.where === 'app') check(`${p.id} club (app): by invitation, no price, buy or subscribe wording`, /available by invitation/.test(l.text) && !/\$\d|subscribe|checkout|buy now|upgrade/i.test(l.text));
  else check(`${p.id} club (website): what stays free and what the Club adds, no pressure`, /free for everyone/.test(l.text) && /The Club adds one personalized resource/.test(l.text));

  // 10. Feedback
  await page.goto(`${base}/app`, { waitUntil: 'networkidle' }); await settle(page);
  await page.click('[data-feedback-quiet] a');
  await page.waitForSelector('[data-feedback-form]', { timeout: 15000 });
  await page.click('[data-feedback-kind="confusing"]');
  await page.fill('[data-feedback-text]', `Pilot test from ${p.id}: where do I see what my kids agreed to?`);
  await page.click('[data-feedback-form] button[type="submit"]');
  await page.waitForSelector('[data-feedback-sent]', { timeout: 15000 }).catch(() => {});
  check(`${p.id} feedback: sent from Today, with where it came from`, (await sql(`select count(*) from public.support_requests where email = '${email}' and topic = 'companion' and message like '[Pilot · confusing · /app · ${p.where === 'app' ? 'ios' : 'web'} · %'`)) === '1');
  await shot('07-feedback');

  // Measured, without family content
  const ev = await sql(`select string_agg(distinct e.event, ',' order by e.event) from public.app_events e join auth.users u on u.id = e.user_id where u.email = '${email}'`);
  check(`${p.id} measured: setup, a first action, the meeting, feedback`, ['onboarding_started', 'onboarding_completed', 'cleaning_checked', 'meeting_started', 'meeting_completed', 'feedback_sent', 'app_open'].every((e) => ev.split(',').includes(e)), ev);
  await ctx.close();
}

check('no billing rows for any new family', (await sql(`select count(*) from public.club_subscriptions s join auth.users u on u.id = s.user_id where u.email like '%@first.e2e.test'`)) === '0');
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), failures, results }, null, 2));
await browser.close(); siteSrv.close(); appSrv.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall first-session checks passed');
process.exit(failures ? 1 : 0);
