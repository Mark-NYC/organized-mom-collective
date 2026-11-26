/**
 * V17 polish checks (docs/ios/V17_VISUAL_SYSTEM.md): run after `npx astro dev`.
 *   node scripts/e2e/v17-polish.mjs [base URL] [screenshot dir]
 *
 * For both primary themes (forest green, calendar brown) at real phone widths (390 × 844 and 430 × 932):
 * - nothing ever ends up under the floating tab bar: the last control on every screen and every meeting part clears it
 *   when scrolled to the bottom (Back/Continue, Come back later, Finish, Back to Today);
 * - the tab bar steps aside while a text field is focused (the keyboard owns the bottom of the screen);
 * - the month calendar: no cell backgrounds, today ringed, the selected date a solid circle, readable contrast;
 * - positive states stay forest green in the brown theme (agreed, progress, cleaning checks);
 * - the Family Meeting completion moment appears once, and reduced motion turns its animation off;
 * - no colored shadows under buttons and cards.
 * Screenshots are viewport-only (what a phone shows), so overlap is visible if it happens.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.argv[2] ?? 'http://127.0.0.1:4321/preview/organized-family-v17';
const OUT = process.argv[3] ?? 'docs/ios/screenshots/v17-polish';
mkdirSync(OUT, { recursive: true });
const results = [];
const errors = [];
const check = (name, ok, detail = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`); };
const browser = await chromium.launch();

async function open(theme, viewport, extra = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...extra });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.evaluate((t) => { localStorage.clear(); localStorage.setItem('omc:v17-theme', t); }, theme);
  await p.goto(`${URL}#/today`);
  await p.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await p.waitForSelector('[data-screen="today"]');
  return p;
}
const settle = (p, ms = 450) => p.waitForTimeout(ms);
const shot = async (p, name) => { await settle(p); await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 84 }); };
const toBottom = async (p) => { await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await settle(p, 350); };
const toTop = async (p) => { await p.evaluate(() => scrollTo(0, 0)); await settle(p, 200); };
/** The element's bottom edge is above the tab bar's top edge (with a little air) when scrolled fully down. */
async function clears(p, sel, label) {
  await toBottom(p);
  const r = await p.evaluate((s) => {
    const el = document.querySelector(s); const bar = document.querySelector('.v16-tabbar');
    if (!el || !bar) return null;
    const a = el.getBoundingClientRect(), b = bar.getBoundingClientRect();
    return { el: Math.round(a.bottom), bar: Math.round(b.top), visible: getComputedStyle(bar).opacity !== '0' };
  }, sel);
  check(`${label}: clears the tab bar`, r && (!r.visible || r.el <= r.bar - 4), JSON.stringify(r));
}
const rgb = (p, sel, prop) => p.locator(sel).first().evaluate((el, pr) => getComputedStyle(el)[pr], prop);

for (const theme of ['forest', 'brown']) {
  for (const vp of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    const tag = `${theme}-${vp.width}`;
    const p = await open(theme, vp);
    check(`${tag}: theme applied`, (await p.locator('[data-v16]').getAttribute('data-theme')) === theme);
    if (theme === 'brown') {
      const look = await p.evaluate(() => { const root = document.querySelector('[data-v16]'); const b = document.querySelector('button.v16-card'); return { page: getComputedStyle(root).backgroundColor, cta: getComputedStyle(b).backgroundImage }; });
      check(`${tag}: brown theme uses the app's warm ivory page (#FAF7F1)`, look.page === 'rgb(250, 247, 241)', look.page);
      check(`${tag}: brown call to action is a gradient of the established browns`, look.cta.includes('linear-gradient') && look.cta.includes('rgb(95, 75, 57)') && look.cta.includes('rgb(74, 63, 62)'), look.cta);
    }
    const primary = await p.locator('[data-v16]').evaluate((el) => getComputedStyle(el).getPropertyValue('--v17-primary').trim());
    check(`${tag}: primary color token is ${theme === 'brown' ? 'the calendar brown #4a3f3e' : 'forest green #3e7a43'}`, primary === (theme === 'brown' ? '#4a3f3e' : '#3e7a43'), primary);
    check(`${tag}: no colored shadow under the primary button card`, (await rgb(p, 'button.v16-card', 'boxShadow')) === 'none');
    if (vp.width === 390) await shot(p, `${tag}-01-today`);
    await clears(p, '[data-shortcut="resources"]', `${tag} Today`);
    if (vp.width === 390) await shot(p, `${tag}-02-today-bottom`);

    // Plans → Month: clean grid, today ringed, a different day selected as a solid circle
    await toTop(p);
    await p.click('[data-shortcut="plans"]');
    await p.click('[data-view="month"]');
    const other = await p.locator('[data-month] button:not([data-today]):not([data-outside])').nth(9);
    await other.click();
    await settle(p, 500);
    const cellBg = await rgb(p, '[data-month] button:not([aria-pressed="true"]) ', 'backgroundColor');
    check(`${tag} Month: no gray cell backgrounds`, cellBg === 'rgba(0, 0, 0, 0)', cellBg);
    const sel = await p.locator('[data-month] button[aria-pressed="true"] .v16-mday').evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundImage !== 'none' ? s.backgroundImage : s.backgroundColor, color: s.color, r: s.borderRadius }; });
    check(`${tag} Month: selected date is a solid circle in the primary color, white number`, sel.color === 'rgb(255, 255, 255)' && sel.r.startsWith('999') && sel.bg !== 'rgba(0, 0, 0, 0)', JSON.stringify(sel));
    const today = await p.locator('[data-month] button[data-today] .v16-mday').evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, ring: s.boxShadow }; });
    check(`${tag} Month: today is a ring (distinct from the selected date)`, today.bg === 'rgba(0, 0, 0, 0)' && today.ring.includes('inset'), JSON.stringify(today));
    const num = await rgb(p, '[data-month] button:not([data-today]):not([aria-pressed="true"]):not([data-outside]) .v16-mday', 'color');
    check(`${tag} Month: date numbers in the theme's ink (near-black; warm charcoal #4B4544 in brown)`, num === (theme === 'brown' ? 'rgb(75, 69, 68)' : 'rgb(18, 22, 20)'), num);
    if (vp.width === 390) { await p.locator('[data-month]').scrollIntoViewIfNeeded(); await shot(p, `${tag}-03-plans-month`); }
    await clears(p, '[data-calendars]', `${tag} Plans`);

    // Cleaning: positive green on checks in both themes
    await p.goBack(); await p.waitForSelector('[data-screen="today"]');
    await p.click('[data-shortcut="cleaning"]');
    await p.selectOption('[data-view-day]', '3');
    await p.locator('[data-daily-reset]').getByText('Make beds').click();
    await settle(p, 400);
    const box = await p.locator('[data-daily-reset] li').first().locator('label > input + span').evaluate((el) => getComputedStyle(el).borderColor);
    check(`${tag} Cleaning: done check is forest green in every theme`, box === 'rgb(62, 122, 67)', box);
    if (vp.width === 390) await shot(p, `${tag}-04-cleaning`);
    await clears(p, '[data-cleaning-back]', `${tag} Cleaning`);
    await toTop(p);
    await p.click('[data-cleaning-back]');

    // Family Meeting: every part's last control clears the bar
    await p.click('[data-tab="meeting"]');
    await p.click('[data-focus-event="Soccer practice"] [data-highlight]');
    await p.click('[data-focus-event="Parent-teacher conference"] [data-highlight]');
    await clears(p, '[data-come-back-later]', `${tag} Our Focus`);
    if (vp.width === 390) await shot(p, `${tag}-05-our-focus-bottom`);
    // typing: the tab bar steps aside
    await p.focus('[data-focus-note]');
    await settle(p, 350);
    check(`${tag}: tab bar steps aside while typing`, (await rgb(p, '.v16-tabbar', 'opacity')) === '0');
    await p.locator('[data-focus-note]').blur();
    await settle(p, 350);
    check(`${tag}: tab bar returns after typing`, (await rgb(p, '.v16-tabbar', 'opacity')) === '1');
    await toTop(p); await p.click('[data-meeting-next]');
    await clears(p, '[data-come-back-later]', `${tag} Let's Talk`);
    await toTop(p); await p.click('[data-meeting-next]');
    await p.click('[data-part="p-soccer-bag"] > button.v16-row');
    await p.click('[data-part="p-soccer-bag"] [data-keep]');
    await p.click('[data-part="p-soccer-bag"] [data-we-agree]');
    await settle(p, 400);
    const agreed = await rgb(p, '[data-part="p-soccer-bag"] .v16-pill--agreed', 'color');
    check(`${tag}: "Agreed" stays forest green in every theme`, agreed === 'rgb(62, 122, 67)', agreed);
    const step = await rgb(p, '.v17-steps > span[data-on]', 'backgroundColor');
    check(`${tag}: meeting progress stays forest green`, step === 'rgb(62, 122, 67)', step);
    if (vp.width === 390) { await toTop(p); await shot(p, `${tag}-06-everyones-part`); }
    await clears(p, '[data-come-back-later]', `${tag} Everyone's Part`);
    await toTop(p); await p.click('[data-meeting-next]');
    await clears(p, '[data-come-back-later]', `${tag} Let's Practice`);
    await p.click('[data-meeting-next]');
    await p.waitForSelector('[data-plan-summary]');
    check(`${tag}: completion moment appears after Finish meeting`, (await p.locator('[data-celebrate]').count()) === 1);
    await settle(p, 1300);
    if (vp.width === 390) await shot(p, `${tag}-07-we-have-a-plan`);
    await clears(p, '[data-back-to-today]', `${tag} We have a plan`);
    await p.click('[data-back-to-today]');
    await p.click('[data-tab="meeting"]');
    check(`${tag}: the celebration plays once, not on every return`, (await p.locator('[data-celebrate]').count()) === 0);

    // Week four check-in
    await p.click('[data-demo-bar] > summary');
    await p.selectOption('[data-demo-scenario]', 'week4');
    await p.locator('[data-demo-bar]').evaluate((d) => { d.open = false; });
    await p.click('[data-invite="check-in"]');
    if (vp.width === 390) await shot(p, `${tag}-08-check-in`);
    await clears(p, '[data-full-meeting]', `${tag} Check-in`);
    await p.context().close();
  }
}

// Reduced motion: the completion moment is shown without animation
{
  const p = await open('forest', { width: 390, height: 844 }, { reducedMotion: 'reduce' });
  await p.click('[data-tab="meeting"]');
  for (let i = 0; i < 3; i++) { await p.click('[data-meeting-next]'); }
  await p.click('[data-meeting-next]');
  await p.waitForSelector('[data-celebrate]');
  const anim = await p.locator('.v17-celebrate-art').evaluate((el) => getComputedStyle(el).animationName);
  check('Reduced motion: completion animation is off', anim === 'none', anim);
  const route = await p.locator('.v16-route').evaluate((el) => getComputedStyle(el).animationName);
  check('Reduced motion: screen transitions are off', route === 'none', route);
  await p.context().close();
}

await browser.close();
check('No page errors', errors.length === 0, errors.join(' | '));
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
