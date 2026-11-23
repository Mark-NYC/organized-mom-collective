#!/usr/bin/env node
/**
 * npm run test:app-shell — drives the iPhone app bundle (app-www/, from npm run build:app) at iPhone size in
 * Chromium, served the way the app's router serves it (ios/App/App/OMCRouter.swift: /app/x → app/x/index.html,
 * unknown → /index.html). Not a substitute for a real iPhone; it catches missing files, script errors, layout
 * overflow, leaked tracking and broken link routing before the Xcode build.
 *
 * Checks, per page: no page errors, no missing bundled file (404), no request to Google/Pinterest, no horizontal
 * overflow at 393 px. Then: Cleaning is free in the app (no wall-calendar unlock), a checkmark survives a reload, and
 * with a stand-in native bridge a shop link opens on the website instead of inside the app.
 *
 * Screenshots → app-shell-smoke/ (CI uploads them). Exit 1 on any failure.
 * Usage: node scripts/app-shell-smoke.mjs [dir=app-www] [outDir=app-shell-smoke]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.argv[2] ?? 'app-www';
const OUT = process.argv[3] ?? 'app-shell-smoke';
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.pdf': 'application/pdf' };

/** Same rule as OMCRouter.swift. */
function route(pathname) {
  const p = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  if (extname(p)) return { file: join(ROOT, p), missingIs404: true };
  const index = join(ROOT, p, 'index.html');
  return existsSync(index) ? { file: index } : { file: join(ROOT, 'index.html') };
}

const server = createServer((req, res) => {
  const { file, missingIs404 } = route(new URL(req.url, 'http://x').pathname);
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(missingIs404 ? 404 : 200);
    return res.end();
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;

const failures = [];
const fail = (m) => {
  failures.push(m);
  console.error('  ✗ ' + m);
};
const browser = await chromium.launch();
const newContext = (native) =>
  browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }).then(async (ctx) => {
    if (native) await ctx.addInitScript(() => {
      // Stand-in for Capacitor's native bridge: plugins aren't there, so init.ts falls back (window.open).
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} };
    });
    return ctx;
  });

async function visit(ctx, path, shot) {
  const page = await ctx.newPage();
  const errors = [];
  const missing = [];
  const tracking = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().startsWith(base) && r.status() === 404) missing.push(new URL(r.url()).pathname);
  });
  page.on('request', (r) => {
    if (/googletagmanager|google-analytics|pinimg|pinterest\.com/.test(r.url())) tracking.push(r.url());
  });
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (shot) await page.screenshot({ path: join(OUT, `${shot}.png`) });
  const label = `${path}`;
  if (errors.length) fail(`${label}: script errors: ${errors.slice(0, 3).join(' | ')}`);
  if (missing.length) fail(`${label}: missing files: ${[...new Set(missing)].slice(0, 5).join(', ')}`);
  if (tracking.length) fail(`${label}: tracking requests: ${tracking[0]}`);
  if (overflow > 1) fail(`${label}: horizontal overflow ${overflow}px at 393px`);
  if (!errors.length && !missing.length && !tracking.length && overflow <= 1) console.log(`  ✓ ${label}`);
  return page;
}

console.log(`app-shell smoke test on ${base}`);
const web = await newContext(false);
const native = await newContext(true);

// Pages a member moves between (screenshots).
const PAGES = [
  ['/', null],
  ['/app', '01-today'],
  ['/app/club', '03-club'],
  ['/app/club/months', null],
  ['/app/club/january', '04-club-january'],
  ['/app/account', '05-account'],
  ['/app/account?demo=1', '05b-account-demo'],
  ['/club/login', '06-club-login'],
  ['/club/family', '08-club-family'],
  ['/app/calendar', null],
];
for (const [p, shot] of PAGES) await (await visit(web, p, shot)).close();

// Every bundled page: a visible way back to Today (the app has no back button), no old Club branding, and no made-up
// family outside the explicit demo. At iPhone width, and at iPad width for the tab bar.
const manifest = JSON.parse(readFileSync(join(ROOT, 'shell-manifest.json'), 'utf8'));
const OLD_BRAND = /Organized Family Club|ORGANIZED FAMILY CLUB|organized-family-club-logo/i;
const ipad = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1 });
let checked = 0;
const purchaseHits = [];
for (const p of manifest.pages) {
  for (const [ctx, label] of [[web, 'iPhone'], [ipad, 'iPad']]) {
    const page = await ctx.newPage();
    await page.goto(base + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const today = page.locator('[data-app-tabbar] a[href="/app"]');
    // The cleaning companion's one-time first-run screen hides the app chrome on purpose; it must offer a way forward.
    const onboarding = await page.evaluate(() => document.documentElement.classList.contains('needs-onboarding'));
    if (onboarding) {
      if (!(await page.locator('[role="dialog"] .btn-primary').isVisible().catch(() => false))) fail(`${p} (${label}): first-run screen with no way forward`);
    } else if (!(await today.isVisible().catch(() => false))) fail(`${p} (${label}): no visible Today tab`);
    if (label === 'iPhone') {
      const html = await page.content();
      if (OLD_BRAND.test(html)) fail(`${p}: old "Organized Family Club" branding: ${html.match(OLD_BRAND)[0]}`);
      if (/Rivera/.test(await page.locator('body').innerText()) && !/demo=1|sample=/.test(p)) fail(`${p}: shows the made-up Rivera family outside the demo`);
      // No in-app Club purchasing, upgrade buttons or payment redirects until there's a compliant App Store approach
      // (owner, 2026-11-15). Links and visible words both.
      const buy = await page.evaluate(() => {
        const bad = /\/checkout|\/club\/join|\/club#offer|club_checkout|billing|stripe\.com|buy\.stripe/i;
        const hrefs = [...document.querySelectorAll('a[href], form[action]')].map((a) => a.getAttribute('href') ?? a.getAttribute('action') ?? '').filter((h) => bad.test(h));
        const words = (document.body.innerText.match(/\b(upgrade|subscribe now|join the club|get my first month free|start (your|my) free month|account & billing)\b/gi) ?? []);
        return [...hrefs, ...words];
      });
      if (buy.length) purchaseHits.push(`${p}: ${[...new Set(buy)].join(', ')}`);
    }
    await page.close();
  }
  checked++;
}
console.log(`  ✓ ${checked} bundled pages checked for a Today tab (iPhone + iPad), old branding and sample families`);
if (purchaseHits.length) for (const h of purchaseHits) fail(`purchase/billing in the app: ${h}`);
else console.log('  ✓ no Club purchase, upgrade or billing links on any bundled page');
await ipad.close();

// Family calendar: works with no account (saved on this phone), survives a reload; in the labeled demo family, a
// weekly event for Mon and Wed with a person and who's handling it shows on both days with that person's color; deleting
// just one day of a repeat leaves the other.
{
  const page = await web.newPage();
  await page.goto(base + '/app/family-calendar', { waitUntil: 'networkidle' });
  const monday = page.locator('[data-calendar-day]').nth(1);
  const mondayDate = await monday.getAttribute('data-calendar-day');
  await monday.locator('button.cal-add').click();
  await page.fill('[data-event-sheet] [data-field="title"]', 'Dentist');
  await page.uncheck('[data-event-sheet] input[type="checkbox"]').catch(() => {});
  await page.fill('[data-event-sheet] [data-field="start"]', '15:30');
  await page.click('[data-save-event]');
  if (!(await page.locator(`[data-calendar-day="${mondayDate}"] [data-calendar-event="Dentist"]`).isVisible())) fail('calendar: a new event doesn\'t show on its day');
  await page.reload({ waitUntil: 'networkidle' });
  if (!(await page.locator(`[data-calendar-day="${mondayDate}"] [data-calendar-event="Dentist"]`).isVisible())) fail('calendar: event lost after reload');
  else console.log('  ✓ calendar: add with no account, still there after reload');
  const status = await page.getAttribute('[data-sync-status]', 'data-sync-status');
  if (status !== 'local') fail(`calendar: expected the "saved on this phone" status, got ${status}`);
  await page.screenshot({ path: join(OUT, '09-calendar.png') });
  await page.close();
}
{
  const page = await web.newPage();
  await page.goto(base + '/app/family-calendar?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  if (!(await page.locator('[data-calendar-demo]').isVisible())) fail('calendar demo: not labeled as a demo');
  const days = page.locator('[data-calendar-day]');
  const mon = await days.nth(1).getAttribute('data-calendar-day');
  const wed = await days.nth(3).getAttribute('data-calendar-day');
  await days.nth(1).locator('button.cal-add').click();
  await page.fill('[data-event-sheet] [data-field="title"]', 'Swim practice');
  await page.fill('[data-event-sheet] [data-field="start"]', '16:15');
  await page.selectOption('[data-event-sheet] [data-field="repeat"]', 'weekly');
  await page.click('[data-event-sheet] button[aria-pressed]:has-text("Wed")');
  await page.click('[data-member-chip="Sofia"]');
  await page.selectOption('[data-event-sheet] [data-field="owner"]', { label: 'Luis' });
  await page.screenshot({ path: join(OUT, '10-calendar-add-sheet.png') });
  await page.click('[data-save-event]');
  const onMon = page.locator(`[data-calendar-day="${mon}"] [data-calendar-event="Swim practice"]`);
  const onWed = page.locator(`[data-calendar-day="${wed}"] [data-calendar-event="Swim practice"]`);
  if (!(await onMon.isVisible()) || !(await onWed.isVisible())) fail('calendar: weekly Mon+Wed event missing a day');
  else if (!/Sofia/.test(await onMon.innerText()) || !/Luis handles it/.test(await onMon.innerText())) fail('calendar: person or "handles it" missing');
  else console.log('  ✓ calendar: weekly on Mon and Wed, with Sofia and who handles it');
  await page.screenshot({ path: join(OUT, '11-calendar-demo-week.png'), fullPage: true });
  await onWed.click();
  await page.click('text=Delete…');
  await page.click('[data-delete-choices] button:first-child'); // "Just Wed …"
  if (await onWed.isVisible()) fail('calendar: skipping one day of a repeat left it there');
  else if (!(await onMon.isVisible())) fail('calendar: skipping one day removed the whole repeat');
  else console.log('  ✓ calendar: delete just one day of a repeat');
  await page.close();
}

// The calendar supports the existing Family Meeting; there is no Sunday Setup or other weekly ritual. A plan added today
// shows on Today's "next 7 days" for the meeting, marked New, and on the calendar with the same mark.
{
  const page = await web.newPage();
  if (await page.goto(base + '/app/sunday-setup').then(() => page.locator('[data-sunday-card], [data-sunday-demo]').count()) > 0) fail('Sunday Setup still bundled');
  await page.goto(base + '/app/family-calendar', { waitUntil: 'networkidle' });
  if (await page.locator('[data-open-sunday-setup]').count()) fail('calendar: still links to Sunday Setup');
  const today = page.locator('[data-calendar-day]').filter({ hasText: 'Today' });
  await today.locator('button.cal-add').click();
  await page.fill('[data-event-sheet] [data-field="title"]', 'Team photo');
  await page.fill('[data-event-sheet] [data-field="start"]', '17:00').catch(() => {});
  await page.click('[data-save-event]');
  const row = page.locator('[data-calendar-event="Team photo"]');
  if (!(await row.locator('[data-change="new"]').isVisible())) fail('calendar: a plan added this week isn\'t marked New');
  else console.log('  ✓ calendar: a plan added this week is marked New for the meeting');
  // Two-tab redesign: the week ahead is part of the meeting's Our Focus; Today counts today's plans (Plans shortcut).
  await page.goto(base + '/app', { waitUntil: 'networkidle' });
  if (!/[1-9][0-9]* events? today/.test(await page.locator('[data-today-shortcut="plans"]').innerText().catch(() => ''))) fail('Today: the Plans shortcut doesn\'t count today\'s plan');
  if (await page.locator('[data-sunday-card]').count()) fail('Today: still shows Sunday Setup');
  await page.goto(base + '/app/family/meeting', { waitUntil: 'networkidle' });
  await page.click('[data-meeting-start]');
  const week = page.locator('[data-meeting-week]');
  if (!(await week.isVisible())) fail('meeting: no "this week on our calendar" in Our Focus');
  else if (!/Team photo/.test(await week.innerText())) fail('meeting: the new plan isn\'t in the week');
  else console.log('  ✓ Today counts today\'s plans; the Family Meeting looks at the week together');
  await week.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, '12-meeting-week.png'), fullPage: true });
  // After the meeting, in the labeled demo family: everyone's part as the month's meeting lists it, in their colors.
  await page.goto(base + '/app?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  if (!(await page.locator('[data-today-demo]').isVisible())) fail('Today demo: not labeled as a demo');
  const parts = page.locator('[data-everyones-part]');
  if (!(await parts.isVisible())) fail('Today: no Everyone\'s Part for a family with parts');
  else if (/Suggested/i.test(await parts.innerText())) fail('Today: shows a suggestion as a part');
  else if (/Takes care of|Helps with/.test(await parts.innerText())) fail('Today: shows what was already done as agreed');
  else console.log('  ✓ Today: Everyone\'s Part before anything is agreed: no suggestions, nothing claimed');
  await page.screenshot({ path: join(OUT, '13-today-everyones-part.png'), fullPage: true });
  await page.close();
}

// Navigation (two-tab redesign): Today · Family Meeting, Account behind the profile icon. Family & resources (Today's
// Resources shortcut) leads back to the meeting (its four parts), then Family Responsibilities, then the Club.
{
  const page = await web.newPage();
  await page.goto(base + '/app', { waitUntil: 'networkidle' });
  const tabs = await page.locator('[data-app-tabbar] a').evaluateAll((as) => as.map((a) => a.lastElementChild.textContent.trim()));
  if (tabs.join() !== 'Today,Family Meeting') fail(`tabs: expected Today,Family Meeting, got ${tabs.join()}`);
  else console.log('  ✓ tabs: Today · Family Meeting');
  for (const id of ['plans', 'cleaning', 'resources']) if (!(await page.locator(`[data-today-shortcut="${id}"]`).isVisible())) fail(`Today: no ${id} shortcut`);
  if (!(await page.locator('[data-profile-link][href="/app/account"]').isVisible())) fail('no profile icon for Account');
  await page.goto(base + '/app/family', { waitUntil: 'networkidle' });
  const parts = await page.locator('[data-our-meeting]').innerText().catch(() => '');
  if (!parts.includes('Our Focus · Let’s Talk · Everyone’s Part · Let’s Practice')) fail(`Family: the four parts aren't shown in order: ${parts}`);
  else if (!(await page.locator('[data-family-responsibilities-card]').isVisible())) fail('Family: responsibilities card missing');
  // Nobody is signed in here: a free family sees no Club membership card (it's for households that have the Club).
  else if (await page.locator('[data-family-club-card]').count()) fail('Family: a free family is shown the Family Meeting Club membership card');
  else if (!(await page.locator('[data-app-tabbar] a[href="/app"][aria-current="page"]').count())) fail('Family & resources: Today tab not marked current');
  else console.log('  ✓ Family & resources: the way to the meeting (four parts), Family Responsibilities; no Club card for a free family');
  await page.screenshot({ path: join(OUT, '14-family.png'), fullPage: true });

  // "We agreed" in the meeting (labeled sample family, saved in this tab only), then everywhere else.
  const month = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][new Date().getMonth()];
  await page.goto(`${base}/app/club/${month}?sample=rivera&view=meeting`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-fm-ready="true"]', { timeout: 15000 });
  const sections = await page.locator('[data-fm-screen] .fm-sec h3').allInnerTexts();
  if (sections.join() !== 'Our Focus,Let’s Talk,Everyone’s Part,Let’s Practice') fail(`meeting: sections changed: ${sections.join()}`);
  if (await page.locator('[data-meeting-sheet] .fm-agree, [data-meeting-sheet] .fm-undo').count()) fail('meeting: agree buttons on the printed guide');
  const agree = page.locator('[data-fm-screen] [data-fm-agree]').first();
  const who = await agree.getAttribute('data-fm-agree');
  const suggested = (await agree.locator('xpath=..').locator('.fm-item-text').innerText()).trim();
  await agree.click();
  await page.waitForSelector(`[data-fm-screen] [data-fm-undo="${who}"]`, { timeout: 10000 });
  const card = page.locator('[data-fm-screen] .fm-item[data-status="confirmed"]').filter({ hasText: suggested });
  if (!(await card.count())) fail('meeting: the agreed part isn\'t shown as agreed');
  else if (await page.locator('[data-fm-screen] .fm-item[data-status="suggested"]').filter({ hasText: suggested }).count()) fail('meeting: still suggested after agreeing');
  else console.log(`  ✓ meeting: "We agreed" saves ${who}'s part as agreed (four parts unchanged, not on the print)`);
  await card.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, '15-meeting-we-agreed.png') });

  // Family Responsibilities (labeled demo = the same sample family): edit the words and reassign.
  await page.goto(base + '/app/family/responsibilities?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  if (!(await page.locator('[data-responsibilities-demo]').isVisible())) fail('Responsibilities demo: not labeled');
  const row = page.locator(`[data-agreement-row="${suggested}"]`);
  if (!(await row.isVisible())) fail('Responsibilities: the agreement from the meeting is missing');
  await page.screenshot({ path: join(OUT, '16-responsibilities.png'), fullPage: true });
  await row.locator('[data-edit-agreement]').click();
  await page.fill('[data-agreement-text]', 'Pack my bag before bed, every school night.');
  await page.fill('[data-agreement-when]', 'Before bed');
  const other = (await page.locator('[data-owner-chip]').allInnerTexts()).map((t) => t.trim()).find((n) => n !== who);
  await page.click(`[data-owner-chip="${who}"]`);
  await page.click(`[data-owner-chip="${other}"]`);
  await page.click('[data-save-agreement]');
  const edited = page.locator('[data-agreement-row="Pack my bag before bed, every school night."]');
  if (!(await edited.isVisible()) || !(await edited.innerText()).includes(other)) fail('Responsibilities: edit + reassign didn\'t stick');
  else console.log(`  ✓ responsibilities: edit the words and reassign ${who} → ${other}`);

  // Today and the calendar show the agreement (agreements only).
  await page.goto(base + '/app?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const today = await page.locator('[data-everyones-part]').innerText().catch(() => '');
  if (!today.includes('Pack my bag before bed, every school night.') || !today.includes(other) || !today.includes('Before bed') || today.includes('At ')) fail('Today: the agreement isn\'t in Everyone\'s Part');
  else if (/Takes care of|Helps with/.test(today)) fail('Today: shows what was already done as agreed');
  else console.log('  ✓ Today: Everyone\'s Part shows only the agreement');
  await page.locator('[data-everyones-part]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, '17-today-agreed.png') });
  await page.goto(base + '/app/family-calendar?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.click('[data-calendar-agreements] summary');
  if (!(await page.locator('[data-calendar-agreements]').innerText()).includes('Pack my bag before bed')) fail('calendar: the agreement isn\'t shown');
  else console.log('  ✓ calendar: agreements beside the week');
  await page.screenshot({ path: join(OUT, '18-calendar-agreed.png') });

  // Remove it: gone everywhere, the profile's own responsibilities stay.
  await page.goto(base + '/app/family/responsibilities?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await edited.locator('[data-remove-agreement]').click();
  await edited.locator('[data-confirm-remove]').click();
  if (!(await page.locator('[data-no-agreements]').isVisible())) fail('Responsibilities: remove didn\'t remove');
  else if (!(await page.locator('#existing-h + ul li').count())) fail('Responsibilities: removing an agreement touched what the family already does');
  else console.log('  ✓ responsibilities: remove an agreement; the family profile is untouched');
  await page.close();
}

// The Club back link ("← Family Meeting Club", href /club) stays in the app: Club Home, not the sales page.
{
  const page = await native.newPage();
  await page.goto(base + '/app/club/january', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = '/club';
    a.id = 'smoke-club';
    a.textContent = '← Family Meeting Club';
    document.querySelector('main')?.prepend(a);
  });
  const popup = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);
  await page.click('#smoke-club');
  await page.waitForLoadState('networkidle');
  if (await popup) fail('/club back link left the app');
  else if (new URL(page.url()).pathname.replace(/\/$/, '') !== '/app/club') fail(`/club back link opened ${page.url()}`);
  else console.log('  ✓ /club back link opens Club Home in the app');
  await page.close();
}

// Root opens Today.
{
  const page = await web.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  if (new URL(page.url()).pathname.replace(/\/$/, '') !== '/app') fail(`/ should open /app, opened ${page.url()}`);
  await page.close();
}

// Our Week: the complete cleaning companion is free in the app (no wall-calendar unlock); a checkmark survives a reload.
{
  const page = await visit(native, '/app', '02-today-native');
  if (await page.locator('[data-calendar-unlock-button]').isVisible()) fail('the app still asks for the wall calendar before Cleaning');
  if (!(await page.locator('[data-today-shortcut="cleaning"]').isVisible())) fail('no Cleaning shortcut without a wall calendar');
  {
    await page.goto(base + '/app/cleaning', { waitUntil: 'networkidle' });
    // A new device sees the companion's short onboarding first: step through it, as she would.
    for (let i = 0; i < 6 && (await page.locator('[role="dialog"] .btn-primary').isVisible().catch(() => false)); i++) {
      await page.locator('[role="dialog"] .btn-primary').click();
      await page.waitForTimeout(150);
    }
    const box = page.locator('input[type="checkbox"]').first();
    if (!(await box.count())) fail('/app/cleaning: no checklist after unlock');
    else {
      await box.check({ force: true });
      await page.reload({ waitUntil: 'networkidle' });
      const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('omc:v1:daily:') || k.startsWith('omc:v1:focus:')).length);
      if (!saved) fail('/app/cleaning: checkmark not saved after reload');
      else console.log('  ✓ free cleaning (no unlock) → checkmark saved');
      await page.screenshot({ path: join(OUT, '07-cleaning.png') });
    }
  }
  // Shopping stays on the website.
  await page.goto(base + '/app', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = '/shop';
    a.textContent = 'shop';
    a.id = 'smoke-shop';
    document.querySelector('main')?.prepend(a);
  });
  const popup = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null);
  await page.click('#smoke-shop');
  const opened = await popup;
  if (!opened) fail('/shop link did not open outside the app');
  else if (!opened.url().startsWith('https://www.organizedmomcollective.com/shop')) fail(`/shop opened ${opened.url()}`);
  else console.log('  ✓ /shop opens on the website, not in the app');
  if (new URL(page.url()).pathname !== '/app') fail('tapping /shop navigated the app away from Today');
  await page.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.error(`\napp-shell smoke test: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`\napp-shell smoke test passed; screenshots in ${OUT}/`);
