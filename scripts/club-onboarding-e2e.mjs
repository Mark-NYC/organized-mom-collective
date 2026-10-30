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

const names = ONLY ? ONLY.split(',') : Object.keys(scenarios);
const browser = await chromium.launch();
try {
  for (const n of names) await scenarios[n](browser);
} catch (e) {
  failures++;
  console.log(`  FAIL (crashed) ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
