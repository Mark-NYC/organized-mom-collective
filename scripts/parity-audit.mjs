#!/usr/bin/env node
/**
 * Web/app parity screenshots: the same /app screens from the iPhone app bundle (app-www/, served like
 * ios/App/App/OMCRouter.swift, with a stand-in native bridge) and from a website build or URL, at iPhone size and on
 * desktop. Writes <out>/<width>/<name>-app.png and -web.png plus a side-by-side <name>.png, and summary.json with the
 * tab labels, header links and page headings each side rendered (so a difference is reported, not just pictured).
 *
 * Usage: node scripts/parity-audit.mjs <web-base-url-or-dir> [out=parity-audit] [app-dir=app-www]
 *   web: a URL (https://organizedmomcollective.com) or a built website directory (dist/), served the same way.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const WEB = process.argv[2];
const OUT = process.argv[3] ?? 'parity-audit';
const APP = process.argv[4] ?? 'app-www';
if (!WEB) { console.error('usage: parity-audit.mjs <web-url-or-dir> [out] [app-dir]'); process.exit(2); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serve(root) {
  const route = (pathname) => {
    const p = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
    if (extname(p)) return join(root, p);
    const index = join(root, p, 'index.html');
    return existsSync(index) ? index : join(root, 'index.html');
  };
  const server = createServer((req, res) => {
    const file = route(new URL(req.url, 'http://x').pathname);
    if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(`http://localhost:${server.address().port}`)));
}

const appBase = await serve(APP);
const webBase = /^https?:/.test(WEB) ? WEB.replace(/\/$/, '') : await serve(WEB);

const SCREENS = [
  ['today', '/app'],
  ['calendar', '/app/family-calendar'],
  ['cleaning', '/app/cleaning'],
  ['family', '/app/family'],
  ['account', '/app/account'],
  ['sign-in', '/app/sign-in'],
  ['club', '/app/club'],
  ['family-meeting', '/app/family/meeting'],
  ['responsibilities', '/app/family/responsibilities'],
  ['week', '/app/week'],
  ['settings', '/app/settings'],
  ['qr-companion', '/app/calendar'],
];
const WIDTHS = [[393, 852, true], [1280, 900, false]];

const browser = await chromium.launch();
const summary = {};
for (const [w, h, mobile] of WIDTHS) {
  mkdirSync(join(OUT, String(w)), { recursive: true });
  for (const side of ['app', 'web']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    if (side === 'app') await ctx.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} }; });
    const page = await ctx.newPage();
    for (const [name, path] of SCREENS) {
      const url = (side === 'app' ? appBase : webBase) + path;
      // Not 'networkidle': signed-in screens poll for shared changes every 15 s, so the network never goes quiet.
      await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const info = await page.evaluate(() => {
        const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]');
        const texts = (sel) => [...document.querySelectorAll(sel)].filter(vis).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
        return {
          finalPath: location.pathname,
          title: document.title,
          tabs: texts('[data-app-tabbar] a, [data-app-topnav] a'),
          headerLinks: texts('header a, header button').slice(0, 12),
          profileIcon: vis(document.querySelector('[data-profile-link]')),
          headings: texts('h1, h2').slice(0, 14),
        };
      });
      (summary[`${w}/${name}`] ??= {})[side] = info;
      await page.screenshot({ path: join(OUT, String(w), `${name}-${side}.png`), fullPage: false });
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
// Side by side: app left, web right.
execFileSync('python3', ['-c', `
import sys, os
from PIL import Image, ImageDraw
out = sys.argv[1]
for w in os.listdir(out):
    d = os.path.join(out, w)
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        if not f.endswith('-app.png'): continue
        n = f[:-8]; a = Image.open(os.path.join(d, f)); b = Image.open(os.path.join(d, n + '-web.png'))
        c = Image.new('RGB', (a.width + b.width + 24, max(a.height, b.height) + 34), 'white')
        c.paste(a, (0, 34)); c.paste(b, (a.width + 24, 34))
        dr = ImageDraw.Draw(c); dr.text((8, 10), 'iPhone app: ' + n, fill='black'); dr.text((a.width + 32, 10), 'website: ' + n, fill='black')
        c.save(os.path.join(d, n + '.png'))
`, OUT]);
console.log(`parity screenshots → ${OUT}/`);
