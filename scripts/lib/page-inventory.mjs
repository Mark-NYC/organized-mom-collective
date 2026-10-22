/**
 * Page inventory for /admin → Pages & Funnels: every page the build produced, including landing
 * pages that nothing links to. Pure functions over built HTML; scripts/page-inventory.mjs reads dist/
 * and syncs the result. Tests: tests/page-inventory.test.ts.
 */

/** Sales pages, listed so they're typed even in builds where their buy buttons are switched off. */
export const OFFER_PATHS = new Set([
  '/calendar',
  '/shop',
  '/weekly-reset',
  '/weekly-reset-simple',
  '/take-back-control',
  '/essential-routines',
  '/real-life-reset-kit',
  '/family-sanity-saver-starter-kit',
  '/mind-your-own-motherhood-mug',
]);

/** Never inventoried: the admin itself, and build files that aren't pages. */
export const EXCLUDED = (path) =>
  path === '/admin' || path.startsWith('/admin/') || path === '/survey/admin' || path === '/404.html' || path === '/404' ||
  // The Organized Family Club's member pages: not launched, behind PUBLIC_CLUB_ENABLED.
  path === '/club' || path.startsWith('/club/');

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
const text = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag, name) => {
  const v = tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  return v === undefined ? undefined : decode(v);
};

/** "/calendar#buy?x" → "/calendar"; "/" stays "/". */
export function normalizePath(href) {
  const p = href.split(/[?#]/)[0].replace(/\/index\.html$/, '').replace(/\.html$/, '');
  return p === '' ? '/' : p.length > 1 ? p.replace(/\/$/, '') : p;
}

/** Internal page links (site-relative or on the site's own domain), normalized. */
export function internalLinks(html, site) {
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*>/g)) {
    let href = attr(m[0], 'href');
    if (!href) continue;
    if (href.startsWith(site)) href = href.slice(site.length) || '/';
    else if (/^https?:\/\/www\./.test(href) && href.replace('://www.', '://').startsWith(site)) href = href.replace('://www.', '://').slice(site.length) || '/';
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    if (/\.(pdf|png|jpe?g|webp|svg|csv|xml|txt|mp3|m4a)$/i.test(href.split(/[?#]/)[0])) continue;
    out.add(normalizePath(href));
  }
  return out;
}

/** Links marked with data-cta (src/lib/analytics.ts): placement, visible label, destination. */
export function ctaLinks(html) {
  const out = [];
  for (const m of html.matchAll(/<a\b([^>]*\sdata-cta="[^"]*"[^>]*)>([\s\S]*?)<\/a>/g)) {
    const tag = `<a${m[1]}>`;
    out.push({ placement: attr(tag, 'data-cta') ?? '', label: text(m[2]).slice(0, 120) || (attr(tag, 'aria-label') ?? '').slice(0, 120), href: attr(tag, 'href') ?? '' });
  }
  return out;
}

export function pageMeta(html) {
  const redirect = html.match(/<meta http-equiv="refresh" content="\d+;\s*url=([^"]+)"/i)?.[1];
  return {
    title: decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').trim() || null,
    h1: text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '') || null,
    indexable: !/<meta name="robots" content="noindex/.test(html) && !redirect,
    redirect_to: redirect ? decode(redirect) : null,
    buys: /href="[^"]*\/checkout(\?|")/.test(html) || /href="https:\/\/(www\.)?etsy\.com\/listing\//.test(html),
  };
}

/** What kind of page a path is. `ctx.tools` = paths the /tools directory links to. */
export function pageType(path, ctx) {
  // /start is the QR code printed on every calendar: it forwards to the companion.
  if (path === '/start') return 'companion';
  if (ctx.redirect) return 'redirect';
  if (path === '/') return 'home';
  if (path === '/app' || path.startsWith('/app/')) return 'companion';
  if (path === '/companion') return 'page';
  if (path === '/tools') return 'library';
  if (path === '/resources') return 'library';
  if (path.startsWith('/resources/topics/')) return 'pillar';
  if (path.startsWith('/resources/')) return 'article';
  if (path.startsWith('/checkout') || path === '/download') return 'checkout';
  if (path === '/support' || path === '/returns') return 'support';
  if (path.startsWith('/survey')) return 'survey';
  if (path === '/starter-kit' || path.startsWith('/starter-kit/')) return 'lead-magnet';
  if (OFFER_PATHS.has(path)) return 'offer';
  if (ctx.dynamic) return 'gated';
  if (ctx.tools?.has(path)) return 'tool';
  if (ctx.buys) return 'offer';
  return 'page';
}

/**
 * Where a page's source lives. `files` = paths under src/pages (e.g. "planner/[access].astro"),
 * `articles` = article slugs. Returns { file, dynamic }.
 */
export function sourceFile(path, files, articles) {
  const bare = path === '/' ? 'index' : path.slice(1);
  for (const c of [`${bare}.astro`, `${bare}/index.astro`, `${bare}.md`, `${bare}.mdx`]) if (files.includes(c)) return { file: `src/pages/${c}`, dynamic: false };
  const slug = path.match(/^\/resources\/([^/]+)$/)?.[1];
  if (slug && articles.includes(slug)) return { file: `src/content/articles/${slug}.mdx`, dynamic: false };
  const dir = bare.includes('/') ? bare.slice(0, bare.lastIndexOf('/')) : '';
  const dyn = files.find((f) => (dir ? f.startsWith(`${dir}/[`) : f.startsWith('[')) && !f.slice(dir ? dir.length + 1 : 0).includes('/'));
  if (dyn) return { file: `src/pages/${dyn}`, dynamic: !path.startsWith('/resources/') };
  return { file: null, dynamic: false };
}

/** Sitemap <loc> paths. */
export function sitemapPaths(xml, site) {
  return new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => normalizePath(m[1].replace(site, '') || '/')));
}

/** Links in the site header and footer (the homepage's). */
export function navPaths(homeHtml, site) {
  const parts = [...homeHtml.matchAll(/<(header|footer)\b[\s\S]*?<\/\1>/g)].map((m) => m[0]).join('');
  return internalLinks(parts, site);
}

/**
 * @typedef {{ placement: string, label: string, href: string, broken?: string }} Cta
 * @typedef {{ path: string, title: string | null, h1: string | null, type: string, indexable: boolean, redirect_to: string | null,
 *   in_sitemap: boolean, in_nav: boolean, inbound_links: number, orphan: boolean, ctas: Cta[], source_file: string | null }} InventoryRow
 * @typedef {{ site: string, files: string[], articles: string[], sitemap?: Set<string>, nav?: Set<string>, tools?: Set<string>,
 *   exists?: (href: string) => boolean }} InventoryOptions
 */

/**
 * Builds the inventory. `pages` = [{ path, html }] for every built page. Returns rows sorted by path.
 * A CTA whose internal destination isn't a built page is marked broken.
 * @param {{ path: string, html: string }[]} pages
 * @param {InventoryOptions} opts
 * @returns {InventoryRow[]}
 */
export function buildInventory(pages, { site, files, articles, sitemap = new Set(), nav = new Set(), tools = new Set(), exists = () => true }) {
  const inbound = new Map();
  for (const p of pages) {
    for (const target of internalLinks(p.html, site)) {
      if (target === p.path) continue;
      if (!inbound.has(target)) inbound.set(target, new Set());
      inbound.get(target).add(p.path);
    }
  }
  return pages
    .filter((p) => !EXCLUDED(p.path))
    .map((p) => {
      const meta = pageMeta(p.html);
      const src = sourceFile(p.path, files, articles);
      const ctas = ctaLinks(p.html).map((c) => {
        const internal = c.href.startsWith('/') && !c.href.startsWith('//');
        return internal && !exists(c.href) ? { ...c, broken: 'missing page' } : c;
      });
      const linkedFrom = inbound.get(p.path)?.size ?? 0;
      const inSitemap = sitemap.has(p.path);
      const inNav = nav.has(p.path);
      return {
        path: p.path,
        title: meta.title,
        h1: meta.h1,
        type: pageType(p.path, { redirect: Boolean(meta.redirect_to), dynamic: src.dynamic, tools, buys: meta.buys }),
        indexable: meta.indexable,
        redirect_to: meta.redirect_to,
        in_sitemap: inSitemap,
        in_nav: inNav,
        inbound_links: linkedFrom,
        orphan: linkedFrom === 0 && !inNav && !inSitemap && !meta.redirect_to,
        ctas,
        source_file: src.file,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Unique external CTA destinations, with the pages that use them.
 * @param {InventoryRow[]} rows
 * @returns {{ href: string, pages: string[] }[]}
 */
export function externalCtas(rows) {
  const out = new Map();
  for (const r of rows)
    for (const c of r.ctas)
      if (/^https?:\/\//.test(c.href)) {
        if (!out.has(c.href)) out.set(c.href, new Set());
        out.get(c.href).add(r.path);
      }
  return [...out].map(([href, pages]) => ({ href, pages: [...pages].sort() }));
}

/** A link check result counts as broken only when the server says the page is gone. 403/429/5xx = unverified. */
export const brokenStatus = (status) => status === 404 || status === 410;
