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


## Approved weekly newsletter schedule, November 10, 2026

The owner confirmed in a fresh private browser that the personalized subscriber guide link no longer prompts again for email. Earlier Resend delivered test emails verified `{{{contact.RESOURCE_PASS}}}` expands to the actual pass. This closes the outstanding human browser QA item for the guide path; a separate generator-specific visit has not been explicitly confirmed.

**Scheduled in Resend and recorded in the Supabase marketing broadcast calendar** (each checked as status `scheduled`; no immediate sends):

| Local send (America/New_York) | Series | Broadcast ID |
| --- | --- | --- |
| Sun Nov 15, 2026, 8:30 AM | Sunday Family Reset 01 | `a042b85c-d216-4fc1-9a19-9caf8660ee4a` |
| Wed Nov 18, 2026, 9 AM | One Small Win 01 | `36761fdf-d316-4921-9c20-bdf44bce02fd` |
| Sun Nov 22, 2026, 8:30 AM | Sunday Family Reset 02 | `9a9acbdc-8150-4f0b-9ce3-bc3e9b7b4a37` |
| Wed Nov 25, 2026, 9 AM | One Small Win 02 | `71b315ae-e4b4-41d5-b2c1-f67769eb310b` |
| Sun Nov 29, 2026, 8:30 AM | Sunday Family Reset 03 | `cb0061d6-7faf-49fe-b823-ce338b9d5960` |
| Wed Dec 2, 2026, 9 AM | One Small Win 03 | `f754f259-ad49-450e-95fc-c490b5f38298` |
| Sun Dec 6, 2026, 8:30 AM | Sunday Family Reset 04 | `c0570537-539b-4976-80fe-ebd30949b205` |

**Remaining five Wednesdays beyond the 28-day protected scheduler horizon**, still drafts:

| Intended local date, 9 AM | Draft |
| --- | --- |
| Dec 9, 2026 | `cb6b9c36-696c-4006-a039-93519616db73` |
| Dec 16, 2026 | `5745766c-36c5-4ab1-a3c1-0becd37ba0a5` |
| Dec 23, 2026 | `f821718f-f926-4b09-b3bf-baf17d5d89e6` |
| Dec 30, 2026 | `ce4ae542-4759-438d-a422-077c35c582a8` |
| Jan 6, 2027 | `fa2fb8e7-1305-449e-a0e6-816e99f259f3` |

**Follow-through task:** ChatGPT automation `6af3131b85d88191a553f26bcc60e2b1`, titled `Finish OMC Newsletter Schedule`, checks daily starting Nov 11 to schedule the remaining five one by one as they enter the 28-day window. It is instructed to verify status and consented segment, reserve the Supabase local date before the Resend call, verify scheduled status, and stop on ambiguity rather than retry blindly. The task is not proof the future broadcasts have been scheduled; verify future run results and calendar rows.

Schedule timezone is EST (UTC-5) on all listed dates. Resend sends to `OMC | Newsletter Ready` rather than the general opt-in segment. Welcome Day 2 and Day 6 emails remain live and blocked from overlapping reserved broadcast dates. The calendar records the seven dates above.

## Longer Resend editorial queue and subject line standards (November 10, 2026)

Created 12 more **unsent, unscheduled Resend drafts**: Sunday Family Reset 05–12 (December 13, 2026 through January 31, 2027) and One Small Win 09–12 (January 13 to February 3, 2027). Existing One Small Win 04–08 remain drafts. Together with the seven earlier scheduled emails, the plan now covers **24 issues** through February 3. All new drafts were read back with the welcome-completed Resend segment, physical footer, unsubscribe and correct personalization placeholders confirmed.

Updated the already-enabled daily automation `OMC Rolling Newsletter Queue` (`6af3131b85d88191a553f26bcc60e2b1`) to schedule the **17 remaining drafts** into Resend once each date falls within the 28-day horizon. It must reserve the date in Supabase first, verify Resend's future-dated status, and record the calendar; ambiguity stops scheduling rather than triggering an immediate send. Future automation runs must be checked before claiming additional items are scheduled.

Re-reviewed 23 actual Clean Mama inbox subjects (Oct 15–Nov 9) and intentionally revised eight new Sunday subject lines for recognizable situations, conversational questions, specific small wins and seasonal relevance. Kept the recurring series name in the email masthead; did not copy subject lines or claim knowledge of Clean Mama open rates. The four new Wednesday subjects follow the same approach. See [OMC_ROLLING_EMAIL_EDITORIAL_QUEUE.md](./OMC_ROLLING_EMAIL_EDITORIAL_QUEUE.md) for all new Resend broadcast IDs, subjects, dates and the applied rules.


### 2026-11-11 rolling newsletter scheduling verification
- **Newly scheduled:** One Small Win 04, broadcast `cb6b9c36-696c-4006-a039-93519616db73`, Wednesday **2026-12-09 09:00 EST / 2026-12-09T14:00:00Z**. Verified the existing Resend draft's newsletter-ready segment `98ec76b1-fe2e-42d4-898d-b235b9c9df8b`, sender, HTML and plain text, required postal footer, unsubscribe macro, and absence of invalid `{{{RESOURCE_PASS}}}`. Its Club link retained its existing UTM parameters. Supabase membership had three synced desired/in-segment records; calendar showed no competing date. `public.marketing_reserve_broadcast` returned `reserved` before scheduling; Resend readback showed `scheduled` with exact timestamp; `public.marketing_record_broadcast_schedule` returned `recorded`. No immediate send or new campaign created.
- Remaining 16 queued drafts are outside the 28-day horizon at this check and were not modified. Previously scheduled seven broadcasts remain unchanged. Continue daily eligibility checks and reconcile ambiguities without resending.
