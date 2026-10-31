/**
 * The Club's onboarding in a real browser: /club/welcome → /club/family-vision → the first monthly resource, the
 * dashboard and the admin print view, against a fake Supabase (Auth, the Club's database functions, club-billing)
 * held in memory by this script. Nothing reaches the real project. The database functions themselves are tested in
 * supabase/tests/club-membership.sql and tests/club-billing-e2e.test.ts; this checks the pages.
 *
 * Needs Playwright with Chromium (`require('playwright')`) and a built site served with member pages and accounts on:
 *
 *   PUBLIC_CLUB_ENABLED=true PUBLIC_ACCOUNTS_ENABLED=true npx astro build && npx astro preview --port 4329
 *   node scripts/club-onboarding-e2e.mjs [http://localhost:4329] [--shots=dir]
 *
 * --only=months opens every monthly tool at /app/club/<month> as her (edit, saved to her account, a new browser, sign
 * out and in, meeting, phone, print); not part of the default run.
 *
 * Exits 1 when any check fails.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:4329';
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8) ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SUPABASE = 'https://uvqhmlqwmgnohhduttip.supabase.co';
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const VALUES = ['Love', 'Faith', 'Joy', 'Peace', 'Adventure', 'Kindness', 'Courage', 'Gratitude', 'Togetherness', 'Hospitality',
  'Growth', 'Creativity', 'Generosity', 'Wonder', 'Perseverance', 'Rest', 'Hope', 'Home', 'Service', 'Playfulness'];
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` · ${detail}` : ''}`);
};

// ------------------------------------------------------------------ the backend: a local Postgres with every migration

// scripts/club-dev-db.sh builds club_dev_template (every migration + supabase/tests/club-dev-seed.sql); each scenario
// gets a fresh copy. Pages' database calls run there as the signed-in member (or the owner), like PostgREST would.
const PG = { PGHOST: process.env.PGHOST ?? 'localhost', PGUSER: process.env.PGUSER ?? 'postgres', PGPASSWORD: process.env.PGPASSWORD ?? 'postgres' };
const DB = 'club_dev';
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com' };
const OWNER = '22222222-2222-4222-8222-222222222222';
const JAN = '2027-01-fresh-start-together';

const psql = (db, input) => execFileSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', db], { input, env: { ...process.env, ...PG }, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
/** SQL as the database owner (setup, time travel, checks). */
export const sql = (q) => psql(DB, q);
function freshDb() {
  psql('postgres', `drop database if exists ${DB} with (force);\ncreate database ${DB} template club_dev_template;`);
}

class RpcError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const sigs = new Map();
function signature(name) {
  if (!sigs.has(name)) {
    const row = sql(`select coalesce(array_to_json(proargnames)::text, '[]') || '|' || array_to_json(proargtypes::regtype[]::text[])::text || '|' || prorettype::regtype::text
                      from pg_proc where proname = ${lit(name)} and pronamespace = 'public'::regnamespace limit 1`);
    if (!row) throw new RpcError(`unknown_function_${name}`, 404);
    const [names, types, ret] = row.split('|');
    sigs.set(name, { names: JSON.parse(names), types: JSON.parse(types), ret });
  }
  return sigs.get(name);
}
/** Runs SQL as a signed-in user (RLS and grants apply, auth.uid() is theirs). Database errors become RpcError. */
function asUser(uid, q) {
  const claims = JSON.stringify({ sub: uid, role: 'authenticated' });
  try {
    return psql(DB, `begin;\nset local role authenticated;\nselect set_config('request.jwt.claims', ${lit(claims)}, true) \\g /dev/null\n${q};\ncommit;\n`);
  } catch (e) {
    const msg = /ERROR:\s+(.*)/.exec(String(e.stderr ?? ''))?.[1] ?? 'failed';
    throw new RpcError(/permission denied/.test(msg) ? 'permission denied' : msg, /permission denied/.test(msg) ? 403 : 400);
  }
}
function rpc(uid, name, body) {
  const { names, types, ret } = signature(name);
  const args = names.map((n, i) => (n in body ? `${n} => ${body[n] === null ? `null::${types[i]}`
    : types[i] === 'jsonb' || types[i] === 'json' ? `${lit(JSON.stringify(body[n]))}::${types[i]}`
    : types[i].endsWith('[]') ? `(select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(${lit(JSON.stringify(body[n]))}::jsonb) x)::${types[i]}`
    : `${lit(body[n])}::${types[i]}`}` : null)).filter(Boolean);
  const call = `public.${name}(${args.join(', ')})`;
  const out = asUser(uid, ret === 'void' ? `select ${call}` : `select coalesce(to_jsonb(${call})::text, 'null')`);
  return ret === 'void' || !out ? null : JSON.parse(out);
}

const TOKENS = { 'member-token': USER.id, 'admin-token': OWNER };

/** Routes every Supabase request of a page to the local database. `fail[name] = n` drops the next n calls of that function. */
async function backend(page, { fail = {}, calls = [] } = {}) {
  page.calls = calls;
  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    const reply = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    const p = url.pathname;
    const uid = TOKENS[(req.headers().authorization ?? '').replace(/^Bearer\s+/, '')] ?? null;
    if (p === '/auth/v1/otp') return reply(200, {});
    if (p === '/auth/v1/verify') {
      if (body.token !== '123456') return reply(400, { msg: 'Token has expired or is invalid' });
      return reply(200, { access_token: 'member-token', refresh_token: 'member-refresh', expires_in: 3600, user: USER });
    }
    if (p === '/auth/v1/token') return reply(200, { access_token: 'member-token', refresh_token: 'member-refresh', expires_in: 3600, user: USER });
    if (p === '/auth/v1/logout') return reply(204, {});
    if (p === '/functions/v1/club-billing') {
      calls.push(`billing:${body.action}`);
      if (body.action === 'checkout_status') return reply(200, { paid: true, open: false, email: USER.email });
      if (body.action === 'sync_email') return reply(200, { updated: false });
      return reply(200, { url: `${BASE}/club/dashboard` });
    }
    if (!uid) return reply(401, { message: 'JWT expired' });
    if (p === '/rest/v1/club_mailing_addresses') {
      return reply(200, JSON.parse(asUser(uid, `select coalesce(json_agg(json_build_object('name', name, 'line1', line1, 'line2', line2, 'city', city,
        'state', state, 'postal_code', postal_code, 'paused', paused)), '[]')::text from public.club_mailing_addresses`)));
    }
    if (p === '/rest/v1/account_saves') return reply(200, []); // her saved site tools (account sync): none here
    if (p === '/rest/v1/club_kits') {
      return reply(200, JSON.parse(asUser(uid, `select coalesce(json_agg(json_build_object('slug', slug, 'month', month, 'title', title, 'status', status, 'mailer_cutoff_at', mailer_cutoff_at) order by month), '[]')::text from public.club_kits`)));
    }
    const m = p.match(/^\/rest\/v1\/rpc\/(\w+)$/);
    if (m) {
      calls.push(m[1]);
      if (fail[m[1]] > 0) {
        fail[m[1]]--;
        return route.abort('failed');
      }
      try {
        return reply(200, rpc(uid, m[1], body));
      } catch (e) {
        if (!(e instanceof RpcError)) throw e;
        return reply(e.status, { message: e.message });
      }
    }
    console.log(`       (unhandled request: ${req.method()} ${p}${url.search})`);
    return reply(404, {});
  });
}

/** Her account as the webhook and her own clicks would leave it (SQL as her, through the same functions). */
const as = {
  family: (display = 'The Rivera Family') => asUser(USER.id, `select public.club_household_save(${lit(display)}, '{}',
    '[{"first_name":"Ana","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Sofia","kind":"child","role":"child","birth_year":2018,"birth_month":4},{"first_name":"Mateo","kind":"child","role":"child","birth_year":2020,"birth_month":9}]') \\g /dev/null`),
  vision: (name, value) => asUser(USER.id, `select public.club_welcome_save(${lit(JSON.stringify({ family_name: name, value }))}::jsonb) \\g /dev/null`),
  approvePrint: () => asUser(USER.id, `select public.club_welcome_approve() \\g /dev/null`),
  /** Family profile steps 2–6 answered (or skipped) to the end. */
  profileDone: () => sql(`update public.club_households set setup_done = array['week','responsibilities','growth','challenges','priority'], setup_completed_at = now() where owner_user_id = '${USER.id}'`),
};
/**
 * Her free month refused (one per household: an earlier claim had the same mailing address), like the production test
 * account on Oct 31 2026: the webhook moved her trial to January 1, so no entitlement, no Welcome Kit orders yet.
 */
function refusedFreeMonth() {
  sql(`delete from public.club_fulfillment_orders where user_id = '${USER.id}'; delete from public.club_entitlements where user_id = '${USER.id}';
    delete from public.club_intro_claims; update public.club_subscriptions set current_period_end = '2027-01-01 05:00:00+00' where user_id = '${USER.id}'`);
}
/** The Club nav's links on the page, in order (ClubNav). */
const clubNavLinks = (page) => page.evaluate(() => [...document.querySelectorAll('[data-club-nav] nav[aria-label="Club"] a')]
  .filter((a) => a.getBoundingClientRect().width > 0).map((a) => `${a.getAttribute('aria-label')}=${a.getAttribute('href')}`));
const CLUB_NAV = ['Club Home=/app/club', 'My Family=/club/family', 'Monthly Resources=/app/club#months', 'Account & Billing=/club/dashboard'];
/** One order's status:readiness, for checks. */
const order = (type) => sql(`select status || ':' || readiness from public.club_fulfillment_queue where user_id = '${USER.id}' and fulfillment_type = '${type}'`);
const orderId = (type) => sql(`select id from public.club_fulfillment_orders where user_id = '${USER.id}' and fulfillment_type = '${type}'`);

const signedIn = (page) => page.addInitScript(([s]) => {
  if (!localStorage.getItem('omc:account:session')) localStorage.setItem('omc:account:session', JSON.stringify(s));
}, [{ access_token: 'member-token', refresh_token: 'member-refresh', expires_at: Date.now() + 3600_000, email: USER.email, user_id: USER.id }]);

async function newPage(browser, viewport, { auth = true, db = true, fail } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Test note' : undefined));
  if (db) await backend(page, { fail });
  if (auth) await signedIn(page);
  return page;
}
const asAdmin = (page) => page.addInitScript(() => {
  sessionStorage.setItem('omc:v1:admin', JSON.stringify({ access_token: 'admin-token', refresh_token: 'admin-refresh', expires_at: Date.now() + 3600_000, email: 'owner@example.com' }));
  sessionStorage.setItem('omc:v1:admin:active', String(Date.now()));
});

const shot = (page, name, fullPage = false) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage }) : null);

/** The print's watercolor, value word and family name as rendered. */
const art = (page) => page.evaluate(() => ({
  img: document.querySelector('#fvp-symbol img')?.getAttribute('src')?.split('/').pop()?.split('?')[0] ?? null,
  imgLoaded: Boolean(document.querySelector('#fvp-symbol img')?.complete && document.querySelector('#fvp-symbol img')?.naturalWidth),
  word: document.getElementById('fvp-art-word')?.textContent,
  name: document.getElementById('fvp-art-name')?.textContent,
  selected: document.querySelector('.fvp-value.selected')?.getAttribute('data-value'),
}));

/** Prints the page to a Letter PDF; returns the page count and a PNG of page 1 (pdftoppm). */
async function printPdf(page, name) {
  await page.emulateMedia({ media: 'print' });
  const dir = SHOTS ?? '/tmp';
  await page.pdf({ path: `${dir}/${name}.pdf`, format: 'Letter', printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  const info = execFileSync('pdfinfo', [`${dir}/${name}.pdf`]).toString();
  execFileSync('pdftoppm', ['-r', '50', '-png', '-singlefile', `${dir}/${name}.pdf`, `${dir}/${name}`]);
  return Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
}

// ------------------------------------------------------------------ scenarios

const scenarios = {};

scenarios.artwork = async (browser) => {
  console.log('\nArtwork renders and follows her choices');
  for (const [label, vp] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
    const page = await newPage(browser, vp, { auth: false, db: false });
    await page.goto(`${BASE}/club/family-vision-preview`, { waitUntil: 'networkidle' });
    let a = await art(page);
    check(`preview ${label}: watercolor on load`, a.img === 'love-vision.jpeg' || a.img?.startsWith('love'), a.img ?? 'no image');
    check(`preview ${label}: image loaded`, a.imgLoaded);
    await page.evaluate(() => document.getElementById('fvp-open-editor')?.click());
    for (const v of ['Joy', 'Courage', 'Togetherness']) {
      await page.click(`[data-value="${v}"]`);
      a = await art(page);
      check(`preview ${label}: choosing ${v} updates art, word and selection`, a.word === v && a.selected === v && a.img && a.img.toLowerCase().includes(v.toLowerCase()), JSON.stringify(a));
    }
    check(`preview ${label}: no script errors`, page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();
  }
  // Every value has a watercolor.
  const page = await newPage(browser, DESKTOP, { auth: false, db: false });
  await page.goto(`${BASE}/club/family-vision-preview`, { waitUntil: 'networkidle' });
  const missing = [];
  for (const v of VALUES) {
    await page.evaluate((x) => document.querySelector(`[data-value="${x}"]`).click(), v);
    const a = await art(page);
    if (a.word !== v || !a.img) missing.push(v);
  }
  check('all 20 values render their watercolor', missing.length === 0, missing.join(', '));
  const pages = await printPdf(page, 'preview-print');
  const a = await art(page);
  check('preview print: one Letter page', pages === 1, `${pages} pages`);
  check('preview print: watercolor present', Boolean(a.img));
  await page.context().close();
};

scenarios.admin = async (browser) => {
  console.log('\nAdmin: Welcome Kits queue, both print views, one package (real database)');
  freshDb();
  as.family();
  as.vision('The Rivera Family', 'Courage');
  as.approvePrint();
  check('kit waits for her first-resource confirmation after the print approval', order('welcome_vision') === 'pending:needs_confirmation' && order('monthly_resource') === 'pending:needs_confirmation', order('welcome_vision'));

  const page = await newPage(browser, DESKTOP, { auth: false });
  await asAdmin(page);
  await page.goto(`${BASE}/admin/club`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("Fulfillment")');
  await page.waitForSelector('text=Welcome Kits (1)');
  const row = page.locator('tr', { hasText: 'ana@example.com' });
  check('one row for her package', (await row.count()) === 1);
  const rowText = (await row.innerText()).replace(/\s+/g, ' ');
  check('the row shows both items', /Family Vision print · The Rivera Family · Courage/.test(rowText) && /January 2027 · Our Family Habit Cards/.test(rowText), rowText.slice(0, 200));
  check('and why it waits (nothing confirmed for her)', rowText.includes('Waiting for her to confirm her first resource') && rowText.includes('not confirmed yet') && !/counts as confirmed/.test(rowText), rowText.slice(0, 260));
  check('the package lists the Family Meeting guide insert', /Family Meeting guide · standard insert/.test(rowText), rowText.slice(0, 300));
  await page.fill('input[type=month]', '2027-01');
  await page.waitForTimeout(800);
  const monthText = await page.locator('body').innerText();
  check('January’s monthly list leaves her kit order out, and says so', monthText.includes('Plus 1 January 2027 resource ships in Welcome Kits') && monthText.includes('No mailings for this month.'));
  await shot(page, 'admin-kits-waiting', true);

  // Days pass: nothing is confirmed for her. Then she confirms January herself; the kit is submitted.
  sql(`update public.club_fulfillment_orders set member_approved_at = now() - interval '3 days 1 hour' where user_id = '${USER.id}' and fulfillment_type = 'welcome_vision'`);
  check('three days later: still waiting for her (no automatic confirmation)', order('welcome_vision') === 'pending:needs_confirmation', order('welcome_vision'));
  asUser(USER.id, `select public.club_fulfillment_approve('${JAN}') \\g /dev/null`);
  check('she confirms January: the kit only needs its PDFs', order('welcome_vision') === 'pending:needs_pdf', order('welcome_vision'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('button:has-text("Fulfillment")');
  await page.waitForSelector('[data-kit-ship-by]');
  check('submitted: the row shows when, and the two-business-day mail-by date', /Submitted .* · mail by /.test(await page.locator('[data-kit-ship-by]').innerText()));

  // The welcome print's print view: her approved choices, the approved print, one page, Mark PDF ready.
  const w = orderId('welcome_vision');
  const pv = await newPage(browser, DESKTOP, { auth: false });
  await asAdmin(pv);
  await pv.goto(`${BASE}/club/family-vision?fulfillment=${w}`, { waitUntil: 'networkidle' });
  await pv.waitForSelector('text=Print / Save PDF');
  const a = await art(pv);
  check('print view: her approved value and name', a.word === 'Courage' && a.name === 'The Rivera Family', JSON.stringify(a));
  check('print view: the Courage watercolor', Boolean(a.img?.startsWith('courage')), a.img ?? 'none');
  check('print view: editing is locked', await pv.evaluate(() => document.getElementById('fvp-open-editor')?.hidden === true));
  const pages = await printPdf(pv, 'admin-print');
  check('welcome print PDF: exactly one Letter page', pages === 1, `${pages} pages`);
  const text = execFileSync('pdftotext', [`${SHOTS ?? '/tmp'}/admin-print.pdf`, '-']).toString();
  check('welcome print PDF: nothing but the artwork on paper', !/Print \/ Save PDF|Welcome print ·|Organized Family Club\n/i.test(text) && /Courage/.test(text), JSON.stringify(text.trim().slice(0, 120)));
  // The approved print, page 1 at 50 dpi (captured from the version before PRs #257/#258): pixel-identical or it fails.
  const diff = execFileSync('python3', ['-c', `from PIL import Image, ImageChops
a = Image.open('tests/fixtures/family-vision-print-golden.png').convert('RGB'); b = Image.open('${SHOTS ?? '/tmp'}/admin-print.png').convert('RGB')
print('size' if a.size != b.size else ImageChops.difference(a, b).getbbox())`]).toString().trim();
  check('welcome print PDF: identical to the approved print (tests/fixtures/family-vision-print-golden.png)', diff === 'None', diff);
  const imgs = execFileSync('pdfimages', ['-list', `${SHOTS ?? '/tmp'}/admin-print.pdf`]).toString().trim().split('\n').length - 2;
  check('welcome print PDF: the watercolor is embedded', imgs >= 1, `${imgs} image(s)`);
  await pv.click('text=Mark PDF ready');
  await pv.waitForSelector('text=PDF marked ready');
  check('print view: no script errors', pv.errors.length === 0, pv.errors.join(' | '));
  await pv.context().close();
  check('one PDF isn’t enough for the kit', order('welcome_vision') === 'pending:needs_pdf');

  // January's print view: her family's cards.
  const m = orderId('monthly_resource');
  const mv = await newPage(browser, DESKTOP, { auth: false });
  await asAdmin(mv);
  check('the admin opens January’s print view on its real tool', (await page.locator('tr', { hasText: 'ana@example.com' }).locator('a:has-text("Print view")').last().getAttribute('href')) === `/app/club/january?fulfillment=${m}`);
  await mv.goto(`${BASE}/app/club/january?fulfillment=${m}`, { waitUntil: 'networkidle' });
  await mv.waitForSelector('text=Mark PDF ready');
  await mv.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready');
  const cards = await mv.locator('.club-plan').innerText();
  check('January print view: the real tool, prepared with her children’s names', /Weekly Meeting/i.test(cards) && /Sofia/.test(cards) && /Mateo/.test(cards), cards.slice(0, 160).replace(/\s+/g, ' '));
  check('January print view: no member chrome (Club nav, Welcome Kit panel)', !(await mv.isVisible('[data-club-nav]')) && !(await mv.isVisible('[data-welcome-kit-confirm]')));
  const janPages = await printPdf(mv, 'admin-january-tool');
  const janText = execFileSync('pdftotext', [`${SHOTS ?? '/tmp'}/admin-january-tool.pdf`, '-']).toString();
  check('January PDF: her Weekly Meeting sheets only (2 Letter pages, no admin bar, no site chrome)', janPages === 2 && /Weekly Meeting/i.test(janText) && /Sofia/.test(janText) && !/Fulfillment ·|Mark PDF ready|Club Home|MONTHLY TOOL/i.test(janText), `${janPages} pages · ${janText.replace(/\s+/g, ' ').slice(0, 160)}`);
  await shot(mv, 'admin-january-print-view');
  await mv.click('text=Mark PDF ready');
  await mv.waitForSelector('text=PDF marked ready');
  await mv.context().close();
  check('both PDFs: the kit is ready', order('welcome_vision') === 'pending:ready' && order('monthly_resource') === 'pending:ready', `${order('welcome_vision')} / ${order('monthly_resource')}`);

  // Approve, print, mail: one set of buttons moves both.
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('button:has-text("Fulfillment")');
  await page.waitForSelector('text=Ready to approve');
  await page.locator('tr', { hasText: 'ana@example.com' }).locator('button:has-text("approve kit")').click();
  await page.waitForFunction(() => document.body.innerText.includes('approved'));
  await page.waitForTimeout(500);
  check('approve kit: both orders approved', order('welcome_vision').startsWith('approved') && order('monthly_resource').startsWith('approved'), `${order('welcome_vision')} / ${order('monthly_resource')}`);
  check('her January is recorded as confirmed by her, never automatically', !sql(`select coalesce(note, '') from public.club_fulfillment_orders where id = '${m}'`).includes('automatically'));
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Download approved kits')]);
  const csv = execFileSync('cat', [await download.path()]).toString().trim().split('\n');
  check('CSV: one row for the package', csv.length === 2, `${csv.length - 1} row(s)`);
  check('CSV: names both items and her address', /Family Vision print \(Courage\) \+ Family Meeting guide \+ 2027-01 Our Family Habit Cards/.test(csv[1]) && /14 Oak St/.test(csv[1]), csv[1]);
  for (const st of ['printed', 'mailed']) {
    await page.locator('tr', { hasText: 'ana@example.com' }).locator(`button:has-text("${st}")`).first().click();
    await page.waitForTimeout(700);
  }
  check('printed, then mailed: one package', order('welcome_vision') === 'mailed:mailed' && order('monthly_resource') === 'mailed:mailed', `${order('welcome_vision')} / ${order('monthly_resource')}`);
  check('one mailed time for both', sql(`select count(distinct mailed_at) from public.club_fulfillment_orders where user_id = '${USER.id}'`) === '1');
  check('off the Welcome Kits list once mailed', await page.isVisible('text=Welcome Kits (0)'));
  check('admin: no script errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
};

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const kitOrders = () => `${order('welcome_vision')} / ${order('monthly_resource')}`;
const firstConfirmed = () => sql(`select member_approved_at is not null from public.club_fulfillment_orders where user_id = '${USER.id}' and fulfillment_type = 'monthly_resource'`) === 't';

/** A new member from Stripe's return URL to her confirmed Welcome Kit, refreshing at every step. */
async function journey(browser, label, vp) {
  console.log(`\nNew member, ${label}: checkout → sign in → family → print → first resource → one confirmation`);
  freshDb();
  const page = await newPage(browser, vp, { auth: false });
  await page.goto(`${BASE}/club/welcome?session_id=cs_test_a1b2c3d4e5f6g7h8`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=You’re in.');
  check('“You’re in.” after checkout, email filled in from the checkout', (await page.inputValue('#club-email')) === USER.email);
  await shot(page, `${label}-1-youre-in`, true);
  await page.click('text=Email me a code');
  await page.fill('#club-code', '123456');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('text=Tell us about your family');
  check('step 1 of the kit shows', await page.isVisible('[aria-label="Your Welcome Kit"] [aria-current="step"]:has-text("Your family")'));
  check('family name prefilled from the checkout name (“Ana Rivera”)', (await page.inputValue('input[autocomplete="family-name"]')) === 'The Rivera Family');
  check('optional details are tucked away', !(await page.isVisible('text=We have a pet')));
  check('a blank first child is ready to fill in', (await page.locator('li', { has: page.locator('select') }).count()) === 1);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Tell us about your family');
  check('refresh before saving: still her family step, still signed in', true);
  await page.fill('input[autocomplete="given-name"]', 'Ana');
  const kidRow = page.locator('li', { has: page.locator('select') });
  await kidRow.nth(0).locator('input').fill('Sofia');
  await kidRow.nth(0).locator('select').first().selectOption('8');
  await page.click('text=+ Add a child');
  await kidRow.nth(1).locator('input').fill('Mateo');
  await kidRow.nth(1).locator('select').first().selectOption('6');
  check('no sideways scrolling (family)', await noSideScroll(page));
  await shot(page, `${label}-2-family`, true);
  check('progress: step 1 of 6', await page.isVisible('text=Step 1 of 6'));
  await page.click('button:has-text("Next")');
  // The rest of her family profile: steps 2–6, each saved as she leaves it.
  await page.waitForSelector('text=What does a typical week look like?');
  check('profile: step 2 of 6 with a progress bar', await page.isVisible('text=Step 2 of 6') && await page.isVisible('[role="progressbar"]'));
  check('profile: activity icons load', await page.evaluate(() => [...document.querySelectorAll('button[aria-pressed] img')].every((i) => i.complete && i.naturalWidth > 0)));
  await page.click('button[aria-pressed]:has-text("School or homeschool")');
  await page.click('button[aria-pressed]:has-text("Sports and practices")');
  await page.click('text=Add details (optional) >> nth=1');
  await page.fill('input[placeholder="Soccer practice"]', 'Soccer');
  await page.click('button[aria-label="Tuesday"]');
  await page.click('button[aria-label="Thursday"]');
  check('no sideways scrolling (week)', await noSideScroll(page));
  await shot(page, `${label}-2b-week`, true);
  await page.click('button:has-text("Next")');
  await page.waitForSelector('text=What does everyone already take care of?');
  await page.click('button[aria-expanded]:has-text("Meals and kitchen")');
  await page.click('button[aria-label="Ana owns it: Meals and kitchen"]');
  await page.click('button[aria-expanded]:has-text("Laundry")');
  await page.click('button[aria-label="Sofia owns it: Laundry"]');
  await page.click('button[aria-label="Sofia helps with it: Laundry"]');
  check('who does what: “Owns it” and “Helps with it”, one or the other per person',
    await page.getAttribute('button[aria-label="Sofia helps with it: Laundry"]', 'aria-pressed') === 'true'
    && await page.getAttribute('button[aria-label="Sofia owns it: Laundry"]', 'aria-pressed') === 'false');
  check('who does what: the card says who', await page.isVisible('text=Owns it: Ana') && await page.isVisible('text=Helps: Sofia'));
  check('no sideways scrolling (who does what)', await noSideScroll(page));
  await shot(page, `${label}-2b2-ownership`, true);
  await page.click('button:has-text("Next")');
  await page.waitForSelector('text=What would you like your kids to take on?');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=What would you like your kids to take on?');
  check('interrupted setup resumes at the first open step', await page.isVisible('text=Step 4 of 6'));
  const saved = JSON.parse(asUser(USER.id, `select public.club_family_profile()::text`));
  check('week and who-does-what saved before the interruption', saved.activities.length === 2 && saved.activities.some((x) => x.name === 'Soccer' && x.days.join() === '2,4')
    && saved.responsibilities.some((r) => r.category === 'laundry' && r.helper_ids.length === 1 && r.owner_ids.length === 0), JSON.stringify(saved));
  await page.click('button:has-text("Skip for now")');
  await page.waitForSelector('text=Where is it hard to stay on the same page?');
  await page.click('button:has-text("Morning and evening routines")');
  await page.click('button:has-text("Next")');
  await page.waitForSelector('text=What’s one thing you’d love to stop managing alone?');
  await page.click('button:has-text("The morning rush")');
  await page.fill('input[maxlength="120"]', 'Shoes, bags, out the door');
  await shot(page, `${label}-2c-priority`, true);
  await page.click('button:has-text("Finish")');
  await page.waitForURL(/\/club\/family-vision/);
  const done = JSON.parse(asUser(USER.id, `select public.club_family_profile()::text`));
  check('profile complete: priority and challenges saved', done.setup_completed && done.priority === 'mornings' && done.challenges.join() === 'routines', JSON.stringify(done));
  await page.waitForSelector('.fvp-approve-cta');
  let a = await art(page);
  check('the gift: her family name, a watercolor, a value', a.name === 'The Rivera Family' && Boolean(a.img) && a.imgLoaded && a.word === 'Love', JSON.stringify(a));
  check('the gift: progress shows family done, print current', await page.isVisible('#fvp-progress-slot [data-state="done"]:has-text("Your family")') && await page.isVisible('#fvp-progress-slot [aria-current="step"]:has-text("Your print")'));
  check('the gift: her mailing city is shown', await page.isVisible('text=Mailing to Austin, TX.'));
  check('the gift: Club header visible (account, sign out)', await page.isVisible('header[data-club-chrome] >> text=Sign out'));
  check('the gift: no next-step panel or links before she approves', (await page.locator('a[href="/club/"], a[href="/app/club/"], .fvp-next-panel').count()) === 0);
  const pos = await page.evaluate(() => ({ h1: document.querySelector('.fvp-intro h1').getBoundingClientRect().top, art: document.querySelector('#fvp-room').getBoundingClientRect().top,
    cta: document.querySelector('.fvp-approve-cta').getBoundingClientRect().top, band: document.querySelector('.fvp').getBoundingClientRect().top, ctaBg: getComputedStyle(document.querySelector('.fvp-approve-cta')).backgroundColor }));
  check('the gift: charcoal #545454 primary button', pos.ctaBg === 'rgb(84, 84, 84)', pos.ctaBg);
  check('the gift: no empty band above the page', pos.band < 120, `page starts at ${Math.round(pos.band)}px`);
  if (vp.width < 850) check('mobile: headline, then artwork, then the button', pos.h1 < pos.art && pos.art < pos.cta, JSON.stringify(pos));
  else check('desktop: headline and button beside the artwork, above the fold', pos.cta < vp.height, JSON.stringify(pos));
  check('no sideways scrolling (gift)', await noSideScroll(page));
  await shot(page, `${label}-3-gift`, vp.width < 850);
  // Customize: Joy, saved; refresh keeps it.
  await page.click('.fvp-edit-after-cta');
  await page.click('[data-value="Joy"]');
  await page.click('text=Done · See my print');
  await page.waitForSelector('text=Saved to your account');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.fvp-approve-cta');
  a = await art(page);
  check('refresh after customizing: Joy kept, Joy watercolor shown', a.word === 'Joy' && a.selected === 'Joy' && Boolean(a.img?.startsWith('joy')), JSON.stringify(a));
  // A dropped approve: honest message, nothing approved, then it works.
  await page.unroute(`${SUPABASE}/**`);
  await backend(page, { fail: { club_welcome_approve: 1 } });
  await page.click('.fvp-approve-cta');
  await page.waitForSelector('text=Couldn’t approve it');
  check('a failed approve says so and approves nothing', order('welcome_vision').endsWith('needs_vision'));
  await page.click('.fvp-approve-cta');
  await page.waitForSelector('text=It’s yours!');
  check('approved: one welcome order, approved once', sql(`select count(*) || ':' || count(member_approved_at) from public.club_fulfillment_orders where user_id = '${USER.id}' and fulfillment_type = 'welcome_vision'`) === '1:1');
  const next = page.locator('a.fvp-next-cta');
  check('approved: next is the Family Meeting guide', (await next.innerText()).startsWith('Next: your Family Meeting guide') && (await next.getAttribute('href')) === '/club/family-meeting-guide', await next.innerText());
  await shot(page, `${label}-4-approved`, vp.width < 850);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=It’s yours!');
  check('refresh after approving: still approved, same next step', await page.isVisible('a.fvp-next-cta:has-text("Next: your Family Meeting guide")'));
  await next.click();
  await page.waitForURL(/\/club\/family-meeting-guide/);
  await page.waitForSelector('[data-meeting-guide-step]');
  const guide = await page.locator('main, body').first().innerText();
  check('Family Meeting guide: the standard sheet, four parts, ten minutes', /Our Family Meeting/.test(guide) && /Our Focus/.test(guide) && /Let’s Practice/.test(guide) && /Nothing to change here/.test(guide), guide.replace(/\s+/g, ' ').slice(0, 200));
  check('Family Meeting guide: progress shows the guide step current', await page.isVisible('[aria-current="step"]:has-text("Meeting guide")'));
  check('no sideways scrolling (guide)', await noSideScroll(page));
  await shot(page, `${label}-4b-meeting-guide`, true);
  const guidePages = await printPdf(page, `${label}-meeting-guide`);
  const guideText = execFileSync('pdftotext', [`${SHOTS ?? '/tmp'}/${label}-meeting-guide.pdf`, '-']).toString();
  check('Family Meeting guide prints on one Letter page, the sheet only', guidePages === 1 && /Our Family Meeting/.test(guideText) && !/Next: your|Club Home|Sign out/.test(guideText), `${guidePages} pages`);
  await page.click('button:has-text("Next: your January resource")');
  await page.waitForURL(/\/app\/club\/january\?welcome=1/);
  check('guide reviewed: recorded on her account', sql(`select meeting_guide_seen_at is not null from public.club_households where owner_user_id = '${USER.id}'`) === 't');
  await page.waitForSelector('text=Looks good. Prepare my Welcome Kit');
  await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready');
  const panel = await page.locator('[data-welcome-kit-confirm]').innerText();
  check('first resource: on the real January tool, with what comes and what to do', /Your January plan/.test(panel) && /In your Welcome Kit/i.test(panel) && /Family Vision print/.test(panel) && /Before you confirm/i.test(panel), panel.replace(/\s+/g, ' ').slice(0, 220));
  check('first resource: progress shows the last step current', await page.isVisible('[data-welcome-kit-confirm] [aria-current="step"]:has-text("Your first resource")'));
  check('first resource: the tool below is prepared with her kids’ names', /Sofia|Mateo/.test(await page.locator('.club-plan').innerText()));
  check('first resource: the Club nav is on the tool', JSON.stringify(await clubNavLinks(page)) === JSON.stringify(CLUB_NAV), JSON.stringify(await clubNavLinks(page)));
  check('no sideways scrolling (first resource)', await noSideScroll(page));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `${label}-5-first-resource`);
  const cta = await page.evaluate(() => {
    const b = document.querySelector('[data-welcome-kit-confirm] .btn-primary').getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { top: Math.round(b.top), clear: Boolean(hit?.closest('[data-welcome-kit-confirm]')) };
  });
  check('first resource: the confirm button isn’t covered', cta.clear || cta.top > vp.height, JSON.stringify(cta));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Looks good. Prepare my Welcome Kit');
  await page.waitForTimeout(1500);
  check('refresh on the tool: still waiting for her one confirmation (never confirmed for her)', order('monthly_resource').endsWith('needs_confirmation') && !firstConfirmed(), kitOrders());
  // Her change on the real tool is what the owner prints.
  const MARK = 'Rivera print check';
  if (label === 'desktop') {
    await editPlan(page, 'january', MARK);
    await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planSave === 'saved', null, { timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
  await page.click('text=Looks good. Prepare my Welcome Kit');
  await page.waitForSelector('text=Your Welcome Kit is submitted');
  const submitted = await page.locator('[data-kit-submitted]').innerText();
  check('submitted: three items, one package, the two-business-day aim', /Family Vision print/.test(submitted) && /Family Meeting guide/.test(submitted) && /January resource/.test(submitted) && /two business days/.test(submitted), submitted.replace(/\s+/g, ' '));
  check('submitted: the owner is notified (club-billing kit_submitted)', page.calls.includes('billing:kit_submitted'), page.calls.filter((c) => c.startsWith('billing')).join(','));
  if (label === 'desktop') {
    const pv = await newPage(browser, DESKTOP, { auth: false });
    await asAdmin(pv);
    await pv.goto(`${BASE}/app/club/january?fulfillment=${orderId('monthly_resource')}`, { waitUntil: 'networkidle' });
    await pv.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready');
    await pv.waitForTimeout(800);
    check('the owner’s print view shows her saved change (what prints is what she approved)', (await pv.locator('.club-plan').innerText()).includes(MARK), (await pv.locator('[data-plan-fulfillment-bar]').innerText()).replace(/\s+/g, ' '));
    await pv.context().close();
  }
  check('confirmed: both items prepared together (kit needs only its PDFs)', order('welcome_vision') === 'pending:needs_pdf' && order('monthly_resource') === 'pending:needs_pdf', kitOrders());
  await shot(page, `${label}-6-all-set`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready');
  await page.waitForTimeout(2000);
  check('revisiting her tool doesn’t undo her confirmation, and the confirm panel is gone', firstConfirmed() && !(await page.isVisible('[data-welcome-kit-confirm]')), kitOrders());
  await page.goto(`${BASE}/app/club/january?welcome=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/club/resources/${JAN}?welcome=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=It’s all set!');
  await page.click('a:has-text("Go to Club Home")');
  await page.waitForURL(/\/app\/club/);
  await page.waitForSelector('[data-club-home]');
  const club = await page.locator('main').innerText();
  check('Club Home: no “preview library” line, her Welcome Kit status', !/preview library, not an active membership/i.test(club) && /Your first mailing, together/.test(club) && /Submitted\. We aim to print and mail your Welcome Kit within two business days/.test(club) && /Family Meeting guide/.test(club), club.replace(/\s+/g, ' ').slice(0, 260));
  check('Club Home: her family name, members with ages and an edit link', /The Rivera Family/.test(club) && /Sofia · 8/.test(club) && /Mateo · 6/.test(club) && await page.isVisible('a[href="/club/family"]:has-text("Edit my family")'), club.replace(/\s+/g, ' ').slice(0, 200));
  check('Club Home: next step opens January', await page.isVisible('.ofc-next-step a[href="/app/club/january"]'));
  check('Club Home: coming up lists February with its payment date', /February 2027: .* opens with your February 1, 2027 payment/.test(club));
  check('Club Home: the Club nav', JSON.stringify(await clubNavLinks(page)) === JSON.stringify(CLUB_NAV), JSON.stringify(await clubNavLinks(page)));
  const jan = page.locator('article.ofc-app-month', { hasText: 'January' });
  check('her Club: January marked hers, opening her family’s plan in the app (saved to her account)', /January 2027 · Yours · Free/i.test(await jan.innerText()) && (await jan.locator('a:not(.ofc-app-month-meeting)').getAttribute('href')) === '/app/club/january');
  check('her Club: every month links its Family Meeting', (await page.locator('a.ofc-app-month-meeting').count()) === 12 && (await jan.locator('a.ofc-app-month-meeting').getAttribute('href')) === '/app/club/january?view=meeting');
  check('her Club: February shows when her next payment opens it', /Next · February 2027/i.test(club) && /Opens with your February 1, 2027 payment/.test(club));
  check('her Club: other months stay previews', (await page.locator('article.ofc-app-month', { hasText: 'March' }).locator('a:not(.ofc-app-month-meeting)').innerText()).startsWith('Preview the tool'));
  check('no sideways scrolling (her Club)', await noSideScroll(page));
  await shot(page, `${label}-7-club`, true);
  await page.click('[data-club-nav] a[aria-label="Account & Billing"]');
  await page.waitForURL(/\/club\/dashboard/);
  await page.waitForSelector('h1:has-text("Account & Billing")');
  const dash = await page.locator('main').innerText();
  check('Account & Billing: her plan and billing, a link to Club Home, no second month list', /First charge: \$5\.90/.test(dash) && await page.isVisible('[data-club-home-link] a[href="/app/club"]') && !/Your resources/.test(dash), dash.replace(/\s+/g, ' ').slice(0, 300));
  check('Account & Billing: the same Club nav, Account & Billing current', JSON.stringify(await clubNavLinks(page)) === JSON.stringify(CLUB_NAV) && await page.isVisible('[data-club-nav] a[aria-current="page"][aria-label="Account & Billing"]'));
  check('no sideways scrolling (dashboard)', await noSideScroll(page));
  await shot(page, `${label}-8-account`, true);
  check('one welcome order and one January order, never more', sql(`select count(*) from public.club_fulfillment_orders where user_id = '${USER.id}'`) === '2'
    && sql(`select count(*) from public.club_entitlements where user_id = '${USER.id}' and revoked_at is null`) === '2');
  check(`${label}: no script errors`, page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();

  // Returning, all done: sign-in lands on her account.
  const back = await newPage(browser, vp, { auth: false });
  await back.goto(`${BASE}/club/login?email=${encodeURIComponent(USER.email)}`, { waitUntil: 'networkidle' });
  await back.click('text=Email me a code');
  await back.fill('#club-code', '123456');
  await back.click('button:has-text("Sign in")');
  await back.waitForURL(/\/app\/club/);
  await back.waitForSelector('[data-club-home]');
  check('returning approved member: lands on Club Home (/app/club)', true);
  await back.goto(`${BASE}/club/family-vision`, { waitUntil: 'networkidle' });
  await back.waitForSelector('.fvp-approved-state');
  const again = await back.locator('.fvp-approved-state').innerText();
  check('returning to her print: approved, kit status, no sales links', /Your print is approved/.test(again) && (await back.locator('a[href="/club/"], a[href="/app/club/"]').count()) === 0, again.replace(/\s+/g, ' '));
  await back.context().close();
}

/**
 * The P0 journey (Oct 31 2026 production test): her free month refused (same household), so no Welcome Kit yet.
 * Family form → straight into steps 2–6 (never dropped into the library) → refresh mid-profile resumes → "Finish later"
 * says what's left → address (required here) → "Your Club starts with January" → Club Home. January stays closed until
 * her January 1 payment. Sign out and back in on another device resumes the open questions without re-entering family.
 */
async function postCheckout(browser, label, vp) {
  console.log(`\nFree month refused, ${label}: checkout → sign in → family → profile → finish later → address → starts with January → Club Home`);
  freshDb();
  refusedFreeMonth();
  sql(`delete from public.club_mailing_addresses where user_id = '${USER.id}'`);
  const page = await newPage(browser, vp, { auth: false });
  await page.goto(`${BASE}/club/welcome?session_id=cs_test_a1b2c3d4e5f6g7h8`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=You’re in.');
  await page.click('text=Email me a code');
  await page.fill('#club-code', '123456');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('text=Tell us about your family');
  check('kit progress: five steps, family current', (await page.locator('[aria-label="Your Welcome Kit"] li').count()) === 5 && await page.isVisible('[aria-label="Your Welcome Kit"] [aria-current="step"]:has-text("Your family")'));
  await page.fill('input[autocomplete="family-name"]', 'The Rivera Family');
  await page.fill('input[autocomplete="given-name"]', 'Ana');
  const kidRow = page.locator('li', { has: page.locator('select') });
  await kidRow.nth(0).locator('input').fill('Sofia');
  await kidRow.nth(0).locator('select').first().selectOption('8');
  await page.click('button:has-text("Next")');
  await page.waitForSelector('text=What does a typical week look like?', { timeout: 10000 }).catch(() => undefined);
  check('family form leads straight into step 2 of 6 (no Welcome Kit needed)', await page.isVisible('text=Step 2 of 6'), page.url());
  check('not sent to the library midway', /\/club\/welcome/.test(page.url()), page.url());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=What does a typical week look like?', { timeout: 10000 }).catch(() => undefined);
  check('refresh after the family form: still her profile questions, family not asked again', await page.isVisible('text=Step 2 of 6') && !(await page.isVisible('text=Tell us about your family')));
  await page.click('button:has-text("Skip for now")');
  await page.waitForSelector('text=What does everyone already take care of?');
  check('“Skip for now” skips one question', await page.isVisible('text=Step 3 of 6'));
  await page.click('button:has-text("Finish later")');
  await page.waitForSelector('text=Saved. Finish the rest anytime.');
  const later = await page.locator('main').innerText();
  check('“Finish later” says what’s left and where', /Still open:/.test(later) && /My Family/.test(later) && (await page.locator('main ul.list-disc li').count()) === 4, later.replace(/\s+/g, ' ').slice(0, 260));
  await shot(page, `${label}-p0-finish-later`, true);
  await page.click('button:has-text("Continue")');
  await page.waitForSelector('text=Where should we mail your Welcome Kit?');
  check('address required: asked next, address step current', await page.isVisible('[aria-label="Your Welcome Kit"] [aria-current="step"]:has-text("Your address")'));
  await page.fill('input[autocomplete="name"]', 'Ana Rivera').catch(() => undefined);
  await page.fill('input[autocomplete="address-line1"]', '14 Oak St');
  await page.fill('input[autocomplete="address-level2"]', 'Austin');
  await page.locator('select[autocomplete="address-level1"], input[autocomplete="address-level1"]').first().evaluate((el) => el.tagName).then(async (tag) => {
    if (tag === 'SELECT') await page.selectOption('select[autocomplete="address-level1"]', 'TX');
    else await page.fill('input[autocomplete="address-level1"]', 'TX');
  });
  await page.fill('input[autocomplete="postal-code"]', '78701');
  await page.click('button:has-text("See my welcome gift")');
  await page.waitForSelector('text=Your Club starts with January', { timeout: 10000 }).catch(() => undefined);
  const starts = await page.locator('main').innerText();
  check('no Welcome Kit yet: explained, with her first payment date', /Your Club starts with January/.test(starts) && /January 1, 2027/.test(starts) && /one per household/.test(starts), starts.replace(/\s+/g, ' ').slice(0, 300));
  check('nothing granted early: no entitlement, no orders', sql(`select count(*) from public.club_entitlements where user_id = '${USER.id}'`) === '0' && sql(`select count(*) from public.club_fulfillment_orders where user_id = '${USER.id}'`) === '0');
  check('no sideways scrolling (starts)', await noSideScroll(page));
  await shot(page, `${label}-p0-starts`, true);
  await page.click('a:has-text("Go to Club Home")');
  await page.waitForSelector('[data-club-home]');
  const home = await page.locator('main').innerText();
  check('Club Home: family name and members', /The Rivera Family/.test(home) && /Ana/.test(home) && /Sofia · 8/.test(home), home.replace(/\s+/g, ' ').slice(0, 200));
  check('Club Home: “starts with January” and the payment date', await page.isVisible('[data-club-starts]') && /January 1, 2027/.test(home));
  check('Club Home: offers finishing the profile (4 open)', await page.isVisible('a[href="/club/family?setup=1"]'));
  check('Club Home: coming up, January with its payment', /January 2027: .* opens with your January 1, 2027 payment/.test(home), home.replace(/\s+/g, ' ').slice(0, 400));
  check('Club Home: Club nav, Club Home current', JSON.stringify(await clubNavLinks(page)) === JSON.stringify(CLUB_NAV) && await page.isVisible('[data-club-nav] a[aria-current="page"][aria-label="Club Home"]'), JSON.stringify(await clubNavLinks(page)));
  check('Club Home: months grid is #months', await page.isVisible('#months article.ofc-app-month'));
  check('Club Home: no preview line, no month marked hers', !/preview library/i.test(home) && !/· Yours/.test(home));
  check('no sideways scrolling (Club Home)', await noSideScroll(page));
  await shot(page, `${label}-p0-club-home`, true);
  await page.goto(`${BASE}/app/club/january`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => ['denied', 'ready'].includes(document.querySelector('.club-plan')?.dataset.planState ?? ''));
  const gate = await page.locator('[data-plan-gate]').innerText();
  check('January before her payment: closed, says when it opens', (await page.locator('.club-plan').getAttribute('data-plan-state')) === 'denied' && /January opens January 1, 2027/.test(gate), gate.replace(/\s+/g, ' '));
  check('January gate: Club nav shown, no Welcome Kit confirmation', JSON.stringify(await clubNavLinks(page)) === JSON.stringify(CLUB_NAV) && !(await page.isVisible('[data-welcome-kit-confirm]')));
  // Navigation: the same four places on every Club page.
  for (const [path, current] of [['/club/family', 'My Family'], ['/club/dashboard', 'Account & Billing']]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-club-nav]');
    check(`nav on ${path}: the same Club nav, ${current} current`, JSON.stringify(await clubNavLinks(page)) === JSON.stringify(CLUB_NAV) && await page.isVisible(`[data-club-nav] a[aria-current="page"][aria-label="${current}"]`));
  }
  await page.goto(`${BASE}/app/account`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-account-family]');
  check('/app/account: her real family, not the sample', (await page.getAttribute('[data-account-family]', 'data-account-family')) === 'member' && /The Rivera Family/.test(await page.locator('main').innerText()) && !(await page.isVisible('text=SAMPLE ONLY')));
  check(`${label} P0: no script errors`, page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();

  // Another device (no "Finish later" remembered): sign-in resumes the open questions, family kept.
  const other = await newPage(browser, vp, { auth: false });
  await other.goto(`${BASE}/club/login?email=${encodeURIComponent(USER.email)}`, { waitUntil: 'networkidle' });
  await other.click('text=Email me a code');
  await other.fill('#club-code', '123456');
  await other.click('button:has-text("Sign in")');
  await other.waitForSelector('text=What does everyone already take care of?', { timeout: 15000 }).catch(() => undefined);
  check('sign in on another device: resumes at the first open question (step 3), family not re-entered', await other.isVisible('text=Step 3 of 6') && !(await other.isVisible('text=Tell us about your family')), other.url());
  for (let i = 0; i < 4; i++) {
    await other.click('button:has-text("Skip for now"), button:has-text("Finish")');
    await other.waitForTimeout(600);
  }
  await other.waitForSelector('text=Your Club starts with January', { timeout: 15000 }).catch(() => undefined);
  check('profile done (all skipped): told again when her Club starts', await other.isVisible('text=Your Club starts with January'), other.url());
  await other.click('a:has-text("Go to Club Home")');
  await other.waitForSelector('[data-club-home]', { timeout: 15000 }).catch(() => undefined);
  check('profile done (all skipped): back on Club Home, no profile nudge', /\/app\/club/.test(other.url()) && !(await other.isVisible('a[href="/club/family?setup=1"]')), other.url());
  check('every answer optional: setup counted complete', sql(`select setup_completed_at is not null from public.club_households where owner_user_id = '${USER.id}'`) === 't');
  // Sign out from the Club nav, sign back in: Club Home.
  await other.click('[data-club-nav] button:has-text("Sign out")');
  await other.waitForTimeout(800);
  check('sign out: session gone, Club Home back to the preview', !(await other.evaluate(() => localStorage.getItem('omc:account:session'))) && /preview library/i.test(await other.locator('main').innerText()));
  await other.goto(`${BASE}/club/login?email=${encodeURIComponent(USER.email)}`, { waitUntil: 'networkidle' });
  await other.click('text=Email me a code');
  await other.fill('#club-code', '123456');
  await other.click('button:has-text("Sign in")');
  await other.waitForSelector('[data-club-home]', { timeout: 15000 }).catch(() => undefined);
  check('sign back in: Club Home with her family', /The Rivera Family/.test(await other.locator('main').innerText()), other.url());
  check(`${label} P0 return: no script errors`, other.errors.length === 0, other.errors.join(' | '));
  await other.context().close();
}

scenarios.p0desktop = (browser) => postCheckout(browser, 'desktop', DESKTOP);
scenarios.p0mobile = (browser) => postCheckout(browser, 'mobile', MOBILE);

scenarios.desktop = (browser) => journey(browser, 'desktop', DESKTOP);
scenarios.mobile = (browser) => journey(browser, 'mobile', MOBILE);

scenarios.preview = async (browser) => {
  console.log('\n/app/club signed out: still the preview library');
  const page = await newPage(browser, MOBILE, { auth: false });
  await page.goto(`${BASE}/app/club`, { waitUntil: 'networkidle' });
  await page.waitForSelector('article.ofc-app-month');
  const text = await page.locator('main').innerText();
  check('signed out: the preview line and twelve preview cards, nothing of anyone’s', /preview library, not an active membership/i.test(text) && (await page.locator('a:has-text("Preview the tool")').count()) === 12 && !/Yours/.test(text));
  check('signed out: no script errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
};

scenarios.resume = async (browser) => {
  console.log('\nComing back midway: the welcome email’s sign-in lands on her next step');
  const signInTo = async (pattern) => {
    const page = await newPage(browser, MOBILE, { auth: false });
    await page.goto(`${BASE}/club/login?email=${encodeURIComponent(USER.email)}`, { waitUntil: 'networkidle' });
    await page.click('text=Email me a code');
    await page.fill('#club-code', '123456');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL(pattern, { timeout: 15000 }).catch(() => undefined);
    const url = page.url();
    await page.context().close();
    return url;
  };
  freshDb();
  check('no family yet → her family step', /\/club\/welcome/.test(await signInTo(/\/club\/welcome/)));
  as.family();
  check('family saved, profile open → her profile questions (/club/welcome)', /\/club\/welcome/.test(await signInTo(/\/club\/welcome/)));
  as.profileDone();
  check('profile done → her print', /\/club\/family-vision/.test(await signInTo(/\/club\/family-vision/)));
  as.vision('The Rivera Family', 'Hope');
  check('print saved but not approved → still her print', /\/club\/family-vision/.test(await signInTo(/\/club\/family-vision/)));
  as.approvePrint();
  check('print approved → the Family Meeting guide', /\/club\/family-meeting-guide/.test(await signInTo(/\/club\/family-meeting-guide/)));
  sql(`update public.club_households set meeting_guide_seen_at = now() where owner_user_id = '${USER.id}'`);
  check('guide reviewed → her first resource on its real tool', /\/app\/club\/january\?welcome=1/.test(await signInTo(/\/app\/club\/january/)));
  sql(`update public.club_fulfillment_orders set member_approved_at = now() - interval '3 days 1 hour' where user_id = '${USER.id}' and fulfillment_type = 'welcome_vision'`);
  check('three days later: still her first resource (never confirmed for her)', /\/app\/club\/january\?welcome=1/.test(await signInTo(/\/app\/club\/january/)));
  asUser(USER.id, `select public.club_fulfillment_approve('${JAN}') \\g /dev/null`);
  check('she confirms → Club Home', /\/app\/club$/.test(new URL(await signInTo(/\/app\/club$/)).pathname));

  // Her January isn't editable once the kit is approved for print; a preparing month never says "not yours".
  const page = await newPage(browser, DESKTOP);
  sql(`update public.club_kits set status = 'draft' where slug = '${JAN}'`);
  await page.goto(`${BASE}/club/resources/${JAN}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=is yours');
  check('a month that’s hers but not published: “yours, we’re finishing it”', !(await page.isVisible('text=isn’t part of your membership')));
  sql(`update public.club_kits set status = 'scheduled' where slug = '${JAN}'`);
  await page.context().close();
};

// Every monthly tool at /app/club/<month> as a signed-in member (src/lib/club/plan/account.ts): her family on it, a real
// edit saved to her account, the same plan back in a new browser (closed browser, another device) and after signing
// out and in, the Family Meeting reading without writing, phone and desktop without sideways scrolling, every image
// loaded, and a Letter print with no blank page. Run with --only=months (not part of the default run: it's slow).
const MONTH_PAGES = [
  ['january', '2027-01-fresh-start-together', 'omc:club:january-weekly-meeting:v1'],
  ['february', '2027-02-better-together', 'omc:club:february-laundry-app:v1'],
  ['march', '2027-03-spring-clean-together', 'omc:club:march-chore-charts:v2'],
  ['april', '2027-04-everybody-helps-at-mealtime', 'omc:club:april-app:v1'],
  ['may', '2027-05-finish-the-school-year', 'omc:club:may-app:v1'],
  ['june', '2027-06-summer-with-a-plan', 'omc:club:june-app:v1'],
  ['july', '2027-07-ready-to-go', 'omc:club:july-app:v1'],
  ['august', '2027-08-school-year', 'omc:club:august-app:v1'],
  ['september', '2027-09-a-week-everyone-can-see', 'omc:preview:september-habit-cards:v3'],
  ['october', '2027-10-home-works-together', 'omc:club:october-daily-reset:v1'],
  ['december', '2026-12-christmas-mission', 'omc:club:december-app:v1'],
];
const NOV = '2026-11-family-ownership';
const pageTexts = (pdf) => execFileSync('pdftotext', ['-layout', pdf, '-']).toString().split('\f').slice(0, -1);
/** Her saved version's entry for a key (null when none). */
const savedEntry = (slug, key) => sql(`select v.state -> ${lit(key)} ->> 'v' from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id
  join public.club_households h on h.id = v.household_id where k.slug = ${lit(slug)} and h.owner_user_id = '${USER.id}'`) || null;
const tabValue = (page, key) => page.evaluate((k) => sessionStorage.getItem(k), key);
async function openPlan(page, month) {
  await page.goto(`${BASE}/app/club/${month}`, { waitUntil: 'networkidle' });
  const ready = await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready', null, { timeout: 15000 }).then(() => true, () => false);
  await page.waitForTimeout(900);
  return ready;
}
/** A real edit with her mouse and keyboard: text on the sheet where the tool has it, else its own editor. */
async function editPlan(page, month, marker) {
  if (month === 'february') {
    await page.click('[data-cpd-edit]');
    await page.locator('dialog[open] input[type="checkbox"]').first().click();
    await page.keyboard.press('Escape');
    return 'unticked a step in its editor';
  }
  if (month === 'march') {
    await page.click('[data-cpd-edit]');
    const input = page.locator('dialog[open] input[type="text"], dialog[open] input:not([type])').first();
    await input.fill(marker);
    await input.press('Tab');
    await page.keyboard.press('Escape');
    return 'renamed a chore in its editor';
  }
  if (month === 'december') {
    await page.click('[data-cpd-edit]');
    await page.locator('dialog[open] button[aria-pressed="false"]').first().click();
    await page.keyboard.press('Escape');
    return 'picked another grown-up helper';
  }
  const target = page.locator('.club-plan [data-plan-sheet] [contenteditable="true"]').first();
  await target.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(marker);
  await page.keyboard.press('Tab');
  await page.mouse.click(5, 5);
  return 'typed on the sheet';
}
scenarios.months = async (browser) => {
  console.log('Every monthly tool at /app/club: her plan saved to her account, back in a new browser, meeting, phone, print');
  freshDb();
  as.family();
  sql(`update public.club_kits set status = 'scheduled'`);
  sql(`insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note)
       select '${USER.id}', h.id, k.month, 'digital', 1, 'admin', 'admin', 'QA: every month'
         from public.club_households h, public.club_kits k
        where h.owner_user_id = '${USER.id}' and k.slug in (${[...MONTH_PAGES.map((m) => m[1]), NOV].map(lit).join(', ')})
       on conflict do nothing`);
  // A plan she saved earlier on her copy of January (a different tool there): it must stay exactly as it is.
  const legacy = '{"legacy":"habit cards she saved earlier"}';
  sql(`insert into public.club_resource_versions (household_id, kit_id, state, profile_version)
       select h.id, k.id, jsonb_build_object('omc:club:member:${MONTH_PAGES[0][1]}:v1', jsonb_build_object('s', 'l', 'v', ${lit(legacy)})), h.profile_version
         from public.club_households h, public.club_kits k where h.owner_user_id = '${USER.id}' and k.slug = '${MONTH_PAGES[0][1]}'`);

  // QA_MONTHS=june,july limits the months (the sign-out check and the Club home links still run).
  const pick = process.env.QA_MONTHS?.split(',');
  for (const [month, slug, key] of MONTH_PAGES.filter(([m]) => !pick || pick.includes(m) || m === 'june')) {
    const page = await newPage(browser, DESKTOP);
    const ready = await openPlan(page, month);
    check(`${month}: her tool opens`, ready, ready ? '' : (await page.locator('.club-plan').innerText().catch(() => '')).slice(0, 160));
    if (!ready) { await page.context().close(); continue; }
    const text = await page.locator('.club-plan').innerText();
    check(`${month}: prepared with her family`, /Sofia|Mateo|Rivera/i.test(text));
    check(`${month}: says it saves to her account`, /Changes save to your account/.test(text));
    const before = savedEntry(slug, key);
    check(`${month}: opening saves nothing`, before === null, String(before).slice(0, 60));
    const imgs = await page.evaluate(() => [...document.querySelectorAll('.club-plan img')].filter((i) => i.getClientRects().length && !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute('src')));
    check(`${month}: every image loads`, imgs.length === 0, imgs.join(' '));
    check(`${month}: desktop, no sideways scrolling`, await noSideScroll(page));

    const marker = `Q${month.slice(0, 3)}${Date.now() % 1000}`;
    const how = await editPlan(page, month, marker);
    await page.waitForTimeout(2500);
    const value = await tabValue(page, key);
    const saved = savedEntry(slug, key);
    check(`${month}: an edit (${how}) saves to her account`, Boolean(value) && saved === value, `${String(saved).slice(0, 50)} vs ${String(value).slice(0, 50)}`);
    if (month === 'january') {
      check('january: the plan she saved earlier on her copy is untouched', sql(`select v.state -> 'omc:club:member:${slug}:v1' ->> 'v' from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '${slug}'`) === legacy);
      check('january: and linked from the tool', await page.isVisible('a:has-text("Open the copy you saved earlier")'));
    }
    check(`${month}: no script errors`, page.errors.length === 0, page.errors.slice(0, 2).join(' | '));
    const revision = sql(`select revision from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '${slug}'`);

    // The Family Meeting beside it reads her family and writes nothing.
    await page.locator('[data-fm-view="meeting"]').first().click();
    await page.waitForTimeout(600);
    check(`${month}: Family Meeting shows her family`, /Sofia|Mateo/.test(await page.locator('[data-meeting-sheet]').first().innerText().catch(() => '')));
    await page.locator('[data-fm-view="tool"]').first().click();
    await page.waitForTimeout(600);
    check(`${month}: back to the tool, her change still there`, (await tabValue(page, key)) === value);
    check(`${month}: the meeting changed nothing saved`, sql(`select revision from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '${slug}'`) === revision && savedEntry(slug, key) === value);

    const pages = await printPdf(page, `app-${month}`);
    const blank = pageTexts(`${SHOTS ?? '/tmp'}/app-${month}.pdf`).map((t, i) => (t.trim() ? null : i + 1)).filter(Boolean);
    check(`${month}: prints ${pages} Letter page(s), none blank`, pages > 0 && blank.length === 0, blank.length ? `blank: ${blank.join(',')}` : '');
    await page.context().close();

    // A new browser (closed browser, another device): the same plan, and it isn't saved again just by opening.
    const again = await newPage(browser, DESKTOP);
    await openPlan(again, month);
    check(`${month}: same plan in a new browser`, (await tabValue(again, key)) === value);
    if (how === 'typed on the sheet' || month === 'march') check(`${month}: her words are on the sheet`, (await again.locator('.club-plan').innerText()).includes(marker) || Boolean(await again.evaluate((m) => [...document.querySelectorAll('.club-plan input')].some((i) => i.value === m), marker)));
    check(`${month}: reopening doesn't save again`, sql(`select revision from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '${slug}'`) === revision);
    await again.context().close();

    const phone = await newPage(browser, MOBILE);
    const ok = await openPlan(phone, month);
    check(`${month}: phone opens with her family`, ok && /Sofia|Mateo|Rivera/i.test(await phone.locator('.club-plan').innerText()));
    const wide = await phone.evaluate(() => document.documentElement.scrollWidth);
    check(`${month}: phone, no sideways scrolling`, await noSideScroll(phone), `page ${wide}px wide`);
    await shot(phone, `app-${month}-phone`);
    await phone.context().close();
  }

  // Sign out, sign back in with her emailed code: June is still her plan.
  const out = await newPage(browser, MOBILE, { auth: false });
  await out.goto(`${BASE}/club/login`, { waitUntil: 'networkidle' });
  await out.evaluate((s) => localStorage.setItem('omc:account:session', JSON.stringify(s)),
    { access_token: 'member-token', refresh_token: 'member-refresh', expires_at: Date.now() + 3600_000, email: USER.email, user_id: USER.id });
  await out.goto(`${BASE}/club/dashboard`, { waitUntil: 'networkidle' });
  await out.click('text=Sign out');
  await out.waitForTimeout(800);
  check('signed out: no session left', !(await out.evaluate(() => localStorage.getItem('omc:account:session'))));
  await out.goto(`${BASE}/app/club/june`, { waitUntil: 'networkidle' });
  await out.waitForTimeout(800);
  check('signed out: her plan asks her to sign in', (await out.locator('.club-plan').getAttribute('data-plan-state')) === 'signed-out');
  await out.context().close();
  const back = await newPage(browser, MOBILE, { auth: false });
  await back.goto(`${BASE}/club/login?email=${encodeURIComponent(USER.email)}`, { waitUntil: 'networkidle' });
  await back.click('text=Email me a code');
  await back.fill('#club-code', '123456');
  await back.click('button:has-text("Sign in")');
  await back.waitForURL((u) => !u.pathname.startsWith('/club/login'), { timeout: 15000 }).catch(() => undefined);
  check('signed back in with her emailed code', !back.url().includes('/club/login'), back.url());
  const backReady = await openPlan(back, 'june');
  if (!backReady) console.log(`       (june: ${await back.locator('.club-plan').getAttribute('data-plan-state')} ${(await back.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 200)})`);
  check('signed back in: June is her saved plan', (await tabValue(back, 'omc:club:june-app:v1')) === savedEntry('2027-06-summer-with-a-plan', 'omc:club:june-app:v1'));
  // Her family page opens for editing (also where the profile functions aren't on the database yet).
  await back.goto(`${BASE}/club/family`, { waitUntil: 'networkidle' });
  await back.waitForSelector('button:has-text("Save our family"), [role="alert"]', { timeout: 10000 }).catch(() => undefined);
  check('her family page opens for editing', await back.locator('button:has-text("Save our family")').isVisible().catch(() => false) && !(await back.isVisible('text=We couldn’t load your family')),
    (await back.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 160));
  // Her Club home opens the app tools (November stays on its own page: it's the only place its tool lives).
  await back.goto(`${BASE}/app/club`, { waitUntil: 'networkidle' });
  await back.waitForSelector('text=Open your June plan', { timeout: 10000 }).catch(() => undefined);
  const links = await back.evaluate(() => Object.fromEntries([...document.querySelectorAll('a')].filter((a) => /^Open your/.test(a.textContent ?? '')).map((a) => [a.textContent.replace(/\s*→\s*$/, ''), a.getAttribute('href')])));
  check('Club home: “Open your June plan” → /app/club/june', links['Open your June plan'] === '/app/club/june', JSON.stringify(links));
  check('Club home: every month she holds opens its tool', Object.entries(links).every(([t, h]) => (/November/.test(t) ? h === `/club/resources/${NOV}` : /^\/app\/club\/[a-z]+$/.test(h))) && Object.keys(links).length === 12, `${Object.keys(links).length} links`);
  await back.context().close();
};

const names = ONLY ? ONLY.split(',') : Object.keys(scenarios).filter((n) => n !== 'months');
const browser = await chromium.launch();
try {
  for (const n of names) await scenarios[n](browser);
} catch (e) {
  failures++;
  console.log(`  FAIL (crashed) ${e.message.split('\n').slice(0, 6).join(' | ')}`);
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
