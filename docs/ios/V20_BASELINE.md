# Organized Family V20: the locked baseline

**Status: design frozen.** V20 is the final approved experimental baseline. It is V19 (approved as the foundation) plus two additions: household notifications and the final illustration treatment.
- **No further design work:** no new screens, features, navigation or visual redesigns.
- **Next phase:** production integration, shared household state, real AI interpretation, notification delivery, native iOS testing and family testing.
- **Preview:** `/preview/organized-family-v20`. It is unlinked and `noindex`, with no analytics and no service worker, and runs on the fictional Rivera household.
- **Comparison:** V16, V17, V18 and V19 stay as they were. Nothing is merged, `/app` is untouched, and there are no production data or migrations.

Earlier decisions still hold where this doc doesn't override them:
- [V16_EXPERIMENT.md](V16_EXPERIMENT.md): product contract, agreements, privacy.
- [V17_VISUAL_SYSTEM.md](V17_VISUAL_SYSTEM.md): visual system.
- [V18_TODAY_INTELLIGENCE.md](V18_TODAY_INTELLIGENCE.md): intelligence layer.
- [V19_ATTENTION.md](V19_ATTENTION.md): attention management.

---

## 1. Locked product principles

1. **Mom shouldn't have to manage everything alone.** Organized moms raise organized families. The outcome is a home where everyone knows the plan and plays a part.
2. **The Family Meeting establishes the plan. Today helps the family navigate reality.** Intelligence bridges the two.
3. **Maximum intelligence, minimum interruption.** Know a lot, remember a lot, anticipate a lot, say very little. Quiet days are success.
4. **The family decides.** Intelligence anticipates, suggests, filters, remembers and recognizes readiness. The family agrees, owns and corrects. Nothing is assigned, agreed, contacted or changed automatically.
5. **Suggested ≠ kept ≠ agreed.** Only "We agree" (or "I've got it" from the person taking it) makes an agreement.
6. **Ownership, not task completion, is the measure.** Readiness comes from family check-ins, never checkboxes. Stages, scores and comparisons between children are never shown.
7. **Privacy by default.**
   - Private calendars stay private.
   - Children's information to any model is minimized.
   - External text is untrusted data.
   - Confirmed facts are kept apart from inferred possibilities.
8. **Two primary destinations:** Today and Family Meeting. Plans, Cleaning, Resources and Account are one tap away. The companion website stays separate.

## 2. Locked visual system

| Element | Rule |
| --- | --- |
| Type | Figtree throughout; the brand wordmark. Near-black text, readable secondary text |
| Surfaces | White backgrounds, one neutral fill. Flat hierarchy, no decorative shadows |
| Actions | Dark brown primary actions. Forest green only for positive states (agreed, done, progress) |
| People | Each family member's saved marker color, unchanged by the month |
| Navigation | Two-tab floating bar (Today, Family Meeting), clear of safe areas |
| Functional icons | Navigation, chevrons, editing controls, checks: **simple, bold, black**, never in a circle |
| Intelligence card | One component, exact palette: background #EDE5DA; eyebrow and icon #655548; heading #151515; body #514843; primary #493F3C; secondary #75695E. About 24px radius, 20px padding, solid, no shadow or border, inline action with →, quiet Dismiss. No other card colors per category |
| **Illustrations (V20)** | The brand's own hand-drawn icons, **charcoal line, white-filled interior, on a solid circle in the printed calendar's palette**. See below |

### Illustration treatment (V20)

- **Source.** The original hand-drawn Organized Mom Collective symbols (`assets/icons/ofc/updatedicons/svg`, traced from the full-resolution drawings). They are not stock, emoji, gradient or AI artwork.
- **Treatment.** `scripts/build-illustrated-badges.mjs` builds `public/assets/icons/ofc/badges/*.png`:
  1. The line is re-colored charcoal (#2E2A28).
  2. Each drawing is fitted to the same visual size.
  3. The interior is filled white by an outside flood fill. Small gaps in the hand-drawn line are bridged, then the outside is grown back to the line so nothing outside turns white.

  The line itself is never redrawn. The tests check that the center of an illustration is opaque white, not transparent line art.
- **Circle.** 40px (32 small, 52 large). The illustration fills 78% of it. Every circle uses a solid color from `monthColors` (src/theme.ts).
- **Color by meaning, the same everywhere** (`src/components/v20/Badge.tsx`):

  | Meaning | Calendar color |
  | --- | --- |
  | School and learning | January frost |
  | Play and sport | May leaf |
  | Home and meals | June apricot |
  | Cleaning | March mint |
  | Family and together | February blush |
  | Care | April lilac |
  | Time and plans | November mushroom |
  | Getting places | August wheat |
  | Seasons and celebration | December evergreen |

- **Where it's used.** Only on activities in What matters, affected agreements in a resolution sheet, and the Family Meeting row. Not on navigation, controls, person avatars, cleaning checklists (the companion's own design) or the intelligence card's eyebrow icon.

## 3. Intelligence architecture (locked)

Deterministic core, optional interpretation, one shared household state.

| Layer | Where | What |
| --- | --- | --- |
| Shared state | `V16State` (+ `intel`) | Calendar (shared/private), parts and agreements, development records, cleaning, the meeting, household memory, feedback, reports, completion history, notification preferences and delivery log |
| Detectors | `src/lib/v18/engine.ts`, `src/lib/v19/engine.ts` | Activity needs (playbooks + memory), open loops, changes since the meeting (cascading consequences), backup, "Something changed?", recurring friction, growing ownership, undated intentions, seasonal transitions, capacity, due-soon nudges |
| Attention | `src/lib/v19/attention.ts` | Gates, three destinations, preparation windows, attention budget, meeting agenda caps |
| Resolution | `src/lib/v19/resolve.ts` | Grounded options applied through existing workflows (edit + We agree, one-week cleaning move, Suggested handoff, family event), plus feedback |
| Notifications | `src/lib/v20/notify.ts` | The same insights, built per recipient, mapped to three purposes with delivery rules |
| Interpretation (optional) | `src/lib/v18/interpret.ts` | The only model seam: ambiguous event titles. Minimized input, strict validation, cached per event. Simulated in the preview |
| Capture (no UI) | `src/lib/v18/capture.ts` | Future newsletters, invitations and voice, as validated candidates |

Every insight carries internal metadata, never shown:
- type, category, evidence;
- events, agreements and members involved;
- confidence, urgency, consequence, relevance, worth;
- earliest and latest useful day, destination, route reason;
- dedupe key and fingerprint;
- expiry and pattern.

## 4. Attention budget (locked defaults)

- **Destinations:**
  - **Today** only when waiting until the meeting would create a problem.
  - **Family Meeting** for friction, ownership, seasons, intentions and preparation whose window opens after it.
  - **Quietly remembered** for the rest.
- **At most one card.** No card when nothing passes the threshold (worth below 0.55, unless urgent).
- **At most one new non-urgent card per household per day.** A dismissal counts, so dismissing never reveals another low-priority card. An unchanged non-urgent insight is a card once, then a quiet line.
- **Urgent items are never held back by a number.** A second urgent issue stays reachable as a quiet line on its activity or part.
- **Meeting caps:** at most one ownership or development item and one routine improvement per meeting.
- **Preparation windows per need** (lunch 0 days … gift 4 … childcare 14). They move with the family's own feedback and one Account choice ("Only when something changes / The usual / Help us get ahead earlier").
- **Feedback:**
  - Dismiss means these facts only.
  - "Already taken care of" resolves it.
  - "Not relevant" turns off the pattern for 60 days, and writes "not needed" memory.
  - "Remind us later" waits until the window.
  - "Don't suggest again" stops the pattern; it can be undone in Account. Calendar changes always still count.

## 5. Notification rules (locked)

**Three purposes only:**

| Purpose | Sent for | Recipient |
| --- | --- | --- |
| **Someone needs you** | A spouse-to-spouse request for a hand (Share the load), or a responsibility offered up without an owner (a handoff) | The person asked, or every other adult for a handoff. Never the person who asked |
| **Something important changed** | An imminent conflict in a plan you own (the same urgent change insight Today shows, built for you, in your words: "Your transportation plan…"), a shared agreement someone else updated today, or a request someone declined | The adult whose plan it is. If it's a child's or nobody's, both adults. Never the person who made the change |
| **Something you were carrying is handled** | Your request was taken ("Luis has it ✓"), or someone took a change you were also told about | Only the person who was carrying it |
| *Family Meeting reminder (optional)* | One hour before a meeting that's on the calendar, with how many things there are to talk about | Adults who turned it on. **Off by default** |

**"I've got it."** One action that confirms ownership and updates the shared plan for both devices:
- **On a request:** it is that person's agreement.
- **On a handoff:** they become the owner and agree.
- **On a conflict:** the change is resolved for the household, and anyone else who'd been told hears "has it ✓".

"Not this time" declines a request; the person who asked hears it still needs someone.

**Delivery rules, in order:**
1. The purpose is turned off → not sent.
2. Already delivered (dedupe key = kind + subject + facts + recipient, shared across devices) → never alerts twice.
3. Quiet hours (default 9 PM–7 AM, per adult) → held until morning, never dropped.
4. More than **4** non-urgent alerts that day → delivered without sound.
5. Otherwise delivered. Urgent notices are never held by a count.

**Never pushed:**
- routine chore or cleaning reminders;
- intelligence suggestions (preparation, opportunities, friction, ownership, seasons, capacity);
- generic AI advice;
- completion notices to anyone who wasn't carrying the thing;
- anything to the person who caused it;
- anything grounded in someone else's private calendar.

There are no messaging threads. Notification settings live in **Account → Notifications**: three purposes (on), the meeting reminder (off) and quiet hours. There is no screen beyond that.

## 6. What's real and what's simulated in V20

| Real (rules and engines) | Simulated (preview only) |
| --- | --- |
| Every notification: who gets it, its words, its status (delivered, held, scheduled, silent, off), dedupe, quiet hours, preferences, "I've got it" / "Not this time" and their effect on the shared plan | **Delivery.** Two lock screens in the striped preview controls stand in for two iPhones. Both read and write one browser's state, which is what shared state + push would do |
| The illustration treatment (generated from the original artwork) | The 26 scenarios' facts (V19's 21 + 5 notification states), the demo clock, the pinned Thursday, and the event interpreter |

## 7. Production requirements (next phase; nothing built or migrated)

**Shared household state** (Supabase, RLS by household membership, per-device sync). Tables:
- `household_insight_feedback`
- `household_reports`
- `part_completion_history`
- `household_insight_shown`
- `household_insight_claims`
- `household_notification_prefs` (per adult)
- `household_notification_log` (dedupe key, recipient, delivered or held state)

Parts also gain the columns `onDate`, `askedBy`, `lastChangedBy`, `lastChangedOn` and `need` on agreements and event responsibilities.

**Push delivery:**
- **APNs** for the iPhone app (Capacitor `@capacitor/push-notifications`), with device tokens per adult.
- An actionable category `HELP` with "I've got it" and "Not this time", handled in the background via an authenticated call that runs the same `gotIt` / `notTonight` rules server-side.
- Optional Web Push for the PWA later.

**Evaluation:**
- **Event-driven.** Run when an agreement, calendar feed, report or completion changes, through a Supabase Edge Function running `outbox()` for the affected household.
- **Scheduled.** A cron pass every 15 minutes for held and scheduled notices: quiet-hour release and meeting reminders.
- **Never** a per-open model call.

**Privacy:**
- The server builds insights per recipient, exactly as the preview does.
- Private-calendar facts never leave their owner.
- Notification text contains no private event titles.
- The lock-screen preview setting is respected.

**Real interpretation:** only behind `interpret.ts`'s contract, after the vendor and children's-data review in V18 §3. Expected cost is about $16 per 10,000 households a month on Haiku-class models.

**Native iOS testing:**
- safe areas, Safari chrome and the standalone PWA;
- notification permission timing (ask after the first real handoff, never on launch);
- actionable notifications from the lock screen.

**Family testing:** measure fewer reminders a parent has to send, not engagement.

## 8. Tests

| Suite | Result |
| --- | --- |
| `tests/v20-notify.test.ts` | **20/20**, below |
| `scripts/e2e/v20-baseline.mjs` | **38/38**, below |
| Regression | V19 (88 unit, 120 e2e), V18 (44, 96), V16/V17 flows (84 + 84), V17 polish (111), `tests/v16-model.test.ts` (28), `astro check`. Results are in the PR |

`tests/v20-notify.test.ts` covers:
- only three purposes, and nothing for suggestions, chores, cleaning or prep;
- targeting, never the actor;
- the "I've got it" round trip on both devices;
- decline, handoff, conflict in the recipient's words, and conflict claimed;
- agreement updated (including from a resolution sheet);
- the private call never reaching Luis;
- dedupe, quiet hours, preferences, the meeting reminder opt-in, and the daily budget never holding urgent notices;
- the engine never mutating state;
- badges generated from the original SVGs with palette colors by meaning.

`scripts/e2e/v20-baseline.mjs` covers:
- V19 intact inside V20;
- a white interior measured on screen, calendar circles, black navigation, the card palette;
- the illustrated sheet and meeting row;
- both phones: help → I've got it → handled, conflict → claimed, quiet hours, agreement changed, nothing pushed for prep;
- Account settings;
- nav clearance at 375, 390 and 430;
- V16–V19 state untouched.

Screenshots: `docs/ios/screenshots/v20/`.

## 9. Known limitations carried into production work

- Chromium only so far. Native iOS and the PWA are the next phase.
- Single browser. Every shared-state behavior is proven by the rules, not by two real devices.
- Cascades only see agreements with a clock time in their cue. Travel time is a fixed 30-minute margin.
- 23 illustrations are generated. Activities outside their vocabulary fall back to the calendar illustration.
- Notification copy is template-based and needs an editorial pass with real family situations.
