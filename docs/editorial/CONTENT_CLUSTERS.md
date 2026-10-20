# Content clusters

The three pillars, the 18 initial articles, what each one targets, and how they connect. Status and dates live in [CONTENT_TRACKER.md](CONTENT_TRACKER.md); linking rules in [INTERNAL_LINKING.md](INTERNAL_LINKING.md); Pinterest planning per article in [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md).

Pillars are defined in code in `src/data/pillars.ts` (id, tracker prefix, name, page copy). URLs: `/resources/topics/<pillar-id>` for the pillar page, `/resources/<slug>` for every article.

| Pillar | Code id | Prefix | Covers | Product anchor |
| --- | --- | --- | --- | --- |
| **Family Planning & Routines** | `family-planning` | FP | Family schedules, the family calendar, home command centers, the weekly reset, meal planning, grocery planning | Wall calendar: daily schedule columns, meal plan, grocery list and to-do list on one weekly page |
| **Simple Home Cleaning** | `home-cleaning` | HC | Daily, weekly and monthly cleaning routines, and realistic catch-up | Companion cleaning website: Daily Reset, weekday zones, weekend options, monthly home projects |
| **Intentional Family Life** | `intentional-family-life` | IF | Family relationships, priorities, prayer, gratitude, personal well-being, shared responsibilities | Wall calendar: self-care habits, word of the week, family and friends, grateful for (prayer and gratitude) |

## How a cluster works

Each pillar has:

- **One pillar guide** (★, `pillarGuide: true`): the broadest article in the cluster. It answers the head query, summarizes the system, and links down to every published article in the cluster.
- **Cluster articles**: each owns a narrower intent, goes deeper on one part of the system, and links up to the pillar guide.
- **A product anchor**: the product the cluster naturally connects to. Mentioned at most once per article.

The clusters connect where real life connects them:

```
             Family Planning & Routines (FP)
             ★ FP-01  How to organize your family's week
                │
   weekly reset ┼── kitchen reset → fridge check before meal planning
   (FP-04)      │   zones written on the calendar / command center
                │
   ┌────────────┴─────────────┐
Simple Home Cleaning (HC)   Intentional Family Life (IF)
★ HC-01 weekly schedule     ★ IF-01 making room for what matters
        └── chores and the daily reset are shared work (IF-02, IF-03) ──┘
   FP-04 weekly reset → the week's priorities, gratitude and prayer (IF-01)
```

## Priority

- **P1**: publish first. The three pillar guides plus the articles with the strongest search demand and product fit.
- **P2**: the core of each cluster.
- **P3**: rounds out the cluster; more competitive, seasonal, or more personal topics that benefit from the rest of the library existing first.

Recommended order: HC-01, FP-05, FP-02, FP-01, HC-02, IF-01, then P2 alternating clusters, then P3.

## Family Planning & Routines (FP)

`family-planning` · Cluster promise: one place for the family's week, one short habit that keeps it true, and dinners decided before 5 pm.

FP-05 (weekly meal planning) is the hub for the meal-planning articles inside this cluster: FP-06 and FP-07 link up to it as well as to FP-01.

| ID | Article | Primary intent | Pri. | Relationships | Overlap boundary |
| --- | --- | --- | --- | --- | --- |
| FP-01 ★ | How to Organize Your Family's Week: A Simple System That Sticks | "how to organize family schedule" · broad how-to | P1 | Links down to FP-02…07. Bridges HC-01, IF-01. Next → FP-02 | The overview: calendar, command center, weekly reset and meals, a section each. Depth lives in the cluster articles. |
| FP-02 | How to Organize a Family Calendar Everyone Actually Uses | "how to organize a family calendar" · how-to | P1 | Parent FP-01. Siblings FP-03, FP-04. Bridges FP-05 (crunch nights → easy dinners), HC-01 (zones on the calendar). Next → FP-03 | Owns calendar format, what goes on it, entry format. Mentions the weekly check and links to FP-04 for the routine. |
| FP-03 | How to Set Up a Home Command Center That Actually Gets Used | "family command center ideas" · how-to / ideas | P2 | Parent FP-01. Siblings FP-02, FP-04. Bridge HC-01. Next → FP-04 | Owns the physical spot: where, what goes there (calendar, papers in/out, keys, lists), and what to leave off. Not a décor roundup. The calendar itself is FP-02. |
| FP-04 | The Weekly Family Reset: 15 Minutes to Plan the Week | "sunday reset routine", "weekly planning routine" · routine | P2 | Parent FP-01. Siblings FP-02, FP-05. Bridges HC-01, IF-01. Next → FP-05 | Owns the weekly planning session (calendar, meals, cleaning, priorities). Links out to each part instead of repeating it. |
| FP-05 | Weekly Meal Planning for Families: Stop Deciding Dinner Every Night | "weekly meal planning for families" · how-to | P1 | Parent FP-01. Links down to FP-06, FP-07. Bridge HC-01 (Thursday fridge check). Next → FP-07 | The 20-minute method and full / short / zero nights. Mentions default dinners and the grocery list briefly; links to FP-07 and FP-06. |
| FP-06 | How to Make a Grocery List From Your Meal Plan | "how to make a grocery list" · how-to | P2 | Parents FP-05, FP-01. Sibling FP-07. Next → FP-04 | Owns the list: staples, store sections, shopping the kitchen first. |
| FP-07 | How to Build a Dinner Rotation Your Family Will Eat | "dinner rotation", "meal rotation ideas" · how-to | P3 | Parents FP-05, FP-01. Sibling FP-06. Next → FP-06 | The system for choosing (default list, theme nights), not a recipe roundup. |
| FP-08 | Command Center Reset: Where Did My Time Go? | "time audit for moms", "where does my time go" · problem-solving | P2 | Parent FP-01. Siblings FP-03, FP-04. Bridge IF-02. Next → FP-04 | Owns finding the week's repeats (questions, searches, re-decisions) and resetting an existing command center to fix them. Setup is FP-03; the weekly session is FP-04. Added 2026-10-13: the Command Center Refresh Sheet links to it. |

## Simple Home Cleaning (HC)

`home-cleaning` · Cluster promise: a house that stays manageable in short daily blocks, with a realistic plan for the missed days.

| ID | Article | Primary intent | Pri. | Relationships | Overlap boundary |
| --- | --- | --- | --- | --- | --- |
| HC-01 ★ | A Weekly Cleaning Schedule for Busy Moms (That Survives a Bad Week) | "weekly cleaning schedule for busy moms" · template / how-to | P1 | Links down to HC-02…05. Bridges FP-02, FP-05. Next → HC-02 | The whole week at a glance (`<CleaningWeek />`) and the skip-don't-stack rule. Each part gets depth elsewhere. |
| HC-02 | The 15-Minute Daily Reset | "daily cleaning routine", "15 minute cleaning routine" · routine | P1 | Parent HC-01. Siblings HC-03, HC-05. Bridge IF-03. Next → HC-03 | Owns the reset: order, timing, doing it with kids, morning vs evening split. |
| HC-03 | Zone Cleaning: One Area a Day, Without the Overwhelm | "zone cleaning schedule" · how-to | P2 | Parent HC-01. Siblings HC-02, HC-04. Next → HC-04 | Owns the method: choosing and sizing zones for your home. HC-01 shows our zones; this teaches building your own. |
| HC-04 | A Monthly Deep Cleaning Plan: One Project a Month | "monthly deep cleaning checklist" · template | P2 | Parent HC-01. Siblings HC-03, HC-05. Next → HC-05 | Built on the 12-month rotation in `src/data/cleaning.ts`; one task per weekend, not a deep-clean marathon. |
| HC-05 | How to Catch Up on Housework When You're Behind | "how to catch up on housework" · problem-solving | P2 | Parent HC-01. Siblings HC-02, HC-04. Next → HC-01 | Recovery, not routine: triage order, the minimum version, then back to the schedule. HC-01's When Life Happens links here. |

## Intentional Family Life (IF)

`intentional-family-life` · Cluster promise: room in a busy week for the people and things that matter, without adding another system to keep up with.

Tone note: prayer and faith are part of the calendar and of many readers' lives. Write about them warmly and practically, without assuming one tradition or preaching. Well-being articles give practical habits, never medical or mental-health advice; link a reputable source or leave the claim out.

| ID | Article | Primary intent | Pri. | Relationships | Overlap boundary |
| --- | --- | --- | --- | --- | --- |
| IF-01 ★ | Intentional Family Life: Making Room for What Matters in a Busy Week | "intentional family living", "how to be intentional with family" · broad how-to | P1 | Links down to IF-02…06. Bridge FP-04. Next → IF-02 | The overview: weekly priorities, time with family and friends, gratitude, prayer, your own well-being, shared work. A section each; depth in the cluster. |
| IF-02 | How to Share the Mental Load at Home | "how to share the mental load" · problem-solving | P2 | Parent IF-01. Sibling IF-03. Bridge FP-03 (visible systems). Next → IF-03 | Practical handoffs: owning whole tasks, visible systems. No unsourced statistics or generalizations about partners. |
| IF-03 | Kids’ Responsibility Chart by Age (Free Printable) | "chores for kids by age" · list + printable | P2 | Parent IF-01. Sibling IF-02. Bridge HC-02, FP-09. Next → HC-02 | Owns age-appropriate chores 2–12 (independent vs with help), teaching without nagging and the free starter chart; links to /chore-chart for custom charts. IF-02 owns whole-task sharing; FP-09 owns morning routines. Rebuilt 2026-10-19 (owner request). |
| IF-04 | A Simple Family Gratitude Habit That Fits a Busy Week | "gratitude practices for families", "family gratitude ideas" · ideas + routine | P3 | Parent IF-01. Siblings IF-05, IF-06. Next → IF-05 | One small, repeatable habit, not a list of 50 activities. No claims about the benefits of gratitude without a linked source. |
| IF-05 | How to Make Time for Prayer as a Busy Mom | "how to make time for prayer as a mom" · how-to | P3 | Parent IF-01. Siblings IF-04, IF-06. Next → IF-06 | Practical: finding a consistent moment, keeping intentions visible. Respectful of different traditions; not theology. |
| IF-06 | Realistic Self-Care for Busy Moms: Small Habits That Fit | "self-care for busy moms" · ideas + how-to | P3 | Parent IF-01. Siblings IF-04, IF-05. Bridge HC-02 ("stop on time"). Next → IF-04 | Small habits tracked weekly. Not medical or mental-health advice. |

## Pillar review (October 2026)

The pillars were changed from *Family Schedules & Routines / Cleaning Routines / Meal Planning* to the three intended pillars above, before any article was published. Nothing was published, so no URLs changed.

| Intended pillar | What the previous plan had | Change |
| --- | --- | --- |
| Family Planning & Routines | Family schedules (FS) and meal planning (MP) as two separate pillars; no command center | Merged into one pillar. Added the home command center (FP-03). Meal planning keeps its own hub article (FP-05). |
| Simple Home Cleaning | Cleaning Routines (CR), including chores for kids | Kept the daily / weekly / monthly / catch-up articles. Chores moved to shared responsibilities (IF-03). |
| Intentional Family Life | Only the mental-load article (inside Family Schedules) | New pillar. Mental load and chores moved here; added the pillar guide, gratitude, prayer and self-care. Relationships and priorities are covered in IF-01. |

ID mapping (old → new): FS-01 → FP-01 · FS-02 → FP-02 · FS-03 → FP-04 · MP-01 → FP-05 (no longer a pillar guide) · MP-02 → FP-06 · MP-03 → FP-07 · CR-01…05 → HC-01…05 · FS-04 → IF-02 · CR-06 → IF-03. New: FP-03, IF-01, IF-04, IF-05, IF-06.

## Backlog

Planned before the review and still worth writing, but outside the initial 18. They keep their research notes from the earlier plan and get an ID in the right pillar when promoted (add a row here and in the tracker).

| Working title | Primary intent | Would go in | Note |
| --- | --- | --- | --- |
| An Evening Routine That Makes Mornings Easier | evening routine for moms | FP | Tomorrow-prep; cleaning parts link to HC-02. |
| A School Morning Routine That Runs Without Nagging | school morning routine for kids | FP | Seasonal: publish July–August. |
| Backup Dinners for Chaotic Nights | easy dinners for busy nights / pantry meals | FP | Food-safety claims need a linked source. |
| Meal Planning on a Budget for Families | budget meal planning for family | FP | No invented savings figures. |
| How to Plan School Lunches for the Week | how to plan school lunches | FP | Seasonal: August–September. Links `/lunch-and-snack-station` (the lunch builder kids follow themselves, and its Monday–Friday lunch plan page). |
| Staying Close to Family and Friends in a Busy Season | staying connected with friends as a busy mom | IF | Uses the calendar's family and friends section. |
| A Summer Bucket List the Kids Help Pick | summer bucket list for kids | IF | Seasonal: publish April–May (large Pinterest search). Ships with a one-page printable at `/summer-bucket-list` built on `ChecklistPages` (kids pick the items, a "one this week" line for the calendar), listed under Free tools. Don't reuse the old members-site list: a generic 35 items, nothing saved, a duplicate tracker and a link to the old June Kit. |
| Backyard Reset Checklist | backyard cleanup checklist / spring yard cleanup | HC | Seasonal: April, with the summer pack. Old members-site tool (six sections: clean & clear, zones, simple beauty, seasonal essentials, safety, optional upgrades; a season picker swapped the essentials list). Keep clean & clear, kid play zone, essentials, safety; drop the project upgrades (speakers, fire pit, raised beds), which aren't a busy-mom reset. Build as one `ChecklistPages` page; the old download was named "Chore_Chart" (copied code). Overlaps the spring checklist's Outdoor & Garage room: link it, don't repeat it. |
| How to Create a Summer Block Schedule (Without Overcomplicating It) | summer block schedule for kids | FP | Seasonal: publish May, alongside the bucket list (each links the other). Printable: `/summer-schedule`, the `/homeschool-rhythm` grid moved into a shared component (blocks Morning / Midday / Afternoon / Evening, starters from the old June Kit example: Adventure, Creative, Connection, Learning, Mom Work). Method from the old Summer Rhythm Builder PDF and companion page: non-negotiable blocks first, then want-to-do blocks, then flexibility (15–30 min buffers, a weekly catch-up block, open blocks), themed days. Optional opener from the old Summer Rhythm survey: two questions (worst time of day; what you need: repeating blocks, things kids do alone, off-duty time for you, structure that isn't rigid) that pick which starter blocks load. The old survey had no plan logic and a placeholder PDF link, so write the plans fresh. Overlap boundary: FP-01 is the school-year week; this is summer only. |

## Adding to a cluster later

New topics go to the end of the relevant table with the next ID (e.g. HC-06), a primary intent that doesn't overlap any existing row, and an overlap boundary. Add the row to [CONTENT_TRACKER.md](CONTENT_TRACKER.md) at the same time. A fourth pillar needs a new entry in `src/data/pillars.ts` (and its prefix) plus a section here.

## Tool-led addition: FP-09

Free morning routine chart generator: a plan kids can follow. URL /resources/morning-routine-chart-generator. Intent: morning routine chart generator. Owns the short school-morning sequence and customizing the existing /routine-chart tool. FP-01 owns the family week; IF-03 owns household chores; FP-04 owns weekly planning. Parent FP-01, bridge/next IF-03. Owner-selected priority October 13, 2026. Supersedes the backlog suggestion to delay the school-morning article until July; publish evergreen now, with seasonal promotion later.

## FP-10: Family launch pad by the door

Owner-requested article /resources/launch-pad-by-the-door. Owns the physical bags/shoes/extras staging area and night-before departure check. FP-03 owns calendar and paper processing; FP-09 owns the get-ready sequence; FP-01 owns weekly planning. Parent FP-01, siblings FP-03/FP-09, next FP-09. No new tool: the existing command-center setup sheet already includes keys, backpacks and ready-to-go papers.

## Decision guides and comparisons (added October 15, 2026)

Test comparison/decision content as roughly **20% of new editorial output**, not a fixed publishing quota or a replacement for practical guides and free tools. Working mix for the next 30 days: 50% practical guides, 30% free tools, 20% decision guides. This is a hypothesis to measure, not a proven optimal ratio. Keep the same three pillars and existing IDs; prioritize based on product fit, distinct search intent, and what the search results actually show.

| ID | Pillar | Proposed article | Priority | Distinct intent and overlap boundary |
| --- | --- | --- | --- | --- |
| FP-11 | FP | Wall Calendar vs. Digital Calendar: What's Better for Busy Families? | First comparison | Decision between physical visibility and digital updates/sharing. Compare a realistic family week; acknowledge when digital-only is better. FP-02 owns how to organize and use a calendar, not format selection. |
| HC-06 | HC | Clean Mama vs. FlyLady: Which Cleaning Routine Fits Busy Moms? | Second comparison | Compare the current, verifiable routines on daily workload, catch-up and family involvement. Recommend either fairly. HC-01 owns OMC's weekly cleaning method, not the third-party head-to-head. Do not suggest affiliation. |
| FP-12 | FP | Best Family Command Center Systems: Which Setup Fits Your Family? | Third comparison | Decision guide comparing distinct setups (wall, digital, hybrid) using a realistic school-and-activities scenario. FP-03 owns how to build and maintain a physical command center; avoid repeating its setup tutorial. |
| FP-14 | FP | Digital Wall Calendars vs. Paper Wall Calendars: Which Fits Your Family? | Fourth comparison (published 2026-10-20) | The category of wall-mounted digital calendar displays (touchscreens, e-paper frames, display apps for a TV or tablet) vs. a paper wall calendar, plus the hybrid; "digital wall calendar vs paper calendar" / "digital family calendar display". Google results share no URLs with FP-17's Skylight query (checked 2026-10-20). FP-11 owns paper vs. phone calendars in general; FP-17 one brand; FP-15 the product roundup. Names only Skylight and Hearth, with prices and plans fetched from their own sites on 2026-10-20. |
| FP-15 | FP | The Best Family Wall Calendars for 2027 | Fifth comparison (owner-assigned, published 2026-10-20) | Product roundup by use case: "best family wall calendar 2027" / "best family calendar for wall". 5–7 picks by family type (column per person, month grid, budget, reusable, meals + chores weekly page, digital); OMC's calendar wins only the weekly meals-and-chores case, and the article says where competitors fit better. Discloses that OMC makes one of the calendars; no testing, ranking or rating claims. Every competitor fact from the seller's own page, dated "as of October 2026"; unverifiable products are omitted. Slug has no year; refresh yearly. FP-11 owns the format decision, FP-14 whether to buy a display, FP-17 the Skylight head-to-head, FP-12 whole setups, FP-02 setup. |
| FP-17 | FP | Skylight Calendar vs. a Paper Wall Calendar: Which Is Worth It for Your Family? | Sixth comparison (briefed 2026-10-19; renumbered FP-14 → FP-15 → FP-17 on 2026-10-20) | One named purchase: a dedicated digital wall display (Skylight) vs. a paper wall calendar, "skylight calendar vs paper calendar" / "is skylight calendar worth it". Say plainly when Skylight is the better buy. FP-14 owns the device category and hybrid (link up to it); FP-11 owns the general wall-vs-digital format decision (Google, Cozi, hybrid); FP-12 the setup roundup; FP-15 the product roundup (Skylight gets one row there, linking here); FP-02 calendar setup. Skylight facts only from its own site, dated. ID FP-13 was already taken by `after-school-routine-for-kids`. |
| FP-18 | FP | Weekly vs. Monthly Wall Calendar: Which Works for a Busy Family? | Seventh comparison (owner-requested as FP-16, filed as FP-18 because FP-16 and FP-17 were taken; published 2026-10-20) | The *view* decision for a paper wall calendar: month, week or both; "weekly vs monthly calendar" / "weekly family calendar vs monthly". Shows one school week in both formats. FP-02 owns setup and entry format, FP-01 the weekly system, FP-11 paper vs. digital, FP-15 which product to buy. Monthly example is the free monthly maker (/try-the-calendar), described as the code does it. |

Tracker IDs added 2026-10-20 for articles published without a row: FP-13 `after-school-routine-for-kids`, IF-07 `bathroom-chores-for-kids`, and **FP-16** `free-weekly-family-planner-printable` (published as FP-07, which stays reserved for the planned dinner rotation article; FP-14, FP-15 and FP-17 are the calendar comparisons).

The comparison is successful when a mom can choose a solution even if she does not buy OMC. Keep the product mention honest: the current offer is a physical wall calendar plus companion cleaning website, **not** a synchronized family calendar app. Link each decision guide up to its pillar guide and contextually to the relevant existing article; add incoming links once published. Track in [CONTENT_TRACKER.md](CONTENT_TRACKER.md).