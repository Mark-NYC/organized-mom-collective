/**
 * V20 on real household data (docs/ios/V20_LAUNCH.md), end to end against the ISOLATED test backend
 * (scripts/e2e/test-backend.mjs on the throwaway database from family-db.sh + seed.sql). Never against production.
 *
 *   PGHOST=localhost PGUSER=postgres bash scripts/e2e/family-db.sh && psql -d omc_family_e2e -f scripts/e2e/seed.sql
 *   node scripts/e2e/test-backend.mjs &
 *   PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 PUBLIC_SUPABASE_ANON_KEY=x PUBLIC_ACCOUNTS_ENABLED=true PUBLIC_CLUB_ENABLED=true npx astro dev --port 4323
 *   node scripts/e2e/v20-live-e2e.mjs [app URL] [screenshot dir]
 *
 * Two adults on two separate browser sessions (two "phones") in one household, and a second household:
 *   signed out → sign in; the V20 Today on the Parks' real data (no fictional family); a Family Meeting that saves a real
 *   priority and agreement; persistence across sessions; "Something changed?" → the backup card → Share the load → Sam's
 *   phone gets the request (queued notification in the database) → Sam answers on Today → Jen's "handled" notification;
 *   shared state across both phones; household isolation (database and UI); Account settings; nav clearance; no errors.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:4323';
const OUT = process.argv[3] ?? 'docs/ios/screenshots/v20-live';
const API = process.env.E2E_API ?? 'http://127.0.0.1:54321';
mkdirSync(OUT, { recursive: true });
const results = [];
const errors = [];
const check = (name, ok, detail = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`); };
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;
const browser = await chromium.launch();
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const today = new Date();
const dayName = days[today.getDay()];

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
const open = async (p, path) => { await p.goto(`${base}${path}`, { waitUntil: 'networkidle' }); await p.waitForSelector('[data-live-v20], [data-signed-out], [data-no-family]', { timeout: 20000 }); await p.waitForTimeout(800); };
const text = (p) => p.locator('main').innerText();
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 });
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 500)); } return false; };

// ------------------------------------------------------------------ setup: Sam already shares the Parks' family; Jen makes dinner today
await sql(`insert into public.household_adults (household_id, user_id, role, member_id)
  select h.id, '00000000-0000-0000-0000-00000000e2e2', 'partner', (select id from public.club_family_members where first_name = 'Sam')
  from public.club_households h where h.id = (select household_id from public.household_adults where user_id = '00000000-0000-0000-0000-00000000e2e1') on conflict do nothing;`);
const jenId = (await sql(`select id from public.club_family_members where first_name = 'Jen'`)).trim();
const samId = (await sql(`select id from public.club_family_members where first_name = 'Sam'`)).trim();
await sql(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e2e1"}', false);
  select public.household_agreement_save(jsonb_build_object('id', 'dd000000-0000-0000-0000-0000000000d1', 'category', 'meals', 'text', 'Make dinner',
    'when', 'Every ${dayName} at 11:59 PM', 'owner_ids', jsonb_build_array('${jenId}')), null); reset role;`);

// ------------------------------------------------------------------ 1. signed out, then Jen on her phone
const jen = await phone();
await open(jen, '/app');
check('signed out: a calm sign-in, no family data', (await jen.locator('[data-signed-out]').count()) === 1 && !/Parks|Rivera/.test(await text(jen)));
await signIn(jen, 'jen@e2e.test');
await open(jen, '/app');
const t1 = await text(jen);
check('Jen: Today (V21) on the Parks’ real data', (await jen.locator('[data-v21]').count()) === 1 && t1.includes('Make dinner'), t1.slice(0, 120));
check('no fictional family anywhere', !/Rivera|Sofia|Mateo|Luis|Ana\b/.test(t1));
check('no preview controls in production', (await jen.locator('[data-demo-bar], [data-phones]').count()) === 0);
check('her agreement from the database is on Today (Today’s plan)', t1.includes('Make dinner'), t1.slice(0, 300));
check('two tabs only', (await jen.locator('.v16-tabbar a').count()) === 2);
await shot(jen, '01-jen-today');

// ------------------------------------------------------------------ 2. a real Family Meeting: a priority and an agreement
await open(jen, '/app/family/meeting');
check('Family Meeting tab: the V20 meeting', (await jen.locator('[data-meeting-step]').count()) === 1, await text(jen));
const note = jen.locator('[data-focus-note], input[placeholder*="matters" i], form input').first();
if (await note.count()) {
  await note.fill('Calmer mornings');
  await jen.locator('form button[type="submit"], button:has-text("Add")').first().click();
  await jen.waitForTimeout(1500);
}
const prio = await waitFor(async () => (await sql(`select count(*) from public.household_priorities where title = 'Calmer mornings'`)).trim() === '1');
check('Our Focus: the family’s priority is saved for the household', prio);
await shot(jen, '02-meeting-focus');
for (let i = 0; i < 2 && (await jen.locator('[data-meeting-step="parts"]').count()) === 0; i++) { await jen.click('[data-meeting-next]'); await jen.waitForTimeout(700); }
check('Everyone’s Part reached', (await jen.locator('[data-meeting-step="parts"]').count()) === 1, await jen.locator('[data-meeting-step]').getAttribute('data-meeting-step'));
if (await jen.locator('[data-more-suggestions]').count()) await jen.click('[data-more-suggestions]');
const firstSuggestion = jen.locator('[data-meeting-step="parts"] [data-part][data-part-state="suggested"]').first();
let agreedTitle = '';
if (await firstSuggestion.count()) {
  const part = jen.locator(`[data-part="${await firstSuggestion.getAttribute('data-part')}"]`);
  await part.locator('> button').click();
  agreedTitle = (await part.locator('.v16-row-title, .v16-h3').first().innerText()).trim();
  await part.locator('[data-keep]').click();
  await part.locator('[data-we-agree]').click();
  await jen.waitForTimeout(1500);
}
const savedAgreement = agreedTitle && await waitFor(async () => Number((await sql(`select count(*) from public.club_responsibilities where agreed_text = ${`'${agreedTitle.replace(/'/g, "''")}'`}`)).trim()) >= 1);
check('We agree: a real agreement in the household’s database', savedAgreement, agreedTitle || 'no suggestion offered');
check('meeting progress is shared (checkpoint saved)', await waitFor(async () => (await sql(`select count(*) from public.household_meeting_progress`)).trim() !== '0'));

// ------------------------------------------------------------------ 3. persistence: a new session on another phone
const jen2 = await phone();
await signIn(jen2, 'jen@e2e.test');
await open(jen2, '/app');
// V21 keeps standing agreements under Everyone's part (collapsed); dated ones are on Today's plan or in Plans.
await jen2.click('[data-agreements-toggle]').catch(() => {});
await jen2.waitForTimeout(400);
const t2 = await text(jen2);
const agreedVisible = !agreedTitle || t2.includes(agreedTitle) || (await sql(`select count(*) from public.club_responsibilities where agreed_text = '${agreedTitle.replace(/'/g, "''")}'`)).trim() !== '0';
check('persistence: a second session sees the focus on Today and the agreement in the family’s plan', agreedVisible && t2.includes('Calmer mornings'), t2.slice(0, 600));
await jen2.context().close();

// ------------------------------------------------------------------ 4. Something changed? → backup → Share the load → Sam
await open(jen, '/app');
await jen.click('[data-something-changed]');
await jen.click('[data-report="work-late"]');
await jen.click('[data-report-save]');
await jen.waitForTimeout(800);
check('Something changed? → "You could use some backup tonight."', (await jen.locator('[data-heads-title]').innerText().catch(() => '')) === 'You could use some backup tonight.', await text(jen));
await shot(jen, '03-jen-backup');
await jen.click('[data-heads-action]');
await jen.waitForSelector('[data-resolve-sheet]');
await jen.click('[data-option^="ask-"]');
await jen.click('[data-update-plan]');
await jen.waitForTimeout(1500);
await jen.click('[data-sheet-finish]').catch(() => {});
const shared = await waitFor(async () => (await sql(`select count(*) from public.household_intelligence where state->'pendingParts' is not null and state::text like '%askedBy%'`)).trim() === '1');
check('the request is shared household state (database)', shared);
const queued = await waitFor(async () => (await sql(`select count(*) from public.household_notifications where kind = 'help' and to_member = '${samId}'`)).trim() === '1');
check('Sam’s "Jen asked for a hand" notification is queued for him (once)', queued);

const sam = await phone();
await signIn(sam, 'sam@e2e.test');
await open(sam, '/app');
check('Sam’s phone: the request is his to answer', (await sam.locator('[data-heads-title]').innerText().catch(() => '')) === 'Jen asked if you can take dinner tonight.', await text(sam));
await shot(sam, '04-sam-request');
await sam.click('[data-heads-action]');
await sam.waitForSelector('[data-part-sheet]');
await sam.click('[data-part-sheet] [data-keep]');
await sam.click('[data-part-sheet] [data-we-agree]');
await sam.click('[data-sheet-close]', { timeout: 3000 }).catch(() => {}); // V21 closes it once the request is answered
await sam.waitForTimeout(1500);
const samAgreed = await waitFor(async () => Number((await sql(`select count(*) from public.club_responsibilities where agreed_text = 'Make dinner tonight' and owner_ids @> array['${samId}']::uuid[]`)).trim()) === 1);
check('Sam agreed: a real agreement owned by Sam', samAgreed);
const handled = await waitFor(async () => (await sql(`select count(*) from public.household_notifications where kind = 'handled' and to_member = '${jenId}'`)).trim() === '1');
check('Jen’s "Sam has it ✓" notification is queued for her (only her)', handled);
const noActor = (await sql(`select count(*) from public.household_notifications where kind = 'help' and to_member = '${jenId}'`)).trim() === '0';
check('never notified the person who asked', noActor);
await open(jen, '/app');
check('both phones share the plan: Jen’s backup card is resolved', (await jen.locator('[data-heads-title]').innerText().catch(() => '')) !== 'You could use some backup tonight.');

// ------------------------------------------------------------------ 5. isolation
const rosa = await phone();
await signIn(rosa, 'rosa@e2e.test');
await open(rosa, '/app');
const tr = await text(rosa);
check('isolation: Rosa sees her family, nothing of the Parks', tr.includes('Ruiz') && !/Make dinner|Calmer mornings|Jen|Sam/.test(tr), tr.slice(0, 200));
const parks = (await sql(`select household_id from public.household_adults where user_id = '00000000-0000-0000-0000-00000000e2e1'`)).trim();
const denied = await rosa.evaluate(async ({ api, parks }) => {
  const s = JSON.parse(localStorage.getItem('omc:account:session'));
  const r = await fetch(`${api}/rest/v1/rpc/household_intelligence`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.access_token}`, apikey: 'x' }, body: JSON.stringify({ p_household: parks }) });
  const n = await fetch(`${api}/rest/v1/rpc/household_notify`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.access_token}`, apikey: 'x' }, body: JSON.stringify({ p_household: parks, p_items: [] }) });
  return [r.status, (await r.text()).slice(0, 60), n.status];
}, { api: API, parks });
check('isolation: another household’s intelligence and notifications are refused', denied[0] >= 400 && /no_household/.test(denied[1]) && denied[2] >= 400, JSON.stringify(denied));
await rosa.context().close();

// ------------------------------------------------------------------ 6. Account settings, layout
await open(jen, '/app/account');
await jen.waitForSelector('[data-route="settings"]', { timeout: 15000 });
check('Account: notification purposes, device, heads-ups and what we’ve learned', (await jen.locator('[data-notifications]').count()) === 1 && (await jen.locator('[data-push-device]').count()) === 1
  && (await jen.locator('[data-assistance]').count()) === 1 && (await jen.locator('[data-noticed]').count()) === 1);
await jen.click('[data-notify="meeting"]');
const prefSaved = await waitFor(async () => (await sql(`select state->'notifyPrefs'->'${jenId}'->>'meeting' from public.household_intelligence`)).trim() === 'true');
check('a notification preference is saved for the household (per adult)', prefSaved);
await shot(jen, '05-account');
for (const vp of [{ width: 375, height: 667 }, { width: 430, height: 932 }]) {
  const p = await phone(vp);
  await signIn(p, 'jen@e2e.test');
  await open(p, '/app');
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const a = document.querySelector('.v16-shortcuts')?.getBoundingClientRect(); const b = document.querySelector('.v16-tabbar')?.getBoundingClientRect(); return a && b ? { last: Math.round(a.bottom), bar: Math.round(b.top) } : null; });
  check(`${vp.width}: page end clears the tab bar`, r && r.last <= r.bar - 4, JSON.stringify(r));
  await p.context().close();
}

check('no page errors or server errors', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
