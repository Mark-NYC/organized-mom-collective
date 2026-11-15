#!/usr/bin/env node
/**
 * dist-app/ → app-www/: the files inside the iPhone app (docs/ios/OMC_APP_ROADMAP.md → 2.1). Run by build:app.
 *
 * - Pages: only those matching src/data/app/shell-routes.json (`include`, minus `neverInclude`), the same patterns
 *   src/lib/native/links.ts uses to keep a tap in the app or open the website.
 * - Files: only what those pages reference (HTML → CSS/JS → further chunks, images, fonts), found by following
 *   absolute `/…` and relative `./…` references, plus the folders code builds paths into at runtime (ALWAYS).
 * - `/` redirects to `/app`, so the app always opens on Today.
 * - Fails (exit 1) if a public, sales, checkout, billing or admin page got in, if a page has the website's GA or
 *   Pinterest tag, or if any file contains something that looks like a secret.
 * - Writes app-www/shell-manifest.json (pages, file count, size) for CI and the smoke test.
 *
 * Usage: node scripts/build-app-shell.mjs [distDir=dist-app] [outDir=app-www]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, posix, relative, sep } from 'node:path';

const DIST = process.argv[2] ?? 'dist-app';
const OUT = process.argv[3] ?? 'app-www';
const routes = JSON.parse(readFileSync('src/data/app/shell-routes.json', 'utf8'));
const include = routes.include.map((p) => new RegExp(p));
const never = routes.neverInclude.map((p) => new RegExp(p));
const inShell = (p) => !never.some((r) => r.test(p)) && include.some((r) => r.test(p));

/** Folders whose files are named at runtime (template strings, month slugs, icon sets): copied whole. */
const ALWAYS = ['icons', 'brand', 'fonts', 'favicon.ico', 'images/club'];
const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.webmanifest', '.txt']);
const SECRETS = [
  /sk_(live|test)_[0-9A-Za-z]{10,}/,
  /rk_(live|test)_[0-9A-Za-z]{10,}/,
  /whsec_[0-9A-Za-z]{10,}/,
  /sb_secret_[0-9A-Za-z_-]{10,}/,
  /"role"\s*:\s*"service_role"/,
  /service_role_key/i,
  /re_[0-9A-Za-z]{8,}_[0-9A-Za-z]{8,}/, // Resend API key shape
  /sk-ant-[0-9A-Za-z-]{10,}/,
  /AIza[0-9A-Za-z_-]{35}/, // Google API key
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

if (!existsSync(DIST)) {
  console.error(`build-app-shell: ${DIST}/ not found. Run npm run build:app.`);
  process.exit(1);
}
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const urlOf = (f) => '/' + relative(DIST, f).split(sep).join('/');
const pagePath = (u) => u.replace(/\/index\.html$/, '') || '/';

// 1. Pages.
const allPages = walk(DIST).filter((f) => f.endsWith('index.html'));
const pages = allPages.filter((f) => inShell(pagePath(urlOf(f))));
const problems = [];
for (const want of ['/app', '/app/cleaning', '/app/club']) if (!pages.some((f) => pagePath(urlOf(f)) === want)) problems.push(`missing required page ${want}`);

// 2. Files those pages use.
const keep = new Set(pages.map(urlOf));
const queue = [...keep];
const ref = /(?<=["'(\s=,:`])(\/(?:_astro|images|icons|brand|fonts|assets|audio|email|downloads|favicon)[^"'()\s?#,`\\]*)/g;
const relRef = /(?<=["'(`])\.\.?\/([\w./-]+\.(?:js|mjs|css|webp|png|jpg|jpeg|svg|woff2?|ttf|json))/g;
while (queue.length) {
  const u = queue.pop();
  const file = join(DIST, u);
  if (!TEXT.has(extname(file))) continue;
  const text = readFileSync(file, 'utf8');
  const found = [...text.matchAll(ref)].map((m) => m[1]);
  for (const m of text.matchAll(relRef)) found.push(posix.normalize(posix.join(posix.dirname(u), m[0])));
  // Vite's preload map lists chunks without the leading slash: "_astro/x.js".
  for (const m of text.matchAll(/(?<=["'`])_astro\/[\w.-]+/g)) found.push('/' + m[0]);
  for (const raw of found) {
    let p;
    try {
      p = decodeURI(raw);
    } catch {
      p = raw;
    }
    if (keep.has(p)) continue;
    const f = join(DIST, p);
    if (existsSync(f) && statSync(f).isFile()) {
      keep.add(p);
      queue.push(p);
    }
  }
}
for (const a of ALWAYS) {
  const f = join(DIST, a);
  if (!existsSync(f)) continue;
  (statSync(f).isDirectory() ? walk(f) : [f]).forEach((x) => keep.add(urlOf(x)));
}

// 3. Copy.
rmSync(OUT, { recursive: true, force: true });
let bytes = 0;
for (const u of keep) {
  const src = join(DIST, u);
  const dst = join(OUT, u);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
  bytes += statSync(src).size;
}
writeFileSync(
  join(OUT, 'index.html'),
  // The app starts on /app (capacitor.config.ts -> server.appStartPath); this page only catches an unknown address,
  // and is never blank: a visible link. It redirects only from "/" itself, so a router that answered every address
  // with this page could never loop.
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Organized Mom</title><script>if (location.pathname === "/" || location.pathname === "/index.html") location.replace("/app")</script></head><body style="background:#fffdfa;color:#4d4544;font-family:-apple-system,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><a href="/app" style="color:#4d4544;font-size:17px">Open Today</a></body></html>\n',
);

// 4. Checks.
for (const f of walk(OUT)) {
  const u = '/' + relative(OUT, f).split(sep).join('/');
  if (u.endsWith('.map')) problems.push(`source map in bundle: ${u}`);
  if (f.endsWith('index.html') && u !== '/index.html' && !inShell(pagePath(u))) problems.push(`page outside the allowlist: ${pagePath(u)}`);
  if (!TEXT.has(extname(f))) continue;
  const text = readFileSync(f, 'utf8');
  for (const s of SECRETS) if (s.test(text)) problems.push(`possible secret (${s}) in ${u}`);
  if (f.endsWith('.html') && /googletagmanager\.com|pintrk\(/.test(text)) problems.push(`third-party tracking tag in ${u}`);
}
if (!walk(OUT).some((f) => f.endsWith('.js') && readFileSync(f, 'utf8').includes('omc-native'))) problems.push('native bridge (src/lib/native/init.ts) not found in any script');

const manifest = {
  builtAt: new Date().toISOString(),
  pages: pages.map((f) => pagePath(urlOf(f))).sort(),
  excludedPages: allPages.length - pages.length,
  files: keep.size + 1,
  megabytes: Math.round((bytes / 1048576) * 10) / 10,
};
writeFileSync(join(OUT, 'shell-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

if (problems.length) {
  console.error('build-app-shell: FAILED\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`build-app-shell: ${manifest.pages.length} pages, ${manifest.files} files, ${manifest.megabytes} MB → ${OUT}/ (${manifest.excludedPages} website pages left out)`);
