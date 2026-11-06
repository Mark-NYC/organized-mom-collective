# Free download email collection rollout (2026-11-06)

## What is implemented
- Existing `tool_email_contacts` remains the source for captured leads. Signup requires an email but marketing checkbox is optional and unchecked.
- Existing chore-chart and responsibility-chart gates keep working on the previous RPC if the new v2 endpoint is not yet deployed.
- Public generators that use `src/lib/printable.ts` now share one signup modal, keyed to their route. Paid, account, Club, and app pages are excluded.
- PDF links on `/guides/<slug>` use the same gate, when clicked normally. Custom PDF buttons that do not use anchor links need individual integration.
- First-touch UTM source/medium/campaign/content are recorded for **new signup submissions** after v2 is deployed. This does not backfill historical visitors.
- Access is remembered in localStorage, so the modal is not repeatedly shown. This does NOT imply the visitor consented to promotional email.

## Deployment order (important)
1. Apply `supabase/migrations/20261106000000_unified_free_download_capture.sql` in the correct Supabase project.
2. Verify the RPC `tool_email_signup_v2` returns `ok` for an allowed tool with unchecked consent and creates a contact with `marketing_opt_in=false`.
3. Deploy the site PR. Existing gate uses its own current flag.
4. Enable `PUBLIC_UNIFIED_DOWNLOAD_EMAIL_ENABLED=true` **only if** `PUBLIC_TOOL_EMAIL_GATE_ENABLED=true`, Supabase URL/key are set, and step 2 passed. Rebuild the Astro site.
5. Smoke test a first-time incognito download on `/chore-chart`, `/routine-chart`, `/planner`, and an actual guide PDF link. Verify repeat downloads do not ask again.
6. Check that paid downloads, Club, /app, and account save flows were not affected.

## Consent and sending
- A download request with unchecked marketing consent is **not** a marketing subscription. Only `marketing_opt_in=true` is eligible for promotional sequences.
- The existing starter-kit delivery flow is separate and was deliberately untouched.
- This PR does NOT create welcome emails, send requested printables by email, or configure unsubscribe processing. Do not enable promotional sequences until unsubscribe/suppression handling and sender verification are audited.
- V2 retains a past opt-in if a customer later downloads without checking the box. Explicit unsubscribe/withdrawal must be applied in the outbound-email system. The database must not treat an opt-out from that system as permission to email.
- Source attribution is only stored when the visitor submits the form; later free downloads after browser access are not linked back to her identity.

## QA cases
1. Invalid email: blocked without network request.
2. Empty honeypot vs filled honeypot: filled is rejected by the RPC.
3. Checkbox unchecked: contact created with `marketing_opt_in=false`.
4. Checkbox checked: timestamps and consent version saved.
5. Existing unsubscribed/suppressed address: do not email without a fresh lawful opt-in.
6. Repeated signup for existing contact: no duplicate row; last_tool refreshed.
7. Unknown tool id: rejected. Rate limit: still enforced.
8. Browser with previous unlock: no new modal.
9. Existing `chore-chart` works when new v2 RPC is unavailable.
10. Club and purchased printables: no email gate.
11. Guide PDF, both mobile and desktop: clicking link after signup begins the download.
