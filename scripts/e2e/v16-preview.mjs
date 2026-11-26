/**
 * V16 experiment click-through. Also drives V17 (same product, new look): pass its URL (docs/ios/V16_EXPERIMENT.md): drives the preview through every scenario the V16
 * contract lists, asserts what each step must show, and saves screenshots (iPhone 390 × 844 @2x, 375, 430, desktop
 * 1280). Needs a running site: `npx astro dev`, then
 *   node scripts/e2e/v16-preview.mjs [base URL] [screenshot dir]
 * Exit code 1 if any check fails.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.argv[2] ?? 'http://127.0.0.1:4321/preview/organized-family-v16';
const OUT = process.argv[3] ?? 'docs/ios/screenshots/v16';
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok) }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`); };
const errors = [];

const browser = await chromium.launch();
async function open(viewport, scale = 2) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|dev-toolbar|\[vite\]/i.test(m.text())) errors.push(m.text()); });
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.goto(`${URL}#/today`);
  await p.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await p.waitForSelector('[data-screen="today"]');
  return p;
}
const shot = async (p, name, full = true) => { await p.waitForTimeout(450); return p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82, fullPage: full }); };
const text = (p, sel = 'main') => p.locator(sel).innerText();
const demo = async (p, sel, value) => {
  if (!(await p.locator('[data-demo-bar]').evaluate((d) => d.open))) await p.click('[data-demo-bar] > summary');
  if (sel === '[data-demo-offline]') await p.click(sel); else await p.selectOption(sel, value);
  await p.locator('[data-demo-bar]').evaluate((d) => { d.open = false; });
};
const rowBtn = (id) => `[data-part="${id}"] > button.v16-row`;
const color = (p, sel) => p.locator(sel).first().evaluate((el) => getComputedStyle(el).color);
const rgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const STAGE_WORDS = /\b(Model|Assist|Watch|Launch|MAWL|stage)\b/;

// ===================================================================== phone, first week
const p = await open({ width: 390, height: 844 });
await shot(p, '01-today-first-week');
let t = await text(p);
check('Today: first-week greeting, gentle invitation to make the plan', /Good (morning|afternoon|evening)\./.test(t) && /Make this week’s plan/.test(t));
check('Today: soccer bag shows under Soccer practice, labeled Suggested', await p.locator('[data-matter="Soccer practice"] [data-today-prep="p-soccer-bag"]').innerText().then((x) => /Sofia · Pack soccer bag/.test(x) && /Suggested/.test(x)));
check('Today: no agreement shown before anyone agreed', (/Agreed household responsibilities appear here/.test(t) || (await p.locator('[data-empty-parts]').count()) === 1) && !(await p.locator('[data-everyone-part]').count()));
check('Today: suggested prep has no checkbox (no fake done state)', (await p.locator('[data-today-prep="p-soccer-bag"] [role="checkbox"]').count()) === 0);
check("Colors: Sofia's avatar is her saved purple, Luis's his brown", (await color(p, '[data-today-prep="p-soccer-bag"] .of-avatar')) === rgb('#6B46C1') && (await color(p, '[data-today-prep="p-pickup"] .of-avatar')) === rgb('#8B5A2B'));

// ---- Plans
await p.click('[data-shortcut="plans"]');
await p.waitForSelector('[data-screen="plans"]');
check('Plans: Soccer practice on Thursday, its bag prep on Wednesday', (await p.locator('[data-day="Thursday"] [data-plan-event="Soccer practice"]').count()) === 1 && (await p.locator('[data-day="Wednesday"] [data-plan-prep="p-soccer-bag"]').count()) === 1);
check("Plans: Ana's private calendar is marked private; Luis's private calendar never appears", /Private · only you/.test(await text(p)) && !/Quarterly review/.test(await text(p)));
check('Plans: ordinary events stay (School, Piano, Dentist)', (await p.locator('[data-plan-event="School"]').count()) === 5 && (await p.locator('[data-plan-event="Piano lesson"]').count()) === 1 && (await p.locator('[data-plan-event="Dentist"]').count()) === 1);
await shot(p, '02-plans-week');
await p.click('[data-day="Thursday"] [data-plan-event="Soccer practice"] button');
check('Plans: an imported event is read-only, edited at its source', /Read-only here: change the date or title in that calendar/.test(await text(p)));
await p.click('[data-add-event]');
await p.fill('[data-new-title]', 'Swim lesson');
await p.selectOption('[data-new-day]', { index: 1 });
await p.fill('[data-new-time]', '17:30');
await p.click('[data-new-save]');
check('Plans: Add event works (Swim lesson on Tuesday)', (await p.locator('[data-day="Tuesday"] [data-plan-event="Swim lesson"]').count()) === 1);
await p.click('[data-view="month"]');
await shot(p, '03-plans-month');
check('Plans: Month view renders with member color dots', (await p.locator('[data-month] .of-dot').count()) > 5);
await p.click('[data-view="agenda"]');
await shot(p, '04-plans-agenda');
check('Plans: Agenda lists the coming two weeks', (await p.locator('[data-agenda] li').count()) > 8);
await p.click('[data-view="week"]');
await p.click('[data-calendars] > summary');
await p.click('[data-feed-private="feed-riverside"]');
check('Privacy: making Riverside FC private removes soccer from the shared week and hides its prep with a reason', (await p.locator('[data-plan-event="Soccer practice"] .v16-pill--private').count()) === 1 && /hidden because its calendar is now private/.test(await text(p)));
await shot(p, '05-plans-calendar-private');
await p.click('[data-feed-shared="feed-riverside"]');
await p.goBack();
await p.waitForSelector('[data-screen="today"]');
check('Browser Back returns from Plans to Today', true);

// ---- Cleaning
await p.click('[data-shortcut="cleaning"]');
await p.selectOption('[data-view-day]', '3');
await shot(p, '06-cleaning-wednesday');
t = await text(p);
check('Cleaning: Daily Reset has all five canonical tasks', ['Make beds', 'Load or unload the dishwasher', 'Clear kitchen counters and table', 'Quick pickup of main living areas', 'Wipe obvious spills and messes'].every((x) => t.includes(x)));
check('Cleaning: Wednesday shows Entry/Bathroom with every task (8)', (await p.locator('[data-zone-session="Entry/Bathroom"] input[type="checkbox"]').count()) === 8);
check('Cleaning: tasks use the cleaning companion’s own checkboxes (TaskList), not round toggles', (await p.locator('[data-screen="cleaning"] ul input[type="checkbox"]').count()) === 13 && (await p.locator('[data-screen="cleaning"] ul .v16-check').count()) === 0);
await p.click('[data-rhythm]');
await shot(p, '07-cleaning-rhythm');
check('Cleaning: Rhythm offers printed calendar, one main day, not right now, Daily Reset', await p.locator('[data-rhythm-panel]').innerText().then((r) => ['Follow the printed calendar', 'One main cleaning day', 'Not right now', 'Include Daily Reset'].every((x) => r.includes(x))) && (await p.locator('[data-mode]').count()) === 3);
await p.click('[data-mode="one-day"]');
await p.selectOption('[data-main-day]', '6');
await p.selectOption('[data-view-day]', '6');
check('Cleaning: one main cleaning day gathers all four zones on Saturday', (await p.locator('[data-zone-session]').count()) === 4);
await p.click('[data-mode="printed"]');
if (await p.locator('[data-sheet]').count()) await p.keyboard.press('Escape'); else await p.click('[data-rhythm]'); // V17: a bottom sheet
// Daily Reset is per date: tick it on TODAY's weekday, the one Today shows (the run may fall on any day).
await p.selectOption('[data-view-day]', String(new Date().getDay()));
await p.locator('[data-daily-reset]').getByText('Make beds').click();
await p.selectOption('[data-view-day]', '3');
await p.click('[data-move-row] [role="checkbox"]');
check('Cleaning: moved session leaves Wednesday', (await p.locator('[data-zone-session="Entry/Bathroom"]').count()) === 0);
await p.selectOption('[data-view-day]', '6');
await p.locator('[data-zone-session="Entry/Bathroom"]').getByText('Clear entry clutter').click();
await p.waitForTimeout(900);
await shot(p, '08-cleaning-moved-to-saturday');
check('Cleaning: Saturday has the same Entry/Bathroom session, marked this week only, plus Home Project', /moved from Wednesday, this week only/i.test(await text(p)) && (await p.locator('[data-weekend-zone="Home Project"]').count()) === 1);
await p.click('[data-view-week="1"]');
await p.selectOption('[data-view-day]', '3');
check('Cleaning: next week is back on Wednesday, unchecked (no forked or reset state carried)', (await p.locator('[data-zone-session="Entry/Bathroom"]').count()) === 1 && !(await p.locator('[data-zone-session="Entry/Bathroom"]').getByLabel('Clear entry clutter').isChecked()));
await p.click('[data-view-week="0"]');
await p.click('[data-move-row] [role="checkbox"]');
check('Cleaning: moving back keeps the check made on Saturday (one session)', (await p.locator('[data-zone-session="Entry/Bathroom"]').getByLabel('Clear entry clutter').isChecked()));
await p.click('text=Back to Today');
check('Today reflects the same Daily Reset check (1 of 5)', /Daily Reset 1 of 5/.test(await p.locator('[data-shortcut="cleaning"]').innerText()));

// ---- Family Meeting: first meeting start to finish
await p.click('[data-tab="meeting"]');
await p.waitForSelector('[data-meeting-step="focus"]');
check('Our Focus: nothing highlighted automatically', (await p.locator('[data-highlight][aria-pressed="true"]').count()) === 0);
await p.click('[data-focus-event="Soccer practice"] [data-highlight]');
await p.click('[data-focus-event="Parent-teacher conference"] [data-highlight]');
await p.click('[data-usual-week] > summary');
await p.fill('[data-focus-note]', 'Grandma visits Saturday');
await p.press('[data-focus-note]', 'Enter');
check("Our Focus: 'Our usual week' holds the recurring school and piano", /School/.test(await p.locator('[data-usual-week]').innerText()) && /Piano lesson/.test(await p.locator('[data-usual-week]').innerText()));
check('Our Focus: three chosen, counted honestly', /3 chosen/.test(await p.locator('[data-focus-count]').innerText()));
await shot(p, '09-meeting-1-our-focus');
await p.click('[data-meeting-next]');

await p.waitForSelector('[data-meeting-step="talk"]');
const q1 = await p.locator('[data-talk-question]').innerText();
check("Let's Talk: the real Club month (November: Owning a complete responsibility)", /This month · Owning a complete responsibility/i.test(await p.locator('[data-talk-card]').innerText()));
await p.click('[data-next-question]');
check("Let's Talk: one question at a time, another on request", (await p.locator('[data-talk-question]').innerText()) !== q1);
await p.selectOption('[data-idea-by]', { label: 'Mateo' });
await p.fill('[data-idea-text]', 'I could feed the dog');
await p.click('[data-add-idea]');
check("Let's Talk: a child's idea is added and NOT accepted automatically", /Not agreed yet/.test(await p.locator('[data-ideas]').innerText()));
await shot(p, '10-meeting-2-lets-talk');
await p.click('[data-meeting-next]');

await p.waitForSelector('[data-meeting-step="parts"]');
await shot(p, '11-meeting-3-everyones-part-collapsed');
await p.click(rowBtn('p-soccer-bag'));
await shot(p, '12-meeting-3-expanded-keep-change-skip');
check("Everyone's Part: expanded row shows Done means and Keep / Change / Skip", /Done means/.test(await p.locator('[data-part="p-soccer-bag"]').innerText()) && (await p.locator('[data-part="p-soccer-bag"] [data-keep]').count()) === 1);
await p.click('[data-part="p-soccer-bag"] [data-change]');
const y0 = await p.evaluate(() => scrollY);
await p.selectOption('[data-part="p-soccer-bag"] [data-edit-owner]', { label: 'Mateo' });
await p.fill('[data-part="p-soccer-bag"] [data-edit-title]', 'Pack soccer bag and water');
await p.fill('[data-part="p-soccer-bag"] [data-edit-finish]', 'Cleats, shin guards, uniform and a full water bottle by the door');
await shot(p, '13-meeting-3-edit-in-place');
check("Everyone's Part: editing happens in place, on the same step", (await p.locator('[data-meeting-step="parts"]').count()) === 1 && Math.abs((await p.evaluate(() => scrollY)) - y0) < 400);
await p.click('[data-part="p-soccer-bag"] [data-done-editing]');
check('Done editing does not agree for the family', (await p.locator('[data-part="p-soccer-bag"]').getAttribute('data-part-state')) === 'suggested');
await p.click('[data-part="p-soccer-bag"] [data-keep]');
check('Keep = kept for discussion, still not agreed', (await p.locator('[data-part="p-soccer-bag"]').getAttribute('data-part-state')) === 'kept');
await p.click('[data-part="p-soccer-bag"] [data-we-agree]');
check('We agree = agreed', (await p.locator('[data-part="p-soccer-bag"]').getAttribute('data-part-state')) === 'agreed');
await p.click('[data-part="p-soccer-bag"] [data-change]');
await p.selectOption('[data-part="p-soccer-bag"] [data-edit-owner]', { label: 'Sofia' });
check('Changing the owner of an agreement invalidates it', (await p.locator('[data-part="p-soccer-bag"]').getAttribute('data-part-state')) === 'changed');
await p.click('[data-part="p-soccer-bag"] [data-done-editing]');
await p.click('[data-part="p-soccer-bag"] [data-we-agree]');
check('…and it needs a fresh We agree', (await p.locator('[data-part="p-soccer-bag"]').getAttribute('data-part-state')) === 'agreed');
check("Ideas stay visible without 'see more'", (await p.locator('[data-proposals] [data-part^="p-idea"]').count()) === 1);
await p.click('[data-more-suggestions]');
await shot(p, '14-meeting-3-all-suggestions');
check('Other suggestions include cleaning, family plan and the Club month idea', (await p.locator('[data-part="p-entry"]').count()) === 1 && (await p.locator('[data-part="p-pickup"]').count()) === 1 && (await p.locator('[data-part^="p-month-"]').count()) >= 1);
await p.click(rowBtn('p-entry'));
await p.click('[data-part="p-entry"] [data-keep]');
await p.click('[data-part="p-entry"] [data-we-agree]');
await p.click(rowBtn('p-pickup'));
await p.click('[data-part="p-pickup"] [data-skip]');
check('Skip moves it to Skipped', (await p.locator('[data-skipped]').count()) === 1);
await p.click('[data-meeting-next]');

await p.waitForSelector('[data-meeting-step="practice"]');
t = await text(p);
check("Let's Practice: one natural question about an agreed part (Sofia's bag), no stage words", /How much help will Sofia need with “Pack soccer bag and water” at first\?/.test(t) && !STAGE_WORDS.test(t));
await shot(p, '15-meeting-4-lets-practice');
check("Let's Practice: two clear answers first; the rest behind 'Other answers'", (await p.locator('[data-practice-choice]').count()) === 2);
await p.click('[data-practice-more]');
check('Other answers reveal the remaining two', (await p.locator('[data-practice-choice]').count()) === 4);
await p.click('[data-practice-choice="start"].v16-choice--primary');
check("Let's Practice: the family's decision is saved through the engine, in plain words", /Saved\. This week: Do it together/.test(await p.locator('[data-practice-outcome]').innerText()));
check("Let's Practice: Club month practice activity is available", /This month’s practice: Say your job out loud/.test(await text(p)));
const weekly = await p.locator('[data-wall-preview="weekly"]').innerText();
check('Wall (weekly): Sofia’s bag written Wednesday; printed zones shown; cleaning jobs not copied', /Sofia: Pack soccer bag and water/.test(weekly) && /ENTRY\/BATHROOM|Entry\/Bathroom/i.test(weekly) && !/Put shoes and bags away/.test(weekly));
check("Wall (weekly): Sofia's ink is her own color", (await p.locator('[data-wall-preview="weekly"] .v16-hand', { hasText: 'Sofia:' }).first().evaluate((el) => getComputedStyle(el).color)) === rgb('#6B46C1'));
await shot(p, '16-meeting-4-wall-weekly');
await p.selectOption('[data-wall-format]', 'monthly');
const monthly = await p.locator('[data-wall-preview="monthly"]').innerText();
check('Wall (monthly): family-name rows × days, with To Do', /Family Names/.test(monthly) && /To Do/.test(monthly) && /Mateo/.test(monthly) && /Put shoes and bags away/.test(monthly));
await p.locator('[data-wall-preview="monthly"]').scrollIntoViewIfNeeded();
await shot(p, '17-meeting-4-wall-monthly');
await p.click('text=We’ll add it together');
await p.click('[data-meeting-next]');
await p.waitForSelector('[data-plan-summary]');
t = await text(p);
check('Finish: We have a plan, with real priorities and only agreed parts', /We have a plan/.test(t) && /Grandma visits Saturday/.test(t) && /Sofia · Pack soccer bag and water/.test(t) && !/Pick up Mateo and Elena/.test(t) && !/feed the dog/.test(t));
await shot(p, '18-meeting-we-have-a-plan');
await p.click('[data-back-to-today]');

// ---- Today after the meeting
t = await text(p);
check('Today: agreement shows beneath its activity, in the owner’s color, on the earlier day', /Sofia · Pack soccer bag and water/.test(await p.locator('[data-matter="Soccer practice"]').innerText()) && /Wednesday/.test(await p.locator('[data-today-prep="p-soccer-bag"]').innerText()) && (await color(p, '[data-today-prep="p-soccer-bag"] .of-avatar')) === rgb('#6B46C1'));
check('Today: agreed preparation has one real checkbox', (await p.locator('[data-today-prep="p-soccer-bag"] [role="checkbox"]').count()) === 1);
check("Today: Everyone's part shows Mateo's agreement with the cleaning task's own check", /Mateo · Put shoes and bags away/.test(await p.locator('[data-everyone-part="p-entry"]').innerText()));
check('Today: the conference stays visible even though its prep was skipped', /Parent-teacher conference/.test(t));
check('Today: the linked cleaning task uses the companion’s square box, not a round toggle', (await p.locator('[data-everyone-part="p-entry"] [data-cleaning-box]').count()) === 1);
await p.click('[data-everyone-part="p-entry"] [role="checkbox"]');
await shot(p, '19-today-after-first-meeting');
await p.click('[data-shortcut="cleaning"]');
await p.selectOption('[data-view-day]', '3');
check('One completion state: the check on Today is the Cleaning task’s check', (await p.locator('[data-zone-session="Entry/Bathroom"]').getByLabel('Put shoes, coats and bags away').isChecked()) && /Mateo’s part/.test(await p.locator('[data-zone-session="Entry/Bathroom"]').innerText()));
await p.click('text=Back to Today');

// ---- Activity moved / cancelled in its source calendar
await demo(p, '[data-demo-soccer]', 'moved');
check('Moved: soccer shows Friday, its bag moves to Thursday', /Friday/.test(await p.locator('[data-matter="Soccer practice"]').innerText()) && /Thursday/.test(await p.locator('[data-today-prep="p-soccer-bag"]').innerText()));
await shot(p, '20-today-soccer-moved');
await demo(p, '[data-demo-soccer]', 'cancelled');
check('Cancelled: no stale details; agreement kept for next time', /Cancelled in its calendar/.test(await text(p)) && /agreement stays/.test(await text(p)));
await demo(p, '[data-demo-soccer]', 'as-planned');

// ---- Offline
await demo(p, '[data-demo-offline]');
await p.click('[data-tab="meeting"]');
await p.click('text=Open the meeting again');
for (let i = 0; i < 2; i++) await p.click('[data-meeting-next]');
await p.click('[data-skipped] > summary');
await p.click(rowBtn('p-pickup'));
await p.click('[data-part="p-pickup"] >> text=Bring it back');
if (await p.locator('[data-more-suggestions][aria-expanded="false"]').count()) await p.click('[data-more-suggestions]');
await p.click(rowBtn('p-pickup'));
await p.click('[data-part="p-pickup"] [data-keep]');
await p.click('[data-part="p-pickup"] [data-we-agree]');
check('Offline: an agreement made offline says it is waiting to share', /waiting to share/.test(await p.locator('[data-part="p-pickup"]').innerText()));
await demo(p, '[data-demo-offline]');
check('Back online: pending clears', !/waiting to share/.test(await p.locator('[data-part="p-pickup"]').innerText()));
await p.click('[data-come-back-later]');
check('Come back later returns to Today with a resumable invitation, no penalty', /Continue your Family Meeting/.test(await text(p)) && /Everyone’s Part/.test(await text(p)));

// ===================================================================== week four
await demo(p, '[data-demo-scenario]', 'week4');
await p.waitForSelector('[data-screen="today"]');
t = await text(p);
check('Week four Today: earlier agreements carried forward, check-in invitation', /A good week starts here/.test(t) && /A quick family check-in/.test(t) && /Mateo · Put shoes and bags away/.test(t) && /Luis · Take out trash and recycling/.test(t));
check('Week four Today: focus carried from last time, labeled', /Still your focus from last time/.test(t));
check('Week four Today: next meeting time comes from the real calendar event', /Next Family Meeting: Sunday at 5 PM \(on your calendar\)/.test(t));
await shot(p, '21-week-four-today');
await p.click('[data-invite="check-in"]');
await p.waitForSelector('[data-check-in]');
t = await text(p);
check('Check-in: still-working agreements need no re-approval', /Still working/.test(t) && /Nothing to confirm again/.test(t) && (await p.locator('[data-still-working] [data-we-agree]').count()) === 0);
check('Check-in: new Friday field trip with a Thursday lunch proposal', /New · Friday/i.test(t) && /School field trip/.test(t) && /Sofia · Thursday/.test(await p.locator('[data-part="p-lunch"]').innerText()));
check('Check-in: readiness question is about Mateo’s real agreement; owned skill (Sofia) not asked', /Could Mateo try “Put shoes and bags away” without help\?/.test(t) && !/Sofia need/.test(t));
await shot(p, '22-week-four-check-in');
await p.click('[data-part="p-lunch"] [data-keep]');
await p.click('[data-part="p-lunch"] [data-we-agree]');
await p.click('[data-practice-choice="advance"]');
check('Readiness: "Let’s try" is a family decision, saved in plain words', /Saved\. This week: Let Mateo do it while you observe/.test(await text(p)) && !STAGE_WORDS.test(await text(p)));
await p.click('[data-finish-check-in]');
await p.waitForSelector('[data-screen="today"]');
check('After check-in: Sofia’s lunch is her part, shown under the field trip, on Thursday', /Thursday/.test(await p.locator('[data-everyone-event="School field trip"] [data-today-prep="p-lunch"]').innerText()));
check('Agreeing to prepare did NOT make the field trip a priority', (await p.locator('[data-matter="School field trip"]').count()) === 0);
await shot(p, '23-week-four-today-after-check-in');
await p.click('[data-tab="meeting"]');
await p.click('text=Open the meeting again');
for (let i = 0; i < 2; i++) await p.click('[data-meeting-next]');
check('Full meeting in week four: earlier agreements listed as still in place', /Already agreed · still in place \(3\)/.test(await text(p)));
await shot(p, '24-week-four-everyones-part');
await p.click('[data-in-force] > summary');
await p.click(rowBtn('p-entry'));
await p.click('[data-part="p-entry"] [data-change]');
await p.selectOption('[data-part="p-entry"] [data-edit-owner]', { label: 'Sofia' });
await p.click('[data-part="p-entry"] [data-done-editing]');
await p.click('[data-come-back-later]');
check('Mid-meeting edit, not re-agreed: Today still shows the durable agreement (Mateo)', /Mateo · Put shoes and bags away/.test(await p.locator('[data-everyone-part="p-entry"]').innerText()));
await p.click('[data-tab="meeting"]');
await p.click('[data-meeting-next]');
await p.waitForSelector('[data-meeting-step="practice"]');
await p.click('[data-meeting-next]');
await p.waitForSelector('[data-plan-summary]');
check('Meeting ends without We agree: the agreement stays exactly as last agreed', /Mateo · Put shoes and bags away/.test(await text(p)) && !/Sofia · Put shoes and bags away/.test(await text(p)));
await p.click('text=Open the meeting again');
for (let i = 0; i < 2; i++) await p.click('[data-meeting-next]');
check('Keep does not outlive the meeting: no part is still "kept" after finishing', (await p.locator('[data-part-state="kept"], [data-part-state="changed"]').count()) === 0);
await p.click('[data-come-back-later]');

// ===================================================================== free, one adult
await demo(p, '[data-demo-plan]', 'free');
await p.click('[data-tab="meeting"]');
check('Meeting resumes where the family left it', (await p.locator('[data-meeting-step="parts"]').count()) === 1);
await p.click('[data-meeting-back]');
t = await p.locator('[data-talk-card]').innerText();
check('Free household: the real four-part meeting without Club content', /Our conversation/i.test(t) && !/This month/i.test(t));
await shot(p, '25-free-lets-talk');
await p.click('[data-come-back-later]');
await p.click('[data-shortcut="resources"]');
check('Free household: Resources has no Club kit', (await p.locator('[data-club-month]').count()) === 0);
await demo(p, '[data-demo-adults]', 'one');
await p.click('[data-account]');
check('One-adult household: no absent-partner blocker', /One adult runs this family’s plan/.test(await text(p)));
await shot(p, '26-one-adult-account');

const phoneText = await p.locator('body').innerText();
check('No MAWL stage names anywhere on screen', !/\b(Model|Assist|Watch|Launch)\b|MAWL/.test(phoneText));
await p.context().close();

// ===================================================================== widths and desktop
for (const w of [375, 430]) {
  const q = await open({ width: w, height: 860 }, 1);
  check(`${w}px: no horizontal scroll on Today`, await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await shot(q, `27-today-${w}`, false);
  await q.click('[data-tab="meeting"]');
  check(`${w}px: no horizontal scroll on Our Focus`, await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await q.context().close();
}
const d = await open({ width: 1280, height: 900 }, 1);
check('Desktop: tabs in the header, no bottom bar', await d.locator('.v16-topnav').isVisible() && !(await d.locator('.v16-tabbar').isVisible()));
await shot(d, '30-desktop-today');
await d.click('.v16-topnav >> text=Family Meeting');
await shot(d, '31-desktop-our-focus');
await d.click('[data-meeting-next]'); await d.click('[data-meeting-next]');
await d.click(rowBtn('p-soccer-bag')); await d.click('[data-part="p-soccer-bag"] [data-change]');
await shot(d, '32-desktop-everyones-part-edit');
await d.click('.v16-topnav >> text=Today');
await d.click('[data-shortcut="plans"]');
await shot(d, '33-desktop-plans');
await d.click('[data-plans-done]');
await d.click('[data-shortcut="cleaning"]');
await shot(d, '34-desktop-cleaning');
await d.context().close();
await browser.close();

check('No page errors', errors.length === 0, errors.join(' | '));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
