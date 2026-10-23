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
