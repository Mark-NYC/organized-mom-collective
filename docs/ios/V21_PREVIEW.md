# Organized Family V21: preview for review (2026-11-27)

V21 refines the V20 production app around one job: **sharing responsibility**. The measure is how much less a parent has to remember, delegate, remind and follow up on.

| | |
| --- | --- |
| **Preview** | `/preview/organized-family-v21`. Unlinked, `noindex`, no analytics, no service worker, not in the sitemap |
| **Production** | `/app` is unchanged. Nothing here merges or deploys over it until the owner approves this preview |
| **Data** | A fictional household (Meg, Mark, Andrew 8, Philip 6) in this browser only (`omc:v21-preview:v1`) |

The household's calendar is held exactly as production holds a real household's calendar (`live: true`, `extraEvents`), so the preview runs the production code path, not the Rivera demo week.

Reviewer tools sit outside the phone frame and are not product UI:
- the Meg / Mark switch (both phones share one household state, as two real devices would);
- the 16 scenarios;
- **Reset demo**;
- the widget-state concept.

## 1. V20 inventory: what happens to each capability

Nothing working is removed. One V20 behavior is repositioned in a way that needs explicit approval; it is flagged in the table and repeated in §6.

### Today

| V20 capability | In V21 | How |
| --- | --- | --- |
| Short headline and subline | **Refined** | Now personal to each adult: "Meg needs a hand.", "Friday pickup needs a plan.", "Nothing needs you today." |
| "Something changed?" (reports → keep today simple) | **Preserved** | A quiet link under What matters. The same sheet and engine. |
| Heads-up card for a real calendar change (cascading consequences) or a reported day | **Preserved** | Shown in What matters with its V20 resolve sheet. |
| Backup card ("you could use some backup") | **Refined** | Replaced by one conflict card, shown only to the owner of the affected responsibility, with "Ask Meg" and "I'll handle it". This removes the duplicate card. |
| Automatic preparation cards from event types (birthday → RSVP, gift, card, ride; field trip → lunch) | **⚠ Repositioned: needs approval** | No longer surfaces on its own. Each event in Our week offers an optional "Plan something" with contextual options and "Nothing needed". Once the family chooses, the preparation appears on the right day. |
| Open loops, recurring friction, growing ownership, intentions, seasons | **Preserved** | Still routed to the Family Meeting agenda, unchanged (`AgendaV19` in Let's Talk). |
| What matters: the family's focus (notes and chosen activities) | **Preserved** | Shown as quiet awareness rows. They don't count as "needs your attention". |
| Preparation lines under activities, with a shared done check | **Repositioned** | Shown in Today's plan on the day they're due, with owner and check. Our week shows the choice under the event. |
| "Earlier this week (n)" | **Repositioned** | Today looks forward. Earlier days remain in Plans. |
| Everyone's part (top three plus "see others"; backup lines) | **Refined** | Dated items moved to Today's plan. Standing agreements sit in a collapsed "Our family agreements" row with routine cards, edits and "What we've decided". |
| Family Meeting row (resume, next meeting, things to talk about) | **Preserved** | Plus a "Start your first Family Meeting" state for a new household. |
| Plans, Cleaning, Resources shortcuts | **Preserved** | Unchanged destinations. |
| One canonical cleaning check (zone tasks) | **Preserved** | A cleaning-linked item in Today's plan uses the same check key as the Cleaning screen. |

### Everything else

| V20 capability | In V21 | How |
| --- | --- | --- |
| Family Meeting (Our Focus → Let's Talk → Everyone's Part → Let's Practice, resume, week-four check-in, "We have a plan") | **Preserved** | Let's Talk adds "Since last time" (§3.7). |
| Agreements: Keep / Change / Skip / We agree, "changed → agree again", offline pending | **Preserved** | The same reducer (`partReducer`). |
| Development records and Let's Practice (Club) | **Preserved** | A routine the family chose to practice shows on Today as encouragement, never as a check. |
| Plans (calendar, connected calendars, private ones), Cleaning, Resources, Account | **Preserved** | The same screens, reused as they are. |
| Notifications (purposes, quiet hours, I've got it / Not this time) | **Preserved in production; preview unchanged** | V21 requests map onto V20's existing "help" notification at production integration (§5). |
| Two-tab navigation (Today, Family Meeting) | **Preserved** | Docked at the bottom, as in the approved screenshots. |

## 2. Visual

- **Black text.** Solid black (`#000`) for all text in the light interface: headings, descriptions, dates, owner chips and button text. Hierarchy comes from size, weight and space, never from fading. The only exceptions are white text on the black primary button, the brand wordmark's "family." and the active tab's icon.
- **Cards.** The light brown card keeps the approved V20 palette (`#EDE5DA`).
- **Icons.** The hand-drawn badges stay on their calendar-color circles. Owner chips are a soft tint of each person's own calendar color.
- **Restraint.** No new cards, borders or badges beyond the screenshots: one card per decision, plain rows for everything else.
- **Code.** Scoped to `.v21` in `src/styles/v21.css`, so `/app` and the earlier previews don't change.

## 3. How it works (`src/lib/v21/`, all pure and tested)

### 3.1 Three layers on Today (`today.ts` `buildTodayV21`)

**What matters** is only what needs this adult:
- requests to them;
- a conflict in their own responsibility;
- a decision made each time that has no owner yet;
- a declined request;
- an agreement someone else changed;
- once, the confirmation that someone took what they asked for.

A request they're waiting on shows as a quiet row ("Waiting for Mark") that doesn't count as attention. When nothing needs them, the screen says so and stops there.

**Today's plan** shows every agreed responsibility due today, with its owner and a done check:
- one-time commitments, like "Pick up groceries" agreed at Sunday's meeting;
- weekly responsibilities, like Thursday trash;
- preparation for an event;
- accepted handoffs.

Your own items come first, with **Mine** and **Everyone** filters. "Tonight · 8:00 PM" marks a time-sensitive weekly item. A quiet What matters never means an empty Today.

**Everyone's part** holds habits like "Andrew · Clean my floor · After I get dressed". They never become a parent's daily checklist, and a parent can't check them off for a child. There's no "missed" state, because no box was checked.

### 3.2 Events never create obligations (`model.ts` intents)

- Every event in Our week offers a quiet **Plan something**, with options that fit the event plus **Nothing needed**:
  - **birthday:** send a text, mail a card, get a gift, go to the party;
  - **school:** who's going, a ride, clothes the night before;
  - **appointment:** who's taking them, paperwork;
  - **holiday, sports, travel:** their own options.
- Families never have to classify an event or dismiss a suggestion.
- Choosing an option for yourself or a child creates one agreed, one-time part on the lead day.
- Choosing it for the other adult sends a **request** instead, so nothing transfers until they accept.
- Real conflicts and established responsibilities still surface on their own.

### 3.3 The handoff (`model.ts` `askHelp` / `answer` / `acknowledge` / `takeIt`)

**Asking.** You can ask from a commitment (Ask for a hand), from a decision that needs an owner (Make a plan) or from a conflict (Ask Meg). Asking never moves responsibility.

**For a weekly responsibility you choose the scope:**
- **"Just Friday"** covers that one date. The standing owner is unchanged, and the plan says "Covering for Meg".
- **"From now on"** is a separate, explicit transfer.

**Answering:**
- Only the person asked can answer.
- **I've got it** moves ownership to them, confirms to the asker, clears the decision and puts it in their plan. Completion is a separate check.
- **Not this time** changes nothing. The asker sees "still needs a plan", or "It's still yours" if it was theirs. The person who declined isn't asked again on Today.

**Idempotency:**
- Answering twice, or answering from the widget and the app, applies once.
- Asking again while a request is open adds nothing.
- The asker can take a request back while it's open.

**Confirmation:** one card ("Mark has it") with OK and an optional **Make Mark the usual**. After OK it leaves priorities and stays in the plan.

**Syncing between two devices:**
- Requests, intents, decisions and completion live in the household intelligence document, keyed by id.
- The existing three-way merge (`src/lib/v20/intel-sync.ts`) combines both adults' changes per key.
- A unit test confirms that Mark's accept and Meg's concurrent edit merge without a duplicate.

### 3.4 Household memory (`model.ts` decisions)

V21 keeps four kinds of decision separate:
- **one-time commitment:** a one-time part;
- **standing responsibility:** an agreed part;
- **remembered preference:** "We usually send Johan a birthday text";
- **decision made each time:** "We decide Friday pickup each week".

Rules:
- Preferences are optional ("Remember this for next time", off by default), and are listed under **What we've decided** in Everyone's part, where they can be edited and forgotten.
- A preference informs the suggestion ("Usually: send Johan a birthday text · Plan it") and never creates the part by itself.
- One-time actions never become standing without an explicit **Make it the usual**.

### 3.5 Routine cards (`components/v21/RoutineCard.tsx`)

- **Where.** **Create routine card** appears on routines and cleaning responsibilities in Everyone's part.
- **Prefilled from the agreement.** Example: "Andrew's floor routine", When "After I get dressed.", What, and "I'm done when" from the agreed finish line.
- **Editable:** who (any child, adult or Together for a shared cleaning zone), title, when, what, done, picture and colors.
- **Built from the existing printable system:**
  - the brand's responsibility illustrations on their fixed category circles;
  - the three tool palettes;
  - Kalam heading with a highlighter swipe;
  - white paper and warm charcoal text, per `TOOL-OUTPUT-DESIGN.md`.
- **Saved** with the agreement (`intel.cards`). There's no separate printable store.
- **Prints** one full US Letter page from the browser's print dialog. It is not a card-sized cutout, per the rule on the physical responsibility cards.

### 3.6 Widget state (`today.ts` `widgetFor`)

A future native Home Screen widget can read one item per adult, in this order:
1. a request (with **I've got it** / **Not this time**);
2. a change;
3. a decision;
4. a confirmed handoff;
5. "waiting";
6. quiet ("Nothing needs you").

It includes a count of other items (`+2`). The widget's buttons would call the same `answer()`. The preview shows this state under the phone, labelled "concept, not built". There is no widget in the website or PWA.

### 3.7 Family Meeting continuity (`today.ts` `carryForward`, `components/v21/CarryForward.tsx`)

**Let's Talk** opens with **Since last time**, one item at a time:
- a declined request that still needs someone: "Meg will" / "Mark will", decided at the table;
- a decision made each time that's coming up: "Mark, from now on" / "Keep deciding each week";
- a request nobody has answered.

Standing agreements are not reviewed one by one; they stay in Everyone's part.

**First meeting.** A first-time household's Today points to the first meeting. The meeting's existing prepared suggestions (the Club month's) make it useful without setup, and Today has a plan as soon as it ends.

## 4. Tests

| Suite | Result |
| --- | --- |
| `tests/v21.test.ts`: all sixteen scenarios, permissions, idempotency, two-device merge, scope of a handoff, memory, continuity | **36 / 36** |
| Full unit suite | **1,728 passed** (107 skipped as before) |
| `astro check` | **0 errors, 0 warnings** |
| Production build | **OK**. The V21 preview is not in the sitemap |
| `scripts/e2e/v21-preview.mjs`: the sixteen scenarios through the interface, as both adults, plus print, black text on Today, Meeting, Account, Plans and Cleaning, 44px answers, two tabs, no horizontal scroll at 375 / 390 / 430, V20 preview storage untouched, no page errors | **70 / 70** |
| V20 / V19 / V18 / V16 previews | **38 / 38, 120 / 120, 96 / 96, 84 / 84** |
| `scripts/e2e/v20-live-e2e.mjs`: production `/app` on the isolated test backend | **27 / 27** |
| `scripts/e2e/family-e2e.mjs` (web) | **Passed** |

Screenshots are in `docs/ios/screenshots/v21/`.

## 5. Limitations and what production integration will need (after approval)

- **Storage.** No new tables are needed. Requests, intents, decisions, completions, covers, cards and seen-markers go in `household_intelligence` (one document per household, revision-checked, merged per key).
- **Agreement writes.** An accepted handoff or a chosen preparation must be written to the agreements store. `src/lib/v20/live.ts` `writesFor` needs:
  - `agreement-save` with the new owner;
  - `task-save` for event preparation.
- **Notifications.** A request maps onto V20's existing "help" notification (`notify.ts`). "Not this time" and "Mark has it" map onto the existing reply and "handled" purposes. No new notification types are needed.
- **Completion for weekly agreements** is per date in V21 (`intel.done`). Production agreements have no per-date completion today, so this is part of the document.
- **Widget.** No native widget exists. It needs WidgetKit, an App Group, and an AppIntent that calls the same answer rule through the household API.
- **Each-time decisions** ("we decide Friday pickup each week") are seeded in the preview. In production a family would make one from a declined or answered request ("Keep deciding each week"). The creation path from an event in Plans is not built yet.
- **Requests go between adults only.** Children own agreements, not requests.
- **Printing** uses the browser's print dialog ("Save as PDF" on phones), like the Club printables.

## 6. Needs owner approval

1. **The V21 preview as a whole**, before anything changes at `/app`.
2. **Repositioning V20's automatic event-preparation cards** (birthday → RSVP, gift and card; field trip → lunch) from Today into the optional "Plan something" on each event. This is the brief's direction, but it removes a working V20 behavior from Today. Conflicts, calendar changes, established responsibilities and the meeting agenda still surface on their own.
3. **The docked tab bar**, as in the screenshots, in place of V20's floating two-tab bar. The tabs themselves are unchanged.
4. **Routine cards print as full-page signs**, not card-sized cutouts, to keep the rule that protects the physical responsibility cards.
