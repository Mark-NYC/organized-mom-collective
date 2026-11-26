/**
 * V18 intelligent Today checks (docs/ios/V18_TODAY_INTELLIGENCE.md): run after `npx astro dev`.
 *   node scripts/e2e/v18-today.mjs [base URL] [screenshot dir]
 *
 * - all 13 preview scenarios: a headline, at most one heads-up card, no page errors, no AI branding in the product;
 * - the heads-up card's exact palette (bg, eyebrow, heading, body, primary, secondary), radius, padding, no shadow/border;
 * - flows through existing workflows: Finish the plan → We agree; Make a plan → Suggest it (a proposal, not an agreement);
 *   Dismiss (attention line stays, survives reload); Already handled; Bring it up Sunday (meeting topic);
 *   Review our week; Review the plan; the meeting resume row;
 * - the simulated interpreter: party read as a birthday when available; deterministic fallback when it's down,
 *   and turning it back on refines the card; "Why am I seeing this?" labels simulated data;
 * - Ana and Luis see different cards; household memory is correctable in Account;
 * - nothing ends up under the floating tab bar at 390 and 430, card or bottom of the page;
 * - V16 and V17 demo state is never touched.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.argv[2] ?? 'http://127.0.0.1:4321/preview/organized-family-v18';
const OUT = process.argv[3] ?? 'docs/ios/screenshots/v18';
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
  await p.selectOption('[data-demo-v18]', id);
  await bar.locator('summary').click();
  await p.evaluate(() => scrollTo(0, 0));
  await settle(p, 500);
}
const headline = (p) => p.locator('[data-v18-headline]').innerText();
const cardTitle = async (p) => ((await p.locator('[data-heads-up]').count()) ? p.locator('.v18-heads-title').innerText() : null);
const style = (p, sel, prop) => p.locator(sel).first().evaluate((el, pr) => getComputedStyle(el)[pr], prop);

// ---------------------------------------------------------------- every scenario
const EXPECT = {
  normal: ['You’re on track.', null],
  'field-trip': ['You’re on track.', 'Tomorrow’s school field trip runs through lunch.'],
  party: ['You’re on track.', 'Zoe’s party on Saturday needs an RSVP, a gift, a card and a ride.'],
  changed: ['Your plans have changed.', 'Soccer practice starts at 3 PM today, not 4 PM.'],
  busy: ['Tomorrow’s a busy one.', 'Three full days in a row.'],
  'open-loop': ['A little preparation will help.', 'You talked about pickup for tomorrow’s school field trip, but nobody has it yet.'],
  development: ['You’re on track.', 'Mateo has done “Put shoes and bags away” well three check-ins in a row.'],
  pattern: ['A little preparation will help.', 'Saturday’s soccer game needs a ride.'],
  dismissed: ['You’re on track.', null],
  'two-adults': ['A couple of things need attention.', 'Tomorrow’s school field trip runs through lunch.'],
  meeting: ['You’re partway through this week’s plan.', null],
  'all-done': ['Everything’s taken care of today.', null],
  'ai-down': ['You’re on track.', 'Zoe’s party on Saturday may need an RSVP and a ride.'],
};
{
  const p = await open();
  for (const [id, [h, title]] of Object.entries(EXPECT)) {
    await scenario(p, id);
    if (id === 'party') await p.waitForFunction(() => document.querySelector('.v18-heads-title')?.textContent?.includes('gift'), null, { timeout: 5000 }).catch(() => {});
    check(`${id}: headline "${h}"`, (await headline(p)) === h, await headline(p));
    check(`${id}: ${title ? 'one card' : 'no card'}`, (await p.locator('[data-heads-up]').count()) === (title ? 1 : 0) && (await cardTitle(p)) === title, String(await cardTitle(p)));
    const product = await p.locator('main').innerText();
    check(`${id}: no AI branding in the product`, !/\bAI\b|assistant|chatbot|artificial intelligence|Claude/i.test(product), product.match(/\bAI\b|assistant|chatbot|Claude/i)?.[0]);
    await shot(p, `scenario-${String(Object.keys(EXPECT).indexOf(id) + 1).padStart(2, '0')}-${id}`);
  }
  await p.context().close();
}

// ---------------------------------------------------------------- the card's palette and shape
{
  const p = await open();
  await scenario(p, 'field-trip');
  const card = '[data-heads-up]';
  check('card: background #EDE5DA', (await style(p, card, 'backgroundColor')) === 'rgb(237, 229, 218)', await style(p, card, 'backgroundColor'));
  check('card: radius 24px', (await style(p, card, 'borderTopLeftRadius')) === '24px', await style(p, card, 'borderTopLeftRadius'));
  check('card: padding 20px', (await style(p, card, 'paddingTop')) === '20px' && (await style(p, card, 'paddingLeft')) === '20px');
  check('card: no shadow', (await style(p, card, 'boxShadow')) === 'none', await style(p, card, 'boxShadow'));
  check('card: no border', (await style(p, card, 'borderTopWidth')) === '0px', await style(p, card, 'borderTopWidth'));
  check('card: eyebrow #655548', (await style(p, '.v18-heads-eyebrow', 'color')) === 'rgb(101, 85, 72)');
  check('card: eyebrow icon #655548', (await style(p, '.v18-heads-eyebrow .v17-icon', 'color')) === 'rgb(101, 85, 72)');
  check('card: heading #151515', (await style(p, '.v18-heads-title', 'color')) === 'rgb(21, 21, 21)');
  check('card: body #514843', (await style(p, '.v18-heads-body', 'color')) === 'rgb(81, 72, 67)');
  check('card: primary #493F3C', (await style(p, '.v18-heads-primary', 'color')) === 'rgb(73, 63, 60)');
  check('card: Dismiss #75695E', (await style(p, '.v18-heads-dismiss', 'color')) === 'rgb(117, 105, 94)');
  check('card: primary text action with an arrow', (await p.locator('.v18-heads-primary').innerText()).replace(/\s+/g, ' ').trim() === 'Finish the plan →');
  check('What matters: "Our week ›"', (await p.locator('[data-our-week]').innerText()).trim().startsWith('Our week'));
  check('What matters: "Done yesterday ✓" under soccer practice', (await p.locator('[data-matter="Soccer practice"] [data-done-yesterday]').innerText()) === 'Done yesterday ✓');
  check('What matters: field trip attention line', (await p.locator('[data-matter="School field trip"] [data-attention]').innerText()) === 'Lunch needs attention.');
  check('field trip is not made a priority', (await p.locator('[data-matter="School field trip"][data-priority]').count()) === 0);
  await shot(p, 'card-field-trip');

  // Finish the plan → the existing proposal → We agree → the card resolves.
  await p.click('[data-heads-action="finish-plan"]');
  await p.waitForSelector('[data-insight-sheet]');
  check('sheet: the existing lunch proposal (Sofia)', (await p.locator('[data-insight-sheet] [data-part="p-lunch"]').count()) === 1);
  await shot(p, 'sheet-finish-plan');
  await p.click('[data-insight-sheet] [data-part="p-lunch"] > button');
  await p.click('[data-insight-sheet] [data-keep]');
  await p.click('[data-insight-sheet] [data-we-agree]');
  await settle(p);
  check('agreeing resolves it ("All set")', (await p.locator('[data-sheet-resolved]').count()) === 1);
  await p.click('[data-sheet-close]');
  check('after agreeing: no card', (await p.locator('[data-heads-up]').count()) === 0);
  check('after agreeing: the attention line is gone', (await p.locator('[data-attention]').count()) === 0);
  check('after agreeing: Sofia’s lunch is in Everyone’s part', (await p.locator('[data-today-prep="p-lunch"][data-state="agreed"]').count()) === 1);
  check('V16 and V17 demo state untouched', await p.evaluate(() => localStorage.getItem('omc:v16-preview:v1') === '"v16-sentinel"' && localStorage.getItem('omc:v16-preview:v1:v17') === '"v17-sentinel"'));
  await p.context().close();
}

// ---------------------------------------------------------------- Dismiss, reload, Already handled, Bring it up
{
  const p = await open();
  await scenario(p, 'field-trip');
  await p.click('[data-heads-dismiss]');
  await settle(p);
  check('dismiss: card gone', (await p.locator('[data-heads-up]').count()) === 0);
  check('dismiss: attention line stays', (await p.locator('[data-attention]').innerText()) === 'Lunch needs attention.');
  await p.reload(); await p.waitForSelector('[data-screen="today"]'); await settle(p);
  check('dismiss: survives reload', (await p.locator('[data-heads-up]').count()) === 0);

  await scenario(p, 'pattern');
  await p.click('[data-heads-action="make-plan"]');
  await p.waitForSelector('[data-possibility="ride"]');
  check('make a plan: possibility names Luis, as a possibility', (await p.locator('[data-possibility="ride"]').innerText()).includes('Could be Luis. Luis drove the last 3 times.'));
  await p.locator('[data-why] summary').click();
  check('why: inferred memory is marked "noticed, not confirmed"', (await p.locator('[data-why] [data-memory="inferred"]').innerText()).includes('noticed, not confirmed'));
  await p.click('[data-suggest]');
  await settle(p);
  check('Suggest it: a proposal row, Suggested, not agreed', (await p.locator('[data-insight-sheet] [data-part-state="suggested"]').count()) === 1);
  await shot(p, 'sheet-make-plan');
  await p.click('[data-sheet-handled]');
  await settle(p);
  check('Already handled: card gone', (await p.locator('[data-heads-up]').count()) === 0);
  check('Already handled: attention line gone', (await p.locator('[data-attention]').count()) === 0);

  await p.click('[data-account]');
  await p.waitForSelector('[data-noticed]');
  check('Account: household memory listed', (await p.locator('[data-noticed] [data-memory="inferred"]').count()) === 1);
  await p.click('[data-noticed] [data-forget]');
  check('Account: Forget removes it', (await p.locator('[data-noticed] [data-memory]').count()) === 0);
  await p.goto(`${URL}#/today`); await p.waitForSelector('[data-screen="today"]');

  await scenario(p, 'development');
  check('development: primary is "Bring it up Sunday"', (await p.locator('.v18-heads-primary').innerText()).startsWith('Bring it up Sunday'));
  await p.click('[data-heads-action="bring-up"]');
  await settle(p);
  check('bring it up: card gone', (await p.locator('[data-heads-up]').count()) === 0);
  check('bring it up: the meeting row counts it', (await p.locator('[data-meeting-topics]').innerText()) === '1 thing to bring up');
  await p.evaluate(() => { location.hash = '/meeting'; });
  await p.waitForSelector('[data-meeting-step]');
  const next = p.locator('[data-meeting-step="focus"] ~ * button, button:has-text("Next")').first();
  if (await p.locator('[data-meeting-step="talk"]').count() === 0 && await next.count()) await next.click().catch(() => {});
  await settle(p);
  if (await p.locator('[data-meeting-step="talk"]').count()) check('Let’s Talk lists what was brought up', (await p.locator('[data-meeting-topics-list]').innerText()).includes('Mateo'));
  await p.context().close();
}

// ---------------------------------------------------------------- routes into existing workflows; the interpreter
{
  const p = await open();
  await scenario(p, 'busy');
  await p.click('[data-heads-action="review-week"]');
  await settle(p);
  check('Review our week opens Plans', (await p.locator('[data-v16]').getAttribute('data-route')) === 'plans');
  await p.goto(`${URL}#/today`); await p.waitForSelector('[data-screen="today"]');

  await scenario(p, 'changed');
  await p.click('[data-heads-action="review-plan"]');
  await p.waitForSelector('[data-insight-sheet]');
  check('Review the plan: Luis’s drive, editable', (await p.locator('[data-insight-sheet] [data-part="p-drive-soccer"]').count()) === 1);
  await shot(p, 'sheet-review-plan');
  await p.click('[data-sheet-close]');

  await scenario(p, 'meeting');
  check('meeting in progress: resume row', (await p.locator('[data-meeting-row="resume"]').innerText()).includes('You stopped at Everyone’s Part'));
  await p.click('[data-meeting-row="resume"]');
  check('resume opens the meeting', (await p.locator('[data-v16]').getAttribute('data-route')) === 'meeting');
  await p.goto(`${URL}#/today`); await p.waitForSelector('[data-screen="today"]');

  await scenario(p, 'ai-down');
  check('interpreter down: rules fallback', (await cardTitle(p)) === 'Zoe’s party on Saturday may need an RSVP and a ride.');
  await p.locator('[data-demo-bar] summary').click();
  await p.check('[data-demo-ai]');
  await p.locator('[data-demo-bar] summary').click();
  await p.waitForFunction(() => document.querySelector('.v18-heads-title')?.textContent?.includes('gift'), null, { timeout: 5000 }).catch(() => {});
  check('interpreter back: refined to a birthday (gift, card)', (await cardTitle(p)) === 'Zoe’s party on Saturday needs an RSVP, a gift, a card and a ride.', await cardTitle(p));
  await p.click('[data-heads-action="make-plan"]');
  await p.locator('[data-why] summary').click();
  check('why: simulated data is labeled', (await p.locator('[data-simulated]').count()) === 1);
  check('why: Mateo’s card memory is "you told us"', (await p.locator('[data-why] [data-memory="confirmed"]').innerText()).includes('Mateo makes the card.'));
  check('notes instructions never reach Today', !(await p.locator('main').innerText()).includes('Ignore previous'));
  await shot(p, 'sheet-party-why');
  await p.click('[data-sheet-close]');

  await scenario(p, 'two-adults');
  check('Ana: the lunch card', (await cardTitle(p)) === 'Tomorrow’s school field trip runs through lunch.');
  await p.locator('[data-demo-bar] summary').click();
  await p.selectOption('[data-demo-viewer]', 'm-luis');
  await p.locator('[data-demo-bar] summary').click();
  await settle(p);
  check('Luis: the change (he’s driving)', (await cardTitle(p)) === 'Soccer practice starts at 3 PM today, not 4 PM.');
  await shot(p, 'two-adults-luis');
  await p.context().close();
}

// ---------------------------------------------------------------- nav clearance and safe areas
for (const vp of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
  const p = await open(vp);
  for (const id of ['field-trip', 'busy', 'meeting']) {
    await scenario(p, id);
    await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await settle(p, 350);
    const r = await p.evaluate(() => {
      const last = document.querySelector('.v16-shortcuts'); const bar = document.querySelector('.v16-tabbar');
      const a = last.getBoundingClientRect(), b = bar.getBoundingClientRect();
      return { last: Math.round(a.bottom), bar: Math.round(b.top) };
    });
    check(`${vp.width} ${id}: page end clears the tab bar`, r.last <= r.bar - 4, JSON.stringify(r));
    // The card's actions are never under the bar when the card is scrolled to the bar's edge.
    if (await p.locator('[data-heads-up]').count()) {
      await p.locator('.v18-heads-actions').scrollIntoViewIfNeeded();
      const q = await p.evaluate(() => {
        const a = document.querySelector('.v18-heads-actions').getBoundingClientRect(), b = document.querySelector('.v16-tabbar').getBoundingClientRect();
        return { actions: Math.round(a.bottom), bar: Math.round(b.top) };
      });
      check(`${vp.width} ${id}: card actions visible above the tab bar`, q.actions <= q.bar, JSON.stringify(q));
    }
  }
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await shot(p, `bottom-${vp.width}`);
  await p.context().close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
