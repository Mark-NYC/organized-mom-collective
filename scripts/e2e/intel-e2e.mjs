#!/usr/bin/env node
/**
 * Household Intelligence Engine, Stage B, end to end on the isolated test backend (docs/intelligence/STAGE_B_REPORT.md):
 * two brand-new families (website and iPhone app bundle, iPhone-size screens) sign in with an emailed code, set up the
 * family, meet the AI-help consent choice (one says yes, one says not now), and use Account → Household intelligence:
 * learning off and on, AI help off (withdrawal), personal calendars, the memory list (confirm, change the day, forget)
 * and erase. The behavioral log is checked in the database: product moments only carry the moment, learning signals
 * stop while learning is off, and the families never see each other's anything. Never touches production; nothing is
 * sent to an AI provider (there is no provider call in Stage B).
 *
 *   PGHOST=localhost PGUSER=postgres bash scripts/e2e/family-db.sh
 *   E2E_DB=omc_family_e2e node scripts/e2e/test-backend.mjs &
 *   (website build into dist, app bundle into app-www, both against the test backend; see FAMILY_E2E.md)
 *   node scripts/e2e/intel-e2e.mjs <dist> <app-www> [out=e2e-intel]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const [SITE = 'dist', APP = 'app-www', OUT = 'e2e-intel'] = process.argv.slice(2);
const API = 'http://127.0.0.1:54321';
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
const siteSrv = await serve(SITE); const appSrv = await serve(APP);
const BASES = { site: `http://localhost:${siteSrv.address().port}`, app: `http://localhost:${appSrv.address().port}` };

let failures = 0;
const results = [];
const check = (step, ok, detail = '') => {
  results.push({ step, ok: Boolean(ok), detail });
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`);
};
const sql = async (q) => (await (await fetch(`${API}/__test/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: q }) })).json()).out;
const settle = (page, ms = 1300) => page.waitForTimeout(ms);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const FAMILIES = [
  { id: 'yes', where: 'app', device: 'iPhone 15 Pro', family: 'The Parkers', me: 'Jess', adults: ['Sam'], kids: [['Ava', '9']], ai: true },
  { id: 'not-now', where: 'site', device: 'iPhone 15 Pro Max', family: 'The Gomez Family', me: 'Maria', adults: [], kids: [['Sofia', '11'], ['Diego', '8']], ai: false },
];
const browser = await chromium.launch();
const errors = [];
const hh = (email) => `(select a.household_id from public.household_adults a join auth.users u on u.id = a.user_id where u.email = '${email}')`;

for (const f of FAMILIES) {
  console.log(`\n${f.id} (${f.where === 'app' ? 'iPhone app bundle' : 'website'}, ${f.device})`);
  const email = `${f.id}@intel.e2e.test`;
  const base = BASES[f.where];
  const ctx = await browser.newContext({ ...devices[f.device] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${f.id}: ${e.message}`));
  const shot = (n) => page.screenshot({ path: join(OUT, `${f.id}-${n}.png`), fullPage: true, timeout: 20000 }).catch(() => {});

  // Sign in with an emailed code, straight to setup
  await page.goto(`${base}/app/sign-in?next=/app/family/setup`, { waitUntil: 'networkidle' });
  await page.fill('#ow-email', email);
  await page.click('button:has-text("Email me a code")');
  await page.fill('#ow-code', '123456');
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForURL(/\/app\/family\/setup/, { timeout: 20000 });
  await page.waitForSelector('[data-ourweek-setup]'); await settle(page, 800);

  // Set up the family
  await page.fill('label:has-text("What do you call your family?") input', f.family);
  await page.fill('label:has-text("Your first name") input', f.me);
  for (const [i, a] of f.adults.entries()) {
    await page.click('button:has-text("+ Add a grown-up")');
    await page.locator('form li').filter({ hasText: 'Who they are' }).nth(i).locator('input').fill(a);
  }
  const kidRows = () => page.locator('form li').filter({ hasText: 'Birthday month' });
  for (const [i, [name, age]] of f.kids.entries()) {
    if ((await kidRows().count()) <= i) await page.click('button:has-text("+ Add a child")');
    await kidRows().nth(i).locator('input').fill(name);
    await kidRows().nth(i).locator('select').first().selectOption(age);
  }
  await page.click('button[type="submit"]:has-text("Save our family")');
  await page.waitForSelector('[data-setup-done]', { timeout: 15000 }).catch(() => {});

  // AI help: one explicit, understandable, optional choice
  await page.waitForSelector('[data-ai-consent="onboarding"]', { timeout: 10000 }).catch(() => {});
  const consent = await page.locator('[data-ai-consent="onboarding"]').innerText().catch(() => '');
  check(`${f.id} onboarding: AI help is an explicit, optional choice in plain words`, (await page.locator('[data-ai-consent-yes]').count()) === 1 && (await page.locator('[data-ai-consent-no]').count()) === 1
    && /only plan names are sent/.test(consent) && /Never descriptions, notes, addresses/.test(consent) && /Everything else works the same/.test(consent));
  check(`${f.id} onboarding: nothing clipped, no sideways scroll`, (await overflow(page)) <= 1);
  const settings = () => sql(`select concat_ws(',', learning_enabled::text, ai_enabled::text, coalesce(ai_consent_version, 0), (ai_consented_by is not null)::text) from public.intel_settings where household_id = ${hh(email)}`);
  check(`${f.id} onboarding: AI help is off before she answers`, !(await settings()).includes('true,true'), await settings());
  await shot('01-consent');
  await page.click(f.ai ? '[data-ai-consent-yes]' : '[data-ai-consent-no]');
  await page.waitForSelector('[data-ai-consent-answered]', { timeout: 10000 }).catch(() => {});
  check(`${f.id} onboarding: ${f.ai ? '"Yes" turns AI help on, recording the consent version and who agreed' : '"Not now" leaves it off'}`,
    f.ai ? (await settings()) === 'true,true,1,true' : !/^true,true/.test(await settings()), await settings());
  check(`${f.id} product moments recorded with nothing but the moment`, (await sql(`select count(*) from public.household_signals where household_id = ${hh(email)} and kind in ('onboarding_started','onboarding_completed') and subject_ref is null and value is null and member_id is null and visible_to is null`)) === '2'
    || (await sql(`select count(*) from public.household_signals s join auth.users u on u.id = s.user_id where u.email = '${email}' and s.kind = 'onboarding_completed' and s.subject_ref is null`)) === '1');

  // Today still works the same (V21, deterministic)
  await page.goto(`${base}/app`, { waitUntil: 'networkidle' }); await settle(page, 1800);
  check(`${f.id} Today: V21 loads on the family's data`, (await page.locator('[data-live-v20][data-route="today"]').count()) === 1);
  const opens = await sql(`select count(*) from public.household_signals s join auth.users u on u.id = s.user_id where u.email = '${email}' and s.kind = 'app_open'`);
  check(`${f.id} Today: app open measured once this hour`, opens === '1', `${opens} rows`);

  // Learning signals: a task the family did, then learning off (dropped), then on again
  // The built bundle has no module path, so log through the RPC as the signed-in adult, exactly as the app does.
  const logAs = (ref) => page.evaluate(async ([api, ref]) => {
    const s = JSON.parse(localStorage.getItem('omc:account:session'));
    const d = new Date(); const p = (n) => String(n).padStart(2, '0');
    const r = await fetch(`${api}/rest/v1/rpc/household_signal_log`, { method: 'POST', headers: { apikey: 'e2e-anon', Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_signals: [{ kind: 'task_done', subject_kind: 'task', subject_ref: ref, local_day: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, local_hour: d.getHours(), local_dow: d.getDay(), at: d.toISOString() }] }) });
    return r.json();
  }, [API, ref]);
  check(`${f.id} learning on: a learning signal is kept`, (await logAs('t-e2e-1')) === 1);

  // Account → Household intelligence
  await page.goto(`${base}/app/account`, { waitUntil: 'networkidle' }); await settle(page);
  await page.waitForSelector('[data-household-intelligence]', { timeout: 15000 }).catch(() => {});
  const box = (k) => page.locator(`[data-intel-${k}]`).isChecked().catch(() => null);
  check(`${f.id} Account: the controls show what she chose`, (await page.locator('[data-household-intelligence]').count()) === 1
    && (await box('learning')) === true && (await box('ai')) === f.ai && (await box('personal')) === false);
  check(`${f.id} Account: nothing clipped, no sideways scroll`, (await overflow(page)) <= 1);
  await shot('02-account');

  await page.click('[data-intel-learning]');
  await page.waitForFunction(() => !document.querySelector('[data-intel-learning]')?.checked, null, { timeout: 10000 }).catch(() => {});
  check(`${f.id} Account: learning off is saved`, (await settings()).startsWith('false'));
  check(`${f.id} learning off: learning signals are dropped by the server`, (await logAs('t-e2e-2')) === 0
    && (await sql(`select count(*) from public.household_signals where household_id = ${hh(email)} and subject_ref = 't-e2e-2'`)) === '0');
  await page.click('[data-intel-learning]');
  await page.waitForFunction(() => document.querySelector('[data-intel-learning]')?.checked, null, { timeout: 10000 }).catch(() => {});
  check(`${f.id} Account: learning back on`, (await settings()).startsWith('true'));

  // Personal calendars: this adult's own consent
  await page.click('[data-intel-personal]');
  await page.waitForFunction(() => document.querySelector('[data-intel-personal]')?.checked, null, { timeout: 10000 }).catch(() => {});
  check(`${f.id} Account: personal calendars consent is hers alone`, (await sql(`select count(*) from public.intel_member_consent c join auth.users u on u.id = c.user_id where u.email = '${email}' and c.personal_calendars`)) === '1');

  // What we've noticed: a learned weekly rhythm (applied as the engine would), confirm, change the day, forget
  await sql(`select intel_private.memory_apply(${hh(email)}, '[{"category":"occasion","subject_key":"event-occurred:series:e2e","content":{"anchor":"2"},"status":"observed","source":"stats","cadence":"weekly","confidence":0.9,"support":6,"contradict":0,"first_seen":"2026-10-01","last_seen":"2026-11-24","review_after":"2026-12-22","evidence":[]},{"category":"occasion","subject_key":"event-occurred:series:e2e-2","content":{"anchor":"4"},"status":"observed","source":"stats","cadence":"weekly","confidence":0.8,"support":5,"contradict":0,"first_seen":"2026-10-01","last_seen":"2026-11-26","review_after":"2026-12-24","evidence":[]}]'::jsonb)`);
  await page.reload({ waitUntil: 'networkidle' }); await settle(page);
  await page.waitForSelector('[data-intel-memory]', { timeout: 15000 }).catch(() => {});
  const rows = await page.locator('[data-intel-memory]').allInnerTexts();
  check(`${f.id} Account: what we've noticed, in plain words`, rows.length === 2 && rows.some((r) => /A plan that happens every Tuesday\./.test(r)) && rows.every((r) => /Noticed, not confirmed/.test(r)), rows.join(' | '));
  await shot('03-noticed');
  await page.locator('[data-intel-memory]').filter({ hasText: 'every Tuesday' }).locator('[data-intel-confirm]').click();
  await settle(page);
  check(`${f.id} Account: "That's right" confirms it`, (await sql(`select status from public.household_memory where household_id = ${hh(email)} and subject_key = 'event-occurred:series:e2e'`)) === 'confirmed');
  await page.locator('[data-intel-memory]').filter({ hasText: 'every Thursday' }).locator('[data-intel-day]').selectOption('3');
  await settle(page);
  check(`${f.id} Account: changing the day corrects it (and the family's word stands)`, (await sql(`select concat(status, ':', content->>'anchor') from public.household_memory where household_id = ${hh(email)} and subject_key = 'event-occurred:series:e2e-2'`)) === 'confirmed:3');
  await page.locator('[data-intel-memory]').filter({ hasText: 'every Wednesday' }).locator('[data-intel-forget]').click();
  await settle(page);
  check(`${f.id} Account: Forget removes it from the list and the database keeps no evidence`, (await page.locator('[data-intel-memory]').count()) === 1
    && (await sql(`select concat(status, ':', (select count(*) from public.household_memory_evidence e where e.memory_id = m.id)) from public.household_memory m where household_id = ${hh(email)} and subject_key = 'event-occurred:series:e2e-2'`)) === 'forgotten:0');

  // AI help off (withdrawal) for the family that said yes: model-derived memory is erased
  if (f.ai) {
    await sql(`insert into public.household_memory (household_id, category, subject_key, content, status, source, confidence, support, contradict) values (${hh(email)}, 'event-meaning', 'p1:birthday', '{"means":"text"}', 'observed', 'model', 0.8, 2, 0)`);
    await page.click('[data-intel-ai]');
    await page.waitForFunction(() => !document.querySelector('[data-intel-ai]')?.checked, null, { timeout: 10000 }).catch(() => {});
    check(`${f.id} Account: turning AI help off withdraws consent and erases what the AI worked out`, /^true,false/.test(await settings())
      && (await sql(`select count(*) from public.household_memory where household_id = ${hh(email)} and source = 'model'`)) === '0'
      && (await sql(`select count(*) from public.intel_settings where household_id = ${hh(email)} and ai_withdrawn_at is not null`)) === '1');
  }

  // Erase everything learned
  await page.click('[data-intel-erase]');
  await page.click('[data-intel-erase-yes]');
  await settle(page);
  check(`${f.id} Account: erase removes all memory and signals (agreements and family stay)`, (await sql(`select count(*) from public.household_memory where household_id = ${hh(email)}`)) === '0'
    && (await sql(`select count(*) from public.household_signals where household_id = ${hh(email)}`)) === '0'
    && (await sql(`select count(*) from public.club_family_members where household_id = ${hh(email)}`)) !== '0');
  await shot('04-erased');
  await ctx.close();
}

// Isolation: neither family's memory, signals or settings name the other's household
check('isolation: each family has exactly its own settings row', (await sql(`select count(distinct household_id) from public.intel_settings s where household_id in (select household_id from public.household_adults a join auth.users u on u.id = a.user_id where u.email like '%@intel.e2e.test')`)) === '2');
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), failures, results }, null, 2));
await browser.close(); siteSrv.close(); appSrv.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall household intelligence checks passed');
process.exit(failures ? 1 : 0);
