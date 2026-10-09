# Direct website shop

Customers buy the calendar at `/checkout` (Stripe embedded checkout); you run orders, inventory and shipping at `/admin/orders`. Etsy is untouched: no import, no sync, and every buy button on the site still goes to Etsy.

**Status: built and tested in Stripe test mode, switched off.** Nothing is public until you flip the switches in [Launch](#launch).

## How it works

```
Browser (/checkout)                    Supabase Edge Functions                 Postgres (shop_* tables)
  pick calendar + qty ───────────────▶ shop-checkout ── shop_create_order ──▶ takes units out of stock (atomic)
  Stripe embedded form ◀── client_secret ◀── Stripe Checkout Session          pending order, held for 30 min
  pays (card / Apple Pay / Google Pay)
                          Stripe ─────▶ stripe-webhook ── signature check ──▶ shop_mark_paid (once per event)
                                           re-fetches session from Stripe     order number, entitlement
                                           sends confirmation email (Resend)
  /checkout/complete polls ──────────────────────────── shop_order_status ──▶ "confirmed" only when paid
Dashboard (/admin/orders)
  reads  ──────────────── row-level security (shop_admins only) ───────────▶ orders, products, emails
  writes ──────────────▶ shop-admin ── verifies admin token ── Stripe refunds / shop_* functions / emails
```

- **The site stays static.** No server added to the Astro build; all server logic is in three Supabase Edge Functions (`supabase/functions/`) and SQL functions (`migrations/20261010000000_shop.sql`). No new npm dependencies, no Stripe SDK (plain `fetch`), no paid services beyond Stripe's per-transaction fees (and Resend's free tier).
- **Paid means the webhook said so.** The success page only polls the database. The webhook verifies Stripe's signature, records each event id once, and re-reads the Checkout Session from Stripe before marking anything paid.
- **No overselling.** Starting checkout takes units out of stock in one conditional `UPDATE … WHERE stock >= qty`, so two buyers can't take the last unit (tested with 40 simultaneous checkouts for 25 units). Units come back when the checkout expires (Stripe's `checkout.session.expired`, or a 40-minute timeout if that webhook is missed), fails, or the customer taps *Change order*.
- **Prices, stock, discounts are server-side.** The browser sends only a product slug and a quantity. Discount codes are Stripe promotion codes, validated by Stripe.
- **Card data never touches us.** It stays inside Stripe's iframe.
- **Entitlements.** Each paid order records a `companion` entitlement by email in `shop_entitlements` (revoked on full refund). Nothing is gated on it: the companion stays open to everyone, no account needed. It has a nullable `user_id` for future accounts.

## Routes

| Route | What | Indexing |
| --- | --- | --- |
| `/checkout` | Product, quantity, Stripe embedded checkout. `?product=calendar-52-week` preselects; `?preview=TOKEN` for preview mode | noindex, not linked, not in sitemap |
| `/checkout/complete?session_id=…` | Confirmation (polls until the webhook confirms) | noindex |
| `/admin/orders` | Orders, inventory, settings (shop admins only) | noindex |
| `…/functions/v1/shop-checkout` | Create / cancel checkout | Edge Function |
| `…/functions/v1/stripe-webhook` | Stripe events | Edge Function |
| `…/functions/v1/shop-admin` | Every dashboard write | Edge Function |

## Set up (test mode)

You need: the Supabase project the survey already uses, a Stripe account (test mode), and optionally a Resend account. Use the Supabase CLI (`npx supabase`) or the dashboard.

1. **Database.** Run `migrations/20261010000000_shop.sql` (SQL editor, or `supabase db push`). It creates the tables, seeds the two calendars (26-week: $34, 25 units, active; 52-week: $54, 0 units, hidden) and one **placeholder** shipping rate ($6 "Standard shipping"). Checkout starts **off**.
2. **Your admin login.** Use the same Supabase Auth user as the survey, or add one (Authentication → Users → Add user). Then:
   ```sql
   insert into public.shop_admins (user_id) select id from auth.users where email = 'you@example.com';
   ```
3. **Stripe (test mode).** Dashboard → Developers → API keys: copy the test **secret** key (`sk_test_…`) and **publishable** key (`pk_test_…`).
4. **Deploy the functions.** `supabase/config.toml` turns the gateway JWT check off for all three (each checks its own callers).
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase functions deploy shop-checkout
   npx supabase functions deploy stripe-webhook
   npx supabase functions deploy shop-admin
   ```
5. **Stripe webhook.** Stripe → Developers → Webhooks → Add endpoint (test mode): `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`, events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`, `refund.failed`, `charge.dispute.created`. Copy its signing secret (`whsec_…`).
6. **Function secrets** (Supabase → Edge Functions → Secrets, or `npx supabase secrets set KEY=value`). `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` are provided automatically.

   | Secret | Value |
   | --- | --- |
   | `STRIPE_SECRET_KEY` | `sk_test_…` (a live key is refused unless `SHOP_LIVE_PAYMENTS=enabled`) |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 5 |
   | `SHOP_SITE_URL` | `https://organizedmomcollective.com` (default) |
   | `SHOP_ALLOWED_ORIGINS` | Browser origins allowed to call the functions, comma-separated. Default: the site URL. Add a preview deploy URL or `http://localhost:4321` to test there |
   | `SHOP_PREVIEW_TOKEN` | Any long random string; unlocks checkout in preview mode via `/checkout?preview=…` |
   | `RESEND_API_KEY` | Optional. Without it, emails are logged as "skipped" and checkout still works |
   | `SHOP_EMAIL_FROM` | Default `Organized Mom Collective <orders@organizedmomcollective.com>` (domain must be verified in Resend) |
   | `SHOP_EMAIL_REPLY_TO` | An inbox you read. When set, emails say "Questions? Just reply" |
   | `SHOP_LIVE_PAYMENTS` | Leave unset. `enabled` only when live payments are approved |
7. **Site build variables** (host settings and `.env`; see `.env.example`): `PUBLIC_SHOP_ENABLED=true` and `PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`, plus the existing Supabase two. Set these on a **preview deployment** first; production can stay `false`.
8. **Email (Resend).** Free tier: create an account, verify `organizedmomcollective.com` (DNS records), create an API key → `RESEND_API_KEY`. Emails: order confirmation/receipt (with companion instructions), shipping with tracking, refund/cancellation, and companion instructions on demand from the dashboard.

## Test a purchase

1. `/admin/orders` → Settings → Website checkout → **Preview**.
2. Open `/checkout?preview=<SHOP_PREVIEW_TOKEN>` (on your phone too).
3. Continue to payment. Card `4242 4242 4242 4242`, any future date, any CVC, any US address. Declines: `4000 0000 0000 0002`. 3D Secure: `4000 0025 0000 3155`. A discount: create a coupon + promotion code in Stripe (test mode) and enter it.
4. You land on `/checkout/complete`: "Confirming…" then "confirmed" once the webhook arrives. The email arrives if Resend is set up.
5. Abandoned checkout: start one and close the tab. Its units show under Inventory → *In checkout* until Stripe expires the session (30 minutes), then return.

## Manage an order

1. `/admin/orders` → Orders (paid orders by default; filter, search, date range, **Export CSV**).
2. Open an order: customer, address (*Copy address*), items, totals, timeline, emails.
3. **Packing** while you pack. **Mark shipped** with carrier + tracking number (USPS/UPS/FedEx links are built automatically); the customer gets the shipping email if the box is ticked. **Delivered** when it arrives.
4. **Refund**: full or partial, through Stripe, emails the customer. Tick *put units back in stock* only if they're physically back. A full refund before shipping cancels the order. Refunds made in the Stripe dashboard also land here via the webhook.
5. **Inventory**: add/remove or set the count (with a reason; logged). If you sell a calendar on Etsy from the same shelf, take it out here. *Show/Hide in checkout* and *Edit details* (price, edition, description, photos).
6. **Settings**: checkout Off / Preview / Open, sales tax mode, shipping rates.

## Decisions before launch (yours)

- **Sales tax.** Find out where you must collect (your home state at least; other states once you pass their economic-nexus thresholds) and register. Then pick a mode in Settings: *Stripe Tax* (accurate local rates; add your registrations in Stripe; per-transaction fee) or *manual* (one rate per state in `shop_tax_rates`; state rate only, shipping not taxed). Default is **off**: no tax collected.
- **Shipping rates.** The $6 rate is a placeholder. Set real rates (and whether multiples cost more: rates are flat per order). Add delivery estimates only if you'll keep them.
- **Which edition ships.** The 26-week calendar comes in January–June and July–December 2027. The listing has no edition set. Either set *Edition* on the product, or add a second product for the other half (new row in `shop_products`).
- **Per-order limit** (5) and **stock** (25 for website sales; your Etsy stock is separate and not synced).
- **Return/refund policy** and a contact address for order questions (`SHOP_EMAIL_REPLY_TO`).
- **Apple Pay.** Register `organizedmomcollective.com` under Stripe → Settings → Payment method domains (for both test and live). Google Pay works without it.

## Launch

Each step needs your explicit go-ahead.

1. Stripe live mode: activate the account, create the live webhook (same URL and events) and use its secret.
2. Functions: `STRIPE_SECRET_KEY=sk_live_…`, `STRIPE_WEBHOOK_SECRET=<live whsec>`, `SHOP_LIVE_PAYMENTS=enabled`.
3. Site: `PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…`, `PUBLIC_SHOP_ENABLED=true`, redeploy.
4. Dashboard → Settings → **Open**.
5. Switch the buy buttons (a code change: `ShopButton`, `CalendarOptions`, `/app/reorder`, plus `tests/shop.test.ts` → *launch guards*, which fails while anything public links to `/checkout`).

To pause at any point: Settings → **Off** (instant; paid orders unaffected).

## Tests

- `npm test`: checkout/session logic, signatures, emails, dashboard math and CSV, launch guards.
- `npm run test:shop`: 45 end-to-end tests on a throwaway local database (the real migrations, PostgREST, the real function handlers; Stripe, Resend and Auth faked): payment, duplicate and forged webhooks, declines, abandoned/expired/canceled checkouts, 40-way overselling race, late payments, refunds, emails, admin auth, row-level security. Needs PostgreSQL and PostgREST locally (header of `scripts/test-shop.sh`).
- Not testable here: the real Stripe iframe, Apple/Google Pay sheets and real email delivery. Do the test purchase above on a phone before launch.

## Later: shipping labels

Fulfillment is manual on purpose. A label provider (Pirate Ship has no public API; Shippo/EasyPost do) would plug into the `fulfillment` action in `supabase/functions/_shared/handlers/admin.ts`: buy the label, then call `shop_set_fulfillment` with the carrier and tracking number it returns. Same email, same timeline.
