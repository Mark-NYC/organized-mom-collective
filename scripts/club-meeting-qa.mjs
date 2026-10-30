/**
 * Browser checks for the Monthly Family Meeting on every Club plan page (src/components/club/plan/ClubFamilyMeeting.astro):
 * all 12 months, several sample families, desktop and mobile, switching between the tool and the meeting without
 * touching the tool, and printing (one portrait Letter page for the meeting; the tool's own page count unchanged).
 *
 *   PUBLIC_CLUB_ENABLED=true npx astro build && npx astro preview --port 4330
 *   node scripts/club-meeting-qa.mjs [http://localhost:4330] [--shots=dir]
 *
 * Uses the made-up sample households (?sample=…) only; a large family with long names is put into this tab's sample
 * storage the same way the sample store keeps edits. Exits 1 when any check fails.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:4330';
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8) ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const COLORS = { january: '#CDDDE1', february: '#E8D2D6', march: '#C7DED3', april: '#DDD8E8', may: '#D4DFC4', june: '#F1D8A8', july: '#ECCBC2', august: '#DCCFAE', september: '#CDD2BC', october: '#D8B79F', november: '#D5C5B8', december: '#BBCBC4' };
const SAMPLES = ['rivera', 'brooks', 'chen', 'okafor', 'hughes'];
const LABELS = new Set(['Already doing', 'Suggested for us', 'Agreed by our family']);

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail && !ok ? ` · ${detail}` : ''}`);
};

/** Twelve people, long names, several shared responsibilities: kept in this tab's sample storage, like the sample store does. */
const LARGE = (() => {
  const long = ['Alexandria-Rose', 'Maximilian', 'Evangeline', 'Bartholomew', 'Anastasia-Grace', 'Christopher', 'Gwendolyn', 'Montgomery', 'Josephine', 'Sebastian', 'Penelope', 'Theodora'];
  const ages = [null, null, null, 17, 15, 13, 11, 9, 7, 5, 3, 1];
  const members = long.map((name, i) => ({
    id: `sample-chen-x${i}`, firstName: name, kind: ages[i] === null ? 'adult' : 'child', role: ages[i] === null ? (i === 0 ? 'parent' : i === 1 ? 'partner' : 'grandparent') : 'child',
    ...(i === 0 ? { isAccountHolder: true } : {}), ...(ages[i] === null ? {} : { birthYear: 2026 - ages[i], birthMonth: 1 }),
  }));
  const ids = members.map((m) => m.id);
  const cats = ['meals', 'laundry', 'cleaning', 'transportation', 'belongings', 'school-prep', 'homework', 'pet-care'];
  return {
    household: { id: 'sample-chen', displayName: 'The Featherstonehaugh-Montgomery Family', preferences: { pets: true }, profileVersion: 1, members },
    documents: {},
    profile: {
      setupDone: ['week', 'responsibilities', 'growth', 'challenges', 'priority'], setupCompleted: true,
      challenges: ['knowing-plans', 'routines', 'sharing-fairly'], priority: 'reminding', priorityNote: 'Everyone asking me where their things are, every single morning',
      activities: [
        { id: 'x-a1', category: 'school', memberIds: ids.slice(3, 10), days: [1, 2, 3, 4, 5] },
        { id: 'x-a2', category: 'sports', name: 'Competitive swim team practice', memberIds: [ids[3], ids[4]], days: [1, 3, 5] },
        { id: 'x-a3', category: 'lessons', name: 'Piano and violin lessons', memberIds: [ids[6], ids[7]], days: [2] },
      ],
      responsibilities: cats.map((c, i) => ({ id: `x-r${i}`, status: 'existing', category: c, ownerIds: [ids[i % 3], ids[3 + (i % 5)]], helperIds: [ids[8 + (i % 3)]], scope: 'shared' }))
        .concat([{ id: 'x-c1', status: 'confirmed', category: 'meals', ownerIds: [ids[5]], helperIds: [] }]),
    },
  };
})();

async function open(browser, viewport, path, { large = false } = {}) {
  const ctx = await browser.newContext({ viewport });
  if (large) await ctx.addInitScript((s) => sessionStorage.setItem('omc:club-sample:chen', JSON.stringify(s)), LARGE);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.setDefaultTimeout(15000);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  return page;
}

const meetingReady = (page) => page.waitForSelector('[data-family-meeting][data-fm-ready]');
const pdfPages = async (page) => {
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
};

/** Print layout of the meeting guide: fits its page, nothing tiny. */
async function printFit(page) {
  await page.emulateMedia({ media: 'print' });
  const r = await page.evaluate(() => {
    const s = document.querySelector('[data-meeting-sheet]');
    const box = s.getBoundingClientRect();
    const last = [...s.querySelectorAll('*')].reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
    const sizes = [...s.querySelectorAll('p,li,span,strong,h2,h3')].filter((e) => e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize));
    const padBottom = parseFloat(getComputedStyle(s).paddingBottom);
    return { w: box.width, h: box.height, overflow: last - (box.bottom - padBottom), min: Math.min(...sizes) };
  });
  await page.emulateMedia({ media: null });
  return r;
}

const browser = await chromium.launch();
try {
  console.log('\nEvery month: switch, personalization, month color, print');
  for (const month of MONTHS) {
    const meetingOnly = month === 'november';
    const page = await open(browser, DESKTOP, `/app/club/${month}?sample=rivera`);
    if (!meetingOnly) {
      await page.waitForSelector('.club-plan[data-plan-state="ready"]');
      check(`${month}: the tool is the default view`, (await page.getAttribute('.club-plan', 'data-plan-view')) === 'tool' && await page.isVisible('.cpd') && !(await page.isVisible('.fm-rail')));
      // The month's own plan, through its PlanResource controller (docs/club/PLAN_ARCHITECTURE.md).
      const planState = () => page.evaluate(() => { const h = [...document.querySelectorAll('*')].find((e) => e.clubPlan); return h ? JSON.stringify(h.clubPlan.state()) : null; });
      const sheet = await planState();
      const deadline = await page.textContent('[data-cpd-status]');
      const storage = await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage).filter(([k]) => !k.startsWith('omc:club-sample')).sort()));
      const toolPages = await pdfPages(page);
      const sheets = await page.$$eval('[data-plan-sheet]', (s) => s.length);
      check(`${month}: tool still prints its own ${sheets} page(s)`, month === 'march' ? toolPages >= sheets : toolPages === sheets, `${toolPages} pages for ${sheets} sheets`);
      await page.click('.fm-switch [data-fm-view="meeting"]');
      await meetingReady(page);
      check(`${month}: switching shows the meeting and links to it`, (await page.getAttribute('.club-plan', 'data-plan-view')) === 'meeting' && page.url().includes('view=meeting') && !(await page.isVisible('.cpd')));
      await page.click('.fm-switch [data-fm-view="tool"]');
      check(`${month}: back to the tool, its plan and editor state untouched`, sheet !== null && (await planState()) === sheet && await page.isVisible('.cpd')
        && (await page.textContent('[data-cpd-status]')) === deadline
        && (await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage).filter(([k]) => !k.startsWith('omc:club-sample')).sort()))) === storage
        && !page.url().includes('view=meeting'));
      await page.click('.fm-switch [data-fm-view="meeting"]');
    }
    await meetingReady(page);
    const m = await page.evaluate(() => {
      const scr = document.querySelector('[data-fm-screen]');
      return {
        sections: scr.querySelectorAll('.fm-sec').length, questions: scr.querySelectorAll('.fm-questions li').length,
        people: scr.querySelectorAll('.fm-person').length, labels: [...scr.querySelectorAll('.fm-pill')].map((x) => x.textContent),
        text: scr.innerText, color: getComputedStyle(document.querySelector('.fm')).getPropertyValue('--fm-month').trim(),
        title: scr.querySelector('.fm-sheet-sub').textContent,
      };
    });
    check(`${month}: four sections, three questions, all five Riveras`, m.sections === 4 && m.questions === 3 && m.people === 5, JSON.stringify({ s: m.sections, q: m.questions, p: m.people }));
    check(`${month}: only the three status labels`, m.labels.every((l) => LABELS.has(l)) && m.labels.length > 0, m.labels.join());
    check(`${month}: month color`, m.color.toUpperCase() === COLORS[month], m.color);
    check(`${month}: no Mom, Dad or parents`, !/\b(mom|dad|parents?)\b/i.test(m.text));
    check(`${month}: names its tool (${m.title})`, /Introducing .+/.test(m.title));
    const fit = await printFit(page);
    check(`${month}: guide is one 8.5 × 11 in page, nothing clipped (${Math.round(-fit.overflow)}px spare)`, Math.round(fit.w) === 816 && Math.round(fit.h) === 1056 && fit.overflow <= 0.5, JSON.stringify(fit));
    check(`${month}: prints exactly one page`, (await pdfPages(page)) === 1);
    check(`${month}: no script errors`, page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();
  }

  console.log('\nFamilies');
  for (const sample of SAMPLES) {
    for (const month of ['january', 'august']) {
      const page = await open(browser, MOBILE, `/app/club/${month}?sample=${sample}&view=meeting`);
      if (sample === 'hughes' || sample === 'okafor' || sample === 'brooks' || sample === 'chen' || sample === 'rivera') await meetingReady(page);
      const info = await page.evaluate(() => {
        const scr = document.querySelector('[data-fm-screen]');
        return { text: scr.innerText, people: scr.querySelectorAll('.fm-person').length, leader: document.querySelector('[data-fm-leader]').textContent, wide: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      check(`${sample} ${month}: complete meeting, no sideways scroll, ${info.people} people`, info.people > 0 && !info.wide && /Let’s Practice/.test(info.text));
      check(`${sample} ${month}: no Mom, Dad or parents`, !/\b(mom|dad|parents?)\b/i.test(info.text));
      if (sample === 'brooks') check('single parent, no profile answers: Max (9) leads, not Jess; generic questions', /Max reads/.test(info.leader) && !/is part of our week|to be ready for/.test(info.text), info.leader);
      if (sample === 'hughes') check('one grown-up, no children: Claire leads a grown-ups’ meeting', /Claire reads/.test(info.leader));
      if (sample === 'chen') check('several grown-ups: the account holder (Mei) doesn’t lead', !/Mei reads/.test(info.leader), info.leader);
      if (sample === 'rivera' && month === 'january') check('Rivera January: Sofia’s soccer, the evening before', /What could Sofia do on Mon and Wed evenings to be ready for Soccer on Tue and Thu\?/.test(info.text), info.text.slice(0, 600));
      if (sample === 'chen' && month === 'january') check('Chen January: Grace and Owen’s swim team, from their own activity', /Check and pack my things for Swim team before bed/.test(info.text), info.text.slice(0, 900));
      check(`${sample} ${month}: no script errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.context().close();
    }
  }

  console.log('\nA large family with long names prints on one readable page');
  for (const month of MONTHS) {
    const page = await open(browser, DESKTOP, `/app/club/${month}?sample=chen&view=meeting`, { large: true });
    await meetingReady(page);
    const people = await page.$$eval('[data-meeting-sheet] .fm-person', (p) => p.length);
    const fit = await printFit(page);
    check(`${month}: 12 people, fits one page (${Math.round(-fit.overflow)}px spare), smallest text ${fit.min.toFixed(1)}px`, people === 12 && fit.overflow <= 0.5 && fit.min >= 8.5, JSON.stringify(fit));
    if (month === 'january') check('large family: the 1-year-old joins in with no job', await page.isVisible('[data-fm-screen] >> text=Joins in and watches'));
    check(`${month}: one page`, (await pdfPages(page)) === 1);
    if (SHOTS && ['january', 'april'].includes(month)) {
      await page.emulateMedia({ media: 'print' });
      await page.setViewportSize({ width: 816, height: 1056 });
      await page.locator('[data-meeting-sheet]').screenshot({ path: `${SHOTS}/print-large-${month}.png` });
      await page.emulateMedia({ media: null });
    }
    await page.context().close();
  }

  if (SHOTS) {
    console.log('\nScreenshots');
    for (const month of ['january', 'april', 'september', 'october']) {
      for (const [label, vp] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
        const page = await open(browser, vp, `/app/club/${month}?sample=rivera&view=meeting`);
        await meetingReady(page);
        await page.screenshot({ path: `${SHOTS}/${month}-meeting-${label}.png`, fullPage: label === 'mobile' });
        if (label === 'desktop') {
          await page.click('.fm-switch [data-fm-view="tool"]');
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${SHOTS}/${month}-tool-${label}.png` });
          await page.click('.fm-switch [data-fm-view="meeting"]');
          await page.emulateMedia({ media: 'print' });
          await page.setViewportSize({ width: 816, height: 1056 });
          await page.locator('[data-meeting-sheet]').screenshot({ path: `${SHOTS}/print-${month}.png` });
        }
        await page.context().close();
      }
    }
    writeFileSync(`${SHOTS}/README.txt`, 'Monthly Family Meeting QA screenshots (scripts/club-meeting-qa.mjs)\n');
  }
} catch (e) {
  failures++;
  console.log(`  FAIL (crashed) ${e.message.split('\n').slice(0, 4).join(' | ')}`);
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
