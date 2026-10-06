#!/usr/bin/env node
// Read-only archiver for the old Organized Mom Collective WordPress sites.
//
// Safety model (nothing here changes state on the site):
//   - Only GET/HEAD requests are made by the crawler itself.
//   - Inside the browser every non-GET request is aborted, as are admin-ajax,
//     wp-cron, heartbeat and anything matching UNSAFE_PATTERNS.
//   - Download/action URLs (download_file, nonces, order keys, add-to-cart,
//     logout, cancel, delete…) are recorded as assets, never requested.
//   - Files under /wp-content/uploads/ get a HEAD check; they are only
//     downloaded with --download-uploads.
//
// Usage:
//   node archive.mjs [--out DIR] [--max-pages N] [--cookies cookies.txt]
//                    [--storage-state state.json] [--download-uploads]
//                    [--no-screens] [--concurrency N]
//   node archive.mjs --login            # headed browser, log in by hand, saves state.json

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, devices } from 'playwright';
import TurndownService from 'turndown';

// ---------------------------------------------------------------- config

const DEFAULT_ORIGINS = [
  'https://members.organizedmomcollective.com',
  'https://organizedmomcollective.com',
];

const PRIORITIES = [
  ['member-home', /^\/?$|member[-_]?home|members?[-_]?area|welcome/i],
  ['tidy', /tidy|clean/i],
  ['monthly-coaching', /coach|monthly|masterclass|live[-_]?call/i],
  ['family-table', /family[-_]?table|meal|recipe|menu|grocer/i],
  ['resources', /resource|download|library|printable|worksheet|vault/i],
  ['dashboard', /dashboard/i],
  ['start-here', /start[-_]?here|onboard|getting[-_]?started|^\/start\b/i],
  ['progress', /progress|tracker|tracking|checklist/i],
  ['audio-coaching', /audio|podcast|listen/i],
  ['daily-rhythm-starter-pack', /daily[-_]?rhythm/i],
  ['essential-routines-bundle', /essential[-_]?routine/i],
  ['complete-control-system', /complete[-_]?control/i],
  ['family-sanity-saver', /sanity[-_]?saver/i],
  ['real-life-reset-kit', /real[-_]?life[-_]?reset/i],
  ['wall-calendar', /calendar/i],
];

// Generic WP/Woo plumbing we don't archive as pages.
const SKIP_PATTERNS = [
  /\/cart\/?/i, /\/checkout\/?/i, /\/basket/i, /privacy/i, /\/terms/i, /cookie-policy/i,
  /\/my-account\/(orders|downloads|edit-address|edit-account|payment-methods|customer-logout|lost-password)/i,
  /\/(account|my-account)\/?$/i, /\/wp-admin/i, /\/wp-login\.php/i, /\/wp-json\//i, /xmlrpc\.php/i,
  /\/feed\/?$/i, /\/comments\/feed/i, /\/(author|tag)\//i, /\/page\/\d+\/?$/i, /\/wp-content\//i, /\/wp-includes\//i,
  /[?&](replytocom|share|preview|s)=/i, /\/embed\/?$/i, /\/trackback\/?$/i,
];

// Never request these, not even with HEAD: they can change state.
const UNSAFE_PATTERNS = [
  /logout|log-out|signout|sign-out/i, /add[-_]to[-_]cart|add-to-cart=/i, /remove_item|undo_item|empty[-_]cart/i,
  /\/(cancel|delete|unsubscribe|deactivate|remove|purge)\/?$/i, /[?&][^#]*(cancel|delete|remove|unsubscribe|purge)/i,
  /cancel-subscription|delete-account|reset[-_]?password|lostpassword/i,
  /[?&](action|_wpnonce|nonce|wpnonce|key|order|token|order_key|download_file|download|dlm-download|edd_action|mepr-.*|ld-.*|wc-ajax|wc-api)=/i,
  /admin-ajax\.php/i, /wp-cron\.php/i, /\/wc-api\//i, /\/\?wc-ajax/i, /\/download\/\d+/i, /\/(subscribe|signup|register|join)\b.*[?&]/i,
  /mailto:|tel:|javascript:/i,
];

const FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z|mp3|m4a|wav|ogg|aac|mp4|m4v|mov|webm|avi|jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|epub|mobi|ics|json|xml|css|js|woff2?|ttf|otf|eot)(\?|#|$)/i;

const VIDEO_HOSTS = /youtube\.com|youtu\.be|vimeo\.com|player\.vimeo|wistia|vidyard|loom\.com|bunny|mediadelivery|jwplayer|spotify|soundcloud|libsyn|buzzsprout|anchor\.fm|podbean/i;

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const OUT = path.resolve(arg('out', path.join(process.cwd(), '../../site-archive')));
const MAX_PAGES = Number(arg('max-pages', 400));
const CONCURRENCY = Number(arg('concurrency', 2));
const COOKIES = arg('cookies', null);
const STATE = arg('storage-state', null);
const DOWNLOAD_UPLOADS = !!arg('download-uploads', false);
const SCREENS = !arg('no-screens', false);
const LOGIN = !!arg('login', false);
// --origins is for testing against a local mock; the first origin is treated as the members site.
const ORIGINS = arg('origins', null) ? String(arg('origins')).split(',') : DEFAULT_ORIGINS;
const HOSTS = new Set(ORIGINS.map((o) => new URL(o).host).concat(['www.organizedmomcollective.com']));
const MEMBERS_HOST = new URL(ORIGINS[0]).host;
const UA_SUFFIX = ' OMC-archive/1.0 (read-only)';

const exePath = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

// ---------------------------------------------------------------- helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');
const mkdirp = (d) => fs.mkdirSync(d, { recursive: true });
const write = (f, data) => { mkdirp(path.dirname(f)); fs.writeFileSync(f, data); };
const logFile = () => path.join(OUT, 'crawl-log.jsonl');
const log = (o) => { fs.appendFileSync(logFile(), JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n'); console.log(o.event, o.url ?? '', o.note ?? ''); };

function normalize(u, base) {
  try {
    const url = new URL(u, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    if (url.hostname.endsWith('organizedmomcollective.com')) url.protocol = 'https:';
    if (url.host === 'www.organizedmomcollective.com') url.host = 'organizedmomcollective.com';
    for (const p of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|_ga|ref$)/i.test(p)) url.searchParams.delete(p);
    if (!url.search) url.search = '';
    if (!FILE_EXT.test(url.pathname) && !url.pathname.endsWith('/') && !url.search) url.pathname += '/';
    return url.toString();
  } catch { return null; }
}
const isOurs = (u) => { try { return HOSTS.has(new URL(u).host); } catch { return false; } };
const isUnsafe = (u) => UNSAFE_PATTERNS.some((r) => r.test(u));
const isSkipped = (u) => SKIP_PATTERNS.some((r) => r.test(new URL(u).pathname + new URL(u).search));
const isFile = (u) => FILE_EXT.test(new URL(u).pathname);

function slugFor(u) {
  const url = new URL(u);
  let s = url.pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9/_-]+/gi, '-').replace(/\//g, '__') || '_home';
  if (url.search) s += '__q-' + sha(url.search).slice(0, 8);
  return s.slice(0, 120);
}
function priorityOf(u, title = '') {
  const p = new URL(u).pathname;
  const hits = PRIORITIES.filter(([, re]) => re.test(p) || re.test(title)).map(([k]) => k);
  if (p === '/' && new URL(u).host === MEMBERS_HOST) hits.unshift('member-home');
  return [...new Set(hits)];
}
function assetType(u) {
  const p = new URL(u).pathname.toLowerCase();
  if (/\.pdf$/.test(p)) return 'pdf';
  if (/\.(docx?|xlsx?|pptx?|csv|txt|epub|mobi|ics)$/.test(p)) return 'document';
  if (/\.(zip|rar|7z)$/.test(p)) return 'archive';
  if (/\.(mp3|m4a|wav|ogg|aac)$/.test(p)) return 'audio';
  if (/\.(mp4|m4v|mov|webm|avi)$/.test(p)) return 'video';
  if (/\.(jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?)$/.test(p)) return 'image';
  if (/\.(woff2?|ttf|otf|eot)$/.test(p)) return 'font';
  if (/\.(css|js|json|xml)$/.test(p)) return 'code';
  if (VIDEO_HOSTS.test(u)) return /spotify|soundcloud|libsyn|buzzsprout|anchor|podbean/i.test(u) ? 'audio-embed' : 'video-embed';
  if (/download|dlm|edd_|\.(pdf|mp3|zip)/i.test(u)) return 'download-action';
  if (isUnsafe(u)) return 'action-link';
  return 'link';
}

function readNetscapeCookies(file) {
  return fs.readFileSync(file, 'utf8').split('\n')
    .map((l) => l.replace(/^#HttpOnly_/, ''))
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('\t'))
    .filter((f) => f.length >= 7)
    .map(([domain, , p, secure, expires, name, value]) => ({
      name, value: value.trim(), domain, path: p, secure: secure === 'TRUE',
      expires: Number(expires) || -1, httpOnly: false, sameSite: 'Lax',
    }));
}

// OMC_COOKIE="wordpress_logged_in_xxx=...; wordpress_sec_xxx=..." (copied from a logged-in browser) applies to both sites.
function envCookies() {
  const raw = process.env.OMC_COOKIE;
  if (!raw) return [];
  const pairs = raw.split(';').map((p) => p.trim()).filter((p) => p.includes('='));
  return ORIGINS.flatMap((o) => pairs.map((p) => {
    const i = p.indexOf('=');
    return { name: p.slice(0, i), value: p.slice(i + 1), url: o + '/' };
  }));
}
async function applyAuth(ctx) {
  if (COOKIES) await ctx.addCookies(readNetscapeCookies(COOKIES));
  const env = envCookies();
  if (env.length) await ctx.addCookies(env);
}

async function safeGet(url, ctx) {
  if (isUnsafe(url)) throw new Error('refusing unsafe url ' + url);
  const res = await ctx.request.get(url, { timeout: 30000, maxRedirects: 5, failOnStatusCode: false });
  return { status: res.status(), url: res.url(), headers: res.headers(), text: await res.text().catch(() => '') };
}

// ---------------------------------------------------------------- state

const pages = new Map();     // url -> record
const queue = [];            // urls to visit
const seen = new Set();
const assets = new Map();    // url -> { type, foundOn:Set, labels:Set, ... }
const discovered = new Map(); // url -> Set(source)

function enqueue(raw, base, source) {
  const u = normalize(raw, base);
  if (!u || !isOurs(u)) return;
  if (isFile(u) || isUnsafe(u)) return addAsset(u, base, source);
  if (!discovered.has(u)) discovered.set(u, new Set());
  discovered.get(u).add(source);
  if (seen.has(u) || isSkipped(u)) return;
  seen.add(u);
  // Priority pages jump the queue.
  if (priorityOf(u).length) queue.unshift(u); else queue.push(u);
}

function addAsset(raw, foundOn, label = '', kindHint) {
  const u = (() => { try { const x = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw, foundOn); x.hash = ''; return x.toString(); } catch { return null; } })();
  if (!u || !/^https?:/.test(u)) return;
  if (!assets.has(u)) assets.set(u, { type: kindHint || assetType(u), foundOn: new Set(), labels: new Set() });
  const a = assets.get(u);
  if (foundOn && !/^(sitemap|wp-json|robots)/.test(foundOn)) a.foundOn.add(foundOn);
  else if (foundOn) a.foundOn.add(foundOn);
  if (label) a.labels.add(String(label).replace(/\s+/g, ' ').trim().slice(0, 120));
}

// ---------------------------------------------------------------- discovery

async function discover(ctx) {
  const dir = path.join(OUT, 'discovery');
  for (const origin of ORIGINS) {
    const host = new URL(origin).host;
    const sitemaps = new Set([`${origin}/wp-sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap.xml`]);
    try {
      const r = await safeGet(`${origin}/robots.txt`, ctx);
      write(path.join(dir, host, 'robots.txt'), r.text);
      for (const m of r.text.matchAll(/^sitemap:\s*(\S+)/gim)) sitemaps.add(m[1]);
      log({ event: 'robots', url: origin, status: r.status });
    } catch (e) { log({ event: 'robots-error', url: origin, note: e.message }); }

    const done = new Set();
    const todo = [...sitemaps];
    while (todo.length) {
      const sm = todo.shift();
      if (done.has(sm)) continue;
      done.add(sm);
      try {
        const r = await safeGet(sm, ctx);
        log({ event: 'sitemap', url: sm, status: r.status });
        if (r.status !== 200 || !/<(urlset|sitemapindex)/.test(r.text)) continue;
        write(path.join(dir, host, 'sitemaps', slugFor(sm) + '.xml'), r.text);
        const locs = [...r.text.matchAll(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
        if (/<sitemapindex/.test(r.text)) todo.push(...locs);
        else for (const l of locs) enqueue(l, sm, 'sitemap');
        for (const m of r.text.matchAll(/<image:loc>\s*(.*?)\s*<\/image:loc>/g)) addAsset(m[1], sm, 'sitemap image');
      } catch (e) { log({ event: 'sitemap-error', url: sm, note: e.message }); }
    }

    // Public REST endpoints (GET only). Media listing is the best inventory of /wp-content/uploads/.
    const endpoints = ['pages', 'posts', 'media', 'product', 'sfwd-courses', 'sfwd-lessons', 'sfwd-topic', 'memberpressproduct', 'mpcs-course', 'mpcs-lesson', 'llms_course', 'lesson', 'course'];
    try {
      const idx = await safeGet(`${origin}/wp-json/`, ctx);
      log({ event: 'wp-json', url: `${origin}/wp-json/`, status: idx.status });
      if (idx.status === 200) {
        write(path.join(dir, host, 'wp-json-index.json'), idx.text);
        try {
          const types = await safeGet(`${origin}/wp-json/wp/v2/types`, ctx);
          if (types.status === 200) {
            write(path.join(dir, host, 'wp-json-types.json'), types.text);
            for (const t of Object.values(JSON.parse(types.text))) if (t.rest_base && !endpoints.includes(t.rest_base)) endpoints.push(t.rest_base);
          }
        } catch {}
        for (const ep of endpoints) {
          const items = [];
          for (let pg = 1; pg <= 50; pg++) {
            const r = await safeGet(`${origin}/wp-json/wp/v2/${ep}?per_page=100&page=${pg}`, ctx).catch(() => null);
            if (!r || r.status !== 200) { if (pg === 1 && r) log({ event: 'wp-json-ep', url: ep, status: r.status }); break; }
            let arr; try { arr = JSON.parse(r.text); } catch { break; }
            if (!Array.isArray(arr) || !arr.length) break;
            items.push(...arr);
            if (arr.length < 100) break;
          }
          if (!items.length) continue;
          write(path.join(dir, host, `wp-json-${ep}.json`), JSON.stringify(items, null, 2));
          log({ event: 'wp-json-ep', url: ep, note: `${items.length} items` });
          for (const it of items) {
            if (ep === 'media') {
              addAsset(it.source_url, `wp-json media (${host})`, it.title?.rendered || it.slug, undefined);
              const a = assets.get(it.source_url);
              if (a) Object.assign(a, { mime: it.mime_type, uploaded: it.date, parent: it.post });
              for (const s of Object.values(it.media_details?.sizes || {})) addAsset(s.source_url, `wp-json media (${host})`, 'size variant');
            } else if (it.link) enqueue(it.link, `${origin}/wp-json/`, `wp-json:${ep}`);
          }
        }
      }
    } catch (e) { log({ event: 'wp-json-error', url: origin, note: e.message }); }

    // WooCommerce Store API (public, read-only product catalogue).
    try {
      const r = await safeGet(`${origin}/wp-json/wc/store/v1/products?per_page=100`, ctx);
      if (r.status === 200) {
        write(path.join(dir, host, 'wc-store-products.json'), r.text);
        for (const p of JSON.parse(r.text)) {
          enqueue(p.permalink, origin, 'wc-store');
          for (const img of p.images || []) addAsset(img.src, p.permalink, `product image: ${p.name}`);
        }
        log({ event: 'wc-store', url: origin, note: 'products listed' });
      }
    } catch {}

    enqueue(origin + '/', origin, 'seed');
  }
}

// ---------------------------------------------------------------- page capture

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
turndown.remove(['script', 'style', 'noscript', 'iframe', 'svg', 'form']);

async function guardContext(ctx) {
  await ctx.route('**/*', (route) => {
    const req = route.request();
    const u = req.url();
    if (req.method() !== 'GET' && req.method() !== 'HEAD') return route.abort('blockedbyclient');
    if (/admin-ajax\.php|wp-cron\.php|heartbeat|wc-ajax=|\/wp-json\/.*(progress|complete|mark|track)/i.test(u)) return route.abort('blockedbyclient');
    if (req.isNavigationRequest() && isOurs(u) && isUnsafe(u)) return route.abort('blockedbyclient');
    return route.continue();
  });
}

async function autoscroll(page) {
  await page.evaluate(async () => {
    const step = Math.max(400, Math.floor(innerHeight * 0.8));
    for (let y = 0; y < document.body.scrollHeight && y < 40000; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); }
    scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}

const LOGIN_MARKERS = /you must be (logged|signed) in|please (log|sign) in|login to (view|access)|members only|this content is (restricted|for members|protected)|purchase (to|for) access|you do not have access|unauthorized|mepr-unauthorized|ld-login|join now to (access|unlock)|password protected/i;

async function capturePage(browser, url) {
  const slug = slugFor(url);
  const host = new URL(url).host;
  const dir = path.join(OUT, 'pages', host, slug);
  mkdirp(path.join(dir, 'screenshots'));
  const rec = { url, slug, host, dir: path.relative(OUT, dir), sources: [...(discovered.get(url) || [])] };

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: undefined, storageState: STATE && fs.existsSync(STATE) ? STATE : undefined });
  await applyAuth(desktop);
  await guardContext(desktop);
  const page = await desktop.newPage();
  const netAssets = new Set();
  page.on('response', (r) => { const t = r.request().resourceType(); if (['image', 'media', 'font'].includes(t) || FILE_EXT.test(r.url())) netAssets.add(r.url()); });

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    rec.status = resp?.status() ?? null;
    rec.finalUrl = page.url();
    rec.rawHtml = resp ? await resp.text().catch(() => '') : '';
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await autoscroll(page);

    const info = await page.evaluate(() => {
      const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
      const pick = ['main', 'article', '.entry-content', '#content', '.site-content', '.elementor', '#main', 'body'];
      const root = pick.map((s) => document.querySelector(s)).find((el) => el && el.innerText.trim().length > 50) || document.body;
      const clone = root.cloneNode(true);
      clone.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
      clone.querySelectorAll('[href]').forEach((n) => { const h = abs(n.getAttribute('href')); if (h) n.setAttribute('href', h); });
      clone.querySelectorAll('img').forEach((n) => { const src = n.currentSrc || n.src || n.getAttribute('data-src') || n.getAttribute('data-lazy-src'); if (src) n.setAttribute('src', abs(src)); });
      const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: abs(a.getAttribute('href')), text: (a.innerText || a.title || a.getAttribute('aria-label') || '').trim() }));
      const media = [];
      const add = (u, label, kind) => { if (u) media.push({ url: abs(u), label: label || '', kind }); };
      document.querySelectorAll('img').forEach((i) => {
        add(i.currentSrc || i.src, i.alt, 'image');
        for (const attr of ['data-src', 'data-lazy-src', 'data-orig-file', 'data-large-file']) if (i.getAttribute(attr)) add(i.getAttribute(attr), i.alt, 'image');
        for (const attr of ['srcset', 'data-srcset', 'data-lazy-srcset']) (i.getAttribute(attr) || '').split(',').forEach((p) => add(p.trim().split(/\s+/)[0], i.alt, 'image'));
      });
      document.querySelectorAll('source[src],source[srcset],video[src],audio[src],video[poster],track[src],embed[src],object[data]').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const k = el.closest('audio') || tag === 'audio' ? 'audio' : el.closest('video') || tag === 'video' ? 'video' : 'media';
        add(el.getAttribute('src') || el.getAttribute('data') || (el.getAttribute('srcset') || '').split(/\s+/)[0], '', k);
        if (el.getAttribute('poster')) add(el.getAttribute('poster'), 'video poster', 'image');
      });
      document.querySelectorAll('iframe').forEach((f) => add(f.src || f.getAttribute('data-src'), f.title, 'embed'));
      document.querySelectorAll('[style*="background"]').forEach((el) => { const m = el.getAttribute('style').match(/url\((['"]?)(.*?)\1\)/); if (m) add(m[2], 'background', 'image'); });
      document.querySelectorAll('[data-settings]').forEach((el) => { const m = (el.getAttribute('data-settings') || '').match(/https?:\\?\/\\?\/[^"']+?\.(?:jpe?g|png|webp|gif|mp4|mp3|pdf)/gi); (m || []).forEach((u) => add(u.replace(/\\\//g, '/'), 'elementor setting', 'media')); });
      const cs = getComputedStyle(document.body);
      return {
        title: document.title,
        h1: [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()).filter(Boolean),
        headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => `${h.tagName}: ${h.innerText.trim().replace(/\s+/g, ' ')}`).filter((s) => s.length > 4).slice(0, 80),
        description: document.querySelector('meta[name="description"]')?.content || document.querySelector('meta[property="og:description"]')?.content || '',
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
        bodyClass: document.body.className,
        mainHtml: clone.innerHTML,
        text: root.innerText,
        links, media,
        hasLoginForm: !!document.querySelector('form#loginform, form[name="loginform"], input[type="password"], .mepr-login-form, .woocommerce-form-login'),
        fonts: cs.fontFamily, bg: cs.backgroundColor, color: cs.color,
        height: document.documentElement.scrollHeight,
      };
    });

    Object.assign(rec, {
      title: info.title, h1: info.h1, headings: info.headings, description: info.description,
      canonical: info.canonical, bodyClass: info.bodyClass, pageHeight: info.height,
      style: { fontFamily: info.fonts, background: info.bg, color: info.color },
    });
    rec.priority = priorityOf(url, info.title + ' ' + info.h1.join(' '));

    // Access status
    const final = new URL(rec.finalUrl);
    const redirectedToLogin = /wp-login|\/login|\/sign-in|my-account/i.test(final.pathname + final.search) && !/wp-login|\/login|my-account/i.test(new URL(url).pathname);
    const loginText = LOGIN_MARKERS.test(info.text.slice(0, 20000)) || /mepr-unauthorized|ld-not-enrolled|wc-memberships-restricted/i.test(info.bodyClass + rec.rawHtml.slice(0, 200000));
    rec.access = rec.status >= 400 ? `http-${rec.status}` : redirectedToLogin ? 'blocked-login-redirect' : (loginText || (info.hasLoginForm && info.text.length < 3000)) ? 'blocked-login-or-paywall' : 'ok';

    // Save HTML + markdown
    write(path.join(dir, 'raw.html'), rec.rawHtml || '');
    write(path.join(dir, 'rendered.html'), await page.content());
    const md = turndown.turndown(info.mainHtml || '').replace(/\n{3,}/g, '\n\n').trim();
    const front = [
      '---', `url: ${url}`, `final_url: ${rec.finalUrl}`, `title: ${JSON.stringify(info.title)}`, `status: ${rec.status}`,
      `access: ${rec.access}`, `priority: [${rec.priority.join(', ')}]`, `captured: ${new Date().toISOString()}`,
      info.description ? `description: ${JSON.stringify(info.description)}` : null, info.canonical ? `canonical: ${info.canonical}` : null, '---', '',
    ].filter((l) => l !== null).join('\n');
    write(path.join(dir, 'page.md'), front + md + '\n');
    rec.textHash = sha(info.text.replace(/\s+/g, ' ').trim().toLowerCase());
    rec.shingles = shingles(info.text);
    rec.wordCount = info.text.split(/\s+/).filter(Boolean).length;
    delete rec.rawHtml;

    // Links -> queue / assets
    rec.outLinks = [];
    for (const l of info.links) {
      if (!l.href) continue;
      const n = normalize(l.href, url);
      if (!n) continue;
      if (isFile(n) || isUnsafe(n) || /\/wp-content\/uploads\//.test(n) || VIDEO_HOSTS.test(n)) addAsset(l.href, url, l.text);
      else if (isOurs(n)) { enqueue(n, url, 'link'); rec.outLinks.push(n); }
    }
    for (const m of info.media) if (m.url && !m.url.startsWith('data:')) addAsset(m.url, url, m.label, m.kind === 'embed' ? (VIDEO_HOSTS.test(m.url) ? undefined : 'embed') : undefined);
    for (const n of netAssets) if (!n.startsWith('data:')) addAsset(n, url, 'loaded at runtime');
    if (info.ogImage) addAsset(info.ogImage, url, 'og:image');

    // Screenshots
    if (SCREENS) {
      rec.screens = [];
      const shot = async (p, file, opts = {}) => { await p.screenshot({ path: path.join(dir, 'screenshots', file), animations: 'disabled', ...opts }); rec.screens.push(`screenshots/${file}`); };
      await page.addStyleTag({ content: '*{scroll-behavior:auto!important} [class*="cookie"],[id*="cookie"],.cky-consent-container,#wpadminbar{display:none!important} html{margin-top:0!important}' }).catch(() => {});
      await shot(page, 'desktop-full.png', { fullPage: true, timeout: 60000 }).catch((e) => log({ event: 'shot-error', url, note: e.message }));
      await shot(page, 'desktop-above-fold.png').catch(() => {});

      // Close-ups: top-level sections that are tall or image-heavy.
      const sections = await page.$$('main > section, main > div > section, .elementor-top-section, .e-con.e-parent, .wp-block-cover, .wp-block-group.alignfull, .wp-block-media-text, .et_pb_section, .fl-row, article section, .entry-content > figure, .wp-block-gallery, .elementor-widget-image-gallery');
      let n = 0;
      for (const el of sections) {
        if (n >= 15) break;
        const ok = await el.evaluate((e) => { const r = e.getBoundingClientRect(); const imgs = e.querySelectorAll('img,video,picture,[style*="background-image"]').length; return r.height > 120 && r.width > 300 && (imgs > 0 || r.height > 350); }).catch(() => false);
        if (!ok) continue;
        n++;
        await el.scrollIntoViewIfNeeded().catch(() => {});
        await shot(el, `closeup-${String(n).padStart(2, '0')}.png`, { timeout: 20000 }).catch(() => { n--; });
      }

      // Mobile
      const mob = await browser.newContext({ ...devices['iPhone 13'], storageState: STATE && fs.existsSync(STATE) ? STATE : undefined });
      await applyAuth(mob);
      await guardContext(mob);
      const mp = await mob.newPage();
      try {
        await mp.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await mp.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await autoscroll(mp);
        await mp.addStyleTag({ content: '[class*="cookie"],[id*="cookie"],#wpadminbar{display:none!important} html{margin-top:0!important}' }).catch(() => {});
        await shot(mp, 'mobile-full.png', { fullPage: true, timeout: 60000 });
      } catch (e) { log({ event: 'mobile-error', url, note: e.message }); }
      await mob.close();
    }
    log({ event: 'page', url, status: rec.status, note: `${rec.access} ${rec.priority.join(',')}` });
  } catch (e) {
    rec.error = e.message;
    rec.access = rec.access || 'error';
    log({ event: 'page-error', url, note: e.message });
  } finally {
    await desktop.close();
  }
  write(path.join(dir, 'meta.json'), JSON.stringify({ ...rec, shingles: undefined }, null, 2));
  return rec;
}

function shingles(text) {
  const w = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const s = new Set();
  for (let i = 0; i + 5 <= w.length; i++) s.add(sha(w.slice(i, i + 5).join(' ')).slice(0, 10));
  return s;
}
function jaccard(a, b) {
  if (!a?.size || !b?.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ---------------------------------------------------------------- asset checks

async function checkAssets(ctx) {
  const uploads = [...assets.entries()].filter(([u, a]) => /\/wp-content\/uploads\//.test(u) && !['download-action', 'action-link'].includes(a.type) && !isUnsafe(u));
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < uploads.length) {
      const [u, a] = uploads[i++];
      try {
        const r = await ctx.request.fetch(u, { method: 'HEAD', timeout: 20000, failOnStatusCode: false, maxRedirects: 3 });
        a.status = r.status();
        a.contentType = r.headers()['content-type'] || '';
        a.bytes = r.headers()['content-length'] || '';
        if (DOWNLOAD_UPLOADS && r.status() === 200) {
          const body = await ctx.request.get(u, { timeout: 120000 });
          const local = path.join(OUT, 'uploads', new URL(u).host, decodeURIComponent(new URL(u).pathname).replace(/^\/wp-content\/uploads\//, ''));
          write(local, await body.body());
          a.local = path.relative(OUT, local);
        }
      } catch (e) { a.status = 'error: ' + e.message.slice(0, 60); }
    }
  }));
}

// ---------------------------------------------------------------- reports

const csv = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function riskFor(u, a) {
  const url = new URL(u);
  if (a.type === 'action-link') return 'n/a: action link (logout/cart/etc.), never requested';
  if (url.host === MEMBERS_HOST && /\/wp-content\/uploads\//.test(url.pathname)) return 'HIGH: hosted on members subdomain uploads, breaks on reroute';
  if (url.host === MEMBERS_HOST && a.type === 'download-action') return 'HIGH: members download link, breaks on reroute';
  if (url.host === MEMBERS_HOST) return 'HIGH: members subdomain URL';
  if (HOSTS.has(url.host) && /\/wp-content\/uploads\//.test(url.pathname)) return 'MEDIUM: main-site uploads, safe only while main WP stays up';
  if (HOSTS.has(url.host)) return 'MEDIUM: main-site URL';
  return 'LOW: third-party host';
}

function reports(records) {
  // Duplicates
  const ok = records.filter((r) => r.shingles?.size > 20);
  for (const r of records) { r.duplicates = []; }
  const byHash = new Map();
  for (const r of records) if (r.textHash) { if (!byHash.has(r.textHash)) byHash.set(r.textHash, []); byHash.get(r.textHash).push(r); }
  for (const g of byHash.values()) if (g.length > 1) for (const r of g) r.duplicates.push(...g.filter((x) => x !== r).map((x) => ({ url: x.url, kind: 'exact' })));
  for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) {
    if (ok[i].textHash === ok[j].textHash) continue;
    const s = jaccard(ok[i].shingles, ok[j].shingles);
    if (s >= 0.8) { ok[i].duplicates.push({ url: ok[j].url, kind: `near ${s.toFixed(2)}` }); ok[j].duplicates.push({ url: ok[i].url, kind: `near ${s.toFixed(2)}` }); }
  }

  // assets.csv
  const rows = [['url', 'type', 'host', 'is_wp_upload', 'reroute_risk', 'head_status', 'content_type', 'bytes', 'mime_from_wp', 'uploaded', 'local_copy', 'labels', 'found_on_count', 'found_on']];
  const sorted = [...assets.entries()].sort(([a, x], [b, y]) => riskFor(a, x).localeCompare(riskFor(b, y)) || x.type.localeCompare(y.type) || a.localeCompare(b));
  for (const [u, a] of sorted) {
    if (a.type === 'font' || a.type === 'code') continue;
    rows.push([u, a.type, new URL(u).host, /\/wp-content\/uploads\//.test(u), riskFor(u, a), a.status ?? (['download-action', 'action-link'].includes(a.type) ? 'not requested (action url)' : ''), a.contentType ?? '', a.bytes ?? '', a.mime ?? '', a.uploaded ?? '', a.local ?? '', [...a.labels].slice(0, 5).join(' | '), a.foundOn.size, [...a.foundOn].slice(0, 15).join(' ')]);
  }
  write(path.join(OUT, 'assets.csv'), rows.map((r) => r.map(csv).join(',')).join('\n') + '\n');

  // pages.csv
  const prow = [['url', 'host', 'title', 'status', 'access', 'priority', 'words', 'duplicates', 'folder', 'discovered_via']];
  for (const r of records) prow.push([r.url, r.host, r.title, r.status, r.access, (r.priority || []).join(' '), r.wordCount, r.duplicates.map((d) => `${d.kind}:${d.url}`).join(' '), r.dir, r.sources.join(' ')]);
  write(path.join(OUT, 'pages.csv'), prow.map((r) => r.map(csv).join(',')).join('\n') + '\n');

  // archive-index.md
  const L = [];
  const blocked = records.filter((r) => r.access && r.access !== 'ok');
  const memberUploads = sorted.filter(([u, a]) => riskFor(u, a).startsWith('HIGH') && !['link', 'font', 'code'].includes(a.type));
  L.push('# Organized Mom Collective — WordPress archive', '');
  L.push(`Captured ${new Date().toISOString()} · ${records.length} pages · ${assets.size} asset URLs · auth: ${COOKIES || STATE || process.env.OMC_COOKIE ? 'logged-in session supplied' : 'anonymous'}`, '');
  L.push('Read-only capture: GET/HEAD only, non-GET browser requests aborted, download/action URLs listed but never requested.', '');
  L.push('## Folder structure', '', '```',
    'site-archive/',
    '  archive-index.md        this file',
    '  assets.csv              every PDF/image/audio/video/download URL found, with reroute risk',
    '  pages.csv               every page, access status, priority tags, duplicates',
    '  crawl-log.jsonl         full request log',
    '  discovery/<host>/       robots.txt, sitemaps, wp-json listings (pages, posts, media, products)',
    '  pages/<host>/<slug>/    page.md, raw.html, rendered.html, meta.json, screenshots/',
    '    screenshots/          desktop-full.png, desktop-above-fold.png, mobile-full.png, closeup-NN.png',
    DOWNLOAD_UPLOADS ? '  uploads/<host>/         local copies of /wp-content/uploads/ files' : '  (uploads not downloaded; rerun with --download-uploads to mirror them)',
    '```', '');

  L.push('## Priority pages', '');
  for (const [key] of PRIORITIES) {
    const hits = records.filter((r) => r.priority?.includes(key));
    L.push(`### ${key}`, '');
    if (!hits.length) { L.push('_Not found in sitemap, wp-json or links._', ''); continue; }
    for (const r of hits) L.push(`- [${r.title || r.url}](${r.dir}/page.md) — ${r.url} · \`${r.access}\`${r.duplicates.length ? ' · dup: ' + r.duplicates.map((d) => d.kind).join(', ') : ''}`);
    L.push('');
  }

  L.push('## Blocked by login / paywall / errors', '');
  if (!blocked.length) L.push('_None._');
  for (const r of blocked) L.push(`- ${r.url} → \`${r.access}\`${r.finalUrl && r.finalUrl !== r.url ? ` (landed on ${r.finalUrl})` : ''}${r.error ? ' — ' + r.error : ''}`);
  L.push('');

  L.push('## Assets that break if members.organizedmomcollective.com is rerouted', '');
  L.push(`${memberUploads.length} asset URLs live on the members subdomain. Full list with HEAD status in \`assets.csv\` (filter reroute_risk = HIGH).`, '');
  const byType = {};
  for (const [, a] of memberUploads) byType[a.type] = (byType[a.type] || 0) + 1;
  for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) L.push(`- ${t}: ${c}`);
  L.push('');
  for (const [u, a] of memberUploads.filter(([, a]) => ['pdf', 'audio', 'video', 'document', 'archive', 'download-action'].includes(a.type)).slice(0, 300)) {
    L.push(`- **${a.type}** ${u}${a.labels.size ? ' — ' + [...a.labels][0] : ''}`);
  }
  L.push('');

  L.push('## Duplicates and near-duplicates', '');
  const dups = records.filter((r) => r.duplicates.length);
  if (!dups.length) L.push('_None detected._');
  for (const r of dups) L.push(`- ${r.url} ↔ ${r.duplicates.map((d) => `${d.url} (${d.kind})`).join(', ')}`);
  L.push('');

  for (const host of [...new Set(records.map((r) => r.host))]) {
    L.push(`## All pages — ${host}`, '', '| Page | Status | Access | Priority | Words | Screens |', '|---|---|---|---|---|---|');
    for (const r of records.filter((x) => x.host === host).sort((a, b) => a.url.localeCompare(b.url))) {
      L.push(`| [${(r.title || new URL(r.url).pathname).replace(/\|/g, '/')}](${r.dir}/page.md)<br>${new URL(r.url).pathname} | ${r.status ?? ''} | ${r.access} | ${(r.priority || []).join(', ')} | ${r.wordCount ?? ''} | ${(r.screens || []).length} |`);
    }
    L.push('');
  }

  const skipped = [...discovered.keys()].filter((u) => isSkipped(u) && !records.find((r) => r.url === u));
  L.push('## Skipped on purpose (WP/Woo plumbing)', '');
  for (const u of skipped.sort()) L.push(`- ${u}`);
  if (!skipped.length) L.push('_None._');
  L.push('');
  write(path.join(OUT, 'archive-index.md'), L.join('\n'));
}

// ---------------------------------------------------------------- main

async function main() {
  const browser = await chromium.launch({ executablePath: exePath, headless: !LOGIN });
  if (LOGIN) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`https://${MEMBERS_HOST}/wp-login.php`);
    console.log('Log in in the browser window, then press Enter here.');
    await new Promise((r) => process.stdin.once('data', r));
    await ctx.storageState({ path: STATE || 'state.json' });
    console.log('Saved', STATE || 'state.json');
    await browser.close();
    return;
  }

  mkdirp(OUT);
  const api = await browser.newContext({ userAgent: (await browser.newPage().then(async (p) => { const ua = await p.evaluate(() => navigator.userAgent); await p.context().close(); return ua; })) + UA_SUFFIX, storageState: STATE && fs.existsSync(STATE) ? STATE : undefined });
  await applyAuth(api);

  await discover(api);
  log({ event: 'discovered', note: `${queue.length} pages queued, ${assets.size} assets` });

  const records = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length && records.length < MAX_PAGES) {
      const u = queue.shift();
      records.push(await capturePage(browser, u));
      await sleep(400);
    }
  }));
  if (queue.length) log({ event: 'max-pages-reached', note: `${queue.length} pages left in queue` });

  await checkAssets(api);
  reports(records);
  await browser.close();
  console.log(`Done: ${records.length} pages, ${assets.size} assets → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
