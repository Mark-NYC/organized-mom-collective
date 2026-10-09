# Content clusters

The three pillars, the 18 initial articles, what each one targets, and how they connect. Status and dates live in [CONTENT_TRACKER.md](CONTENT_TRACKER.md); linking rules in [INTERNAL_LINKING.md](INTERNAL_LINKING.md); Pinterest planning per article in [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md).

Pillars are defined in code in `src/data/pillars.ts` (id, tracker prefix, name, page copy). URLs: `/resources/topics/<pillar-id>` for the pillar page, `/resources/<slug>` for every article.

| Pillar | Code id | Prefix | Covers | Product anchor |
| --- | --- | --- | --- | --- |
| **Family Planning & Routines** | `family-planning` | FP | Family schedules, the family calendar, home command centers, the weekly reset, meal planning, grocery planning | Wall calendar: daily schedule columns, meal plan, grocery list and to-do list on one weekly page |
| **Simple Home Cleaning** | `home-cleaning` | HC | Daily, weekly and monthly cleaning routines, and realistic catch-up | Companion cleaning app: Daily Reset, weekday zones, weekend options, monthly home projects |
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
| IF-03 | Age-Appropriate Chores for Kids (and How to Hand Them Over) | "chores for kids by age" · list + how-to | P2 | Parent IF-01. Sibling IF-02. Bridge HC-02. Next → HC-02 | Competitive list query; differentiate with how to hand a chore over so it sticks, tied to the existing zones. |
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
| How to Plan School Lunches for the Week | how to plan school lunches | FP | Seasonal: August–September. |
| Staying Close to Family and Friends in a Busy Season | staying connected with friends as a busy mom | IF | Uses the calendar's family and friends section. |

## Adding to a cluster later

New topics go to the end of the relevant table with the next ID (e.g. HC-06), a primary intent that doesn't overlap any existing row, and an overlap boundary. Add the row to [CONTENT_TRACKER.md](CONTENT_TRACKER.md) at the same time. A fourth pillar needs a new entry in `src/data/pillars.ts` (and its prefix) plus a section here.
