/**
 * POST /functions/v1/shop-gelato-draft { order_id }
 * Owner-only, paid physical orders only. Creates a Gelato DRAFT, never a production order.
 * Fail closed: uncertain submissions retain their claim, requiring manual investigation.
 */
import { createDb, loadOrder } from '../_shared/db.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { readEnv } from '../_shared/env.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const env = readEnv((key) => Deno.env.get(key));
const db = createDb(env.supabaseUrl, env.serviceRoleKey);

Deno.serve(async (req) => {
  const cors = corsHeaders(req, env.allowedOrigins);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
  try {
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ error: 'unauthorized' }, 401, cors);
    const userRes = await fetch(env.supabaseUrl + '/auth/v1/user', {
      headers: { apikey: env.anonKey || env.serviceRoleKey, Authorization: 'Bearer ' + token },
    });
    if (!userRes.ok) return json({ error: 'unauthorized' }, 401, cors);
    const user = await userRes.json();
    if (!user.id || !UUID.test(user.id) || !await db.rpc<boolean>('shop_is_admin_user', { p_user: user.id })) {
      return json({ error: 'forbidden' }, 403, cors);
    }
    const body = await req.json().catch(() => null);
    const orderId = body?.order_id;
    if (typeof orderId !== 'string' || !UUID.test(orderId)) return json({ error: 'invalid_order_id' }, 400, cors);
    const order = await loadOrder(db, orderId);
    if (!order) return json({ error: 'not_found' }, 404, cors);
    if (order.payment_status !== 'paid' || order.digital || order.fulfillment_status !== 'unfulfilled')
      return json({ error: 'order_not_eligible' }, 409, cors);
    if (!order.email || !order.shipping_address || !order.shop_order_items.length)
      return json({ error: 'missing_order_details' }, 422, cors);
    const key = Deno.env.get('GELATO_API_KEY');
    if (!key) return json({ error: 'gelato_not_configured' }, 503, cors);
    const mappingRows = await db.select<{ product_id: string; product_uid: string; print_file_url: string; page_count: number | null }>(
      'shop_gelato_products', 'select=product_id,product_uid,print_file_url,page_count&enabled=eq.true',
    );
    const mappings = new Map(mappingRows.map((m) => [m.product_id, m]));
    if (order.shop_order_items.some((item) => !mappings.has(item.product_id)))
      return json({ error: 'unmapped_products', product_slugs: order.shop_order_items.filter((i) => !mappings.has(i.product_id)).map((i) => i.product_slug) }, 422, cors);
    const address = order.shipping_address;
    const name = (order.shipping_name || order.customer_name || '').trim().split(/\s+/);
    const firstName = name.shift() || '';
    const lastName = name.join(' ') || firstName;
    if (!firstName || !address.line1 || !address.city || !address.postal_code || !address.country)
      return json({ error: 'incomplete_shipping_address' }, 422, cors);
    if (['US','CA','AU'].includes(address.country.toUpperCase()) && !address.state)
      return json({ error: 'missing_shipping_state' }, 422, cors);
    const claimed = await db.rpc<boolean>('shop_gelato_claim', { p_order: orderId });
    if (!claimed) return json({ error: 'already_claimed_or_not_paid', detail: 'Review shop_gelato_orders before any retry' }, 409, cors);
    const items = order.shop_order_items.map((item) => {
      const m = mappings.get(item.product_id)!;
      return {
        itemReferenceId: item.id, productUid: m.product_uid, quantity: item.quantity,
        files: [{ type: 'default', url: m.print_file_url }],
        ...(m.page_count ? { pageCount: m.page_count } : {}),
      };
    });
    const payload = {
      orderType: 'draft', orderReferenceId: order.id,
      customerReferenceId: order.id, currency: 'USD', items,
      shippingAddress: {
        firstName, lastName, addressLine1: address.line1, addressLine2: address.line2 || undefined,
        city: address.city, state: address.state || undefined, postCode: address.postal_code,
        country: address.country.toUpperCase(), email: order.email,
      },
    };
    let response: Response;
    try {
      response = await fetch('https://order.gelatoapis.com/v4/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      await db.rpc('shop_gelato_record', { p_order: orderId, p_status: 'needs_review', p_error: 'network_uncertain' });
      return json({ error: 'gelato_response_uncertain', detail: 'Check Gelato dashboard before any retry' }, 502, cors);
    }
    if (!response.ok) {
      await db.rpc('shop_gelato_record', { p_order: orderId, p_status: 'needs_review', p_error: 'http_' + response.status });
      return json({ error: 'gelato_rejected', status: response.status, detail: 'Inspect Gelato dashboard and mappings before retrying' }, 502, cors);
    }
    const result = await response.json().catch(() => null);
    if (!result?.id) {
      await db.rpc('shop_gelato_record', { p_order: orderId, p_status: 'needs_review', p_error: 'missing_gelato_order_id' });
      return json({ error: 'gelato_response_uncertain' }, 502, cors);
    }
    await db.rpc('shop_gelato_record', { p_order: orderId, p_status: 'draft', p_gelato_id: result.id });
    return json({ ok: true, status: 'draft', gelato_order_id: result.id }, 200, cors);
  } catch (error) {
    console.error('shop-gelato-draft', error);
    return json({ error: 'server_error' }, 500, cors);
  }
});
