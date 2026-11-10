# Sunday Family Reset | OMC email series
Last updated: 2026-11-09

## Strategy

**Clean Mama research basis:** The owner's Gmail sample of 27 emails (October 14–November 9, 2026) showed recurring Sunday Routine Reset, Tuesday Quick Tip, Friday Catch-All emails, plus separate launch/welcome campaigns. Our conscious adaptation is **Sunday Family Reset + Wednesday One Small Win**, two core weekly series instead of copying three. See [full email strategy](./OMC_EMAIL_MARKETING_GAME_PLAN.md).

Recurring Sunday email to help families plan the week together, reinforce the four-part Family Meeting approach without replacing the Club's personalized printed resources. Paired with Wednesday's *One Small Win*. Content first, soft offer second.

- Sunday: 1 concrete weekly shared-family action, preferably anchored to a Family Meeting.
- Wednesday: One Small Win for one small practical problem.
- Monthly: tie ideas to OMC Club theme, with free guides as gentle reading links.
- Promotions: separate campaigns only when appropriate, never overload the inbox.

## First four Resend drafts (ALL UNSENT and UNSCHEDULED)

| Intended Sunday | Issue | Subject | Resend broadcast ID |
|---|---|---|---|
| 2026-11-15 | 01 | Your family doesn't need another complicated plan | `a042b85c-d216-4fc1-9a19-9caf8660ee4a` |
| 2026-11-22 | 02 | One question that gets the whole family helping | `9a9acbdc-8150-4f0b-9ce3-bc3e9b7b4a37` |
| 2026-11-29 | 03 | Before December starts, ask your kids this | `cb0061d6-7faf-49fe-b823-ce338b9d5960` |
| 2026-12-06 | 04 | A December family tradition that doesn't cost much | `c0570537-539b-4976-80fe-ebd30949b205` |

All four **currently use** the opted-in Free Resource Resend segment `7bf64eae-a8f7-4fb4-a18d-3578a2e1e557`; branded email HTML; white edge-to-edge mobile wrapper; complete plain text; physical mailing address; unsubscribe link. Resend read-back confirmed all are drafts with valid content. The broadcast scheduler allowlist in `supabase/functions/resend-broadcast-scheduler/index.ts` now contains these IDs; this does **not** schedule or send them.

## Subscriber Access in these drafts

- **Issues 01–03:** The free guide library link now uses `https://www.organizedmomcollective.com/guides/#omc_pass={{{contact.RESOURCE_PASS}}}` in both HTML and plain text. Resend merges the subscriber-specific property at send time. The site should validate the pass and remember access without requiring another email form.
- **Issue 04:** The Club link is an offer page, not gated free content, so it **does not** carry the subscriber pass.
- Three existing consented contacts have private passes synced to Resend; valid-pass and invalid-pass API checks passed. The actual Resend tracked-click -> deployed site -> fresh-browser experience is **still unverified**. See [Subscriber Access](./SUBSCRIBER_RESOURCE_ACCESS.md).
- Do not include the raw pass in logs, public pages, Pinterest pins, or any Club member authentication pathway.

## Editorial pattern
1. Short opener reflecting an actual family pressure point.
2. One Family Meeting question or weekly practice.
3. One small achievable family action, not a long list.
4. One soft link to a relevant free guide, or occasionally the Club.
5. Monthly themes: November 2026 *Our Family, Our Team*; December 2026 *Give to Others*.

## Critical pre-scheduling gates
**Do not schedule any Sunday or Wednesday newsletter yet.** Audience separation is now implemented and all twelve drafts target Newsletter Ready. Real tracked-link and live new-subscriber handoff checks remain before first scheduling. The database welcome-send ledger blocks welcome sends on reserved newsletter dates; do not bypass the Resend scheduling guard.

Before sending, build and verify a newsletter-ready audience that excludes subscribers who have incomplete welcome steps, including an end-to-end test where a newly opted-in contact does not receive the Sunday broadcast. Keep existing unsubscribe and suppression safeguards in both Supabase and Resend. The reservation-first scheduler requires service-role and `BROADCAST_SCHEDULING_ENABLED=true`; it is not enabled.

Once gates are resolved, review the emails with the owner; schedule Sunday sends for a consistent local time, reserve the dates first, and introduce Wednesday One Small Win in a coordinated plan. The two early welcome emails remain active only for new opt-ins.

## Launch checklist

- [x] Four Sunday issues drafted in Resend with mobile-friendly HTML and footer.
- [x] Sunday 01–03 have `RESOURCE_PASS` links and corresponding Resend contact properties.
- [x] Sunday drafts on scheduler allowlist, with sending disabled.
- [ ] Test a real personalized email link with Resend click tracking and fresh mobile/browser.
- [ ] Verify welcome-completed audience membership and exclusion of new Day 2/Day 6 signups.
- [ ] Confirm unsubscribe/suppression enforcement in the actual broadcast segment.
- [ ] Confirm per-day coordination with Wednesday One Small Win and any launch campaigns.
- [ ] Owner approves content, dates, and schedule. **Do not send before approval.**

## Newsletter Ready audience (implemented 2026-11-09)

The four Sunday drafts have been reassigned in Resend to `OMC | Newsletter Ready` (`98ec76b1-fe2e-42d4-898d-b235b9c9df8b`). The separate marketing capture segment remains `OMC | Free Resource Opt-Ins`. Supabase admits new readers to Newsletter Ready only after their Day 6 welcome has a confirmed `sent` status; the three existing prelaunch opted-in contacts were synced successfully. Suppression and explicit consent still apply. SQL eligibility tests passed; a genuine new subscriber's complete lifecycle has not yet been observed. See [handoff runbook](./NEWSLETTER_AUDIENCE_HANDOFF.md).

All four emails remain **draft**, unsent and unscheduled. The guarded broadcast scheduler was redeployed to require the new segment.


## Resolved broadcast personalization (after QA)

Earlier one-person sends showed blank custom fields, because they used the unsupported top-level placeholder. That finding is **superseded** by delivered diagnosis using `{{{contact.RESOURCE_PASS}}}` and a successful one-person email containing a clickable, complete signed URL. Three Sunday drafts were corrected and read back as drafts. The only remaining Subscriber Access check is the **real production browser popup/download experience**; do not schedule until that and final audience/schedule approval are complete. See [Subscriber Access](./SUBSCRIBER_RESOURCE_ACCESS.md).


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
