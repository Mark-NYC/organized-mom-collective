/**
 * Renders IF-03's printables from src/data/chores-by-age.ts, so the files always match the article:
 *
 *   public/downloads/kids-responsibility-chart.pdf              free starter chart, US Letter landscape (vector)
 *   public/images/tools/previews/kids-responsibility-chart.webp  its on-page preview (a render of the same page)
 *   public/downloads/chores-for-kids-by-age-infographic.pdf     the age infographic, US Letter portrait (vector)
 *   public/images/pinterest/IF-03-save-1000x1500.png            the same infographic as the IF-03 save-worthy pin
 *
 * Fonts are the site's own (Kalam headings, Montserrat text, from node_modules); illustrations are the
 * Responsibility Cards originals in design/responsibilities/ (art only, never the cards' steps).
 * Rerun after changing the data or the layouts below:
 *
 *   npm i --no-save playwright && node scripts/render-printables.mjs
 *
 * Set CHROMIUM to a browser executable if Playwright's own isn't installed.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ageBands, printables } from '../src/data/chores-by-age.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Inlined as data URIs: the page is set from a string, so it can't fetch local files.
const types = { woff2: 'font/woff2', webp: 'image/webp', png: 'image/png' };
const file = (p) => `data:${types[p.split('.').pop()]};base64,${readFileSync(join(root, p)).toString('base64')}`;
const out = (p) => {
  const path = join(root, 'public', p);
  mkdirSync(dirname(path), { recursive: true });
  return path;
};

const INK = '#4d4544';
const SOFT = '#6e6461';
const RULE = '#e7ddd4';
const URL_TEXT = 'organizedmomcollective.com';

const fonts = `
  @font-face { font-family: Kalam; font-weight: 700; src: url(${file('node_modules/@fontsource/kalam/files/kalam-latin-700-normal.woff2')}) format('woff2'); }
  @font-face { font-family: Kalam; font-weight: 400; src: url(${file('node_modules/@fontsource/kalam/files/kalam-latin-400-normal.woff2')}) format('woff2'); }
  @font-face { font-family: Montserrat; font-weight: 100 900; src: url(${file('node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2')}) format('woff2'); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; color: ${INK}; font-family: Montserrat, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hand { font-family: Kalam, cursive; font-weight: 700; }
  .swipe { background: linear-gradient(transparent 58%, var(--swipe) 58%, var(--swipe) 88%, transparent 88%); padding: 0 .08em; border-radius: 4px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { width: 44px; height: 44px; }
  .brand b { display: block; font-size: 13px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; }
  .brand span { display: block; font-size: 13px; color: ${SOFT}; margin-top: 2px; }
`;

// The originals are 1254 px; 600 px is still about 400 dpi at the PDF's printed size and keeps the files small.
const artwork = Object.fromEntries(await Promise.all(ageBands.map(async (b) => [
  b.illustration,
  `data:image/png;base64,${(await sharp(join(root, `design/responsibilities/${b.illustration}.webp`)).resize(600).png().toBuffer()).toString('base64')}`,
])));
const art = (id) => artwork[id];

// ---- Starter chart: US Letter landscape, 11 × 8.5 in = 1056 × 816 CSS px ----
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const starterChart = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
  @page { size: 11in 8.5in; margin: 0; }
  body { width: 1056px; height: 816px; padding: 44px 52px 36px; display: flex; flex-direction: column; --swipe: #F3DEDD; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; }
  h1 { font-size: 46px; line-height: 1; }
  .sub { margin-top: 10px; font-size: 14px; color: ${SOFT}; }
  .fields { display: grid; gap: 14px; width: 330px; font-size: 13px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }
  .fields div { display: flex; align-items: flex-end; gap: 10px; }
  .fields i { flex: 1; border-bottom: 1.5px solid ${INK}; height: 26px; }
  table { margin-top: 26px; width: 100%; border-collapse: separate; border-spacing: 0; }
  th { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${SOFT}; padding-bottom: 10px; }
  th.job { text-align: left; width: 330px; }
  td { border-top: 1.5px solid ${RULE}; height: 104px; text-align: center; vertical-align: middle; }
  tr:last-child td { border-bottom: 1.5px solid ${RULE}; }
  td.job { text-align: left; padding-right: 20px; }
  .num { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: #EFEBE7; font-family: Kalam; font-weight: 700; font-size: 20px; margin-right: 12px; vertical-align: middle; }
  .line { display: inline-block; width: 262px; border-bottom: 1.5px solid ${INK}; height: 30px; vertical-align: middle; }
  .when { margin: 12px 0 0 46px; display: flex; gap: 8px; align-items: flex-end; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: ${SOFT}; }
  .when i { width: 210px; border-bottom: 1px dashed ${SOFT}; height: 16px; }
  .box { display: inline-block; width: 50px; height: 50px; border: 2px solid ${INK}; border-radius: 12px; }
  td:nth-child(even) .box { background: #F6F1E7; }
  .week { margin-top: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; flex: 1; }
  .week section { border: 2px solid ${INK}; border-radius: 16px; padding: 14px 18px; display: flex; flex-direction: column; }
  .week section:nth-child(1) { background: #FBF4F3; }
  .week section:nth-child(2) { background: #F3F6EE; }
  .week section:nth-child(3) { background: #FBF7EF; }
  .week h2 { font-family: Kalam; font-weight: 700; font-size: 22px; line-height: 1.1; }
  .week p { font-size: 12px; color: ${SOFT}; margin-top: 2px; }
  .week i { display: block; border-bottom: 1.5px dashed #b9aea6; height: 34px; }
  footer { margin-top: 18px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: ${SOFT}; }
  footer em { font-style: normal; }
</style></head><body>
  <header>
    <div>
      <h1 class="hand"><span class="swipe">My Responsibility Chart</span></h1>
      <p class="sub">Three jobs I’ve practiced. I check the chart, do the job, then tick the box.</p>
    </div>
    <div class="fields">
      <div>Name <i></i></div>
      <div>Week of <i></i></div>
    </div>
  </header>
  <table>
    <thead><tr><th class="job">My job</th>${days.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>${[1, 2, 3].map((n) => `<tr><td class="job"><span class="num">${n}</span><span class="line"></span><div class="when">When <i></i></div></td>${days.map(() => '<td><span class="box"></span></td>').join('')}</tr>`).join('')}</tbody>
  </table>
  <div class="week">
    <section><h2>This week I’m proud of…</h2><i></i><i></i><i></i></section>
    <section><h2>We’ll celebrate by…</h2><p>A walk, a game, picking Friday’s dinner</p><i></i><i></i></section>
    <section><h2>Next week I’ll practice…</h2><i></i><i></i><i></i></section>
  </div>
  <footer>
    <div class="brand"><img src="${file('public/brand/omc-mark.png')}" alt=""><div><b>Organized Mom Collective</b><span>${URL_TEXT}</span></div></div>
    <em>Practice it together first. Then let the chart do the reminding.</em>
  </footer>
</body></html>`;

// ---- Infographic: 1000 px wide; 1500 tall for the pin, 1294 tall (US Letter ratio) for the PDF ----
const infographic = (height) => {
  const tight = height < 1500;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
  @page { size: 8.5in 11in; margin: 0; }
  body { width: 1000px; height: ${height}px; padding: ${tight ? '52px 64px 40px' : '72px 72px 56px'}; background: #fffdfa; display: flex; flex-direction: column; --swipe: #F3DEDD; }
  .eyebrow { font-size: 18px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: ${SOFT}; }
  h1 { margin-top: 10px; font-size: ${tight ? 74 : 84}px; line-height: 1.02; }
  .sub { margin-top: 14px; font-size: 24px; line-height: 1.35; color: ${SOFT}; max-width: 760px; }
  .bands { margin-top: ${tight ? 28 : 40}px; display: grid; gap: ${tight ? 16 : 22}px; flex: 1; }
  .band { display: grid; grid-template-columns: ${tight ? 150 : 172}px 1fr; gap: 28px; align-items: center; padding: ${tight ? '14px 26px 14px 18px' : '20px 28px 20px 20px'}; border-radius: 22px; background: color-mix(in srgb, var(--c) 34%, white); border: 2px solid var(--c); }
  .art { width: 100%; aspect-ratio: 1; border-radius: 50%; background: var(--c); display: grid; place-items: center; }
  .art img { width: 82%; height: 82%; object-fit: contain; }
  .head { display: flex; align-items: baseline; gap: 16px; }
  .head b { font-family: Kalam; font-weight: 700; font-size: ${tight ? 42 : 48}px; line-height: 1; }
  .head span { font-size: 15px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${SOFT}; }
  ul { list-style: none; margin-top: ${tight ? 10 : 14}px; display: grid; grid-template-columns: 1fr 1fr; gap: ${tight ? '8px 22px' : '12px 24px'}; }
  li { display: flex; align-items: center; gap: 10px; font-size: ${tight ? 19 : 21}px; font-weight: 600; line-height: 1.2; }
  li::before { content: ''; flex: none; width: 20px; height: 20px; border: 2px solid ${INK}; border-radius: 6px; background: #fff; }
  li.help::before { background: linear-gradient(135deg, #fff 50%, var(--c) 50%); }
  .legend { margin-top: ${tight ? 16 : 22}px; display: flex; gap: 28px; font-size: 16px; color: ${SOFT}; }
  .legend span { display: inline-flex; align-items: center; gap: 8px; }
  .legend i { width: 18px; height: 18px; border: 2px solid ${INK}; border-radius: 5px; }
  .legend i.h { background: linear-gradient(135deg, #fff 50%, #c9c2bb 50%); }
  footer { margin-top: ${tight ? 18 : 26}px; padding-top: ${tight ? 16 : 22}px; border-top: 2px solid ${RULE}; display: flex; justify-content: space-between; align-items: center; gap: 24px; }
  footer p { font-size: 17px; color: ${SOFT}; text-align: right; line-height: 1.35; }
  .brand img { width: 58px; height: 58px; }
  .brand b { font-size: 15px; }
  .brand span { font-size: 17px; font-weight: 600; color: ${INK}; }
</style></head><body>
  <p class="eyebrow">Free printable · Ages 2–12</p>
  <h1 class="hand">Kids’ Responsibility Chart <span class="swipe">by Age</span></h1>
  <p class="sub">Chores kids can learn, from toddlers to tweens. Teach each one first, then step back.</p>
  <div class="bands">${ageBands.map((b) => `
    <section class="band" style="--c: ${b.color}">
      <div class="art"><img src="${art(b.illustration)}" alt=""></div>
      <div>
        <div class="head"><b>${b.label}</b><span>${b.focus}</span></div>
        <ul>${b.highlights.map((h) => `<li${h.help ? ' class="help"' : ''}>${h.text}</li>`).join('')}</ul>
      </div>
    </section>`).join('')}
  </div>
  <div class="legend"><span><i></i> On their own, once practiced</span><span><i class="h"></i> With your help</span></div>
  <footer>
    <div class="brand"><img src="${file('public/brand/omc-mark.png')}" alt=""><div><b>Organized Mom Collective</b><span>${URL_TEXT}</span></div></div>
    <p>Starting points, not milestones.<br>Every child is ready at their own pace.</p>
  </footer>
</body></html>`;
};

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1056, height: 816 }, deviceScaleFactor: 2 });
const load = async (html, width, height) => {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
};

await load(starterChart, 1056, 816);
await page.pdf({ path: out(printables.starterChart.href), width: '11in', height: '8.5in', printBackground: true, pageRanges: '1' });
await sharp(await page.screenshot({ type: 'png' })).resize(900).webp({ quality: 88 }).toFile(out('/images/tools/previews/kids-responsibility-chart.webp'));

await load(infographic(1294), 1000, 1294);
// 1000 CSS px × 0.816 = 816 px = 8.5 in, so the Letter page holds the whole 1000 × 1294 layout.
await page.pdf({ path: out(printables.infographicPdf.href), width: '8.5in', height: '11in', scale: 0.816, printBackground: true, pageRanges: '1' });

await load(infographic(1500), 1000, 1500);
await sharp(await page.screenshot({ type: 'png' })).resize(1000, 1500).png({ compressionLevel: 9, palette: false }).toFile(out(printables.infographicPng.href));

await browser.close();
console.log('Rendered the starter chart, its preview, the infographic PDF and the pin.');
