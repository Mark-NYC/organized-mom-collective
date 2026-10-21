/**
 * POST /functions/v1/shop-download   { token } → { files: [{ label, product, url }], expires_at, test }
 *                                     { order } + Authorization: Bearer <customer access token> → same, expires_at null
 *
 * With a token: the link from the order emails (expires after DOWNLOAD_DAYS).
 * With an order id and a signed-in customer (/account): Supabase Auth verifies the access token, then
 * shop_account_download checks the order belongs to her verified email. No expiry; refunds still revoke.
 *
 * The /download page calls this with the token from the emailed link. The database checks
 * the token (shop_download: paid, not refunded, not expired) and lists the order's files;
 * each file then gets a signed Storage URL that works for SIGNED_URL_SECONDS. The files sit in
 * the private `shop-downloads` bucket and are never public. Errors: invalid_link (404),
 * link_expired / access_revoked (410), rate_limited (429).
 */
import { DbError } from '../db.ts';
import type { ShopDeps } from '../deps.ts';
import { clientIp, corsHeaders, json, readJson, type Handler } from '../http.ts';

export const DOWNLOAD_BUCKET = 'shop-downloads';
/** Long enough to start a slow download on a phone; the page asks for fresh URLs on each visit. */
export const SIGNED_URL_SECONDS = 600;

interface DownloadGrant {
  order_number: number | null;
  livemode: boolean | null;
  /** null for downloads from her account, which don't expire. */
  expires_at: string | null;
  files: { path: string; label: string; product: string }[];
}

const STATUS: Record<string, number> = { invalid_link: 404, link_expired: 410, access_revoked: 410, rate_limited: 429 };

export function createDownloadHandler(deps: ShopDeps): Handler {
  return async (req) => {
    const cors = corsHeaders(req, deps.env.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    const body = await readJson(req, 2_000);
    const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    const byAccount = Boolean(bearer) && typeof body?.order === 'string';
    if (!body || (!byAccount && typeof body.token !== 'string')) return json({ error: 'invalid_link' }, 404, cors);

    let grant: DownloadGrant;
    try {
      if (byAccount) {
        if (!UUID.test(body.order as string)) return json({ error: 'invalid_link' }, 404, cors);
        const userId = await verifiedUser(deps, bearer!);
        if (!userId) return json({ error: 'unauthorized' }, 401, cors);
        grant = await deps.db.rpc<DownloadGrant>('shop_account_download', { p_user: userId, p_order: body.order, p_client: clientIp(req) });
      } else {
        grant = await deps.db.rpc<DownloadGrant>('shop_download', { p_token: body.token, p_client: clientIp(req) });
      }
    } catch (err) {
      if (err instanceof DbError && STATUS[err.message]) return json({ error: err.message }, STATUS[err.message], cors);
      console.error('shop-download', err);
      return json({ error: 'server_error' }, 500, cors);
    }

    // One missing file shouldn't hide the others: it comes back without a URL.
    const files = await Promise.all(
      grant.files.map(async (f) => ({ label: f.label, product: f.product, url: await signedUrl(deps, f.path).catch(() => null) })),
    );
    return json({ files, expires_at: grant.expires_at, order_number: grant.order_number, test: grant.livemode === false }, 200, cors);
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in customer's user id, if Supabase Auth accepts her access token; otherwise null. */
async function verifiedUser(deps: ShopDeps, token: string): Promise<string | null> {
  const res = await deps.fetch(`${deps.env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: deps.env.anonKey || deps.env.serviceRoleKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json().catch(() => ({}))) as { id?: string };
  return user.id && UUID.test(user.id) ? user.id : null;
}

/** A short-lived URL for one private file, served as an attachment under its own file name. */
export async function signedUrl(deps: ShopDeps, path: string): Promise<string | null> {
  if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]{0,200}$/.test(path) || path.includes('..')) return null;
  const key = deps.env.serviceRoleKey;
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys don't.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const res = await deps.fetch(`${deps.env.supabaseUrl}/storage/v1/object/sign/${DOWNLOAD_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
  });
  if (!res.ok) {
    console.warn('shop-download: could not sign', path, res.status);
    return null;
  }
  const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL ?? data.signedUrl;
  if (!signed) return null;
  const url = new URL(`${deps.env.supabaseUrl}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}`);
  url.searchParams.set('download', path.split('/').pop()!);
  return url.href;
}
