# Organized Family V21: production launch (2026-11-27)

The owner approved the V21 preview ([V21_PREVIEW.md](V21_PREVIEW.md)) and its four decisions:
- the preview itself;
- moving automatic event-preparation cards into the optional "Plan something";
- the docked two-tab bar;
- full-page routine cards.

V21 is now the experience at **/app** on each signed-in household's real data. It is built on the V20 launch ([V20_LAUNCH.md](V20_LAUNCH.md)), with no feature flags and no parallel experience.

## 1. What changed in production

| Where | Change |
| --- | --- |
| `/app` (Today) | `TodayV21`: What matters for this adult, Today's plan (agreed commitments with owners and checks), Our week (awareness, optional "Plan something"), Everyone's part (standing agreements, routine cards, what we've decided), the Family Meeting row, Plans · Cleaning · Resources |
| Kept from V20 | "Something changed?" and its cards: simplify today, a little backup, calendar changes. A request made with V20's Share the load still opens its own sheet. |
| `/app/family/meeting` | Let's Talk opens with "Since last time" (declined requests, decisions made each time, unanswered requests), before V20's agenda |
| Every `/app` family page | Solid black text, except white on dark buttons, person avatars in their calendar colors, and the brand wordmark. Sans-serif wordmark; a docked two-tab bar on phones (desktop keeps the header tabs). The printed-calendar companion (`/app/calendar…`) is unchanged. |
| Notifications | A request reaches only the person asked, in the asker's words, with I've got it / Not this time. The asker hears the answer once. No duplicate "updated a shared plan" notice for an accept or a one-time plan. A tapped answer is applied once the household's shared state has loaded; before this fix it could be lost on a cold start. |

## 2. Where V21's data lives (no migrations)

| V21 concept | Store |
| --- | --- |
| Requests, event choices, remembered decisions, per-date completion of weekly agreements, one-date covers, routine-card drafts, what each adult has seen | `household_intelligence`, one revision-checked document per household, keyed maps merged per key across two adults' devices. Old entries are pruned (answered requests after 21 days, choices and covers after 30, completions after 60). |
| An accepted request, a preparation the family chose, "I'll do it", "make it the usual", an edited standing agreement | The agreements store, through the existing outbox (`writesFor` → `agreement-save`) |

**IDs are deterministic** (`uuidFrom`), so the same request accepted on two phones writes the same agreement row once.

**One-date responsibilities are agreements with `onDate`.** They are never linked to a recurring event, so they can't silently repeat every week.

## 3. Verification before launch

| Suite | Result |
| --- | --- |
| Unit (`npx vitest run`) | **1,736 passed** (107 skipped as before), including 44 V21 tests |
| `astro check` | **0 errors, 0 warnings** |
| Production build | OK |
| `scripts/e2e/v21-live-e2e.mjs` (new): two real adult sessions on the isolated backend | **28 / 28** |
| `scripts/e2e/v20-live-e2e.mjs`: production `/app` (selectors updated for V21 Today; V20 flows kept) | **27 / 27** |
| `scripts/e2e/family-e2e.mjs` (web): reads Everyone's part after opening it, as a person would | **Passed** |
| `scripts/e2e/v21-preview.mjs` | **70 / 70** |
| V20 / V19 / V18 / V16 previews | **38, 120, 96, 84** |
| Every `/app` family page at 390 px | No light-on-light or dark-on-dark text; member colors intact; no page errors |

The new two-adult suite (`v21-live-e2e.mjs`) covers, end to end:
- Today's plan from real agreements;
- Ask for a hand: asking moves nothing, the request is shared state, and one push is queued for Sam;
- Sam accepts: a real agreement for that date only, and Jen's weekly agreement is unchanged;
- a stale second session of Sam's accepts again and still makes one agreement;
- Jen gets one "has it" push and no duplicates;
- Jen sees the confirmation, then it goes quiet;
- completion is separate;
- a request declined from a tapped push, applied as Sam: Jen keeps it ("still yours") and hears once;
- the docked tabs, black text and nav clearance at 375 and 430 px.

## 4. Rollback

1. **App:** in Cloudflare Pages, redeploy the production deployment before the V21 merge (`main` at `fa2b633a`, the V20 launch). The V20 client ignores V21's keys in `household_intelligence`.
2. **Data:** nothing to undo. Agreements V21 created are ordinary agreements, kept and editable in V20.
3. **Full restore**, only if ever required: from the verified backup taken before this launch ([DATABASE_BACKUPS.md](../operations/DATABASE_BACKUPS.md)).

## 5. Not in this launch

- **The native Home Screen widget.** The state it would read (`widgetFor`) is in place; the widget is not built.
- **Native APNs.** Unchanged from V20.
- **Creating a "we decide this each week" rule from the calendar.** Only the meeting's "Keep deciding each week" keeps one; there is no way to start one in production yet.
- **One-date agreements stay in the agreements store** after their date, as V20's Share the load agreements already did. Today and Everyone's part leave them out; other agreement lists may still show them.
