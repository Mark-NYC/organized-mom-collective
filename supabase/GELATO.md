# Gelato API integration, phase 1

This is a SAFE pilot, not automatic fulfillment. The new Supabase Edge Function `shop-gelato-draft` creates **draft** orders only, and only when an existing shop administrator calls it with a paid physical shop order UUID. The existing Stripe webhook, checkout, and manual fulfillment remain unchanged. No Gelato order is automatically sent to production.

## Deployment checklist (private print files)

1. Keep `GELATO_API_KEY` in Supabase Edge Function Secrets.
2. Apply migrations in order: `20261101000000_shop_gelato.sql`, then `20261102000000_shop_gelato_private_storage.sql`. The second migration creates a **disabled** mapping for `family-schedule-calendar-2027`.
3. In Supabase Storage, confirm bucket `gelato-print-files` is PRIVATE and contains the original `2027-family-wall-calendar.pdf` object.
4. Deploy the **updated**, standalone `shop-gelato-draft` function from GitHub's `supabase/functions/shop-gelato-draft/index.ts` using the Dashboard editor. Previous live version still reads a public URL and MUST be replaced.
5. Keep gateway Verify JWT off on that function, because it independently validates the Supabase admin user and `shop_is_admin_user`.
6. Confirm `shop_gelato_products` has `enabled=false`, `storage_object_path='2027-family-wall-calendar.pdf'`, `page_count=13`, `print_file_url=null`, and the verified UID. The private bucket contains paid design artwork; NEVER expose its signed link in the UI, logs, GitHub, or browser requests.
7. After independently validating exact file dimensions, print areas, Gelato's page-count and PDF compatibility requirements, perform a controlled test. Enabling the mapping does **not** submit an order, but an owner invoking `shop-gelato-draft` for a paid unfulfilled order will create a Gelato **draft**, not a production order.
8. Confirm draft and eventual file ingestion in Gelato before approving production manually. The signing TTL is 7200 seconds (2 hours); whether this is adequate for later Gelato processing must be verified. If Gelato processes files only after converting the draft to production, generate a fresh signed URL at that later point instead of relying on this one.

### Run in Supabase SQL Editor to check mapping (read-only)

```sql
select p.slug, g.product_uid, g.storage_object_path, g.page_count, g.enabled,
       g.print_file_url
from public.shop_products p
join public.shop_gelato_products g on g.product_id=p.id
where p.slug='family-schedule-calendar-2027';
```

### Private file technical details

The function uses the Supabase Storage REST signing endpoint from the Edge Function's service-role environment. It builds a time-limited signed download URL on the server, sends it only in the Gelato create-draft request, and never stores it in database mappings or returns it to the admin client. All file signing happens **before** the duplicate-safe order claim. Errors in signing block submission entirely.

This does not restore secrecy for the old GitHub commit history. The public PDF was removed from `main`, but historical Git objects and third-party caches may retain it. Consider the old copy exposed and arrange history cleanup where feasible.

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

## Private print-file delivery (security decision, 2026-11-01)

**Never host the paid calendar PDF in public GitHub or the website's /public folder.** The previous public file was removed from main in commit 53a2933, but GitHub commit history/caches may still contain it. Contact GitHub Support or use a carefully reviewed history rewrite to address the historical blob; deleting the current file does not erase history.

Use a **private Supabase Storage bucket** (example: `gelato-print-files`) for the print-ready calendar. Restrict reads/writes to backend service-role only. Store just the bucket/object path in the product mapping, never a permanent public URL.

When an authorized admin submits a draft order, the backend should create a limited-lifetime signed download URL server-side and pass it to Gelato. Confirm the expiry window is long enough for Gelato's file ingestion. Do not log or return the signed URL to frontend clients. Do not submit an order until the function is updated to support signed URLs and tested. Existing `shop-gelato-draft` is NOT compatible with private storage as written because it reads `print_file_url` directly.

Keep mapping disabled and site product stock zero until private bucket upload, signed URL support, sample validation, and end-to-end tests are complete.
