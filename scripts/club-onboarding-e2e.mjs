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
    : types[i] === 'jsonb' || types[i] === 'json' ? `${lit(JSON.stringify(body[n]))}::${types[i]}` : `${lit(body[n])}::${types[i]}`}` : null)).filter(Boolean);
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
};
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
  check('and why it waits', rowText.includes('Waiting for her to confirm her first resource') && rowText.includes('counts as confirmed'), rowText.slice(0, 260));
  await page.fill('input[type=month]', '2027-01');
  await page.waitForTimeout(800);
  const monthText = await page.locator('body').innerText();
  check('January’s monthly list leaves her kit order out, and says so', monthText.includes('Plus 1 January 2027 resource ships in Welcome Kits') && monthText.includes('No mailings for this month.'));
  await shot(page, 'admin-kits-waiting', true);

  // Three days pass: her prepared January counts as confirmed (everything else is valid).
  sql(`update public.club_fulfillment_orders set member_approved_at = now() - interval '3 days 1 hour' where user_id = '${USER.id}' and fulfillment_type = 'welcome_vision'`);
  check('after three days the kit only needs its PDFs', order('welcome_vision') === 'pending:needs_pdf', order('welcome_vision'));

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
  await mv.goto(`${BASE}/club/resources/${JAN}?fulfillment=${m}`, { waitUntil: 'networkidle' });
  await mv.waitForSelector('text=Mark PDF ready');
  const cards = await mv.locator('#club-month-content').innerText();
  check('January print view: prepared with her children’s names', /Sofia/.test(cards) && /Mateo/.test(cards), cards.slice(0, 160).replace(/\s+/g, ' '));
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
  check('her January is recorded as confirmed by the three-day rule', sql(`select note from public.club_fulfillment_orders where id = '${m}'`).includes('confirmed automatically'));
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Download approved kits')]);
  const csv = execFileSync('cat', [await download.path()]).toString().trim().split('\n');
  check('CSV: one row for the package', csv.length === 2, `${csv.length - 1} row(s)`);
  check('CSV: names both items and her address', /Family Vision print \(Courage\) \+ 2027-01 Our Family Habit Cards/.test(csv[1]) && /14 Oak St/.test(csv[1]), csv[1]);
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
  await page.click('button:has-text("See my welcome gift")');
  await page.waitForURL(/\/club\/family-vision/);
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
  check('approved: primary CTA is “See your first family resource”', (await next.innerText()).startsWith('See your first family resource'));
  check('approved: it goes to her January (her entitlement), never a sales page', (await next.getAttribute('href')) === `/club/resources/${JAN}?welcome=1`);
  await shot(page, `${label}-4-approved`, vp.width < 850);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=It’s yours!');
  check('refresh after approving: still approved, same next step', await page.isVisible('a.fvp-next-cta:has-text("See your first family resource")'));
  await next.click();
  await page.waitForURL(/\/club\/resources\//);
  await page.waitForSelector('text=Looks good. Prepare my Welcome Kit');
  const panel = await page.locator('.kit-first').innerText();
  check('first resource: titled, for her kids, with what comes and her first step', /Our Family Habit Cards/.test(panel) && /Sofia and Mateo/.test(panel) && /In your Welcome Kit/i.test(panel) && /first step/i.test(panel), panel.replace(/\s+/g, ' ').slice(0, 220));
  check('first resource: her cards below are prepared with her kids’ names', /Sofia|Mateo/.test(await page.locator('#club-month-content').innerText()));
  check('first resource: no separate monthly “Looks good, print it”', !(await page.isVisible('button:has-text("Looks good, print it")')));
  check('no sideways scrolling (first resource)', await noSideScroll(page));
  await shot(page, `${label}-5-first-resource`, vp.width < 850);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `${label}-5b-first-resource-view`);
  const cta = await page.evaluate(() => {
    const b = document.querySelector('.kit-first .btn-primary').getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { top: Math.round(b.top), clear: Boolean(hit?.closest('.kit-first')) };
  });
  check('first resource: the confirm button isn’t covered by the printable’s toolbar', cta.clear || cta.top > vp.height, JSON.stringify(cta));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Looks good. Prepare my Welcome Kit');
  await page.waitForTimeout(1500);
  check('refresh on the resource: still waiting for her one confirmation', order('monthly_resource').endsWith('needs_confirmation'), kitOrders());
  await page.click('text=Looks good. Prepare my Welcome Kit');
  await page.waitForSelector('text=It’s all set!');
  check('confirmed: both items prepared together (kit needs only its PDFs)', order('welcome_vision') === 'pending:needs_pdf' && order('monthly_resource') === 'pending:needs_pdf', kitOrders());
  await shot(page, `${label}-6-all-set`, vp.width < 850);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=It’s all set!');
  await page.waitForTimeout(2000);
  check('revisiting her resource doesn’t undo her confirmation', firstConfirmed(), kitOrders());
  await page.click('a:has-text("See your Club")');
  await page.waitForURL(/\/app\/club/);
  await page.waitForSelector('text=Your year in the Club');
  const club = await page.locator('main').innerText();
  check('her Club (/app/club): no “preview library” line, her Welcome Kit status', !/preview library, not an active membership/i.test(club) && /Your first mailing, together/.test(club) && /We’re preparing your Welcome Kit/.test(club), club.replace(/\s+/g, ' ').slice(0, 260));
  const jan = page.locator('article.ofc-app-month', { hasText: 'January' });
  check('her Club: January marked hers, opening her family’s version', /January 2027 · Yours · Free/i.test(await jan.innerText()) && (await jan.locator('a').getAttribute('href')) === `/club/resources/${JAN}`);
  check('her Club: February shows when her next payment opens it', /Next · February 2027/i.test(club) && /Opens with your February 1, 2027 payment/.test(club));
  check('her Club: other months stay previews', (await page.locator('article.ofc-app-month', { hasText: 'March' }).locator('a').innerText()).startsWith('Preview the tool'));
  check('no sideways scrolling (her Club)', await noSideScroll(page));
  await shot(page, `${label}-7-club`, true);
  await page.click('a:has-text("billing, family and mailing address")');
  await page.waitForURL(/\/club\/dashboard/);
  await page.waitForSelector('text=Your first mailing, together');
  const dash = await page.locator('main').innerText();
  check('dashboard: one Welcome Kit card with both items and its status', /Family Vision watercolor print/.test(dash) && /January: Our Family Habit Cards/.test(dash) && /We’re preparing your Welcome Kit/.test(dash), dash.replace(/\s+/g, ' ').slice(0, 300));
  check('dashboard: January isn’t called “This month” in October', /January 2027 · Your first month/i.test(dash) && !/January 2027 · This month/i.test(dash));
  check('dashboard: January’s printed copy “Coming in your Welcome Kit”', /Coming in your Welcome Kit/.test(dash));
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
  await back.waitForSelector('text=Your year in the Club');
  check('returning approved member: lands on her Club (/app/club)', true);
  await back.goto(`${BASE}/club/family-vision`, { waitUntil: 'networkidle' });
  await back.waitForSelector('.fvp-approved-state');
  const again = await back.locator('.fvp-approved-state').innerText();
  check('returning to her print: approved, kit status, no sales links', /Your print is approved/.test(again) && (await back.locator('a[href="/club/"], a[href="/app/club/"]').count()) === 0, again.replace(/\s+/g, ' '));
  await back.context().close();
}

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
  check('family saved → her print', /\/club\/family-vision/.test(await signInTo(/\/club\/family-vision/)));
  as.vision('The Rivera Family', 'Hope');
  check('print saved but not approved → still her print', /\/club\/family-vision/.test(await signInTo(/\/club\/family-vision/)));
  as.approvePrint();
  check('print approved → her first resource', new RegExp(`/club/resources/${JAN}\\?welcome=1`).test(await signInTo(/\/club\/resources\//)));
  sql(`update public.club_fulfillment_orders set member_approved_at = now() - interval '3 days 1 hour' where user_id = '${USER.id}' and fulfillment_type = 'welcome_vision'`);
  check('three days later (prepared resource confirmed for her) → her Club', /\/app\/club/.test(await signInTo(/\/app\/club/)));

  // Her January isn't editable once the kit is approved for print; a preparing month never says "not yours".
  const page = await newPage(browser, DESKTOP);
  sql(`update public.club_kits set status = 'draft' where slug = '${JAN}'`);
  await page.goto(`${BASE}/club/resources/${JAN}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=is yours');
  check('a month that’s hers but not published: “yours, we’re finishing it”', !(await page.isVisible('text=isn’t part of your membership')));
  sql(`update public.club_kits set status = 'scheduled' where slug = '${JAN}'`);
  await page.context().close();
};

const names = ONLY ? ONLY.split(',') : Object.keys(scenarios);
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
