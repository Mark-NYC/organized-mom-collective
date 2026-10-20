# Brief: FP-18 weekly-vs-monthly-wall-calendar

- **Pillar:** Family Planning & Routines (pillar guide? no)
- **URL:** /resources/weekly-vs-monthly-wall-calendar
- **Researched:** 2026-10-20
- **ID note:** Requested as FP-16, but FP-16 is the published `free-weekly-family-planner-printable` (its pins and tracker row use the ID) and FP-17 is the published Skylight comparison. Filed as FP-18.
- **Decision:** a monthly wall calendar, a weekly one, or both. Buyer is a mom choosing the family's wall calendar format for 2027.

## Search intent (Google)

Primary query: *weekly vs monthly calendar*. Validation query: *weekly family calendar vs monthly*. Also checked: *weekly vs monthly wall calendar for family*. Intent type: comparison / format decision. In one sentence: which view will actually keep a busy family's week straight, and is the month enough?

Secondary keywords: weekly family calendar vs monthly; monthly vs weekly wall calendar; weekly wall calendar for family; monthly family calendar; weekly or monthly planner.

Related questions (from result titles; no "People also ask" box shown to the search tool): monthly vs weekly vs daily planning; do you need both a weekly and monthly calendar; which calendar format is best for kids' activities.

## What currently ranks

Live searches 2026-10-20 (WebSearch, standard mode):

| Query | What ranks |
| --- | --- |
| weekly vs monthly calendar | Do2Learn job-skills pages on weekly and monthly schedules (static.do2learn.com, do2learn.com); Tim van de Vall "Monthly vs Weekly vs Daily Planning" (calendars.timvandevall.com, a printable-calendar seller); planner shop collections; off-topic enterprise docs |
| weekly family calendar vs monthly | A podcast episode listing on a weekly family calendar system (audible); andreadekker.com; a 2017 HomeAdvisor page; keyword-stuffed filler on hijacked domains (certtest.bart.gov, cache.studiobinder.com) |
| weekly vs monthly wall calendar for family | Hearth Display blog (sells a digital display); designertrapped.com family calendar ideas; Lazada stationery guide; theeverymom.com planner roundups; filler pages |

**Dominant format:** general planning guides written for individuals or work, display-seller blogs, filler. **Table stakes:** month = big picture and fixed dates; week = day-to-day detail; many suggest both.

**Gaps:** nothing shows a real family week in both formats, so a reader can't see what doesn't fit in a month square. Nobody says when monthly alone is enough, or how to run both without double work.

## Differentiation

- **The worked example:** one realistic week (school, soccer twice, piano, a Thursday dentist visit, dinners) written as a month square vs. a week column. The difference is visible, not argued.
- **Format cards in the FP-15 design** (`<ProductSnapshot>`, green ticks and red crosses): monthly (our free monthly maker's real output as the example) vs. weekly (our calendar, featured, with its honest cons).
- **The Shift (folded into the answer, no separate component):** a month shows *when*; a week shows *who, what time and what's for dinner*.

## Structure (interactive guide layout)

1. Frontmatter: `quick` time "1 week" note "to test it"; jump to the StepChecklist. No hero (no cleared, source-unique lifestyle photo; not forced).
2. Tension: Thursday's square says "Dentist." It doesn't say what time, who's driving, or that soccer is the same night.
3. First H2: "Should a family use a weekly or monthly wall calendar?" Short answer ≤ 100 words: monthly for seeing far ahead with light weeks; weekly for daily logistics, meals and jobs; monthly is enough when weeks are steady; both = month for dates, week for the plan.
4. `<StepChecklist>` "Find your format in one week": list this month's dates, count this week's moving parts, write Thursday in a month square, see what fell off, pick.
5. H2 "One week, two calendars": 2-column table, Thursday as a month square vs. as a week column; one line on what to notice.
6. H2 "Monthly vs. weekly at a glance": two `ProductSnapshot` cards. Monthly: example = our free monthly maker (`/try-the-calendar`), described only as the code does it. Weekly: our calendar (`ours`), pros from the verified product list, cons kept (no month view, no column per person). No prices in cards; prices only in the ProductCTA.
7. `<WhenLifeHappens>`: month full but nobody knows the plan; weekly page stale by Wednesday; running both feels like double work.
8. "Make it part of your week": FP-02 (set up the calendar), FP-04 (weekly reset, where the copy-over happens), FP-16 (free weekly page).
9. `<ProductCTA>` (calendar): weekly, 11 × 17, one week per page; prices from `CALENDAR_OPTIONS`; no month view.
10. Next Small Win: tonight, write tomorrow on a sticky note the size of a month square. Whatever doesn't fit is your answer.

## Free monthly maker: verified against the code (`src/pages/try-the-calendar.astro`)

- Free, filled in on screen, downloads as a PNG (US Letter portrait). Not the printed calendar.
- One row per family member (five), one activity shown per person per day.
- Activities are added once as repeating rules (every Tuesday, or a date that repeats).
- Header boxes: "Big Things / Deadlines" and "Word of the Month". Autosaves in the browser.
- Has "Fill in an example month". The article screenshot is that example (October 2026), captured from a local build.

## Internal links

- Parent: FP-01 (body, first half)
- Siblings: FP-02 (body + `next`), FP-04 weekly reset (body), FP-16 free weekly planner printable (body), FP-15 best family wall calendars (body: "which one to buy")
- Tools: `/try-the-calendar`, `/planner`
- Incoming to add: FP-02 (required), FP-01 (child link), FP-15 (format question)
- Bridge: none

## Product CTA

`calendar`: ARTICLE_FORMAT.md → Product notes (11 × 17 portrait, one week per page; daily schedule column per day, cleaning zone, meal plan, grocery list, to-do list, notes; gratitude, family and friends, self-care habits) and `src/config.ts` (prices imported). It's weekly only: no month view. Doesn't sync.

## Overlap check

Published articles reviewed (frontmatter, headings, body grep for "month"/"week view"):

| Article | What it owns | FP-18 boundary |
| --- | --- | --- |
| FP-02 `how-to-organize-a-family-calendar` | Setting up and using a family calendar: one shared reference, entry format, what goes on it, the daily look. "Calendar format" in CONTENT_CLUSTERS means paper vs. digital and entry format; it never compares week and month views | FP-18 owns the week-vs-month *view* decision only. It doesn't teach entry format or setup; links to FP-02 as `next`. FP-02 gets an incoming link. |
| FP-01 `how-to-organize-your-familys-week` | The whole weekly system: calendar, reset, meals, cleaning | FP-18 doesn't re-teach the system; links up to it once. |
| FP-11 `wall-calendar-vs-digital-calendar-for-families` | Paper vs. digital | FP-18 assumes paper on the wall; no digital comparison. |
| FP-15 `best-family-wall-calendars` | Which product to buy | FP-18 compares formats, names no competitor product; links to FP-15 for buying. |
| FP-16 `free-weekly-family-planner-printable` | The free weekly printable | Linked as the free way to try weekly. |

Primary keyword *weekly vs monthly calendar* is unique in the library. **Decision: distinct intent, proceed.**

## Claim log

| Claim | Source | Date | Tested or documented | Status |
| --- | --- | --- | --- | --- |
| Monthly maker features | `src/pages/try-the-calendar.astro` | 2026-10-20 | Code + screenshot of the running page | Verified |
| OMC calendar features | ARTICLE_FORMAT.md → Product notes | 2026-10-20 | Repository | Verified |
| OMC prices | `src/config.ts` | 2026-10-20 | Repository | Verified, imported |
| The example week | Illustrative, labeled "for example"; no statistics, no first-person story | — | — | n/a |

## Pinterest research notes

- Researched on: 2026-10-20, separately from Google (web search restricted to pinterest.com, then Pinterest's own topic pages fetched directly).
- Pinterest topic pages observed: "Weekly Family Planner" (guided terms shown: Printable Free, Board, Printable, Template, Week, Whiteboard, Meal); "Monthly Family Calendar" (page showed "54 people searched this", "Last updated 1w"); "Family Week Planner Wall" (page showed "27 people searched this", "Last updated 1w"); "Family Weekly Planner Board" (uk.pinterest.com); "Family weekly planner".
- Autocomplete and Trends: not observed (search renders with JavaScript).
- Details in `pinterest/FP-18.md`.
