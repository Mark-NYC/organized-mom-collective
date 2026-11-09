/**
 * March's Spring Clean as a Team at print size (docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md → Phase 3b): every sample
 * family in every room, printed as real US Letter PDFs. Checks: exactly two pages (front, back), nothing cut off on
 * either sheet (the printable marks a sheet data-scl-overflow when it measures one), every icon loads, no script
 * errors. With --shots=<dir>, also writes each sample's prepared front and back as PNGs at 110 dpi to look at.
 *
 *   npx astro build && npx astro preview --port 4329
 *   node scripts/march-spring-clean-qa.mjs [http://localhost:4329] [--shots=dir]
 *
 * Needs Playwright with Chromium (`require('playwright')`) and poppler's pdfinfo/pdftoppm. Exits 1 on any failure.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:4329';
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8) ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SAMPLES = ['hughes', 'okafor', 'brooks', 'rivera', 'chen', 'lindqvist', 'goering'];
const ROOMS = ['Kitchen', 'Living room', 'Dining room', 'Bathroom', 'Bedrooms', 'Entryway or mudroom', 'Laundry area', 'Playroom', 'Home office', 'Closets', 'Another space'];

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  if (!ok || process.env.QA_VERBOSE) console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` · ${detail}` : ''}`);
};
const pdfPages = (page, path) => page.emulateMedia({ media: 'print' })
  .then(() => page.pdf({ path, format: 'Letter', printBackground: true }))
  .then(() => page.emulateMedia({ media: 'screen' }))
  .then(() => Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [path]).toString())[1]));

const browser = await chromium.launch();
let printed = 0;
for (const sample of SAMPLES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/app/club/march/spring-clean?sample=${sample}`, { waitUntil: 'networkidle' });
  const ready = await page.waitForSelector('.club-plan[data-plan-state="ready"]', { timeout: 15000 }).then(() => true, () => false);
  check(`${sample}: opens`, ready);
  if (!ready) { await page.close(); continue; }
  await page.waitForTimeout(500);
  const sheetState = () => page.evaluate(() => ({
    sheets: [...document.querySelectorAll('[data-plan-sheet]')].map((s) => s.dataset.planSheet),
    cut: [...document.querySelectorAll('[data-plan-sheet][data-scl-overflow]')].map((s) => s.dataset.planSheet),
    broken: [...document.querySelectorAll('[data-plan-sheet] img')].filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute('src')),
    room: document.querySelector('[data-scl]').clubPlan.view().room.label,
  }));
  // The prepared project first.
  const file = `${SHOTS ?? tmpdir()}/spring-clean-${sample}.pdf`;
  const pages = await pdfPages(page, file);
  const s0 = await sheetState();
  check(`${sample} (${s0.room}, prepared): two sheets, front then back`, s0.sheets.join() === 'front,back', s0.sheets.join());
  check(`${sample} (${s0.room}, prepared): prints two Letter pages`, pages === 2, `${pages}`);
  check(`${sample} (${s0.room}, prepared): nothing cut off`, s0.cut.length === 0, s0.cut.join());
  check(`${sample} (${s0.room}, prepared): every icon loads`, s0.broken.length === 0, s0.broken.join(' '));
  if (SHOTS) execFileSync('pdftoppm', ['-r', '110', '-png', file, `${SHOTS}/spring-clean-${sample}`]);
  printed++;
  // Then every room.
  for (const room of ROOMS) {
    await page.evaluate(() => document.querySelector('[data-scl]').clubPlan.openEditor('room'));
    await page.locator('dialog[open] .cp-chip', { hasText: room }).first().click();
    await page.locator('dialog[open] [data-scl-close]').first().click();
    await page.waitForTimeout(150);
    const st = await sheetState();
    const n = await pdfPages(page, `${tmpdir()}/spring-clean-room.pdf`);
    check(`${sample} / ${room}: two pages, nothing cut off, icons load`, n === 2 && st.cut.length === 0 && st.broken.length === 0, `${n} pages; cut ${st.cut.join() || '-'}; broken ${st.broken.length}`);
    printed++;
  }
  check(`${sample}: no script errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} check(s) failed (${printed} plans printed)` : `\nAll checks passed (${printed} plans printed)`);
process.exit(failures ? 1 : 0);
