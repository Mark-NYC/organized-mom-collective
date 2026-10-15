import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CALENDAR_OPTIONS } from '../src/config';
import { routes } from '../src/routes';
import {
  FEED_COLUMNS,
  FEED_ORIGIN,
  FEED_PRODUCTS,
  feedCell,
  feedCsv,
  feedPrice,
  feedRows,
  handleFeed,
  type Catalog,
} from '../api/pinterest-feed';

/** Shaped like the live shop_catalog() answer on 2026-10-15, with the store switched to Open. */
const catalog = (over: Partial<Catalog> = {}): Catalog => ({
  checkout_mode: 'live',
  products: [
    { slug: 'calendar-26-week', kind: 'physical', price_cents: 3400, currency: 'usd', available: true },
    { slug: 'weekly-reset-system', kind: 'digital', price_cents: 900, currency: 'usd', available: true },
    { slug: 'take-back-control', kind: 'digital', price_cents: 2900, currency: 'usd', available: true },
  ],
  shipping_rates: [
    { label: 'USPS Ground Advantage', amount_cents: 895, test_only: false, min_units: 1, max_units: null, free_over_cents: null },
    { label: 'Standard shipping (test placeholder)', amount_cents: 600, test_only: true, min_units: 1, max_units: null, free_over_cents: null },
  ],
  ...over,
});

/** Minimal RFC 4180 parser, to read the feed back the way Pinterest would. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\r' && text[i + 1] === '\n') row.push(cell), rows.push(row), (row = []), (cell = ''), i++;
    else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}

const req = (method = 'GET') => new Request('https://www.organizedmomcollective.com/pinterest-feed.csv', { method });
const env = { PUBLIC_SUPABASE_URL: 'https://example.supabase.co', PUBLIC_SUPABASE_ANON_KEY: 'anon' };

describe('pinterest feed rows', () => {
  it('lists only products that can be bought right now and are opted in', () => {
    expect(feedRows(catalog()).map((r) => r.id)).toEqual(['calendar-26-week']);
  });

  it('is empty unless the store switch is Open', () => {
    expect(feedRows(catalog({ checkout_mode: 'preview' }))).toEqual([]);
    expect(feedRows(catalog({ checkout_mode: 'off' }))).toEqual([]);
  });

  it('leaves out sold-out products (inactive ones never reach the public catalog)', () => {
    const c = catalog();
    c.products[0].available = false;
    expect(feedRows(c)).toEqual([]);
    expect(feedRows(catalog({ products: [] }))).toEqual([]);
  });

  it('takes price and currency from the database, never from the copy', () => {
    const c = catalog();
    c.products[0].price_cents = 3650;
    const [row] = feedRows(c);
    expect(row.price).toBe('36.50 USD');
    expect(row.availability).toBe('in stock');
    expect(row.shipping).toBe('US::USPS Ground Advantage:8.95 USD');
  });

  it('formats prices as Pinterest requires', () => {
    expect(feedPrice(3400, 'usd')).toBe('34.00 USD');
    expect(feedPrice(5, 'usd')).toBe('0.05 USD');
  });

  it('fills every required field with absolute HTTPS links on the live host', () => {
    for (const row of feedRows(catalog())) {
      for (const f of ['id', 'title', 'description', 'link', 'image_link', 'price', 'availability'] as const) expect(row[f]).not.toBe('');
      expect(row.id.length).toBeLessThanOrEqual(127);
      expect(row.title.length).toBeLessThanOrEqual(500);
      expect(row.description.length).toBeLessThanOrEqual(10000);
      const links = [row.link, row.image_link, ...row.additional_image_link.split(',').filter(Boolean)];
      for (const l of links) {
        expect(l.startsWith(FEED_ORIGIN + '/')).toBe(true);
        expect(new URL(l).protocol).toBe('https:');
      }
      expect(['in stock', 'out of stock', 'preorder']).toContain(row.availability);
      expect(row.condition).toBe('new');
    }
  });
});

describe('pinterest feed copy and assets', () => {
  it('links each product to a real page that sells it', () => {
    const pages = new Set<unknown>(Object.values(routes));
    for (const [slug, copy] of Object.entries(FEED_PRODUCTS)) {
      expect(pages.has(copy.path)).toBe(true);
      // A calendar is only buyable on /calendar when an option there is wired to its shop product.
      if (copy.path === routes.calendar) expect(CALENDAR_OPTIONS.some((o) => o.websiteProduct === slug)).toBe(true);
    }
  });

  it('ships every image as a JPEG in public/', () => {
    for (const copy of Object.values(FEED_PRODUCTS)) {
      expect(copy.images.length).toBeGreaterThan(0);
      expect(copy.images.length).toBeLessThanOrEqual(11);
      for (const src of copy.images) {
        expect(src).toMatch(/^\/images\/.+\.jpe?g$/);
        const file = new URL(`../public${src}`, import.meta.url);
        expect(existsSync(file)).toBe(true);
        expect([...readFileSync(file).subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
      }
    }
  });

  it('never calls the companion an app or promises features that are not live', () => {
    for (const copy of Object.values(FEED_PRODUCTS)) {
      const text = `${copy.title} ${copy.description}`;
      expect(text).not.toMatch(/\bapps?\b|sync|integrat|google calendar|icloud|outlook/i);
    }
  });
});

describe('pinterest feed CSV', () => {
  it('quotes commas, quotes and line breaks and reads back losslessly', () => {
    expect(feedCell('plain')).toBe('plain');
    expect(feedCell('a, b')).toBe('"a, b"');
    expect(feedCell('say "hi"')).toBe('"say ""hi"""');
    expect(feedCell('two\nlines')).toBe('"two\nlines"');
    const rows = feedRows(catalog());
    const parsed = parseCsv(feedCsv(rows));
    expect(parsed[0]).toEqual([...FEED_COLUMNS]);
    expect(parsed.slice(1)).toEqual(rows.map((r) => FEED_COLUMNS.map((c) => r[c])));
  });

  it('is a header row only when nothing is for sale', () => {
    expect(feedCsv([])).toBe(FEED_COLUMNS.join(',') + '\r\n');
  });
});

describe('pinterest feed endpoint', () => {
  it('serves UTF-8 CSV from the public catalog RPC, with no secrets', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(catalog()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await handleFeed(req(), env);
    vi.unstubAllGlobals();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
    const text = await res.text();
    expect(text.startsWith('id,title,description,link,image_link,price,availability')).toBe(true);
    expect(text).toContain('34.00 USD');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/shop_catalog');
    expect(init.method).toBe('POST');
  });

  it('answers 503, not an empty feed, when the catalog cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    const res = await handleFeed(req(), env);
    vi.unstubAllGlobals();
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await handleFeed(req(), {})).status).toBe(503);
  });

  it('supports HEAD and refuses other methods', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(catalog()), { status: 200 })));
    const head = await handleFeed(req('HEAD'), env);
    vi.unstubAllGlobals();
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect((await handleFeed(req('POST'), env)).status).toBe(405);
  });
});
