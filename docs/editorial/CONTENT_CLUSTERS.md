# Content clusters

The three pillars, the 18 initial articles, what each one targets, and how they connect. Status and dates live in [CONTENT_TRACKER.md](CONTENT_TRACKER.md); linking rules in [INTERNAL_LINKING.md](INTERNAL_LINKING.md).

Pillars are defined in code in `src/data/pillars.ts` (id, tracker prefix, name, page copy). URLs: `/resources/topics/<pillar-id>` for the pillar page, `/resources/<slug>` for every article.

## How a cluster works

Each pillar has:

- **One pillar guide** (★, `pillarGuide: true`): the broadest article in the cluster. It answers the head query, summarizes the system, and links down to every published article in the cluster.
- **Five cluster articles**: each owns a narrower intent, goes deeper on one part of the system, and links up to the pillar guide.
- **A product anchor**: the product the cluster naturally connects to. Mentioned at most once per article.

The three clusters connect where real life connects them: the weekly reset (Family) includes planning dinners (Meals) and seeing the cleaning zones (Cleaning); the kitchen reset (Cleaning) includes the fridge check before planning (Meals); chores (Cleaning) are shared work (Family).

```
          Family Schedules & Routines (FS)
            ★ FS-01  How to organize your family's week
               │  weekly reset ⇄ meal planning
               │  shared work  ⇄ chores
   ┌───────────┴────────────┐
Cleaning Routines (CR)   Meal Planning (MP)
★ CR-01 weekly schedule  ★ MP-01 weekly meal planning
         └── kitchen reset → fridge check ──┘
```

## Priority

- **P1**: publish first. The three pillar guides plus the two cluster articles with the strongest search demand and product fit.
- **P2**: the core of each cluster.
- **P3**: rounds out the cluster; more competitive or seasonal.

Recommended order: CR-01, MP-01, FS-02, FS-01, CR-02, then P2 by cluster, alternating clusters so each grows evenly.

## Family Schedules & Routines (FS)

`family-schedules` · Product anchor: **wall calendar** (daily schedule columns, to-do list, meal plan and grocery list on one weekly page).
Cluster promise: one place for the plan, one weekly habit that keeps it true, and routines that run without reminders.

| ID | Article | Primary intent | Pri. | Relationships | Overlap boundary |
| --- | --- | --- | --- | --- | --- |
| FS-01 ★ | How to Organize Your Family's Week: A Simple System That Sticks | "how to organize family schedule" · broad how-to | P1 | Links down to FS-02…06. Bridges to CR-01, MP-01. Next → FS-02 | The overview. Summarizes calendar, weekly reset and routines in a section each; the depth lives in the cluster articles. |
| FS-02 | How to Organize a Family Calendar Everyone Actually Uses | "how to organize a family calendar" · how-to | P1 | Parent FS-01. Siblings FS-03. Bridge MP-01 (crunch nights → easy dinners), CR-01 (zones on the calendar). Next → FS-03 | Owns calendar format, what goes on it, entry format. Mentions the weekly check briefly and links to FS-03 for the full routine. |
| FS-03 | The Weekly Family Reset: 15 Minutes to Plan the Week | "sunday reset routine", "weekly planning routine" · routine/template | P2 | Parent FS-01. Siblings FS-02, FS-04. Bridge MP-01, CR-01. Next → MP-01 | Owns the weekly planning session (calendar + meals + cleaning + family). Links out for each part instead of repeating it. |
| FS-04 | How to Share the Mental Load at Home | "how to share the mental load" · problem-solving | P2 | Parent FS-01. Siblings FS-02, FS-03. Bridge CR-06. Next → CR-06 | Practical handoffs (ownership of whole tasks, visible systems). No unsourced statistics or gender claims. |
| FS-05 | An Evening Routine That Makes Mornings Easier | "evening routine for moms" · routine | P3 | Parent FS-01. Sibling FS-06. Bridge CR-02 (Daily Reset can live in the evening). Next → FS-06 | Owns tomorrow-prep (bags, clothes, lunches, calendar glance). Cleaning is linked to CR-02, not repeated. |
| FS-06 | A School Morning Routine That Runs Without Nagging | "school morning routine for kids" · routine | P3 | Parent FS-01. Sibling FS-05. Bridge MP-06. Next → MP-06 | Mornings only; the night-before prep is FS-05. Seasonal boost July–September. |

## Cleaning Routines (CR)

`cleaning-routines` · Product anchor: **companion cleaning app** (Daily Reset, weekday zones, weekend options, monthly home projects).
Cluster promise: a house that stays manageable in short daily blocks, with a plan for the missed days.

| ID | Article | Primary intent | Pri. | Relationships | Overlap boundary |
| --- | --- | --- | --- | --- | --- |
| CR-01 ★ | A Weekly Cleaning Schedule for Busy Moms (That Survives a Bad Week) | "weekly cleaning schedule for busy moms" · template/how-to | P1 | Links down to CR-02…06. Bridges to FS-02, MP-01. Next → CR-02 | The whole week at a glance (`<CleaningWeek />`) and the skip-don't-stack rule. Each part gets depth elsewhere. |
| CR-02 | The 15-Minute Daily Reset | "daily cleaning routine", "15 minute cleaning routine" · routine | P1 | Parent CR-01. Siblings CR-03, CR-05. Bridge FS-05. Next → FS-05 | Owns the reset: order, timing, doing it with kids, morning vs evening split. |
| CR-03 | Zone Cleaning: One Area a Day, Without the Overwhelm | "zone cleaning schedule" · how-to | P2 | Parent CR-01. Siblings CR-02, CR-04. Next → CR-04 | Owns the method: how to choose and size zones for your home. CR-01 shows our zones; this teaches building your own. |
| CR-04 | A Monthly Deep Cleaning Plan: One Project a Month | "monthly deep cleaning checklist" · template | P2 | Parent CR-01. Siblings CR-03, CR-05. Next → CR-05 | Built on the 12-month rotation in `src/data/cleaning.ts`; one task per weekend, not a deep-clean marathon. |
| CR-05 | How to Catch Up on Housework When You're Behind | "how to catch up on housework" · problem-solving | P2 | Parent CR-01. Siblings CR-02, CR-04. Next → CR-01 | Recovery, not routine: triage order, the minimum version, then back to the schedule. CR-01's When Life Happens links here. |
| CR-06 | Age-Appropriate Chores for Kids (and How to Hand Them Over) | "chores for kids by age" · list + how-to | P3 | Parent CR-01. Sibling CR-02. Bridge FS-04. Next → FS-04 | Competitive list query; differentiate with how to hand a chore over so it sticks. Tie chores to the existing zones. |

## Meal Planning (MP)

`meal-planning` · Product anchor: **wall calendar** (meal plan and grocery list on the same weekly page as the schedule).
Cluster promise: dinner decided once a week, a list that writes itself, and a backup for the night it all goes sideways.

| ID | Article | Primary intent | Pri. | Relationships | Overlap boundary |
| --- | --- | --- | --- | --- | --- |
| MP-01 ★ | Weekly Meal Planning for Families: Stop Deciding Dinner Every Night | "weekly meal planning for families" · how-to | P1 | Links down to MP-02…06. Bridges to FS-02, CR-01 (Thursday fridge check). Next → MP-03 | The 20-minute method and full / short / zero nights. Mentions default dinners, the grocery list and backups briefly; links to MP-03, MP-02, MP-04. |
| MP-02 | How to Make a Grocery List From Your Meal Plan | "how to make a grocery list" · how-to | P2 | Parent MP-01. Siblings MP-05. Next → MP-05 | Owns the list: staples, store sections, shopping the kitchen first. |
| MP-03 | How to Build a Dinner Rotation Your Family Will Eat | "dinner rotation", "meal rotation ideas" · how-to | P2 | Parent MP-01. Siblings MP-04. Next → MP-04 | The system for choosing (default list, theme nights), not a recipe roundup. |
| MP-04 | Backup Dinners for Chaotic Nights | "easy dinners for busy nights", "pantry meals" · list + how-to | P3 | Parent MP-01. Siblings MP-03. Bridge FS-02 (crunch nights). Next → MP-01 | What to keep on hand and when to use it. Ideas are categories and examples, not recipes. Food-safety claims must link a reputable source. |
| MP-05 | Meal Planning on a Budget for Families | "budget meal planning for family" · how-to | P3 | Parent MP-01. Siblings MP-02. Next → MP-04 | Planning habits that save money (shop the kitchen, plan around sales, pantry night). No invented savings figures. |
| MP-06 | How to Plan School Lunches for the Week | "school lunch planning", "how to plan school lunches" · how-to | P3 | Parent MP-01. Bridge FS-06. Next → FS-05 | Rotation and prep for lunches only; dinners belong to MP-01. Seasonal boost August–September. |

## Adding to a cluster later

New topics go to the end of the relevant table with the next ID (e.g. CR-07), a primary intent that doesn't overlap any existing row, and an overlap boundary. Add the row to [CONTENT_TRACKER.md](CONTENT_TRACKER.md) at the same time. A fourth pillar needs a new entry in `src/data/pillars.ts` (and its prefix) plus a section here.
