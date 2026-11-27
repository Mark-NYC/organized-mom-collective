/**
 * V21 preview checks (docs/ios/V21_PREVIEW.md): run after `npx astro dev`.
 *   node scripts/e2e/v21-preview.mjs [base URL] [screenshot dir]
 *
 * Walks the sixteen scenarios through the real interface, as both adults on one shared household state: events never
 * create obligations, a conflict reaches its owner, routines stay in Everyone's part, the handoff (ask → I've got it /
 * Not this time → confirmation → completion), remembered decisions, a routine card, the meeting carrying what's open,
 * a quiet day, several requests, a first Family Meeting. Then: solid black text, 44px targets, no horizontal scroll at
 * 375/390/430, the two-tab navigation, and that /app and the V16–V20 previews' storage are untouched.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.argv[2] ?? 'http://127.0.0.1:4321/preview/organized-family-v21';
const OUT = process.argv[3] ?? 'docs/ios/screenshots/v21';
mkdirSync(OUT, { recursive: true });
const results = [];
const errors = [];
const check = (name, ok, detail = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`); };
const browser = await chromium.launch();

async function open(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = 'astro-dev-toolbar{display:none!important}'; document.head.append(st);
  }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('omc:v16-preview:v1:v20', '"v20-sentinel"'); });
  await p.goto(`${URL}#/today`);
  await p.waitForSelector('[data-screen="today"]');
  return p;
}
const settle = (p, ms = 350) => p.waitForTimeout(ms);
const shot = async (p, name) => { await settle(p); await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 84 }); };
async function scenario(p, id, viewer) {
  await p.selectOption('[data-scenario-select]', id);
  if (viewer) await p.click(`[data-viewer="m-${viewer}"]`);
  await p.evaluate(() => scrollTo(0, 0));
  await settle(p);
}
const as = async (p, viewer) => { await p.click(`[data-viewer="m-${viewer}"]`); await p.evaluate(() => scrollTo(0, 0)); await settle(p); };
const headline = (p) => p.locator('[data-v21-headline]').innerText();
const text = (p, sel) => p.locator(sel).innerText();
const count = (p, sel) => p.locator(sel).count();

const p = await open();

// ------------------------------------------------------------------ the week, Meg: Friday pickup needs a plan
await scenario(p, 'week', 'meg');
check('Meg: "Friday pickup needs a plan."', (await headline(p)) === 'Friday pickup needs a plan.', await headline(p));
check('Meg: one card, "Who’s picking up the boys?" · 2:30 PM · Needs an owner', (await text(p, '[data-matter="needs-owner"]')).includes('Who’s picking up the boys?') && (await text(p, '[data-matter="needs-owner"]')).includes('2:30 PM · Needs an owner'));
check('Today’s plan keeps the agreed commitments with owners', (await count(p, '[data-plan-item]')) === 3 && (await text(p, '[data-plan-count]')) === '0 of 3 commitments completed');
check('date line is the full date', /^[A-Z]+DAY, [A-Z]+ \d+$/.test(await text(p, '.v21-date')), await text(p, '.v21-date'));
await shot(p, '01-meg-week');

// ------------------------------------------------------------------ 7. Meg asks Mark; Mark's view; accept; confirmation; completion
await p.click('[data-make-plan]');
await p.waitForSelector('[data-make-plan-sheet]');
check('Make a plan offers I’ll do it, Ask Mark, the meeting', (await count(p, '[data-take]')) === 1 && (await count(p, '[data-ask="m-mark"]')) === 1);
await shot(p, '02-meg-make-plan');
await p.click('[data-ask="m-mark"]');
await settle(p);
check('asking doesn’t transfer: Meg sees "Waiting for Mark"', (await text(p, '[data-matter="waiting"]')).includes('Waiting for Mark'));
check('Meg’s widget state: Waiting for Mark', (await text(p, '[data-widget="m-meg"]')).includes('Waiting for Mark'));
await as(p, 'mark');
check('7. Mark: "Meg needs a hand."', (await headline(p)) === 'Meg needs a hand.');
check('7. Mark: "Can you pick up the boys?" · Friday · 2:30 PM · From Meg', (await text(p, '[data-matter="request-in"]')).includes('Friday · 2:30 PM · From Meg'));
check('Mark’s widget state offers the two answers', (await count(p, '[data-widget="m-mark"] [data-widget-action]')) === 2);
await shot(p, '03-mark-request');
await p.click('[data-matter="request-in"] [data-answer="accept"]');
await settle(p);
check('accepted: the request leaves Mark’s priorities', (await count(p, '[data-matter="request-in"]')) === 0);
const pickup = p.locator('[data-plan-item^="p-rq"]');
check('accepted: Mark sees it as his commitment, not done', (await pickup.count()) === 1 && (await pickup.getAttribute('data-mine')) === '' && (await pickup.getAttribute('data-done')) === null);
await shot(p, '04-mark-accepted');
await as(p, 'meg');
check('Meg: clear confirmation "Mark has it"', (await text(p, '[data-matter="accepted"]')).includes('Mark has it') && (await headline(p)) === 'Mark has it.');
check('Meg can make Mark the usual (optional)', (await count(p, '[data-matter="accepted"] [data-make-usual]')) === 1);
await shot(p, '05-meg-confirmed');
await p.click('[data-matter="accepted"] [data-ack]');
await settle(p);
check('the confirmation quietly leaves; the plan shows Mark', (await count(p, '[data-matter="accepted"]')) === 0 && (await p.locator('[data-plan-item^="p-rq"] [data-chip]').innerText()) === 'Mark');
check('Meg’s Today is quiet now', (await headline(p)) === 'Nothing needs you today.');
// 9. completion is separate
await as(p, 'mark');
await p.locator('[data-plan-item^="p-rq"] [role="checkbox"]').click();
await settle(p);
check('9. completion is its own action', (await p.locator('[data-plan-item^="p-rq"]').getAttribute('data-done')) === '');

// ------------------------------------------------------------------ 8. declined
await scenario(p, 'handoff-ask', 'mark');
await p.click('[data-matter="request-in"] [data-answer="decline"]');
await settle(p);
check('8. Mark declined: nothing on his Today about it', (await count(p, '[data-matter]')) === 0 || !(await p.locator('[data-what-matters]').innerText()).includes('pick up'));
await as(p, 'meg');
check('8. Meg: "Mark can’t pick up the boys." · still needs a plan', (await text(p, '[data-matter="declined"]')).includes('Still needs a plan') && (await headline(p)) === 'Friday pickup still needs a plan.');
check('8. nobody owns pickup', !(await p.locator('[data-todays-plan]').innerText()).includes('Pick up the boys'));
await shot(p, '06-meg-declined');
await p.click('[data-matter="declined"] [data-make-plan]');
check('8. Mark isn’t offered again', (await count(p, '[data-ask="m-mark"]')) === 0);
await p.click('[data-take]');
await settle(p);
check('8. Meg takes it: on her plan, priorities quiet', (await p.locator('[data-todays-plan]').innerText()).includes('Pick up the boys') && (await count(p, '[data-matter="declined"]')) === 0);
if (await count(p, '[data-sheet]')) await p.click('[data-sheet-close]');

// ------------------------------------------------------------------ 1–3. events never create obligations
await scenario(p, 'birthday-none', 'meg');
check('1. Johan’s birthday: not in What matters', !(await text(p, '[data-what-matters]')).includes('Johan'));
check('1. offered quietly in Our week', (await p.locator('[data-week="Johan’s birthday"] [data-plan-something]').innerText()) === 'Plan something');
check('14. quiet: "Nothing needs you today." and the plan stays', (await headline(p)) === 'Nothing needs you today.' && (await count(p, '[data-plan-item]')) > 0);
check('14. quiet widget', (await text(p, '[data-widget="m-meg"]')).includes('Nothing needs you'));
await shot(p, '07-quiet-birthday');
await p.click('[data-week="Johan’s birthday"] [data-plan-something]');
await p.waitForSelector('[data-intent-sheet]');
check('birthday options: text, card, gift, party + Nothing needed', (await count(p, '[data-intent-option]')) === 4 && (await count(p, '[data-intent-nothing]')) === 1);
await shot(p, '08-birthday-options');
await p.click('[data-intent-option="card"]');
await p.click('[data-remember]');
await p.click('[data-intent-save]');
await settle(p);
check('2. chosen: the card is on the plan with its owner', (await p.locator('[data-todays-plan]').innerText()).includes('Mail Johan’s birthday card'));
check('2. Our week shows the choice', (await p.locator('[data-week="Johan’s birthday"] [data-week-status]').innerText()).includes('Meg · Mail Johan’s birthday card'));
await scenario(p, 'school-event', 'mark');
check('3. School concert: awareness only', !(await text(p, '[data-what-matters]')).includes('concert') && (await count(p, '[data-week="School concert"]')) === 1);

// ------------------------------------------------------------------ 4. conflict
await scenario(p, 'conflict', 'mark');
check('4. Mark: "Something overlaps." with his dentist and pickup', (await headline(p)) === 'Something overlaps.' && (await text(p, '[data-matter="conflict"]')).includes('Your dentist overlaps “Pick up the boys”.'));
check('4. one card, no duplicate backup card', (await count(p, '[data-matter="change"]')) === 0);
await shot(p, '09-mark-conflict');
await p.click('[data-matter="conflict"] [data-ask-other]');
await p.waitForSelector('[data-ask-sheet]');
check('4. asking Meg: just this Friday by default, "from now on" separate', (await p.locator('[data-scope-once]').getAttribute('aria-checked')) === 'true' && (await count(p, '[data-scope-always]')) === 1);
await p.click('[data-send-ask]');
await settle(p);
await as(p, 'meg');
check('4. Meg is asked, Mark’s usual stays his', (await text(p, '[data-matter="request-in"]')).includes('Can you pick up the boys?'));
await as(p, 'meg');
check('4. Meg doesn’t see Mark’s conflict', (await count(p, '[data-matter="conflict"]')) === 0);

// ------------------------------------------------------------------ 5, 11, 12. routines, memory, routine card
await scenario(p, 'routine', 'meg');
check('5. routines aren’t on the parent’s checklist', !(await text(p, '[data-todays-plan]')).includes('floor'));
await p.click('[data-agreements-toggle]');
check('5. Everyone’s part: Andrew and Philip’s floors', (await count(p, '[data-agreement="p-floor-andrew"]')) === 1 && (await count(p, '[data-agreement="p-floor-philip"]')) === 1);
await p.locator('[data-agreement="p-floor-andrew"] [data-create-card]').click();
await p.waitForSelector('[data-routine-card-sheet]');
check('12. card prefilled from the agreement', (await p.inputValue('[data-card-title]')) === 'Andrew’s floor routine' && (await p.inputValue('[data-card-when]')) === 'After I get dressed.'
  && (await p.inputValue('[data-card-done]')).startsWith('I can walk from my bed'));
await p.fill('[data-card-what]', 'Put away clothes and pick up my floor.');
await p.click('[data-card-palette="blue-green"]');
check('12. customizing updates the card', (await p.locator('[data-routine-card-sheet] [data-routine-card]').innerText()).includes('Put away clothes and pick up my floor.'));
check('12. hand-drawn responsibility art', (await p.locator('[data-routine-card-sheet] [data-routine-card] img').getAttribute('src')).includes('clean-my-floor'));
await shot(p, '10-routine-card');
await p.emulateMedia({ media: 'print' });
await p.evaluate(() => { window.print = () => {}; });
await p.click('[data-print-card]');
await settle(p, 300);
const printOk = await p.evaluate(() => { const r = document.querySelector('[data-print-root]'); return Boolean(r) && getComputedStyle(r).display === 'block' && document.querySelector('[data-v21-stage]').getClientRects().length === 0; });
check('12. print shows only the card', printOk);
await p.emulateMedia({ media: 'screen' });
await p.click('[data-sheet-close]');
await settle(p);
await p.evaluate(() => document.documentElement.classList.remove('v21-printing'));

await scenario(p, 'memory', 'meg');
check('11. remembered preference informs the suggestion', (await p.locator('[data-week="Johan’s birthday"] [data-week-usually]').innerText()).includes('send Johan a birthday text'));
await p.click('[data-agreements-toggle]');
check('11. decisions listed: preference and each-time', (await count(p, '[data-decision-kind="preference"]')) === 1 && (await count(p, '[data-decision-kind="each-time"]')) === 1);
await p.locator('[data-decision-kind="preference"] [data-edit-decision]').click();
await p.fill('[data-decision-text]', 'We usually call Johan');
await p.click('[data-save-decision]');
await settle(p);
check('11. edited', (await text(p, '[data-decision-kind="preference"]')).includes('We usually call Johan'));
await shot(p, '11-memory');
await p.locator('[data-decision-kind="preference"] [data-forget-decision]').click();
await settle(p);
check('11. removable', (await count(p, '[data-decision-kind="preference"]')) === 0);
await p.locator('[data-agreement="p-trash"] [data-edit-agreement]').click();
await p.fill('[data-edit-cue]', 'By 7:00 PM');
await p.click('[data-save-agreement]');
await as(p, 'mark');
await as(p, 'meg');
check('standing agreement edited by its owner: no notice to herself', (await count(p, '[data-matter="changed"]')) === 0);

// ------------------------------------------------------------------ 6. weekly
await scenario(p, 'weekly-due', 'meg');
check('6. Thursday: trash on Meg’s plan tonight', (await headline(p)) === 'Take out the trash tonight.' && (await text(p, '[data-plan-item="p-trash"]')).includes('Tonight · 8:00 PM'));
await shot(p, '12-weekly-due');

// ------------------------------------------------------------------ 10. two views
await scenario(p, 'two-views', 'meg');
const megH = await headline(p);
await as(p, 'mark');
const markH = await headline(p);
check('10. two adults, two views of one plan', megH === 'Nothing needs you today.' && markH === 'Meg needs a hand.', `${megH} / ${markH}`);
await p.click('[data-scope="mine"]');
check('10. Mine filters to Mark’s and shared items', (await p.locator('[data-plan-item]').allInnerTexts()).every((t) => /Mark|Together/.test(t)));

// ------------------------------------------------------------------ 15. several
await scenario(p, 'multiple', 'mark');
check('15. three requests, most important first', (await count(p, '[data-matter="request-in"]')) === 3 && (await p.locator('[data-matter="request-in"]').first().innerText()).includes('pick up the boys'));
check('15. widget shows the first with +2', (await text(p, '[data-widget="m-mark"] [data-widget-more]')) === '+2');
await shot(p, '13-multiple');
await p.click('[data-widget="m-mark"] [data-widget-action="got-it"]');
await settle(p);
check('widget answer uses the same rule (idempotent)', (await count(p, '[data-matter="request-in"]')) === 2);

// ------------------------------------------------------------------ 13. carried into the meeting
await scenario(p, 'carry', 'meg');
await p.click('[data-tab="meeting"]');
await p.waitForSelector('[data-meeting-step]');
await p.click('[data-meeting-next]');
await p.waitForSelector('[data-meeting-step="talk"]');
check('13. Let’s Talk picks up the declined pickup', (await count(p, '[data-carry-kind="declined"]')) === 1);
await shot(p, '14-meeting-carry');
await p.click('[data-carry-owner="m-mark"]');
await settle(p);
await p.click('[data-tab="today"]');
await settle(p);
check('13. decided at the table: Mark has it on Today', (await p.locator('[data-todays-plan]').innerText()).includes('Pick up the boys'));

// ------------------------------------------------------------------ 16. first time
await scenario(p, 'first-time', 'meg');
check('16. first-time: the meeting first', (await headline(p)) === 'Let’s make your first plan.' && (await count(p, '[data-meeting-row="first"]')) === 1);
await shot(p, '15-first-time');
await p.click('[data-meeting-row="first"]');
await p.waitForSelector('[data-meeting-step]');
for (let i = 0; i < 2; i++) { await p.click('[data-meeting-next]'); await settle(p); }
await p.waitForSelector('[data-meeting-step="parts"]');
const firstPart = p.locator('[data-proposals] [data-part]').first();
const hadSuggestion = await p.locator('[data-proposals] [data-part]').count();
if (hadSuggestion) {
  if (!(await firstPart.locator('[data-we-agree]').count())) { await firstPart.locator('> button').click(); await settle(p); }
  if (await firstPart.locator('[data-keep]').count()) { await firstPart.locator('[data-keep]').click(); await settle(p); }
  await firstPart.locator('[data-we-agree]').click(); await settle(p);
}
await shot(p, '16-first-meeting-agree');
check('16. the first meeting has prepared suggestions to agree', hadSuggestion > 0);
await p.click('[data-meeting-next]');
await settle(p);
const finish = p.locator('[data-meeting-next]');
if (await finish.count()) await finish.click();
await settle(p, 500);
await p.click('[data-tab="today"]');
await settle(p);
check('16. after the meeting, Today is no longer first-time', (await headline(p)) !== 'Let’s make your first plan.', await headline(p));

// ------------------------------------------------------------------ design and accessibility
await scenario(p, 'handoff-ask', 'mark');
const nonBlack = await p.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('.v21-phone :is(p,span,h1,h2,h3,button,label,a)')) {
    if (!el.textContent.trim() || el.closest('.v21-btn--dark,[data-chip],.v21-wordmark')) continue;
    const c = getComputedStyle(el).color;
    if (c !== 'rgb(0, 0, 0)') bad.push(`${el.tagName}.${el.className}:${c}`);
  }
  return bad;
});
check('solid black text in the light interface (Today)', nonBlack.length === 0, nonBlack.slice(0, 5).join(' | '));
const blackOn = async (route) => {
  await p.evaluate((r) => { location.hash = `/${r}`; }, route);
  await settle(p, 500);
  return p.evaluate(() => [...document.querySelectorAll('.v21-phone :is(p,span,h1,h2,h3,button,label,a,li)')].filter((el) => el.textContent.trim() && !el.closest('.of-btn:not(.of-btn--soft),.v21-btn--dark,[data-chip],.v21-wordmark,[data-routine-card]'))
    .map((el) => getComputedStyle(el).color).filter((c) => c !== 'rgb(0, 0, 0)'));
};
for (const r of ['meeting', 'account', 'plans', 'cleaning']) { const bad = await blackOn(r); check(`solid black text: ${r}`, bad.length === 0, bad.slice(0, 3).join(' | ')); }
await p.evaluate(() => { location.hash = '/today'; });
await settle(p, 400);
const small = await p.evaluate(() => [...document.querySelectorAll('.v21-phone :is(button,[role=checkbox])')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height < 34; }).map((b) => b.textContent.trim()).slice(0, 5));
check('tap targets at least 34px (44px for primary actions)', small.length === 0, small.join(', '));
const actions = await p.evaluate(() => [...document.querySelectorAll('[data-answer]')].every((b) => b.getBoundingClientRect().height >= 44));
check('I’ve got it / Not this time are 44px+', actions);
check('two tabs only', (await count(p, '.v21-tabbar [data-tab]')) === 2);
for (const w of [375, 390, 430]) {
  await p.setViewportSize({ width: w, height: 844 });
  await settle(p);
  const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(`no horizontal scroll at ${w}px`, !over);
}
const v20 = await p.evaluate(() => localStorage.getItem('omc:v16-preview:v1:v20'));
check('V20 preview storage untouched', v20 === '"v20-sentinel"');
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
