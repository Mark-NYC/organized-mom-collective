# Organized Family V19: maximum intelligence, minimum interruption

**Status:** experiment for the owner's review.
- **Not done:** no merge, no deploy over `/app`, no production data, no migrations.
- **Preview:** `/preview/organized-family-v19`. It is unlinked and `noindex`, with no analytics and no service worker, and runs on the fictional Rivera household.
- **Scope:** built on V18, covering Today plus the meeting agenda in Let's Talk. Everything else is V17/V18, unchanged.
- **Comparison:** V16, V17 and V18 stay as they were, each with its own demo state.

## 1. Audit: what V18 already had

| Area | V18 state | V19 |
| --- | --- | --- |
| Today engine (`src/lib/v18/engine.ts`) | Detectors, ranking, one card, suppression by fingerprint | **Extended, not forked.** Its detectors, helpers and state are reused by `src/lib/v19/`. Its default behavior is unchanged (the V18 tests still pass) |
| Calendar integration / curation | Shared-only plan, private calendars filtered (`eventsFor`, `sharedOccurrences`) | Reused. Ranges beyond this week were added for preparation windows and seasons |
| Event change detection | Baseline diff since the last meeting | Extended into **cascading consequences**: every affected agreement, one insight |
| Preparation recommendations | Playbooks + memory + development-grounded owners, 3-day horizon | Reused with a 14-day horizon. **Per-need useful windows**. Independent needs are quietly remembered |
| Family Meeting engine | Talk questions, ideas, agreements | Let's Talk gets the **agenda** in the same light brown card, one at a time |
| Agreements | Keep / Change / Skip / We agree, signatures, re-agree on change | Reused for every resolution. One-time parts (`onDate`) and handoffs (`askedBy`) added |
| Development engine / MAWL | Records, check-in signals, stages never shown | Ownership is read only from `ownership` check-ins, never from completion checkboxes |
| Cleaning companion | One check per task, one-week moves | Reused: "move this week's session" is `moveSession` |
| Household memory | Confirmed / inferred (3+), correctable | Reused. "Not relevant" writes confirmed *not needed* memory |
| Completion history | Observations of done, need-linked parts | Added: late or moved history per standing part (recurring friction) |
| Ranking and suppression | One score, venue today/meeting, dismissed/handled/topic | Replaced by **three destinations + gates + an attention budget** (`attention.ts`) |
| Dismissal and resolution | Dismiss (fingerprint), Already handled, Bring it up | Plain Dismiss plus optional feedback: handled, not relevant, later, never |
| Household permissions | Private calendars never shared, viewer relevance | `privateTo`: an insight grounded in someone's private calendar is only ever theirs |
| AI infrastructure | None in the repo. A validated interpreter seam with a simulated interpreter | Unchanged. **V19 adds no model calls** |

## 2. What genuinely improved

- **Headlines** are 2–6 words, drawn from a short list:
  - You're on track.
  - A change of plans.
  - A few things need attention.
  - A little preparation will help.
  - A little backup will help.
  - Tomorrow's a busy one.
  - A lighter day.
  - All set for today.
  - Pick up where you left off.
  - Here's today. (neutral, when there isn't enough data)

  The subline only appears with no card, and only when it adds something.
- **The card explains the implication; it doesn't repeat the headline.** For example: "Soccer starts an hour earlier." / "Practice now starts when school ends. Luis's transportation plan needs adjusting." / *Adjust the plan →*.
- **Resolution (Level 3).** One sheet isolates each affected agreement:
  - its question ("How will Sofia get to soccer?");
  - the facts;
  - the current agreement and its planned departure;
  - grounded options.

  What's already done appears only as reassurance ("Sofia's soccer bag is already packed ✓"). Nothing changes until **Update our plan**, which goes through the existing agreement edit and *We agree*.
  - **Options are generated from known facts only.** The current owner can pick up at school "only if they can be there by 3"; the coach can be told; or the family makes another plan. No adult is assumed to be free because their calendar is empty.
- **What matters, ordered for today:**
  1. unresolved and time-sensitive;
  2. today;
  3. coming up and needing preparation;
  4. other priorities;
  5. earlier this week, behind "Earlier this week (n) ⌄".

  Completed preparation is shown muted. Every agreed priority stays reachable, and so does "Our week".
- **New intelligence:**

  | Capability | What it does |
  | --- | --- |
  | Cascading consequences | One change, every affected agreement, one insight ("Thursday needs a little reshuffling.") |
  | Backup | From a known commitment (including the person's own private calendar, shown to them only) or a reported one. "Ask Luis" creates a Suggested handoff that Luis answers himself |
  | Something changed? | A quiet link, not a card. Sick, behind, work late, lighter day or something else leads to one "Keep today simple." plan, covering flexible things only |
  | Recurring friction | Three late or moved occurrences in a row, routed to the meeting |
  | Undated intentions | The family's own ideas from Let's Talk, matched to a real open weekend morning, offered and never booked |
  | Seasonal transitions | Only from events on the family's calendar, routed to the meeting before the planning window |
  | Growing ownership | Three or more family check-ins about ownership, routed to the meeting. No scores, stages or comparisons |
  | Gentle due-soon nudge | An agreed gift or RSVP due tomorrow and not marked done, shown to its owner only |

## 3. Attention routing and timing (`src/lib/v19/attention.ts`)

**Three destinations:**

| Destination | When |
| --- | --- |
| **today** | Waiting until the meeting would create a problem: a change that breaks a plan, backup tonight, preparation in its useful window before the next meeting |
| **meeting** | Worth discussing together: friction, ownership, seasons, intentions after the meeting, preparation whose useful window opens after the meeting |
| **remembered** | Too early with no meeting in time, a need the family handles on its own, or over the meeting's caps |

**Gates, in order.** An insight is stopped if any of these apply:
1. It's private to another adult.
2. It has expired.
3. It's already handled.
4. It was already talked about.
5. It's postponed ("later" until a date).
6. Its pattern was turned off with "never". Calendar changes always count anyway.
7. It was marked not relevant (for 60 days).
8. It's unreliable (confidence below 0.6).
9. It's too early, or better for the meeting.
10. The viewer can't act on it.
11. It was already seen (an unchanged, non-urgent insight is a card once, then a quiet line).
12. Over budget.
13. Below the threshold (worth below 0.55).

**Worth** = 0.35·urgency + 0.25·consequence + 0.2·confidence + 0.2·relevance.

**Preparation windows** (days before a need is due when acting becomes useful):

| Need | Lunch | Gear | Outfit | Pickup | Card | Ride | RSVP | Gift | Childcare |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Window (days) | 0 | 0 | 1 | 1 | 2 | 2 | 3 | 4 | 14 |

The family moves these windows:
- "Already handled" twice for a need closes its window.
- Accepting help twice opens it two days earlier.
- The Account choice "How much should Today bring up?" (only when something changes / the usual / help us get ahead earlier) wins.

**Before the window opens:**
- If a meeting falls before the deadline, the insight goes to that meeting (the next-Saturday party is discussed Sunday).
- Otherwise it is remembered until the window opens.

**The intended week, tested.** The Sunday meeting agrees on gift, card, RSVP and ride.

| Day | What Today does |
| --- | --- |
| Monday, Tuesday | Nothing |
| Wednesday | The gift is due tomorrow and not done: a gentle heads-up to **Luis only** |
| Thursday | Gift done: quiet |
| Saturday | Ready: quiet |

**Attention budget:**
- At most one card.
- At most one *new* non-urgent card per household per day. A dismissal counts, so dismissing never reveals another low-priority card.
- Urgent items are never held back by a number. A second urgent issue stays reachable as a tappable line under its activity or part.
- At most one ownership item and one routine improvement per meeting.
- No notifications were added.

## 4. Learning from feedback (`src/lib/v19/resolve.ts`)

| Response | Effect |
| --- | --- |
| Dismiss (one tap) | Hidden for *these facts* (fingerprint). New facts bring it back. The quiet line stays |
| Already taken care of | Resolved everywhere. Twice for the same need → that need's window closes |
| Not relevant to our family | Suppresses that pattern for 60 days. For activity needs, writes confirmed "not needed" memory (correctable) |
| Remind us later | Hidden until its useful window, or tomorrow |
| Don't suggest this again | That pattern stops (listed in Account with **Undo**). Calendar changes are never suppressed |
| Update our plan / Suggest it | Resolved. Accepting help is recorded and moves windows earlier over time |
| Talked about it (meeting) | Leaves the agenda |

The feedback menu is optional: it appears in a "Dismissed · Tell us more" line after a Dismiss.

## 5. What remains simulated

- **The facts in the 21 scenarios.** They are chosen in the striped "Preview controls · simulated data" bar, outside the product: the moved practice, Ana's private call, three late Wednesdays, four ownership check-ins, Winter break on the calendar, and so on. The engine computes everything else.
- **The event interpreter** (V18's seam): a fixed answer for the demo party, labeled as simulated.
- **The demo day:** "Today" is pinned to Thursday.
- **History and reports.** Completion history (late or moved) and reports live in this browser only. There's no capture of real completion times yet.

## 6. AI cost

**V19 adds no model calls.** Every V19 capability is deterministic, including cascades, options, routing, timing, friction, ownership and seasons. The only possible model use is still V18's interpreter for ambiguous event titles: about 2–8 calls per household per month, cached per event.

| Model | Per household per month | Per 10,000 households per month |
| --- | --- | --- |
| Haiku 5.5 | under $0.002 | ~$16 |
| Opus 5.5 | ~$0.06 | ~$620 |

**Candidates for AI later (not built), each behind the same validated seam:**

| Use | Approximate volume | Haiku 5.5 per 10,000 households/month | Notes |
| --- | --- | --- | --- |
| Resolution phrasing for unusual cases | ≤ 1 per change | ~$5–20 | Must choose only from validated options |
| Reading captured school newsletters | ~4 per month | ~$10 | Uses `src/lib/v18/capture.ts` |

**Never** send a daily briefing prompt with the whole household. Prices are from the Claude API reference; verify them before committing.

## 7. Tests

| Suite | Result |
| --- | --- |
| `tests/v19-attention.test.ts` | **88/88**, below |
| `scripts/e2e/v19-today.mjs` | **120/120**, below |
| Regression | `tests/v18-intelligence.test.ts` 44/44 · `tests/v16-model.test.ts` 28/28 · V18 e2e · V16/V17 flows · V17 polish · `astro check`. Results are in the PR |

`tests/v19-attention.test.ts` covers:
- all 21 scenarios: headline, card, a headline of six words or fewer, and no subline repeating the card;
- isolated resolution and reassurance, and options that never assume an adult;
- cascade consolidation;
- nothing changing before Update, edit + re-agree, the one-week cleaning move, the handoff becoming the other adult's loose end;
- Luis never seeing Ana's private call;
- the lighter-day and sick paths;
- friction needing three occurrences;
- ownership only from ownership check-ins;
- seasons only from the calendar;
- meeting before the window, and agenda caps;
- intentions offered and never booked;
- **the Monday–Saturday rhythm**;
- the budget: no replacement after a dismiss, seen-once, independent needs remembered, urgent issues stay reachable;
- feedback kinds and window adaptation;
- What matters ordering, and every priority staying reachable;
- the engine never mutating state;
- stale data, V18 unchanged, and AI failure.

`scripts/e2e/v19-today.mjs` covers:
- all 21 scenarios;
- the exact palette;
- the Adjust the plan flow end to end;
- the cascade (three agreements in one sheet, plus "finish it together");
- backup → Luis answers → agreed, with no private details shown to Luis;
- Something changed? → Keep today simple;
- Dismiss → Tell us more → Don't suggest → Account **Undo**;
- the Let's Talk agenda card and "Talked about it";
- Earlier this week;
- nav clearance and sheet reachability at 375, 390 and 430;
- V16/V17/V18 state untouched, and no page errors.

Screenshots: `docs/ios/screenshots/v19/`.

## 8. Limitations

- Chromium only. Safari browser chrome and the installed iPhone PWA still need a device pass. The layout uses the same safe-area and tab-bar rules V17's checks cover.
- Single device. Feedback, reports, history, shown and talked records need the backend tables below, per household with RLS, before two phones can share them:
  - `household_insight_feedback`
  - `household_reports`
  - `part_completion_history`
  - `household_insight_shown`

  Nothing was migrated.
- Cascades only see agreements with a clock time in their cue ("Leave at 3:40 PM"). Travel time is a fixed 30-minute margin.
- Backup only sees the person's own calendar and reports. It does not know about anyone's energy, health or relationship, by design.
- Options are templates for the common cases (rides, dinner, a cleaning zone, a handoff). Unusual activities get "Make another plan".
- Seasons are only read from events already on the calendar. The school calendar feeds would need to carry breaks.

## 9. Recommended to defer

- **Push notifications.** Opt-in only, and only after the attention budget has proven itself in use.
- **Automatic contact** (texting a coach or another parent). Never without an explicit, per-message choice.
- **An LLM for options or patterns.** The deterministic options cover the common cases. Add a model only where real families hit "Make another plan" often, and measure that first.
- **An intentions list or goals screen.** Ideas live in Let's Talk. Revisit only if families ask to see them all.
- **Capacity scoring beyond the calendar** (energy, sleep, moods). Unsupported and invasive.
- **Learning assistance level automatically from engagement.** Use only the explicit signals: handled, accepted, and the Account choice.
