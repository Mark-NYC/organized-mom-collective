# Pinterest Merchant Review: audit (2026-10-19)

Pinterest flagged organizedmomcollective.com as "broken, inactive, or requiring registration". Deadline to re-request review: **2026-11-14**.

## Verdict

The site is up and crawlable. It fails review because **nothing on it can actually be bought**: every website buy path ends at "Online checkout isn't open yet. For now, the calendar is available on Etsy.", and the payment form runs on a Stripe **test** key. To a reviewer that reads as an inactive store.

## Confirmed (with evidence)

| # | Finding | Evidence |
| --- | --- | --- |
| 1 | **Store switch is Preview, not Open.** Without a `?preview=` token, `/checkout` shows "Online checkout isn't open yet… available on Etsy". | `shop_settings.checkout_mode = 'preview'` (DB, 2026-10-19). Live `Checkout.*.js` gates on `checkout_mode === 'live'`. |
| 2 | **Production uses a Stripe test key.** Even with the store Open, checkout shows "Test mode. No real charges. Pay with card 4242…". | Live `/_astro/shop.*.js` holds `pk_test_…`. |
| 3 | **Sales tax not decided.** Live checkout stays closed until it is (launch gate #5). | `tax_reviewed = false`, `tax_mode = 'off'`. |
| 4 | **The only feed product is "out of stock".** Follows from #1. Pinterest sees a catalog with nothing buyable. | GitHub Action *Pinterest feed check*, 2026-10-18: `calendar-26-week 34.00 USD out of stock`. Stock in DB: 25. |
| 5 | **Full-year $54 is Etsy-only.** /calendar's $54 button and its Product JSON-LD offer point to etsy.com. | Live /calendar HTML. `calendar-52-week` is inactive with 0 stock. It's correctly left out of the feed. |
| 6 | **Visible dead ends on public pages.** `/shop` shows a "Coming soon" mug. `/weekly-reset` and the other download pages show Buy buttons that return "checkout closed" while the store is Preview. | Live /shop HTML; SHOP.md "Last verified" note. |
| 7 | **Canonical host mismatch (fixed in code, not deployed).** Canonical, og:url, JSON-LD, sitemap and robots.txt said `organizedmomcollective.com`, which 308-redirects to `www`. The feed, Pinterest tag pages and Vercel all serve `www`. | Live /calendar `<link rel="canonical" href="https://organizedmomcollective.com/calendar">`. Vercel domains: apex → www (308). |

## Checked and ruled out

- **Redirects:** apex → www is a single 308, with no loop or chain. Every feed URL (product page and 3 JPEGs) answers 200 directly.
- **HTTP status:** `/`, `/calendar`, `/shop`, `/checkout`, `/robots.txt` and the feed all return 200, with no 403, 404 or 5xx.
- **SSL:** valid, with HSTS.
- **robots.txt:** `Allow: /` for every agent; Pinterestbot is not blocked.
- **Cloudflare:** DNS only. Both hostnames resolve to Vercel IPs (216.198.79.x / 64.29.17.x), so Cloudflare's proxy, WAF and bot fight mode are not in the request path. Vercel has no firewall config on the project.
- **Registration gates:** none on custom domains. No accounts, logins or email gates in front of products or checkout.

## Hypotheses (not reproduced)

- **"External fetch of apex failed after redirecting to www."** This didn't reproduce from GitHub's runners or Vercel. Most likely the fetching tool refuses cross-host redirects (apex → www counts as one). Fix 7 removes the redirect from every URL Pinterest reads. Still, give Pinterest www URLs everywhere.
- **`*.vercel.app` URLs require a Vercel login** (Vercel Authentication covers everything except custom domains). If any Pinterest field, pin or catalog row uses `organized-mom-collective*.vercel.app`, the reviewer sees a login wall, which counts as "requires registration". Nothing in the repo does, but check Pinterest.
- **Claimed domain vs. merchant domain.** If Pinterest has the bare domain claimed but the feed and pages are on www (or the reverse), review can fail. Check below.

## Fixes

### Done in code (branch, not deployed)
- `site` → `https://www.organizedmomcollective.com`. This updates canonical, og:url, JSON-LD, sitemap and Pin-it share links. robots.txt Sitemap line, `check-site` / `page-inventory` hosts and the Pinterest plan URLs were changed to match.
- Regression: `npm run verify` passes (195 tests, 82 pages). A full before/after build diff shows only the host changed, plus random island IDs and the service-worker hash. Checkout, the Pinterest tag (`2613936771748`), GA4 (`G-VGJK1B4TJ6`), `data-cta` tracking and `p:domain_verify` are byte-identical.

### Owner actions to open the store (in order; full steps in `supabase/SHOP.md` → Launch)
1. Stripe: activate live payments, create the live webhook and add both payment method domains.
2. Supabase → Edge Function secrets: `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET`, `SHOP_LIVE_CHECKOUT=enabled`.
3. Vercel → Production env: `PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_…`, then redeploy. The same deploy ships fix 7.
4. Admin → Settings: save the sales tax decision, then **Checkout: Open**.
5. Make one real $34 purchase, then refund it (SHOP.md step 6).
6. Recommended: hide or remove the "Coming soon" mug card from `/shop` until it's for sale.

### Pinterest changes before re-requesting review
1. **Business settings → Claimed accounts:** the claimed website must be `www.organizedmomcollective.com` or `organizedmomcollective.com` and show *Claimed*. The `p:domain_verify` tag is on every page; if the claim is on the other host, reclaim it as-is (don't add a second tag).
2. **Profile / business info → Website:** `https://www.organizedmomcollective.com`.
3. **Catalogs → Data source URL:** `https://www.organizedmomcollective.com/pinterest-feed.csv`. Never use the apex or vercel.app URL.
4. Wait for the next feed ingest to show `calendar-26-week` as **in stock** at $34.00 with the `www` link. The daily GitHub check should log `in stock`.
5. Remove any pins, catalog rows or profile links that use `*.vercel.app`.
6. Merchant Details: the shipping (US, USPS Ground Advantage $8.95) and returns (14-day, `/returns`) answers must match the site, and contact info must match `/support`.
7. Then request a new review.
