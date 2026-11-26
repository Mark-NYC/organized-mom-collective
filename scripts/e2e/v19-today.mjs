/**
 * V19 Today checks (docs/ios/V19_ATTENTION.md): run after `npx astro dev`.
 *   node scripts/e2e/v19-today.mjs [base URL] [screenshot dir]
 *
 * - all 21 scenarios: a short headline (≤ 6 words), at most one card with the expected title, no AI branding;
 * - the card keeps V18's exact palette; the resolution sheet isolates the affected agreement, offers grounded options,
 *   reassures with what's done, and changes nothing until "Update our plan";
 * - cascade (three affected agreements in one sheet), backup and the handoff to Luis, "Something changed?",
 *   Dismiss + optional feedback (no replacement card), Earlier this week, the meeting agenda in Let's Talk,
 *   Account's "how much should Today bring up" and Undo, Luis never seeing Ana's private call;
 * - nothing under the floating tab bar at 390 and 430; V16/V17/V18 state untouched; no page errors.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.argv[2] ?? 'http://127.0.0.1:4321/preview/organized-family-v19';
const OUT = process.argv[3] ?? 'docs/ios/screenshots/v19';
mkdirSync(OUT, { recursive: true });
const results = [];
const errors = [];
const check = (name, ok, detail = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`); };
const browser = await chromium.launch();

async function open(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // The dev server's toolbar is not part of the page; keep it out of the way on every load.
  await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = 'astro-dev-toolbar{display:none!important}'; document.head.append(st);
  }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('omc:v16-preview:v1', '"v16-sentinel"');
    localStorage.setItem('omc:v16-preview:v1:v17', '"v17-sentinel"');
    localStorage.setItem('omc:v16-preview:v1:v18', '"v18-sentinel"');
  });
  await p.goto(`${URL}#/today`);
  await p.waitForSelector('[data-screen="today"]');
  return p;
}
const settle = (p, ms = 400) => p.waitForTimeout(ms);
const shot = async (p, name) => { await settle(p); await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 84 }); };
async function scenario(p, id) {
  const bar = p.locator('[data-demo-bar]');
  if (!(await bar.evaluate((d) => d.open))) await bar.locator('summary').click();
  await p.selectOption('[data-demo-v19]', id);
  await bar.locator('summary').click();
  await p.evaluate(() => scrollTo(0, 0));
  await settle(p, 500);
}
const headline = (p) => p.locator('[data-v18-headline]').innerText();
const cardTitle = async (p) => ((await p.locator('[data-heads-up]').count()) ? p.locator('.v18-heads-title').innerText() : null);
const style = (p, sel, prop) => p.locator(sel).first().evaluate((el, pr) => getComputedStyle(el)[pr], prop);


const words = (h) => h.replace(/[.’']/g, '').split(/\s+/).length;
// ---------------------------------------------------------------- every scenario
const EXPECT = {
  quiet: ['You’re on track.', null],
  change: ['A change of plans.', 'Soccer starts an hour earlier.'],
  cascade: ['A change of plans.', 'Thursday needs a little reshuffling.'],
  prep: ['A little preparation will help.', 'Tomorrow’s school field trip runs through lunch.'],
  handled: ['You’re on track.', null],
  transport: ['A little preparation will help.', 'Who’s driving to Saturday’s soccer game?'],
  backup: ['A little backup will help.', 'You could use some backup tonight.'],
  lighter: ['A change of plans.', 'Keep today simple.'],
  friction: ['You’re on track.', null],
  ownership: ['You’re on track.', null],
  intention: ['You’re on track.', 'Saturday might be a good day for this.'],
  season: ['You’re on track.', null],
  dismissed: ['You’re on track.', null],
  postponed: ['You’re on track.', null],
  'two-adults': ['A few things need attention.', 'You could use some backup tonight.'],
  consolidated: ['A little preparation will help.', 'Zoe’s birthday party on Saturday needs a few things.'],
  'low-value': ['You’re on track.', null],
  secondary: ['A few things need attention.', 'Soccer starts an hour earlier.'],
  meeting: ['Pick up where you left off.', null],
  'all-done': ['All set for today.', null],
  'ai-down': ['A little preparation will help.', 'Zoe’s party on Saturday may need an RSVP and a ride.'],
};
{
  const p = await open();
  let n = 0;
  for (const [id, [h, title]] of Object.entries(EXPECT)) {
    n++;
    await scenario(p, id);
    check(`${id}: headline "${h}"`, (await headline(p)) === h && words(h) <= 6, await headline(p));
    check(`${id}: ${title ? 'one card' : 'no card'}`, (await p.locator('[data-heads-up]').count()) === (title ? 1 : 0) && (await cardTitle(p)) === title, String(await cardTitle(p)));
    if (title) check(`${id}: no subline repeating the card`, (await p.locator('[data-v18-sub]').count()) === 0);
    const product = await p.locator('main').innerText();
    check(`${id}: no AI branding`, !/\bAI\b|assistant|chatbot|artificial intelligence|Claude/i.test(product));
    await shot(p, `scenario-${String(n).padStart(2, '0')}-${id}`);
  }
  await p.context().close();
}

// ---------------------------------------------------------------- the card and its resolution
{
  const p = await open();
  await scenario(p, 'change');
  const card = '[data-heads-up]';
  check('card: background #EDE5DA, 24px, 20px, flat', (await style(p, card, 'backgroundColor')) === 'rgb(237, 229, 218)' && (await style(p, card, 'borderTopLeftRadius')) === '24px'
    && (await style(p, card, 'paddingTop')) === '20px' && (await style(p, card, 'boxShadow')) === 'none' && (await style(p, card, 'borderTopWidth')) === '0px');
  check('card: eyebrow, heading, body, actions in palette', (await style(p, '.v18-heads-eyebrow', 'color')) === 'rgb(101, 85, 72)' && (await style(p, '.v18-heads-title', 'color')) === 'rgb(21, 21, 21)'
    && (await style(p, '.v18-heads-body', 'color')) === 'rgb(81, 72, 67)' && (await style(p, '.v18-heads-primary', 'color')) === 'rgb(73, 63, 60)' && (await style(p, '.v18-heads-dismiss', 'color')) === 'rgb(117, 105, 94)');
  check('card: "Changed since your meeting" / implication body', (await p.locator('.v18-heads-eyebrow').innerText()).includes('Changed since your meeting')
    && (await p.locator('.v18-heads-body').innerText()) === 'Practice now starts when school ends. Luis’s transportation plan needs adjusting.');
  check('What matters: unresolved change first', (await p.locator('[data-matter]').first().getAttribute('data-matter')) === 'Soccer practice');
  check('What matters: earlier this week recedes', (await p.locator('[data-earlier]').innerText()).startsWith('Earlier this week (2)') && (await p.locator('[data-matter="Dentist"]').count()) === 0);
  await p.click('[data-earlier]');
  check('Earlier this week opens (conference, dentist)', (await p.locator('[data-matter="Dentist"]').count()) === 1 && (await p.locator('[data-matter="Parent-teacher conference"]').count()) === 1);
  await p.click('[data-heads-action]');
  await p.waitForSelector('[data-resolve-sheet]');
  check('sheet: one isolated question', (await p.locator('[data-affected]').count()) === 1 && (await p.locator('.v19-question').innerText()) === 'How will Sofia get to soccer?');
  check('sheet: current agreement and planned departure', (await p.locator('[data-current]').innerText()).includes('Luis · Drive to soccer') && (await p.locator('[data-current]').innerText()).includes('Planned departure: 3:40 PM'));
  check('sheet: reassurance, not equal attention', (await p.locator('[data-reassurance]').innerText()).includes('Sofia’s soccer bag is already packed ✓'));
  check('sheet: Update disabled until a choice', await p.locator('[data-update-plan]').isDisabled());
  await shot(p, 'sheet-adjust-plan');
  await p.click('[data-option="school"]');
  await p.click('[data-update-plan]');
  await settle(p);
  check('update: card resolved', (await p.locator('[data-heads-up]').count()) === 0);
  check('update: the agreement now says pick up at school', (await p.locator('[data-today-prep="p-drive-soccer"]').innerText()).includes('Pick up Sofia from school'));
  check('V16/V17/V18 demo state untouched', await p.evaluate(() => ['', ':v17', ':v18'].every((k, i) => localStorage.getItem(`omc:v16-preview:v1${k}`) === ['"v16-sentinel"', '"v17-sentinel"', '"v18-sentinel"'][i])));

  await scenario(p, 'cascade');
  await p.click('[data-heads-action]');
  await p.waitForSelector('[data-resolve-sheet]');
  check('cascade: three affected agreements in one sheet', (await p.locator('[data-affected]').count()) === 3);
  await shot(p, 'sheet-cascade');
  await p.locator('[data-affected="ride"] [data-option="shift"]').click();
  await p.locator('[data-affected="dinner"] [data-option="someone"]').click();
  await p.locator('[data-affected="cleaning"] [data-option="move"]').click();
  await p.click('[data-update-plan]');
  await settle(p);
  check('cascade: the handoff is finished together (choose who)', (await p.locator('[data-resolve-sheet] [data-part]').count()) === 1);
  await p.click('[data-sheet-finish]');
  check('cascade: card resolved', (await p.locator('[data-heads-up]').count()) === 0);
  await p.context().close();
}

// ---------------------------------------------------------------- backup, the handoff, privacy
{
  const p = await open();
  await scenario(p, 'backup');
  check('backup: the part row carries one quiet line', (await p.locator('[data-part-attention]').innerText()) === 'Could use backup tonight.');
  await p.click('[data-heads-action]');
  await p.waitForSelector('[data-resolve-sheet]');
  await p.click('[data-option="ask-m-luis"]');
  await p.click('[data-update-plan]');
  await settle(p);
  await p.click('[data-sheet-finish]').catch(() => {});
  await p.locator('[data-demo-bar] summary').click();
  await p.selectOption('[data-demo-viewer]', 'm-luis');
  await p.locator('[data-demo-bar] summary').click();
  await settle(p);
  check('Luis: Ana’s request is his to answer', (await cardTitle(p)) === 'Ana asked if you can take dinner tonight.');
  check('Luis: never sees Ana’s private call', !/Client call|work meeting/i.test(await p.locator('main').innerText()));
  await p.click('[data-heads-action]');
  await p.waitForSelector('[data-part-sheet]');
  await p.click('[data-part-sheet] [data-keep]');
  await p.click('[data-part-sheet] [data-we-agree]');
  await p.click('[data-sheet-close]');
  await settle(p);
  check('Luis agreed: the request is settled', (await p.locator('[data-heads-up]').count()) === 0);
  await shot(p, 'luis-after-agreeing');
  await p.context().close();
}

// ---------------------------------------------------------------- Something changed?, Dismiss + feedback
{
  const p = await open();
  await scenario(p, 'quiet');
  check('quiet: no card, and "Something changed?" is a quiet link', (await p.locator('[data-heads-up]').count()) === 0 && (await style(p, '[data-something-changed]', 'backgroundColor')) === 'rgba(0, 0, 0, 0)');
  await p.click('[data-something-changed]');
  await p.waitForSelector('[data-changed-sheet]');
  await shot(p, 'something-changed');
  await p.click('[data-report="lighter"]');
  await p.click('[data-report-save]');
  await settle(p);
  check('reported a lighter day → "Keep today simple."', (await cardTitle(p)) === 'Keep today simple.' && (await headline(p)) === 'A change of plans.');

  await scenario(p, 'intention');
  await p.click('[data-heads-dismiss]');
  await settle(p);
  check('dismiss: one tap, card gone, no replacement', (await p.locator('[data-heads-up]').count()) === 0 && (await p.locator('[data-dismissed-note]').count()) === 1);
  await p.click('[data-tell-more]');
  check('feedback menu: five choices, all optional', (await p.locator('[data-feedback-menu] button').count()) === 5);
  await shot(p, 'dismiss-feedback');
  await p.click('[data-fb="never"]');
  await settle(p);
  await p.click('[data-account]');
  await p.waitForSelector('[data-assistance]');
  check('Account: how much Today brings up', (await p.locator('[data-assistance-select] option').count()) === 3);
  check('Account: "Don’t suggest" is listed and can be undone', (await p.locator('[data-never]').count()) === 1);
  await p.click('[data-undo]');
  check('Account: Undo', (await p.locator('[data-never]').count()) === 0);
  await p.context().close();
}

// ---------------------------------------------------------------- the meeting agenda (destination 2)
{
  const p = await open();
  await scenario(p, 'friction');
  check('friction: no card, meeting row counts it', (await p.locator('[data-heads-up]').count()) === 0 && (await p.locator('[data-meeting-topics]').innerText()) === '1 thing to talk about');
  await p.evaluate(() => { location.hash = '/meeting'; });
  await p.waitForSelector('[data-meeting-step]');
  if (await p.locator('[data-meeting-step="talk"]').count() === 0) await p.click('[data-meeting-next]');
  await p.waitForSelector('[data-meeting-step="talk"]');
  check('Let’s Talk: the same card, "Something we’ve noticed · 1 of 1"', (await p.locator('[data-agenda] .v18-heads-eyebrow').innerText()).includes('Something we’ve noticed · 1 of 1'));
  await shot(p, 'meeting-agenda');
  await p.click('[data-agenda-talked]');
  check('talked about it: leaves the agenda', (await p.locator('[data-agenda]').count()) === 0);
  await p.context().close();
}

// ---------------------------------------------------------------- nav clearance, sheets on small screens
for (const vp of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  const p = await open(vp);
  for (const id of ['change', 'cascade', 'quiet']) {
    await scenario(p, id);
    await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await settle(p, 350);
    const r = await p.evaluate(() => {
      const a = document.querySelector('.v16-shortcuts').getBoundingClientRect(), b = document.querySelector('.v16-tabbar').getBoundingClientRect();
      return { last: Math.round(a.bottom), bar: Math.round(b.top) };
    });
    check(`${vp.width} ${id}: page end clears the tab bar`, r.last <= r.bar - 4, JSON.stringify(r));
    if (await p.locator('[data-heads-up]').count()) {
      await p.evaluate(() => scrollTo(0, 0));
      await p.click('[data-heads-action]');
      await p.waitForSelector('[data-resolve-sheet]');
      await settle(p, 400);
      await p.locator('[data-update-plan]').scrollIntoViewIfNeeded();
      const r2 = await p.evaluate(() => {
        const b = document.querySelector('[data-update-plan]').getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), vh: innerHeight };
      });
      check(`${vp.width} ${id}: sheet's Update button reachable, 44px+`, r2.top >= 0 && r2.bottom <= r2.vh && r2.h >= 44, JSON.stringify(r2));
      await p.click('[data-sheet-close]');
    }
  }
  await p.context().close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
