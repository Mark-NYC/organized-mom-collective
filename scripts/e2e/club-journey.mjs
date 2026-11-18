#!/usr/bin/env node
/**
 * The Family Meeting Club inside Organized Family, end to end (docs/ios/CLUB_INTEGRATION.md): for each membership state
 * (free, trial with a second adult, active returning member, canceled with delivered months kept, beta grant), sign in
 * and walk Today → Family → this month's Club plan → its Family Meeting → Club Home → Monthly resources → membership →
 * back to Family, checking every screen keeps the app's header and four tabs (never a separate Club site). Then ask the
 * server directly what each person may open or change: access is decided there, not by hidden buttons.
 *
 * Against the ISOLATED test backend only (scripts/e2e/test-backend.mjs on the database from family-db.sh, seed.sql and
 * club-journey-seed.sql). Never production.
 * Usage: node scripts/e2e/club-journey.mjs <build-dir> [out=club-journey] [web|app]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.argv[2] ?? 'app-www';
const OUT = process.argv[3] ?? 'club-journey';
const WEB = process.argv[4] === 'web';
const API = 'http://127.0.0.1:54321';
mkdirSync(OUT, { recursive: true });
const MONTH = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][new Date().getMonth()];
const KIT = '2026-11-family-ownership';

const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg' };
const server = createServer((q, r) => {
  const p = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const f = extname(p) ? join(ROOT, p) : existsSync(join(ROOT, p, 'index.html')) ? join(ROOT, p, 'index.html') : join(ROOT, 'index.html');
  if (!existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': T[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;

const results = [];
let failures = 0;
const check = (who, step, ok, detail = '') => {
  results.push({ who, step, ok: Boolean(ok), detail });
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} [${who}] ${step}${detail ? ` — ${detail}` : ''}`);
};
const rpc = async (token, fn, body = {}) => {
  const r = await fetch(`${API}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, body: json };
};

const browser = await chromium.launch();
async function session(email, width = 393) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 852 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('omc:v1:onboarded', '1'); } catch { /* fine */ } });
  const page = await ctx.newPage();
  await page.goto(`${base}/club/login`, { waitUntil: 'networkidle' });
  await page.fill('#club-email', email);
  await page.click('button:has-text("Email me a code")');
  await page.fill('#club-code', '123456');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('omc:account:session')).access_token);
  return { ctx, page, token };
}
const settle = (page, ms = 2500) => page.waitForTimeout(ms);
/** The app's chrome on this screen: its header, the four tabs (bar or header), the Club bar. */
const chrome = (page) => page.evaluate(() => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
  return {
    path: location.pathname + location.search,
    header: vis(document.querySelector('body > header[data-chrome]')),
    tabs: [...document.querySelectorAll('[data-app-tabbar] a, [data-app-topnav] a')].filter(vis).map((e) => e.textContent.trim()),
    clubBar: vis(document.querySelector('[data-club-nav]')),
    oldClubHeader: !!document.querySelector('header.club-header, #club-header-slot'),
    h1: [...document.querySelectorAll('h1')].filter(vis).map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  };
});
const inApp = (c) => c.header && ['Today', 'Calendar', 'Cleaning', 'Family'].every((t) => c.tabs.includes(t)) && !c.oldClubHeader;
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

const PEOPLE = [
  { email: 'free@e2e.test', who: 'free', club: false },
  { email: 'trial@e2e.test', who: 'trial (new member)', club: true, owner: true },
  { email: 'partner@e2e.test', who: 'second adult', club: true, owner: false },
  { email: 'active@e2e.test', who: 'active (returning)', club: true, owner: true },
  { email: 'canceled@e2e.test', who: 'canceled', club: false, kept: true },
  { email: 'jen@e2e.test', who: 'beta grant', club: true, owner: true },
];

for (const person of PEOPLE) {
  const { who } = person;
  const { ctx, page, token } = await session(person.email);
  const tag = who.split(' ')[0];

  await page.goto(`${base}/app`, { waitUntil: 'load' }); await settle(page);
  check(who, 'Today is the app', inApp(await chrome(page)));
  await page.click('[data-app-tabbar] a[href="/app/family"]'); await page.waitForURL(/\/app\/family/); await settle(page);
  const fam = await chrome(page);
  check(who, 'Family tab: the app', inApp(fam));
  const clubTile = await page.locator('[data-family-club-card]').count();
  check(who, person.club ? 'Family shows the Club tile' : 'Family shows no Club tile', person.club ? clubTile === 1 : clubTile === 0);
  if (person.kept) check(who, 'Family shows the months the family kept (no price, no rejoin)', (await page.locator('[data-family-club-kept]').count()) === 1 && !/\$\d|join|subscribe/i.test(await page.locator('[data-family-club-kept]').innerText()));
  if (!person.club && !person.kept) check(who, 'Family shows no kept-months tile', (await page.locator('[data-family-club-kept]').count()) === 0);
  await shot(page, `${tag}-01-family`);

  // Server-side: what may this person open or change?
  const res = await rpc(token, 'club_resource_get', { p_kit: KIT });
  const opened = res.status < 300 && res.body && typeof res.body === 'object' && res.body.can;
  if (person.club || person.kept) check(who, `server opens November (${res.body?.can ?? res.status})`, Boolean(opened), JSON.stringify(res.body).slice(0, 120));
  else check(who, 'server refuses November', !opened, `${res.status} ${JSON.stringify(res.body).slice(0, 120)}`);
  if (person.club && person.owner === false) {
    const addr = await rpc(token, 'club_address_save', { p: { name: 'T', line1: '1 Test St', city: 'X', state: 'NY', postal_code: '10001' } });
    check(who, 'server refuses the second adult the mailing address', addr.status >= 400 && /owner_only/.test(JSON.stringify(addr.body)), `${addr.status} ${JSON.stringify(addr.body).slice(0, 80)}`);
    const me = await rpc(token, 'club_me');
    check(who, 'server shows the second adult no billing', me.body?.household_role === 'partner' && me.body?.plan === null && me.body?.has_address === null);
  }

  if (person.kept) {
    await page.click('[data-family-club-kept]'); await page.waitForURL(/\/app\/club\/months/); await settle(page, 3500);
    check(who, 'kept months open inside the app', inApp(await chrome(page)));
    await shot(page, `${tag}-05-months`);
  }
  if (person.club) {
    await page.click('[data-family-club-card] a.of-btn:not(.of-btn--soft)'); await page.waitForURL(new RegExp(`/app/club/${MONTH}`)); await settle(page, 4000);
    const month = await chrome(page);
    check(who, `${MONTH}'s plan opens inside the app (header, tabs, Club bar)`, inApp(month) && month.clubBar, JSON.stringify(month).slice(0, 160));
    await shot(page, `${tag}-02-month`);
    await page.goto(`${base}/app/club/${MONTH}?view=meeting`, { waitUntil: 'load' }); await settle(page, 3500);
    check(who, 'this month’s Family Meeting: inside the app', inApp(await chrome(page)) && (await page.locator('[data-family-meeting]').count()) > 0);
    await shot(page, `${tag}-03-meeting`);
    await page.click('[data-club-nav] a[href="/app/club"]'); await page.waitForURL(/\/app\/club$/); await settle(page, 3500);
    const home = await chrome(page);
    check(who, 'Club Home from the Club bar: inside the app', inApp(home) && home.clubBar);
    const status = await page.locator('[data-club-membership]').getAttribute('data-membership-status').catch(() => null);
    check(who, `Club Home shows the membership (${status})`, Boolean(status));
    if (!person.owner) check(who, 'Club Home shows the second adult no billing link', (await page.locator('[data-club-membership] a[href="/club/dashboard"]').count()) === 0);
    await shot(page, `${tag}-04-club-home`);
    await page.click('[data-club-nav] a[href="/app/club/months"]'); await page.waitForURL(/\/app\/club\/months/); await settle(page, 3000);
    check(who, 'Monthly resources: inside the app', inApp(await chrome(page)));
    await shot(page, `${tag}-05-months`);
    if (WEB && person.owner) {
      await page.goto(`${base}/club/dashboard`, { waitUntil: 'load' }); await settle(page, 3500);
      const dash = await chrome(page);
      check(who, `membership and billing (${dash.path}): inside the app`, inApp(dash) && dash.clubBar, JSON.stringify(dash).slice(0, 160));
      await shot(page, `${tag}-06-membership`);
    }
    // Back to Family from anywhere in the Club, with one tap.
    await page.click('[data-app-tabbar] a[href="/app/family"]'); await page.waitForURL(/\/app\/family$/); await settle(page);
    check(who, 'back to Family in one tap', inApp(await chrome(page)) && (await page.locator('[data-family-club-card]').count()) === 1);
  }
  await ctx.close();
}

// Desktop: the same journey keeps the header tabs (no stretched phone, no lost navigation).
{
  const { ctx, page } = await session('active@e2e.test', 1280);
  for (const path of ['/app/family', `/app/club/${MONTH}`, '/app/club', '/app/club/months', ...(WEB ? ['/club/family'] : [])]) {
    await page.goto(base + path, { waitUntil: 'load' }); await settle(page, 3500);
    const c = await chrome(page);
    check('active, desktop', `${path}: header tabs and Club bar`, c.header && c.tabs.length === 4 && !c.oldClubHeader && (path === '/app/family' || c.clubBar), JSON.stringify(c).slice(0, 140));
    await shot(page, `desktop-${path.replace(/\W+/g, '-').replace(/^-|-$/g, '')}`);
  }
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log(failures ? `club journey: ${failures} failure(s)` : `club journey passed (${results.length} checks)`);
server.close();
process.exit(failures ? 1 : 0);
