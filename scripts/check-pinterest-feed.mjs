#!/usr/bin/env node
/**
 * Checks the LIVE Pinterest catalog feed the way Pinterest's crawler sees it: no cookies, no auth,
 * redirects not followed. Exits non-zero on any problem. Run daily by
 * .github/workflows/pinterest-feed-check.yml, or by hand: `npm run check:feed [-- <url>]`.
 *
 *   - the feed URL answers 200 directly (a redirect's text/plain body is what Pinterest rejected
 *     with "Catalogs doesn't support your file type")
 *   - Content-Type text/csv; charset=utf-8, body is CSV (no HTML, JSON, BOM), header + ≥1 product row
 *   - required fields present, price "12.34 USD", availability a Pinterest value, condition valid
 *   - every product link and image answers 200 without redirecting, images are JPEG/PNG
 *   - the bare domain's feed URL redirects straight to the www one
 */
const FEED = process.argv[2] ?? 'https://www.organizedmomcollective.com/pinterest-feed.csv';
const APEX = 'https://organizedmomcollective.com/pinterest-feed.csv';
const UA = 'Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)';
const REQUIRED = ['id', 'title', 'description', 'link', 'image_link', 'price', 'availability'];

const problems = [];
const fail = (msg) => problems.push(msg);
const get = (url, method = 'GET') => fetch(url, { method, redirect: 'manual', headers: { 'User-Agent': UA, Accept: '*/*' } });

/** RFC 4180 parser. */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
      if (c === '\r') i++;
      row.push(cell), rows.push(row), (row = []), (cell = '');
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}

const res = await get(FEED).catch((e) => {
  console.error(`✗ Pinterest feed check failed: ${FEED}: ${e.cause?.code ?? e.message}`);
  process.exit(1);
});
const type = res.headers.get('content-type') ?? '';
const body = await res.text();
console.log(`GET ${FEED} → ${res.status} ${type}`);
for (const h of ['content-type', 'content-disposition', 'cache-control', 'x-robots-tag', 'location']) {
  if (res.headers.get(h)) console.log(`  ${h}: ${res.headers.get(h)}`);
}
if (res.status !== 200) fail(`feed answered ${res.status}${res.headers.get('location') ? ` → ${res.headers.get('location')}` : ''}, not 200`);
if (type.replace(/\s/g, '').toLowerCase() !== 'text/csv;charset=utf-8') fail(`Content-Type is "${type}", not "text/csv; charset=utf-8"`);
if (body.charCodeAt(0) === 0xfeff) fail('body starts with a byte-order mark');
if (/<\s*(!doctype|html|head|body)\b/i.test(body)) fail('body contains HTML');
if (/^\s*[{[]/.test(body)) fail('body looks like JSON');

const rows = parseCsv(body).filter((r) => r.some((c) => c !== ''));
const header = rows[0] ?? [];
const items = rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
for (const f of REQUIRED) if (!header.includes(f)) fail(`header is missing "${f}"`);
if (rows.some((r) => r.length !== header.length)) fail('a row has a different number of cells than the header');
if (items.length === 0) fail('no product rows (Pinterest rejects a header-only file)');
console.log(`  ${items.length} product row(s): ${items.map((i) => `${i.id} ${i.price} ${i.availability}`).join('; ')}`);

const urls = new Set();
for (const item of items) {
  for (const f of REQUIRED) if (!item[f]) fail(`${item.id || '?'}: empty ${f}`);
  if (!/^\d+\.\d{2} [A-Z]{3}$/.test(item.price)) fail(`${item.id}: price "${item.price}" isn't "12.34 USD"`);
  if (!['in stock', 'out of stock', 'preorder'].includes(item.availability)) fail(`${item.id}: availability "${item.availability}"`);
  if (item.condition && !['new', 'refurbished', 'used'].includes(item.condition)) fail(`${item.id}: condition "${item.condition}"`);
  if (item.id.length > 127 || item.title.length > 500 || item.description.length > 10000) fail(`${item.id}: a field is over Pinterest's length limit`);
  urls.add(`page ${item.link}`).add(`image ${item.image_link}`);
  for (const u of item.additional_image_link?.split(',').filter(Boolean) ?? []) urls.add(`image ${u}`);
}
for (const entry of urls) {
  const [kind, url] = entry.split(' ');
  if (!url.startsWith('https://')) {
    fail(`${kind} ${url} isn't absolute HTTPS`);
    continue;
  }
  const r = await get(url, kind === 'image' ? 'HEAD' : 'GET').catch((e) => (fail(`${kind} ${url}: ${e.cause?.code ?? e.message}`), null));
  if (!r) continue;
  const t = r.headers.get('content-type') ?? '';
  console.log(`  ${kind} ${url} → ${r.status} ${t}`);
  if (r.status !== 200) fail(`${kind} ${url} answered ${r.status}`);
  if (kind === 'image' && !/^image\/(jpeg|png)$/.test(t)) fail(`image ${url} is "${t}", not JPEG/PNG`);
  if (kind === 'page' && !t.startsWith('text/html')) fail(`page ${url} is "${t}"`);
}

if (FEED !== APEX) {
  const apex = await get(APEX).catch(() => ({ status: 0, headers: new Headers() }));
  const loc = apex.headers.get('location') ?? '';
  console.log(`GET ${APEX} → ${apex.status}${loc ? ` → ${loc}` : ''}`);
  if (apex.status !== 200 && !(apex.status >= 300 && apex.status < 400 && loc.split('?')[0] === FEED)) {
    fail(`${APEX} answered ${apex.status} ${loc} instead of serving or redirecting to ${FEED}`);
  }
}

if (problems.length) {
  console.error(`\n✗ Pinterest feed check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\n✓ Pinterest feed OK');
