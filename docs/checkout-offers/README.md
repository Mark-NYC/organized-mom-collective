# Checkout offers foundation (disabled until launch)

## What is already in the repo
- Embedded Stripe Checkout, created server-side by `shop-checkout`.
- Atomic stock reservations from `shop_create_order`; order rows and Stripe webhook reconciliation.
- Product-page checkout auto-opens immediately for selected SKUs.
- Club billing exists but is not automatically authorized by a calendar purchase.

## Added here
- A private `shop_offers` table for placement, eligibility and activation.
- Private `shop_checkout_journeys` with first/last-touch UTM fields.
- A private append-only `shop_offer_events` funnel ledger with deduplication keys.
- Typed and unit-testable offer eligibility and UTM normalization helpers.
- **All offers remain inactive; no checkout UX, price, shipping, or charge behavior changes.**

## Rollout (do not skip)
1. Apply migration to the intended Supabase project. Verify RLS and admin-only/service-role access.
2. Confirm responsibility card product and actual live pricing/stock, shipping weight, tax treatment, image and fulfillment.
3. Add a server-side offer resolver to `shop-checkout`. Ignore client-submitted prices. Use a configured product slug and existing `shop_create_order` for combined carts. **Do not use Stripe Checkout optional items alone unless it can reconcile server-side inventory/order items and refunds.**
4. Add a single optional checkbox in the OMC order summary, before the embedded payment opens. Keep the linked-product auto-checkout path frictionless; do not interpose a new page.
5. On the server, attach an opaque journey ID to the created Stripe Checkout Session and persist the checkout-order mapping. Track offer viewed/declined/accepted idempotently. Do not mark paid from the browser.
6. Record checkout completion only after Stripe webhook payment confirmation. Cross-reference `shop_orders` for AOV and contribution margin.
7. For post-purchase upsells: first establish explicit consent for payment method reuse, mode/livemode checks, inventory reservation and reliable authenticated association with the just-paid order. Handle SCA/requires_action, failed payments, duplicate clicks and refunds. A Checkout Session ID in a return URL is NOT authority to charge a card. Never use an arbitrary `payment_method` or customer ID supplied by the browser.
8. Test failure/retry, stock exhaustion, promo codes, US shipping, tax, Apple Pay, webhook retries, missing consent, refund and duplicate-click behavior in Stripe test mode.
9. Start an A/B holdout and compare **contribution profit per checkout start** and **payment completion**, not just offer acceptance.

## Security / measurement
- GitHub stores code, not customer payment credentials.
- Supabase tracks first/last touch, offer impressions, acceptances and decline events. UTMs are not a full event system.
- Stripe's verified paid orders are the revenue source of truth.
- No PII in UTMs, public events or arbitrary JSON event metadata. Keep public endpoints constrained/rate-limited.
- Event deduplication and server authorization are mandatory before public event collection.
- Avoid assuming free trial Club starts equal immediate revenue.
- Feature activation must be explicit, reversible and separate from publishing code.

## Suggested offer rollout
1. Calendar -> Responsibility Cards order bump. Price only after margin validation.
2. Paid calendar -> Club opt-in after purchase. This is an invitation, not a silent recurring charge.
3. Conditional downsell only after rejection data validates the use case.
