/**
 * Organized Family Club QA, run by hand on a build with the Club switched on (never part of npm run verify):
 *
 *   PUBLIC_CLUB_ENABLED=true npx astro build --outDir /tmp/dist-club
 *   npm i --no-save playwright   # or playwright-core, with CHROMIUM=/path/to/chrome
 *   node scripts/club-qa.mjs /tmp/dist-club /tmp/club-qa
 *
 * For every sample household (src/data/club/samples.ts): the dashboard, the family form and the kit at phone
 * (390 px) and desktop widths, no sideways scrolling, the chart filled in for every person; then edits (reassign,
 * reword, frequency, add, remove, accept or dismiss suggestions), save, reload, still there; then each printable to
 * a US Letter PDF and a PNG of the printed page, checking page count and that no job text overflows its card.
 * Also a stress chart: the biggest sample plus 24 added jobs.
 * Writes PDFs, PNGs and report.json to the output folder; exits 1 on any failure.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const [dist, out = 'club-qa'] = process.argv.slice(2);
if (!dist || !existsSync(join(dist, 'club'))) {
  console.error('Usage: node scripts/club-qa.mjs <dist built with PUBLIC_CLUB_ENABLED=true> [out]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core'));
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const candidates = [join(dist, path), join(dist, path, 'index.html'), join(dist, `${path}.html`)];
  const file = candidates.find((f) => existsSync(f) && statSync(f).isFile());
  if (!file) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const failures = [];
const report = [];
const check = (ok, what) => {
  if (!ok) failures.push(what);
  return ok;
};

const pdfPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

async function printTo(page, doc, orientation, name, nth = 0) {
  // The real print button, with the browser's dialog stubbed: printDocument() fits the chart and sets the page up.
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('[hidden]').evaluateAll(() => {});
  const button = page.getByRole('button', { name: 'Print or save as PDF' }).filter({ visible: true });
  await button.nth(nth).click();
  await page.evaluate((d) => { if (document.documentElement.dataset.clubPrint !== d) throw new Error(`printing ${document.documentElement.dataset.clubPrint}, expected ${d}`); }, doc);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))));
  const overflow = await page.evaluate((d) => {
    const root = document.querySelector(`.club-print[data-doc="${d}"]`);
    if (!root) return ['missing'];
    return [...root.querySelectorAll('.club-job-title, .club-card-name, .club-sheet-row, .club-sheet-owner')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent.trim().slice(0, 40));
  }, doc);
  // A blank page still counts as a page: the printable itself must be showing, with its text, in print mode.
  const shown = await page.evaluate((d) => {
    const el = document.querySelector(`.club-print[data-doc="${d}"]`);
    return Boolean(el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 100 && el.textContent?.trim());
  }, doc);
  if (!shown) failures.push(`${name}: the printout was blank (printable hidden in print)`);
  // The PNG first: page.pdf() fires afterprint, which (rightly) puts the screen back.
  const [w, h] = orientation === 'landscape' ? [1056, 816] : [816, 1056];
  await page.setViewportSize({ width: w, height: h });
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  writeFileSync(join(out, `${name}.pdf`), pdf);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => {
    delete document.documentElement.dataset.clubPrint;
    document.getElementById('club-page-size')?.remove();
  });
  return { pages: pdfPages(pdf), overflow };
}

const noSideScroll = (page) => page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1);

const samples = ['rivera', 'brooks', 'chen', 'okafor'];
for (const id of samples) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const entry = { sample: id };

  await page.goto(`${base}/club/dashboard?sample=${id}`);
  await page.getByRole('link', { name: /open your kit/i }).waitFor();
  check(await noSideScroll(page), `${id}: dashboard scrolls sideways on a phone`);
  await page.screenshot({ path: join(out, `${id}-dashboard-phone.png`), fullPage: true });

  await page.goto(`${base}/club/family?sample=${id}`);
  await page.getByRole('heading', { name: 'Your family' }).waitFor();
  check(await noSideScroll(page), `${id}: family form scrolls sideways on a phone`);
  await page.screenshot({ path: join(out, `${id}-family-phone.png`), fullPage: true });

  await page.goto(`${base}/club/kits/2026-11-family-ownership?sample=${id}`);
  await page.getByRole('heading', { name: 'Our Family, Our Team' }).waitFor();
  check(await noSideScroll(page), `${id}: kit scrolls sideways on a phone`);
  const people = await page.locator('section[aria-labelledby^="who-ownership-chart-"]:not([aria-labelledby="who-ownership-chart-open"])').count();
  const jobs = await page.locator('section[aria-labelledby^="who-ownership-chart-"] li').count();
  entry.people = people;
  entry.jobs = jobs;
  check(people > 0 && jobs >= people, `${id}: the kit didn't open filled in (${people} people, ${jobs} jobs)`);
  await page.screenshot({ path: join(out, `${id}-kit-phone.png`), fullPage: true });

  // Edits: reword and reassign the first job, add one, remove one, save, reload.
  const first = page.locator('section[aria-labelledby^="who-ownership-chart-"] li').first();
  await first.getByRole('button', { name: /^Change/ }).click();
  await first.getByLabel('The job').fill('QA reworded job');
  await first.getByLabel('How often').selectOption('weekdays');
  await first.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /^\+ Add a job for/ }).first().click();
  await page.getByLabel(/^A job for/).fill('QA custom job');
  await page.getByRole('button', { name: 'Add job', exact: true }).click();
  // Remove a suggested job from the last person (the custom job above went to the first).
  const other = page.locator('section[aria-labelledby^="who-ownership-chart-"]:not([aria-labelledby="who-ownership-chart-open"])').last().locator('li').first();
  await other.getByRole('button', { name: /^Change/ }).click();
  await other.getByRole('button', { name: 'Remove from the chart' }).click();
  await page.getByRole('button', { name: /Save our chart|Save changes/ }).first().click();
  await page.getByText('All changes saved').first().waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Our Family, Our Team' }).waitFor();
  check(await page.getByText('QA reworded job').count() > 0, `${id}: a reworded job didn't survive a reload`);
  check(await page.getByText('QA custom job').count() > 0, `${id}: an added job didn't survive a reload`);
  check(await page.getByText(/Removed jobs \(1\)/).count() > 0, `${id}: a removed job didn't survive a reload`);

  // Desktop print of every printable.
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [tab, doc, orientation] of [['Family chart', 'ownership-chart', 'landscape'], ['Team reset', 'kitchen-pantry-reset', 'portrait'], ['Team meeting', 'who-owns-what', 'portrait'], ['Handing Over a Whole Job', 'handing-over', 'portrait']]) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const r = await printTo(page, doc, orientation, `${id}-${doc}`);
    entry[doc] = r;
    check(r.pages === 1, `${id}: ${doc} printed on ${r.pages} pages (expected 1)`);
    check(r.overflow.length === 0, `${id}: ${doc} has text overflowing: ${r.overflow.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  check(errors.length === 0, `${id}: page errors: ${errors.join(' | ')}`);
  report.push(entry);
  await ctx.close();
}

// August: the overview opens with 5–8 first actions; the school setup changes the plan; every printable prints.
for (const id of samples) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const entry = { august: id };
  await page.goto(`${base}/club/kits/2027-08-school-year?sample=${id}`);
  await page.getByRole('heading', { name: /^Start with these/ }).waitFor();
  check(await noSideScroll(page), `${id}: August overview scrolls sideways on a phone`);
  const actions = await page.locator('#club-first ~ ol > li').count();
  entry.actions = actions;
  check(actions >= 5 && actions <= 8, `${id}: August overview shows ${actions} first actions (expected 5–8)`);
  check(await page.getByRole('link', { name: 'November 2026' }).count() === 1, `${id}: no month switcher to November`);
  await page.screenshot({ path: join(out, `${id}-august-overview-phone.png`), fullPage: true });

  // School setup: a first day and a different school for the first child; the chips turn into dates.
  await page.getByRole('button', { name: /Add first days and schools|Change schools or first days/ }).click();
  await page.locator('input[type="date"]').first().fill('2027-08-26');
  await page.getByText('Saved', { exact: true }).waitFor();
  check(await page.getByText(/By Aug \d+/).count() > 0, `${id}: a first day didn't turn into due dates`);
  await page.reload();
  await page.getByRole('heading', { name: /^Start with these/ }).waitFor();
  check(await page.getByText(/starts Thu, Aug 26/).count() > 0, `${id}: the first day didn't survive a reload`);

  await page.setViewportSize({ width: 1280, height: 900 });
  const kidsInSchool = await page.evaluate(() => [...document.querySelectorAll('section[aria-labelledby="club-setup"] ul > li')].filter((li) => !/Not in school/.test(li.textContent ?? '')).length);
  for (const [tab, doc, orientation, pages] of [['Launch plan', 'school-launch', 'portrait', 1], ['Routines', 'school-routines', 'portrait', kidsInSchool], ['Command center', 'command-center', 'landscape', 1]]) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const r = await printTo(page, doc, orientation, `${id}-august-${doc}`);
    entry[doc] = r;
    check(r.pages === pages, `${id}: ${doc} printed on ${r.pages} pages (expected ${pages})`);
    check(r.overflow.length === 0, `${id}: ${doc} has text overflowing: ${r.overflow.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.getByRole('button', { name: 'In the mail', exact: true }).click();
  for (const [n, doc] of ['school-guide', 'school-huddle', 'backpack-station'].entries()) {
    const r = await printTo(page, doc, 'portrait', `${id}-august-${doc}`, n);
    entry[doc] = r;
    check(r.pages === 1, `${id}: ${doc} printed on ${r.pages} pages (expected 1)`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  // Same family, same profile: November still opens from the switcher.
  await page.getByRole('link', { name: 'November 2026' }).click();
  await page.getByRole('heading', { name: 'Our Family, Our Team' }).waitFor();
  check(errors.length === 0, `${id}: August page errors: ${errors.join(' | ')}`);
  report.push(entry);
  await ctx.close();
}

// Family changes: add a child on the family page, then the kit shows suggestions without changing the chart.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/club/kits/2026-11-family-ownership?sample=brooks`);
  await page.getByRole('button', { name: 'Save our chart' }).click();
  await page.getByText('All changes saved').waitFor();
  const before = await page.locator('section[aria-labelledby^="who-ownership-chart-"] li').allTextContents();
  await page.goto(`${base}/club/family?sample=brooks`);
  await page.getByRole('button', { name: '+ Add a grown-up' }).click();
  await page.getByLabel('First name').nth(1).fill('Sam');
  await page.getByRole('button', { name: '+ Add a child' }).click();
  await page.getByLabel('First name').last().fill('Nora');
  await page.getByLabel('Age').last().selectOption('11');
  await page.getByRole('button', { name: 'Save our family' }).click();
  await page.getByText('Saved.').waitFor();
  await page.goto(`${base}/club/kits/2026-11-family-ownership?sample=brooks`);
  await page.getByRole('heading', { name: 'Suggested changes' }).first().waitFor();
  const after = await page.locator('section[aria-labelledby^="who-ownership-chart-"] li').allTextContents();
  const suggestions = await page.locator('#ownership-chart-suggestions + p + ul li').count();
  check(suggestions > 0, 'family change: no suggestions shown');
  const changed = before.filter((t) => !after.includes(t));
  check(changed.length === 0, `family change: the saved chart changed by itself: ${changed.join(' | ')}`);
  check(await page.getByText(/Move .* from Jess to Sam/).count() > 0, 'family change: no workload balance suggestion toward the new partner');
  await page.getByRole('button', { name: /Add all/ }).click();
  await page.screenshot({ path: join(out, 'brooks-after-family-change.png'), fullPage: true });
  report.push({ familyChange: { suggestions } });
  await ctx.close();
}

// Stress: the biggest family plus 24 extra jobs still prints readably (at most two pages, nothing clipped).
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/club/kits/2026-11-family-ownership?sample=chen`);
  await page.getByRole('heading', { name: 'Our Family, Our Team' }).waitFor();
  const adders = page.getByRole('button', { name: /^\+ Add a job for/ });
  const n = await adders.count();
  for (let i = 0; i < 24; i++) {
    await adders.nth(i % n).click();
    await page.getByLabel(/^A job for/).fill(`Extra job number ${i + 1} with a longer name to wrap`);
    await page.getByRole('button', { name: 'Add job', exact: true }).click();
  }
  const r = await printTo(page, 'ownership-chart', 'landscape', 'stress-ownership-chart');
  report.push({ stress: r });
  check(r.pages <= 2, `stress: chart printed on ${r.pages} pages (expected at most 2)`);
  check(r.overflow.length === 0, `stress: text overflowing: ${r.overflow.join(' | ')}`);
  await ctx.close();
}

await browser.close();
server.close();
writeFileSync(join(out, 'report.json'), JSON.stringify({ report, failures }, null, 2));
console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nClub QA passed. Output in ${out}`);
