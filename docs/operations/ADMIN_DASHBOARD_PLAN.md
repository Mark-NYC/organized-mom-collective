# Unified /admin dashboard: plan

**Status:** planned, not built. Today's tools stay as they are until each phase below replaces one. Written 2026-10-16.

**Goal:** one private place, usable from a phone, to run Organized Mom Collective: website settings, products, shop orders, support requests, refunds and returns. Build it a slice at a time, each slice useful on its own, without disturbing what works today.

## Where things are today

| Job | Today | Where it lives |
| --- | --- | --- |
| Website orders, refunds, restocking, inventory, product fields, shop settings, shipping rate, launch status | `/admin/orders` (shop admins) | `src/pages/admin/orders.astro`, `src/components/shop/OrdersAdmin.tsx`, `shop-admin` Edge Function, `shop_admins` |
| Survey results | `/survey/admin` (survey admins) | `src/components/survey/SurveyAdmin.tsx`, `survey_admins` |
| Support requests and returns | Support inbox + Supabase Table Editor (`support_open`, `support_requests`) | `supabase/SUPPORT.md`, `docs/operations/CUSTOMER_SUPPORT.md` |
| Etsy orders, refunds, messages | Etsy Shop Manager | Etsy (no API integration) |
| Email contacts (tool gate, Starter Kit) | Table Editor → `tool_email_contacts` | `supabase/TOOL-EMAIL.md` |
| Site copy, products shown, prices on pages | Code (`src/data/*`, `src/config.ts`) + a deploy | Repository |

Good enough for the first 25 orders. The pain to fix later: two logins and admin lists, raw tables for support, no single "what needs me today" view.

## Architecture (keep the current pattern)

- **Pages:** one static Astro route group under `/admin` (noindex, out of the sitemap, no site header or footer), a shared admin shell (nav, sign-in state) and one React island per section. No server rendering needed: the site stays static on Vercel.
- **Sign-in:** Supabase Auth (email + password, public sign-ups off), the same login the order dashboard uses now. Turn on MFA (TOTP) before anything new ships.
- **Who's an admin:** one `admins` table (`user_id`, `role`: `owner` / `helper`, `added_at`), replacing `shop_admins` and `survey_admins` through views or a migration that copies them. Roles gate sections (a future helper might see support but not refunds or settings).
- **Reads:** through row-level security, as now (admins only; `anon` sees nothing).
- **Writes:** only through Edge Functions with the service role, each checking the caller's token and role first (the `shop-admin` pattern). One function per area (`shop-admin` stays; add `support-admin`) rather than one giant one.
- **Audit log:** an `admin_events` table (who, when, action, target, small JSON detail, never secrets or addresses) written by every admin function. Order events already exist (`shop_order_events`); fold them in or link them.
- **Secrets stay secrets:** the return address, Stripe and Resend keys stay in Edge Function secrets. The dashboard can show *whether* something is configured (as `status` does today), never its value. The return address is never displayed in the dashboard.
- **Etsy:** no API integration in the plan. Etsy orders, refunds and messages stay in Etsy; the dashboard records the Etsy order number on support and return records and links out to Etsy.

## Sections and requirements

### 1. Today (home)
- Counts and lists of what needs action: open support requests older than one business day, approved returns not yet received, received returns not yet refunded, unshipped paid orders, failed emails (`notify_status`, `return_instructions_status`, `shop_email_log`).
- Each item links to its record.

### 2. Support
- List with filters (status, topic, age), search by reference, email or order number.
- Record view: message, photo flag, email outcomes, notes, status changes (open → waiting → resolved).
- "Reply" opens the email client with the reference in the subject. In-dashboard replies are a later option only if email replies become hard to track.
- Link a request to a website order (and show it in the order) or record an Etsy order number.

### 3. Returns and refunds
- One flow per return: requested → approved → received → refunded (or declined), with dates.
- "Approve return" button: sets `return_status = approved`, which sends the existing return-instructions email. The address is never shown on screen.
- Website orders: refund through Stripe from the same screen (reuse `shop-admin` → `refund`), restock if sellable.
- Etsy orders: a reminder and link to refund in Etsy, then "Mark refunded".
- Policy checks shown, not enforced: days since delivery vs the 14-day window; damage has no cutoff.

### 4. Orders (move `/admin/orders` in)
- Everything `OrdersAdmin` does today, unchanged in behavior, inside the shared shell.

### 5. Products and inventory
- What `OrdersAdmin` already edits (name, price, active, stock), plus product images and per-product policy text (so the mug and future products get their own return terms, never the calendar's by default).

### 6. Website
- Shop switches already in `shop_settings` (checkout mode, tax). Feature flags that are build variables today (e.g. `PUBLIC_TOOL_EMAIL_GATE_ENABLED`) stay in Vercel unless moved to runtime settings deliberately.
- Page copy stays in code. A CMS is out of scope.

### 7. Contacts and survey
- Survey results (move `/survey/admin` in) and a marketing-consent export (only `marketing_opt_in = true`). Support contacts are never mixed in.

## Non-functional requirements

- Works on a phone first; every action reachable in two taps from Today.
- No customer data in browser storage beyond the Supabase session.
- Every destructive or money action asks for confirmation and is idempotent (request ids, as refunds already are).
- Accessible: labeled controls, keyboard use, visible focus, status messages announced.
- Tests per function (like `tests/shop.test.ts`), plus an access test: a signed-in non-admin and `anon` get nothing.
- Privacy: retention rule for resolved support requests (suggested 12 months), an export/delete path per customer on request.

## Build order (each phase ships on its own)

| Phase | Ships | Why first |
| --- | --- | --- |
| 0 (done) | Support form, `support_requests`, return approvals by Table Editor + webhook | Enough for the first 25 orders |
| 1 | `/admin` shell, `admins` table + roles, MFA on, sign-in; links to the existing order and survey dashboards | Foundation; no behavior change |
| 2 | Support section + `support-admin` function + `admin_events` | Replaces the Table Editor for daily support |
| 3 | Returns and refunds flow, with "Approve return" | Replaces manual status edits and the webhook |
| 4 | Orders and products moved into the shell | Consolidation; same features |
| 5 | Today view across all sections | Needs the data from 2–4 |
| 6 | Website settings, contacts, survey moved in; retire `/admin/orders` and `/survey/admin` routes (redirect) | Cleanup |

**When to start Phase 1:** when support volume or a second person makes the Table Editor painful, or before switching the website checkout from preview to live with real volume. Not before.

## Out of scope (for now)

Etsy API sync, a helpdesk/ticketing product, live chat, customer accounts, an in-dashboard email composer, page-copy editing.
