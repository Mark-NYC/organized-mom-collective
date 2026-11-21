#!/usr/bin/env node
/**
 * First-session walkthrough (docs/pilot/PILOT_TESTING.md): a brand-new mom, never signed up, on an iPhone-size screen,
 * from first open through family setup to every tab. Saves a screenshot and the visible text of every step to OUT, for
 * reviewing what a new user meets. Against the isolated test backend only.
 *
 *   node scripts/e2e/first-session-audit.mjs <app-www|dist-qa> [out=first-session] [label]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = process.argv[2] ?? 'app-www';
const OUT = process.argv[3] ?? 'first-session';
const LABEL = process.argv[4] ?? 'before';
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const srv = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = [join(ROOT, p), join(ROOT, p, 'index.html'), join(ROOT, `${p}.html`)].find((f) => existsSync(f) && statSync(f).isFile());
  if (!file) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://localhost:${srv.address().port}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const notes = [];
let n = 0;
const snap = async (name) => {
  await page.waitForTimeout(1500);
  const file = `${LABEL}-${String(++n).padStart(2, '0')}-${name}`;
  await page.screenshot({ path: join(OUT, `${file}.png`), fullPage: true, timeout: 20000 }).catch(() => {});
  const info = await page.evaluate(() => ({ url: location.pathname, h: document.documentElement.scrollHeight, text: (document.querySelector('main') ?? document.body).innerText.replace(/\n{2,}/g, '\n') }));
  notes.push(`## ${file}  (${info.url}, page height ${info.h}px)\n${info.text}\n`);
};

const email = `new-mom-${Date.now()}@e2e.test`;
await page.goto(`${base}/`, { waitUntil: 'networkidle' }); await snap('first-open');
await page.goto(`${base}/app/sign-in`, { waitUntil: 'networkidle' }); await snap('sign-in');
await page.fill('#ow-email', email);
await page.click('button:has-text("Email me a code")'); await snap('code-sent');
await page.fill('#ow-code', '123456');
await page.click('button[type="submit"]:has-text("Sign in")');
await page.waitForFunction(() => Boolean(localStorage.getItem('omc:account:session')), null, { timeout: 15000 });
await snap('after-sign-in');
// Family setup, filled in the way a mom would: name, partner, two kids.
const familyName = page.locator('label:has-text("What do you call your family?") input');
if (await familyName.count()) await familyName.fill('The Parkers');
await page.locator('input[autocomplete="given-name"]').fill('Jess');
await page.click('button:has-text("+ Add a grown-up")');
await page.locator('form li').filter({ hasText: 'Who they are' }).first().locator('input').fill('Sam');
const kidRows = () => page.locator('form li').filter({ hasText: 'Birthday month' });
for (const [i, [name, age]] of [['Ava', '9'], ['Leo', '6']].entries()) {
  if ((await kidRows().count()) <= i) await page.click('button:has-text("+ Add a child")');
  const row = kidRows().nth(i);
  await row.locator('input').fill(name);
  await row.locator('select').first().selectOption(age);
}
await snap('setup-filled');
await page.click('button:has-text("Save our family"), button:has-text("Save and continue")');
await page.waitForSelector("[data-setup-done]", { timeout: 15000 }).catch(() => {});
await snap("after-save");
for (const [path, name] of [['/app', 'today'], ['/app/family-calendar', 'calendar'], ['/app/cleaning', 'cleaning'], ['/app/family', 'family'], ['/app/family/meeting', 'meeting'], ['/app/club', 'club'], ['/app/account', 'account']]) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await snap(name);
}
writeFileSync(join(OUT, `${LABEL}-notes.md`), notes.join('\n') + (errors.length ? `\n## page errors\n${errors.join('\n')}\n` : ''));
await browser.close(); srv.close();
console.log(`${n} steps → ${OUT}/${LABEL}-*.png, ${LABEL}-notes.md; page errors: ${errors.length}`);
