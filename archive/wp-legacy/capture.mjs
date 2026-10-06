#!/usr/bin/env node
// Read-only visual archive of the legacy WordPress members site.
//
// Discovers pages (sitemaps + WP REST API + link crawl), skips WP/WooCommerce
// plumbing and anything that could change state, then captures desktop,
// mobile and close-up screenshots plus page copy and a downloads manifest.
// Only ever issues GET navigations (plus the login form submit when asked).
//
// Usage: see README.md in this folder.

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

// ---------------------------------------------------------------- config

const env = process.env;
const args = new Set(process.argv.slice(2));
const argVal = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const ORIGINS = (argVal('origins', env.ARCHIVE_ORIGINS) || 'https://members.organizedmomcollective.com')
  .split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
const HOSTS = new Set(ORIGINS.map((o) => new URL(o).host));
const OUT = path.resolve(argVal('out', env.ARCHIVE_OUT || `output/${new Date().toISOString().slice(0, 10)}`));
const MAX_PAGES = Number(argVal('max-pages', env.ARCHIVE_MAX_PAGES || 400));
const CRAWL_DEPTH = Number(argVal('depth', env.ARCHIVE_DEPTH || 4));
const DUP_THRESHOLD = Number(argVal('dup-threshold', env.ARCHIVE_DUP_THRESHOLD || 0.82));
const MAX_DETAILS = Number(argVal('max-details', 12));
const LOGIN_URL = argVal('login-url', env.WP_LOGIN_URL || `${ORIGINS[0]}/wp-login.php`);
const STORAGE_STATE = argVal('storage-state', env.WP_STORAGE_STATE);
const MANUAL_LOGIN = args.has('--manual-login');
const DISCOVER_ONLY = args.has('--discover-only');
const EXTRA_URLS = (argVal('urls', env.ARCHIVE_EXTRA_URLS) || '').split(',').map((s) => s.trim()).filter(Boolean);
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const MOBILE = {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

// URLs we never load. Anything that could mutate state is in here — GET
// links like logout, add-to-cart and nonce'd actions included.
const UNSAFE = [
  /logout/i, /log-out/i, /[?&]action=/i, /_wpnonce/i, /add-to-cart/i, /remove_item/i, /undo_item/i,
  /[?&](cancel|delete|unsubscribe|resubscribe|pause|resume|switch)/i, /\/wp-admin/i, /xmlrpc/i,
  /\/wp-json/i, /\/feed\/?$/i, /[?&](download|dlm|dlm_download|wpdmdl|download_file|download_id)=/i, /\/download\/[^/]+/i, /\/(cancel|delete)[-_/]/i, /mepr-(process|unauth)/i,
];
// Generic plumbing the user asked us to skip.
const PLUMBING = [
  /\/(cart|basket|checkout|my-account|account|orders?|order-received|order-pay|view-order|edit-address|edit-account|payment-methods|subscriptions?)(\/|$)/i,
  /\/(wp-login|login|register|lost-password|password-reset|reset-password|forgot-password)(\.php)?(\/|$)/i,
  /\/(privacy|privacy-policy|terms|terms-of-service|terms-and-conditions|terms-conditions|refund|refund[-_]policy|returns?|shipping|cookie|cookies|cookie-policy|disclaimer|accessibility|dmca)(\/|$|-)/i,
  /\/(product-category|product-tag|category|tag|author|page\/\d+|shop)(\/|$)/i,
  /\/(sample-page|hello-world)(\/|$)/i, /[?&](attachment_id|replytocom|s|orderby|filter_|min_price|max_price)=/i,
  /\.(xml|xsl|txt|json|css|js|pdf|zip|docx?|xlsx?|pptx?|mp3|m4a|wav|mp4|mov|png|jpe?g|gif|webp|svg)(\?|$)/i,
];

// Priority buckets, in the order the user listed them. First match wins.
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const PRIORITY = [
  { key: 'members-home', name: 'Members homepage', test: (u) => u.pathname === '/' && u.origin === ORIGINS[0] },
  { key: 'tidy', name: 'Tidy / cleaning system', test: (u, t) => /tidy|clean/i.test(u.pathname + ' ' + t) },
  { key: 'june', name: 'June monthly coaching', test: (u, t) => /june/i.test(u.pathname) || /\bjune\b/i.test(t) },
  { key: 'month', name: 'Monthly coaching', test: (u, t) => MONTHS.some((m) => u.pathname.toLowerCase().includes(m) || new RegExp(`\\b${m}\\b`, 'i').test(t)) && /month|coach|theme|focus|challenge|\d{4}/i.test(u.pathname + ' ' + t) },
  { key: 'family-table', name: 'Family Table / meal planning', test: (u, t) => /family[-\s]?table|meal|recipe|menu|grocer/i.test(u.pathname + ' ' + t) },
  { key: 'resources', name: 'Resource / download library', test: (u, t) => /resource|download|library|printable|vault|toolkit/i.test(u.pathname + ' ' + t) },
  { key: 'dashboard', name: 'Member dashboard', test: (u, t) => /dashboard|member[s]?[-_]?(home|area|hub|portal)|my[-_]membership|courses?\/?$/i.test(u.pathname + ' ' + t) },
  { key: 'start-here', name: 'Start Here / onboarding', test: (u, t) => /start[-\s]?here|onboard|welcome|getting[-\s]?started|orientation|new[-\s]?member/i.test(u.pathname + ' ' + t) },
  { key: 'progress', name: 'Progress tracking', test: (u, t) => /progress|tracker|streak|badge|achievement|milestone/i.test(u.pathname + ' ' + t) },
  { key: 'audio', name: 'Audio coaching', test: (u, t, f) => f?.audio || /audio|podcast|listen|coaching[-\s]?call|episode/i.test(u.pathname + ' ' + t) },
  { key: 'daily-rhythm-starter-pack', name: 'Daily Rhythm Starter Pack', test: (u, t) => /daily[-\s]?rhythm/i.test(u.pathname + ' ' + t) },
  { key: 'essential-routines-bundle', name: 'Essential Routines Bundle', test: (u, t) => /essential[-\s]?routines/i.test(u.pathname + ' ' + t) },
  { key: 'complete-control-system-bundle', name: 'Complete Control System Bundle', test: (u, t) => /complete[-\s]?control/i.test(u.pathname + ' ' + t) },
  { key: 'family-sanity-saver-starter-kit', name: 'Family Sanity Saver Starter Kit', test: (u, t) => /sanity[-\s]?saver/i.test(u.pathname + ' ' + t) },
  { key: 'real-life-reset-kit', name: 'Real Life Reset Kit', test: (u, t) => /real[-\s]?life[-\s]?reset/i.test(u.pathname + ' ' + t) },
  { key: 'wall-calendar', name: 'Organized Mom Wall Calendar offer', test: (u, t) => /wall[-\s]?calendar/i.test(u.pathname + ' ' + t) || (/calendar/i.test(u.pathname) && !MONTHS.some((m) => u.pathname.toLowerCase().includes(m))) },
];
// Product bundles are named explicitly, so test them before the generic buckets
// (e.g. "Daily Rhythm Starter Pack" would otherwise land in "start-here").
const BUNDLE_KEYS = new Set(['daily-rhythm-starter-pack', 'essential-routines-bundle', 'complete-control-system-bundle', 'family-sanity-saver-starter-kit', 'real-life-reset-kit', 'wall-calendar']);
const PRIORITY_ORDER = [...PRIORITY.filter((p) => BUNDLE_KEYS.has(p.key)), ...PRIORITY.filter((p) => !BUNDLE_KEYS.has(p.key))];

const ASSET_RE = /\.(pdf|zip|docx?|xlsx?|pptx?|key|pages|numbers|epub|mp3|m4a|wav|aac|ogg|mp4|mov|m4v|webm|ics|csv)(\?|#|$)/i;

// ---------------------------------------------------------------- helpers

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalize(raw, base) {
  try {
    const u = new URL(raw, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$|_ga)/i.test(k)) u.searchParams.delete(k);
    if (u.pathname !== '/' && !u.pathname.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(u.pathname)) u.pathname += '/';
    return u.toString();
  } catch { return null; }
}
const isUnsafe = (url) => UNSAFE.some((re) => re.test(url));
const isPlumbing = (url) => PLUMBING.some((re) => re.test(new URL(url).pathname + new URL(url).search));
const inScope = (url) => HOSTS.has(new URL(url).host);

function slugFor(url) {
  const u = new URL(url);
  const s = (u.pathname.replace(/^\/|\/$/g, '') || 'home').split('/').slice(-2).join('-');
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'page';
}

function shingles(text, n = 5) {
  const words = text.toLowerCase().replace(new RegExp(`\\b(${MONTHS.join('|')})\\b`, 'g'), ' ')
    .replace(/\b\d+\b/g, ' ').split(/[^a-z']+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + n <= words.length; i++) set.add(words.slice(i, i + n).join(' '));
  return set;
}
const layoutSig = (r) => JSON.stringify([r.headings.map((h) => h.level), Object.entries(r.components).filter(([k]) => k !== 'illustrations').map(([k, v]) => [k, Math.min(Number(v), 5)]), Math.min(r.images.length, 6)]);
function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

async function fetchText(ctx, url) {
  try {
    const r = await ctx.request.get(url, { timeout: 20000, failOnStatusCode: false });
    if (!r.ok()) return null;
    return await r.text();
  } catch { return null; }
}

// ---------------------------------------------------------------- discovery

async function discoverSitemaps(ctx) {
  const found = new Set();
  const queue = [];
  for (const o of ORIGINS) {
    queue.push(`${o}/wp-sitemap.xml`, `${o}/sitemap_index.xml`, `${o}/sitemap.xml`, `${o}/page-sitemap.xml`, `${o}/product-sitemap.xml`);
    const robots = await fetchText(ctx, `${o}/robots.txt`);
    for (const m of robots?.matchAll(/^sitemap:\s*(\S+)/gim) || []) queue.push(m[1]);
  }
  const seen = new Set();
  while (queue.length) {
    const sm = queue.shift();
    if (seen.has(sm) || seen.size > 200) continue;
    seen.add(sm);
    const xml = await fetchText(ctx, sm);
    if (!xml || !/<(urlset|sitemapindex)/i.test(xml)) continue;
    const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
    if (/<sitemapindex/i.test(xml)) {
      // Skip taxonomy/user sitemaps; we only want real pages.
      for (const l of locs) if (!/(taxonom|categor|tag|users?|author)/i.test(l)) queue.push(l);
    } else {
      for (const l of locs) { const n = normalize(l); if (n) found.add(n); }
    }
  }
  return found;
}

async function discoverRest(ctx) {
  // Public WP REST listing catches published landing pages that aren't in a
  // sitemap or linked anywhere. Types that 404 are simply skipped.
  const found = new Map();
  for (const o of ORIGINS) {
    for (const type of ['pages', 'posts', 'product', 'mpcs-course', 'mpcs-lesson', 'sfwd-courses', 'sfwd-lessons', 'sfwd-topic', 'lp_course', 'llms_course', 'llms_lesson', 'elementor_library', 'landing', 'landing-page']) {
      for (let page = 1; page <= 20; page++) {
        const body = await fetchText(ctx, `${o}/wp-json/wp/v2/${type}?per_page=100&page=${page}&_fields=link,title,type,template,status`);
        if (!body) break;
        let rows;
        try { rows = JSON.parse(body); } catch { break; }
        if (!Array.isArray(rows) || !rows.length) break;
        for (const r of rows) {
          const n = r.link && normalize(r.link);
          if (n) found.set(n, { restType: r.type || type, title: r.title?.rendered || '' });
        }
        if (rows.length < 100) break;
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------- page work

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // Close common popups / cookie banners (click only on close/dismiss controls).
  await page.evaluate(() => {
    const closeSel = [
      '.pum-close', '.popmake-close', '[aria-label="Close"]', '[aria-label="close"]', '.mfp-close', '.modal .close',
      '.cky-btn-accept', '#cookie_action_close_header', '.cmplz-accept', '#onetrust-accept-btn-handler', '.cn-set-cookie',
      '.klaviyo-close-form', '.needsclick button[aria-label*="Close" i]', '.elementor-popup-modal .dialog-close-button',
    ];
    for (const s of closeSel) document.querySelectorAll(s).forEach((el) => { if (el.offsetParent !== null && !el.closest('form:not(.klaviyo-form)')) el.click?.(); });
  }).catch(() => {});
  // Scroll through to trigger lazy-loaded images and scroll animations.
  await page.evaluate(async () => {
    const step = Math.max(400, window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
    document.querySelectorAll('img[data-src],img[data-lazy-src]').forEach((i) => { i.src = i.dataset.lazySrc || i.dataset.src; });
    window.scrollTo(0, 0);
  }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  // Freeze animations and un-hide reveal-on-scroll content so full-page shots are complete.
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}
      .elementor-invisible,.wow,.aos-init,[data-aos]{visibility:visible!important;opacity:1!important;transform:none!important}
      .pum-overlay,.pum-container,#cookie-notice,.cky-consent-container,.cmplz-cookiebanner,#onetrust-banner-sdk,.elementor-popup-modal,.klaviyo-form-overlay{display:none!important}`,
  }).catch(() => {});
  await sleep(400);
}

// Extract copy, outline, assets and component fingerprints from a loaded page.
async function inspect(page) {
  return page.evaluate((assetSrc) => {
    const assetRe = new RegExp(assetSrc, 'i');
    const abs = (u) => { try { return new URL(u, location.href).toString(); } catch { return null; } };
    const main = document.querySelector('main, #main, .site-main, #content, .entry-content, article') || document.body;
    const text = (main.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    const headings = [...document.querySelectorAll('h1,h2,h3')].filter((h) => h.offsetParent !== null)
      .map((h) => ({ level: Number(h.tagName[1]), text: h.innerText.trim().replace(/\s+/g, ' ') })).filter((h) => h.text).slice(0, 60);
    const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: abs(a.getAttribute('href')), text: (a.innerText || a.title || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 120) })).filter((l) => l.href);
    const downloads = links.filter((l) => assetRe.test(l.href) || /download|printable|worksheet|pdf/i.test(l.text) || /[?&](download|dlm|wpdmdl)=|\/download\//i.test(l.href));
    const media = [];
    document.querySelectorAll('audio, audio source, video, video source').forEach((m) => { const s = m.currentSrc || m.src || m.getAttribute('src'); if (s) media.push({ kind: m.closest('audio') ? 'audio' : 'video', src: abs(s) }); });
    document.querySelectorAll('iframe[src]').forEach((f) => { const s = abs(f.getAttribute('src')); if (s && /youtube|vimeo|wistia|loom|soundcloud|libsyn|buzzsprout|spotify|anchor|podbean|captivate|transistor|hearthis|bunny|vidyard/i.test(s)) media.push({ kind: 'embed', src: s }); });
    const images = [...new Set([...document.querySelectorAll('img')].filter((i) => i.naturalWidth >= 120 || i.width >= 120)
      .map((i) => abs(i.currentSrc || i.src)).filter((s) => s && !s.startsWith('data:')))];
    const bgImages = [...new Set([...main.querySelectorAll('*')].slice(0, 4000).map((el) => getComputedStyle(el).backgroundImage)
      .filter((b) => b && b.startsWith('url(')).map((b) => abs(b.slice(4, -1).replace(/["']/g, ''))).filter(Boolean))];
    const svgs = main.querySelectorAll('svg').length;
    const q = (s) => main.querySelectorAll(s).length;
    const components = {
      audio: media.some((m) => m.kind === 'audio') || media.some((m) => /soundcloud|libsyn|buzzsprout|spotify|anchor|podbean|captivate|transistor/i.test(m.src)) || q('.mejs-audio, .wp-block-audio, [class*="audio-player"], [class*="podcast"]') > 0,
      video: media.some((m) => m.kind !== 'audio'),
      tabs: q('[role="tablist"], .elementor-tabs, .wp-block-tabs, .tabs, .et_pb_tabs'),
      accordions: q('details, .elementor-accordion, .elementor-toggle, .wp-block-details, [class*="accordion"]'),
      checklists: q('input[type="checkbox"], [class*="checklist"], .wp-block-list.is-style-checkmark, [class*="todo"]'),
      progress: q('progress, [role="progressbar"], [class*="progress"], [class*="tracker"], [class*="streak"]'),
      forms: q('form:not([role="search"]):not(.search-form)'),
      calendars: q('[class*="calendar"], table.wp-calendar-table'),
      cards: q('[class*="card"], .wp-block-column, .elementor-column, .et_pb_column'),
      buttons: q('.wp-block-button, .elementor-button, .button, .btn, button'),
      pricing: q('[class*="price"], [class*="pricing"], .woocommerce-Price-amount'),
      testimonials: q('[class*="testimonial"], blockquote, .wp-block-quote'),
      illustrations: svgs + images.filter((s) => /\.(svg|png)(\?|$)/i.test(s)).length,
    };
    const bodyClass = document.body.className;
    return {
      title: document.title.trim(), h1: headings.find((h) => h.level === 1)?.text || '', text, headings, links: links.map((l) => l.href),
      downloads, media, images, bgImages, components, bodyClass,
      isProduct: /single-product|product-template/.test(bodyClass) || !!document.querySelector('.single-product, form.cart'),
      isGated: /login|log in|members only|restricted|you must be|please sign in|unauthorized/i.test(text.slice(0, 600)) && !!document.querySelector('form input[type="password"]'),
      height: document.documentElement.scrollHeight,
    };
  }, ASSET_RE.source);
}

// Visible, sizeable top-level content blocks for close-up shots.
async function sectionHandles(page) {
  const sel = [
    '.elementor-top-section', '.e-con.e-parent', '.elementor-section-wrap > section', '.et_pb_section', '.fl-row',
    '.entry-content > .wp-block-group', '.entry-content > .wp-block-cover', '.entry-content > .wp-block-columns',
    '.entry-content > .wp-block-media-text', '.entry-content > .wp-block-table', '.entry-content > figure',
    'main > section', 'article > section', '.woocommerce-product-gallery', '.summary.entry-summary', '.woocommerce-tabs',
  ].join(',');
  const handles = await page.$$(sel);
  const out = [];
  for (const h of handles) {
    const ok = await h.evaluate((el, sel) => {
      const r = el.getBoundingClientRect();
      const nested = el.parentElement?.closest(sel);
      return r.height >= 180 && r.width >= 300 && !nested && getComputedStyle(el).display !== 'none' && (el.innerText.trim().length > 20 || el.querySelector('img,svg,video,iframe,audio'));
    }, sel).catch(() => false);
    if (ok) out.push(h);
  }
  return out;
}

// ---------------------------------------------------------------- main

async function login(browser) {
  if (STORAGE_STATE && existsSync(STORAGE_STATE)) { log(`Using saved session ${STORAGE_STATE}`); return STORAGE_STATE; }
  const ctx = await browser.newContext(DESKTOP);
  const page = await ctx.newPage();
  if (MANUAL_LOGIN) {
    await page.goto(LOGIN_URL);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question('\nLog in in the browser window (use a member account that can see everything), then press Enter here... ');
    rl.close();
  } else if (env.WP_USER && env.WP_PASS) {
    log(`Logging in as ${env.WP_USER} via ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    const user = page.locator('#user_login, input[name="log"], input[name="username"], input[type="email"], input[name="email"]').first();
    const pass = page.locator('#user_pass, input[name="pwd"], input[name="password"], input[type="password"]').first();
    await user.fill(env.WP_USER);
    await pass.fill(env.WP_PASS);
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}),
      pass.press('Enter'),
    ]);
    await sleep(1500);
    const cookies = await ctx.cookies();
    if (!cookies.some((c) => /wordpress_logged_in|mepr|woocommerce_session|wp_.*logged/i.test(c.name))) log('WARNING: no WordPress login cookie after submit — check credentials / LOGIN_URL. Continuing as a visitor.');
  } else {
    log('No login configured — archiving public view only. Set WP_USER/WP_PASS or use --manual-login for member pages.');
    await ctx.close();
    return undefined;
  }
  const statePath = path.join(OUT, '.session.json');
  await mkdir(OUT, { recursive: true });
  await ctx.storageState({ path: statePath });
  await ctx.close();
  return statePath;
}

async function main() {
  await mkdir(path.join(OUT, 'screenshots'), { recursive: true });
  await mkdir(path.join(OUT, 'text'), { recursive: true });
  await mkdir(path.join(OUT, 'html'), { recursive: true });

  const launch = { headless: !MANUAL_LOGIN };
  if (existsSync(LOCAL_CHROMIUM)) launch.executablePath = LOCAL_CHROMIUM;
  const browser = await chromium.launch(launch);
  const storageState = await login(browser);
  const desktop = await browser.newContext({ ...DESKTOP, storageState });
  const mobile = await browser.newContext({ ...MOBILE, storageState });
  const detail = await browser.newContext({ ...DESKTOP, deviceScaleFactor: 2, storageState });

  // ---- discovery
  log(`Discovering pages on ${ORIGINS.join(', ')}`);
  const sitemapUrls = await discoverSitemaps(desktop);
  const restUrls = await discoverRest(desktop);
  log(`sitemaps: ${sitemapUrls.size} urls, REST: ${restUrls.size} urls`);
  const sources = new Map(); // url -> Set(source)
  const add = (u, src) => { const n = normalize(u); if (!n || !inScope(n)) return; if (!sources.has(n)) sources.set(n, new Set()); sources.get(n).add(src); };
  for (const o of ORIGINS) add(`${o}/`, 'seed');
  for (const u of EXTRA_URLS) add(u, 'manual');
  for (const u of sitemapUrls) add(u, 'sitemap');
  for (const [u] of restUrls) add(u, 'rest');

  // ---- crawl + inspect (desktop pass)
  const records = new Map();
  const skipped = [];
  const queue = [...sources.keys()].map((u) => ({ url: u, depth: 0 }));
  const visited = new Set();
  const page = await desktop.newPage();
  while (queue.length && records.size < MAX_PAGES) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    if (isUnsafe(url)) { skipped.push({ url, reason: 'unsafe (could change state)' }); continue; }
    if (isPlumbing(url)) { skipped.push({ url, reason: 'WP/WooCommerce plumbing' }); continue; }
    let resp;
    try { resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) { skipped.push({ url, reason: `load failed: ${e.message.split('\n')[0]}` }); continue; }
    const finalUrl = normalize(page.url());
    if (!finalUrl || !inScope(finalUrl) || (finalUrl !== url && (isPlumbing(finalUrl) || isUnsafe(finalUrl)))) { skipped.push({ url, reason: `redirected to ${page.url()}` }); continue; }
    if (finalUrl !== url && records.has(finalUrl)) { records.get(finalUrl).aliases.push(url); continue; }
    visited.add(finalUrl);
    await settle(page);
    const info = await inspect(page);
    const status = resp?.status() ?? 0;
    if (status >= 400) { skipped.push({ url, reason: `HTTP ${status}` }); continue; }
    const rec = {
      url: finalUrl, aliases: finalUrl !== url ? [url] : [], status, sources: [...(sources.get(url) || ['crawl'])], depth,
      restType: restUrls.get(url)?.restType || restUrls.get(finalUrl)?.restType, ...info,
      html: await page.content(), shingles: null,
    };
    rec.shingles = shingles(rec.text);
    records.set(finalUrl, rec);
    log(`[${records.size}] ${status} ${finalUrl} — ${info.h1 || info.title}`);
    if (depth < CRAWL_DEPTH) for (const l of info.links) { const n = normalize(l); if (n && inScope(n) && !visited.has(n)) { if (!sources.has(n)) sources.set(n, new Set(['crawl'])); queue.push({ url: n, depth: depth + 1 }); } }
  }
  await page.close();

  // ---- classify + dedupe
  const all = [...records.values()];
  for (const r of all) {
    const u = new URL(r.url);
    const label = `${r.h1} ${r.title}`;
    const bucket = PRIORITY_ORDER.find((p) => p.test(u, label, r.components));
    r.bucket = bucket?.key || (r.isProduct ? 'product' : r.restType === 'post' ? 'post' : 'landing');
    r.bucketName = bucket?.name || (r.isProduct ? 'Other product page' : r.restType === 'post' ? 'Blog post' : 'Landing page');
    r.visualScore = r.components.illustrations + r.images.length + r.bgImages.length;
  }
  const rank = (r) => { const i = PRIORITY.findIndex((p) => p.key === r.bucket); return i >= 0 ? i : r.bucket === 'landing' ? 50 : r.bucket === 'product' ? 60 : 70; };
  all.sort((a, b) => rank(a) - rank(b) || b.visualScore - a.visualScore || a.url.localeCompare(b.url));

  // Duplicate detection: a page whose copy (month names/numbers stripped) is
  // near-identical to one already kept, AND has the same heading skeleton, is
  // listed in the index but not screenshotted. Months are compared to June first.
  const kept = [];
  const june = all.find((r) => r.bucket === 'june');
  for (const r of all) {
    if (r.isGated) { r.note = 'Rendered a login/paywall wall for this session — log in with a full-access account to capture it.'; }
    let best = { sim: 0, of: null };
    const pool = r.bucket === 'month' && june ? [june, ...kept.filter((k) => k.bucket === 'month')] : kept.filter((k) => k.bucket === r.bucket || (r.isProduct && k.isProduct));
    for (const k of pool) { if (k === r) continue; const s = jaccard(r.shingles, k.shingles); if (s > best.sim) best = { sim: s, of: k }; }
    // Non-bundle products (merch etc.): the layout is what matters, so match on
    // structure — heading skeleton + component mix — not on description copy.
    if (r.bucket === 'product') {
      const twin = kept.find((k) => k.bucket === 'product' && layoutSig(k) === layoutSig(r));
      if (twin && !r.downloads.length) { r.duplicateOf = twin.url; r.similarity = Math.max(best.sim, jaccard(r.shingles, twin.shingles)); r.dupReason = 'same product layout'; continue; }
    }
    const structural = best.of && best.of.headings.length === r.headings.length;
    const visualSame = best.of && Math.abs(best.of.visualScore - r.visualScore) <= 2;
    const mustKeep = BUNDLE_KEYS.has(r.bucket) || ['members-home', 'june', 'tidy', 'family-table', 'resources', 'dashboard', 'start-here', 'progress', 'audio'].includes(r.bucket) && !kept.some((k) => k.bucket === r.bucket);
    if (!mustKeep && best.sim >= DUP_THRESHOLD && (structural || visualSame)) {
      r.duplicateOf = best.of.url; r.similarity = best.sim; continue;
    }
    if (best.of) r.closestMatch = { url: best.of.url, similarity: best.sim };
    kept.push(r);
  }

  // Number everything kept; priority + visually rich pages get close-ups.
  let n = 0;
  const taken = new Set();
  for (const r of kept) {
    n++;
    let base = r.bucket === 'members-home' ? 'members-home' : r.bucket === 'landing' || r.bucket === 'product' || r.bucket === 'post' || r.bucket === 'month' ? slugFor(r.url) : `${r.bucket}${r.bucket === slugFor(r.url) ? '' : '-' + slugFor(r.url)}`;
    if (['june', 'tidy', 'family-table', 'resources', 'dashboard', 'start-here', 'progress', 'audio'].includes(r.bucket) && !taken.has(r.bucket)) base = r.bucket;
    if (BUNDLE_KEYS.has(r.bucket) && !taken.has(r.bucket)) base = r.bucket;
    base = base.replace(/-+/g, '-').slice(0, 70);
    taken.add(base);
    r.prefix = `${String(n).padStart(2, '0')}-${base}`;
    r.wantDetails = rank(r) < 50 || r.visualScore >= 12 || r.components.audio || r.components.progress > 0 || r.components.checklists > 2;
  }

  if (DISCOVER_ONLY) {
    await writeOutputs(kept, all, skipped, { discoverOnly: true });
    await browser.close();
    log(`Discovery only: ${kept.length} pages to capture, ${all.length - kept.length} duplicates, ${skipped.length} skipped. See ${OUT}/archive-index.md`);
    return;
  }

  // ---- screenshots
  for (const r of kept) {
    r.files = [];
    log(`Capturing ${r.prefix} ← ${r.url}`);
    const shoot = async (ctx, suffix, opts = {}) => {
      const p = await ctx.newPage();
      try {
        await p.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await settle(p);
        const file = `${r.prefix}-${suffix}.png`;
        await p.screenshot({ path: path.join(OUT, 'screenshots', file), fullPage: true, ...opts });
        r.files.push(file);
        return p;
      } catch (e) { log(`  ! ${suffix} failed: ${e.message.split('\n')[0]}`); await p.close(); return null; }
    };
    const dp = await shoot(desktop, 'desktop');
    await dp?.close();
    const mp = await shoot(mobile, 'mobile');
    await mp?.close();

    if (r.wantDetails) {
      const p = await detail.newPage();
      try {
        await p.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await settle(p);
        const secs = await sectionHandles(p);
        let i = 0;
        for (const h of secs) {
          if (i >= MAX_DETAILS) break;
          const box = await h.boundingBox();
          if (!box) continue;
          const file = `${r.prefix}-detail-${String(++i).padStart(2, '0')}.png`;
          await h.screenshot({ path: path.join(OUT, 'screenshots', file) }).then(() => r.files.push(file)).catch(() => i--);
        }
        // No recognisable section markup: fall back to 1400px viewport slices at 2x.
        if (!i && r.height > 1800) {
          const shotH = 1400;
          for (let y = 0; y < Math.min(r.height, shotH * MAX_DETAILS); y += shotH) {
            const file = `${r.prefix}-detail-${String(++i).padStart(2, '0')}.png`;
            await p.screenshot({ path: path.join(OUT, 'screenshots', file), fullPage: true, clip: { x: 0, y, width: 1440, height: Math.min(shotH, r.height - y) } }).then(() => r.files.push(file)).catch(() => {});
          }
        }
      } catch (e) { log(`  ! details failed: ${e.message.split('\n')[0]}`); }
      await p.close();
    }
    await writeFile(path.join(OUT, 'text', `${r.prefix}.md`), `# ${r.h1 || r.title}\n\nSource: ${r.url}\n\n${r.text}\n`);
    await writeFile(path.join(OUT, 'html', `${r.prefix}.html`), r.html);
  }

  await writeOutputs(kept, all, skipped, {});
  await browser.close();
  log(`Done. ${kept.length} pages captured → ${OUT}`);
}

// ---------------------------------------------------------------- outputs

function preserveNotes(r) {
  const c = r.components;
  const notes = [];
  if (r.headings.length) notes.push(`Content outline: ${r.headings.filter((h) => h.level <= 2).slice(0, 10).map((h) => h.text).join(' → ')}`);
  const comp = [];
  if (c.audio) comp.push('audio player / coaching audio');
  if (c.video) comp.push('video embeds');
  if (c.progress) comp.push(`progress/tracker UI (${c.progress})`);
  if (c.checklists) comp.push(`checklists / checkboxes (${c.checklists})`);
  if (c.tabs) comp.push(`tabbed sections (${c.tabs})`);
  if (c.accordions) comp.push(`accordions/toggles (${c.accordions})`);
  if (c.calendars) comp.push('calendar layout');
  if (c.pricing) comp.push('pricing / offer stack');
  if (c.testimonials) comp.push(`testimonials/quotes (${c.testimonials})`);
  if (c.forms) comp.push(`forms (${c.forms})`);
  if (comp.length) notes.push(`UX components: ${comp.join(', ')}`);
  if (r.visualScore) notes.push(`Visual assets: ${r.images.length} images, ${r.bgImages.length} background images, ${c.illustrations} illustrations/icons/SVGs`);
  if (r.downloads.length) notes.push(`${r.downloads.length} download link(s) — printable/worksheet content`);
  if (r.text.length > 2500) notes.push(`Long-form copy (~${Math.round(r.text.split(/\s+/).length / 10) * 10} words) saved in text/${r.prefix}.md`);
  if (r.closestMatch && r.bucket === 'month') notes.push(`Differs from ${r.closestMatch.url} (copy similarity ${(r.closestMatch.similarity * 100).toFixed(0)}%)`);
  if (r.note) notes.push(`⚠️ ${r.note}`);
  return notes;
}

const uploadsOnly = (u) => /\/wp-content\/uploads\//i.test(u);

async function writeOutputs(kept, all, skipped, { discoverOnly }) {
  const strip = ({ html, shingles, links, text, ...rest }) => rest;
  const assetRows = [];
  for (const r of kept) {
    for (const d of r.downloads) assetRows.push({ page: r.prefix, type: (d.href.match(ASSET_RE)?.[1] || 'link').toLowerCase(), url: d.href, label: d.text });
    for (const m of r.media) assetRows.push({ page: r.prefix, type: m.kind, url: m.src, label: '' });
    for (const i of [...r.images, ...r.bgImages].filter(uploadsOnly)) assetRows.push({ page: r.prefix, type: 'image', url: i, label: '' });
  }
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), origins: ORIGINS, pages: kept.map(strip), duplicates: all.filter((r) => r.duplicateOf).map(strip), skipped }, null, 2));
  const csvEsc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  await writeFile(path.join(OUT, 'assets.csv'), ['page,type,url,label', ...assetRows.map((a) => [a.page, a.type, a.url, a.label].map(csvEsc).join(','))].join('\n') + '\n');

  const md = [];
  md.push('# Legacy WordPress Visual Archive', '');
  md.push(`Captured ${new Date().toISOString().slice(0, 10)} from ${ORIGINS.join(', ')} before \`members.organizedmomcollective.com\` was rerouted to the new app. Read-only: nothing on the WordPress site was changed.`, '');
  if (discoverOnly) md.push('> **Discovery run only — no screenshots yet.** Re-run without `--discover-only` to capture.', '');
  md.push(`- **${kept.length}** pages captured · **${all.filter((r) => r.duplicateOf).length}** skipped as duplicates · **${skipped.length}** skipped as plumbing/unsafe/broken`);
  md.push('- `screenshots/` — `NN-name-desktop.png` (1440px full page), `NN-name-mobile.png` (390px @2x full page), `NN-name-detail-XX.png` (section close-ups @2x)');
  md.push('- `text/` — page copy as Markdown · `html/` — rendered HTML · `assets.csv` — every PDF, audio, video and upload linked · `manifest.json` — raw data', '');
  md.push('## Index', '', '| # | Page | Type | URL | Shots |', '|---|---|---|---|---|');
  for (const r of kept) md.push(`| ${r.prefix.slice(0, 2)} | ${(r.h1 || r.title).replace(/\|/g, '\\|')} | ${r.bucketName} | ${r.url} | ${discoverOnly ? '—' : r.files.length} |`);
  md.push('');
  for (const r of kept) {
    md.push(`## ${r.prefix.slice(0, 2)} · ${r.h1 || r.title}`, '');
    md.push(`- **Type:** ${r.bucketName}`, `- **URL:** ${r.url}${r.aliases.length ? ` (also ${r.aliases.join(', ')})` : ''}`);
    if (!discoverOnly) md.push(`- **Screenshots:** ${r.files.map((f) => `\`${f}\``).join(', ') || '_none — capture failed_'}`);
    md.push(`- **Copy:** \`text/${r.prefix}.md\``);
    md.push('- **Worth preserving:**', ...preserveNotes(r).map((x) => `  - ${x}`));
    const dl = r.downloads.concat(r.media.map((m) => ({ href: m.src, text: m.kind })));
    if (dl.length) md.push('- **Keep available on old WordPress:**', ...[...new Map(dl.map((d) => [d.href, d])).values()].slice(0, 40).map((d) => `  - ${d.text ? `${d.text} — ` : ''}${d.href}`));
    const up = [...new Set([...r.images, ...r.bgImages].filter(uploadsOnly))];
    if (up.length) md.push(`- **Images in /wp-content/uploads:** ${up.length} (listed in \`assets.csv\`)`);
    md.push('');
  }
  const dups = all.filter((r) => r.duplicateOf);
  if (dups.length) {
    md.push('## Skipped as duplicates', '', '| Page | URL | Same as | Why |', '|---|---|---|---|');
    for (const r of dups) md.push(`| ${(r.h1 || r.title).replace(/\|/g, '\\|')} | ${r.url} | ${r.duplicateOf} | ${r.dupReason || `${(r.similarity * 100).toFixed(0)}% same copy`} |`);
    md.push('');
  }
  const allDownloads = [...new Map(assetRows.filter((a) => a.type !== 'image').map((a) => [a.url, a])).values()];
  md.push('## Files that must stay live on the old WordPress install', '');
  md.push('Anything below hosted in `/wp-content/uploads/` (or a download manager) keeps working only if the old install stays reachable at its current URL after the reroute. Full list including images in `assets.csv`.', '');
  if (allDownloads.length) for (const a of allDownloads) md.push(`- [${a.type}] ${a.label ? `${a.label} — ` : ''}${a.url}`);
  else md.push('_None found._');
  md.push('', '## Skipped URLs', '', '<details><summary>' + skipped.length + ' URLs not captured (plumbing, unsafe or broken)</summary>', '');
  for (const s of skipped) md.push(`- ${s.url} — ${s.reason}`);
  md.push('', '</details>', '');
  await writeFile(path.join(OUT, 'archive-index.md'), md.join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
