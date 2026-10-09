/**
 * Post-build checks for the static site, plus the content inventory.
 *
 *   npm run build && npm run check:site
 *
 * Fails (exit 1) on:
 *   - internal links or assets that don't resolve to a built file, and #anchors that don't exist
 *   - indexable pages missing a single <h1>, <title>, meta description or a correct canonical URL
 *   - images without an alt attribute
 *   - article pages with missing or invalid JSON-LD, or fewer than two contextual links to other articles
 *   - sitemap URLs that weren't built
 *   - articles that don't match their row in docs/editorial/CONTENT_TRACKER.md (id, slug, status, date)
 *   - published articles without a complete Pinterest plan (docs/editorial/pinterest/{ID}.md: three
 *     pins, valid statuses and filenames, no leftover placeholders), or a tracker row whose Pinterest
 *     columns don't match the plan. Rules: docs/editorial/PINTEREST_STRATEGY.md.
 * Warns on articles that no other article links to yet.
 *
 * Writes docs/editorial/content-inventory.md (actual links, generated) from the
 * articles' frontmatter and their built pages. Linking rules: docs/editorial/INTERNAL_LINKING.md.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const SITE = 'https://organizedmomcollective.com';
const ARTICLES_DIR = join(root, 'src/content/articles');
const INVENTORY = join(root, 'docs/editorial/content-inventory.md');
const TRACKER = join(root, 'docs/editorial/CONTENT_TRACKER.md');
const PINTEREST_DIR = join(root, 'docs/editorial/pinterest');
const PIN_TYPES = ['search', 'curiosity', 'save'];
const PIN_STATUSES = ['planned', 'generated', 'reviewed', 'published'];

if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));

/** dist file → the URL path it's served at (/resources/x/index.html → /resources/x). */
const pagePath = (file) => {
  const p = '/' + relative(dist, file).split(sep).join('/');
  return p.replace(/\/index\.html$/, '') || '/';
};

/** URL path → built file, or undefined. */
const resolve = (path) => {
  const clean = decodeURIComponent(path.split(/[?#]/)[0]);
  const candidates = [join(dist, clean), join(dist, clean, 'index.html'), join(dist, clean + '.html')];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
};

const ids = new Map();
const idsOf = (file) => {
  if (!ids.has(file)) ids.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return ids.get(file);
};

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const path = pagePath(file);
  const rel = relative(root, file);

  // 1. Internal links, assets and anchors
  for (const m of html.matchAll(/<(a|link|img|script|source)\b[^>]*>/g)) {
    const tag = m[0];
    const refs = [attr(tag, 'href'), attr(tag, 'src'), ...(attr(tag, 'srcset') ?? '').split(',').map((s) => s.trim().split(/\s+/)[0])];
    for (const ref of refs) {
      if (!ref || /^(https?:|mailto:|tel:|data:|\/\/)/.test(ref)) continue;
      if (ref.startsWith('#')) {
        if (ref.length > 1 && !idsOf(file).has(ref.slice(1))) fail(rel, `anchor ${ref} has no matching id`);
        continue;
      }
      if (!ref.startsWith('/')) continue;
      const target = resolve(ref);
      if (!target) {
        fail(rel, `broken link ${ref}`);
        continue;
      }
      const hash = ref.split('#')[1];
      if (hash && target.endsWith('.html') && !idsOf(target).has(hash)) fail(rel, `anchor ${ref} has no matching id`);
    }
  }

  // 2. Images need alt text (alt="" for decorative ones)
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(m[0])) fail(rel, `image without alt: ${attr(m[0], 'src')}`);
  }

  // 3. Indexable pages: one H1, title, description, canonical
  const indexable = !/<meta name="robots" content="noindex/.test(html) && !html.includes('http-equiv="refresh"');
  if (indexable) {
    const h1s = html.match(/<h1\b/g)?.length ?? 0;
    if (h1s !== 1) fail(rel, `expected exactly one <h1>, found ${h1s}`);
    if (!/<title>[^<]+<\/title>/.test(html)) fail(rel, 'missing <title>');
    if (!/<meta name="description" content="[^"]{20,}"/.test(html)) fail(rel, 'missing meta description');
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    const expected = SITE + (path === '/' ? '/' : path.replace(/\.html$/, ''));
    if (path !== '/404.html' && canonical !== expected) fail(rel, `canonical is ${canonical ?? 'missing'}, expected ${expected}`);
  }

  // 4. Structured data must parse
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch {
      fail(rel, 'invalid JSON-LD');
    }
  }
}

// ---- Articles: contextual links and inventory ----

/** Minimal frontmatter reader for the fields the inventory needs. */
function frontmatter(src) {
  const block = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const data = {};
  let listKey = null;
  for (const line of block.split('\n')) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && listKey) {
      data[listKey].push(item[1].trim());
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    const value = raw.trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    if (value === '') {
      data[key] = [];
      listKey = key;
    } else {
      data[key] = value;
      listKey = null;
    }
  }
  return data;
}

const articles = readdirSync(ARTICLES_DIR)
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => {
    const slug = f.replace(/\.mdx$/, '');
    return { slug, ...frontmatter(readFileSync(join(ARTICLES_DIR, f), 'utf8')) };
  })
  .filter((a) => a.draft !== 'true');

const bodyLinks = new Map();
for (const a of articles) {
  const file = resolve(`/resources/${a.slug}`);
  if (!file) {
    fail(`src/content/articles/${a.slug}.mdx`, 'article page was not built');
    bodyLinks.set(a.slug, []);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  if (!html.includes('"@type":"Article"')) fail(rel, 'missing Article JSON-LD');
  // The article body only: excludes header, Read next, related cards and footer.
  const body = html.slice(html.indexOf('class="article-body'), html.indexOf('</article>'));
  const links = [...new Set([...body.matchAll(/href="\/resources\/([a-z0-9-]+)(?:#[^"]*)?"/g)].map((m) => m[1]))].filter(
    (s) => s !== a.slug && s !== 'topics',
  );
  bodyLinks.set(a.slug, links);
  const others = articles.length - 1;
  if (links.length < Math.min(2, others)) fail(rel, `only ${links.length} contextual link(s) to other articles in the body (need ${Math.min(2, others)})`);
}

const incoming = new Map(articles.map((a) => [a.slug, []]));
for (const [from, links] of bodyLinks) for (const to of links) incoming.get(to)?.push(from);
for (const a of articles) {
  if (articles.length > 1 && incoming.get(a.slug).length === 0) warnings.push(`${a.slug}: no other article links to it yet`);
}

// ---- Tracker ----
// Rows look like:
// | HC-01 | Title | `slug` | Cluster | Status | Intent | Target links | Published | Pinterest plan | Pins (search / curiosity / save) |
const trackerRows = existsSync(TRACKER)
  ? readFileSync(TRACKER, 'utf8')
      .split('\n')
      .map((l) => l.split('|').map((c) => c.trim()))
      .filter((c) => /^[A-Z]{2}-\d{2}$/.test(c[1] ?? ''))
      .map((c) => ({ id: c[1], slug: c[3].replace(/`/g, ''), status: c[5], published: c[8], plan: c[9], pins: c[10] }))
  : [];
if (!trackerRows.length) fail('docs/editorial/CONTENT_TRACKER.md', 'missing or has no article rows');
for (const a of articles) {
  const src = `src/content/articles/${a.slug}.mdx`;
  const row = trackerRows.find((r) => r.id === a.trackerId);
  if (!row) {
    fail(src, `trackerId ${a.trackerId} is not in CONTENT_TRACKER.md`);
    continue;
  }
  if (row.slug !== a.slug) fail(src, `tracker row ${row.id} has slug ${row.slug}; the file is ${a.slug}`);
  if (row.status !== 'Published') fail(src, `tracker row ${row.id} status is "${row.status}"; set it to Published`);
  if (row.published !== a.published) fail(src, `tracker row ${row.id} published date is "${row.published}"; frontmatter says ${a.published}`);
}
for (const r of trackerRows) {
  if (r.status === 'Published' && !articles.some((a) => a.trackerId === r.id)) {
    fail('docs/editorial/CONTENT_TRACKER.md', `${r.id} is marked Published but no article has that trackerId`);
  }
}

// ---- Pinterest plans ----
/** Reads and validates docs/editorial/pinterest/{id}.md. Returns undefined if there is no plan. */
function readPlan(id, slug) {
  const file = join(PINTEREST_DIR, `${id}.md`);
  if (!existsSync(file)) return undefined;
  const rel = relative(root, file);
  const text = readFileSync(file, 'utf8');
  const field = (label) => [...text.matchAll(new RegExp(`\\*\\*${label}:\\*\\*[ \\t]*(.+)`, 'g'))].map((m) => m[1].trim());
  const placeholders = text.replace(/<!--[\s\S]*?-->/g, '').match(/<[^<>\n]{1,120}>/g);
  if (placeholders) fail(rel, `leftover placeholder(s): ${[...new Set(placeholders)].slice(0, 3).join(', ')}`);
  if (field('Article ID')[0] !== id) fail(rel, `Article ID is "${field('Article ID')[0] ?? 'missing'}", expected ${id}`);
  const url = `${SITE}/resources/${slug}`;
  if (field('Final article URL')[0] !== url) fail(rel, `Final article URL is "${field('Final article URL')[0] ?? 'missing'}", expected ${url}`);
  for (const label of ['Primary Pinterest keyword', 'Secondary search terms', 'Target audience', 'Search intent', 'Save intent']) {
    if (!field(label)[0]) fail(rel, `missing "${label}"`);
  }
  const statuses = field('Production status');
  const assets = field('Asset filename');
  if (statuses.length !== 3) fail(rel, `expected exactly 3 pins (Production status lines), found ${statuses.length}`);
  for (const label of ['Text overlay', 'Image-generation prompt', 'Pinterest title', 'Pinterest description', 'Alt text', 'Recommended board']) {
    const n = text.split(`**${label}:**`).length - 1;
    if (n !== 3) fail(rel, `expected "${label}" for each of the 3 pins, found ${n}`);
  }
  statuses.forEach((s, i) => {
    if (!PIN_STATUSES.includes(s)) fail(rel, `pin ${i + 1} status "${s}" is not one of ${PIN_STATUSES.join(', ')}`);
  });
  PIN_TYPES.forEach((type, i) => {
    if (!new RegExp(`^${id}-${type}-1000x1500\\.(png|jpg)$`).test(assets[i] ?? '')) {
      fail(rel, `pin ${i + 1} asset filename should be ${id}-${type}-1000x1500.png (or .jpg), found "${assets[i] ?? 'missing'}"`);
    }
  });
  return { statuses };
}

const plans = new Map();
for (const r of trackerRows) {
  const plan = readPlan(r.id, r.slug);
  plans.set(r.id, plan);
  const expectedPlan = plan ? 'Yes' : '—';
  const expectedPins = plan ? plan.statuses.join(' / ') : '—';
  if (r.plan !== expectedPlan) fail('docs/editorial/CONTENT_TRACKER.md', `${r.id} Pinterest plan column is "${r.plan ?? 'missing'}", expected "${expectedPlan}"`);
  if (r.pins !== expectedPins) fail('docs/editorial/CONTENT_TRACKER.md', `${r.id} Pins column is "${r.pins ?? 'missing'}", expected "${expectedPins}"`);
}
if (existsSync(PINTEREST_DIR)) {
  for (const f of readdirSync(PINTEREST_DIR).filter((f) => f.endsWith('.md'))) {
    if (!trackerRows.some((r) => `${r.id}.md` === f)) fail(`docs/editorial/pinterest/${f}`, 'file name is not a tracker ID (e.g. HC-01.md)');
  }
}
for (const a of articles) {
  if (!plans.get(a.trackerId)) fail(`src/content/articles/${a.slug}.mdx`, `no Pinterest plan: create docs/editorial/pinterest/${a.trackerId}.md from templates/pinterest-plan.md`);
}

// ---- Sitemap ----
const sitemap = resolve('/sitemap.xml');
if (!sitemap) fail('dist/sitemap.xml', 'not built');
else {
  for (const m of readFileSync(sitemap, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = m[1].replace(SITE, '') || '/';
    if (!resolve(path)) fail('dist/sitemap.xml', `lists ${m[1]}, which wasn't built`);
  }
}

// ---- Inventory ----
const pillarNames = Object.fromEntries(
  [...readFileSync(join(root, 'src/data/pillars.ts'), 'utf8').matchAll(/id: '([^']+)',\s*\n\s*prefix: '[A-Z]+',\s*\n\s*name: '([^']+)'/g)].map(
    (m) => [m[1], m[2]],
  ),
);
const ctaLabel = { calendar: 'Wall calendar (/calendar)', app: 'Companion explainer (/companion)', none: 'None' };
const list = (xs) => (xs.length ? xs.map((s) => `\`${s}\``).join('<br>') : '—');
const sorted = [...articles].sort((a, b) => String(a.trackerId).localeCompare(String(b.trackerId)));
const inventory = [
  '# Content inventory',
  '',
  '_Generated by `npm run check:site` from `src/content/articles/` and the built pages. Do not edit by hand._',
  '',
  '"Outgoing" and "incoming" count contextual links in the article body only (not the Read next / related cards).',
  '',
  '| ID | Article | Pillar | Related (frontmatter) | Next | Outgoing links | Incoming links | Product CTA | Pins (search / curiosity / save) |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...sorted.map(
    (a) =>
      `| ${a.trackerId} | [${a.title}](/resources/${a.slug})<br>\`${a.slug}\` | ${pillarNames[a.pillar] ?? a.pillar}${a.pillarGuide === 'true' ? ' ★' : ''} | ${list(a.related ?? [])} | ${a.next ? `\`${a.next}\`` : '—'} | ${list(bodyLinks.get(a.slug) ?? [])} | ${list(incoming.get(a.slug) ?? [])} | ${ctaLabel[a.cta] ?? a.cta} | ${plans.get(a.trackerId)?.statuses.join(' / ') ?? '—'} |`,
  ),
  '',
  `${articles.length} published article(s). ★ = pillar guide.`,
  '',
].join('\n');
writeFileSync(INVENTORY, inventory);

// ---- Report ----
for (const w of warnings) console.warn(`warn  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  console.error(`\n✗ ${errors.length} problem(s) in ${htmlFiles.length} pages.`);
  process.exit(1);
}
console.log(`✓ ${htmlFiles.length} pages checked: links, anchors, alt text, metadata, structured data, sitemap.`);
console.log(`✓ Inventory written: ${relative(root, INVENTORY)} (${articles.length} article${articles.length === 1 ? "" : "s"}).`);
