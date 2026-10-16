# /admin: setup and security

One private command center at `/admin`: Overview (alerts + numbers), Pages & Funnels, Shop & Orders, Survey, Settings. Plan, audit and later phases: [docs/operations/ADMIN_DASHBOARD_PLAN.md](../docs/operations/ADMIN_DASHBOARD_PLAN.md).

**Status (2026-10-16): built (Phases 1–3), not yet activated.** The code is in the repository; the three database migrations, the `shop-admin` redeploy and the GitHub secret below are the owner's steps.

## How it's protected

| Layer | What it does |
| --- | --- |
| Sign-in | Supabase Auth email + password, then an authenticator-app code (TOTP). First sign-in adds the authenticator (QR code). No public sign-up. |
| Database | `is_admin()` is true only for a row in `admin_users` **and** an MFA-verified (`aal2`) session. Every admin table and the existing shop/survey policies go through it, so a stolen password alone reads nothing. |
| Edge Function | `shop-admin` refuses tokens without `aal2` (`mfa_required`) and accounts not in `admin_users` as owner. |
| Least privilege | Admin pages read through row-level security with the admin's own token. Admin functions are `security definer` and check `is_admin` first. The service role stays in Edge Functions. `helper` role (for a future assistant) gets survey and page inventory only, no orders, money or audit log. |
| Audit log | `admin_audit_log`: sign-ins, authenticator setup, every `shop-admin` change, alert acknowledgments, token rotation. Append-only (a trigger refuses update/delete, even for the service role). Never stores notes, addresses or message bodies. |
| Rate limits | Supabase Auth's own sign-in/MFA limits; 60 audit entries per admin per minute; inventory sync 30 runs/hour. |
| Browser | `AdminLayout`: noindex, no GA4, no Pinterest tag, no manifest or service worker (`npm run check:site` fails the build otherwise). `vercel.json` headers on `/admin/*` and `/survey/admin`: CSP (scripts from this site only, connections to Supabase only), no framing, no referrer, `no-store`. One session per tab (`sessionStorage`), refreshed automatically, signed out after 30 minutes idle. |
| Secrets | Stripe and Resend keys stay in Edge Function secrets. Settings shows only configured / not configured. The page-inventory token is stored as a SHA-256 hash. |

`script-src` allows inline scripts because Astro's island loader is inline; third-party script hosts are still blocked.

## Activate (in this order, so you're never locked out)

1. **Merge the PR** (into the default branch) and wait for the Vercel deploy. `/admin`, `/admin/orders` and `/survey/admin` now use the new sign-in.
2. **Add the authenticator:** open `/admin`, sign in with the shop admin account, scan the QR code with an authenticator app, type the code. (This works before the migrations; it only uses Supabase Auth.) Save the app's backup in your password manager.
3. **Supabase → SQL Editor**, run each file once, in order (paste the whole file → Run):
   1. `supabase/migrations/20261020000000_admin_core.sql`: `admin_users` (copies the current shop admin in as owner), MFA rule, audit log. From now on every admin read needs the authenticator code.
   2. `supabase/migrations/20261020010000_admin_pages.sql`: page inventory.
   3. `supabase/migrations/20261020020000_admin_alerts.sql`: alerts, Overview numbers, `low_stock_threshold` on products, `return_status_at` on support requests.
4. **Redeploy `shop-admin`**: Edge Functions → shop-admin → Code → replace everything with `supabase/dashboard/shop-admin.ts` → Deploy (Verify JWT stays off). It now requires the authenticator session and writes the audit log.
5. **Authentication → Sign In / Providers:** confirm "Allow new users to sign up" is **off**. **Authentication → Password security:** turn on leaked-password protection.
6. **Page inventory** (see below).
7. Sign out and in again at `/admin`; the Overview should load with its alerts.

If step 3 runs before step 2, sign in at `/admin` anyway: the sign-in adds the authenticator before it needs the database, then everything loads.

**Lost phone:** Supabase → Authentication → Users → the admin → remove the MFA factor, then sign in at `/admin` and add the new phone. Only someone with the Supabase account can do this.

**Adding an admin later:** create the user in Authentication → Users, then
`insert into public.admin_users (user_id, role) select id, 'helper' from auth.users where email = 'them@example.com';`
(`owner` for full access). `shop_admins` and `survey_admins` are no longer consulted.

## Page inventory

After every push to the default branch, `.github/workflows/page-inventory.yml` builds the site, lists every page (including landing pages nothing links to), their tracked buttons, and checks external button links (Etsy etc.), then sends it to `site_pages_sync`.

1. `/admin/settings` → Page inventory → **Create token**. Copy it (shown once).
2. GitHub → repository → Settings → Secrets and variables → Actions:
   - **Secret** `PAGE_INVENTORY_TOKEN` = the token.
   - **Variables** `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` (same public values as Vercel), plus any `PUBLIC_*` flags set on Vercel production (`PUBLIC_SHOP_ENABLED`, `PUBLIC_TOOL_EMAIL_GATE_ENABLED`) so the inventory matches the live build.
3. Actions → Page inventory → Run workflow. `/admin/pages` fills in.

The token can only replace the page list. If it leaks, Settings → Replace token.

Locally: `npm run build && npm run inventory` writes `page-inventory.json` (git-ignored) and prints a summary.

## Alerts

`admin_alerts_refresh()` re-checks every rule each time the Overview loads; alerts open once per problem, update, and close themselves when the problem is gone. Rules (in `admin_alert_conditions()`, migration `20261020020000_admin_alerts.sql`) cover live orders only:

- paid physical order not shipped after 2 business days (critical at 4)
- order flags: oversold, amount mismatch, dispute, failed refund
- customer emails failed or not sent (no provider), order and Starter Kit
- support request that didn't reach the inbox; acknowledgment failed; open 1+ business days (critical at 3)
- return approved 14+ days and not received; received and not refunded after 2 business days
- physical product on sale with 0 stock (critical) or at/below its `low_stock_threshold` (default 5)
- Stripe webhook silent while checkouts were started
- store switch Open with no real shipping rate
- website: button pointing at a page that isn't built, external button link answering 404/410, page removed, inventory stale

Not yet: alert emails (needs a scheduled function; Phase 3b), analytics-event alerts (needs GA4 data, Phase 5).

## Tests

- `npm test`: sign-in/MFA client, `shop-admin` MFA gate and audit detail, alert sorting, page filters, inventory parsing (`tests/admin.test.ts`, `tests/page-inventory.test.ts`).
- `npm run test:admin-sql`: 80 database checks on a throwaway local Postgres (anon, signed-in stranger, owner without MFA, helper, owner with MFA; every alert rule opening, ignoring test orders, resolving and reopening; the exact function allow-list). `supabase/tests/admin-access.sql`.
- `npm run test:shop`: the shop end-to-end suite now signs in with MFA-verified tokens and checks a password-only token is refused.
- `npm run check:site`: admin pages carry no trackers, manifest or service worker, are noindex and stay out of the sitemap.
