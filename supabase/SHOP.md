# Direct website shop

Customers buy the calendar at `/checkout` (Stripe embedded checkout); you run orders, inventory and shipping at `/admin/orders`. Etsy is untouched: no import, no sync, and the calendar's buy buttons are unchanged. The same checkout also sells **downloads** (the $9 Weekly Reset System from `/weekly-reset`, and the $29 Take Back Control from `/take-back-control`): see [Digital products](#digital-products).

**Status: built, tested against fakes and a real local database, switched off.** Nothing is public and no real money can move until you complete [Launch](#launch).

## The launch gate

Real payments need **all five**. Each is checked on the server; the database (`shop_create_order`) makes the final call.

| # | Switch | Where | Ships as |
| --- | --- | --- | --- |
| 1 | Live Stripe secret key (`sk_live_…`) | Supabase function secret `STRIPE_SECRET_KEY` | not set |
| 2 | **Deployment flag** `SHOP_LIVE_CHECKOUT=enabled` | Supabase function secret | not set |
| 3 | **Store setting** checkout = Open | Dashboard → Settings | Off |
| 4 | At least one real (not test-only) shipping rate | Dashboard → Settings | none (only a test placeholder) |
| 5 | Sales tax decided and saved (Stripe Tax, or deliberately not collecting) | Dashboard → Settings → Sales tax | not decided |

What each combination does:

| Store setting | Deployment flag | Stripe key | Result |
| --- | --- | --- | --- |
| Off | any | any | Closed |
| Preview | any | test | Only with `/checkout?preview=TOKEN`; test cards, no real money |
| Preview | any | live | **Closed.** Preview never takes real money |
| Open | off | test | Closed |
| Open | off | live | Closed: functions refuse a live key without the flag (also refunds and webhooks) |
| Open | on | test | Public **test** checkout (no real charges) |
| Open | on | live | Real payments, if a real shipping rate exists and the tax setting was saved; otherwise closed |

Dashboard → Settings → **Launch readiness** shows which switches are on (no secret values). `PUBLIC_SHOP_ENABLED` (Vercel) only decides whether the `/checkout` page renders; it is not a security control.

Placeholder shipping: the seeded "$6 Standard shipping (test placeholder)" is marked **test only**. It is never offered with a live key, and a live checkout refuses to open until you add a real rate.

## How it works

```
Browser (/checkout)                    Supabase Edge Functions                 Postgres (shop_* tables)
  pick calendar + qty ───────────────▶ shop-checkout ── shop_create_order ──▶ launch gate, then takes units out
  Stripe embedded form ◀── client_secret ◀── Stripe Checkout Session          of stock (atomic); 30-min hold
  pays (card / Apple Pay / Google Pay)
                          Stripe ─────▶ stripe-webhook ── signature check ──▶ shop_mark_paid (once per event)
                                           re-fetches session from Stripe     order number, entitlement
                                           sends confirmation email (Resend)
  /checkout/complete polls ──────────────────────────── shop_order_status ──▶ "confirmed" only when paid
Dashboard (/admin/orders)
  reads  ──────────────── row-level security (shop_admins only) ───────────▶ orders, products, emails
  writes ──────────────▶ shop-admin ── verifies admin token ── Stripe refunds / shop_* functions / emails
```

- **The site stays static.** All server logic lives in three Supabase Edge Functions (`supabase/functions/`) and SQL functions (`migrations/20261010000000_shop.sql`). No new npm dependencies, no Stripe SDK.
- **Paid means the webhook said so.** Signature-verified (5-minute tolerance), each event id processed once, the session re-read from Stripe, amount/currency/mode cross-checked (mismatches flag the order).
- **No overselling.** One conditional `UPDATE … WHERE stock >= qty`, so two buyers can't take the last unit (tested: 40 simultaneous checkouts for 25 units). Units come back on expiry, failure or *Change order*. If a payment lands after its hold expired and the stock is gone, the order is flagged *oversold*.
- **Shipping is quoted in the database** for the exact cart (see [Shipping](#shipping)); the page's estimate uses the same rules.
- **Server-side prices.** The browser sends only a slug and a quantity. Discount codes are Stripe promotion codes.
- **Refunds** use Stripe idempotency keys; a retry after a failed request can't refund twice. State always comes from Stripe's own refunded total. **A refund never changes inventory.** Units go back to stock only when you return them (with a full refund, or afterwards a chosen number per order line); each unit can be returned once. The order page says how many are back in stock, and flags refunded units that aren't.
- **Emails** report what actually happened: *sent* (Resend accepted it), *not sent: no provider configured* (skipped), *failed*, or *sending*. Dashboard messages are built from that answer, never assumed. A failed or skipped email is retried as the same email (same log row), and Resend gets an idempotency key, so a retry after a timeout that actually went out can't deliver a second copy. A deliberate resend of an email that was sent is a new email, once per click.
- **Fulfillment** saves only real changes. Saving the same status and tracking again records nothing and emails nobody; a new status or corrected tracking number is logged (with the old number) and, if the box is ticked, emailed. *Resend shipping email* is the deliberate way to send it again.
- **Customer data.** The only public endpoints are `shop_catalog()` (products, no stock counts) and `shop_order_status(session_id)` (status, number, items, totals, masked email; no name, address or phone; 30 days only; needs the unguessable Checkout Session id). Everything else needs a signed-in user listed in `shop_admins`. The end-to-end tests check the database grants directly.
- **Entitlements.** Paid orders record a `companion` entitlement by email (revoked on full refund). Nothing is gated on it.

## Products

- **The Weekly Reset System.** $9 download (`weekly-reset-system`), active, no stock. Sold from `/weekly-reset`. See [Digital products](#digital-products).
- **Take Back Control.** $29 download (`take-back-control`), active, no stock. Sold from `/take-back-control`, the offer after the Weekly Reset. See [Digital products](#digital-products).
- **Essential Routines Bundle.** $12 download (`essential-routines`), active, no stock. Sold from `/essential-routines`, the downsell when someone passes on Take Back Control.
- **Mind Your Own Motherhood Mug.** $23, 15oz ceramic (`mind-your-own-motherhood-mug`), active, **0 units** until you set real stock. Physical: ships like a calendar (1 shipping unit, so the same rate as one 26-week calendar), no cleaning companion in its emails. Sold from `/mind-your-own-motherhood-mug`; its checkout link shows only the mug.
- **Real Life Reset Kit.** $7 download (`real-life-reset-kit`), active, no stock. Sold from `/real-life-reset-kit` (not linked from any funnel yet).
- **26-Week Family Wall Calendar, January–June 2027.** $34, 25 units, active. Only this edition is listed.
- **52-Week Family Wall Calendar.** $54, hidden, 0 units.
- A July–December 2027 edition is **not** listed. When you have it in hand, add it as its own product with its own stock; don't change the January–June one.

## Manual checklist

Work top to bottom. Nothing here enables real payments until the **Launch** section.

### Supabase (all in the web dashboard; no CLI needed)
- [ ] **SQL Editor → New query**: paste the whole of `supabase/migrations/20261010000000_shop.sql` (on GitHub: open the file → *Raw* → select all → copy) → **Run**, once. It only creates new `shop_*` objects; survey data is untouched. Running it a second time stops at the first statement and changes nothing.
- [ ] Add your admin (create the user first under Authentication → Users if needed):
  `insert into public.shop_admins (user_id) select id from auth.users where email = 'you@example.com';`
- [ ] Authentication → Sign In / Providers: turn off "Allow new users to sign up".
- [ ] Give the admin account a long, unique password (a password manager's). The dashboard signs in with email + password only; Supabase MFA would need sign-in support added to `/admin/orders` first, so enabling it in Supabase alone doesn't protect this page.
- [ ] **Edge Functions → Deploy a new function → Via Editor**, three times. Each function is ONE paste-ready file in `supabase/dashboard/` (generated from `supabase/functions/` by `npm run build:functions`; never edit them by hand):

  | Function name (exact) | Paste this file |
  | --- | --- |
  | `shop-checkout` | `supabase/dashboard/shop-checkout.ts` |
  | `stripe-webhook` | `supabase/dashboard/stripe-webhook.ts` |
  | `shop-admin` | `supabase/dashboard/shop-admin.ts` |

  Replace everything in the editor with the file, deploy, then in the function's **Details/Settings** turn **off** "Verify JWT" (Enforce JWT verification) for all three. Each function checks its own callers instead.
- [ ] Edge Functions → Secrets: `STRIPE_SECRET_KEY` (sk_**test**_…), `STRIPE_WEBHOOK_SECRET`, `SHOP_PREVIEW_TOKEN` (long random string), `SHOP_SITE_URL=https://organizedmomcollective.com`, `SHOP_ALLOWED_ORIGINS` (site URL plus your Vercel preview URL, comma-separated), `RESEND_API_KEY`, `SHOP_EMAIL_REPLY_TO`. **Do not set `SHOP_LIVE_CHECKOUT`.**
- (With the Supabase CLI instead: `supabase db push` and `supabase functions deploy <name>` from `supabase/functions/`; `supabase/config.toml` already turns JWT verification off.)

### Stripe (test mode)
- [ ] Developers → API keys: copy `sk_test_…` (to Supabase) and `pk_test_…` (to Vercel).
- [ ] Developers → Webhooks → Add endpoint `https://<ref>.supabase.co/functions/v1/stripe-webhook` with events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`, `refund.failed`, `charge.dispute.created`. Copy the signing secret to Supabase.
- [ ] Settings → Payment method domains: add `organizedmomcollective.com` (and the preview domain) for Apple Pay.
- [ ] Optional: Products → Coupons → create a coupon and promotion code to test discounts.

### Resend
- [ ] Create an account; Domains → add `organizedmomcollective.com` and add its DNS records where the domain's DNS lives; wait for "Verified".
- [ ] API Keys → create a "sending access" key → Supabase secret `RESEND_API_KEY`.
- [ ] The default sender is `orders@organizedmomcollective.com`; set `SHOP_EMAIL_FROM` to change it. Make sure `SHOP_EMAIL_REPLY_TO` is an inbox you read.

### Vercel
- [ ] **Preview** environment only: `PUBLIC_SHOP_ENABLED=true`, `PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` (plus the existing `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`).
- [ ] **Production**: leave `PUBLIC_SHOP_ENABLED` unset/false for now.

### Test (preview deployment, test mode)
- [ ] Dashboard → Settings → **Preview**.
- [ ] On your phone, open `<preview-url>/checkout?preview=<SHOP_PREVIEW_TOKEN>` and pay with `4242 4242 4242 4242` (any future date, any CVC, any US address). Also try the decline `4000 0000 0000 0002`, 3D Secure `4000 0025 0000 3155`, a promotion code, Apple Pay (Safari) and Google Pay (Chrome).
- [ ] Confirm: the page goes "Confirming…" then "confirmed"; a "[Test]" receipt email arrives; the order is in the dashboard.
- [ ] Mark it shipped with a tracking number (shipping email arrives), then refund it (refund email arrives).
- [ ] Start a checkout and abandon it: its units show *In checkout* and return after about 30 minutes (Stripe's `checkout.session.expired`).
- [ ] Stripe → Webhooks → your endpoint shows 200 responses.

### Database update: launch preparation (once, after the first migration)
- [ ] **SQL Editor → New query**: paste the whole of `supabase/migrations/20261011000000_shop_launch_prep.sql` → **Run**, once. It adds columns and replaces some `shop_*` functions; existing orders, stock, emails, survey data and admins are untouched. A second run stops at the first statement and changes nothing.
- [ ] Then redeploy **all three** functions from `supabase/dashboard/` (same steps as above: open the function → Code → replace everything → Deploy). Keep "Verify JWT" off.

### Database update: digital products (once, after launch preparation)
- [ ] **SQL Editor → New query**: paste the whole of `supabase/migrations/20261012000000_shop_digital.sql` → **Run**, once. It adds downloads (columns, functions, the Weekly Reset product) and creates the private Storage bucket `shop-downloads`. Existing orders, stock, emails and admins are untouched; a second run stops at the first statement.
- [ ] Redeploy **all three** existing functions from `supabase/dashboard/` (same steps as above), then deploy the **fourth**, `shop-download` from `supabase/dashboard/shop-download.ts`, with "Verify JWT" off. It needs no new secrets.
- [ ] **Storage → shop-downloads**: check it says *Private*. Upload the four files at exactly these paths (folder `weekly-reset`): `weekly-command-center.pdf`, `weekly-command-center-editable.pdf`, `30-minute-daily-tidy-system.pdf`, `weekly-reset-coaching-audio.mp3`. If you ran the digital-products migration before the fillable Command Center was added, add it to the product once in the SQL Editor: `update shop_products set files = jsonb_insert(files, '{1}', '{"path":"weekly-reset/weekly-command-center-editable.pdf","label":"The Weekly Command Center (fillable PDF: type in it on your computer)"}') where slug = 'weekly-reset-system';` Dashboard → Inventory lists the paths too.
- [ ] Buy it once in preview (test card) and open the download link from the receipt email: all three files should download.

### Database update: Take Back Control (once, after digital products)
- [ ] **SQL Editor → New query**: paste the whole of `supabase/migrations/20261013000000_shop_take_back_control.sql` → **Run**, once. It only adds the product; a second run stops at the insert.
- [ ] Redeploy `stripe-webhook` and `shop-admin` from `supabase/dashboard/` (the receipt email now has this product's picture).
- [ ] **Storage → shop-downloads**: upload the eleven files to folder `take-back-control`, renamed to exactly:

  | Your file | Upload as |
  | --- | --- |
  | Week 1 – Create Your Family Reset Rhythm (Control Kit).mp3 | `week-1-create-your-family-reset-rhythm.mp3` |
  | Week 2 – Morning Flow That Doesn't Break (Control Kit).mp3 | `week-2-morning-flow-that-doesnt-break.mp3` |
  | Week 3 – Weekly Planning on Autopilot (Control Kit).mp3 | `week-3-weekly-planning-on-autopilot.mp3` |
  | Week 4 – Declutter Your Brain, Not Just the Toys (Control Kit).mp3 | `week-4-declutter-your-brain-not-just-the-toys.mp3` |
  | 3-Min Reset Ritual Audio.m4a | `3-minute-reset-ritual.m4a` |
  | Morning Routine.pdf | `morning-routine.pdf` |
  | After-School Routine.pdf | `after-school-routine.pdf` |
  | Bedtime Routine.pdf | `bedtime-routine.pdf` |
  | Weekend Prep Routine.pdf | `weekend-prep-routine.pdf` |
  | Chore Chart by Age.pdf | `chore-chart-by-age.pdf` |
  | 7-Day Declutter Dash.pdf | `7-day-declutter-dash.pdf` |

  The Weekly Planner Generator (upgraded, with example weeks) and the Pantry Inventory (`/pantry`) are website tools, not files: the buyer's download page links to both (`src/components/shop/DownloadFiles.tsx`).
- [ ] Buy it once in preview (test card): all eleven files should download.

### Database update: Essential Routines (once, after Take Back Control)
- [ ] **SQL Editor → New query**: paste the whole of `supabase/migrations/20261014000000_shop_essential_routines.sql` → **Run**, once. It only adds the product.
- [ ] Redeploy `stripe-webhook` and `shop-admin` (receipt emails now use `public/email/<slug>.jpg` for every product, so later products need only that file).
- [ ] **Storage → shop-downloads**: the 4 routine PDFs are already there (Take Back Control's). Upload the Quick Setup Audio to folder `essential-routines` as `quick-setup-audio.m4a`. The "Why Routines Work" cheat sheet is a page on the site (`WHY_ROUTINES_PATH`), linked from the buyer's download page, not a file.
- [ ] Buy it once in preview (test card): all five files should download, and the download page should link to "Why Routines Work".

### Database update: the mug (once, after Essential Routines)
- [ ] **SQL Editor → New query**: paste the whole of `supabase/migrations/20261015000000_shop_mug.sql` → **Run**, once. It only adds the product.
- [ ] Redeploy `stripe-webhook` and `shop-admin` from `supabase/dashboard/` (mug-only orders no longer say "your calendar" or show the cleaning companion panel).
- [ ] Dashboard → Inventory: set the mug's stock to what you actually have (or can fulfil). Check its shipping: it's charged one calendar's rate.
- [ ] Buy one in preview (test card): `/checkout?product=mind-your-own-motherhood-mug` shows only the mug; the receipt shows the mug's picture and no companion panel.

### Database update: Real Life Reset Kit (once, after the mug)
- [ ] **SQL Editor → New query**: paste the whole of `supabase/migrations/20261016000000_shop_real_life_reset.sql` → **Run**, once. It only adds the product.
- [ ] **Storage → shop-downloads**: upload to folder `real-life-reset`, renamed exactly:

  | File you have | Upload as |
  | --- | --- |
  | Plan_B_Quick-Pivot_Framework.pdf | `plan-b-quick-pivot-framework.pdf` |
  | 15-Minute_Reset_Checklist.pdf | `15-minute-reset-checklist.pdf` |
  | Its_OK_to_Pivot_Coaching.mp3 | `its-ok-to-pivot-coaching.mp3` |
- [ ] Buy it once in preview (test card): all three files should download.

### Decisions you owe before launch
- [ ] **Sales tax** ([Tax](#sales-tax)). Then Settings → Sales tax → choose → **Confirm and save**. Real-money checkout stays closed until you do.
- [ ] **Shipping prices** ([Shipping](#shipping)). Add the real rate(s) in Settings, then turn off the test placeholder.
- [ ] Per-order limit (5) and website stock (25; separate from Etsy, not synced).
- [ ] Refund/return policy: draft in [REFUND_POLICY_DRAFT.md](REFUND_POLICY_DRAFT.md). Not published. The Weekly Reset page promises a 30-day "Actually Used It" money-back guarantee: honor it with a full refund from the dashboard (that also turns the download link off).
- [ ] **Sales tax on downloads**: the Weekly Reset product carries Stripe tax code `txcd_10000000` (general electronically supplied services). Confirm the right code with your accountant before choosing Stripe Tax; change it in the SQL Editor (`update shop_products set tax_code = '…' where slug = 'weekly-reset-system';`).
- [ ] Support inbox: `SHOP_EMAIL_REPLY_TO` is printed in every customer email as the contact address.

## Launch

Only after you approve it. Each step is reversible: Settings → **Off** stops new checkouts instantly.

1. Stripe live mode: activate the account; add the **live** webhook endpoint (same URL, same events); disable the test endpoint (it would otherwise fail signature checks against the live secret and Stripe will email you).
2. Supabase secrets: `STRIPE_SECRET_KEY=sk_live_…`, `STRIPE_WEBHOOK_SECRET=<live whsec>`, `SHOP_LIVE_CHECKOUT=enabled`.
3. Vercel production: `PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…`, `PUBLIC_SHOP_ENABLED=true`; redeploy.
4. Dashboard → Settings → Launch readiness: all ★ items ticked → **Open**.
5. Optional real-money smoke test: buy one with a 100%-minus-$1 promotion code, then refund it.
6. Switching the site's buy buttons from Etsy to `/checkout` is a separate code change (`ShopButton`, `CalendarOptions`, `/app/reorder`); `tests/shop.test.ts` → *launch guards* fails while anything public other than the offer pages and the mug page links to `/checkout`, so it must be updated deliberately.

## Digital products

A product is either **physical** (the calendars: stock, shipping, an address) or **digital** (a download). A checkout is one or the other, never both (`mixed_cart`). The Weekly Reset page's buttons go to `/checkout?product=weekly-reset-system`, which shows only the download: no quantity, no shipping, no address.

```
/weekly-reset → /checkout?product=weekly-reset-system → Stripe (email + card; billing address only with Stripe Tax)
stripe-webhook → shop_mark_paid: order paid AND delivered, a 'download' entitlement with a random token (7 days)
              → receipt email with a "Download your files" button → /download?t=TOKEN
/download → shop-download Edge Function → shop_download (token valid? paid? not expired?) → signed Storage URLs (10 min each)
```

- **The files are private.** They sit in the `shop-downloads` bucket, never public. The download page asks `shop-download` for fresh signed links on every visit; each link works for 10 minutes and downloads the file under its own name.
- **Links last 7 days.** After that the page says the link expired and to email you. Open the order in the dashboard → Emails → **Send a new download link**: a new token, 7 more days, emailed at once; the old link stops working.
- **Refunds.** A full refund turns the link off at once (the refund email says so). A partial refund leaves it working. Downloads never touch inventory, can't be marked shipped, and never show as "to ship".
- **Missing files** don't break the others: the page shows that one as unavailable and tells the customer to email you. Upload it and they can reload.
- **The token is the key.** Anyone with the link can download until it expires; the page never passes it on as a referrer, the database caps tries per connection (60/hour), and tokens are 192 random bits. Signed-in admins can see tokens in the database; nobody else can.
- **Adding another download:** insert a product with `kind = 'digital'`, its `files` (`[{"path": "folder/file.pdf", "label": "…"}]`) and a `tax_code`, upload the files, and link to `/checkout?product=<slug>`.

## Order emails

Four emails, all sent by `stripe-webhook` or `shop-admin` through Resend: receipt (on payment), shipping (when marked shipped with tracking), refund/cancellation, and companion instructions (sent by hand from an order). Templates: `renderEmail` in `supabase/functions/_shared/email.ts`.

- Design: the site's warm palette (cream page, white card, Georgia headings, rose accent, sage companion panel), the round OMC badge, one fluid 560px column that reads on a phone without media queries, inline styles and tables only (Gmail drops some `<style>` blocks), a button for tracking and for the companion, and a footer with the support address (`SHOP_EMAIL_REPLY_TO`). Under 10 KB each; Gmail clips at ~102 KB.
- Images load from the live site: `public/email/omc-badge-144.png`, `calendar-26-week.jpg`, `calendar-52-week.jpg` (real product photos resized to JPEG; WebP isn't safe in every mail client). They appear only once Vercel deploys them.
- Test-mode orders carry `[Test]` in the subject, a dashed "Test order" band at the top and a footer note. Real orders have none of these.
- Preview the four emails locally: `tests/shop.test.ts` renders them; or run `renderEmail` with a sample order.

### The sender's picture (avatar) in Gmail

Gmail's circle next to the sender comes from one of these, and **none is guaranteed**:

| Option | Cost | What it takes | Notes |
| --- | --- | --- | --- |
| **BIMI** (official brand logo) | Paid certificate | DMARC at enforcement (`p=quarantine` or `p=reject`) on organizedmomcollective.com, a square SVG Tiny PS logo, a `default._bimi` DNS record, and for Gmail a VMC or CMC certificate from a certificate authority | Gmail shows BIMI logos only with that certificate (an annual fee), so it's out of scope for now. The DMARC part is free and worth doing anyway. |
| **Google profile photo for the sending address** | Free | Create a Google Account using `orders@organizedmomcollective.com` (Google lets you sign up with an existing non-Gmail address), verify it, and set the OMC badge as its profile picture | Gmail sometimes shows this to recipients. Not documented as a guarantee. The address must be able to receive Google's verification email, so it needs a working inbox or forwarding. |
| Nothing | Free | | Gmail shows the first letter of the sender name ("O") on a colored circle. |

Recommended now: send from `Organized Mom Collective <orders@organizedmomcollective.com>` (the default `SHOP_EMAIL_FROM`), set up DMARC with your DNS provider (start at `p=none` with reports, then `p=quarantine` once Resend's SPF/DKIM pass), and try the free Google-profile route. Revisit BIMI only if the brand logo in the inbox is worth an annual certificate.

## Shipping

US addresses only (Stripe collects the address; no other countries are offered). Fulfillment stays manual: you buy the label (USPS, Pirate Ship, …) and enter the carrier and tracking number on the order.

Each rate in Settings has:

| Field | Meaning |
| --- | --- |
| First | Price for the first calendar |
| Each extra | Added per additional calendar (0 = flat per order) |
| From / To | Offer this rate only for carts of that many calendars (To empty = no limit) |
| Free over | Free at or above this subtotal, before discount codes (empty = never) |

"Calendars" here are shipping units: the 26-week counts 1, the 52-week counts 2 (two 26-week sets), editable per product (Inventory → Edit details → Shipping units). The database prices the cart (`shop_shipping_quote`); the checkout page shows the same estimate. If no rate covers a cart (e.g. every rate stops at 2 and someone orders 3), checkout refuses it and holds nothing.

The seeded "$6 Standard shipping (test placeholder)" is **test only**: never offered with a live key, and a live checkout won't open until a real rate exists.

## Sales tax

Two choices, both deliberate (Settings → Sales tax → Confirm and save):

- **Stripe Tax (automatic).** Stripe calculates tax from the shipping address, only in states where you've added an active registration in Stripe (Tax → Registrations), including tax on shipping where that state taxes it (shipping is sent with Stripe's shipping tax code `txcd_92010001`, the calendar with `txcd_99999999`, general tangible goods), after any discount. Prices are tax-exclusive; Stripe's checkout shows the tax line, and receipts, the confirmation page and the dashboard show it. Launch readiness shows Stripe Tax's status and your active registrations. Stripe charges a fee per transaction.
- **Don't collect tax.** Only if your accountant confirms you don't need to.

The old "manual state rates" mode is switched off: one rate per state can't express local rates (New York City's combined rate differs from the state rate) or tax on shipping. It can no longer be chosen, and a real-money checkout refuses to run in it.

In Stripe (you, in the dashboard, before choosing Stripe Tax): Settings → Tax → origin/head-office address (your NYC address); the product tax code default; Tax → Registrations → add each state where you're registered (New York first, if your accountant confirms). Stripe also monitors thresholds in other states (Tax → Registrations → Monitoring); adding a registration there is your decision.

## Checking what's deployed

Nothing here deploys itself: a merged PR changes GitHub only. Vercel deploys the site from GitHub (check its dashboard); Supabase SQL and Edge Functions are pasted by hand.

| Piece | How to tell it's current |
| --- | --- |
| Database (launch-prep migration) | SQL Editor: `select column_name from information_schema.columns where table_name = 'shop_settings' and column_name = 'tax_reviewed';` returns one row |
| Database (digital products) | SQL Editor: `select kind from shop_products where slug = 'weekly-reset-system';` returns `digital` |
| Edge Functions | Each function → Code: search for `Idempotency-Key` (launch prep) and `omc-badge-144` (email redesign). Both should be present in shop-checkout, stripe-webhook and shop-admin, and `download:` (digital products) in shop-admin. `shop-download` exists. |
| Site (Vercel) | Deployments → Production: the commit matches the latest merge on GitHub. Dashboard → Orders has an "Orders: Real and test" filter. |

## Tests

- `npm test`: session building, signatures, emails, dashboard math and CSV, launch guards (seed values, flags, no public links to `/checkout`), and that the paste-ready files in `supabase/dashboard/` are self-contained and up to date.
- `npm run test:shop`: 71 end-to-end tests, then a Deno smoke test of the four paste-ready files in `supabase/dashboard/` (each loaded on its own: checkout, signed webhook, admin, shipping, refund, emails, a download) on a throwaway local database (the real migrations, PostgREST, the real function handlers; Stripe, Resend and Supabase Auth faked). Covers the launch gate (every row of the table above), payment, forged/stale/duplicate webhooks, declines, abandoned/expired/canceled checkouts, the overselling race, late payments, refunds and their idempotency, emails, downloads (no stock or shipping, mixed carts, tokens, expiry, renewal, refunds, missing files), admin auth, row-level security and the database's grants to the browser roles. Needs PostgreSQL and PostgREST locally (see `scripts/test-shop.sh`).

**Not verified against the real services** (Stripe's API isn't reachable from the build sandbox): the real Stripe API and embedded iframe, Apple Pay / Google Pay sheets, Stripe Tax calculations, the exact shape of Stripe's webhook payloads for your account's API version (the code reads both old and new shapes and re-fetches sessions with a pinned API version, `2025-03-31.basil`), Supabase's hosted gateway (CORS, `x-forwarded-for`, the new `sb_secret_` keys), Supabase Auth's `/user` endpoint, Supabase Storage's signed URLs (the response shape is read both ways: `signedURL` / `signedUrl`), Resend delivery and your DNS. The test checklist above covers these.

## Known limits

- **Stock hoarding.** Anyone can hold up to 5 units for 30 minutes per checkout. Rate limiting is 12 checkouts/hour per connection, keyed on the IP Supabase forwards; if that header can be spoofed upstream, the limit can be bypassed. Worst case: stock looks sold out until the holds expire. Watch *In checkout*; set checkout Off if abused.
- **Stale holds** are released by Stripe's expiry webhook, or on the next checkout if that webhook is missed. Until then the dashboard's *In checkout* may show them.
- **Etsy and website stock aren't connected.** If they share a shelf, take Etsy sales out here by hand.
- Admin sessions last one hour (Supabase access token) and live in the tab's sessionStorage.

## Later: shipping labels

Fulfillment is manual on purpose. A label provider (Pirate Ship has no public API; Shippo/EasyPost do) would plug into the `fulfillment` action in `supabase/functions/_shared/handlers/admin.ts`: buy the label, then call `shop_set_fulfillment` with the carrier and tracking number it returns.
