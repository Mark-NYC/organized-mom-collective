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
