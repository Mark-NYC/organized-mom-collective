/**
 * What would actually print: renders a month's member page (/club/resources/<slug>, the page members approve and the
 * admin's ?fulfillment= view prints the mailing from) and the month's app page (/app/club/<month>, where the Family
 * Meeting lives) for a Rivera-shaped household, prints both to PDF, and reports pages, page size, orientation and the
 * printed title (pdfinfo / pdftotext / pdftoppm). Read-only towards the product: a throwaway copy of the local dev
 * database (scripts/club-dev-db.sh), fake Auth, nothing real.
 *
 *   PUBLIC_CLUB_ENABLED=true PUBLIC_ACCOUNTS_ENABLED=true npx astro build && npx astro preview --port 4330
 *   PGPASSWORD=… bash scripts/club-dev-db.sh
 *   node scripts/club-resource-pdf-audit.mjs [http://localhost:4330] [--out=dir] [--months=01,02,03,09]
 *
 * Prints a JSON report and writes <out>/<path>.pdf and .png for each. Used for docs/club/RESOURCE_CONSISTENCY.md.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:4330';
const OUT = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? '/tmp/club-resource-pdfs';
const ONLY = (process.argv.find((a) => a.startsWith('--months='))?.slice(9) ?? '01,02,03,09').split(',');
const SHOTS_MOBILE = !process.argv.includes('--no-mobile');
mkdirSync(OUT, { recursive: true });
const SUPABASE = 'https://uvqhmlqwmgnohhduttip.supabase.co';
const PG = { PGHOST: process.env.PGHOST ?? 'localhost', PGUSER: process.env.PGUSER ?? 'postgres', PGPASSWORD: process.env.PGPASSWORD ?? 'postgres' };
const DB = 'club_pdf_audit';
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com' };
const OWNER = '22222222-2222-4222-8222-222222222222';
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const psql = (db, input) => execFileSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', db], { input, env: { ...process.env, ...PG }, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
const sql = (q) => psql(DB, q);
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

psql('postgres', `drop database if exists ${DB} with (force);\ncreate database ${DB} template club_dev_template;`);

class RpcError extends Error { constructor(m, s = 400) { super(m); this.status = s; } }
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
function asUser(uid, q) {
  const claims = JSON.stringify({ sub: uid, role: 'authenticated' });
  try {
    return psql(DB, `begin;\nset local role authenticated;\nselect set_config('request.jwt.claims', ${lit(claims)}, true) \\g /dev/null\n${q};\ncommit;\n`);
  } catch (e) {
    const msg = /ERROR:\s+(.*)/.exec(String(e.stderr ?? ''))?.[1] ?? 'failed';
    throw new RpcError(msg, /permission denied/.test(msg) ? 403 : 400);
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
async function backend(page) {
  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    const reply = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    const p = url.pathname;
    const uid = TOKENS[(req.headers().authorization ?? '').replace(/^Bearer\s+/, '')] ?? null;
    if (p.startsWith('/auth/v1/')) return reply(200, { access_token: 'member-token', refresh_token: 'r', expires_in: 3600, user: USER });
    if (p === '/functions/v1/club-billing') return reply(200, { updated: false });
    if (!uid) return reply(401, { message: 'JWT expired' });
    if (p === '/rest/v1/club_mailing_addresses') return reply(200, []);
    if (p === '/rest/v1/account_saves') return reply(200, []);
    if (p === '/rest/v1/club_kits') return reply(200, JSON.parse(asUser(uid, `select coalesce(json_agg(json_build_object('slug', slug, 'month', month, 'title', title, 'status', status, 'mailer_cutoff_at', mailer_cutoff_at) order by month), '[]')::text from public.club_kits`)));
    const m = p.match(/^\/rest\/v1\/rpc\/(\w+)$/);
    if (m) {
      try { return reply(200, rpc(uid, m[1], body)); } catch (e) { return reply(e.status ?? 400, { message: e.message }); }
    }
    return reply(404, {});
  });
}

// The Rivera sample family (src/data/club/samples.ts), as her household.
asUser(USER.id, `select public.club_household_save('The Rivera Family', '{"pets":true}', '[
  {"first_name":"Ana","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Luis","kind":"adult","role":"partner"},
  {"first_name":"Sofia","kind":"child","role":"child","birth_year":2016,"birth_month":3},{"first_name":"Mateo","kind":"child","role":"child","birth_year":2019,"birth_month":6},
  {"first_name":"Elena","kind":"child","role":"child","birth_year":2022,"birth_month":2}]') \\g /dev/null`);
// Open the audited months to her in this throwaway copy only.
sql(`update public.club_kits set status = 'scheduled', release_at = now() - interval '1 day' where status = 'draft'`);
sql(`insert into public.club_access_grants (user_id, reason, note) values ('${USER.id}', 'preview', 'pdf audit') on conflict (user_id) do update set revoked_at = null, expires_at = null`);

function pdfReport(file) {
  const info = execFileSync('pdfinfo', [file]).toString();
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
  const [w, h] = (/Page size:\s+([\d.]+) x ([\d.]+)/.exec(info) ?? []).slice(1).map(Number);
  const sizes = [];
  for (let i = 1; i <= pages; i++) {
    const pi = execFileSync('pdfinfo', ['-f', String(i), '-l', String(i), file]).toString();
    const s = /Page\s+\d+ size:\s+([\d.]+) x ([\d.]+)/.exec(pi);
    sizes.push(s ? `${Math.round(Number(s[1]) / 72 * 100) / 100}x${Math.round(Number(s[2]) / 72 * 100) / 100}in` : `${w / 72}x${h / 72}in`);
  }
  const text = execFileSync('pdftotext', ['-l', '1', file, '-']).toString().replace(/\s+/g, ' ').trim();
  execFileSync('pdftoppm', ['-r', '40', '-png', '-f', '1', '-l', '1', '-singlefile', file, file.replace(/\.pdf$/, '')]);
  return { pages, sizes, firstPageText: text.slice(0, 160) };
}

const browser = await chromium.launch();
const report = [];
try {
  for (const mm of ONLY) {
    const slug = sql(`select slug from public.club_kits where to_char(month, 'MM') = '${mm}' and month < '2027-11-01' order by month limit 1`);
    const name = MONTH_NAMES[Number(mm) - 1];
    // Member page, as Ana.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await backend(page);
    await page.addInitScript(([s]) => localStorage.setItem('omc:account:session', JSON.stringify(s)), [{ access_token: 'member-token', refresh_token: 'r', expires_at: Date.now() + 3600_000, email: USER.email, user_id: USER.id }]);
    await page.goto(`${BASE}/club/resources/${slug}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#club-month-content:not([hidden])', { timeout: 20000 }).catch(() => errors.push('member page never showed the resource'));
    await page.waitForTimeout(800);
    if (mm === '02') {
      // February's member copy is the laundry guides: her editor opens from her copy, a change saves to her account,
      // and comes back after a reload.
      const before = await page.locator('.laundry-day-banner strong').first().textContent();
      await page.click('button:has-text("Change your plan")');
      const open = await page.isVisible('[data-lg-editor][open]');
      await page.locator('[data-days-controls] input').nth(2).click(); // Wednesday
      await page.locator('[data-lg-editor] [data-lg-close]').last().click();
      // Saves are debounced (bridgeResourceState): wait for this change's own save, not the page's first one.
      await page.waitForSelector('text=Saving…', { timeout: 5000 }).catch(() => undefined);
      await page.waitForSelector('text=Saved to your account', { timeout: 10000 }).catch(() => errors.push('edit never saved'));
      const changed = await page.locator('.laundry-day-banner strong').first().textContent();
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForSelector('#club-month-content:not([hidden])');
      await page.waitForTimeout(800);
      const after = await page.locator('.laundry-day-banner strong').first().textContent();
      const saved = sql(`select count(*) from public.club_resource_versions v join public.club_kits k on k.id = v.kit_id where k.slug = '${slug}' and v.state::text like '%omc:club:member:${slug}:v1%'`);
      report.push({ month: name, check: 'member edit', editorOpened: open, before, changed, afterReload: after, savedVersions: Number(saved),
        ok: open && changed !== before && after === changed && Number(saved) === 1 });
      if (SHOTS_MOBILE) {
        const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const mp = await mobile.newPage();
        await backend(mp);
        await mp.addInitScript(([s]) => localStorage.setItem('omc:account:session', JSON.stringify(s)), [{ access_token: 'member-token', refresh_token: 'r', expires_at: Date.now() + 3600_000, email: USER.email, user_id: USER.id }]);
        await mp.goto(`${BASE}/club/resources/${slug}`, { waitUntil: 'networkidle' });
        await mp.waitForSelector('#club-month-content:not([hidden])');
        await mp.waitForTimeout(800);
        report.push({ month: name, check: 'mobile', sideScroll: await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) });
        await mp.screenshot({ path: `${OUT}/member-${name}-mobile.png`, fullPage: true });
        await mobile.close();
      }
      await page.screenshot({ path: `${OUT}/member-${name}-desktop.png` });
    }
    const file = `${OUT}/member-${name}.pdf`;
    await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    report.push({ month: name, path: `/club/resources/${slug}`, ...pdfReport(file), errors });
    await ctx.close();

    // The app page, Rivera sample, tool view (where the Family Meeting is).
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await ctx2.newPage();
    const errors2 = [];
    p2.on('pageerror', (e) => errors2.push(e.message));
    await p2.goto(`${BASE}/app/club/${name}?sample=rivera`, { waitUntil: 'networkidle' });
    await p2.waitForSelector('.club-plan[data-plan-state="ready"]', { timeout: 20000 }).catch(() => errors2.push('app page not ready'));
    await p2.waitForTimeout(800);
    const file2 = `${OUT}/app-${name}.pdf`;
    await p2.pdf({ path: file2, preferCSSPageSize: true, printBackground: true });
    report.push({ month: name, path: `/app/club/${name}`, ...pdfReport(file2), errors: errors2 });
    await ctx2.close();
  }

  // The admin's print view of the pending January mailing (what fulfillment actually prints).
  const order = sql(`select o.id from public.club_fulfillment_orders o join public.club_kits k on k.id = o.kit_id where o.fulfillment_type = 'monthly_resource' and to_char(k.month, 'MM') = '01' limit 1`);
  if (order) {
    const slug = sql(`select k.slug from public.club_fulfillment_orders o join public.club_kits k on k.id = o.kit_id where o.id = '${order}'`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await backend(page);
    await page.addInitScript(() => {
      sessionStorage.setItem('omc:v1:admin', JSON.stringify({ access_token: 'admin-token', refresh_token: 'r', expires_at: Date.now() + 3600_000, email: 'owner@example.com' }));
      sessionStorage.setItem('omc:v1:admin:active', String(Date.now()));
    });
    await page.goto(`${BASE}/club/resources/${slug}?fulfillment=${order}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Mark PDF ready', { timeout: 20000 }).catch(() => errors.push('print view not ready'));
    await page.waitForTimeout(800);
    const file = `${OUT}/fulfillment-january.pdf`;
    await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    report.push({ month: 'january', path: `/club/resources/${slug}?fulfillment=<order>`, ...pdfReport(file), errors });
    await ctx.close();
  }
} finally {
  await browser.close();
  psql('postgres', `drop database if exists ${DB} with (force)`);
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
