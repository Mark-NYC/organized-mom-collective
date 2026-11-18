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

const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out?.trim() ?? '';
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

  // THE weekly meeting (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §2): one page; the Club's month inside it.
  await page.goto(`${base}/app/family/meeting`, { waitUntil: 'load' }); await settle(page, 3500);
  const kind = await page.locator('[data-weekly-meeting]').getAttribute('data-meeting-kind');
  const parts = await page.locator('[data-meeting-part]').evaluateAll((els) => els.map((e) => e.getAttribute('data-meeting-part')));
  check(who, 'weekly meeting: the four approved parts, in order', parts.join() === 'Our Focus,Let’s Talk,Everyone’s Part,Let’s Practice' && inApp(await chrome(page)));
  if (person.club) {
    check(who, `weekly meeting carries this month's prepared plan (${kind})`, kind === 'club' && (await page.locator('[data-meeting-focus]').count()) === 1 && (await page.locator('[data-meeting-questions] li').count()) > 0 && (await page.locator('[data-meeting-practice]').count()) === 1);
  } else {
    const body = await page.locator('body').innerText();
    check(who, `weekly meeting: basic guidance, no Club content or selling (${kind})`, kind === 'free' && (await page.locator('[data-meeting-focus], [data-meeting-suggestions], [data-meeting-practice]').count()) === 0 && !/upgrade|subscribe|join the club|family meeting club/i.test(body));
  }
  // Follow-through in weeks 2–4: the family's agreement from 8 days ago comes up in Let's Talk.
  const due = page.locator('[data-check-in]');
  if (['free', 'trial (new member)', 'active (returning)'].includes(who)) {
    const answer = who === 'free' ? 'on-own' : who === 'active (returning)' ? 'struggling' : 'reminders';
    check(who, 'follow-through: last week’s agreement asks “How did it go?”', (await due.count()) === 1);
    await shot(page, `${tag}-07-weekly-meeting`);
    if (await due.count()) {
      await due.first().locator(`[data-check-in-answer="${answer}"]`).click(); await settle(page, 1500);
      if (answer === 'struggling') { await page.click('[data-check-in-barrier="forgets"]'); await settle(page, 1500); }
      const prog = await sql(`select progress || '|' || coalesce(barrier, '') from public.club_responsibilities r where r.status = 'confirmed' and r.household_id = (select household_id from public.household_adults a join auth.users u on u.id = a.user_id where u.email = '${person.email}') and r.agreed_text is not null and r.checked_on is not null limit 1`);
      const want = { 'on-own': 'independent|', reminders: 'improving|', struggling: 'struggling|forgets' }[answer];
      check(who, `follow-through saved for the household: ${answer} → ${prog}`, prog === want);
      if (answer === 'struggling') check(who, 'struggling shows one adjustment for what gets in the way', (await page.locator('[data-check-in-adjustment]').count()) === 1);
      await shot(page, `${tag}-08-follow-through`);
    }
  }
  if (who === 'second adult') check(who, 'follow-through: the other adult sees the household’s answer (asked once a week, not again)', (await due.count()) === 0);
  if (person.club && (await page.locator('[data-agree-suggestion]').count())) {
    await page.locator('[data-agree-suggestion]').first().click(); await settle(page, 2500);
    const src = await sql(`select count(*) from public.club_responsibilities r where r.status = 'confirmed' and r.agreed_source like 'month:%' and r.household_id = (select household_id from public.household_adults a join auth.users u on u.id = a.user_id where u.email = '${person.email}')`);
    check(who, 'an age-fit suggestion becomes an agreement with the month’s source key', Number(src) >= 1, src);
  }
  // Progressive profiling, free only: one question, saved to the same profile the Club intake uses.
  if (who === 'free') {
    const q = page.locator('[data-profile-question="challenges"]');
    check(who, 'one optional profile question after the meeting (never the five-step intake)', (await q.count()) === 1 && (await page.locator('[data-profile-question]').count()) === 1);
    if (await q.count()) {
      await page.click('[data-profile-choice="routines"]'); await page.click('[data-profile-save]'); await settle(page, 2000);
      const saved = await sql(`select array_to_string(challenges, ',') || '|' || array_to_string(setup_done, ',') from public.club_households h join public.household_adults a on a.household_id = h.id join auth.users u on u.id = a.user_id where u.email = 'free@e2e.test'`);
      check(who, `saved to the family profile and marks the Club intake step (${saved})`, saved === 'routines|challenges');
      await page.reload({ waitUntil: 'load' }); await settle(page, 3000);
      check(who, 'next meeting’s Let’s Talk asks about it; the next question is priority', (await page.locator('[data-meeting-challenge]').count()) === 1 && (await page.locator('[data-profile-question="priority"]').count()) === 1);
      await shot(page, `${tag}-09-profile-question`);
    }
  }

  if (person.kept) {
    await page.goto(`${base}/app/family`, { waitUntil: 'load' }); await settle(page);
    await page.click('[data-family-club-kept]'); await page.waitForURL(/\/app\/club\/months/); await settle(page, 3500);
    check(who, 'kept months open inside the app', inApp(await chrome(page)));
    await shot(page, `${tag}-05-months`);
  }
  if (person.club) {
    await page.goto(`${base}/app/family`, { waitUntil: 'load' }); await settle(page);
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
    if (await page.locator('[data-home-weekly-meeting]').count()) check(who, 'Club Home’s meeting button opens THE weekly meeting', (await page.locator('[data-home-weekly-meeting]').getAttribute('href')) === '/app/family/meeting');
    if (await page.locator('[data-home-current]').count()) check(who, 'Club Home: what this month was prepared from (ages, theme)', /\(\d+\)/.test(await page.locator('[data-prepared-for]').innerText().catch(() => '')));
    check(who, 'no audio promises anywhere on Club Home', !/audio/i.test(await page.locator('body').innerText()));
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

// THE member journey, one family, phone size: Today → Family → this week's Family Meeting → this month's personalized
// resource → back → "We agreed" → a week later, the follow-through on what they agreed. Every screen is the app.
{
  const who = 'member journey';
  const { ctx, page } = await session('active@e2e.test');
  const step = async (name, ok, detail) => { check(who, name, ok, detail); await shot(page, `journey-${String(results.filter((r) => r.who === who).length).padStart(2, '0')}`); };
  await page.goto(`${base}/app`, { waitUntil: 'load' }); await settle(page, 3000);
  await step('Today: the app, with this month’s Club tile named as its page names it', inApp(await chrome(page)) && (await page.locator('[data-club-month]').count()) === 1);
  await page.click('[data-app-tabbar] a[href="/app/family"]'); await page.waitForURL(/\/app\/family$/); await settle(page, 2500);
  await step('Family: one way into the meeting, then the month’s Club tile (no duplicate meeting buttons)', inApp(await chrome(page)) && (await page.locator('a[href="/app/family/meeting"]:not([data-getting-started] a)').count()) === 1 && (await page.locator('[data-family-club-card]').count()) === 1);
  await page.click('[data-app-tabbar] a[href="/app"]'); await page.waitForURL(/\/app$/); await settle(page, 2500);
  await step('Today’s meeting link opens the same weekly meeting', (await page.locator('a[href*="view=meeting"]').count()) === 0);
  await page.click('[data-app-tabbar] a[href="/app/family"]'); await page.waitForURL(/\/app\/family$/); await settle(page, 2500);
  await page.click('[data-open-meeting]'); await page.waitForURL(/\/app\/family\/meeting/); await settle(page, 3500);
  await step('Weekly meeting: this month’s prepared plan inside the four parts', inApp(await chrome(page)) && (await page.locator('[data-weekly-meeting][data-meeting-kind="club"]').count()) === 1);
  const res = page.locator('[data-meeting-resource]').first();
  const resHref = await res.getAttribute('href');
  await res.click(); await page.waitForURL((u) => u.pathname === resHref); await settle(page, 5000);
  const r = await chrome(page);
  await step(`the month’s personalized resource (${resHref}) opens inside the app with the Club bar`, inApp(r) && r.clubBar, JSON.stringify(r).slice(0, 160));
  await page.goBack({ waitUntil: 'load' }); await settle(page, 3500);
  await step('back to the meeting in one step', /\/app\/family\/meeting/.test(page.url()));
  const before = Number(await sql(`select count(*) from public.club_responsibilities where status = 'confirmed' and deleted_at is null and household_id = public.household_id_for('00000000-0000-0000-0000-0000000c1b03')`));
  const sug = page.locator('[data-agree-suggestion]').first();
  const had = await sug.count();
  if (had) { await sug.click(); await settle(page, 2500); }
  else { await page.fill('[data-agreement-new]', 'Set the table before dinner'); await page.click('[data-owner-chip="Mia"]'); await page.click('[data-save-new-agreement]'); await settle(page, 2500); }
  const after = Number(await sql(`select count(*) from public.club_responsibilities where status = 'confirmed' and deleted_at is null and household_id = public.household_id_for('00000000-0000-0000-0000-0000000c1b03')`));
  await step(`"We agreed" saves the agreement for the household (${had ? 'the month’s suggestion' : 'their own words'})`, after === before + 1, `${before} → ${after}`);
  // A week passes (test database only): the new agreement is 8 days old.
  await sql(`update public.club_responsibilities set confirmed_at = now() - interval '8 days' where status = 'confirmed' and household_id = public.household_id_for('00000000-0000-0000-0000-0000000c1b03') and checked_on is null and confirmed_at > now() - interval '1 day'`);
  await page.reload({ waitUntil: 'load' }); await settle(page, 3500);
  const due = page.locator('[data-check-in]');
  await step('next week: Let’s Talk asks how it went', (await due.count()) >= 1);
  if (await due.count()) {
    await due.first().locator('[data-check-in-answer="on-own"]').click(); await settle(page, 2000);
    await step('On my own: celebrated, nothing new added', (await page.locator('[data-check-in-result="celebrate"]').count()) === 1);
  }
  await page.click('[data-app-tabbar] a[href="/app/family"]'); await page.waitForURL(/\/app\/family$/); await settle(page, 2500);
  await step('Family’s “Who does what” shows the agreement', (await page.locator('[data-family-responsibilities-card]').innerText()).length > 20);
  // January's earlier work (production shape): reachable from the January page, viewed without changing anything saved.
  const savedBefore = await sql(`select v.state -> 'omc:club:january-weekly-meeting:v1' ->> 'v' from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '2027-01-fresh-start-together' and v.household_id = public.household_id_for('00000000-0000-0000-0000-0000000c1b03')`);
  await page.goto(`${base}/app/club/january`, { waitUntil: 'load' }); await settle(page, 5000);
  const earlierLink = await page.locator('a[href*="?earlier"]').count();
  await step('January page offers the plans this family saved earlier', earlierLink >= 1);
  await page.goto(`${base}/club/resources/2027-01-fresh-start-together?earlier`, { waitUntil: 'load' }); await settle(page, 5000);
  const e = await chrome(page);
  await step('earlier January plans: inside the app, a clear note, both tools offered, no print approval', inApp(e) && (await page.locator('[data-earlier-note]').count()) === 1 && !(await page.locator('[data-earlier-switch]').isHidden()) && (await page.locator('button:has-text("Looks good, print it")').count()) === 0, JSON.stringify(e).slice(0, 120));
  await page.click('[data-earlier-show="weekly-meeting"]'); await settle(page, 1500);
  await step('the retired January Weekly Meeting opens', await page.locator('[data-earlier-tool="weekly-meeting"]').isVisible());
  const savedAfter = await sql(`select v.state -> 'omc:club:january-weekly-meeting:v1' ->> 'v' from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '2027-01-fresh-start-together' and v.household_id = public.household_id_for('00000000-0000-0000-0000-0000000c1b03')`);
  check(who, 'viewing the retired tool changes nothing saved', savedBefore === savedAfter && savedBefore.length > 0);
  await ctx.close();
}

// November has two editions (owner, 2026-11-18). Each prints its own year and works out ages for its own November:
// Mia (born May 2017) is 9 in November 2026 and 10 in November 2027, so her prepared job differs. Saved versions stay
// per edition; an admin's print view of each mailing shows that edition; viewing changes no order.
{
  const who = 'november editions';
  const NOV = { '2026': '2026-11-family-ownership', '2027': '2027-11-family-ownership' };
  const JOB = { '2026': "Lay out tomorrow's clothes", '2027': 'Prepare my school and activity gear' };
  for (const [y, slug] of Object.entries(NOV)) {
    const html = readFileSync(join(ROOT, 'club/resources', slug, 'index.html'), 'utf8');
    const other = y === '2026' ? '2027' : '2026';
    check(who, `${y}: every printed header says NOVEMBER ${y} (static page)`, (html.match(new RegExp(`FAMILY MEETING CLUB · NOVEMBER ${y}`, 'g')) ?? []).length === 3 && !html.includes(`NOVEMBER ${other}`));
  }
  const version = (slug) => sql(`select coalesce(md5(v.state::text) || ':' || v.revision, 'none') from public.club_kits k left join public.club_resource_versions v on v.kit_id = k.id and v.household_id = public.household_id_for('00000000-0000-0000-0000-0000000c1b03') where k.slug = '${slug}'`);
  const orders = () => sql(`select string_agg(to_char(resource_month,'YYYY-MM') || ' ' || status || ' ' || updated_at::text, ', ' order by resource_month) from public.club_fulfillment_orders where note like 'e2e November%'`);
  const statuses = () => sql(`select string_agg(to_char(resource_month,'YYYY-MM') || ' ' || status, ', ' order by resource_month) from public.club_fulfillment_orders where note like 'e2e November%'`);
  const statusBefore = await statuses();
  const ordersBefore = await orders();
  const { ctx, page } = await session('active@e2e.test', 1280);
  const seen = {};
  for (const [y, slug] of Object.entries(NOV)) {
    await page.goto(`${base}/club/resources/${slug}`, { waitUntil: 'load' }); await settle(page, 6000);
    const text = await page.locator('.nvp').innerText().catch(() => '');
    seen[y] = await version(slug);
    check(who, `${y}: Mia's prepared job is the one for her age that November (${JOB[y]})`, text.includes(JOB[y]) && !text.includes(JOB[y === '2026' ? '2027' : '2026']) && text.includes(`NOVEMBER ${y}`));
    check(who, `${y}: inside the app with the Club bar`, inApp(await chrome(page)) && (await chrome(page)).clubBar);
    await shot(page, `november-${y}`);
  }
  check(who, `each edition keeps its own saved version (${seen['2026'].split(':')[1] ?? '–'} / ${seen['2027'].split(':')[1] ?? '–'})`, seen['2026'] !== seen['2027']);
  await page.goto(`${base}/club/resources/${NOV['2026']}`, { waitUntil: 'load' }); await settle(page, 6000);
  check(who, '2026 again after opening 2027: its saved version and its job are unchanged', (await version(NOV['2026'])) === seen['2026'] && (await page.locator('.nvp').innerText()).includes(JOB['2026']));
  await ctx.close();
  // (A member's first save of a month resets that month's PENDING order to "not approved by her yet": the existing
  // rule in club_resource_save. Printed and mailed orders are never touched by it.)
  const ordersBeforeAdmin = await orders();
  // An admin's print view of each mailing (bare, the household's own edition).
  const admin = await session('admin@e2e.test', 1280);
  const tok = await admin.page.evaluate(() => JSON.parse(localStorage.getItem('omc:account:session')));
  await admin.page.evaluate((t) => { sessionStorage.setItem('omc:v1:admin', JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token ?? '', expires_at: Date.now() + 3600e3, email: 'admin@e2e.test' })); sessionStorage.setItem('omc:v1:admin:active', String(Date.now())); }, tok);
  for (const [y, slug] of Object.entries(NOV)) {
    const id = await sql(`select id from public.club_fulfillment_orders where note = 'e2e November ${y}'`);
    await admin.page.goto(`${base}/club/resources/${slug}?fulfillment=${id}`, { waitUntil: 'load' }); await settle(admin.page, 6000);
    const c = await chrome(admin.page);
    const text = await admin.page.locator('.nvp').innerText().catch(() => '');
    check(who, `${y}: the mailing's print view is bare and prints NOVEMBER ${y} with the right job`, !c.header && c.tabs.length === 0 && !c.clubBar && text.includes(`NOVEMBER ${y}`) && text.includes(JOB[y]), `${JSON.stringify(c).slice(0, 80)} ${text.slice(0, 60)}`);
    await shot(admin.page, `november-${y}-fulfillment`);
  }
  await admin.ctx.close();
  check(who, 'the print views change nothing on either order', (await orders()) === ordersBeforeAdmin, ordersBeforeAdmin);
  check(who, 'no order status changed by any of this', (await statuses()) === statusBefore, statusBefore);
}

// Every monthly page (the source of truth for its month) opens inside the app: header, four tabs, Club bar, and
// Club Home's year strip calls each month what its page calls it (src/data/club/month-pages.ts).
{
  const names = readFileSync('src/data/club/month-pages.ts', 'utf8');
  const pageNames = [...names.matchAll(/route: '(\/app\/club\/[a-z]+)', name: '([^']+)'/g)].map((m) => ({ route: m[1], name: m[2] }));
  const { ctx, page } = await session('active@e2e.test');
  await page.goto(`${base}/app/club`, { waitUntil: 'load' }); await settle(page, 3500);
  const strip = await page.locator('[data-home-year] .ofc-year-title').allInnerTexts();
  check('active', `Club Home year strip names all 12 months as their pages do (${strip.length})`, strip.length === 12 && pageNames.every((p, i) => strip[i].replace(/[‘’]/g, "'") === p.name.replace(/[‘’]/g, "'")), strip.join(' | '));
  for (const route of [...pageNames.map((p) => p.route), '/app/club/march/spring-prep']) {
    await page.goto(base + route, { waitUntil: 'load' }); await settle(page, 3000);
    const c = await chrome(page);
    check('active', `${route}: inside the app with the Club bar`, inApp(c) && c.clubBar, JSON.stringify(c).slice(0, 140));
  }
  await shot(page, 'phone-march-spring-prep');
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
