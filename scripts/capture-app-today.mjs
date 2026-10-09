/**
 * Captures the companion app's Today screen once per weekday for the homepage hero
 * (public/images/site/app-today-<dow>-<390|780>.webp), with the date line blanked out.
 * The homepage writes the visitor's real date over that blank (src/components/site/LiveTodayPhone.astro),
 * so the phone always shows today with today's real cleaning zone.
 *
 * Also writes src/data/app-today-shot.json: where the blanked date lines sit and how they're set.
 *
 * Run against a production build (retake whenever the Today screen changes):
 *   npm run build && npx astro preview --port 4321 &
 *   npm i --no-save playwright && node scripts/capture-app-today.mjs [http://localhost:4321]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const W = 390;
const H = 844;
const DOWS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// One October 2026 week, Mon 5 – Sun 11, so every shot carries the same month accent.
const FOCUS = { mon: ['mon-items', 'mon-surfaces'], tue: ['tue-clothes', 'tue-loose'], wed: ['wed-entry', 'wed-shoes'], thu: ['thu-clear', 'thu-wipe'] };

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let layout;
for (const [i, dow] of DOWS.entries()) {
  const day = new Date(2026, 9, 5 + i, 9, 0, 0);
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Sample progress: three Daily Reset tasks and two zone tasks today, a little on earlier days.
  const seed = { 'omc:v1:onboarded': '1', 'omc:v1:install-invite': 'dismissed' };
  for (let j = 0; j < i; j++) seed[`omc:v1:daily:${key(new Date(2026, 9, 5 + j))}`] = JSON.stringify(['beds', 'dishwasher']);
  seed[`omc:v1:daily:${key(day)}`] = JSON.stringify(['beds', 'dishwasher', 'counters']);
  if (FOCUS[dow]) seed[`omc:v1:focus:${key(day)}`] = JSON.stringify(FOCUS[dow]);

  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.clock.setFixedTime(day);
  await page.addInitScript((s) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  const lines = page.locator('main h1 > span');
  await lines.first().waitFor();
  if (!layout) {
    layout = await lines.evaluateAll((els, size) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        // Everything as a fraction of the screen, so the overlay scales with the image.
        return {
          left: r.left / size.w,
          top: r.top / size.h,
          fontSize: parseFloat(cs.fontSize) / size.w,
          letterSpacing: parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) || 0,
          lineHeight: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1,
        };
      }),
    { w: W, h: H });
  }
  await page.addStyleTag({ content: 'main h1 > span { color: transparent !important; }' });
  const png = await page.screenshot();
  for (const w of [390, 780]) {
    await sharp(png).resize(w).webp({ quality: 86 }).toFile(`public/images/site/app-today-${dow}-${w}.webp`);
  }
  console.log('captured', dow, key(day));
  await page.close();
}
await browser.close();
const [weekdayLine, monthLine] = layout;
writeFileSync('src/data/app-today-shot.json', JSON.stringify({ width: W, height: H, weekdayLine, monthLine }, null, 2) + '\n');
console.log('layout', layout);
