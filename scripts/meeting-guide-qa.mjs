/**
 * The personalized Monthly Family Focus (January's resource, /app/club/january) in a real browser: every sample
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
const PARTS = ['Our Family Focus', 'Our shared focus', 'Small habits worth trying', 'Our Words of the Week', 'Bring it to your Family Meeting'];
const lc = (s) => s.toLowerCase();
const WORDS = ['Notice', 'Choose', 'Practice', 'Grow'];
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
const fit = (page) => page.evaluate(() => [...document.querySelectorAll('[data-meeting-guide] [data-mg-pages] .mg-sheet')].map((s) => {
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
    check(`${sample} ${label}: the Family Focus sections, in order`, PARTS.every((p, i) => lc(text).indexOf(lc(p)) > -1 && (i === 0 || lc(text).indexOf(lc(p)) > lc(text).indexOf(lc(PARTS[i - 1])))), text.slice(0, 300));
    check(`${sample} ${label}: not organized under the four meeting parts`, !/Let’s Talk|Let’s Practice|Everyone’s Part/.test(text));
    check(`${sample} ${label}: January’s four authored words`, WORDS.every((w) => text.includes(w)) && /What needs our attention\?/.test(text));
    const chips = await page.locator('[data-meeting-guide] [data-mg-pages] .mg-legend .mg-chip').evaluateAll((cs) => cs.map((c) => [c.textContent.trim(), c.querySelector('.mg-dot')?.style.background]));
    check(`${sample} ${label}: every member has a named, distinct color`, chips.length >= 1 && chips.every(([n, c]) => n && c) && new Set(chips.map((x) => x[1])).size === chips.length, JSON.stringify(chips));
    check(`${sample} ${label}: no Mom, Dad or parents; no unfilled tokens`, !/\b(mom|dad|parents?)\b|\{\w+\}/i.test(text));
    check(`${sample} ${label}: no sideways scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (label === 'desktop') {
      const f = await fit(page);
      check(`${sample}: ${f.length} sheet(s), each fits (${f.map((x) => x.spare).join(', ')}px spare)`, f.length >= 1 && f.length <= 2 && f.every((x) => x.spare >= 0 && x.min >= 10), JSON.stringify(f));
      check(`${sample}: prints ${f.length} Letter page(s), no blank page`, (await pdfPages(page)) === f.length);
      await page.click('[data-cpd-edit]');
      check(`${sample}: Make changes opens the editor`, await page.isVisible('dialog[open][data-mg-editor]'));
      await page.keyboard.press('Escape');
    } else {
      check(`${sample} phone: the Family Focus reference (focus, habit cards, four words, the meeting guide; no scaled printable, no editor open)`, await page.isVisible('[data-mgm-focus-title]') && await page.isVisible('[data-mgm-people] li') && (await page.locator('[data-mgm-words] li').count()) === 4 && await page.isVisible('.mgm-guide-link') && !(await page.isVisible('.cp-thumb--hero')) && !(await page.isVisible('dialog[open]')));
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
  // A focus that gives every child an idea (tidying), so the page is as full as it gets.
  fam.profile = { ...fam.profile, priority: 'tidying', challenges: [] };
  const page = await open(browser, { width: 1440, height: 900 }, '/app/club/january?sample=chen', fam);
  const f = await fit(page);
  check(`${n} people: ${f.length} sheet(s), each fits (${f.map((x) => x.spare).join(', ')}px spare), smallest text ${Math.min(...f.map((x) => x.min))}px`, f.length >= 1 && f.length <= 2 && f.every((x) => x.spare >= 0 && x.min >= 10), JSON.stringify(f));
  check(`${n} people: prints ${f.length} Letter page(s), no blank page`, (await pdfPages(page)) === f.length);
  const exps = await page.locator('[data-meeting-guide] [data-mg-pages] .mg-exp').count();
  const adapt = await page.locator('[data-meeting-guide] [data-mg-pages] .mg-exp-adapt li').count();
  check(`${n} people: ${exps} experiment(s)${adapt ? `, one shared routine for ${adapt} children` : ''}; grown-ups get a conversation, not a job`, exps >= 1 && exps <= 2 && /help without taking over/.test(await page.locator('[data-meeting-guide] .mg-sheet').first().innerText()));
  await page.context().close();
}
console.log('\nMom’s review: Keep it / Change it / Skip it');
{
  const page = await open(browser, { width: 1440, height: 900 }, '/app/club/january?sample=rivera');
  const sheetText = () => page.locator('[data-meeting-guide] [data-mg-pages]').innerText();
  const before = await page.locator('[data-meeting-guide] [data-mg-pages] .mg-exp').count();
  const titles = await page.locator('[data-meeting-guide] [data-mg-pages] .mg-exp-title').allInnerTexts();
  await page.click('[data-cpd-edit]');
  const boxes = page.locator('dialog[open] .mg-ed-exp');
  check('review: every suggestion has Keep / Change / Skip', (await boxes.count()) === before && (await boxes.first().locator('.mg-ed-choice-btn').allInnerTexts()).join('|') === 'Keep it|Change it|Skip it');
  await boxes.nth(0).getByRole('button', { name: 'Skip it' }).click();
  if (before > 1) {
    await boxes.nth(1).getByRole('button', { name: 'Change it' }).click();
    const t = boxes.nth(1).locator('.mg-ed-change textarea').nth(1);
    await t.fill('Pack the bag together, then solo by Friday.');
    await t.dispatchEvent('change');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  let txt = await sheetText();
  check('review: a skipped idea comes off the printable', !txt.includes(titles[0]), titles[0]);
  if (before > 1) check('review: her wording prints', txt.includes('Pack the bag together, then solo by Friday.'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready' && document.querySelector('.mg-sheet'));
  await page.waitForTimeout(500);
  txt = await sheetText();
  check('review: edits and skips persist after reopening', !txt.includes(titles[0]) && (before < 2 || txt.includes('Pack the bag together, then solo by Friday.')));
  if (SHOTS) {
    await page.click('[data-cpd-edit]');
    await page.waitForTimeout(300);
    await page.locator('dialog[open]').screenshot({ path: `${SHOTS}/review-editor.png` });
    await page.keyboard.press('Escape');
    await page.locator('[data-meeting-guide] [data-mg-pages] .mg-sheet').first().screenshot({ path: `${SHOTS}/review-after.png` });
  }
  await page.context().close();
}
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
