/**
 * Browser QA for the November worksheet generator (/club/worksheet-generator). Run after `npm run build`:
 *
 *   node scripts/worksheet-qa.mjs [out-dir]
 *
 * Serves dist/ with the Club's production Content-Security-Policy (public/_headers), then in Chromium:
 * every form field, presets, short / long / blank entries, a real PDF download per case (2 pages, 612 × 792 pt,
 * fonts embedded, the typed text present), each PDF page rendered to PNG (pdftoppm) and diffed against the
 * on-screen preview drawn at the same size, and the phone layout. Exits non-zero on any failure.
 * Needs Playwright (preinstalled in cloud sessions, else `npm i --no-save playwright`) and poppler-utils.
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = await import('playwright'));
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = process.argv[2] ?? join(root, 'worksheet-qa');
mkdirSync(out, { recursive: true });

const headers = readFileSync(join(root, 'public/_headers'), 'utf8');
const csp = /\/club\/\*\n\s+Content-Security-Policy: (.+)/.exec(headers)?.[1];
if (!csp) throw new Error('no /club/* CSP in public/_headers');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(dist, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  else if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file)) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', ...(path.startsWith('/club/') ? { 'content-security-policy': csp } : {}) });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const URL_PATH = '/club/worksheet-generator/';

const failures = [];
const results = [];
const check = (ok, what) => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

const browser = await chromium.launch();

async function open(viewport, opts = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + URL_PATH);
  await page.waitForFunction(() => document.querySelectorAll('.ws-sheet svg').length === 2 && !document.querySelector('#ws-download').disabled);
  await page.evaluate(() => document.fonts.ready);
  return { context, page, errors };
}

const svgText = (page, i) => page.$eval(`.ws-sheet[data-page="${i}"] svg`, (s) => [...s.querySelectorAll('text')].map((t) => t.textContent).join(' | '));

async function fill(page, c) {
  await page.fill('#ws-family', c.familyName ?? '');
  await page.fill('#ws-owner', c.owner ?? '');
  if (c.preset !== undefined) await page.selectOption('#ws-job', String(c.preset));
  if (c.job !== undefined) {
    await page.selectOption('#ws-job', 'custom');
    await page.fill('#ws-custom', c.job);
  }
  if (c.when !== undefined) await page.fill('#ws-when', c.when);
  if (c.done !== undefined) await page.fill('#ws-done', c.done);
  await page.fill('#ws-checkin', c.checkIn ?? '');
  await page.waitForTimeout(150);
}

/** Download, verify the file, render its pages, and diff them against the preview drawn at the same size. */
async function downloadAndCompare(page, name, expectText, button = '#ws-download') {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(button)]);
  const file = join(out, `${name}.pdf`);
  await dl.saveAs(file);
  check(/^november-i-own-this-job[a-z0-9-]*\.pdf$/.test(dl.suggestedFilename()), `${name}: file name ${dl.suggestedFilename()}`);
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  check(/Pages:\s+2\n/.test(info), `${name}: exactly 2 pages`);
  const sizes = execFileSync('pdfinfo', ['-f', '1', '-l', '2', file], { encoding: 'utf8' }).match(/Page\s+\d+ size:\s+([\d.]+) x ([\d.]+)/g) ?? [];
  check(sizes.length === 2 && sizes.every((s) => /612 x 792/.test(s)), `${name}: both pages 8.5 × 11 in (612 × 792 pt)`);
  const fonts = execFileSync('pdffonts', [file], { encoding: 'utf8' }).split('\n').slice(2).filter(Boolean);
  check(fonts.length > 0 && fonts.every((l) => /\byes\b/.test(l.split(/\s+/).slice(-5).join(' '))), `${name}: all ${fonts.length} fonts embedded`);
  const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  for (const t of expectText) check(text.includes(t), `${name}: PDF text includes “${t}”`);

  // Render the PDF at 144 dpi, and the preview's SVGs at the same 1224 × 1584 px, then compare.
  execFileSync('pdftoppm', ['-r', '144', '-png', file, join(out, `${name}-pdf`)]);
  const svgs = await page.$$eval('.ws-sheet svg', (els) => els.map((e) => e.outerHTML));
  const fontCss = await page.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } }).filter((r) => r.cssText.startsWith('@font-face') && r.cssText.includes('WS ')).map((r) => r.cssText).join('\n'));
  const shot = await page.context().newPage();
  await shot.setViewportSize({ width: 1224, height: 1584 });
  for (let i = 0; i < 2; i++) {
    await shot.goto(base + URL_PATH); // same origin, so the @font-face URLs resolve
    await shot.setContent(`<!doctype html><style>${fontCss}html,body{margin:0}svg{display:block;width:1224px;height:1584px}</style>${svgs[i]}`);
    await shot.evaluate(() => document.fonts.ready);
    await shot.waitForTimeout(100);
    const previewPng = join(out, `${name}-preview-${i + 1}.png`);
    await shot.screenshot({ path: previewPng });
    const pdfPng = join(out, `${name}-pdf-${i + 1}.png`);
    const [a, b] = await Promise.all([previewPng, pdfPng].map((p) => sharp(p).resize(1224, 1584, { fit: 'fill' }).greyscale().blur(1.2).raw().toBuffer()));
    let differ = 0;
    for (let k = 0; k < a.length; k++) if (Math.abs(a[k] - b[k]) > 48) differ++;
    const pct = (differ / a.length) * 100;
    check(pct < 0.5, `${name}: page ${i + 1} PDF matches preview (${pct.toFixed(3)}% of pixels differ)`);
    // Nothing printed inside the 0.5 in safe margin (72 px at 144 dpi; 6 px tolerance for antialiasing).
    const { data, info: meta } = await sharp(pdfPng).greyscale().raw().toBuffer({ resolveWithObject: true });
    let edge = 0;
    for (let y = 0; y < meta.height; y++) for (let x = 0; x < meta.width; x++) {
      const inside = x >= 66 && x < meta.width - 66 && y >= 66 && y < meta.height - 66;
      if (!inside && data[y * meta.width + x] < 250) edge++;
    }
    check(edge === 0, `${name}: page ${i + 1} nothing within 0.5 in of the edge (${edge} px)`);
  }
  await shot.close();
  return text;
}

const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---- Desktop ----
{
  const { page, errors, context } = await open({ width: 1440, height: 1000 });
  await page.screenshot({ path: join(out, 'generator-desktop.png'), fullPage: true });

  // Defaults render into both pages.
  check((await svgText(page, 0)).includes('The Goering Family'), 'default family name in preview');
  check((await svgText(page, 0)).includes('Andrew'), 'default owner in preview');

  // Field by field: each change shows up in the preview.
  await page.fill('#ws-family', 'Rivera');
  await page.waitForTimeout(100);
  check((await svgText(page, 0)).includes('The Rivera Family'), 'family name → “The Rivera Family”');
  check((await page.textContent('#ws-family-hint')).includes('The Rivera Family'), 'family hint shows the printed form');
  await page.fill('#ws-family', 'The Rivera Crew');
  await page.waitForTimeout(100);
  check((await svgText(page, 0)).includes('The Rivera Crew'), 'family name typed in full stays as typed');
  await page.fill('#ws-owner', 'Sofia');
  await page.waitForTimeout(100);
  check((await svgText(page, 0)).includes('Sofia') && (await svgText(page, 1)).includes('Sofia’s name'), 'owner on both pages');
  await page.selectOption('#ws-job', '3');
  await page.waitForTimeout(100);
  check((await page.inputValue('#ws-when')) === 'Every morning, once it has finished', 'preset fills “when”');
  check((await svgText(page, 0)).includes('Empty the dishwasher'), 'preset job in preview');
  await page.fill('#ws-when', 'Before school');
  await page.selectOption('#ws-job', '1');
  check((await page.inputValue('#ws-when')) === 'Before school', 'edited “when” survives a preset change');
  await page.selectOption('#ws-job', 'custom');
  check(await page.isVisible('#ws-custom'), 'custom job field appears');
  await page.fill('#ws-custom', 'Water the plants');
  await page.waitForTimeout(100);
  check((await svgText(page, 0)).includes('Water the plants'), 'custom job in preview');
  await page.fill('#ws-done', 'Every pot watered\nand the can back by the door');
  await page.waitForTimeout(100);
  check((await svgText(page, 0)).includes('and the can back by the door'), 'line breaks kept in “finished”');
  check((await page.textContent('#ws-done-count')).includes('/ 260'), 'character counter');
  await page.click('#ws-two-weeks');
  await page.waitForTimeout(100);
  const twoWeeks = new Date(today);
  twoWeeks.setDate(twoWeeks.getDate() + 14);
  check((await page.inputValue('#ws-checkin')) === iso(twoWeeks), '“Two weeks from today” sets the date');
  check((await svgText(page, 1)).includes(twoWeeks.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })), 'check-in date on the back');
  await page.fill('#ws-checkin', '2020-01-01');
  await page.waitForTimeout(100);
  check((await page.textContent('#ws-date-hint')).includes('passed'), 'past date warns');

  const cases = [
    { name: 'short', familyName: 'Li', owner: 'Bo', preset: 0, when: 'After dinner', done: 'Table wiped.', checkIn: '2026-11-14', expect: ['The Li Family', 'Bo', 'Set and clear the dinner table', 'After dinner', 'Saturday, November 14'] },
    {
      name: 'long',
      familyName: 'Montgomery-Vanderbilt-Castellanos Household',
      owner: 'Maximiliana-Josephine',
      job: 'Plan, shop for and cook one family dinner every Sunday night, including all of the cleanup',
      when: 'Every Sunday afternoon starting at four, plus the grocery list on Friday nights',
      done: 'Menu chosen by Friday, groceries on the list, dinner on the table by six, kitchen counters wiped, dishwasher loaded and started, leftovers labeled in the fridge, and the recipe added to the family binder so we can make it again next month without anyone having to ask.',
      checkIn: '2026-11-28',
      expect: ['Maximiliana-Josephine', 'Saturday, November 28'],
    },
    { name: 'blank', familyName: '', owner: '', job: '', when: '', done: '', checkIn: '', expect: ['I own this job.', 'What went well?'] },
    { name: 'accents', familyName: 'Nuñez-Łukasiewicz 🎉', owner: 'Zoë', preset: 4, checkIn: '', expect: ['The Nuñez-', 'Lukasiewicz Family', 'Zoë', 'Keep the entryway tidy'] },
  ];
  for (const c of cases) {
    await fill(page, c);
    await downloadAndCompare(page, c.name, c.expect);
  }
  check((await page.textContent('#ws-status')).includes('Downloaded'), 'download status message');
  check(errors.length === 0, `desktop: no console errors or CSP violations${errors.length ? `: ${errors.join(' / ')}` : ''}`);
  await context.close();
}

// ---- Phone ----
{
  const { page, errors, context } = await open({ width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `phone: no sideways scroll (${overflow}px)`);
  const small = await page.$$eval('#ws-form input, #ws-form select, #ws-form textarea, #ws-download', (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.id));
  check(small.length === 0, `phone: controls at least 44 px tall${small.length ? ` (${small.join(', ')})` : ''}`);
  const inputFont = await page.$eval('#ws-family', (e) => parseFloat(getComputedStyle(e).fontSize));
  check(inputFont >= 16, 'phone: inputs 16 px (no zoom on focus)');
  await page.screenshot({ path: join(out, 'generator-phone.png'), fullPage: true });
  await page.screenshot({ path: join(out, 'generator-phone-top.png') });
  await fill(page, { familyName: 'Goering', owner: 'Andrew', preset: 0, checkIn: '2026-11-14' });
  check(await page.isVisible('.ws-jump'), 'phone: “See your worksheet” link shown');
  check(await page.isVisible('.ws-download-again'), 'phone: second Download button under the preview');
  await downloadAndCompare(page, 'phone', ['The Goering Family', 'Andrew'], '.ws-download-again');
  check(errors.length === 0, `phone: no console errors${errors.length ? `: ${errors.join(' / ')}` : ''}`);
  await context.close();
}

await browser.close();
server.close();
writeFileSync(join(out, 'results.txt'), results.join('\n') + '\n');
console.log(results.join('\n'));
console.log(`\n${results.length - failures.length}/${results.length} passed. Files in ${out}`);
process.exit(failures.length ? 1 : 0);
