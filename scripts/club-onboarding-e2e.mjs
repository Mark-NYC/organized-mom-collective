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

// ------------------------------------------------------------------ the fake backend

const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com' };
const JAN = '2027-01-fresh-start-together';

/** A new founding member right after checkout: free January, no family yet, the address from Stripe Checkout. */
export function newMember(over = {}) {
  return {
    household: null,
    address: { name: 'Ana Rivera', line1: '14 Oak St', line2: '', city: 'Austin', state: 'TX', postal_code: '78701', paused: false },
    welcome: { status: 'pending', personalization: null, member_approved_at: null, mailed_at: null, printed_at: null, pdf: 'not_ready' },
    months: [{ month: '2027-01-01', slug: JAN, title: 'A Fresh Start, Together', published: true, free: true, mailing: { status: 'pending', readiness: 'needs_profile', late: false, batch: 'regular', approved: false, mailed_at: null } }],
    member: true,
    calls: [],
    fail: {},
    ...over,
  };
}

const visionValid = (p) => p && typeof p.family_name === 'string' && p.family_name.trim().length >= 1 && p.family_name.trim().length <= 45 && VALUES.includes(p.value);

function welcomeView(st) {
  const w = st.welcome;
  if (!w) return null;
  const readiness = !['pending', 'approved', 'on_hold'].includes(w.status) ? w.status
    : !visionValid(w.personalization) || !w.member_approved_at ? 'needs_vision'
    : !st.address ? 'needs_address' : st.address.paused ? 'mail_paused' : w.pdf !== 'ready' ? 'needs_pdf' : 'ready';
  return { status: w.status, readiness, personalization: w.personalization, approved: Boolean(w.member_approved_at), satisfies_month: null,
    printed_at: w.printed_at, mailed_at: w.mailed_at, editable: ['pending', 'on_hold'].includes(w.status), display_name: st.household?.display_name ?? null };
}

function clubMe(st) {
  const onboarded = Boolean(st.household);
  const w = welcomeView(st);
  return {
    access: st.member, grant: null, member: st.member, plan: 'monthly', status: st.member ? 'trialing' : null, payment_problem: false,
    renews: st.member ? '2027-02-01T05:00:00+00:00' : null, ends: null, ended_at: null, revoked: false, onboarded,
    has_address: Boolean(st.address), enrolled_at: st.member ? '2026-10-30T12:00:00+00:00' : null, first_paid_month: '2027-01-01',
    current_month: '2026-10-01', membership_year: 1,
    welcome: w && { status: w.status, readiness: w.readiness, approved: w.approved, personalized: visionValid(w.personalization), satisfies_month: null, mailed_at: w.mailed_at },
    next: st.member ? { month: '2027-02-01', payment_on: '2027-02-01T05:00:00+00:00', slug: '2027-02-better-together', title: 'Better Together', regular_cutoff_at: null } : null,
    intro: st.member ? { month: '2027-01-01', trial_ends: '2027-02-01T05:00:00+00:00' } : null,
    kits: st.months.filter((m) => m.published).map((m) => ({ slug: m.slug, title: m.title, month: m.month, can: 'edit' })),
    months: st.member ? st.months.map((m) => ({ month: m.month, fulfilled_by: 'monthly_resource', free: m.free, slug: m.slug, title: m.title, published: m.published,
      can: m.published ? 'edit' : 'none', state: m.published ? 'available' : 'preparing', membership_year: 1, plan: 'monthly',
      mailing: { ...m.mailing, readiness: onboarded ? (st.address ? 'needs_pdf' : 'needs_address') : 'needs_profile' } })) : [],
  };
}

class RpcError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function rpc(st, name, body) {
  switch (name) {
    case 'club_me':
      return clubMe(st);
    case 'club_household':
      return st.household;
    case 'club_household_save': {
      const prev = st.household;
      st.household = {
        id: 'hh-1', display_name: body.p_display_name ?? null, preferences: body.p_preferences ?? {}, profile_version: (prev?.profile_version ?? 0) + 1,
        members: body.p_members.map((m, i) => ({ id: m.id ?? `m-${i + 1}`, first_name: m.first_name, kind: m.kind, role: m.role,
          birth_year: m.birth_year ?? null, birth_month: m.birth_month ?? null, is_account_holder: Boolean(m.is_account_holder), archived: false })),
      };
      return st.household;
    }
    case 'club_address_save':
      st.address = { ...body.p };
      return st.address;
    case 'club_welcome_get':
      return welcomeView(st);
    case 'club_welcome_save': {
      const clean = { family_name: String(body.p?.family_name ?? '').trim(), value: body.p?.value };
      if (!visionValid(clean)) throw new RpcError('invalid');
      if (!st.welcome) throw new RpcError('not_found');
      if (!['pending', 'on_hold'].includes(st.welcome.status)) throw new RpcError('locked');
      if (JSON.stringify(st.welcome.personalization) !== JSON.stringify(clean)) {
        st.welcome.personalization = clean;
        st.welcome.member_approved_at = null;
      }
      return welcomeView(st);
    }
    case 'club_welcome_approve':
      if (!st.welcome) throw new RpcError('not_found');
      if (!visionValid(st.welcome.personalization)) throw new RpcError('incomplete');
      if (st.welcome.status === 'pending' && !st.welcome.member_approved_at) st.welcome.member_approved_at = new Date().toISOString();
      return welcomeView(st);
    case 'club_resource_get': {
      const m = st.months.find((x) => x.slug === body.p_kit);
      if (!m || !m.published) throw new RpcError('not_found');
      return { can: 'edit', month: m.month, state: {}, revision: 0, profile_version: 1, approved_at: null,
        mailing: { status: 'pending', readiness: 'needs_pdf', approved: m.mailing.approved } };
    }
    case 'club_resource_save':
      return (body.p_revision ?? 0) + 1;
    case 'club_fulfillment_approve': {
      const m = st.months.find((x) => x.slug === body.p_kit);
      if (m) m.mailing.approved = true;
      return true;
    }
    case 'club_admin_fulfillment_bundle':
      return st.adminBundle;
    case 'club_admin_set_fulfillment':
      st.welcome.pdf = 'ready';
      return true;
    default:
      throw new RpcError(`unmocked_${name}`, 404);
  }
}

/** Routes every Supabase request of a page to the fake. `st.fail[name] = n` fails the next n calls of that function. */
async function fakeSupabase(page, st) {
  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    const reply = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    const p = url.pathname;
    if (p === '/auth/v1/otp') return reply(200, {});
    if (p === '/auth/v1/verify') {
      if (body.token !== '123456') return reply(400, { msg: 'Token has expired or is invalid' });
      return reply(200, { access_token: 'member-token', refresh_token: 'member-refresh', expires_in: 3600, user: USER });
    }
    if (p === '/auth/v1/token') return reply(200, { access_token: 'member-token', refresh_token: 'member-refresh', expires_in: 3600, user: USER });
    if (p === '/auth/v1/logout') return reply(204, {});
    if (p === '/functions/v1/club-billing') {
      st.calls.push(`billing:${body.action}`);
      if (body.action === 'checkout_status') return reply(200, { paid: true, open: false, email: USER.email });
      if (body.action === 'sync_email') return reply(200, { updated: false });
      return reply(200, { url: `${BASE}/club/dashboard` });
    }
    if (p === '/rest/v1/club_mailing_addresses') return reply(200, st.address ? [st.address] : []);
    const m = p.match(/^\/rest\/v1\/rpc\/(\w+)$/);
    if (m) {
      st.calls.push(m[1]);
      if (st.fail[m[1]] > 0) {
        st.fail[m[1]]--;
        return route.abort('failed');
      }
      try {
        const out = rpc(st, m[1], body);
        return reply(200, out ?? null);
      } catch (e) {
        if (!(e instanceof RpcError)) throw e;
        if (e.status === 404) console.log(`       (unmocked call: ${m[1]})`);
        return reply(e.status, { message: e.message });
      }
    }
    console.log(`       (unmocked request: ${req.method()} ${p})`);
    return reply(404, {});
  });
}

const signedIn = (page) => page.addInitScript(([s]) => {
  if (!localStorage.getItem('omc:account:session')) localStorage.setItem('omc:account:session', JSON.stringify(s));
}, [{ access_token: 'member-token', refresh_token: 'member-refresh', expires_at: Date.now() + 3600_000, email: USER.email, user_id: USER.id }]);

async function newPage(browser, viewport, st, { auth = true } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  if (st) await fakeSupabase(page, st);
  if (auth) await signedIn(page);
  return page;
}

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
    const page = await newPage(browser, vp, null, { auth: false });
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
  const page = await newPage(browser, DESKTOP, null, { auth: false });
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
  console.log('\nAdmin print view (?fulfillment=)');
  const st = newMember({
    adminBundle: { order: { id: 'order-1', display_name: 'The Rivera Family', email: USER.email, status: 'pending', readiness: 'needs_pdf',
      fulfillment_type: 'welcome_vision', satisfies_month: null, personalization: { family_name: 'The Rivera Family', value: 'Courage' },
      address: { name: 'Ana Rivera', line1: '14 Oak St', line2: '', city: 'Austin', state: 'TX', postal_code: '78701' } } },
  });
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await fakeSupabase(page, st);
  await page.addInitScript(() => {
    sessionStorage.setItem('omc:v1:admin', JSON.stringify({ access_token: 'admin-token', refresh_token: 'admin-refresh', expires_at: Date.now() + 3600_000, email: 'owner@example.com' }));
    sessionStorage.setItem('omc:v1:admin:active', String(Date.now()));
  });
  await page.goto(`${BASE}/club/family-vision?fulfillment=order-1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Print / Save PDF');
  const a = await art(page);
  check('admin: her approved value and name are on the print', a.word === 'Courage' && a.name === 'The Rivera Family', JSON.stringify(a));
  check('admin: watercolor is the Courage illustration', Boolean(a.img?.startsWith('courage')), a.img ?? 'none');
  check('admin: editing is locked', await page.evaluate(() => document.getElementById('fvp-open-editor')?.hidden === true));
  await shot(page, 'admin-screen');
  const pages = await printPdf(page, 'admin-print');
  check('admin print: exactly one Letter page', pages === 1, `${pages} pages`);
  const text = execFileSync('pdftotext', [`${SHOTS ?? '/tmp'}/admin-print.pdf`, '-']).toString();
  check('admin print: no admin bar, header or buttons on paper', !/Print \/ Save PDF|Welcome print ·|Organized Family Club\n/i.test(text) && /Courage/.test(text), JSON.stringify(text.trim().slice(0, 120)));
  // The approved print, page 1 at 50 dpi (captured from the version before PRs #257/#258): pixel-identical or it fails.
  const diff = execFileSync('python3', ['-c', `from PIL import Image, ImageChops
a = Image.open('tests/fixtures/family-vision-print-golden.png').convert('RGB'); b = Image.open('${SHOTS ?? '/tmp'}/admin-print.png').convert('RGB')
print('size' if a.size != b.size else ImageChops.difference(a, b).getbbox())`]).toString().trim();
  check('admin print: identical to the approved print (tests/fixtures/family-vision-print-golden.png)', diff === 'None', diff);
  const imgs = execFileSync('pdfimages', ['-list', `${SHOTS ?? '/tmp'}/admin-print.pdf`]).toString().trim().split('\n').length - 2;
  check('admin print: the watercolor is embedded in the PDF', imgs >= 1, `${imgs} image(s)`);
  await page.click('text=Mark PDF ready');
  await page.waitForSelector('text=PDF marked ready');
  check('admin: Mark PDF ready calls the database', st.calls.includes('club_admin_set_fulfillment'));
  check('admin: no script errors', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
};

const names = ONLY ? ONLY.split(',') : Object.keys(scenarios);
const browser = await chromium.launch();
try {
  for (const n of names) await scenarios[n](browser);
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
