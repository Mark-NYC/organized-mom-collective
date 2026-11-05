/**
 * The personalized Family Meeting companion (January's resource, /app/club/january) in a real browser: every sample
 * family on desktop and phone, families of 6, 8 and 12 with long names, and print. Run against a built preview:
 *
 *   PUBLIC_CLUB_ENABLED=true npx astro build && npx astro preview --port 4330
 *   node scripts/meeting-guide-qa.mjs [http://localhost:4330] [--shots=dir]
 *
 * Exits 1 when any check fails. Made-up sample families only.
 */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:4330';
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SAMPLES = ['rivera', 'brooks', 'chen', 'okafor', 'hughes'];
const PARTS = ['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice'];
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail && !ok ? ` · ${detail}` : ''}`);
};

// The twelve-person family with long names from scripts/club-meeting-qa.mjs.
const src = readFileSync(new URL('./club-meeting-qa.mjs', import.meta.url), 'utf8');
const LARGE = (0, eval)(src.slice(src.indexOf('const LARGE = ') + 14, src.indexOf('async function open')).trim().replace(/;$/, ''));

async function open(browser, viewport, path, family) {
  const ctx = await browser.newContext({ viewport });
  if (family) await ctx.addInitScript((s) => sessionStorage.setItem('omc:club-sample:chen', JSON.stringify(s)), family);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready' && document.querySelector('.mg-sheet'), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  return page;
}
/** Each sheet's spare room at the bottom (px at real size; negative = clipped) and its smallest text. */
const fit = (page) => page.evaluate(() => [...document.querySelectorAll('[data-meeting-guide] .mg-sheet')].map((s) => {
  const box = s.getBoundingClientRect();
  const scale = box.width / 816 || 1;
  const all = [...s.querySelectorAll('*')];
  const bottom = Math.max(...all.map((e) => e.getBoundingClientRect().bottom));
  const text = all.filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
  return { spare: Math.round((box.bottom - bottom) / scale), min: Math.min(...text.map((e) => parseFloat(getComputedStyle(e).fontSize))) };
}));
const pdfPages = async (page) => {
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: null });
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
};

const browser = await chromium.launch();
console.log('Sample families');
for (const sample of SAMPLES) {
  for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await open(browser, vp, `/app/club/january?sample=${sample}`);
    const text = await page.locator('[data-meeting-guide] [data-plan-sheet]').allInnerTexts().then((t) => t.join('\n'));
    check(`${sample} ${label}: the four parts, in order`, PARTS.every((p, i) => text.indexOf(p) > -1 && (i === 0 || text.indexOf(p) > text.indexOf(PARTS[i - 1]))));
    check(`${sample} ${label}: no Mom, Dad or parents; no unfilled tokens`, !/\b(mom|dad|parents?)\b|\{\w+\}/i.test(text));
    check(`${sample} ${label}: no sideways scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (label === 'desktop') {
      const f = await fit(page);
      check(`${sample}: both sheets fit (${f.map((x) => x.spare).join(', ')}px spare)`, f.length === 2 && f.every((x) => x.spare >= 0 && x.min >= 10), JSON.stringify(f));
      check(`${sample}: prints 2 Letter pages`, (await pdfPages(page)) === 2);
      await page.click('[data-cpd-edit]');
      check(`${sample}: Make changes opens the editor`, await page.isVisible('dialog[open][data-mg-editor]'));
      await page.keyboard.press('Escape');
    } else {
      check(`${sample} phone: the companion’s sections`, await page.isVisible('[data-mgm-focus] li') && await page.isVisible('[data-mgm-practice] li'));
    }
    check(`${sample} ${label}: no script errors`, page.errors.length === 0, page.errors.join(' | '));
    if (SHOTS && sample === 'rivera') await page.screenshot({ path: `${SHOTS}/guide-rivera-${label}.png` });
    await page.context().close();
  }
}

console.log('\nLarge families with long names');
for (const n of [6, 8, 12]) {
  const fam = structuredClone(LARGE);
  fam.household.members = fam.household.members.slice(0, n);
  const page = await open(browser, { width: 1440, height: 900 }, '/app/club/january?sample=chen', fam);
  const f = await fit(page);
  check(`${n} people: both sheets fit (${f.map((x) => x.spare).join(', ')}px spare), smallest text ${Math.min(...f.map((x) => x.min))}px`, f.length === 2 && f.every((x) => x.spare >= 0 && x.min >= 10), JSON.stringify(f));
  check(`${n} people: prints 2 Letter pages`, (await pdfPages(page)) === 2);
  const kids = fam.household.members.filter((m) => m.kind === 'child').length;
  check(`${n} people: every child has ideas; grown-ups get a conversation, not a job`, (await page.locator('[data-meeting-guide] [data-plan-sheet="back"] .mg-kids > li').count()) === kids && /help without taking over/.test(await page.locator('[data-meeting-guide] .mg-grownups').first().innerText()));
  await page.context().close();
}
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
