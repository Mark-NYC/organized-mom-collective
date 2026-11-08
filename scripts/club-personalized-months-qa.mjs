/**
 * Browser QA for the three months on the shared personalization foundation (March, May, August;
 * docs/club/PERSONALIZATION_FOUNDATION.md). Run by hand on a build (never part of npm run verify):
 *
 *   npx astro build --outDir /tmp/dist
 *   node scripts/club-personalized-months-qa.mjs /tmp/dist /tmp/months-qa
 *
 * For each month and sample family (one child, two school-aged children, mixed ages, several grown-ups, limited or
 * no profile): the plan page at desktop (1440) and phone (390) widths, the family's names on the sheets, every sheet
 * inside its page (nothing clipped, no picture cut off), a US Letter PDF with one page per sheet, then an edit on the
 * phone (who does a job), the change on the printed sheet, approval, and the change still there after a reload.
 * Writes PDFs, PNGs and report.json to the output folder; exits 1 on any failure.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
// Playwright is not a dependency: use the one installed globally (NODE_PATH=$(npm root -g)) or `npm i --no-save playwright`.
const { chromium } = createRequire(import.meta.url)('playwright');

const [dist, out = 'months-qa'] = process.argv.slice(2);
if (!dist || !existsSync(join(dist, 'app', 'club'))) {
  console.error('Usage: node scripts/club-personalized-months-qa.mjs <dist> [out]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = [join(dist, path), join(dist, path, 'index.html'), join(dist, `${path}.html`)].find((f) => existsSync(f) && statSync(f).isFile());
  if (!file) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const pdfPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

// Which names must print, per family (the people with a part that month).
const FAMILIES = {
  okafor: { shows: 'one child (a preschooler), two grown-ups', names: { march: ['Zara', 'Ada', 'Tunde'], may: ['Zara'], august: ['Zara', 'Ada', 'Tunde'] } },
  brooks: { shows: 'two school-aged children, one grown-up, no profile answers', names: { march: ['Max', 'Lily', 'Jess'], may: ['Max', 'Lily'], august: ['Max', 'Lily', 'Jess'] } },
  rivera: { shows: 'mixed ages (11, 8, 5), two grown-ups, full profile', names: { march: ['Sofia', 'Mateo', 'Elena', 'Ana', 'Luis'], may: ['Sofia', 'Mateo', 'Elena'], august: ['Sofia', 'Mateo', 'Elena', 'Ana', 'Luis'] } },
  chen: { shows: 'four children 6–17, three grown-ups', names: { march: ['Grace', 'Owen', 'Ivy', 'Leo', 'Mei', 'David', 'Lin'], may: ['Grace', 'Owen', 'Ivy', 'Leo'], august: ['Grace', 'Owen', 'Ivy', 'Leo', 'Mei', 'David', 'Lin'] } },
  goering: { shows: 'limited profile: names and ages only', names: { march: ['Andrew', 'Philip', 'Mark', 'Megan'], may: ['Andrew', 'Philip'], august: ['Andrew', 'Philip'] } },
  hughes: { shows: 'no children yet', names: { march: ['Claire'], may: [], august: [] } },
};
const MONTHS = ['march', 'may', 'august'];
const report = [];
let failed = 0;
const fail = (r, msg) => { r.problems.push(msg); failed++; };

const browser = await chromium.launch();
for (const month of MONTHS) {
  for (const [sample, fam] of Object.entries(FAMILIES)) {
    const r = { month, sample, shows: fam.shows, problems: [], sheets: 0, pages: 0 };
    report.push(r);
    const url = `${base}/app/club/${month}?sample=${sample}`;
    // Desktop: sheets, names, fit, PDF.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('.club-plan[data-plan-state="ready"]', { timeout: 15000 }).catch(() => fail(r, 'never ready'));
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const sheets = [...document.querySelectorAll('[data-plan-sheet]')].filter((s) => s.closest('[data-plan-proof-body]') && !s.closest('[data-cp-thumb]'));
      return {
        sheets: sheets.map((s) => s.dataset.planSheet),
        ends: sheets.filter((s) => s.hasAttribute('data-plan-sheet-end')).length,
        text: sheets.map((s) => s.textContent).join(' '),
        clipped: sheets.flatMap((s) => {
          const box = s.getBoundingClientRect();
          const scale = box.width / (Number(s.dataset.planWidth) || 816);
          return [...s.querySelectorAll('h2,h3,strong,span,p,li,img,time,.msr-row,.mfr-row,.asr-row')].filter((el) => {
            const b = el.getBoundingClientRect();
            if (!b.width || !b.height || getComputedStyle(el).visibility === 'hidden') return false;
            if (b.bottom > box.bottom + 1 * scale || b.right > box.right + 1 * scale || b.top < box.top - 1 || b.left < box.left - 1) return true;
            // Cut off by a box inside the sheet (a panel or row that hides its overflow).
            for (let a = el.parentElement; a && a !== s; a = a.parentElement) {
              const cs = getComputedStyle(a);
              if (cs.overflow === 'visible' && cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
              const r = a.getBoundingClientRect();
              if (b.bottom > r.bottom + 1 || b.right > r.right + 1) return true;
            }
            return false;
          }).slice(0, 3).map((el) => `${s.dataset.planSheet}: ${el.tagName} “${(el.textContent || el.getAttribute('src') || '').slice(0, 40)}”`);
        }),
        images: sheets.flatMap((s) => [...s.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src'))),
        cue: (() => { const c = sheets.map((s) => s.querySelector('.hc-cue')).find(Boolean); if (!c) return null; const cs = getComputedStyle(c); const l = getComputedStyle(c.querySelector('.hc-cue-label')); const i = c.querySelector('img'); return [cs.backgroundColor, cs.color, cs.fontSize, cs.fontFamily.split(',')[0], cs.paddingLeft, cs.paddingRight, cs.borderRadius, l.fontSize, l.letterSpacing, l.textTransform, i?.getAttribute('src')?.includes('clock'), Math.round(i?.getBoundingClientRect().width / (sheets[0].getBoundingClientRect().width / (Number(sheets[0].dataset.planWidth) || 816)))].join('|'); })(),
        mom: /\bMom\b/.test(sheets.map((s) => s.textContent).join(' ')),
        rewards: /\b(points?|stars?|streaks?|rewards?)\b|%/i.test(sheets.map((s) => s.textContent).join(' ')),
      };
    });
    r.sheets = info.sheets.length;
    r.cueStyle = info.cue;
    r.sheetIds = info.sheets;
    if (!info.sheets.length) fail(r, 'no sheets');
    if (info.ends !== 1) fail(r, `${info.ends} sheets marked as the last`);
    for (const n of fam.names[month]) if (!info.text.includes(n)) fail(r, `${n} isn’t on the sheets`);
    if (info.clipped.length) fail(r, `clipped: ${info.clipped.join('; ')}`);
    if (info.images.length) fail(r, `broken images: ${info.images.join(', ')}`);
    if (info.mom) fail(r, 'a sheet says “Mom”');
    if (month === 'march' && info.rewards) fail(r, 'rewards language on the family rhythm');
    await page.screenshot({ path: join(out, `${month}-${sample}-desktop.png`), fullPage: false });
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    writeFileSync(join(out, `${month}-${sample}.pdf`), pdf);
    r.pages = pdfPages(pdf);
    if (r.pages !== r.sheets) fail(r, `PDF has ${r.pages} pages for ${r.sheets} sheets`);
    await page.emulateMedia({ media: 'screen' });
    if (errors.length) fail(r, `errors: ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();

    // Phone: the plan screen, an edit, the change on the sheet, approval, and the change after a reload.
    try {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForSelector('.club-plan[data-plan-state="ready"]', { timeout: 15000 }).catch(() => fail(r, 'phone never ready'));
    await p.waitForTimeout(400);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (wide > 1) fail(r, `phone scrolls sideways by ${wide}px`);
    await p.screenshot({ path: join(out, `${month}-${sample}-phone.png`), fullPage: true });
    const fp = () => p.evaluate(() => document.querySelector('[data-mfr], .msr, .asr').clubPlan.fingerprint());
    const before = await fp();
    // The first row in the month's own section that opens an edit sheet with owner chips (or a chart editor).
    const rows = p.locator('[data-plan-screen] .cp-section .cp-row:not([disabled]):visible');
    let edited = false;
    for (let i = 0; i < Math.min(await rows.count(), 6) && !edited; i++) {
      await rows.nth(i).click({ timeout: 5000 });
      await p.waitForTimeout(700);
      // March opens one moment, then one job, before any owner choices show.
      if (month === 'march' && await p.locator('[data-cp-sheet] .mre-btn', { hasText: 'Edit responsibilities' }).count()) {
        await p.locator('[data-cp-sheet] .mre-btn', { hasText: 'Edit responsibilities' }).first().evaluate((b) => b.click());
        await p.waitForTimeout(250);
        await p.locator('[data-cp-sheet] .mre-row button', { hasText: 'Edit' }).first().evaluate((b) => b.click());
        await p.waitForTimeout(250);
      }
      const chip = p.locator('[data-cp-sheet] .po-chip[aria-pressed="false"]:not([disabled]), [data-cp-sheet] .mre-chip:not(.mre-chip--job)[aria-pressed="false"]:not([disabled])').first();
      if (await chip.count()) {
        await chip.evaluate((b) => b.click());
        await p.waitForTimeout(150);
        const done = p.locator('[data-cp-sheet] .mre-btn--dark', { hasText: 'Done' });
        if (await done.count()) await done.first().evaluate((b) => b.click());
        edited = true;
        await p.waitForTimeout(250);
      }
      // Done (the sheet's own button may be below the fold): close it as Done does.
      await p.evaluate(() => document.querySelector('[data-cp-sheet]')?.close());
      await p.waitForTimeout(150);
    }
    const after = await fp();
    r.phoneEdit = edited ? (before !== after ? 'changed the sheet' : 'no change') : 'nothing to edit';
    if (edited && before === after) fail(r, 'a phone edit didn’t change the printed sheet');
    if (edited) {
      await p.evaluate(() => document.querySelector('[data-plan-screen] [data-plan-primary]')?.click());
      await p.waitForTimeout(200);
      const approved = await p.locator('[data-plan-screen]').getAttribute('data-approval');
      if (approved !== 'approved') fail(r, `approval reads ${approved}`);
      await p.reload({ waitUntil: 'networkidle' });
      await p.waitForSelector('.club-plan[data-plan-state="ready"]');
      await p.waitForTimeout(400);
      if ((await fp()) !== after) fail(r, 'the edit didn’t survive a reload');
      const still = await p.locator('[data-plan-screen]').getAttribute('data-approval');
      if (still !== 'approved') fail(r, `approval after reload reads ${still}`);
    }
    await phone.close();
    } catch (e) { fail(r, `phone: ${String(e.message).split('\n')[0]}`); }
    console.log(`${r.problems.length ? '✗' : '✓'} ${month} ${sample}: ${r.sheets} sheets, ${r.pages} PDF pages, phone ${r.phoneEdit}${r.problems.length ? `\n    ${r.problems.join('\n    ')}` : ''}`);
  }
}
await browser.close();
server.close();
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
// The WHEN cue must look the same in every month.
const styles = [...new Set(report.map((r) => r.cueStyle).filter(Boolean))];
console.log(`WHEN cue styles across months: ${styles.length === 1 ? 'identical' : `DIFFERENT\n  ${styles.join('\n  ')}`}`);
if (styles.length > 1) failed++;
console.log(failed ? `\n${failed} problem(s)` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
