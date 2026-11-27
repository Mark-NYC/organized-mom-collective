/**
 * V21 on real household data (docs/ios/V21_PREVIEW.md → Production), end to end against the ISOLATED test backend
 * (scripts/e2e/test-backend.mjs on the throwaway database from family-db.sh + seed.sql). Never against production.
 *
 *   PGHOST=localhost PGUSER=postgres bash scripts/e2e/family-db.sh && psql -d omc_family_e2e -f scripts/e2e/seed.sql
 *   node scripts/e2e/test-backend.mjs &
 *   PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 PUBLIC_SUPABASE_ANON_KEY=x PUBLIC_ACCOUNTS_ENABLED=true PUBLIC_CLUB_ENABLED=true npx astro dev --port 4323
 *   node scripts/e2e/v21-live-e2e.mjs [app URL] [screenshot dir]
 *
 * Two real adult sessions (Jen and Sam) in one household, plus a stale second session of Sam's:
 *   Today's plan from real agreements · Ask for a hand (asking moves nothing; the request is shared household state;
 *   Sam's push is queued once) · Sam accepts on Today (a real agreement owned by Sam for that date only; Jen's weekly
 *   agreement unchanged; Jen's "has it" queued) · the stale session accepts again (still one agreement: idempotent) ·
 *   Jen's confirmation, then quiet · completion is separate · a second request declined from a tapped push
 *   notification (applied as Sam; Jen keeps it; "still yours") · black text · docked two-tab bar · no errors.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:4323';
const OUT = process.argv[3] ?? 'docs/ios/screenshots/v21-live';
const API = process.env.E2E_API ?? 'http://127.0.0.1:54321';
mkdirSync(OUT, { recursive: true });
const results = [];
const errors = [];
const check = (name, ok, detail = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`); };
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;
const browser = await chromium.launch();
const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

async function phone(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'astro-dev-toolbar{display:none!important}'; document.head.append(st); }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('response', async (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  return p;
}
async function signIn(p, email) {
  await p.goto(`${base}/club/login`, { waitUntil: 'networkidle' });
  await p.fill('#club-email', email);
  await p.click('button:has-text("Email me a code")');
  await p.fill('#club-code', '123456');
  await p.click('button[type="submit"]:has-text("Sign in")');
  await p.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
}
const open = async (p, path = '/app') => { await p.goto(`${base}${path}`, { waitUntil: 'networkidle' }); await p.waitForSelector('[data-live-v20] [data-v21], [data-signed-out]', { timeout: 20000 }); await p.waitForTimeout(1200); };
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 });
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 500)); } return false; };
const n = async (q) => Number((await sql(q)).trim());
const item = (p, title) => p.locator('[data-plan-item]', { hasText: title });

// ------------------------------------------------------------------ setup: Sam shares the Parks' family; two weekly agreements of Jen's due tonight
await sql(`insert into public.household_adults (household_id, user_id, role, member_id)
  select h.id, '00000000-0000-0000-0000-00000000e2e2', 'partner', (select id from public.club_family_members where first_name = 'Sam')
  from public.club_households h where h.id = (select household_id from public.household_adults where user_id = '00000000-0000-0000-0000-00000000e2e1') on conflict do nothing;`);
const jenId = (await sql(`select id from public.club_family_members where first_name = 'Jen'`)).trim();
const samId = (await sql(`select id from public.club_family_members where first_name = 'Sam'`)).trim();
for (const [id, text, at] of [['dd000000-0000-0000-0000-0000000000e1', 'Take out the trash', '8:00 PM'], ['dd000000-0000-0000-0000-0000000000e2', 'Make dinner', '11:58 PM']]) {
  await sql(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e2e1"}', false);
    select public.household_agreement_save(jsonb_build_object('id', '${id}', 'category', 'other', 'text', '${text}', 'when', 'Every ${dayName} at ${at}', 'owner_ids', jsonb_build_array('${jenId}')), null); reset role;`);
}

// ------------------------------------------------------------------ 1. Jen: Today's plan from real agreements
const jen = await phone();
await signIn(jen, 'jen@e2e.test');
await open(jen);
check('Jen: V21 Today on real data', (await jen.locator('[data-v21]').count()) === 1);
check('Today’s plan shows her real agreements due today, hers', (await item(jen, 'Take out the trash').count()) === 1 && (await item(jen, 'Take out the trash').getAttribute('data-mine')) === '');
const tab = await jen.evaluate(() => { const b = document.querySelector('.v16-tabbar'); const c = getComputedStyle(b); return { radius: c.borderTopLeftRadius, left: Math.round(b.getBoundingClientRect().left), links: b.querySelectorAll('a').length }; });
check('docked two-tab bar', tab.radius === '0px' && tab.left === 0 && tab.links === 2, JSON.stringify(tab));
const grey = await jen.evaluate(() => [...document.querySelectorAll('[data-live-v20] :is(p,span,h1,h2,h3,button,a,label)')].filter((e) => e.textContent.trim() && !e.closest('.of-btn:not(.of-btn--soft),.v21-btn--dark,[data-chip]')).map((e) => getComputedStyle(e).color).filter((c) => c !== 'rgb(0, 0, 0)'));
check('solid black text on Today', grey.length === 0, grey.slice(0, 3).join(' | '));
await shot(jen, '01-jen-today');

// ------------------------------------------------------------------ 2. Ask for a hand: asking moves nothing; shared state; one push to Sam
const sam2 = await phone();
await signIn(sam2, 'sam@e2e.test'); // a second session of Sam's that will be stale when he answers elsewhere
await item(jen, 'Take out the trash').locator('.v21-plan-main').click();
await jen.click('[data-ask-hand]');
await jen.waitForSelector('[data-ask-sheet]');
check('asking for one date by default ("Just today")', (await jen.locator('[data-scope-once]').getAttribute('aria-checked')) === 'true');
await jen.click('[data-send-ask]');
const asked = await waitFor(async () => (await n(`select count(*) from public.household_intelligence, jsonb_each(state->'requests') r where r.value->>'status' = 'asked'`)) === 1);
check('the request is shared household state (database)', asked);
check('asking moved nothing: the agreement is still Jen’s', (await sql(`select owner_ids::text from public.club_responsibilities where id = 'dd000000-0000-0000-0000-0000000000e1'`)).includes(jenId));
check('Jen sees "Waiting for Sam"', await waitFor(async () => (await jen.locator('[data-matter="waiting"]').innerText().catch(() => '')).includes('Waiting for Sam')));
const pushed = await waitFor(async () => (await n(`select count(*) from public.household_notifications where kind = 'help' and to_member = '${samId}' and data->>'requestId' is not null`)) === 1);
check('Sam’s push is queued once, for him only, with the request', pushed && (await n(`select count(*) from public.household_notifications where kind = 'help' and to_member = '${jenId}'`)) === 0);

// ------------------------------------------------------------------ 3. Sam accepts; the stale session accepts again
await open(sam2);
const sam = await phone();
await signIn(sam, 'sam@e2e.test');
await open(sam);
check('Sam: "Jen needs a hand." with her words', (await sam.locator('[data-v21-headline]').innerText()) === 'Jen needs a hand.'
  && (await sam.locator('[data-matter="request-in"]').innerText()).includes('Can you take out the trash?'));
await shot(sam, '02-sam-request');
await sam.click('[data-matter="request-in"] [data-answer="accept"]');
const samOwns = await waitFor(async () => (await n(`select count(*) from public.club_responsibilities where agreed_text = 'Take out the trash' and owner_ids @> array['${samId}']::uuid[]`)) === 1);
check('accepted: a real agreement owned by Sam', samOwns);
check('Jen’s weekly agreement is unchanged (this date only)', (await sql(`select owner_ids::text from public.club_responsibilities where id = 'dd000000-0000-0000-0000-0000000000e1'`)).includes(jenId));
check('Sam sees it as his commitment, not done', await waitFor(async () => (await item(sam, 'Take out the trash').getAttribute('data-mine').catch(() => null)) === '' ));
const stale = sam2.locator('[data-matter="request-in"] [data-answer="accept"]');
if (await stale.count()) { await stale.click(); await sam2.waitForTimeout(2500); }
check('the stale session answering again changes nothing (one agreement)', (await n(`select count(*) from public.club_responsibilities where agreed_text = 'Take out the trash' and owner_ids @> array['${samId}']::uuid[]`)) === 1);
const handled = await waitFor(async () => (await n(`select count(*) from public.household_notifications where kind = 'handled' and to_member = '${jenId}' and data->>'requestId' is not null`)) === 1);
check('Jen’s "Sam has it ✓" is queued for her, once', handled);
check('no "updated a shared plan" duplicate for the accept', (await n(`select count(*) from public.household_notifications where kind = 'agreement'`)) === 0);

// ------------------------------------------------------------------ 4. Jen: confirmation, then quiet; the plan shows Sam covering
await open(jen);
check('Jen: "Sam has it"', (await jen.locator('[data-matter="accepted"]').innerText().catch(() => '')).includes('Sam has it'));
check('the plan shows Sam covering for Jen', (await item(jen, 'Take out the trash').innerText()).includes('Covering for Jen'));
await shot(jen, '03-jen-confirmed');
await jen.click('[data-matter="accepted"] [data-ack]');
await jen.waitForTimeout(1500);
await open(jen);
check('after OK it leaves her priorities, on every load', (await jen.locator('[data-matter="accepted"]').count()) === 0);

// ------------------------------------------------------------------ 5. completion is separate
await open(sam);
await item(sam, 'Take out the trash').locator('[role="checkbox"]').click();
const done = await waitFor(async () => (await sql(`select state->'partMeta'::text from public.household_intelligence`)).includes('doneOn'));
check('Sam marks it done: shared completion', done);

// ------------------------------------------------------------------ 6. a request declined from a tapped push notification
await open(jen);
await item(jen, 'Make dinner').locator('.v21-plan-main').click();
await jen.click('[data-ask-hand]');
await jen.click('[data-send-ask]');
const dinnerPush = await waitFor(async () => (await n(`select count(*) from public.household_notifications where kind = 'help' and to_member = '${samId}' and title like '%dinner%'`)) === 1);
check('dinner request queued for Sam', dinnerPush);
const nid = (await sql(`select id from public.household_notifications where kind = 'help' and to_member = '${samId}' and title like '%dinner%'`)).trim();
await sam.goto(`${base}/app?notification=${nid}&action=not-tonight`, { waitUntil: 'networkidle' });
await sam.waitForTimeout(2500);
const declined = await waitFor(async () => (await n(`select count(*) from public.household_intelligence, jsonb_each(state->'requests') r where r.value->>'status' = 'declined'`)) === 1);
check('"Not this time" from the notification is applied as Sam', declined);
check('declined: dinner stays Jen’s', (await sql(`select owner_ids::text from public.club_responsibilities where id = 'dd000000-0000-0000-0000-0000000000e2'`)).includes(jenId)
  && (await n(`select count(*) from public.club_responsibilities where agreed_text = 'Make dinner' and owner_ids @> array['${samId}']::uuid[]`)) === 0);
await open(jen);
check('Jen: "Sam can’t make dinner." It’s still yours', (await jen.locator('[data-matter="declined"]').innerText().catch(() => '')).includes('It’s still yours'));
await shot(jen, '04-jen-declined');
const jenDeclinedPush = await waitFor(async () => (await n(`select count(*) from public.household_notifications where kind = 'declined' and to_member = '${jenId}'`)) === 1);
check('Jen hears the answer once', jenDeclinedPush);

// ------------------------------------------------------------------ 7. layout
for (const vp of [{ width: 375, height: 667 }, { width: 430, height: 932 }]) {
  const p = await phone(vp);
  await signIn(p, 'jen@e2e.test');
  await open(p);
  const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const a = document.querySelector('.v16-shortcuts')?.getBoundingClientRect(); const b = document.querySelector('.v16-tabbar')?.getBoundingClientRect(); return a && b ? { last: Math.round(a.bottom), bar: Math.round(b.top) } : null; });
  check(`${vp.width}: no horizontal scroll, page end clears the tab bar`, !over && r && r.last <= r.bar - 4, JSON.stringify(r));
  await p.context().close();
}

check('no page errors or server errors', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
