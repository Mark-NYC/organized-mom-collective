# Integrated /admin dashboard: audit and plan

**Status (2026-10-16):** Phases 1–3 **built** (secure shell, page inventory, Overview + alerts), waiting on the owner's activation steps in [supabase/ADMIN.md](../../supabase/ADMIN.md). Later phases planned. **Etsy is out of scope** (owner decision, 2026-10-16): no import, no sync; Etsy keeps running in Shop Manager.

**Goal:** one login, one command center: what's broken, what needs me today, how the business is doing. Claude keeps editing pages and code; this is not a CMS.

---

## Part 1: Audit

### Stack and hosting

- **Astro 7, fully static** on Vercel (`dist/`). No SSR adapter. One Vercel Function: `api/pinterest-feed.ts`.
- **Supabase** project `uvqhmlqwmgnohhduttip` (Postgres 17, us-east-1). All server logic is Supabase Edge Functions + SQL functions. Live functions: `shop-checkout`, `shop-admin`, `stripe-webhook`, `shop-download`, `starter-kit-signup`, `support-request`, plus two leftovers (`shop-storage-fix`, `support-return`) that should be deleted.
- **Stripe** (embedded checkout, webhooks, refunds) and **Resend** (all transactional email). No other paid services.

### Routes (`src/pages/`, 60 files + 17 articles)

| Type | Routes |
| --- | --- |
| Core public | `/`, `/calendar`, `/shop`, `/companion`, `/support`, `/returns`, `/tools` |
| Resource library | `/resources`, `/resources/<slug>` (17), `/resources/topics/<pillar>` |
| Free tools (lead magnets) | ~25: `/planner`, `/pantry`, `/chore-chart`, `/meal-planner`, seasonal checklists, … |
| Offer / funnel pages | `/weekly-reset`, `/weekly-reset-simple`, `/take-back-control`, `/essential-routines`, `/real-life-reset-kit` (unlinked), `/family-sanity-saver-starter-kit`, `/mind-your-own-motherhood-mug`, `/starter-kit`, `/starter-kit/kit`, `/try-the-calendar` |
| Gated / tokenized | `/planner/[access]`, `/routine-chart/[access]`, `/why-routines-work/[access]`, `/download` |
| Checkout | `/checkout`, `/checkout/complete` |
| Companion website | `/start`, `/app`, `/app/week`, `/app/reorder`, `/app/settings`, `/app/tidy` |
| Admin today | `/admin/orders`, `/survey/admin` |

23 pages are noindex. Several funnel pages are deliberately linked from nowhere (e.g. `/real-life-reset-kit`), so **nav and sitemap can't be the source of truth**: the build output is. `scripts/check-site.mjs` already walks `dist/` and parses every page; the inventory reuses that.

### Auth and database

- **Supabase Auth**, email + password, signed in from the browser (`adminSignIn` in `src/lib/survey.ts`); token kept in `sessionStorage`.
- Two separate admin lists: `shop_admins` (1 user), `survey_admins` (0 users). Reads via RLS (`is_shop_admin()` / `is_survey_admin()`), writes via `shop-admin` with the service role.
- **Live state:** 1 auth user, **0 MFA factors enrolled**. Supabase advisor: leaked-password protection **off**. The docs note MFA was never wired into the sign-in.
- RLS is on everywhere; customer tables deny `anon`. Advisor warnings are mostly intended public RPCs (`shop_catalog`, `survey_submit`, …); one real fix: `shop_download_days` has a mutable `search_path`.

### Data that exists

| Data | Table(s) | Live volume (2026-10-16) |
| --- | --- | --- |
| Website orders, items, events, fulfillment, refunds, inventory log, entitlements | `shop_*` | 8 orders, **all test mode**; store is in **Preview** (no real money yet) |
| Products, stock, shipping, tax, store switch | `shop_products`, `shop_settings`, `shop_shipping_rates` | 7 products |
| Transactional email outcomes | `shop_email_log`, `support_requests.notify_status/ack_status`, `tool_email_contacts.starter_kit_email_status` | 7 sent, 4 skipped, 0 failed |
| Support requests + returns | `support_requests` (`status`, `return_status`), view `support_open` | 1 open (the known test row `OMC-SGAM48`) |
| Leads + marketing consent | `tool_email_contacts` (`first_tool`, `marketing_opt_in`, `consent_version`) | 3 contacts, 1 opted in |
| Survey | `survey_sessions`, `survey_responses` | 0 responses |
| **Etsy orders** | none | out of scope (owner decision) |

**Gaps:** no customer table (email is the only join key, and it isn't normalized identically everywhere); no product cost; no Etsy data; no attribution stored on any order, lead or support row.

### Analytics and tracking

- **GA4** (`G-VGJK1B4TJ6`) and the **Pinterest tag** are loaded in `BaseLayout.astro` on every page, **including `/admin/orders` and `/survey/admin`**: third-party script on pages that show customer names and addresses. Fix first.
- Custom events: `cta_click` (25 placements via `data-cta`, `src/lib/analytics.ts`), `starter_kit_view`, `starter_kit_signup`, `starter_kit_resource_open`, tool engagement events. Pinterest: `lead` (chore chart, starter kit), `checkout` (live orders only).
- **Missing:** no GA4 `purchase` or `generate_lead` event; **no UTM / landing-page / referrer capture anywhere**, so no order or lead can be attributed to a Pin or campaign. Etsy clicks leave the site; Etsy sales can't be tied back except by Etsy's own stats.
- No GA4 Data API access, Vercel Web Analytics or Pinterest API connection exists. Every traffic number in the dashboard depends on adding one.

### Customer service and returns

Form → `support-request` → `support_requests` + two Resend emails. Owner works it from the inbox and the Supabase Table Editor; returns are tracked by hand-editing `return_status`. Return address is never stored (keep it that way). Policy: `docs/operations/CUSTOMER_SUPPORT.md`. No reply templates, no history beyond `notes` and `resolved_at`.

### Integration limits

| Integration | State | Limits that matter |
| --- | --- | --- |
| Stripe | Built, test keys | Refunds via API with idempotency keys (done). Reads count toward the 100 req/s live limit: don't poll; trust webhooks. |
| Etsy | Manual (Shop Manager) | Open API v3 needs an approved app + OAuth, ~10 req/s and a daily cap. **No API to issue refunds** (Shop Manager only). Orders CSV export from Shop Manager is free and needs no approval. |
| GA4 | Tag only | Data API is free with per-property token quotas; needs a Google Cloud service account added as Viewer. Custom event params must be registered as custom dimensions to be queryable. Data lags 24–48 h for full accuracy. |
| Pinterest | Tag + catalog feed | API v5 analytics needs an app + OAuth token (free). |
| Resend | Live | Sending only; delivery/bounce webhooks available but not wired. |

### Reuse, don't rebuild

`OrdersAdmin.tsx` (orders, refunds, restock, inventory, shop settings, launch readiness), `shop-admin` function and its auth check, email-outcome logging, `check-site.mjs` page parsing, `src/lib/analytics.ts` event shape, `survey_allow` throttle ledger, `ConfirmationDialog`, the print palette and `.label`/`.page-title` styles, `supabase/tests/supabase-stub.sql` access tests.

---

## Part 2: Architecture

**Keep the static site. No SSR adapter, no new framework, no paid tools.**

```
/admin/* (static Astro pages, AdminLayout, React islands)
   │  Supabase session (email + password)
   ├── reads ──► Postgres via RLS: is_admin() checks admin_users
   └── actions ─► Edge Functions (admin-*) ─► verify JWT + role + throttle
                       │                      ─► SQL functions (audit-logged)
                       ├─► Stripe / Resend / GA4 Data API (secrets stay server-side)
pg_cron (hourly) ──► admin-health ──► admin_alerts ──► Overview + email digest (Resend)
GitHub Action (push to the default branch, after Vercel build) ──► page inventory ──► site_pages
```

### Security requirements

1. **`AdminLayout`**: noindex, no GA4, no Pinterest tag, no site chrome, no manifest/service worker. `public/_headers` headers for `/admin/*`: strict CSP (self + Supabase + Stripe only), `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`.
2. **One admin, password sign-in.** Email + password (owner decision 2026-10-16: no authenticator step). `is_admin()` returns true only for an account in `admin_users`. `is_shop_admin()` / `is_survey_admin()` call it, so every existing policy uses the one list.
3. **No registration.** Confirm "Allow new users to sign up" is off; turn on leaked-password protection.
4. **Server-side authorization on every call**: each admin function re-checks token and role; the browser never decides.
5. **Least privilege:** new admin functions call SQL functions with the *admin's* JWT (security definer functions that check `is_admin()`), not the service role. Service role stays only where it's already required (Stripe webhook, checkout, email).
6. **Rate limiting:** Supabase Auth's built-in limits on sign-in; per-admin throttle on admin functions (reuse the throttle ledger); exports capped.
7. **Audit log:** `admin_audit_log` (actor, time, action, target, small JSON detail; never secrets, addresses or message bodies), append-only (no update/delete grants). Supabase's own auth log also records sign-ins.
8. **Secrets** stay in Supabase function secrets. Settings shows configured / not configured, never values.
9. **Sessions:** short access token (Supabase default 1 h) with refresh; explicit sign-out clears it; idle sign-out in the client after 30 min.

### Database changes (by phase)

| Object | Purpose | Phase |
| --- | --- | --- |
| `admin_users(user_id, role, added_at)`, `is_admin(role)` | Single admin list, roles for later helpers | 1 |
| `admin_audit_log` | Who did what | 1 |
| `site_pages(path, title, type, robots, in_sitemap, in_nav, inbound_links, cta_placements jsonb, source_file, build_sha, first_seen, last_seen, removed_at)` | Page inventory | 2 |
| `admin_alerts(key, severity, area, title, detail, link, first_seen, last_seen, resolved_at, acked_at)` | Actionable alerts, deduped by `key`, auto-resolve | 3 |
| `attribution` columns on `shop_orders`, `tool_email_contacts`, `support_requests` (`utm_source/medium/campaign/content`, `landing_path`, `referrer_host`, first-touch time) | Real attribution, stored server-side | 4 |
| `analytics_daily(date, path, source, medium, campaign, views, users, cta_clicks, leads, purchases)` | GA4 cached once a day, not queried live | 5 |
| `support_events`, `reply_templates` | Resolution history, templates | 6 |
| `customers` **view** keyed on lower(email) across orders, support, contacts, entitlements | Profiles without a duplicate store | 7 |
| `cost_cents`, `bundle_items` on products (`low_stock_threshold` added in Phase 3) | Margin, bundles | 8 |
| `marketing_links(code, destination, utm…)` | QR / short links | 9 |

All additive. No existing table is renamed or dropped.

### Alerts: "tell me when it's broken"

Hourly `admin-health` function writes `admin_alerts`; each rule has a stable key so it opens once, updates, and resolves itself when the condition clears. Critical alerts email immediately; everything else goes in one daily digest. Same Resend account, no new service.

| Rule | Source | Available |
| --- | --- | --- |
| Paid physical order not shipped after 2 business days | `shop_orders` | Phase 3 |
| Customer email failed / skipped (no provider) | `shop_email_log`, support and starter-kit status columns | Phase 3 |
| Support request open > 1 business day; return approved but not received in 14 days; received but not refunded | `support_requests` | Phase 3 |
| Stock at or below threshold; active product with 0 stock | `shop_products` | Phase 3 |
| Order flagged (oversold, amount mismatch, dispute) | `shop_orders` flags | Phase 3 |
| Stripe webhook silent while checkouts are being created | `shop_stripe_events` vs `shop_orders` | Phase 3 |
| Page in inventory now 404/500; page removed since last build | `site_pages` + HTTP check | Phase 3 |
| CTA points to a dead page or an Etsy listing that 404s | `site_pages.cta_placements` + HTTP check | Phase 3 |
| Launch-gate mismatch (e.g. store Open with test key) | existing readiness check | Phase 3 |
| `cta_click` / `purchase` / lead event volume drops to 0 for 48 h | `analytics_daily` | Phase 5 |
| Pinterest feed check failing | existing `pinterest-feed-check.yml` | Phase 3 (read the workflow status) |

---

## Part 3: Phased plan

Each phase ships on its own and is useful alone. Phases 1–3 are the priority you asked for.

| Phase | Ships | Tests |
| --- | --- | --- |
| **0. Account hardening** (owner, 15 min, no code) | Turn on leaked-password protection; confirm sign-ups off; delete `shop-storage-fix` and `support-return` functions; delete test row `OMC-SGAM48` | — |
| **1. Secure shell** ✅ built | `AdminLayout` + headers; `/admin` email + password sign-in; `admin_users`, `is_admin()`, audit log; `/admin/orders` and `/survey/admin` moved onto `AdminLayout` behind the same sign-in; shell nav with every section, unbuilt ones labeled "Not built yet"; remove GA/Pinterest from admin pages | SQL: anon and signed-in non-admins denied on every admin table/RPC; admins allowed by role. Unit: sign-in states, idle sign-out. Build check: no `googletagmanager`/`pinimg` in `dist/admin/**` |
| **2. Page inventory** ✅ built | `scripts/page-inventory.mjs` (reuses check-site parsing): every built page with path, title, type (rules on path), robots, sitemap, in header/footer nav, inbound internal links, orphan flag, `data-cta` placements and destinations, source file. GitHub Action upserts to `site_pages` on the default branch. Pages & Funnels view: filter by type/status, GitHub source link, Vercel deployment link, live preview (iframe, phone + desktop width). Traffic/leads/conversion columns read "GA4 not connected" | Unit: type rules, orphan detection, CTA extraction against fixture HTML; inventory of the real build includes `/real-life-reset-kit` (unlinked) and excludes `/admin/*` |
| **3. Overview + alerts** ✅ built (alert email digest still to do) | `admin_alerts`, `admin-health` on pg_cron, email digest. Overview: open alerts first, then real numbers: website orders/revenue (test vs live separated, test hidden by default), unshipped, open support, returns in progress, stock, leads and opt-ins, recent activity. Every metric without a source shows "Not connected" with what's needed. | Unit per rule with fixtures (opens, dedupes, auto-resolves); email digest content; no rule runs on test-mode orders unless asked |
| **4. Attribution foundation** | First-touch capture (UTM, landing path, referrer host) in `sessionStorage` on public pages; sent with checkout (stored on the order and in Stripe metadata), lead signups and support requests. GA4 `purchase` (live orders, deduped like the Pinterest event) and `generate_lead`. Register GA4 custom dimensions (`cta_placement`, `page_path`) | Unit: capture/precedence rules; server re-validates and length-limits; checkout E2E stores attribution |
| **5. Analytics** | `admin-analytics` function pulls GA4 Data API daily into `analytics_daily` (one batch, well inside quota). Analytics view: sources, Pinterest campaigns, landing pages, visitor → lead → purchase funnels from GA4 + server-side counts side by side (labeled; they won't match exactly). Pages view gets traffic/CTA columns | Unit: response mapping, quota/backoff, "no data yet" states |
| **6. Customer service** | Support inbox in admin: filters, record view, status + return flow (requested → approved → received → refunded/declined), notes, history, reply templates (opens your email client prefilled; return address never in the system), link to website order or Etsy order number. Replaces Table Editor | Handler tests, access tests, audit entries per change |
| **7. Customers** | Profile per email: website orders, support history, lead source, marketing consent and version. Export/delete on request | View access tests; consent never inferred |
| **8. Products & inventory** | Cost, margin, bundles; edit the per-product low-stock threshold (column exists since Phase 3) | Margin math; threshold alert |
| **9. Marketing + settings** | Lead magnets (signups by `first_tool`, opt-in rate), QR/short links (static `_redirects` redirects with UTMs, generated from a data file), Pinterest performance (API v5, optional). Settings: admin account, integration status, notification preferences, audit log viewer | Redirect generation; settings never return secret values |

### Cost

Nothing new to pay for. Supabase (pg_cron, Edge Functions, Auth), Vercel, GitHub Actions, GA4 Data API, Pinterest API and Resend all fit the current plans/free tiers at this volume. Revisit if order volume grows by orders of magnitude.

### Out of scope

CMS, page editor or builder; customer accounts; any Etsy integration; in-dashboard email composer; helpdesk/ticketing products; live chat.

---

## Decisions

- 2026-10-16: No authenticator (MFA) step: the admin signs in with email + password only. Compensating controls: leaked-password protection on, a unique password, the audit log.
- 2026-10-16: Etsy out of scope; roll forward with Phases 1–3. The existing shop admin login is the single owner account (`admin_users`). Alert emails and GA4 access are decided when those phases start.

## What's built (Phases 1–3)

| Piece | Where |
| --- | --- |
| Admin layout (noindex, no trackers), nav with unbuilt sections labeled | `src/layouts/AdminLayout.astro`, `src/data/admin.ts` |
| Sign-in: email + password; refresh; 30-min idle sign-out | `src/lib/admin/session.ts`, `src/components/admin/AdminGate.tsx` |
| `/admin/orders`, `/survey/admin` on the shared sign-in | `src/components/shop/OrdersAdmin.tsx`, `src/components/survey/SurveyAdmin.tsx` |
| `admin_users`, `is_admin()`, audit log; `shop-admin` checks `admin_users` and logs every change | `supabase/migrations/20261020000000_admin_core.sql`, `supabase/functions/_shared/handlers/admin.ts` |
| Page inventory from the build, synced by GitHub Action with a write-only token | `scripts/page-inventory.mjs`, `.github/workflows/page-inventory.yml`, `20261020010000_admin_pages.sql`, `/admin/pages` |
| Alerts (self-opening and self-resolving) and Overview numbers; unavailable data labeled | `20261020020000_admin_alerts.sql`, `/admin` |
| Settings: account, integration status, inventory token, audit log | `/admin/settings` |
| Security headers on admin paths | `public/_headers` |
| Tests | `tests/admin.test.ts`, `tests/page-inventory.test.ts`, `supabase/tests/admin-access.sql` (`npm run test:admin-sql`), `tests/shop-e2e.test.ts` |

Next up: Phase 3b alert email digest (scheduled Edge Function + Resend), then Phase 4 attribution.
