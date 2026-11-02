/**
 * Read-only Gelato product lookup for the OMC calendar.
 * Requires a Supabase authenticated shop admin; never exposes GELATO_API_KEY.
 */
import { createDb } from '../_shared/db.ts';
import { readEnv } from '../_shared/env.ts';
import { corsHeaders, json } from '../_shared/http.ts';

const STORE_ID = 'fc4a8fec-06f5-4823-815f-cec8937b4df4';
const PRODUCT_ID = 'a3755bc5-1a7e-4690-89df-6913d6bb6074';
const env = readEnv((key) => Deno.env.get(key));
const db = createDb(env.supabaseUrl, env.serviceRoleKey);

Deno.serve(async (req) => {
  const cors = corsHeaders(req, env.allowedOrigins);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
  try {
    const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return json({ error: 'unauthorized' }, 401, cors);
    const userResponse = await fetch(env.supabaseUrl + '/auth/v1/user', {
      headers: { apikey: env.anonKey || env.serviceRoleKey, Authorization: 'Bearer ' + bearer },
    });
    if (!userResponse.ok) return json({ error: 'unauthorized' }, 401, cors);
    const user = await userResponse.json();
    if (!user.id || !await db.rpc<boolean>('shop_is_admin_user', { p_user: user.id }))
      return json({ error: 'forbidden' }, 403, cors);
    const key = Deno.env.get('GELATO_API_KEY');
    if (!key) return json({ error: 'gelato_not_configured' }, 503, cors);
    const response = await fetch(
      'https://ecommerce.gelatoapis.com/v1/stores/' + STORE_ID + '/products/' + PRODUCT_ID,
      { headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) {
      console.error('gelato product lookup status', response.status);
      return json({ error: 'gelato_lookup_failed', upstream_status: response.status }, 502, cors);
    }
    const product = await response.json();
    if (product.id !== PRODUCT_ID || product.storeId !== STORE_ID || !Array.isArray(product.variants))
      return json({ error: 'unexpected_gelato_product' }, 502, cors);
    return json({
      store_id: STORE_ID, product_id: PRODUCT_ID,
      title: product.title, status: product.status,
      variants: product.variants.map((v: Record<string, unknown>) => ({
        id: v.id, title: v.title, product_uid: v.productUid, connection_status: v.connectionStatus,
      })),
    }, 200, cors);
  } catch (e) {
    console.error('gelato product lookup', e);
    return json({ error: 'server_error' }, 500, cors);
  }
});
