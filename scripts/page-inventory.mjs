/**
 * Page inventory for /admin → Pages & Funnels. Run after a build:
 *
 *   npm run build && npm run inventory                 # summary + page-inventory.json
 *   node scripts/page-inventory.mjs --check-links      # also checks external CTA links (Etsy etc.)
 *   node scripts/page-inventory.mjs --check-links --sync   # and sends it to Supabase (CI only)
 *
 * --sync needs SUPABASE_URL, SUPABASE_ANON_KEY and PAGE_INVENTORY_TOKEN (created in /admin → Settings).
 * The GitHub Action .github/workflows/page-inventory.yml runs it after every push to main.
 * Logic: scripts/lib/page-inventory.mjs. Setup: supabase/ADMIN.md.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brokenStatus, buildInventory, externalCtas, internalLinks, navPaths, normalizePath, sitemapPaths } from './lib/page-inventory.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const SITE = 'https://organizedmomcollective.com';
const args = new Set(process.argv.slice(2));

if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const pathOf = (file) => normalizePath('/' + relative(dist, file).split(sep).join('/'));

const pages = walk(dist)
  .filter((f) => f.endsWith('.html'))
  .map((f) => ({ path: pathOf(f), html: readFileSync(f, 'utf8') }));
const built = new Set(pages.map((p) => p.path));
const exists = (href) => {
  const clean = href.split(/[?#]/)[0];
  return built.has(normalizePath(clean)) || existsSync(join(dist, clean));
};

const srcPages = join(root, 'src/pages');
const files = walk(srcPages).map((f) => relative(srcPages, f).split(sep).join('/'));
const articles = readdirSync(join(root, 'src/content/articles'))
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => f.replace(/\.mdx$/, ''));
const home = pages.find((p) => p.path === '/')?.html ?? '';
const toolsHtml = pages.find((p) => p.path === '/tools')?.html ?? '';
const sitemap = existsSync(join(dist, 'sitemap.xml')) ? sitemapPaths(readFileSync(join(dist, 'sitemap.xml'), 'utf8'), SITE) : new Set();

const rows = buildInventory(pages, { site: SITE, files, articles, sitemap, nav: navPaths(home, SITE), tools: internalLinks(toolsHtml, SITE), exists });

// External CTA destinations: only "gone" (404/410) counts as broken; blocked or slow is "unverified".
const links = [];
if (args.has('--check-links')) {
  for (const { href, pages: on } of externalCtas(rows)) {
    let status = 0;
    try {
      const res = await fetch(href, { redirect: 'follow', signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'OrganizedMomCollective-LinkCheck/1.0' } });
      status = res.status;
    } catch {
      status = 0;
    }
    links.push({ href, status, broken: brokenStatus(status), pages: on });
  }
}

const sha = process.env.GITHUB_SHA ?? null;
const out = { generated_at: new Date().toISOString(), build_sha: sha, pages: rows, links };
writeFileSync(join(root, 'page-inventory.json'), JSON.stringify(out, null, 2) + '\n');

const byType = rows.reduce((m, r) => ((m[r.type] = (m[r.type] ?? 0) + 1), m), {});
const brokenCtas = rows.flatMap((r) => r.ctas.filter((c) => c.broken).map((c) => `${r.path} → ${c.href}`));
console.log(`${rows.length} pages: ${Object.entries(byType).map(([t, n]) => `${n} ${t}`).join(', ')}`);
console.log(`${rows.filter((r) => r.orphan).length} not linked from anywhere, ${rows.filter((r) => !r.indexable).length} noindex`);
if (brokenCtas.length) console.log(`Broken internal CTAs:\n  ${brokenCtas.join('\n  ')}`);
if (links.length) console.log(`${links.length} external CTA links checked, ${links.filter((l) => l.broken).length} broken, ${links.filter((l) => !l.broken && l.status !== 200).length} unverified`);

if (args.has('--sync')) {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY ?? '';
  const token = process.env.PAGE_INVENTORY_TOKEN ?? '';
  if (!url || !key || !token) {
    console.error('--sync needs SUPABASE_URL, SUPABASE_ANON_KEY and PAGE_INVENTORY_TOKEN.');
    process.exit(1);
  }
  const res = await fetch(`${url}/rest/v1/rpc/site_pages_sync`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_build_sha: sha, p_pages: rows, p_links: links }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status !== 'ok') {
    console.error(`Sync failed (${res.status}): ${JSON.stringify(body)}`);
    process.exit(1);
  }
  console.log(`Synced: ${body.pages} pages, ${body.added} new, ${body.removed} removed.`);
}
