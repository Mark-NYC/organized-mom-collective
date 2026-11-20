#!/usr/bin/env node
/**
 * Browser QA for the development layer of the weekly Family Meeting (docs/product/FAMILY_DEVELOPMENT_ENGINE.md), on
 * a website build pointed at the isolated test backend (scripts/e2e/test-backend.mjs on a throwaway database from
 * family-db.sh + seed.sql). Real database functions, real migration 20261207, no mocks. Never touches production.
 *
 *   PGHOST=localhost PGUSER=postgres bash scripts/e2e/family-db.sh && psql -d omc_family_e2e -f scripts/e2e/seed.sql
 *   E2E_DB=omc_family_e2e node scripts/e2e/test-backend.mjs &
 *   PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 PUBLIC_SUPABASE_ANON_KEY=e2e-anon PUBLIC_ACCOUNTS_ENABLED=true \
 *     PUBLIC_CLUB_ENABLED=true npx astro build --outDir dist-qa
 *   node scripts/e2e/family-development-qa.mjs dist-qa [out=e2e-development] [--axe=path/to/axe.min.js]
 *
 * Covers: signed out, free family, Club family without and with records, two children, "We agreed" saving record and
 * agreement together, a failed save and its retry, a failed load, pause taking the agreement off the list, MAWL
 * wording, Club access lost and an account switch in another tab while the meeting is open, the four parts,
 * phone (393), large phone (430) and desktop (1440): overflow, touch targets, focus, keyboard, axe.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.argv[2] ?? 'dist-qa';
const OUT = process.argv.find((a, i) => i > 2 && !a.startsWith('--')) ?? 'e2e-development';
const AXE = process.argv.find((a) => a.startsWith('--axe='))?.slice(6) ?? null;
const API = 'http://127.0.0.1:54321';
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const cands = [join(ROOT, p), join(ROOT, p, 'index.html'), join(ROOT, `${p}.html`)];
  const file = cands.find((f) => existsSync(f) && statSync(f).isFile());
  if (!file) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;

let failures = 0;
const results = [];
const check = (step, ok, detail = '') => {
  results.push({ step, ok: Boolean(ok), detail });
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`);
};
const note = (step, detail) => { results.push({ step, ok: null, detail }); console.log(`  • ${step} — ${detail}`); };
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;
const settle = (page, ms = 700) => page.waitForTimeout(ms);
const shot = (page, name, full = true) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full });

const browser = await chromium.launch();
const VIEWPORTS = { phone: { width: 393, height: 852 }, large: { width: 430, height: 932 }, desktop: { width: 1440, height: 900 } };
const newCtx = (vp, extra = {}) => browser.newContext({ viewport: VIEWPORTS[vp], deviceScaleFactor: 1, hasTouch: vp !== 'desktop', isMobile: vp !== 'desktop', ...extra });

async function signIn(page, email) {
  await page.goto(`${base}/club/login`, { waitUntil: 'networkidle' });
  await page.fill('#club-email', email);
  await page.click('button:has-text("Email me a code")');
  await page.fill('#club-code', '123456');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
}
const MEETING = '/app/family/meeting';
const openMeeting = async (page) => { await page.goto(`${base}${MEETING}`, { waitUntil: 'networkidle' }); await settle(page, 1500); };
const step = async (page, i) => { await page.click(`[data-meeting-step="${i}"]`); await settle(page, 400); };

async function layout(page, label) {
  const r = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const small = [...document.querySelectorAll('[data-development-next-steps] button, [data-development-check-ins] button, [data-development-next-steps] input, [data-development-next-steps] summary')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ t: (b.textContent || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 30), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width }))
      .filter((b) => b.h < 44 || b.w < 44);
    const tiny = [...document.querySelectorAll('[data-development-next-steps] *, [data-development-check-ins] *')]
      .filter((e) => !e.classList.contains('of-eyebrow')) // the app-wide uppercase section label, same on every screen
      .filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.offsetParent !== null)
      .map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((s) => s < 12);
    return { overflow, small, tiny: tiny.length };
  });
  check(`${label}: no horizontal overflow`, r.overflow <= 1, `${r.overflow}px`);
  check(`${label}: development buttons and fields are at least 44px`, r.small.length === 0, JSON.stringify(r.small));
  check(`${label}: no development text under 12px`, r.tiny === 0, `${r.tiny} elements`);
}
async function axe(page, label) {
  if (!AXE) return note(`${label}: axe`, 'skipped (no --axe)');
  await page.addScriptTag({ path: AXE });
  const v = await page.evaluate(async () => (await window.axe.run(document.querySelector('[data-weekly-meeting]') ?? document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations
    .map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, where: x.nodes.slice(0, 2).map((n) => n.target.join(' ')) })));
  const serious = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  check(`${label}: axe (WCAG 2.1 AA) no serious/critical issues in the meeting`, serious.length === 0, JSON.stringify(serious));
  if (v.length > serious.length) note(`${label}: axe minor`, JSON.stringify(v.filter((x) => !serious.includes(x))));
}
const devCount = (page) => page.locator('[data-development-next-steps], [data-development-check-ins], [data-development-practice]').count();
const ids = async () => JSON.parse(await sql(`select json_build_object('maya', (select id from club_family_members where first_name='Maya'), 'leo', (select id from club_family_members where first_name='Leo'))`));

console.log(`family development QA: site ${base}, isolated backend ${API}`);

// ------------------------------------------------------------------ 1. signed out and free: no paid layer
{
  const ctx = await newCtx('phone'); const page = await ctx.newPage();
  await openMeeting(page);
  check('signed out: the meeting opens', await page.locator('[data-weekly-meeting]').count() === 1);
  check('signed out: no development guidance', await devCount(page) === 0);
  await step(page, 2);
  check('signed out: Everyone\'s Part asks to sign in', await page.locator('a[href*="/app/sign-in"]').count() > 0);
  await shot(page, '01-signed-out-everyones-part');
  await signIn(page, 'rosa@e2e.test');
  await openMeeting(page);
  check('free family: meeting is the free kind', (await page.getAttribute('[data-weekly-meeting]', 'data-meeting-kind')) === 'free');
  for (let i = 0; i < 4; i++) { await step(page, i); check(`free family: part ${i + 1} has no development guidance`, await devCount(page) === 0); }
  await shot(page, '02-free-everyones-part');
  await ctx.close();
}

// ------------------------------------------------------------------ 2. Club family, no records yet, two children
const jenCtx = await newCtx('phone'); const jen = await jenCtx.newPage();
const consoleErrors = [];
jen.on('pageerror', (e) => consoleErrors.push(e.message));
await signIn(jen, 'jen@e2e.test');
await openMeeting(jen);
const kids = await ids();
check('Club family: meeting is the Club kind', (await jen.getAttribute('[data-weekly-meeting]', 'data-meeting-kind')) === 'club');
await step(jen, 1);
check('no records: Let\'s Talk has no development check-in yet', await jen.locator('[data-development-check-ins]').count() === 0);
await step(jen, 2);
const people = await jen.locator('[data-development-person]').evaluateAll((els) => els.map((e) => e.getAttribute('data-development-person')));
check('no records: one next step each, for the two children only', JSON.stringify(people.sort()) === JSON.stringify(['Leo', 'Maya']), people.join(','));
const monthDup = await jen.locator('[data-meeting-suggestion="Maya"], [data-meeting-suggestion="Leo"]').count();
check('no duplicate: a child with a development step gets no month suggestion too', monthDup === 0, `${monthDup}`);
check('no records: each child has exactly one idea', await jen.locator('[data-development-person="Leo"] [data-development-suggest]').count() === 1 && await jen.locator('[data-development-person="Maya"] [data-development-suggest]').count() === 1);
await layout(jen, 'phone 393 · Everyone\'s Part (ideas)');
await jen.click('[data-development-person="Leo"] [data-development-adjust] summary');
const stages = await jen.locator('[data-development-person="Leo"] [data-development-stage]').allTextContents();
check('all four MAWL stages in the approved words', JSON.stringify(stages) === JSON.stringify(['I’ll show them how', 'We’ll do it together', 'They’ll do it, I’ll coach', 'Ready to take full responsibility']), stages.join(' · '));
await layout(jen, 'phone 393 · idea adjust panel open');
await shot(jen, '03b-idea-adjust-open');
await jen.click('[data-development-person="Leo"] [data-development-adjust] summary');
await axe(jen, 'phone 393 · Everyone\'s Part');
await shot(jen, '03-club-no-records-everyones-part');
const leoSkill = await jen.getAttribute('[data-development-person="Leo"] [data-development-suggest]', 'data-development-suggest');
const mayaSkill = await jen.getAttribute('[data-development-person="Maya"] [data-development-suggest]', 'data-development-suggest');

// "We agreed" for Leo, by keyboard: record + agreement saved together; focus moves to the result.
await jen.locator('[data-development-person="Leo"] [data-development-agree]').focus();
await jen.keyboard.press('Enter');
await jen.waitForSelector('[data-development-person="Leo"] [data-development-saved]', { timeout: 10000 });
const savedText = await jen.textContent('[data-development-person="Leo"] [data-development-saved]');
check('We agreed: says it is saved and on the child\'s list', /Saved: agreed by our family\. It’s on Leo’s list/.test(savedText), savedText);
check('We agreed: focus moves to the result (screen readers hear it)', await jen.evaluate(() => document.activeElement?.hasAttribute('data-development-saved')));
const db1 = JSON.parse(await sql(`select json_build_object('records', (select count(*) from household_development where member_id = '${kids.leo}' and skill_id = '${leoSkill}' and status = 'active'), 'agreements', (select count(*) from club_responsibilities where agreed_source = 'skill:${leoSkill}' and owner_ids = array['${kids.leo}']::uuid[] and deleted_at is null), 'linked', (select count(*) from household_development d join club_responsibilities a on a.id = d.agreement_id where d.member_id = '${kids.leo}'))`));
check('We agreed: exactly one record and one agreement, linked', db1.records === 1 && db1.agreements === 1 && db1.linked === 1, JSON.stringify(db1));
check('We agreed: the agreement shows on the family\'s list on this page', ((await jen.locator('[data-agreed-parts] [data-part-person="Leo"]').textContent()) ?? '').includes(await sql(`select title from household_development where member_id = '${kids.leo}'`)));

// A failed save for Maya: nothing claimed, nothing half-saved; the retry saves once.
await jenCtx.route(`${API}/rest/v1/rpc/household_development_decide`, (r) => r.abort('internetdisconnected'));
await jen.click('[data-development-person="Maya"] [data-development-agree]');
await jen.waitForSelector('[data-development-person="Maya"] [data-development-error]', { timeout: 10000 });
check('failed save: says it was not saved', /Not saved/.test(await jen.textContent('[data-development-person="Maya"] [data-development-error]')));
check('failed save: no "Saved" message', await jen.locator('[data-development-person="Maya"] [data-development-saved]').count() === 0);
check('failed save: the button offers to try again', /Try again/.test(await jen.textContent('[data-development-person="Maya"] [data-development-agree]')));
check('failed save: nothing in the database', (await sql(`select count(*) from household_development where member_id = '${kids.maya}'`)) === '0' && (await sql(`select count(*) from club_responsibilities where owner_ids = array['${kids.maya}']::uuid[] and agreed_source like 'skill:%'`)) === '0');
await shot(jen, '04-failed-save', false);
await jenCtx.unroute(`${API}/rest/v1/rpc/household_development_decide`);
// The answer is lost on the way back once (the save happened): the retry must not double it.
let dropped = false;
await jenCtx.route(`${API}/rest/v1/rpc/household_development_decide`, async (r) => {
  if (dropped) return r.continue();
  dropped = true;
  await r.fetch(); // reaches the database…
  return r.abort('connectionreset'); // …but the phone never hears back
});
await jen.click('[data-development-person="Maya"] [data-development-agree]');
await jen.waitForSelector('[data-development-person="Maya"] [data-development-error]', { timeout: 10000 });
await jen.click('[data-development-person="Maya"] [data-development-agree]');
await jen.waitForSelector('[data-development-person="Maya"] [data-development-saved]', { timeout: 10000 });
await jenCtx.unroute(`${API}/rest/v1/rpc/household_development_decide`);
const db2 = JSON.parse(await sql(`select json_build_object('records', (select count(*) from household_development where member_id = '${kids.maya}'), 'agreements', (select count(*) from club_responsibilities where owner_ids = array['${kids.maya}']::uuid[] and agreed_source = 'skill:${mayaSkill}'))`));
check('lost answer + retry: one record and one agreement, not two', db2.records === 1 && db2.agreements === 1, JSON.stringify(db2));
check('lost answer + retry: then says saved', /Saved: agreed by our family/.test(await jen.textContent('[data-development-person="Maya"] [data-development-saved]')));

// Return later: same responsibility, same stage; no repeated idea.
await openMeeting(jen);
await step(jen, 2);
check('return later: the agreed skills are not suggested again', await jen.locator(`[data-development-suggest="${leoSkill}"], [data-development-suggest="${mayaSkill}"]`).count() === 0);
await step(jen, 0); await step(jen, 3);
await shot(jen, '05-club-lets-practice');

// ------------------------------------------------------------------ 3. a week later: check-in, Watch, pause
await sql(`update household_development set stage = 'watch', last_check_in_on = current_date - 8, cue = 'After dinner' where member_id = '${kids.leo}'`);
await openMeeting(jen);
await step(jen, 1);
check('a week later: Let\'s Talk asks how Leo\'s skill is going', await jen.locator(`[data-development-check-in="${leoSkill}"]`).count() === 1);
check('Watch: the question is about the usual time without reminders', /without a reminder/.test(await jen.textContent(`[data-development-check-in="${leoSkill}"]`)));
check('Watch: offers "a different kind of day"', await jen.locator('[data-development-variation]').count() === 1);
check('no duplicate: the old follow-through doesn\'t ask about the same agreement', await jen.locator('[data-check-in]').count() === 0);
await layout(jen, 'phone 393 · Let\'s Talk (check-in)');
await axe(jen, 'phone 393 · Let\'s Talk');
await shot(jen, '06-watch-check-in');
await jen.check('[data-development-variation]');
await jen.click(`[data-development-check-in="${leoSkill}"] [data-development-answer="strong"]`);
await jen.waitForSelector(`[data-development-check-in="${leoSkill}"] [data-development-saved]`);
const afterCheck = await sql(`select stage || ',' || status || ',' || last_value || ',' || variations_practiced from household_development where member_id = '${kids.leo}'`);
check('check-in "Usually": recorded, stage stays Watch (no automatic Launch)', afterCheck === 'watch,active,strong,1', afterCheck);
await step(jen, 2);
const next = jen.locator(`[data-development-next="${leoSkill}"]`);
check('Everyone\'s Part: Launch is offered only as the family\'s own decision', /Hand over responsibility/.test(await next.textContent()) && /Doing it on their own is progress/.test(await next.textContent()));
check('Everyone\'s Part: the stage is in plain words', /They’ll do it, I’ll coach/.test(await next.textContent()));
await shot(jen, '07-watch-next-step');
await next.locator('[data-development-decision="pause"]').click();
await jen.waitForSelector(`[data-development-next="${leoSkill}"] [data-development-saved]`);
check('pause: says it is off everyone\'s list', /off everyone’s list/.test(await next.textContent()));
const paused = await sql(`select d.status || ',' || (a.deleted_at is not null) from household_development d join club_responsibilities a on a.id = d.agreement_id where d.member_id = '${kids.leo}'`);
check('pause: record paused and its agreement removed (tombstone), together', paused === 'paused,true', paused);
check('pause: the agreement is gone from the family\'s list on this page', !(await jen.locator('[data-agreed-parts] [data-part-person="Leo"]').count() ? await jen.locator('[data-agreed-parts] [data-part-person="Leo"]').textContent() : '').includes(await sql(`select title from household_development where member_id = '${kids.leo}'`)));
await openMeeting(jen);
await step(jen, 1);
check('after pause: no check-in for the paused skill', await jen.locator(`[data-development-check-in="${leoSkill}"]`).count() === 0);
await step(jen, 2);
check('after pause: not suggested again', await jen.locator(`[data-development-suggest="${leoSkill}"]`).count() === 0);

// ------------------------------------------------------------------ 3b. Hand over responsibility (Launch) for Maya
await sql(`update household_development set stage = 'watch', last_check_in_on = current_date - 8 where member_id = '${kids.maya}'`);
await openMeeting(jen);
await step(jen, 2);
const handOver = jen.locator(`[data-development-next="${mayaSkill}"] [data-development-decision="advance"]`);
check('Launch: the button says "Hand over responsibility"', (await handOver.textContent())?.trim() === 'Hand over responsibility');
check('Launch: its accessible name says what is handed to whom', /Hand over responsibility to Maya/.test(await handOver.getAttribute('aria-label') ?? ''));
check('Launch: Watch says doing it alone is progress, handing over is a separate choice', await jen.locator(`[data-development-next="${mayaSkill}"] [data-development-watch-distinction]`).count() === 1);
check('Watch: staying in Watch and stepping back are both offered', await jen.locator(`[data-development-next="${mayaSkill}"] [data-development-decision="stay"]`).count() === 1 && /Step back: We’ll do it together/.test(await jen.locator(`[data-development-next="${mayaSkill}"] [data-development-decision="step-back"]`).textContent()));
await layout(jen, 'phone 393 · Everyone\'s Part (Watch, hand over)');
await shot(jen, '07b-watch-hand-over');
await jenCtx.route(`${API}/rest/v1/rpc/household_development_decide`, (r) => r.abort('internetdisconnected'));
await handOver.click();
await jen.waitForSelector(`[data-development-next="${mayaSkill}"] [data-development-error]`, { timeout: 10000 });
check('Launch failed to save: no confirmation shown', !/Great! This is now their responsibility/.test(await jen.locator(`[data-development-next="${mayaSkill}"]`).textContent()));
check('Launch failed to save: still Watch in the database', (await sql(`select stage from household_development where member_id = '${kids.maya}'`)) === 'watch');
await jenCtx.unroute(`${API}/rest/v1/rpc/household_development_decide`);
await handOver.click();
await jen.waitForSelector(`[data-development-next="${mayaSkill}"] [data-development-saved]`, { timeout: 10000 });
const conf = (await jen.textContent(`[data-development-next="${mayaSkill}"] [data-development-saved]`))?.trim();
check('Launch saved: the approved confirmation', conf === 'Great! This is now their responsibility. You can always step back and practice together again if needed.', conf);
const launched = await sql(`select d.stage || ',' || d.status || ',' || (a.deleted_at is null) from household_development d join club_responsibilities a on a.id = d.agreement_id where d.member_id = '${kids.maya}'`);
check('Launch saved: launched, and the agreement stays on the list', launched === 'launch,launched,true', launched);
await shot(jen, '07c-launch-confirmed', false);
await sql(`update household_development set last_check_in_on = current_date - 30 where member_id = '${kids.maya}'`);
await openMeeting(jen);
await step(jen, 1);
check('after Launch: the check-in asks whether it is still theirs (ownership)', /still Maya’s/.test(await jen.textContent(`[data-development-check-in="${mayaSkill}"]`) ?? ''));
check('after Launch: the stage reads "Ready to take full responsibility"', /Ready to take full responsibility/.test(await jen.textContent(`[data-development-check-in="${mayaSkill}"]`) ?? ''));
await step(jen, 2);
check('after Launch: moving back is still possible', /Step back: They’ll do it, I’ll coach/.test(await jen.locator(`[data-development-next="${mayaSkill}"] [data-development-decision="step-back"]`).textContent() ?? ''));
check('after Launch: no "hand over" offered again', await jen.locator(`[data-development-next="${mayaSkill}"] [data-development-decision="advance"]`).count() === 0);
await shot(jen, '07d-launched-check-in');

// ------------------------------------------------------------------ 4. viewports
for (const vp of ['large', 'desktop']) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], storageState: await jenCtx.storageState() });
  const page = await ctx.newPage();
  await sql(`update household_development set last_check_in_on = current_date - 30 where member_id = '${kids.maya}'`);
  await openMeeting(page);
  await step(page, 1); await layout(page, `${vp} · Let's Talk`); await shot(page, `08-${vp}-lets-talk`);
  await step(page, 2); await layout(page, `${vp} · Everyone's Part`); await axe(page, `${vp} · Everyone's Part`); await shot(page, `09-${vp}-everyones-part`);
  // Four parts in order, Back/Next work.
  await step(page, 0);
  for (const title of ['Let’s Talk', 'Everyone’s Part', 'Let’s Practice']) {
    await page.click('[data-meeting-step-actions] button:has-text("Next")'); await settle(page, 300);
    check(`${vp}: Next goes to ${title}`, await page.locator(`[data-meeting-part="${title}"]`).count() === 1);
  }
  await ctx.close();
}

// ------------------------------------------------------------------ 5. loading failure: the meeting works without the layer
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.phone, storageState: await jenCtx.storageState() });
  await ctx.route(`${API}/rest/v1/rpc/household_development`, (r) => r.abort('internetdisconnected'));
  const page = await ctx.newPage();
  await openMeeting(page);
  check('records fail to load: meeting still opens with its four parts', await page.locator('[data-meeting-step]').count() === 4);
  for (let i = 0; i < 4; i++) { await step(page, i); }
  check('records fail to load: no development guidance (nothing guessed)', await devCount(page) === 0);
  await step(page, 2);
  check('records fail to load: month ideas and "We agreed" still work as before', await page.locator('[data-add-agreement]').count() === 1);
  await shot(page, '10-records-unavailable');
  await ctx.close();
}

// ------------------------------------------------------------------ 6. access lost and account switch while open
await sql(`update household_development set last_check_in_on = current_date - 30 where member_id = '${kids.maya}'`);
await openMeeting(jen);
await step(jen, 1);
check('before: Club guidance is showing', await devCount(jen) > 0);
await sql(`update club_access_grants set revoked_at = now() where user_id = (select id from auth.users where email = 'jen@e2e.test')`);
await jen.evaluate(() => window.dispatchEvent(new Event('omc:app:resume')));
await jen.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await settle(jen, 1500);
check('Club access lost: paid guidance disappears without a reload', await devCount(jen) === 0);
check('Club access lost: the meeting falls back to the free kind', (await jen.getAttribute('[data-weekly-meeting]', 'data-meeting-kind')) === 'free');
await sql(`update club_access_grants set revoked_at = null where user_id = (select id from auth.users where email = 'jen@e2e.test')`);
await jen.evaluate(() => window.dispatchEvent(new Event('omc:app:resume')));
await settle(jen, 1500);
check('Club access back: guidance returns for the same family', await devCount(jen) > 0);
// Another tab in the same browser signs out and in as Rosa (free, another household).
const tab = await jenCtx.newPage();
await tab.goto(`${base}/club/login`, { waitUntil: 'networkidle' });
await tab.evaluate(() => localStorage.removeItem('omc:account:session'));
await settle(jen, 1500);
check('signed out in another tab: this meeting drops the family\'s guidance at once', await devCount(jen) === 0);
await signIn(tab, 'rosa@e2e.test');
await settle(jen, 2000);
check('another account in another tab: no Parks guidance in this tab', await devCount(jen) === 0 && !(await jen.innerText('[data-weekly-meeting]')).includes('Maya ·'));
await tab.close();
check('no page errors during the Club run', consoleErrors.length === 0, consoleErrors.join(' | '));

writeFileSync(join(OUT, 'results.json'), JSON.stringify({ base: ROOT, at: new Date().toISOString(), failures, results }, null, 2));
await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall development QA checks passed');
process.exit(failures ? 1 : 0);
