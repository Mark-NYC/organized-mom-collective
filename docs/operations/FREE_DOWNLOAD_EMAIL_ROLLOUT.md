# Free download email collection rollout (2026-11-06)

**Update, November 9, 2026:** Subscriber Access has been built as an extension to this existing gate, not a replacement. The site now recognizes secure subscriber links from OMC email through the `RESOURCE_PASS` Resend contact property. Backend sync and token verification have passed tests, but the live email-click/browser flow still needs deployment smoke testing. See [Subscriber Access](./SUBSCRIBER_RESOURCE_ACCESS.md) and [email strategy](./OMC_EMAIL_MARKETING_GAME_PLAN.md). Historical rollout steps remain below.

## What is implemented
- Existing `tool_email_contacts` remains the source for captured leads. Signup requires an email but marketing checkbox is optional and unchecked.
- Existing chore-chart and responsibility-chart gates keep working on the previous RPC if the new v2 endpoint is not yet deployed.
- Public generators that use `src/lib/printable.ts` now share one signup modal, keyed to their route. Paid, account, Club, and app pages are excluded.
- PDF links from `/guides/<slug>` and `/resources/<slug>` use the same gate when clicked normally (links to static files under `/downloads/`). Custom export buttons still need explicit wiring if they do not use `src/lib/printable.ts`. The standalone free Family Meeting Agenda print button now uses the gate.
- First-touch UTM source/medium/campaign/content are recorded for **new signup submissions** after v2 is deployed. This does not backfill historical visitors.
- Access is remembered in localStorage, so the modal is not repeatedly shown. This does NOT imply the visitor consented to promotional email.
- **Subscriber Access:** Already opted-in readers may also arrive via an email URL fragment `#omc_pass={{{contact.RESOURCE_PASS}}}`. The browser verifies the pass with an Edge Function, removes the fragment and reuses the same localStorage key. A fragment pass does not require another signup and does not imply a new marketing opt-in. Access is limited to the **free-resource download gate**, not paid member rights.

## Deployment order (important)
1. Apply `supabase/migrations/20261106000000_unified_free_download_capture.sql` in the correct Supabase project.
2. Apply `supabase/migrations/20261106010000_extend_free_download_tool_ids.sql` in the same project to add newly covered routes such as Family Responsibility Builder and Family Meeting Agenda.
3. Verify the RPC `tool_email_signup_v2` returns `ok` for an allowed tool with unchecked consent and creates a contact with `marketing_opt_in=false`.
4. Deploy the site PR. Existing gate uses its own current flag.
5. Enable `PUBLIC_UNIFIED_DOWNLOAD_EMAIL_ENABLED=true` **only if** `PUBLIC_TOOL_EMAIL_GATE_ENABLED=true`, Supabase URL/key are set, and step 2 passed. Rebuild the Astro site.
6. Smoke test a first-time incognito download on `/chore-chart`, `/routine-chart`, `/planner`, `/family-responsibility-builder`, `/family-meeting-agenda` (print), and an actual guide and article PDF link. Verify repeat downloads do not ask again.
7. Check that paid downloads, Club, /app, and account save flows were not affected.

## Consent and sending
- A download request with unchecked marketing consent is **not** a marketing subscription. Only `marketing_opt_in=true` is eligible for promotional sequences.
- The existing starter-kit delivery flow is separate and was deliberately untouched.
- This PR does NOT create welcome emails, send requested printables by email, or configure unsubscribe processing. Do not enable promotional sequences until unsubscribe/suppression handling and sender verification are audited.
- V2 retains a past opt-in if a customer later downloads without checking the box. Explicit unsubscribe/withdrawal must be applied in the outbound-email system. The database must not treat an opt-out from that system as permission to email.
- Source attribution is only stored when the visitor submits the form; later free downloads after browser access are not linked back to her identity.

## Subscriber link QA (added 2026-11-09)

- [x] Three existing marketing-eligible contacts have synced pass properties in Resend.
- [x] Valid pass verified by deployed endpoint: `{ok:true}`.
- [x] Invalid pass rejected by deployed endpoint: `{ok:false}`.
- [x] Email links in Sunday 01–03 and One Small Win 05 updated to pass the personalized fragment.
- [ ] Confirm the site includes recent `tool-email.ts` / `PublicLayout.astro` changes in the **deployed production build**.
- [ ] Follow a real Resend personalized, click-tracked email URL on a clean device and verify a guide PDF and generator can be downloaded without another form.
- [ ] Test expired pass, unavailable API, subscriber who opted out after earlier access, and access from a new browser.
- [ ] Test that no `/club`, `/app` or paid feature can be unlocked by the free pass.
- [ ] Do not schedule Sunday/Wednesday newsletters until the separate welcome-completion audience rule passes QA.

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

## Coverage notes
- Generic PNG downloads calling `downloadPng` are gated by their public route ID. The builder and weekly planning tools remain editable before signup.
- Free document links under `/downloads/` are gated on individual public guide and article pages, including nested clickable elements in the link.
- Preview images and links, ordinary article reading, home and shop pages, and all /club, /app, /checkout and purchased /download routes are not intercepted.
- A successful signup is remembered in localStorage under `omc:tool-download-access:v1`. To confirm the first-time modal, use a **fresh incognito session** (or clear that key). A missing popup on a browser that has already unlocked is expected.
- Static files under /downloads are publicly addressable. The email dialog is a convenience gate on the download interaction, **not** access control for direct URLs.
- If the unified feature flag or Supabase URL/anon key is missing, no modal will appear even when the route is wired; verify deployment variables and rerun build after toggling.
- For newly added free tools, update both `publicPrintablePaths` and the Supabase v2 RPC allowlist in a new migration. For new guides and articles, `guide-<slug>` routes are automatically supported by the existing v2 pattern.

### Verified contact-property syntax and broadcast link, November 9, 2026

**Resolved:** Resend's broadcast interpolation for custom contact properties uses `{{{contact.RESOURCE_PASS}}}`, **not** `{{{RESOURCE_PASS}}}`. The latter rendered blank even though the contact property exists. A diagnostic one-person broadcast confirmed `{{{contact.RESOURCE_PASS}}}` expands to the actual 64-character pass. A subsequent one-person broadcast `55bec597-3270-4e9a-8c05-c410dca2a15f` was delivered to Gmail with a complete clickable `/guides/#omc_pass=<64-hex-pass>` URL. Domain click tracking was disabled during this test. No production newsletter was sent.

**Resend drafts corrected and read back:** Sunday Family Reset 01–03 and One Small Win 05 now contain `{{{contact.RESOURCE_PASS}}}` in HTML and plain text, with zero old placeholders; all remain `draft`, assigned to `OMC | Newsletter Ready`. The 15-minute pass sync and Supabase token verifier are active. A fresh valid-token POST returned `200 {ok:true}` and invalid-token POST returned `200 {ok:false}`.

**Final pending browser QA:** A human must open the delivered one-person test email in a fresh private browser and try a real PDF and generator download. Static production website deployment cannot be independently confirmed from the available connectors. Do not claim that the live site's popup behavior has been verified. Further schedule approval is still separate from testing.

