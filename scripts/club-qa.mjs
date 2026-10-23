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

async function printTo(page, doc, orientation, name, nth = 0, label = 'Print or save as PDF') {
  // The real print button, with the browser's dialog stubbed: printDocument() fits the chart and sets the page up.
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('[hidden]').evaluateAll(() => {});
  const button = page.getByRole('button', { name: label }).filter({ visible: true });
  await button.nth(nth).click();
  await page.evaluate((d) => { if (document.documentElement.dataset.clubPrint !== d) throw new Error(`printing ${document.documentElement.dataset.clubPrint}, expected ${d}`); }, doc);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))));
  const overflow = await page.evaluate((d) => {
    const root = document.querySelector(`.club-print[data-doc="${d}"]`);
    if (!root) return ['missing'];
    const wide = [...root.querySelectorAll('.club-job-title, .club-card-name, .club-sheet-row, .club-sheet-owner, .club-routine-chart-text, .club-action-text')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1);
    // A letter page is a fixed sheet: anything taller is cut off.
    const tall = [...root.querySelectorAll('.club-letter-page')].filter((el) => el.scrollHeight > el.clientHeight + 1);
    return [...wide, ...tall].map((el) => el.textContent.trim().slice(0, 40));
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

// August (letter, action, tool): one calm screen; the countdown works undated, then dates itself from the first day
// (plenty of time, three days, tomorrow, already started), keeps her own dates, saves, prints and copies; the letter
// prints front and back; "Make a routine chart" opens the site's own routine chart for a child, prefilled.
const pad = (n) => String(n).padStart(2, '0');
const dayFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
for (const id of [...samples, 'hughes']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const entry = { august: id };
  const kitUrl = `${base}/club/kits/2027-08-school-year?sample=${id}`;
  const status = () => page.locator('section[aria-labelledby="club-action"] p[role="status"]').textContent();
  const firstDay = page.locator('section[aria-labelledby="club-start"] input[type="date"]').first();
  const lines = page.locator('section[aria-labelledby="club-action"] .club-screen ol > li');
  await page.goto(kitUrl);
  await page.getByRole('heading', { name: 'When does school start?' }).waitFor();
  check(await noSideScroll(page), `${id}: August scrolls sideways on a phone`);
  check(await lines.count() === 6, `${id}: the countdown has ${await lines.count()} lines (expected 6)`);
  check(await page.getByText(/^By [A-Z][a-z]{2} \d+$/).count() === 0, `${id}: dates before a first day`);
  check(await page.locator('nav[aria-label="In this kit"]').count() === 0, `${id}: August shows tabs`);
  check(await page.getByRole('link', { name: 'November 2026' }).count() === 1, `${id}: no month switcher to November`);
  await page.screenshot({ path: join(out, `${id}-august-phone-undated.png`), fullPage: true });

  // Undated still works: check a line off and name a helper.
  await lines.first().locator('input[type="checkbox"]').check();
  await page.getByPlaceholder('Who’s helping?').first().fill('Dad');
  await page.getByText('1 of 6 done').waitFor();

  // A first day a month out: six real dates.
  await firstDay.fill(dayFromNow(30));
  await page.getByText(/^Suggested days, counting back from/).waitFor();
  check(await page.getByText(/^By [A-Z][a-z]{2} \d+$/).count() === 6, `${id}: a first day didn't date all six lines`);
  await page.screenshot({ path: join(out, `${id}-august-phone-dated.png`), fullPage: true });
  // Her own date for line 2 survives a new first day; going back to suggestions says what changes.
  await lines.nth(1).getByRole('button', { name: /^change/ }).click();
  await lines.nth(1).locator('input[type="date"]').fill(dayFromNow(4));
  await lines.nth(1).getByRole('button', { name: 'Done' }).click();
  await firstDay.fill(dayFromNow(40));
  await page.getByText('1 of 6 done').waitFor();
  check(await lines.nth(1).getByText('your date').count() === 1, `${id}: her own date was overwritten by a new first day`);
  await page.getByRole('button', { name: 'Go back to the suggested dates' }).click();
  check(await page.getByText('These dates you chose would change:').count() === 1, `${id}: no explanation before resetting dates`);
  await page.getByRole('button', { name: 'Keep my dates' }).click();
  await page.reload();
  await page.getByRole('heading', { name: 'When does school start?' }).waitFor();
  check(await firstDay.inputValue() === dayFromNow(40), `${id}: the first day didn't survive a reload`);
  check(await lines.first().locator('input[type="checkbox"]').isChecked(), `${id}: the checked line didn't survive a reload`);
  check(await page.getByPlaceholder('Who’s helping?').first().inputValue() === 'Dad', `${id}: the helper didn't survive a reload`);
  check(await lines.nth(1).getByText('your date').count() === 1, `${id}: her own date didn't survive a reload`);

  // A child who starts on another day.
  await page.getByRole('button', { name: '+ A child starts on a different day' }).click();
  // With children on the profile she picks one; without, she types a name.
  const nameField = page.getByLabel('Child’s first name');
  if (await nameField.count()) {
    await nameField.fill('Sam');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  } else {
    await page.locator('section[aria-labelledby="club-start"] .btn-secondary').first().click();
  }
  {
    await page.locator('section[aria-labelledby="club-start"] input[type="date"]').nth(1).fill(dayFromNow(45));
    await page.getByText('Dates count back from').waitFor();
    await page.locator('input[name="club-basis"]').nth(1).check();
    check(/\(/.test(await status()), `${id}: the countdown doesn't say whose first day it counts from`);
    await page.locator('input[name="club-basis"]').first().check();
  }

  // Coming fast: three days, tomorrow, already started.
  await page.getByRole('button', { name: 'Go back to the suggested dates' }).click();
  await page.getByRole('button', { name: 'Change them' }).click();
  await firstDay.fill(dayFromNow(3));
  await page.getByText(/^3 days to go/).waitFor();
  const dated = await page.getByText(/^By [A-Z][a-z]{2} \d+$/).allTextContents();
  check(dated.length === 6 && new Set(dated).size <= 3, `${id}: three days out gave ${dated.join(', ')}`);
  await page.screenshot({ path: join(out, `${id}-august-phone-three-days.png`), fullPage: true });
  await firstDay.fill(dayFromNow(1));
  await page.getByText(/^School starts tomorrow/).waitFor();
  check(await page.getByText(/^By [A-Z][a-z]{2} \d+$/).count() === 3 && await page.locator('section[aria-labelledby="club-action"] .club-screen').getByText('When you can', { exact: true }).count() === 3, `${id}: tomorrow isn't just the essentials`);
  await firstDay.fill(dayFromNow(-5));
  await page.getByText(/^School has already started/).waitFor();
  check(await page.getByRole('button', { name: 'Make a routine chart for school days' }).count() === 1, `${id}: no routine chart offer after school started`);
  await firstDay.fill(dayFromNow(30));
  await page.getByText(/^Suggested days/).waitFor();

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [doc, button, pages] of [['countdown', 'Print it', 1], ['letter', 'Print another copy', 2]]) {
    const r = await printTo(page, doc, 'portrait', `${id}-august-${doc}`, 0, button);
    entry[doc] = r;
    check(r.pages === pages, `${id}: ${doc} printed on ${r.pages} pages (expected ${pages})`);
    check(r.overflow.length === 0, `${id}: ${doc} has text cut off: ${r.overflow.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  const holder = await page.evaluate(() => document.querySelector('.club-letter-greeting')?.textContent);
  entry.greeting = holder;
  check(/^Hi [A-Z][a-z]+,$/.test(holder ?? ''), `${id}: the letter greets "${holder}", not her name`);
  check(await page.evaluate(() => [...document.querySelectorAll('.club-letter .club-action-when .club-action-helper-line')].every((el) => !el.textContent)), `${id}: the mailed letter prints dates`);
  check(await page.evaluate(() => [...document.querySelectorAll('.club-action-sheet .club-action-when .club-action-helper-line')].filter((el) => el.textContent).length === 6), `${id}: the countdown printout is missing dates`);

  // The tool: the site's own routine chart, opened in the Club for a child, prefilled, editable, downloadable.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Make a routine chart', exact: true }).click();
  // Several children: pick one (after school); one child opens straight away; none opens it as any visitor sees it.
  await page.waitForTimeout(300);
  const chooser = page.locator('section[aria-labelledby="club-tool"] .btn-secondary');
  const kidCount = /\/club\/tools\//.test(page.url()) ? 0 : await chooser.count();
  if (kidCount) {
    await page.locator('section[aria-labelledby="club-tool"]').getByRole('button', { name: 'After school' }).click();
    await chooser.first().click();
  }
  await page.waitForURL(/\/club\/tools\/routine-chart/);
  await page.waitForSelector('#routine-chart');
  const title = await page.inputValue('[data-field="title"]');
  entry.routineTitle = title;
  check(kidCount ? /’s After-School Routine$/.test(title) : /Routine$/.test(title), `${id}: the routine chart didn't open for the child: "${title}"`);
  check(await page.locator('.mr-container[data-mr-handoff]').count() === 1, `${id}: the Club page isn't the site's routine chart`);
  check(await noSideScroll(page), `${id}: the routine chart scrolls sideways on a phone`);
  await page.screenshot({ path: join(out, `${id}-august-routine-phone.png`), fullPage: true });
  await page.locator('[data-mr-move="1"]').first().click();
  const order = await page.$$eval('[data-mr-step]', (els) => els.map((e) => e.value));
  await page.reload();
  await page.waitForSelector('#routine-chart');
  check(JSON.stringify(await page.$$eval('[data-mr-step]', (els) => els.map((e) => e.value))) === JSON.stringify(order), `${id}: the routine chart didn't keep her edits`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-mr-download]')]);
  entry.routineDownload = dl.suggestedFilename();
  await dl.saveAs(join(out, `${id}-august-routine.png`));
  await page.getByRole('link', { name: /^← Back to/ }).click();
  await page.waitForURL(/\/club\/kits\//);

  // Same family, same profile: November still opens from the switcher.
  await page.goto(kitUrl);
  await page.getByRole('link', { name: 'November 2026' }).click();
  await page.getByRole('heading', { name: 'Our Family, Our Team' }).waitFor();
  check(errors.length === 0, `${id}: August page errors: ${errors.join(' | ')}`);
  report.push(entry);
  await ctx.close();
}

// October (letter, five-line reset, the site's chore chart): no dates anywhere; checks, helpers and her wording save;
// her copy and the letter print; "Make a Family Chore Chart" opens the site's own chart for a child, prefilled.
for (const id of [...samples, 'hughes']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const entry = { october: id };
  const kitUrl = `${base}/club/kits/2027-10-home-works-together?sample=${id}`;
  const lines = page.locator('section[aria-labelledby="club-action"] .club-screen ol > li');
  await page.goto(kitUrl);
  await page.getByRole('heading', { name: 'Our Fall Home Reset' }).waitFor();
  check(await noSideScroll(page), `${id}: October scrolls sideways on a phone`);
  check(await lines.count() === 5, `${id}: the reset has ${await lines.count()} lines (expected 5)`);
  check(await page.locator('section[aria-labelledby="club-start"], input[type="date"]').count() === 0, `${id}: October asks for dates`);
  check(await page.getByText(/^By [A-Z][a-z]{2} \d+$/).count() === 0, `${id}: October shows due dates`);
  await page.screenshot({ path: join(out, `${id}-october-phone.png`), fullPage: true });

  await lines.first().locator('input[type="checkbox"]').check();
  await page.getByPlaceholder('Who’s helping?').first().fill('Dad');
  await lines.nth(1).getByRole('button', { name: /^reword/ }).click();
  await lines.nth(1).locator('input[type="text"]').first().fill('Set up the mudroom for coats and boots.');
  await lines.nth(1).getByRole('button', { name: 'Done' }).click();
  await page.getByText('1 of 5 done').waitFor();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole('heading', { name: 'Our Fall Home Reset' }).waitFor();
  check(await lines.first().locator('input[type="checkbox"]').isChecked(), `${id}: the checked line didn't survive a reload`);
  check(await page.getByPlaceholder('Who’s helping?').first().inputValue() === 'Dad', `${id}: the helper didn't survive a reload`);
  check(await lines.nth(1).locator('label > span').textContent() === 'Set up the mudroom for coats and boots.', `${id}: her wording didn't survive a reload`);

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [doc, button, pages] of [['fall-reset', 'Print it', 1], ['letter', 'Print another copy', 2]]) {
    const r = await printTo(page, doc, 'portrait', `${id}-october-${doc}`, 0, button);
    entry[doc] = r;
    check(r.pages === pages, `${id}: October ${doc} printed on ${r.pages} pages (expected ${pages})`);
    check(r.overflow.length === 0, `${id}: October ${doc} has text cut off: ${r.overflow.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  const sheet = await page.evaluate(() => document.querySelector('.club-action-sheet')?.textContent ?? '');
  check(sheet.includes('Dad') && sheet.includes('Set up the mudroom'), `${id}: her printout is missing her helper or wording`);
  const mailed = await page.evaluate(() => document.querySelector('.club-letter .club-action')?.textContent ?? '');
  check(!mailed.includes('Dad') && !mailed.includes('mudroom') && mailed.includes('Get the entryway ready'), `${id}: the mailed letter shows her own entries`);
  check(await page.evaluate(() => document.querySelectorAll('.club-letter .club-action-when').length === 0), `${id}: the October letter prints "By" blanks`);
  entry.greeting = await page.evaluate(() => document.querySelector('.club-letter-greeting')?.textContent);

  // The tool: the site's own chore chart, opened in the Club for a child, prefilled, downloadable.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Make a Family Chore Chart', exact: true }).click();
  await page.waitForTimeout(300);
  const chooser = page.locator('section[aria-labelledby="club-tool"] .btn-secondary');
  const kidCount = /\/club\/tools\//.test(page.url()) ? 0 : await chooser.count();
  const kidName = kidCount ? (await chooser.first().textContent()).replace(/\d+/g, '').trim() : null;
  if (kidCount) await chooser.first().click();
  await page.waitForURL(/\/club\/tools\/chore-chart/);
  await page.waitForSelector('#chore-chart');
  const name = await page.inputValue('[data-cc-name]');
  const jobs = await page.$$eval('#chore-chart .cc-chore, #chore-chart .cc-reward-text', (els) => els.map((e) => e.value).filter(Boolean));
  entry.choreChart = { name, age: await page.inputValue('[data-cc-age]'), jobs };
  check(jobs.length === 1, `${id}: the chore chart opened with ${jobs.length} jobs and rewards, not one job (${jobs.join(', ')})`);
  check(await page.locator('.chore-chart-container[data-cc-handoff]').count() === 1, `${id}: the Club page isn't the site's chore chart`);
  check(kidName ? name.toLowerCase() === kidName.toLowerCase() : Boolean(name), `${id}: the chore chart didn't open for ${kidName ?? 'the one person'}: "${name}"`);
  check(await noSideScroll(page), `${id}: the chore chart scrolls sideways on a phone`);
  await page.screenshot({ path: join(out, `${id}-october-chore-phone.png`), fullPage: true });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-cc-download]')]);
  entry.choreDownload = dl.suggestedFilename();
  check(await page.locator('dialog.tool-email-dialog').count() === 0, `${id}: the Club chore chart asked for an email`);
  await dl.saveAs(join(out, `${id}-october-chore.png`));
  await page.getByRole('link', { name: /^← Back to/ }).click();
  await page.waitForURL(/\/club\/kits\//);
  check(errors.length === 0, `${id}: October page errors: ${errors.join(' | ')}`);
  report.push(entry);
  await ctx.close();
}

// December (letter, five-decision Christmas plan, the traditions picker): no dates; checks, helpers and her wording
// save; her copy and the letter print; "Find Our Christmas Traditions" opens the picker with the children's ages.
const decUrl = (id) => `${base}/club/kits/2027-12-christmas-family-affair?sample=${id}`;
const cardNames = (page) => page.locator('.tp-card .tp-card-name').allTextContents();
for (const id of [...samples, 'hughes']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const entry = { december: id };
  const lines = page.locator('section[aria-labelledby="club-action"] .club-screen ol > li');
  await page.goto(decUrl(id));
  await page.getByRole('heading', { name: 'Our Family Christmas Plan' }).waitFor();
  check(await noSideScroll(page), `${id}: December scrolls sideways on a phone`);
  check(await lines.count() === 5, `${id}: the plan has ${await lines.count()} lines (expected 5)`);
  check(await page.locator('section[aria-labelledby="club-start"], input[type="date"]').count() === 0, `${id}: December asks for dates`);
  check(await page.locator('.club-screen').getByText(/^Already made your plans\?/).count() === 1, `${id}: December is missing the already-planned note`);
  check(await page.getByText('Pick two or three Christmas traditions your family really wants to enjoy.').count() >= 1, `${id}: the plan's detail lines are missing`);
  check(await page.getByRole('button', { name: 'Read this month’s letter' }).count() === 1, `${id}: no "Read this month's letter" link`);
  await page.screenshot({ path: join(out, `${id}-december-phone.png`), fullPage: true });

  await lines.first().locator('input[type="checkbox"]').check();
  await page.getByPlaceholder('Who’s helping?').nth(2).fill('Grandma');
  await lines.nth(3).getByRole('button', { name: /^reword/ }).click();
  await lines.nth(3).locator('input[type="text"]').first().fill('Bake for the church food pantry.');
  await lines.nth(3).getByRole('button', { name: 'Done' }).click();
  await page.getByText('1 of 5 done').waitFor();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole('heading', { name: 'Our Family Christmas Plan' }).waitFor();
  check(await lines.first().locator('input[type="checkbox"]').isChecked(), `${id}: the checked decision didn't survive a reload`);
  check(await page.getByPlaceholder('Who’s helping?').nth(2).inputValue() === 'Grandma', `${id}: the helper didn't survive a reload`);
  check((await lines.nth(3).locator('label > span').textContent()) === 'Bake for the church food pantry.', `${id}: her wording didn't survive a reload (or kept our detail)`);

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [doc, button, pages] of [['christmas-plan', 'Print it', 1], ['letter', 'Print another copy', 2]]) {
    const r = await printTo(page, doc, 'portrait', `${id}-december-${doc}`, 0, button);
    entry[doc] = r;
    check(r.pages === pages, `${id}: December ${doc} printed on ${r.pages} pages (expected ${pages})`);
    check(r.overflow.length === 0, `${id}: December ${doc} has text cut off: ${r.overflow.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  const sheet = await page.evaluate(() => document.querySelector('.club-action-sheet')?.textContent ?? '');
  check(sheet.includes('Grandma') && sheet.includes('church food pantry'), `${id}: her printout is missing her helper or wording`);
  const mailed = await page.evaluate(() => document.querySelector('.club-letter .club-action')?.textContent ?? '');
  check(!mailed.includes('Grandma') && !mailed.includes('food pantry') && mailed.includes('Choose one way to give together.'), `${id}: the mailed letter shows her own entries`);
  check(await page.evaluate(() => document.querySelectorAll('.club-letter .club-action-when').length === 0), `${id}: the December letter prints "By" blanks`);
  check(await page.evaluate(() => document.querySelectorAll('.club-letter .club-sprig').length === 2 && document.querySelector('.club-letter')?.dataset.accent === 'evergreen'), `${id}: the December letter is missing its evergreen touch`);
  const back = await page.evaluate(() => document.querySelectorAll('.club-letter-page')[1]?.textContent ?? '');
  for (const part of ['Making Christmas Together', 'Choose what matters.', 'Share the preparations.', 'Leave room to enjoy it.', 'What’s one thing we could each do to make Christmas special for someone else?', 'Find Your Family’s Christmas Traditions', 'organizedmomcollective.com/club/kits/2027-12-christmas-family-affair', 'Leave some open space, too.']) {
    check(back.includes(part), `${id}: the letter's back is missing "${part}"`);
  }
  entry.greeting = await page.evaluate(() => document.querySelector('.club-letter-greeting')?.textContent);

  // The tool: the traditions picker, for the whole family, with the children's ages from the profile.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Find Our Christmas Traditions', exact: true }).click();
  await page.waitForURL(/\/club\/tools\/traditions-picker/);
  await page.locator('.tp-card').nth(2).waitFor();
  check(await page.locator('.tp[data-tp-handoff]').count() === 1, `${id}: the Club page isn't the site's traditions picker`);
  check(await page.locator('.tp-card').count() === 3, `${id}: the picker shows ${await page.locator('.tp-card').count()} ideas (expected 3)`);
  const agesNote = await page.locator('[data-tp-ages-note]').textContent();
  check(id === 'hughes' ? /Tap any/.test(agesNote) : /^From your family profile: \d/.test(agesNote), `${id}: the picker's ages: "${agesNote}"`);
  check(await page.getByText('Three meaningful traditions are better than twenty things you feel obligated to do.').count() >= 1, `${id}: the picker is missing the fewer-is-better reminder`);
  check(await noSideScroll(page), `${id}: the picker scrolls sideways on a phone`);
  const first = await cardNames(page);
  entry.traditions = { ages: agesNote, first, kids: await page.locator('.tp-card [data-tp-kids]').allTextContents() };
  await page.screenshot({ path: join(out, `${id}-december-picker-phone.png`), fullPage: true });

  // Time and budget change the ideas; every meta stays within them.
  await page.getByRole('button', { name: 'Half a day' }).click();
  await page.getByRole('button', { name: 'Flexible', exact: true }).click();
  const big = await cardNames(page);
  await page.getByRole('button', { name: '15–30 minutes' }).click();
  await page.getByRole('button', { name: 'Free', exact: true }).click();
  const small = await cardNames(page);
  const smallMeta = await page.locator('.tp-card [data-tp-meta]').allTextContents();
  check(big.join() !== small.join(), `${id}: time and budget didn't change the ideas (${big.join(', ')})`);
  check(smallMeta.every((m) => /minutes/.test(m) && /Free$/.test(m)), `${id}: a short, free search suggested ${smallMeta.join(' | ')}`);
  entry.traditions.halfDayFlexible = big;
  entry.traditions.shortFree = small;
  await page.getByRole('button', { name: 'About an hour' }).click();
  await page.getByRole('button', { name: 'Under $25' }).click();

  // Swap one, keep two, reload: still there; the printout has the two.
  const before = await cardNames(page);
  await page.locator('.tp-card').nth(1).getByRole('button', { name: /^Swap/ }).click();
  const swapped = await cardNames(page);
  check(swapped[1] !== before[1] && swapped[0] === before[0] && swapped[2] === before[2] && !before.includes(swapped[1]), `${id}: swapping didn't replace just that idea (${before.join(', ')} → ${swapped.join(', ')})`);
  await page.locator('.tp-card').nth(0).getByRole('checkbox').check();
  await page.locator('.tp-card').nth(2).getByRole('checkbox').check();
  await page.reload();
  await page.locator('.tp-card').nth(2).waitFor();
  const kept = await page.locator('.tp-card.is-kept .tp-card-name').allTextContents();
  check(kept.length === 2 && kept[0] === swapped[0] && kept[1] === swapped[2], `${id}: kept ideas didn't survive a reload (${kept.join(', ')})`);
  check(await page.locator('.tp-card.is-kept [data-tp-swap]:not([hidden])').count() === 0, `${id}: a kept idea can still be swapped`);
  const printed = await page.locator('.tp-sheet-item .tp-sheet-name').allTextContents();
  check(printed.join() === kept.join(), `${id}: the printout shows ${printed.join(', ')}, not the kept ${kept.join(', ')}`);
  check((await page.locator('.tp-sheet-num').allTextContents()).join() === '1,2', `${id}: the printout isn't numbered 1, 2`);
  const family = (await page.locator('[data-tp-sheet-family]').textContent()).trim();
  check(id === 'hughes' ? family === 'The Hughes family' : family.length > 0, `${id}: the printout's family name is "${family}"`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-tp-download]')]);
  entry.traditionsDownload = dl.suggestedFilename();
  await dl.saveAs(join(out, `${id}-december-traditions.png`));
  check(await page.locator('dialog.tool-email-dialog').count() === 0, `${id}: the picker asked for an email`);
  await page.click('[data-tp-copy]');
  await page.waitForTimeout(200);
  const copied = await page.locator('[data-tp-status]').textContent();
  const fallback = await page.locator('[data-tp-copy-fallback]').inputValue();
  check(/^Copied/.test(copied) || (fallback.includes(kept[0]) && fallback.includes('Three meaningful traditions')), `${id}: copying didn't work ("${copied}")`);
  await page.locator('.tp-sheet').screenshot({ path: join(out, `${id}-december-traditions-sheet.png`) });
  await page.getByRole('link', { name: /^← Back to/ }).click();
  await page.waitForURL(/\/club\/kits\/2027-12/);
  check(errors.length === 0, `${id}: December page errors: ${errors.join(' | ')}`);
  report.push(entry);
  await ctx.close();
}

{
  const first = (id) => report.find((e) => e.december === id)?.traditions.first.join();
  check(first('okafor') !== first('brooks'), `December: a toddler family and a school-age family got the same ideas (${first('okafor')})`);
}

// A family that's already done most of Christmas, opening the kit mid-December: still useful, nothing overdue.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2027-12-15T19:00:00'));
  await page.goto(decUrl('chen'));
  await page.getByRole('heading', { name: 'Our Family Christmas Plan' }).waitFor();
  const lines = page.locator('section[aria-labelledby="club-action"] .club-screen ol > li');
  for (const [i, who] of [[0, 'Everyone'], [1, 'Mei'], [2, 'David']]) {
    await lines.nth(i).locator('input[type="checkbox"]').check();
    await page.getByPlaceholder('Who’s helping?').nth(i).fill(who);
  }
  await page.getByText('3 of 5 done').waitFor();
  const text = await page.locator('main').textContent();
  check(!/overdue|too late|missed|already passed|deadline/i.test(text), 'mid-December: the kit reads as late or overdue');
  check(/Already made your plans\? Use this as a quick family check-in\./.test(text), 'mid-December: no check-in note for a family already planned');
  await page.screenshot({ path: join(out, 'chen-december-mid-month.png'), fullPage: true });
  await page.getByRole('button', { name: 'Find Our Christmas Traditions', exact: true }).click();
  await page.locator('.tp-card').nth(2).waitFor();
  report.push({ midDecember: { done: 3, picker: await cardNames(page) } });
  await ctx.close();
}

// No family profile at all: the picker still works on its own, with defaults and no handoff.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/club/tools/traditions-picker?sample=new`);
  await page.locator('.tp-card').nth(2).waitFor();
  check(/Tap any/.test(await page.locator('[data-tp-ages-note]').textContent()), 'no profile: the picker claims ages from a profile');
  await page.getByRole('button', { name: 'Under 5' }).click();
  const toddler = await page.locator('.tp-card [data-tp-kids]').allTextContents();
  report.push({ noProfile: { names: await cardNames(page), kids: toddler } });
  check(toddler.length === 3, 'no profile: picking an age broke the ideas');
  await ctx.close();
}

// Two families in one browser, December: one family's kept traditions never show in the other's picker.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(decUrl('rivera'));
  await page.getByRole('button', { name: 'Find Our Christmas Traditions', exact: true }).click();
  await page.locator('.tp-card').nth(2).waitFor();
  await page.locator('.tp-card').nth(0).getByRole('checkbox').check();
  await page.locator('[data-tp-family]').fill('Rivera Party of Five');
  const riveraNote = await page.locator('[data-tp-ages-note]').textContent();
  await page.goto(decUrl('okafor'));
  await page.getByRole('button', { name: 'Find Our Christmas Traditions', exact: true }).click();
  await page.locator('.tp-card').nth(2).waitFor();
  check(await page.locator('.tp-card.is-kept').count() === 0, 'leak: Rivera’s kept tradition shows in the Okafors’ picker');
  check((await page.locator('[data-tp-sheet-family]').textContent()).trim() === 'The Okafors', 'leak: the Okafors’ printout has another family’s name');
  check(await page.locator('[data-tp-ages-note]').textContent() !== riveraNote, 'leak: the Okafors’ picker has Rivera’s ages');
  await page.goto(`${base}/club/tools/traditions-picker?sample=okafor`);
  await page.locator('.tp-card').nth(2).waitFor();
  check(await page.locator('.tp-card.is-kept').count() === 0 && !(await page.locator('[data-tp-sheet-family]').textContent()).includes('Rivera'), 'leak: the picker opened from its address carries a family over');
  report.push({ decemberLeakCheck: 'ok' });
  await ctx.close();
}

// January (letter, One-Thing Family Reset, the Family Habit Builder): the one thing, plan and start day save; the
// plan and the letter print; "Build Our Family Habit" opens the builder with the family's names and its one thing.
const janUrl = (id) => `${base}/club/kits/2027-01-fresh-start-together?sample=${id}`;
const janLines = (page) => page.locator('section[aria-labelledby="club-action"] .club-screen ol > li');
const janCustom = { brooks: { thing: 'Laundry on the bedroom floor', action: 'put dirty clothes in the hamper' } };
for (const id of [...samples, 'hughes']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const entry = { january: id };
  const custom = janCustom[id];
  const lines = janLines(page);
  await page.goto(janUrl(id));
  await page.getByRole('heading', { name: 'Our One-Thing Family Reset' }).waitFor();
  check(await noSideScroll(page), `${id}: January scrolls sideways on a phone`);
  check(await lines.count() === 5, `${id}: the reset has ${await lines.count()} steps (expected 5)`);
  check(await page.getByPlaceholder('Who’s helping?').count() === 0, `${id}: January asks who's helping on every step`);
  check(await page.locator('section[aria-labelledby="club-action"] input[type="date"]').count() === 1, `${id}: January should have exactly one (optional) date: the start day`);
  check(await page.getByText(/^By [A-Z][a-z]{2} \d+$/).count() === 0, `${id}: January shows due dates`);
  await page.screenshot({ path: join(out, `${id}-january-phone.png`), fullPage: true });

  const thing = page.getByLabel('What is your family’s one thing?');
  if (custom) await thing.fill(custom.thing);
  else await page.getByRole('group', { name: 'Ideas for your one thing' }).getByRole('button', { name: 'Keeping the kitchen tidy' }).click();
  const planText = id === 'chen' ? 'After dinner, everyone spends five minutes resetting the kitchen. Grace clears, Owen wipes the table, Ivy puts cups away, Leo stacks the placemats.' : 'After dinner, everyone spends five minutes resetting the kitchen.';
  await page.getByLabel('Our simpler plan').fill(planText);
  await page.getByLabel('Start day (optional)').fill('2027-01-10');
  await lines.first().locator('input[type="checkbox"]').check();
  await page.getByText('1 of 5 done').waitFor();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole('heading', { name: 'Our One-Thing Family Reset' }).waitFor();
  const want = custom ? custom.thing : 'Keeping the kitchen tidy';
  check(await thing.inputValue() === want, `${id}: the one thing didn't survive a reload ("${await thing.inputValue()}")`);
  check(await page.getByLabel('Our simpler plan').inputValue() === planText, `${id}: the plan didn't survive a reload`);
  check(await page.getByLabel('Start day (optional)').inputValue() === '2027-01-10', `${id}: the start day didn't survive a reload`);
  check(await page.getByText('Check in together Sunday, January 17.').count() === 1, `${id}: no check-in a week after the start`);
  check(await lines.first().locator('input[type="checkbox"]').isChecked(), `${id}: the checked step didn't survive a reload`);
  if (!custom) check(await page.getByRole('button', { name: 'Keeping the kitchen tidy' }).getAttribute('aria-pressed') === 'true', `${id}: the chosen suggestion isn't marked`);

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [doc, button, pages] of [['one-thing-plan', 'Print it', 1], ['letter', 'Print another copy', 2]]) {
    const r = await printTo(page, doc, 'portrait', `${id}-january-${doc}`, 0, button);
    entry[doc] = r;
    check(r.pages === pages, `${id}: January ${doc} printed on ${r.pages} pages (expected ${pages})`);
    check(r.overflow.length === 0, `${id}: January ${doc} has text cut off: ${r.overflow.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  check(await page.evaluate(() => [...document.querySelectorAll('.club-action-sheet .club-focus-line .club-action-helper-line')].every((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)), `${id}: her one thing or plan is cut off on her printout`);
  const sheet = await page.evaluate(() => document.querySelector('.club-action-sheet')?.textContent ?? '');
  check(sheet.includes(want) && sheet.includes('resetting the kitchen') && sheet.includes('Sunday, January 10') && sheet.includes('Sunday, January 17'), `${id}: her printed plan is missing her one thing, plan or days`);
  const front = await page.evaluate(() => document.querySelector('.club-letter .club-letter-page')?.textContent ?? '');
  check(front.includes('Our one thing this month') && !front.includes(want) && front.includes('Try it for seven days.'), `${id}: the mailed letter's front is wrong (one-thing blank, five steps)`);
  const back = await page.evaluate(() => document.querySelectorAll('.club-letter-page')[1]?.textContent ?? '');
  for (const part of ['Small Changes That Stick', 'Start with something small.', 'Connect it to something you already do.', 'Let everyone play a part.', 'The kitchen after dinner', 'What’s one part of our day that we could make easier for everyone?', 'Build Your Family Habit', 'organizedmomcollective.com/club/kits/2027-01-fresh-start-together', 'Write both on your family calendar.']) {
    check(back.includes(part), `${id}: the letter's back is missing "${part}"`);
  }
  entry.greeting = await page.evaluate(() => document.querySelector('.club-letter-greeting')?.textContent);

  // The tool: the habit builder, with the family's names, its one thing and start day.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Build Our Family Habit', exact: true }).click();
  await page.waitForURL(/\/club\/tools\/habit-builder/);
  const statement = page.locator('[data-hb-statement]');
  await statement.waitFor();
  check(await page.locator('.hb[data-hb-handoff]').count() === 1, `${id}: the Club page isn't the site's habit builder`);
  check(await page.locator('[data-hb-start]').inputValue() === '2027-01-10', `${id}: the builder didn't get the start day`);
  const days = await page.locator('[data-hb-day]').allTextContents();
  check(days.length === 7 && days[0] === 'Sun 1/10' && days[6] === 'Sat 1/16', `${id}: the practice days are ${days.join(', ')}`);
  if (custom) {
    check(await page.locator('[data-hb-area="other"]').getAttribute('aria-pressed') === 'true' && await page.locator('[data-hb-other-label]').inputValue() === custom.thing, `${id}: the builder didn't open on her own one thing`);
    await page.locator('[data-hb-other-action]').fill(custom.action);
    check(await statement.inputValue() === 'After dinner, everyone puts dirty clothes in the hamper.', `${id}: custom habit reads "${await statement.inputValue()}"`);
  } else {
    check(await page.locator('[data-hb-area="kitchen"]').getAttribute('aria-pressed') === 'true', `${id}: the builder didn't open on the kitchen`);
    check(await statement.inputValue() === 'After dinner, everyone spends five minutes resetting the kitchen.', `${id}: the habit reads "${await statement.inputValue()}"`);
  }
  // A different moment changes the sentence.
  await page.locator('[data-hb-moment="before-bed"]').click();
  check((await statement.inputValue()).startsWith('Before bedtime, everyone'), `${id}: the moment didn't change the habit`);
  // Who: the family's own first names.
  await page.locator('[data-hb-who="some"]').click();
  const people = await page.locator('[data-hb-person]').evaluateAll((els) => els.map((e) => e.value));
  entry.people = people;
  check(people.length >= 1, `${id}: no family names to choose from`);
  await page.locator('[data-hb-person]').first().check();
  if (people.length > 1) await page.locator('[data-hb-person]').nth(1).check();
  const picked = people.slice(0, 2);
  check(picked.every((n) => (statement.inputValue ? true : false)) && (await statement.inputValue()).includes(picked[0]), `${id}: chosen names aren't in the habit ("${await statement.inputValue()}")`);
  entry.habit = await statement.inputValue();
  // Her own words stay through a reload and a changed answer; ours come back on request.
  await statement.fill('Before bed, we all spend five minutes getting tomorrow ready.');
  await page.locator('[data-hb-moment="after-dinner"]').click();
  await page.reload();
  await statement.waitFor();
  check(await statement.inputValue() === 'Before bed, we all spend five minutes getting tomorrow ready.', `${id}: her own words didn't stay`);
  check(await page.locator('[data-hb-sheet-statement]').textContent() === 'Before bed, we all spend five minutes getting tomorrow ready.', `${id}: the card doesn't show her words`);
  check(await page.locator('.hb-sheet-box').count() === 7, `${id}: the card has ${await page.locator('.hb-sheet-box').count()} practice boxes`);
  const card = await page.locator('[data-hb-sheet]').textContent();
  check(card.includes('Did this make our day easier? What should we change?') && !/streak|points|badge|reward/i.test(card), `${id}: the card's reflection or no-scoring rule is off`);
  check(await noSideScroll(page), `${id}: the builder scrolls sideways on a phone`);
  await page.screenshot({ path: join(out, `${id}-january-builder-phone.png`), fullPage: true });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-hb-download]')]);
  await dl.saveAs(join(out, `${id}-january-card.png`));
  check(await page.locator('dialog.tool-email-dialog').count() === 0, `${id}: the builder asked for an email`);
  await page.getByRole('button', { name: 'Use the suggested wording' }).click();
  entry.suggestedAgain = await statement.inputValue();
  check(entry.suggestedAgain.startsWith('After dinner,'), `${id}: "Use the suggested wording" gave "${entry.suggestedAgain}"`);
  await page.click('[data-hb-copy]');
  await page.waitForTimeout(200);
  const copied = await page.locator('[data-hb-status]').textContent();
  const fallback = await page.locator('[data-hb-copy-fallback]').inputValue();
  check(/^Copied/.test(copied) || fallback.includes('Did this make our day easier?'), `${id}: copying the habit didn't work`);
  await page.getByRole('link', { name: /^← Back to/ }).click();
  await page.waitForURL(/\/club\/kits\/2027-01/);
  check(errors.length === 0, `${id}: January page errors: ${errors.join(' | ')}`);
  report.push(entry);
  await ctx.close();
}

// Opened in March 2027 (a late joiner, or a look back): no deadlines, the start day still works.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2027-03-15T19:00:00'));
  await page.goto(janUrl('chen'));
  await page.getByRole('heading', { name: 'Our One-Thing Family Reset' }).waitFor();
  await page.getByLabel('Start day (optional)').fill('2027-03-16');
  check(await page.getByText('Check in together Tuesday, March 23.').count() === 1, 'late January: the check-in date is wrong');
  check(!/overdue|too late|missed|deadline/i.test(await page.locator('main').textContent()), 'late January: the kit reads as late');
  report.push({ lateJanuary: 'ok' });
  await ctx.close();
}

// No family profile: the builder works on its own, with typed names.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/club/tools/habit-builder?sample=new`);
  const statement = page.locator('[data-hb-statement]');
  await statement.waitFor();
  check(await statement.inputValue() === 'After dinner, everyone spends five minutes resetting the kitchen.', 'no profile: the builder doesn’t open with an example habit');
  await page.locator('[data-hb-area="out-the-door"]').click();
  await page.locator('[data-hb-who="some"]').click();
  check(await page.locator('[data-hb-person]').count() === 0, 'no profile: the builder shows names it can’t know');
  await page.locator('[data-hb-names-text]').fill('Sam and Ruby');
  report.push({ habitNoProfile: await statement.inputValue() });
  check(await statement.inputValue() === 'Before bedtime, Sam and Ruby put shoes, coats and bags by the door.', `no profile: typed names give "${await statement.inputValue()}"`);
  await ctx.close();
}

// Two families in one browser, January: one family's habit and names never show up in the other's.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(janUrl('rivera'));
  await page.getByRole('button', { name: 'Build Our Family Habit', exact: true }).click();
  await page.locator('[data-hb-statement]').fill('Rivera rule: shoes off at the door.');
  await page.goto(janUrl('okafor'));
  await page.getByRole('button', { name: 'Build Our Family Habit', exact: true }).click();
  await page.locator('[data-hb-statement]').waitFor();
  check(!(await page.locator('[data-hb-statement]').inputValue()).includes('Rivera'), 'leak: Rivera’s habit shows in the Okafors’ builder');
  await page.locator('[data-hb-who="some"]').click();
  const names = await page.locator('[data-hb-person]').evaluateAll((els) => els.map((e) => e.value));
  check(!names.includes('Ana') && names.includes('Zara'), `leak: the Okafors’ builder lists ${names.join(', ')}`);
  await page.goto(janUrl('rivera'));
  await page.getByRole('heading', { name: 'Our One-Thing Family Reset' }).waitFor();
  check(await page.getByLabel('What is your family’s one thing?').inputValue() === '', 'leak: a one thing appeared in a family that never chose one');
  report.push({ januaryLeakCheck: 'ok' });
  await ctx.close();
}

// February (letter, three-part connection challenge, the Family Connection Planner): ideas per line save; the challenge
// and the letter print; "Find Something to Do Together" opens the planner with the children's ages and first names.
const febUrl = (id) => `${base}/club/kits/2027-02-better-together?sample=${id}`;
const cnNames = (page) => page.locator('.cn-card .cn-card-name').allTextContents();
const YOUNG_ONLY = ['Kitchen dance party', 'Read together', 'Five-minute bedtime chat'];
for (const id of [...samples, 'hughes']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const entry = { february: id };
  const lines = page.locator('section[aria-labelledby="club-action"] .club-screen ol > li');
  await page.goto(febUrl(id));
  await page.getByRole('heading', { name: 'Our Family Connection Challenge' }).waitFor();
  check(await noSideScroll(page), `${id}: February scrolls sideways on a phone`);
  check(await lines.count() === 3, `${id}: the challenge has ${await lines.count()} actions (expected 3)`);
  check(await page.getByPlaceholder('Our idea (optional)').count() === 3, `${id}: February is missing its "Our idea" lines`);
  check(await page.locator('section[aria-labelledby="club-action"] input[type="date"]').count() === 0, `${id}: February asks for dates`);
  await page.screenshot({ path: join(out, `${id}-february-phone.png`), fullPage: true });

  await page.getByPlaceholder('Our idea (optional)').first().fill('Friday pizza and board games');
  await lines.first().locator('input[type="checkbox"]').check();
  await page.getByText('1 of 3 done').waitFor();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole('heading', { name: 'Our Family Connection Challenge' }).waitFor();
  check(await page.getByPlaceholder('Our idea (optional)').first().inputValue() === 'Friday pizza and board games', `${id}: the idea didn't survive a reload`);
  check(await lines.first().locator('input[type="checkbox"]').isChecked(), `${id}: the checked action didn't survive a reload`);

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [doc, button, pages] of [['connection-challenge', 'Print it', 1], ['letter', 'Print another copy', 2]]) {
    const r = await printTo(page, doc, 'portrait', `${id}-february-${doc}`, 0, button);
    entry[doc] = r;
    check(r.pages === pages, `${id}: February ${doc} printed on ${r.pages} pages (expected ${pages})`);
    check(r.overflow.length === 0, `${id}: February ${doc} has text cut off: ${r.overflow.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  const sheet = await page.evaluate(() => document.querySelector('.club-action-sheet')?.textContent ?? '');
  check(sheet.includes('Friday pizza and board games'), `${id}: her printout is missing her idea`);
  const front = await page.evaluate(() => document.querySelector('.club-letter .club-letter-page')?.textContent ?? '');
  check(!front.includes('Friday pizza') && front.includes('Make a shared space more inviting.') && (front.match(/Our idea/g) ?? []).length === 3, `${id}: the mailed letter's challenge is wrong`);
  check(await page.evaluate(() => { const h = [...document.querySelectorAll('.club-letter .club-heart')]; return h.length === 2 && h.every((x) => parseFloat(getComputedStyle(x).height) > 15 || getComputedStyle(x).flexShrink === '0'); }), `${id}: the letter's heart is missing or squashed`);
  const back = await page.evaluate(() => document.querySelectorAll('.club-letter-page')[1]?.textContent ?? '');
  for (const part of ['Make Room for Connection', 'Make ordinary moments count.', 'Let everyone contribute.', 'Keep it simple enough to repeat.', 'What’s something that made you laugh this week?', 'What’s one thing you appreciate about someone in our family?', 'Family Connection Planner', 'Find simple activities that fit your family’s ages, time, and budget.', 'organizedmomcollective.com/club/kits/2027-02-better-together', 'let everyone help make it happen.']) {
    check(back.includes(part), `${id}: the letter's back is missing "${part}"`);
  }
  check((back.match(/do together more often/g) ?? []).length === 1, `${id}: the letter's question repeats on the back`);
  entry.greeting = await page.evaluate(() => document.querySelector('.club-letter-greeting')?.textContent);

  // The tool: the connection planner, with the family's ages and first names.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Find Something to Do Together', exact: true }).click();
  await page.waitForURL(/\/club\/tools\/connection-planner/);
  await page.locator('.cn-card').nth(2).waitFor();
  check(await page.locator('.cn[data-cn-handoff]').count() === 1, `${id}: the Club page isn't the site's connection planner`);
  const agesNote = await page.locator('[data-cn-ages-note]').textContent();
  check(id === 'hughes' ? /Tap any/.test(agesNote) : /^From your family profile: \d/.test(agesNote), `${id}: the planner's ages: "${agesNote}"`);
  const slots = await page.locator('.cn-card [data-cn-slot]').allTextContents();
  check(slots.join() === 'Family moment,One-on-one moment,Simple connection rhythm', `${id}: the three ideas are ${slots.join(', ')}`);
  check(await page.locator('[data-cn-plan]').isHidden(), `${id}: a plan shows before anything is chosen`);
  entry.ideas = { ages: agesNote, first: await cnNames(page) };
  await page.screenshot({ path: join(out, `${id}-february-planner-phone.png`), fullPage: true });

  // Time and budget change the ideas.
  await page.getByRole('button', { name: 'About an hour' }).click();
  await page.getByRole('button', { name: 'Under $25' }).click();
  entry.ideas.hour25 = await cnNames(page);
  check(entry.ideas.hour25.join() !== entry.ideas.first.join(), `${id}: time and budget didn't change the ideas`);

  // Swap the first, edit and choose the second, plan it, reload: all still there.
  const before = await cnNames(page);
  await page.locator('.cn-card').nth(0).getByRole('button', { name: /^Swap/ }).click();
  const after = await cnNames(page);
  check(after[0] !== before[0] && after[1] === before[1] && after[2] === before[2] && (await page.locator('.cn-card [data-cn-slot]').first().textContent()) === 'Family moment', `${id}: swapping didn't replace just the family moment`);
  const second = page.locator('.cn-card').nth(1);
  await second.getByRole('button', { name: /^Edit/ }).click();
  await second.locator('[data-cn-edit-title]').fill('Saturday muffins, just the two of us');
  await second.getByRole('button', { name: /^Done editing/ }).click();
  await second.getByRole('button', { name: /^Choose/ }).click();
  check(await page.locator('[data-cn-plan]').isVisible(), `${id}: choosing an idea didn't show the plan`);
  const people = await page.locator('[data-cn-person]').allTextContents();
  entry.people = people;
  check(people.length >= 1, `${id}: no family names to choose who's joining`);
  for (const n of people.slice(0, 2)) await page.locator(`[data-cn-person="${n}"]`).click();
  const whoWant = people.length > 1 ? `${people[0]} and ${people[1]}` : people[0];
  check(await page.locator('[data-cn-who]').inputValue() === whoWant, `${id}: who's joining reads "${await page.locator('[data-cn-who]').inputValue()}"`);
  await page.locator('[data-cn-when]').fill('Saturday morning');
  await page.getByRole('button', { name: '15 minutes' }).click();
  check((await cnNames(page))[1] === 'Saturday muffins, just the two of us', `${id}: the chosen idea moved when answers changed`);
  await page.reload();
  await page.locator('.cn-card').nth(2).waitFor();
  check(await page.locator('.cn-card.is-chosen .cn-card-name').textContent() === 'Saturday muffins, just the two of us', `${id}: the chosen, edited idea didn't survive a reload`);
  check(await page.locator('[data-cn-sheet-name]').textContent() === 'Saturday muffins, just the two of us' && await page.locator('[data-cn-sheet-who]').textContent() === whoWant && await page.locator('[data-cn-sheet-when]').textContent() === 'Saturday morning', `${id}: the plan doesn't show the chosen idea, who and when`);
  const plan = await page.locator('[data-cn-sheet]').textContent();
  check(plan.includes('Something to ask') && plan.includes('family and friends section') && !/score|streak|points/i.test(plan), `${id}: the plan is missing its question or calendar line`);
  check(await noSideScroll(page), `${id}: the planner scrolls sideways on a phone`);
  await page.screenshot({ path: join(out, `${id}-february-planner-chosen.png`), fullPage: true });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-cn-download]')]);
  await dl.saveAs(join(out, `${id}-february-plan.png`));
  check(await page.locator('dialog.tool-email-dialog').count() === 0, `${id}: the planner asked for an email`);
  await page.click('[data-cn-copy]');
  await page.waitForTimeout(200);
  const copied = await page.locator('[data-cn-status]').textContent();
  const fallback = await page.locator('[data-cn-copy-fallback]').inputValue();
  check(/^Copied/.test(copied) || fallback.includes('Saturday muffins'), `${id}: copying the plan didn't work`);
  await page.getByRole('link', { name: /^← Back to/ }).click();
  await page.waitForURL(/\/club\/kits\/2027-02/);
  check(errors.length === 0, `${id}: February page errors: ${errors.join(' | ')}`);
  report.push(entry);
  await ctx.close();
}
{
  const first = (id) => report.find((e) => e.february === id)?.ideas.hour25.join();
  check(first('okafor') !== first('chen'), `February: a toddler family and a family with teens got the same ideas (${first('okafor')})`);
}

// No family profile, teenagers only: nothing childish, and the planner works with no setup.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/club/tools/connection-planner?sample=new`);
  await page.locator('.cn-card').nth(2).waitFor();
  check(/Tap any/.test(await page.locator('[data-cn-ages-note]').textContent()), 'no profile: the planner claims ages from a profile');
  await page.getByRole('button', { name: 'Teens', exact: true }).click();
  const seen = new Set(await cnNames(page));
  for (const time of ['15 minutes', 'About an hour', 'More time']) {
    await page.getByRole('button', { name: time, exact: true }).click();
    for (const n of await cnNames(page)) seen.add(n);
  }
  check(![...seen].some((n) => YOUNG_ONLY.includes(n)), `teens: childish ideas offered (${[...seen].join(', ')})`);
  await page.locator('.cn-card').first().getByRole('button', { name: /^Choose/ }).click();
  check(await page.locator('[data-cn-person]').count() === 0, 'no profile: the planner shows names it can’t know');
  await page.locator('[data-cn-who]').fill('Everyone who’s home');
  report.push({ teensNoProfile: [...seen] });
  await ctx.close();
}

// Two families in one browser, February: one family's plan never shows up in the other's.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(febUrl('rivera'));
  await page.getByRole('button', { name: 'Find Something to Do Together', exact: true }).click();
  await page.locator('.cn-card').nth(2).waitFor();
  await page.locator('.cn-card').first().getByRole('button', { name: /^Choose/ }).click();
  await page.locator('[data-cn-when]').fill('Rivera Friday');
  await page.goto(febUrl('okafor'));
  await page.getByRole('button', { name: 'Find Something to Do Together', exact: true }).click();
  await page.locator('.cn-card').nth(2).waitFor();
  check(await page.locator('.cn-card.is-chosen').count() === 0 && await page.locator('[data-cn-plan]').isHidden(), 'leak: Rivera’s chosen idea shows in the Okafors’ planner');
  check((await page.locator('[data-cn-family]').inputValue()) === 'The Okafors', 'leak: the Okafors’ plan has another family’s name');
  await page.locator('.cn-card').first().getByRole('button', { name: /^Choose/ }).click();
  check(await page.locator('[data-cn-when]').inputValue() === '' && !(await page.locator('[data-cn-person]').allTextContents()).includes('Ana'), 'leak: Rivera’s plan details or names show for the Okafors');
  // Same tab, straight to each tool's address as another sample family: the Okafors' handoff doesn't carry over.
  for (const [tool, ready, probe] of [
    ['connection-planner', '.cn-card', () => document.querySelector('[data-cn-family]')?.value ?? ''],
    ['meal-team', '.mlt-row', () => document.querySelector('[data-mlt-family]')?.value ?? ''],
    ['school-wrap-up', '.wu', () => document.querySelector('[data-wu-family]')?.value ?? ''],
    ['habit-builder', '[data-hb-statement]', () => document.querySelector('[data-hb-family]')?.value ?? ''],
    ['traditions-picker', '.tp-card', () => document.querySelector('[data-tp-family]')?.value ?? ''],
    ['chore-chart', '#chore-chart', () => document.querySelector('[data-cc-name]')?.value ?? ''],
    ['routine-chart', '.mr-container', () => document.querySelector('.mr-container [data-field="title"]')?.value ?? ''],
  ]) {
    await page.goto(`${base}/club/tools/${tool}?sample=brooks`);
    await page.locator(ready).first().waitFor();
    const shown = await page.evaluate(probe);
    check(!/Okafor|Zara/.test(shown) && !/Okafor|Zara/.test(await page.locator('h1').first().textContent()), `leak: ${tool} opened as Brooks shows the Okafors' "${shown}"`);
  }
  report.push({ februaryLeakCheck: 'ok' });
  await ctx.close();
}

// March (letter, One-Room Family Reset, the Family Spring Cleaning Builder): the room, the day and helpers save; the
// reset and the letter print; "Build Our Cleaning Plan" opens the builder with the family as helpers.
const marUrl = (id) => `${base}/club/kits/2027-03-spring-clean-together?sample=${id}`;
/** Every job row's chosen person is one the builder allows (no grown-ups-only job or limit broken). */
const sbAllowed = (page) => page.evaluate(() => [...document.querySelectorAll('.sb-job select')].every((sel) => !sel.selectedOptions[0]?.disabled));
const sbSessionMinutes = (page) => page.locator('.sb-room .sb-session-title').allTextContents();
for (const id of [...samples, 'hughes']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const entry = { march: id };
  const lines = page.locator('section[aria-labelledby="club-action"] .club-screen ol > li');
  await page.goto(marUrl(id));
  await page.getByRole('heading', { name: 'Our One-Room Family Reset' }).waitFor();
  check(await noSideScroll(page), `${id}: March scrolls sideways on a phone`);
  check(await lines.count() === 5, `${id}: the reset has ${await lines.count()} steps (expected 5)`);
  check(await page.getByPlaceholder('Who’s helping?').count() === 5, `${id}: March is missing its helper lines`);
  check(await page.locator('section[aria-labelledby="club-action"] input[type="date"]').count() === 1, `${id}: March should have one optional date`);
  await page.screenshot({ path: join(out, `${id}-march-phone.png`), fullPage: true });

  await page.getByRole('group', { name: 'Rooms to choose from' }).getByRole('button', { name: 'Living room' }).click();
  await page.getByLabel(/When we’re doing it/).fill('2027-03-06');
  await page.getByPlaceholder('Who’s helping?').nth(1).fill('Everyone');
  await lines.first().locator('input[type="checkbox"]').check();
  await page.getByText('1 of 5 done').waitFor();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole('heading', { name: 'Our One-Room Family Reset' }).waitFor();
  check(await page.getByLabel('Which room or space?').inputValue() === 'Living room', `${id}: the room didn't survive a reload`);
  check(await page.getByLabel(/When we’re doing it/).inputValue() === '2027-03-06', `${id}: the day didn't survive a reload`);
  check(await page.getByPlaceholder('Who’s helping?').nth(1).inputValue() === 'Everyone' && await lines.first().locator('input[type="checkbox"]').isChecked(), `${id}: helpers or checks didn't survive a reload`);

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [doc, button, pages] of [['one-room-reset', 'Print it', 1], ['letter', 'Print another copy', 2]]) {
    const r = await printTo(page, doc, 'portrait', `${id}-march-${doc}`, 0, button);
    entry[doc] = r;
    check(r.pages === pages, `${id}: March ${doc} printed on ${r.pages} pages (expected ${pages})`);
    check(r.overflow.length === 0, `${id}: March ${doc} has text cut off: ${r.overflow.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  const sheet = await page.evaluate(() => document.querySelector('.club-action-sheet')?.textContent ?? '');
  check(sheet.includes('Living room') && sheet.includes('Saturday, March 6') && sheet.includes('Everyone'), `${id}: her printed reset is missing the room, day or helper`);
  check(!sheet.includes('check in'), `${id}: March's printout has a check-in`);
  const front = await page.evaluate(() => document.querySelector('.club-letter .club-letter-page')?.textContent ?? '');
  check(front.includes('The space we’re resetting') && front.includes('When we’re doing it') && !front.includes('Living room') && !front.includes('March 6'), `${id}: the mailed letter's blanks are wrong`);
  check(await page.evaluate(() => { const h = [...document.querySelectorAll('.club-letter .club-stem')]; return h.length === 2 && h.every((x) => getComputedStyle(x).flexShrink === '0'); }), `${id}: the letter's stem is missing or squashed`);
  const back = await page.evaluate(() => document.querySelectorAll('.club-letter-page')[1]?.textContent ?? '');
  for (const part of ['Your Spring Reset Field Guide', 'Start with one room.', 'Give everyone a real job.', 'Work in short sessions.', 'Outgrown clothes and shoes', 'not four more projects', 'What’s one space in our home we could make better together?', 'Build Your Family Spring Cleaning Plan', 'organizedmomcollective.com/club/kits/2027-03-spring-clean-together', 'so everyone knows when it’s happening.']) {
    check(back.includes(part), `${id}: the letter's back is missing "${part}"`);
  }
  entry.greeting = await page.evaluate(() => document.querySelector('.club-letter-greeting')?.textContent);

  // The tool: the cleaning builder, with the family as helpers and the living room first.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Build Our Cleaning Plan', exact: true }).click();
  await page.waitForURL(/\/club\/tools\/spring-cleaning/);
  await page.locator('.sb-room').first().waitFor();
  check(await page.locator('.sb[data-sb-handoff]').count() === 1, `${id}: the Club page isn't the site's cleaning builder`);
  const helpers = await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value));
  entry.helpers = helpers;
  check(helpers.length >= 1 && !helpers.includes('Adult 1'), `${id}: the builder didn't take the family as helpers (${helpers.join(', ')})`);
  check((await page.locator('.sb-room .sb-room-name').first().textContent()) === 'Living room', `${id}: the builder didn't open on the living room`);
  check(await sbAllowed(page), `${id}: a job went to someone who can't safely do it`);
  check(await page.locator('.sb-job .sb-job-note').filter({ hasText: 'Needs someone' }).count() === 0, `${id}: a living-room job has nobody`);
  check(await noSideScroll(page), `${id}: the builder scrolls sideways on a phone`);

  // The simplest case: one room, 15 minutes, a short plan straight away.
  await page.locator('[data-sb-length="15"]').click();
  const first = (await sbSessionMinutes(page))[0];
  const firstMin = Number(/About (\d+) minutes/.exec(first)?.[1]);
  check(firstMin > 0 && firstMin <= 15, `${id}: a 15-minute session reads "${first}"`);
  entry.living15 = await page.locator('.sb-room .sb-session').first().locator('.sb-job').evaluateAll((rows) => rows.map((r) => `${r.querySelector('select').selectedOptions[0].textContent}: ${r.querySelector('textarea').value}`));
  await page.screenshot({ path: join(out, `${id}-march-builder-15.png`), fullPage: true });
  await page.locator('[data-sb-length="30"]').click();

  // Limits are rules: a seated-only grown-up gets only seated jobs, wherever they are.
  if (id === 'chen') {
    const lin = page.locator('[data-hp-helper]').filter({ has: page.locator('[data-hp-name][value="Lin"]') });
    await page.getByRole('button', { name: 'Limits for Lin' }).click();
    await page.locator('[data-hp-helper]').nth(2).getByLabel('Seated jobs only').check();
    check(await sbAllowed(page), 'chen: a limit was broken after adding it');
    entry.linJobs = await page.locator('.sb-job').evaluateAll((rows) => rows.filter((r) => r.querySelector('select').selectedOptions[0].textContent === 'Lin').map((r) => r.querySelector('textarea').value));
    void lin;
  }

  // Several rooms: each its own sessions, only the open room expanded.
  await page.locator('[data-sb-room="kitchen"]').click();
  await page.locator('[data-sb-room="bathroom"]').click();
  check(await page.locator('.sb-room').count() === 3, `${id}: three rooms should show three plans`);
  check(await page.locator('.sb-room .sb-room-body').count() === 1, `${id}: more than one room is expanded at once`);
  check(await sbAllowed(page), `${id}: a kitchen or bathroom job went to someone who can't safely do it`);
  entry.bathroom = await page.locator('.sb-room-sum').allTextContents();

  // Edit the living room (rename, reassign, remove, add our own), then refresh only the kitchen: the living room keeps its edits.
  await page.locator('.sb-room-head').first().click();
  const living = page.locator('.sb-room').first();
  const row = living.locator('.sb-job').first();
  await row.locator('textarea').fill('Collect everything that wandered in here');
  await row.locator('textarea').blur();
  await living.locator('.sb-job').nth(1).getByRole('button', { name: /^Remove/ }).click();
  await living.getByLabel(/^Add a job to/).selectOption('__own');
  await living.getByLabel('Your own job').fill('Water the plants');
  await living.getByRole('button', { name: 'Add', exact: true }).click();
  const owners = await living.locator('.sb-job select').first().locator('option:not([disabled])').allTextContents();
  await living.locator('.sb-job select').first().selectOption({ label: owners[owners.length - 1] });
  const livingBefore = await living.locator('.sb-job textarea').evaluateAll((els) => els.map((e) => e.value));
  check(livingBefore.includes('Collect everything that wandered in here') && livingBefore.includes('Water the plants'), `${id}: living-room edits didn't apply`);
  await page.locator('.sb-room-head').nth(1).click();
  await page.getByRole('button', { name: /^New suggestions for Kitchen/ }).click();
  await page.locator('.sb-room-head').first().click();
  const livingAfter = await page.locator('.sb-room').first().locator('.sb-job textarea').evaluateAll((els) => els.map((e) => e.value));
  check(livingAfter.join('|') === livingBefore.join('|'), `${id}: refreshing the kitchen changed the living room`);
  await page.reload();
  await page.locator('.sb-room').first().waitFor();
  const livingReload = await page.locator('.sb-room').first().locator('.sb-job textarea').evaluateAll((els) => els.map((e) => e.value));
  check(livingReload.join('|') === livingBefore.join('|'), `${id}: the edited plan didn't survive a reload`);

  // Print one room only.
  await page.locator('[data-sb-print-room]').selectOption({ label: 'Living room' });
  const sheetText = await page.locator('.sb-sheet').first().textContent();
  check(sheetText.includes('Living room Reset') && sheetText.includes('Water the plants') && !sheetText.includes('Kitchen'), `${id}: the living-room printout isn't just the living room`);
  check(await page.locator('.sb-sheet .sb-sheet-box').count() >= 4, `${id}: the printout has too few boxes`);
  check(await page.evaluate(() => [...document.querySelectorAll('.sb-sheet')].every((s) => s.scrollHeight <= s.clientHeight + 1)), `${id}: a printout runs off its page`);
  await page.screenshot({ path: join(out, `${id}-march-builder-phone.png`), fullPage: true });
  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await page.click('[data-sb-download]');
  await page.waitForTimeout(2500);
  check(downloads.length >= 1, `${id}: no printout downloaded`);
  if (downloads[0]) await downloads[0].saveAs(join(out, `${id}-march-living.png`));
  check(await page.locator('dialog.tool-email-dialog').count() === 0, `${id}: the builder asked for an email`);
  await page.click('[data-sb-copy]');
  await page.waitForTimeout(200);
  const copied = await page.locator('[data-sb-status]').textContent();
  const fallback = await page.locator('[data-sb-copy-fallback]').inputValue();
  check(/^Copied/.test(copied) || (fallback.includes('LIVING ROOM') && fallback.includes('KITCHEN')), `${id}: copying the plan didn't work`);
  await page.getByRole('link', { name: /^← Back to/ }).click();
  await page.waitForURL(/\/club\/kits\/2027-03/);
  check(errors.length === 0, `${id}: March page errors: ${errors.join(' | ')}`);
  report.push(entry);
  await ctx.close();
}

// No family profile: one adult to start; add a child and a teen, and the plan shares the work with them.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/club/tools/spring-cleaning?sample=new`);
  await page.locator('.sb-room').first().waitFor();
  check((await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value))).join() === 'Adult 1', 'no profile: the builder invents people');
  await page.getByRole('button', { name: '+ School-age child' }).click();
  await page.getByRole('button', { name: '+ Teen' }).click();
  const owners = await page.locator('.sb-job select').evaluateAll((els) => els.map((e) => e.selectedOptions[0].textContent));
  check(owners.some((o) => o.startsWith('Child')) && owners.some((o) => o.startsWith('Teen')), `no profile: added helpers got no jobs (${owners.join(', ')})`);
  check(await sbAllowed(page), 'no profile: a job went to someone who can’t safely do it');
  report.push({ cleaningNoProfile: owners });
  await ctx.close();
}

// Two families in one browser, March: one family's plan never shows up in the other's.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(marUrl('rivera'));
  await page.getByRole('button', { name: 'Build Our Cleaning Plan', exact: true }).click();
  await page.locator('.sb-room').first().waitFor();
  await page.locator('.sb-room').first().getByLabel(/^Add a job to/).selectOption('__own');
  await page.locator('.sb-room').first().getByLabel('Your own job').fill('Rivera secret job');
  await page.locator('.sb-room').first().getByRole('button', { name: 'Add', exact: true }).click();
  await page.goto(marUrl('okafor'));
  await page.getByRole('button', { name: 'Build Our Cleaning Plan', exact: true }).click();
  await page.locator('.sb-room').first().waitFor();
  const names = await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value));
  const jobs = await page.locator('.sb-job textarea').evaluateAll((els) => els.map((e) => e.value));
  check(!names.includes('Ana') && names.includes('Zara') && !jobs.includes('Rivera secret job'), `leak: the Okafors’ cleaning plan shows the Riveras’ (${names.join(', ')})`);
  await page.goto(`${base}/club/tools/spring-cleaning?sample=brooks`);
  await page.locator('.sb-room').first().waitFor();
  const direct = await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value));
  check(!direct.includes('Zara') && !direct.includes('Ana'), `leak: the cleaning builder opened by address as Brooks shows another family (${direct.join(', ')})`);
  report.push({ marchLeakCheck: 'ok' });
  await ctx.close();
}

// April (letter, Family Dinner Team, the Family Meal Responsibility Planner): the meal, the day and helpers save; the
// dinner team and the letter print; "Build Our Mealtime Plan" opens the planner with the family as helpers.
const aprUrl = (id) => `${base}/club/kits/2027-04-everybody-helps-at-mealtime?sample=${id}`;
/** Every job row's chosen person is one the planner allows (no grown-ups-only job, allergy rule or limit broken). */
const mltAllowed = (page) => page.evaluate(() => [...document.querySelectorAll('.mlt-row select')].every((sel) => !sel.selectedOptions[0]?.disabled));
const mltOwners = (page) => page.locator('.mlt-row').evaluateAll((rows) => rows.map((r) => `${r.querySelector('select').selectedOptions[0].textContent}: ${r.querySelector('textarea').value}`));
for (const id of [...samples, 'hughes']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const entry = { april: id };
  const lines = page.locator('section[aria-labelledby="club-action"] .club-screen ol > li');
  await page.goto(aprUrl(id));
  await page.getByRole('heading', { name: 'Our Family Dinner Team' }).waitFor();
  check(await noSideScroll(page), `${id}: April scrolls sideways on a phone`);
  check(await lines.count() === 5, `${id}: the dinner team has ${await lines.count()} steps (expected 5)`);
  check(await page.getByPlaceholder('Who’s helping?').count() === 5, `${id}: April is missing its helper lines`);
  await page.screenshot({ path: join(out, `${id}-april-phone.png`), fullPage: true });

  await page.getByRole('group', { name: 'Ideas' }).getByRole('button', { name: 'Taco night' }).click();
  await page.getByLabel(/When we’re having it/).fill('2027-04-09');
  await page.getByPlaceholder('Who’s helping?').nth(2).fill('Kids set the table');
  await lines.first().locator('input[type="checkbox"]').check();
  await page.getByText('1 of 5 done').waitFor();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole('heading', { name: 'Our Family Dinner Team' }).waitFor();
  check(await page.getByLabel('Which meal?').inputValue() === 'Taco night', `${id}: the meal didn't survive a reload`);
  check(await page.getByLabel(/When we’re having it/).inputValue() === '2027-04-09', `${id}: the day didn't survive a reload`);
  check(await page.getByPlaceholder('Who’s helping?').nth(2).inputValue() === 'Kids set the table' && await lines.first().locator('input[type="checkbox"]').isChecked(), `${id}: helpers or checks didn't survive a reload`);
  // Her own meal, typed.
  await page.getByLabel('Which meal?').fill('Grandma’s chili');
  await page.getByLabel('Which meal?').blur();

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [doc, button, pages] of [['dinner-team', 'Print it', 1], ['letter', 'Print another copy', 2]]) {
    const r = await printTo(page, doc, 'portrait', `${id}-april-${doc}`, 0, button);
    entry[doc] = r;
    check(r.pages === pages, `${id}: April ${doc} printed on ${r.pages} pages (expected ${pages})`);
    check(r.overflow.length === 0, `${id}: April ${doc} has text cut off: ${r.overflow.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  const sheet = await page.evaluate(() => document.querySelector('.club-action-sheet')?.textContent ?? '');
  check(sheet.includes('Grandma’s chili') && sheet.includes('Friday, April 9') && sheet.includes('Kids set the table'), `${id}: her printed dinner team is missing the meal, day or helper`);
  const front = await page.evaluate(() => document.querySelector('.club-letter .club-letter-page')?.textContent ?? '');
  check(front.includes('The meal we’re making') && front.includes('When we’re having it') && !front.includes('chili') && !front.includes('April 9'), `${id}: the mailed letter's blanks are wrong`);
  check(front.includes('Everybody Helps at Mealtime') && front.includes('Less on Mom’s plate') && front.includes('Megan'), `${id}: the letter's front is missing its title, subtitle or signature`);
  check(await page.evaluate(() => { const h = [...document.querySelectorAll('.club-letter .club-place')]; return h.length === 2 && h.every((x) => getComputedStyle(x).flexShrink === '0'); }), `${id}: the letter's place setting is missing or squashed`);
  const back = await page.evaluate(() => document.querySelectorAll('.club-letter-page')[1]?.textContent ?? '');
  for (const part of ['Everyone Has a Place at the Table', 'Before the meal.', 'During the meal.', 'After the meal.', 'Kitchen jobs by age', '3–5', '13+', 'A five-minute pantry check', 'add only what’s missing', 'What’s one part of mealtime you could take responsibility for this week?', 'Make Your Family Meal Responsibility Plan', 'organizedmomcollective.com/club/kits/2027-04-everybody-helps-at-mealtime', 'meal-planning and grocery-list sections']) {
    check(back.includes(part), `${id}: the letter's back is missing "${part}"`);
  }

  // The tool: the meal planner, with the family as helpers, dinner and the same jobs all week.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Build Our Mealtime Plan', exact: true }).click();
  await page.waitForURL(/\/club\/tools\/meal-team/);
  await page.locator('.mlt-row').first().waitFor();
  check(await page.locator('.mlt[data-mlt-handoff]').count() === 1, `${id}: the Club page isn't the site's meal planner`);
  const helpers = await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value));
  entry.helpers = helpers;
  check(helpers.length >= 1 && !helpers.includes('Adult 1'), `${id}: the planner didn't take the family as helpers (${helpers.join(', ')})`);
  check(await page.locator('[data-mlt-meal="dinner"][aria-pressed="true"]').count() === 1 && await page.locator('[data-mlt-meal][aria-pressed="true"]').count() === 1, `${id}: the planner didn't start on dinner alone`);
  check(await page.locator('[data-mlt-mode="same"][aria-pressed="true"]').count() === 1, `${id}: the planner didn't start with the same jobs all week`);
  check(await mltAllowed(page), `${id}: a job went to someone who can't safely do it`);
  check(await page.locator('.mlt-row.is-open').count() === 0, `${id}: a dinner job has nobody`);
  const owners = await mltOwners(page);
  entry.dinner = owners;
  for (const h of helpers) check(owners.some((o) => o.startsWith(`${h}:`)) || owners.some((o) => o.startsWith('Everyone:')) && helpers.length === 1, `${id}: ${h} has no mealtime job`);
  for (const part of ['week', 'before', 'during', 'after']) check(await page.locator(`[data-mlt-part="${part}"] .mlt-row`).count() > 0, `${id}: the plan has no ${part} jobs`);
  entry.balance = await page.locator('[data-mlt-balance]').textContent();
  check(await noSideScroll(page), `${id}: the planner scrolls sideways on a phone`);
  await page.screenshot({ path: join(out, `${id}-april-planner-phone.png`), fullPage: true });

  // Breakfast instead of dinner: different jobs, still safe.
  await page.locator('[data-mlt-meal="breakfast"]').click();
  await page.locator('[data-mlt-meal="dinner"]').click();
  const breakfast = await mltOwners(page);
  entry.breakfast = breakfast;
  check(breakfast.some((o) => o.includes('bowls, spoons')) && !breakfast.some((o) => o.includes('Cook the main dish')), `${id}: breakfast plans look like dinner`);
  check(await mltAllowed(page), `${id}: a breakfast job went to someone who can't safely do it`);
  // All three meals.
  await page.locator('[data-mlt-meal="lunch"]').click();
  await page.locator('[data-mlt-meal="dinner"]').click();
  const three = await mltOwners(page);
  check(['Breakfast:', 'Lunch:', 'Dinner:'].every((m) => three.some((o) => o.includes(m))), `${id}: three meals don't each have jobs`);
  check(await mltAllowed(page), `${id}: a job went to someone who can't safely do it with three meals`);
  await page.locator('[data-mlt-meal="breakfast"]').click();
  await page.locator('[data-mlt-meal="lunch"]').click();

  // Limits and the allergy rule.
  if (id === 'chen') {
    await page.getByRole('button', { name: 'Limits for Lin' }).click();
    await page.locator('[data-hp-helper]').nth(2).getByLabel('Seated jobs only').check();
    check(await mltAllowed(page), 'chen: a limit was broken after adding it');
    entry.linJobs = (await mltOwners(page)).filter((o) => o.startsWith('Lin:'));
  }
  await page.locator('[data-mlt-allergy]').check();
  check(await mltAllowed(page), `${id}: the allergy rule was broken`);
  await page.locator('[data-mlt-allergy]').uncheck();

  // Edit: reword, reassign, remove, add our own; then new suggestions keep all of it, and so does a reload.
  const firstRow = page.locator('.mlt-row').first();
  await firstRow.locator('textarea').fill('Plan the week’s dinners on Sunday');
  await firstRow.locator('textarea').blur();
  const after = page.locator('[data-mlt-part="after"] .mlt-row').filter({ hasNot: page.locator('select option[value="everyone"]:checked') });
  const target = after.first();
  const pick = (await target.locator('select option:not([disabled])').allTextContents()).filter((t) => t !== 'Needs someone' && t !== 'Everyone').pop();
  await target.locator('select').selectOption({ label: pick });
  const pickedJob = await target.locator('textarea').inputValue();
  const removed = await page.locator('[data-mlt-part="during"] .mlt-row textarea').first().inputValue();
  await page.locator('[data-mlt-part="during"] .mlt-row').first().getByRole('button', { name: /^Remove/ }).click();
  await page.getByLabel('Part of mealtime').selectOption('after');
  await page.getByLabel('Your own job').fill('Feed the dog after dinner');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const before = await mltOwners(page);
  check(before.includes(`${pick}: ${pickedJob}`) && before.some((o) => o.endsWith('Plan the week’s dinners on Sunday')) && before.some((o) => o.endsWith('Feed the dog after dinner')) && !before.some((o) => o.endsWith(removed)), `${id}: edits didn't apply`);
  await page.locator('[data-mlt-fresh]').click();
  const fresh = await mltOwners(page);
  check(fresh.includes(`${pick}: ${pickedJob}`) && fresh.some((o) => o.endsWith('Plan the week’s dinners on Sunday')) && fresh.some((o) => o.endsWith('Feed the dog after dinner')) && !fresh.some((o) => o.endsWith(removed)), `${id}: new suggestions erased her edits`);
  await page.reload();
  await page.locator('.mlt-row').first().waitFor();
  const reloaded = await mltOwners(page);
  check(reloaded.join('|') === fresh.join('|'), `${id}: the edited plan didn't survive a reload`);

  // Rotate: the weekly view becomes a day-by-day grid, and the printout gains the week.
  await page.locator('[data-mlt-mode="rotate"]').click();
  await page.locator('[data-mlt-day="5"]').click();
  await page.locator('[data-mlt-day="6"]').click();
  await page.locator('[data-mlt-view="week"]').click();
  const gridRows = await page.locator('.mlt-grid tbody tr').count();
  check(helpers.length === 1 || gridRows === 5, `${id}: the rotation grid has ${gridRows} days (expected Mon–Fri)`);
  if (helpers.length > 1) {
    const cols = await page.locator('.mlt-grid tbody tr').evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent)));
    entry.rotation = cols;
    const varied = cols[0].some((_, c) => new Set(cols.map((r) => r[c])).size > 1);
    check(varied, `${id}: rotating didn't change anyone's jobs from day to day`);
  }
  check(await noSideScroll(page), `${id}: the weekly grid scrolls the page sideways on a phone`);
  await page.screenshot({ path: join(out, `${id}-april-week-phone.png`), fullPage: true });
  check(await page.locator('.mlt-sheet').count() >= 2, `${id}: a rotating plan didn't add the week to the printout`);
  check(await page.evaluate(() => [...document.querySelectorAll('.mlt-sheet')].every((s) => s.scrollHeight <= s.clientHeight + 1)), `${id}: a printout runs off its page`);
  const sheetText = (await page.locator('.mlt-sheet[data-mlt-sheet="Our Mealtime Team"]').allTextContents()).join(' ');
  entry.chartPages = await page.locator('.mlt-sheet[data-mlt-sheet="Our Mealtime Team"]').count();
  check(sheetText.includes('Our Mealtime Team') && sheetText.includes('Feed the dog after dinner') && sheetText.includes('meal plan') && sheetText.includes('grocery list'), `${id}: the chart is missing its title, her job or the calendar tie-in`);
  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await page.click('[data-mlt-download]');
  await page.waitForTimeout(3500);
  check(downloads.length >= 1, `${id}: no chart downloaded`);
  for (const [i, d] of downloads.entries()) await d.saveAs(join(out, `${id}-april-chart-${i + 1}.png`));
  check(await page.locator('dialog.tool-email-dialog').count() === 0, `${id}: the planner asked for an email`);
  await page.click('[data-mlt-copy]');
  await page.waitForTimeout(200);
  const copied = await page.locator('[data-mlt-status]').textContent();
  const fallback = await page.locator('[data-mlt-copy-fallback]').inputValue();
  check(/^Copied/.test(copied) || (fallback.includes('BEFORE THE MEAL') && fallback.includes('Mon:')), `${id}: copying the plan didn't work`);
  await page.locator('[data-mlt-mode="same"]').click();
  await page.locator('[data-mlt-view="team"]').click();
  await page.getByRole('link', { name: /^← Back to/ }).click();
  await page.waitForURL(/\/club\/kits\/2027-04/);
  check(errors.length === 0, `${id}: April page errors: ${errors.join(' | ')}`);
  report.push(entry);
  await ctx.close();
}

// No family profile: one adult to start; add a young child and a teen, and the plan shares the work with them.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/club/tools/meal-team?sample=new`);
  await page.locator('.mlt-row').first().waitFor();
  check((await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value))).join() === 'Adult 1', 'no profile: the planner invents people');
  await page.getByRole('button', { name: '+ Young child' }).click();
  await page.getByRole('button', { name: '+ Teen' }).click();
  const owners = await mltOwners(page);
  check(owners.some((o) => o.startsWith('Child')) && owners.some((o) => o.startsWith('Teen')), `no profile: added helpers got no jobs (${owners.join(', ')})`);
  check(await mltAllowed(page), 'no profile: a job went to someone who can’t safely do it');
  report.push({ mealNoProfile: owners });
  await ctx.close();
}

// Two families in one browser, April: one family's plan never shows up in the other's.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(aprUrl('rivera'));
  await page.getByRole('button', { name: 'Build Our Mealtime Plan', exact: true }).click();
  await page.locator('.mlt-row').first().waitFor();
  await page.getByLabel('Your own job').fill('Rivera secret job');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.goto(aprUrl('okafor'));
  await page.getByRole('button', { name: 'Build Our Mealtime Plan', exact: true }).click();
  await page.locator('.mlt-row').first().waitFor();
  const names = await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value));
  const jobs = await mltOwners(page);
  check(!names.includes('Ana') && names.includes('Zara') && !jobs.some((j) => j.includes('Rivera secret job')), `leak: the Okafors’ meal plan shows the Riveras’ (${names.join(', ')})`);
  await page.goto(`${base}/club/tools/meal-team?sample=brooks`);
  await page.locator('.mlt-row').first().waitFor();
  const direct = await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value));
  check(!direct.includes('Zara') && !direct.includes('Ana'), `leak: the meal planner opened by address as Brooks shows another family (${direct.join(', ')})`);
  report.push({ aprilLeakCheck: 'ok' });
  await ctx.close();
}

// May (letter, School Year Wrap-Up, the School Year Wrap-Up Builder): checks and helpers save; the wrap-up and the
// letter print; "Build Our School Year Plan" opens the builder with the family; dates are August's, never overdue.
const mayUrl = (id) => `${base}/club/kits/2027-05-finish-the-school-year?sample=${id}`;
const localDay = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const wuRows = (page) => page.locator('.wu-row').evaluateAll((rows) => rows.map((r) => ({ title: r.querySelector('textarea').value, date: r.querySelector('input[type="date"]').value, owner: r.querySelector('select').selectedOptions[0]?.textContent ?? '', phase: r.closest('[data-wu-group]').dataset.wuGroup })));
const wuAllowed = (page) => page.evaluate(() => [...document.querySelectorAll('.wu-row select')].every((sel) => !sel.selectedOptions[0]?.disabled));
for (const id of samples) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const entry = { may: id };
  const lines = page.locator('section[aria-labelledby="club-action"] .club-screen ol > li');
  await page.goto(mayUrl(id));
  await page.getByRole('heading', { name: 'Our School Year Wrap-Up' }).waitFor();
  check(await noSideScroll(page), `${id}: May scrolls sideways on a phone`);
  check(await lines.count() === 5, `${id}: the wrap-up has ${await lines.count()} steps (expected 5)`);
  check(await page.getByPlaceholder('Who’s helping?').count() === 5, `${id}: May is missing its helper lines`);
  check(await page.locator('section[aria-labelledby="club-action"] input[type="date"]').count() === 0, `${id}: May's checklist shouldn't ask for a date`);
  check(await page.getByText('Read this month’s letter').count() >= 1, `${id}: May has no "Read this month's letter" link`);
  await page.screenshot({ path: join(out, `${id}-may-phone.png`), fullPage: true });

  await page.getByPlaceholder('Who’s helping?').nth(2).fill('Each kid, their own');
  await lines.first().locator('input[type="checkbox"]').check();
  await page.getByText('1 of 5 done').waitFor();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole('heading', { name: 'Our School Year Wrap-Up' }).waitFor();
  check(await page.getByPlaceholder('Who’s helping?').nth(2).inputValue() === 'Each kid, their own' && await lines.first().locator('input[type="checkbox"]').isChecked(), `${id}: helpers or checks didn't survive a reload`);

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [doc, button, pages] of [['school-wrap-up', 'Print it', 1], ['letter', 'Print another copy', 2]]) {
    const r = await printTo(page, doc, 'portrait', `${id}-may-${doc}`, 0, button);
    entry[doc] = r;
    check(r.pages === pages, `${id}: May ${doc} printed on ${r.pages} pages (expected ${pages})`);
    check(r.overflow.length === 0, `${id}: May ${doc} has text cut off: ${r.overflow.join(' | ')}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  const sheet = await page.evaluate(() => document.querySelector('.club-action-sheet')?.textContent ?? '');
  check(sheet.includes('Each kid, their own') && sheet.includes('Sort school papers.'), `${id}: her printed wrap-up is missing a helper or a step`);
  const front = await page.evaluate(() => document.querySelector('.club-letter .club-letter-page')?.textContent ?? '');
  check(front.includes('Finish the School Year Well') && front.includes('Less end-of-year chaos') && front.includes('Megan') && front.includes('Start wherever you are') && !front.includes('Each kid'), `${id}: the letter's front is wrong`);
  check(await page.evaluate(() => { const h = [...document.querySelectorAll('.club-letter .club-notebook')]; return h.length === 2 && h.every((x) => getComputedStyle(x).flexShrink === '0'); }), `${id}: the letter's notebook is missing or squashed`);
  const back = await page.evaluate(() => document.querySelectorAll('.club-letter-page')[1]?.textContent ?? '');
  for (const part of ['Close the Year, Keep What Matters', 'Finish the loose ends.', 'Let your child help sort.', 'Celebrate their growth.', 'The Five Favorites Rule', 'My favorite memory this year was', 'Something new I learned was', 'Something I’m proud of is', 'Build Your School Year Wrap-Up Plan', 'organizedmomcollective.com/club/kits/2027-05-finish-the-school-year', 'so everyone can see the plan.']) {
    check(back.includes(part), `${id}: the letter's back is missing "${part}"`);
  }
  // Room to write: two lines per prompt, each at least a quarter inch apart.
  const writing = await page.evaluate(() => [...document.querySelectorAll('.club-letter-reflection li')].map((li) => [...li.querySelectorAll('.club-write')].reduce((n, w) => n + parseFloat(getComputedStyle(w).height), 0)));
  check(writing.length === 3 && writing.every((h) => h >= 50), `${id}: the reflection prompts lack writing room (${writing.join(', ')})`);

  // The tool: the builder, with the family as helpers.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Build Our School Year Plan', exact: true }).click();
  await page.waitForURL(/\/club\/tools\/school-wrap-up/);
  await page.locator('.wu-row').first().waitFor();
  check(await page.locator('.wu[data-wu-handoff]').count() === 1, `${id}: the Club page isn't the site's wrap-up builder`);
  const helpers = await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value));
  entry.helpers = helpers;
  check(helpers.length >= 1 && !helpers.includes('Adult 1'), `${id}: the builder didn't take the family as helpers (${helpers.join(', ')})`);
  check(await page.locator('[data-hp-limits-toggle]:visible').count() === 0, `${id}: the builder shows a Limits button`);
  check(await page.locator('[data-wu-pick]:checked').count() === 6, `${id}: not every responsibility starts on`);
  const undated = await wuRows(page);
  check(undated.every((r) => r.date === ''), `${id}: dates appeared before a last day`);
  await page.screenshot({ path: join(out, `${id}-may-builder-input.png`), fullPage: true });

  // Late May.
  await page.locator('[data-wu-family-day]').fill('2027-05-27');
  await page.locator('[data-wu-family-day]').dispatchEvent('change');
  const late = await wuRows(page);
  entry.lateMay = late;
  check(late.every((r) => r.date), `${id}: a late-May task has no date`);
  check(late.some((r) => r.date === '2027-05-13' && /wall calendar/.test(r.title)), `${id}: the calendar task isn't 14 days before May 27`);
  check(late.filter((r) => r.phase === 'after').some((r) => r.date === '2027-05-28'), `${id}: nothing the day after May 27`);
  check(await wuAllowed(page), `${id}: a task went to someone who can't own it`);
  check(await page.locator('.wu-row.is-open').count() === 0, `${id}: a task has nobody`);
  const titles = late.map((r) => `${r.title}|${r.date}`);
  check(new Set(titles).size === titles.length, `${id}: a task repeats`);
  check(await noSideScroll(page), `${id}: the builder scrolls sideways on a phone`);
  await page.screenshot({ path: join(out, `${id}-may-plan-late-may.png`), fullPage: true });

  // Late June, and a child with a different day.
  await page.locator('[data-wu-family-day]').fill('2027-06-24');
  await page.locator('[data-wu-family-day]').dispatchEvent('change');
  const june = await wuRows(page);
  entry.lateJune = june;
  check(june.some((r) => r.date === '2027-06-10' && /wall calendar/.test(r.title)) && june.some((r) => r.date === '2027-06-29'), `${id}: late-June dates are off`);
  const kids = await page.locator('[data-wu-kid]').count();
  if (kids > 1) {
    const first = page.locator('[data-wu-kid]').first();
    const name = (await first.locator('span').textContent()).trim();
    await first.locator('select').selectOption('own');
    await first.locator('input[type="date"]').fill('2027-06-04');
    await first.locator('input[type="date"]').dispatchEvent('change');
    const mixed = await wuRows(page);
    entry.mixed = mixed;
    check(mixed.some((r) => r.date === '2027-06-04' && /Celebrate/.test(r.title) && r.title.includes(name)), `${id}: ${name}'s own last day has no celebration`);
    check(mixed.some((r) => r.date === '2027-06-24' && /Celebrate/.test(r.title)), `${id}: the others lost their celebration`);
    await page.screenshot({ path: join(out, `${id}-may-plan-mixed.png`), fullPage: true });
    await first.locator('select').selectOption('family');
  }

  // Three days away: nothing overdue, trips combined.
  await page.locator('[data-wu-family-day]').fill(localDay(3));
  await page.locator('[data-wu-family-day]').dispatchEvent('change');
  const soon = await wuRows(page);
  entry.threeDays = soon;
  check(soon.every((r) => r.date >= localDay(0)), `${id}: three days out shows something before today`);
  check(await page.locator('[data-wu-timing]').isVisible() && /a few things moved|just what matters/.test(await page.locator('[data-wu-timing]').textContent()), `${id}: no gentle note for a close last day`);
  await page.screenshot({ path: join(out, `${id}-may-plan-three-days.png`), fullPage: true });

  // Already over: only the after-school closeout, from today.
  await page.locator('[data-wu-family-day]').fill(localDay(-6));
  await page.locator('[data-wu-family-day]').dispatchEvent('change');
  const over = await wuRows(page);
  entry.over = over;
  check(over.every((r) => r.phase === 'after' && r.date >= localDay(0)), `${id}: a finished school year still shows before-tasks or past dates`);
  check(/School’s out/.test(await page.locator('[data-wu-timing]').textContent()), `${id}: no note that school's out`);

  // Edit: date, owner, wording, remove, add, check off; new suggestions and a reload keep it; "Use the suggested dates" clears her date.
  await page.locator('[data-wu-family-day]').fill('2027-06-15');
  await page.locator('[data-wu-family-day]').dispatchEvent('change');
  const row = page.locator('[data-wu-group="before"] .wu-row').first();
  await row.locator('input[type="date"]').fill('2027-06-03');
  await row.locator('input[type="date"]').dispatchEvent('change');
  await row.locator('textarea').fill('Write every school event on the calendar');
  await row.locator('textarea').blur();
  await page.locator('[data-wu-group="before"] .wu-row').first().locator('input[type="checkbox"]').check();
  const removed = await page.locator('[data-wu-group="after"] .wu-row textarea').last().inputValue();
  await page.locator('[data-wu-group="after"] .wu-row').last().getByRole('button', { name: /^Remove/ }).click();
  await page.locator('[data-wu-add-title]').fill('Thank-you note for the teacher');
  await page.locator('[data-wu-add]').click();
  const edited = await wuRows(page);
  check(edited.some((r) => r.date === '2027-06-03' && r.title === 'Write every school event on the calendar') && edited.some((r) => r.title === 'Thank-you note for the teacher') && !edited.some((r) => r.title === removed), `${id}: edits didn't apply`);
  await page.locator('[data-wu-fresh]').click();
  await page.reload();
  await page.locator('.wu-row').first().waitFor();
  const kept = await wuRows(page);
  check(JSON.stringify(kept) === JSON.stringify(await wuRows(page)) && kept.some((r) => r.date === '2027-06-03' && r.title === 'Write every school event on the calendar') && kept.some((r) => r.title === 'Thank-you note for the teacher') && !kept.some((r) => r.title === removed), `${id}: edits didn't survive new suggestions and a reload`);
  check(await page.locator('[data-wu-group="before"] .wu-row').first().locator('input[type="checkbox"]').isChecked(), `${id}: a checked task came back unchecked`);
  await page.locator('[data-wu-reset-dates]').click();
  const reset = await wuRows(page);
  check(reset.some((r) => r.date === '2027-06-01' && r.title === 'Write every school event on the calendar'), `${id}: "Use the suggested dates" didn't restore the suggestion`);

  // Print: the family's plan on one page, then one child's.
  check(await page.evaluate(() => [...document.querySelectorAll('.wu-sheet')].every((s) => s.scrollHeight <= s.clientHeight + 1)), `${id}: a printout runs off its page`);
  const familySheets = await page.locator('.wu-sheet').count();
  entry.familyPages = familySheets;
  const fam = (await page.locator('.wu-sheet').allTextContents()).join(' ');
  check(fam.includes('Our School Year Wrap-Up') && fam.includes('Before school ends') && fam.includes('After school ends') && fam.includes('Last day of school: Tuesday, June 15') && fam.includes('not school deadlines'), `${id}: the family plan is missing its parts`);
  check(await page.locator('.wu-sheet .wu-sheet-box').count() >= 5, `${id}: the plan has too few checkboxes`);
  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await page.click('[data-wu-download]');
  await page.waitForTimeout(3000);
  check(downloads.length >= 1, `${id}: no plan downloaded`);
  for (const [i, d] of downloads.entries()) await d.saveAs(join(out, `${id}-may-plan-family-${i + 1}.png`));
  const options = await page.locator('[data-wu-print-for] option').allTextContents();
  if (options.length > 1) {
    await page.locator('[data-wu-print-for]').selectOption({ index: options.length - 1 });
    const one = (await page.locator('.wu-sheet').allTextContents()).join(' ');
    entry.childPages = await page.locator('.wu-sheet').count();
    check(entry.childPages === 1, `${id}: one child's plan took ${entry.childPages} pages`);
    check(/School Year Wrap-Up/.test(one) && !one.includes('Finish the school forms'), `${id}: one child's plan includes the grown-ups' forms`);
    const before = downloads.length;
    await page.click('[data-wu-download]');
    await page.waitForTimeout(2500);
    if (downloads[before]) await downloads[before].saveAs(join(out, `${id}-may-plan-child.png`));
    await page.locator('[data-wu-print-for]').selectOption('family');
  }
  check(await page.locator('dialog.tool-email-dialog').count() === 0, `${id}: the builder asked for an email`);
  await page.click('[data-wu-copy]');
  await page.waitForTimeout(200);
  const copied = await page.locator('[data-wu-status]').textContent();
  const fallback = await page.locator('[data-wu-copy-fallback]').inputValue();
  check(/^Copied/.test(copied) || (fallback.includes('BEFORE SCHOOL ENDS') && fallback.includes('AFTER THE LAST DAY')), `${id}: copying the plan didn't work`);
  await page.screenshot({ path: join(out, `${id}-may-builder-phone.png`), fullPage: true });
  await page.getByRole('link', { name: /^← Back to/ }).click();
  await page.waitForURL(/\/club\/kits\/2027-05/);
  check(errors.length === 0, `${id}: May page errors: ${errors.join(' | ')}`);
  report.push(entry);
  await ctx.close();
}

// A grown-up with no children on the profile: the builder asks for a child instead of planning nothing.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(mayUrl('hughes'));
  await page.getByRole('heading', { name: 'Our School Year Wrap-Up' }).waitFor();
  await page.getByRole('button', { name: 'Build Our School Year Plan', exact: true }).click();
  await page.locator('[data-wu-timing]').waitFor();
  check(/Add a child/.test(await page.locator('[data-wu-timing]').textContent()) && await page.locator('.wu-row').count() === 0, 'hughes: a family without children should be asked to add one');
  await page.getByRole('button', { name: '+ School-age child' }).click();
  await page.locator('.wu-row').first().waitFor();
  report.push({ mayNoChildren: 'ok' });
  await ctx.close();
}

// No family profile: one adult and one child to start; a date gives a plan; adding a teen adds their own tasks.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/club/tools/school-wrap-up?sample=new`);
  await page.locator('.wu-row').first().waitFor();
  check((await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value))).join() === 'Adult 1,Child 1', 'no profile: the builder should start with one adult and one child');
  await page.locator('[data-wu-family-day]').fill('2027-06-10');
  await page.locator('[data-wu-family-day]').dispatchEvent('change');
  await page.getByRole('button', { name: '+ Teen' }).click();
  const rows = await wuRows(page);
  check(rows.some((r) => /locker/.test(r.title) && r.owner.startsWith('Teen')), `no profile: the teen got no tasks of their own (${rows.map((r) => r.owner).join(', ')})`);
  check(await wuAllowed(page), 'no profile: a task went to someone who can’t own it');
  report.push({ wrapNoProfile: rows.length });
  await ctx.close();
}

// Two families in one browser, May: one family's plan never shows up in the other's.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(mayUrl('rivera'));
  await page.getByRole('button', { name: 'Build Our School Year Plan', exact: true }).click();
  await page.locator('.wu-row').first().waitFor();
  await page.locator('[data-wu-add-title]').fill('Rivera secret task');
  await page.locator('[data-wu-add]').click();
  await page.locator('[data-wu-family-day]').fill('2027-06-09');
  await page.locator('[data-wu-family-day]').dispatchEvent('change');
  await page.goto(mayUrl('okafor'));
  await page.getByRole('button', { name: 'Build Our School Year Plan', exact: true }).click();
  await page.locator('.wu-row').first().waitFor();
  const names = await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value));
  const rows = await wuRows(page);
  check(!names.includes('Ana') && names.includes('Zara') && !rows.some((r) => r.title === 'Rivera secret task') && await page.locator('[data-wu-family-day]').inputValue() === '', `leak: the Okafors’ wrap-up shows the Riveras’ (${names.join(', ')})`);
  await page.goto(`${base}/club/tools/school-wrap-up?sample=brooks`);
  await page.locator('.wu-row').first().waitFor();
  const direct = await page.locator('[data-hp-name]').evaluateAll((els) => els.map((e) => e.value));
  check(!direct.includes('Zara') && !direct.includes('Ana'), `leak: the wrap-up builder opened by address as Brooks shows another family (${direct.join(', ')})`);
  report.push({ mayLeakCheck: 'ok' });
  await ctx.close();
}

// Two families in one browser: nothing one does shows up in the other's kit or tools.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/club/kits/2027-10-home-works-together?sample=rivera`);
  await page.getByRole('heading', { name: 'Our Fall Home Reset' }).waitFor();
  await page.locator('section[aria-labelledby="club-action"] .club-screen ol > li input[type="checkbox"]').first().check();
  await page.getByText('1 of 5 done').waitFor();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Make a Family Chore Chart', exact: true }).click();
  await page.locator('section[aria-labelledby="club-tool"] .btn-secondary').first().click();
  await page.waitForSelector('#chore-chart');
  await page.waitForFunction(() => document.querySelector('[data-cc-name]')?.value);
  const riveraKid = await page.inputValue('[data-cc-name]');
  // Brooks, same browser: their own reset, and a chore chart opened straight from its address carries nobody over.
  await page.goto(`${base}/club/kits/2027-10-home-works-together?sample=brooks`);
  await page.getByRole('heading', { name: 'Our Fall Home Reset' }).waitFor();
  check(await page.getByText('0 of 5 done').count() === 1, 'leak: Rivera’s checked line shows in Brooks’s reset');
  await page.goto(`${base}/club/tools/chore-chart?sample=brooks`);
  await page.waitForSelector('#chore-chart');
  const name = await page.inputValue('[data-cc-name]');
  check(name !== riveraKid, `leak: Brooks’s chore chart opened with Rivera’s ${riveraKid}`);
  report.push({ leakCheck: { riveraKid, brooksOpenedWith: name } });
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
