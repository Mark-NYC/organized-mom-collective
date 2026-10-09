# Content tracker

Status of every planned and published article and its Pinterest pins. Strategy, priority and overlap boundaries: [CONTENT_CLUSTERS.md](CONTENT_CLUSTERS.md). Process: [ARTICLE_WORKFLOW.md](ARTICLE_WORKFLOW.md). Pinterest rules: [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md).

## Columns

- **Status:** `Planned` → `Briefed` (brief in `briefs/`) → `Drafted` (in `src/content/articles/`, `draft: true`) → `Published`.
- **Target links:** P = parent (pillar guide or hub article), S = siblings, B = bridge to another cluster, N = next (frontmatter `next`). Links to articles that aren't published yet are added when they are (see [INTERNAL_LINKING.md](INTERNAL_LINKING.md#maintaining-incoming-links)).
- **Pinterest plan:** `—` (none yet) or `Yes` (complete plan at `pinterest/{ID}.md`).
- **Pins (search / curiosity / save):** the production status of the three pins, in that order, copied from the plan: `planned`, `generated`, `reviewed` or `published`. `—` until the plan exists.

★ = pillar guide.

## Kept in sync automatically

`npm run check:site` fails if:

- a published article's `trackerId`, slug or `published` date doesn't match its row, or a row says `Published` without an article;
- a published article has no Pinterest plan, the plan is incomplete (not exactly three pins, leftover placeholders, wrong ID or URL), or the row's Pinterest plan / Pins columns don't match the plan file.

Keep the table format as is: one row per article, these ten columns, in this order. The check reads it.

## Articles

| ID | Title | Slug | Cluster | Status | Primary intent | Target links | Published | Pinterest plan | Pins (search / curiosity / save) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FP-01 | ★ How to Organize Your Family's Week: A Simple System That Sticks | `how-to-organize-your-familys-week` | Family Planning & Routines | Planned | how to organize family schedule | Children FP-02…07 · B HC-01, IF-01 · N FP-02 | — | — | — |
| FP-02 | How to Organize a Family Calendar Everyone Actually Uses | `how-to-organize-a-family-calendar` | Family Planning & Routines | Planned | how to organize a family calendar | P FP-01 · S FP-03, FP-04 · B FP-05, HC-01 · N FP-03 | — | — | — |
| FP-03 | How to Set Up a Home Command Center That Actually Gets Used | `home-command-center` | Family Planning & Routines | Planned | family command center ideas | P FP-01 · S FP-02, FP-04 · B HC-01 · N FP-04 | — | — | — |
| FP-04 | The Weekly Family Reset: 15 Minutes to Plan the Week | `weekly-family-reset` | Family Planning & Routines | Planned | sunday reset routine / weekly planning routine | P FP-01 · S FP-02, FP-05 · B HC-01, IF-01 · N FP-05 | — | — | — |
| FP-05 | Weekly Meal Planning for Families: Stop Deciding Dinner Every Night | `weekly-meal-planning-for-families` | Family Planning & Routines | Planned | weekly meal planning for families | P FP-01 · Children FP-06, FP-07 · B HC-01 · N FP-07 | — | — | — |
| FP-06 | How to Make a Grocery List From Your Meal Plan | `grocery-list-from-meal-plan` | Family Planning & Routines | Planned | how to make a grocery list | P FP-05, FP-01 · S FP-07 · N FP-04 | — | — | — |
| FP-07 | How to Build a Dinner Rotation Your Family Will Eat | `dinner-rotation` | Family Planning & Routines | Planned | dinner rotation / meal rotation ideas | P FP-05, FP-01 · S FP-06 · N FP-06 | — | — | — |
| HC-01 | ★ A Weekly Cleaning Schedule for Busy Moms (That Survives a Bad Week) | `weekly-cleaning-schedule-for-busy-moms` | Simple Home Cleaning | Planned | weekly cleaning schedule for busy moms | Children HC-02…05 · B FP-02, FP-05 · N HC-02 | — | — | — |
| HC-02 | The 15-Minute Daily Reset | `daily-cleaning-routine` | Simple Home Cleaning | Planned | daily cleaning routine / 15 minute cleaning routine | P HC-01 · S HC-03, HC-05 · B IF-03 · N HC-03 | — | — | — |
| HC-03 | Zone Cleaning: One Area a Day, Without the Overwhelm | `zone-cleaning-schedule` | Simple Home Cleaning | Planned | zone cleaning schedule | P HC-01 · S HC-02, HC-04 · N HC-04 | — | — | — |
| HC-04 | A Monthly Deep Cleaning Plan: One Project a Month | `monthly-deep-cleaning-schedule` | Simple Home Cleaning | Planned | monthly deep cleaning checklist | P HC-01 · S HC-03, HC-05 · N HC-05 | — | — | — |
| HC-05 | How to Catch Up on Housework When You're Behind | `how-to-catch-up-on-housework` | Simple Home Cleaning | Planned | how to catch up on housework | P HC-01 · S HC-02, HC-04 · N HC-01 | — | — | — |
| IF-01 | ★ Intentional Family Life: Making Room for What Matters in a Busy Week | `intentional-family-life` | Intentional Family Life | Planned | intentional family living / how to be intentional with family | Children IF-02…06 · B FP-04 · N IF-02 | — | — | — |
| IF-02 | How to Share the Mental Load at Home | `how-to-share-the-mental-load` | Intentional Family Life | Planned | how to share the mental load | P IF-01 · S IF-03 · B FP-03 · N IF-03 | — | — | — |
| IF-03 | Age-Appropriate Chores for Kids (and How to Hand Them Over) | `chores-for-kids-by-age` | Intentional Family Life | Planned | chores for kids by age | P IF-01 · S IF-02 · B HC-02 · N HC-02 | — | — | — |
| IF-04 | A Simple Family Gratitude Habit That Fits a Busy Week | `family-gratitude-habit` | Intentional Family Life | Planned | gratitude practices for families | P IF-01 · S IF-05, IF-06 · N IF-05 | — | — | — |
| IF-05 | How to Make Time for Prayer as a Busy Mom | `prayer-time-for-busy-moms` | Intentional Family Life | Planned | how to make time for prayer as a mom | P IF-01 · S IF-04, IF-06 · N IF-06 | — | — | — |
| IF-06 | Realistic Self-Care for Busy Moms: Small Habits That Fit | `self-care-for-busy-moms` | Intentional Family Life | Planned | self-care for busy moms | P IF-01 · S IF-04, IF-05 · B HC-02 · N IF-04 | — | — | — |
