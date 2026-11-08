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
import { mkdirSync, readFileSync } from 'node:fs';
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
const clubNavLinks = async (page) => {
  // On phones the four links fold into the header's Menu: open it first.
  if (await page.isVisible('[data-club-nav] .club-header-menu') && !(await page.isVisible('[data-club-nav] nav[aria-label="Club"] a'))) await page.click('[data-club-nav] .club-header-menu');
  return page.evaluate(() => [...document.querySelectorAll('[data-club-nav] nav[aria-label="Club"] a')]
    .filter((a) => a.getBoundingClientRect().width > 0).map((a) => `${a.getAttribute('aria-label')}=${a.getAttribute('href')}`));
};
const CLUB_NAV = ['Club Home=/app/club', 'My Family=/club/family', 'Monthly Resources=/app/club/months', 'Account & Billing=/club/dashboard'];
/** One order's status:readiness, for checks. */
const order = (type) => sql(`select status || ':' || readiness from public.club_fulfillment_queue where user_id = '${USER.id}' and fulfillment_type = '${type}'`);
const orderId = (type) => sql(`select id from public.club_fulfillment_orders where user_id = '${USER.id}' and fulfillment_type = '${type}'`);

const signedIn = (page) => page.addInitScript(([s]) => {
  if (!localStorage.getItem('omc:account:session')) localStorage.setItem('omc:account:session', JSON.stringify(s));
}, [{ access_token: 'member-token', refresh_token: 'member-refresh', expires_at: Date.now() + 3600_000, email: USER.email, user_id: USER.id }]);

/** The production headers for /club/* (public/_headers), which `astro preview` doesn't send: framing rules included. */
const CLUB_HEADERS = Object.fromEntries(readFileSync(new URL('../public/_headers', import.meta.url), 'utf8').split(/\n(?=\/)/)
  .find((b) => b.startsWith('/club/*')).split('\n').slice(1).map((l) => l.trim()).filter(Boolean).map((l) => [l.slice(0, l.indexOf(':')).toLowerCase(), l.slice(l.indexOf(':') + 1).trim()]));
async function newPage(browser, viewport, { auth = true, db = true, fail } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/\/club\//, async (route) => {
    if (!route.request().url().startsWith(BASE) || route.request().resourceType() !== 'document') return route.fallback();
    const res = await route.fetch();
    return route.fulfill({ response: res, headers: { ...res.headers(), ...CLUB_HEADERS } });
  });
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

/**
 * The first month, personalized for a real-looking family (not the Rivera sample): a mother holding the account, her
 * partner, a grandparent at home and three children (12, 8 and 4). Her January (Our Family Focus) and her
 * Family Vision print must show her family, correctly, on screen and in the owner's print PDFs.
 */
scenarios.firstMonth = async (browser) => {
  console.log('\nFirst month personalization: the Okafor family on January and the Family Vision print');
  freshDb();
  asUser(USER.id, `select public.club_household_save('The Okafor Family', '{"icon_style":"hand-drawn"}',
    '[{"first_name":"Ada","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Chidi","kind":"adult","role":"partner"},
      {"first_name":"Rose","kind":"adult","role":"grandparent"},{"first_name":"Zara","kind":"child","role":"child","birth_year":2014,"birth_month":5},
      {"first_name":"Emeka","kind":"child","role":"child","birth_year":2018,"birth_month":9},{"first_name":"Nia","kind":"child","role":"child","birth_year":2022,"birth_month":2}]') \\g /dev/null`);
  as.vision('The Okafor Family', 'Joy');
  as.approvePrint();
  const SAMPLE = /Rivera|Sofia|Mateo|Chen|Brooks/;
  const NAMES = ['Ada', 'Chidi', 'Rose', 'Zara', 'Emeka', 'Nia'];

  // Her own view of January.
  const page = await newPage(browser, DESKTOP);
  await page.goto(`${BASE}/app/club/january`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready', null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const sheet = await page.locator('.club-plan [data-plan-sheet]').allInnerTexts().then((t) => t.join(' '));
  // The companion names each child with ideas for their age; grown-ups get a conversation, not a job.
  const KIDS = ['Zara', 'Emeka', 'Nia'];
  check('January (her view): every child by first name', KIDS.every((n) => sheet.includes(n)), sheet.replace(/\s+/g, ' ').slice(0, 300));
  check('January (her view): no sample family, no assumed Mom/Dad', !SAMPLE.test(sheet) && !/\b(Mom|Dad)\b/.test(sheet), (sheet.match(SAMPLE) ?? sheet.match(/\b(Mom|Dad)\b/) ?? [''])[0]);
  // She answered no profile questions: nothing is invented for the children; January's meeting habit is the start.
  check('January (her view): no answers, so no invented needs: the meeting habit, and every child starts a small idea now, to consider, nothing assigned', /Starting our Family Meeting habit/i.test(sheet) && /Something to consider/i.test(sheet) && /Nia, Emeka and Zara/.test(sheet) && /not assignments/.test(sheet) && !/once the meeting is a habit/.test(sheet) && !/Led by|add your own plans|Our habit experiment/i.test(sheet), sheet.replace(/\s+/g, ' ').slice(0, 600));
  check('January (her view): the Family Focus, not the four meeting parts', ['Our Family Focus', 'Our shared focus', 'Small habits worth trying', 'Our Words of the Week', 'Notice', 'Choose', 'Practice', 'Grow'].every((t) => sheet.toLowerCase().includes(t.toLowerCase())) && !/Let’s Talk|Let’s Practice/.test(sheet));
  check('January (her view): a winter sheet, no fall wording', /JANUARY 2027/i.test(sheet) && !/\bfall\b|Cooler weather/i.test(sheet));
  // Her review: keep the first idea, change the second's wording, skip the grown-ups line. Saved to her account.
  await page.click('[data-cpd-edit]');
  const boxes = page.locator('dialog[open] .mg-ed-exp');
  await boxes.nth(0).getByRole('button', { name: 'Keep it' }).click();
  await boxes.nth(1).getByRole('button', { name: 'Change it' }).click();
  const what = boxes.nth(1).locator('.mg-ed-change textarea').nth(1);
  await what.fill('Each of us adds our own plans on Sunday night.');
  await what.dispatchEvent('change');
  await page.locator('dialog[open] label', { hasText: 'For the grown-ups' }).locator('input').uncheck();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  const SAVED = `(select md5(v.state::text) || v.updated_at::text from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '${JAN}')`;
  check('her review saved to her account (kept, changed, skipped)', /Sunday night/.test(sql(`select v.state::text from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '${JAN}'`)));
  check('January (her view): no script errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();

  // She approves January; the kit is submitted and goes to print.
  asUser(USER.id, `select public.club_fulfillment_approve('${JAN}') \\g /dev/null`);
  check('both approvals in: the kit needs only its PDFs', order('welcome_vision') === 'pending:needs_pdf' && order('monthly_resource') === 'pending:needs_pdf', kitOrders());

  // Later, on her phone: the calm reference shows her saved choices, not regenerated defaults; viewing it, opening the
  // Family Meeting guide and coming back saves nothing and leaves the approved order as it is.
  const before = sql(`select ${SAVED}`);
  const phone = await newPage(browser, MOBILE);
  await phone.goto(`${BASE}/app/club/january`, { waitUntil: 'networkidle' });
  await phone.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready' && document.querySelector('[data-mgm-people] li'), null, { timeout: 15000 });
  await phone.waitForTimeout(600);
  let ref = await phone.locator('[data-mgm]').innerText();
  check('phone: her saved wording, her skip, no editor open', /Sunday night/.test(ref) && !/For the grown-ups/.test(ref) && !(await phone.isVisible('dialog[open]')), ref.replace(/\s+/g, ' ').slice(0, 300));
  check('phone: focus first, four words, a link to the Family Meeting guide', /Starting our Family Meeting habit/i.test(ref) && (await phone.locator('.mgm-word').count()) === 4 && await phone.isVisible('.mgm-guide-link'));
  check('phone: no sideways scrolling', await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await phone.click('.mgm-guide-link');
  await phone.waitForSelector('[data-mg-back]:not([hidden]) a', { timeout: 10000 });
  await phone.click('[data-mg-back] a');
  await phone.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready' && document.querySelector('[data-mgm-people] li'), null, { timeout: 15000 });
  await phone.waitForTimeout(1200);
  ref = await phone.locator('[data-mgm]').innerText();
  check('phone: back from the guide to the same Family Focus', /\/app\/club\/january/.test(phone.url()) && /Sunday night/.test(ref) && !/For the grown-ups/.test(ref), phone.url());
  check('viewing saved nothing and the approved order is unchanged', sql(`select ${SAVED}`) === before && order('monthly_resource') === 'pending:needs_pdf', `${order('monthly_resource')}`);
  check('phone: no script errors', phone.errors.length === 0, phone.errors.join(' | '));
  await phone.context().close();

  // The owner's print views: what actually gets printed and mailed.
  const mv = await newPage(browser, DESKTOP, { auth: false });
  await asAdmin(mv);
  await mv.goto(`${BASE}/app/club/january?fulfillment=${orderId('monthly_resource')}`, { waitUntil: 'networkidle' });
  await mv.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready', null, { timeout: 15000 });
  await mv.waitForTimeout(800);
  const janPages = await printPdf(mv, 'first-month-january');
  const jan = execFileSync('pdftotext', [`${SHOTS ?? '/tmp'}/first-month-january.pdf`, '-']).toString();
  check('January PDF: one or two Letter pages, as the family’s content needs', janPages === 1 || janPages === 2, `${janPages} pages`);
  check('January PDF: every child by first name', KIDS.every((n) => jan.includes(n)), KIDS.filter((n) => !jan.includes(n)).join(','));
  check('January PDF: exactly what she approved (her wording in, the skipped line out)', /Sunday night/.test(jan.replace(/\s+/g, ' ')) && !/For the grown-ups/.test(jan.replace(/\s+/g, ' ')), jan.replace(/\s+/g, ' ').slice(0, 300));
  check('January PDF: no sample family, no assumed Mom/Dad, no fall wording', !SAMPLE.test(jan) && !/\b(Mom|Dad)\b/.test(jan) && !/\bfall\b|Cooler weather/i.test(jan), jan.replace(/\s+/g, ' ').slice(0, 200));
  await mv.context().close();
  const pv = await newPage(browser, DESKTOP, { auth: false });
  await asAdmin(pv);
  await pv.goto(`${BASE}/club/family-vision?fulfillment=${orderId('welcome_vision')}`, { waitUntil: 'networkidle' });
  await pv.waitForSelector('text=Print / Save PDF');
  const a = await art(pv);
  check('Family Vision print: her family name and her word', a.name === 'The Okafor Family' && a.word === 'Joy' && Boolean(a.img?.startsWith('joy')), JSON.stringify(a));
  const visionPages = await printPdf(pv, 'first-month-vision');
  check('Family Vision PDF: one Letter page with her family name', visionPages === 1 && /theokaforfamily/i.test(execFileSync('pdftotext', [`${SHOTS ?? '/tmp'}/first-month-vision.pdf`, '-']).toString().replace(/\s+/g, '')));
  await pv.context().close();

  // The admin's Welcome Kits list: the package, ready for print and mail.
  const ad = await newPage(browser, DESKTOP, { auth: false });
  await asAdmin(ad);
  await ad.goto(`${BASE}/admin/club`, { waitUntil: 'networkidle' });
  await ad.locator('button:has-text("Fulfillment"), a:has-text("Fulfillment")').first().click().catch(() => undefined);
  await ad.waitForSelector('text=ana@example.com', { timeout: 10000 }).catch(() => undefined);
  const row = (await ad.locator('tr', { hasText: 'ana@example.com' }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  check('Welcome Kits: one package with her print, the Family Meeting guide and January, with a mail-by date', /Okafor/.test(row) && /Joy/.test(row) && /Family Meeting guide/.test(row) && /January 2027/.test(row) && /mail by/i.test(row), row.slice(0, 300));
  await ad.context().close();
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
  check('the row shows both items', /Family Vision print · The Rivera Family · Courage/.test(rowText) && /January 2027 · Our Family Focus/.test(rowText), rowText.slice(0, 200));
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
  check('January print view: the real tool, prepared with her children’s names', /Our Family Focus/i.test(cards) && /Sofia/.test(cards) && /Mateo/.test(cards), cards.slice(0, 160).replace(/\s+/g, ' '));
  check('January print view: no member chrome (Club nav, Welcome Kit panel)', !(await mv.isVisible('[data-club-nav]')) && !(await mv.isVisible('[data-welcome-kit-confirm]')));
  const janPages = await printPdf(mv, 'admin-january-tool');
  const janText = execFileSync('pdftotext', [`${SHOTS ?? '/tmp'}/admin-january-tool.pdf`, '-']).toString();
  check('January PDF: her Family Focus only (1–2 Letter pages, no admin bar, no site chrome)', (janPages === 1 || janPages === 2) && /Our Family Focus/i.test(janText) && /Sofia/.test(janText) && !/Fulfillment ·|Mark PDF ready|Club Home|MONTHLY TOOL/i.test(janText), `${janPages} pages · ${janText.replace(/\s+/g, ' ').slice(0, 160)}`);
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
  check('CSV: names both items and her address', /Family Vision print \(Courage\) \+ Family Meeting guide \+ 2027-01 Our Family Focus/.test(csv[1]) && /14 Oak St/.test(csv[1]), csv[1]);
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
  await page.waitForSelector('h1:has-text("Tell us about your family")');
  check('journey phase 1 shows in the header', await page.isVisible('[data-club-onboarding] [aria-label="Your Welcome Kit"] [aria-current="step"]:has-text("family")'));
  check('family name prefilled from the checkout name (“Ana Rivera”)', (await page.inputValue('input[autocomplete="family-name"]')) === 'The Rivera Family');
  check('optional details are tucked away', !(await page.isVisible('text=We have a pet')));
  check('a blank first child is ready to fill in', (await page.locator('li', { has: page.locator('select') }).count()) === 1);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Tell us about your family")');
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
  await page.waitForURL(/\/club\/welcome-kit/);
  const done = JSON.parse(asUser(USER.id, `select public.club_family_profile()::text`));
  check('profile complete: priority and challenges saved', done.setup_completed && done.priority === 'mornings' && done.challenges.join() === 'routines', JSON.stringify(done));
  // Her Welcome Kit: the three printed pieces together, each a miniature of the real printable.
  await page.waitForSelector('h1:has-text("Let’s get your first family package ready.")');
  const kit = await page.locator('[data-welcome-kit]').innerText();
  check('Welcome Kit: what she gets, in one sentence', /Three printed resources, made for your family and mailed together to your door\./.test(kit), kit.replace(/\s+/g, ' ').slice(0, 200));
  const statuses = () => page.evaluate(() => [...document.querySelectorAll('[data-kit-item]')].map((li) => `${li.dataset.kitItem}:${li.dataset.status}`).join(','));
  check('Welcome Kit: print needs review, guide ready, January needs review', await statuses() === 'print:needs_review,guide:ready,first:needs_review', await statuses());
  check('Welcome Kit: January is the Family Meeting guide', /January Resource/.test(kit) && /Our Family Focus/.test(kit), kit.replace(/\s+/g, ' ').slice(0, 400));
  check('Welcome Kit: “Prepare My Welcome Kit” waits until everything is ready', await page.isDisabled('[data-kit-prepare]'));
  check('Welcome Kit: a checklist, numbered 1–3, “1 of 3 ready”, the print tagged “Start here”', (await page.locator('.wk-item-num').allInnerTexts()).join() === '1,2,3' && /1 of 3 ready/.test(kit) && await page.isVisible('[data-kit-item="print"][data-start] .wk-item-start'));
  check('Welcome Kit: her address to confirm', /Mailing to/i.test(kit) && /14 Oak St/.test(kit));
  check('header: one journey, “Make it yours” current, a way to finish later', await page.isVisible('[data-club-onboarding] [aria-current="step"]:has-text("Make it yours")') && await page.isVisible('[data-club-onboarding] a:has-text("Finish later")'));
  check('header: no account links during onboarding', !(await page.isVisible('[data-club-nav] nav[aria-label="Club"]')));
  const thumbs = await page.waitForFunction(() => document.querySelectorAll('[data-kit-item] .kit-preview[data-state="ready"]').length === 3, null, { timeout: 30000 }).then(() => true, () => false);
  check('Welcome Kit: real previews of all three printables', thumbs, await page.evaluate(() => [...document.querySelectorAll('.kit-preview')].map((p) => p.dataset.state).join(',')));
  check('Welcome Kit: the January preview shows her family', await page.evaluate(() => /Sofia|Mateo/.test(document.querySelector('[data-kit-item="first"] iframe')?.contentDocument?.querySelector('.club-plan')?.innerText ?? '')));
  check('no sideways scrolling (Welcome Kit)', await noSideScroll(page));
  await shot(page, `${label}-3a-welcome-kit`, true);
  check('previews save nothing and confirm nothing', !firstConfirmed() && order('welcome_vision').endsWith('needs_vision'));
  await page.click('[data-kit-item="print"] .wk-item-action');
  await page.waitForURL(/\/club\/family-vision/);
  await page.waitForSelector('.fvp-approve-cta');
  let a = await art(page);
  check('the gift: her family name, a watercolor, a value', a.name === 'The Rivera Family' && Boolean(a.img) && a.imgLoaded && a.word === 'Love', JSON.stringify(a));
  check('the gift: header shows “Make it yours” current', await page.isVisible('[data-club-onboarding] [aria-current="step"]:has-text("Make it yours")'));
  check('the gift: the Welcome Kit step bar, the print current (1 of 3), a way back to the kit', (await page.evaluate(() => [...document.querySelectorAll('[data-kit-bar] li')].map((l) => `${l.dataset.step}:${l.dataset.state}`).join(','))) === 'print:current,guide:todo,first:todo' && await page.isVisible(vp.width < 861 ? '[data-kit-bar] .wkbar-phone:has-text("1 of 3")' : '[data-kit-bar] [data-step="print"] a') && await page.isVisible('[data-kit-bar] a.wkbar-back[href="/club/welcome-kit"]'), (await page.evaluate(() => [...document.querySelectorAll('[data-kit-bar] li')].map((l) => `${l.dataset.step}:${l.dataset.state}`).join(','))));
  check('the gift: “Approve for printing”, the same words as January', (await page.innerText('.fvp-approve-cta')).toLowerCase() === 'approve for printing');
  check('the gift: her mailing city is shown', await page.isVisible('text=Mailing to Austin, TX.'));
  check('the gift: no next-step panel or links before she approves', (await page.locator('a[href="/club/"], a[href="/app/club/"], .fvp-next-panel').count()) === 0);
  const pos = await page.evaluate(() => ({ h1: document.querySelector('.fvp-intro h1').getBoundingClientRect().top, art: document.querySelector('#fvp-room').getBoundingClientRect().top,
    cta: document.querySelector('.fvp-approve-cta').getBoundingClientRect().top, band: document.querySelector('.fvp').getBoundingClientRect().top, ctaBg: getComputedStyle(document.querySelector('.fvp-approve-cta')).backgroundColor }));
  check('the gift: charcoal #545454 primary button', pos.ctaBg === 'rgb(84, 84, 84)', pos.ctaBg);
  check('the gift: no empty band above the page (header and step bar only)', pos.band < 180, `page starts at ${Math.round(pos.band)}px`);
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
  check('approved: next is piece 2, the Family Meeting Guide', /^next: family meeting guide/i.test(await next.innerText()) && (await next.getAttribute('href')) === '/club/family-meeting-guide', await next.innerText());
  check('approved: still in the step bar, the guide and January still to do', (await page.evaluate(() => [...document.querySelectorAll('[data-kit-bar] li')].map((l) => `${l.dataset.step}:${l.dataset.state}`).join(','))) === 'print:current,guide:todo,first:todo', (await page.evaluate(() => [...document.querySelectorAll('[data-kit-bar] li')].map((l) => `${l.dataset.step}:${l.dataset.state}`).join(','))));
  await shot(page, `${label}-4-approved`, vp.width < 850);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=It’s yours!');
  check('refresh after approving: still approved, same next step', await page.isVisible('a.fvp-next-cta:has-text("Family Meeting Guide")'));
  // The Family Meeting guide: piece 2, nothing to approve.
  await next.click();
  await page.waitForURL(/\/club\/family-meeting-guide/);
  await page.waitForSelector('[data-meeting-guide-step]');
  const guide = await page.locator('body').innerText();
  check('Family Meeting guide: the standard sheet, nothing to change, next is piece 3', /Our Family Meeting/.test(guide) && /Our Focus/.test(guide) && /Let’s Practice/.test(guide) && /nothing to change/i.test(guide) && (await page.getAttribute('[data-kit-next]', 'href')) === '/app/club/january?welcome=1' && /Next: January Resource/i.test(await page.innerText('[data-kit-next]')), guide.replace(/\s+/g, ' ').slice(0, 200));
  check('Family Meeting guide: the step bar, print done, guide current', (await page.evaluate(() => [...document.querySelectorAll('[data-kit-bar] li')].map((l) => `${l.dataset.step}:${l.dataset.state}`).join(','))) === 'print:done,guide:current,first:todo' && await page.isVisible(vp.width < 861 ? '[data-kit-bar] .wkbar-phone:has-text("2 of 3")' : '[data-kit-bar] [data-step="guide"] a'), (await page.evaluate(() => [...document.querySelectorAll('[data-kit-bar] li')].map((l) => `${l.dataset.step}:${l.dataset.state}`).join(','))));
  check('Family Meeting guide: no approval button', (await page.locator('button:has-text("Approve"), button:has-text("Next: your")').count()) === 0);
  check('no sideways scrolling (guide)', await noSideScroll(page));
  await shot(page, `${label}-4b-meeting-guide`, true);
  const guidePages = await printPdf(page, `${label}-meeting-guide`);
  const guideText = execFileSync('pdftotext', [`${SHOTS ?? '/tmp'}/${label}-meeting-guide.pdf`, '-']).toString();
  check('Family Meeting guide prints on one Letter page, the sheet only', guidePages === 1 && /Our Family Meeting/.test(guideText) && !/Back to my|Club Home|Sign out|Finish later/.test(guideText), `${guidePages} pages`);
  check('guide opened: noted on her account (never required)', sql(`select meeting_guide_seen_at is not null from public.club_households where owner_user_id = '${USER.id}'`) === 't');
  // Her January resource, in Welcome Kit mode: the printable first, the step bar, one approval.
  await page.click('[data-kit-next]');
  await page.waitForURL(/\/app\/club\/january\?welcome=1/);
  await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready');
  await page.waitForSelector('[data-welcome-kit-confirm]');
  await page.waitForTimeout(600);
  await page.waitForSelector('[data-kit-bar]');
  const crumb = await page.locator('[data-welcome-kit-confirm]').innerText();
  check('January: the step bar, not a banner: piece 3 current, the other two done', /January Resource/.test(crumb) && (await page.evaluate(() => [...document.querySelectorAll('[data-kit-bar] li')].map((l) => `${l.dataset.step}:${l.dataset.state}`).join(','))) === 'print:done,guide:done,first:current' && await page.isVisible(vp.width < 861 ? '[data-kit-bar] .wkbar-phone:has-text("3 of 3")' : '[data-kit-bar] [data-step="first"] a'), (await page.evaluate(() => [...document.querySelectorAll('[data-kit-bar] li')].map((l) => `${l.dataset.step}:${l.dataset.state}`).join(','))));
  if (vp.width >= 1100) check('January: what to do, in the rail', /Review your family’s plan\. Make any changes, then approve it for printing\./.test(await page.innerText('[data-cpd-approval]')));
  const crumbBox = await page.locator('[data-welcome-kit-confirm]').boundingBox();
  check('January: the Welcome Kit line is small', crumbBox.height < (vp.width < 850 ? 110 : 60), JSON.stringify(crumbBox));
  check('January: the tool is prepared with her kids’ names', /Sofia|Mateo/.test(await page.locator('.club-plan').innerText()));
  check('January: one header (the Club’s), journey current', await page.isVisible('[data-club-onboarding] [aria-current="step"]:has-text("Make it yours")') && !(await page.isVisible('body > header[data-chrome]')));
  check('January: no Family Meeting or wall calendar tabs in Welcome Kit mode', !(await page.isVisible('.fm-switch')) && !(await page.isVisible('.osr-tabs')));
  if (vp.width >= 1100) {
    const layout = await page.evaluate(() => {
      const sheet = document.querySelector('.club-plan [data-plan-sheet="front"]').getBoundingClientRect();
      const doc = document.querySelector('.club-plan [data-plan-proof-scroll]').getBoundingClientRect();
      const rail = document.querySelector('.cpd').getBoundingClientRect();
      return { sheetTop: Math.round(sheet.top), sheetW: Math.round(sheet.width), docW: Math.round(doc.width), railW: Math.round(rail.width), vw: innerWidth, vh: innerHeight, scroll: document.documentElement.scrollHeight };
    });
    check('desktop editor: the printable is visible at once, near the top', layout.sheetTop < 200, JSON.stringify(layout));
    check('desktop editor: about 70% for the printable, 30% for the controls', layout.docW / layout.vw > 0.62 && layout.railW / layout.vw <= 0.31, JSON.stringify(layout));
    check('desktop editor: the page itself doesn’t scroll (the document does)', layout.scroll <= layout.vh + 1, JSON.stringify(layout));
    check('desktop editor: “Approve for printing” in the rail', (await page.innerText('[data-cpd-approve]')).toLowerCase() === 'approve for printing');
    check('desktop editor: a small print deadline', /Print deadline/.test(await page.innerText('[data-cpd-status]')) && !(await page.isVisible('[data-cpd-countdown]')), await page.innerText('[data-cpd-status]'));
  } else {
    const m = await page.evaluate(() => {
      // January on a phone is its own reference view (the focus first), not a scaled printable.
      const hero = (document.querySelector('.mgm-focus') ?? document.querySelector('.cp-thumb--hero')).getBoundingClientRect();
      const bar = document.querySelector('[data-cp-bar]').getBoundingClientRect();
      const nav = document.querySelector('nav[data-chrome]')?.getBoundingClientRect();
      return { heroW: Math.round(hero.width), heroH: Math.round(hero.height), heroTop: Math.round(hero.top), vw: innerWidth, barBottom: Math.round(bar.bottom), navTop: nav ? Math.round(nav.top) : null, primary: document.querySelector('[data-plan-primary]').textContent };
    });
    check('mobile: the family focus at the screen’s width, near the top (no scaled PDF)', m.heroW >= m.vw - 48 && m.heroTop < 520 && !(await page.isVisible('.cp-thumb--hero')), JSON.stringify(m));
    check('mobile editor: “Approve for printing” in the action bar, above the tab bar', /approve for printing/i.test(m.primary) && (m.navTop == null || m.barBottom <= m.navTop + 1), JSON.stringify(m));
  }
  check('no sideways scrolling (first resource)', await noSideScroll(page));
  await shot(page, `${label}-5-first-resource`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready');
  await page.waitForTimeout(1500);
  check('refresh on the tool: nothing confirmed for her', order('monthly_resource').endsWith('needs_confirmation') && !firstConfirmed(), kitOrders());
  // Her change on the real tool is what the owner prints.
  const MARK = 'Rivera print check';
  if (label === 'desktop') {
    await editPlan(page, 'january', MARK);
    await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planSave === 'saved', null, { timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
  const approveSel = vp.width >= 1100 ? '[data-cpd-approve]' : '[data-plan-primary]';
  await page.click(approveSel);
  await page.waitForURL(/\/club\/welcome-kit/);
  await page.waitForSelector('[data-kit-item="first"][data-status="approved"]');
  check('approved for printing → back to her Welcome Kit, January approved', await statuses() === 'print:approved,guide:ready,first:approved', await statuses());
  check('back on the kit: “✓ January Resource approved for printing. Everything’s ready”, 3 of 3', /January Resource approved for printing\. Everything’s ready/.test(await page.innerText('[data-kit-flash]')) && /3 of 3 ready/.test(await page.innerText('[data-kit-count]')) && await page.isVisible('[data-kit-item="first"][data-just-done]'));
  check('her review alone submits nothing', order('monthly_resource').endsWith('needs_confirmation') && !firstConfirmed(), kitOrders());
  check('header: “Confirm your Welcome Kit” current', await page.isVisible('[data-club-onboarding] [aria-current="step"]:has-text("Confirm your Welcome Kit")'));
  check('“Prepare My Welcome Kit” is ready', await page.isEnabled('[data-kit-prepare]'));
  if (label === 'desktop') {
    // Going back and changing the plan asks her to look again; nothing she did is lost.
    await page.goto(`${BASE}/app/club/january?welcome=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready');
    await page.waitForTimeout(900);
    check('back on January: her earlier change is still there', !(await page.locator('[data-meeting-guide] [data-plan-sheet]').allInnerTexts()).join(' ').includes(removed[MARK]), removed[MARK]);
    await editPlan(page, 'january', `${MARK} 2`);
    await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planSave === 'saved', null, { timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    await page.goto(`${BASE}/club/welcome-kit`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-kit-item="first"]');
    check('a change after approving: January needs review again, the print stays approved', await statuses() === 'print:approved,guide:ready,first:needs_review' && await page.isDisabled('[data-kit-prepare]'), await statuses());
    await page.click('[data-kit-item="first"] .wk-item-action');
    await page.waitForURL(/\/app\/club\/january\?welcome=1/);
    await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready');
    await page.waitForSelector('[data-welcome-kit-confirm]');
    await page.waitForTimeout(800);
    await page.click(approveSel);
    await page.waitForURL(/\/club\/welcome-kit/);
    await page.waitForSelector('[data-kit-item="first"][data-status="approved"]');
  }
  await shot(page, `${label}-5b-ready`, true);
  // One click, twice: one package.
  await page.locator('[data-kit-prepare]').dblclick();
  await page.waitForSelector('h1:has-text("Your Welcome Kit is getting ready!")');
  const submitted = await page.locator('[data-kit-submitted]').innerText();
  check('submitted: getting ready, three pieces, two business days, what’s next', /Family Vision Print/.test(submitted) && /Family Meeting Guide/.test(submitted) && /January Resource/.test(submitted) && /two business days/.test(submitted) && /Here’s what’s coming next/.test(submitted), submitted.replace(/\s+/g, ' ').slice(0, 300));
  check('submitted: the owner is notified (club-billing kit_submitted)', page.calls.includes('billing:kit_submitted'), page.calls.filter((c) => c.startsWith('billing')).join(','));
  check('submitted: header back to the normal Club nav', await page.isVisible('[data-club-nav] nav[aria-label="Club"]') || vp.width < 768);
  if (label === 'desktop') {
    const pv = await newPage(browser, DESKTOP, { auth: false });
    await asAdmin(pv);
    await pv.goto(`${BASE}/app/club/january?fulfillment=${orderId('monthly_resource')}`, { waitUntil: 'networkidle' });
    await pv.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready');
    await pv.waitForTimeout(800);
    const printed = (await pv.locator('[data-meeting-guide] [data-plan-sheet]').allInnerTexts()).join(' ');
    check('the owner’s print view shows her saved change (what prints is what she approved)', !printed.includes(removed[MARK]) && !printed.includes(removed[`${MARK} 2`]) && /Our Family Focus/i.test(printed), `${removed[MARK]} / ${removed[`${MARK} 2`]}`);
    await pv.context().close();
  }
  check('confirmed: both items prepared together (kit needs only its PDFs)', order('welcome_vision') === 'pending:needs_pdf' && order('monthly_resource') === 'pending:needs_pdf', kitOrders());
  await shot(page, `${label}-6-all-set`, true);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Your Welcome Kit is getting ready!")');
  check('refresh after submitting: still submitted, never a second order', sql(`select count(*) from public.club_fulfillment_orders where user_id = '${USER.id}'`) === '2');
  await page.goto(`${BASE}/app/club/january?welcome=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready');
  await page.waitForTimeout(2000);
  check('revisiting her tool doesn’t undo her confirmation, and the Welcome Kit line is gone', firstConfirmed() && !(await page.isVisible('[data-welcome-kit-confirm]')), kitOrders());
  await page.goto(`${BASE}/club/resources/${JAN}?welcome=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=It’s all set!');
  await page.click('a:has-text("Go to Club Home")');
  await page.waitForURL(/\/app\/club/);
  await page.waitForSelector('[data-club-home]');
  const club = await page.locator('main').innerText();
  check('Club Home now: getting ready, the tracker at Printing, the package, no setup checklist', !/preview library, not an active membership/i.test(club) && /Your Welcome Kit is getting ready!/.test(club)
    && await page.isVisible('.ofc-tracker [aria-current="step"]:has-text("Printing")') && await page.isVisible('.ofc-package') && !/Your next step/i.test(club), club.replace(/\s+/g, ' ').slice(0, 300));
  check('Club Home this week: hold your first family meeting, with the meeting and the guide', /Hold your first family meeting\./.test(club)
    && await page.isVisible('[data-home-week] a[href="/app/club/january"]') && await page.isVisible('[data-home-week] a[href="/club/family-meeting-guide"]'));
  check('Club Home: her January once, Our Family Focus, made for her family', await page.isVisible('[data-home-current] a.ofc-member-cta[href="/app/club/january"]') && /Our Family Focus/.test(await page.locator('[data-home-current]').innerText()) && /Made for Ana, Sofia and Mateo/.test(club));
  check('Club Home: her family name, members with ages and an edit link', /The Rivera Family/.test(club) && /Sofia · 8/.test(club) && /Mateo · 6/.test(club) && await page.isVisible('a[href="/club/family"]:has-text("Edit my family")'), club.replace(/\s+/g, ' ').slice(0, 200));
  const strip = await page.locator('[data-home-year]').innerText();
  check('Club Home: her year in one strip, January hers, February opens Feb 1', await page.isVisible('[data-home-year] li[data-month="january"][data-held] a[href="/app/club/january"]') && /Opens Feb 1/.test(await page.locator('[data-home-year] li[data-month="february"]').innerText()) && (await page.locator('[data-home-year] li').count()) === 12, strip.replace(/\s+/g, ' ').slice(0, 300));
  check('Club Home: no twelve-card catalog, a link to every month', (await page.locator('article.ofc-app-month').count()) === 0 && await page.isVisible('[data-home-year] a[href="/app/club/months"]'));
  check('Club Home: one header, the Club nav', JSON.stringify(await clubNavLinks(page)) === JSON.stringify(CLUB_NAV) && !(await page.isVisible('body > header[data-chrome]')), JSON.stringify(await clubNavLinks(page)));
  check('Club Home: the real package (three printables)', await page.waitForFunction(() => document.querySelectorAll('.ofc-package .kit-preview[data-state="ready"]').length === 3, null, { timeout: 30000 }).then(() => true, () => false));
  check('no sideways scrolling (her Club)', await noSideScroll(page));
  await shot(page, `${label}-7-club`, true);
  // Monthly Resources: every month's card, hers marked.
  await page.goto(`${BASE}/app/club/months`, { waitUntil: 'networkidle' });
  await page.waitForSelector('article.ofc-app-month >> text=Yours');
  const all = await page.locator('main').innerText();
  const jan = page.locator('article.ofc-app-month', { hasText: 'January' });
  check('Monthly Resources: January marked hers, opening her family’s plan in the app', /January 2027 · Yours · Free/i.test(await jan.innerText()) && (await jan.locator('a:not(.ofc-app-month-meeting)').getAttribute('href')) === '/app/club/january');
  check('Monthly Resources: January’s card is the weekly family meeting', /Stop Being the Family's Calendar/.test(await jan.innerText()));
  check('Monthly Resources: every month links its Family Meeting', (await page.locator('a.ofc-app-month-meeting').count()) === 12 && (await jan.locator('a.ofc-app-month-meeting').getAttribute('href')) === '/app/club/january');
  check('Monthly Resources: February shows when her next payment opens it', /Next · February 2027/i.test(all) && /Opens with your February 1, 2027 payment/.test(all));
  check('Monthly Resources: other months stay previews', (await page.locator('article.ofc-app-month', { hasText: 'March' }).locator('a:not(.ofc-app-month-meeting)').innerText()).startsWith('Preview the tool'));
  check('Monthly Resources: the Club nav with it current', JSON.stringify(await clubNavLinks(page)) === JSON.stringify(CLUB_NAV) && await page.isVisible('[data-club-nav] a[aria-current="page"][aria-label="Monthly Resources"]'));
  check('no sideways scrolling (Monthly Resources)', await noSideScroll(page));
  await shot(page, `${label}-7d-months`, true);
  await page.goto(`${BASE}/app/club`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-club-home]');
  // Mailed (the owner marks it): "on its way", with the mailed date and where to start, never a delivery promise.
  sql(`update public.club_fulfillment_orders set status = 'mailed', mailed_at = now(), printed_at = now() where user_id = '${USER.id}'`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-home-state="kit_mailed"]');
  const mailed = await page.locator('[data-home-state="kit_mailed"]').innerText();
  check('Club Home after mailing: on its way, where to start, no delivery estimate', /Your Welcome Kit is on its way\./.test(mailed) && /We mailed it on/.test(mailed) && /Family Meeting Guide/.test(mailed) && !/arrive(s)? (by|on)|deliver/i.test(mailed), mailed.replace(/\s+/g, ' '));
  await shot(page, `${label}-7b-mailed`, true);
  sql(`update public.club_fulfillment_orders set status = 'pending', mailed_at = null, printed_at = null where user_id = '${USER.id}'`);
  await page.goto(`${BASE}/app/club`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-club-home]');
  if (vp.width < 768) {
    check('phone header: one row, the Club links folded into a small menu', !(await page.isVisible('[data-club-nav] nav[aria-label="Club"] a')) && (await page.locator('[data-club-nav]').boundingBox()).height < 64);
    check('phone header: the menu has every Club link', JSON.stringify(await clubNavLinks(page)) === JSON.stringify(CLUB_NAV), JSON.stringify(await clubNavLinks(page)));
    await shot(page, `${label}-7c-menu`);
  }
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
  await page.waitForSelector('h1:has-text("Tell us about your family")');
  check('journey: three phases in the header, “Tell us about your family” current', (await page.locator('[data-club-onboarding] [aria-label="Your Welcome Kit"] li').count()) === 3 && await page.isVisible('[aria-label="Your Welcome Kit"] [aria-current="step"]:has-text("family")'));
  await page.fill('input[autocomplete="family-name"]', 'The Rivera Family');
  await page.fill('input[autocomplete="given-name"]', 'Ana');
  const kidRow = page.locator('li', { has: page.locator('select') });
  await kidRow.nth(0).locator('input').fill('Sofia');
  await kidRow.nth(0).locator('select').first().selectOption('8');
  await page.click('button:has-text("Next")');
  await page.waitForSelector('text=What does a typical week look like?', { timeout: 10000 }).catch(() => undefined);
  check('family form leads straight into step 2 of 6 (no Welcome Kit needed)', await page.isVisible('text=Step 2 of 6'), page.url());
  check('not sent to the library midway', /\/club\/welcome/.test(page.url()), page.url());
  check('her family is saved, with her illustration style (20261113)', sql(`select preferences ->> 'icon_style' from public.club_households where owner_user_id = '${USER.id}'`) === 'hand-drawn');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=What does a typical week look like?', { timeout: 10000 }).catch(() => undefined);
  check('refresh after the family form: still her profile questions, family not asked again', await page.isVisible('text=Step 2 of 6') && !(await page.isVisible('h1:has-text("Tell us about your family")')));
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
  check('address required: asked next, still phase 1 of the journey', await page.isVisible('[aria-label="Your Welcome Kit"] [aria-current="step"]:has-text("family")'));
  await page.fill('input[autocomplete="name"]', 'Ana Rivera').catch(() => undefined);
  await page.fill('input[autocomplete="address-line1"]', '14 Oak St');
  await page.fill('input[autocomplete="address-level2"]', 'Austin');
  await page.locator('select[autocomplete="address-level1"], input[autocomplete="address-level1"]').first().evaluate((el) => el.tagName).then(async (tag) => {
    if (tag === 'SELECT') await page.selectOption('select[autocomplete="address-level1"]', 'TX');
    else await page.fill('input[autocomplete="address-level1"]', 'TX');
  });
  await page.fill('input[autocomplete="postal-code"]', '78701');
  await page.click('button:has-text("Next: my Welcome Kit")');
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
  check('Club Home: when her Club starts, January with its payment', /Your Club starts with January/.test(home) && /January 1, 2027/.test(home), home.replace(/\s+/g, ' ').slice(0, 400));
  check('Club Home: Club nav, Club Home current', JSON.stringify(await clubNavLinks(page)) === JSON.stringify(CLUB_NAV) && await page.isVisible('[data-club-nav] a[aria-current="page"][aria-label="Club Home"]'), JSON.stringify(await clubNavLinks(page)));
  check('Club Home: her year strip, nothing hers yet', (await page.locator('[data-home-year] li').count()) === 12 && (await page.locator('[data-home-year] li[data-held]').count()) === 0);
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
  check('sign in on another device: resumes at the first open question (step 3), family not re-entered', await other.isVisible('text=Step 3 of 6') && !(await other.isVisible('h1:has-text("Tell us about your family")')), other.url());
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
  if (await other.isVisible('[data-club-nav] .club-header-menu')) await other.click('[data-club-nav] .club-header-menu');
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

// The live database before 20261113 refuses the illustration style key: the family form must still save (without it).
scenarios.familyBeforeMigration = async (browser) => {
  console.log('\nFamily form on a database without 20261113: still saves');
  freshDb();
  sql(`do $do$ declare d text := pg_get_functiondef('public.club_household_save'::regproc); begin
    execute replace(replace(d, ', ''icon_style''', ''), ', ''colors''', ''); end $do$`);
  check('setup: this database refuses icon_style', (() => { try { asUser(USER.id, `select public.club_household_save('X', '{"icon_style":"hand-drawn"}', '[{"first_name":"A","kind":"adult","role":"parent","is_account_holder":true}]')`); return false; } catch { return true; } })());
  const page = await newPage(browser, MOBILE);
  await page.goto(`${BASE}/club/welcome`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Tell us about your family")');
  await page.fill('input[autocomplete="given-name"]', 'Ana');
  const kid = page.locator('li', { has: page.locator('select') }).nth(0);
  await kid.locator('input').fill('Sofia');
  await kid.locator('select').first().selectOption('8');
  await page.click('button:has-text("Next")');
  await page.waitForSelector('text=What does a typical week look like?', { timeout: 10000 }).catch(() => undefined);
  check('the family saves and setup moves on (no "couldn’t save")', await page.isVisible('text=Step 2 of 6') && !(await page.isVisible('text=We couldn’t save just now')),
    (await page.locator('[role=alert]').allInnerTexts()).join(' | '));
  check('saved without the optional style key', sql(`select preferences ? 'icon_style' from public.club_households where owner_user_id = '${USER.id}'`) === 'f'
    && /Sofia/.test(sql(`select string_agg(first_name, ',') from public.club_family_members m join public.club_households h on h.id = m.household_id where h.owner_user_id = '${USER.id}'`)));
  check('no script errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
};

// Family colors (migration 20261120): her choices survive save, reload, January, approval and the owner's print view;
// on a database without the migration they are never dropped quietly.
const COLOR_FAMILY = `'[{"first_name":"Ada","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Chidi","kind":"adult","role":"partner"},
  {"first_name":"Zara","kind":"child","role":"child","birth_year":2014,"birth_month":5},{"first_name":"Emeka","kind":"child","role":"child","birth_year":2018,"birth_month":9},
  {"first_name":"Nia","kind":"child","role":"child","birth_year":2022,"birth_month":2}]'`;
const RGB = { blue: 'rgb(43, 108, 176)', purple: 'rgb(107, 70, 193)', teal: 'rgb(24, 128, 139)' };
const legend = (page) => page.locator('[data-meeting-guide] [data-mg-pages] .mg-legend .mg-chip').evaluateAll((cs) =>
  Object.fromEntries(cs.map((c) => [c.textContent.trim(), getComputedStyle(c.querySelector('.mg-dot')).backgroundColor])));
const pickColors = async (page) => {
  await page.goto(`${BASE}/club/family`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-family-colors] select', { timeout: 15000 });
  const sel = (name) => page.locator('[data-family-colors] li', { hasText: name }).locator('select');
  const before = { Zara: await sel('Zara').inputValue(), Nia: await sel('Nia').inputValue() };
  await sel('Emeka').selectOption('teal');
  await sel('Nia').selectOption(before.Zara); // already Zara's: they swap
  const after = { Zara: await sel('Zara').inputValue(), Emeka: await sel('Emeka').inputValue(), Nia: await sel('Nia').inputValue() };
  await page.click('button:has-text("Save our family")');
  await page.waitForSelector('[role=status]:has-text("Saved"), [data-colors-not-saved]', { timeout: 10000 }).catch(() => undefined);
  return { before, after, sel };
};
scenarios.familyColors = async (browser) => {
  console.log('\nFamily colors with 20261120: save, reload, January, approval, print');
  freshDb();
  sql(readFileSync(new URL('../supabase/migrations/20261120000000_club_household_colors.sql', import.meta.url), 'utf8'));
  asUser(USER.id, `select public.club_household_save('The Okafor Family', '{"icon_style":"hand-drawn"}', ${COLOR_FAMILY}) \\g /dev/null`);
  as.vision('The Okafor Family', 'Joy');
  as.approvePrint();
  const page = await newPage(browser, DESKTOP);
  const { before, after, sel } = await pickColors(page);
  check('picking a color someone has swaps them, nobody is quietly reassigned', before.Zara === 'blue' && after.Nia === 'blue' && after.Zara === before.Nia && after.Emeka === 'teal', JSON.stringify({ before, after }));
  check('saved, with no colors warning', await page.isVisible('[role=status]:has-text("Saved")') && !(await page.isVisible('[data-colors-not-saved]')));
  const stored = JSON.parse(sql(`select preferences -> 'colors' from public.club_households where owner_user_id = '${USER.id}'`) || '{}');
  const idOf = (n) => sql(`select m.id from public.club_family_members m join public.club_households h on h.id = m.household_id where h.owner_user_id = '${USER.id}' and m.first_name = '${n}'`);
  check('every member’s color is kept by id (adding someone later can’t shift anyone)', Object.keys(stored).length === 5);
  check('stored by member id', stored[idOf('Emeka')] === 'teal' && stored[idOf('Nia')] === 'blue' && stored[idOf('Zara')] === after.Zara && sql(`select preferences ->> 'icon_style' from public.club_households where owner_user_id = '${USER.id}'`) === 'hand-drawn', JSON.stringify(stored));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-family-colors] select');
  check('after reload the family page shows her choices', await sel('Emeka').inputValue() === 'teal' && await sel('Nia').inputValue() === 'blue' && await sel('Zara').inputValue() === after.Zara);
  await page.goto(`${BASE}/app/club/january`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready' && document.querySelector('.mg-sheet'), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const mine = await legend(page);
  check('January shows her colors beside each name', mine.Emeka === RGB.teal && mine.Nia === RGB.blue && mine.Zara === RGB[after.Zara], JSON.stringify(mine));
  check('no script errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
  asUser(USER.id, `select public.club_fulfillment_approve('${JAN}') \\g /dev/null`);
  const mv = await newPage(browser, DESKTOP, { auth: false });
  await asAdmin(mv);
  await mv.goto(`${BASE}/app/club/january?fulfillment=${orderId('monthly_resource')}`, { waitUntil: 'networkidle' });
  await mv.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready' && document.querySelector('.mg-sheet'), null, { timeout: 15000 });
  await mv.waitForTimeout(800);
  const printed = await legend(mv);
  check('the owner’s print view after approval: the same colors', JSON.stringify(printed) === JSON.stringify(mine), JSON.stringify(printed));
  await mv.emulateMedia({ media: 'print' });
  check('and in print media', JSON.stringify(await legend(mv)) === JSON.stringify(mine));
  if (SHOTS) await mv.pdf({ path: `${SHOTS}/colors-print.pdf`, preferCSSPageSize: true, printBackground: true });
  await mv.context().close();

  console.log('\nFamily colors without 20261120: never lost quietly');
  freshDb();
  asUser(USER.id, `select public.club_household_save('The Okafor Family', '{"icon_style":"hand-drawn"}', ${COLOR_FAMILY}) \\g /dev/null`);
  const old = await newPage(browser, DESKTOP);
  await pickColors(old);
  check('she is told her colors weren’t saved (no plain "Saved.")', await old.isVisible('[data-colors-not-saved]') && !(await old.isVisible('[role=status]:has-text("Saved")')));
  check('the rest of her family still saved, no colors stored', sql(`select preferences ? 'colors' from public.club_households where owner_user_id = '${USER.id}'`) === 'f'
    && sql(`select preferences ->> 'icon_style' from public.club_households where owner_user_id = '${USER.id}'`) === 'hand-drawn');
  check('the picker shows what is actually in effect (standard colors)', await old.locator('[data-family-colors] li', { hasText: 'Emeka' }).locator('select').inputValue() !== 'teal');
  // A save where she didn't touch the colors: nothing of hers is lost, so just "Saved."
  await old.reload({ waitUntil: 'networkidle' });
  await old.waitForSelector('[data-family-colors] select');
  await old.click('button:has-text("Save our family")');
  await old.waitForSelector('[role=status]:has-text("Saved"), [data-colors-not-saved]', { timeout: 10000 }).catch(() => undefined);
  check('an ordinary save (colors untouched) just says Saved', await old.isVisible('[role=status]:has-text("Saved")') && !(await old.isVisible('[data-colors-not-saved]')));
  check('no script errors', old.errors.length === 0, old.errors.join(' | '));
  await old.context().close();
};

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
  check('profile done → her Welcome Kit', /\/club\/welcome-kit/.test(await signInTo(/\/club\/welcome-kit/)));
  as.vision('The Rivera Family', 'Hope');
  check('print saved but not approved → still her Welcome Kit', /\/club\/welcome-kit/.test(await signInTo(/\/club\/welcome-kit/)));
  as.approvePrint();
  check('print approved (guide never required) → her Welcome Kit', /\/club\/welcome-kit/.test(await signInTo(/\/club\/welcome-kit/)));
  sql(`update public.club_fulfillment_orders set member_approved_at = now() - interval '3 days 1 hour' where user_id = '${USER.id}' and fulfillment_type = 'welcome_vision'`);
  check('three days later: still her Welcome Kit (never confirmed for her)', /\/club\/welcome-kit/.test(await signInTo(/\/club\/welcome-kit/)) && !firstConfirmed());
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
  ['january', '2027-01-fresh-start-together', 'omc:club:january-family-meeting:v1'],
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
/** January: the idea taken off for each marker (its edit removes text instead of typing it). */
const removed = {};
async function editPlan(page, month, marker) {
  if (month === 'february') {
    await page.click('[data-cpd-edit]');
    await page.locator('dialog[open] input[type="checkbox"]').first().click();
    await page.keyboard.press('Escape');
    return 'unticked a step in its editor';
  }
  if (month === 'march') {
    await page.click('[data-cpd-edit]');
    await page.locator('dialog[open] [role="tab"]', { hasText: 'Our moments' }).click();
    const input = page.locator('dialog[open] input[type="text"], dialog[open] input:not([type])').first();
    await input.fill(marker);
    await input.press('Tab');
    await page.keyboard.press('Escape');
    return 'renamed a moment in its editor';
  }
  if (month === 'december') {
    await page.click('[data-cpd-edit]');
    await page.locator('dialog[open] button[aria-pressed="false"]').first().click();
    await page.keyboard.press('Escape');
    return 'picked another grown-up helper';
  }
  if (month === 'january') {
    // Her review: skip a suggestion (its title is what the checks look for, now absent).
    await page.click('[data-cpd-edit]');
    const box = page.locator('dialog[open] .mg-ed-exp:not(.is-skipped)').last();
    removed[marker] = (await box.locator('.mg-ed-name').innerText()).split(' · ').slice(1).join(' · ').trim();
    await box.getByRole('button', { name: 'Skip it' }).click();
    await page.keyboard.press('Escape');
    return 'skipped a suggestion in her review';
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
  // Her Welcome Kit already submitted (print and January approved), so January is her ordinary month here: the
  // Family Meeting switch shows (it's hidden on her first month only while the kit waits on her).
  as.vision('The Rivera Family', 'Hope');
  as.approvePrint();
  asUser(USER.id, `select public.club_fulfillment_approve('${JAN}') \\g /dev/null`);
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

    // The Family Meeting beside it reads her family and writes nothing (January's tool is the meeting guide itself).
    if (month === 'january') check('january: no separate meeting switch, the guide is the tool', !(await page.isVisible('[data-fm-view]')) && /Our Focus/.test(await page.locator('.club-plan [data-plan-sheet]').first().innerText()));
    else {
    await page.locator('[data-fm-view="meeting"]').first().click();
    await page.waitForTimeout(600);
    check(`${month}: Family Meeting shows her family`, /Sofia|Mateo/.test(await page.locator('[data-meeting-sheet]').first().innerText().catch(() => '')));
    await page.locator('[data-fm-view="tool"]').first().click();
    await page.waitForTimeout(600);
    check(`${month}: back to the tool, her change still there`, (await tabValue(page, key)) === value);
    check(`${month}: the meeting changed nothing saved`, sql(`select revision from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '${slug}'`) === revision && savedEntry(slug, key) === value);
    }

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
  if (await out.isVisible('[data-club-nav] .club-header-menu')) await out.click('[data-club-nav] .club-header-menu');
  await out.click('[data-club-nav] button:has-text("Sign out")');
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
  // Monthly Resources (/app/club/months since the Nov 2 Club Home): every month card.
  await back.goto(`${BASE}/app/club/months`, { waitUntil: 'networkidle' });
  await back.waitForSelector('text=Open your June plan', { timeout: 10000 }).catch(() => undefined);
  const links = await back.evaluate(() => Object.fromEntries([...document.querySelectorAll('a')].filter((a) => /^Open your/.test(a.textContent ?? '')).map((a) => [a.textContent.replace(/\s*→\s*$/, ''), a.getAttribute('href')])));
  check('Monthly Resources: “Open your June plan” → /app/club/june', links['Open your June plan'] === '/app/club/june', JSON.stringify(links));
  check('Monthly Resources: every month she holds opens its tool', Object.entries(links).every(([t, h]) => (/November/.test(t) ? h === `/club/resources/${NOV}` : /^\/app\/club\/[a-z]+$/.test(h))) && Object.keys(links).length === 12, `${Object.keys(links).length} links`);
  await back.context().close();
};

// The Welcome Family Rhythm (/app/club/family-rhythm; docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md → Phase 2b): every
// member's, whatever month she holds; her edits and her approval on her account (club_welcome_plans), the same on
// another device and her phone; no deadline, no reminders; March's saved plan never touched.
const WELCOME_KEY = 'omc:club:welcome-family-rhythm:v1';
const welcomeRow = (col) => sql(`select w.${col} from public.club_welcome_plans w join public.club_households h on h.id = w.household_id where h.owner_user_id = '${USER.id}'`) || null;
async function openWelcome(page) {
  await page.goto(`${BASE}/app/club/family-rhythm`, { waitUntil: 'networkidle' });
  const ready = await page.waitForFunction(() => document.querySelector('.club-plan')?.dataset.planState === 'ready', null, { timeout: 15000 }).then(() => true, () => false);
  await page.waitForTimeout(900);
  return ready;
}
scenarios.welcomeRhythm = async (browser) => {
  console.log('The Welcome Family Rhythm: hers whatever month, saved and approved on her account, every device');
  freshDb();
  as.family();
  const page = await newPage(browser, DESKTOP);
  const ready = await openWelcome(page);
  check('welcome rhythm: opens for a member with no month open yet', ready, ready ? '' : (await page.locator('main').innerText().catch(() => '')).slice(0, 160));
  if (!ready) { await page.context().close(); return; }
  const text = await page.locator('.club-plan').innerText();
  check('welcome rhythm: prepared with her family', /Sofia|Mateo|Rivera/i.test(text));
  check('welcome rhythm: no deadline, hers to keep', /Yours to keep/.test(text) && !/Print deadline/.test(text));
  check('welcome rhythm: says it saves to her account', /Changes save to your account/.test(text));
  check('welcome rhythm: no monthly meeting switch, no March tabs', !(await page.isVisible('[data-fm-view]')) && !(await page.isVisible('.mar-tabs')));
  check('welcome rhythm: opening saves nothing', welcomeRow('revision') === null);
  check('welcome rhythm: desktop, no sideways scrolling', await noSideScroll(page));

  const marker = `Qwel${Date.now() % 1000}`;
  await page.click('[data-cpd-edit]');
  await page.locator('dialog[open] [role="tab"]', { hasText: 'Our moments' }).click();
  const input = page.locator('dialog[open] input[type="text"], dialog[open] input:not([type])').first();
  await input.fill(marker);
  await input.press('Tab');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  const value = await tabValue(page, WELCOME_KEY);
  const saved = sql(`select w.state -> ${lit(WELCOME_KEY)} ->> 'v' from public.club_welcome_plans w join public.club_households h on h.id = w.household_id where h.owner_user_id = '${USER.id}'`) || null;
  check('welcome rhythm: an edit saves to her account', Boolean(value) && saved === value, `${String(saved).slice(0, 60)} vs ${String(value).slice(0, 60)}`);
  const st = JSON.parse(value ?? '{}'); // the tab's { current, state }
  check('welcome rhythm: saved as a Welcome plan with its month', st.state?.context === 'welcome' && /^\d{4}-\d{2}$/.test(st.state?.month ?? ''), JSON.stringify(st.state ?? {}).slice(0, 80));

  await page.click('[data-cpd-approve]');
  await page.waitForTimeout(1500);
  const fp = await page.evaluate(() => document.querySelector('[data-mfr]').clubPlan.fingerprint());
  check('welcome rhythm: approval saved on her account, against what prints', Boolean(welcomeRow('approved_at')) && welcomeRow('approved_fingerprint') === fp);
  check('welcome rhythm: approving creates no order', sql(`select count(*) from public.club_fulfillment_orders where user_id = '${USER.id}' and fulfillment_type not in ('monthly_resource', 'welcome_vision')`) === '0');
  const pages = await printPdf(page, 'welcome-rhythm');
  check('welcome rhythm: prints one Letter page', pages === 1, `${pages} pages`);
  check('welcome rhythm: no script errors', page.errors.length === 0, page.errors.slice(0, 2).join(' | '));
  const revision = welcomeRow('revision');
  await page.context().close();

  // Another device: her plan and her approval.
  const again = await newPage(browser, DESKTOP);
  await openWelcome(again);
  check('welcome rhythm: same plan in a new browser', (await tabValue(again, WELCOME_KEY)) === value);
  check('welcome rhythm: her words on the sheet', Boolean(await again.evaluate((m) => document.querySelector('.club-plan').innerText.includes(m), marker)));
  check('welcome rhythm: approved on the other device too', /approved/i.test(await again.locator('[data-cpd-approve]').innerText()));
  check('welcome rhythm: reopening doesn’t save again', welcomeRow('revision') === revision && Boolean(welcomeRow('approved_at')));
  await again.context().close();

  // Her phone: the same, approved; a change there clears the approval (she approves again only if she wants).
  const phone = await newPage(browser, MOBILE);
  check('welcome rhythm: phone opens with her family', (await openWelcome(phone)) && /Sofia|Mateo|Rivera/i.test(await phone.locator('.club-plan').innerText()));
  check('welcome rhythm: phone shows it approved', /approved/i.test(await phone.locator('[data-plan-primary]').innerText()));
  check('welcome rhythm: phone, no sideways scrolling', await noSideScroll(phone));
  await phone.locator('[data-mrm-edit] button').first().click();
  const pin = phone.locator('dialog[open] input[type="text"]:visible, dialog[open] input:not([type]):visible').first();
  await pin.fill(`${marker}b`);
  await pin.press('Tab');
  await phone.evaluate(() => document.querySelector('dialog[open]')?.close());
  await phone.waitForTimeout(2500);
  check('welcome rhythm: a later change saves and clears the approval', Number(welcomeRow('revision')) > Number(revision) && welcomeRow('approved_at') === null);
  check('welcome rhythm: and the phone offers approval again', /approve (this plan|changes)/i.test(await phone.locator('[data-plan-primary]').innerText()));
  await shot(phone, 'welcome-rhythm-phone');
  await phone.context().close();

  // March's saved plan is its own: nothing written there, and Club Home links to her Family Rhythm.
  check('welcome rhythm: March’s saved plan untouched', sql(`select count(*) from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '2027-03-spring-clean-together'`) === '0');
  const home = await newPage(browser, DESKTOP);
  await home.goto(`${BASE}/app/club`, { waitUntil: 'networkidle' });
  await home.waitForTimeout(1200);
  check('Club Home links to her Family Rhythm', await home.locator('a[href="/app/club/family-rhythm"]').count() > 0);
  await home.context().close();
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
