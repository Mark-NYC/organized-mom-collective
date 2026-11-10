# Newsletter audience handoff (2026-11-09)

**Status:** Built and deployed. All 12 editorial broadcasts remain **unsent and unscheduled**. Resend segment is `OMC | Newsletter Ready` (`98ec76b1-fe2e-42d4-898d-b235b9c9df8b`).

## Purpose

Keep the Sunday Family Reset and Wednesday One Small Win broadcasts separate from the Day 2 / Day 6 new-subscriber welcome sequence. The existing `OMC | Free Resource Opt-Ins` (`7bf64eae-a8f7-4fb4-a18d-3578a2e1e557`) remains the consented contact collection segment, **not** the newsletter broadcast audience.

## Eligibility

A contact is eligible only if:
1. `public.tool_email_contacts.marketing_opt_in = true`;
2. there is no row in `public.marketing_suppressions` for that email;
3. **either** the contact opted in before 2026-11-09 UTC and has *no* welcome queue entries (legacy subscribers who cannot complete the newly launched welcome drip), **or** their Day 6 `marketing_welcome_queue` entry has status `sent`.

Newly opted-in contacts with Day 2 or Day 6 jobs still `held`, `ready`, `sending`, `failed` or `cancelled` must not enter the newsletter audience. If welcome ends in failure, the newsletter handoff remains closed until explicitly reconciled.

No retroactive welcome backfill is performed for prelaunch opt-ins.

## Automation

- `supabase/migrations/20261109100000_newsletter_ready_audience.sql`: RLS-protected membership ledger, private eligibility function, service-role-only claim and finish RPCs and `*/5 * * * *` cron `omc-newsletter-audience-sync`.
- `supabase/functions/resend-newsletter-audience/index.ts`: deployed Edge Function. Receives an opaque dispatch token, rechecks current eligibility via Supabase, checks Resend unsubscribe state and adds/removes a contact from **Newsletter Ready**. Does not send any email.
- Retry failures remain recorded; the ledger tracks `desired`, `in_segment`, `status`, attempts, errors and timestamps. Reconciliation checks both eligibility and cached segment membership.
- `supabase/functions/resend-broadcast-scheduler/index.ts` now permits scheduling only broadcasts targeting **Newsletter Ready** (and requires an explicit disabled-by-default scheduling flag plus Supabase date reservation).
- **Important:** Direct manual sending from Resend's dashboard bypasses the scheduler's date reservation. Operators must not send outside the approved workflow.

## QA actually performed

- Transaction-rolled-back SQL QA: new welcome-incomplete opt-in excluded; new opt-in with confirmed Day 6 `sent` eligible; no-consent contact excluded; suppressed contact excluded. No QA contact persisted.
- Production sync: three prelaunch consented contacts imported to **Newsletter Ready**, each with `desired=true`, `in_segment=true`, `status=synced`, first attempt successful; cron active.
- Twelve usable Resend broadcasts were updated to target segment `98ec76b1-fe2e-42d4-898d-b235b9c9df8b`. A Resend readback verified all twelve segment IDs and `draft` statuses.
- No broadcasts were sent or scheduled by this change. The welcome sequence is still live for newly consented contacts.

## Still to verify before first live broadcast

- Confirm a genuine new subscriber completes Day 6 in production, automatically appears in Newsletter Ready, and is excluded before Day 6. Simulation passed, but this full lifecycle has not been observed with a real new subscriber.
- Test end-to-end Resend personalized resource link (including Resend tracking) to a clean browser, as described in [SUBSCRIBER_RESOURCE_ACCESS.md](./SUBSCRIBER_RESOURCE_ACCESS.md).
- Inspect unsubscribes/removals and any membership failures before broadcast scheduling. Resend dashboard manual sends bypass the locked scheduler.
- Confirm the broadcast segment has no welcome-incomplete contacts at send time, and verify one-message-per-day coordination.
- Obtain explicit approval for the actual send dates and recipient audience.

## Editorial reference

- [OMC_EMAIL_MARKETING_GAME_PLAN.md](./OMC_EMAIL_MARKETING_GAME_PLAN.md)
- [SUNDAY_FAMILY_RESET_LAUNCH_PLAN.md](./SUNDAY_FAMILY_RESET_LAUNCH_PLAN.md)
- [ONE_SMALL_WIN_FIRST_8_DRAFTS.md](./ONE_SMALL_WIN_FIRST_8_DRAFTS.md)

### Verified contact-property syntax and broadcast link, November 9, 2026

**Resolved:** Resend's broadcast interpolation for custom contact properties uses `{{{contact.RESOURCE_PASS}}}`, **not** `{{{RESOURCE_PASS}}}`. The latter rendered blank even though the contact property exists. A diagnostic one-person broadcast confirmed `{{{contact.RESOURCE_PASS}}}` expands to the actual 64-character pass. A subsequent one-person broadcast `55bec597-3270-4e9a-8c05-c410dca2a15f` was delivered to Gmail with a complete clickable `/guides/#omc_pass=<64-hex-pass>` URL. Domain click tracking was disabled during this test. No production newsletter was sent.

**Resend drafts corrected and read back:** Sunday Family Reset 01–03 and One Small Win 05 now contain `{{{contact.RESOURCE_PASS}}}` in HTML and plain text, with zero old placeholders; all remain `draft`, assigned to `OMC | Newsletter Ready`. The 15-minute pass sync and Supabase token verifier are active. A fresh valid-token POST returned `200 {ok:true}` and invalid-token POST returned `200 {ok:false}`.

**Final pending browser QA:** A human must open the delivered one-person test email in a fresh private browser and try a real PDF and generator download. Static production website deployment cannot be independently confirmed from the available connectors. Do not claim that the live site's popup behavior has been verified. Further schedule approval is still separate from testing.

