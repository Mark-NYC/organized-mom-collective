/**
 * V20 baseline checks (docs/ios/V20_BASELINE.md): run after `npx astro dev`.
 *   node scripts/e2e/v20-baseline.mjs [base URL] [screenshot dir]
 *
 * - V19 is intact inside V20: every V19 scenario keeps its headline and card;
 * - notifications on two simulated phones: the request reaches only Luis, "I've got it" updates the shared plan and
 *   Ana hears it's handled; a conflict reaches the plan's owner in their own words; quiet hours hold; settings in Account;
 * - the illustration treatment: activity icons are hand-drawn on calendar-color circles with white interiors;
 *   navigation stays simple and black; the light brown card keeps its exact palette;
 * - nav clearance at 375/390/430, V16–V19 state untouched, no page errors.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.argv[2] ?? 'http://127.0.0.1:4321/preview/organized-family-v20';
const OUT = process.argv[3] ?? 'docs/ios/screenshots/v20';
mkdirSync(OUT, { recursive: true });
const results = [];
const errors = [];
const check = (name, ok, detail = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`); };
const browser = await chromium.launch();

async function open(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // The dev server's toolbar is not part of the page; keep it out of the way on every load.
  await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = 'astro-dev-toolbar{display:none!important}'; document.head.append(st);
  }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('omc:v16-preview:v1', '"v16-sentinel"');
    localStorage.setItem('omc:v16-preview:v1:v17', '"v17-sentinel"');
    localStorage.setItem('omc:v16-preview:v1:v18', '"v18-sentinel"');
    localStorage.setItem('omc:v16-preview:v1:v19', '"v19-sentinel"');
  });
  await p.goto(`${URL}#/today`);
  await p.waitForSelector('[data-screen="today"]');
  return p;
}
const settle = (p, ms = 400) => p.waitForTimeout(ms);
const shot = async (p, name) => { await settle(p); await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 84 }); };
async function scenario(p, id) {
  const bar = p.locator('[data-demo-bar]');
  if (!(await bar.evaluate((d) => d.open))) await bar.locator('summary').click();
  await p.selectOption('[data-demo-v19]', id);
  await bar.locator('summary').click();
  await p.evaluate(() => scrollTo(0, 0));
  await settle(p, 500);
}
const headline = (p) => p.locator('[data-v18-headline]').innerText();
const cardTitle = async (p) => ((await p.locator('[data-heads-up]').count()) ? p.locator('.v18-heads-title').innerText() : null);
const style = (p, sel, prop) => p.locator(sel).first().evaluate((el, pr) => getComputedStyle(el)[pr], prop);



// ---------------------------------------------------------------- V19 inside V20
const EXPECT = {
  quiet: ['You’re on track.', null], change: ['A change of plans.', 'Soccer starts an hour earlier.'], cascade: ['A change of plans.', 'Thursday needs a little reshuffling.'],
  prep: ['A little preparation will help.', 'Tomorrow’s school field trip runs through lunch.'], backup: ['A little backup will help.', 'You could use some backup tonight.'],
  lighter: ['A change of plans.', 'Keep today simple.'], friction: ['You’re on track.', null], intention: ['You’re on track.', 'Saturday might be a good day for this.'],
  'two-adults': ['A few things need attention.', 'You could use some backup tonight.'], 'low-value': ['You’re on track.', null], meeting: ['Pick up where you left off.', null],
  'all-done': ['All set for today.', null], 'ai-down': ['A little preparation will help.', 'Zoe’s party on Saturday may need an RSVP and a ride.'],
};
const phone = (p, id) => p.locator(`[data-phone="${id}"] [data-push]`);
async function openBar(p) { const bar = p.locator('[data-demo-bar]'); if (!(await bar.evaluate((d) => d.open))) await bar.locator('summary').click(); }
{
  const p = await open();
  for (const [id, [h, title]] of Object.entries(EXPECT)) {
    await scenario(p, id);
    check(`${id}: V19 headline and card intact`, (await headline(p)) === h && (await cardTitle(p)) === title, `${await headline(p)} | ${await cardTitle(p)}`);
  }
  await p.context().close();
}

// ---------------------------------------------------------------- illustration treatment
{
  const p = await open();
  await scenario(p, 'change');
  const badge = await p.locator('[data-matter="Soccer practice"] [data-badge]').evaluate((el) => {
    const cs = getComputedStyle(el); const img = el.querySelector('img');
    return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, w: el.getBoundingClientRect().width, name: el.dataset.badge, loaded: img.complete && img.naturalWidth > 0 };
  });
  check('activity: hand-drawn badge on a calendar-color circle', badge.name === 'move-play' && badge.bg === 'rgb(212, 223, 196)' && badge.radius === '50%' && badge.loaded && badge.w === 40, JSON.stringify(badge));
  const white = await p.locator('[data-matter="Soccer practice"] [data-badge] img').evaluate(async (img) => {
    const c = document.createElement('canvas'); c.width = c.height = 192; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 192, 192);
    const d = x.getImageData(96, 96, 1, 1).data; return [...d];
  });
  check('badge: the interior is white, not transparent line art', white[0] > 240 && white[1] > 240 && white[2] > 240 && white[3] === 255, JSON.stringify(white));
  check('navigation icons stay simple and black (no circles)', (await p.locator('.v16-tabbar [data-badge], .v16-header [data-badge]').count()) === 0);
  check('the light brown card keeps its palette', (await style(p, '[data-heads-up]', 'backgroundColor')) === 'rgb(237, 229, 218)' && (await style(p, '.v18-heads-title', 'color')) === 'rgb(21, 21, 21)');
  await p.click('[data-heads-action]');
  await p.waitForSelector('[data-resolve-sheet]');
  check('sheet: the affected agreement carries its illustration (car)', (await p.locator('[data-affected="ride"] [data-badge="car"]').count()) === 1);
  await shot(p, 'sheet-with-illustration');
  await p.click('[data-sheet-close]');
  check('meeting row illustrated', (await p.locator('[data-meeting-row] [data-badge="family-meeting-around-a-table"]').count()) === 1);
  await shot(p, 'today-illustrated');
  await p.context().close();
}

// ---------------------------------------------------------------- notifications
{
  const p = await open();
  await scenario(p, 'n-help');
  await openBar(p);
  check('help: only Luis’s phone gets it', (await phone(p, 'm-luis').count()) === 1 && (await phone(p, 'm-ana').count()) === 0);
  check('help: "Ana asked for a hand" with I’ve got it', (await phone(p, 'm-luis').first().innerText()).includes('Ana asked for a hand') && (await p.locator('[data-phone="m-luis"] [data-push-action="got-it"]').count()) === 1);
  await shot(p, 'push-help');
  await p.click('[data-phone="m-luis"] [data-push-action="got-it"]');
  await settle(p);
  check('I’ve got it: the request leaves Luis’s phone', (await phone(p, 'm-luis').count()) === 0);
  check('I’ve got it: Ana hears it’s handled', (await phone(p, 'm-ana').first().innerText()).includes('Luis has it ✓'));
  await p.locator('[data-demo-bar] summary').click();
  await p.locator('[data-other-parts]').click().catch(() => {});
  check('the shared plan now shows Luis’s dinner tonight', (await p.locator('main').innerText()).includes('Luis · Make dinner tonight'));
  await shot(p, 'push-handled');

  await scenario(p, 'n-conflict');
  await openBar(p);
  check('conflict: Luis, in his own words; Ana not disturbed', (await phone(p, 'm-luis').first().innerText()).includes('Your transportation plan needs adjusting.') && (await phone(p, 'm-ana').count()) === 0);
  await p.click('[data-phone="m-luis"] [data-push-action="got-it"]');
  await p.locator('[data-demo-bar] summary').click();
  await settle(p);
  check('conflict claimed: resolved on Today for the household', (await p.locator('[data-heads-up]').count()) === 0);

  await scenario(p, 'n-quiet');
  await openBar(p);
  check('quiet hours: held until 7:00 AM', (await phone(p, 'm-luis').first().getAttribute('data-push-status')) === 'held' && (await phone(p, 'm-luis').first().innerText()).includes('7:00 AM'));
  await shot(p, 'push-quiet-hours');

  await scenario(p, 'n-changed');
  await openBar(p);
  check('agreement changed: Ana hears, Luis (who changed it) doesn’t', (await phone(p, 'm-ana').first().innerText()).includes('Luis updated a shared plan') && (await phone(p, 'm-luis').count()) === 0);

  await scenario(p, 'prep');
  await openBar(p);
  check('a preparation suggestion is never pushed', (await p.locator('[data-push]').count()) === 0);
  await p.locator('[data-demo-bar] summary').click();

  await p.click('[data-account]');
  await p.waitForSelector('[data-notifications]');
  check('Account: three purposes on, meeting reminder off, quiet hours', (await p.locator('[data-notify="needsYou"]').isChecked()) && (await p.locator('[data-notify="changed"]').isChecked())
    && (await p.locator('[data-notify="handled"]').isChecked()) && !(await p.locator('[data-notify="meeting"]').isChecked()) && (await p.locator('[data-quiet]').inputValue()) === '21:00-07:00');
  await shot(p, 'account-notifications');
  check('V16–V19 demo state untouched', await p.evaluate(() => ['', ':v17', ':v18', ':v19'].every((k, i) => localStorage.getItem(`omc:v16-preview:v1${k}`) === ['"v16-sentinel"', '"v17-sentinel"', '"v18-sentinel"', '"v19-sentinel"'][i])));
  await p.context().close();
}

// ---------------------------------------------------------------- nav clearance
for (const vp of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  const p = await open(vp);
  for (const id of ['change', 'n-help']) {
    await scenario(p, id);
    await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await settle(p, 350);
    const r = await p.evaluate(() => { const a = document.querySelector('.v16-shortcuts').getBoundingClientRect(), b = document.querySelector('.v16-tabbar').getBoundingClientRect(); return { last: Math.round(a.bottom), bar: Math.round(b.top) }; });
    check(`${vp.width} ${id}: page end clears the tab bar`, r.last <= r.bar - 4, JSON.stringify(r));
  }
  await p.context().close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
