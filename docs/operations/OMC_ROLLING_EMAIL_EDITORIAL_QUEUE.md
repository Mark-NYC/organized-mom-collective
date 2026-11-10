# OMC rolling editorial email queue

Updated 2026-11-10. Existing Sunday and Wednesday weekly cadence, same subscriber segment and suppression safeguards.

## Delivery system

- Sundays: **Sunday Family Reset**, 8:30 AM America/New_York, a 10-minute family meeting anchored in the month's family responsibility theme.
- Wednesdays: **One Small Win**, 9:00 AM America/New_York, one specific actionable household/family tip.
- Resend segment: `OMC | Newsletter Ready` `98ec76b1-fe2e-42d4-898d-b235b9c9df8b`, excludes still-onboarding subscribers.
- Resend only supports a limited advance scheduling horizon. All the new issues listed here have been **created as drafts in Resend**, not scheduled or sent. An enabled daily ChatGPT automation titled `OMC Rolling Newsletter Queue` (`6af3131b85d88191a553f26bcc60e2b1`) has been updated to reserve each date in Supabase, schedule it with explicit send time in Resend when within 28 days, check read-back status and record it, skip idempotently and alert on conflicts. The automation runs daily from Nov 11, 2026 to Jan 11, 2027. Automated future scheduling is a plan, **not proof the future send is scheduled**.
- Original Nov 15–Dec 6 seven newsletters are already scheduled in Resend and Supabase. They were not modified in this batch.
- Original One Small Win 04–08 already existed as drafts through January 6, and are covered in the extended rolling automation.

## Editorial queue

| Date | Series | Issue | Resend ID | Subject | State |
| --- | --- | --- | --- | --- | --- |
| Dec 9 2026 | Wednesday | 04 | `cb6b9c36-696c-4006-a039-93519616db73` | Ask your kids this question tonight | Existing draft |
| Dec 13 2026 | Sunday | 05 | `3e5fc633-bf8f-479d-9656-47e58be80bb9` | Who could use a little kindness this week? | New draft |
| Dec 16 2026 | Wednesday | 05 | `5745766c-36c5-4ab1-a3c1-0becd37ba0a5` | Tomorrow morning starts tonight | Existing draft |
| Dec 20 2026 | Sunday | 06 | `fecd6c29-8fe0-4bf5-8429-1d5274282a90` | One holiday job your child can actually own | New draft |
| Dec 23 2026 | Wednesday | 06 | `f821718f-f926-4b09-b3bf-baf17d5d89e6` | (Existing One Small Win 06 subject in Resend) | Existing draft |
| Dec 27 2026 | Sunday | 07 | `80a1aab1-b366-4d2e-ab5c-3f704aabfd7c` | Before January, ask your family these 3 things | New draft |
| Dec 30 2026 | Wednesday | 07 | `ce4ae542-4759-438d-a422-077c35c582a8` | Dinner shouldn't be your job alone | Existing draft |
| Jan 3 2027 | Sunday | 08 | `4c6b8392-d684-4f47-b553-cb7cc415f945` | What happens in a 10-minute family meeting? | New draft |
| Jan 6 2027 | Wednesday | 08 | `fa2fb8e7-1305-449e-a0e6-816e99f259f3` | The 15-minute habit that changes your week | Existing draft |
| Jan 10 2027 | Sunday | 09 | `d0f0ef29-ddba-4122-8bb8-906a60b77465` | One question that gets kids taking ownership | New draft |
| Jan 13 2027 | Wednesday | 09 | `c40c3657-d074-480d-8000-3912d0de667d` | Still reminding everyone? Try this instead. | New draft |
| Jan 17 2027 | Sunday | 10 | `60a9dc52-681e-40ad-8848-8ddea040fe23` | When your family meeting goes off the rails | New draft |
| Jan 20 2027 | Wednesday | 10 | `a7eb1f1d-c50a-449a-b425-17e61e3e6935` | The 2-minute fix for the after-school pile | New draft |
| Jan 24 2027 | Sunday | 11 | `d1735512-1731-49e5-9704-9025a67749f4` | The routine isn't sticking? Try this. | New draft |
| Jan 27 2027 | Wednesday | 11 | `9bd6cf29-47ac-4617-a6cd-4f612708d61f` | Does every family job end up back with you? | New draft |
| Jan 31 2027 | Sunday | 12 | `45caddd3-b6b5-4494-b56a-74bd565d9c61` | Before February, keep this one family habit | New draft |
| Feb 3 2027 | Wednesday | 12 | `3f959f5c-97dc-4437-b13e-20c92ba6aafb` | Want more family connection? Start smaller. | New draft |

**All 12 new Resend drafts were read back and verified**: draft status, Newsletter Ready segment, physical address, unsubscribe macro, HTML and plain text, no old broken `{{{RESOURCE_PASS}}}` macro. Two Wednesday free-guide links include the supported `{{{contact.RESOURCE_PASS}}}` macro after their UTM query, as tested in prior controlled broadcasts.

## Actual Clean Mama inbox subject-line review

Source: owner's connected Gmail, 23 Clean Mama emails Oct 15–Nov 9, 2026, covering editorial, launch and promotional email. Example subjects actually observed:
- `Routine Reset : Hello November! 🍂`
- `Quick Tip: What I Do Before Guests Come Over 🧺`
- `Scrolled for 20 minutes, cleaned nothing? 😂`
- `Quick Tip: 7 little homekeeping tricks that actually work ✨`
- `✨It’s not a motivation problem (it’s this)`
- `Catch-All Friday : hotel vibes at home + the coziest fall finds 🏨✨`
- `⏰Today only: a free 2027 Homekeeping Planner (act fast!)`

Observed features to apply without copying: recognizable recurring franchise; specific lived situations; a question that sounds natural; concrete outcome or time cost; timely seasonal context; occasional personal voice; more sales urgency only for real time-limited offers. Avoid a formula that makes every subject identical, exaggerated claims like 'changes everything' when the body is a modest tip, or emoji overload. Weekly editorial subject lines should sound like everyday family life; put the recognizable series identity in the preheader/masthead. Each draft should answer the exact promise in the subject.

We do **not** have Clean Mama's open/click/attributed sales data and cannot claim one subject formula is proven to convert better. OMC sender-domain click/open tracking is currently off.

## New content rationale

December Sundays: making giving a family-owned practice without shopping/pressure, keeping holiday responsibilities small, then reflecting together before January. January Sundays: establishing a short four-part Family Meeting, weekly ownership, adjusting unsuccessful routines, and continuing the rhythm into February. Wednesday tips: specific visible cues, after-school landing spot, whole-job ownership, and one ten-minute family connection moment in February. Every email contains one complete, independently useful action; Club links are occasional and relevant, not hard-sell pitches.

## Later checks

Ensure automation advances the Resend scheduled queue as planned and never schedules beyond the provider's 28-day horizon. Check actual schedule rows and welcome-suppression sync periodically, and compare email-associated conversion metrics after sufficient real traffic. Do not infer performance from deliverability tests. No immediate emails were sent by creating these drafts.
