#!/usr/bin/env node
/**
 * npm run test:app-shell — drives the iPhone app bundle (app-www/, from npm run build:app) at iPhone size in
 * Chromium, served the way the app's router serves it (ios/App/App/OMCRouter.swift: /app/x → app/x/index.html,
 * unknown → /index.html). Not a substitute for a real iPhone; it catches missing files, script errors, layout
 * overflow, leaked tracking and broken link routing before the Xcode build.
 *
 * Checks, per page: no page errors, no missing bundled file (404), no request to Google/Pinterest, no horizontal
 * overflow at 393 px. Then: the "I have the wall calendar" unlock opens cleaning, a checkmark survives a reload, and
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

// Pages a member moves between.
const PAGES = [
  ['/', null],
  ['/app', '01-today'],
  ['/app/club', '03-club'],
  ['/app/club/months', null],
  ['/app/club/january', '04-club-january'],
  ['/app/account', '05-account'],
  ['/club/login', '06-club-login'],
  ['/app/calendar', null],
];
for (const [p, shot] of PAGES) await (await visit(web, p, shot)).close();

// Root opens Today.
{
  const page = await web.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  if (new URL(page.url()).pathname.replace(/\/$/, '') !== '/app') fail(`/ should open /app, opened ${page.url()}`);
  await page.close();
}

// Calendar owners: unlock, then cleaning works and a checkmark survives a reload (native context: the card is app-only UI).
const native = await newContext(true);
{
  const page = await visit(native, '/app', '02-today-native');
  const button = page.locator('[data-calendar-unlock-button]');
  if (!(await button.isVisible())) fail('"I have the wall calendar" card not shown in the app');
  else {
    await button.click();
    await page.waitForURL(/\/app\/cleaning/);
    await page.waitForLoadState('networkidle');
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
      else console.log('  ✓ unlock → cleaning → checkmark saved');
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
