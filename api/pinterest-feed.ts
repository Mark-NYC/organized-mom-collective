/**
 * Pinterest catalog feed: https://www.organizedmomcollective.com/pinterest-feed.csv
 * (vercel.json rewrites that path here). Pinterest fetches it daily.
 *
 * A Vercel Function, not a build-time file, so price, stock and the store switch are read live
 * from the shop database on every fetch (cached at the edge for 5 minutes). It calls only the
 * public shop_catalog() RPC with the public anon key, the same call the /checkout page makes:
 * no stock counts, no Stripe or service-role secrets, no admin endpoints.
 *
 * A product is listed when it's active in Dashboard → Inventory (inactive = unpublished or future,
 * never listed) and has an entry in FEED_PRODUCTS below (landing page, Pinterest copy, JPEG images).
 * It's "in stock" only when it can be bought right now: store switch Open (checkout_mode 'live') AND
 * in stock (shop_catalog's `available`). Otherwise it's listed as "out of stock", which Pinterest
 * keeps in the catalog but doesn't show as buyable. Listing it either way keeps the feed from being
 * a header row only, which Pinterest refuses ("Catalogs doesn't support your file type").
 *
 * Price, currency and availability always come from the database; nothing here can override them.
 * Setup and Pinterest steps: supabase/SHOP.md → Pinterest catalog feed.
 */

/** The host that serves the site (the bare domain 308-redirects here). Product and image links use it. */
export const FEED_ORIGIN = 'https://www.organizedmomcollective.com';
export const BRAND = 'Organized Mom Collective';

export interface FeedProductCopy {
  /** Page where this product can be bought, a path from src/routes.ts. */
  path: string;
  title: string;
  description: string;
  /** JPEG files in public/, primary first (Pinterest takes up to 10 additional images). */
  images: string[];
  /** Variants of one product share a group (e.g. the 26- and 52-week calendar). */
  itemGroupId?: string;
  size?: string;
  productType: string;
  googleProductCategory: string;
}

/**
 * Products that may appear in the feed, by shop slug. A slug not listed here is never exported.
 *
 * Only the physical calendar for now. Before adding:
 *   - calendar-52-week: first sell it on the website (CALENDAR_OPTIONS.websiteProduct in src/config.ts),
 *     or /calendar won't let anyone buy it. tests/pinterest-feed.test.ts enforces this.
 *   - the downloads (weekly-reset-system, take-back-control, …): Pinterest catalogs are built for
 *     physical retail goods; confirm digital products are allowed for your merchant account first.
 */
export const FEED_PRODUCTS: Record<string, FeedProductCopy> = {
  'calendar-26-week': {
    path: '/calendar',
    title: '2027 Family Wall Calendar & Weekly Planner, January–June (26 Weeks), 11 × 17 Family Organizer with Meal Plan, Grocery List & Cleaning Schedule',
    description:
      'Get the week out of your head and onto the wall, where the whole family can see it. ' +
      'Each week of this 2027 family wall calendar has its own 11 × 17 page with room for the daily schedule, ' +
      'school and activity plans, a meal plan, grocery list, to-dos and a cleaning zone for every day, ' +
      'so everyone knows the plan and can play a part. ' +
      'January–June 2027 edition: 26 double-sided weekly pages, premium uncoated writing paper, ' +
      'Wire-O top binding with a built-in hanging hole. ' +
      'Includes free access to the cleaning companion website, which turns each day’s cleaning zone into a short checklist ' +
      '(no account, no subscription). A printed paper calendar for your kitchen or family command center.',
    images: [
      '/images/pinterest/catalog/family-wall-calendar-in-use.jpg',
      '/images/pinterest/catalog/family-wall-calendar-on-wall.jpg',
      '/images/pinterest/catalog/family-wall-calendar-specs.jpg',
    ],
    itemGroupId: 'family-wall-calendar-2027',
    size: '26 weeks',
    productType: 'Calendars & Planners > Family Wall Calendars',
    googleProductCategory: 'Office Supplies > Filing & Organization > Calendars, Organizers & Planners',
  },
};

/** What shop_catalog() returns (supabase/migrations/…_shop_digital.sql), the fields the feed reads. */
export interface CatalogProduct {
  slug: string;
  kind: 'physical' | 'digital';
  price_cents: number;
  currency: string;
  available: boolean;
}
export interface CatalogShippingRate {
  label: string;
  amount_cents: number;
  test_only: boolean;
  min_units: number;
  max_units: number | null;
  free_over_cents: number | null;
}
export interface Catalog {
  checkout_mode: 'off' | 'preview' | 'live';
  products: CatalogProduct[];
  shipping_rates: CatalogShippingRate[];
}

/** Pinterest's retail catalog columns, in order. Required: id, title, description, link, image_link, price, availability. */
export const FEED_COLUMNS = [
  'id',
  'title',
  'description',
  'link',
  'image_link',
  'price',
  'availability',
  'brand',
  'condition',
  'additional_image_link',
  'item_group_id',
  'size',
  'product_type',
  'google_product_category',
  'shipping',
] as const;
export type FeedRow = Record<(typeof FEED_COLUMNS)[number], string>;

/** "34.00 USD": a decimal amount and its ISO 4217 code, as Pinterest requires. */
export const feedPrice = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;

/** Pinterest's shipping attribute, country:region:service:price, for one unit to anywhere in the US. */
function feedShipping(rates: CatalogShippingRate[], priceCents: number, currency: string): string {
  const oneUnit = rates.filter((r) => !r.test_only && (r.min_units ?? 1) <= 1 && (r.max_units == null || r.max_units >= 1));
  return oneUnit
    .map((r) => {
      const cents = r.free_over_cents != null && priceCents >= r.free_over_cents ? 0 : r.amount_cents;
      return `US::${r.label.replace(/[:,]/g, ' ')}:${feedPrice(cents, currency)}`;
    })
    .join(',');
}

const absolute = (path: string) => FEED_ORIGIN + path;

/** The rows Pinterest should see right now. Pure: everything comes from `catalog`. */
export function feedRows(catalog: Catalog): FeedRow[] {
  const open = catalog.checkout_mode === 'live';
  const rows: FeedRow[] = [];
  for (const p of catalog.products) {
    const copy = FEED_PRODUCTS[p.slug];
    if (!copy) continue;
    if (!Number.isInteger(p.price_cents) || p.price_cents <= 0 || !/^[a-z]{3}$/i.test(p.currency)) continue;
    rows.push({
      id: p.slug,
      title: copy.title,
      description: copy.description,
      link: absolute(copy.path),
      image_link: absolute(copy.images[0]),
      price: feedPrice(p.price_cents, p.currency),
      availability: open && p.available ? 'in stock' : 'out of stock',
      brand: BRAND,
      condition: 'new',
      additional_image_link: copy.images.slice(1, 11).map(absolute).join(','),
      item_group_id: copy.itemGroupId ?? '',
      size: copy.size ?? '',
      product_type: copy.productType,
      google_product_category: copy.googleProductCategory,
      shipping: p.kind === 'physical' ? feedShipping(catalog.shipping_rates ?? [], p.price_cents, p.currency) : '',
    });
  }
  return rows;
}

/** RFC 4180 cell: quoted when it holds a comma, quote or line break; quotes doubled. */
export const feedCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** UTF-8 CSV text with a header row and CRLF line endings. */
export const feedCsv = (rows: FeedRow[]) =>
  [FEED_COLUMNS.join(','), ...rows.map((r) => FEED_COLUMNS.map((c) => feedCell(r[c])).join(','))].join('\r\n') + '\r\n';

/** Reads the live catalog through the public RPC. Throws on any failure (the handler answers 503). */
export async function loadCatalog(supabaseUrl: string, anonKey: string): Promise<Catalog> {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/shop_catalog`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`shop_catalog ${res.status}`);
  const catalog = (await res.json()) as Catalog;
  if (!catalog || !Array.isArray(catalog.products) || typeof catalog.checkout_mode !== 'string') throw new Error('shop_catalog: unexpected shape');
  return catalog;
}

/**
 * The handler. A database outage answers 503 rather than an empty feed, so Pinterest keeps the
 * last good catalog and retries instead of removing every product.
 */
export async function handleFeed(request: Request, env: Record<string, string | undefined> = process.env): Promise<Response> {
  const head = request.method === 'HEAD';
  if (request.method !== 'GET' && !head) return new Response('Method not allowed\n', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.PUBLIC_SUPABASE_ANON_KEY;
  const noStore = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '3600' };
  if (!url || !key) return new Response('Feed not configured\n', { status: 503, headers: noStore });
  let body: string;
  try {
    body = feedCsv(feedRows(await loadCatalog(url, key)));
  } catch {
    return new Response('Catalog temporarily unavailable\n', { status: 503, headers: noStore });
  }
  return new Response(head ? null : body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="pinterest-feed.csv"',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
      'X-Robots-Tag': 'noindex',
    },
  });
}

export const GET = (request: Request) => handleFeed(request);
export const HEAD = (request: Request) => handleFeed(request);
