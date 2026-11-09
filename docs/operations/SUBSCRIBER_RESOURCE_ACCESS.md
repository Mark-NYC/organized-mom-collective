# Subscriber Resource Access

Built 2026-11-09 for Organized Mom Collective. This is the reusable **subscriber benefit layer** for the Clean Mama-informed Sunday Family Reset and Wednesday One Small Win strategy. Access is separate from email marketing consent; the feature itself does not send email or schedule broadcasts.

## What it does

Someone opening an OMC newsletter can use the free guides and free generators without supplying the same email address again. New Pinterest/Google visitors continue to see the existing download/signup modal. This is **convenience gating**, not paid-content authorization: the website's `/downloads/*` static files already remain public.

### Email link format

Append the subscriber-specific Resend contact property to the **fragment**, not the query:

```text
https://www.organizedmomcollective.com/guides/#omc_pass={{{RESOURCE_PASS}}}
https://www.organizedmomcollective.com/routine-chart/#omc_pass={{{RESOURCE_PASS}}}
https://www.organizedmomcollective.com/guides/family-laundry-system/#omc_pass={{{RESOURCE_PASS}}}
```

`RESOURCE_PASS` is the custom **string** Resend contact property (created November 9, 2026). It must be merged by Resend when sending to a contact, not copied as a literal token or an email address. Do not use these links on non-personalized public web pages. Do not use the pass for access to `/club`, `/app`, `/account`, paid products, private APIs, or any personal data.

The fragment is handled by website JavaScript and is not included in a standard HTTP request to the website. Client code POSTs the token to the resource-pass verification Edge Function, strips the fragment using `history.replaceState`, then remembers access in the existing `omc:tool-download-access:v1` localStorage key. **Raw token is not stored in the browser's localStorage.** If the pass is invalid, expired, or the endpoint is unavailable, the normal email gate remains available. Same-browser access already existed before this work.

### Database / sync

- `public.subscriber_resource_passes`: per-address random 64-hex access pass, SHA-256 hash, expiry 90 days, sync status; RLS and no anon/authenticated grants.
- `public.subscriber_resource_pass_sync_jobs`: isolated, opaque dispatch tokens; retry controls and RLS.
- Private signup trigger creates a pass when marketing consent becomes true; does not grant fresh passes to suppressed or opted-out contacts.
- Every fifteen minutes `omc-resource-pass-sync` prepares/renews expiring passes and dispatches eligible sync jobs.
- `resend-resource-pass-sync` Edge Function updates the contact's `RESOURCE_PASS` via Resend API only after rechecking explicit marketing consent, suppression, and Resend opt-out. It does not send emails.
- `subscriber-resource-access` Edge Function checks SHA-256 token hash and expiry, with restricted CORS and no-store; its response is only `{ok:true|false}`.
- Access previously granted is retained after opting out of marketing. **Consent to send emails and entitlement to existing free resources are different things.**
- Pass expiration matters only for opening a link on a *new browser*; a successful prior browser download is remembered. Never treat a token as proof of marketing consent.

Files:
- `supabase/migrations/20261109090000_subscriber_resource_passes.sql` (source mirror of already applied production schema)
- `supabase/functions/resend-resource-pass-sync/index.ts`
- `supabase/functions/subscriber-resource-access/index.ts`
- `src/lib/tool-email.ts`
- `src/layouts/PublicLayout.astro`

### Newsletter drafts updated

The first four Sunday drafts are part of the new **Sunday Family Reset** series. The ongoing OMC cadence is Sunday (shared family rhythm), Wednesday (One Small Win) and occasional purposeful campaigns, rather than copying Clean Mama's three-weekly-emails-plus-launches volume. See [email strategy](./OMC_EMAIL_MARKETING_GAME_PLAN.md) and [Sunday plan](./SUNDAY_FAMILY_RESET_LAUNCH_PLAN.md).


- Sunday Family Reset 01 `a042b85c-d216-4fc1-9a19-9caf8660ee4a`
- Sunday Family Reset 02 `9a9acbdc-8150-4f0b-9ce3-bc3e9b7b4a37`
- Sunday Family Reset 03 `cb0061d6-7faf-49fe-b823-ce338b9d5960`
- One Small Win 05 `5745766c-36c5-4ab1-a3c1-0becd37ba0a5`

Sunday 04 links to a Club offer, not a free gated guide, so it intentionally has no pass.

### Verification

- Production three eligible contacts provisioned with 90-day access passes; all three Resend sync jobs marked `synced` on first attempt.
- Resend contact readback verified `RESOURCE_PASS` is populated (do not log or display the raw value).
- HTTP via pg_net tested a valid pass: `200 {ok:true}`; invalid token: `200 {ok:false}`.
- Three Sunday broadcasts verified `{{{RESOURCE_PASS}}}` appears in HTML and plain text, status `draft`, and physical address/unsubscribe placeholders remain intact.

### Still to verify before scheduling

1. A real personalized **Resend broadcast** preview/delivery to an opted-in test contact: ensure Resend actually substitutes `{{{RESOURCE_PASS}}}` in the tracked link and retains the fragment after any click-tracking redirects. A direct API contact-property check is not proof of this step.
2. Actual production web deployment of the `src/` commits, with browser smoke test on a clean private browser: newsletter click → no email dialog on PDF and generator download; invalid pass → ordinary dialog; cross-device behavior.
3. Test consent-free download, an unsubscribed reader's previously granted access, and that Club/paid routes never become accessible via a resource pass.
4. One Small Win & Sunday newsletters **remain drafts/unscheduled** pending welcome-completion audience separation.

The feature is implemented, but do not claim the end-to-end email-to-browser experience is live-verified until these checks are complete.

## Ownership and ongoing maintenance

- The marketing email team must use `{{{RESOURCE_PASS}}}` for **new free guide and generator links** where an already opted-in reader would otherwise be prompted for the same email. For public articles, product offers, Club account routes and directly accessible PDFs, a subscriber pass is not always needed.
- Do not remove the existing `omc:tool-download-access:v1` behavior; it already grants access after the original capture on the same browser. Subscriber Access extends this to links clicked on other devices.
- Add new newsletter draft IDs and personalized URL QA to the relevant Sunday or One Small Win MD before approving send.
- Token lifecycle: 90-day pass, refreshed before expiry for active consented Resend contacts. Older links may expire on a new device; previously remembered browser access continues. Never reenable marketing mail from a free-resource access check.
- This is not payment, authentication, Club access, nor protection for public static `/downloads/*.pdf` files. It merely avoids duplicate email capture.
- The last blocker for the full editorial program is **newsletter segmentation excluding welcome-incomplete contacts**. This is separate from token validation and must be done before broadcast scheduling.
