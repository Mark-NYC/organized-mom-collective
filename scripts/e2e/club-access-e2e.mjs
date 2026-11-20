#!/usr/bin/env node
/**
 * Free accounts and complimentary Family Meeting Club, end to end (docs/ios/APP_STORE_LAUNCH.md), in Chromium at iPhone
 * size against the isolated test backend (scripts/e2e/test-backend.mjs on a throwaway database from family-db.sh +
 * seed.sql), with every migration including 20261207 and 20261208. The owner uses the real admin dashboard; families use
 * the real app pages. Never touches production.
 *
 *   PGHOST=localhost PGUSER=postgres bash scripts/e2e/family-db.sh && psql -d omc_family_e2e -f scripts/e2e/seed.sql
 *   E2E_DB=omc_family_e2e node scripts/e2e/test-backend.mjs &
 *   PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 PUBLIC_SUPABASE_ANON_KEY=e2e-anon PUBLIC_ACCOUNTS_ENABLED=true \
 *     PUBLIC_CLUB_ENABLED=true npx astro build --outDir dist-qa
 *   node scripts/e2e/club-access-e2e.mjs dist-qa [out=e2e-club-access] [app-www]   (CI: family-e2e job, on dist)
 *
 * Scenarios: a new free account; free features; no Club for a free family (pages and server); the owner grants
 * complimentary access in the dashboard; both adults get the Club, including the MAWL layer; access survives sign-out;
 * expiry; revoke keeps the family; paid stays paid; paid + complimentary; nobody grants themself; the App Review
 * password sign-in.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = process.argv[2] ?? 'dist-qa';
const OUT = process.argv[3] ?? 'e2e-club-access';
const API = 'http://127.0.0.1:54321';
const PASSWORD = 'e2e-test-password'; // the test backend's only password (never a real one)
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const serve = async (root) => {
  const srv = createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = [join(root, p), join(root, p, 'index.html'), join(root, `${p}.html`)].find((f) => existsSync(f) && statSync(f).isFile());
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return srv;
};
const server = await serve(ROOT);
const base = `http://localhost:${server.address().port}`;
// Optional: the iPhone app bundle (npm run build:app → app-www), where the Club opens only for an explicit grant.
const APP_ROOT = process.argv[4];
const appServer = APP_ROOT ? await serve(APP_ROOT) : null;
const appBase = appServer ? `http://localhost:${appServer.address().port}` : null;

let failures = 0;
const results = [];
const check = (step, ok, detail = '') => {
  results.push({ step, ok: Boolean(ok), detail });
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`);
};
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;
const settle = (page, ms = 1200) => page.waitForTimeout(ms);
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true, timeout: 15000 }).catch((e) => console.log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
const rpc = async (token, fn, body = {}) => {
  const res = await fetch(`${API}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: 'e2e-anon', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const browser = await chromium.launch();
const phone = { ...devices['iPhone 15 Pro'] };
const newPhone = () => browser.newContext(phone);
async function signInCode(page, email, at = base) {
  await page.goto(`${at}/app/sign-in`, { waitUntil: 'networkidle' });
  await page.fill('#ow-email', email);
  await page.click('button:has-text("Email me a code")');
  await page.fill('#ow-code', '123456');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
  await settle(page, 1500);
  return page.evaluate(() => JSON.parse(localStorage.getItem('omc:account:session')).access_token);
}
const meetingKind = async (page, at = base) => {
  await page.goto(`${at}/app/family/meeting`, { waitUntil: 'networkidle' }); await settle(page, 2000);
  return page.getAttribute('[data-weekly-meeting]', 'data-meeting-kind');
};
const clubHome = async (page, at = base) => {
  await page.goto(`${at}/app/club`, { waitUntil: 'networkidle' }); await settle(page, 2000);
  return page.evaluate(() => (document.getElementById('club-preview-intro')?.hidden ? 'member' : 'preview'));
};

console.log(`club access e2e: site ${base}, isolated backend ${API}`);

// ------------------------------------------------------------------ setup (test database only)
await sql(`insert into auth.users (id, email, email_confirmed_at) values
  (gen_random_uuid(), 'owner-admin@e2e.test', now()), (gen_random_uuid(), 'review-free@e2e.test', now())
  on conflict do nothing;
insert into public.admin_users (user_id, role) select id, 'owner' from auth.users where email = 'owner-admin@e2e.test' on conflict do nothing;`);
const verify = async (email) => (await (await fetch(`${API}/auth/v1/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'email', email, token: '123456' }) })).json()).access_token;
// The Riveras (free): Ana holds the account, Tom joins as the second adult, Lily (11) is the child the development
// engine has a next step for. Pat's family pays.
const anaTok = await verify('ana@e2e.test');
const fam = await rpc(anaTok, 'household_save', { p_expected_version: null, p_display_name: 'The Riveras', p_preferences: {}, p_members: [
  { first_name: 'Ana', kind: 'adult', role: 'parent', is_account_holder: true }, { first_name: 'Tom', kind: 'adult', role: 'partner' },
  { first_name: 'Lily', kind: 'child', role: 'child', birth_year: 2015, birth_month: 3 }] });
const members = fam.body?.members ?? [];
const lily = members.find((m) => m.first_name === 'Lily')?.id;
await rpc(anaTok, 'club_responsibilities_save', { p_status: 'desired', p_items: [{ category: 'laundry', item: 'put-away-laundry', owner_ids: [lily], helper_ids: [] }] });
const code = (await rpc(anaTok, 'household_invite_create', { p_member_id: members.find((m) => m.first_name === 'Tom')?.id, p_email: 'tom@e2e.test' })).body?.code;
check('setup: invitation for the second adult', Boolean(code), String(code));
const accepted = await rpc(await verify('tom@e2e.test'), 'household_invite_accept', { p_code: code });
check('setup: Tom joins the household', accepted.status === 200, JSON.stringify(accepted.body).slice(0, 100));
const payTok = await verify('payer@e2e.test');
await rpc(payTok, 'household_save', { p_expected_version: null, p_display_name: 'The Payers', p_preferences: {}, p_members: [
  { first_name: 'Pia', kind: 'adult', role: 'parent', is_account_holder: true }, { first_name: 'Ola', kind: 'child', role: 'child', birth_year: 2017, birth_month: 5 }] });
await sql(`insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, current_period_start, current_period_end, started_at, livemode)
  select 'sub_E2EPay', 'cus_E2EPay', id, 'active', 'price_1', now() - interval '2 days', now() + interval '28 days', now(), false from auth.users where email = 'payer@e2e.test'`);
const family = async () => JSON.parse(await sql(`select json_build_object('members', (select count(*) from public.club_family_members m join public.household_adults a on a.household_id = m.household_id join auth.users u on u.id = a.user_id where u.email = 'ana@e2e.test'),
  'adults', (select count(*) from public.household_adults a2 where a2.household_id = (select household_id from public.household_adults a join auth.users u on u.id = a.user_id where u.email = 'ana@e2e.test')))`));
const familyBefore = await family();
check('setup: Ana\'s family has two adults', familyBefore.adults === 2, JSON.stringify(familyBefore));

// ------------------------------------------------------------------ 1–3. a brand-new free account
{
  const ctx = await newPhone(); const page = await ctx.newPage();
  const token = await signInCode(page, 'brand-new@e2e.test');
  check('1. a brand-new person creates a free account with an emailed code', (await sql(`select count(*) from auth.users where email = 'brand-new@e2e.test'`)) === '1');
  check('1. and is taken to set up their family', /\/app\/family\/setup/.test(page.url()), page.url());
  await rpc(token, 'household_save', { p_expected_version: null, p_display_name: 'The Newmans', p_preferences: {}, p_members: [
    { first_name: 'Nia', kind: 'adult', role: 'parent', is_account_holder: true }, { first_name: 'Kai', kind: 'child', role: 'child', birth_year: 2018, birth_month: 1 }] });
  for (const [path, sel] of [['/app', '[data-today], main'], ['/app/family-calendar', 'main'], ['/app/cleaning', 'main'], ['/app/family', 'main']]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }); await settle(page, 800);
    check(`2. free feature opens: ${path}`, (await page.locator(sel).count()) > 0 && !/sign in to/i.test((await page.title()) ?? ''));
  }
  check('2. the weekly Family Meeting is the free kind', (await meetingKind(page)) === 'free');
  await page.click('[data-meeting-step="2"]');
  await page.fill('[data-agreement-new]', 'Feed the cat');
  await page.click('[data-owner-chip="Kai"]'); await page.click('[data-save-new-agreement]'); await settle(page, 2500);
  check('2. a free family writes down an agreement', (await sql(`select count(*) from public.club_responsibilities where agreed_text = 'Feed the cat'`)) === '1');
  check('3. Club Home is the preview library, no member Club', (await clubHome(page)) === 'preview');
  await page.goto(`${base}/app/club/january`, { waitUntil: 'networkidle' }); await settle(page, 2500);
  const gate = await page.locator('main').innerText();
  check('3. a Club month is closed, and doesn\'t say a membership ended', /part of Family Meeting Club|isn’t open/.test(gate) && !/membership has ended/i.test(gate), gate.replace(/\s+/g, ' ').slice(0, 140));
  const r = await rpc(token, 'club_resource_get', { p_kit: '2026-11-family-ownership' });
  check('3. the server refuses this month\'s released Club kit to a free account', r.status >= 400 && !/Could not find/.test(JSON.stringify(r.body)), `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
  const self = await rpc(token, 'club_admin_access_grant', { p_user: await sql(`select id from auth.users where email = 'brand-new@e2e.test'`) });
  check('14. a family cannot grant itself the Club', self.status >= 400 && (await sql(`select count(*) from public.club_access_grants g join auth.users u on u.id = g.user_id where u.email = 'brand-new@e2e.test'`)) === '0', `${self.status}`);
  await shot(page, '01-free-club-gate');
  await ctx.close();
}

// ------------------------------------------------------------------ 4. the owner grants complimentary access in the dashboard
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
await admin.goto(`${base}/admin/club?tab=access`, { waitUntil: 'networkidle' });
await admin.fill('input[type="email"]', 'owner-admin@e2e.test');
await admin.fill('input[type="password"]', PASSWORD);
await admin.click('button[type="submit"]');
await admin.waitForSelector('[data-club-access]', { timeout: 20000 });
const search = async (q) => { await admin.fill('[data-access-search]', q); await admin.click('[data-club-access] button[type="submit"]'); await admin.waitForSelector('[data-access-results]', { timeout: 10000 }); };
const openRow = async (email) => { await admin.click(`[data-access-open="${email}"]`); await admin.waitForSelector(`[data-access-detail="${email}"]`, { timeout: 10000 }); await settle(admin, 1200); };
const statusOf = async () => admin.getAttribute('[data-access-detail] [data-access-status]', 'data-access-status');
await search('tom@');
await openRow('tom@e2e.test');
check('4. the owner finds the second adult by email and sees the household', /The Riveras/.test(await admin.locator('[data-access-detail]').innerText()) && /ana@e2e\.test/.test(await admin.locator('[data-access-detail]').innerText()));
check('4. status: Free', (await statusOf()) === 'free');
await admin.fill('[data-access-note]', 'Beta family');
admin.once('dialog', (d) => d.accept());
await admin.click('[data-access-grant]');
await admin.waitForSelector('[data-access-msg]');
check('4. granted in the dashboard: Complimentary Club', (await statusOf()) === 'complimentary');
check('4. who granted it and when, and the history', /owner-admin@e2e\.test/.test(await admin.locator('[data-access-detail]').innerText()) && (await admin.locator('[data-access-history] li').count()) === 1);
check('4. the grant is on the household owner\'s account, with no subscription created', (await sql(`select u.email from public.club_access_grants g join auth.users u on u.id = g.user_id where g.reason = 'complimentary' and g.revoked_at is null`)) === 'ana@e2e.test' && (await sql(`select count(*) from public.club_subscriptions`)) === '1');
await shot(admin, '02-admin-granted');

// ------------------------------------------------------------------ 5–8. both adults use the Club, MAWL included, across sign-out
const anaCtx = await newPhone(); const ana = await anaCtx.newPage();
await signInCode(ana, 'ana@e2e.test');
check('5. the household has the Club right away: the meeting is the Club kind', (await meetingKind(ana)) === 'club');
await ana.click('[data-meeting-step="2"]'); await settle(ana, 600);
check('7. Club personalization and MAWL: one next step for her child', (await ana.locator('[data-development-next-steps] [data-development-person]').count()) >= 1);
check('5. Club Home shows her membership, not the preview', (await clubHome(ana)) === 'member');
const tomCtx = await newPhone(); const tom = await tomCtx.newPage();
await signInCode(tom, 'tom@e2e.test');
check('6. the second adult: Club meeting too', (await meetingKind(tom)) === 'club');
check('6. the second adult: member Club Home (not the preview)', (await clubHome(tom)) === 'member');
await tom.goto(`${base}/app/family/meeting`, { waitUntil: 'networkidle' }); await settle(tom, 1500); await tom.click('[data-meeting-step="2"]'); await settle(tom, 600);
const add = tom.locator('[data-development-agree]').first();
if (await add.count()) { await add.click(); await tom.waitForSelector('[data-development-saved], [data-development-error]', { timeout: 10000 }); }
check('7. the second adult adds a skill to the plan (record + agreement)', (await sql(`select count(*) from public.household_development d join public.household_adults a on a.household_id = d.household_id join auth.users u on u.id = a.user_id where u.email = 'tom@e2e.test' and d.status = 'active' and d.agreement_id is not null`)) === '1');
await shot(tom, '03-second-adult-club');
await ana.goto(`${base}/app/account`, { waitUntil: 'networkidle' }); await settle(ana, 1200);
await ana.click('[data-sign-out]'); await settle(ana, 1500);
await signInCode(ana, 'ana@e2e.test');
check('8. after signing out and back in, the Club is still there', (await meetingKind(ana)) === 'club');

// ------------------------------------------------------------------ 11. expiry
await admin.fill('[data-access-expiry]', new Date(Date.now() + 2 * 86400e3).toLocaleDateString('en-CA'));
await admin.click('[data-access-save-expiry]'); await settle(admin, 1200);
check('11. the owner sets an expiry', /Expires at the end of/.test(await admin.locator('[data-access-msg]').innerText()) && (await sql(`select count(*) from public.club_access_grants where expires_at is not null and revoked_at is null`)) === '1');
await sql(`update public.club_access_grants set expires_at = now() - interval '1 second' where reason = 'complimentary' and revoked_at is null`); // time passes (test only)
check('11. once expired, the Club closes for the family', (await meetingKind(ana)) === 'free' && (await clubHome(tom)) === 'preview');
await openRow('tom@e2e.test');
check('11. the dashboard shows Expired, status Free', (await statusOf()) === 'free' && /Expired/.test(await admin.locator('[data-access-detail]').innerText()));
admin.once('dialog', (d) => d.accept());
await admin.click('[data-access-grant]'); await settle(admin, 1500);
check('11. granting again reopens it', (await statusOf()) === 'complimentary' && (await meetingKind(ana)) === 'club');

// ------------------------------------------------------------------ 9–10. revoke: the Club closes, the family stays
admin.once('dialog', (d) => d.accept());
await admin.click('[data-access-revoke]'); await settle(admin, 1500);
check('9. revoked in the dashboard: Free, with who revoked it', (await statusOf()) === 'free' && /Revoked/.test(await admin.locator('[data-access-detail]').innerText()));
check('10. Club features are closed again for both adults', (await meetingKind(ana)) === 'free' && (await clubHome(tom)) === 'preview');
const after = await family();
check('10. no family data lost (people, adults)', after.members === familyBefore.members && after.adults === familyBefore.adults, JSON.stringify(after));
check('10. the MAWL record and its agreement are kept', (await sql(`select count(*) from public.household_development d join public.club_responsibilities r on r.id = d.agreement_id and r.deleted_at is null join public.household_adults a on a.household_id = d.household_id join auth.users u on u.id = a.user_id where u.email = 'tom@e2e.test'`)) === '1');
await shot(admin, '04-admin-revoked');

// ------------------------------------------------------------------ 12–13. paid stays paid; paid + complimentary
await search('payer@');
await openRow('payer@e2e.test');
check('12. a paying household shows Paid Club', (await statusOf()) === 'paid');
check('12. and there is nothing complimentary to revoke', (await admin.locator('[data-access-revoke]').count()) === 0);
admin.once('dialog', (d) => d.accept());
await admin.click('[data-access-grant]'); await settle(admin, 1500);
check('13. paid + complimentary', (await statusOf()) === 'paid_and_complimentary');
admin.once('dialog', (d) => d.accept());
await admin.click('[data-access-revoke]'); await settle(admin, 1500);
check('13. revoking the complimentary part leaves Paid Club', (await statusOf()) === 'paid' && /still have Paid Club/.test(await admin.locator('[data-access-msg]').innerText()));
const payerCtx = await newPhone(); const payer = await payerCtx.newPage();
await signInCode(payer, 'payer@e2e.test');
check('12. the paying family keeps the Club', (await meetingKind(payer)) === 'club');
check('12. the subscription row is untouched', (await sql(`select status || ',' || cancel_at_period_end || ',' || (access_revoked_at is null) from public.club_subscriptions where stripe_subscription_id = 'sub_E2EPay'`)) === 'active,false,true');
let payerApp = null;
if (appBase) {
  // The iPhone app (owner decision on PR 516): a paid website subscription alone doesn't open the Club in the app.
  const ctx = await newPhone(); payerApp = await ctx.newPage();
  await signInCode(payerApp, 'payer@e2e.test', appBase);
  check('app: a paying website member with no grant gets the free meeting in the app', (await meetingKind(payerApp, appBase)) === 'free');
  check('app: and Club Home is the preview, with the invitation line', (await clubHome(payerApp, appBase)) === 'preview'
    && /available by invitation/.test(await payerApp.locator('[data-club-invitation]').innerText()));
  const text = await payerApp.locator('main').innerText();
  check('app: no price, checkout or subscription wording on Club Home', !/\$\d|checkout|subscribe|upgrade|join the club/i.test(text));
  await shot(payerApp, '06-app-paid-only-free');
}
admin.once('dialog', (d) => d.accept());
await admin.click('[data-access-grant]'); await settle(admin, 1500);
if (payerApp) {
  check('app: once the owner grants complimentary access, the Club meeting opens in the app', (await meetingKind(payerApp, appBase)) === 'club');
  check('app: and Club Home shows the membership', (await clubHome(payerApp, appBase)) === 'member');
}
await sql(`update public.club_subscriptions set status = 'canceled', ended_at = now() where stripe_subscription_id = 'sub_E2EPay'`); // the subscription ends (test only)
check('13. the subscription ends while complimentary is live: access stays', (await meetingKind(payer)) === 'club');

// ------------------------------------------------------------------ App Review: password sign-in for the demo accounts
{
  const ctx = await newPhone(); const page = await ctx.newPage();
  await page.goto(`${base}/app/sign-in`, { waitUntil: 'networkidle' });
  await page.click('[data-use-password]');
  await page.fill('#ow-pw-email', 'review-free@e2e.test');
  await page.fill('#ow-password', 'wrong-password');
  await page.click('[data-password-signin] button[type="submit"]'); await settle(page, 1000);
  check('review: a wrong password says so, and signs nobody in', /didn’t match/.test(await page.locator('[role="alert"]').innerText()) && !(await page.evaluate(() => localStorage.getItem('omc:account:session'))));
  await page.fill('#ow-password', PASSWORD);
  await page.click('[data-password-signin] button[type="submit"]');
  await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
  check('review: the demo account signs in with its password', true);
  await shot(page, '05-review-signed-in');
  await ctx.close();
}

writeFileSync(join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), failures, results }, null, 2));
await browser.close();
server.close();
appServer?.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall club access checks passed');
process.exit(failures ? 1 : 0);
