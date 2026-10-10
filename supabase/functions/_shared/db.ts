/**
 * The database, through Supabase's REST API with the service role key (functions only;
 * never in the browser). All writes are the shop_* SQL functions in
 * supabase/migrations/*_shop.sql, which do the locking and validation.
 */

export class DbError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export interface Db {
  rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>;
  select<T = unknown>(table: string, query: string): Promise<T[]>;
}

export function createDb(supabaseUrl: string, serviceKey: string, fetchFn: typeof fetch = fetch): Db {
  const headers: Record<string, string> = { apikey: serviceKey, 'Content-Type': 'application/json' };
  // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys don't.
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`;

  const fail = async (res: Response) => {
    let message = `db_${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.message === 'string') message = body.message;
    } catch {
      /* keep the status */
    }
    return new DbError(message, res.status);
  };

  return {
    async rpc<T>(name: string, args: Record<string, unknown> = {}) {
      const res = await fetchFn(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
      if (!res.ok) throw await fail(res);
      const text = await res.text();
      return (text ? JSON.parse(text) : null) as T;
    },
    async select<T>(table: string, query: string) {
      const res = await fetchFn(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers });
      if (!res.ok) throw await fail(res);
      return (await res.json()) as T[];
    },
  };
}

export interface OrderItemRow {
  id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  unit_price_cents: number;
  quantity: number;
  restocked: number;
}

export interface OrderRow {
  id: string;
  order_number: number | null;
  created_at: string;
  payment_status: 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'failed' | 'expired' | 'canceled';
  fulfillment_status: 'unfulfilled' | 'packing' | 'shipped' | 'delivered' | 'canceled';
  reservation: 'held' | 'converted' | 'released';
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  livemode: boolean | null;
  email: string | null;
  customer_name: string | null;
  shipping_name: string | null;
  shipping_address: Address | null;
  shipping_method: string | null;
  promotion_code?: string | null;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number | null;
  refunded_cents: number;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  flags: string[];
  shop_order_items: OrderItemRow[];
}

export interface Address {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export async function loadOrder(db: Db, id: string): Promise<OrderRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db.select<OrderRow>('shop_orders', `id=eq.${id}&select=*,shop_order_items(*)`);
  return rows[0] ?? null;
}
