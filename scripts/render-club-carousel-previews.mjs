/**
 * Renders the /club monthly carousel previews from the real member printables, filled in for one sample household.
 *
 * Each month's own page (/app/club/<month>, November's kit page) is opened with ?sample=rivera (src/data/club/samples.ts),
 * switched to print media so the sheet looks exactly as it prints (no editing pencils or controls), and the sheet
 * element is captured at 2x and saved as WebP. Nothing about the printables, their generators or the PDFs changes:
 * this only photographs what a member would see for that family. The crops shown on /club live in
 * src/data/club/carousel-previews.ts.
 *
 * Run against a dev or preview server with the Club switched on:
 *   PUBLIC_CLUB_ENABLED=true npx astro dev --port 4321
 *   node scripts/render-club-carousel-previews.mjs http://localhost:4321
 *
 * Exits 1 if a sheet is missing or doesn't show the names expected for that month.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import sharp from 'sharp';

const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const sample = 'rivera';
const outDir = 'public/images/club/carousel';
mkdirSync(outDir, { recursive: true });

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    // A globally installed Playwright is reachable through require (NODE_PATH), not through import.
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    ({ chromium } = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core'));
  }
}

/** Which page, which sheet, and the sample names that sheet must show. */
const months = [
  { month: 'january', path: '/app/club/january', sheet: '[data-plan-sheet]', expect: ['Sofia', 'Mateo', 'Elena'] },
  { month: 'february', path: '/app/club/february', sheet: '[data-plan-sheet]', expect: ['Mateo', 'Elena'] },
  { month: 'march', path: '/app/club/march', sheet: '[data-plan-sheet]', expect: ['Sofia'] },
  { month: 'april', path: '/app/club/april', sheet: '[data-plan-sheet]', expect: ['Sofia', 'Mateo'] },
  { month: 'may', path: '/app/club/may', sheet: '[data-plan-sheet]', expect: ['RIVERA'] },
  { month: 'june', path: '/app/club/june', sheet: '[data-plan-sheet]', expect: ['Sofia', 'Mateo', 'Elena'] },
  { month: 'july', path: '/app/club/july', sheet: '[data-plan-sheet]', expect: ['Sofia'] },
  { month: 'august', path: '/app/club/august', sheet: '[data-plan-sheet]', expect: ['Sofia'] },
  { month: 'september', path: '/app/club/september', sheet: '[data-plan-sheet]', expect: ['Sofia', 'Mateo'] },
  { month: 'october', path: '/app/club/october', sheet: '[data-plan-sheet]', expect: ['Sofia'] },
  { month: 'november', path: '/club/kits/2026-11-family-ownership', sheet: '.ws-sheet', expect: ['Sofia', 'Mateo'] },
  { month: 'december', path: '/app/club/december', sheet: '[data-plan-sheet]', expect: ['Sofia', 'Mateo', 'Elena'] },
];

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const failures = [];

for (const m of months) {
  // A fresh context per month: each sample session starts clean, as a member's first visit would.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`${base}${m.path}?sample=${sample}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  // Some printables are client-rendered (November's kit is a React island): wait for the sheet itself.
  await page.waitForSelector(m.sheet, { state: 'visible', timeout: 15000 }).catch(() => {});
  await page.emulateMedia({ media: 'print' });
  // Print media applies each sheet's own print rules (no pencils, underlines or hints). Some pages print through a
  // separate print target and hide the on-screen sheet; keep the sheet itself visible so it can be captured.
  await page.addStyleTag({ content: `${m.sheet},${m.sheet} *{visibility:visible!important}` });
  await page.waitForTimeout(800);
  const sheets = await page.$$(m.sheet);
  let sheet = null;
  for (const s of sheets) if (await s.isVisible()) { sheet = s; break; }
  if (!sheet) { failures.push(`${m.month}: no visible ${m.sheet}`); await context.close(); continue; }
  const text = await sheet.innerText();
  const missing = m.expect.filter((n) => !text.includes(n));
  if (missing.length) failures.push(`${m.month}: sheet is missing ${missing.join(', ')}`);
  const png = await sheet.screenshot({ type: 'png' });
  const file = join(outDir, `${sample}-${m.month}.webp`);
  const info = await sharp(png).webp({ quality: 82 }).toFile(file);
  console.log(`${m.month}: ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB`);
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error('\n' + failures.join('\n'));
  process.exit(1);
}
