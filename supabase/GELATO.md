# Gelato API integration, phase 1

This is a SAFE pilot, not automatic fulfillment. The new Supabase Edge Function `shop-gelato-draft` creates **draft** orders only, and only when an existing shop administrator calls it with a paid physical shop order UUID. The existing Stripe webhook, checkout, and manual fulfillment remain unchanged. No Gelato order is automatically sent to production.

## Deployment checklist

1. **Already done:** In the correct Supabase project, add `GELATO_API_KEY` in Edge Functions → Secrets. Never add the value to GitHub or client variables.
2. Apply migration `20261101000000_shop_gelato.sql` in Supabase, after existing shop migrations.
3. Verify the product's exact Gelato **productUid**, required file dimensions, file layout, pageCount and real sample. Do not assume an existing Printed.com product uses the same print specification.
4. Upload a *publicly fetchable* Gelato-compatible PDF/X file with no sensitive information, then configure the matching shop product by UUID:

```sql
insert into public.shop_gelato_products(product_id, product_uid, print_file_url, page_count, enabled)
values ('REAL_SHOP_PRODUCT_UUID', 'VERIFIED_GELATO_PRODUCT_UID',
        'https://PUBLIC_HOST/print-ready.pdf', null, true)
on conflict (product_id) do update
set product_uid=excluded.product_uid, print_file_url=excluded.print_file_url,
    page_count=excluded.page_count, enabled=excluded.enabled, updated_at=now();
```

For multipage products, provide the *confirmed* page count in place of null, including covers if applicable.
5. Deploy the Supabase function `shop-gelato-draft` and verify it is accessible on the expected project. This PR does not deploy it.
6. From an **authenticated shop admin session**, POST to `/functions/v1/shop-gelato-draft` with a JSON body `{"order_id":"PAID_SHOP_ORDER_UUID"}` and `Authorization: Bearer <ADMIN_SESSION_ACCESS_TOKEN>` and your project's public anon key as the `apikey` header. Do not run against arbitrary customer orders.
7. Confirm the resulting *draft* appears in Gelato and the `shop_gelato_orders` record has status `draft`. Review pricing, production, shipping and file quality before approving manually in Gelato.

## Safety behavior

* One claim per order enforced by the `shop_gelato_orders.order_id` primary key and `shop_gelato_claim` SQL function. A repeated POST returns 409.
* Network timeouts and ambiguous Gelato responses become `needs_review`. **Never delete a claim or blindly retry**. Search Gelato by orderReferenceId (our shop UUID) and reconcile manually first.
* An unmapped item blocks the *entire* order; no split fulfillment. Digital orders and unpaid orders are ineligible. The function creates drafts, not active production orders.
* No customer-visible UI, tracking webhook, admin button, or automated production conversion has been added. Those require further work after the first successful sample and finance check.
* Fulfillment status remains controlled through existing admin workflows; the Gelato draft does not mark an order shipped.

## Gelato documentation

* https://dashboard.gelato.com/docs/orders/v4/create/
* https://dashboard.gelato.com/docs/webhooks/


## Read-only calendar product lookup

This repository includes `shop-gelato-product`, a dedicated read-only admin endpoint for the existing Gelato Manual store product. It calls Gelato's documented ecommerce Get Product endpoint server-side, using the `GELATO_API_KEY` Supabase secret.

- Store: `fc4a8fec-06f5-4823-815f-cec8937b4df4`
- Gelato product: `a3755bc5-1a7e-4690-89df-6913d6bb6074`
- The earlier UUID `d57a4f39-4bc3-40df-8e70-7e448487b38a` was identified as a template ID and is **not** the Product UID.
- Current product variant shown in dashboard: Ledger (11x16.5 in), vertical, wire hanger. Do not assume its Product UID from the size.

To activate:

1. Deploy Supabase Edge Function `shop-gelato-product` in the same project where `GELATO_API_KEY` is set.
2. Authenticate as a current shop administrator.
3. POST `{}` to `https://<PROJECT_REF>.supabase.co/functions/v1/shop-gelato-product` with the admin session Bearer token and public Supabase anon-key header.
4. The response includes `variants[].product_uid`. Verify which variant corresponds to the pictured Ledger wall calendar.
5. Only then add the Gelato product UID and a verified print PDF URL to `shop_gelato_products` using the mapping instructions above.
6. Before a paid draft submission, confirm Gelato's supported file type/page count, destination pricing, and that the shop UUID and Gelato item correspond to the same item.

This endpoint does not modify products, create orders or release production. Keep it owner-only. The API key never appears in its response.

Reference: https://dashboard.gelato.com/docs/ecommerce/products/get/


## Deploy through Supabase Dashboard (no terminal)

Both Gelato Edge Functions are now **self-contained** in their respective `index.ts` files. They do not import `../_shared/*`. This avoids the dashboard's "Module not found _shared/db.ts" bundling error.

Open the Supabase project Dashboard → Edge Functions → each named function → Code. Replace the existing code with the **full raw index.ts** content from GitHub and deploy. Use the production branch after PR merge (or the PR branch's raw file if not yet merged).

1. `shop-gelato-product`: read-only admin product lookup, no orders.
2. `shop-gelato-draft`: authenticated manual draft order submission, never auto-triggered.

Both use the existing `GELATO_API_KEY` in Supabase Secrets, plus Supabase's standard `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` variables. Disable the gateway's legacy JWT verification for these functions: they perform their own Supabase Auth admin check and enforce `shop_is_admin_user` before accessing Gelato.

The SQL migration `20261101000000_shop_gelato.sql` must be applied separately before creating any draft orders. Pasting a function does **not** deploy its migration.

After the read-only lookup is deployed, call it with your existing authenticated admin's Supabase access token and inspect its product JSON for variant Product UIDs. Do not expose credentials in browser UI or GitHub. No production order is sent by this lookup.


## Verified calendar variant (Gelato API readback, 2026-11-01)

- Site product slug: `family-schedule-calendar-2027` (seeded in `20261028000000_shop_scheduler.sql`; seeded with zero stock, $30.99).
- Gelato store ID: `fc4a8fec-06f5-4823-815f-cec8937b4df4`
- Gelato ecommerce product ID: `a3755bc5-1a7e-4690-89df-6913d6bb6074`
- Gelato variant ID: `69683d5c-b524-49db-b41e-ed3035c3ad2f`
- Gelato variant title: Ledger (11x16.5″) - Vertical - Binding with wire hanger
- **Verified Product UID**: `wall_calendar_product_pf_xl11x16-5-inch_pt_100-lb-cover-coated-silk_cl_4-4_bt_wire-with-hook-top_ct_none_prt_none_ver`
- Variant connection status: `connected`. Product status was `created`, not published.

**Not yet verified:** print-ready artwork/PDF URL, page count, physical sample, actual order cost and shipping, `shop_gelato_products` mapping in live Supabase, whether SQL migration applied, a Gelato draft order, and website product stock/availability. Do not set a guessed file URL or turn on sales just because the variant is connected. Preview S3 URLs expire and are not print files.

When the correct permanent public printable PDF URL and page count are confirmed, configure the mapping with an existing shop product ID selected by slug:

```sql
insert into public.shop_gelato_products(product_id, product_uid, print_file_url, page_count, enabled)
select id,
  'wall_calendar_product_pf_xl11x16-5-inch_pt_100-lb-cover-coated-silk_cl_4-4_bt_wire-with-hook-top_ct_none_prt_none_ver',
  'REPLACE_WITH_VERIFIED_HTTPS_PRINT_FILE_URL',
  null, false
from public.shop_products where slug = 'family-schedule-calendar-2027'
on conflict (product_id) do update
  set product_uid=excluded.product_uid, print_file_url=excluded.print_file_url,
      page_count=excluded.page_count, enabled=false, updated_at=now();
```

Do not execute until a real URL is available. Set `enabled=true` only after print-file/page-count checks, and only create draft orders before final fulfillment approval.
