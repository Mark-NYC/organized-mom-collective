# Sunday Family Reset | OMC email series
Last updated: 2026-11-09

## Strategy
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

All four use the opted-in Free Resource Resend segment `7bf64eae-a8f7-4fb4-a18d-3578a2e1e557`; branded email HTML; white edge-to-edge mobile wrapper; complete plain text; physical mailing address; unsubscribe link. Resend read-back confirmed all are drafts with valid content. The broadcast scheduler allowlist in `supabase/functions/resend-broadcast-scheduler/index.ts` now contains these IDs; this does **not** schedule or send them.

## Editorial pattern
1. Short opener reflecting an actual family pressure point.
2. One Family Meeting question or weekly practice.
3. One small achievable family action, not a long list.
4. One soft link to a relevant free guide, or occasionally the Club.
5. Monthly themes: November 2026 *Our Family, Our Team*; December 2026 *Give to Others*.

## Critical pre-scheduling gates
**Do not schedule any Sunday or Wednesday newsletter yet.** The current broadcast audience segment includes all marketing opt-ins, including people still completing Day 2 and Day 6 welcome emails. The database welcome-send ledger blocks welcome sends on newsletter dates, but Resend bulk broadcasts do not automatically exclude new contacts or respect a per-contact welcome completion state.

Before sending, build and verify a newsletter-ready audience that excludes subscribers who have incomplete welcome steps, including an end-to-end test where a newly opted-in contact does not receive the Sunday broadcast. Keep existing unsubscribe and suppression safeguards in both Supabase and Resend. The reservation-first scheduler requires service-role and `BROADCAST_SCHEDULING_ENABLED=true`; it is not enabled.

Once gates are resolved, review the emails with the owner; schedule Sunday sends for a consistent local time, reserve the dates first, and introduce Wednesday One Small Win in a coordinated plan. The two early welcome emails remain active only for new opt-ins.
